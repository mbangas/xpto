/**
 * tests/unit/gedcom-export.test.js
 * Unit tests for GEDCOM 7 export — both the pure builder lib and the API endpoint.
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated env ─────────────────────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-gexp-'));
process.env.DATA_DIR = tmpDir;

const request = require('supertest');
const app     = require('../../server.js');

/* ── Pure lib ─────────────────────────────────────────────────────────── */
const { buildGedcomText }   = require('../../lib/gedcom-builder');
const { parseGedcomToJson } = require('../../lib/gedcom-parser');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Sample collections ──────────────────────────────────────────────── */
const NOW = '2026-01-01T00:00:00.000Z';

function makeCollection() {
  return {
    individuals: {
      I1: {
        id: 'I1', type: 'INDI', sex: 'M', deletedAt: null,
        names: [{ value: 'João /Silva/', given: 'João', surname: 'Silva', prefix: '', suffix: '', nickname: '' }],
        events: [{ type: 'BIRT', date: '15 MAR 1980', place: 'Lisboa' }, { type: 'DEAT', date: '1 JAN 2060', place: 'Porto' }],
        attributes: [{ type: 'OCCU', value: 'Engenheiro' }],
        famc: 'F1', fams: ['F2'], notes: ['Uma nota'], sourceRefs: [], multimediaRefs: [],
        createdAt: NOW, updatedAt: NOW,
      },
      I2: {
        id: 'I2', type: 'INDI', sex: 'F', deletedAt: null,
        names: [{ value: 'Maria /Costa/', given: 'Maria', surname: 'Costa', prefix: 'Dra.', suffix: '', nickname: 'Mari' }],
        events: [{ type: 'BIRT', date: '5 MAY 1982', place: 'Coimbra' }],
        attributes: [],
        famc: null, fams: ['F2'], notes: [], sourceRefs: [], multimediaRefs: [],
        createdAt: NOW, updatedAt: NOW,
      },
    },
    families: {
      F2: {
        id: 'F2', type: 'FAM', husb: 'I1', wife: 'I2', children: [], deletedAt: null,
        events: [{ type: 'MARR', date: '10 JUN 2005', place: 'Coimbra' }],
        notes: [], sourceRefs: [], multimediaRefs: [], createdAt: NOW, updatedAt: NOW,
      },
    },
    sources: {
      S1: {
        id: 'S1', type: 'SOUR', title: 'Registo Paroquial', author: 'Paróquia Lisboa',
        publication: 'Lisboa, 1900', deletedAt: null, createdAt: NOW, updatedAt: NOW,
        notes: [], multimediaRefs: [],
      },
    },
    repositories: {
      R1: {
        id: 'R1', type: 'REPO', name: 'Arquivo Nacional', deletedAt: null,
        createdAt: NOW, updatedAt: NOW, notes: [],
      },
    },
    notes: {
      N1: {
        id: 'N1', type: 'NOTE', text: 'Nota genealógica geral.', deletedAt: null,
        sourceRefs: [], createdAt: NOW, updatedAt: NOW,
      },
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM Export — lib/gedcom-builder (pure unit)', () => {
  test('returns a string', () => {
    const text = buildGedcomText(makeCollection());
    expect(typeof text).toBe('string');
  });

  test('output starts with "0 HEAD"', () => {
    const text = buildGedcomText(makeCollection());
    expect(text.trim().startsWith('0 HEAD')).toBe(true);
  });

  test('output ends with "0 TRLR"', () => {
    const text = buildGedcomText(makeCollection());
    expect(text.trim().endsWith('0 TRLR')).toBe(true);
  });

  test('contains GEDC VERS 7.0', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 GEDC');
    expect(text).toContain('2 VERS 7.0');
  });

  test('contains CHAR UTF-8', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 CHAR UTF-8');
  });

  test('contains INDI records with @id@ pointer', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toMatch(/0 @I1@ INDI/);
    expect(text).toMatch(/0 @I2@ INDI/);
  });

  test('INDI records include NAME tag', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 NAME João /Silva/');
  });

  test('INDI NAME includes GIVN and SURN sub-tags', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('2 GIVN João');
    expect(text).toContain('2 SURN Silva');
  });

  test('INDI NAME includes NPFX when present', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('2 NPFX Dra.');
  });

  test('INDI NAME includes NICK when present', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('2 NICK Mari');
  });

  test('INDI includes SEX tag', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toMatch(/1 SEX M/);
    expect(text).toMatch(/1 SEX F/);
  });

  test('INDI events include DATE and PLAC sub-records', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 BIRT');
    expect(text).toContain('2 DATE 15 MAR 1980');
    expect(text).toContain('2 PLAC Lisboa');
  });

  test('INDI attributes use correct GEDCOM tag (OCCU)', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 OCCU Engenheiro');
  });

  test('INDI includes FAMC pointer', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 FAMC @F1@');
  });

  test('INDI includes FAMS pointer', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 FAMS @F2@');
  });

  test('INDI includes NOTE tag', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 NOTE Uma nota');
  });

  test('FAM record with HUSB and WIFE', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toMatch(/0 @F2@ FAM/);
    expect(text).toContain('1 HUSB @I1@');
    expect(text).toContain('1 WIFE @I2@');
  });

  test('FAM marriage event with DATE and PLAC', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toContain('1 MARR');
    expect(text).toContain('2 DATE 10 JUN 2005');
    expect(text).toContain('2 PLAC Coimbra');
  });

  test('SOUR record with TITL and AUTH', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toMatch(/0 @S1@ SOUR/);
    expect(text).toContain('1 TITL Registo Paroquial');
    expect(text).toContain('1 AUTH Paróquia Lisboa');
  });

  test('REPO record with NAME', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toMatch(/0 @R1@ REPO/);
    expect(text).toContain('1 NAME Arquivo Nacional');
  });

  test('NOTE record at level 0', () => {
    const text = buildGedcomText(makeCollection());
    expect(text).toMatch(/0 @N1@ NOTE Nota genealógica geral\./);
  });

  test('soft-deleted individuals are excluded', () => {
    const col = makeCollection();
    col.individuals['I1'].deletedAt = '2026-01-01T00:00:00.000Z';
    const text = buildGedcomText(col);
    expect(text).not.toMatch(/0 @I1@ INDI/);
    expect(text).toMatch(/0 @I2@ INDI/);
  });

  test('FAM children array emits CHIL tags', () => {
    const col  = makeCollection();
    col.families['F2'].children = ['I3', 'I4'];
    const text = buildGedcomText(col);
    expect(text).toContain('1 CHIL @I3@');
    expect(text).toContain('1 CHIL @I4@');
  });

  test('empty collections produce minimal valid GEDCOM', () => {
    const text = buildGedcomText({});
    expect(text).toContain('0 HEAD');
    expect(text).toContain('0 TRLR');
    const indiCount = (text.match(/0 @.*@ INDI/g) || []).length;
    expect(indiCount).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM Export — GET /api/gedcom/export (API)', () => {
  beforeAll(async () => {
    // Seed the test DB via import
    const { parseGedcomToJson } = require('../../lib/gedcom-parser');
    const { writeCollection }    = require('../../lib/crud-helpers');
    const col = makeCollection();
    writeCollection('individuals',  col.individuals);
    writeCollection('families',     col.families);
    writeCollection('sources',      col.sources);
    writeCollection('repositories', col.repositories);
    writeCollection('notes',        col.notes);
  });

  test('GET /api/gedcom/export returns 200', async () => {
    const res = await request(app).get('/api/gedcom/export');
    expect(res.status).toBe(200);
  });

  test('exported text starts with "0 HEAD"', async () => {
    const res = await request(app).get('/api/gedcom/export');
    expect(res.text.trim().startsWith('0 HEAD')).toBe(true);
  });

  test('exported text ends with "0 TRLR"', async () => {
    const res = await request(app).get('/api/gedcom/export');
    expect(res.text.trim().endsWith('0 TRLR')).toBe(true);
  });

  test('exported text contains seeded INDI', async () => {
    const res = await request(app).get('/api/gedcom/export');
    expect(res.text).toMatch(/0 @I1@ INDI/);
  });

  test('exported text contains seeded FAM', async () => {
    const res = await request(app).get('/api/gedcom/export');
    expect(res.text).toMatch(/0 @F2@ FAM/);
  });

  test('format=file sets Content-Disposition header', async () => {
    const res = await request(app).get('/api/gedcom/export?format=file');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
  });
});
