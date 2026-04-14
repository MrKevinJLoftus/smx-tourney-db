import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UpcomingStartGgEvent {
  tournamentName: string | null;
  eventName: string | null;
  /** Unix seconds */
  startAt: number;
  url: string | null;
}

export interface UpcomingStartGgEventsResponse {
  events: UpcomingStartGgEvent[];
  meta: {
    daysBack: number;
    afterDate: number;
    videogameIds: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class StartGgPublicService {
  constructor(private http: HttpClient) {}

  getUpcomingStepmaniaxEvents(daysBack = 2, limit = 15): Observable<UpcomingStartGgEventsResponse> {
    let params = new HttpParams()
      .set('daysBack', String(daysBack))
      .set('limit', String(limit));
    return this.http.get<UpcomingStartGgEventsResponse>(
      `${environment.apiUrl}/startgg/upcoming-stepmaniax`,
      { params }
    );
  }
}

