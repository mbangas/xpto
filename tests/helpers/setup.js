/**
 * tests/helpers/setup.js
 * Shared helper: creates an isolated temp DATA_DIR and returns a fresh app instance.
 * Usage at the top of each test file:
 *
 *   const { setupTestEnv } = require('../helpers/setup');
 *   const { app, cleanup, authHeader } = setupTestEnv();
 *   afterAll(cleanup);
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const TEST_JWT_SECRET = 'test-secret-for-unit-tests';

/**
 * Creates a temporary data directory, sets process.env.DATA_DIR,
 * and loads a fresh copy of the Express app.
 *
 * @returns {{ app: import('express').Express, tmpDir: string, cleanup: () => void, authHeader: string }}
 */
function setupTestEnv() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mylineage-test-'));
  process.env.DATA_DIR = tmpDir;
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  // Clear the module cache so that lib/crud-helpers picks up the new DATA_DIR
  Object.keys(require.cache).forEach(key => {
    if (key.includes('myLineage')) delete require.cache[key];
  });

  // Generate a test admin token
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: '00000000-0000-0000-0000-000000000001', email: 'test@test.com', isAdmin: true },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
  const authHeader = 'Bearer ' + token;

  // eslint-disable-next-line global-require
  const app = require('../../server.js');

  function cleanup() {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  }

  return { app, tmpDir, cleanup, authHeader };
}

module.exports = { setupTestEnv };
