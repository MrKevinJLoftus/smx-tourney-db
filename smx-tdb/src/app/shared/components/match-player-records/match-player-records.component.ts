import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerMatchRating, PlayerStats } from '../../../models/match';

@Component({
  selector: 'app-match-player-records',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-player-records.component.html',
  styleUrl: './match-player-records.component.scss',
})
export class MatchPlayerRecordsComponent {
  /** Per-song aggregate W–L–D for each competitor in the match (from API `player_stats`). */
  @Input() playerStats: PlayerStats[] | null | undefined;
  /** Pre-event Glicko-2 ratings for players in the match (from API `player_ratings`). */
  @Input() playerRatings: PlayerMatchRating[] | null | undefined;
  /** `chips`: pill style (e.g. home cards). `inline`: compact text rows (lists, expansion panels). */
  @Input() variant: 'chips' | 'inline' = 'inline';

  get hasStats(): boolean {
    return !!this.playerStats?.length;
  }

  get stats(): PlayerStats[] {
    return this.playerStats ?? [];
  }

  /** If any player has draws in this match, show the third number for every row (match-detail behavior). */
  get showDraws(): boolean {
    return this.stats.some((s) => Number(s.draws) > 0);
  }

  formatRecord(stat: PlayerStats): string {
    const w = Number(stat.wins) || 0;
    const l = Number(stat.losses) || 0;
    const d = Number(stat.draws) || 0;
    if (this.showDraws) {
      return `${w}-${l}-${d}`;
    }
    return `${w}-${l}`;
  }

  getRatingText(playerId: number): string | null {
    const rating = (this.playerRatings || []).find((entry) => Number(entry.player_id) === Number(playerId));
    if (!rating) {
      return null;
    }
    return `Rating ${rating.rating} (RD ${rating.deviation})`;
  }
}
