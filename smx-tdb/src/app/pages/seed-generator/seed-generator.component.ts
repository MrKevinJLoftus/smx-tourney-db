import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { Player } from '../../models/player';
import { SeedEntry } from '../../models/seed';
import { PlayerService } from '../../services/player.service';
import { SeedService } from '../../services/seed.service';
import { SharedModule } from '../../shared/shared.module';
import { RatingsHelpDialogComponent } from '../../shared/components/ratings-help-dialog/ratings-help-dialog.component';

@Component({
  selector: 'app-seed-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './seed-generator.component.html',
  styleUrl: './seed-generator.component.scss',
})
export class SeedGeneratorComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly rosterChange$ = new Subject<Player[]>();

  playerControl = new FormControl<Player | string>('');
  playerSuggestions$: Observable<Player[]>;

  roster: Player[] = [];
  seeding: SeedEntry[] = [];
  method = '';
  tiebreak = '';

  isGenerating = false;
  error: string | null = null;

  constructor(
    private playerService: PlayerService,
    private seedService: SeedService,
    private dialog: MatDialog
  ) {
    this.playerSuggestions$ = this.playerControl.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      map((value) => this.textFromPlayerControl(value)),
      distinctUntilChanged(),
      switchMap((query) => {
        if (query.trim().length < 2) {
          return of([]);
        }
        return this.playerService.searchPlayers(query).pipe(catchError(() => of([])));
      })
    );

    this.rosterChange$
      .pipe(
        switchMap((roster) => {
          if (roster.length < 1) {
            this.isGenerating = false;
            this.seeding = [];
            this.method = '';
            this.tiebreak = '';
            return of(null);
          }

          const playerIds = roster
            .map((player) => player.id)
            .filter((id): id is number => typeof id === 'number');

          this.isGenerating = true;
          this.error = null;

          return this.seedService.generateSeeding(playerIds).pipe(
            catchError((err) => of({ error: err?.error?.message || 'Failed to generate seeding.' }))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }

        if ('error' in response) {
          this.error = response.error;
          this.isGenerating = false;
          return;
        }

        this.seeding = response.seeding || [];
        this.method = response.method;
        this.tiebreak = response.tiebreak;
        this.isGenerating = false;
      });
  }

  displayPlayer(player: Player | string | null): string {
    if (!player) {
      return '';
    }
    if (typeof player === 'string') {
      return player;
    }
    return player.username || '';
  }

  onSelectPlayer(player: Player): void {
    if (!player?.id) {
      return;
    }
    if (this.roster.some((entry) => entry.id === player.id)) {
      this.error = `${player.username} is already on the roster.`;
      this.playerControl.setValue('');
      return;
    }

    this.roster = [...this.roster, player];
    this.playerControl.setValue('');
    this.error = null;
    this.rosterChange$.next(this.roster);
  }

  removePlayer(playerId: number): void {
    this.roster = this.roster.filter((player) => player.id !== playerId);
    this.rosterChange$.next(this.roster);
  }

  clearRoster(): void {
    this.roster = [];
    this.seeding = [];
    this.method = '';
    this.tiebreak = '';
    this.error = null;
    this.isGenerating = false;
  }

  copySeeding(): void {
    if (!this.seeding.length) {
      return;
    }

    const lines = this.seeding.map(
      (entry) =>
        `${entry.seed}. ${entry.player.username} (rating ${entry.rating}${entry.provisional ? ', provisional' : ''})`
    );
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {
      this.error = 'Could not copy to clipboard.';
    });
  }

  exportSeedingToCsv(): void {
    if (!this.seeding.length) {
      return;
    }

    const headers = ['Seed', 'Player ID', 'Username', 'Rating', 'RD', '1v1 Matches', 'Provisional'];
    const rows = this.seeding.map((entry) => [
      entry.seed,
      entry.player.id,
      entry.player.username,
      entry.rating,
      entry.deviation,
      entry.matchesCounted,
      entry.provisional ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seed-generator-${this.buildExportTimestamp()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  openRatingsHelp(): void {
    this.dialog.open(RatingsHelpDialogComponent, {
      width: '560px',
      autoFocus: false,
    });
  }

  private textFromPlayerControl(value: Player | string | null): string {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return value.username || '';
  }

  private escapeCsvCell(value: string | number): string {
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private buildExportTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  }
}
