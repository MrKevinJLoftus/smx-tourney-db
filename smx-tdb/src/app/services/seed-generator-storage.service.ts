import { Injectable } from '@angular/core';
import { SeedRosterEntry } from '../models/seed';

const STORAGE_KEY = 'smx-tdb-seed-generator-roster';
const STORAGE_VERSION = 1;

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
        nextGuestId: parsed.nextGuestId,
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

  private isValidEntry(entry: SeedRosterEntry): boolean {
    if (!entry || typeof entry.username !== 'string' || !entry.username.trim()) {
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
