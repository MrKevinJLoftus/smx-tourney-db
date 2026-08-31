import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ScoutCompareResponse, ScoutMode, ScoutPlayer } from '../models/scout';

@Injectable({
  providedIn: 'root',
})
export class ScoutService {
  constructor(private http: HttpClient) {}

  searchPlayers(query: string): Observable<ScoutPlayer[]> {
    let params = new HttpParams();
    if (query.trim()) {
      params = params.set('q', query.trim());
    }
    return this.http.get<ScoutPlayer[]>(`${environment.apiUrl}/scout/players/search`, { params });
  }

  resolvePlayer(query: string): Observable<ScoutPlayer> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<ScoutPlayer>(`${environment.apiUrl}/scout/players/resolve`, { params });
  }

  compare(input: {
    youId: number;
    opponentIds: number[];
    mode: ScoutMode;
    levelMin?: number | null;
    levelMax?: number | null;
  }): Observable<ScoutCompareResponse> {
    return this.http.post<ScoutCompareResponse>(`${environment.apiUrl}/scout/compare`, input);
  }
}
