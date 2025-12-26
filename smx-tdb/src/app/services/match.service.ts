import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Match, MatchWithDetails } from '../models/match';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MatchService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  getMatchesByEvent(eventId: number): Observable<MatchWithDetails[]> {
    return this.http.get<MatchWithDetails[]>(`${environment.apiUrl}/match/event/${eventId}`);
  }

  getMatchById(id: number): Observable<MatchWithDetails> {
    return this.http.get<MatchWithDetails>(`${environment.apiUrl}/match/${id}`);
  }

  createMatch(match: {
    event_id: number;
    player1_id: number;
    player2_id: number;
    song_id?: number;
    winner_id?: number;
    score1?: number;
    score2?: number;
    round?: string;
  }): Observable<MatchWithDetails> {
    const token = this.authService.getToken();
    return this.http.post<MatchWithDetails>(`${environment.apiUrl}/match`, match, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  updateMatch(id: number, match: {
    event_id: number;
    player1_id: number;
    player2_id: number;
    song_id?: number;
    winner_id?: number;
    score1?: number;
    score2?: number;
    round?: string;
  }): Observable<MatchWithDetails> {
    const token = this.authService.getToken();
    return this.http.put<MatchWithDetails>(`${environment.apiUrl}/match/${id}`, match, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  deleteMatch(id: number): Observable<{ message: string }> {
    const token = this.authService.getToken();
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/match/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
}

