import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { HOME_SEARCH_RETURN_STATE_KEY } from '../../shared/navigation/detail-return-state';
import { PlayerService } from '../../services/player.service';
import { EventService } from '../../services/event.service';
import { MatchService } from '../../services/match.service';
import { BrowseService, Top5PlayerByRatio, Top5RecentEvent, Top5Rivalry } from '../../services/browse.service';
import { StartGgPublicService, UpcomingStartGgEvent } from '../../services/start-gg-public.service';
import { Player } from '../../models/player';
import { Event } from '../../models/event';
import { MatchWithDetails } from '../../models/match';
import { Observable, combineLatest, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map, startWith } from 'rxjs/operators';

type SearchAutocompleteOption = {
  type: 'player' | 'event' | 'match';
  item: any;
  display: string;
};

@Component({
  selector: 'app-home',
  imports: [SharedModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  searchControl = new FormControl('');
  searchQuery = '';
  
  players: Player[] = [];
  events: Event[] = [];
  matches: MatchWithDetails[] = [];

  recentEventsTop5: Top5RecentEvent[] = [];
  topPlayersByRatioTop5: Top5PlayerByRatio[] = [];
  topRivalriesTop5: Top5Rivalry[] = [];
  isTop5Loading = false;
  top5Error: string | null = null;

  upcomingStartGgEvents: UpcomingStartGgEvent[] = [];
  isUpcomingStartGgLoading = false;
  upcomingStartGgError: string | null = null;
  
  isLoading = false;
  hasSearched = false;
  
  autocompleteOptions$: Observable<SearchAutocompleteOption[]>;

  constructor(
    private playerService: PlayerService,
    private eventService: EventService,
    private matchService: MatchService,
    private browseService: BrowseService,
    private startGgPublicService: StartGgPublicService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Create autocomplete options stream with debouncing
    this.autocompleteOptions$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map((value) => this.searchTextFromControlValue(value)),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
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
          this.matchService.searchMatches(searchTerm, { limit: 50 }).pipe(
            map((page) => page.matches),
            catchError(() => of([]))
          )
        ]).pipe(
          map(([players, events, matches]) => {
            const options: SearchAutocompleteOption[] = [];
            
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
    this.loadTop5Lists();
    this.loadUpcomingStartGgEvents();
    const initialQ = this.route.snapshot.queryParamMap.get('q')?.trim();
    if (initialQ) {
      this.searchControl.setValue(initialQ);
      this.performSearch();
    }
    // Subscribe to search control for full search on Enter or when selecting from autocomplete
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      // This will be handled by the performSearch method when user submits
    });
  }

  loadTop5Lists(): void {
    this.isTop5Loading = true;
    this.top5Error = null;
    this.browseService.getTop5Lists().subscribe({
      next: (data) => {
        this.recentEventsTop5 = data?.recentEvents || [];
        this.topPlayersByRatioTop5 = data?.topPlayersByWinLossRatio || [];
        this.topRivalriesTop5 = data?.topRivalries || [];
        this.isTop5Loading = false;
      },
      error: (error) => {
        console.error('Error loading home lists:', error);
        this.top5Error = 'Failed to load home lists.';
        this.isTop5Loading = false;
      }
    });
  }

  loadUpcomingStartGgEvents(): void {
    this.isUpcomingStartGgLoading = true;
    this.upcomingStartGgError = null;
    this.startGgPublicService.getUpcomingStepmaniaxEvents(2, 15).subscribe({
      next: (data) => {
        this.upcomingStartGgEvents = data?.events || [];
        this.isUpcomingStartGgLoading = false;
      },
      error: (error) => {
        console.error('Error loading upcoming start.gg events:', error);
        this.upcomingStartGgError = 'Failed to load upcoming start.gg events.';
        this.isUpcomingStartGgLoading = false;
      }
    });
  }

  performSearch(): void {
    this.searchQuery = this.searchTextFromControlValue(this.searchControl.value).trim();
    
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
      this.matchService.searchMatches(this.searchQuery, { limit: 50 }).pipe(
        map((page) => page.matches),
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

  onOptionSelected(option: SearchAutocompleteOption): void {
    // Navigate directly to the detail page for the selected item
    if (option.type === 'player') {
      const playerId = option.item.id || option.item.player_id;
      if (playerId) {
        this.router.navigate(['/player', playerId], this.homeSearchDetailNavExtras());
      }
    } else if (option.type === 'event' && option.item.id) {
      this.router.navigate(['/event', option.item.id], this.homeSearchDetailNavExtras());
    } else if (option.type === 'match') {
      const matchId = option.item.id || option.item.match_id;
      if (matchId) {
        this.router.navigate(['/match', matchId], this.homeSearchDetailNavExtras());
      }
    }
  }

  navigateToPlayer(player: Player): void {
    const playerId = (player as any).id || player.player_id;
    if (playerId) {
      this.router.navigate(['/player', playerId], this.homeSearchDetailNavExtras());
    }
  }

  navigateToEvent(event: Event): void {
    if (event.id) {
      this.router.navigate(['/event', event.id], this.homeSearchDetailNavExtras());
    }
  }

  navigateToMatch(match: MatchWithDetails): void {
    const matchId = (match as any).id || match.match_id;
    if (matchId) {
      this.router.navigate(['/match', matchId], this.homeSearchDetailNavExtras());
    }
  }

  private homeSearchDetailNavExtras(): { state?: Record<string, { q: string }> } {
    const q = this.searchTextFromControlValue(this.searchControl.value).trim();
    if (!q) return {};
    return { state: { [HOME_SEARCH_RETURN_STATE_KEY]: { q } } };
  }

  /**
   * Autocomplete sets the control value to the selected option object; free typing uses a string.
   */
  private searchTextFromControlValue(value: unknown): string {
    if (value == null || value === '') return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'display' in value) {
      return this.displayFn(value as SearchAutocompleteOption | string);
    }
    return '';
  }

  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatUnixSecondsDate(seconds: number | null | undefined): string {
    if (seconds == null || !Number.isFinite(Number(seconds))) return '';
    return this.formatDate(new Date(Number(seconds) * 1000));
  }

  formatRatio(ratio: number | null): string {
    if (ratio === null || ratio === undefined) return '∞';
    if (!Number.isFinite(ratio)) return '∞';
    return ratio.toFixed(2);
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
