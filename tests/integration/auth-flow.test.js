/**
 * tests/integration/auth-flow.test.js
 * Integration tests for the authentication system (Phase 2).
 *
 * Scenarios tested:
 *  1. Register a new user
 *  2. Login with correct credentials
 *  3. Login with wrong password → 401
 *  4. Access protected route with valid token
 *  5. Access protected route without token → 401
 *  6. Refresh token flow
 *  7. Update profile (name)
 *  8. Change password
 *  9. GET /me returns current user info
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/* ── Isolated environment ─────────────────────────────────────────────── */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-auth-test-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-auth-secret';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Admin1234!';

const request = require('supertest');

// Clear module cache to get fresh app
Object.keys(require.cache).forEach(k => {
  if (k.includes('myLineage')) delete require.cache[k];
});

const app = require('../../server.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

/* ── Helpers ──────────────────────────────────────────────────────────── */
const TEST_USER = {
  name: 'João Teste',
  email: 'joao@test.local',
  password: 'Segredo123!',
};

let accessToken = '';
let refreshToken = '';

/* ══════════════════════════════════════════════════════════════════════ */
describe('Auth — Registration & Login', () => {

  test('POST /api/auth/register creates a new account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user.name).toBe(TEST_USER.name);
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  test('POST /api/auth/register with duplicate email fails', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(TEST_USER);

    expect(res.status).toBe(409);
  });

  test('POST /api/auth/login with valid credentials returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  test('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login with unknown email returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@test.local', password: 'any' });

    expect(res.status).toBe(401);
  });
});

describe('Auth — Protected routes', () => {

  test('GET /api/auth/me returns user info', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ' + accessToken);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_USER.email);
    expect(res.body.name).toBe(TEST_USER.name);
  });

  test('GET /api/auth/me without token → 401', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  test('Protected API route without token → 401', async () => {
    const res = await request(app)
      .get('/api/trees');

    expect(res.status).toBe(401);
  });

  test('Protected API route with valid token succeeds', async () => {
    const res = await request(app)
      .get('/api/trees')
      .set('Authorization', 'Bearer ' + accessToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Auth — Token refresh', () => {

  test('POST /api/auth/refresh with valid refresh token returns new tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  test('POST /api/auth/refresh with invalid token → 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(res.status).toBe(401);
  });
});

describe('Auth — Profile updates', () => {

  test('PUT /api/auth/me updates user name', async () => {
    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', 'Bearer ' + accessToken)
      .send({ name: 'João Actualizado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('João Actualizado');
  });

  test('PUT /api/auth/me/password changes password', async () => {
    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', 'Bearer ' + accessToken)
      .send({ currentPassword: TEST_USER.password, newPassword: 'NovaPass456!' });

    expect(res.status).toBe(200);

    // Verify new password works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'NovaPass456!' });

    expect(loginRes.status).toBe(200);
  });
});
