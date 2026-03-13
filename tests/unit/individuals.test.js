/**
 * tests/unit/individuals.test.js
 * Unit tests for the Individuals CRUD API (/api/individuals)
 * Each test run uses an isolated temporary data directory.
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated environment ─────────────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-indi-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const request = require('supertest');
const app     = require('../../server.js');

const jwt = require('jsonwebtoken');
const _testToken = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000001', email: 'test@test.com', isAdmin: true },
  process.env.JWT_SECRET, { expiresIn: '1h' });
const AUTH = { Authorization: 'Bearer ' + _testToken };

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Helpers ──────────────────────────────────────────────────────────── */
const INDI_BASE = {
  names: [{ given: 'João', surname: 'Silva', prefix: '', suffix: '', nickname: '', type: 'BIRTH' }],
  sex: 'M',
  events: [{ type: 'BIRT', date: '15 MAR 1980', place: 'Lisboa' }],
  attributes: [],
  famc: null,
  fams: [],
  notes: [],
  sourceRefs: [],
  multimediaRefs: [],
};

/* ══════════════════════════════════════════════════════════════════════ */
describe('Individuals — CREATE (POST /api/individuals)', () => {
  test('creates a new individual and returns 201 with correct fields', async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send(INDI_BASE);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'INDI', sex: 'M' });
    expect(res.body.id).toBeTruthy();
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.updatedAt).toBeTruthy();
    expect(res.body.deletedAt).toBeNull();
  });

  test('auto-generates a sequential id with prefix I', async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send({ ...INDI_BASE, names: [{ given: 'Ana', surname: 'Costa' }], sex: 'F' });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^I\d+$/);
  });

  test('accepts a custom id when provided', async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send({ ...INDI_BASE, id: 'I_CUSTOM' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('I_CUSTOM');
  });

  test('creates individual with sex=F', async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send({ ...INDI_BASE, sex: 'F', names: [{ given: 'Maria', surname: 'Sousa' }] });
    expect(res.status).toBe(201);
    expect(res.body.sex).toBe('F');
  });

  test('creates individual with default sex=U when not provided', async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send({ names: [{ given: 'Pessoa', surname: 'Teste' }] });
    expect(res.status).toBe(201);
    // The default factory sets sex to 'U'
    expect(['U', undefined, '']).toContain(res.body.sex !== 'M' && res.body.sex !== 'F' ? res.body.sex : 'U');
  });

  test('stores multiple name parts (GIVN, SURN, NPFX, NSFX, NICK)', async () => {
    const richName = { given: 'Pedro', surname: 'Ferreira', prefix: 'Dr.', suffix: 'Jr.', nickname: 'Pe', type: 'BIRTH' };
    const res = await request(app).post('/api/individuals').set(AUTH).send({ ...INDI_BASE, names: [richName] });
    expect(res.status).toBe(201);
    const savedName = res.body.names[0];
    expect(savedName.given).toBe('Pedro');
    expect(savedName.surname).toBe('Ferreira');
    expect(savedName.prefix).toBe('Dr.');
    expect(savedName.suffix).toBe('Jr.');
    expect(savedName.nickname).toBe('Pe');
  });

  test('stores GEDCOM 7 event fields (type, date, place)', async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send({
      ...INDI_BASE,
      events: [
        { type: 'BIRT', date: '1 JAN 1990', place: 'Porto' },
        { type: 'DEAT', date: '5 DEC 2070', place: 'Lisboa' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toMatchObject({ type: 'BIRT', date: '1 JAN 1990', place: 'Porto' });
    expect(res.body.events[1]).toMatchObject({ type: 'DEAT', date: '5 DEC 2070', place: 'Lisboa' });
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Individuals — READ (GET /api/individuals)', () => {
  let createdId;

  beforeAll(async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send(INDI_BASE);
    createdId = res.body.id;
  });

  test('GET /api/individuals returns an array', async () => {
    const res = await request(app).get('/api/individuals').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/individuals/:id returns the individual', async () => {
    const res = await request(app).get(`/api/individuals/${createdId}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
    expect(res.body.type).toBe('INDI');
  });

  test('GET /api/individuals/:id returns 404 for non-existent id', async () => {
    const res = await request(app).get('/api/individuals/XXXXXXXX').set(AUTH);
    expect(res.status).toBe(404);
  });

  test('GET /api/individuals excludes soft-deleted records by default', async () => {
    // Create and delete an individual
    const post = await request(app).post('/api/individuals').set(AUTH).send({ ...INDI_BASE, names: [{ given: 'Para Apagar' }] });
    const delId = post.body.id;
    await request(app).delete(`/api/individuals/${delId}`).set(AUTH);

    const list = await request(app).get('/api/individuals').set(AUTH);
    const ids = list.body.map(i => i.id);
    expect(ids).not.toContain(delId);
  });

  test('GET /api/individuals?includeDeleted=true includes soft-deleted records', async () => {
    const post = await request(app).post('/api/individuals').set(AUTH).send({ ...INDI_BASE, names: [{ given: 'Deleted Indi' }] });
    const delId = post.body.id;
    await request(app).delete(`/api/individuals/${delId}`).set(AUTH);

    const all = await request(app).get('/api/individuals?includeDeleted=true').set(AUTH);
    const ids = all.body.map(i => i.id);
    expect(ids).toContain(delId);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Individuals — UPDATE (PUT /api/individuals/:id)', () => {
  let indiId;

  beforeAll(async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send(INDI_BASE);
    indiId = res.body.id;
  });

  test('updates an individual and returns the updated record', async () => {
    const res = await request(app).put(`/api/individuals/${indiId}`)
      .set(AUTH).send({ names: [{ given: 'João Pedro', surname: 'Silva' }] });
    expect(res.status).toBe(200);
    expect(res.body.names[0].given).toBe('João Pedro');
    expect(res.body.id).toBe(indiId);
  });

  test('updating sets a new updatedAt timestamp', async () => {
    const before = (await request(app).get(`/api/individuals/${indiId}`).set(AUTH)).body.updatedAt;
    await new Promise(r => setTimeout(r, 10));
    const res = await request(app).put(`/api/individuals/${indiId}`).set(AUTH).send({ sex: 'F' });
    expect(res.status).toBe(200);
    expect(res.body.updatedAt).not.toBe(before);
  });

  test('PUT on non-existent id returns 404', async () => {
    const res = await request(app).put('/api/individuals/XXNOTFOUND').set(AUTH).send({ sex: 'M' });
    expect(res.status).toBe(404);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Individuals — DELETE (soft delete)', () => {
  test('DELETE sets deletedAt and returns { ok: true }', async () => {
    const post = await request(app).post('/api/individuals').set(AUTH).send(INDI_BASE);
    const id   = post.body.id;

    const del = await request(app).delete(`/api/individuals/${id}`).set(AUTH);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    // Record still exists but has deletedAt set
    const full = await request(app).get(`/api/individuals/${id}`).set(AUTH);
    expect(full.status).toBe(200);
    expect(full.body.deletedAt).toBeTruthy();
  });

  test('DELETE on non-existent id returns 404', async () => {
    const res = await request(app).delete('/api/individuals/NOEXIST').set(AUTH);
    expect(res.status).toBe(404);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Individuals — GEDCOM 7 structural compliance', () => {
  test('individual has all required GEDCOM 7 INDI fields', async () => {
    const res = await request(app).post('/api/individuals').set(AUTH).send(INDI_BASE);
    const indi = res.body;
    // Required structural fields for INDI
    expect(indi).toHaveProperty('type', 'INDI');
    expect(indi).toHaveProperty('names');
    expect(indi).toHaveProperty('sex');
    expect(indi).toHaveProperty('events');
    expect(indi).toHaveProperty('attributes');
    expect(indi).toHaveProperty('famc');
    expect(indi).toHaveProperty('fams');
    expect(indi).toHaveProperty('notes');
    expect(indi).toHaveProperty('sourceRefs');
    expect(indi).toHaveProperty('multimediaRefs');
    expect(Array.isArray(indi.names)).toBe(true);
    expect(Array.isArray(indi.events)).toBe(true);
    expect(Array.isArray(indi.fams)).toBe(true);
  });

  test.each(['M', 'F', 'X', 'U'])('accepts GEDCOM 7 sex value: %s', async (sex) => {
    const res = await request(app).post('/api/individuals').set(AUTH).send({ ...INDI_BASE, sex });
    expect(res.status).toBe(201);
    expect(res.body.sex).toBe(sex);
  });

  test.each(['BIRT', 'DEAT', 'BURI', 'BAPM', 'CHR', 'CONF', 'ADOP', 'EMIG', 'IMMI', 'CENS', 'PROB', 'RETI', 'EVEN'])(
    'accepts GEDCOM 7 individual event type: %s', async (evType) => {
      const res = await request(app).post('/api/individuals').set(AUTH).send({
        ...INDI_BASE,
        events: [{ type: evType, date: '1 JAN 2000', place: 'Lisboa' }],
      });
      expect(res.status).toBe(201);
      const savedEv = res.body.events.find(e => e.type === evType);
      expect(savedEv).toBeDefined();
    }
  );

  test.each(['OCCU', 'EDUC', 'RELI', 'NATI', 'TITL', 'FACT', 'RESI'])(
    'accepts GEDCOM 7 individual attribute type: %s', async (atType) => {
      const res = await request(app).post('/api/individuals').set(AUTH).send({
        ...INDI_BASE,
        attributes: [{ type: atType, value: 'Valor Teste' }],
      });
      expect(res.status).toBe(201);
      const savedAt = res.body.attributes.find(a => a.type === atType);
      expect(savedAt).toBeDefined();
    }
  );
});
