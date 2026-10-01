import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import {
  TourneyImportService,
  TourneyImportSource,
  TourneyImportPreviewResponse,
  TourneyImportResponse,
  TourneyImportMatch,
  BlamethepadsTourney
} from '../../../services/tourneyImport.service';
import { EventService } from '../../../services/event.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';

type MatchStatus = 'new' | 'imported' | 'skipped';

@Component({
  selector: 'app-tourney-import',
  templateUrl: './tourney-import.component.html',
  styleUrl: './tourney-import.component.scss',
  imports: [SharedModule]
})
export class TourneyImportComponent {
  form: FormGroup;
  isSubmitting = false;
  isImporting = false;
  isLoadingTourneys = false;
  preview: TourneyImportPreviewResponse | null = null;
  importResult: TourneyImportResponse | null = null;
  errorMessage: string | null = null;
  tourneys: BlamethepadsTourney[] | null = null;
  tourneysError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private tourneyImportService: TourneyImportService,
    private eventService: EventService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.form = this.fb.group({
      source: ['ddrtools' as TourneyImportSource, Validators.required],
      ref: ['', Validators.required]
    });
  }

  get source(): TourneyImportSource {
    return this.form.get('source')?.value as TourneyImportSource;
  }

  get hasImportableMatches(): boolean {
    return !!this.preview?.events.some((e) => !e.blocker && e.counts.toImport > 0);
  }

  loadTourneys(): void {
    this.tourneysError = null;
    this.isLoadingTourneys = true;
    this.tourneyImportService.listBlamethepadsTourneys().subscribe({
      next: (data) => {
        this.tourneys = data.tourneys;
        this.isLoadingTourneys = false;
      },
      error: (err) => {
        console.error('blamethepads tourney list error:', err);
        this.tourneysError = err.error?.message || err.message || 'Could not load blamethepads tourneys.';
        this.isLoadingTourneys = false;
      }
    });
  }

  previewFrom(source: TourneyImportSource, ref: string | number): void {
    this.form.setValue({ source, ref: String(ref) });
    this.onSubmit();
  }

  onSubmit(): void {
    this.errorMessage = null;
    this.preview = null;
    this.importResult = null;

    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const { source, ref } = this.form.value as { source: TourneyImportSource; ref: string };
    this.isSubmitting = true;
    this.loadingService.setIsLoading(true);

    this.tourneyImportService.preview(source, ref).subscribe({
      next: (data) => {
        this.preview = data;
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
      },
      error: (err) => {
        console.error('tourney import preview error:', err);
        const msg = err.error?.message || err.message || 'Could not load tournament results.';
        this.errorMessage = msg;
        this.messageService.show(msg);
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
      }
    });
  }

  onImport(): void {
    this.errorMessage = null;
    this.importResult = null;

    if (this.form.invalid || this.isImporting) {
      this.form.markAllAsTouched();
      return;
    }

    const { source, ref } = this.form.value as { source: TourneyImportSource; ref: string };
    this.isImporting = true;
    this.loadingService.setIsLoading(true);

    this.tourneyImportService.import(source, ref).subscribe({
      next: (data) => {
        this.importResult = data;
        this.preview = null;
        this.eventService.reloadEvents();
        this.messageService.show(data.message);
        this.isImporting = false;
        this.loadingService.setIsLoading(false);
        if (this.tourneys) {
          this.loadTourneys();
        }
      },
      error: (err) => {
        console.error('tourney import error:', err);
        const msg = err.error?.message || err.message || 'Import failed.';
        this.errorMessage = msg;
        this.messageService.show(msg);
        this.isImporting = false;
        this.loadingService.setIsLoading(false);
      }
    });
  }

  clearResult(): void {
    this.preview = null;
    this.importResult = null;
    this.errorMessage = null;
  }

  matchStatus(match: TourneyImportMatch, eventBlocked: boolean): MatchStatus {
    if (match.alreadyImported) return 'imported';
    if (match.skipReason || eventBlocked) return 'skipped';
    return 'new';
  }

  matchStatusLabel(match: TourneyImportMatch, eventBlocked: boolean): string {
    switch (this.matchStatus(match, eventBlocked)) {
      case 'imported':
        return 'Already imported';
      case 'skipped':
        return match.skipReason ? `Skipped: ${match.skipReason}` : 'Skipped';
      default:
        return 'New';
    }
  }

  formatScore(score: number | null | undefined): string {
    return score == null ? '—' : score.toLocaleString();
  }
}
