import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-add-event-users-form',
  templateUrl: './add-event-users-form.component.html',
  styleUrls: ['./add-event-users-form.component.scss'],
  imports: [SharedModule]
})
export class AddEventUsersFormComponent implements OnInit {
  userForm!: FormGroup;

  constructor(private fb: FormBuilder) {
    this.initForm();
  }

  ngOnInit(): void {

  }

  initForm(): void {
    this.userForm = this.fb.group({
      gamertag: ['', Validators.required],
      seed: [''],
      place: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      console.log('Form Submitted!', this.userForm.value);
      // Handle form submission logic here
    }
  }
}
