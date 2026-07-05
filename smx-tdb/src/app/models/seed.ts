export interface SeedPlayerResult {
  id: number;
  username: string;
}

export interface SeedEntry {
  seed: number;
  player: SeedPlayerResult;
  rating: number;
  deviation: number;
  matchesCounted: number;
  provisional: boolean;
}

export interface SeedGenerateResponse {
  playerCount: number;
  seeding: SeedEntry[];
  method: string;
  tiebreak: string;
}

export interface RebuildRatingsResponse {
  message: string;
  playersRated: number;
  matchesProcessed: number;
}
