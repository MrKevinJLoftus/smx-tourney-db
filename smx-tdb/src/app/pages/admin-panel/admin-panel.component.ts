import { Component } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { EventUsersListComponent } from './event-users-list/event-users-list.component';
import { EventMatchesListComponent } from './event-matches-list/event-matches-list.component';
import { EventListComponent } from './event-list/event-list.component';
import { FormWrapperComponent } from './form-wrapper/form-wrapper.component';

@Component({
  selector: 'app-admin-panel',
  imports: [SharedModule, EventListComponent, EventUsersListComponent, EventMatchesListComponent, FormWrapperComponent],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss'
})
export class AdminPanelComponent {
}
