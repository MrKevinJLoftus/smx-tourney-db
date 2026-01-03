export interface Event {
  id?: number;
  name: string;
  date: string | Date;
  description?: string;
  location?: string;
  organizers?: string;
  created_at?: string;
  updated_at?: string;
}

