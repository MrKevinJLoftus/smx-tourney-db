import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-ratings-help-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './ratings-help-dialog.component.html',
  styleUrl: './ratings-help-dialog.component.scss',
})
export class RatingsHelpDialogComponent {
  constructor(public dialogRef: MatDialogRef<RatingsHelpDialogComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}
