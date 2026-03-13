/**
 * lib/tree-auth.js — Tree-scoped authorisation middleware for myLineage.
 *
 * Verifies that the authenticated user has access to the tree identified
 * by `req.params.treeId`, and attaches `req.treeId` and `req.treeRole`
 * to the request object.
 *
 * Must be mounted AFTER authMiddleware so that `req.user` is available.
 */

'use strict';

/**
 * Express middleware — resolves treeId from route params, verifies
 * membership, and attaches `req.treeId` + `req.treeRole`.
 *
 * Admins bypass the membership check and get treeRole = 'admin'.
 */
function treeAuthMiddleware(req, res, next) {
  const treeId = req.params.treeId;
  if (!treeId) {
    return res.status(400).json({ error: 'treeId em falta' });
  }

  // Admins always have access
  if (req.user.isAdmin) {
    req.treeId   = treeId;
    req.treeRole = 'admin';
    return next();
  }

  const { query } = require('./db');
  query('SELECT role FROM tree_memberships WHERE tree_id = $1 AND user_id = $2', [treeId, req.user.id])
    .then(({ rows }) => {
      if (!rows.length) {
        return res.status(403).json({ error: 'Sem acesso a esta árvore' });
      }
      req.treeId   = treeId;
      req.treeRole = rows[0].role;
      next();
    })
    .catch(err => res.status(500).json({ error: String(err) }));
}

/**
 * Middleware factory — requires one of the listed roles.
 * Must be used AFTER treeAuthMiddleware.
 * Admin role always passes.
 *
 * @param  {...string} roles  e.g. 'owner', 'writer'
 */
function requireTreeRole(...roles) {
  return (req, res, next) => {
    if (req.treeRole === 'admin') return next();
    if (!roles.includes(req.treeRole)) {
      return res.status(403).json({ error: 'Permissão insuficiente nesta árvore' });
    }
    next();
  };
}

module.exports = { treeAuthMiddleware, requireTreeRole };
