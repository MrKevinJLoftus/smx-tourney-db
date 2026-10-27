import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WeeklyChallengeAllTimeResponse, WeeklyChallengeResponse } from '../models/weekly-challenge';

@Injectable({
  providedIn: 'root',
})
export class WeeklyChallengeService {
  constructor(private http: HttpClient) {}

  get(weekOffset = 0): Observable<WeeklyChallengeResponse> {
    const params = new HttpParams().set('week', String(weekOffset));
    return this.http.get<WeeklyChallengeResponse>(`${environment.apiUrl}/weekly-challenge`, { params });
  }

  getAllTime(): Observable<WeeklyChallengeAllTimeResponse> {
    return this.http.get<WeeklyChallengeAllTimeResponse>(`${environment.apiUrl}/weekly-challenge/all-time`);
  }
}
