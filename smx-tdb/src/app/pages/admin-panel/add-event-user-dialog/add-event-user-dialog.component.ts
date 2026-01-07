import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SharedModule } from '../../../shared/shared.module';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, startWith, map, takeUntil } from 'rxjs/operators';
import { EventService } from '../../../services/event.service';
import { PlayerService } from '../../../services/player.service';
import { EventPlayerService } from '../../../services/eventPlayer.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { Event } from '../../../models/event';
import { Player } from '../../../models/player';

@Component({
  selector: 'app-add-event-user-dialog',
  templateUrl: './add-event-user-dialog.component.html',
  styleUrls: ['./add-event-user-dialog.component.scss'],
  imports: [SharedModule, MatDialogModule]
})
export class AddEventUserDialogComponent implements OnInit, OnDestroy {
  userForm!: FormGroup;
  events$: Observable<Event[]>;
  isSubmitting = false;
  isEditMode = false;
  eventPlayerId?: number;
  filteredPlayers$!: Observable<Player[]>;
  selectedPlayer: Player | null = null;
  isCreatingNewPlayer = false;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private playerService: PlayerService,
    private eventPlayerService: EventPlayerService,
    private messageService: MessageService,
    private loadingService: LoadingService,
    public dialogRef: MatDialogRef<AddEventUserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      eventId?: number; 
      eventPlayerId?: number;
      player?: { id: number; username: string; pronouns?: string };
      seed?: number;
      place?: number;
      onSuccess?: () => void 
    }
  ) {
    this.initForm();
    this.events$ = this.eventService.getEvents();
    this.isEditMode = !!data?.eventPlayerId;
    this.eventPlayerId = data?.eventPlayerId;
    
    // Setup autocomplete filtering
    this.setupAutocomplete();

    // Enable/disable form fields based on event selection
    this.userForm.get('event')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(event => {
      if (event) {
        if (!this.isEditMode) {
          this.userForm.get('playerInput')?.enable();
        }
        this.userForm.get('pronouns')?.enable();
        this.userForm.get('seed')?.enable();
        this.userForm.get('place')?.enable();
      } else {
        this.userForm.get('playerInput')?.disable();
        this.userForm.get('pronouns')?.disable();
        this.userForm.get('seed')?.disable();
        this.userForm.get('place')?.disable();
      }
    });

    // If eventId is provided, set it
    if (data?.eventId) {
      this.events$.subscribe(events => {
        const event = events.find(e => e.id === data.eventId);
        if (event) {
          this.userForm.get('event')?.setValue(event);
        }
      });
    }

    // If in edit mode, prepopulate the form
    if (this.isEditMode && data?.player) {
      const playerData = data.player; // Store in local variable for type safety
      this.events$.pipe(takeUntil(this.destroy$)).subscribe(events => {
        if (data.eventId) {
          const event = events.find(e => e.id === data.eventId);
          if (event) {
            this.userForm.get('event')?.setValue(event);
          }
        }
        // Create a Player object for the selected player
        const player: Player = {
          player_id: playerData.id,
          username: playerData.username,
          pronouns: playerData.pronouns
        };
        this.selectedPlayer = player;
        this.userForm.get('playerInput')?.setValue(player); // Set Player object for autocomplete consistency
        this.userForm.get('playerInput')?.disable(); // Disable player input in edit mode
        if (playerData.pronouns) {
          this.userForm.get('pronouns')?.setValue(playerData.pronouns);
        }
        if (data.seed !== undefined && data.seed !== null) {
          this.userForm.get('seed')?.setValue(data.seed);
        }
        if (data.place !== undefined && data.place !== null) {
          this.userForm.get('place')?.setValue(data.place);
        }
      });
    }
  }

  ngOnInit(): void {
    // Events are already loaded via events$ observable
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

  initForm(): void {
    this.userForm = this.fb.group({
      playerInput: new FormControl({ value: '', disabled: true }, Validators.required),
      pronouns: new FormControl({ value: '', disabled: true }),
      seed: new FormControl({ value: '', disabled: true }),
      place: new FormControl({ value: '', disabled: true }, Validators.required),
      event: ['', Validators.required]
    });
  }

  setupAutocomplete(): void {
    // Watch for input changes and trigger search
    this.userForm.get('playerInput')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      if (typeof value === 'string') {
        this.searchSubject.next(value);
        this.isCreatingNewPlayer = false;
        this.selectedPlayer = null;
        // Clear pronouns when user starts typing a new name
        if (value.trim().length > 0) {
          this.userForm.get('pronouns')?.setValue('');
        }
      }
    });

    // Setup filtered players observable
    this.filteredPlayers$ = this.searchSubject.pipe(
      startWith(''),
      switchMap((query: string) => {
        if (!query || query.trim().length === 0) {
          return this.playerService.searchPlayers('');
        }
        return this.playerService.searchPlayers(query);
      }),
      map((players: Player[]) => {
        const inputValue = this.userForm.get('playerInput')?.value || '';
        if (typeof inputValue === 'string' && inputValue.trim().length > 0) {
          // Check if input matches any existing player exactly
          const exactMatch = players.find(p => 
            p.username.toLowerCase() === inputValue.trim().toLowerCase()
          );
          if (!exactMatch) {
            // Add option to create new player
            return players;
          }
        }
        return players;
      })
    );
  }

  displayPlayer(player: Player | string | null): string {
    if (!player) {
      return '';
    }
    // Handle both Player objects and string values
    if (typeof player === 'string') {
      return player;
    }
    return player.username || '';
  }

  onPlayerSelected(player: Player): void {
    this.selectedPlayer = player;
    this.isCreatingNewPlayer = false;
    // Ensure form control has the player object (autocomplete should set this, but ensure it)
    this.userForm.get('playerInput')?.setValue(player, { emitEvent: false });
    // Auto-populate pronouns if available
    if (player.pronouns) {
      this.userForm.get('pronouns')?.setValue(player.pronouns);
    }
  }

  onInputChange(value: string): void {
    // Reset selected player when user types
    if (this.selectedPlayer && value !== this.selectedPlayer.username) {
      this.selectedPlayer = null;
      this.isCreatingNewPlayer = false;
    }
  }

  onSubmit(): void {
    if (this.userForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);
      
      const formValue = this.userForm.value;
      
      if (this.isEditMode && this.eventPlayerId) {
        // Update existing event player and player pronouns if changed
        // Trim the pronouns value but preserve empty strings (to allow clearing pronouns)
        const pronouns = formValue.pronouns != null ? formValue.pronouns.trim() : '';
        const playerId = this.data?.player?.id;
        
        // Update player pronouns if player ID is available
        // Always update pronouns when playerId exists (backend handles empty strings correctly)
        if (playerId) {
          this.playerService.updatePlayer(playerId, { pronouns: pronouns }).subscribe({
            next: () => {
              // After updating player, update event player relationship
              this.updateEventPlayer(this.eventPlayerId!, formValue.seed, formValue.place);
            },
            error: (error) => {
              console.error('Error updating player pronouns:', error);
              // Still try to update event player even if pronouns update fails
              this.updateEventPlayer(this.eventPlayerId!, formValue.seed, formValue.place);
            }
          });
        } else {
          // No pronouns to update, just update event player
          this.updateEventPlayer(this.eventPlayerId, formValue.seed, formValue.place);
        }
      } else {
        // Create new event player
        const event: Event = formValue.event;
        const playerInput = formValue.playerInput;
        const pronouns = formValue.pronouns?.trim() || undefined;

        // Determine if we have a selected player or need to create a new one
        // Check if playerInput is a Player object (from autocomplete selection) or string (manual input)
        let playerToUse: Player | null = null;
        let gamertagToCreate: string | null = null;

        if (this.selectedPlayer) {
          // Player was selected from autocomplete
          playerToUse = this.selectedPlayer;
        } else if (playerInput && typeof playerInput === 'object' && 'username' in playerInput) {
          // Form control has Player object (from autocomplete, but selectedPlayer wasn't set)
          playerToUse = playerInput as Player;
        } else if (typeof playerInput === 'string' && playerInput.trim().length > 0) {
          // User typed a string - check if it matches an existing player
          gamertagToCreate = playerInput.trim();
        }

        if (playerToUse) {
          // Use existing player
          const eventId = (event as any).id;
          const playerId = (playerToUse as any).id || (playerToUse as any).player_id;
          this.addPlayerToEvent(eventId!, playerId!, formValue.seed, formValue.place);
        } else if (gamertagToCreate) {
          // Create new player
          this.playerService.createPlayer({ username: gamertagToCreate, pronouns: pronouns }).subscribe({
            next: (newPlayer: Player) => {
              const eventId = (event as any).id;
              const playerId = (newPlayer as any).id || (newPlayer as any).player_id;
              this.addPlayerToEvent(eventId!, playerId!, formValue.seed, formValue.place);
            },
            error: (createError: any) => {
              console.error('Error creating player:', createError);
              // If player already exists (409), try to get it and add to event
              if (createError.status === 409 && createError.error?.player) {
                const existingPlayer = createError.error.player;
                const eventId = (event as any).id;
                const playerId = existingPlayer.id;
                this.addPlayerToEvent(eventId!, playerId!, formValue.seed, formValue.place);
              } else {
                const errorMessage = createError.error?.message || 'Failed to create player. Please try again.';
                this.messageService.show(errorMessage);
                this.isSubmitting = false;
                this.loadingService.setIsLoading(false);
              }
            }
          });
        } else {
          // Invalid state
          this.messageService.show('Please select or enter a player gamertag.');
          this.isSubmitting = false;
          this.loadingService.setIsLoading(false);
        }
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private addPlayerToEvent(eventId: number, playerId: number, seed?: number, place?: number): void {
    this.eventPlayerService.addPlayerToEvent({
      event_id: eventId,
      player_id: playerId,
      seed: seed ? seed : -1,
      place: place ? place : -1
    }).subscribe({
      next: () => {
        this.messageService.show('Player added to event successfully!');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
        // Call the success callback if provided
        if (this.data?.onSuccess) {
          this.data.onSuccess();
        }
        this.dialogRef.close(true);
      },
      error: (error) => {
        console.error('Error adding player to event:', error);
        const errorMessage = error.error?.message || 'Failed to add player to event. Please try again.';
        this.messageService.show(errorMessage);
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
      }
    });
  }

  private updateEventPlayer(eventPlayerId: number, seed?: number, place?: number): void {
    this.eventPlayerService.updateEventPlayer(eventPlayerId, {
      seed: seed ? seed : -1,
      place: place ? place : -1
    }).subscribe({
      next: () => {
        this.messageService.show('Player updated successfully!');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
        // Call the success callback if provided
        if (this.data?.onSuccess) {
          this.data.onSuccess();
        }
        this.dialogRef.close(true);
      },
      error: (error) => {
        console.error('Error updating player:', error);
        const errorMessage = error.error?.message || 'Failed to update player. Please try again.';
        this.messageService.show(errorMessage);
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
      }
    });
  }
}

