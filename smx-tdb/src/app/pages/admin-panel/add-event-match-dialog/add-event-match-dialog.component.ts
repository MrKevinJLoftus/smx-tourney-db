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
import { Chart } from '../../../models/chart';

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
  chartsBySongIndex: Map<number, Chart[]> = new Map();
  reportingMode: 'wld' | 'songs' | null = null; // null = not selected yet, 'wld' = W-L-D stats, 'songs' = songs

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
      // Determine reporting mode based on existing match data
      if (data.match.songs && data.match.songs.length > 0) {
        this.reportingMode = 'songs';
      } else if (data.match.player_stats && data.match.player_stats.length > 0) {
        this.reportingMode = 'wld';
      } else {
        // Default to W-L-D if no data exists
        this.reportingMode = 'wld';
      }
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
    // Don't add song by default - wait for user to select reporting mode
    
    // Subscribe to songs changes to auto-calculate W-L-D and update field states
    // Only calculate from songs if in 'songs' mode
    this.songsFormArray.valueChanges.subscribe(() => {
      if (this.reportingMode === 'songs') {
        this.calculateWLDFromSongs();
      }
      this.updateWLDFieldStates();
    });
  }

  setReportingMode(mode: 'wld' | 'songs' | null): void {
    // Handle null case (when toggle is deselected)
    if (mode === null) {
      return;
    }
    
    this.reportingMode = mode;
    
    if (mode === 'songs') {
      // Clear W-L-D fields and ensure at least one song exists
      this.playersFormArray.controls.forEach(control => {
        control.get('wins')?.setValue(0, { emitEvent: false });
        control.get('losses')?.setValue(0, { emitEvent: false });
        control.get('draws')?.setValue(0, { emitEvent: false });
        control.get('wins')?.disable();
        control.get('losses')?.disable();
        control.get('draws')?.disable();
      });
      
      // Add a song if none exist
      if (this.songsFormArray.length === 0) {
        this.addSong();
      }
    } else if (mode === 'wld') {
      // Clear songs and enable W-L-D fields
      while (this.songsFormArray.length > 0) {
        this.songsFormArray.removeAt(0);
      }
      
      // Explicitly enable W-L-D fields
      this.playersFormArray.controls.forEach(control => {
        control.get('wins')?.enable();
        control.get('losses')?.enable();
        control.get('draws')?.enable();
      });
      
      // Ensure field states are correct
      this.updateWLDFieldStates();
    }
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
    // Recalculate W-L-D after updating score fields (only if in songs mode)
    if (this.reportingMode === 'songs') {
      this.calculateWLDFromSongs();
    }
  }

  private updateWLDFieldStates(): void {
    // Only update field states based on reporting mode
    // If in 'wld' mode, fields should always be enabled
    // If in 'songs' mode, fields should be disabled (auto-calculated)
    // If reportingMode is null, enable fields by default (for new matches before mode selection)
    if (this.reportingMode === 'wld' || this.reportingMode === null) {
      // Enable W-L-D fields when in W-L-D mode or when mode hasn't been selected yet
      this.playersFormArray.controls.forEach(control => {
        control.get('wins')?.enable();
        control.get('losses')?.enable();
        control.get('draws')?.enable();
      });
    } else if (this.reportingMode === 'songs') {
      // Disable W-L-D fields when in songs mode (auto-calculation is mandatory)
      this.playersFormArray.controls.forEach(control => {
        control.get('wins')?.disable();
        control.get('losses')?.disable();
        control.get('draws')?.disable();
      });
    }
  }

  private calculateWLDFromSongs(): void {
    // Get all valid players
    const players = this.playersFormArray.controls
      .map(control => control.get('player')?.value)
      .filter((player: any) => player && player !== '' && player.player_id) as Player[];

    if (players.length === 0) {
      return;
    }

    // Initialize W-L-D stats for each player
    const stats = new Map<number, { wins: number; losses: number; draws: number }>();
    players.forEach(player => {
      stats.set(player.player_id!, { wins: 0, losses: 0, draws: 0 });
    });

    // Process each song
    this.songsFormArray.controls.forEach((songControl, songIndex) => {
      const songGroup = songControl as FormGroup;
      const song = songGroup.get('song')?.value;
      
      if (!song || song === '' || !song.song_id) {
        return; // Skip invalid songs
      }

      const playerScoresFormArray = songGroup.get('playerScores') as FormArray;
      const validScores: Array<{ player_id: number; score: number }> = [];

      // Collect valid scores
      playerScoresFormArray.controls.forEach((scoreControl, playerIndex) => {
        const player = players[playerIndex];
        if (!player) return;
        
        const scoreValue = scoreControl.value;
        if (scoreValue !== null && scoreValue !== undefined && scoreValue !== '') {
          const parsedScore = parseInt(scoreValue, 10);
          if (!isNaN(parsedScore) && parsedScore >= 0) {
            validScores.push({
              player_id: player.player_id!,
              score: parsedScore
            });
          }
        }
      });

      if (validScores.length === 0) {
        return; // Skip songs with no valid scores
      }

      // Find max and min scores
      const scores = validScores.map(ps => ps.score);
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);

      // Find players with max score (winners or draws)
      const maxScorePlayers = validScores.filter(ps => ps.score === maxScore).map(ps => ps.player_id);
      // Find players with min score
      const minScorePlayers = validScores.filter(ps => ps.score === minScore).map(ps => ps.player_id);

      // If all players have the same score, it's a draw for all
      if (maxScore === minScore) {
        maxScorePlayers.forEach(playerId => {
          const playerStats = stats.get(playerId);
          if (playerStats) {
            playerStats.draws++;
          }
        });
      } else {
        // If only one winner, they win; others lose
        if (maxScorePlayers.length === 1) {
          const winnerId = maxScorePlayers[0];
          const winnerStats = stats.get(winnerId);
          if (winnerStats) {
            winnerStats.wins++;
          }

          // All other players lose
          validScores.forEach(ps => {
            if (ps.player_id !== winnerId) {
              const playerStats = stats.get(ps.player_id);
              if (playerStats) {
                playerStats.losses++;
              }
            }
          });
        } else {
          // Multiple players tied for highest score - all get a draw
          maxScorePlayers.forEach(playerId => {
            const playerStats = stats.get(playerId);
            if (playerStats) {
              playerStats.draws++;
            }
          });

          // Players with lower scores lose
          validScores.forEach(ps => {
            if (!maxScorePlayers.includes(ps.player_id)) {
              const playerStats = stats.get(ps.player_id);
              if (playerStats) {
                playerStats.losses++;
              }
            }
          });
        }
      }
    });

    // Update W-L-D fields in player form groups
    this.playersFormArray.controls.forEach((playerControl, index) => {
      const playerGroup = playerControl as FormGroup;
      const player = playerGroup.get('player')?.value as Player;
      
      if (player && player.player_id) {
        const playerStats = stats.get(player.player_id);
        if (playerStats) {
          // Update W-L-D fields without triggering valueChanges to avoid infinite loop
          const winsControl = playerGroup.get('wins');
          const lossesControl = playerGroup.get('losses');
          const drawsControl = playerGroup.get('draws');
          
          if (winsControl) {
            winsControl.setValue(playerStats.wins, { emitEvent: false });
          }
          if (lossesControl) {
            lossesControl.setValue(playerStats.losses, { emitEvent: false });
          }
          if (drawsControl) {
            drawsControl.setValue(playerStats.draws, { emitEvent: false });
          }
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

      // Validate reporting mode is selected
      if (!this.reportingMode) {
        this.messageService.show('Please select a reporting method (W-L-D Stats or Songs).');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
        return;
      }

      // Determine which data to send based on reporting mode
      let matchData: any = {
        event_id: event.id!,
        player_ids: playerIds,
        winner_id: winner && winner.player_id ? winner.player_id : undefined
      };

      if (this.reportingMode === 'songs') {
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

            // Get chart_id from the form
            const chartObj = songEntry.chart;
            const chartId = chartObj && typeof chartObj === 'object' ? chartObj.id : (chartObj || null);

            return {
              song_id: songId,
              chart_id: chartId,
              player_scores: playerScores
            };
          })
          .filter((entry: any) => entry !== null);
        
        matchData.songs = songsData.length > 0 ? songsData : undefined;
      } else if (this.reportingMode === 'wld') {
        // Extract W-L-D stats from form
        const playerStats = formValue.players
          .map((playerEntry: any, index: number) => {
            const playerObj = playerEntry.player;
            if (!playerObj || playerObj === '' || !playerObj.player_id) {
              return null;
            }
            return {
              player_id: playerObj.player_id,
              wins: playerEntry.wins || 0,
              losses: playerEntry.losses || 0,
              draws: playerEntry.draws || 0
            };
          })
          .filter((stat: any) => stat !== null);
        
        matchData.player_stats = playerStats;
      }

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
                
                // Find W-L-D stats for this player
                const playerStats = match.player_stats?.find((ps: any) => ps.player_id === playerObj.player_id);
                
                const playerGroup = this.fb.group({
                  player: new FormControl({ value: playerObj, disabled: false }, Validators.required),
                  wins: new FormControl({ 
                    value: playerStats?.wins || 0, 
                    disabled: false 
                  }, [Validators.min(0), Validators.required]),
                  losses: new FormControl({ 
                    value: playerStats?.losses || 0, 
                    disabled: false 
                  }, [Validators.min(0), Validators.required]),
                  draws: new FormControl({ 
                    value: playerStats?.draws || 0, 
                    disabled: false 
                  }, [Validators.min(0), Validators.required])
                });
                this.playersFormArray.push(playerGroup);
              }
            });
            
            // Enable player fields after populating
            this.playersFormArray.controls.forEach(control => control.enable());
            this.updateSongScoreFields();
            
            // Disable W-L-D fields if songs exist (since auto-calculation is mandatory)
            const hasSongs = match.songs && match.songs.length > 0;
            this.playersFormArray.controls.forEach(control => {
              if (hasSongs) {
                control.get('wins')?.disable();
                control.get('losses')?.disable();
                control.get('draws')?.disable();
              }
            });
            
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
                chart: [''],
                playerScores: playerScores
              });
              this.songsFormArray.push(songGroup);
              
              // Setup chart loading for this song
              const songIndex = this.songsFormArray.length - 1;
              this.setupSongChartLoading(songIndex);
              
              // Load charts and set chart if available
              const songId = songToUse.song_id || songToUse.id;
              if (songId) {
                this.songService.getChartsBySong(songId).subscribe({
                  next: (charts: Chart[]) => {
                    this.chartsBySongIndex.set(songIndex, charts);
                    // Try to find and set the chart if matchSong has chart_id
                    if (matchSong.chart_id && charts.length > 0) {
                      const chartObj = charts.find(c => c.id === matchSong.chart_id);
                      if (chartObj) {
                        const songGroupToUpdate = this.getSongFormGroup(songIndex);
                        songGroupToUpdate.get('chart')?.setValue(chartObj, { emitEvent: false });
                      }
                    }
                  },
                  error: (error) => {
                    console.error('Error loading charts:', error);
                    this.chartsBySongIndex.set(songIndex, []);
                  }
                });
              }
            }
          });
          
          // Recalculate W-L-D from songs after loading (if songs exist)
          if (match.songs && match.songs.length > 0) {
            this.calculateWLDFromSongs();
          }
        } else if (this.reportingMode === 'songs') {
          // If no songs but in songs mode, add one empty song field
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
      player: new FormControl({ value: '', disabled: true }, Validators.required),
      wins: new FormControl({ value: 0, disabled: false }, [Validators.min(0), Validators.required]),
      losses: new FormControl({ value: 0, disabled: false }, [Validators.min(0), Validators.required]),
      draws: new FormControl({ value: 0, disabled: false }, [Validators.min(0), Validators.required])
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
      chart: [''],
      playerScores: playerScores
    });
    this.songsFormArray.push(songGroup);

    // Subscribe to song changes to load charts
    const songIndex = this.songsFormArray.length - 1;
    this.setupSongChartLoading(songIndex);
    
    // Update W-L-D field states after adding song
    this.updateWLDFieldStates();
  }

  removeSong(index: number): void {
    this.songsFormArray.removeAt(index);
    if (this.songsFormArray.length === 0) {
      this.addSong();
    }
    // Update W-L-D field states after removing song
    this.updateWLDFieldStates();
  }

  getSongFormGroup(index: number): FormGroup {
    return this.songsFormArray.at(index) as FormGroup;
  }

  getPlayerScoresFormArray(songIndex: number): FormArray {
    return this.getSongFormGroup(songIndex).get('playerScores') as FormArray;
  }

  getChartsForSongIndex(songIndex: number): Chart[] {
    return this.chartsBySongIndex.get(songIndex) || [];
  }

  private setupSongChartLoading(songIndex: number): void {
    const songGroup = this.getSongFormGroup(songIndex);
    const songControl = songGroup.get('song');
    const chartControl = songGroup.get('chart');

    if (!songControl || !chartControl) return;

    songControl.valueChanges.subscribe((selectedSong: Song | string) => {
      // Clear chart when song changes
      chartControl.setValue('', { emitEvent: false });
      
      if (selectedSong && typeof selectedSong !== 'string') {
        const songId = (selectedSong as any).id || selectedSong.song_id;
        if (songId) {
          // Load charts for this song
          this.songService.getChartsBySong(songId).subscribe({
            next: (charts: Chart[]) => {
              this.chartsBySongIndex.set(songIndex, charts);
            },
            error: (error) => {
              console.error('Error loading charts:', error);
              this.chartsBySongIndex.set(songIndex, []);
            }
          });
        } else {
          this.chartsBySongIndex.set(songIndex, []);
        }
      } else {
        this.chartsBySongIndex.set(songIndex, []);
      }
    });
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

