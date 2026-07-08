export interface PlayerRatingSummary {
  rating: number;
  deviation: number;
  matchesCounted: number;
  provisional: boolean;
  rank?: number | null;
}

export interface PlayerMatchRating {
  player_id: number;
  rating: number;
  deviation: number;
  gamertag?: string;
}
