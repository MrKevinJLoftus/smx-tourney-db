import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Song } from '../models/song';
import { Chart } from '../models/chart';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SongService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  getSongs(): Observable<Song[]> {
    return this.http.get<Song[]>(`${environment.apiUrl}/song`);
  }

  getSongById(id: number): Observable<Song> {
    return this.http.get<Song>(`${environment.apiUrl}/song/${id}`);
  }

  createSong(song: { title: string; artist?: string }): Observable<Song> {
    const token = this.authService.getToken();
    return this.http.post<Song>(`${environment.apiUrl}/song`, song, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  updateSong(id: number, song: { title: string; artist?: string }): Observable<Song> {
    const token = this.authService.getToken();
    return this.http.put<Song>(`${environment.apiUrl}/song/${id}`, song, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  deleteSong(id: number): Observable<{ message: string }> {
    const token = this.authService.getToken();
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/song/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  getChartsBySong(songId: number): Observable<Chart[]> {
    return this.http.get<Chart[]>(`${environment.apiUrl}/song/${songId}/charts`);
  }
}

