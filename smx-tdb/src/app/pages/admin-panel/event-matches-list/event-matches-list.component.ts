import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { MatchService } from '../../../services/match.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatchWithDetails } from '../../../models/match';
import { MatDialog } from '@angular/material/dialog';
import { MessageService } from '../../../services/message.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-event-matches-list',
  templateUrl: './event-matches-list.component.html',
  styleUrls: ['./event-matches-list.component.scss'],
  imports: [SharedModule]
})
export class EventMatchesListComponent implements OnInit, OnChanges {
  @Input() eventId?: number;
  matches$: Observable<MatchWithDetails[]> = of([]);
  isLoading = false;

  constructor(
    private matchService: MatchService,
    private dialog: MatDialog,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadMatches();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId'] && !changes['eventId'].firstChange) {
      this.loadMatches();
    }
  }

  loadMatches(): void {
    if (this.eventId) {
      this.isLoading = true;
      this.matches$ = this.matchService.getMatchesByEvent(this.eventId).pipe(
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

