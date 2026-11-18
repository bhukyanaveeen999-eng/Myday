export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function formatDateTime(isoString: string | null): string {
  if (!isoString) return 'Not scheduled';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid date';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      dateStyle: 'medium',
    }).format(date);
  } catch {
    return '';
  }
}

export function formatTimeOnly(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      timeStyle: 'short',
    }).format(date);
  } catch {
    return '';
  }
}

export function toInputDate(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

export function toInputTime(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  } catch {
    return '';
  }
}

export function combineDateAndTime(dateStr: string, timeStr?: string): string | null {
  if (!dateStr) return null;
  const time = timeStr && timeStr.trim() !== '' ? timeStr : '09:00';
  const combined = new Date(`${dateStr}T${time}:00`);
  if (isNaN(combined.getTime())) return null;
  return combined.toISOString();
}

