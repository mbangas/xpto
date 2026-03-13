/**
 * routes/notifications.js — Notification API for myLineage.
 *
 * Endpoints:
 *   GET    /api/notifications              — list notifications for current user
 *   GET    /api/notifications/unread-count  — get unread count
 *   PUT    /api/notifications/:id/read      — mark notification as read
 *   PUT    /api/notifications/read-all      — mark all notifications as read
 *   DELETE /api/notifications/:id           — delete a notification
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { query } = require('../lib/db');

/**
 * GET / — List notifications for the authenticated user.
 * Query params: ?limit=20&offset=0
 */
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { rows } = await query(
      `SELECT id, type, data, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset],
    );

    res.json(rows.map(r => ({
      id: r.id,
      type: r.type,
      data: r.data,
      read: r.read,
      createdAt: r.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /unread-count — Get count of unread notifications.
 */
router.get('/unread-count', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [req.user.id],
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * PUT /read-all — Mark all notifications as read.
 */
router.put('/read-all', async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [req.user.id],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * PUT /:id/read — Mark a single notification as read.
 */
router.put('/:id/read', async (req, res) => {
  try {
    const { rowCount } = await query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Notificação não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * DELETE /:id — Delete a notification.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Notificação não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
