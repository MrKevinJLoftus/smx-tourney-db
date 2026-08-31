import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-scout-help-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './scout-help-dialog.component.html',
  styleUrl: './scout-help-dialog.component.scss',
})
export class ScoutHelpDialogComponent {
  constructor(public dialogRef: MatDialogRef<ScoutHelpDialogComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}
