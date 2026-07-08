import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Top5RecentEvent {
  id: number;
  name: string;
  date: string | Date | null;
  winner: { id: number; username: string } | null;
}

export interface Top5PlayerByRating {
  id: number;
  username: string;
  rating: number;
  deviation: number;
  matchesCounted: number;
  provisional: boolean;
}

export interface LeaderboardEntry extends Top5PlayerByRating {
  rank: number;
}

export interface Top5Rivalry {
  player1: { id: number; username: string };
  player2: { id: number; username: string };
  matchCount: number;
}

export interface BrowseTop5ListsResponse {
  recentEvents: Top5RecentEvent[];
  topPlayersByRating: Top5PlayerByRating[];
  topPlayersByRatingEstablished: Top5PlayerByRating[];
  topRivalries: Top5Rivalry[];
}

export interface LeaderboardResponse {
  players: LeaderboardEntry[];
}

@Injectable({
  providedIn: 'root'
})
export class BrowseService {
  constructor(private http: HttpClient) {}

  getTop5Lists(): Observable<BrowseTop5ListsResponse> {
    return this.http.get<BrowseTop5ListsResponse>(`${environment.apiUrl}/browse/top5`);
  }

  getLeaderboard(includeProvisional = true, q = ''): Observable<LeaderboardResponse> {
    const params = new URLSearchParams();
    params.set('includeProvisional', String(includeProvisional));
    if (q.trim()) {
      params.set('q', q.trim());
    }
    return this.http.get<LeaderboardResponse>(`${environment.apiUrl}/browse/leaderboard?${params.toString()}`);
  }
}
