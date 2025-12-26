import { Component } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';
import { Route } from './models/general';
import { Title } from '@angular/platform-browser';
import { AuthService } from './services/auth.service';
import { LoadingService } from './services/loading.service';
import { filter, map } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatToolbarModule,
    MatProgressSpinner,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    ReactiveFormsModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'smx-tdb';
  isLoading = false;
  isAuthenticated = false;
  routes: Route[] = [
    { url: "/", text: "Home", icon: "home" },
    { url: "/login", text: "Login", icon: "login" },
    { url: "/update-password", text: "Update Password", icon: "lock" }];
  protectedRoutes: Route[] = [
    { url: '/admin-panel', text: 'Admin', icon: 'admin_panel_settings' }
  ];
  accessibleRoutes: Route[] = this.routes;
  constructor(
    private router: Router,
    private titleService: Title,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private loadingService: LoadingService
  ) {
      // subscribe to loading status
      this.loadingService.getIsLoadingListener().subscribe(res => {
        this.isLoading = res;
      });
      // subscribe to auth changes
      this.authService.getAuthStatusListener().subscribe(res => {
        this.isAuthenticated = res;
        this.accessibleRoutes = this.isAuthenticated ? [...this.routes, ...this.protectedRoutes] : [...this.routes]
      });
      // attempt to auto-auth user
      this.authService.autoAuthUser();
      // handle title changes
      this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => {
          const child = this.activatedRoute.firstChild;
          return (child && child.snapshot.data['title']) || '';
        })
      ).subscribe((title: string) => {
        this.titleService.setTitle(`${title} | ${this.title}`);
      });

      // TODO: Remove this once login is implemented
      this.accessibleRoutes = [...this.routes, ...this.protectedRoutes];
    }

  navigateHome() {
    this.router.navigate(['/']);
  }

  logout() {}
}
