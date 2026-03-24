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

export interface StartGgStepmaniaCandidate {
  startGgEventId: number;
  eventName: string;
  eventSlug: string;
  eventStartAt: number | null;
  numEntrants: number | null;
  tournamentId: number;
  tournamentName: string;
}

export interface StartGgStepmaniaRefreshResponse {
  candidates: StartGgStepmaniaCandidate[];
  meta: {
    videogameId: string;
    previousWatermark: number | null;
    newWatermark: number | null;
    pagesFetched: number;
    tournamentsTotalPages: number;
    eventsSeen: number;
    candidateCount: number;
    resetWatermark: boolean;
  };
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

  /**
   * Past StepManiaX events on start.gg not yet imported locally (button-triggered only).
   * Optional `resetWatermark` ignores the DB watermark for this request.
   */
  refreshStepmaniaDiscovery(
    resetWatermark = false
  ): Observable<StartGgStepmaniaRefreshResponse> {
    const token = this.authService.getToken();
    return this.http.post<StartGgStepmaniaRefreshResponse>(
      `${environment.apiUrl}/startgg-import/stepmania/refresh`,
      { resetWatermark },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }

  importEventByStartGgId(
    startGgEventId: number
  ): Observable<StartGgImportFullResponse> {
    const token = this.authService.getToken();
    return this.http.post<StartGgImportFullResponse>(
      `${environment.apiUrl}/startgg-import/import-by-id`,
      { startGgEventId },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }
}
