/**
 * tests/helpers/setup.js
 * Shared helper: creates an isolated temp DATA_DIR and returns a fresh app instance.
 * Usage at the top of each test file:
 *
 *   const { setupTestEnv } = require('../helpers/setup');
 *   const { app, cleanup } = setupTestEnv();
 *   afterAll(cleanup);
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/**
 * Creates a temporary data directory, sets process.env.DATA_DIR,
 * and loads a fresh copy of the Express app.
 *
 * @returns {{ app: import('express').Express, tmpDir: string, cleanup: () => void }}
 */
function setupTestEnv() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mylineage-test-'));
  process.env.DATA_DIR = tmpDir;

  // Clear the module cache so that lib/crud-helpers picks up the new DATA_DIR
  Object.keys(require.cache).forEach(key => {
    if (key.includes('myLineage')) delete require.cache[key];
  });

  // eslint-disable-next-line global-require
  const app = require('../../server.js');

  function cleanup() {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  }

  return { app, tmpDir, cleanup };
}

module.exports = { setupTestEnv };
