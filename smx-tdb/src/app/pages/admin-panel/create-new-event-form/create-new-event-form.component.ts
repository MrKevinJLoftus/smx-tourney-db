import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-create-new-event-form',
  templateUrl: './create-new-event-form.component.html',
  styleUrls: ['./create-new-event-form.component.scss'],
  imports: [SharedModule]
})
export class CreateNewEventFormComponent implements OnInit {
  eventForm!: FormGroup;

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  ngOnInit(): void {

  }

  initializeForm(): void {
    this.eventForm = this.fb.group({
      eventName: ['', Validators.required],
      eventDate: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.eventForm.valid) {
      console.log('Form Submitted!', this.eventForm.value);
      // Handle form submission logic here
    }
  }
}
