/**
 * routes/genealogy.js — Tree-scoped genealogy routes for myLineage.
 *
 * All routes are mounted under /api/trees/:treeId/
 * The treeAuthMiddleware has already run, so req.treeId and req.treeRole
 * are available.
 *
 * Provides:
 *   /{collection}           — CRUD for individuals, families, sources, etc.
 *   /bulk-replace           — Bulk replace multiple collections
 *   /header                 — GEDCOM header
 *   /settings               — Tree settings (key/value)
 *   /history                — Tree history log
 *   /stats                  — Tree statistics
 *   /gedcom/export          — GEDCOM 7 export
 *   /gedcom/import          — GEDCOM 7 import
 *   /multimedia/cache-status — External image cache status
 *   /multimedia/refresh-zones — Refresh zone tags
 *   /topola-json            — Topola-compatible JSON
 *   /surname-research/:surname — Surname genealogical research
 */

'use strict';

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');

const {
  readCollection, writeCollection, nextId, nowISO, ensureDataDir, getDataDir,
  readTreeSettings, writeTreeSettings, deleteTreeSettings,
  readTreeHistory, appendTreeHistory, clearTreeHistory,
} = require('../lib/crud-helpers');
const { parseGedcomToJson } = require('../lib/gedcom-parser');
const { buildGedcomText }   = require('../lib/gedcom-builder');
const { requireTreeRole }   = require('../lib/tree-auth');

const router = express.Router({ mergeParams: true }); // mergeParams so :treeId is available

/* ── Async helper — resolves value whether it is a Promise or not ──── */
function resolve(v) { return v instanceof Promise ? v : Promise.resolve(v); }

