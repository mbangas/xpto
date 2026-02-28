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
    Family: 'Família',
    Source: 'Fonte',
    Repository: 'Repositório',
    Multimedia: 'Multimédia',
    Note: 'Nota',
    Submitter: 'Submissor'
  };

  function wrap(original, entityType, fnName){
    return function(){
      const result = original.apply(DB, arguments);
      try {
        const data = arguments[0];
        const id = (typeof data === 'string') ? data : (data && data.id) || (result && result.id) || '?';
        let action = 'update';
        if (fnName.startsWith('delete')) action = 'delete';
        else if (fnName.startsWith('save') && data && !data.updatedAt) action = 'create';
        const label = ENTITY_LABELS[entityType] || entityType;
        let desc = '';
        if (entityType === 'Individual' && result && result.names && result.names[0]) {
          desc = ((result.names[0].given || '') + ' ' + (result.names[0].surname || '')).trim();
        }
        DB.addHistory({
          timestamp: new Date().toISOString(),
          entity: entityType,
          action: action,
          id: String(id),
          description: desc ? label + ': ' + desc : label + ' ' + id,
          detail: action + ' ' + label.toLowerCase() + ' ' + id
        });
      } catch(e) { /* silent */ }
      return result;
    };
  }

  // Wrap mutation methods
  DB.saveIndividual  = wrap(DB.saveIndividual,  'Individual', 'save');
  DB.deleteIndividual= wrap(DB.deleteIndividual,'Individual', 'delete');
  DB.saveFamily      = wrap(DB.saveFamily,      'Family',     'save');
  DB.deleteFamily    = wrap(DB.deleteFamily,    'Family',     'delete');
  DB.saveSource      = wrap(DB.saveSource,      'Source',     'save');
  DB.deleteSource    = wrap(DB.deleteSource,    'Source',     'delete');
  DB.saveRepository  = wrap(DB.saveRepository,  'Repository', 'save');
  DB.deleteRepository= wrap(DB.deleteRepository,'Repository','delete');
  DB.saveMultimedia  = wrap(DB.saveMultimedia,  'Multimedia', 'save');
  DB.deleteMultimedia= wrap(DB.deleteMultimedia,'Multimedia', 'delete');
  DB.saveNote        = wrap(DB.saveNote,        'Note',       'save');
  DB.deleteNote      = wrap(DB.deleteNote,      'Note',       'delete');
  DB.saveSubmitter   = wrap(DB.saveSubmitter,   'Submitter',  'save');
  DB.deleteSubmitter = wrap(DB.deleteSubmitter, 'Submitter',  'delete');
})();
