export interface Player {
  id?: number;
  player_id?: number; // Deprecated: use id instead. Kept for backward compatibility.
  username: string;
  pronouns?: string;
  /** When true, this player's match data is hidden site-wide. */
  hidden_matches?: boolean;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

