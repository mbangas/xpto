/**
 * lib/crud-helpers.js — CRUD helpers for myLineage
 *
 * Dual-mode: uses PostgreSQL when DATABASE_URL is set, otherwise falls back to
 * JSON files (legacy / tests without a running database).
 *
 * Public API (all functions are synchronous in file-mode, async in PG-mode):
 *   readCollection(treeId, name)           → { entityId: { …data } }
 *   writeCollection(treeId, name, data)    → void
 *   writeEntity(treeId, collection, entityId, data) → void
 *   deleteEntity(treeId, collection, entityId)      → void
 *   nextId(treeId, collection, prefix)     → 'P3' etc.
 *   nowISO()                               → ISO-8601 string
 *
 * Legacy wrappers (no treeId) are kept for the transition period.
 * They use a fixed LEGACY_TREE_ID so that existing unscoped routes keep working
 * until Phase 3 (multi-tree) migrates every call site.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

/* ── Helpers shared by both modes ──────────────────────────────────── */

function nowISO() {
  return new Date().toISOString();
}

/**
 * Sentinel tree id used by legacy (non-tree-aware) callers.
 * On first startup the data-migration script should assign this UUID to the
 * imported tree so that pre-existing data is visible through legacy routes.
 */
const LEGACY_TREE_ID = '00000000-0000-0000-0000-000000000000';

/* ── Detect mode ──────────────────────────────────────────────────── */

function usePg() {
  return !!process.env.DATABASE_URL;
}

/* ═══════════════════════════════════════════════════════════════════
   PostgreSQL implementation
   ═══════════════════════════════════════════════════════════════════ */

function _db() {
  // Lazy-require to avoid crashing when pg is not installed (e.g. unit tests)
  return require('./db');
}

/**
 * Read every non-deleted record for (treeId + collection).
 * Returns an object keyed by entity_id → data JSONB (with id injected).
 */
async function pgReadCollection(treeId, name) {
  const { rows } = await _db().query(
    `SELECT entity_id, data FROM genealogy_records
     WHERE tree_id = $1 AND collection = $2 AND deleted_at IS NULL`,
    [treeId, name],
  );
  const result = {};
  for (const r of rows) {
    result[r.entity_id] = { ...r.data, id: r.entity_id };
  }
  return result;
}

/**
 * Bulk-write a full collection (replace).  Used by GEDCOM import & bulk-replace.
 * Wraps everything in a transaction so the collection swap is atomic.
 */
