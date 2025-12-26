import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EventPlayer } from '../models/eventPlayer';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class EventPlayerService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  addPlayerToEvent(eventPlayer: {
    event_id: number;
    player_id: number;
    seed?: number;
    place?: number;
  }): Observable<EventPlayer> {
    const token = this.authService.getToken();
    return this.http.post<EventPlayer>(`${environment.apiUrl}/eventPlayer`, eventPlayer, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  updateEventPlayer(id: number, eventPlayer: {
    seed?: number;
    place?: number;
  }): Observable<EventPlayer> {
    const token = this.authService.getToken();
    return this.http.put<EventPlayer>(`${environment.apiUrl}/eventPlayer/${id}`, eventPlayer, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  removePlayerFromEvent(id: number): Observable<{ message: string }> {
    const token = this.authService.getToken();
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/eventPlayer/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
}

