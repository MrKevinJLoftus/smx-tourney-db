export interface EventPlayer {
  event_player_id?: number;
  event_id: number;
  player_id: number;
  seed?: number;
  place?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EventPlayerWithDetails extends EventPlayer {
  player?: {
    player_id: number;
    gamertag: string;
  };
  event?: {
    event_id: number;
    name: string;
    date: string;
  };
}

