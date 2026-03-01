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
      if (n.given)    L.push(`2 GIVN ${n.given}`);
      if (n.surname)  L.push(`2 SURN ${n.surname}`);
      if (n.prefix)   L.push(`2 NPFX ${n.prefix}`);
      if (n.suffix)   L.push(`2 NSFX ${n.suffix}`);
      if (n.nickname) L.push(`2 NICK ${n.nickname}`);
    });
    if (indi.sex) L.push(`1 SEX ${indi.sex}`);
    (indi.events || []).forEach(ev => {
      if (!ev.type) return;
      L.push(`1 ${ev.type.toUpperCase()}`);
      if (ev.date)  L.push(`2 DATE ${ev.date}`);
      if (ev.place) L.push(`2 PLAC ${ev.place}`);
    });
    (indi.attributes || []).forEach(a => {
      if (!a.type) return;
      L.push(`1 ${a.type.toUpperCase()} ${a.value || ''}`);
    });
    if (indi.famc) L.push(`1 FAMC @${indi.famc}@`);
    (indi.fams || []).forEach(f => L.push(`1 FAMS @${f}@`));
    (indi.notes || []).forEach(n => L.push(`1 NOTE ${n}`));
    (indi.sourceRefs || []).forEach(sr => {
      L.push(`1 SOUR @${sr.sourceId}@`);
      if (sr.page) L.push(`2 PAGE ${sr.page}`);
    });
  });

  // FAMilies
  Object.values(families).filter(f => !f.deletedAt).forEach(fam => {
    L.push(`0 @${fam.id}@ FAM`);
    if (fam.husb) L.push(`1 HUSB @${fam.husb}@`);
    if (fam.wife) L.push(`1 WIFE @${fam.wife}@`);
    (fam.children || []).forEach(c => L.push(`1 CHIL @${c}@`));
    (fam.events || []).forEach(ev => {
      if (!ev.type) return;
      L.push(`1 ${ev.type.toUpperCase()}`);
      if (ev.date)  L.push(`2 DATE ${ev.date}`);
      if (ev.place) L.push(`2 PLAC ${ev.place}`);
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
