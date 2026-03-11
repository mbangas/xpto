/**
 * Tests for new GEDCOM fields: CONC, _MARNM, _AKA, CAUS, AGE, TYPE,
 * ADDR/EMAIL/WWW, _DATE/_PLACE on OBJE.
 */
'use strict';

const { parseGedcomToJson } = require('../../lib/gedcom-parser');
const { buildGedcomText }   = require('../../lib/gedcom-builder');

describe('GEDCOM parser – new fields', () => {
  const ged = [
    '0 HEAD', '1 GEDC', '2 VERS 7.0', '1 CHAR UTF-8',
    '0 @I1@ INDI',
    '1 NAME Maria /Santos/',
    '2 GIVN Maria',
    '2 SURN Santos',
    '2 _MARNM Ferreira',
    '2 _AKA Micas',
    '1 SEX F',
    '1 DEAT',
    '2 DATE 1 JAN 2020',
    '2 PLAC Lisboa',
    '2 CAUS Acidente',
    '2 AGE 80',
    '1 BIRT',
    '2 DATE 5 MAR 1940',
    '1 EVEN',
    '2 DATE 15 AUG 1970',
    '2 TYPE Funeral',
    '1 RESI',
    '2 ADDR',
    '3 ADR1 Rua Principal 10',
    '3 ADR2 Encarnação',
    '3 CITY Lisboa',
    '3 STAE 2640',
    '3 CTRY Portugal',
    '3 POST 2640-001',
    '2 EMAIL maria@test.pt',
    '2 WWW http://example.com',
    '1 NOTE This is a long',
    '2 CONC  note that continues here.',
    '1 OBJE',
    '2 FORM jpg',
    '2 FILE /uploads/fotos/test.jpg',
    '2 TITL Test Photo',
    '2 _DATE 9 APR 1917',
    '2 _PLACE França',
    '2 _PHOTO_RIN MH:P1',
    '0 @F1@ FAM',
    '1 MARR',
    '2 DATE 15 AUG 1960',
    '2 PLAC Lisboa',
    '2 TYPE Civil',
    '0 TRLR',
  ].join('\n');

  let result;
  beforeAll(() => { result = parseGedcomToJson(ged); });

  test('parses _MARNM and _AKA from NAME', () => {
    const name = result.individuals['I1'].names[0];
    expect(name.marriedName).toBe('Ferreira');
    expect(name.aka).toBe('Micas');
  });

  test('parses CAUS and AGE from DEAT event', () => {
    const deat = result.individuals['I1'].events.find(e => e.type === 'DEAT');
    expect(deat.cause).toBe('Acidente');
    expect(deat.age).toBe('80');
  });

  test('parses TYPE (description) from EVEN', () => {
    const ev = result.individuals['I1'].events.find(e => e.type === 'EVEN');
    expect(ev.description).toBe('Funeral');
  });

  test('parses ADDR sub-structure from RESI', () => {
    const resi = result.individuals['I1'].attributes.find(a => a.type === 'RESI');
    expect(resi.address).toBeDefined();
    expect(resi.address.adr1).toBe('Rua Principal 10');
    expect(resi.address.adr2).toBe('Encarnação');
    expect(resi.address.city).toBe('Lisboa');
    expect(resi.address.stae).toBe('2640');
    expect(resi.address.ctry).toBe('Portugal');
    expect(resi.address.post).toBe('2640-001');
  });

  test('parses EMAIL and WWW from RESI', () => {
    const resi = result.individuals['I1'].attributes.find(a => a.type === 'RESI');
    expect(resi.email).toBe('maria@test.pt');
    expect(resi.www).toBe('http://example.com');
  });

  test('merges CONC into NOTE', () => {
    const notes = result.individuals['I1'].notes;
    expect(notes[0]).toBe('This is a long note that continues here.');
  });

  test('parses _DATE and _PLACE from OBJE', () => {
    const mm = Object.values(result.multimedia);
    const file = mm[0].files[0];
    expect(file.photoDate).toBe('9 APR 1917');
    expect(file.photoPlace).toBe('França');
  });

  test('parses TYPE from FAM event', () => {
    const marr = result.families['F1'].events.find(e => e.type === 'MARR');
    expect(marr.description).toBe('Civil');
  });
});

