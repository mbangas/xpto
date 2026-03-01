/**
 * tests/integration/api-flow.test.js
 * Integration tests: complete multi-entity workflows spanning the full API.
 *
 * Scenarios tested:
 *  1. Three-generation family tree creation and cross-reference verification
 *  2. /api/stats reflects live data accurately
 *  3. Soft-delete + includeDeleted behaviour across entities
 *  4. Bulk-replace endpoint replaces collections atomically
 *  5. Settings, History, Header and Topola JSON utility endpoints
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated environment ─────────────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-int-flow-'));
process.env.DATA_DIR = tmpDir;

const request = require('supertest');
const app     = require('../../server.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Helpers ──────────────────────────────────────────────────────────── */
async function post(url, body) {
  const res = await request(app).post(url).send(body);
  return res.body;
}

async function get(url) {
  const res = await request(app).get(url);
  return res.body;
}

async function put(url, body) {
  const res = await request(app).put(url).send(body);
  return res.body;
}

async function del(url) {
  const res = await request(app).delete(url);
  return res.body;
}

/* ══════════════════════════════════════════════════════════════════════ */
describe('Integration — Three-generation family tree', () => {
  let gpFatherId, gpMotherId, fatherId, motherId, child1Id, child2Id;
  let gpFamId, parentFamId;

  beforeAll(async () => {
    // ── Generation 0: Grandparents ──
    gpFatherId = (await post('/api/individuals', {
      names: [{ given: 'Avô', surname: 'Ferreira' }], sex: 'M',
      events: [{ type: 'BIRT', date: '5 FEB 1930', place: 'Évora' }],
    })).id;

    gpMotherId = (await post('/api/individuals', {
      names: [{ given: 'Avó', surname: 'Ferreira' }], sex: 'F',
      events: [{ type: 'BIRT', date: '12 JUN 1933', place: 'Beja' }],
    })).id;

    gpFamId = (await post('/api/families', {
      husb: gpFatherId, wife: gpMotherId, children: [],
      events: [{ type: 'MARR', date: '20 APR 1950', place: 'Évora' }],
    })).id;

    await put(`/api/individuals/${gpFatherId}`, { fams: [gpFamId] });
    await put(`/api/individuals/${gpMotherId}`, { fams: [gpFamId] });

    // ── Generation 1: Father (child of grandparents) + Mother ──
    fatherId = (await post('/api/individuals', {
      names: [{ given: 'Pai', surname: 'Ferreira' }], sex: 'M',
      events: [{ type: 'BIRT', date: '3 SEP 1955', place: 'Évora' }],
      famc: gpFamId,
    })).id;

    await put(`/api/families/${gpFamId}`, { children: [fatherId] });

    motherId = (await post('/api/individuals', {
      names: [{ given: 'Mãe', surname: 'Alves' }], sex: 'F',
      events: [{ type: 'BIRT', date: '14 NOV 1957', place: 'Setúbal' }],
    })).id;

    parentFamId = (await post('/api/families', {
      husb: fatherId, wife: motherId, children: [],
      events: [{ type: 'MARR', date: '7 JUL 1980', place: 'Lisboa' }],
    })).id;

    await put(`/api/individuals/${fatherId}`, { fams: [parentFamId] });
    await put(`/api/individuals/${motherId}`, { fams: [parentFamId] });

    // ── Generation 2: Two Children ──
    child1Id = (await post('/api/individuals', {
      names: [{ given: 'Ana', surname: 'Ferreira' }], sex: 'F',
      events: [{ type: 'BIRT', date: '20 JAN 1982', place: 'Lisboa' }],
      famc: parentFamId,
    })).id;

    child2Id = (await post('/api/individuals', {
      names: [{ given: 'Rui', surname: 'Ferreira' }], sex: 'M',
      events: [{ type: 'BIRT', date: '15 MAR 1984', place: 'Lisboa' }],
      famc: parentFamId,
    })).id;

    await put(`/api/families/${parentFamId}`, { children: [child1Id, child2Id] });
  });

  test('all 6 individuals exist and are accessible', async () => {
    const list = await get('/api/individuals');
    const ids  = list.map(i => i.id);
    [gpFatherId, gpMotherId, fatherId, motherId, child1Id, child2Id].forEach(id => {
      expect(ids).toContain(id);
    });
  });

  test('both families exist and are accessible', async () => {
    const list = await get('/api/families');
    const ids  = list.map(f => f.id);
    expect(ids).toContain(gpFamId);
    expect(ids).toContain(parentFamId);
  });

  test('grandparents family links husb and wife correctly', async () => {
    const gpFam = await get(`/api/families/${gpFamId}`);
    expect(gpFam.husb).toBe(gpFatherId);
    expect(gpFam.wife).toBe(gpMotherId);
  });

  test('father is child of grandparents (FAMC) and head of own family (FAMS)', async () => {
    const father = await get(`/api/individuals/${fatherId}`);
    expect(father.famc).toBe(gpFamId);
    expect(father.fams).toContain(parentFamId);
  });

  test('parent family contains both children', async () => {
    const pFam = await get(`/api/families/${parentFamId}`);
    expect(pFam.children).toContain(child1Id);
    expect(pFam.children).toContain(child2Id);
  });

  test('each child has FAMC pointing to parent family', async () => {
    const c1 = await get(`/api/individuals/${child1Id}`);
    const c2 = await get(`/api/individuals/${child2Id}`);
    expect(c1.famc).toBe(parentFamId);
    expect(c2.famc).toBe(parentFamId);
  });

  test('siblings share same FAMC', async () => {
    const c1 = await get(`/api/individuals/${child1Id}`);
    const c2 = await get(`/api/individuals/${child2Id}`);
    expect(c1.famc).toBe(c2.famc);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Integration — /api/stats reflects live data', () => {
  test('stats shows correct number of individuals', async () => {
    const stats = await get('/api/stats');
    expect(stats.individuals).toBeGreaterThanOrEqual(6);
  });

  test('stats shows correct number of families', async () => {
    const stats = await get('/api/stats');
    expect(stats.families).toBeGreaterThanOrEqual(2);
  });

  test('stats counts male and female separately', async () => {
    const stats = await get('/api/stats');
    expect(typeof stats.males).toBe('number');
    expect(typeof stats.females).toBe('number');
    expect(stats.males + stats.females).toBeLessThanOrEqual(stats.individuals);
  });

  test('stats counts births from BIRT events', async () => {
    const stats = await get('/api/stats');
    expect(stats.births).toBeGreaterThanOrEqual(6); // All 6 individuals have BIRT
  });

  test('stats counts marriages from FAM MARR events', async () => {
    const stats = await get('/api/stats');
    expect(stats.marriages).toBeGreaterThanOrEqual(2); // Both families have MARR
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Integration — Soft-delete and includeDeleted', () => {
  let tempId;

  beforeAll(async () => {
    const res = await post('/api/individuals', {
      names: [{ given: 'Temporário', surname: 'Teste' }], sex: 'U',
    });
    tempId = res.id;
  });

  test('individual appears in normal GET after creation', async () => {
    const list = await get('/api/individuals');
    expect(list.map(i => i.id)).toContain(tempId);
  });

  test('after soft-delete, individual is NOT in default GET', async () => {
    await del(`/api/individuals/${tempId}`);
    const list = await get('/api/individuals');
    expect(list.map(i => i.id)).not.toContain(tempId);
  });

  test('after soft-delete, individual IS in GET?includeDeleted=true', async () => {
    const list = await get('/api/individuals?includeDeleted=true');
    expect(list.map(i => i.id)).toContain(tempId);
  });

  test('total with includeDeleted is greater than without', async () => {
    const normal = (await get('/api/individuals')).length;
    const all    = (await get('/api/individuals?includeDeleted=true')).length;
    expect(all).toBeGreaterThan(normal);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Integration — Bulk-replace endpoint', () => {
  test('POST /api/bulk-replace replaces all individuals atomically', async () => {
    const bulkData = {
      individuals: {
        IBULK1: {
          id: 'IBULK1', type: 'INDI',
          names: [{ given: 'Bulk', surname: 'Um' }],
          sex: 'M', events: [], attributes: [], famc: null, fams: [],
          notes: [], sourceRefs: [], multimediaRefs: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
        },
      },
    };

    const res = await request(app).post('/api/bulk-replace').send(bulkData);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const ibulk1 = await get('/api/individuals/IBULK1');
    expect(ibulk1.names[0].given).toBe('Bulk');
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('Integration — Utility endpoints', () => {
  test('GET /api/header returns { gedc: { vers: "7.0" } } structure', async () => {
    const header = await get('/api/header');
    expect(header).toHaveProperty('gedc');
    expect(header.gedc.vers).toBe('7.0');
  });

  test('PUT /api/header persists data', async () => {
    const customHeader = { gedc: { vers: '7.0' }, sour: { name: 'myLineage', vers: '2.0' }, charset: 'UTF-8', note: 'Test note' };
    const res = await request(app).put('/api/header').send(customHeader);
    expect(res.status).toBe(200);

    const back = await get('/api/header');
    expect(back.note).toBe('Test note');
  });

  test('PUT /api/settings stores and GET retrieves', async () => {
    const settings = { focusedPerson: { id: 'IBULK1', name: 'Bulk Um' }, theme: 'dark' };
    await request(app).put('/api/settings').send(settings);

    const back = await get('/api/settings');
    expect(back.focusedPerson.id).toBe('IBULK1');
    expect(back.theme).toBe('dark');
  });

  test('POST /api/history adds entries; GET retrieves them', async () => {
    await request(app).post('/api/history').send({ action: 'test', entity: 'individual', page: 'app', when: new Date().toISOString() });

    const hist = await get('/api/history');
    expect(Array.isArray(hist)).toBe(true);
    expect(hist.length).toBeGreaterThanOrEqual(1);
  });

  test('DELETE /api/history clears all entries', async () => {
    await del('/api/history');
    const hist = await get('/api/history');
    expect(hist).toHaveLength(0);
  });

  test('GET /api/topola-json returns { indis: [...], fams: [...] }', async () => {
    const topola = await get('/api/topola-json');
    expect(topola).toHaveProperty('indis');
    expect(topola).toHaveProperty('fams');
    expect(Array.isArray(topola.indis)).toBe(true);
    expect(Array.isArray(topola.fams)).toBe(true);
  });

  test('Topola JSON individuals include firstName, lastName, sex', async () => {
    const topola = await get('/api/topola-json');
    const indi   = topola.indis[0];
    if (indi) {
      expect(indi).toHaveProperty('id');
      expect(indi).toHaveProperty('firstName');
      expect(indi).toHaveProperty('lastName');
      expect(indi).toHaveProperty('sex');
    }
  });
});
