import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { PlayerService } from '../../../services/player.service';
import { EventPlayerService } from '../../../services/eventPlayer.service';
import { EventService } from '../../../services/event.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MessageService } from '../../../services/message.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { AddEventUserDialogComponent } from '../add-event-user-dialog/add-event-user-dialog.component';
import { Event as EventModel } from '../../../models/event';

@Component({
  selector: 'app-event-users-list',
  templateUrl: './event-users-list.component.html',
  styleUrls: ['./event-users-list.component.scss'],
  imports: [SharedModule]
})
export class EventUsersListComponent implements OnInit, OnChanges {
  @Input() eventId?: number;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  players$: Observable<any[]> = of([]);
  events$: Observable<EventModel[]>;
  isLoading = false;
  isImporting = false;
  selectedEventId?: number;
  selectedEvent: EventModel | null = null;

  constructor(
    private playerService: PlayerService,
    private eventPlayerService: EventPlayerService,
    private eventService: EventService,
    private dialog: MatDialog,
    private messageService: MessageService
  ) {
    this.events$ = this.eventService.getEvents();
  }

  ngOnInit(): void {
    if (this.eventId) {
      this.selectedEventId = this.eventId;
      this.events$.subscribe(events => {
        this.selectedEvent = events.find(e => e.id === this.eventId) || null;
      });
    }
    this.loadPlayers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId'] && !changes['eventId'].firstChange) {
      this.selectedEventId = this.eventId;
      this.events$.subscribe(events => {
        this.selectedEvent = events.find(e => e.id === this.eventId) || null;
      });
      this.loadPlayers();
    }
  }

  onEventChange(event: EventModel | null): void {
    this.selectedEvent = event;
    if (event) {
      this.selectedEventId = event.id;
    } else {
      this.selectedEventId = undefined;
    }
    this.loadPlayers();
  }

  loadPlayers(): void {
    const eventIdToUse = this.selectedEventId || this.eventId;
    if (eventIdToUse) {
      this.isLoading = true;
      this.players$ = this.playerService.getPlayersByEvent(eventIdToUse).pipe(
        catchError(error => {
          console.error('Error loading players:', error);
          return of([]);
        })
      );
      this.players$.subscribe(() => {
        this.isLoading = false;
      });
    } else {
      this.players$ = of([]);
      this.isLoading = false;
    }
  }

  openAddUserDialog(): void {
    const dialogRef = this.dialog.open(AddEventUserDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        eventId: this.selectedEventId,
        onSuccess: () => {
          this.loadPlayers();
        }
      }
    });
  }

  editPlayer(player: any): void {
    const dialogRef = this.dialog.open(AddEventUserDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        eventId: this.selectedEventId,
        eventPlayerId: player.id,
        player: {
          id: player.player_id || player.id,
          username: player.username || player.gamertag,
          pronouns: player.pronouns
        },
        seed: player.seed,
        place: player.placement || player.place,
        onSuccess: () => {
          this.loadPlayers();
        }
      }
    });
  }

  deletePlayer(eventPlayerId: number, gamertag: string): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Remove Player from Event',
        message: `Are you sure you want to remove ${gamertag} from this event? This action cannot be undone.`,
        confirmText: 'Remove',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.eventPlayerService.removePlayerFromEvent(eventPlayerId).subscribe({
          next: () => {
            this.messageService.show('Player removed from event successfully');
            this.loadPlayers();
          },
          error: (error) => {
            console.error('Error removing player from event:', error);
            this.messageService.show('Error removing player from event. Please try again.');
          }
        });
      }
    });
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(fileEvent: Event): void {
    const input = fileEvent.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel'];
    const isValidType = validTypes.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
    
    if (!isValidType) {
      this.messageService.show('Invalid file type. Please select a CSV file.');
      // Reset file input
      input.value = '';
      return;
    }

    const eventIdToUse = this.selectedEventId || this.eventId;
    if (!eventIdToUse) {
      this.messageService.show('Please select an event first.');
      input.value = '';
      return;
    }

    // Confirm import
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Import Players from CSV',
        message: `Are you sure you want to import players from "${file.name}"? This will add all players from the CSV to the selected event.`,
        confirmText: 'Import',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.isImporting = true;
        this.messageService.show(`Starting import of "${file.name}"...`, 'Dismiss');
        this.eventPlayerService.bulkImportPlayers(eventIdToUse, file).subscribe({
          next: (response) => {
            this.isImporting = false;
            const summary = response.summary;
            let message = `Import completed! `;
            message += `${summary.playersAddedToEvent} player(s) added to event`;
            if (summary.playersCreated > 0) {
              message += `, ${summary.playersCreated} new player(s) created`;
            }
            if (summary.rowsSkipped > 0) {
              message += `, ${summary.rowsSkipped} row(s) skipped`;
            }
            if (summary.errors > 0) {
              message += `, ${summary.errors} error(s) occurred`;
            }
            this.messageService.show(message);
            this.loadPlayers();
            // Reset file input
            input.value = '';
          },
          error: (error) => {
            this.isImporting = false;
            console.error('Error importing players:', error);
            const errorMessage = error?.error?.message || 'Error importing players. Please check the CSV format and try again.';
            this.messageService.show(errorMessage);
            // Reset file input
            input.value = '';
          }
        });
      } else {
        // Reset file input if cancelled
        input.value = '';
      }
    });
  }
}

