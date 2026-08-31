import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  take,
} from 'rxjs/operators';
import { Player } from '../../models/player';
import {
  ChartComparison,
  PocketPickMode,
  ScoutCompareResponse,
  ScoutMode,
  ScoutPlayer,
  ScoutSuggestion,
} from '../../models/scout';
import { PocketVetoStorageService } from '../../services/pocket-veto-storage.service';
import { PlayerService } from '../../services/player.service';
import { ScoutService } from '../../services/scout.service';
import { ScoutHelpDialogComponent } from '../../shared/components/scout-help-dialog/scout-help-dialog.component';
import { SharedModule } from '../../shared/shared.module';
import { ScoutChartRowComponent } from './scout-chart-row/scout-chart-row.component';

const MODES: { value: ScoutMode; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'easy', label: 'Easy' },
  { value: 'hard', label: 'Hard' },
  { value: 'wild', label: 'Wild' },
  { value: 'dual', label: 'Dual' },
  { value: 'full', label: 'Full' },
];

@Component({
  selector: 'app-pocket-veto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule, ScoutChartRowComponent],
  templateUrl: './pocket-veto.component.html',
  styleUrl: './pocket-veto.component.scss',
})
export class PocketVetoComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly modes = MODES;

  youControl = new FormControl<ScoutSuggestion | string | null>('');
  opponentControl = new FormControl<ScoutSuggestion | string | null>('');
  modeControl = new FormControl<ScoutMode>('wild', { nonNullable: true });
  levelMinControl = new FormControl<number | null>(null);
  levelMaxControl = new FormControl<number | null>(null);

  youSuggestions$: Observable<ScoutSuggestion[]>;
  opponentSuggestions$: Observable<ScoutSuggestion[]>;

  you: ScoutPlayer | null = null;
  opponents: ScoutPlayer[] = [];

  isResolving = false;
  isComparing = false;
  error: string | null = null;
  compareResult: ScoutCompareResponse | null = null;

  constructor(
    private scoutService: ScoutService,
    private playerService: PlayerService,
    private storageService: PocketVetoStorageService,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    public router: Router
  ) {
    this.youSuggestions$ = this.buildSuggestions$(this.youControl);
    this.opponentSuggestions$ = this.buildSuggestions$(this.opponentControl);
  }

  ngOnInit(): void {
    const stored = this.storageService.loadYou();
    if (stored) {
      this.you = stored;
      this.youControl.setValue(this.toSuggestion(stored), { emitEvent: false });
    }

    this.route.queryParamMap
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((pm) => this.applyQueryParams(pm));
  }

  get canCompare(): boolean {
    return !!this.you && this.opponents.length > 0 && !this.isComparing;
  }

  displaySuggestion(value: ScoutSuggestion | string | ScoutPlayer | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.username || '';
  }

  onSelectYou(suggestion: ScoutSuggestion): void {
    this.resolveAndSetYou(suggestion.username);
  }

  onSelectOpponent(suggestion: ScoutSuggestion): void {
    this.resolveAndAddOpponent(suggestion.username);
  }

  onYouEnter(event: Event): void {
    event.preventDefault();
    const query = this.textFromControl(this.youControl.value);
    if (!query.trim()) return;
    this.resolveAndSetYou(query);
  }

  onOpponentEnter(event: Event): void {
    event.preventDefault();
    const query = this.textFromControl(this.opponentControl.value);
    if (!query.trim()) return;
    this.resolveAndAddOpponent(query);
  }

  clearYou(): void {
    this.you = null;
    this.youControl.setValue('');
    this.compareResult = null;
    this.storageService.clearYou();
    this.syncQueryParams();
  }

  removeOpponent(player: ScoutPlayer): void {
    this.opponents = this.opponents.filter((p) => p.id !== player.id);
    this.compareResult = null;
    this.syncQueryParams();
  }

  clearOpponents(): void {
    this.opponents = [];
    this.compareResult = null;
    this.syncQueryParams();
  }

  compare(): void {
    if (!this.you || !this.opponents.length) {
      return;
    }

    this.isComparing = true;
    this.error = null;
    this.compareResult = null;

    this.scoutService
      .compare({
        youId: this.you.id,
        opponentIds: this.opponents.map((p) => p.id),
        mode: this.modeControl.value,
        levelMin: this.levelMinControl.value,
        levelMax: this.levelMaxControl.value,
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.compareResult = result;
          this.isComparing = false;
          this.syncQueryParams();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to compare players.';
          this.isComparing = false;
        },
      });
  }

  statmaniaxPlayerUrl(id: number): string {
    return `https://statmaniax.com/player/${id}`;
  }

  pocketCharts(result: ScoutCompareResponse): ChartComparison[] {
    return result.pocketPickMode === 'wins' ? result.pocketPicks : result.closestMatchups;
  }

  pocketChartCount(result: ScoutCompareResponse): number {
    return this.pocketCharts(result).length;
  }

  pocketPanelDescription(result: ScoutCompareResponse): string {
    return result.pocketPickMode === 'wins'
      ? 'Charts where you lead the selected opponents'
      : 'Charts where you trail or tie — closest matchups first';
  }

  deltaClass(delta: number | null | undefined, mode: PocketPickMode): string {
    if (delta == null) return '';
    if (mode === 'wins') return 'positive';
    if (delta === 0) return 'even';
    return 'fallback';
  }

  openScoutHelp(): void {
    this.dialog.open(ScoutHelpDialogComponent, {
      width: '560px',
      autoFocus: false,
    });
  }

  private buildSuggestions$(control: FormControl<ScoutSuggestion | string | null>): Observable<ScoutSuggestion[]> {
    return control.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      map((v) => this.textFromControl(v)),
      distinctUntilChanged(),
      switchMap((query) => {
        const q = query.trim();
        if (q.length < 2) return of([]);

        return combineLatest([
          this.scoutService.searchPlayers(q).pipe(catchError(() => of([]))),
          this.playerService.searchPlayers(q).pipe(catchError(() => of([]))),
        ]).pipe(
          map(([smxPlayers, tdbPlayers]) => this.mergeSuggestions(smxPlayers, tdbPlayers))
        );
      })
    );
  }

  private mergeSuggestions(smxPlayers: ScoutPlayer[], tdbPlayers: Player[]): ScoutSuggestion[] {
    const byKey = new Map<string, ScoutSuggestion>();

    for (const player of smxPlayers || []) {
      const key = player.username.trim().toLowerCase();
      if (!key) continue;
      byKey.set(key, { id: player.id, username: player.username, source: 'statmaniax' });
    }

    for (const player of tdbPlayers || []) {
      const username = player.username?.trim();
      if (!username) continue;
      const key = username.toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, { id: player.id || player.player_id || 0, username, source: 'tdb' });
      }
    }

    return [...byKey.values()].sort((a, b) => a.username.localeCompare(b.username));
  }

  private resolveAndSetYou(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;

    this.isResolving = true;
    this.error = null;

    this.scoutService
      .resolvePlayer(trimmed)
      .pipe(take(1))
      .subscribe({
        next: (player) => {
          this.you = player;
          this.youControl.setValue(this.toSuggestion(player), { emitEvent: false });
          this.storageService.saveYou(player);
          this.compareResult = null;
          this.isResolving = false;
          this.syncQueryParams();
        },
        error: () => {
          this.error = `Could not find a StatManiaX player for "${trimmed}".`;
          this.isResolving = false;
        },
      });
  }

  private resolveAndAddOpponent(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (this.you && trimmed === String(this.you.id)) {
      this.error = 'You cannot add yourself as an opponent.';
      return;
    }

    this.isResolving = true;
    this.error = null;

    this.scoutService
      .resolvePlayer(trimmed)
      .pipe(take(1))
      .subscribe({
        next: (player) => {
          if (this.you && player.id === this.you.id) {
            this.error = 'You cannot add yourself as an opponent.';
            this.isResolving = false;
            return;
          }
          if (this.opponents.some((p) => p.id === player.id)) {
            this.error = `${player.username} is already in the opponent list.`;
            this.opponentControl.setValue('');
            this.isResolving = false;
            return;
          }

          this.opponents = [...this.opponents, player];
          this.opponentControl.setValue('');
          this.compareResult = null;
          this.isResolving = false;
          this.syncQueryParams();
        },
        error: () => {
          this.error = `Could not find a StatManiaX player for "${trimmed}".`;
          this.isResolving = false;
        },
      });
  }

  private applyQueryParams(pm: import('@angular/router').ParamMap): void {
    const youId = this.parseId(pm.get('you'));
    const vsRaw = pm.get('vs');
    const mode = pm.get('mode') as ScoutMode | null;
    const min = this.parseOptionalNumber(pm.get('min'));
    const max = this.parseOptionalNumber(pm.get('max'));

    if (mode && this.modes.some((m) => m.value === mode)) {
      this.modeControl.setValue(mode, { emitEvent: false });
    }
    if (min != null) this.levelMinControl.setValue(min, { emitEvent: false });
    if (max != null) this.levelMaxControl.setValue(max, { emitEvent: false });

    const opponentIds = (vsRaw || '')
      .split(',')
      .map((s) => this.parseId(s))
      .filter((id): id is number => id != null);

    if (!youId && !opponentIds.length) {
      return;
    }

    const loadYou$ = youId
      ? this.scoutService.resolvePlayer(String(youId)).pipe(catchError(() => of(null)))
      : of(this.you);

    loadYou$.pipe(take(1)).subscribe((player) => {
      if (player) {
        this.you = player;
        this.youControl.setValue(this.toSuggestion(player), { emitEvent: false });
        this.storageService.saveYou(player);
      }

      if (!opponentIds.length) return;

      const idsToLoad = opponentIds.filter((id) => id !== this.you?.id);
      idsToLoad.forEach((id) => {
        this.scoutService
          .resolvePlayer(String(id))
          .pipe(take(1))
          .subscribe({
            next: (player) => {
              if (this.you && player.id === this.you.id) return;
              if (this.opponents.some((p) => p.id === player.id)) return;
              this.opponents = [...this.opponents, player];
            },
          });
      });
    });
  }

  private syncQueryParams(): void {
    const qp: Record<string, string | number> = {};
    if (this.you?.id) qp['you'] = this.you.id;
    if (this.opponents.length) qp['vs'] = this.opponents.map((p) => p.id).join(',');
    if (this.modeControl.value) qp['mode'] = this.modeControl.value;
    if (this.levelMinControl.value != null) qp['min'] = this.levelMinControl.value;
    if (this.levelMaxControl.value != null) qp['max'] = this.levelMaxControl.value;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.keys(qp).length ? qp : {},
      replaceUrl: true,
    });
  }

  private toSuggestion(player: ScoutPlayer): ScoutSuggestion {
    return { id: player.id, username: player.username, source: 'statmaniax' };
  }

  private textFromControl(value: ScoutSuggestion | string | ScoutPlayer | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.username || '';
  }

  private parseId(raw: string | null): number | null {
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private parseOptionalNumber(raw: string | null): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
}
