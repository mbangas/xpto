/**
 * history-logger.js — myLineage
 * Regista automaticamente as acções do utilizador em localStorage('history:myLineage').
 * Inclui em todas as páginas antes de </body>.
 */
(function () {
  'use strict';

  const HIST_KEY  = 'history:myLineage';
  const MAX_ITEMS = 500;

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const _orig = localStorage.setItem.bind(localStorage);

  function now() { return new Date().toISOString(); }

  function readHist() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; }
  }

  function writeHist(entries) {
    try { _orig(HIST_KEY, JSON.stringify(entries)); } catch (e) {}
  }

  function pushEntries(msgs) {
    if (!msgs || msgs.length === 0) return;
    const ts      = now();
    const entries = readHist();
    for (const m of msgs) {
      entries.unshift({ ts, category: m.category || 'geral', action: m.action, detail: m.detail || '' });
    }
    if (entries.length > MAX_ITEMS) entries.length = MAX_ITEMS;
    writeHist(entries);
  }

  /* ── public API ──────────────────────────────────────────────────────── */
  /**
   * window.logHistory(action, detail, category)
   * Para chamadas explícitas em qualquer página.
   */
  window.logHistory = function (action, detail, category) {
    pushEntries([{ action, detail, category: category || 'geral' }]);
  };

  /* ── entity labels ──────────────────────────────────────────────────── */
  const EVENT_TYPES = {
    BIRTH: 'Nascimento', BIRT: 'Nascimento',
    DEATH: 'Óbito',      DEAT: 'Óbito',
    MARRIAGE: 'Casamento', MARR: 'Casamento',
    DIVORCE: 'Divórcio',   DIV:  'Divórcio',
    BAPTISM: 'Baptismo',   BAPM: 'Baptismo',
    BURIAL:  'Enterro',    BURI: 'Enterro',
    GRADUATION: 'Formatura',
  };
  const REL_TYPES = {
    parent:  'Pai/Mãe → Filho/a',
    child:   'Filho/a → Pai/Mãe',
    spouse:  'Cônjuge',
    sibling: 'Irmão/ã',
  };

  function pName(p) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ') || '(sem nome)';
  }
  function eType(t) {
    return EVENT_TYPES[(t || '').toUpperCase()] || t || 'Evento';
  }
  function rType(t) {
    return REL_TYPES[(t || '').toLowerCase()] || t || 'Relação';
  }

  /* ── diff helpers ────────────────────────────────────────────────────── */
  function diffArray(oldArr, newArr, idFn, toMsg) {
    const oldMap = new Map(oldArr.map(x => [idFn(x), x]));
    const newMap = new Map(newArr.map(x => [idFn(x), x]));
    const msgs   = [];

    // created
    for (const [id, item] of newMap) {
      if (!oldMap.has(id)) msgs.push(toMsg('create', item, null));
    }
    // soft-deleted or updated
    for (const [id, item] of newMap) {
      const old = oldMap.get(id);
      if (!old) continue;
      const wasDeleted = !old.deletedAt && item.deletedAt;
      if (wasDeleted) {
        msgs.push(toMsg('delete', item, old));
      } else if (!item.deletedAt && JSON.stringify(old) !== JSON.stringify(item)) {
        msgs.push(toMsg('update', item, old));
      }
    }
    return msgs;
  }

  function diffPeople(oldArr, newArr) {
    return diffArray(oldArr, newArr,
      p => p.id,
      (op, p) => ({
        category: 'pessoas',
        action:   op === 'create' ? 'Pessoa criada' : op === 'delete' ? 'Pessoa eliminada' : 'Pessoa actualizada',
        detail:   pName(p),
      })
    );
  }

  function diffEvents(oldArr, newArr) {
    return diffArray(oldArr, newArr,
      e => e.id,
      (op, e) => ({
        category: 'eventos',
        action:   op === 'create' ? 'Evento criado' : op === 'delete' ? 'Evento eliminado' : 'Evento actualizado',
        detail:   eType(e.type) + (e.date ? ' · ' + e.date : '') + (e.location ? ' · ' + e.location : ''),
      })
    );
  }

  function diffRelations(oldArr, newArr) {
    return diffArray(oldArr, newArr,
      r => r.id,
      (op, r) => ({
        category: 'relacoes',
        action:   op === 'create' ? 'Relação criada' : op === 'delete' ? 'Relação eliminada' : 'Relação actualizada',
        detail:   rType(r.type),
      })
    );
  }

  function diffPhotos(oldArr, newArr) {
    const oldIds = new Set(oldArr.map(p => p.id));
    const newIds = new Set(newArr.map(p => p.id));
    const msgs   = [];
    for (const p of newArr) {
      if (!oldIds.has(p.id)) msgs.push({ category: 'album', action: 'Foto adicionada', detail: p.caption || p.filename || '' });
    }
    for (const p of oldArr) {
      if (!newIds.has(p.id)) msgs.push({ category: 'album', action: 'Foto removida', detail: p.caption || p.filename || '' });
    }
    return msgs;
  }

  function diffDocuments(oldArr, newArr) {
    const oldIds = new Set(oldArr.map(d => d.id));
    const newIds = new Set(newArr.map(d => d.id));
    const msgs   = [];
    for (const d of newArr) {
      if (!oldIds.has(d.id)) msgs.push({ category: 'documentos', action: 'Documento adicionado', detail: d.title || d.filename || '' });
    }
    for (const d of oldArr) {
      if (!newIds.has(d.id)) msgs.push({ category: 'documentos', action: 'Documento removido', detail: d.title || d.filename || '' });
    }
    return msgs;
  }

  function diffImportHistory(oldArr, newArr) {
    if (!newArr.length) return [];
    const oldLen = oldArr.length;
    if (newArr.length > oldLen) {
      const latest = newArr[0];
      const detail = latest
        ? `${latest.people || latest.peopleCount || 0} pessoas · ${latest.events || latest.eventsCount || 0} eventos · ${latest.relations || latest.relationsCount || 0} relações`
        : '';
      return [{ category: 'gedcom', action: 'GEDCOM importado', detail }];
    }
    return [];
  }

  /* ── localStorage patch ─────────────────────────────────────────────── */
  localStorage.setItem = function (key, value) {
    if (key === HIST_KEY) { _orig(key, value); return; }          // bypass for self

    const oldRaw = localStorage.getItem(key);
    _orig(key, value);                                             // write first

    try {
      let msgs = [];
      const parse = raw => { try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; } };

      if      (key === 'people:myLineage')        msgs = diffPeople(parse(oldRaw), parse(value));
      else if (key === 'events:myLineage')         msgs = diffEvents(parse(oldRaw), parse(value));
      else if (key === 'relations:myLineage')      msgs = diffRelations(parse(oldRaw), parse(value));
      else if (key === 'photos:myLineage')         msgs = diffPhotos(parse(oldRaw), parse(value));
      else if (key === 'documents:myLineage')      msgs = diffDocuments(parse(oldRaw), parse(value));
      else if (key === 'importHistory:myLineage')  msgs = diffImportHistory(parse(oldRaw), parse(value));

      pushEntries(msgs);
    } catch (e) { /* silent */ }
  };

})();
