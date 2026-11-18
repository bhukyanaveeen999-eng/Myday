import type { NotificationMode, Task } from '../types/database.types';

export const SNOOZE_MINUTES = 5;
export const MISSED_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getEffectiveReminderTime(task: Task): string | null {
  if (task.status !== 'pending' || task.reminder_dismissed) {
    return null;
  }
  return task.snoozed_until || task.scheduled_at || null;
}

export function getReminderOccurrenceKey(taskId: string, effectiveIso: string): string {
  const ts = new Date(effectiveIso).getTime();
  return `${taskId}::${Number.isNaN(ts) ? effectiveIso : ts}`;
}

export function isReminderDue(
  task: Task,
  nowMs: number,
  acknowledgedKeys: ReadonlySet<string>
): boolean {
  const effectiveIso = getEffectiveReminderTime(task);
  if (!effectiveIso) return false;

  const dueMs = new Date(effectiveIso).getTime();
  if (Number.isNaN(dueMs)) return false;

  // Not yet due
  if (dueMs > nowMs) return false;

  // Ignore very old reminders (> 24 hours old) to prevent alert storms on old tasks
  if (nowMs - dueMs > MISSED_WINDOW_MS) return false;

  // Already fired/acknowledged in this runtime session for this exact timestamp
  const key = getReminderOccurrenceKey(task.id, effectiveIso);
  if (acknowledgedKeys.has(key)) return false;

  // Already reminded on or after this exact due timestamp
  if (task.last_reminded_at) {
    const lastMs = new Date(task.last_reminded_at).getTime();
    if (!Number.isNaN(lastMs) && lastMs >= dueMs) {
      return false;
    }
  }

  return true;
}

export function getDueReminders(
  tasks: Task[],
  nowMs: number,
  acknowledgedKeys: ReadonlySet<string>
): Task[] {
  return tasks
    .filter((task) => isReminderDue(task, nowMs, acknowledgedKeys))
    .sort((a, b) => {
      const aIso = getEffectiveReminderTime(a) || '';
      const bIso = getEffectiveReminderTime(b) || '';
      return new Date(aIso).getTime() - new Date(bIso).getTime();
    });
}

export function getNextUpcomingReminderDelayMs(tasks: Task[], nowMs: number): number | null {
  let soonestMs: number | null = null;
  for (const task of tasks) {
    const effectiveIso = getEffectiveReminderTime(task);
    if (!effectiveIso) continue;
    const dueMs = new Date(effectiveIso).getTime();
    if (Number.isNaN(dueMs) || dueMs <= nowMs) continue;
    if (soonestMs === null || dueMs < soonestMs) {
      soonestMs = dueMs;
    }
  }
  return soonestMs === null ? null : Math.max(250, soonestMs - nowMs);
}

export function computeSnoozeUntilIso(nowMs: number = Date.now(), minutes: number = SNOOZE_MINUTES): string {
  return new Date(nowMs + minutes * 60 * 1000).toISOString();
}

export function shouldRingForMode(mode: NotificationMode): boolean {
  return mode === 'ring' || mode === 'both';
}

export function shouldBlinkForMode(mode: NotificationMode): boolean {
  return mode === 'blink' || mode === 'both';
}

