/**
 * server.js — myLineage GEDCOM 7 Server
 * RESTful APIs for GEDCOM 7 entities stored as JSON in JSON-DATA/
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const DATA_DIR = path.join(__dirname, 'JSON-DATA');
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname), { etag: false, lastModified: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate') }));

/* ── Helpers ──────────────────────────────────────────────────────────── */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function nowISO() { return new Date().toISOString(); }

function readCollection(name) {
  ensureDataDir();
  const fpath = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(fpath)) return {};
  try { return JSON.parse(fs.readFileSync(fpath, 'utf8')); } catch (e) { return {}; }
}

function writeCollection(name, data) {
  ensureDataDir();
  fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(data, null, 2), 'utf8');
}

function nextId(collection, prefix) {
  const data = readCollection(collection);
  let n = 1; while (data[prefix + n]) n++;
  return prefix + n;
}

/* ── Generic CRUD router factory ─────────────────────────────────────── */
function entityRoutes(collectionName, idPrefix, defaultFn) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const data = readCollection(collectionName);
      const all = req.query.includeDeleted === 'true';
      res.json(Object.values(data).filter(r => all || !r.deletedAt));
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.get('/:id', (req, res) => {
    try {
      const rec = readCollection(collectionName)[req.params.id];
      if (!rec) return res.status(404).json({ error: 'Not found' });
      res.json(rec);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.post('/', (req, res) => {
    try {
      const data = readCollection(collectionName);
      const id = req.body.id || nextId(collectionName, idPrefix);
      const now = nowISO();
      const rec = { ...defaultFn(), ...req.body, id, createdAt: req.body.createdAt || now, updatedAt: now, deletedAt: null };
      data[id] = rec;
      writeCollection(collectionName, data);
      res.status(201).json(rec);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.put('/:id', (req, res) => {
    try {
      const data = readCollection(collectionName);
      if (!data[req.params.id]) return res.status(404).json({ error: 'Not found' });
      const rec = { ...data[req.params.id], ...req.body, id: req.params.id, updatedAt: nowISO() };
      data[req.params.id] = rec;
      writeCollection(collectionName, data);
      res.json(rec);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.delete('/:id', (req, res) => {
    try {
      const data = readCollection(collectionName);
      if (!data[req.params.id]) return res.status(404).json({ error: 'Not found' });
      data[req.params.id] = { ...data[req.params.id], deletedAt: nowISO(), updatedAt: nowISO() };
      writeCollection(collectionName, data);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  return router;
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

/* ── Mount entity CRUD routes ────────────────────────────────────────── */
app.use('/api/individuals',  entityRoutes('individuals','I',defaultIndividual));
app.use('/api/families',     entityRoutes('families','F',defaultFamily));
app.use('/api/sources',      entityRoutes('sources','S',defaultSource));
app.use('/api/repositories', entityRoutes('repositories','R',defaultRepository));
app.use('/api/multimedia',   entityRoutes('multimedia','M',defaultMultimedia));
app.use('/api/notes',        entityRoutes('notes','N',defaultNote));
app.use('/api/submitters',   entityRoutes('submitters','U',defaultSubmitter));

/* ── Bulk replace ────────────────────────────────────────────────────── */
app.post('/api/bulk-replace', (req, res) => {
  try {
    const b = req.body;
    if (b.individuals)  writeCollection('individuals', b.individuals);
    if (b.families)     writeCollection('families', b.families);
    if (b.sources)      writeCollection('sources', b.sources);
    if (b.repositories) writeCollection('repositories', b.repositories);
    if (b.multimedia)   writeCollection('multimedia', b.multimedia);
    if (b.notes)        writeCollection('notes', b.notes);
    if (b.submitters)   writeCollection('submitters', b.submitters);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Header ──────────────────────────────────────────────────────────── */
app.get('/api/header', (req, res) => {
  try {
    ensureDataDir();
    const fp = path.join(DATA_DIR, 'header.json');
    if (!fs.existsSync(fp)) return res.json({ gedc:{vers:'7.0'}, sour:{name:'myLineage',vers:'2.0'}, charset:'UTF-8' });
    res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.put('/api/header', (req, res) => {
  try { ensureDataDir(); fs.writeFileSync(path.join(DATA_DIR,'header.json'), JSON.stringify(req.body,null,2),'utf8'); res.json(req.body); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Settings ────────────────────────────────────────────────────────── */
app.get('/api/settings', (req, res) => {
  try {
    ensureDataDir();
    const fp = path.join(DATA_DIR, 'settings.json');
    if (!fs.existsSync(fp)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.put('/api/settings', (req, res) => {
  try {
    ensureDataDir();
    const fp = path.join(DATA_DIR, 'settings.json');
    let cur = {}; if (fs.existsSync(fp)) cur = JSON.parse(fs.readFileSync(fp,'utf8'));
    const upd = { ...cur, ...req.body };
    fs.writeFileSync(fp, JSON.stringify(upd,null,2),'utf8');
    res.json(upd);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── History ─────────────────────────────────────────────────────────── */
app.get('/api/history', (req, res) => {
  try {
    ensureDataDir();
    const fp = path.join(DATA_DIR, 'history.json');
    if (!fs.existsSync(fp)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/history', (req, res) => {
  try {
    ensureDataDir();
    const fp = path.join(DATA_DIR, 'history.json');
    let arr = []; if (fs.existsSync(fp)) arr = JSON.parse(fs.readFileSync(fp,'utf8'));
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    arr = entries.concat(arr).slice(0, 500);
    fs.writeFileSync(fp, JSON.stringify(arr,null,2),'utf8');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.delete('/api/history', (req, res) => {
  try { ensureDataDir(); fs.writeFileSync(path.join(DATA_DIR,'history.json'),'[]','utf8'); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── Stats ───────────────────────────────────────────────────────────── */
app.get('/api/stats', (req, res) => {
  try {
    const indis = Object.values(readCollection('individuals')).filter(r=>!r.deletedAt);
    const fams  = Object.values(readCollection('families')).filter(r=>!r.deletedAt);
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
      sources: Object.values(readCollection('sources')).filter(r=>!r.deletedAt).length,
      multimedia: Object.values(readCollection('multimedia')).filter(r=>!r.deletedAt).length,
      births, deaths, marriages, baptisms, burials, divorces,
      males: indis.filter(i=>i.sex==='M').length,
      females: indis.filter(i=>i.sex==='F').length });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── GEDCOM 7 Export ─────────────────────────────────────────────────── */
app.get('/api/gedcom/export', (req, res) => {
  try {
    const indis=readCollection('individuals'), fams=readCollection('families'),
          srcs=readCollection('sources'), repos=readCollection('repositories'),
          nts=readCollection('notes'), subms=readCollection('submitters');
    const L = [];
    L.push('0 HEAD','1 GEDC','2 VERS 7.0','1 SOUR myLineage','2 VERS 2.0','2 NAME myLineage','1 CHAR UTF-8');

    Object.values(subms).filter(s=>!s.deletedAt).forEach(s=>{
      L.push(`0 @${s.id}@ SUBM`);
      if(s.name)L.push(`1 NAME ${s.name}`);
      if(s.phone)L.push(`1 PHON ${s.phone}`);
      if(s.email)L.push(`1 EMAIL ${s.email}`);
    });

    Object.values(indis).filter(i=>!i.deletedAt).forEach(indi=>{
      L.push(`0 @${indi.id}@ INDI`);
      (indi.names||[]).forEach(n=>{
        const v=n.value||`${n.given||''} /${n.surname||''}/`.trim();
        L.push(`1 NAME ${v}`);
        if(n.given)L.push(`2 GIVN ${n.given}`);
        if(n.surname)L.push(`2 SURN ${n.surname}`);
        if(n.prefix)L.push(`2 NPFX ${n.prefix}`);
        if(n.suffix)L.push(`2 NSFX ${n.suffix}`);
        if(n.nickname)L.push(`2 NICK ${n.nickname}`);
      });
      if(indi.sex)L.push(`1 SEX ${indi.sex}`);
      (indi.events||[]).forEach(ev=>{
        if(!ev.type)return;
        L.push(`1 ${ev.type.toUpperCase()}`);
        if(ev.date)L.push(`2 DATE ${ev.date}`);
        if(ev.place)L.push(`2 PLAC ${ev.place}`);
      });
      (indi.attributes||[]).forEach(a=>{
        if(!a.type)return;
        L.push(`1 ${a.type.toUpperCase()} ${a.value||''}`);
      });
      if(indi.famc)L.push(`1 FAMC @${indi.famc}@`);
      (indi.fams||[]).forEach(f=>L.push(`1 FAMS @${f}@`));
      (indi.notes||[]).forEach(n=>L.push(`1 NOTE ${n}`));
      (indi.sourceRefs||[]).forEach(sr=>{
        L.push(`1 SOUR @${sr.sourceId}@`);
        if(sr.page)L.push(`2 PAGE ${sr.page}`);
      });
    });

    Object.values(fams).filter(f=>!f.deletedAt).forEach(fam=>{
      L.push(`0 @${fam.id}@ FAM`);
      if(fam.husb)L.push(`1 HUSB @${fam.husb}@`);
      if(fam.wife)L.push(`1 WIFE @${fam.wife}@`);
      (fam.children||[]).forEach(c=>L.push(`1 CHIL @${c}@`));
      (fam.events||[]).forEach(ev=>{
        if(!ev.type)return;
        L.push(`1 ${ev.type.toUpperCase()}`);
        if(ev.date)L.push(`2 DATE ${ev.date}`);
        if(ev.place)L.push(`2 PLAC ${ev.place}`);
      });
    });

    Object.values(srcs).filter(s=>!s.deletedAt).forEach(src=>{
      L.push(`0 @${src.id}@ SOUR`);
      if(src.title)L.push(`1 TITL ${src.title}`);
      if(src.author)L.push(`1 AUTH ${src.author}`);
      if(src.publication)L.push(`1 PUBL ${src.publication}`);
    });

    Object.values(repos).filter(r=>!r.deletedAt).forEach(repo=>{
      L.push(`0 @${repo.id}@ REPO`);
      if(repo.name)L.push(`1 NAME ${repo.name}`);
    });

    Object.values(nts).filter(n=>!n.deletedAt).forEach(note=>{
      L.push(`0 @${note.id}@ NOTE ${note.text||''}`);
    });

    L.push('0 TRLR');

    if(req.query.format==='file'){
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      res.setHeader('Content-Disposition','attachment; filename="myLineage_export.ged"');
    }
    res.send(L.join('\n'));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ── GEDCOM Import ───────────────────────────────────────────────────── */
app.post('/api/gedcom/import', express.text({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const text = typeof req.body === 'string' ? req.body : (req.body.text || '');
    const result = parseGedcomToJson(text);
    writeCollection('individuals', result.individuals);
    writeCollection('families', result.families);
    if (result.multimedia && Object.keys(result.multimedia).length) writeCollection('multimedia', result.multimedia);
    res.json({ ok:true, stats:result.stats, warnings:result.warnings });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

function parseGedcomToJson(text) {
  const lines = text.split(/\r?\n/).map(l=>l.trimEnd());
  // Build tree of records
  const recs = []; let cur = null;
  for (const raw of lines) {
    if (!raw) continue;
    const m = raw.match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const lev = parseInt(m[1],10), rest = m[2];
    if (lev === 0) { if (cur) recs.push(cur); cur = { lines:[{lev:0,rest,raw}] }; }
    else if (cur) cur.lines.push({lev,rest,raw});
  }
  if (cur) recs.push(cur);

  const individuals={}, families={}, multimedia={}, warnings=[];
  const now = nowISO();

  function subLines(lines, idx) {
    const base = lines[idx].lev; const out = [];
    for (let j = idx+1; j < lines.length && lines[j].lev > base; j++) out.push(lines[j]);
    return out;
  }

  for (const rec of recs) {
    const first = rec.lines[0].rest;
    // INDI
    const im = first.match(/^@([^@]+)@\s+INDI/);
    if (im) {
      const id = im[1];
      const indi = { id, type:'INDI', names:[], sex:'U', events:[], attributes:[], famc:null, fams:[], notes:[], sourceRefs:[], multimediaRefs:[], createdAt:now, updatedAt:now, deletedAt:null };
      for (let i = 1; i < rec.lines.length; i++) {
        const {lev,rest} = rec.lines[i];
        if (lev !== 1) continue;
        if (rest.startsWith('NAME')) {
          const v = rest.replace(/^NAME\s*/,'').trim();
          const sm = v.match(/\/(.*?)\//);
          const n = { value:v, given:v.replace(/\/(.*?)\//,'').trim(), surname:sm?sm[1].trim():'', prefix:'', suffix:'', nickname:'', type:'BIRTH' };
          subLines(rec.lines,i).forEach(s=>{
            if(s.rest.startsWith('GIVN'))n.given=s.rest.replace(/^GIVN\s*/,'').trim();
            if(s.rest.startsWith('SURN'))n.surname=s.rest.replace(/^SURN\s*/,'').trim();
            if(s.rest.startsWith('NPFX'))n.prefix=s.rest.replace(/^NPFX\s*/,'').trim();
            if(s.rest.startsWith('NSFX'))n.suffix=s.rest.replace(/^NSFX\s*/,'').trim();
            if(s.rest.startsWith('NICK'))n.nickname=s.rest.replace(/^NICK\s*/,'').trim();
            if(s.rest.startsWith('TYPE'))n.type=s.rest.replace(/^TYPE\s*/,'').trim();
          });
          indi.names.push(n);
        }
        if (rest.startsWith('SEX')) indi.sex = rest.replace(/^SEX\s*/,'').trim();
        const evTypes = ['BIRT','DEAT','BURI','BAPM','CHR','CONF','FCOM','ORDN','RETI','EMIG','IMMI','CENS','PROB','WILL','GRAD','EVEN','ADOP'];
        for (const et of evTypes) {
          if (rest.startsWith(et+' ')||rest===et) {
            const ev = { type:et, date:'', place:'', notes:[] };
            subLines(rec.lines,i).forEach(s=>{
              if(s.rest.startsWith('DATE'))ev.date=s.rest.replace(/^DATE\s*/,'').trim();
              if(s.rest.startsWith('PLAC'))ev.place=s.rest.replace(/^PLAC\s*/,'').trim();
              if(s.rest.startsWith('NOTE'))ev.notes.push(s.rest.replace(/^NOTE\s*/,'').trim());
              if(s.rest.startsWith('TYPE'))ev.description=s.rest.replace(/^TYPE\s*/,'').trim();
            });
            indi.events.push(ev);
          }
        }
        const atTypes = ['OCCU','EDUC','RELI','NATI','TITL','FACT','SSN','RESI','IDNO','NCHI','CAST','DSCR'];
        for (const at of atTypes) {
          if (rest.startsWith(at)) {
            const attr = { type:at, value:rest.replace(new RegExp('^'+at+'\\s*'),'').trim() };
            subLines(rec.lines,i).forEach(s=>{
              if(s.rest.startsWith('DATE'))attr.date=s.rest.replace(/^DATE\s*/,'').trim();
              if(s.rest.startsWith('PLAC'))attr.place=s.rest.replace(/^PLAC\s*/,'').trim();
            });
            indi.attributes.push(attr);
          }
        }
        if(rest.startsWith('FAMC')){const m2=rest.match(/@([^@]+)@/);if(m2)indi.famc=m2[1];}
        if(rest.startsWith('FAMS')){const m2=rest.match(/@([^@]+)@/);if(m2)indi.fams.push(m2[1]);}
        if(rest.startsWith('NOTE'))indi.notes.push(rest.replace(/^NOTE\s*/,'').trim());
        if(rest.startsWith('SOUR')){
          const m2=rest.match(/@([^@]+)@/);
          if(m2){const sr={sourceId:m2[1],page:'',quality:''};
            subLines(rec.lines,i).forEach(s=>{
              if(s.rest.startsWith('PAGE'))sr.page=s.rest.replace(/^PAGE\s*/,'').trim();
              if(s.rest.startsWith('QUAY'))sr.quality=s.rest.replace(/^QUAY\s*/,'').trim();
            });
            indi.sourceRefs.push(sr);
          }
        }
        if(rest.startsWith('OBJE')){
          const m2=rest.match(/@([^@]+)@/);
          if(m2){
            // reference to a top-level OBJE record
            if(!indi.multimediaRefs.includes(m2[1])) indi.multimediaRefs.push(m2[1]);
          } else {
            // inline OBJE: create an anonymous multimedia record
            const file={file:'',form:''};
            subLines(rec.lines,i).forEach(s=>{
              if(s.rest.startsWith('FILE'))file.file=s.rest.replace(/^FILE\s*/,'').trim();
              if(s.rest.startsWith('FORM'))file.form=s.rest.replace(/^FORM\s*/,'').trim();
            });
            if(file.file){
              const mid='M_'+id+'_'+indi.multimediaRefs.length;
              multimedia[mid]={id:mid,type:'OBJE',files:[file],notes:[],sourceRefs:[],dataUrl:null,tags:[],createdAt:now,updatedAt:now,deletedAt:null};
              indi.multimediaRefs.push(mid);
            }
          }
        }
      }
      if(!indi.names.length) warnings.push({id,reason:'Missing name'});
      individuals[id] = indi;
      continue;
    }
    // OBJE (top-level multimedia)
    const om = first.match(/^@([^@]+)@\s+OBJE/);
    if (om) {
      const id = om[1];
      const obje = { id, type:'OBJE', files:[], notes:[], sourceRefs:[], dataUrl:null, tags:[], createdAt:now, updatedAt:now, deletedAt:null };
      let fileObj = null;
      for (let i = 1; i < rec.lines.length; i++) {
        const {lev,rest} = rec.lines[i];
        if (lev === 1 && rest.startsWith('FILE')) {
          fileObj = { file: rest.replace(/^FILE\s*/,'').trim(), form:'' };
          obje.files.push(fileObj);
        }
        if (lev === 2 && rest.startsWith('FORM') && fileObj) {
          fileObj.form = rest.replace(/^FORM\s*/,'').trim();
        }
        if (lev === 1 && rest.startsWith('NOTE')) obje.notes.push(rest.replace(/^NOTE\s*/,'').trim());
        if (lev === 1 && rest.startsWith('TITL')) obje.tags.push(rest.replace(/^TITL\s*/,'').trim());
      }
      multimedia[id] = obje;
      continue;
    }
    // FAM
    const fm = first.match(/^@([^@]+)@\s+FAM/);
    if (fm) {
      const id = fm[1];
      const fam = { id, type:'FAM', husb:null, wife:null, children:[], events:[], notes:[], sourceRefs:[], multimediaRefs:[], createdAt:now, updatedAt:now, deletedAt:null };
      for (let i = 1; i < rec.lines.length; i++) {
        const {lev,rest} = rec.lines[i]; if(lev!==1)continue;
        if(rest.startsWith('HUSB')){const m2=rest.match(/@([^@]+)@/);if(m2)fam.husb=m2[1];}
        if(rest.startsWith('WIFE')){const m2=rest.match(/@([^@]+)@/);if(m2)fam.wife=m2[1];}
        if(rest.startsWith('CHIL')){const m2=rest.match(/@([^@]+)@/);if(m2)fam.children.push(m2[1]);}
        if(rest.startsWith('OBJE')){
          const m2=rest.match(/@([^@]+)@/);
          if(m2){if(!fam.multimediaRefs.includes(m2[1]))fam.multimediaRefs.push(m2[1]);}
        }
        const famEvTypes=['MARR','DIV','ANUL','ENGA','MARB','MARC','MARL','MARS','EVEN'];
        for(const et of famEvTypes){
          if(rest.startsWith(et+' ')||rest===et){
            const ev={type:et,date:'',place:'',notes:[]};
            subLines(rec.lines,i).forEach(s=>{
              if(s.rest.startsWith('DATE'))ev.date=s.rest.replace(/^DATE\s*/,'').trim();
              if(s.rest.startsWith('PLAC'))ev.place=s.rest.replace(/^PLAC\s*/,'').trim();
            });
            fam.events.push(ev);
          }
        }
      }
      // Cross-link
      if(fam.husb&&individuals[fam.husb]&&!individuals[fam.husb].fams.includes(id))individuals[fam.husb].fams.push(id);
      if(fam.wife&&individuals[fam.wife]&&!individuals[fam.wife].fams.includes(id))individuals[fam.wife].fams.push(id);
      fam.children.forEach(cid=>{if(individuals[cid])individuals[cid].famc=id;});
      families[id] = fam;
    }
  }
  return { individuals, families, multimedia, stats:{individuals:Object.keys(individuals).length,families:Object.keys(families).length,multimedia:Object.keys(multimedia).length,warnings:warnings.length}, warnings };
}

/* ── Topola JSON ─────────────────────────────────────────────────────── */
app.get('/api/topola-json', (req, res) => {
  try {
    const indis=readCollection('individuals'), fams=readCollection('families');
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

/* ── Start ───────────────────────────────────────────────────────────── */
app.listen(PORT, () => { console.log(`myLineage GEDCOM 7 server on http://localhost:${PORT}`); });
