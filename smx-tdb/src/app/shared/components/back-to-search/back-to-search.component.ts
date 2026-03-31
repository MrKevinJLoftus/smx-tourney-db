import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import {
  readBrowseReturnPayload,
  readHomeSearchReturnPayload,
} from '../../navigation/detail-return-state';

@Component({
  selector: 'app-back-to-search',
  templateUrl: './back-to-search.component.html',
  styleUrls: ['./back-to-search.component.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
})
export class BackToSearchComponent implements OnInit {
  /** When set, overrides automatic label and default `/` fallback route. */
  @Input() label: string | null = null;
  @Input() route: string | any[] = '/';

  displayLabel = 'Back to Search';

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (this.label) {
      this.displayLabel = this.label;
      return;
    }
    const state = history.state as Record<string, unknown> | null | undefined;
    if (readBrowseReturnPayload(state)) {
      this.displayLabel = 'Back to browse';
    } else if (readHomeSearchReturnPayload(state)) {
      this.displayLabel = 'Back to search';
    } else {
      this.displayLabel = 'Back to Search';
    }
  }

  navigate(): void {
    const state = history.state as Record<string, unknown> | null | undefined;
    const browse = readBrowseReturnPayload(state);
    if (browse) {
      const queryParams: Record<string, string> = { tab: browse.tab };
      if (browse.q) queryParams['q'] = browse.q;
      this.router.navigate(['/browse'], { queryParams });
      return;
    }
    const homeSearch = readHomeSearchReturnPayload(state);
    if (homeSearch) {
      this.router.navigate(['/'], { queryParams: { q: homeSearch.q } });
      return;
    }
    this.router.navigate(Array.isArray(this.route) ? this.route : [this.route]);
  }
}
