import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SharedModule } from '../../../shared/shared.module';
import { CreateNewEventFormComponent } from '../create-new-event-form/create-new-event-form.component';
import { Event } from '../../../models/event';

@Component({
  selector: 'app-add-event-dialog',
  templateUrl: './add-event-dialog.component.html',
  styleUrls: ['./add-event-dialog.component.scss'],
  imports: [SharedModule, MatDialogModule, CreateNewEventFormComponent]
})
export class AddEventDialogComponent implements OnInit {
  isEditMode = false;
  event?: Event;

  constructor(
    public dialogRef: MatDialogRef<AddEventDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      event?: Event;
      onSuccess?: () => void 
    }
  ) {
    this.isEditMode = !!data?.event;
    this.event = data?.event;
  }

  ngOnInit(): void {
  }

  onEventSaved(): void {
    if (this.data?.onSuccess) {
      this.data.onSuccess();
    }
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

