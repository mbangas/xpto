/**
 * tests/unit/notes.test.js
 * Unit tests for the Notes CRUD API (/api/notes)
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-note-'));
process.env.DATA_DIR = tmpDir;

const request = require('supertest');
const app     = require('../../server.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const NOTE_BASE = { text: 'Esta é uma nota de teste para genealogia.' };

describe('Notes — CREATE', () => {
  test('creates a note and returns 201', async () => {
    const res = await request(app).post('/api/notes').send(NOTE_BASE);
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('NOTE');
    expect(res.body.id).toMatch(/^N\d+$/);
    expect(res.body.text).toBe(NOTE_BASE.text);
    expect(res.body.deletedAt).toBeNull();
  });

  test('creates an empty note (text defaults to empty string)', async () => {
    const res = await request(app).post('/api/notes').send({});
    expect(res.status).toBe(201);
    expect(typeof res.body.text).toBe('string');
  });
});

describe('Notes — READ', () => {
  let noteId;

  beforeAll(async () => {
    const res = await request(app).post('/api/notes').send(NOTE_BASE);
    noteId = res.body.id;
  });

  test('GET /api/notes returns array', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/notes/:id returns the note', async () => {
    const res = await request(app).get(`/api/notes/${noteId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(noteId);
    expect(res.body.type).toBe('NOTE');
    expect(res.body.text).toBe(NOTE_BASE.text);
  });

  test('GET on non-existent id returns 404', async () => {
    const res = await request(app).get('/api/notes/NNOPE');
    expect(res.status).toBe(404);
  });
});

describe('Notes — UPDATE', () => {
  let noteId;

  beforeAll(async () => {
    const res = await request(app).post('/api/notes').send(NOTE_BASE);
    noteId = res.body.id;
  });

  test('updates the text of a note', async () => {
    const res = await request(app).put(`/api/notes/${noteId}`)
      .send({ text: 'Texto da nota actualizado.' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Texto da nota actualizado.');
  });

  test('PUT on missing id returns 404', async () => {
    const res = await request(app).put('/api/notes/NNOPE').send({ text: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('Notes — DELETE', () => {
  test('DELETE soft-deletes a note', async () => {
    const post = await request(app).post('/api/notes').send({ text: 'A apagar' });
    const id   = post.body.id;

    const del = await request(app).delete(`/api/notes/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const rec = (await request(app).get(`/api/notes/${id}`)).body;
    expect(rec.deletedAt).toBeTruthy();
  });
});

describe('Notes — GEDCOM 7 compliance', () => {
  test('NOTE record has correct GEDCOM 7 type and structure', async () => {
    const res = await request(app).post('/api/notes').send(NOTE_BASE);
    const note = res.body;
    expect(note.type).toBe('NOTE');
    expect(note).toHaveProperty('text');
    expect(note).toHaveProperty('sourceRefs');
    expect(Array.isArray(note.sourceRefs)).toBe(true);
  });

  test('note text is stored as a plain UTF-8 string', async () => {
    const unicodeText = 'Família portuguesa com acentuação: ã, é, ó, ú, ç';
    const res = await request(app).post('/api/notes').send({ text: unicodeText });
    expect(res.status).toBe(201);
    expect(res.body.text).toBe(unicodeText);
  });
});
