export const NOTE_CATEGORIES = ['General', 'Personal', 'Work', 'Ideas', 'Study'] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export function getCategoryStyles(category: string): {
  badge: string;
  dot: string;
  accentBorder: string;
} {
  switch (category) {
    case 'Work':
      return {
        badge: 'bg-blue-50 text-blue-700 border-blue-200/80',
        dot: 'bg-blue-500',
        accentBorder: 'group-hover:border-blue-300',
      };
    case 'Personal':
      return {
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        dot: 'bg-indigo-500',
        accentBorder: 'group-hover:border-indigo-300',
      };
    case 'Ideas':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200/80',
        dot: 'bg-amber-500',
        accentBorder: 'group-hover:border-amber-300',
      };
    case 'Study':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dot: 'bg-emerald-500',
        accentBorder: 'group-hover:border-emerald-300',
      };
    case 'General':
    default:
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-200/80',
        dot: 'bg-slate-400',
        accentBorder: 'group-hover:border-blue-300',
      };
  }
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

