import test from 'node:test';
import assert from 'node:assert';
import { loadAppState, updateAppState, isValidAppRoute } from '../src/utils/appStateStorage.ts';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => { store.clear(); },
};

test('isValidAppRoute accepts valid protected routes and rejects invalid routes', () => {
  assert.strictEqual(isValidAppRoute('/dashboard'), true);
  assert.strictEqual(isValidAppRoute('/notes'), true);
  assert.strictEqual(isValidAppRoute('/tasks?status=pending'), true);
  assert.strictEqual(isValidAppRoute('/login'), false);
  assert.strictEqual(isValidAppRoute('https://evil.example'), false);
});

test('updateAppState and loadAppState persist lastRoute and notes preferences per user', () => {
  store.clear();
  updateAppState('user-1', {
    lastRoute: '/notes',
    notesViewMode: 'list',
    notesCategory: 'Work',
    notesSortBy: 'title',
  });
  updateAppState('user-2', {
    lastRoute: '/tasks?status=completed',
    notesViewMode: 'grid',
    notesCategory: 'Ideas',
  });

  const s1 = loadAppState('user-1');
  const s2 = loadAppState('user-2');
  const s3 = loadAppState('user-3');

  assert.strictEqual(s1.lastRoute, '/notes');
  assert.strictEqual(s1.notesViewMode, 'list');
  assert.strictEqual(s1.notesCategory, 'Work');
  assert.strictEqual(s1.notesSortBy, 'title');

  assert.strictEqual(s2.lastRoute, '/tasks?status=completed');
  assert.strictEqual(s2.notesCategory, 'Ideas');

  // Default fallback for new user
  assert.strictEqual(s3.lastRoute, '/dashboard');
  assert.strictEqual(s3.notesViewMode, 'grid');
});