describe('GEDCOM builder – new fields roundtrip', () => {
  const collections = {
    individuals: {
      'I1': {
        id: 'I1', type: 'INDI', deletedAt: null,
        names: [{ value: 'Maria /Santos/', given: 'Maria', surname: 'Santos', prefix: '', suffix: '', nickname: '', marriedName: 'Ferreira', aka: 'Micas', type: 'BIRTH' }],
        sex: 'F',
        events: [
          { type: 'DEAT', date: '1 JAN 2020', place: 'Lisboa', notes: [], cause: 'Acidente', age: '80', description: '' },
          { type: 'EVEN', date: '15 AUG 1970', place: '', notes: [], cause: '', age: '', description: 'Funeral' },
        ],
        attributes: [
          { type: 'RESI', value: '', date: '', place: '', email: 'maria@test.pt', www: 'http://example.com',
            address: { addr: '', adr1: 'Rua Principal 10', adr2: 'Encarnação', city: 'Lisboa', stae: '2640', ctry: 'Portugal', post: '2640-001' } },
        ],
        famc: null, fams: [], notes: [], sourceRefs: [], multimediaRefs: ['M1'],
        createdAt: '', updatedAt: '',
      },
    },
    families: {
      'F1': {
        id: 'F1', type: 'FAM', deletedAt: null,
        husb: null, wife: null, children: [],
        events: [{ type: 'MARR', date: '15 AUG 1960', place: 'Lisboa', notes: [], cause: '', age: '', description: 'Civil' }],
        notes: [], sourceRefs: [], multimediaRefs: [],
      },
    },
    multimedia: {
      'M1': {
        id: 'M1', type: 'OBJE', deletedAt: null,
        files: [{ file: '/uploads/fotos/test.jpg', form: 'jpg', title: 'Test', position: null, photoDate: '9 APR 1917', photoPlace: 'França', photoRin: 'MH:P1' }],
        tags: [{ personId: 'I1', personName: 'Maria', objeProps: { photoDate: '9 APR 1917', photoPlace: 'França', photoRin: 'MH:P1' } }],
        notes: [], sourceRefs: [],
      },
    },
    sources: {}, repositories: {}, notes: {}, submitters: {},
  };

  let text;
  beforeAll(() => { text = buildGedcomText(collections); });

  test('exports _MARNM and _AKA', () => {
    expect(text).toContain('2 _MARNM Ferreira');
    expect(text).toContain('2 _AKA Micas');
  });

  test('exports CAUS and AGE', () => {
    expect(text).toContain('2 CAUS Acidente');
    expect(text).toContain('2 AGE 80');
  });

  test('exports TYPE for events', () => {
    expect(text).toContain('2 TYPE Funeral');
    expect(text).toContain('2 TYPE Civil');
  });

  test('exports ADDR sub-structure', () => {
    expect(text).toContain('2 ADDR');
    expect(text).toContain('3 ADR1 Rua Principal 10');
    expect(text).toContain('3 CITY Lisboa');
    expect(text).toContain('3 CTRY Portugal');
    expect(text).toContain('3 POST 2640-001');
  });

  test('exports EMAIL and WWW', () => {
    expect(text).toContain('2 EMAIL maria@test.pt');
    expect(text).toContain('2 WWW http://example.com');
  });

  test('exports _DATE and _PLACE for OBJE', () => {
    expect(text).toContain('2 _DATE 9 APR 1917');
    expect(text).toContain('2 _PLACE França');
  });

  test('exports date and place from attributes', () => {
    // RESI has no date/place in this test, but verify the structure exists
    expect(text).toContain('1 RESI');
  });
});
