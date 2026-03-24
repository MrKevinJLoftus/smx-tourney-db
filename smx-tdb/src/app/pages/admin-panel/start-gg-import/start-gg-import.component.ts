import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import {
  StartGgImportService,
  StartGgImportPreviewResponse,
  StartGgImportFullResponse
} from '../../../services/startGgImport.service';
import { EventService } from '../../../services/event.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';

type SetPreviewNode = NonNullable<
  NonNullable<StartGgImportPreviewResponse['setsPreview']>['nodes']
>[number];

@Component({
  selector: 'app-start-gg-import',
  templateUrl: './start-gg-import.component.html',
  styleUrl: './start-gg-import.component.scss',
  imports: [SharedModule]
})
export class StartGgImportComponent {
  form: FormGroup;
  isSubmitting = false;
  isImporting = false;
  preview: StartGgImportPreviewResponse | null = null;
  importResult: StartGgImportFullResponse | null = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private startGgImportService: StartGgImportService,
    private eventService: EventService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.form = this.fb.group({
      url: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  onSubmit(): void {
    this.errorMessage = null;
    this.preview = null;
    this.importResult = null;

    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const url = this.form.get('url')?.value as string;
    this.isSubmitting = true;
    this.loadingService.setIsLoading(true);

    this.startGgImportService.previewEvent(url).subscribe({
      next: (data) => {
        this.preview = data;
        this.messageService.show('Loaded event data from start.gg.');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
      },
      error: (err) => {
        console.error('start.gg preview error:', err);
        const msg =
          err.error?.message ||
          err.message ||
          'Could not load this event from start.gg.';
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

    const url = this.form.get('url')?.value as string;
    this.isImporting = true;
    this.loadingService.setIsLoading(true);

    this.startGgImportService.importFullEvent(url).subscribe({
      next: (data) => {
        this.importResult = data;
        this.eventService.reloadEvents();
        this.messageService.show(
          `Import complete. Local event id ${data.localEventId}.`
        );
        this.isImporting = false;
        this.loadingService.setIsLoading(false);
      },
      error: (err) => {
        console.error('start.gg import error:', err);
        let msg =
          err.error?.message ||
          err.message ||
          'Import failed.';
        if (err.status === 409 && err.error?.localEventId != null) {
          msg = `${msg} (existing local event id: ${err.error.localEventId})`;
        }
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

  /**
   * Human-readable bracket context when `fullRoundText` is duplicated across pools
   * (e.g. Uppers vs Lowers both show "Grand Final"). Prefer `phaseGroup.phase.name`;
   * fall back to group id / bracket type / negative `round` (losers side).
   */
  bracketContextLabel(set: SetPreviewNode): string {
    const pg = set.phaseGroup;
    if (pg?.phase?.name) {
      return pg.phase.name;
    }
    const parts: string[] = [];
    if (pg?.displayIdentifier != null && String(pg.displayIdentifier).trim() !== '') {
      parts.push(`Group ${String(pg.displayIdentifier).trim()}`);
    }
    if (pg?.bracketType) {
      parts.push(pg.bracketType.replace(/_/g, ' '));
    }
    if (typeof set.round === 'number' && set.round < 0) {
      parts.push('Losers side');
    }
    return parts.join(' · ');
  }

  bracketContextTitle(set: SetPreviewNode): string {
    const label = this.bracketContextLabel(set);
    const id = set.phaseGroup?.id;
    if (id != null && label) {
      return `${label} (start.gg phaseGroup id: ${id})`;
    }
    if (id != null) {
      return `start.gg phaseGroup id: ${id}`;
    }
    return label;
  }
}
