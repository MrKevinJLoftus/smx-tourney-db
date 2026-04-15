import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import { PlayerService } from '../../../services/player.service';
import { Player } from '../../../models/player';
import { MessageService } from '../../../services/message.service';

@Component({
  selector: 'app-player-match-privacy',
  standalone: true,
  imports: [SharedModule, ReactiveFormsModule],
  templateUrl: './player-match-privacy.component.html',
  styleUrl: './player-match-privacy.component.scss'
})
export class PlayerMatchPrivacyComponent {
  searchControl = new FormControl('');
  selectedPlayer: Player | null = null;
  results: Player[] = [];

  hideMatchesControl = new FormControl<boolean>(true, { nonNullable: true });
  deleteInsteadControl = new FormControl<boolean>(false, { nonNullable: true });
  deleteEventParticipationControl = new FormControl<boolean>(false, { nonNullable: true });

  isSearching = false;
  isSaving = false;

  constructor(
    private playerService: PlayerService,
    private messageService: MessageService
  ) {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          const q = (value || '').trim();
          if (!q) {
            this.results = [];
            return of([]);
          }
          this.isSearching = true;
          return this.playerService.searchPlayers(q);
        })
      )
      .subscribe({
        next: (players) => {
          this.results = players || [];
          this.isSearching = false;
        },
        error: () => {
          this.results = [];
          this.isSearching = false;
        }
      });
  }

  selectPlayer(p: Player): void {
    this.selectedPlayer = p;
    const hidden = !!p.hidden_matches;
    this.hideMatchesControl.setValue(hidden);
  }

  clearSelection(): void {
    this.selectedPlayer = null;
    this.results = [];
    this.searchControl.setValue('');
    this.hideMatchesControl.setValue(true);
    this.deleteInsteadControl.setValue(false);
    this.deleteEventParticipationControl.setValue(false);
  }

  apply(): void {
    const playerId = this.selectedPlayer?.id ?? this.selectedPlayer?.player_id;
    if (!playerId) return;

    this.isSaving = true;
    const hidden = this.hideMatchesControl.value;
    const shouldDelete = this.deleteInsteadControl.value;
    const shouldDeleteEventParticipation = this.deleteEventParticipationControl.value;

    this.playerService
      .setPlayerMatchDataHidden(playerId, hidden, {
        delete: shouldDelete,
        deleteEventParticipation: shouldDeleteEventParticipation
      })
      .subscribe({
      next: (resp) => {
        this.isSaving = false;
        this.selectedPlayer = resp.player;
        const deleted = resp.deletedMatches || 0;
        const deletedEps = resp.deletedEventParticipations || 0;
        if (shouldDelete) {
          const parts = [`Deleted ${deleted} matches`];
          if (shouldDeleteEventParticipation) {
            parts.push(`deleted ${deletedEps} event entries`);
          }
          this.messageService.show(`Updated. ${parts.join(', ')}.`);
        } else {
          this.messageService.show(hidden ? 'Updated. Match data hidden.' : 'Updated. Match data unhidden.');
        }
      },
      error: (err) => {
        console.error('Error updating player match privacy:', err);
        this.isSaving = false;
        this.messageService.show('Error updating player. Please try again.');
      }
    });
  }
}

