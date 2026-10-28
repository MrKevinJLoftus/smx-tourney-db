import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { MessageService } from '../../../services/message.service';
import { WeeklyChallengeService } from '../../../services/weekly-challenge.service';
import {
  DifficultyBucketSettings,
  LevelBucket,
  WeeklyChallengeBucketSettings,
} from '../../../models/weekly-challenge';

interface DifficultyDraft {
  buckets: LevelBucket[];
  applyToCurrentWeek: boolean;
  isSaving: boolean;
}

@Component({
  selector: 'app-weekly-challenge-buckets',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './weekly-challenge-buckets.component.html',
  styleUrl: './weekly-challenge-buckets.component.scss',
})
export class WeeklyChallengeBucketsComponent implements OnInit {
  settings: WeeklyChallengeBucketSettings | null = null;
  drafts: Record<string, DifficultyDraft> = {};
  isLoading = false;
  error: string | null = null;

  constructor(
    private weeklyChallengeService: WeeklyChallengeService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.weeklyChallengeService.getBucketSettings().subscribe({
      next: (settings) => {
        this.isLoading = false;
        this.settings = settings;
        this.drafts = {};
        for (const difficulty of settings.difficulties) this.resetDraft(difficulty);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isLoading = false;
        this.error = err?.error?.message || 'Failed to load weekly challenge buckets.';
      },
    });
  }

  resetDraft(difficulty: DifficultyBucketSettings): void {
    this.drafts[difficulty.key] = {
      buckets: difficulty.nextWeek.buckets.map((b) => ({ ...b })),
      applyToCurrentWeek: false,
      isSaving: false,
    };
  }

  fillAutomatic(difficulty: DifficultyBucketSettings): void {
    this.drafts[difficulty.key].buckets = difficulty.automaticBuckets.map((b) => ({ ...b }));
  }

  setLevel(key: string, index: number, field: 'min' | 'max', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.drafts[key].buckets[index][field] = Number.isFinite(value) ? Math.round(value) : 0;
  }

  setApplyToCurrentWeek(key: string, checked: boolean): void {
    this.drafts[key].applyToCurrentWeek = checked;
  }

  chartCount(difficulty: DifficultyBucketSettings, bucket: LevelBucket): number {
    return difficulty.levelCounts
      .filter((c) => c.level >= bucket.min && c.level <= bucket.max)
      .reduce((sum, c) => sum + c.count, 0);
  }

  bucketError(bucket: LevelBucket): string | null {
    if (!this.settings) return null;
    if (!Number.isInteger(bucket.min) || !Number.isInteger(bucket.max)) return 'Whole numbers only.';
    if (bucket.min < this.settings.minLevel || bucket.max > this.settings.maxLevel) {
      return `Levels ${this.settings.minLevel}-${this.settings.maxLevel} only.`;
    }
    if (bucket.min > bucket.max) return 'Min is above max.';
    return null;
  }

  hasErrors(key: string): boolean {
    return this.drafts[key].buckets.some((b) => this.bucketError(b) !== null);
  }

  warnings(difficulty: DifficultyBucketSettings): string[] {
    const buckets = this.drafts[difficulty.key].buckets;
    if (this.hasErrors(difficulty.key)) return [];
    const warnings: string[] = [];

    const overlaps = buckets.some((a, i) => buckets.some((b, j) => j > i && a.min <= b.max && b.min <= a.max));
    if (overlaps) {
      warnings.push('Buckets overlap. A chart picked for an earlier bucket is never picked again for a later one.');
    }
    buckets.forEach((bucket, i) => {
      if (this.chartCount(difficulty, bucket) === 0) {
        warnings.push(`Bucket ${i + 1} has no charts, so its pick falls back to the nearest bucket.`);
      }
    });
    const covered = difficulty.levelCounts
      .filter((c) => buckets.some((b) => c.level >= b.min && c.level <= b.max))
      .reduce((sum, c) => sum + c.count, 0);
    if (covered > 0 && covered < buckets.length) {
      warnings.push(`Only ${covered} chart(s) fit these buckets, so the closest levels outside them fill the rest.`);
    }
    return warnings;
  }

  isUnchanged(difficulty: DifficultyBucketSettings): boolean {
    const draft = this.drafts[difficulty.key];
    const target = draft.applyToCurrentWeek ? difficulty.thisWeek : difficulty.nextWeek;
    return (
      target.custom &&
      target.buckets.every((b, i) => b.min === draft.buckets[i].min && b.max === draft.buckets[i].max)
    );
  }

  save(difficulty: DifficultyBucketSettings, automatic = false): void {
    const draft = this.drafts[difficulty.key];
    if (draft.isSaving || (!automatic && this.hasErrors(difficulty.key))) return;
    draft.isSaving = true;

    this.weeklyChallengeService
      .saveBucketSetting(difficulty.key, automatic ? null : draft.buckets, draft.applyToCurrentWeek)
      .subscribe({
        next: (response) => {
          if (this.settings) {
            const index = this.settings.difficulties.findIndex((d) => d.key === difficulty.key);
            this.settings.difficulties[index] = response.difficulty;
            this.resetDraft(response.difficulty);
          }
          const when = draft.applyToCurrentWeek ? "this week's charts were redrawn" : `starting ${response.effectiveWeek}`;
          this.messageService.show(
            `${difficulty.label} ${automatic ? 'set to automatic buckets' : 'buckets saved'}, ${when}.`
          );
        },
        error: (err: { error?: { message?: string } }) => {
          draft.isSaving = false;
          this.messageService.show(err?.error?.message || `Failed to save ${difficulty.label} buckets.`);
        },
      });
  }

  formatBuckets(buckets: LevelBucket[]): string {
    return buckets.map((b) => (b.min === b.max ? `${b.min}` : `${b.min}-${b.max}`)).join(', ');
  }
}
