import test from 'node:test';
import assert from 'node:assert';
import { formatDateTime, formatDateOnly, formatTimeOnly, toInputDate, toInputTime, combineDateAndTime } from '../src/utils/dateUtils.ts';

test('formatDateTime formats ISO strings with timezone Asia/Kolkata', () => {
  const result = formatDateTime('2026-11-18T10:30:00Z');
  assert.ok(result.includes('2026') || result.includes('Nov'));
});

test('formatDateTime handles null gracefully', () => {
  assert.strictEqual(formatDateTime(null), 'Not scheduled');
});

test('toInputDate converts ISO string to yyyy-mm-dd', () => {
  const iso = '2026-11-18T14:30:00.000Z';
  const dateStr = toInputDate(iso);
  assert.match(dateStr, /^\d{4}-\d{2}-\d{2}$/);
});

test('toInputTime converts ISO string to hh:mm', () => {
  const iso = '2026-11-18T14:30:00.000Z';
  const timeStr = toInputTime(iso);
  assert.match(timeStr, /^\d{2}:\d{2}$/);
});

test('combineDateAndTime produces a valid ISO string', () => {
  const combined = combineDateAndTime('2026-11-18', '14:30');
  assert.ok(combined !== null);
  const parsed = new Date(combined);
  assert.strictEqual(isNaN(parsed.getTime()), false);
});

test('combineDateAndTime handles empty date by returning null', () => {
  assert.strictEqual(combineDateAndTime('', '14:30'), null);
});

