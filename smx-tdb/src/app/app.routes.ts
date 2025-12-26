import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { UpdatePasswordComponent } from './pages/update-password/update-password.component';
import { SuperAdminPanelComponent } from './pages/super-admin-panel/super-admin-panel.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { title: 'Home' } },
  { path: 'admin-panel', component: AdminPanelComponent, data: { title: 'Admin Panel' }},
  { path: 'super-admin-panel', component: SuperAdminPanelComponent, data: { title: 'Super Admin Panel' }},
  { path: 'update-password', component: UpdatePasswordComponent, data: { title: 'Update Password' } },
  { path: 'login', loadChildren: () => import('./pages/login/login.module').then(m => m.LoginModule), data: { title: 'Login' } },
  { path: '**', redirectTo: '/' }
];
