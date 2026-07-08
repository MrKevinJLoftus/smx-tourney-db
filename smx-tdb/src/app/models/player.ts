import { PlayerRatingSummary } from './rating';

export interface Player {
  id?: number;
  player_id?: number; // Deprecated: use id instead. Kept for backward compatibility.
  username: string;
  pronouns?: string;
  /** When true, this player's match data is hidden site-wide. */
  hidden_matches?: boolean;
  rating?: PlayerRatingSummary | null;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

