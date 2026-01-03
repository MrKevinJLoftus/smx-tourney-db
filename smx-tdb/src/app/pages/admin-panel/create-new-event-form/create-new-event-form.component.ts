import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { EventService } from '../../../services/event.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-create-new-event-form',
  templateUrl: './create-new-event-form.component.html',
  styleUrls: ['./create-new-event-form.component.scss'],
  imports: [SharedModule]
})
export class CreateNewEventFormComponent implements OnInit {
  eventForm!: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {

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

      this.eventService.createEvent(eventData).subscribe({
        next: (event) => {
          this.messageService.show('Event created successfully!');
          this.eventForm.reset();
          this.isSubmitting = false;
          this.loadingService.setIsLoading(false);
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
