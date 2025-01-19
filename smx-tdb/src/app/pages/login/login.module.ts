import { NgModule } from '@angular/core';
import { LoginComponent } from './login.component';
import { Routes, RouterModule } from '@angular/router';
import { LoginFormComponent } from './components/login-form/login-form.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: LoginComponent }
];

const MODULES = [
  SharedModule
];

const COMPONENTS = [
  LoginComponent,
  LoginFormComponent
];

@NgModule({
  declarations: [COMPONENTS],
  imports: [
    ...MODULES,
    RouterModule.forChild(routes)
  ],
  exports: [...MODULES, ...COMPONENTS, RouterModule]
})
export class LoginModule { }
