import { Component, OnInit, Inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SharedModule } from '../../../shared/shared.module';
import { Observable } from 'rxjs';
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
export class AddEventUserDialogComponent implements OnInit {
  userForm!: FormGroup;
  events$: Observable<Event[]>;
  isSubmitting = false;
  isEditMode = false;
  eventPlayerId?: number;

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
    
    // Enable/disable form fields based on event selection
    this.userForm.get('event')?.valueChanges.subscribe(event => {
      if (event) {
        if (!this.isEditMode) {
          this.userForm.get('gamertag')?.enable();
        }
        this.userForm.get('pronouns')?.enable();
        this.userForm.get('seed')?.enable();
        this.userForm.get('place')?.enable();
      } else {
        this.userForm.get('gamertag')?.disable();
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
      this.events$.subscribe(events => {
        if (data.eventId) {
          const event = events.find(e => e.id === data.eventId);
          if (event) {
            this.userForm.get('event')?.setValue(event);
          }
        }
        this.userForm.get('gamertag')?.setValue(data.player?.username);
        this.userForm.get('gamertag')?.disable(); // Disable gamertag in edit mode
        if (data.player?.pronouns) {
          this.userForm.get('pronouns')?.setValue(data.player.pronouns);
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

  initForm(): void {
    this.userForm = this.fb.group({
      gamertag: new FormControl({ value: '', disabled: true }, Validators.required),
      pronouns: new FormControl({ value: '', disabled: true }),
      seed: new FormControl({ value: '', disabled: true }),
      place: new FormControl({ value: '', disabled: true }, Validators.required),
      event: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.userForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);
      
      const formValue = this.userForm.value;
      
      if (this.isEditMode && this.eventPlayerId) {
        // Update existing event player and player pronouns if changed
        const pronouns = formValue.pronouns?.trim() || undefined;
        const playerId = this.data?.player?.id;
        
        // Update player pronouns if player ID is available and pronouns changed
        if (playerId && pronouns !== undefined) {
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
        const gamertag = formValue.gamertag.trim();
        const pronouns = formValue.pronouns?.trim() || undefined;

        // First, try to find or create the player
        this.playerService.getPlayerByUsername(gamertag).subscribe({
          next: (player: Player) => {
            // Player exists, add to event
            const eventId = (event as any).id;
            const playerId = (player as any).id;
            this.addPlayerToEvent(eventId!, playerId!, formValue.seed, formValue.place);
          },
          error: (error: any) => {
            // Player doesn't exist, create it first
            if (error.status === 404) {
              this.playerService.createPlayer({ username: gamertag, pronouns: pronouns }).subscribe({
                next: (newPlayer: Player) => {
                  const eventId = (event as any).id;
                  const playerId = (newPlayer as any).id;
                  this.addPlayerToEvent(eventId!, playerId!, formValue.seed, formValue.place);
                },
                error: (createError: any) => {
                  console.error('Error creating player:', createError);
                  const errorMessage = createError.error?.message || 'Failed to create player. Please try again.';
                  this.messageService.show(errorMessage);
                  this.isSubmitting = false;
                  this.loadingService.setIsLoading(false);
                }
              });
            } else {
              console.error('Error fetching player:', error);
              const errorMessage = error.error?.message || 'Failed to fetch player. Please try again.';
              this.messageService.show(errorMessage);
              this.isSubmitting = false;
              this.loadingService.setIsLoading(false);
            }
          }
        });
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

