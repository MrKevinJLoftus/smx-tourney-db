import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { AuthService } from '../../../services/auth.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-create-user-form',
  templateUrl: './create-user-form.component.html',
  styleUrls: ['./create-user-form.component.scss'],
  imports: [SharedModule]
})
export class CreateUserFormComponent implements OnInit {
  userForm!: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
  }

  initializeForm(): void {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.userForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);
      
      const formValue = this.userForm.value;
      const email = formValue.email.trim();
      const password = formValue.password;

      // Create user without auto-login (skipAutoLogin = true)
      this.authService.createUser(email, password, true);
      
      // Reset form and loading state after a brief delay
      // The AuthService handles success/error messaging
      setTimeout(() => {
        this.userForm.reset();
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
      }, 1500);
    }
  }
}

