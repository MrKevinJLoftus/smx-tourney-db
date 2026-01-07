import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-back-to-search',
  templateUrl: './back-to-search.component.html',
  styleUrls: ['./back-to-search.component.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule]
})
export class BackToSearchComponent {
  @Input() label: string = 'Back to Search';
  @Input() route: string | any[] = '/';

  constructor(private router: Router) {}

  navigate(): void {
    this.router.navigate(Array.isArray(this.route) ? this.route : [this.route]);
  }
}


