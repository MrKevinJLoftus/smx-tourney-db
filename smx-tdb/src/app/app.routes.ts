import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { BrowseComponent } from './pages/browse/browse.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { UpdatePasswordComponent } from './pages/update-password/update-password.component';
import { SuperAdminPanelComponent } from './pages/super-admin-panel/super-admin-panel.component';
import { PlayerDetailComponent } from './pages/player-detail/player-detail.component';
import { PlayerCompareComponent } from './pages/player-compare/player-compare.component';
import { PocketVetoComponent } from './pages/pocket-veto/pocket-veto.component';
import { SeedGeneratorComponent } from './pages/seed-generator/seed-generator.component';
import { EventDetailComponent } from './pages/event-detail/event-detail.component';
import { MatchDetailComponent } from './pages/match-detail/match-detail.component';
import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';
import { AuthGuard } from './shared/auth/auth-guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { title: 'Home' } },
  { path: 'browse', component: BrowseComponent, data: { title: 'Browse' } },
  { path: 'leaderboard', component: LeaderboardComponent, data: { title: 'Leaderboard' } },
  { path: 'compare', component: PlayerCompareComponent, data: { title: 'Compare Players' } },
  { path: 'protect-veto', component: PocketVetoComponent, data: { title: 'Protect / Veto' } },
  { path: 'seed-generator', component: SeedGeneratorComponent, data: { title: 'Seed Generator' } },
  { path: 'player/:id', component: PlayerDetailComponent, data: { title: 'Player' } },
  { path: 'event/:id', component: EventDetailComponent, data: { title: 'Event' } },
  { path: 'match/:id', component: MatchDetailComponent, data: { title: 'Match' } },
  { path: 'admin-panel', component: AdminPanelComponent, canActivate: [AuthGuard], data: { title: 'Admin Panel' }},
  { path: 'super-admin-panel', component: SuperAdminPanelComponent, canActivate: [AuthGuard], data: { title: 'Super Admin Panel' }},
  { path: 'update-password', component: UpdatePasswordComponent, canActivate: [AuthGuard], data: { title: 'Update Password' } },
  { path: 'login', loadChildren: () => import('./pages/login/login.module').then(m => m.LoginModule), data: { title: 'Login' } },
  { path: '**', redirectTo: '/' }
];
