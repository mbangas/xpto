/**
 * tests/integration/gedcom-roundtrip.test.js
 * Integration tests for full GEDCOM import → export → re-import round-trips.
 * Verifies that no data is lost or corrupted when cycling through the GEDCOM pipeline.
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated environment ─────────────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-int-rtip-'));
process.env.DATA_DIR = tmpDir;

const request = require('supertest');
const app     = require('../../server.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Sample GEDCOM data ──────────────────────────────────────────────── */
const ROUNDTRIP_GEDCOM = `0 HEAD
1 GEDC
2 VERS 7.0
1 SOUR myLineage
2 VERS 2.0
2 NAME myLineage
1 CHAR UTF-8
0 @I1@ INDI
1 NAME António /Rodrigues/
2 GIVN António
2 SURN Rodrigues
1 SEX M
1 BIRT
2 DATE 3 MAR 1945
2 PLAC Braga
1 DEAT
2 DATE 12 DEC 2010
2 PLAC Porto
1 OCCU Agricultor
1 FAMS @F1@
0 @I2@ INDI
1 NAME Conceição /Melo/
2 GIVN Conceição
2 SURN Melo
1 SEX F
1 BIRT
2 DATE 7 JUL 1948
2 PLAC Guimarães
1 FAMS @F1@
0 @I3@ INDI
1 NAME Luís /Rodrigues/
2 GIVN Luís
2 SURN Rodrigues
1 SEX M
1 BIRT
2 DATE 15 MAR 1970
2 PLAC Braga
1 FAMC @F1@
0 @I4@ INDI
1 NAME Teresa /Rodrigues/
2 GIVN Teresa
2 SURN Rodrigues
1 SEX F
1 BIRT
2 DATE 28 FEB 1973
2 PLAC Braga
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 CHIL @I4@
1 MARR
2 DATE 20 APR 1968
2 PLAC Braga
0 @S1@ SOUR
1 TITL Registo Civil de Braga
1 AUTH Arquivo Municipal de Braga
1 PUBL Braga, 1968
0 @N1@ NOTE Família originária do Minho, norte de Portugal.
0 TRLR`;

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM Round-trip — import → export → re-import', () => {
  let exportedGedcom;

  test('1. Import GEDCOM returns ok:true with correct stats', async () => {
    const res = await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .send(ROUNDTRIP_GEDCOM);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.stats.individuals).toBe(4);
    expect(res.body.stats.families).toBe(1);
  });

  test('2. After import, all individuals are retrievable', async () => {
    const list = await (await request(app).get('/api/individuals')).body;
    expect(Array.isArray(list)).toBe(true);
    const ids = list.map(i => i.id);
    ['I1', 'I2', 'I3', 'I4'].forEach(id => expect(ids).toContain(id));
  });

  test('3. After import, family F1 is retrievable with correct links', async () => {
    const fam = (await request(app).get('/api/families/F1')).body;
    expect(fam.husb).toBe('I1');
    expect(fam.wife).toBe('I2');
    expect(fam.children).toContain('I3');
    expect(fam.children).toContain('I4');
  });

  test('4. After import, individuals have correct cross-links', async () => {
    const i1 = (await request(app).get('/api/individuals/I1')).body;
    const i3 = (await request(app).get('/api/individuals/I3')).body;

    expect(i1.fams).toContain('F1');
    expect(i3.famc).toBe('F1');
  });

  test('5. Export produces valid GEDCOM 7 text', async () => {
    const res = await request(app).get('/api/gedcom/export');
    expect(res.status).toBe(200);
    exportedGedcom = res.text;

    expect(exportedGedcom).toContain('0 HEAD');
    expect(exportedGedcom).toContain('2 VERS 7.0');
    expect(exportedGedcom).toContain('0 TRLR');
  });

  test('6. Exported GEDCOM contains all 4 individuals', () => {
    ['I1', 'I2', 'I3', 'I4'].forEach(id => {
      expect(exportedGedcom).toMatch(new RegExp(`0 @${id}@ INDI`));
    });
  });

  test('7. Exported GEDCOM contains family F1', () => {
    expect(exportedGedcom).toMatch(/0 @F1@ FAM/);
  });

  test('8. Exported GEDCOM preserves HUSB, WIFE, CHIL pointers', () => {
    expect(exportedGedcom).toContain('1 HUSB @I1@');
    expect(exportedGedcom).toContain('1 WIFE @I2@');
    expect(exportedGedcom).toContain('1 CHIL @I3@');
    expect(exportedGedcom).toContain('1 CHIL @I4@');
  });

  test('9. Exported GEDCOM preserves FAMS and FAMC cross-links', () => {
    expect(exportedGedcom).toContain('1 FAMS @F1@');
    expect(exportedGedcom).toContain('1 FAMC @F1@');
  });

  test('10. Exported GEDCOM preserves individual names', () => {
    expect(exportedGedcom).toContain('António');
    expect(exportedGedcom).toContain('Conceição');
    expect(exportedGedcom).toContain('Luís');
    expect(exportedGedcom).toContain('Teresa');
  });

  test('11. Exported GEDCOM preserves event dates', () => {
    expect(exportedGedcom).toContain('3 MAR 1945');
    expect(exportedGedcom).toContain('20 APR 1968');
  });

  test('12. Re-import exported GEDCOM returns ok:true', async () => {
    const res = await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .send(exportedGedcom);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('13. After re-import, individual count is preserved', async () => {
    const list = (await request(app).get('/api/individuals')).body;
    expect(list.filter(i => !i.deletedAt)).toHaveLength(4);
  });

  test('14. After re-import, family count is preserved', async () => {
    const list = (await request(app).get('/api/families')).body;
    expect(list.filter(f => !f.deletedAt)).toHaveLength(1);
  });

  test('15. After re-import, I1 name is preserved', async () => {
    const i1 = (await request(app).get('/api/individuals/I1')).body;
    expect(i1.names[0].given).toBe('António');
    expect(i1.names[0].surname).toBe('Rodrigues');
  });

  test('16. After re-import, SEX values are preserved', async () => {
    const i1 = (await request(app).get('/api/individuals/I1')).body;
    const i2 = (await request(app).get('/api/individuals/I2')).body;
    expect(i1.sex).toBe('M');
    expect(i2.sex).toBe('F');
  });

  test('17. After re-import, BIRT events are preserved', async () => {
    const i1 = (await request(app).get('/api/individuals/I1')).body;
    const birt = i1.events.find(e => e.type === 'BIRT');
    expect(birt).toBeDefined();
    expect(birt.date).toBe('3 MAR 1945');
    expect(birt.place).toBe('Braga');
  });

  test('18. /api/topola-json returns correct data after round-trip', async () => {
    const topola = (await request(app).get('/api/topola-json')).body;
    expect(topola.indis.length).toBe(4);
    expect(topola.fams.length).toBe(1);
  });

  test('19. /api/stats returns correct counts after round-trip', async () => {
    const stats = (await request(app).get('/api/stats')).body;
    expect(stats.individuals).toBe(4);
    expect(stats.families).toBe(1);
    expect(stats.males).toBe(2);
    expect(stats.females).toBe(2);
    expect(stats.births).toBe(4);
    expect(stats.marriages).toBe(1);
    expect(stats.deaths).toBe(1); // Only I1 has DEAT
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM Round-trip — large GEDCOM with multiple event types', () => {
  const EVENTS_GEDCOM = `0 HEAD
1 GEDC
2 VERS 7.0
1 CHAR UTF-8
0 @IALL@ INDI
1 NAME All /Events/
2 GIVN All
2 SURN Events
1 SEX M
1 BIRT
2 DATE 1 JAN 1950
1 CHR
2 DATE 15 JAN 1950
1 CONF
2 DATE 1 JAN 1965
1 RETI
2 DATE 1 JAN 2010
1 DEAT
2 DATE 1 JAN 2020
2 PLAC Lisboa
1 BURI
2 DATE 3 JAN 2020
1 OCCU Médico
1 EDUC Universidade de Lisboa
1 NATI Portuguesa
0 @FALL@ FAM
1 HUSB @IALL@
1 MARR
2 DATE 1 MAY 1975
1 DIV
2 DATE 1 MAY 1995
1 ENGA
2 DATE 1 JAN 1975
0 TRLR`;

  test('complex GEDCOM imports and exports without data loss', async () => {
    // Import
    const importRes = await request(app)
      .post('/api/gedcom/import')
      .set('Content-Type', 'text/plain')
      .send(EVENTS_GEDCOM);
    expect(importRes.body.ok).toBe(true);

    // Export
    const exportRes = await request(app).get('/api/gedcom/export');
    const exported  = exportRes.text;

    // Key event tags present
    expect(exported).toContain('1 BIRT');
    expect(exported).toContain('1 CHR');
    expect(exported).toContain('1 DEAT');
    expect(exported).toContain('1 BURI');
    expect(exported).toContain('1 RETI');
    expect(exported).toContain('1 MARR');
    expect(exported).toContain('1 DIV');
    expect(exported).toContain('1 OCCU Médico');
    expect(exported).toContain('1 EDUC Universidade de Lisboa');
  });
});
