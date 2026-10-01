import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { SongService } from '../../../services/song.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { SongCatalogPreview, SongCatalogImportResult, SongCatalogChart } from '../../../models/song';

@Component({
  selector: 'app-song-catalog-refresh',
  templateUrl: './song-catalog-refresh.component.html',
  styleUrl: './song-catalog-refresh.component.scss',
  imports: [SharedModule]
})
export class SongCatalogRefreshComponent {
  applyLevelChanges = new FormControl(false, { nonNullable: true });
  isPreviewing = false;
  isImporting = false;
  preview: SongCatalogPreview | null = null;
  importResult: SongCatalogImportResult | null = null;
  errorMessage: string | null = null;

  constructor(
    private songService: SongService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {}

  get hasChanges(): boolean {
    if (!this.preview) return false;
    return (
      this.preview.newSongs.length > 0 ||
      this.preview.newCharts.length > 0 ||
      (this.applyLevelChanges.value && this.preview.levelChanges.length > 0)
    );
  }

  get newSongChartCount(): number {
    return this.preview ? this.preview.newSongs.reduce((n, s) => n + s.charts.length, 0) : 0;
  }

  onPreview(): void {
    if (this.isPreviewing) return;
    this.errorMessage = null;
    this.importResult = null;
    this.isPreviewing = true;
    this.loadingService.setIsLoading(true);
    this.songService.previewCatalogRefresh().subscribe({
      next: (data) => {
        this.preview = data;
        this.isPreviewing = false;
        this.loadingService.setIsLoading(false);
      },
      error: (err) => {
        console.error('song catalog preview error:', err);
        this.errorMessage = err.error?.message || err.message || 'Could not load the song data.';
        this.messageService.show(this.errorMessage!);
        this.isPreviewing = false;
        this.loadingService.setIsLoading(false);
      }
    });
  }

  onImport(): void {
    if (this.isImporting) return;
    this.errorMessage = null;
    this.isImporting = true;
    this.loadingService.setIsLoading(true);
    this.songService.importCatalogRefresh(this.applyLevelChanges.value).subscribe({
      next: (data) => {
        this.importResult = data;
        this.preview = null;
        this.messageService.show(data.message);
        this.isImporting = false;
        this.loadingService.setIsLoading(false);
      },
      error: (err) => {
        console.error('song catalog import error:', err);
        this.errorMessage = err.error?.message || err.message || 'Song import failed.';
        this.messageService.show(this.errorMessage!);
        this.isImporting = false;
        this.loadingService.setIsLoading(false);
      }
    });
  }

  chartList(charts: SongCatalogChart[]): string {
    return charts.map((c) => `${c.mode} ${c.difficulty}`).join(', ');
  }

  formatDate(epochMs: number | null): string {
    return epochMs ? new Date(epochMs).toLocaleString() : 'unknown';
  }
}
