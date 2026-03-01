/**
 * tests/unit/multimedia.test.js
 * Unit tests for the Multimedia CRUD API (/api/multimedia)
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-media-'));
process.env.DATA_DIR = tmpDir;

const request = require('supertest');
const app     = require('../../server.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const OBJE_BASE = {
  files: [
    { file: 'foto1.jpg', form: 'image/jpeg' },
  ],
  tags: ['Casamento', 'Família'],
  notes: [],
};

describe('Multimedia — CREATE', () => {
  test('creates a multimedia object (OBJE) with 201', async () => {
    const res = await request(app).post('/api/multimedia').send(OBJE_BASE);
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('OBJE');
    expect(res.body.id).toMatch(/^M\d+$/);
    expect(res.body.deletedAt).toBeNull();
  });

  test('stores files array correctly', async () => {
    const res = await request(app).post('/api/multimedia').send(OBJE_BASE);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0]).toMatchObject({ file: 'foto1.jpg', form: 'image/jpeg' });
  });

  test('stores multiple files', async () => {
    const res = await request(app).post('/api/multimedia').send({
      files: [
        { file: 'foto1.jpg', form: 'image/jpeg' },
        { file: 'doc.pdf',   form: 'application/pdf' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.files).toHaveLength(2);
  });

  test('stores tags array', async () => {
    const res = await request(app).post('/api/multimedia').send(OBJE_BASE);
    expect(res.body.tags).toContain('Casamento');
  });

  test('stores dataUrl if provided', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const res = await request(app).post('/api/multimedia').send({ ...OBJE_BASE, dataUrl });
    expect(res.status).toBe(201);
    expect(res.body.dataUrl).toBe(dataUrl);
  });
});

describe('Multimedia — READ', () => {
  let objId;

  beforeAll(async () => {
    const res = await request(app).post('/api/multimedia').send(OBJE_BASE);
    objId = res.body.id;
  });

  test('GET /api/multimedia returns array', async () => {
    const res = await request(app).get('/api/multimedia');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/multimedia/:id returns the object', async () => {
    const res = await request(app).get(`/api/multimedia/${objId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(objId);
    expect(res.body.type).toBe('OBJE');
  });

  test('GET on non-existent id returns 404', async () => {
    const res = await request(app).get('/api/multimedia/MNOPE');
    expect(res.status).toBe(404);
  });
});

describe('Multimedia — UPDATE', () => {
  let objId;

  beforeAll(async () => {
    const res = await request(app).post('/api/multimedia').send(OBJE_BASE);
    objId = res.body.id;
  });

  test('updates files array', async () => {
    const res = await request(app).put(`/api/multimedia/${objId}`)
      .send({ files: [{ file: 'nova.jpg', form: 'image/jpeg' }] });
    expect(res.status).toBe(200);
    expect(res.body.files[0].file).toBe('nova.jpg');
  });

  test('updates tags', async () => {
    const res = await request(app).put(`/api/multimedia/${objId}`).send({ tags: ['Baptizado'] });
    expect(res.status).toBe(200);
    expect(res.body.tags).toContain('Baptizado');
  });
});

describe('Multimedia — DELETE', () => {
  test('DELETE soft-deletes a multimedia object', async () => {
    const post = await request(app).post('/api/multimedia').send(OBJE_BASE);
    const id   = post.body.id;

    const del = await request(app).delete(`/api/multimedia/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const record = (await request(app).get(`/api/multimedia/${id}`)).body;
    expect(record.deletedAt).toBeTruthy();
  });
});

describe('Multimedia — GEDCOM 7 compliance', () => {
  test('OBJE record has correct GEDCOM 7 type and structure', async () => {
    const res = await request(app).post('/api/multimedia').send(OBJE_BASE);
    const obje = res.body;
    expect(obje.type).toBe('OBJE');
    expect(obje).toHaveProperty('files');
    expect(obje).toHaveProperty('notes');
    expect(obje).toHaveProperty('sourceRefs');
    expect(Array.isArray(obje.files)).toBe(true);
    expect(Array.isArray(obje.notes)).toBe(true);
  });
});
