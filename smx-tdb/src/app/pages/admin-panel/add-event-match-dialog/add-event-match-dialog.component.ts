import { Component, OnInit, Inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SharedModule } from '../../../shared/shared.module';
import { Observable, tap } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { PlayerService } from '../../../services/player.service';
import { MatchService } from '../../../services/match.service';
import { SongService } from '../../../services/song.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { Event } from '../../../models/event';
import { Player } from '../../../models/player';
import { Song } from '../../../models/song';

@Component({
  selector: 'app-add-event-match-dialog',
  templateUrl: './add-event-match-dialog.component.html',
  styleUrls: ['./add-event-match-dialog.component.scss'],
  imports: [SharedModule, MatDialogModule]
})
export class AddEventMatchDialogComponent implements OnInit {
  matchForm!: FormGroup;
  events$: Observable<Event[]>;
  players$: Observable<Player[]>;
  songs$: Observable<Song[]>;
  isSubmitting = false;
  isEditMode = false;
  matchId?: number;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private playerService: PlayerService,
    private matchService: MatchService,
    private songService: SongService,
    private messageService: MessageService,
    private loadingService: LoadingService,
    public dialogRef: MatDialogRef<AddEventMatchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      eventId?: number; 
      matchId?: number;
      match?: any;
      onSuccess?: () => void 
    }
  ) {
    this.initForm();
    this.events$ = this.eventService.getEvents();
    this.songs$ = this.songService.getSongs();
    this.players$ = new Observable<Player[]>(subscriber => subscriber.next([]));

    // Load players when event is selected
    this.matchForm.get('event')?.valueChanges.subscribe(event => {
      if (event && event.id) {
        this.players$ = this.playerService.getPlayersByEvent(event.id).pipe(tap(res => console.log(res)));
        // Enable player fields
        this.playersFormArray.controls.forEach(control => control.enable());
        this.matchForm.get('winner')?.enable();
      } else {
        this.players$ = new Observable<Player[]>(subscriber => subscriber.next([]));
        // Disable player fields
        this.playersFormArray.controls.forEach(control => control.disable());
        this.matchForm.get('winner')?.disable();
      }
    });

    // Update winner options when players change
    this.playersFormArray.valueChanges.subscribe(() => {
      this.updateWinnerOptions();
      this.updateSongScoreFields();
    });

    // If eventId is provided, set it
    if (data?.eventId) {
      this.events$.subscribe(events => {
        const event = events.find(e => e.id === data.eventId);
        if (event) {
          this.matchForm.get('event')?.setValue(event);
        }
      });
    }

    // If in edit mode, prepopulate the form
    this.isEditMode = !!data?.matchId;
    this.matchId = data?.matchId;
    if (this.isEditMode && data?.match) {
      this.prepopulateForm(data.match);
    }
  }

  ngOnInit(): void {
    // Forms are initialized in constructor
  }

  initForm(): void {
    this.matchForm = this.fb.group({
      event: ['', Validators.required],
      players: this.fb.array([], [Validators.required, this.minPlayersValidator(2)]),
      songs: this.fb.array([]),
      round: [''],
      winner: new FormControl({ value: '', disabled: true })
    });
    // Start with 2 players
    this.addPlayer();
    this.addPlayer();
    // Start with one empty song field
    this.addSong();
  }

  minPlayersValidator(min: number) {
    return (control: any) => {
      if (!(control instanceof FormArray)) {
        return null;
      }
      const validPlayers = control.controls.filter((c: any) => c.get('player')?.value && c.get('player')?.value !== '');
      return validPlayers.length >= min ? null : { minPlayers: { required: min, actual: validPlayers.length } };
    };
  }

  private updateWinnerOptions(): void {
    const players = this.playersFormArray.controls
      .map(control => control.get('player')?.value)
      .filter((player: any) => player && player !== '');
    const currentWinner = this.matchForm.get('winner')?.value;

    // Reset winner if current selection is no longer valid
    if (currentWinner && !players.includes(currentWinner)) {
      this.matchForm.get('winner')?.setValue('');
    }
  }

  private updateSongScoreFields(): void {
    const numPlayers = this.playersFormArray.length;
    this.songsFormArray.controls.forEach((songControl, songIndex) => {
      const songGroup = songControl as FormGroup;
      const currentScores = songGroup.get('playerScores') as FormArray;
      const currentLength = currentScores.length;

      // Add score fields if players increased
      if (currentLength < numPlayers) {
        for (let i = currentLength; i < numPlayers; i++) {
          currentScores.push(this.fb.control('', [Validators.min(0), Validators.max(100000)]));
        }
      }
      // Remove score fields if players decreased
      else if (currentLength > numPlayers) {
        for (let i = currentLength - 1; i >= numPlayers; i--) {
          currentScores.removeAt(i);
        }
      }
    });
  }

  onSubmit(): void {
    if (this.matchForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);

      const formValue = this.matchForm.value;
      const event: Event = formValue.event;
      const winner: Player = formValue.winner;

      // Extract players, ensuring at least 2 and all are different
      const playersData = formValue.players
        .map((playerEntry: any) => {
          const playerObj = playerEntry.player;
          if (!playerObj || playerObj === '' || !playerObj.player_id) {
            return null;
          }
          return playerObj;
        })
        .filter((player: any) => player !== null);

      if (playersData.length < 2) {
        this.messageService.show('At least 2 players are required.');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
        return;
      }

      // Check for duplicate players
      const playerIds = playersData.map((p: Player) => p.player_id);
      const uniquePlayerIds = new Set(playerIds);
      if (uniquePlayerIds.size !== playerIds.length) {
        this.messageService.show('All players must be different.');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
        return;
      }

      // Validate score fields before processing
      let hasInvalidScore = false;
      this.songsFormArray.controls.forEach((songControl: any, songIndex: number) => {
        const playerScoresFormArray = this.getPlayerScoresFormArray(songIndex);
        playerScoresFormArray.controls.forEach((scoreControl: any, playerIndex: number) => {
          const scoreValue = scoreControl.value;
          if (scoreValue !== null && scoreValue !== undefined && scoreValue !== '') {
            const parsedScore = parseInt(scoreValue, 10);
            if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100000) {
              hasInvalidScore = true;
            }
          }
        });
      });
      if (hasInvalidScore) {
        this.messageService.show('Scores must be between 0 and 100,000.');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
        return;
      }

      // Extract songs with player scores
      const songsData = formValue.songs
        .map((songEntry: any, songIndex: number) => {
          const songObj = songEntry.song;
          const songId = songObj?.id || songObj?.song_id;
          if (!songObj || songObj === '' || !songId) {
            return null;
          }
          
          const playerScoresFormArray = this.getPlayerScoresFormArray(songIndex);
          const playerScores = playerScoresFormArray.controls
            .map((scoreControl: any, playerIndex: number) => {
              const player = playersData[playerIndex];
              if (!player) return null;
              const scoreValue = scoreControl.value;
              const parsedScore = scoreValue !== null && scoreValue !== undefined && scoreValue !== '' 
                ? parseInt(scoreValue, 10) 
                : undefined;
              if (parsedScore !== undefined && (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100000)) {
                return null;
              }
              return {
                player_id: player.player_id,
                score: parsedScore
              };
            })
            .filter((entry: any) => entry !== null);

          return {
            song_id: songId,
            player_scores: playerScores
          };
        })
        .filter((entry: any) => entry !== null);

      const matchData = {
        event_id: event.id!,
        player_ids: playerIds,
        songs: songsData.length > 0 ? songsData : undefined,
        winner_id: winner && winner.player_id ? winner.player_id : undefined
      };

      console.log('Match data being sent:', JSON.stringify(matchData, null, 2));

      if (this.isEditMode && this.matchId) {
        // Update existing match
        this.matchService.updateMatch(this.matchId, matchData).subscribe({
          next: () => {
            this.messageService.show('Match updated successfully!');
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
            // Call the success callback if provided
            if (this.data?.onSuccess) {
              this.data.onSuccess();
            }
            this.dialogRef.close(true);
          },
          error: (error) => {
            console.error('Error updating match:', error);
            const errorMessage = error.error?.message || 'Failed to update match. Please try again.';
            this.messageService.show(errorMessage);
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
          }
        });
      } else {
        // Create new match
        this.matchService.createMatch(matchData).subscribe({
          next: () => {
            this.messageService.show('Match created successfully!');
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
            // Call the success callback if provided
            if (this.data?.onSuccess) {
              this.data.onSuccess();
            }
            this.dialogRef.close(true);
          },
          error: (error) => {
            console.error('Error creating match:', error);
            const errorMessage = error.error?.message || 'Failed to create match. Please try again.';
            this.messageService.show(errorMessage);
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
          }
        });
      }
    }
  }

  private prepopulateForm(match: any): void {
    // Set event first
    this.events$.subscribe(events => {
      const event = events.find(e => e.id === match.event_id);
      if (event) {
        // Temporarily disable valueChanges to prevent it from interfering
        const eventControl = this.matchForm.get('event');
        if (eventControl) {
          // Set the event value without triggering valueChanges
          eventControl.setValue(event, { emitEvent: false });
        }
        
        // Load players for the event directly
        this.players$ = this.playerService.getPlayersByEvent(match.event_id);
        
        // Clear existing players and add match players
        while (this.playersFormArray.length > 0) {
          this.playersFormArray.removeAt(0);
        }
        
        // Wait for players to load, then populate
        this.players$.subscribe(availablePlayers => {
          if (match.players && match.players.length > 0) {
            match.players.forEach((matchPlayer: any) => {
              // Find the player object from available players
              // getPlayersByEvent returns data with both 'id' (from p.id) and 'player_id' (from ep.player_id)
              // Match players have 'player_id', so we need to match on either
              const playerObj = availablePlayers.find((p: any) => {
                const pId = p.player_id || p.id;
                return pId === matchPlayer.player_id;
              });
              
              if (playerObj) {
                // Ensure the player object has player_id for consistency with the Player interface
                // Use the original object reference so mat-select can match it
                if (!playerObj.player_id && (playerObj as any).id) {
                  playerObj.player_id = (playerObj as any).id;
                }
                if (!playerObj.username && (playerObj as any).gamertag) {
                  playerObj.username = (playerObj as any).gamertag;
                }
                
                const playerGroup = this.fb.group({
                  player: new FormControl({ value: playerObj, disabled: false }, Validators.required)
                });
                this.playersFormArray.push(playerGroup);
              }
            });
            
            // Enable player fields after populating
            this.playersFormArray.controls.forEach(control => control.enable());
            this.updateSongScoreFields();
            
            // Set winner after players are loaded
            if (match.winner && match.winner.player_id) {
              const winnerPlayer = this.playersFormArray.controls
                .map(control => control.get('player')?.value)
                .find((p: Player) => {
                  const pId = p.player_id;
                  return pId === match.winner.player_id;
                });
              if (winnerPlayer) {
                this.matchForm.get('winner')?.setValue(winnerPlayer);
                this.matchForm.get('winner')?.enable();
              }
            }
          }
        });
      }
    });

    // Clear existing songs and add match songs
    // Wait for both players and songs to be loaded before populating
    while (this.songsFormArray.length > 0) {
      this.songsFormArray.removeAt(0);
    }

    // Use combineLatest or nested subscribe to ensure both are loaded
    this.players$.subscribe(availablePlayers => {
      this.songs$.subscribe(availableSongs => {
        if (match.songs && match.songs.length > 0) {
          match.songs.forEach((matchSong: any) => {
            // Songs from database have 'id', match songs have 'song_id'
            // Handle both cases for matching
            const songObj = availableSongs.find((s: Song) => {
              const songId = s.song_id || (s as any).id;
              return songId === matchSong.song_id;
            });
            
            if (songObj) {
              const numPlayers = this.playersFormArray.length;
              const playerScores = this.fb.array([]);
              
              // Populate scores for each player
              for (let i = 0; i < numPlayers; i++) {
                const player = this.playersFormArray.at(i).get('player')?.value;
                if (player && matchSong.player_scores) {
                  const playerScore = matchSong.player_scores.find((ps: any) => ps.player_id === player.player_id);
                  const scoreValue = playerScore?.score !== undefined && playerScore.score !== null ? playerScore.score : '';
                  playerScores.push(this.fb.control(scoreValue, [Validators.min(0), Validators.max(100000)]));
                } else {
                  playerScores.push(this.fb.control('', [Validators.min(0), Validators.max(100000)]));
                }
              }
              
              // Ensure song object has song_id for consistency
              const songToUse: any = { ...songObj };
              if (!songToUse.song_id && songToUse.id) {
                songToUse.song_id = songToUse.id;
              }
              
              const songGroup = this.fb.group({
                song: [songToUse],
                playerScores: playerScores
              });
              this.songsFormArray.push(songGroup);
            }
          });
        } else {
          // If no songs, add one empty song field
          this.addSong();
        }
      });
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getWinnerOptions(): Player[] {
    return this.playersFormArray.controls
      .map(control => control.get('player')?.value)
      .filter((player: any) => player && player !== '') as Player[];
  }

  get playersFormArray(): FormArray {
    return this.matchForm.get('players') as FormArray;
  }

  get songsFormArray(): FormArray {
    return this.matchForm.get('songs') as FormArray;
  }

  addPlayer(): void {
    const playerGroup = this.fb.group({
      player: new FormControl({ value: '', disabled: true }, Validators.required)
    });
    this.playersFormArray.push(playerGroup);
    this.updateSongScoreFields();
  }

  removePlayer(index: number): void {
    if (this.playersFormArray.length <= 2) {
      this.messageService.show('At least 2 players are required.');
      return;
    }
    this.playersFormArray.removeAt(index);
    this.updateSongScoreFields();
    this.updateWinnerOptions();
  }

  addSong(): void {
    const numPlayers = this.playersFormArray.length;
    const playerScores = this.fb.array([]);
    for (let i = 0; i < numPlayers; i++) {
      playerScores.push(this.fb.control('', [Validators.min(0), Validators.max(100000)]));
    }
    const songGroup = this.fb.group({
      song: [''],
      playerScores: playerScores
    });
    this.songsFormArray.push(songGroup);
  }

  removeSong(index: number): void {
    this.songsFormArray.removeAt(index);
    if (this.songsFormArray.length === 0) {
      this.addSong();
    }
  }

  getSongFormGroup(index: number): FormGroup {
    return this.songsFormArray.at(index) as FormGroup;
  }

  getPlayerScoresFormArray(songIndex: number): FormArray {
    return this.getSongFormGroup(songIndex).get('playerScores') as FormArray;
  }

  comparePlayers(player1: Player | null, player2: Player | null): boolean {
    if (!player1 || !player2) {
      return player1 === player2;
    }
    const id1 = player1.player_id;
    const id2 = player2.player_id;
    return id1 !== undefined && id2 !== undefined && id1 === id2;
  }

  compareSongs(song1: Song | null, song2: Song | null): boolean {
    if (!song1 || !song2) {
      return song1 === song2;
    }
    const id1 = song1.song_id || (song1 as any).id;
    const id2 = song2.song_id || (song2 as any).id;
    return id1 !== undefined && id2 !== undefined && id1 === id2;
  }
}

