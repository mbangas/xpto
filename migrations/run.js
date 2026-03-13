/**
 * migrations/run.js — Lightweight migration runner for myLineage.
 *
 * Tracks applied migrations in a `schema_migrations` table.
 * Each migration file exports { up(pool), down(pool) }.
 *
 * Usage:
 *   node migrations/run.js          — apply pending migrations (up)
 *   node migrations/run.js down     — rollback the last migration
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = __dirname;

/**
 * Ensure the schema_migrations tracking table exists.
 */
async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Return an ordered list of migration files (*.js excluding run.js).
 */
function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js') && f !== 'run.js')
    .sort();
}

/**
 * Apply all pending migrations.
 */
async function up(pool) {
  await ensureTable(pool);

  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
  const appliedSet = new Set(applied.map(r => r.name));
  const files = getMigrationFiles();

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    console.log(`[migrate] Applying ${file} …`);
    const migration = require(path.join(MIGRATIONS_DIR, file));
    await migration.up(pool);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    count++;
    console.log(`[migrate] ✓ ${file}`);
  }

  if (count === 0) {
    console.log('[migrate] No pending migrations.');
  } else {
    console.log(`[migrate] Applied ${count} migration(s).`);
  }
}

/**
 * Rollback the most recently applied migration.
 */
async function down(pool) {
  await ensureTable(pool);

  const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1');
  if (!rows.length) {
    console.log('[migrate] Nothing to rollback.');
    return;
  }

  const file = rows[0].name;
  console.log(`[migrate] Rolling back ${file} …`);
  const migration = require(path.join(MIGRATIONS_DIR, file));
  await migration.down(pool);
  await pool.query('DELETE FROM schema_migrations WHERE name = $1', [file]);
  console.log(`[migrate] ✓ Rolled back ${file}`);
}

/* ── CLI entry point ─────────────────────────────────────────────────── */
if (require.main === module) {
  const { getPool, closePool } = require('../lib/db');
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  const pool = getPool();

  (direction === 'up' ? up(pool) : down(pool))
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[migrate] FATAL:', err);
      closePool().finally(() => process.exit(1));
    });
}

module.exports = { up, down };
