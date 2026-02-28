/**
 * remote-storage.js — myLineage GEDCOM 7 Data Access Layer
 * Loads all GEDCOM data from server at page load (sync XHR).
 * Provides window.GedcomDB for all data operations.
 * All mutations are applied locally + async-synced to server.
 */
(function(){
  'use strict';
  const API = '/api';

  /* ── Sync XHR ────────────────────────────────────────────────────────── */
  function syncGet(url) {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', url, false);
      x.send(null);
      if (x.status >= 200 && x.status < 300) return JSON.parse(x.responseText);
    } catch(e) {}
    return null;
  }

  /* ── Async helpers ───────────────────────────────────────────────────── */
  function asyncJson(method, url, body) {
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined
    }).catch(() => {});
  }

  /* ── In-memory caches ────────────────────────────────────────────────── */
  let _individuals = {};
  let _families    = {};
  let _sources     = {};
  let _repositories = {};
  let _multimedia  = {};
  let _notes       = {};
  let _submitters  = {};
  let _settings    = {};
  let _history     = [];

  function toMap(arr) {
    const m = {};
    if (Array.isArray(arr)) arr.forEach(r => { if (r && r.id) m[r.id] = r; });
    return m;
  }

  /* ── Load all data synchronously at init ─────────────────────────────── */
  function loadAll() {
    _individuals  = toMap(syncGet(API + '/individuals?includeDeleted=true'));
    _families     = toMap(syncGet(API + '/families?includeDeleted=true'));
    _sources      = toMap(syncGet(API + '/sources?includeDeleted=true'));
    _repositories = toMap(syncGet(API + '/repositories?includeDeleted=true'));
    _multimedia   = toMap(syncGet(API + '/multimedia?includeDeleted=true'));
    _notes        = toMap(syncGet(API + '/notes?includeDeleted=true'));
    _submitters   = toMap(syncGet(API + '/submitters?includeDeleted=true'));
    _settings     = syncGet(API + '/settings') || {};
    _history      = syncGet(API + '/history') || [];
  }
  loadAll();

  /* ── ID generation ───────────────────────────────────────────────────── */
  function nextId(map, prefix) {
    let n = 1; while (map[prefix + n]) n++;
    return prefix + n;
  }

  function nowISO() { return new Date().toISOString(); }

  /* ── Generic CRUD helpers ────────────────────────────────────────────── */
  function createEntity(cache, endpoint, prefix, data) {
    const id = data.id || nextId(cache, prefix);
    const now = nowISO();
    const rec = { ...data, id, createdAt: data.createdAt || now, updatedAt: now, deletedAt: null };
    cache[id] = rec;
    asyncJson('POST', API + endpoint, rec);
    return rec;
  }

  function updateEntity(cache, endpoint, id, data) {
    if (!cache[id]) return null;
    const rec = { ...cache[id], ...data, id, updatedAt: nowISO() };
    cache[id] = rec;
    asyncJson('PUT', API + endpoint + '/' + id, rec);
    return rec;
  }

  function deleteEntity(cache, endpoint, id) {
    if (!cache[id]) return false;
    cache[id] = { ...cache[id], deletedAt: nowISO(), updatedAt: nowISO() };
    asyncJson('DELETE', API + endpoint + '/' + id);
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     GedcomDB — Public API
     ═══════════════════════════════════════════════════════════════════════ */
  const DB = {};

  /* ── Individuals ─────────────────────────────────────────────────────── */
  DB.getIndividuals = function(includeDeleted) {
    return Object.values(_individuals).filter(r => includeDeleted || !r.deletedAt);
  };
  DB.getIndividual = function(id) { return _individuals[id] || null; };
  DB.saveIndividual = function(data) {
    if (data.id && _individuals[data.id]) return updateEntity(_individuals, '/individuals', data.id, data);
    return createEntity(_individuals, '/individuals', 'I', data);
  };
  DB.deleteIndividual = function(id) { return deleteEntity(_individuals, '/individuals', id); };

  /* ── Families ────────────────────────────────────────────────────────── */
  DB.getFamilies = function(includeDeleted) {
    return Object.values(_families).filter(r => includeDeleted || !r.deletedAt);
  };
  DB.getFamily = function(id) { return _families[id] || null; };
  DB.saveFamily = function(data) {
    if (data.id && _families[data.id]) return updateEntity(_families, '/families', data.id, data);
    return createEntity(_families, '/families', 'F', data);
  };
  DB.deleteFamily = function(id) { return deleteEntity(_families, '/families', id); };

  /* ── Sources ─────────────────────────────────────────────────────────── */
  DB.getSources = function(includeDeleted) {
    return Object.values(_sources).filter(r => includeDeleted || !r.deletedAt);
  };
  DB.getSource = function(id) { return _sources[id] || null; };
  DB.saveSource = function(data) {
    if (data.id && _sources[data.id]) return updateEntity(_sources, '/sources', data.id, data);
    return createEntity(_sources, '/sources', 'S', data);
  };
  DB.deleteSource = function(id) { return deleteEntity(_sources, '/sources', id); };

  /* ── Repositories ────────────────────────────────────────────────────── */
  DB.getRepositories = function(includeDeleted) {
    return Object.values(_repositories).filter(r => includeDeleted || !r.deletedAt);
  };
  DB.getRepository = function(id) { return _repositories[id] || null; };
  DB.saveRepository = function(data) {
    if (data.id && _repositories[data.id]) return updateEntity(_repositories, '/repositories', data.id, data);
    return createEntity(_repositories, '/repositories', 'R', data);
  };
  DB.deleteRepository = function(id) { return deleteEntity(_repositories, '/repositories', id); };

  /* ── Multimedia ──────────────────────────────────────────────────────── */
  DB.getMultimedia = function(includeDeleted) {
    return Object.values(_multimedia).filter(r => includeDeleted || !r.deletedAt);
  };
  DB.getMultimediaItem = function(id) { return _multimedia[id] || null; };
  DB.saveMultimedia = function(data) {
    if (data.id && _multimedia[data.id]) return updateEntity(_multimedia, '/multimedia', data.id, data);
    return createEntity(_multimedia, '/multimedia', 'M', data);
  };
  DB.deleteMultimedia = function(id) { return deleteEntity(_multimedia, '/multimedia', id); };

  /* ── Notes ───────────────────────────────────────────────────────────── */
  DB.getNotes = function(includeDeleted) {
    return Object.values(_notes).filter(r => includeDeleted || !r.deletedAt);
  };
  DB.getNote = function(id) { return _notes[id] || null; };
  DB.saveNote = function(data) {
    if (data.id && _notes[data.id]) return updateEntity(_notes, '/notes', data.id, data);
    return createEntity(_notes, '/notes', 'N', data);
  };
  DB.deleteNote = function(id) { return deleteEntity(_notes, '/notes', id); };

  /* ── Submitters ──────────────────────────────────────────────────────── */
  DB.getSubmitters = function(includeDeleted) {
    return Object.values(_submitters).filter(r => includeDeleted || !r.deletedAt);
  };
  DB.getSubmitter = function(id) { return _submitters[id] || null; };
  DB.saveSubmitter = function(data) {
    if (data.id && _submitters[data.id]) return updateEntity(_submitters, '/submitters', data.id, data);
    return createEntity(_submitters, '/submitters', 'U', data);
  };
  DB.deleteSubmitter = function(id) { return deleteEntity(_submitters, '/submitters', id); };

  /* ── Settings ────────────────────────────────────────────────────────── */
  DB.getSetting = function(key) { return _settings[key] !== undefined ? _settings[key] : null; };
  DB.setSetting = function(key, value) {
    _settings[key] = value;
    const patch = {}; patch[key] = value;
    asyncJson('PUT', API + '/settings', patch);
  };
  DB.getSettings = function() { return { ..._settings }; };

  /* ── History ─────────────────────────────────────────────────────────── */
  DB.getHistory = function() { return _history.slice(); };
  DB.addHistory = function(entries) {
    const arr = Array.isArray(entries) ? entries : [entries];
    _history = arr.concat(_history).slice(0, 500);
    asyncJson('POST', API + '/history', arr);
  };
  DB.clearHistory = function() {
    _history = [];
    fetch(API + '/history', { method: 'DELETE' }).catch(() => {});
  };

  /* ═══════════════════════════════════════════════════════════════════════
     Convenience helpers (used by frontend pages)
     ═══════════════════════════════════════════════════════════════════════ */

  /** Get display name for an individual */
  DB.getDisplayName = function(indi) {
    if (!indi) return '(sem nome)';
    const n = (indi.names && indi.names[0]) || {};
    const full = ((n.given || '') + ' ' + (n.surname || '')).trim();
    return full || '(sem nome)';
  };

  /** Get given name */
  DB.getGivenName = function(indi) {
    const n = (indi && indi.names && indi.names[0]) || {};
    return n.given || '';
  };

  /** Get surname */
  DB.getSurname = function(indi) {
    const n = (indi && indi.names && indi.names[0]) || {};
    return n.surname || '';
  };

  /** Get birth event */
  DB.getBirthEvent = function(indi) {
    if (!indi) return null;
    return (indi.events || []).find(e => e.type === 'BIRT') || null;
  };

  /** Get death event */
  DB.getDeathEvent = function(indi) {
    if (!indi) return null;
    return (indi.events || []).find(e => e.type === 'DEAT') || null;
  };

  /** Get event of specific type */
  DB.getEvent = function(indi, type) {
    if (!indi) return null;
    return (indi.events || []).find(e => e.type === type) || null;
  };

  /** Get parents of an individual */
  DB.getParents = function(indiId) {
    const indi = _individuals[indiId];
    if (!indi || !indi.famc) return [];
    const fam = _families[indi.famc];
    if (!fam) return [];
    const parents = [];
    if (fam.husb && _individuals[fam.husb] && !_individuals[fam.husb].deletedAt) parents.push(_individuals[fam.husb]);
    if (fam.wife && _individuals[fam.wife] && !_individuals[fam.wife].deletedAt) parents.push(_individuals[fam.wife]);
    return parents;
  };

  /** Get children of an individual */
  DB.getChildren = function(indiId) {
    const indi = _individuals[indiId];
    if (!indi) return [];
    const children = [];
    (indi.fams || []).forEach(fid => {
      const fam = _families[fid];
      if (!fam) return;
      (fam.children || []).forEach(cid => {
        const c = _individuals[cid];
        if (c && !c.deletedAt && !children.find(x => x.id === cid)) children.push(c);
      });
    });
    return children;
  };

  /** Get spouses of an individual */
  DB.getSpouses = function(indiId) {
    const indi = _individuals[indiId];
    if (!indi) return [];
    const spouses = [];
    (indi.fams || []).forEach(fid => {
      const fam = _families[fid];
      if (!fam) return;
      if (fam.husb && fam.husb !== indiId && _individuals[fam.husb] && !_individuals[fam.husb].deletedAt)
        spouses.push(_individuals[fam.husb]);
      if (fam.wife && fam.wife !== indiId && _individuals[fam.wife] && !_individuals[fam.wife].deletedAt)
        spouses.push(_individuals[fam.wife]);
    });
    return spouses;
  };

  /** Get siblings of an individual */
  DB.getSiblings = function(indiId) {
    const indi = _individuals[indiId];
    if (!indi || !indi.famc) return [];
    const fam = _families[indi.famc];
    if (!fam) return [];
    return (fam.children || [])
      .filter(cid => cid !== indiId)
      .map(cid => _individuals[cid])
      .filter(c => c && !c.deletedAt);
  };

  /** Get family as child */
  DB.getFamilyAsChild = function(indiId) {
    const indi = _individuals[indiId];
    if (!indi || !indi.famc) return null;
    return _families[indi.famc] || null;
  };

  /** Get families as spouse */
  DB.getFamiliesAsSpouse = function(indiId) {
    const indi = _individuals[indiId];
    if (!indi) return [];
    return (indi.fams || []).map(fid => _families[fid]).filter(Boolean);
  };

  /** Create or find family for a couple, returns family record */
  DB.ensureFamily = function(spouse1Id, spouse2Id) {
    const s1 = _individuals[spouse1Id], s2 = _individuals[spouse2Id];
    if (!s1 || !s2) return null;
    // Check if family already exists
    for (const fid of (s1.fams || [])) {
      const f = _families[fid];
      if (!f || f.deletedAt) continue;
      if ((f.husb === spouse1Id && f.wife === spouse2Id) || (f.husb === spouse2Id && f.wife === spouse1Id)) return f;
    }
    // Create new family
    const husb = (s1.sex === 'M') ? spouse1Id : (s2.sex === 'M') ? spouse2Id : spouse1Id;
    const wife = husb === spouse1Id ? spouse2Id : spouse1Id;
    const fam = DB.saveFamily({ husb, wife, children: [], events: [] });
    // Link individuals
    if (!s1.fams) s1.fams = [];
    if (!s2.fams) s2.fams = [];
    if (!s1.fams.includes(fam.id)) { s1.fams.push(fam.id); DB.saveIndividual(s1); }
    if (!s2.fams.includes(fam.id)) { s2.fams.push(fam.id); DB.saveIndividual(s2); }
    return fam;
  };

  /** Add child to a family */
  DB.addChildToFamily = function(familyId, childId) {
    const fam = _families[familyId];
    const child = _individuals[childId];
    if (!fam || !child) return;
    if (!fam.children) fam.children = [];
    if (!fam.children.includes(childId)) {
      fam.children.push(childId);
      DB.saveFamily(fam);
    }
    child.famc = familyId;
    DB.saveIndividual(child);
  };

  /** Parse GEDCOM date string to display format */
  DB.formatDate = function(dateStr) {
    if (!dateStr) return '';
    return dateStr; // Already in GEDCOM format like "1 JAN 1980"
  };

  /** Extract year from GEDCOM date */
  DB.extractYear = function(dateStr) {
    if (!dateStr) return null;
    const m = String(dateStr).match(/\d{3,4}/);
    return m ? parseInt(m[0], 10) : null;
  };

  /** Compute age between two GEDCOM dates */
  DB.computeAge = function(birthDate, refDate) {
    const by = DB.extractYear(birthDate);
    const ry = refDate ? DB.extractYear(refDate) : new Date().getFullYear();
    if (!by || !ry) return null;
    return ry - by;
  };

  /** Get multimedia items linked to an individual */
  DB.getMultimediaForIndividual = function(indiId) {
    const indi = _individuals[indiId];
    if (!indi) return [];
    return (indi.multimediaRefs || []).map(mid => _multimedia[mid]).filter(m => m && !m.deletedAt);
  };

  /** Get thumbnail URL for an individual */
  DB.getThumbnailForPerson = function(indiId) {
    const media = DB.getMultimediaForIndividual(indiId);
    for (const m of media) {
      if (m.dataUrl) return m.dataUrl;
      // only use file path if it looks like a valid URL (not a bare filename)
      if (m.files && m.files.length && m.files[0].file) {
        const f = m.files[0].file;
        if (f.startsWith('data:') || f.startsWith('http') || f.startsWith('/')) return f;
      }
    }
    return null;
  };

  /** Bulk replace (used by GEDCOM import) */
  DB.bulkReplace = function(data) {
    if (data.individuals) _individuals = data.individuals;
    if (data.families) _families = data.families;
    if (data.sources) _sources = data.sources || {};
    if (data.repositories) _repositories = data.repositories || {};
    if (data.multimedia) _multimedia = data.multimedia || {};
    if (data.notes) _notes = data.notes || {};
    if (data.submitters) _submitters = data.submitters || {};
    asyncJson('POST', API + '/bulk-replace', data);
  };

  /** Reload from server */
  DB.reload = function() { loadAll(); };

  /* ── Gender placeholder SVG ──────────────────────────────────────────── */
  DB.genderPlaceholder = function(sex) {
    const color = (sex === 'F') ? '#e26aa6' : (sex === 'M') ? '#4a90e2' : '#9aa0a6';
    const svg = `<?xml version='1.0' encoding='UTF-8'?><svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 120 120'><rect width='100%' height='100%' fill='${color}' rx='12'/><g fill='#ffffff' transform='translate(30,20)'><circle cx='30' cy='24' r='16'/><path d='M6 80c0-18 36-18 48-18s48 0 48 18v6H6v-6z'/></g></svg>`;
    try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); }
    catch (e) { return 'data:image/svg+xml;base64,' + btoa(svg); }
  };

  /* ── Expose ──────────────────────────────────────────────────────────── */
  window.GedcomDB = DB;

})();
