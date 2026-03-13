/**
 * tests/unit/families.test.js
 * Unit tests for the Families CRUD API (/api/families)
 * Each test run uses an isolated temporary data directory.
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated environment ─────────────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-fam-'));
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
async function createIndi(given, surname, sex = 'M') {
  const res = await request(app).post('/api/individuals').set(AUTH).send({
    names: [{ given, surname, prefix: '', suffix: '', nickname: '', type: 'BIRTH' }],
    sex,
  });
  return res.body.id;
}

/* ══════════════════════════════════════════════════════════════════════ */
describe('Families — CREATE (POST /api/families)', () => {
  test('creates an empty family and returns 201', async () => {
    const res = await request(app).post('/api/families').set(AUTH).send({});
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('FAM');
    expect(res.body.id).toBeTruthy();
    expect(res.body.deletedAt).toBeNull();
  });

  test('creates family with husb and wife', async () => {
    const husbId = await createIndi('Carlos', 'Pereira', 'M');
    const wifeId = await createIndi('Sofia', 'Matos', 'F');

    const res = await request(app).post('/api/families').set(AUTH).send({ husb: husbId, wife: wifeId, children: [] });
    expect(res.status).toBe(201);
    expect(res.body.husb).toBe(husbId);
    expect(res.body.wife).toBe(wifeId);
    expect(res.body.children).toEqual([]);
  });

  test('creates family with marriage event', async () => {
    const res = await request(app).post('/api/families').set(AUTH).send({
      events: [{ type: 'MARR', date: '10 JUN 2005', place: 'Coimbra' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({ type: 'MARR', date: '10 JUN 2005', place: 'Coimbra' });
  });

  test('creates family with children array', async () => {
    const child1 = await createIndi('Filha', 'Uma', 'F');
    const child2 = await createIndi('Filho', 'Dois', 'M');
    const res = await request(app).post('/api/families').set(AUTH).send({ children: [child1, child2] });
    expect(res.status).toBe(201);
    expect(res.body.children).toContain(child1);
    expect(res.body.children).toContain(child2);
  });

  test('auto-generates an id with prefix F', async () => {
    const res = await request(app).post('/api/families').set(AUTH).send({});
    expect(res.body.id).toMatch(/^F\d+$/);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Families — READ', () => {
  let famId;

  beforeAll(async () => {
    const res = await request(app).post('/api/families').set(AUTH).send({
      events: [{ type: 'MARR', date: '1 JAN 2000', place: 'Lisboa' }],
    });
    famId = res.body.id;
  });

  test('GET /api/families returns an array', async () => {
    const res = await request(app).get('/api/families').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/families/:id returns the family', async () => {
    const res = await request(app).get(`/api/families/${famId}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(famId);
    expect(res.body.type).toBe('FAM');
  });

  test('GET /api/families/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/families/XNOTEXIST').set(AUTH);
    expect(res.status).toBe(404);
  });

  test('deleted families are excluded by default', async () => {
    const post = await request(app).post('/api/families').set(AUTH).send({});
    const id   = post.body.id;
    await request(app).delete(`/api/families/${id}`).set(AUTH);

    const list = await request(app).get('/api/families').set(AUTH);
    expect(list.body.map(f => f.id)).not.toContain(id);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Families — UPDATE (PUT /api/families/:id)', () => {
  let famId;

  beforeAll(async () => {
    const res = await request(app).post('/api/families').set(AUTH).send({});
    famId = res.body.id;
  });

  test('updates husb and wife', async () => {
    const h = await createIndi('H', 'One', 'M');
    const w = await createIndi('W', 'One', 'F');
    const res = await request(app).put(`/api/families/${famId}`).set(AUTH).send({ husb: h, wife: w });
    expect(res.status).toBe(200);
    expect(res.body.husb).toBe(h);
    expect(res.body.wife).toBe(w);
  });

  test('adds children to family', async () => {
    const child = await createIndi('Child', 'Test', 'M');
    const current = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const res = await request(app).put(`/api/families/${famId}`).set(AUTH).send({ children: [...(current.children || []), child] });
    expect(res.status).toBe(200);
    expect(res.body.children).toContain(child);
  });

  test('PUT on non-existent id returns 404', async () => {
    const res = await request(app).put('/api/families/NOTFOUND').set(AUTH).send({ husb: 'X' });
    expect(res.status).toBe(404);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Families — DELETE (soft delete)', () => {
  test('DELETE sets deletedAt and returns { ok: true }', async () => {
    const post = await request(app).post('/api/families').set(AUTH).send({});
    const id   = post.body.id;

    const del = await request(app).delete(`/api/families/${id}`).set(AUTH);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const record = (await request(app).get(`/api/families/${id}`).set(AUTH)).body;
    expect(record.deletedAt).toBeTruthy();
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Families — GEDCOM 7 structural compliance', () => {
  test('family record has all required GEDCOM 7 FAM fields', async () => {
    const res = await request(app).post('/api/families').set(AUTH).send({});
    const fam = res.body;
    expect(fam).toHaveProperty('type', 'FAM');
    expect(fam).toHaveProperty('husb');
    expect(fam).toHaveProperty('wife');
    expect(fam).toHaveProperty('children');
    expect(fam).toHaveProperty('events');
    expect(fam).toHaveProperty('notes');
    expect(fam).toHaveProperty('sourceRefs');
    expect(fam).toHaveProperty('multimediaRefs');
    expect(Array.isArray(fam.children)).toBe(true);
    expect(Array.isArray(fam.events)).toBe(true);
  });

  test.each(['MARR', 'DIV', 'ANUL', 'ENGA', 'EVEN'])(
    'accepts GEDCOM 7 family event type: %s', async (evType) => {
      const res = await request(app).post('/api/families').set(AUTH).send({
        events: [{ type: evType, date: '1 JAN 2000', place: 'Porto' }],
      });
      expect(res.status).toBe(201);
      const savedEv = res.body.events.find(e => e.type === evType);
      expect(savedEv).toBeDefined();
    }
  );
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Families — Relationship / kinship (GEDCOM 7)', () => {
  test('spouse relationship: both individuals linked via FAMS to the family', async () => {
    const husbId = await createIndi('Esposo', 'Teste', 'M');
    const wifeId = await createIndi('Esposa', 'Teste', 'F');

    // Create family
    const famRes = await request(app).post('/api/families').set(AUTH).send({ husb: husbId, wife: wifeId, children: [] });
    const famId  = famRes.body.id;

    // Update each individual's fams array (the app doesn't auto cross-link on create, only on GEDCOM import)
    await request(app).put(`/api/individuals/${husbId}`).set(AUTH).send({ fams: [famId] });
    await request(app).put(`/api/individuals/${wifeId}`).set(AUTH).send({ fams: [famId] });

    const fam  = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const husb = (await request(app).get(`/api/individuals/${husbId}`).set(AUTH)).body;
    const wife = (await request(app).get(`/api/individuals/${wifeId}`).set(AUTH)).body;

    // GEDCOM 7: FAM has HUSB and WIFE pointers
    expect(fam.husb).toBe(husbId);
    expect(fam.wife).toBe(wifeId);
    // GEDCOM 7: each spouse has FAMS pointer back to FAM
    expect(husb.fams).toContain(famId);
    expect(wife.fams).toContain(famId);
  });

  test('parent-child: child has FAMC and family has CHIL pointer', async () => {
    const parentId = await createIndi('Pai', 'Teste', 'M');
    const childId  = await createIndi('Filho', 'Teste', 'M');

    const famRes = await request(app).post('/api/families').set(AUTH).send({ husb: parentId, wife: null, children: [childId] });
    const famId  = famRes.body.id;

    // Update child to set famc
    await request(app).put(`/api/individuals/${childId}`).set(AUTH).send({ famc: famId });

    const fam   = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const child = (await request(app).get(`/api/individuals/${childId}`).set(AUTH)).body;

    // GEDCOM 7: FAM has CHIL pointer
    expect(fam.children).toContain(childId);
    // GEDCOM 7: child INDI has FAMC pointer back to FAM
    expect(child.famc).toBe(famId);
  });

  test('sibling relationship: siblings share the same FAMC family', async () => {
    const sib1 = await createIndi('Irmão1', 'Teste', 'M');
    const sib2 = await createIndi('Irmã2', 'Teste', 'F');
    const sib3 = await createIndi('Irmão3', 'Teste', 'M');

    const famRes = await request(app).post('/api/families').set(AUTH).send({ children: [sib1, sib2, sib3] });
    const famId  = famRes.body.id;

    await request(app).put(`/api/individuals/${sib1}`).set(AUTH).send({ famc: famId });
    await request(app).put(`/api/individuals/${sib2}`).set(AUTH).send({ famc: famId });
    await request(app).put(`/api/individuals/${sib3}`).set(AUTH).send({ famc: famId });

    const fam = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const s1  = (await request(app).get(`/api/individuals/${sib1}`).set(AUTH)).body;
    const s2  = (await request(app).get(`/api/individuals/${sib2}`).set(AUTH)).body;
    const s3  = (await request(app).get(`/api/individuals/${sib3}`).set(AUTH)).body;

    // All siblings share the same FAMC family
    expect(s1.famc).toBe(famId);
    expect(s2.famc).toBe(famId);
    expect(s3.famc).toBe(famId);
    expect(fam.children).toContain(sib1);
    expect(fam.children).toContain(sib2);
    expect(fam.children).toContain(sib3);
  });

  test('grandparent relationship: two-generation FAM chain', async () => {
    // Generation 1: grandparents → parent
    const gpFatherId = await createIndi('Avô', 'Teste', 'M');
    const gpMotherId = await createIndi('Avó', 'Teste', 'F');
    const parentId   = await createIndi('Pai', 'Teste', 'M');

    const gpFamRes = await request(app).post('/api/families').set(AUTH).send({ husb: gpFatherId, wife: gpMotherId, children: [parentId] });
    const gpFamId  = gpFamRes.body.id;
    await request(app).put(`/api/individuals/${parentId}`).set(AUTH).send({ famc: gpFamId });

    // Generation 2: parent → child
    const childId   = await createIndi('Neto', 'Teste', 'M');
    const parentFam = await request(app).post('/api/families').set(AUTH).send({ husb: parentId, children: [childId] });
    const parentFamId = parentFam.body.id;
    await request(app).put(`/api/individuals/${parentId}`).set(AUTH).send({ fams: [parentFamId] });
    await request(app).put(`/api/individuals/${childId}`).set(AUTH).send({ famc: parentFamId });

    const child  = (await request(app).get(`/api/individuals/${childId}`).set(AUTH)).body;
    const parent = (await request(app).get(`/api/individuals/${parentId}`).set(AUTH)).body;

    // Child knows its family of origin
    expect(child.famc).toBe(parentFamId);
    // Parent is a child in grandparent family and head of own family
    expect(parent.famc).toBe(gpFamId);
    expect(parent.fams).toContain(parentFamId);
  });
});
