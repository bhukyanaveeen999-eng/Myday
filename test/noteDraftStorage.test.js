import test from 'node:test';
import assert from 'node:assert';
import {
  saveNoteDraft,
  loadNoteDraft,
  clearNoteDraft,
  NEW_NOTE_DRAFT_ID,
} from '../src/utils/noteDraftStorage.ts';

// Minimal in-memory localStorage mock for Node test environment
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => { store.clear(); },
};

test('saveNoteDraft and loadNoteDraft persist unfinished new note locally per user', () => {
  store.clear();
  saveNoteDraft('user-a', NEW_NOTE_DRAFT_ID, 'Shopping List', 'Milk, Eggs');
  const loaded = loadNoteDraft('user-a', NEW_NOTE_DRAFT_ID);
  assert.ok(loaded);
  assert.strictEqual(loaded.title, 'Shopping List');
  assert.strictEqual(loaded.content, 'Milk, Eggs');
});

test('local drafts are strictly isolated between different users on the same device', () => {
  store.clear();
  saveNoteDraft('user-a', NEW_NOTE_DRAFT_ID, 'User A Private Draft', 'Secret A');
  saveNoteDraft('user-b', NEW_NOTE_DRAFT_ID, 'User B Private Draft', 'Secret B');

  const draftA = loadNoteDraft('user-a', NEW_NOTE_DRAFT_ID);
  const draftB = loadNoteDraft('user-b', NEW_NOTE_DRAFT_ID);
  const draftC = loadNoteDraft('user-c', NEW_NOTE_DRAFT_ID);

  assert.strictEqual(draftA?.title, 'User A Private Draft');
  assert.strictEqual(draftB?.title, 'User B Private Draft');
  assert.strictEqual(draftC, null);
});

test('saveNoteDraft removes entry when both title and content are blank', () => {
  store.clear();
  saveNoteDraft('user-a', NEW_NOTE_DRAFT_ID, 'Temp', 'Text');
  saveNoteDraft('user-a', NEW_NOTE_DRAFT_ID, '   ', '');
  assert.strictEqual(loadNoteDraft('user-a', NEW_NOTE_DRAFT_ID), null);
});

test('clearNoteDraft deletes saved draft after successful save', () => {
  store.clear();
  saveNoteDraft('user-a', 'note-123', 'Edited Title', 'Edited Body');
  assert.ok(loadNoteDraft('user-a', 'note-123'));
  clearNoteDraft('user-a', 'note-123');
  assert.strictEqual(loadNoteDraft('user-a', 'note-123'), null);
});
