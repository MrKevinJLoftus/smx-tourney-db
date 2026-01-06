import { Component, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { EventService } from '../../../services/event.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { Event } from '../../../models/event';

@Component({
  selector: 'app-create-new-event-form',
  templateUrl: './create-new-event-form.component.html',
  styleUrls: ['./create-new-event-form.component.scss'],
  imports: [SharedModule]
})
export class CreateNewEventFormComponent implements OnInit, OnChanges {
  @Input() event?: Event;
  @Output() eventSaved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  
  eventForm!: FormGroup;
  isSubmitting = false;
  isEditMode = false;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    if (this.event) {
      this.populateForm(this.event);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['event'] && this.event) {
      this.populateForm(this.event);
    }
  }

  initializeForm(): void {
    this.eventForm = this.fb.group({
      eventName: ['', Validators.required],
      eventDate: ['', Validators.required],
      eventDescription: [''],
      eventLocation: [''],
      eventOrganizers: ['']
    });
  }

  populateForm(event: Event): void {
    this.isEditMode = true;
    const eventDate = event.date instanceof Date 
      ? event.date 
      : event.date 
        ? new Date(event.date) 
        : null;
    
    this.eventForm.patchValue({
      eventName: event.name || '',
      eventDate: eventDate,
      eventDescription: event.description || '',
      eventLocation: event.location || '',
      eventOrganizers: event.organizers || ''
    });
  }

  onSubmit(): void {
    if (this.eventForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);
      
      const formValue = this.eventForm.value;
      const eventData = {
        name: formValue.eventName,
        date: formValue.eventDate instanceof Date 
          ? formValue.eventDate.toISOString().split('T')[0] 
          : formValue.eventDate,
        description: formValue.eventDescription || null,
        location: formValue.eventLocation || null,
        organizers: formValue.eventOrganizers || null
      };

      if (this.isEditMode && this.event?.id) {
        // Update existing event
        this.eventService.updateEvent(this.event.id, eventData).subscribe({
          next: (event) => {
            this.messageService.show('Event updated successfully!');
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
            this.eventSaved.emit();
          },
          error: (error) => {
            console.error('Error updating event:', error);
            const errorMessage = error.error?.message || 'Failed to update event. Please try again.';
            this.messageService.show(errorMessage);
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
          }
        });
      } else {
        // Create new event
        this.eventService.createEvent(eventData).subscribe({
          next: (event) => {
            this.messageService.show('Event created successfully!');
            this.eventForm.reset();
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
            this.eventSaved.emit();
          },
          error: (error) => {
            console.error('Error creating event:', error);
            const errorMessage = error.error?.message || 'Failed to create event. Please try again.';
            this.messageService.show(errorMessage);
            this.isSubmitting = false;
            this.loadingService.setIsLoading(false);
          }
        });
      }
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
