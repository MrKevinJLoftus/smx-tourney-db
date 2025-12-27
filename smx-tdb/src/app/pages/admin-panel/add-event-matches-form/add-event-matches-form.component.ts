import { Component, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { Observable, map, switchMap, tap } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { PlayerService } from '../../../services/player.service';
import { MatchService } from '../../../services/match.service';
import { SongService } from '../../../services/song.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { Event } from '../../../models/event';
import { Player } from '../../../models/player';
import { Song } from '../../../models/song';
import { EventMatchesListComponent } from '../event-matches-list/event-matches-list.component';

@Component({
  selector: 'app-add-event-matches-form',
  imports: [SharedModule, EventMatchesListComponent],
  templateUrl: './add-event-matches-form.component.html',
  styleUrl: './add-event-matches-form.component.scss'
})
export class AddEventMatchesFormComponent implements OnInit {
  @ViewChild(EventMatchesListComponent) matchesListComponent!: EventMatchesListComponent;
  matchForm!: FormGroup;
  events$: Observable<Event[]>;
  players$: Observable<Player[]>;
  songs$: Observable<Song[]>;
  isSubmitting = false;
  selectedEventId?: number;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private playerService: PlayerService,
    private matchService: MatchService,
    private songService: SongService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.initForm();
    this.events$ = this.eventService.getEvents();
    this.songs$ = this.songService.getSongs();
    this.players$ = new Observable<Player[]>(subscriber => subscriber.next([]));

    // Load players when event is selected
    this.matchForm.get('event')?.valueChanges.subscribe(event => {
      if (event && event.id) {
        this.selectedEventId = event.id;
        this.players$ = this.playerService.getPlayersByEvent(event.id).pipe(tap(res => console.log(res)));
        // Enable player fields
        this.playersFormArray.controls.forEach(control => control.enable());
        this.matchForm.get('winner')?.enable();
      } else {
        this.selectedEventId = undefined;
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
      // Structure: array of { song_id, player_scores: [{ player_id, score }] }
      const songsData = formValue.songs
        .map((songEntry: any, songIndex: number) => {
          const songObj = songEntry.song;
          // Handle both 'id' (from database) and 'song_id' (from interface)
          const songId = songObj?.id || songObj?.song_id;
          if (!songObj || songObj === '' || !songId) {
            return null;
          }
          
          // Get player scores for this song - get actual form control values
          const playerScoresFormArray = this.getPlayerScoresFormArray(songIndex);
          const playerScores = playerScoresFormArray.controls
            .map((scoreControl: any, playerIndex: number) => {
              const player = playersData[playerIndex];
              if (!player) return null;
              const scoreValue = scoreControl.value;
              const parsedScore = scoreValue !== null && scoreValue !== undefined && scoreValue !== '' 
                ? parseInt(scoreValue, 10) 
                : undefined;
              // Validate score range if provided
              if (parsedScore !== undefined && (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100000)) {
                return null; // Invalid score, will be filtered out
              }
              return {
                player_id: player.player_id,
                score: parsedScore
              };
            })
            .filter((entry: any) => entry !== null);

          // Include song even if no scores are provided (scores can be undefined)
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

      this.matchService.createMatch(matchData).subscribe({
      next: () => {
        this.messageService.show('Match created successfully!');
        // Refresh the matches list
        if (this.matchesListComponent) {
          this.matchesListComponent.loadMatches();
        }
        // Keep the event selected, only reset other fields
        const selectedEvent = this.matchForm.get('event')?.value;
        this.matchForm.reset();
        this.matchForm.get('event')?.setValue(selectedEvent);
        // Reset players to 2 default
        while (this.playersFormArray.length > 0) {
          this.playersFormArray.removeAt(0);
        }
        this.addPlayer();
        this.addPlayer();
        // Reset songs array to have one empty field
        while (this.songsFormArray.length > 0) {
          this.songsFormArray.removeAt(0);
        }
        this.addSong();
        this.matchForm.get('round')?.setValue('');
        this.matchForm.get('winner')?.setValue('');
        // Keep fields enabled if event is still selected
        if (selectedEvent) {
          this.playersFormArray.controls.forEach(control => control.enable());
          this.matchForm.get('winner')?.enable();
        } else {
          this.playersFormArray.controls.forEach(control => control.disable());
          this.matchForm.get('winner')?.disable();
        }
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
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

  loadMatches(): void {
    if (this.matchesListComponent) {
      this.matchesListComponent.loadMatches();
    }
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
    // Update song score fields when a player is added
    this.updateSongScoreFields();
  }

  removePlayer(index: number): void {
    if (this.playersFormArray.length <= 2) {
      this.messageService.show('At least 2 players are required.');
      return;
    }
    this.playersFormArray.removeAt(index);
    // Update song score fields when a player is removed
    this.updateSongScoreFields();
    this.updateWinnerOptions();
  }

  addSong(): void {
    const numPlayers = this.playersFormArray.length;
    const playerScores = this.fb.array([]);
    // Initialize score fields for all current players
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
    // Ensure at least one song field remains
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
}
