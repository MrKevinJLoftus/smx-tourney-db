export interface Match {
  match_id?: number;
  event_id: number;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PlayerScore {
  player_id: number;
  score?: number;
  win?: boolean;
  player_gamertag?: string;
}

export interface MatchSong {
  song_id: number;
  title?: string;
  artist?: string;
  chart_id?: number;
  chart_mode?: string;
  chart_difficulty?: number;
  chart_display?: string;
  player_scores: PlayerScore[];
}

export interface MatchWithDetails extends Match {
  players?: Array<{
    player_id: number;
    gamertag: string;
  }>;
  winner?: {
    player_id: number;
    gamertag: string;
  } | null;
  songs?: MatchSong[];
  event?: {
    event_id: number;
    name: string;
    date: string;
  };
}

