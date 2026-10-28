import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

// Keep in sync with the pre-boot script in index.html
const STORAGE_KEY = 'smx-tdb-theme';
const LIGHT_THEME_CLASS = 'light-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.load());

  constructor() {
    this.apply(this.mode());
  }

  isLight(): boolean {
    return this.mode() === 'light';
  }

  toggle(): void {
    const next: ThemeMode = this.isLight() ? 'dark' : 'light';
    this.mode.set(next);
    this.apply(next);
    this.save(next);
  }

  private apply(mode: ThemeMode): void {
    this.document.documentElement.classList.toggle(LIGHT_THEME_CLASS, mode === 'light');
  }

  private load(): ThemeMode {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  private save(mode: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this session.
    }
  }
}
