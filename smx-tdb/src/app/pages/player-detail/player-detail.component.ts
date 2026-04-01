import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { OrdinalPipe } from '../../shared/pipes/ordinal.pipe';
import { PlayerService } from '../../services/player.service';
import { MatchService } from '../../services/match.service';
import { Player } from '../../models/player';
import { Event } from '../../models/event';
import { MatchWithDetails } from '../../models/match';
import { combineLatest, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-player-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, SharedModule, OrdinalPipe],
  templateUrl: './player-detail.component.html',
  styleUrl: './player-detail.component.scss'
})
export class PlayerDetailComponent implements OnInit {
  player: Player | null = null;
  events: Event[] = [];
  matches: MatchWithDetails[] = [];
  filteredEvents: Event[] = [];
  filteredMatches: MatchWithDetails[] = [];

  eventFilterControl = new FormControl('');
  matchFilterControl = new FormControl('');

  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private playerService: PlayerService,
    private matchService: MatchService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Invalid player ID';
      this.isLoading = false;
      return;
    }

    const playerId = parseInt(id, 10);
    if (isNaN(playerId)) {
      this.error = 'Invalid player ID';
      this.isLoading = false;
      return;
    }

    this.eventFilterControl.valueChanges
      .pipe(startWith(''), debounceTime(200), distinctUntilChanged())
      .subscribe(() => this.applyEventFilter());

    this.matchFilterControl.valueChanges
      .pipe(startWith(''), debounceTime(200), distinctUntilChanged())
      .subscribe(() => this.applyMatchFilter());

    this.loadPlayer(playerId);
  }

  loadPlayer(id: number): void {
    this.isLoading = true;
    this.error = null;

    combineLatest([
      this.playerService.getPlayerById(id).pipe(
        catchError(() => {
          this.error = 'Failed to load player. Please try again.';
          return of(null);
        })
      ),
      this.playerService.getEventsByPlayer(id).pipe(
        catchError(() => of([]))
      ),
      this.matchService.getMatchesByPlayer(id).pipe(
        catchError(() => of([]))
      )
    ]).subscribe({
      next: ([player, events, matches]) => {
        this.player = player;
        this.events = events;
        this.matches = matches;
        this.applyEventFilter();
        this.applyMatchFilter();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading player data:', error);
        this.error = 'Failed to load player data. Please try again.';
        this.isLoading = false;
      }
    });
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  }

  navigateToEvent(eventId: number | undefined): void {
    if (eventId) {
      this.router.navigate(['/event', eventId]);
    }
  }

  navigateToMatch(matchId: number | undefined): void {
    if (matchId) {
      this.router.navigate(['/match', matchId]);
    }
  }

  getPlayerId(): number | undefined {
    if (!this.player) return undefined;
    return (this.player as any).id || this.player.player_id;
  }

  getOpponentNames(match: MatchWithDetails): string {
    if (!match.players || match.players.length === 0) return 'Unknown';
    const playerId = this.getPlayerId();
    if (!playerId) {
      return match.players.map(p => p.gamertag).join(', ');
    }
    const opponents = match.players.filter(p => p.player_id !== playerId);
    if (opponents.length === 0) return 'Solo';
    return opponents.map(p => p.gamertag).join(', ');
  }

  getMatchId(match: MatchWithDetails): number | undefined {
    return (match as any).id || match.match_id;
  }

  getMatchRecord(): { wins: number; losses: number; draws: number } {
    const playerId = this.getPlayerId();
    if (!playerId || !this.matches) {
      return { wins: 0, losses: 0, draws: 0 };
    }

    // Match-level record only (match winner), not per-song stats.
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const match of this.matches) {
      if (match?.winner?.player_id !== undefined && match?.winner?.player_id !== null) {
        if (Number(match.winner.player_id) === Number(playerId)) wins++;
        else losses++;
      } else {
        draws++;
      }
    }
    return { wins, losses, draws };
  }

  getMatchRecordString(): string {
    const r = this.getMatchRecord();
    return `${r.wins}-${r.losses}${r.draws ? `-${r.draws}` : ''}`;
  }

  getPlacementNumber(event: Event): number | null {
    if (!event.placement) return null;
    const placement = typeof event.placement === 'string' ? parseInt(event.placement, 10) : event.placement;
    return isNaN(placement) ? null : placement;
  }

  applyEventFilter(): void {
    const q = (this.eventFilterControl.value || '').toLowerCase().trim();
    if (!q) {
      this.filteredEvents = [...(this.events || [])];
      return;
    }
    this.filteredEvents = (this.events || []).filter(e => {
      const placement = this.getPlacementNumber(e);
      const haystack = [
        e.name,
        e.location,
        e.organizers,
        e.date ? this.formatDate(e.date) : '',
        placement !== null ? `${placement}` : '',
      ]
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
    this.filteredMatches = (this.matches || []).filter(m => {
      const opponents = this.getOpponentNames(m);
      const haystack = [
        m.round,
        m.event?.name,
        m.event?.date ? this.formatDate(m.event.date) : '',
        opponents,
        m.winner?.gamertag,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }
}

