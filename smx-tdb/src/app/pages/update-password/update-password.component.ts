import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-update-password',
  templateUrl: './update-password.component.html',
  styleUrls: ['./update-password.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, MatInputModule, MatFormFieldModule, MatButtonModule, MatCardModule]
})
export class UpdatePasswordComponent implements OnInit {
  passwordForm!: FormGroup;
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
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: [this.passwordMatchValidator] });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    return control.get('newPassword')?.value === control.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.passwordForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);
      
      const formValue = this.passwordForm.value;
      this.authService.updatePassword(
        formValue.currentPassword,
        formValue.newPassword
      ).subscribe({
        next: () => {
          this.messageService.show('Password updated successfully!');
          this.passwordForm.reset();
          this.isSubmitting = false;
          this.loadingService.setIsLoading(false);
        },
        error: (error) => {
          console.error('Error updating password:', error);
          const errorMessage = error.error?.message || 'Failed to update password. Please try again.';
          this.messageService.show(errorMessage);
          this.isSubmitting = false;
          this.loadingService.setIsLoading(false);
        }
      });
    }
  }
}

