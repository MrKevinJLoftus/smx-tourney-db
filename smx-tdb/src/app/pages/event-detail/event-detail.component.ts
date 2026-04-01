import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { EventService } from '../../services/event.service';
import { PlayerService } from '../../services/player.service';
import { MatchService } from '../../services/match.service';
import { Event } from '../../models/event';
import { MatchWithDetails } from '../../models/match';
import { forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';
import { OrdinalPipe } from '../../shared/pipes/ordinal.pipe';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, SharedModule, OrdinalPipe],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.scss'
})
export class EventDetailComponent implements OnInit {
  event: Event | null = null;
  participants: any[] = [];
  filteredParticipants: any[] = [];
  matches: MatchWithDetails[] = [];
  filteredMatches: MatchWithDetails[] = [];

  participantFilterControl = new FormControl('');
  matchFilterControl = new FormControl('');

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

    this.participantFilterControl.valueChanges
      .pipe(startWith(''), debounceTime(200), distinctUntilChanged())
      .subscribe(() => this.applyParticipantFilter());

    this.matchFilterControl.valueChanges
      .pipe(startWith(''), debounceTime(200), distinctUntilChanged())
      .subscribe(() => this.applyMatchFilter());

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
        this.applyParticipantFilter();
        this.applyMatchFilter();
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

  getMatchId(match: MatchWithDetails): number | undefined {
    return (match as any).id ?? match.match_id;
  }

  /** Player profile id (not event_x_player row id). */
  getParticipantPlayerId(p: any): number | undefined {
    const id = p?.player_id ?? p?.id;
    return id != null ? Number(id) : undefined;
  }

  navigateToPlayer(playerId: number | undefined): void {
    if (playerId != null) {
      this.router.navigate(['/player', playerId]);
    }
  }

  navigateToMatch(matchId: number | undefined): void {
    if (matchId != null) {
      this.router.navigate(['/match', matchId]);
    }
  }

  applyParticipantFilter(): void {
    const q = (this.participantFilterControl.value || '').toLowerCase().trim();
    if (!q) {
      this.filteredParticipants = [...(this.participants || [])];
      return;
    }
    this.filteredParticipants = (this.participants || []).filter((p) => {
      const placement =
        p.placement !== null && p.placement !== undefined
          ? String(p.placement)
          : '';
      const seed =
        p.seed !== null && p.seed !== undefined && p.seed > -1
          ? String(p.seed)
          : '';
      const haystack = [p.username, placement, seed]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  applyMatchFilter(): void {
    const q = (this.matchFilterControl.value || '').toLowerCase().trim();
    if (!q) {
      this.filteredMatches = [...(this.matches || [])];
      return;
    }
    this.filteredMatches = (this.matches || []).filter((m) => {
      const playersLine = this.formatMatchPlayers(m);
      const idStr =
        m.match_id != null ? String(m.match_id) : '';
      const haystack = [
        m.round,
        playersLine,
        m.winner?.gamertag,
        idStr,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }
}

