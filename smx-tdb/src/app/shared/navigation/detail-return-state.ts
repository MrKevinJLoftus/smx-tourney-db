export type BrowseTabParam = 'player' | 'event' | 'match';

export interface BrowseReturnPayload {
  tab: BrowseTabParam;
  q?: string;
}

export interface HomeSearchReturnPayload {
  q: string;
}

/** Keys stored on History.state when opening a detail page from browse or home search. */
export const BROWSE_RETURN_STATE_KEY = 'browseReturn';
export const HOME_SEARCH_RETURN_STATE_KEY = 'homeSearchReturn';

export function readBrowseReturnPayload(
  state: Record<string, unknown> | null | undefined
): BrowseReturnPayload | null {
  if (!state) return null;
  const raw = state[BROWSE_RETURN_STATE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const tab = (raw as { tab?: unknown }).tab;
  if (tab !== 'player' && tab !== 'event' && tab !== 'match') return null;
  const qRaw = (raw as { q?: unknown }).q;
  const q = typeof qRaw === 'string' ? qRaw : undefined;
  return q ? { tab, q } : { tab };
}

export function readHomeSearchReturnPayload(
  state: Record<string, unknown> | null | undefined
): HomeSearchReturnPayload | null {
  if (!state) return null;
  const raw = state[HOME_SEARCH_RETURN_STATE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const q = (raw as { q?: unknown }).q;
  if (typeof q !== 'string' || !q.trim()) return null;
  return { q: q.trim() };
}
