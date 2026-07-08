import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PlayerRatingSummary } from '../../../models/rating';

@Component({
  selector: 'app-player-rating-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './player-rating-summary.component.html',
  styleUrl: './player-rating-summary.component.scss',
})
export class PlayerRatingSummaryComponent {
  @Input() rating: PlayerRatingSummary | null | undefined;
  @Input() showRankLink = false;
  @Input() rankLink = '/leaderboard';
  @Input() compact = false;

  get hasRating(): boolean {
    return !!this.rating;
  }
}
