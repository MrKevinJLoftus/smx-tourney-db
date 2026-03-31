import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { PlayerService } from '../../services/player.service';
import { EventService } from '../../services/event.service';
import { MatchService } from '../../services/match.service';
import { Player } from '../../models/player';
import { Event } from '../../models/event';
import { MatchWithDetails } from '../../models/match';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';
import {
  BROWSE_RETURN_STATE_KEY,
  BrowseTabParam,
} from '../../shared/navigation/detail-return-state';

type BrowseType = 'player' | 'match' | 'event';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, SharedModule],
  templateUrl: './browse.component.html',
  styleUrl: './browse.component.scss'
})
export class BrowseComponent implements OnInit {
  selectedTab: BrowseType = 'player';
  selectedTabIndex = 0;
  filterControl = new FormControl('');
  
  players: Player[] = [];
  events: Event[] = [];
  matches: MatchWithDetails[] = [];
  
  filteredPlayers: Player[] = [];
  filteredEvents: Event[] = [];
  filteredMatches: MatchWithDetails[] = [];
  
  isLoading = false;
  error: string | null = null;

  constructor(
    private playerService: PlayerService,
    private eventService: EventService,
    private matchService: MatchService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.applyBrowseQueryParams(this.route.snapshot.queryParamMap.get('tab'), this.route.snapshot.queryParamMap.get('q'));

    this.loadData();

    this.filterControl.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.applyFilter();
    });

    this.syncBrowseQueryParams();
  }

  /**
   * State passed when opening a detail page so "Back" can restore tab + filter.
   */
  browseDetailNavState(tab: BrowseTabParam): Record<string, { tab: BrowseTabParam; q?: string }> {
    const q = (this.filterControl.value || '').trim();
    return {
      [BROWSE_RETURN_STATE_KEY]: q ? { tab, q } : { tab },
    };
  }

  private applyBrowseQueryParams(tabParam: string | null, qParam: string | null): void {
    const tabs: BrowseType[] = ['player', 'event', 'match'];
    if (tabParam === 'player' || tabParam === 'event' || tabParam === 'match') {
      this.selectedTab = tabParam;
      this.selectedTabIndex = tabs.indexOf(tabParam);
    }
    if (qParam && qParam.trim()) {
      this.filterControl.setValue(qParam.trim(), { emitEvent: false });
    }
  }

  onTabChange(index: number): void {
    const tabs: BrowseType[] = ['player', 'event', 'match'];
    const newTab = tabs[index];
    if (this.selectedTab !== newTab) {
      this.selectedTab = newTab;
      this.selectedTabIndex = index;
      this.filterControl.setValue('');
      this.loadData();
    } else {
      this.selectedTabIndex = index;
    }
    this.syncBrowseQueryParams();
  }

  private syncBrowseQueryParams(): void {
    const q = (this.filterControl.value || '').trim();
    const queryParams: Record<string, string> = { tab: this.selectedTab };
    if (q) queryParams['q'] = q;
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  getTabType(index: number): BrowseType {
    const tabs: BrowseType[] = ['player', 'event', 'match'];
    return tabs[index];
  }

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    switch (this.selectedTab) {
      case 'player':
        this.loadPlayers();
        break;
      case 'event':
        this.loadEvents();
        break;
      case 'match':
        this.loadMatches();
        break;
    }
  }

  loadPlayers(): void {
    this.playerService.getPlayers().subscribe({
      next: (players) => {
        this.players = players;
        this.applyFilter();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading players:', error);
        this.error = 'Failed to load players. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadEvents(): void {
    this.eventService.getEvents().subscribe({
      next: (events) => {
        this.events = events;
        this.applyFilter();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading events:', error);
        this.error = 'Failed to load events. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadMatches(): void {
    // Use a very broad search term to get all matches (API returns empty array for empty query)
    // Using '%' as a search term that will match everything in the LIKE query
    this.matchService.searchMatches('%').subscribe({
      next: (matches) => {
        this.matches = matches;
        this.applyFilter();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading matches:', error);
        this.error = 'Failed to load matches. Please try again.';
        this.isLoading = false;
      }
    });
  }

  applyFilter(): void {
    const filterValue = (this.filterControl.value || '').toLowerCase().trim();
    
    switch (this.selectedTab) {
      case 'player':
        this.filteredPlayers = this.players.filter(player =>
          player.username.toLowerCase().includes(filterValue) ||
          (player.pronouns && player.pronouns.toLowerCase().includes(filterValue))
        );
        break;
      case 'event':
        this.filteredEvents = this.events.filter(event =>
          event.name.toLowerCase().includes(filterValue) ||
          (event.location && event.location.toLowerCase().includes(filterValue)) ||
          (event.organizers && event.organizers.toLowerCase().includes(filterValue))
        );
        break;
      case 'match':
        this.filteredMatches = this.matches.filter(match => {
          const roundMatch = match.round && match.round.toLowerCase().includes(filterValue);
          const eventMatch = match.event && match.event.name.toLowerCase().includes(filterValue);
          const playerMatch = match.players && match.players.some(p => 
            p.gamertag.toLowerCase().includes(filterValue)
          );
          return roundMatch || eventMatch || playerMatch;
        });
        break;
    }
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  }

  formatMatchPlayers(match: MatchWithDetails): string {
    if (!match.players || match.players.length === 0) {
      return '';
    }
    return match.players.map(p => p.gamertag).join(' vs ');
  }
}
