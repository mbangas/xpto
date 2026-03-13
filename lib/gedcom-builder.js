/**
 * lib/gedcom-builder.js — myLineage JSON collections → GEDCOM 7 text builder
 * Exported function: buildGedcomText(collections) → string
 */

'use strict';

/**
 * Build a GEDCOM 7.0 text from myLineage JSON collections.
 *
 * @param {{ individuals?: Object, families?: Object, sources?: Object, repositories?: Object, notes?: Object, submitters?: Object }} collections
 * @returns {string} GEDCOM text (lines joined by '\n')
 */
function buildGedcomText(collections) {
  const {
    individuals  = {},
    families     = {},
    multimedia   = {},
    sources      = {},
    repositories = {},
    notes        = {},
    submitters   = {},
  } = collections;

  const L = [];

  // HEAD
  L.push('0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SOUR myLineage', '2 VERS 2.0', '2 NAME myLineage', '1 CHAR UTF-8');

  // SUBMitters
  Object.values(submitters).filter(s => !s.deletedAt).forEach(s => {
    L.push(`0 @${s.id}@ SUBM`);
    if (s.name)  L.push(`1 NAME ${s.name}`);
    if (s.phone) L.push(`1 PHON ${s.phone}`);
    if (s.email) L.push(`1 EMAIL ${s.email}`);
  });

  // INDIviduals
  Object.values(individuals).filter(i => !i.deletedAt).forEach(indi => {
    L.push(`0 @${indi.id}@ INDI`);
    (indi.names || []).forEach(n => {
      const v = n.value || `${n.given || ''} /${n.surname || ''}/`.trim();
      L.push(`1 NAME ${v}`);
      if (n.given)       L.push(`2 GIVN ${n.given}`);
      if (n.surname)     L.push(`2 SURN ${n.surname}`);
      if (n.prefix)      L.push(`2 NPFX ${n.prefix}`);
      if (n.suffix)      L.push(`2 NSFX ${n.suffix}`);
      if (n.nickname)    L.push(`2 NICK ${n.nickname}`);
      if (n.marriedName) L.push(`2 _MARNM ${n.marriedName}`);
      if (n.aka)         L.push(`2 _AKA ${n.aka}`);
    });
    if (indi.sex) L.push(`1 SEX ${indi.sex}`);
    (indi.events || []).forEach(ev => {
      if (!ev.type) return;
      L.push(`1 ${ev.type.toUpperCase()}`);
      if (ev.date)        L.push(`2 DATE ${ev.date}`);
      if (ev.place)       L.push(`2 PLAC ${ev.place}`);
      if (ev.country)     L.push(`2 _CTRY ${ev.country}`);
      if (ev.description) L.push(`2 TYPE ${ev.description}`);
      if (ev.cause)       L.push(`2 CAUS ${ev.cause}`);
      if (ev.age)         L.push(`2 AGE ${ev.age}`);
    });
    (indi.attributes || []).forEach(a => {
      if (!a.type) return;
      L.push(`1 ${a.type.toUpperCase()} ${a.value || ''}`);
      if (a.date)  L.push(`2 DATE ${a.date}`);
      if (a.place) L.push(`2 PLAC ${a.place}`);
      if (a.address) {
        const ad = a.address;
        L.push(`2 ADDR${ad.addr ? ' ' + ad.addr : ''}`);
        if (ad.adr1) L.push(`3 ADR1 ${ad.adr1}`);
        if (ad.adr2) L.push(`3 ADR2 ${ad.adr2}`);
        if (ad.city) L.push(`3 CITY ${ad.city}`);
        if (ad.stae) L.push(`3 STAE ${ad.stae}`);
        if (ad.ctry) L.push(`3 CTRY ${ad.ctry}`);
        if (ad.post) L.push(`3 POST ${ad.post}`);
      }
      if (a.email) L.push(`2 EMAIL ${a.email}`);
      if (a.www)   L.push(`2 WWW ${a.www}`);
    });
    if (indi.famc) L.push(`1 FAMC @${indi.famc}@`);
    (indi.fams || []).forEach(f => L.push(`1 FAMS @${f}@`));
    (indi.notes || []).forEach(n => L.push(`1 NOTE ${n}`));
    (indi.sourceRefs || []).forEach(sr => {
      L.push(`1 SOUR @${sr.sourceId}@`);
      if (sr.page) L.push(`2 PAGE ${sr.page}`);
    });
    (indi.multimediaRefs || []).forEach(mref => {
      const mm = multimedia[mref];
      if (!mm || mm.deletedAt) return;
      // Find per-person tag with objeProps for roundtrip fidelity
      const tag = (mm.tags || []).find(t => t.personId === indi.id);
      const op = tag && tag.objeProps;
      (mm.files || []).forEach(f => {
        L.push('1 OBJE');
        const form = op ? (f.form || '') : f.form;
        const file = f.file;
        const title = f.title;
        if (form)            L.push(`2 FORM ${form}`);
        if (file)            L.push(`2 FILE ${file}`);
        if (title)           L.push(`2 TITL ${title}`);
        // Per-person flags from objeProps (if available), else fall back to file-level
        const primary       = op ? op.primary       : f.primary;
        const cutout        = op ? op.cutout        : f.cutout;
        const parentRin     = op ? op.parentRin     : f.parentRin;
        const personalPhoto = op ? op.personalPhoto : f.personalPhoto;
        const photoRin      = op ? op.photoRin      : f.photoRin;
        const primaryCutout = op ? op.primaryCutout : f.primaryCutout;
        const parentPhoto   = op ? op.parentPhoto   : f.parentPhoto;
        const note          = op ? op.note          : f.note;
        if (primary)         L.push('2 _PRIM Y');
        if (cutout)          L.push('2 _CUTOUT Y');
        if (parentRin)       L.push(`2 _PARENTRIN ${parentRin}`);
        if (personalPhoto)   L.push('2 _PERSONALPHOTO Y');
        if (photoRin)        L.push(`2 _PHOTO_RIN ${photoRin}`);
        if (primaryCutout)   L.push('2 _PRIM_CUTOUT Y');
        if (parentPhoto)     L.push('2 _PARENTPHOTO Y');
        // Per-person _POSITION from objeProps, then tag pixelCoords, then file-level
        if (op && op.position) {
          L.push(`2 _POSITION ${op.position}`);
        } else if (f.position) {
          L.push(`2 _POSITION ${f.position}`);
        } else if (tag && tag.pixelCoords) {
          const pc = tag.pixelCoords;
          L.push(`2 _POSITION ${pc.x1} ${pc.y1} ${pc.x2} ${pc.y2}`);
        }
        if (note)            L.push(`2 NOTE ${note}`);
        // Photo metadata
        const photoDate  = op ? op.photoDate  : f.photoDate;
        const photoPlace = op ? op.photoPlace : f.photoPlace;
        if (photoDate)       L.push(`2 _DATE ${photoDate}`);
        if (photoPlace)      L.push(`2 _PLACE ${photoPlace}`);
      });
    });
  });

  // FAMilies
  Object.values(families).filter(f => !f.deletedAt).forEach(fam => {
    L.push(`0 @${fam.id}@ FAM`);
    if (fam.husb) L.push(`1 HUSB @${fam.husb}@`);
    if (fam.wife) L.push(`1 WIFE @${fam.wife}@`);
    if (fam.relationshipOrder) L.push(`1 _RELORDER ${fam.relationshipOrder}`);
    (fam.children || []).forEach(c => L.push(`1 CHIL @${c}@`));
    (fam.events || []).forEach(ev => {
      if (!ev.type) return;
      L.push(`1 ${ev.type.toUpperCase()}`);
      if (ev.date)        L.push(`2 DATE ${ev.date}`);
      if (ev.place)       L.push(`2 PLAC ${ev.place}`);
      if (ev.country)     L.push(`2 _CTRY ${ev.country}`);
      if (ev.description) L.push(`2 TYPE ${ev.description}`);
      if (ev.cause)       L.push(`2 CAUS ${ev.cause}`);
      if (ev.age)         L.push(`2 AGE ${ev.age}`);
    });
  });

  // SOURces
  Object.values(sources).filter(s => !s.deletedAt).forEach(src => {
    L.push(`0 @${src.id}@ SOUR`);
    if (src.title)       L.push(`1 TITL ${src.title}`);
    if (src.author)      L.push(`1 AUTH ${src.author}`);
    if (src.publication) L.push(`1 PUBL ${src.publication}`);
  });

  // REPOsitories
  Object.values(repositories).filter(r => !r.deletedAt).forEach(repo => {
    L.push(`0 @${repo.id}@ REPO`);
    if (repo.name) L.push(`1 NAME ${repo.name}`);
  });

  // NOTEs
  Object.values(notes).filter(n => !n.deletedAt).forEach(note => {
    L.push(`0 @${note.id}@ NOTE ${note.text || ''}`);
  });

  L.push('0 TRLR');

  return L.join('\n');
}

module.exports = { buildGedcomText };
