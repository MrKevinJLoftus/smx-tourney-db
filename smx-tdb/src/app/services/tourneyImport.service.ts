import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type TourneyImportSource = 'blamethepads' | 'ddrtools';

export interface BlamethepadsTourney {
  id: number;
  name: string;
  status: string | null;
  type: string | null;
  startDate: string | null;
  endDate: string | null;
  eventId: number;
  eventName: string | null;
  location: string | null;
  ddrtoolsRoom: string | null;
  /** Set when this tourney was already imported. */
  localEventId: number | null;
}

export interface TourneyImportChart {
  title: string;
  artist: string;
  diffClass: string;
  /** null when the source didn't record whether this is a plus chart. */
  plus: boolean | null;
  level: number | null;
  /** player name -> score */
  scores: Record<string, number | null>;
  songId: number | null;
  chartId: number | null;
  resolved: boolean;
  unresolvedReason: string | null;
  label: string;
}

export interface TourneyImportMatch {
  source: TourneyImportSource;
  sourceKey: string;
  round: string;
  players: string[];
  winnerName: string | null;
  skipReason?: string;
  alreadyImported: boolean;
  localMatchId: number | null;
  charts: TourneyImportChart[];
}

export interface TourneyImportEvent {
  externalSource: TourneyImportSource;
  externalId: string;
  name: string;
  date: string | null;
  location: string | null;
  description: string;
  blocker?: string;
  localEventId: number | null;
  players: Array<{ name: string; seed: string | null; exists: boolean }>;
  matches: TourneyImportMatch[];
  counts: { toImport: number; alreadyImported: number; skipped: number };
  unresolvedCharts: Array<{ title: string; artist: string; label: string; reason: string }>;
}

export interface TourneyImportPreviewResponse {
  source: TourneyImportSource;
  ref: string;
  warnings: string[];
  events: TourneyImportEvent[];
}

export interface TourneyImportEventSummary {
  externalSource: TourneyImportSource;
  externalId: string;
  name: string;
  localEventId: number | null;
  eventCreated: boolean;
  matchesImported: number;
  matchesAlreadyImported: number;
  matchesSkipped: number;
  eventPlayersAdded: number;
  playersCreated: number;
  unresolvedCharts: number;
}

export interface TourneyImportResponse {
  message: string;
  source: TourneyImportSource;
  ref: string;
  warnings: string[];
  events: TourneyImportEventSummary[];
  ratingsRebuild: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class TourneyImportService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private authHeaders() {
    return { Authorization: `Bearer ${this.authService.getToken()}` };
  }

  listBlamethepadsTourneys(): Observable<{ tourneys: BlamethepadsTourney[] }> {
    return this.http.get<{ tourneys: BlamethepadsTourney[] }>(
      `${environment.apiUrl}/tourney-import/blamethepads/tourneys`,
      { headers: this.authHeaders() }
    );
  }

  preview(source: TourneyImportSource, ref: string): Observable<TourneyImportPreviewResponse> {
    return this.http.post<TourneyImportPreviewResponse>(
      `${environment.apiUrl}/tourney-import/preview`,
      { source, ref: ref.trim() },
      { headers: this.authHeaders() }
    );
  }

  import(source: TourneyImportSource, ref: string): Observable<TourneyImportResponse> {
    return this.http.post<TourneyImportResponse>(
      `${environment.apiUrl}/tourney-import/import`,
      { source, ref: ref.trim() },
      { headers: this.authHeaders() }
    );
  }
}
