import { Component } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { EventUsersListComponent } from './event-users-list/event-users-list.component';
import { EventMatchesListComponent } from './event-matches-list/event-matches-list.component';
import { EventListComponent } from './event-list/event-list.component';
import { FormWrapperComponent } from './form-wrapper/form-wrapper.component';
import { StartGgImportComponent } from './start-gg-import/start-gg-import.component';
import { StartGgStepmaniaDiscoveryComponent } from './start-gg-stepmania-discovery/start-gg-stepmania-discovery.component';
import { PlayerMatchPrivacyComponent } from './player-match-privacy/player-match-privacy.component';

@Component({
  selector: 'app-admin-panel',
  imports: [SharedModule, EventListComponent, EventUsersListComponent, EventMatchesListComponent, FormWrapperComponent, StartGgImportComponent, StartGgStepmaniaDiscoveryComponent, PlayerMatchPrivacyComponent],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss'
})
export class AdminPanelComponent {
}
