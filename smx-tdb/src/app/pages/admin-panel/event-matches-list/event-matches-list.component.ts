import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { MatchService } from '../../../services/match.service';
import { EventService } from '../../../services/event.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatchWithDetails } from '../../../models/match';
import { MatDialog } from '@angular/material/dialog';
import { MessageService } from '../../../services/message.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { AddEventMatchDialogComponent } from '../add-event-match-dialog/add-event-match-dialog.component';
import { Event } from '../../../models/event';

@Component({
  selector: 'app-event-matches-list',
  templateUrl: './event-matches-list.component.html',
  styleUrls: ['./event-matches-list.component.scss'],
  imports: [SharedModule]
})
export class EventMatchesListComponent implements OnInit, OnChanges {
  @Input() eventId?: number;
  matches$: Observable<MatchWithDetails[]> = of([]);
  events$: Observable<Event[]>;
  isLoading = false;
  selectedEventId?: number;
  selectedEvent: Event | null = null;

  constructor(
    private matchService: MatchService,
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
    this.loadMatches();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId'] && !changes['eventId'].firstChange) {
      this.selectedEventId = this.eventId;
      this.events$.subscribe(events => {
        this.selectedEvent = events.find(e => e.id === this.eventId) || null;
      });
      this.loadMatches();
    }
  }

  onEventChange(event: Event | null): void {
    this.selectedEvent = event;
    if (event) {
      this.selectedEventId = event.id;
    } else {
      this.selectedEventId = undefined;
    }
    this.loadMatches();
  }

  loadMatches(): void {
    const eventIdToUse = this.selectedEventId || this.eventId;
    if (eventIdToUse) {
      this.isLoading = true;
      this.matches$ = this.matchService.getMatchesByEvent(eventIdToUse).pipe(
        catchError(error => {
          console.error('Error loading matches:', error);
          return of([]);
        })
      );
      this.matches$.subscribe(() => {
        this.isLoading = false;
      });
    } else {
      this.matches$ = of([]);
      this.isLoading = false;
    }
  }

  openAddMatchDialog(): void {
    const dialogRef = this.dialog.open(AddEventMatchDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: {
        eventId: this.selectedEventId,
        onSuccess: () => {
          this.loadMatches();
        }
      }
    });
  }

  editMatch(match: any): void {
    const dialogRef = this.dialog.open(AddEventMatchDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: {
        matchId: match.match_id,
        match: match,
        eventId: this.selectedEventId,
        onSuccess: () => {
          this.loadMatches();
        }
      }
    });
  }

  deleteMatch(matchId: number): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Match',
        message: 'Are you sure you want to delete this match? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.matchService.deleteMatch(matchId).subscribe({
          next: () => {
            this.messageService.show('Match deleted successfully');
            this.loadMatches();
          },
          error: (error) => {
            console.error('Error deleting match:', error);
            this.messageService.show('Error deleting match. Please try again.');
          }
        });
      }
    });
  }
}

