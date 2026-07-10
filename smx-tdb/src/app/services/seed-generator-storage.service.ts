import { Injectable } from '@angular/core';
import { SeedRosterEntry } from '../models/seed';

const STORAGE_KEY = 'smx-tdb-seed-generator-roster';
const STORAGE_VERSION = 1;
const GUEST_USERNAME_MIN_LENGTH = 2;
const GUEST_USERNAME_MAX_LENGTH = 64;
const DEFAULT_NEXT_GUEST_ID = -1;

interface StoredRoster {
  version: number;
  entries: SeedRosterEntry[];
  nextGuestId: number;
}

@Injectable({
  providedIn: 'root',
})
export class SeedGeneratorStorageService {
  load(): StoredRoster | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as StoredRoster;
      if (
        parsed.version !== STORAGE_VERSION ||
        !Array.isArray(parsed.entries) ||
        typeof parsed.nextGuestId !== 'number'
      ) {
        return null;
      }

      const entries = parsed.entries.filter((entry) => this.isValidEntry(entry));
      if (!entries.length) {
        return null;
      }

      return {
        version: STORAGE_VERSION,
        entries,
        nextGuestId: this.resolveNextGuestId(parsed.nextGuestId, entries),
      };
    } catch {
      return null;
    }
  }

  save(entries: SeedRosterEntry[], nextGuestId: number): void {
    if (!entries.length) {
      this.clear();
      return;
    }

    const payload: StoredRoster = {
      version: STORAGE_VERSION,
      entries,
      nextGuestId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private resolveNextGuestId(nextGuestId: number, entries: SeedRosterEntry[]): number {
    if (typeof nextGuestId === 'number' && nextGuestId < 0) {
      return nextGuestId;
    }

    const guestIds = entries
      .filter((entry): entry is Extract<SeedRosterEntry, { kind: 'guest' }> => entry.kind === 'guest')
      .map((entry) => entry.guestId);

    if (!guestIds.length) {
      return DEFAULT_NEXT_GUEST_ID;
    }

    return Math.min(...guestIds) - 1;
  }

  private isValidEntry(entry: SeedRosterEntry): boolean {
    const username = entry?.username?.trim() || '';
    if (!entry || typeof entry.username !== 'string' || username.length < GUEST_USERNAME_MIN_LENGTH) {
      return false;
    }

    if (username.length > GUEST_USERNAME_MAX_LENGTH) {
      return false;
    }

    if (entry.kind === 'tracked') {
      return typeof entry.id === 'number' && entry.id > 0;
    }

    if (entry.kind === 'guest') {
      return typeof entry.guestId === 'number' && entry.guestId < 0;
    }

    return false;
  }
}
