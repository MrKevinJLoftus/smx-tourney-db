import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { PlayerService } from '../../../services/player.service';
import { EventPlayerService } from '../../../services/eventPlayer.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MessageService } from '../../../services/message.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-event-users-list',
  templateUrl: './event-users-list.component.html',
  styleUrls: ['./event-users-list.component.scss'],
  imports: [SharedModule]
})
export class EventUsersListComponent implements OnInit, OnChanges {
  @Input() eventId?: number;
  players$: Observable<any[]> = of([]);
  isLoading = false;

  constructor(
    private playerService: PlayerService,
    private eventPlayerService: EventPlayerService,
    private dialog: MatDialog,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadPlayers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId'] && !changes['eventId'].firstChange) {
      this.loadPlayers();
    }
  }

  loadPlayers(): void {
    if (this.eventId) {
      this.isLoading = true;
      this.players$ = this.playerService.getPlayersByEvent(this.eventId).pipe(
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
}