/* ── Generic CRUD router factory (tree-scoped) ────────────────────── */
function entityRoutes(collectionName, idPrefix, defaultFn) {
  const sub = express.Router({ mergeParams: true });

  sub.get('/', async (req, res) => {
    try {
      const data = await resolve(readCollection(req.treeId, collectionName));
      const all = req.query.includeDeleted === 'true';
      res.json(Object.values(data).filter(r => all || !r.deletedAt));
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  sub.get('/:id', async (req, res) => {
    try {
      const rec = (await resolve(readCollection(req.treeId, collectionName)))[req.params.id];
      if (!rec) return res.status(404).json({ error: 'Not found' });
      res.json(rec);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  sub.post('/', requireTreeRole('owner', 'writer'), async (req, res) => {
    try {
      const data = await resolve(readCollection(req.treeId, collectionName));
      const id = req.body.id || await resolve(nextId(req.treeId, collectionName, idPrefix));
      const now = nowISO();
      const rec = { ...defaultFn(), ...req.body, id, createdAt: req.body.createdAt || now, updatedAt: now, deletedAt: null };
      data[id] = rec;
      await resolve(writeCollection(req.treeId, collectionName, data));
      res.status(201).json(rec);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  sub.put('/:id', requireTreeRole('owner', 'writer'), async (req, res) => {
    try {
      const data = await resolve(readCollection(req.treeId, collectionName));
      if (!data[req.params.id]) return res.status(404).json({ error: 'Not found' });
      const rec = { ...data[req.params.id], ...req.body, id: req.params.id, updatedAt: nowISO() };
      data[req.params.id] = rec;
      await resolve(writeCollection(req.treeId, collectionName, data));
      res.json(rec);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  sub.delete('/:id', requireTreeRole('owner', 'writer'), async (req, res) => {
    try {
      const data = await resolve(readCollection(req.treeId, collectionName));
      if (!data[req.params.id]) return res.status(404).json({ error: 'Not found' });
      data[req.params.id] = { ...data[req.params.id], deletedAt: nowISO(), updatedAt: nowISO() };
      await resolve(writeCollection(req.treeId, collectionName, data));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  return sub;
}

/* ── Default record factories (GEDCOM 7) ─────────────────────────────── */
function defaultIndividual() {
  return { id:'',type:'INDI', names:[], sex:'U', events:[], attributes:[], famc:null, fams:[], notes:[], sourceRefs:[], multimediaRefs:[], createdAt:'', updatedAt:'', deletedAt:null };
}
function defaultFamily() {
  return { id:'',type:'FAM', husb:null, wife:null, children:[], events:[], notes:[], sourceRefs:[], multimediaRefs:[], createdAt:'', updatedAt:'', deletedAt:null };
}
function defaultSource() {
  return { id:'',type:'SOUR', title:'', author:'', publication:'', abbreviation:'', text:'', repositoryRef:null, callNumber:'', notes:[], multimediaRefs:[], createdAt:'', updatedAt:'', deletedAt:null };
}
function defaultRepository() {
  return { id:'',type:'REPO', name:'', address:{addr:'',city:'',state:'',postal:'',country:''}, phone:'', email:'', web:'', notes:[], createdAt:'', updatedAt:'', deletedAt:null };
}
function defaultMultimedia() {
  return { id:'',type:'OBJE', files:[], notes:[], sourceRefs:[], dataUrl:null, tags:[], createdAt:'', updatedAt:'', deletedAt:null };
}
function defaultNote() {
  return { id:'',type:'NOTE', text:'', sourceRefs:[], createdAt:'', updatedAt:'', deletedAt:null };
}
function defaultSubmitter() {
  return { id:'',type:'SUBM', name:'', address:{addr:'',city:'',state:'',postal:'',country:''}, phone:'', email:'', web:'', language:'', notes:[], createdAt:'', updatedAt:'', deletedAt:null };
}
function defaultHistoricalFact() {
  return { id:'', titulo:'', dia:null, mes:null, anoInicio:null, anoFim:null, facto:'', pais:'Mundial', createdAt:'', updatedAt:'', deletedAt:null };
}

/* ── External image cache helpers ─────────────────────────────────────── */
let _cacheRunning = false;

function _fetchBuf(url) {
  return new Promise(resolve => {
    try {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { timeout: 15000 }, res => {
        if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end',  () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      });
      req.on('error',   () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch(_e) { resolve(null); }
  });
}

function getUploadsDir(treeId) {
  return path.join(__dirname, '..', 'uploads', treeId, 'fotos');
}

function getUploadsUrlPrefix(treeId) {
  return '/uploads/' + treeId + '/fotos/';
}

async function cacheExternalImages(treeId, multimedia) {
  if (_cacheRunning) return;
  _cacheRunning = true;
  const fotosDir = getUploadsDir(treeId);
  try {
    fs.mkdirSync(fotosDir, { recursive: true });
    const pending = Object.values(multimedia).filter(m =>
      !m.deletedAt && m.files && m.files[0] && /^https?:\/\//i.test(m.files[0].file)
    );
    if (!pending.length) return;
    console.log(`[media] A descarregar ${pending.length} fotos externas (tree=${treeId})...`);
    const CONCURRENCY = 4;
    let done = 0;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async m => {
        const url     = m.files[0].file;
        const rawExt  = url.split('?')[0].split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const ext     = ['jpg','jpeg','png','gif','webp','bmp'].includes(rawExt) ? rawExt : 'jpg';
        const safeName = m.id.replace(/[^a-zA-Z0-9_-]/g, '_') + '.' + ext;
        const destPath = path.join(fotosDir, safeName);
        const localPath = getUploadsUrlPrefix(treeId) + safeName;
        if (fs.existsSync(destPath)) { m.files[0].file = localPath; done++; return; }
        const buf = await _fetchBuf(url);
        if (buf && buf.length > 0) {
          try { fs.writeFileSync(destPath, buf); m.files[0].file = localPath; done++; } catch(_e) {}
        }
      }));
      await resolve(writeCollection(treeId, 'multimedia', multimedia));
    }
    console.log(`[media] Concluído: ${done}/${pending.length} fotos guardadas (tree=${treeId}).`);
  } finally { _cacheRunning = false; }
}

/* ── Cache status ────────────────────────────────────────────────────── */
router.get('/multimedia/cache-status', async (req, res) => {
  try {
    const mm = await resolve(readCollection(req.treeId, 'multimedia'));
    const all     = Object.values(mm).filter(m => !m.deletedAt && m.files && m.files[0]);
    const cached  = all.filter(m => !/^https?:\/\//i.test(m.files[0].file || '')).length;
    const pending = all.length - cached;
    res.json({ total: all.length, cached, pending, running: _cacheRunning });
  } catch(e) { res.status(500).json({ error: String(e) }); }
});

/* ── Refresh zone tags ───────────────────────────────────────────────── */
router.post('/multimedia/refresh-zones', requireTreeRole('owner', 'writer'), async (req, res) => {
  try {
    const individuals = await resolve(readCollection(req.treeId, 'individuals'));
    const multimedia  = await resolve(readCollection(req.treeId, 'multimedia'));
    let added = 0;

    for (const indi of Object.values(individuals)) {
      if (indi.deletedAt) continue;
      const nameRec = (indi.names && indi.names[0]) || {};
      const personName = ((nameRec.given || '') + ' ' + (nameRec.surname || '')).trim() || indi.id;
      for (const mref of (indi.multimediaRefs || [])) {
        const mm = multimedia[mref];
        if (!mm) continue;
        if (!mm.tags) mm.tags = [];
        let tag = mm.tags.find(t => t.personId === indi.id);
        if (tag) {
          if (!tag.personName) { tag.personName = personName; added++; }
          continue;
        }
        let pixelCoords = null;
        if (mm.files) {
          for (const f of mm.files) {
            if (!f.position) continue;
            const parts = f.position.trim().split(/\s+/).map(Number);
            if (parts.length === 4 && !parts.some(n => isNaN(n))) {
              const [x1, y1, x2, y2] = parts;
              pixelCoords = { x1, y1, x2, y2 };
              break;
            }
          }
        }
        tag = { personId: indi.id, personName };
        if (pixelCoords) tag.pixelCoords = pixelCoords;
        mm.tags.push(tag);
        added++;
      }
    }

    await resolve(writeCollection(req.treeId, 'multimedia', multimedia));
    res.json({ ok: true, zonesAdded: added });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Mount entity CRUD routes ────────────────────────────────────────── */
router.use('/individuals',      entityRoutes('individuals','I', defaultIndividual));
router.use('/families',         entityRoutes('families','F', defaultFamily));
router.use('/sources',          entityRoutes('sources','S', defaultSource));
router.use('/repositories',     entityRoutes('repositories','R', defaultRepository));
router.use('/multimedia',       entityRoutes('multimedia','M', defaultMultimedia));
router.use('/notes',            entityRoutes('notes','N', defaultNote));
router.use('/submitters',       entityRoutes('submitters','U', defaultSubmitter));
router.use('/historical-facts', entityRoutes('historical-facts','H', defaultHistoricalFact));

/* ── Bulk replace ────────────────────────────────────────────────────── */
router.post('/bulk-replace', requireTreeRole('owner', 'writer'), async (req, res) => {
  try {
    const b = req.body;
    const tid = req.treeId;
    if (b.individuals)  await resolve(writeCollection(tid, 'individuals', b.individuals));
    if (b.families)     await resolve(writeCollection(tid, 'families', b.families));
    if (b.sources)      await resolve(writeCollection(tid, 'sources', b.sources));
    if (b.repositories) await resolve(writeCollection(tid, 'repositories', b.repositories));
    if (b.multimedia)   await resolve(writeCollection(tid, 'multimedia', b.multimedia));
    if (b.notes)        await resolve(writeCollection(tid, 'notes', b.notes));
    if (b.submitters)   await resolve(writeCollection(tid, 'submitters', b.submitters));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Header ──────────────────────────────────────────────────────────── */
router.get('/header', (req, res) => {
  try {
    ensureDataDir();
    const fp = path.join(getDataDir(), 'header.json');
    if (!fs.existsSync(fp)) return res.json({ gedc:{vers:'7.0'}, sour:{name:'myLineage',vers:'2.0'}, charset:'UTF-8' });
    res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
router.put('/header', requireTreeRole('owner', 'writer'), (req, res) => {
  try { ensureDataDir(); fs.writeFileSync(path.join(getDataDir(),'header.json'), JSON.stringify(req.body,null,2),'utf8'); res.json(req.body); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Settings (tree-scoped) ──────────────────────────────────────────── */
router.get('/settings', async (req, res) => {
  try {
    const settings = await readTreeSettings(req.treeId);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
router.put('/settings', requireTreeRole('owner', 'writer'), async (req, res) => {
  try {
    const current = await readTreeSettings(req.treeId);
    const merged  = { ...current, ...req.body };
    await writeTreeSettings(req.treeId, req.body);
    res.json(merged);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
router.delete('/settings', requireTreeRole('owner'), async (req, res) => {
  try {
    await deleteTreeSettings(req.treeId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── History (tree-scoped) ───────────────────────────────────────────── */
router.get('/history', async (req, res) => {
  try {
    const history = await readTreeHistory(req.treeId);
    res.json(history);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
router.post('/history', requireTreeRole('owner', 'writer'), async (req, res) => {
  try {
    await appendTreeHistory(req.treeId, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
router.delete('/history', requireTreeRole('owner'), async (req, res) => {
  try {
    await clearTreeHistory(req.treeId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Stats ───────────────────────────────────────────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const tid = req.treeId;
    const indis = Object.values(await resolve(readCollection(tid, 'individuals'))).filter(r=>!r.deletedAt);
    const fams  = Object.values(await resolve(readCollection(tid, 'families'))).filter(r=>!r.deletedAt);
    let births=0, deaths=0, marriages=0, baptisms=0, burials=0, divorces=0;
    indis.forEach(i => { (i.events||[]).forEach(ev => {
      const t = (ev.type||'').toUpperCase();
      if (t==='BIRT') births++; if (t==='DEAT') deaths++;
      if (t==='BAPM'||t==='CHR') baptisms++; if (t==='BURI') burials++;
    }); });
    fams.forEach(f => { (f.events||[]).forEach(ev => {
      const t = (ev.type||'').toUpperCase();
      if (t==='MARR') marriages++; if (t==='DIV') divorces++;
    }); });
    res.json({ individuals:indis.length, families:fams.length,
      sources: Object.values(await resolve(readCollection(tid, 'sources'))).filter(r=>!r.deletedAt).length,
      multimedia: Object.values(await resolve(readCollection(tid, 'multimedia'))).filter(r=>!r.deletedAt).length,
      births, deaths, marriages, baptisms, burials, divorces,
      males: indis.filter(i=>i.sex==='M').length,
      females: indis.filter(i=>i.sex==='F').length });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── GEDCOM 7 Export ─────────────────────────────────────────────────── */
router.get('/gedcom/export', async (req, res) => {
  try {
    const tid = req.treeId;
    const gedText = buildGedcomText({
      individuals:  await resolve(readCollection(tid, 'individuals')),
      families:     await resolve(readCollection(tid, 'families')),
      multimedia:   await resolve(readCollection(tid, 'multimedia')),
      sources:      await resolve(readCollection(tid, 'sources')),
      repositories: await resolve(readCollection(tid, 'repositories')),
      notes:        await resolve(readCollection(tid, 'notes')),
      submitters:   await resolve(readCollection(tid, 'submitters')),
    });
    if (req.query.format === 'file') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="myLineage_export.ged"');
    }
    res.send(gedText);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── GEDCOM Import ───────────────────────────────────────────────────── */
router.post('/gedcom/import', requireTreeRole('owner', 'writer'), express.text({ type: '*/*', limit: '50mb' }), async (req, res) => {
  try {
    const tid = req.treeId;
    const text = typeof req.body === 'string' ? req.body : (req.body.text || '');
    const result = parseGedcomToJson(text);
    await resolve(writeCollection(tid, 'individuals', result.individuals));
    await resolve(writeCollection(tid, 'families', result.families));
    // Merge existing multimedia tags (zones) into newly imported records
    if (result.multimedia && Object.keys(result.multimedia).length) {
      const oldMm = await resolve(readCollection(tid, 'multimedia'));
      const oldByFile = {};
      const oldIdToLocal = {};
      for (const om of Object.values(oldMm)) {
        if (!om.files || !om.files[0]) continue;
        const localFile = om.files[0].file;
        if (om.tags && om.tags.length && localFile) {
          oldByFile[localFile] = om.tags;
        }
        oldIdToLocal[om.id] = localFile;
      }
      for (const nm of Object.values(result.multimedia)) {
        // Preserve local file path if the image was already cached
        if (nm.files && nm.files[0] && /^https?:\/\//i.test(nm.files[0].file)) {
          const oldLocal = oldIdToLocal[nm.id];
          if (oldLocal && /^\/uploads\//.test(oldLocal)) {
            const destPath = path.join(__dirname, '..', oldLocal);
            if (fs.existsSync(destPath)) {
              nm.files[0].file = oldLocal;
            }
          }
        }
        // Merge existing zone tags
        const existingTags = (oldMm[nm.id] && oldMm[nm.id].tags && oldMm[nm.id].tags.length)
          ? oldMm[nm.id].tags
          : (nm.files && nm.files[0] && nm.files[0].file && oldByFile[nm.files[0].file]) || null;
        if (existingTags && existingTags.length) {
          const merged = [...(nm.tags || [])];
          for (const et of existingTags) {
            if (!et.personId) continue;
            if (!merged.some(t => t.personId === et.personId)) merged.push(et);
          }
          nm.tags = merged;
        }
      }
      await resolve(writeCollection(tid, 'multimedia', result.multimedia));
    }
    const pendingImages = Object.values(result.multimedia || {}).filter(m =>
      !m.deletedAt && m.files && m.files[0] && /^https?:\/\//i.test(m.files[0].file)
    ).length;
    if (pendingImages > 0) {
      cacheExternalImages(tid, result.multimedia).catch(e => console.error('[media] Erro no cache:', e));
    }
    res.json({ ok:true, stats:result.stats, warnings:result.warnings, pendingImages });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Topola JSON ─────────────────────────────────────────────────────── */
router.get('/topola-json', async (req, res) => {
  try {
    const tid = req.treeId;
    const indis=await resolve(readCollection(tid, 'individuals')), fams=await resolve(readCollection(tid, 'families'));
    const months={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
    function pd(s){if(!s)return undefined;const c=s.replace(/^(ABT|EST|CAL|BEF|AFT|FROM|TO|BET)\s+/i,'').trim().split(/\s+/);
      const r={text:s};if(c.length===3){r.day=parseInt(c[0])||undefined;r.month=months[c[1].toUpperCase()]||undefined;r.year=parseInt(c[2])||undefined;}
      else if(c.length===2){r.month=months[c[0].toUpperCase()]||undefined;r.year=parseInt(c[1])||undefined;}
      else if(c.length===1){r.year=parseInt(c[0])||undefined;} return r;}

    const ti=[],tf=[];
    Object.values(indis).filter(i=>!i.deletedAt).forEach(indi=>{
      const n=(indi.names&&indi.names[0])||{};
      const b=(indi.events||[]).find(e=>e.type==='BIRT');
      const d=(indi.events||[]).find(e=>e.type==='DEAT');
      ti.push({id:indi.id,firstName:n.given||'',lastName:n.surname||'',sex:indi.sex||'U',
        famc:indi.famc||undefined,fams:(indi.fams&&indi.fams.length)?indi.fams:undefined,
        birth:b&&b.date?{date:pd(b.date)}:undefined, death:d&&d.date?{date:pd(d.date)}:undefined});
    });
    Object.values(fams).filter(f=>!f.deletedAt).forEach(fam=>{
      const m=(fam.events||[]).find(e=>e.type==='MARR');
      tf.push({id:fam.id,husb:fam.husb||undefined,wife:fam.wife||undefined,
        children:(fam.children&&fam.children.length)?fam.children:undefined,
        marriage:m&&m.date?{date:pd(m.date)}:undefined});
    });
    res.json({indis:ti,fams:tf});
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Surname genealogical research (Wikipedia + Wikidata) ────────────── */
router.get('/surname-research/:surname', async (req, res) => {
  const surname = (req.params.surname || '').trim();
  if (!surname) return res.status(400).json({ error: 'Surname is required' });

  const results = { surname, history: '', coatOfArmsUrl: '', sources: [] };

  function fetchJson(url) {
    return new Promise((resolveP, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const reqObj = mod.get(url, { timeout: 12000, headers: { 'User-Agent': 'myLineage/2.0 (genealogy app)' } }, resp => {
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          return fetchJson(resp.headers.location).then(resolveP).catch(reject);
        }
        if (resp.statusCode !== 200) { resp.resume(); return resolveP(null); }
        const chunks = [];
        resp.on('data', c => chunks.push(c));
        resp.on('end', () => {
          try { resolveP(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
          catch (_e) { resolveP(null); }
        });
        resp.on('error', () => resolveP(null));
      });
      reqObj.on('error', () => resolveP(null));
      reqObj.on('timeout', () => { reqObj.destroy(); resolveP(null); });
    });
  }

  try {
    const encodedSurname = encodeURIComponent(surname);
    const wikiLangs = [
      { lang: 'pt', searchTerms: [`${surname} (apelido)`, `Família ${surname}`, surname] },
      { lang: 'en', searchTerms: [`${surname} (surname)`, `${surname} family`, surname] }
    ];

    let wikiExtract = '';
    let wikiTitle = '';
    let wikiLang = '';
    let wikiUrl = '';

    for (const { lang, searchTerms } of wikiLangs) {
      if (wikiExtract) break;
      for (const term of searchTerms) {
        const searchUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
        const data = await fetchJson(searchUrl);
        if (data && data.extract && data.extract.length > 80) {
          wikiExtract = data.extract;
          wikiTitle = data.title || term;
          wikiLang = lang;
          wikiUrl = data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
          break;
        }
      }
    }

    if (wikiExtract) {
      results.history = wikiExtract;
      results.sources.push({
        name: `Wikipedia (${wikiLang.toUpperCase()})`,
        url: wikiUrl,
        article: wikiTitle
      });
    }

    const wdSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodedSurname}+family&language=en&format=json&limit=5`;
    const wdSearch = await fetchJson(wdSearchUrl);
    let coaUrl = '';

    if (wdSearch && wdSearch.search && wdSearch.search.length) {
      for (const item of wdSearch.search) {
        if (coaUrl) break;
        const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${item.id}&props=claims&format=json`;
        const entityData = await fetchJson(entityUrl);
        if (!entityData || !entityData.entities || !entityData.entities[item.id]) continue;
        const claims = entityData.entities[item.id].claims || {};
        const coaClaims = claims['P94'] || claims['P18'] || [];
        if (coaClaims.length) {
          const fileName = coaClaims[0].mainsnak && coaClaims[0].mainsnak.datavalue && coaClaims[0].mainsnak.datavalue.value;
          if (fileName) {
            coaUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=300`;
            results.sources.push({
              name: 'Wikidata / Wikimedia Commons',
              url: `https://www.wikidata.org/wiki/${item.id}`,
              article: item.label || surname
            });
          }
        }
      }
    }

    if (!coaUrl) {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodedSurname}+coat+of+arms&srnamespace=6&srlimit=3&format=json`;
      const commonsData = await fetchJson(commonsUrl);
      if (commonsData && commonsData.query && commonsData.query.search && commonsData.query.search.length) {
        const file = commonsData.query.search[0];
        const fileTitle = file.title;
        coaUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileTitle.replace('File:', ''))}?width=300`;
        results.sources.push({
          name: 'Wikimedia Commons',
          url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(fileTitle)}`,
          article: fileTitle
        });
      }
    }

    results.coatOfArmsUrl = coaUrl;

    if (!results.history) {
      results.history = `Não foram encontradas informações genealógicas detalhadas sobre o apelido "${surname}" nas fontes consultadas. Recomenda-se consultar arquivos históricos locais, registos paroquiais ou bases de dados especializadas em genealogia.`;
    }

    res.json(results);
  } catch (e) {
    console.error('[surname-research] Error:', e.message);
    res.status(500).json({ error: 'Erro ao pesquisar o apelido: ' + e.message });
  }
});

module.exports = router;
