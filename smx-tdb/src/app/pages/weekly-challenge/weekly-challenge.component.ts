import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SharedModule } from '../../shared/shared.module';
import { WeeklyChallengeService } from '../../services/weekly-challenge.service';
import {
  WeeklyChallengeAllTimeResponse,
  WeeklyChallengeChart,
  WeeklyChallengeResponse,
} from '../../models/weekly-challenge';

type WeeklyChallengeView = 'weekly' | 'all-time';

const MAX_WEEKS_BACK = 8;
const CHART_PREVIEW_COUNT = 10;
/** URL fragments for the difficulty tabs, in the order the API returns them. */
const TAB_KEYS = ['easy', 'hard', 'wild', 'full'] as const;

@Component({
  selector: 'app-weekly-challenge',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './weekly-challenge.component.html',
  styleUrl: './weekly-challenge.component.scss',
})
export class WeeklyChallengeComponent implements OnInit, OnDestroy {
  readonly maxWeeksBack = MAX_WEEKS_BACK;
  readonly chartPreviewCount = CHART_PREVIEW_COUNT;

  view: WeeklyChallengeView = 'weekly';
  challenge: WeeklyChallengeResponse | null = null;
  allTime: WeeklyChallengeAllTimeResponse | null = null;
  weekOffset = 0;
  selectedTab = 0;
  isLoading = false;
  error: string | null = null;
  countdown = '';
  expandedCharts = new Set<number>();

  private subscriptions = new Subscription();

  constructor(
    private weeklyChallengeService: WeeklyChallengeService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        this.view = params.get('view') === 'all-time' ? 'all-time' : 'weekly';
        const week = Number(params.get('week') ?? 0);
        this.weekOffset =
          Number.isInteger(week) && week <= 0 && week >= -MAX_WEEKS_BACK ? week : 0;
        if (this.view === 'all-time') {
          this.loadAllTime();
        } else {
          this.load();
        }
      })
    );
    this.subscriptions.add(
      this.route.fragment.subscribe((fragment) => {
        if (this.view !== 'weekly') return;
        const index = TAB_KEYS.indexOf(fragment as (typeof TAB_KEYS)[number]);
        this.selectedTab = index >= 0 ? index : 0;
      })
    );
    this.subscriptions.add(interval(30_000).subscribe(() => this.updateCountdown()));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.expandedCharts.clear();
    this.weeklyChallengeService
      .get(this.weekOffset)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.challenge = response;
          this.updateCountdown();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Unable to load the weekly challenge right now.';
          this.challenge = null;
        },
      });
  }

  loadAllTime(): void {
    this.isLoading = true;
    this.error = null;
    this.weeklyChallengeService
      .getAllTime()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => (this.allTime = response),
        error: (err) => {
          this.error = err?.error?.message || 'Unable to load the all-time standings right now.';
          this.allTime = null;
        },
      });
  }

  setView(view: WeeklyChallengeView): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'all-time' ? 'all-time' : null, week: null },
      fragment: view === 'weekly' ? TAB_KEYS[this.selectedTab] : undefined,
    });
  }

  selectTab(index: number): void {
    this.selectedTab = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      fragment: TAB_KEYS[index],
      replaceUrl: true,
    });
  }

  changeWeek(delta: number): void {
    const week = this.weekOffset + delta;
    if (week > 0 || week < -MAX_WEEKS_BACK) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { week: week === 0 ? null : week },
      preserveFragment: true,
    });
  }

  toggleChart(chartId: number): void {
    if (this.expandedCharts.has(chartId)) {
      this.expandedCharts.delete(chartId);
    } else {
      this.expandedCharts.add(chartId);
    }
  }

  visibleScores(chart: WeeklyChallengeChart) {
    return this.expandedCharts.has(chart.chartId)
      ? chart.scores
      : chart.scores.slice(0, CHART_PREVIEW_COUNT);
  }

  /** The week's `to` date is the last day of the window, so format it without shifting zones. */
  formatDay(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  private updateCountdown(): void {
    if (!this.challenge?.isCurrent) {
      this.countdown = '';
      return;
    }
    const remainingMs = Date.parse(this.challenge.endsAt) - Date.now();
    if (remainingMs <= 0) {
      this.countdown = 'New charts are being drawn';
      return;
    }
    const totalMinutes = Math.floor(remainingMs / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    this.countdown = `Resets in ${days ? `${days}d ` : ''}${hours}h ${minutes}m`;
  }
}
