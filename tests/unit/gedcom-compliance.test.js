/**
 * tests/unit/gedcom-compliance.test.js
 * Tests that every kinship degree added to the system produces a GEDCOM 7-compliant
 * representation in both the JSON model and in the exported GEDCOM text.
 *
 * GEDCOM 7 kinship rules:
 *   - Spouse         : Individual has FAMS @Fn@; FAM has HUSB @In@ / WIFE @In@
 *   - Parent         : Individual has FAMS @Fn@ (as head) and children have FAMC @Fn@; FAM has CHIL @In@
 *   - Child          : Individual has FAMC @Fn@; FAM has CHIL @In@
 *   - Sibling        : Shares same FAMC family
 *   - Adoptive child : FAMC @Fn@ + ADOP event (or ADOP in FAM CHIL record in GEDCOM 5; in GEDCOM 7 type is in ADOP event)
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-comp-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const request = require('supertest');
const app     = require('../../server.js');

const jwt = require('jsonwebtoken');
const _testToken = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000001', email: 'test@test.com', isAdmin: true },
  process.env.JWT_SECRET, { expiresIn: '1h' });
const AUTH = { Authorization: 'Bearer ' + _testToken };

const { buildGedcomText }   = require('../../lib/gedcom-builder');
const { parseGedcomToJson } = require('../../lib/gedcom-parser');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Helpers ──────────────────────────────────────────────────────────── */
async function createIndi(given, surname, sex = 'M', extra = {}) {
  const res = await request(app).post('/api/individuals').set(AUTH).send({
    names: [{ given, surname, prefix: '', suffix: '', nickname: '', type: 'BIRTH' }],
    sex,
    events: [],
    ...extra,
  });
  return res.body.id;
}

async function createFam(husb = null, wife = null, children = [], events = []) {
  const res = await request(app).post('/api/families').set(AUTH).send({ husb, wife, children, events });
  return res.body.id;
}

async function linkFamToIndi(indiId, famId, role) {
  const rec = (await request(app).get(`/api/individuals/${indiId}`).set(AUTH)).body;
  if (role === 'fams') {
    await request(app).put(`/api/individuals/${indiId}`).set(AUTH).send({ fams: [...(rec.fams || []), famId] });
  } else {
    await request(app).put(`/api/individuals/${indiId}`).set(AUTH).send({ famc: famId });
  }
}

