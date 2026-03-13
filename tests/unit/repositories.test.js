/**
 * tests/unit/repositories.test.js
 * Unit tests for the Repositories CRUD API (/api/repositories)
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-repo-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const request = require('supertest');
const app     = require('../../server.js');

const jwt = require('jsonwebtoken');
const _testToken = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000001', email: 'test@test.com', isAdmin: true },
  process.env.JWT_SECRET, { expiresIn: '1h' });
const AUTH = { Authorization: 'Bearer ' + _testToken };

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const REPO_BASE = {
  name:    'Arquivo Distrital de Lisboa',
  address: { addr: 'Rua das Flores, 1', city: 'Lisboa', state: '', postal: '1200-001', country: 'PT' },
  phone:   '+351 213 000 000',
  email:   'arquivo@adlisboa.pt',
  web:     'https://adlisboa.pt',
};

describe('Repositories — CREATE', () => {
  test('creates a repository with 201 and correct fields', async () => {
    const res = await request(app).post('/api/repositories').set(AUTH).send(REPO_BASE);
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('REPO');
    expect(res.body.id).toMatch(/^R\d+$/);
    expect(res.body.name).toBe(REPO_BASE.name);
    expect(res.body.deletedAt).toBeNull();
  });

  test('creates minimal repository with just a name', async () => {
    const res = await request(app).post('/api/repositories').set(AUTH).send({ name: 'Arquivo Simples' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Arquivo Simples');
  });
});

describe('Repositories — READ', () => {
  let repoId;

  beforeAll(async () => {
    const res = await request(app).post('/api/repositories').set(AUTH).send(REPO_BASE);
    repoId = res.body.id;
  });

  test('GET /api/repositories returns array', async () => {
    const res = await request(app).get('/api/repositories').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/repositories/:id returns the repository', async () => {
    const res = await request(app).get(`/api/repositories/${repoId}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(repoId);
  });

  test('GET /api/repositories/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/repositories/RNOPE').set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('Repositories — UPDATE', () => {
  let repoId;

  beforeAll(async () => {
    const res = await request(app).post('/api/repositories').set(AUTH).send(REPO_BASE);
    repoId = res.body.id;
  });

  test('updates a repository name', async () => {
    const res = await request(app).put(`/api/repositories/${repoId}`)
      .set(AUTH).send({ name: 'Arquivo Nacional Torre do Tombo' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Arquivo Nacional Torre do Tombo');
  });
});

describe('Repositories — DELETE', () => {
  test('DELETE soft-deletes a repository', async () => {
    const post = await request(app).post('/api/repositories').set(AUTH).send({ name: 'A Apagar' });
    const id   = post.body.id;

    const del = await request(app).delete(`/api/repositories/${id}`).set(AUTH);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const record = (await request(app).get(`/api/repositories/${id}`).set(AUTH)).body;
    expect(record.deletedAt).toBeTruthy();
  });
});

describe('Repositories — GEDCOM 7 compliance', () => {
  test('repository has REPO type and expected fields', async () => {
    const res = await request(app).post('/api/repositories').set(AUTH).send(REPO_BASE);
    const repo = res.body;
    expect(repo.type).toBe('REPO');
    expect(repo).toHaveProperty('name');
    expect(repo).toHaveProperty('address');
    expect(repo).toHaveProperty('notes');
    expect(Array.isArray(repo.notes)).toBe(true);
  });
});
