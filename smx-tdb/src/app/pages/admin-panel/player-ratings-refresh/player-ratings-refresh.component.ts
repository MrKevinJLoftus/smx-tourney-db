import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SeedService } from '../../../services/seed.service';
import { MessageService } from '../../../services/message.service';
import { SharedModule } from '../../../shared/shared.module';
import { RebuildRatingsResponse } from '../../../models/seed';

@Component({
  selector: 'app-player-ratings-refresh',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './player-ratings-refresh.component.html',
  styleUrl: './player-ratings-refresh.component.scss',
})
export class PlayerRatingsRefreshComponent {
  isRefreshing = false;
  lastSummary: string | null = null;

  constructor(
    private seedService: SeedService,
    private messageService: MessageService
  ) {}

  refreshRatings(): void {
    if (this.isRefreshing) {
      return;
    }

    this.isRefreshing = true;
    this.lastSummary = null;

    this.seedService.rebuildRatings().subscribe({
      next: (response: RebuildRatingsResponse) => {
        this.isRefreshing = false;
        this.lastSummary = `${response.playersRated} players rated from ${response.matchesProcessed} 1v1 matches.`;
        this.messageService.show(response.message || 'Player ratings refreshed.');
      },
      error: (err: { error?: { message?: string } }) => {
        this.isRefreshing = false;
        const message = err?.error?.message || 'Failed to refresh player ratings.';
        this.messageService.show(message);
      },
    });
  }
}
