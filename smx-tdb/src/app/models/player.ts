export interface Player {
  id?: number;
  player_id?: number; // Deprecated: use id instead. Kept for backward compatibility.
  username: string;
  pronouns?: string;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

