import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthData } from '../models/general';
import { MessageService } from '../services/message.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticated = false;
  private isAdmin = false;
  private token?: string | null;
  private tokenTimer: any;
  private userId?: string | null;
  private authStatusListener = new Subject<boolean>();

  constructor(
    private http: HttpClient,
    private router: Router,
    private messageService: MessageService
  ) { }

  getToken() {
    return this.token;
  }

  getUserId() {
    return this.userId;
  }

  getIsAuthenticated() {
    return this.isAuthenticated;
  }

  getIsAdmin() {
    return this.isAdmin;
  }

  getAuthStatusListener() {
    return this.authStatusListener.asObservable();
  }

  /**
   * Attempt to log the user in.
   * Will always redirect user to home page.
   */
  login(authData: AuthData) {
    this.http.post<{token: string, expiresIn: number, username: string, userId: string, isAdmin: boolean}>(
      `${environment.apiUrl}/user/login`, authData)
      .subscribe(response => {
        if (response.token) {
          const token = response.token;
          this.token = token;
          const expiresInDuration = response.expiresIn;
          this.loginSetup(expiresInDuration, response.userId, token, response.isAdmin);
          this.messageService.show('Login successful.');
        } else {
          this.logout(false);
          this.messageService.show('Your username or password was incorrect. Please try again.');
        }
    }, error => {
      console.error(error);
      this.messageService.show('Your username or password was incorrect. Please try again.');
      this.logout(false);
    });
  }

  /**
   * Hard-coded to always point to localhost, endpoint is not active on prod API.
   * This may be useful in the future if external users need to be able to register.
   */
  createUser(username: string, password: string) {
    const authData: AuthData = {username, password};
    this.http.post<{token: string, expiresIn: number, userId: string, isAdmin: boolean}>('http://localhost:3000/api/user/signUp', authData)
      .subscribe({ next: (response) => {
        const token = response.token;
        this.token = token;
        if (token) {
          const expiresInDuration = response.expiresIn;
          this.loginSetup(expiresInDuration, response.userId, token, response.isAdmin);
        }
    }, error: (e) => {
      console.error(e);
      this.messageService.show('Something went wrong.');
    }});
  }

  autoAuthUser() {
    const authInformation = this.getAuthData();
    if (!authInformation) {
      this.authStatusListener.next(false);
      return;
    }
    const now = new Date();
    const expiresIn = authInformation.expirationDate.getTime() - now.getTime();
    if (expiresIn > 0) {
      this.token = authInformation.token;
      this.isAuthenticated = true;
      this.userId = authInformation.userId;
      this.setAuthTimer(expiresIn / 1000);
      this.authStatusListener.next(true);
    }
  }

  logout(navigateAway: boolean = true) {
    const wasAuthenticated = this.isAuthenticated === true;
    this.token = null;
    this.isAuthenticated = false;
    this.authStatusListener.next(false);
    clearTimeout(this.tokenTimer);
    this.clearAuthData();
    if (navigateAway) {
      this.router.navigate(['/']);
    }
    if (wasAuthenticated) {
      this.messageService.show('Logout successful.');
    }
  }

  private loginSetup(expiresInDuration: number, userId: string, token: string, isAdmin: boolean) {
    this.setAuthTimer(expiresInDuration);
    this.isAuthenticated = true;
    this.isAdmin = isAdmin;
    this.userId = userId;
    this.authStatusListener.next(true);
    const now = new Date();
    const expirationDate = new Date(now.getTime() + expiresInDuration * 1000);
    this.saveAuthData(token, expirationDate, this.userId, this.isAdmin);
    this.postLoginNavigation();
  }

  private setAuthTimer(duration: number) {
    this.tokenTimer = setTimeout(() => {
      this.logout(true);
    }, duration * 1000);
  }

  private saveAuthData(token: string, expirationDate: Date, userId: string, isAdmin: boolean) {
    localStorage.setItem('token', token);
    localStorage.setItem('expiration', expirationDate.toISOString());
    localStorage.setItem('userId', userId);
    localStorage.setItem('isAdmin', isAdmin.toString())
  }

  private clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('expiration');
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
  }

  private getAuthData() {
    const token = localStorage.getItem('token');
    const expirationDate = localStorage.getItem('expiration');
    const userId = localStorage.getItem('userId');
    const isAdmin = localStorage.getItem('isAdmin');
    if (!token || !expirationDate) {
      return;
    }
    return {
      token,
      expirationDate: new Date(expirationDate),
      userId,
      isAdmin: isAdmin === "true"
    };
  }

  private postLoginNavigation() {
    this.router.navigate(['/']);
  }
}
