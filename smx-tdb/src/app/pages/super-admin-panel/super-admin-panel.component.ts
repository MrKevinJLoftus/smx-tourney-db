import { Component } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CreateUserFormComponent } from './create-user-form/create-user-form.component';
import { FormWrapperComponent } from '../admin-panel/form-wrapper/form-wrapper.component';

@Component({
  selector: 'app-super-admin-panel',
  imports: [SharedModule, CreateUserFormComponent, FormWrapperComponent],
  templateUrl: './super-admin-panel.component.html',
  styleUrl: './super-admin-panel.component.scss'
})
export class SuperAdminPanelComponent {
}

