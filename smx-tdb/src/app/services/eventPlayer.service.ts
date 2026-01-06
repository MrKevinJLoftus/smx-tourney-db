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

  bulkImportPlayers(eventId: number, csvFile: File): Observable<{
    message: string;
    summary: {
      totalRows: number;
      playersCreated: number;
      playersAddedToEvent: number;
      rowsSkipped: number;
      errors: number;
    };
    errors?: Array<{
      row: number;
      message: string;
      data: any;
    }>;
  }> {
    const token = this.authService.getToken();
    const formData = new FormData();
    formData.append('csv', csvFile);

    return this.http.post<{
      message: string;
      summary: {
        totalRows: number;
        playersCreated: number;
        playersAddedToEvent: number;
        rowsSkipped: number;
        errors: number;
      };
      errors?: Array<{
        row: number;
        message: string;
        data: any;
      }>;
    }>(`${environment.apiUrl}/eventPlayer/event/${eventId}/bulk-import`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`
        // Note: Don't set Content-Type header - browser will set it with boundary for FormData
      }
    });
  }
}

