/**
 * routes/admin.js — Admin dashboard API routes for myLineage.
 *
 * All routes require admin privileges (requireAdmin middleware).
 *
 * Provides:
 *   GET /stats   — aggregate platform statistics
 *   GET /users   — list all users
 *   GET /trees   — list all trees
 *   GET /logins  — login audit log
 */

'use strict';

const express = require('express');
const { query } = require('../lib/db');

const router = express.Router();

/* ── GET /stats — aggregate platform statistics ──────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const [users, trees, records, logins] = await Promise.all([
      query('SELECT count(*)::int AS count FROM users'),
      query('SELECT count(*)::int AS count FROM trees'),
      query(`SELECT collection, count(*)::int AS count
             FROM genealogy_records WHERE deleted_at IS NULL
             GROUP BY collection`),
      query(`SELECT count(*)::int AS total,
                    count(*) FILTER (WHERE success) ::int AS successful,
                    count(*) FILTER (WHERE NOT success) ::int AS failed
             FROM login_audit
             WHERE created_at > NOW() - INTERVAL '30 days'`),
    ]);

    const collections = {};
    for (const row of records.rows) {
      collections[row.collection] = row.count;
    }

    const loginStats = logins.rows[0] || { total: 0, successful: 0, failed: 0 };

    res.json({
      users: users.rows[0].count,
      trees: trees.rows[0].count,
      collections,
      logins30d: loginStats,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── GET /users — list all users ─────────────────────────────────────── */
router.get('/users', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await query(
      `SELECT u.id, u.email, u.name, u.is_admin, u.totp_verified,
              u.created_at, u.updated_at,
              count(tm.id)::int AS tree_count
       FROM users u
       LEFT JOIN tree_memberships tm ON tm.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const total = await query('SELECT count(*)::int AS count FROM users');

    res.json({
      users: result.rows.map(r => ({
        id: r.id,
        email: r.email,
        name: r.name,
        isAdmin: r.is_admin,
        totpVerified: r.totp_verified,
        treeCount: r.tree_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: total.rows[0].count,
      limit,
      offset,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── GET /trees — list all trees ─────────────────────────────────────── */
router.get('/trees', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await query(
      `SELECT t.id, t.name, t.description, t.owner_id, t.created_at,
              u.email AS owner_email, u.name AS owner_name,
              count(DISTINCT tm.user_id)::int AS member_count,
              count(DISTINCT gr.entity_id) FILTER
                (WHERE gr.collection = 'individuals' AND gr.deleted_at IS NULL)::int AS individual_count
       FROM trees t
       JOIN users u ON u.id = t.owner_id
       LEFT JOIN tree_memberships tm ON tm.tree_id = t.id
       LEFT JOIN genealogy_records gr ON gr.tree_id = t.id
       GROUP BY t.id, u.email, u.name
       ORDER BY t.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const total = await query('SELECT count(*)::int AS count FROM trees');

    res.json({
      trees: result.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        ownerId: r.owner_id,
        ownerEmail: r.owner_email,
        ownerName: r.owner_name,
        memberCount: r.member_count,
        individualCount: r.individual_count,
        createdAt: r.created_at,
      })),
      total: total.rows[0].count,
      limit,
      offset,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── GET /logins — login audit log ───────────────────────────────────── */
router.get('/logins', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await query(
      `SELECT la.id, la.user_id, la.ip, la.user_agent, la.success, la.created_at,
              u.email, u.name
       FROM login_audit la
       LEFT JOIN users u ON u.id = la.user_id
       ORDER BY la.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const total = await query('SELECT count(*)::int AS count FROM login_audit');

    res.json({
      logins: result.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        email: r.email,
        name: r.name,
        ip: r.ip,
        userAgent: r.user_agent,
        success: r.success,
        createdAt: r.created_at,
      })),
      total: total.rows[0].count,
      limit,
      offset,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
