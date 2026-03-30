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

export interface Top5PlayerByRatio {
  id: number;
  username: string;
  wins: number;
  losses: number;
  ratio: number | null;
}

export interface Top5Rivalry {
  player1: { id: number; username: string };
  player2: { id: number; username: string };
  matchCount: number;
}

export interface BrowseTop5ListsResponse {
  recentEvents: Top5RecentEvent[];
  topPlayersByWinLossRatio: Top5PlayerByRatio[];
  topRivalries: Top5Rivalry[];
}

@Injectable({
  providedIn: 'root'
})
export class BrowseService {
  constructor(private http: HttpClient) {}

  getTop5Lists(): Observable<BrowseTop5ListsResponse> {
    return this.http.get<BrowseTop5ListsResponse>(`${environment.apiUrl}/browse/top5`);
  }
}

