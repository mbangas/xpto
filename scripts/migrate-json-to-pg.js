#!/usr/bin/env node
/**
 * scripts/migrate-json-to-pg.js — Migrate JSON-DATA files into PostgreSQL.
 *
 * Reads each JSON file from JSON-DATA/, inserts records into genealogy_records
 * for the legacy tree (LEGACY_TREE_ID).  Also migrates settings → tree_settings
 * and history → tree_history.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate-json-to-pg.js [--dry-run]
 *
 * Requires the database schema from migrations/001_initial_schema.js to be
 * already applied (the system user + legacy tree must exist).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const LEGACY_TREE_ID = '00000000-0000-0000-0000-000000000000';
const DATA_DIR = path.join(__dirname, '..', 'JSON-DATA');

const COLLECTIONS = [
  { file: 'individuals.json',      collection: 'individuals' },
  { file: 'families.json',         collection: 'families' },
  { file: 'sources.json',          collection: 'sources' },
  { file: 'repositories.json',     collection: 'repositories' },
  { file: 'multimedia.json',       collection: 'multimedia' },
  { file: 'notes.json',            collection: 'notes' },
  { file: 'submitters.json',       collection: 'submitters' },
  { file: 'historical-facts.json', collection: 'historical-facts' },
];

function readJsonFile(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[migrate] DRY RUN — no data will be written.\n');

  const { getPool, closePool } = require('../lib/db');
  const pool = getPool();

  // Verify the legacy tree exists
  const treeCheck = await pool.query('SELECT id FROM trees WHERE id = $1', [LEGACY_TREE_ID]);
  if (!treeCheck.rows.length) {
    console.error('ERROR: Legacy tree not found. Run migrations first (npm start or migration runner).');
    await closePool();
    process.exit(1);
  }

  let totalRecords = 0;

  // ── Migrate entity collections ───────────────────────────────────────
  for (const { file, collection } of COLLECTIONS) {
    const data = readJsonFile(file);
    if (!data || typeof data !== 'object') {
      console.log(`[migrate] ${file} — skipped (not found or empty)`);
      continue;
    }
    const entries = Object.values(data);
    if (!entries.length) {
      console.log(`[migrate] ${file} — 0 records`);
      continue;
    }

    console.log(`[migrate] ${file} — ${entries.length} records`);

    if (!dryRun) {
      // Use a single transaction per collection for performance
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const rec of entries) {
          if (!rec.id) continue;
          await client.query(
            `INSERT INTO genealogy_records (tree_id, collection, entity_id, data, created_at, updated_at, deleted_at)
             VALUES ($1, $2, $3, $4,
                     COALESCE($5::timestamptz, NOW()),
                     COALESCE($6::timestamptz, NOW()),
                     $7::timestamptz)
             ON CONFLICT (tree_id, collection, entity_id)
             DO UPDATE SET data = EXCLUDED.data,
                           updated_at = EXCLUDED.updated_at,
                           deleted_at = EXCLUDED.deleted_at`,
            [
              LEGACY_TREE_ID,
              collection,
              rec.id,
              JSON.stringify(rec),
              rec.createdAt || null,
              rec.updatedAt || null,
              rec.deletedAt || null,
            ],
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ERROR on ${file}: ${e.message}`);
      } finally {
        client.release();
      }
    }

    totalRecords += entries.length;
  }

  // ── Migrate settings ────────────────────────────────────────────────
  const settings = readJsonFile('settings.json');
  if (settings && typeof settings === 'object') {
    const keys = Object.keys(settings);
    console.log(`[migrate] settings.json — ${keys.length} keys`);
    if (!dryRun && keys.length) {
      for (const key of keys) {
        await pool.query(
          `INSERT INTO tree_settings (tree_id, key, value)
           VALUES ($1, $2, $3)
           ON CONFLICT (tree_id, key)
           DO UPDATE SET value = EXCLUDED.value`,
          [LEGACY_TREE_ID, key, JSON.stringify(settings[key])],
        );
      }
    }
  } else {
    console.log('[migrate] settings.json — skipped (not found)');
  }

  // ── Migrate history ─────────────────────────────────────────────────
  const history = readJsonFile('history.json');
  if (Array.isArray(history) && history.length) {
    console.log(`[migrate] history.json — ${history.length} entries`);
    if (!dryRun) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const entry of history) {
          await client.query(
            `INSERT INTO tree_history (tree_id, data, created_at)
             VALUES ($1, $2, COALESCE($3::timestamptz, NOW()))`,
            [LEGACY_TREE_ID, JSON.stringify(entry), entry.timestamp || entry.createdAt || null],
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ERROR on history: ${e.message}`);
      } finally {
        client.release();
      }
    }
  } else {
    console.log('[migrate] history.json — skipped (not found or empty)');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log(`\n[migrate] Done. ${totalRecords} genealogy records processed.`);
  if (dryRun) console.log('[migrate] (DRY RUN — nothing was written)');

  await closePool();
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
