/**
 * lib/gedcom-parser.js — GEDCOM 7 → JSON parser for myLineage
 * Exported function: parseGedcomToJson(text) → { individuals, families, multimedia, stats, warnings }
 */

'use strict';

const { nowISO } = require('./crud-helpers');

/**
 * Parse a GEDCOM 7 text file into myLineage JSON collections.
 * @param {string} text - raw GEDCOM text
 * @returns {{ individuals: Object, families: Object, multimedia: Object, stats: Object, warnings: Array }}
 */
function parseGedcomToJson(text) {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd());

  // Build list of top-level records (level-0 blocks)
  const recs = [];
  let cur = null;
  for (const raw of lines) {
    if (!raw) continue;
    const m = raw.match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const lev  = parseInt(m[1], 10);
    const rest = m[2];
    if (lev === 0) {
      if (cur) recs.push(cur);
      cur = { lines: [{ lev: 0, rest, raw }] };
    } else if (cur) {
      cur.lines.push({ lev, rest, raw });
    }
  }
  if (cur) recs.push(cur);

  const individuals = {}, families = {}, multimedia = {}, warnings = [];
  const now = nowISO();
  const indiObjPositions = {}; // { indiId: { mrefId: positionString } }
  const photoRinToMid = {};   // { photoRin: multimediaId } — consolidate same-photo entries

  /** Return all direct sub-lines (level > base) for the record line at index idx */
  function subLines(recLines, idx) {
    const base = recLines[idx].lev;
    const out  = [];
    for (let j = idx + 1; j < recLines.length && recLines[j].lev > base; j++) {
      out.push(recLines[j]);
    }
    return out;
  }

  for (const rec of recs) {
    const first = rec.lines[0].rest;

    /* ── INDI ── */
    const im = first.match(/^@([^@]+)@\s+INDI/);
    if (im) {
      const id   = im[1];
      const indi = {
        id, type: 'INDI',
        names: [], sex: 'U', events: [], attributes: [],
        famc: null, fams: [], notes: [], sourceRefs: [], multimediaRefs: [],
        createdAt: now, updatedAt: now, deletedAt: null,
      };

      for (let i = 1; i < rec.lines.length; i++) {
        const { lev, rest } = rec.lines[i];
        if (lev !== 1) continue;

        // NAME
        if (rest.startsWith('NAME')) {
          const v   = rest.replace(/^NAME\s*/, '').trim();
          const sm  = v.match(/\/(.*?)\//);
          const n   = { value: v, given: v.replace(/\/(.*?)\//, '').trim(), surname: sm ? sm[1].trim() : '', prefix: '', suffix: '', nickname: '', type: 'BIRTH' };
          subLines(rec.lines, i).forEach(s => {
            if (s.rest.startsWith('GIVN')) n.given    = s.rest.replace(/^GIVN\s*/, '').trim();
            if (s.rest.startsWith('SURN')) n.surname  = s.rest.replace(/^SURN\s*/, '').trim();
            if (s.rest.startsWith('NPFX')) n.prefix   = s.rest.replace(/^NPFX\s*/, '').trim();
            if (s.rest.startsWith('NSFX')) n.suffix   = s.rest.replace(/^NSFX\s*/, '').trim();
            if (s.rest.startsWith('NICK')) n.nickname = s.rest.replace(/^NICK\s*/, '').trim();
            if (s.rest.startsWith('TYPE')) n.type     = s.rest.replace(/^TYPE\s*/, '').trim();
          });
          indi.names.push(n);
        }

        // SEX
        if (rest.startsWith('SEX')) indi.sex = rest.replace(/^SEX\s*/, '').trim();

        // Individual events
        const evTypes = ['BIRT','DEAT','BURI','BAPM','CHR','CONF','FCOM','ORDN','RETI','EMIG','IMMI','CENS','PROB','WILL','GRAD','EVEN','ADOP','CREM','BARM','BASM','BLES','CHRA','NATU'];
        for (const et of evTypes) {
          if (rest.startsWith(et + ' ') || rest === et) {
            const ev = { type: et, date: '', place: '', notes: [] };
            subLines(rec.lines, i).forEach(s => {
              if (s.rest.startsWith('DATE')) ev.date  = s.rest.replace(/^DATE\s*/, '').trim();
              if (s.rest.startsWith('PLAC')) ev.place = s.rest.replace(/^PLAC\s*/, '').trim();
              if (s.rest.startsWith('NOTE')) ev.notes.push(s.rest.replace(/^NOTE\s*/, '').trim());
              if (s.rest.startsWith('TYPE')) ev.description = s.rest.replace(/^TYPE\s*/, '').trim();
            });
            indi.events.push(ev);
          }
        }

        // Individual attributes
        const atTypes = ['OCCU','EDUC','RELI','NATI','TITL','FACT','SSN','RESI','IDNO','NCHI','CAST','DSCR'];
        for (const at of atTypes) {
          if (rest.startsWith(at)) {
            const attr = { type: at, value: rest.replace(new RegExp('^' + at + '\\s*'), '').trim() };
            subLines(rec.lines, i).forEach(s => {
              if (s.rest.startsWith('DATE')) attr.date  = s.rest.replace(/^DATE\s*/, '').trim();
              if (s.rest.startsWith('PLAC')) attr.place = s.rest.replace(/^PLAC\s*/, '').trim();
            });
            indi.attributes.push(attr);
          }
        }

        if (rest.startsWith('FAMC')) { const m2 = rest.match(/@([^@]+)@/); if (m2) indi.famc = m2[1]; }
        if (rest.startsWith('FAMS')) { const m2 = rest.match(/@([^@]+)@/); if (m2) indi.fams.push(m2[1]); }
        if (rest.startsWith('NOTE')) indi.notes.push(rest.replace(/^NOTE\s*/, '').trim());

        if (rest.startsWith('SOUR')) {
          const m2 = rest.match(/@([^@]+)@/);
          if (m2) {
            const sr = { sourceId: m2[1], page: '', quality: '' };
            subLines(rec.lines, i).forEach(s => {
              if (s.rest.startsWith('PAGE')) sr.page    = s.rest.replace(/^PAGE\s*/, '').trim();
              if (s.rest.startsWith('QUAY')) sr.quality = s.rest.replace(/^QUAY\s*/, '').trim();
            });
            indi.sourceRefs.push(sr);
          }
        }

        if (rest.startsWith('OBJE')) {
          const m2 = rest.match(/@([^@]+)@/);
          if (m2) {
            if (!indi.multimediaRefs.includes(m2[1])) indi.multimediaRefs.push(m2[1]);
            for (const s of subLines(rec.lines, i)) {
              if (s.rest.startsWith('_POSITION ')) {
                if (!indiObjPositions[id]) indiObjPositions[id] = {};
                indiObjPositions[id][m2[1]] = s.rest.replace(/^_POSITION\s*/, '').trim();
              }
            }
          } else {
            const file = { file: '', form: '', title: '', position: null, cutout: false, primary: false, parentRin: '', parentPhoto: false, primaryCutout: false, personalPhoto: false, photoRin: '', note: '' };
            subLines(rec.lines, i).forEach(s => {
              if (s.rest.startsWith('FILE'))            file.file          = s.rest.replace(/^FILE\s*/, '').trim();
              if (s.rest.startsWith('FORM'))            file.form          = s.rest.replace(/^FORM\s*/, '').trim();
              if (s.rest.startsWith('TITL'))            file.title         = s.rest.replace(/^TITL\s*/, '').trim();
              if (s.rest.startsWith('NOTE'))            file.note          = s.rest.replace(/^NOTE\s*/, '').trim();
              if (s.rest.startsWith('_POSITION '))      file.position      = s.rest.replace(/^_POSITION\s*/, '').trim();
              if (s.rest.startsWith('_PRIM '))          file.primary       = true;
              if (s.rest.startsWith('_CUTOUT '))        file.cutout        = true;
              if (s.rest.startsWith('_PARENTRIN '))     file.parentRin     = s.rest.replace(/^_PARENTRIN\s*/, '').trim();
              if (s.rest.startsWith('_PARENTPHOTO '))   file.parentPhoto   = true;
              if (s.rest.startsWith('_PRIM_CUTOUT '))   file.primaryCutout = true;
              if (s.rest.startsWith('_PERSONALPHOTO ')) file.personalPhoto = true;
              if (s.rest.startsWith('_PHOTO_RIN '))     file.photoRin      = s.rest.replace(/^_PHOTO_RIN\s*/, '').trim();
            });
            if (file.file) {
              // Non-cutout files with a photoRin: consolidate into a single multimedia entry
              if (file.photoRin && !file.cutout && photoRinToMid[file.photoRin]) {
                const existingMid = photoRinToMid[file.photoRin];
                if (!indi.multimediaRefs.includes(existingMid)) indi.multimediaRefs.push(existingMid);
                // Store per-person OBJE props for roundtrip export
                multimedia[existingMid].tags.push({
                  personId: id,
                  personName: null, // resolved in post-processing
                  pixelCoords: null,
                  objeProps: { position: file.position, cutout: file.cutout, primary: file.primary, parentRin: file.parentRin, parentPhoto: file.parentPhoto, primaryCutout: file.primaryCutout, personalPhoto: file.personalPhoto, photoRin: file.photoRin, note: file.note }
                });
              } else {
                const mid = 'M_' + id + '_' + indi.multimediaRefs.length;
                const tag = {
                  personId: id,
                  personName: null,
                  pixelCoords: null,
                  objeProps: { position: file.position, cutout: file.cutout, primary: file.primary, parentRin: file.parentRin, parentPhoto: file.parentPhoto, primaryCutout: file.primaryCutout, personalPhoto: file.personalPhoto, photoRin: file.photoRin, note: file.note }
                };
                multimedia[mid] = { id: mid, type: 'OBJE', files: [file], notes: [], sourceRefs: [], dataUrl: null, tags: [tag], createdAt: now, updatedAt: now, deletedAt: null };
                indi.multimediaRefs.push(mid);
                if (file.photoRin && !file.cutout) photoRinToMid[file.photoRin] = mid;
              }
            }
          }
        }
      }

      if (!indi.names.length) warnings.push({ id, reason: 'Missing name' });
      individuals[id] = indi;
      continue;
    }

    /* ── OBJE (top-level multimedia) ── */
    const om = first.match(/^@([^@]+)@\s+OBJE/);
    if (om) {
      const id   = om[1];
      const obje = { id, type: 'OBJE', title: '', files: [], notes: [], sourceRefs: [], dataUrl: null, tags: [], createdAt: now, updatedAt: now, deletedAt: null };
      let fileObj = null;
      for (let i = 1; i < rec.lines.length; i++) {
        const { lev, rest } = rec.lines[i];
        if (lev === 1 && rest.startsWith('FILE')) {
          fileObj = { file: rest.replace(/^FILE\s*/, '').trim(), form: '', title: '', position: null, cutout: false, primary: false, parentRin: '', parentPhoto: false, primaryCutout: false, personalPhoto: false, photoRin: '', note: '' };
          obje.files.push(fileObj);
        }
        if (lev === 2 && fileObj) {
          if (rest.startsWith('FORM'))            fileObj.form          = rest.replace(/^FORM\s*/, '').trim();
          if (rest.startsWith('TITL'))            fileObj.title         = rest.replace(/^TITL\s*/, '').trim();
          if (rest.startsWith('_POSITION '))      fileObj.position      = rest.replace(/^_POSITION\s*/, '').trim();
          if (rest.startsWith('_PRIM '))          fileObj.primary       = true;
          if (rest.startsWith('_CUTOUT '))        fileObj.cutout        = true;
          if (rest.startsWith('_PARENTRIN '))     fileObj.parentRin     = rest.replace(/^_PARENTRIN\s*/, '').trim();
          if (rest.startsWith('_PARENTPHOTO '))   fileObj.parentPhoto   = true;
          if (rest.startsWith('_PRIM_CUTOUT '))   fileObj.primaryCutout = true;
          if (rest.startsWith('_PERSONALPHOTO ')) fileObj.personalPhoto = true;
          if (rest.startsWith('_PHOTO_RIN '))     fileObj.photoRin      = rest.replace(/^_PHOTO_RIN\s*/, '').trim();
        }
        if (lev === 1 && rest.startsWith('NOTE')) obje.notes.push(rest.replace(/^NOTE\s*/, '').trim());
        if (lev === 1 && rest.startsWith('TITL')) obje.title = rest.replace(/^TITL\s*/, '').trim();
      }
      multimedia[id] = obje;
      continue;
    }

    /* ── FAM ── */
    const fm = first.match(/^@([^@]+)@\s+FAM/);
    if (fm) {
      const id  = fm[1];
      const fam = {
        id, type: 'FAM',
        husb: null, wife: null, children: [], events: [], notes: [], sourceRefs: [], multimediaRefs: [],
        createdAt: now, updatedAt: now, deletedAt: null,
      };
      for (let i = 1; i < rec.lines.length; i++) {
        const { lev, rest } = rec.lines[i];
        if (lev !== 1) continue;
        if (rest.startsWith('HUSB')) { const m2 = rest.match(/@([^@]+)@/); if (m2) fam.husb = m2[1]; }
        if (rest.startsWith('WIFE')) { const m2 = rest.match(/@([^@]+)@/); if (m2) fam.wife = m2[1]; }
        if (rest.startsWith('CHIL')) { const m2 = rest.match(/@([^@]+)@/); if (m2) fam.children.push(m2[1]); }
        if (rest.startsWith('OBJE')) {
          const m2 = rest.match(/@([^@]+)@/);
          if (m2 && !fam.multimediaRefs.includes(m2[1])) fam.multimediaRefs.push(m2[1]);
        }
        const famEvTypes = ['MARR','DIV','DIVF','ANUL','ENGA','MARB','MARC','MARL','MARS','EVEN'];
        for (const et of famEvTypes) {
          if (rest.startsWith(et + ' ') || rest === et) {
            const ev = { type: et, date: '', place: '', notes: [] };
            subLines(rec.lines, i).forEach(s => {
              if (s.rest.startsWith('DATE')) ev.date  = s.rest.replace(/^DATE\s*/, '').trim();
              if (s.rest.startsWith('PLAC')) ev.place = s.rest.replace(/^PLAC\s*/, '').trim();
            });
            fam.events.push(ev);
          }
        }
      }
      // Cross-link individuals ↔ family
      if (fam.husb && individuals[fam.husb] && !individuals[fam.husb].fams.includes(id)) individuals[fam.husb].fams.push(id);
      if (fam.wife && individuals[fam.wife] && !individuals[fam.wife].fams.includes(id)) individuals[fam.wife].fams.push(id);
      fam.children.forEach(cid => { if (individuals[cid]) individuals[cid].famc = id; });
      families[id] = fam;
    }
  }

  // Post-process: resolve personName and pixelCoords in tags
  for (const indiId of Object.keys(individuals)) {
    const indi = individuals[indiId];
    const nameRec = (indi.names && indi.names[0]) || {};
    const personName = ((nameRec.given || '') + ' ' + (nameRec.surname || '')).trim() || indiId;
    for (const mref of (indi.multimediaRefs || [])) {
      const mm = multimedia[mref];
      if (!mm) continue;
      if (!mm.tags) mm.tags = [];

      // Find existing tag for this person (created during inline OBJE parsing)
      let tag = mm.tags.find(t => t.personId === indiId);

      if (!tag) {
        // Tag not yet created (e.g. top-level OBJE ref) — create one
        tag = { personId: indiId, personName, pixelCoords: null };
        mm.tags.push(tag);
      }

      // Resolve personName if not yet set
      if (!tag.personName) tag.personName = personName;

      // Resolve pixelCoords from objeProps, indiObjPositions, or file-level position
      if (!tag.pixelCoords) {
        let posStr = tag.objeProps && tag.objeProps.position;
        if (!posStr) posStr = indiObjPositions[indiId] && indiObjPositions[indiId][mref];
        if (!posStr && mm.files) {
          for (const f of mm.files) { if (f.position) { posStr = f.position; break; } }
        }
        if (posStr) {
          const parts = posStr.trim().split(/\s+/).map(Number);
          if (parts.length === 4 && !parts.some(n => isNaN(n))) {
            const [x1, y1, x2, y2] = parts;
            tag.pixelCoords = { x1, y1, x2, y2 };
          }
        }
      }
    }
  }

  return {
    individuals, families, multimedia,
    stats: {
      individuals: Object.keys(individuals).length,
      families:    Object.keys(families).length,
      multimedia:  Object.keys(multimedia).length,
      warnings:    warnings.length,
    },
    warnings,
  };
}

module.exports = { parseGedcomToJson };
