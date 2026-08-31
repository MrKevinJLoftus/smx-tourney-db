import { Injectable } from '@angular/core';
import { ScoutPlayer } from '../models/scout';

const STORAGE_KEY = 'smx-tdb-pocket-veto-you';
const STORAGE_VERSION = 1;

interface StoredYou {
  version: number;
  player: ScoutPlayer;
}

@Injectable({
  providedIn: 'root',
})
export class PocketVetoStorageService {
  loadYou(): ScoutPlayer | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as StoredYou;
      if (parsed.version !== STORAGE_VERSION || !parsed.player) return null;

      const id = Number(parsed.player.id);
      const username = String(parsed.player.username || '').trim();
      if (!Number.isFinite(id) || id <= 0 || !username) return null;

      return { id, username };
    } catch {
      return null;
    }
  }

  saveYou(player: ScoutPlayer | null): void {
    if (!player) {
      this.clearYou();
      return;
    }

    const payload: StoredYou = {
      version: STORAGE_VERSION,
      player,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  clearYou(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
