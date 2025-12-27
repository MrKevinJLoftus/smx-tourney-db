import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { PlayerService } from '../../../services/player.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

  constructor(private playerService: PlayerService) {}

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
}

