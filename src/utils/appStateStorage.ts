export type NotesViewMode = 'grid' | 'list';
export type NotesSortBy = 'updated' | 'created' | 'title';

export interface PersistedAppState {
  lastRoute: string;
  notesViewMode: NotesViewMode;
  notesCategory: string;
  notesSortBy: NotesSortBy;
}

const DEFAULT_STATE: PersistedAppState = {
  lastRoute: '/dashboard',
  notesViewMode: 'grid',
  notesCategory: 'all',
  notesSortBy: 'updated',
};

const STATE_PREFIX = 'myday_app_state_';
const ALLOWED_ROUTE_PREFIXES = ['/dashboard', '/tasks', '/notes', '/settings'];

function getStorageKey(userId: string): string {
  return `${STATE_PREFIX}${userId}`;
}

export function isValidAppRoute(route: string): boolean {
  if (!route || typeof route !== 'string') return false;
  return ALLOWED_ROUTE_PREFIXES.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}?`) || route.startsWith(`${prefix}/`)
  );
}

export function loadAppState(userId: string | undefined): PersistedAppState {
  if (!userId) return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    return {
      lastRoute: isValidAppRoute(parsed.lastRoute ?? '') ? (parsed.lastRoute as string) : DEFAULT_STATE.lastRoute,
      notesViewMode: parsed.notesViewMode === 'list' ? 'list' : 'grid',
      notesCategory: typeof parsed.notesCategory === 'string' && parsed.notesCategory.trim() ? parsed.notesCategory : 'all',
      notesSortBy:
        parsed.notesSortBy === 'created' || parsed.notesSortBy === 'title' ? parsed.notesSortBy : 'updated',
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function updateAppState(
  userId: string | undefined,
  patch: Partial<PersistedAppState>
): PersistedAppState {
  const current = loadAppState(userId);
  const next: PersistedAppState = {
    ...current,
    ...patch,
    lastRoute:
      patch.lastRoute !== undefined && isValidAppRoute(patch.lastRoute)
        ? patch.lastRoute
        : current.lastRoute,
  };
  if (userId) {
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
    } catch {
      // Ignore storage quota/privacy errors
    }
  }
  return next;
}

