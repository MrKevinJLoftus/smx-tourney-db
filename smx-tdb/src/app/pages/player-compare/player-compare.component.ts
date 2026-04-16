import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap, take, tap } from 'rxjs/operators';
import { Player } from '../../models/player';
import { MatchWithDetails, PlayerStats } from '../../models/match';
import { MatchService } from '../../services/match.service';
import { PlayerService } from '../../services/player.service';
import { SharedModule } from '../../shared/shared.module';

type SimplePlayer = { id: number; username: string };

@Component({
  selector: 'app-player-compare',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './player-compare.component.html',
  styleUrl: './player-compare.component.scss',
})
export class PlayerCompareComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  playerAControl = new FormControl<Player | string>('');
  playerBControl = new FormControl<SimplePlayer | string>({ value: '', disabled: true } as any);

  playerASuggestions$: Observable<Player[]>;
  opponentSuggestions$: Observable<SimplePlayer[]>;

  selectedA: Player | null = null;
  selectedB: SimplePlayer | null = null;

  isLoadingOpponents = false;
  isLoadingMatches = false;
  error: string | null = null;

  private matchesByA: MatchWithDetails[] = [];
  private opponentPool: SimplePlayer[] = [];

  headToHeadMatches: MatchWithDetails[] = [];
  headToHeadMatchRecord: { aWins: number; bWins: number; draws: number; total: number } = {
    aWins: 0,
    bWins: 0,
    draws: 0,
    total: 0,
  };
  headToHeadSongRecord: { a: { wins: number; losses: number; draws: number }; b: { wins: number; losses: number; draws: number } } | null =
    null;

  constructor(
    private playerService: PlayerService,
    private matchService: MatchService,
    private route: ActivatedRoute,
    public router: Router
  ) {
    this.playerASuggestions$ = this.playerAControl.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      map((v) => this.textFromPlayerControl(v)),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.trim().length < 2) return of([]);
        return this.playerService.searchPlayers(q).pipe(catchError(() => of([])));
      })
    );

    this.opponentSuggestions$ = this.playerBControl.valueChanges.pipe(
      startWith(''),
      debounceTime(150),
      map((v) => this.textFromSimplePlayerControl(v)),
      distinctUntilChanged(),
      map((q) => this.filterOpponents(q))
    );

    // If the user types in A field after selecting, clear state.
    this.playerAControl.valueChanges
      .pipe(
        debounceTime(150),
        takeUntilDestroyed(this.destroyRef),
        tap((v) => {
          if (typeof v === 'string' && this.selectedA && v !== this.selectedA.username) {
            this.clearSelectionA();
          }
        })
      )
      .subscribe();

    // If the user types in B field after selecting, clear B selection + recompute.
    this.playerBControl.valueChanges
      .pipe(
        debounceTime(150),
        takeUntilDestroyed(this.destroyRef),
        tap((v) => {
          if (typeof v === 'string' && this.selectedB && v !== this.selectedB.username) {
            this.selectedB = null;
            this.recomputeHeadToHead();
          }
        })
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        distinctUntilChanged(
          (a, b) => a.get('a') === b.get('a') && a.get('b') === b.get('b')
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((pm) => {
        const aId = this.parseQueryParamId(pm.get('a'));
        const bId = this.parseQueryParamId(pm.get('b'));
        if (aId === this.selectedAId && bId === (this.selectedB?.id ?? null)) {
          return;
        }
        this.applyUrlState(aId, bId);
      });
  }

  displayPlayer(p: Player | string | null): string {
    if (!p) return '';
    if (typeof p === 'string') return p;
    return p.username || '';
  }

  displaySimplePlayer(p: SimplePlayer | string | null): string {
    if (!p) return '';
    if (typeof p === 'string') return p;
    return p.username || '';
  }

  onSelectPlayerA(player: Player): void {
    this.selectPlayerA(player);
  }

  onSelectPlayerB(player: SimplePlayer): void {
    this.selectedB = player;
    this.playerBControl.setValue(player, { emitEvent: false });
    this.recomputeHeadToHead();
    this.syncQueryParams();
  }

  clearAInput(): void {
    this.playerAControl.setValue('');
    this.clearSelectionA();
  }

  clearBInput(): void {
    this.playerBControl.setValue('');
    this.selectedB = null;
    this.recomputeHeadToHead();
    this.syncQueryParams();
  }

  navigateToMatch(match: MatchWithDetails): void {
    const id = (match as any).id || match.match_id;
    if (id) this.router.navigate(['/match', id]);
  }

  navigateToPlayer(playerId: number | null | undefined): void {
    if (playerId) this.router.navigate(['/player', playerId]);
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  get hasOpponents(): boolean {
    return !!this.opponentPool?.length;
  }

  get opponentCount(): number {
    return this.opponentPool?.length || 0;
  }

  get canShowResults(): boolean {
    return !!(this.selectedA && this.selectedB);
  }

  get selectedAId(): number | null {
    return this.selectedA ? this.playerId(this.selectedA) : null;
  }

  private clearSelectionA(): void {
    this.selectedA = null;
    this.selectedB = null;
    this.matchesByA = [];
    this.opponentPool = [];
    this.headToHeadMatches = [];
    this.headToHeadMatchRecord = { aWins: 0, bWins: 0, draws: 0, total: 0 };
    this.headToHeadSongRecord = null;
    this.playerBControl.disable({ emitEvent: false });
    this.playerBControl.setValue('', { emitEvent: false });
    this.error = null;
    this.syncQueryParams();
  }

  /** Query params: `?a=<playerId>&b=<playerId>` — shareable deep links. */
  private syncQueryParams(): void {
    const qp: Record<string, number> = {};
    const a = this.selectedAId;
    const b = this.selectedB?.id ?? null;
    if (a != null) qp['a'] = a;
    if (b != null) qp['b'] = b;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.keys(qp).length ? qp : {},
      replaceUrl: true,
    });
  }

  private parseQueryParamId(raw: string | null): number | null {
    if (raw == null || raw === '') return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private applyUrlState(aId: number | null, bId: number | null): void {
    if (!aId) {
      if (this.selectedA) {
        this.clearSelectionAWithoutUrlSync();
      }
      return;
    }
    if (this.selectedAId === aId && this.matchesByA.length > 0) {
      this.applyOpponentById(bId);
      return;
    }
    this.error = null;
    this.playerService
      .getPlayerById(aId)
      .pipe(take(1))
      .subscribe({
        next: (player) => {
          this.selectPlayerA(player, { bIdFromUrl: bId });
        },
        error: () => {
          this.error = 'Could not load player from URL.';
          this.clearSelectionAWithoutUrlSync();
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
        },
      });
  }

  private clearSelectionAWithoutUrlSync(): void {
    this.selectedA = null;
    this.selectedB = null;
    this.matchesByA = [];
    this.opponentPool = [];
    this.headToHeadMatches = [];
    this.headToHeadMatchRecord = { aWins: 0, bWins: 0, draws: 0, total: 0 };
    this.headToHeadSongRecord = null;
    this.playerAControl.setValue('', { emitEvent: false });
    this.playerBControl.disable({ emitEvent: false });
    this.playerBControl.setValue('', { emitEvent: false });
    this.error = null;
  }

  /**
   * Loads Player A and their matches. Optionally applies Player B from a deep link after matches load.
   */
  private selectPlayerA(player: Player, options?: { bIdFromUrl?: number | null }): void {
    this.selectedA = player;
    this.error = null;
    this.selectedB = null;
    this.headToHeadMatches = [];
    this.headToHeadMatchRecord = { aWins: 0, bWins: 0, draws: 0, total: 0 };
    this.headToHeadSongRecord = null;

    this.playerAControl.setValue(player, { emitEvent: false });
    this.playerBControl.setValue('', { emitEvent: false });
    this.playerBControl.enable({ emitEvent: false });

    const aId = this.playerId(player);
    if (!aId) {
      this.error = 'Invalid player selection.';
      this.syncQueryParams();
      return;
    }

    this.isLoadingOpponents = true;
    this.isLoadingMatches = true;

    this.matchService
      .getMatchesByPlayer(aId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (matches) => {
          this.matchesByA = matches || [];
          this.opponentPool = this.buildOpponentPool(aId, this.matchesByA);
          this.isLoadingOpponents = false;
          this.isLoadingMatches = false;
          const bFromUrl = options?.bIdFromUrl;
          if (bFromUrl != null) {
            this.applyOpponentById(bFromUrl);
          } else {
            this.recomputeHeadToHead();
            this.syncQueryParams();
          }
        },
        error: (e) => {
          console.error('Failed to load matches for player compare:', e);
          this.matchesByA = [];
          this.opponentPool = [];
          this.isLoadingOpponents = false;
          this.isLoadingMatches = false;
          this.error = 'Failed to load matches for that player. Please try again.';
          this.syncQueryParams();
        },
      });
  }

  /** Set Player B by id (from URL or pool). */
  private applyOpponentById(bId: number | null): void {
    if (bId == null) {
      this.selectedB = null;
      this.playerBControl.setValue('', { emitEvent: false });
      this.recomputeHeadToHead();
      this.syncQueryParams();
      return;
    }
    const fromPool = this.opponentPool.find((o) => o.id === bId);
    if (fromPool) {
      this.selectedB = fromPool;
      this.playerBControl.setValue(fromPool, { emitEvent: false });
      this.recomputeHeadToHead();
      this.syncQueryParams();
      return;
    }
    this.playerService
      .getPlayerById(bId)
      .pipe(take(1))
      .subscribe({
        next: (p) => {
          const id = this.playerId(p);
          if (!id) {
            this.selectedB = null;
            this.recomputeHeadToHead();
            this.syncQueryParams();
            return;
          }
          this.selectedB = { id, username: p.username };
          this.playerBControl.setValue(this.selectedB, { emitEvent: false });
          this.recomputeHeadToHead();
          this.syncQueryParams();
        },
        error: () => {
          this.selectedB = null;
          this.playerBControl.setValue('', { emitEvent: false });
          this.recomputeHeadToHead();
          this.syncQueryParams();
        },
      });
  }

  private recomputeHeadToHead(): void {
    const aId = this.selectedA ? this.playerId(this.selectedA) : null;
    const bId = this.selectedB?.id ?? null;

    if (!aId || !bId) {
      this.headToHeadMatches = [];
      this.headToHeadMatchRecord = { aWins: 0, bWins: 0, draws: 0, total: 0 };
      this.headToHeadSongRecord = null;
      return;
    }

    const matches = (this.matchesByA || []).filter((m) => this.matchHasPlayer(m, bId));
    matches.sort((m1, m2) => {
      const d1 = m1?.event?.date ? new Date(m1.event.date).getTime() : 0;
      const d2 = m2?.event?.date ? new Date(m2.event.date).getTime() : 0;
      return d2 - d1;
    });

    this.headToHeadMatches = matches;
    this.headToHeadMatchRecord = this.computeMatchLevelRecord(matches, aId, bId);
    this.headToHeadSongRecord = this.computeSongLevelRecord(matches, aId, bId);
  }

  private computeMatchLevelRecord(
    matches: MatchWithDetails[],
    aId: number,
    bId: number
  ): { aWins: number; bWins: number; draws: number; total: number } {
    let aWins = 0;
    let bWins = 0;
    let draws = 0;
    for (const m of matches || []) {
      const w = m?.winner?.player_id;
      if (w == null) draws++;
      else if (Number(w) === Number(aId)) aWins++;
      else if (Number(w) === Number(bId)) bWins++;
      else draws++;
    }
    return { aWins, bWins, draws, total: (matches || []).length };
  }

  private computeSongLevelRecord(
    matches: MatchWithDetails[],
    aId: number,
    bId: number
  ): { a: { wins: number; losses: number; draws: number }; b: { wins: number; losses: number; draws: number } } | null {
    let a = { wins: 0, losses: 0, draws: 0 };
    let b = { wins: 0, losses: 0, draws: 0 };

    let foundAny = false;
    for (const m of matches || []) {
      const stats = m?.player_stats || [];
      const aStat = stats.find((s) => Number(s.player_id) === Number(aId));
      const bStat = stats.find((s) => Number(s.player_id) === Number(bId));
      if (!aStat || !bStat) continue;
      foundAny = true;
      a = this.addStats(a, aStat);
      b = this.addStats(b, bStat);
    }

    return foundAny ? { a, b } : null;
  }

  private addStats(
    acc: { wins: number; losses: number; draws: number },
    s: PlayerStats
  ): { wins: number; losses: number; draws: number } {
    return {
      wins: acc.wins + (Number(s.wins) || 0),
      losses: acc.losses + (Number(s.losses) || 0),
      draws: acc.draws + (Number(s.draws) || 0),
    };
  }

  private buildOpponentPool(aId: number, matches: MatchWithDetails[]): SimplePlayer[] {
    const mapById = new Map<number, SimplePlayer>();
    for (const m of matches || []) {
      for (const p of m.players || []) {
        if (Number(p.player_id) === Number(aId)) continue;
        const id = Number(p.player_id);
        if (!Number.isFinite(id)) continue;
        if (!mapById.has(id)) {
          mapById.set(id, { id, username: p.gamertag || 'Unknown' });
        }
      }
    }
    return [...mapById.values()].sort((x, y) => x.username.localeCompare(y.username));
  }

  private filterOpponents(query: string): SimplePlayer[] {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [...this.opponentPool];
    return (this.opponentPool || []).filter((p) => p.username.toLowerCase().includes(q));
  }

  private matchHasPlayer(match: MatchWithDetails, playerId: number): boolean {
    return !!match?.players?.some((p) => Number(p.player_id) === Number(playerId));
  }

  private playerId(p: Player): number | null {
    const id = (p as any).id ?? p.player_id;
    if (id == null) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }

  private textFromPlayerControl(v: unknown): string {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && 'username' in v) return (v as Player).username || '';
    return '';
  }

  private textFromSimplePlayerControl(v: unknown): string {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && 'username' in v) return (v as SimplePlayer).username || '';
    return '';
  }
}