function collectionsFromDB(data) {
  return {
    individuals:  data.individuals,
    families:     data.families,
    sources:      {},
    repositories: {},
    notes:        {},
    submitters:   {},
  };
}

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — Spouse relationship', () => {
  test('spouse: FAM has HUSB and WIFE; both have FAMS pointing to FAM', async () => {
    const husbId = await createIndi('Esposo', 'Cunha', 'M');
    const wifeId = await createIndi('Esposa', 'Cunha', 'F');
    const famId  = await createFam(husbId, wifeId, [], [{ type: 'MARR', date: '1 JAN 2010', place: 'Porto' }]);

    await linkFamToIndi(husbId, famId, 'fams');
    await linkFamToIndi(wifeId, famId, 'fams');

    const fam  = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const husb = (await request(app).get(`/api/individuals/${husbId}`).set(AUTH)).body;
    const wife = (await request(app).get(`/api/individuals/${wifeId}`).set(AUTH)).body;

    // JSON model compliance
    expect(fam.husb).toBe(husbId);
    expect(fam.wife).toBe(wifeId);
    expect(husb.fams).toContain(famId);
    expect(wife.fams).toContain(famId);

    // GEDCOM text compliance
    const gedcom = buildGedcomText({ individuals: { [husbId]: husb, [wifeId]: wife }, families: { [famId]: fam } });
    expect(gedcom).toContain(`1 HUSB @${husbId}@`);
    expect(gedcom).toContain(`1 WIFE @${wifeId}@`);
    expect(gedcom).toContain(`1 FAMS @${famId}@`);
  });

  test('spouse with marriage event: MARR tag with DATE and PLAC emitted', async () => {
    const h = await createIndi('H2', 'Fam', 'M');
    const w = await createIndi('W2', 'Fam', 'F');
    const famId = await createFam(h, w, [], [{ type: 'MARR', date: '15 AUG 2015', place: 'Braga' }]);

    const fam = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const gedcom = buildGedcomText({ families: { [famId]: fam } });

    expect(gedcom).toContain('1 MARR');
    expect(gedcom).toContain('2 DATE 15 AUG 2015');
    expect(gedcom).toContain('2 PLAC Braga');
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — Parent-child relationship', () => {
  test('child has FAMC; FAM has CHIL; parent has FAMS', async () => {
    const fatherId = await createIndi('Pai', 'Nunes', 'M');
    const motherId = await createIndi('Mãe', 'Nunes', 'F');
    const childId  = await createIndi('Filho', 'Nunes', 'M');

    const famId = await createFam(fatherId, motherId, [childId]);

    await linkFamToIndi(fatherId, famId, 'fams');
    await linkFamToIndi(motherId, famId, 'fams');
    await linkFamToIndi(childId,  famId, 'famc');

    const fam    = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const father = (await request(app).get(`/api/individuals/${fatherId}`).set(AUTH)).body;
    const child  = (await request(app).get(`/api/individuals/${childId}`).set(AUTH)).body;

    expect(fam.children).toContain(childId);
    expect(child.famc).toBe(famId);
    expect(father.fams).toContain(famId);

    const gedcom = buildGedcomText({
      individuals: { [fatherId]: father, [childId]: child },
      families:    { [famId]: fam },
    });
    expect(gedcom).toContain(`1 CHIL @${childId}@`);
    expect(gedcom).toContain(`1 FAMC @${famId}@`);
    expect(gedcom).toContain(`1 FAMS @${famId}@`);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — Sibling relationship', () => {
  test('siblings share the same FAMC; FAM lists all as CHIL', async () => {
    const s1 = await createIndi('Irmão', 'A', 'M');
    const s2 = await createIndi('Irmã',  'A', 'F');
    const s3 = await createIndi('Irmão', 'B', 'M');

    const famId = await createFam(null, null, [s1, s2, s3]);
    await linkFamToIndi(s1, famId, 'famc');
    await linkFamToIndi(s2, famId, 'famc');
    await linkFamToIndi(s3, famId, 'famc');

    const fam = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;
    const sibling1 = (await request(app).get(`/api/individuals/${s1}`).set(AUTH)).body;
    const sibling2 = (await request(app).get(`/api/individuals/${s2}`).set(AUTH)).body;
    const sibling3 = (await request(app).get(`/api/individuals/${s3}`).set(AUTH)).body;

    // All share same FAMC
    expect(sibling1.famc).toBe(famId);
    expect(sibling2.famc).toBe(famId);
    expect(sibling3.famc).toBe(famId);

    // FAM lists all as children
    expect(fam.children).toContain(s1);
    expect(fam.children).toContain(s2);
    expect(fam.children).toContain(s3);

    // GEDCOM text: all CHIL tags present
    const gedcom = buildGedcomText({ families: { [famId]: fam } });
    expect(gedcom).toContain(`1 CHIL @${s1}@`);
    expect(gedcom).toContain(`1 CHIL @${s2}@`);
    expect(gedcom).toContain(`1 CHIL @${s3}@`);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — SEX values', () => {
  const gedcom7SexValues = ['M', 'F', 'X', 'U'];

  test.each(gedcom7SexValues)('SEX value %s is stored and emitted correctly', async (sex) => {
    const id  = await createIndi(`Pessoa_${sex}`, 'Teste', sex);
    const rec = (await request(app).get(`/api/individuals/${id}`).set(AUTH)).body;
    expect(rec.sex).toBe(sex);

    const text = buildGedcomText({ individuals: { [id]: rec } });
    expect(text).toContain(`1 SEX ${sex}`);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — Event types for INDI', () => {
  const indiEventTypes = [
    'BIRT', 'CHR',  'DEAT', 'BURI', 'CREM',
    'ADOP', 'BAPM', 'BARM', 'BASM', 'BLES',
    'CHRA', 'CONF', 'FCOM', 'ORDN', 'NATU',
    'EMIG', 'IMMI', 'CENS', 'PROB', 'WILL',
    'GRAD', 'RETI', 'EVEN',
  ];

  test.each(indiEventTypes)('INDI event type %s round-trips through import+export', (evType) => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      `0 @IEVT@ INDI`,
      `1 NAME Test /Event/`,
      `1 ${evType}`,
      `2 DATE 1 JAN 2000`,
      `2 PLAC Porto`,
      '0 TRLR',
    ].join('\n');

    const parsed = parseGedcomToJson(gedcom);
    const indi   = parsed.individuals['IEVT'];
    expect(indi).toBeDefined();

    const ev = indi.events.find(e => e.type === evType);
    expect(ev).toBeDefined();
    expect(ev.date).toBe('1 JAN 2000');
    expect(ev.place).toBe('Porto');

    // Now export and verify tag appears
    const exported = buildGedcomText({ individuals: { IEVT: indi } });
    expect(exported).toContain(`1 ${evType}`);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — Event types for FAM', () => {
  const famEventTypes = ['MARR', 'MARB', 'MARC', 'MARL', 'MARS', 'ANUL', 'DIV', 'DIVF', 'ENGA', 'EVEN'];

  test.each(famEventTypes)('FAM event type %s round-trips through import+export', (evType) => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      `0 @FEVT@ FAM`,
      `1 ${evType}`,
      `2 DATE 1 JAN 2000`,
      `2 PLAC Lisboa`,
      '0 TRLR',
    ].join('\n');

    const parsed = parseGedcomToJson(gedcom);
    const fam    = parsed.families['FEVT'];
    expect(fam).toBeDefined();

    const ev = fam.events.find(e => e.type === evType);
    expect(ev).toBeDefined();

    const exported = buildGedcomText({ families: { FEVT: fam } });
    expect(exported).toContain(`1 ${evType}`);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — Name structure', () => {
  test('NAME tag follows GEDCOM 7 with GIVN and SURN sub-records', () => {
    const col = {
      individuals: {
        IT: {
          id: 'IT', type: 'INDI', sex: 'M', deletedAt: null,
          names: [{ value: 'José /Ribeiro/', given: 'José', surname: 'Ribeiro', prefix: '', suffix: '', nickname: '' }],
          events: [], attributes: [], famc: null, fams: [], notes: [], sourceRefs: [], multimediaRefs: [],
          createdAt: '', updatedAt: '',
        },
      },
    };
    const text = buildGedcomText(col);
    expect(text).toContain('1 NAME José /Ribeiro/');
    expect(text).toContain('2 GIVN José');
    expect(text).toContain('2 SURN Ribeiro');
  });

  test('NAME with prefix emits NPFX sub-record', () => {
    const col = {
      individuals: {
        IP: {
          id: 'IP', type: 'INDI', sex: 'M', deletedAt: null,
          names: [{ value: 'Dr. José /Ribeiro/', given: 'José', surname: 'Ribeiro', prefix: 'Dr.', suffix: '', nickname: '' }],
          events: [], attributes: [], famc: null, fams: [], notes: [], sourceRefs: [], multimediaRefs: [],
          createdAt: '', updatedAt: '',
        },
      },
    };
    const text = buildGedcomText(col);
    expect(text).toContain('2 NPFX Dr.');
  });

  test('NAME with suffix emits NSFX sub-record', () => {
    const col = {
      individuals: {
        IS: {
          id: 'IS', type: 'INDI', sex: 'M', deletedAt: null,
          names: [{ value: 'João /Silva/ Jr.', given: 'João', surname: 'Silva', prefix: '', suffix: 'Jr.', nickname: '' }],
          events: [], attributes: [], famc: null, fams: [], notes: [], sourceRefs: [], multimediaRefs: [],
          createdAt: '', updatedAt: '',
        },
      },
    };
    const text = buildGedcomText(col);
    expect(text).toContain('2 NSFX Jr.');
  });

  test('NAME with nickname emits NICK sub-record', () => {
    const col = {
      individuals: {
        IN: {
          id: 'IN', type: 'INDI', sex: 'F', deletedAt: null,
          names: [{ value: 'Maria /Costa/', given: 'Maria', surname: 'Costa', prefix: '', suffix: '', nickname: 'Micas' }],
          events: [], attributes: [], famc: null, fams: [], notes: [], sourceRefs: [], multimediaRefs: [],
          createdAt: '', updatedAt: '',
        },
      },
    };
    const text = buildGedcomText(col);
    expect(text).toContain('2 NICK Micas');
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
describe('GEDCOM 7 Compliance — Adoptive child', () => {
  test('adopted child has FAMC and ADOP event', async () => {
    const fatherId  = await createIndi('Pai Adoptivo', 'Sousa', 'M');
    const childId   = await createIndi('Criança', 'Adoptada', 'F', {
      events: [{ type: 'ADOP', date: '1 MAR 2010', place: 'Faro' }],
    });
    const famId = await createFam(fatherId, null, [childId]);
    await linkFamToIndi(childId, famId, 'famc');

    const child = (await request(app).get(`/api/individuals/${childId}`).set(AUTH)).body;
    const fam   = (await request(app).get(`/api/families/${famId}`).set(AUTH)).body;

    expect(child.famc).toBe(famId);
    expect(fam.children).toContain(childId);

    const adop = child.events.find(e => e.type === 'ADOP');
    expect(adop).toBeDefined();
    expect(adop.date).toBe('1 MAR 2010');

    const gedcom = buildGedcomText({
      individuals: { [childId]: child },
      families:    { [famId]:   fam   },
    });
    expect(gedcom).toContain('1 ADOP');
    expect(gedcom).toContain(`1 FAMC @${famId}@`);
  });
});
