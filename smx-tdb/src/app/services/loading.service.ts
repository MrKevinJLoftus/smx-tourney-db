import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {

  private isLoadingListener = new Subject<boolean>();

  constructor() { }
  /**
   * Push event to all listeners for loading resource from API.
   */
  public setIsLoading(b: boolean): void {
    this.isLoadingListener.next(b);
  }

  /**
   * Exposed observable for subscribing to isLoading changes.
   */
  public getIsLoadingListener(): Observable<boolean> {
    return this.isLoadingListener.asObservable();
  }
}
