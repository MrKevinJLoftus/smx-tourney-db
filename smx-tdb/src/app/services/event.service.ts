import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EventService {

  constructor() { }

  getEvents(): Observable<string[]> {
    // Placeholder implementation for fetching events from the API
    // Replace with actual HTTP call when API is ready
    return of([]); // Returns an empty array as a placeholder
  }
}
