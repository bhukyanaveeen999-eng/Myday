export interface NoteDraft {
  title: string;
  content: string;
  category?: string;
  isPinned?: boolean;
  savedAt: string;
}

const DRAFT_PREFIX = 'myday_note_draft_';
export const NEW_NOTE_DRAFT_ID = 'new';

function getStorageKey(userId: string, draftId: string): string {
  return `${DRAFT_PREFIX}${userId}_${draftId}`;
}

export function loadNoteDraft(userId: string | undefined, draftId: string): NoteDraft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId, draftId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NoteDraft>;
    if (typeof parsed.title !== 'string' && typeof parsed.content !== 'string') {
      return null;
    }
    const title = parsed.title ?? '';
    const content = parsed.content ?? '';
    if (!title.trim() && !content.trim()) {
      return null;
    }
    return {
      title,
      content,
      category: typeof parsed.category === 'string' ? parsed.category : undefined,
      isPinned: typeof parsed.isPinned === 'boolean' ? parsed.isPinned : undefined,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveNoteDraft(
  userId: string | undefined,
  draftId: string,
  title: string,
  content: string,
  meta?: { category?: string; isPinned?: boolean }
): NoteDraft | null {
  if (!userId) return null;
  try {
    if (!title.trim() && !content.trim()) {
      localStorage.removeItem(getStorageKey(userId, draftId));
      return null;
    }
    const draft: NoteDraft = {
      title,
      content,
      category: meta?.category,
      isPinned: meta?.isPinned,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(getStorageKey(userId, draftId), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

export function clearNoteDraft(userId: string | undefined, draftId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(getStorageKey(userId, draftId));
  } catch {
    // Ignore storage errors
  }
}
