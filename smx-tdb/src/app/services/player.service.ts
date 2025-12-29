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
    return this.http.get<Player>(`${environment.apiUrl}/player/gamertag/${encodeURIComponent(username)}`);
  }

  createPlayer(player: { username: string; pronouns?: string; user_id?: number }): Observable<Player> {
    const token = this.authService.getToken();
    // Map username to gamertag for API compatibility
    const requestBody = {
      gamertag: player.username,
      pronouns: player.pronouns,
      user_id: player.user_id
    };
    return this.http.post<Player>(`${environment.apiUrl}/player`, requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  updatePlayer(id: number, player: { username?: string; pronouns?: string; user_id?: number }): Observable<Player> {
    const token = this.authService.getToken();
    // Map username to gamertag for API compatibility
    const requestBody: any = {};
    if (player.username !== undefined) {
      requestBody.gamertag = player.username;
    }
    if (player.pronouns !== undefined) {
      requestBody.pronouns = player.pronouns;
    }
    if (player.user_id !== undefined) {
      requestBody.user_id = player.user_id;
    }
    return this.http.put<Player>(`${environment.apiUrl}/player/${id}`, requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  getPlayersByEvent(eventId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/player/event/${eventId}`);
  }
}

