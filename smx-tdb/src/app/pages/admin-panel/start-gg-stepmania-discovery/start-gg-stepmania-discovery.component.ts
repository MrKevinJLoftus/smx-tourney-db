import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SharedModule } from '../../../shared/shared.module';
import {
  StartGgImportService,
  StartGgImportFullResponse,
  StartGgStepmaniaCandidate,
  StartGgStepmaniaRefreshResponse
} from '../../../services/startGgImport.service';
import { EventService } from '../../../services/event.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-start-gg-stepmania-discovery',
  templateUrl: './start-gg-stepmania-discovery.component.html',
  styleUrl: './start-gg-stepmania-discovery.component.scss',
  imports: [SharedModule, DatePipe]
})
export class StartGgStepmaniaDiscoveryComponent {
  isRefreshing = false;
  importingEventId: number | null = null;
  resetWatermark = false;
  lastRefresh: StartGgStepmaniaRefreshResponse | null = null;
  importResult: StartGgImportFullResponse | null = null;
  errorMessage: string | null = null;

  constructor(
    private startGgImportService: StartGgImportService,
    private eventService: EventService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {}

  eventPageUrl(c: StartGgStepmaniaCandidate): string {
    return `https://www.start.gg/${c.eventSlug}`;
  }

  onRefresh(): void {
    this.errorMessage = null;
    this.lastRefresh = null;
    this.importResult = null;
    if (this.isRefreshing) {
      return;
    }
    this.isRefreshing = true;
    this.loadingService.setIsLoading(true);

    this.startGgImportService.refreshStepmaniaDiscovery(this.resetWatermark).subscribe({
      next: (data) => {
        this.lastRefresh = data;
        const n = data.meta.candidateCount;
        this.messageService.show(
          n === 0
            ? 'Refresh complete — no new StepManiaX events to import.'
            : `Refresh complete — ${n} event(s) not yet imported.`
        );
        this.isRefreshing = false;
        this.loadingService.setIsLoading(false);
      },
      error: (err) => {
        console.error('start.gg StepManiaX refresh error:', err);
        const msg =
          err.error?.message ||
          err.message ||
          'Could not refresh StepManiaX events from start.gg.';
        this.errorMessage = msg;
        this.messageService.show(msg);
        this.isRefreshing = false;
        this.loadingService.setIsLoading(false);
      }
    });
  }

  onImportRow(startGgEventId: number): void {
    this.errorMessage = null;
    this.importResult = null;
    if (this.importingEventId != null) {
      return;
    }
    this.importingEventId = startGgEventId;
    this.loadingService.setIsLoading(true);

    this.startGgImportService.importEventByStartGgId(startGgEventId).subscribe({
      next: (data) => {
        this.importResult = data;
        this.eventService.reloadEvents();
        this.messageService.show(
          `Import complete. Local event id ${data.localEventId}.`
        );
        if (this.lastRefresh != null) {
          const nextCandidates = this.lastRefresh.candidates.filter(
            (c) => c.startGgEventId !== startGgEventId
          );
          this.lastRefresh = {
            ...this.lastRefresh,
            candidates: nextCandidates,
            meta: {
              ...this.lastRefresh.meta,
              candidateCount: nextCandidates.length
            }
          };
        }
        this.importingEventId = null;
        this.loadingService.setIsLoading(false);
      },
      error: (err) => {
        console.error('start.gg import-by-id error:', err);
        let msg =
          err.error?.message || err.message || 'Import failed.';
        if (err.status === 409 && err.error?.localEventId != null) {
          msg = `${msg} (existing local event id: ${err.error.localEventId})`;
        }
        this.errorMessage = msg;
        this.messageService.show(msg);
        this.importingEventId = null;
        this.loadingService.setIsLoading(false);
      }
    });
  }

  clearMessages(): void {
    this.errorMessage = null;
    this.importResult = null;
  }
}
