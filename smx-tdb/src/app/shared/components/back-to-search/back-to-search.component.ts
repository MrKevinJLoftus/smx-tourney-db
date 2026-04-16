import { Location } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-back-to-search',
  templateUrl: './back-to-search.component.html',
  styleUrls: ['./back-to-search.component.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
})
export class BackToSearchComponent {
  /** Optional override; defaults to "Back". */
  @Input() label: string | null = null;

  constructor(private location: Location) {}

  get displayLabel(): string {
    const t = this.label?.trim();
    return t || 'Back';
  }

  goBack(): void {
    this.location.back();
  }
}
