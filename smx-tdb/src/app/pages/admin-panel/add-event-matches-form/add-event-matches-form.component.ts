import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { Observable, map, switchMap } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { PlayerService } from '../../../services/player.service';
import { MatchService } from '../../../services/match.service';
import { SongService } from '../../../services/song.service';
import { MessageService } from '../../../services/message.service';
import { LoadingService } from '../../../services/loading.service';
import { Event } from '../../../models/event';
import { Player } from '../../../models/player';
import { Song } from '../../../models/song';

@Component({
  selector: 'app-add-event-matches-form',
  imports: [SharedModule],
  templateUrl: './add-event-matches-form.component.html',
  styleUrl: './add-event-matches-form.component.scss'
})
export class AddEventMatchesFormComponent implements OnInit {
  matchForm!: FormGroup;
  events$: Observable<Event[]>;
  players$: Observable<Player[]>;
  songs$: Observable<Song[]>;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private playerService: PlayerService,
    private matchService: MatchService,
    private songService: SongService,
    private messageService: MessageService,
    private loadingService: LoadingService
  ) {
    this.initForm();
    this.events$ = this.eventService.getEvents();
    this.songs$ = this.songService.getSongs();
    this.players$ = new Observable<Player[]>(subscriber => subscriber.next([]));

    // Load players when event is selected
    this.matchForm.get('event')?.valueChanges.subscribe(event => {
      if (event && event.event_id) {
        this.players$ = this.playerService.getPlayersByEvent(event.event_id);
        // Enable player fields
        this.matchForm.get('player1')?.enable();
        this.matchForm.get('player2')?.enable();
        this.matchForm.get('winner')?.enable();
      } else {
        this.players$ = new Observable<Player[]>(subscriber => subscriber.next([]));
        // Disable player fields
        this.matchForm.get('player1')?.disable();
        this.matchForm.get('player2')?.disable();
        this.matchForm.get('winner')?.disable();
      }
    });

    // Update winner options when players change
    this.matchForm.get('player1')?.valueChanges.subscribe(() => {
      this.updateWinnerOptions();
    });
    this.matchForm.get('player2')?.valueChanges.subscribe(() => {
      this.updateWinnerOptions();
    });
  }

  ngOnInit(): void {
    // Forms are initialized in constructor
  }

  initForm(): void {
    this.matchForm = this.fb.group({
      event: ['', Validators.required],
      player1: new FormControl({ value: '', disabled: true }, Validators.required),
      player2: new FormControl({ value: '', disabled: true }, Validators.required),
      song: [''],
      score1: [''],
      score2: [''],
      round: [''],
      winner: new FormControl({ value: '', disabled: true })
    });
  }

  private updateWinnerOptions(): void {
    const player1 = this.matchForm.get('player1')?.value;
    const player2 = this.matchForm.get('player2')?.value;
    const currentWinner = this.matchForm.get('winner')?.value;

    // Reset winner if current selection is no longer valid
    if (currentWinner && currentWinner !== player1 && currentWinner !== player2) {
      this.matchForm.get('winner')?.setValue('');
    }
  }

  onSubmit(): void {
    if (this.matchForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.loadingService.setIsLoading(true);

      const formValue = this.matchForm.value;
      const event: Event = formValue.event;
      const player1: Player = formValue.player1;
      const player2: Player = formValue.player2;
      const winner: Player = formValue.winner;

      // Ensure player1 and player2 are different
      if (player1.player_id === player2.player_id) {
        this.messageService.show('Player 1 and Player 2 must be different.');
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
        return;
      }

      const matchData = {
        event_id: event.event_id!,
        player1_id: player1.player_id!,
        player2_id: player2.player_id!,
        song_id: formValue.song && formValue.song !== '' && formValue.song.song_id ? formValue.song.song_id : undefined,
        winner_id: winner && winner.player_id ? winner.player_id : undefined,
        score1: formValue.score1 ? parseInt(formValue.score1) : undefined,
        score2: formValue.score2 ? parseInt(formValue.score2) : undefined,
        round: formValue.round ? formValue.round.trim() : undefined
      };

      this.matchService.createMatch(matchData).subscribe({
      next: () => {
        this.messageService.show('Match created successfully!');
        this.matchForm.reset();
        this.matchForm.get('event')?.setValue('');
        // Disable player fields after reset
        this.matchForm.get('player1')?.disable();
        this.matchForm.get('player2')?.disable();
        this.matchForm.get('winner')?.disable();
        this.isSubmitting = false;
        this.loadingService.setIsLoading(false);
      },
        error: (error) => {
          console.error('Error creating match:', error);
          const errorMessage = error.error?.message || 'Failed to create match. Please try again.';
          this.messageService.show(errorMessage);
          this.isSubmitting = false;
          this.loadingService.setIsLoading(false);
        }
      });
    }
  }

  getWinnerOptions(): Player[] {
    const player1 = this.matchForm.get('player1')?.value;
    const player2 = this.matchForm.get('player2')?.value;
    const options: Player[] = [];
    if (player1) options.push(player1);
    if (player2) options.push(player2);
    return options;
  }
}
