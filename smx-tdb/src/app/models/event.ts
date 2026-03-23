export interface Event {
  id?: number;
  name: string;
  date: string | Date;
  description?: string;
  location?: string;
  organizers?: string;
  /** Set when the event was created via start.gg import */
  start_gg_event_id?: number | null;
  created_at?: string;
  updated_at?: string;
  placement?: string | number; // Placement in event (only available when fetched by player)
  seed?: number | string; // Seed in event (only available when fetched by player)
}

