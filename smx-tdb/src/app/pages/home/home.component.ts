import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PlayerService } from '../../services/player.service';
import { EventService } from '../../services/event.service';
import { MatchService } from '../../services/match.service';
import { Player } from '../../models/player';
import { Event } from '../../models/event';
import { MatchWithDetails } from '../../models/match';
import { Observable, combineLatest, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  imports: [SharedModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  searchControl = new FormControl('');
  searchQuery = '';
  
  players: Player[] = [];
  events: Event[] = [];
  matches: MatchWithDetails[] = [];
  
  isLoading = false;
  hasSearched = false;
  
  autocompleteOptions$: Observable<Array<{ type: 'player' | 'event' | 'match', item: any, display: string }>>;

  constructor(
    private playerService: PlayerService,
    private eventService: EventService,
    private matchService: MatchService,
    private router: Router
  ) {
    // Create autocomplete options stream with debouncing
    this.autocompleteOptions$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        const searchTerm = query || '';
        if (searchTerm.trim().length < 2) {
          return of([]);
        }
        
        return combineLatest([
          this.playerService.searchPlayers(searchTerm).pipe(
            catchError(() => of([]))
          ),
          this.eventService.searchEvents(searchTerm).pipe(
            catchError(() => of([]))
          ),
          this.matchService.searchMatches(searchTerm).pipe(
            catchError(() => of([]))
          )
        ]).pipe(
          map(([players, events, matches]) => {
            const options: Array<{ type: 'player' | 'event' | 'match', item: any, display: string }> = [];
            
            // Add top 5 players
            players.slice(0, 5).forEach(player => {
              options.push({
                type: 'player',
                item: player,
                display: player.username
              });
            });
            
            // Add top 5 events
            events.slice(0, 5).forEach(event => {
              options.push({
                type: 'event',
                item: event,
                display: event.name
              });
            });
            
            // Add top 5 matches (showing event name and players)
            matches.slice(0, 5).forEach(match => {
              const playerNames = match.players?.map(p => p.gamertag).join(', ') || 'Unknown players';
              const displayText = match.event?.name 
                ? `${match.event.name} - ${playerNames}` 
                : playerNames;
              options.push({
                type: 'match',
                item: match,
                display: displayText
              });
            });
            
            return options;
          })
        );
      })
    );
  }

  ngOnInit(): void {
    // Subscribe to search control for full search on Enter or when selecting from autocomplete
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      // This will be handled by the performSearch method when user submits
    });
  }

  performSearch(): void {
    const query = this.searchControl.value || '';
    this.searchQuery = query.trim();
    
    if (!this.searchQuery) {
      this.clearSearch();
      return;
    }
    
    this.isLoading = true;
    this.hasSearched = true;
    
    combineLatest([
      this.playerService.searchPlayers(this.searchQuery).pipe(
        catchError(() => of([]))
      ),
      this.eventService.searchEvents(this.searchQuery).pipe(
        catchError(() => of([]))
      ),
      this.matchService.searchMatches(this.searchQuery).pipe(
        catchError(() => of([]))
      )
    ]).subscribe({
      next: ([players, events, matches]) => {
        this.players = players;
        this.events = events;
        this.matches = matches;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Search error:', error);
        this.players = [];
        this.events = [];
        this.matches = [];
        this.isLoading = false;
      }
    });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.searchQuery = '';
    this.players = [];
    this.events = [];
    this.matches = [];
    this.hasSearched = false;
  }

  displayFn(option: { type: 'player' | 'event' | 'match', item: any, display: string } | string): string {
    if (!option) return '';
    if (typeof option === 'string') return option;
    return option.display;
  }

  onOptionSelected(option: { type: 'player' | 'event' | 'match', item: any, display: string }): void {
    // Navigate directly to the detail page for the selected item
    if (option.type === 'player') {
      const playerId = option.item.id || option.item.player_id;
      if (playerId) {
        this.router.navigate(['/player', playerId]);
      }
    } else if (option.type === 'event' && option.item.id) {
      this.router.navigate(['/event', option.item.id]);
    } else if (option.type === 'match') {
      const matchId = option.item.id || option.item.match_id;
      if (matchId) {
        this.router.navigate(['/match', matchId]);
      }
    }
  }

  navigateToPlayer(player: Player): void {
    const playerId = (player as any).id || player.player_id;
    if (playerId) {
      this.router.navigate(['/player', playerId]);
    }
  }

  navigateToEvent(event: Event): void {
    if (event.id) {
      this.router.navigate(['/event', event.id]);
    }
  }

  navigateToMatch(match: MatchWithDetails): void {
    const matchId = (match as any).id || match.match_id;
    if (matchId) {
      this.router.navigate(['/match', matchId]);
    }
  }

  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getMatchDisplayText(match: MatchWithDetails): string {
    const playerNames = match.players?.map(p => p.gamertag).join(', ') || 'Unknown players';
    const roundText = match.round ? ` (${match.round})` : '';
    const eventText = match.event?.name ? `${match.event.name} - ` : '';
    return `${eventText}${playerNames}${roundText}`;
  }

  getPlayerNames(match: MatchWithDetails): string {
    if (!match.players || match.players.length === 0) {
      return 'Unknown players';
    }
    return match.players.map(p => p.gamertag).join(', ');
  }
}
