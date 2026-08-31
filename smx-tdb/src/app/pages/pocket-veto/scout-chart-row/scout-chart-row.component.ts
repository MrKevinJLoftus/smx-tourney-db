import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChartComparison, ScoutMode } from '../../../models/scout';

@Component({
  selector: 'app-scout-chart-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scout-chart-row.component.html',
  styleUrl: './scout-chart-row.component.scss',
})
export class ScoutChartRowComponent {
  @Input({ required: true }) chart!: ChartComparison;
  @Input({ required: true }) mode!: ScoutMode;
  @Input() deltaClass = '';

  get modeLevelLabel(): string {
    const label = this.mode.charAt(0).toUpperCase() + this.mode.slice(1);
    return `${label} ${this.chart.level}`;
  }

  get songUrl(): string {
    if (this.chart.gameSongId != null && this.chart.difficultyId != null) {
      return `https://statmaniax.com/song/${this.chart.gameSongId}/${this.chart.difficultyId}`;
    }
    return '';
  }

  formatScore(score: number | null | undefined): string {
    if (score == null) return '—';
    return score.toLocaleString('en-US');
  }

  formatDelta(delta: number | null | undefined): string {
    if (delta == null) return '—';
    if (delta === 0) return 'Even';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toLocaleString('en-US')}`;
  }
}
