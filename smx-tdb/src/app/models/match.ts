export interface Match {
  match_id?: number;
  event_id: number;
  player1_id: number;
  player2_id: number;
  song_id?: number;
  winner_id?: number;
  score1?: number;
  score2?: number;
  round?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MatchWithDetails extends Match {
  player1?: {
    player_id: number;
    gamertag: string;
  };
  player2?: {
    player_id: number;
    gamertag: string;
  };
  winner?: {
    player_id: number;
    gamertag: string;
  };
  song?: {
    song_id: number;
    title: string;
    artist?: string;
  };
  event?: {
    event_id: number;
    name: string;
    date: string;
  };
}

