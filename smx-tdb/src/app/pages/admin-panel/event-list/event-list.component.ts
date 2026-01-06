import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { EventService } from '../../../services/event.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MessageService } from '../../../services/message.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { AddEventDialogComponent } from '../add-event-dialog/add-event-dialog.component';
import { Event } from '../../../models/event';

@Component({
  selector: 'app-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss'],
  imports: [SharedModule]
})
export class EventListComponent implements OnInit {
  events$: Observable<Event[]>;
  isLoading = false;

  constructor(
    private eventService: EventService,
    private dialog: MatDialog,
    private messageService: MessageService
  ) {
    this.events$ = this.eventService.getEvents();
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.isLoading = true;
    this.events$ = this.eventService.getEvents().pipe(
      catchError(error => {
        console.error('Error loading events:', error);
        return of([]);
      })
    );
    this.events$.subscribe(() => {
      this.isLoading = false;
    });
  }

  openAddEventDialog(): void {
    const dialogRef = this.dialog.open(AddEventDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {
        onSuccess: () => {
          this.loadEvents();
        }
      }
    });
  }

  editEvent(event: Event): void {
    const dialogRef = this.dialog.open(AddEventDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {
        event: event,
        onSuccess: () => {
          this.loadEvents();
        }
      }
    });
  }

  deleteEvent(event: Event): void {
    if (!event.id) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Event',
        message: `Are you sure you want to delete "${event.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.eventService.deleteEvent(event.id!).subscribe({
          next: () => {
            this.messageService.show('Event deleted successfully');
            this.loadEvents();
          },
          error: (error) => {
            console.error('Error deleting event:', error);
            this.messageService.show('Error deleting event. Please try again.');
          }
        });
      }
    });
  }
}

