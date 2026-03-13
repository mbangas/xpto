/**
 * lib/db.js — PostgreSQL connection pool for myLineage
 * Uses DATABASE_URL env var for connection configuration.
 */

'use strict';

const { Pool } = require('pg');

let pool = null;

/**
 * Returns the shared connection pool, creating it on first call.
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Convenience wrapper — runs a parameterised query and returns rows.
 * @param {string} text  SQL query with $1, $2, … placeholders
 * @param {any[]}  [params]
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(text, params) {
  return getPool().query(text, params);
}

/** Gracefully close the pool (for shutdown / tests). */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, closePool };
