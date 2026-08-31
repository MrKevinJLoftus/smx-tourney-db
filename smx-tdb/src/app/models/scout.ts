export interface ScoutPlayer {
  id: number;
  username: string;
}

export type ScoutMode = 'beginner' | 'easy' | 'hard' | 'wild' | 'dual' | 'full';

export interface ScoutOpponentScore {
  id: number;
  username: string;
  score: number | null;
}

export type PocketPickMode = 'wins' | 'fallback';

export interface ChartComparison {
  songChartId: string;
  title: string;
  artist: string;
  level: number;
  gameSongId: number | null;
  difficultyId: number | null;
  yourScore: number | null;
  opponentScores: ScoutOpponentScore[];
  bestOpponentScore: number;
  delta: number | null;
  youUnplayed: boolean;
  opponentsUnplayed: boolean;
}

export interface ScoutCompareResponse {
  mode: ScoutMode;
  levelMin: number | null;
  levelMax: number | null;
  players: ScoutPlayer[];
  you: ScoutPlayer;
  opponents: ScoutPlayer[];
  pocketPicks: ChartComparison[];
  closestMatchups: ChartComparison[];
  pocketPickMode: PocketPickMode;
  vetos: ChartComparison[];
  chartCount: number;
}

export interface ScoutSuggestion {
  id: number;
  username: string;
  source: 'statmaniax' | 'tdb';
}
