import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { AuthData } from '../../../../models/general';

@Component({
  selector: 'app-login-form',
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
  standalone: false,
})
export class LoginFormComponent implements OnInit {
  @Input() isLoading = false;
  @Output() login = new EventEmitter<AuthData>();
  loginForm!: FormGroup;

  constructor(
    private fb: FormBuilder
    ) { }

  ngOnInit(): void {
    this.setupForm();
  }

  /**
   * Initialize the form.
   */
  setupForm() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(16)]]
    });
  }

  /**
   * Emit output event for the user's login attempt.
   */
  onSubmit() {
    if (this.loginForm.valid && !this.isLoading) {
      const { email, password } = this.loginForm.getRawValue();
      this.login.emit({
        email,
        password
      });
    }
  }

}
