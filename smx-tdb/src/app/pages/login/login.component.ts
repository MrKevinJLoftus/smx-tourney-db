import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AuthData } from '../../models/general';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false,
})
export class LoginComponent {
  isLoading = false;

  constructor(private authService: AuthService) { }

  /**
   * Call auth service to handle login attempt.
   */
  handleLoginAttempt(data: AuthData) {
    this.isLoading = true;
    this.authService.login(data).subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

}
