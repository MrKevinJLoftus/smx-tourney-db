import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import { PlayerService, PlayerMergePreview } from '../../../services/player.service';
import { Player } from '../../../models/player';
import { Event } from '../../../models/event';
import { MessageService } from '../../../services/message.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-player-merge',
  standalone: true,
  imports: [SharedModule, ReactiveFormsModule],
  templateUrl: './player-merge.component.html',
  styleUrl: './player-merge.component.scss'
})
export class PlayerMergeComponent {
  keepSearchControl = new FormControl('');
  absorbSearchControl = new FormControl('');
  usernameControl = new FormControl('', { nonNullable: true });

  keepResults: Player[] = [];
  absorbResults: Player[] = [];
  keepPlayer: Player | null = null;
  absorbPlayer: Player | null = null;

  preview: PlayerMergePreview | null = null;
  isSearchingKeep = false;
  isSearchingAbsorb = false;
  isLoadingPreview = false;
  isMerging = false;

  constructor(
    private playerService: PlayerService,
    private messageService: MessageService,
    private dialog: MatDialog
  ) {
    this.keepSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          const q = (value || '').trim();
          if (!q || this.keepPlayer) {
            this.keepResults = [];
            return of([]);
          }
          this.isSearchingKeep = true;
          return this.playerService.searchPlayers(q);
        })
      )
      .subscribe({
        next: (players) => {
          this.keepResults = players || [];
          this.isSearchingKeep = false;
        },
        error: () => {
          this.keepResults = [];
          this.isSearchingKeep = false;
        }
      });

    this.absorbSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          const q = (value || '').trim();
          if (!q || this.absorbPlayer) {
            this.absorbResults = [];
            return of([]);
          }
          this.isSearchingAbsorb = true;
          return this.playerService.searchPlayers(q);
        })
      )
      .subscribe({
        next: (players) => {
          this.absorbResults = players || [];
          this.isSearchingAbsorb = false;
        },
        error: () => {
          this.absorbResults = [];
          this.isSearchingAbsorb = false;
        }
      });
  }

  selectKeep(player: Player): void {
    this.keepPlayer = player;
    this.keepResults = [];
    this.keepSearchControl.setValue(player.username, { emitEvent: false });
    this.usernameControl.setValue(player.username || '');
    this.loadPreview();
  }

  selectAbsorb(player: Player): void {
    this.absorbPlayer = player;
    this.absorbResults = [];
    this.absorbSearchControl.setValue(player.username, { emitEvent: false });
    this.loadPreview();
  }

  clearKeep(): void {
    this.keepPlayer = null;
    this.keepResults = [];
    this.keepSearchControl.setValue('');
    this.usernameControl.setValue('');
    this.preview = null;
  }

  clearAbsorb(): void {
    this.absorbPlayer = null;
    this.absorbResults = [];
    this.absorbSearchControl.setValue('');
    this.preview = null;
  }

  private playerId(player: Player | null): number | null {
    const id = player?.id ?? player?.player_id;
    return id != null ? Number(id) : null;
  }

  private loadPreview(): void {
    const keepId = this.playerId(this.keepPlayer);
    const absorbId = this.playerId(this.absorbPlayer);
    if (!keepId || !absorbId) {
      this.preview = null;
      return;
    }
    if (keepId === absorbId) {
      this.preview = null;
      this.messageService.show('Keep and Absorb must be different players.');
      return;
    }

    this.isLoadingPreview = true;
    this.playerService.previewPlayerMerge(keepId, absorbId).subscribe({
      next: (preview) => {
        this.preview = preview;
        this.isLoadingPreview = false;
        if (!this.usernameControl.value && preview.keep?.username) {
          this.usernameControl.setValue(preview.keep.username);
        }
      },
      error: (err) => {
        console.error('Error loading merge preview:', err);
        this.preview = null;
        this.isLoadingPreview = false;
        const msg = err?.error?.message || 'Error loading merge preview.';
        this.messageService.show(msg);
      }
    });
  }

  formatEventDate(event: Event): string {
    if (!event?.date) return '';
    const d = new Date(event.date);
    if (Number.isNaN(d.getTime())) return String(event.date);
    return d.toLocaleDateString();
  }

  confirmMerge(): void {
    const keepId = this.playerId(this.keepPlayer);
    const absorbId = this.playerId(this.absorbPlayer);
    if (!keepId || !absorbId || !this.preview?.canMerge || this.isMerging) {
      return;
    }

    const keepName = this.keepPlayer?.username || `ID ${keepId}`;
    const absorbName = this.absorbPlayer?.username || `ID ${absorbId}`;
    const resultingUsername = this.usernameControl.value.trim() || keepName;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '480px',
      data: {
        title: 'Merge Players',
        message:
          `Merge "${absorbName}" into "${keepName}"? ` +
          `All event and match history from "${absorbName}" will move to "${keepName}" (ID ${keepId}), ` +
          `"${absorbName}" will be deleted, and the surviving username will be "${resultingUsername}". ` +
          `Ratings will be rebuilt. This cannot be undone.`,
        confirmText: 'Merge',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.runMerge(keepId, absorbId, resultingUsername);
    });
  }

  private runMerge(keepId: number, absorbId: number, username: string): void {
    this.isMerging = true;
    this.playerService.mergePlayers(keepId, absorbId, username).subscribe({
      next: (result) => {
        this.isMerging = false;
        const rebuild = result.ratingsRebuild;
        const rebuildMsg = rebuild
          ? ` Ratings rebuilt (${rebuild.playersRated} players).`
          : ' Ratings rebuild failed; use Player Ratings to rebuild manually.';
        this.messageService.show(
          `Merged "${result.absorbedUsername}" into "${result.player.username}".${rebuildMsg}`
        );
        this.clearAbsorb();
        this.keepPlayer = result.player;
        this.keepSearchControl.setValue(result.player.username || '', { emitEvent: false });
        this.usernameControl.setValue(result.player.username || '');
        this.preview = null;
      },
      error: (err) => {
        console.error('Error merging players:', err);
        this.isMerging = false;
        const msg = err?.error?.message || 'Error merging players. Please try again.';
        this.messageService.show(msg);
      }
    });
  }
}
