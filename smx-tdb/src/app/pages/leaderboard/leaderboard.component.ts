import { Component, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { SharedModule } from '../../shared/shared.module';
import { LeaderboardEntry, BrowseService } from '../../services/browse.service';
import { RatingsHelpDialogComponent } from '../../shared/components/ratings-help-dialog/ratings-help-dialog.component';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit {
  players: LeaderboardEntry[] = [];
  filterControl = new FormControl('');
  showProvisionalControl = new FormControl(true, { nonNullable: true });
  isLoading = false;
  error: string | null = null;

  constructor(
    private browseService: BrowseService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.filterControl.valueChanges
      .pipe(startWith(this.filterControl.value), debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.loadLeaderboard());

    this.showProvisionalControl.valueChanges.subscribe(() => this.loadLeaderboard());
  }

  loadLeaderboard(): void {
    this.isLoading = true;
    this.error = null;
    this.browseService
      .getLeaderboard(this.showProvisionalControl.value, this.filterControl.value || '')
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.players = response.players;
        },
        error: () => {
          this.error = 'Unable to load leaderboard right now.';
          this.players = [];
        },
      });
  }

  openRatingsHelp(): void {
    this.dialog.open(RatingsHelpDialogComponent, {
      width: '560px',
      autoFocus: false,
    });
  }
}
