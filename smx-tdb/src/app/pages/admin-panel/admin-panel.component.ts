import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-admin-panel',
  imports: [MatButtonModule],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss'
})
export class AdminPanelComponent {

  createNewEvent(): void {
    // Logic to create a new event
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
