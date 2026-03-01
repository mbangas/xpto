/**
 * tests/unit/gedcom-import.test.js
 * Unit tests for GEDCOM 7 import — both the pure parser lib and the API endpoint.
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated env for API tests ──────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-gimp-'));
process.env.DATA_DIR = tmpDir;

const request = require('supertest');
const app     = require('../../server.js');

/* ── Pure lib import (no HTTP) ───────────────────────────────────────── */
const { parseGedcomToJson } = require('../../lib/gedcom-parser');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Sample GEDCOM snippets ──────────────────────────────────────────── */
const MINIMAL_GEDCOM = `0 HEAD
1 GEDC
2 VERS 7.0
1 CHAR UTF-8
0 @I1@ INDI
1 NAME João /Silva/
2 GIVN João
2 SURN Silva
1 SEX M
1 BIRT
2 DATE 15 MAR 1980
2 PLAC Lisboa
0 TRLR`;

const FAMILY_GEDCOM = `0 HEAD
1 GEDC
2 VERS 7.0
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Carlos /Pereira/
2 GIVN Carlos
2 SURN Pereira
1 SEX M
1 FAMS @F1@
0 @I2@ INDI
1 NAME Sofia /Matos/
2 GIVN Sofia
2 SURN Matos
1 SEX F
1 FAMS @F1@
0 @I3@ INDI
1 NAME Ana /Pereira/
2 GIVN Ana
2 SURN Pereira
1 SEX F
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 10 JUN 2005
2 PLAC Coimbra
0 TRLR`;

const MULTI_EVENT_GEDCOM = `0 HEAD
1 GEDC
2 VERS 7.0
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Pedro /Alves/
2 GIVN Pedro
2 SURN Alves
1 SEX M
1 BIRT
2 DATE 1 JAN 1975
2 PLAC Porto
1 BAPM
2 DATE 15 JAN 1975
2 PLAC Porto
1 RETI
2 DATE 1 JAN 2035
1 DEAT
2 DATE 15 MAR 2050
2 PLAC Lisboa
0 TRLR`;

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM Import — lib/gedcom-parser (pure unit)', () => {
  test('parses empty GEDCOM (only HEAD + TRLR) without errors', () => {
    const result = parseGedcomToJson('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 CHAR UTF-8\n0 TRLR');
    expect(result.individuals).toBeDefined();
    expect(result.families).toBeDefined();
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.stats).toBeDefined();
  });

  test('parses a single INDI record correctly', () => {
    const result = parseGedcomToJson(MINIMAL_GEDCOM);
    expect(Object.keys(result.individuals)).toHaveLength(1);
    const indi = result.individuals['I1'];
    expect(indi).toBeDefined();
    expect(indi.type).toBe('INDI');
    expect(indi.names[0].given).toBe('João');
    expect(indi.names[0].surname).toBe('Silva');
    expect(indi.sex).toBe('M');
  });

  test('parses BIRT event with date and place', () => {
    const result = parseGedcomToJson(MINIMAL_GEDCOM);
    const birt = result.individuals['I1'].events.find(e => e.type === 'BIRT');
    expect(birt).toBeDefined();
    expect(birt.date).toBe('15 MAR 1980');
    expect(birt.place).toBe('Lisboa');
  });

  test('parses a FAM record with HUSB, WIFE, CHIL', () => {
    const result = parseGedcomToJson(FAMILY_GEDCOM);
    expect(Object.keys(result.families)).toHaveLength(1);
    const fam = result.families['F1'];
    expect(fam.husb).toBe('I1');
    expect(fam.wife).toBe('I2');
    expect(fam.children).toContain('I3');
  });

  test('cross-links individuals to families on import', () => {
    const result = parseGedcomToJson(FAMILY_GEDCOM);
    // Husband should have fams = ['F1']
    expect(result.individuals['I1'].fams).toContain('F1');
    // Wife should have fams = ['F1']
    expect(result.individuals['I2'].fams).toContain('F1');
    // Child should have famc = 'F1'
    expect(result.individuals['I3'].famc).toBe('F1');
  });

  test('parses FAM marriage event', () => {
    const result = parseGedcomToJson(FAMILY_GEDCOM);
    const marr = result.families['F1'].events.find(e => e.type === 'MARR');
    expect(marr).toBeDefined();
    expect(marr.date).toBe('10 JUN 2005');
    expect(marr.place).toBe('Coimbra');
  });

  test('parses multiple events on same individual', () => {
    const result = parseGedcomToJson(MULTI_EVENT_GEDCOM);
    const indi   = result.individuals['I1'];
    const types  = indi.events.map(e => e.type);
    expect(types).toContain('BIRT');
    expect(types).toContain('BAPM');
    expect(types).toContain('RETI');
    expect(types).toContain('DEAT');
  });

  test('returns stats with correct counts', () => {
    const result = parseGedcomToJson(FAMILY_GEDCOM);
    expect(result.stats.individuals).toBe(3);
    expect(result.stats.families).toBe(1);
  });

  test('emits warning for INDI without a name', () => {
    const gedcom = '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I99@ INDI\n1 SEX M\n0 TRLR';
    const result = parseGedcomToJson(gedcom);
    const warn   = result.warnings.find(w => w.id === 'I99');
    expect(warn).toBeDefined();
    expect(warn.reason).toMatch(/Missing name/i);
  });

  test('parses OCCU attribute', () => {
    const gedcom = `0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Test /Test/\n1 OCCU Carpinteiro\n0 TRLR`;
    const result = parseGedcomToJson(gedcom);
    const occu   = result.individuals['I1'].attributes.find(a => a.type === 'OCCU');
    expect(occu).toBeDefined();
    expect(occu.value).toBe('Carpinteiro');
  });

  test('parses top-level OBJE record to multimedia collection', () => {
    const gedcom = `0 HEAD\n1 CHAR UTF-8\n0 @M1@ OBJE\n1 FILE foto.jpg\n2 FORM image/jpeg\n1 TITL Casamento\n0 TRLR`;
    const result = parseGedcomToJson(gedcom);
    const obje   = result.multimedia['M1'];
    expect(obje).toBeDefined();
    expect(obje.type).toBe('OBJE');
    expect(obje.files[0].file).toBe('foto.jpg');
  });

  test('handles Windows-style CRLF line endings', () => {
    const gedcom = MINIMAL_GEDCOM.replace(/\n/g, '\r\n');
    const result = parseGedcomToJson(gedcom);
    expect(Object.keys(result.individuals)).toHaveLength(1);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM Import — POST /api/gedcom/import (API)', () => {
  test('returns { ok: true } with stats on valid GEDCOM', async () => {
    const res = await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .send(MINIMAL_GEDCOM);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.individuals).toBeGreaterThanOrEqual(1);
  });

  test('imported individuals are retrievable via GET', async () => {
    await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .send(FAMILY_GEDCOM);

    const i1 = (await request(app).get('/api/individuals/I1')).body;
    expect(i1.names[0].given).toBe('Carlos');
    expect(i1.sex).toBe('M');
  });

  test('imported families are retrievable via GET', async () => {
    await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .send(FAMILY_GEDCOM);

    const f1 = (await request(app).get('/api/families/F1')).body;
    expect(f1.husb).toBe('I1');
    expect(f1.wife).toBe('I2');
    expect(f1.children).toContain('I3');
  });

  test('accepts JSON body with { text: <gedcom> }', async () => {
    const res = await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: MINIMAL_GEDCOM }));
    // The mock import handler tries to parse the body as text first,
    // falls back to body.text — both paths should produce ok:true
    expect(res.status).toBe(200);
  });
});
