/**
 * tests/unit/sources.test.js
 * Unit tests for the Sources CRUD API (/api/sources)
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-sour-'));
process.env.DATA_DIR = tmpDir;

const request = require('supertest');
const app     = require('../../server.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const SOURCE_BASE = {
  title:       'Registo Paroquial de São Pedro',
  author:      'Paróquia de São Pedro',
  publication: 'Lisboa, 1850',
  abbreviation: 'Reg.Paroquial',
  text:        'Anotação do padre sobre baptismo.',
};

describe('Sources — CREATE', () => {
  test('creates a source and returns 201 with correct fields', async () => {
    const res = await request(app).post('/api/sources').send(SOURCE_BASE);
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('SOUR');
    expect(res.body.id).toMatch(/^S\d+$/);
    expect(res.body.title).toBe(SOURCE_BASE.title);
    expect(res.body.author).toBe(SOURCE_BASE.author);
    expect(res.body.deletedAt).toBeNull();
  });

  test('creates a minimal source with only title', async () => {
    const res = await request(app).post('/api/sources').send({ title: 'Apenas Título' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Apenas Título');
  });
});

describe('Sources — READ', () => {
  let srcId;

  beforeAll(async () => {
    const res = await request(app).post('/api/sources').send(SOURCE_BASE);
    srcId = res.body.id;
  });

  test('GET /api/sources returns array', async () => {
    const res = await request(app).get('/api/sources');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/sources/:id returns the source', async () => {
    const res = await request(app).get(`/api/sources/${srcId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(srcId);
    expect(res.body.type).toBe('SOUR');
  });

  test('GET /api/sources/:id returns 404 for non-existent id', async () => {
    const res = await request(app).get('/api/sources/SXXXXXXX');
    expect(res.status).toBe(404);
  });
});

describe('Sources — UPDATE', () => {
  let srcId;

  beforeAll(async () => {
    const res = await request(app).post('/api/sources').send(SOURCE_BASE);
    srcId = res.body.id;
  });

  test('updates a source', async () => {
    const res = await request(app).put(`/api/sources/${srcId}`)
      .send({ title: 'Título Actualizado', author: 'Novo Autor' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Título Actualizado');
    expect(res.body.author).toBe('Novo Autor');
  });

  test('PUT on missing id returns 404', async () => {
    const res = await request(app).put('/api/sources/SNOPE').send({ title: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('Sources — DELETE (soft delete)', () => {
  test('DELETE sets deletedAt', async () => {
    const post = await request(app).post('/api/sources').send({ title: 'Para Apagar' });
    const id   = post.body.id;

    const del = await request(app).delete(`/api/sources/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const src = (await request(app).get(`/api/sources/${id}`)).body;
    expect(src.deletedAt).toBeTruthy();

    const list = (await request(app).get('/api/sources')).body;
    expect(list.map(s => s.id)).not.toContain(id);
  });
});

describe('Sources — GEDCOM 7 compliance', () => {
  test('source record has SOUR type and standard fields', async () => {
    const res = await request(app).post('/api/sources').send(SOURCE_BASE);
    const src = res.body;
    expect(src.type).toBe('SOUR');
    expect(src).toHaveProperty('title');
    expect(src).toHaveProperty('author');
    expect(src).toHaveProperty('publication');
    expect(src).toHaveProperty('notes');
    expect(src).toHaveProperty('multimediaRefs');
    expect(Array.isArray(src.notes)).toBe(true);
  });
});
