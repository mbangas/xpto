/**
 * server.js — myLineage GEDCOM 7 Server
 * RESTful APIs for GEDCOM 7 entities stored as JSON in JSON-DATA/
 *
 * Route layout (Phase 3 — Multi-Tree):
 *   /api/auth/*                       — public auth routes
 *   /api/trees/*                      — tree management (authed)
 *   /api/trees/:treeId/*              — tree-scoped genealogy (authed + tree membership)
 *   /api/*  (legacy)                  — redirects to /api/trees/LEGACY_TREE_ID/* for backward-compat
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const { LEGACY_TREE_ID }       = require('./lib/crud-helpers');
const { authMiddleware }       = require('./lib/auth-middleware');
const { treeAuthMiddleware }   = require('./lib/tree-auth');
const authRoutes               = require('./routes/auth');
const treesRouter              = require('./routes/trees');
const genealogyRouter          = require('./routes/genealogy');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname), { etag: false, lastModified: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate') }));

/* ── Auth routes (public — no authMiddleware) ────────────────────────── */
app.use('/api/auth', authRoutes);

/* ── Protect all other /api/* routes ─────────────────────────────────── */
app.use('/api', authMiddleware);

/* ── Trees management API ────────────────────────────────────────────── */
app.use('/api/trees', treesRouter);

/* ── Tree-scoped genealogy routes ────────────────────────────────────── */
app.use('/api/trees/:treeId', treeAuthMiddleware, genealogyRouter);

/* ── Per-tree static uploads ─────────────────────────────────────────── */
app.use('/uploads/:treeId', (req, res, next) => {
  // Serve files from uploads/<treeId>/ directory
  const treeDir = path.join(__dirname, 'uploads', req.params.treeId);
  express.static(treeDir)(req, res, next);
});

/* ── Legacy backward-compat routes (/api/* → /api/trees/LEGACY_TREE_ID/*) ── */
const LEGACY_COLLECTIONS = [
  'individuals', 'families', 'sources', 'repositories',
  'multimedia', 'notes', 'submitters', 'historical-facts',
];

// Entity CRUD: GET/POST /api/:collection, GET/PUT/DELETE /api/:collection/:id
LEGACY_COLLECTIONS.forEach(col => {
  app.all('/api/' + col, (req, res) => {
    req.url = '/' + col + (req._parsedUrl.search || '');
    req.treeId   = LEGACY_TREE_ID;
    req.treeRole = req.user.isAdmin ? 'admin' : 'owner';
    genealogyRouter(req, res, () => res.status(404).json({ error: 'Not found' }));
  });
  app.all('/api/' + col + '/:id', (req, res) => {
    req.url = '/' + col + '/' + req.params.id + (req._parsedUrl.search || '');
    req.treeId   = LEGACY_TREE_ID;
    req.treeRole = req.user.isAdmin ? 'admin' : 'owner';
    genealogyRouter(req, res, () => res.status(404).json({ error: 'Not found' }));
  });
});

// Other legacy endpoints
['bulk-replace', 'header', 'settings', 'history', 'stats',
 'gedcom/export', 'gedcom/import', 'topola-json',
 'multimedia/cache-status', 'multimedia/refresh-zones'].forEach(ep => {
  app.all('/api/' + ep, (req, res) => {
    req.url = '/' + ep + (req._parsedUrl.search || '');
    req.treeId   = LEGACY_TREE_ID;
    req.treeRole = req.user.isAdmin ? 'admin' : 'owner';
    genealogyRouter(req, res, () => res.status(404).json({ error: 'Not found' }));
  });
});

// Legacy surname-research
app.get('/api/surname-research/:surname', (req, res) => {
  req.url = '/surname-research/' + encodeURIComponent(req.params.surname);
  req.treeId   = LEGACY_TREE_ID;
  req.treeRole = req.user.isAdmin ? 'admin' : 'owner';
  genealogyRouter(req, res, () => res.status(404).json({ error: 'Not found' }));
});

/* ── Seed admin user from environment variables ─────────────────────── */
async function seedAdminUser() {
  if (!process.env.DATABASE_URL || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  try {
    const { query } = require('./lib/db');
    const { hashPassword } = require('./lib/auth-middleware');
    const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return;
    const hash = await hashPassword(process.env.ADMIN_PASSWORD);
    await query(
      `INSERT INTO users (email, password_hash, name, is_admin)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [email, hash, 'Admin'],
    );
    console.log(`[auth] Admin user seeded: ${email}`);
  } catch (e) { console.error('Aviso: não foi possível criar admin:', e.message); }
}

/* ── Start ───────────────────────────────────────────────────────────── */
if (require.main === module) {
  (async () => {
    // If DATABASE_URL is set, initialise the pool and run pending migrations
    if (process.env.DATABASE_URL) {
      const { getPool, closePool } = require('./lib/db');
      const { up } = require('./migrations/run');
      const pool = getPool();
      await up(pool);
      console.log('[db] PostgreSQL ready');
      await seedAdminUser();

      // Graceful shutdown
      const shutdown = async () => {
        console.log('[db] Closing pool...');
        await closePool();
        process.exit(0);
      };
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    }

    app.listen(PORT, () => { console.log(`myLineage GEDCOM 7 server on http://localhost:${PORT}`); });
  })().catch(err => { console.error('Startup failed:', err); process.exit(1); });
}

module.exports = app;
