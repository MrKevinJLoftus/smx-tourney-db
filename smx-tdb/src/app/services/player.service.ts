import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Player } from '../models/player';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  getPlayers(): Observable<Player[]> {
    return this.http.get<Player[]>(`${environment.apiUrl}/player`);
  }

  getPlayerById(id: number): Observable<Player> {
    return this.http.get<Player>(`${environment.apiUrl}/player/${id}`);
  }

  getPlayerByUsername(username: string): Observable<Player> {
    return this.http.get<Player>(`${environment.apiUrl}/player/username/${encodeURIComponent(username)}`);
  }

  createPlayer(player: { username: string; user_id?: number }): Observable<Player> {
    const token = this.authService.getToken();
    return this.http.post<Player>(`${environment.apiUrl}/player`, player, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  getPlayersByEvent(eventId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/player/event/${eventId}`);
  }
}

