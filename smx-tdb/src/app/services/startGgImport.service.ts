import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** start.gg `PhaseGroup` + nested `Phase` — distinguishes bracket sides when `fullRoundText` repeats. */
export interface StartGgSetPreviewPhaseGroup {
  id: string | number;
  displayIdentifier: string | null;
  bracketType: string | null;
  phase: {
    id: string | number;
    name: string | null;
    bracketType: string | null;
    phaseOrder: number | null;
  } | null;
}

export interface StartGgImportPreviewResponse {
  slug: string;
  startGgEventId: string | number;
  summary: {
    eventName: string;
    tournamentName: string | null;
    city: string | null;
    suggestedLocalDate: string | null;
    numEntrants: number | null;
    standingsTotal: number | null;
    setsTotal: number | null;
  };
  standingsPreview: {
    pageInfo: { total?: number; totalPages?: number };
    nodes: Array<{ placement: number; entrant: { id: string | number; name: string } }>;
  } | null;
  setsPreview: {
    pageInfo: { total?: number; totalPages?: number };
    nodes: Array<{
      id: string | number;
      state: number;
      fullRoundText: string | null;
      identifier: string | null;
      /** Negative values indicate losers-bracket sets (per start.gg Set docs). */
      round: number | null;
      winnerId: string | number | null;
      phaseGroup: StartGgSetPreviewPhaseGroup | null;
      slots: Array<{
        slotIndex: number;
        entrant: { id: string | number; name: string } | null;
        standing?: { stats?: { score?: { value?: number } } };
      }>;
    }>;
  } | null;
}

export interface StartGgImportFullResponse {
  message: string;
  slug: string;
  startGgEventId: string | number;
  localEventId: number;
  summary: {
    standingsRows: number;
    eventPlayersAdded: number;
    eventPlayersSkipped: number;
    playersCreatedFromStandings: number;
    setsFetched: number;
    matches: {
      totalMatches: number;
      matchesCreated: number;
      matchesSkipped: number;
      duplicatesSkipped: number;
      playersCreated: number;
      errors: Array<{ matchId?: unknown; message?: string }>;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class StartGgImportService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  previewEvent(url: string): Observable<StartGgImportPreviewResponse> {
    const token = this.authService.getToken();
    return this.http.post<StartGgImportPreviewResponse>(
      `${environment.apiUrl}/startgg-import/preview`,
      { url: url.trim() },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }

  importFullEvent(url: string): Observable<StartGgImportFullResponse> {
    const token = this.authService.getToken();
    return this.http.post<StartGgImportFullResponse>(
      `${environment.apiUrl}/startgg-import/import`,
      { url: url.trim() },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }
}
