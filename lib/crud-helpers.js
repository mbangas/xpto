/**
 * lib/crud-helpers.js — CRUD helpers for myLineage
 * Provides readCollection, writeCollection, nextId, nowISO.
 * DATA_DIR is resolved from process.env.DATA_DIR or the default JSON-DATA path.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '..', 'JSON-DATA');
}

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nowISO() {
  return new Date().toISOString();
}

function readCollection(name) {
  ensureDataDir();
  const fpath = path.join(getDataDir(), name + '.json');
  if (!fs.existsSync(fpath)) return {};
  try { return JSON.parse(fs.readFileSync(fpath, 'utf8')); } catch (e) { return {}; }
}

function writeCollection(name, data) {
  ensureDataDir();
  fs.writeFileSync(path.join(getDataDir(), name + '.json'), JSON.stringify(data, null, 2), 'utf8');
}

function nextId(collectionName, prefix) {
  const data = readCollection(collectionName);
  let n = 1;
  while (data[prefix + n]) n++;
  return prefix + n;
}

module.exports = { getDataDir, ensureDataDir, nowISO, readCollection, writeCollection, nextId };
