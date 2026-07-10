import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { Player } from '../../models/player';
import { GuestPlayerInput, SeedEntry, SeedRosterEntry } from '../../models/seed';
import { PlayerService } from '../../services/player.service';
import { SeedGeneratorStorageService } from '../../services/seed-generator-storage.service';
import { SeedService } from '../../services/seed.service';
import { SharedModule } from '../../shared/shared.module';
import { RatingsHelpDialogComponent } from '../../shared/components/ratings-help-dialog/ratings-help-dialog.component';

interface GuestOptionValue {
  guestUsername: string;
}

@Component({
  selector: 'app-seed-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './seed-generator.component.html',
  styleUrl: './seed-generator.component.scss',
})
export class SeedGeneratorComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly rosterChange$ = new Subject<SeedRosterEntry[]>();

  playerControl = new FormControl<Player | string | GuestOptionValue>('');
  playerSuggestions$: Observable<Player[]>;
  guestAddQuery$: Observable<string>;

  roster: SeedRosterEntry[] = [];
  nextGuestId = -1;
  seeding: SeedEntry[] = [];
  method = '';
  tiebreak = '';

  isGenerating = false;
  error: string | null = null;
  private latestSuggestions: Player[] = [];

  constructor(
    private playerService: PlayerService,
    private seedService: SeedService,
    private storageService: SeedGeneratorStorageService,
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

    this.playerSuggestions$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((suggestions) => {
      this.latestSuggestions = suggestions;
    });

    this.guestAddQuery$ = this.playerControl.valueChanges.pipe(
      startWith(''),
      map((value) => this.textFromPlayerControl(value)),
      distinctUntilChanged()
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
            .filter((entry): entry is Extract<SeedRosterEntry, { kind: 'tracked' }> => entry.kind === 'tracked')
            .map((entry) => entry.id);

          const guestPlayers: GuestPlayerInput[] = roster
            .filter((entry): entry is Extract<SeedRosterEntry, { kind: 'guest' }> => entry.kind === 'guest')
            .map((entry) => ({
              id: entry.guestId,
              username: entry.username,
            }));

          this.isGenerating = true;
          this.error = null;

          return this.seedService.generateSeeding(playerIds, guestPlayers).pipe(
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

    this.restoreRosterFromStorage();
  }

  displayPlayer(player: Player | string | GuestOptionValue | null): string {
    if (!player) {
      return '';
    }
    if (typeof player === 'object' && 'guestUsername' in player) {
      return player.guestUsername;
    }
    if (typeof player === 'string') {
      return player;
    }
    return player.username || '';
  }

  guestOptionValue(query: string): GuestOptionValue {
    return { guestUsername: query.trim() };
  }

  isGuestOptionValue(value: unknown): value is GuestOptionValue {
    return !!value && typeof value === 'object' && 'guestUsername' in value;
  }

  canAddGuest(query: string): boolean {
    const trimmed = query.trim();
    return trimmed.length >= 2 && !this.hasRosterUsername(trimmed);
  }

  onSelectPlayer(player: Player): void {
    if (!player?.id) {
      return;
    }
    if (this.roster.some((entry) => entry.kind === 'tracked' && entry.id === player.id)) {
      this.error = `${player.username} is already on the roster.`;
      this.playerControl.setValue('');
      return;
    }

    this.addRosterEntry({ kind: 'tracked', id: player.id, username: player.username });
    this.playerControl.setValue('');
    this.error = null;
  }

  onAddGuestFromQuery(query: string): void {
    const username = query.trim();
    if (!this.canAddGuest(username)) {
      if (username.length >= 2 && this.hasRosterUsername(username)) {
        this.error = `${username} is already on the roster.`;
      }
      return;
    }

    this.addGuestPlayer(username);
    this.playerControl.setValue('');
    this.error = null;
  }

  onPlayerInputEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }

    const query = this.textFromPlayerControl(this.playerControl.value);
    if (!this.canAddGuest(query) || this.matchesTrackedSuggestion(query)) {
      return;
    }

    keyboardEvent.preventDefault();
    this.onAddGuestFromQuery(query);
  }

  onAutocompleteSelected(value: Player | string | GuestOptionValue): void {
    if (this.isGuestOptionValue(value)) {
      this.onAddGuestFromQuery(value.guestUsername);
      return;
    }

    if (typeof value !== 'string') {
      this.onSelectPlayer(value);
    }
  }

  removePlayer(entry: SeedRosterEntry): void {
    this.roster = this.roster.filter((player) => !this.isSameRosterEntry(player, entry));
    this.persistRoster();
    this.rosterChange$.next(this.roster);
  }

  clearRoster(): void {
    this.roster = [];
    this.nextGuestId = -1;
    this.seeding = [];
    this.method = '';
    this.tiebreak = '';
    this.error = null;
    this.isGenerating = false;
    this.storageService.clear();
    this.rosterChange$.next(this.roster);
  }

  private matchesTrackedSuggestion(query: string): boolean {
    const normalized = query.trim().toLowerCase();
    return this.latestSuggestions.some((player) => player.username.trim().toLowerCase() === normalized);
  }

  copySeeding(): void {
    if (!this.seeding.length) {
      return;
    }

    const lines = this.seeding.map((entry) => {
      const tags: string[] = [];
      if (entry.player.isGuest || entry.player.id < 0) {
        tags.push('guest');
      }
      if (entry.provisional) {
        tags.push('provisional');
      }

      const suffix = tags.length ? `, ${tags.join(', ')}` : '';
      return `${entry.seed}. ${entry.player.username} (rating ${entry.rating}${suffix})`;
    });

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
      entry.player.id > 0 ? entry.player.id : 'guest',
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

  private restoreRosterFromStorage(): void {
    const stored = this.storageService.load();
    if (!stored) {
      return;
    }

    this.roster = stored.entries;
    this.nextGuestId = stored.nextGuestId;
    this.rosterChange$.next(this.roster);
  }

  private addGuestPlayer(username: string): void {
    const trimmed = username.trim();
    if (!this.canAddGuest(trimmed)) {
      return;
    }

    const guestId = this.nextGuestId;
    this.nextGuestId -= 1;
    this.addRosterEntry({ kind: 'guest', guestId, username: trimmed });
  }

  private addRosterEntry(entry: SeedRosterEntry): void {
    this.roster = [...this.roster, entry];
    this.persistRoster();
    this.rosterChange$.next(this.roster);
  }

  private persistRoster(): void {
    this.storageService.save(this.roster, this.nextGuestId);
  }

  private hasRosterUsername(username: string): boolean {
    const normalized = username.trim().toLowerCase();
    return this.roster.some((entry) => entry.username.trim().toLowerCase() === normalized);
  }

  private isSameRosterEntry(a: SeedRosterEntry, b: SeedRosterEntry): boolean {
    if (a.kind !== b.kind) {
      return false;
    }

    if (a.kind === 'tracked' && b.kind === 'tracked') {
      return a.id === b.id;
    }

    if (a.kind === 'guest' && b.kind === 'guest') {
      return a.guestId === b.guestId;
    }

    return false;
  }

  private textFromPlayerControl(value: Player | string | GuestOptionValue | null): string {
    if (!value) {
      return '';
    }
    if (this.isGuestOptionValue(value)) {
      return value.guestUsername;
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
