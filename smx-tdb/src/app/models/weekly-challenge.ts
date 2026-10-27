export interface WeeklyChallengePlayer {
  rank: number;
  gamerId: number;
  username: string;
  country: string | null;
  avatarUrl: string | null;
  hexColor: string | null;
}

export interface WeeklyChallengeChartScore extends WeeklyChallengePlayer {
  score: number;
  fullCombo: boolean;
  createdAt: string | null;
}

export interface WeeklyChallengeOverallEntry extends WeeklyChallengePlayer {
  total: number;
  chartsPlayed: number;
  scores: (number | null)[];
}

export interface WeeklyChallengeChart {
  chartId: number;
  songId: number;
  title: string;
  subtitle: string;
  artist: string;
  coverUrl: string | null;
  level: number;
  difficultyDisplay: string;
  isPlus: boolean;
  bucket: { min: number; max: number };
  browserUrl: string;
  scores: WeeklyChallengeChartScore[];
}

export interface WeeklyChallengeDifficulty {
  key: 'easy' | 'hard' | 'wild' | 'full';
  label: string;
  levelRange: { min: number; max: number } | null;
  charts: WeeklyChallengeChart[];
  overall: WeeklyChallengeOverallEntry[];
}

export interface WeeklyChallengeAllTimeEntry {
  rank: number;
  gamerId: number;
  username: string;
  wins: number;
  top10s: number;
}

export interface WeeklyChallengeAllTimeResponse {
  launchWeek: string | null;
  weeksCounted: number;
  lastFinalizedWeek: string | null;
  topRank: number;
  difficulties: {
    key: WeeklyChallengeDifficulty['key'];
    label: string;
    players: WeeklyChallengeAllTimeEntry[];
  }[];
}

export interface WeeklyChallengeResponse {
  weekKey: string;
  weekOffset: number;
  isCurrent: boolean;
  from: string;
  to: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  refreshedAt: string;
  difficulties: WeeklyChallengeDifficulty[];
}
