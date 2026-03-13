/**
 * routes/trees.js — Tree CRUD & member management for myLineage.
 *
 * Endpoints:
 *   POST   /              — create tree (user becomes owner)
 *   GET    /              — list trees the user has access to
 *   GET    /:treeId       — get tree details
 *   PUT    /:treeId       — update tree name/description (owner only)
 *   DELETE /:treeId       — delete tree and all data (owner only)
 *   GET    /:treeId/members          — list members
 *   POST   /:treeId/members          — add member (owner only)
 *   PUT    /:treeId/members/:userId  — change member role (owner only)
 *   DELETE /:treeId/members/:userId  — remove member (owner only)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { query } = require('../lib/db');

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Check if user has specific role(s) in a tree. Returns role or null. */
async function getMemberRole(treeId, userId) {
  const { rows } = await query(
    'SELECT role FROM tree_memberships WHERE tree_id = $1 AND user_id = $2',
    [treeId, userId],
  );
  return rows.length ? rows[0].role : null;
}

/** Require the caller to be tree owner (or admin). 403 otherwise. */
async function requireOwner(req, res, next) {
  if (req.user.isAdmin) return next();
  const role = await getMemberRole(req.params.treeId, req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Apenas o proprietário pode executar esta ação' });
  }
  next();
}

