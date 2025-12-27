import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { MatchService } from '../../../services/match.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatchWithDetails } from '../../../models/match';

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

  constructor(private matchService: MatchService) {}

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
}

