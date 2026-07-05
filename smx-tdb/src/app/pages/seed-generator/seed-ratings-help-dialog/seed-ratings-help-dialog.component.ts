import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-seed-ratings-help-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './seed-ratings-help-dialog.component.html',
  styleUrl: './seed-ratings-help-dialog.component.scss',
})
export class SeedRatingsHelpDialogComponent {
  constructor(public dialogRef: MatDialogRef<SeedRatingsHelpDialogComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}