/** Validate UUID format (loose). */
function isUUID(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/* ═══════════════════════════════════════════════════════════════════════
   Tree CRUD
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * POST / — Create a new tree.
 * Body: { name, description? }
 */
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da árvore é obrigatório' });
    }

    const { rows } = await query(
      `INSERT INTO trees (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, owner_id, created_at, updated_at`,
      [name.trim(), (description || '').trim(), req.user.id],
    );
    const tree = rows[0];

    // Creator automatically becomes owner member
    await query(
      `INSERT INTO tree_memberships (tree_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [tree.id, req.user.id],
    );

    res.status(201).json({
      id: tree.id,
      name: tree.name,
      description: tree.description,
      ownerId: tree.owner_id,
      role: 'owner',
      createdAt: tree.created_at,
      updatedAt: tree.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET / — List trees the authenticated user has access to.
 * Admins see all trees.
 */
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.user.isAdmin) {
      ({ rows } = await query(
        `SELECT t.id, t.name, t.description, t.owner_id, t.created_at, t.updated_at,
                COALESCE(m.role, 'admin') AS role
         FROM trees t
         LEFT JOIN tree_memberships m ON m.tree_id = t.id AND m.user_id = $1
         ORDER BY t.name`,
        [req.user.id],
      ));
    } else {
      ({ rows } = await query(
        `SELECT t.id, t.name, t.description, t.owner_id, t.created_at, t.updated_at,
                m.role
         FROM trees t
         JOIN tree_memberships m ON m.tree_id = t.id AND m.user_id = $1
         ORDER BY t.name`,
        [req.user.id],
      ));
    }

    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      ownerId: r.owner_id,
      role: r.role,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /:treeId — Get tree details (if user has access).
 */
router.get('/:treeId', async (req, res) => {
  try {
    const { treeId } = req.params;
    if (!isUUID(treeId)) return res.status(400).json({ error: 'treeId inválido' });

    const { rows } = await query('SELECT * FROM trees WHERE id = $1', [treeId]);
    if (!rows.length) return res.status(404).json({ error: 'Árvore não encontrada' });

    // Check access and determine role
    let userRole;
    if (req.user.isAdmin) {
      const membership = await getMemberRole(treeId, req.user.id);
      userRole = membership || 'admin';
    } else {
      userRole = await getMemberRole(treeId, req.user.id);
      if (!userRole) return res.status(403).json({ error: 'Sem acesso a esta árvore' });
    }

    const tree = rows[0];
    // Get member count
    const countResult = await query(
      'SELECT COUNT(*)::int AS total FROM tree_memberships WHERE tree_id = $1',
      [treeId],
    );

    res.json({
      id: tree.id,
      name: tree.name,
      description: tree.description,
      ownerId: tree.owner_id,
      role: userRole,
      memberCount: countResult.rows[0].total,
      createdAt: tree.created_at,
      updatedAt: tree.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * PUT /:treeId — Update tree name/description (owner or admin only).
 */
router.put('/:treeId', requireOwner, async (req, res) => {
  try {
    const { treeId } = req.params;
    const { name, description } = req.body;

    const sets = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name.trim()); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description.trim()); }
    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    sets.push(`updated_at = NOW()`);
    vals.push(treeId);

    const { rows } = await query(
      `UPDATE trees SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (!rows.length) return res.status(404).json({ error: 'Árvore não encontrada' });

    const tree = rows[0];
    res.json({
      id: tree.id,
      name: tree.name,
      description: tree.description,
      ownerId: tree.owner_id,
      createdAt: tree.created_at,
      updatedAt: tree.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * DELETE /:treeId — Delete tree and all associated data (owner or admin only).
 * Cascades via FK: tree_memberships, genealogy_records, tree_settings, tree_history.
 */
router.delete('/:treeId', requireOwner, async (req, res) => {
  try {
    const { treeId } = req.params;
    const { rowCount } = await query('DELETE FROM trees WHERE id = $1', [treeId]);
    if (!rowCount) return res.status(404).json({ error: 'Árvore não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Tree members
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * GET /:treeId/members — List members of a tree.
 * Any member (or admin) can list members.
 */
router.get('/:treeId/members', async (req, res) => {
  try {
    const { treeId } = req.params;

    // Check access
    if (!req.user.isAdmin) {
      const role = await getMemberRole(treeId, req.user.id);
      if (!role) return res.status(403).json({ error: 'Sem acesso a esta árvore' });
    }

    const { rows } = await query(
      `SELECT m.user_id, m.role, m.created_at,
              u.name, u.email
       FROM tree_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.tree_id = $1
       ORDER BY m.role, u.name`,
      [treeId],
    );

    res.json(rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      email: r.email,
      role: r.role,
      joinedAt: r.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /:treeId/members — Add a member to the tree (owner or admin only).
 * Body: { userId, role } where role ∈ ['writer', 'reader']
 */
router.post('/:treeId/members', requireOwner, async (req, res) => {
  try {
    const { treeId } = req.params;
    const { userId, role } = req.body;

    if (!userId || !isUUID(userId)) {
      return res.status(400).json({ error: 'userId inválido' });
    }
    if (!['writer', 'reader'].includes(role)) {
      return res.status(400).json({ error: 'Role deve ser "writer" ou "reader"' });
    }

    // Verify user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!userCheck.rows.length) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    await query(
      `INSERT INTO tree_memberships (tree_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (tree_id, user_id)
       DO UPDATE SET role = $3`,
      [treeId, userId, role],
    );

    res.status(201).json({ ok: true, userId, role });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * PUT /:treeId/members/:userId — Change a member's role (owner or admin only).
 * Body: { role } where role ∈ ['owner', 'writer', 'reader']
 */
router.put('/:treeId/members/:userId', requireOwner, async (req, res) => {
  try {
    const { treeId, userId } = req.params;
    const { role } = req.body;

    if (!['owner', 'writer', 'reader'].includes(role)) {
      return res.status(400).json({ error: 'Role deve ser "owner", "writer" ou "reader"' });
    }

    const { rowCount } = await query(
      `UPDATE tree_memberships SET role = $3
       WHERE tree_id = $1 AND user_id = $2`,
      [treeId, userId, role],
    );
    if (!rowCount) return res.status(404).json({ error: 'Membro não encontrado' });

    // If promoting someone to owner, also update trees.owner_id
    if (role === 'owner') {
      await query('UPDATE trees SET owner_id = $2, updated_at = NOW() WHERE id = $1', [treeId, userId]);
    }

    res.json({ ok: true, userId, role });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * DELETE /:treeId/members/:userId — Remove a member (owner or admin only).
 * Cannot remove the owner.
 */
router.delete('/:treeId/members/:userId', requireOwner, async (req, res) => {
  try {
    const { treeId, userId } = req.params;

    // Cannot remove the tree owner
    const treeCheck = await query('SELECT owner_id FROM trees WHERE id = $1', [treeId]);
    if (treeCheck.rows.length && treeCheck.rows[0].owner_id === userId) {
      return res.status(400).json({ error: 'Não é possível remover o proprietário da árvore' });
    }

    const { rowCount } = await query(
      'DELETE FROM tree_memberships WHERE tree_id = $1 AND user_id = $2',
      [treeId, userId],
    );
    if (!rowCount) return res.status(404).json({ error: 'Membro não encontrado' });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
