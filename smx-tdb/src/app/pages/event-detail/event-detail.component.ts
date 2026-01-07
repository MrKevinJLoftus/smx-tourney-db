import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { EventService } from '../../services/event.service';
import { PlayerService } from '../../services/player.service';
import { MatchService } from '../../services/match.service';
import { Event } from '../../models/event';
import { MatchWithDetails } from '../../models/match';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.scss'
})
export class EventDetailComponent implements OnInit {
  event: Event | null = null;
  participants: any[] = [];
  matches: MatchWithDetails[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private eventService: EventService,
    private playerService: PlayerService,
    private matchService: MatchService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Invalid event ID';
      this.isLoading = false;
      return;
    }

    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      this.error = 'Invalid event ID';
      this.isLoading = false;
      return;
    }

    this.loadEvent(eventId);
  }

  loadEvent(id: number): void {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      event: this.eventService.getEventById(id),
      participants: this.playerService.getPlayersByEvent(id).pipe(
        catchError(() => of([]))
      ),
      matches: this.matchService.getMatchesByEvent(id).pipe(
        catchError(() => of([]))
      )
    }).subscribe({
      next: (data) => {
        this.event = data.event;
        this.participants = data.participants;
        this.matches = data.matches;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading event:', error);
        this.error = 'Failed to load event. Please try again.';
        this.isLoading = false;
      }
    });
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  }

  formatMatchPlayers(match: MatchWithDetails): string {
    if (!match.players || match.players.length === 0) {
      return '';
    }
    return match.players.map(p => p.gamertag).join(' vs ');
  }
}

