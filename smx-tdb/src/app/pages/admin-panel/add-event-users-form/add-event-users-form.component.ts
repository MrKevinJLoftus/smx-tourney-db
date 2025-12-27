import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { Observable, map } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { PlayerService } from '../../../services/player.service';
import { EventPlayerService } from '../../../services/eventPlayer.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { Event } from '../../../models/event';
import { EventUsersListComponent } from '../event-users-list/event-users-list.component';
import { Player } from '../../../models/player';

@Component({
  selector: 'app-add-event-users-form',
  templateUrl: './add-event-users-form.component.html',
  styleUrls: ['./add-event-users-form.component.scss'],
  imports: [SharedModule, EventUsersListComponent]
})
export class AddEventUsersFormComponent implements OnInit {
  @ViewChild(EventUsersListComponent) usersListComponent!: EventUsersListComponent;
  userForm!: FormGroup;
  events$: Observable<Event[]>;
  isSubmitting = false;
  selectedEventId?: number;

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
        this.selectedEventId = (event as any).id;
        this.userForm.get('gamertag')?.enable();
        this.userForm.get('pronouns')?.enable();
        this.userForm.get('seed')?.enable();
        this.userForm.get('place')?.enable();
      } else {
        this.selectedEventId = undefined;
        this.userForm.get('gamertag')?.disable();
        this.userForm.get('pronouns')?.disable();
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
      pronouns: new FormControl({ value: '', disabled: true }), // Pronouns is optional
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

  loadPlayers(): void {
    if (this.usersListComponent) {
      this.usersListComponent.loadPlayers();
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
        // Refresh the users list
        if (this.usersListComponent) {
          this.usersListComponent.loadPlayers();
        }
        // Keep the event selected, only reset other fields
        const selectedEvent = this.userForm.get('event')?.value;
        this.userForm.reset();
        this.userForm.get('event')?.setValue(selectedEvent);
        this.userForm.get('gamertag')?.setValue('');
        this.userForm.get('pronouns')?.setValue('');
        this.userForm.get('seed')?.setValue('');
        this.userForm.get('place')?.setValue('');
        // Keep fields enabled if event is still selected
        if (selectedEvent) {
          this.userForm.get('gamertag')?.enable();
          this.userForm.get('pronouns')?.enable();
          this.userForm.get('seed')?.enable();
          this.userForm.get('place')?.enable();
        } else {
          this.userForm.get('gamertag')?.disable();
          this.userForm.get('pronouns')?.disable();
          this.userForm.get('seed')?.disable();
          this.userForm.get('place')?.disable();
        }
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
