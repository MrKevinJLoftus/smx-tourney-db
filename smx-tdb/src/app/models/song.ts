export interface Song {
  song_id?: number;
  title: string;
  artist?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SongCatalogChart {
  mode: string;
  difficulty: number;
}

export interface SongCatalogPreview {
  sourceUrl: string;
  /** Epoch ms from the source's meta.lastUpdated. */
  sourceLastUpdated: number | null;
  upstreamSongCount: number;
  upstreamChartCount: number;
  localSongCount: number;
  newSongs: Array<{ title: string; artist: string; charts: SongCatalogChart[] }>;
  newCharts: Array<SongCatalogChart & { songId: number; title: string; artist: string }>;
  levelChanges: Array<{
    chartId: number;
    songId: number;
    title: string;
    artist: string;
    mode: string;
    from: number;
    to: number;
    matchCount: number;
  }>;
  localOnlySongs: Array<{ id: number; title: string; artist: string }>;
}

export interface SongCatalogImportResult {
  message: string;
  sourceUrl: string;
  sourceLastUpdated: number | null;
  songsAdded: number;
  chartsAdded: number;
  levelChangesApplied: number;
  levelChangesSkipped: number;
}