async function pgWriteCollection(treeId, name, data) {
  const pool = _db().getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark every existing record as deleted
    await client.query(
      `UPDATE genealogy_records SET deleted_at = NOW()
       WHERE tree_id = $1 AND collection = $2 AND deleted_at IS NULL`,
      [treeId, name],
    );

    // Upsert each entity
    const entries = Object.entries(data);
    for (const [entityId, entityData] of entries) {
      const jsonData = { ...entityData };
      delete jsonData.id; // id lives in entity_id column
      await client.query(
        `INSERT INTO genealogy_records (tree_id, collection, entity_id, data, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), NULL)
         ON CONFLICT (tree_id, collection, entity_id)
         DO UPDATE SET data = $4, updated_at = NOW(), deleted_at = NULL`,
        [treeId, name, entityId, JSON.stringify(jsonData)],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Upsert a single entity inside a collection.
 */
async function pgWriteEntity(treeId, collection, entityId, data) {
  const jsonData = { ...data };
  delete jsonData.id;
  await _db().query(
    `INSERT INTO genealogy_records (tree_id, collection, entity_id, data, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW(), NULL)
     ON CONFLICT (tree_id, collection, entity_id)
     DO UPDATE SET data = $4, updated_at = NOW(), deleted_at = NULL`,
    [treeId, collection, entityId, JSON.stringify(jsonData)],
  );
}

/**
 * Soft-delete a single entity.
 */
async function pgDeleteEntity(treeId, collection, entityId) {
  await _db().query(
    `UPDATE genealogy_records SET deleted_at = NOW(), updated_at = NOW()
     WHERE tree_id = $1 AND collection = $2 AND entity_id = $3`,
    [treeId, collection, entityId],
  );
}

/**
 * Return the next available id (prefix + N) for a collection.
 */
async function pgNextId(treeId, collection, prefix) {
  const { rows } = await _db().query(
    `SELECT entity_id FROM genealogy_records
     WHERE tree_id = $1 AND collection = $2 AND entity_id LIKE $3
     ORDER BY entity_id`,
    [treeId, collection, prefix + '%'],
  );
  const used = new Set(rows.map(r => r.entity_id));
  let n = 1;
  while (used.has(prefix + n)) n++;
  return prefix + n;
}

/* ═══════════════════════════════════════════════════════════════════
   JSON-file implementation (legacy / tests)
   ═══════════════════════════════════════════════════════════════════ */

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '..', 'JSON-DATA');
}

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fileReadCollection(_treeId, name) {
  ensureDataDir();
  const fpath = path.join(getDataDir(), name + '.json');
  if (!fs.existsSync(fpath)) return {};
  try { return JSON.parse(fs.readFileSync(fpath, 'utf8')); } catch (_e) { return {}; }
}

function fileWriteCollection(_treeId, name, data) {
  ensureDataDir();
  fs.writeFileSync(path.join(getDataDir(), name + '.json'), JSON.stringify(data, null, 2), 'utf8');
}

function fileWriteEntity(treeId, collection, entityId, data) {
  const all = fileReadCollection(treeId, collection);
  all[entityId] = data;
  fileWriteCollection(treeId, collection, all);
}

function fileDeleteEntity(treeId, collection, entityId) {
  const all = fileReadCollection(treeId, collection);
  if (all[entityId]) {
    all[entityId] = { ...all[entityId], deletedAt: nowISO(), updatedAt: nowISO() };
    fileWriteCollection(treeId, collection, all);
  }
}

function fileNextId(treeId, collectionName, prefix) {
  const data = fileReadCollection(treeId, collectionName);
  let n = 1;
  while (data[prefix + n]) n++;
  return prefix + n;
}

/* ═══════════════════════════════════════════════════════════════════
   Unified public API — delegates to PG or file backend
   ═══════════════════════════════════════════════════════════════════ */

function readCollection(treeIdOrName, maybeName) {
  // Support legacy call: readCollection('individuals')
  const treeId = maybeName ? treeIdOrName : LEGACY_TREE_ID;
  const name   = maybeName || treeIdOrName;
  return usePg() ? pgReadCollection(treeId, name) : fileReadCollection(treeId, name);
}

function writeCollection(treeIdOrName, maybeNameOrData, maybeData) {
  // Support legacy call: writeCollection('individuals', {...})
  let treeId, name, data;
  if (maybeData !== undefined) {
    treeId = treeIdOrName; name = maybeNameOrData; data = maybeData;
  } else {
    treeId = LEGACY_TREE_ID; name = treeIdOrName; data = maybeNameOrData;
  }
  return usePg() ? pgWriteCollection(treeId, name, data) : fileWriteCollection(treeId, name, data);
}

function writeEntity(treeId, collection, entityId, data) {
  return usePg()
    ? pgWriteEntity(treeId, collection, entityId, data)
    : fileWriteEntity(treeId, collection, entityId, data);
}

function deleteEntity(treeId, collection, entityId) {
  return usePg()
    ? pgDeleteEntity(treeId, collection, entityId)
    : fileDeleteEntity(treeId, collection, entityId);
}

function nextId(treeIdOrName, maybePrefixOrName, maybePrefix) {
  // Support legacy call: nextId('individuals', 'I')
  let treeId, collection, prefix;
  if (maybePrefix !== undefined) {
    treeId = treeIdOrName; collection = maybePrefixOrName; prefix = maybePrefix;
  } else {
    treeId = LEGACY_TREE_ID; collection = treeIdOrName; prefix = maybePrefixOrName;
  }
  return usePg()
    ? pgNextId(treeId, collection, prefix)
    : fileNextId(treeId, collection, prefix);
}

module.exports = {
  LEGACY_TREE_ID,
  getDataDir,
  ensureDataDir,
  nowISO,
  readCollection,
  writeCollection,
  writeEntity,
  deleteEntity,
  nextId,
};
