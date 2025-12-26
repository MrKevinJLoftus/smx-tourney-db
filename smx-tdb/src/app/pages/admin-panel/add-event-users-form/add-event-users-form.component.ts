import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { Observable, map } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { PlayerService } from '../../../services/player.service';
import { EventPlayerService } from '../../../services/eventPlayer.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { Event } from '../../../models/event';

@Component({
  selector: 'app-add-event-users-form',
  templateUrl: './add-event-users-form.component.html',
  styleUrls: ['./add-event-users-form.component.scss'],
  imports: [SharedModule]
})
export class AddEventUsersFormComponent implements OnInit {
  userForm!: FormGroup;
  events$: Observable<Event[]>;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private playerService: PlayerService,
    private eventPlayerService: EventPlayerService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.initForm();
    this.events$ = this.eventService.getEvents();
    
    // Enable/disable form fields based on event selection
    this.userForm.get('event')?.valueChanges.subscribe(event => {
      if (event) {
        this.userForm.get('gamertag')?.enable();
        this.userForm.get('seed')?.enable();
        this.userForm.get('place')?.enable();
      } else {
        this.userForm.get('gamertag')?.disable();
        this.userForm.get('seed')?.disable();
        this.userForm.get('place')?.disable();
      }
    });
  }

  ngOnInit(): void {
    // Events are already loaded via events$ observable
  }

  initForm(): void {
    this.userForm = this.fb.group({
      gamertag: new FormControl({ value: '', disabled: true }, Validators.required),
      seed: new FormControl({ value: '', disabled: true }), // Seed is optional and disabled until an event is selected
      place: new FormControl({ value: '', disabled: true }, Validators.required),
      event: ['', Validators.required] // New required field for event
    });
  }

  onSubmit(): void {
    if (this.userForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);
      
      const formValue = this.userForm.value;
      const event: Event = formValue.event;
      const gamertag = formValue.gamertag.trim();

      // First, try to find or create the player
      this.playerService.getPlayerByGamertag(gamertag).subscribe({
        next: (player) => {
          // Player exists, add to event
          this.addPlayerToEvent(event.event_id!, player.player_id!, formValue.seed, formValue.place);
        },
        error: (error) => {
          // Player doesn't exist, create it first
          if (error.status === 404) {
            this.playerService.createPlayer({ gamertag }).subscribe({
              next: (newPlayer) => {
                this.addPlayerToEvent(event.event_id!, newPlayer.player_id!, formValue.seed, formValue.place);
              },
              error: (createError) => {
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

  private addPlayerToEvent(eventId: number, playerId: number, seed?: number, place?: number): void {
    this.eventPlayerService.addPlayerToEvent({
      event_id: eventId,
      player_id: playerId,
      seed: seed ? seed : -1,
      place: place ? place : -1
    }).subscribe({
      next: () => {
        this.messageService.show('Player added to event successfully!');
        this.userForm.reset();
        this.userForm.get('event')?.setValue('');
        // Disable fields after reset
        this.userForm.get('gamertag')?.disable();
        this.userForm.get('seed')?.disable();
        this.userForm.get('place')?.disable();
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
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
}
