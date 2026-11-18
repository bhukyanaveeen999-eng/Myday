import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20261117173323_create_initial_schema.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8');

test('Migration file exists and is populated', () => {
  assert.ok(fs.existsSync(migrationPath));
  assert.ok(sql.length > 500);
});

test('Tasks table schema meets all requirements', () => {
  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.tasks/i);
  assert.match(sql, /id\s+UUID\s+PRIMARY\s+KEY/i);
  assert.match(sql, /user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(sql, /title\s+TEXT\s+NOT\s+NULL/i);
  assert.match(sql, /description\s+TEXT/i);
  assert.match(sql, /scheduled_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /timezone\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'Asia\/Kolkata'/i);
  assert.match(sql, /priority\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'medium'/i);
  assert.match(sql, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
  assert.match(sql, /created_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /updated_at\s+TIMESTAMPTZ/i);
});

test('Notes table schema meets all requirements', () => {
  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.notes/i);
  assert.match(sql, /id\s+UUID\s+PRIMARY\s+KEY/i);
  assert.match(sql, /user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(sql, /title\s+TEXT/i);
  assert.match(sql, /content\s+TEXT/i);
  assert.match(sql, /created_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /updated_at\s+TIMESTAMPTZ/i);
});

test('Row Level Security is enabled on both tables', () => {
  assert.match(sql, /ALTER\s+TABLE\s+public\.tasks\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  assert.match(sql, /ALTER\s+TABLE\s+public\.notes\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});

test('RLS policies enforce auth.uid() = user_id for all operations', () => {
  // Tasks policies
  assert.match(sql, /CREATE\s+POLICY\s+"Users can view own tasks"\s+ON\s+public\.tasks\s+FOR\s+SELECT\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /CREATE\s+POLICY\s+"Users can insert own tasks"\s+ON\s+public\.tasks\s+FOR\s+INSERT\s+WITH\s+CHECK\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /CREATE\s+POLICY\s+"Users can update own tasks"\s+ON\s+public\.tasks\s+FOR\s+UPDATE\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)\s+WITH\s+CHECK\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /CREATE\s+POLICY\s+"Users can delete own tasks"\s+ON\s+public\.tasks\s+FOR\s+DELETE\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);

  // Notes policies
  assert.match(sql, /CREATE\s+POLICY\s+"Users can view own notes"\s+ON\s+public\.notes\s+FOR\s+SELECT\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /CREATE\s+POLICY\s+"Users can insert own notes"\s+ON\s+public\.notes\s+FOR\s+INSERT\s+WITH\s+CHECK\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /CREATE\s+POLICY\s+"Users can update own notes"\s+ON\s+public\.notes\s+FOR\s+UPDATE\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)\s+WITH\s+CHECK\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /CREATE\s+POLICY\s+"Users can delete own notes"\s+ON\s+public\.notes\s+FOR\s+DELETE\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
});

test('Indexes are configured for query performance', () => {
  assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tasks_user_id\s+ON\s+public\.tasks\(user_id\)/i);
  assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tasks_status\s+ON\s+public\.tasks\(status\)/i);
  assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tasks_scheduled_at\s+ON\s+public\.tasks\(scheduled_at\)/i);
  assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_notes_user_id\s+ON\s+public\.notes\(user_id\)/i);
});

test('Triggers for updated_at timestamps are defined', () => {
  assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_updated_at/i);
  assert.match(sql, /CREATE\s+TRIGGER\s+set_tasks_updated_at/i);
  assert.match(sql, /CREATE\s+TRIGGER\s+set_notes_updated_at/i);
});

