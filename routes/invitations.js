/**
 * routes/invitations.js — Invitation API for myLineage.
 *
 * Endpoints:
 *   POST   /api/trees/:treeId/invitations     — owner sends invitation
 *   GET    /api/trees/:treeId/invitations      — list invitations for a tree (owner)
 *   GET    /api/invitations                    — list user's pending invitations
 *   POST   /api/invitations/:id/accept         — accept invitation
 *   POST   /api/invitations/:id/decline        — decline invitation
 *   GET    /api/invitations/by-token/:token     — public: get invitation details by token
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { query }              = require('../lib/db');
const { sendInvitationEmail } = require('../lib/email');

/* ═══════════════════════════════════════════════════════════════════════
   Tree-scoped router — mounted at /api/trees/:treeId/invitations
   ═══════════════════════════════════════════════════════════════════════ */
const treeRouter = express.Router({ mergeParams: true });

/**
 * POST / — Owner sends an invitation to an email address.
 * Body: { email, role }
 */
treeRouter.post('/', async (req, res) => {
  try {
    const treeId = req.params.treeId;

    // Only owner (or admin) can invite
    if (req.treeRole !== 'owner' && req.treeRole !== 'admin') {
      return res.status(403).json({ error: 'Apenas o proprietário pode enviar convites' });
    }

    const { email, role } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }
    if (!['writer', 'reader'].includes(role)) {
      return res.status(400).json({ error: 'Role deve ser "writer" ou "reader"' });
    }

    const normalEmail = email.toLowerCase().trim();

    // Check if already a member
    const memberCheck = await query(
      `SELECT m.user_id FROM tree_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.tree_id = $1 AND u.email = $2`,
      [treeId, normalEmail],
    );
    if (memberCheck.rows.length) {
      return res.status(409).json({ error: 'Este utilizador já é membro da árvore' });
    }

    // Check if there's already a pending invitation
    const pendingCheck = await query(
      `SELECT id FROM invitations
       WHERE tree_id = $1 AND invitee_email = $2 AND status = 'pending' AND expires_at > NOW()`,
      [treeId, normalEmail],
    );
    if (pendingCheck.rows.length) {
      return res.status(409).json({ error: 'Já existe um convite pendente para este email' });
    }

    // Generate unique token
    const token = crypto.randomBytes(48).toString('base64url');

    // Create invitation
    const { rows } = await query(
      `INSERT INTO invitations (tree_id, inviter_id, invitee_email, role, token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tree_id, inviter_id, invitee_email, role, status, token, created_at, expires_at`,
      [treeId, req.user.id, normalEmail, role, token],
    );
    const invitation = rows[0];

    // Get inviter name and tree name for the email
    const inviterResult = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const treeResult    = await query('SELECT name FROM trees WHERE id = $1', [treeId]);
    const inviterName = (inviterResult.rows[0] || {}).name || req.user.email;
    const treeName    = (treeResult.rows[0] || {}).name || 'Árvore';

    // If invitee already has an account, create an in-app notification
    const inviteeUser = await query('SELECT id FROM users WHERE email = $1', [normalEmail]);
    if (inviteeUser.rows.length) {
      await query(
        `INSERT INTO notifications (user_id, type, data)
         VALUES ($1, 'invitation', $2)`,
        [
          inviteeUser.rows[0].id,
          JSON.stringify({
            invitationId: invitation.id,
            treeId,
            treeName,
            inviterName,
            role,
          }),
        ],
      );
    }

    // Send invitation email (async — don't block the response)
    sendInvitationEmail({
      email: normalEmail,
      inviterName,
      treeName,
      role,
      token,
    }).catch(err => console.error('[email] Erro ao enviar convite:', err.message));

    res.status(201).json({
      id: invitation.id,
      treeId: invitation.tree_id,
      inviteeEmail: invitation.invitee_email,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.created_at,
      expiresAt: invitation.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET / — List invitations for this tree (owner/admin only).
 */
treeRouter.get('/', async (req, res) => {
  try {
    if (req.treeRole !== 'owner' && req.treeRole !== 'admin') {
      return res.status(403).json({ error: 'Apenas o proprietário pode ver os convites' });
    }

    const { rows } = await query(
      `SELECT i.id, i.invitee_email, i.role, i.status, i.created_at, i.expires_at, i.responded_at,
              u.name AS inviter_name
       FROM invitations i
       JOIN users u ON u.id = i.inviter_id
       WHERE i.tree_id = $1
       ORDER BY i.created_at DESC`,
      [req.params.treeId],
    );

    res.json(rows.map(r => ({
      id: r.id,
      inviteeEmail: r.invitee_email,
      role: r.role,
      status: r.status,
      inviterName: r.inviter_name,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      respondedAt: r.responded_at,
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   User-scoped router — mounted at /api/invitations
   ═══════════════════════════════════════════════════════════════════════ */
const userRouter = express.Router();

/**
 * GET / — List pending invitations for the authenticated user.
 */
userRouter.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.tree_id, i.invitee_email, i.role, i.status,
              i.created_at, i.expires_at, i.token,
              t.name AS tree_name,
              u.name AS inviter_name
       FROM invitations i
       JOIN trees t ON t.id = i.tree_id
       JOIN users u ON u.id = i.inviter_id
       WHERE i.invitee_email = $1 AND i.status = 'pending' AND i.expires_at > NOW()
       ORDER BY i.created_at DESC`,
      [req.user.email],
    );

    res.json(rows.map(r => ({
      id: r.id,
      treeId: r.tree_id,
      treeName: r.tree_name,
      inviterName: r.inviter_name,
      role: r.role,
      status: r.status,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /by-token/:token — Public-ish: get invitation details by token.
 * Used by invite.html to display details before login/register.
 * Note: authMiddleware applies to /api/invitations, so user is authenticated.
 */
userRouter.get('/by-token/:token', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.tree_id, i.invitee_email, i.role, i.status,
              i.created_at, i.expires_at,
              t.name AS tree_name,
              u.name AS inviter_name
       FROM invitations i
       JOIN trees t ON t.id = i.tree_id
       JOIN users u ON u.id = i.inviter_id
       WHERE i.token = $1`,
      [req.params.token],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    const inv = rows[0];
    res.json({
      id: inv.id,
      treeId: inv.tree_id,
      treeName: inv.tree_name,
      inviterName: inv.inviter_name,
      inviteeEmail: inv.invitee_email,
      role: inv.role,
      status: inv.status,
      expired: new Date(inv.expires_at) < new Date(),
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /:id/accept — Accept an invitation.
 */
userRouter.post('/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT * FROM invitations WHERE id = $1`,
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    const inv = rows[0];

    // Verify the invitation belongs to this user
    if (inv.invitee_email !== req.user.email) {
      return res.status(403).json({ error: 'Este convite não é para si' });
    }

    if (inv.status !== 'pending') {
      return res.status(400).json({ error: `Convite já foi ${inv.status === 'accepted' ? 'aceite' : inv.status}` });
    }

    if (new Date(inv.expires_at) < new Date()) {
      await query(`UPDATE invitations SET status = 'expired' WHERE id = $1`, [id]);
      return res.status(410).json({ error: 'Convite expirado' });
    }

    // Accept: update invitation + create membership
    await query(
      `UPDATE invitations SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [id],
    );

    await query(
      `INSERT INTO tree_memberships (tree_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (tree_id, user_id)
       DO UPDATE SET role = $3`,
      [inv.tree_id, req.user.id, inv.role],
    );

    // Notify the inviter
    const treeResult = await query('SELECT name FROM trees WHERE id = $1', [inv.tree_id]);
    const treeName   = (treeResult.rows[0] || {}).name || 'Árvore';
    const userName   = req.user.email;

    const userNameResult = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const displayName    = (userNameResult.rows[0] || {}).name || userName;

    await query(
      `INSERT INTO notifications (user_id, type, data)
       VALUES ($1, 'invitation_accepted', $2)`,
      [
        inv.inviter_id,
        JSON.stringify({
          invitationId: inv.id,
          treeId: inv.tree_id,
          treeName,
          acceptedBy: displayName,
        }),
      ],
    );

    res.json({ ok: true, treeId: inv.tree_id, role: inv.role });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /:id/decline — Decline an invitation.
 */
userRouter.post('/:id/decline', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT * FROM invitations WHERE id = $1`,
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    const inv = rows[0];

    if (inv.invitee_email !== req.user.email) {
      return res.status(403).json({ error: 'Este convite não é para si' });
    }

    if (inv.status !== 'pending') {
      return res.status(400).json({ error: `Convite já foi ${inv.status === 'accepted' ? 'aceite' : inv.status}` });
    }

    await query(
      `UPDATE invitations SET status = 'declined', responded_at = NOW() WHERE id = $1`,
      [id],
    );

    // Notify the inviter
    const treeResult = await query('SELECT name FROM trees WHERE id = $1', [inv.tree_id]);
    const treeName   = (treeResult.rows[0] || {}).name || 'Árvore';

    const userNameResult = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const displayName    = (userNameResult.rows[0] || {}).name || req.user.email;

    await query(
      `INSERT INTO notifications (user_id, type, data)
       VALUES ($1, 'invitation_declined', $2)`,
      [
        inv.inviter_id,
        JSON.stringify({
          invitationId: inv.id,
          treeId: inv.tree_id,
          treeName,
          declinedBy: displayName,
        }),
      ],
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Public router — mounted BEFORE authMiddleware for token-based access
   ═══════════════════════════════════════════════════════════════════════ */
const publicRouter = express.Router();

/**
 * GET /api/invitations/accept/:token — Public endpoint: get invitation info.
 * Used by invite.html before the user is logged in.
 */
publicRouter.get('/accept/:token', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.tree_id, i.invitee_email, i.role, i.status,
              i.created_at, i.expires_at,
              t.name AS tree_name,
              u.name AS inviter_name
       FROM invitations i
       JOIN trees t ON t.id = i.tree_id
       JOIN users u ON u.id = i.inviter_id
       WHERE i.token = $1`,
      [req.params.token],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    const inv = rows[0];
    res.json({
      id: inv.id,
      treeId: inv.tree_id,
      treeName: inv.tree_name,
      inviterName: inv.inviter_name,
      inviteeEmail: inv.invitee_email,
      role: inv.role,
      status: inv.status,
      expired: new Date(inv.expires_at) < new Date(),
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = { treeRouter, userRouter, publicRouter };
