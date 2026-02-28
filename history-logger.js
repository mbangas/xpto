/**
 * history-logger.js — GEDCOM 7 audit logger for myLineage
 * Monitors GedcomDB mutations and pushes entries to the history log.
 *
 * Include this AFTER remote-storage.js on pages that need auditing.
 */
(function(){
  'use strict';
  if (!window.GedcomDB) return;

  const DB = window.GedcomDB;

  const ENTITY_LABELS = {
    Individual: 'Indivíduo',
    Family:     'Família',
    Source:     'Fonte',
    Repository: 'Repositório',
    Multimedia: 'Multimédia',
    Note:       'Nota',
    Submitter:  'Submissor'
  };

  const ACTION_LABELS = {
    create: 'Criar',
    update: 'Actualizar',
    delete: 'Eliminar'
  };

  const ENTITY_CATEGORIES = {
    Individual: 'pessoas',
    Family:     'relacoes',
    Source:     'documentos',
    Multimedia: 'album',
    Note:       'geral',
    Repository: 'geral',
    Submitter:  'geral'
  };

  /** Extract display name from an individual object */
  function nameOf(indi) {
    if (!indi || !indi.names || !indi.names[0]) return '';
    return ((indi.names[0].given || '') + ' ' + (indi.names[0].surname || '')).trim();
  }

  function wrap(original, entityType, fnName){
    return function(){
      const data = arguments[0];
      const isDelete = fnName.startsWith('delete');

      // For deletions, resolve the person's name BEFORE the record disappears
      let preDeleteName = '';
      if (isDelete && entityType === 'Individual') {
        try {
          const lookupId = typeof data === 'string' ? data : (data && data.id);
          if (lookupId) preDeleteName = nameOf(DB.getIndividual(String(lookupId)));
        } catch(e2) { /* silent */ }
      }

      const result = original.apply(DB, arguments);

      try {
        const id = (typeof data === 'string') ? data : (data && data.id) || (result && result.id) || '?';
        let actionKey = 'update';
        if (isDelete) actionKey = 'delete';
        else if (fnName.startsWith('save') && data && !data.updatedAt) actionKey = 'create';

        const label    = ENTITY_LABELS[entityType] || entityType;
        const verb     = ACTION_LABELS[actionKey]  || actionKey;
        const category = ENTITY_CATEGORIES[entityType] || 'geral';

        // Resolve name: pre-fetched (delete), from result (save), or from data
        let personName = preDeleteName;
        if (!personName && entityType === 'Individual') {
          personName = nameOf(result) || nameOf(data);
        }

        const actionText = personName
          ? `${verb} ${label}: ${personName}`
          : `${verb} ${label}`;
        const detail = personName ? '' : (label + ' ' + id);

        DB.addHistory({
          ts:       new Date().toISOString(),
          entity:   entityType,
          action:   actionText,
          id:       String(id),
          detail:   detail,
          category: category
        });
      } catch(e) { /* silent */ }
      return result;
    };
  }

  // Wrap mutation methods
  DB.saveIndividual   = wrap(DB.saveIndividual,   'Individual', 'save');
  DB.deleteIndividual = wrap(DB.deleteIndividual, 'Individual', 'delete');
  DB.saveFamily       = wrap(DB.saveFamily,       'Family',     'save');
  DB.deleteFamily     = wrap(DB.deleteFamily,     'Family',     'delete');
  DB.saveSource       = wrap(DB.saveSource,       'Source',     'save');
  DB.deleteSource     = wrap(DB.deleteSource,     'Source',     'delete');
  DB.saveRepository   = wrap(DB.saveRepository,   'Repository', 'save');
  DB.deleteRepository = wrap(DB.deleteRepository, 'Repository', 'delete');
  DB.saveMultimedia   = wrap(DB.saveMultimedia,   'Multimedia', 'save');
  DB.deleteMultimedia = wrap(DB.deleteMultimedia, 'Multimedia', 'delete');
  DB.saveNote         = wrap(DB.saveNote,         'Note',       'save');
  DB.deleteNote       = wrap(DB.deleteNote,       'Note',       'delete');
  DB.saveSubmitter    = wrap(DB.saveSubmitter,    'Submitter',  'save');
  DB.deleteSubmitter  = wrap(DB.deleteSubmitter,  'Submitter',  'delete');
})();
