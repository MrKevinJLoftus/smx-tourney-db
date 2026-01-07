import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { BrowseComponent } from './pages/browse/browse.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { UpdatePasswordComponent } from './pages/update-password/update-password.component';
import { SuperAdminPanelComponent } from './pages/super-admin-panel/super-admin-panel.component';
import { PlayerDetailComponent } from './pages/player-detail/player-detail.component';
import { EventDetailComponent } from './pages/event-detail/event-detail.component';
import { MatchDetailComponent } from './pages/match-detail/match-detail.component';
import { AuthGuard } from './shared/auth/auth-guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { title: 'Home' } },
  { path: 'browse', component: BrowseComponent, data: { title: 'Browse' } },
  { path: 'player/:id', component: PlayerDetailComponent, data: { title: 'Player' } },
  { path: 'event/:id', component: EventDetailComponent, data: { title: 'Event' } },
  { path: 'match/:id', component: MatchDetailComponent, data: { title: 'Match' } },
  { path: 'admin-panel', component: AdminPanelComponent, canActivate: [AuthGuard], data: { title: 'Admin Panel' }},
  { path: 'super-admin-panel', component: SuperAdminPanelComponent, data: { title: 'Super Admin Panel' }},
  { path: 'update-password', component: UpdatePasswordComponent, canActivate: [AuthGuard], data: { title: 'Update Password' } },
  { path: 'login', loadChildren: () => import('./pages/login/login.module').then(m => m.LoginModule), data: { title: 'Login' } },
  { path: '**', redirectTo: '/' }
];
