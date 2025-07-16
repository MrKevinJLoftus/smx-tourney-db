import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-add-event-users-form',
  templateUrl: './add-event-users-form.component.html',
  styleUrls: ['./add-event-users-form.component.scss'],
  imports: [SharedModule]
})
export class AddEventUsersFormComponent implements OnInit {
  userForm!: FormGroup;
  events$: Observable<string[]>; // Placeholder for events fetched from eventService

  constructor(private fb: FormBuilder) {
    this.initForm();
    this.events$ = new Observable(); // Placeholder until eventService is implemented
  }

  ngOnInit(): void {
    // Placeholder for fetching events from eventService
    // this.events$ = this.eventService.getEvents();
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
    if (this.userForm.valid) {
      console.log('Form Submitted!', this.userForm.value);
      // Handle form submission logic here
    }
  }
}
