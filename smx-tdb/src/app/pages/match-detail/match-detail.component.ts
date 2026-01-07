import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { MatchService } from '../../services/match.service';
import { MatchWithDetails } from '../../models/match';

@Component({
  selector: 'app-match-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './match-detail.component.html',
  styleUrl: './match-detail.component.scss'
})
export class MatchDetailComponent implements OnInit {
  match: MatchWithDetails | null = null;
  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private matchService: MatchService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Invalid match ID';
      this.isLoading = false;
      return;
    }

    const matchId = parseInt(id, 10);
    if (isNaN(matchId)) {
      this.error = 'Invalid match ID';
      this.isLoading = false;
      return;
    }

    this.loadMatch(matchId);
  }

  loadMatch(id: number): void {
    this.isLoading = true;
    this.error = null;

    this.matchService.getMatchById(id).subscribe({
      next: (match) => {
        this.match = match;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading match:', error);
        this.error = 'Failed to load match. Please try again.';
        this.isLoading = false;
      }
    });
  }

  formatDate(date: string | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getMatchDisplayText(): string {
    if (!this.match) return '';
    const playerNames = this.match.players?.map(p => p.gamertag).join(', ') || 'Unknown players';
    const roundText = this.match.round ? ` (${this.match.round})` : '';
    const eventText = this.match.event?.name ? `${this.match.event.name} - ` : '';
    return `${eventText}${playerNames}${roundText}`;
  }

  navigateToPlayer(playerId: number): void {
    this.router.navigate(['/player', playerId]);
  }

  navigateToEvent(eventId: number): void {
    this.router.navigate(['/event', eventId]);
  }

  getSongWinner(song: any): string {
    if (!song || !song.player_scores || song.player_scores.length === 0) {
      return 'No scores';
    }

    const winner = song.player_scores.find((ps: any) => ps.win);
    if (winner) {
      return winner.player_gamertag || 'Unknown';
    }

    // If no winner marked, find highest score
    const scores = song.player_scores.filter((ps: any) => ps.score !== null && ps.score !== undefined);
    if (scores.length === 0) {
      return 'No scores';
    }

    const maxScore = Math.max(...scores.map((ps: any) => Number(ps.score)));
    const winners = scores.filter((ps: any) => Number(ps.score) === maxScore);
    
    if (winners.length === 1) {
      return winners[0].player_gamertag || 'Unknown';
    } else if (winners.length > 1) {
      return 'Tie: ' + winners.map((w: any) => w.player_gamertag).join(', ');
    }

    return 'No winner';
  }
}

