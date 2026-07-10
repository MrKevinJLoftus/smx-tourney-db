import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GuestPlayerInput, RebuildRatingsResponse, SeedGenerateResponse } from '../models/seed';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class SeedService {
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  generateSeeding(playerIds: number[], guestPlayers: GuestPlayerInput[] = []): Observable<SeedGenerateResponse> {
    return this.http.post<SeedGenerateResponse>(`${environment.apiUrl}/seed/generate`, {
      playerIds,
      guestPlayers,
    });
  }

  rebuildRatings(): Observable<RebuildRatingsResponse> {
    const token = this.authService.getToken();
    return this.http.post<RebuildRatingsResponse>(
      `${environment.apiUrl}/seed/rebuild-ratings`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }
}
