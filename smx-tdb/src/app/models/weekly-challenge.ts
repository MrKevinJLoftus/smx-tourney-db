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
  key: 'easy' | 'hard' | 'wild' | 'dual' | 'full';
  label: string;
  levelRange: { min: number; max: number } | null;
  charts: WeeklyChallengeChart[];
  overall: WeeklyChallengeOverallEntry[];
}

export interface LevelBucket {
  min: number;
  max: number;
}

export interface BucketSettingSummary {
  /** False when the automatic thirds of the level range are in use. */
  custom: boolean;
  buckets: LevelBucket[];
  /** Week the setting started, or null when automatic has never been changed. */
  since: string | null;
}

export interface DifficultyBucketSettings {
  key: WeeklyChallengeDifficulty['key'];
  label: string;
  levelRange: LevelBucket | null;
  levelCounts: { level: number; count: number }[];
  automaticBuckets: LevelBucket[];
  thisWeek: BucketSettingSummary & {
    charts: { chartId: number; title: string; level: number; difficultyDisplay: string; bucket: LevelBucket }[];
  };
  nextWeek: BucketSettingSummary;
}

export interface WeeklyChallengeBucketSettings {
  currentWeek: string;
  nextWeek: string;
  minLevel: number;
  maxLevel: number;
  difficulties: DifficultyBucketSettings[];
}

export interface SaveBucketSettingResponse {
  effectiveWeek: string;
  difficulty: DifficultyBucketSettings;
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
  /** Oldest week offset that can be viewed (0 when only the current week exists). */
  minWeekOffset: number;
  isCurrent: boolean;
  from: string;
  to: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  refreshedAt: string;
  difficulties: WeeklyChallengeDifficulty[];
}
