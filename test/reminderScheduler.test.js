import test from 'node:test';
import assert from 'node:assert';
import {
  computeSnoozeUntilIso,
  getDueReminders,
  getEffectiveReminderTime,
  getNextUpcomingReminderDelayMs,
  getReminderOccurrenceKey,
  shouldBlinkForMode,
  shouldRingForMode,
} from '../src/utils/reminderScheduler.ts';

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Sample Task',
    description: null,
    scheduled_at: null,
    timezone: 'Asia/Kolkata',
    priority: 'medium',
    status: 'pending',
    snoozed_until: null,
    last_reminded_at: null,
    reminder_dismissed: false,
    created_at: '2026-11-18T00:00:00.000Z',
    updated_at: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

test('notification modes map cleanly to ring and blink flags', () => {
  assert.strictEqual(shouldRingForMode('ring'), true);
  assert.strictEqual(shouldBlinkForMode('ring'), false);

  assert.strictEqual(shouldRingForMode('blink'), false);
  assert.strictEqual(shouldBlinkForMode('blink'), true);

  assert.strictEqual(shouldRingForMode('both'), true);
  assert.strictEqual(shouldBlinkForMode('both'), true);

  assert.strictEqual(shouldRingForMode('silent'), false);
  assert.strictEqual(shouldBlinkForMode('silent'), false);
});

test('completed and dismissed tasks never trigger reminders', () => {
  const now = new Date('2026-11-18T10:00:00.000Z').getTime();
  const tasks = [
    makeTask({ id: 'completed', status: 'completed', scheduled_at: '2026-11-18T09:55:00.000Z' }),
    makeTask({ id: 'dismissed', reminder_dismissed: true, scheduled_at: '2026-11-18T09:55:00.000Z' }),
    makeTask({ id: 'due', scheduled_at: '2026-11-18T09:55:00.000Z' }),
  ];

  const due = getDueReminders(tasks, now, new Set());
  assert.deepStrictEqual(due.map((t) => t.id), ['due']);
});

test('deduplication prevents duplicate alerts for the same occurrence', () => {
  const now = new Date('2026-11-18T10:00:00.000Z').getTime();
  const task = makeTask({ id: 't-1', scheduled_at: '2026-11-18T10:00:00.000Z' });
  const key = getReminderOccurrenceKey(task.id, task.scheduled_at);

  assert.strictEqual(getDueReminders([task], now, new Set()).length, 1);
  assert.strictEqual(getDueReminders([task], now, new Set([key])).length, 0);
});

test('snoozed reminder waits until snoozed_until and fires again at the exact snoozed time', () => {
  const originalDue = new Date('2026-11-18T10:00:00.000Z').getTime();
  const snoozedUntil = computeSnoozeUntilIso(originalDue, 5);
  assert.strictEqual(snoozedUntil, '2026-11-18T10:05:00.000Z');

  const task = makeTask({
    id: 't-snooze',
    scheduled_at: '2026-11-18T10:00:00.000Z',
    snoozed_until: snoozedUntil,
    last_reminded_at: '2026-11-18T10:00:05.000Z',
  });

  // Before 10:05 -> not due yet
  const at1003 = new Date('2026-11-18T10:03:00.000Z').getTime();
  assert.strictEqual(getDueReminders([task], at1003, new Set()).length, 0);
  assert.strictEqual(getNextUpcomingReminderDelayMs([task], at1003), 2 * 60 * 1000);

  // At 10:05 -> due again even though last_reminded_at was 10:00:05
  const at1005 = new Date('2026-11-18T10:05:00.000Z').getTime();
  assert.strictEqual(getDueReminders([task], at1005, new Set()).length, 1);
  assert.strictEqual(getEffectiveReminderTime(task), snoozedUntil);
});

test('multiple due reminders sort earliest first and ignore stale reminders older than 24h', () => {
  const now = new Date('2026-11-18T12:00:00.000Z').getTime();
  const tasks = [
    makeTask({ id: 'stale', scheduled_at: '2026-11-16T08:00:00.000Z' }),
    makeTask({ id: 'second', scheduled_at: '2026-11-18T11:55:00.000Z' }),
    makeTask({ id: 'first', scheduled_at: '2026-11-18T11:30:00.000Z' }),
    makeTask({ id: 'future', scheduled_at: '2026-11-18T12:10:00.000Z' }),
  ];

  const due = getDueReminders(tasks, now, new Set());
  assert.deepStrictEqual(due.map((t) => t.id), ['first', 'second']);
  assert.strictEqual(getNextUpcomingReminderDelayMs(tasks, now), 10 * 60 * 1000);
});

