import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { SignupRequestComponent } from './pages/signup-request/signup-request.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { title: 'Home' } },
  { path: 'admin-panel', component: AdminPanelComponent, data: { title: 'Administration Panel' }},
  { path: 'signup', component: SignupRequestComponent, data: { title: 'Register As TO' } },
  { path: 'login', loadChildren: () => import('./pages/login/login.module').then(m => m.LoginModule), data: { title: 'Login' } },
  { path: '**', redirectTo: '/' }
];
