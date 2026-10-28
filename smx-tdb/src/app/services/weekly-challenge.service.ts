import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  LevelBucket,
  SaveBucketSettingResponse,
  WeeklyChallengeAllTimeResponse,
  WeeklyChallengeBucketSettings,
  WeeklyChallengeDifficulty,
  WeeklyChallengeResponse,
} from '../models/weekly-challenge';

@Injectable({
  providedIn: 'root',
})
export class WeeklyChallengeService {
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  get(weekOffset = 0): Observable<WeeklyChallengeResponse> {
    const params = new HttpParams().set('week', String(weekOffset));
    return this.http.get<WeeklyChallengeResponse>(`${environment.apiUrl}/weekly-challenge`, { params });
  }

  getAllTime(): Observable<WeeklyChallengeAllTimeResponse> {
    return this.http.get<WeeklyChallengeAllTimeResponse>(`${environment.apiUrl}/weekly-challenge/all-time`);
  }

  getBucketSettings(): Observable<WeeklyChallengeBucketSettings> {
    return this.http.get<WeeklyChallengeBucketSettings>(`${environment.apiUrl}/weekly-challenge/admin/buckets`, {
      headers: { Authorization: `Bearer ${this.authService.getToken()}` },
    });
  }

  /** `buckets` null switches the difficulty back to the automatic thirds. */
  saveBucketSetting(
    difficulty: WeeklyChallengeDifficulty['key'],
    buckets: LevelBucket[] | null,
    applyToCurrentWeek: boolean
  ): Observable<SaveBucketSettingResponse> {
    return this.http.put<SaveBucketSettingResponse>(
      `${environment.apiUrl}/weekly-challenge/admin/buckets/${difficulty}`,
      { buckets, applyToCurrentWeek },
      { headers: { Authorization: `Bearer ${this.authService.getToken()}` } }
    );
  }
}
