/**
 * tests/integration/trees-flow.test.js
 * Integration tests for tree management and access control (Phase 3+4).
 *
 * Scenarios tested:
 *  1. Create a tree
 *  2. List trees (user sees only their trees)
 *  3. Get single tree details
 *  4. Update tree name/description
 *  5. Tree-scoped data isolation
 *  6. Legacy backward-compat routes still work
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated environment ─────────────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-trees-test-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-trees-secret';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

Object.keys(require.cache).forEach(k => {
  if (k.includes('myLineage')) delete require.cache[k];
});

const app = require('../../server.js');

// Admin token for tree operations
const adminToken = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000001', email: 'admin@test.local', isAdmin: true },
  process.env.JWT_SECRET, { expiresIn: '1h' },
);
const AUTH = { Authorization: 'Bearer ' + adminToken };

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Helpers ──────────────────────────────────────────────────────────── */
let createdTreeId = '';

/* ══════════════════════════════════════════════════════════════════════ */
describe('Trees — CRUD', () => {

  test('POST /api/trees creates a new tree', async () => {
    const res = await request(app)
      .post('/api/trees')
      .set(AUTH)
      .send({ name: 'Família Teste', description: 'Árvore de testes' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Família Teste');
    createdTreeId = res.body.id;
  });

  test('GET /api/trees lists trees for user', async () => {
    const res = await request(app)
      .get('/api/trees')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Admin sees all trees including legacy
    const found = res.body.find(t => t.id === createdTreeId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Família Teste');
  });

  test('GET /api/trees/:id returns tree details', async () => {
    const res = await request(app)
      .get('/api/trees/' + createdTreeId)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Família Teste');
    expect(res.body.description).toBe('Árvore de testes');
  });

  test('PUT /api/trees/:id updates tree', async () => {
    const res = await request(app)
      .put('/api/trees/' + createdTreeId)
      .set(AUTH)
      .send({ name: 'Família Silva', description: 'Atualizada' });

    expect(res.status).toBe(200);

    const get = await request(app).get('/api/trees/' + createdTreeId).set(AUTH);
    expect(get.body.name).toBe('Família Silva');
    expect(get.body.description).toBe('Atualizada');
  });
});

describe('Trees — Tree-scoped genealogy', () => {

  test('POST individual to a tree', async () => {
    const res = await request(app)
      .post('/api/trees/' + createdTreeId + '/individuals')
      .set(AUTH)
      .send({
        names: [{ given: 'Maria', surname: 'Silva' }],
        sex: 'F',
        events: [{ type: 'BIRT', date: '3 MAR 1985' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.names[0].given).toBe('Maria');
  });

  test('GET individuals from a tree returns only that tree\'s data', async () => {
    const res = await request(app)
      .get('/api/trees/' + createdTreeId + '/individuals')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].names[0].given).toBe('Maria');
  });

  test('GET stats for a tree', async () => {
    const res = await request(app)
      .get('/api/trees/' + createdTreeId + '/stats')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.individuals).toBe(1);
  });
});

describe('Trees — Legacy backward-compat', () => {

  test('Legacy /api/individuals route still works', async () => {
    const res = await request(app)
      .get('/api/individuals')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Legacy /api/stats route still works', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('individuals');
  });
});
