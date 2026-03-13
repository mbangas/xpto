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
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const request = require('supertest');
const app     = require('../../server.js');

const jwt = require('jsonwebtoken');
const _testToken = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000001', email: 'test@test.com', isAdmin: true },
  process.env.JWT_SECRET, { expiresIn: '1h' });
const AUTH = { Authorization: 'Bearer ' + _testToken };

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

  test('parses inline OBJE with _POSITION and photo metadata', () => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      '0 @I1@ INDI', '1 NAME Test /Test/',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE https://example.com/cutout.jpg',
      '2 TITL Test cutout',
      '2 _PRIM Y',
      '2 _CUTOUT Y',
      '2 _PARENTRIN MH:P100',
      '2 _PERSONALPHOTO Y',
      '2 _PHOTO_RIN MH:P101',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE https://example.com/group.jpg',
      '2 TITL Group photo',
      '2 _PRIM_CUTOUT Y',
      '2 _PARENTPHOTO Y',
      '2 _POSITION 26 58 230 330',
      '2 _PHOTO_RIN MH:P100',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE https://example.com/other-group.jpg',
      '2 _POSITION 541 380 631 486',
      '2 _PHOTO_RIN MH:P200',
      '0 TRLR',
    ].join('\n');
    const result = parseGedcomToJson(gedcom);
    const indi   = result.individuals['I1'];
    expect(indi.multimediaRefs).toHaveLength(3);

    const cutout = result.multimedia[indi.multimediaRefs[0]].files[0];
    expect(cutout.primary).toBe(true);
    expect(cutout.cutout).toBe(true);
    expect(cutout.parentRin).toBe('MH:P100');
    expect(cutout.personalPhoto).toBe(true);
    expect(cutout.photoRin).toBe('MH:P101');
    expect(cutout.position).toBeNull();
    expect(cutout.title).toBe('Test cutout');

    const parent = result.multimedia[indi.multimediaRefs[1]].files[0];
    expect(parent.primaryCutout).toBe(true);
    expect(parent.parentPhoto).toBe(true);
    expect(parent.position).toBe('26 58 230 330');
    expect(parent.photoRin).toBe('MH:P100');

    const other = result.multimedia[indi.multimediaRefs[2]].files[0];
    expect(other.position).toBe('541 380 631 486');
    expect(other.photoRin).toBe('MH:P200');
    expect(other.primary).toBe(false);
    expect(other.cutout).toBe(false);
  });

  test('creates tags with pixelCoords from _POSITION during import', () => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      '0 @I1@ INDI', '1 NAME João /Silva/',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE https://example.com/group.jpg',
      '2 _PARENTPHOTO Y',
      '2 _POSITION 26 58 230 330',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE https://example.com/cutout.jpg',
      '2 _CUTOUT Y',
      '0 TRLR',
    ].join('\n');
    const result = parseGedcomToJson(gedcom);
    const indi   = result.individuals['I1'];

    // Parent photo should have a tag with pixelCoords
    const parentMm = result.multimedia[indi.multimediaRefs[0]];
    expect(parentMm.tags).toHaveLength(1);
    expect(parentMm.tags[0].personId).toBe('I1');
    expect(parentMm.tags[0].personName).toBe('João Silva');
    expect(parentMm.tags[0].pixelCoords).toEqual({ x1: 26, y1: 58, x2: 230, y2: 330 });

    // Cutout (no _POSITION) should have no tags
    const cutoutMm = result.multimedia[indi.multimediaRefs[1]];
    expect(cutoutMm.tags).toHaveLength(0);
  });

  test('does not duplicate tags on _POSITION for same person', () => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      '0 @I1@ INDI', '1 NAME Ana /Costa/',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE photo.jpg',
      '2 _POSITION 10 20 100 200',
      '0 TRLR',
    ].join('\n');
    const result = parseGedcomToJson(gedcom);
    const mm = result.multimedia[result.individuals['I1'].multimediaRefs[0]];
    expect(mm.tags).toHaveLength(1);
    expect(mm.tags[0].personId).toBe('I1');
  });

  test('parses top-level OBJE with photo metadata on file sub-tags', () => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      '0 @M1@ OBJE',
      '1 FILE group.jpg',
      '2 FORM jpg',
      '2 _POSITION 10 20 100 200',
      '2 _PHOTO_RIN MH:P50',
      '1 TITL Grupo familiar',
      '0 TRLR',
    ].join('\n');
    const result = parseGedcomToJson(gedcom);
    const obje   = result.multimedia['M1'];
    expect(obje.files[0].position).toBe('10 20 100 200');
    expect(obje.files[0].photoRin).toBe('MH:P50');
    expect(obje.title).toBe('Grupo familiar');
    expect(obje.tags).toEqual([]);
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
      .set(AUTH).send(MINIMAL_GEDCOM);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.individuals).toBeGreaterThanOrEqual(1);
  });

  test('imported individuals are retrievable via GET', async () => {
    await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .set(AUTH).send(FAMILY_GEDCOM);

    const i1 = (await request(app).get('/api/individuals/I1').set(AUTH)).body;
    expect(i1.names[0].given).toBe('Carlos');
    expect(i1.sex).toBe('M');
  });

  test('imported families are retrievable via GET', async () => {
    await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .set(AUTH).send(FAMILY_GEDCOM);

    const f1 = (await request(app).get('/api/families/F1').set(AUTH)).body;
    expect(f1.husb).toBe('I1');
    expect(f1.wife).toBe('I2');
    expect(f1.children).toContain('I3');
  });

  test('accepts JSON body with { text: <gedcom> }', async () => {
    const res = await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'application/json')
      .set(AUTH).send(JSON.stringify({ text: MINIMAL_GEDCOM }));
    // The mock import handler tries to parse the body as text first,
    // falls back to body.text — both paths should produce ok:true
    expect(res.status).toBe(200);
  });

  test('re-import preserves existing multimedia tags (zones)', async () => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      '0 @I1@ INDI', '1 NAME Test /User/',
      '2 GIVN Test', '2 SURN User',
      '1 SEX M',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE photo.jpg',
      '0 TRLR',
    ].join('\n');

    // First import
    await request(app).post('/api/gedcom/import').set('Content-Type', 'text/plain').set(AUTH).send(gedcom);

    // Manually add a bbox tag to the multimedia via PUT
    const mmList = (await request(app).get('/api/multimedia').set(AUTH)).body;
    const mm = mmList.find(m => m.files && m.files[0] && m.files[0].file === 'photo.jpg');
    expect(mm).toBeDefined();
    mm.tags = [{ personId: 'I1', personName: 'Test User', bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }];
    await request(app).put('/api/multimedia/' + mm.id).set(AUTH).send(mm);

    // Verify tag was saved
    const mmAfterTag = (await request(app).get('/api/multimedia/' + mm.id).set(AUTH)).body;
    expect(mmAfterTag.tags).toHaveLength(1);

    // Re-import the same GEDCOM
    const res = await request(app).post('/api/gedcom/import').set('Content-Type', 'text/plain').set(AUTH).send(gedcom);
    expect(res.body.ok).toBe(true);

    // The tag should be preserved after re-import
    const mmAfterReimport = (await request(app).get('/api/multimedia/' + mm.id).set(AUTH)).body;
    expect(mmAfterReimport.tags).toHaveLength(1);
    expect(mmAfterReimport.tags[0].personId).toBe('I1');
    expect(mmAfterReimport.tags[0].bbox).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });
});
