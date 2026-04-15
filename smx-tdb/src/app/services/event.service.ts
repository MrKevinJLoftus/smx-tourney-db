import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Event } from '../models/event';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private eventsSubject = new BehaviorSubject<Event[]>([]);
  public events$ = this.eventsSubject.asObservable();
  private eventsLoaded = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  getEvents(): Observable<Event[]> {
    // Load events if not already loaded
    if (!this.eventsLoaded) {
      this.refreshEvents();
    }
    return this.events$;
  }

  private refreshEvents(): void {
    this.http.get<Event[]>(`${environment.apiUrl}/event`).subscribe({
      next: (events) => {
        this.eventsSubject.next(events);
        this.eventsLoaded = true;
      },
      error: (error) => {
        console.error('Error loading events:', error);
      }
    });
  }

  /** Admin-only: list all events including hidden. */
  getEventsAdmin(): Observable<Event[]> {
    const token = this.authService.getToken();
    return this.http.get<Event[]>(`${environment.apiUrl}/event/admin/all`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /** Reload the events list (e.g. after start.gg import creates an event). */
  reloadEvents(): void {
    this.refreshEvents();
  }

  getEventById(id: number): Observable<Event> {
    return this.http.get<Event>(`${environment.apiUrl}/event/${id}`);
  }

  searchEvents(query: string): Observable<Event[]> {
    let params = new HttpParams();
    if (query.trim()) {
      params = params.set('q', query.trim());
    }
    return this.http.get<Event[]>(`${environment.apiUrl}/event/search`, { params });
  }

  createEvent(event: { 
    name: string; 
    date: string | Date;
    description?: string | null;
    location?: string | null;
    organizers?: string | null;
  }): Observable<Event> {
    const token = this.authService.getToken();
    return this.http.post<Event>(`${environment.apiUrl}/event`, event, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).pipe(
      tap(() => {
        // Refresh events list after creating a new event
        this.refreshEvents();
      })
    );
  }

  updateEvent(id: number, event: { 
    name: string; 
    date: string | Date;
    description?: string | null;
    location?: string | null;
    organizers?: string | null;
  }): Observable<Event> {
    const token = this.authService.getToken();
    return this.http.put<Event>(`${environment.apiUrl}/event/${id}`, event, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).pipe(
      tap(() => {
        // Refresh events list after updating an event
        this.refreshEvents();
      })
    );
  }

  deleteEvent(id: number): Observable<{ message: string }> {
    const token = this.authService.getToken();
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/event/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).pipe(
      tap(() => {
        // Refresh events list after deleting an event
        this.refreshEvents();
      })
    );
  }

  setEventHidden(id: number, hidden: boolean): Observable<Event> {
    const token = this.authService.getToken();
    return this.http.patch<Event>(`${environment.apiUrl}/event/${id}/hidden`, { hidden }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).pipe(
      tap(() => {
        // Public event lists/searches must reflect the change.
        this.refreshEvents();
      })
    );
  }
}
