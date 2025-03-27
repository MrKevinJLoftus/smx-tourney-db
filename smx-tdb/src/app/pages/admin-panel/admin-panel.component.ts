import { Component } from '@angular/core';
import { CreateNewEventFormComponent } from './create-new-event-form/create-new-event-form.component';
import { SharedModule } from '../../shared/shared.module';
import { AddEventMatchesFormComponent } from "./add-event-matches-form/add-event-matches-form.component";
import { AddEventUsersFormComponent } from './add-event-users-form/add-event-users-form.component';
import { FormWrapperComponent } from './form-wrapper/form-wrapper.component';

@Component({
  selector: 'app-admin-panel',
  imports: [SharedModule, CreateNewEventFormComponent, AddEventMatchesFormComponent, AddEventUsersFormComponent, FormWrapperComponent],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss'
})
export class AdminPanelComponent {
  isCreateNewEventFormVisible = false;

  createNewEvent(): void {
    // Logic to create a new event
    this.isCreateNewEventFormVisible = true;
    console.log('Create New Event clicked');
  }

  addEditUsers(): void {
    // Logic to add/edit users for an existing event
    console.log('Add/Edit Users clicked');
  }

  addEditMatches(): void {
    // Logic to add/edit matches for an existing event
    console.log('Add/Edit Matches clicked');
  }
}
