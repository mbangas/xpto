/**
 * edit-person-drawer.js
 * Shared "Edit Person" drawer for arvore.html, app.html and validacao.html.
 *
 * Configuration — each page sets window.DRAWER_CONFIG BEFORE this script loads:
 *
 *   window.DRAWER_CONFIG = {
 *     // What the "Ver na Árvore" button does. If omitted the button is hidden.
 *     treeBtnAction: function(personId) { ... },
 *     // Called after a person is saved (create or update). Receives saved id.
 *     afterSave:     function(personId) { ... },
 *     // Called after a person is permanently deleted. Receives the deleted id.
 *     afterDelete:   function(deletedId) { ... },
 *   };
 *
 * Depends on:
 *   window.GedcomDB     — GEDCOM data store (set by remote-storage.js)
 *   window.PhotoLightbox — photo viewer (set by photo-lightbox.js)
 */
(function () {
  'use strict';

  /* ── Data store ──────────────────────────────────────────────────────────── */
  function _db() { return window.GedcomDB; }

  /* ── Permission helper ───────────────────────────────────────────────────── */
  function _canEdit() {
    var DB = _db();
    return DB && typeof DB.canEdit === 'function' ? DB.canEdit() : true;
  }

  /* ── HTML escape ─────────────────────────────────────────────────────────── */
  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── GEDCOM date utilities ───────────────────────────────────────────────── */
  var MONTHS     = ['','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var MONTHS_MAP = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  var QUAL_TO_GED = {'Antes de':'BEF','Depois de':'AFT','Cerca de':'ABT'};
  var GED_TO_QUAL = {BEF:'Antes de',AFT:'Depois de',ABT:'Cerca de',EST:'Cerca de'};

  function buildGedcomDate(day, month, year, qualifier) {
    var p = [];
    if (qualifier && qualifier !== 'Exatamente') p.push(QUAL_TO_GED[qualifier] || qualifier);
    if (day)   p.push(String(day));
    if (month) p.push(MONTHS[month] || '');
    if (year)  p.push(String(year));
    return p.join(' ');
  }

  function parseGedcomDate(s) {
    if (!s) return {};
    var tokens = s.toUpperCase().split(/\s+/);
    var q = null, d = null, m = null, y = null;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (GED_TO_QUAL[t])                    q = GED_TO_QUAL[t];
      else if (MONTHS_MAP[t])                m = MONTHS_MAP[t];
      else if (/^\d{3,4}$/.test(t))          y = parseInt(t);
      else if (/^\d{1,2}$/.test(t) && !d)   d = parseInt(t);
    }
    return { day: d, month: m, year: y, qualifier: q };
  }

  function fmtEventDate(ev) {
    if (!ev || !ev.date) return '';
    var p = parseGedcomDate(ev.date);
    var qualMap = { 'Antes de': 'ant.', 'Depois de': 'dep.', 'Cerca de': 'c.' };
    var q = p.qualifier ? (qualMap[p.qualifier] || p.qualifier) + ' ' : '';
    var parts = [];
    if (p.day)   parts.push(String(p.day).padStart(2, '0'));
    if (p.month) parts.push(String(p.month).padStart(2, '0'));
    if (p.year)  parts.push(String(p.year));
    return q + (parts.length ? parts.join('/') : ev.date);
  }

  /* ── Drawer state ────────────────────────────────────────────────────────── */
  var _drawerPersonId = null;
  var _drawerMode     = 'edit';

  /* ── Open / Close ────────────────────────────────────────────────────────── */
  function openDrawer(mode, personId) {
    var DB = _db();
    var editable = _canEdit();
    var footer  = document.querySelector('.drawer-footer');
    var backBtn = document.getElementById('drawerBackBtn');
    var phdr    = document.getElementById('drawerPersonHeader');
    if (footer)  footer.style.display = editable ? '' : 'none';
    if (backBtn) { backBtn.style.display = 'none'; backBtn._personId = null; }
    if (phdr)    phdr.style.display = '';

    _drawerMode     = mode;
    _drawerPersonId = personId ? String(personId) : null;

    var indi = (personId && DB) ? DB.getIndividual(personId) : null;

    document.getElementById('drawerTitle').textContent = (mode === 'create') ? 'Nova Pessoa' : 'Editar Pessoa';

    /* Tree button */
    var cfg      = window.DRAWER_CONFIG || {};
    var treeBtn  = document.getElementById('drawerTreeBtn');
    if (treeBtn) {
      var showTree = (mode === 'edit' && personId && typeof cfg.treeBtnAction === 'function');
      treeBtn.style.display = showTree ? 'flex' : 'none';
      treeBtn.onclick = showTree ? function () { cfg.treeBtnAction(_drawerPersonId); } : null;
    }

    /* Person header (avatar, name, dates) */
    var nameEl   = document.getElementById('drawerPersonName');
    var subEl    = document.getElementById('drawerPersonSub');
    var avatarEl = document.getElementById('drawerAvatar');
    if (indi && DB) {
      nameEl.textContent = DB.getDisplayName(indi);
      var sub = [];
      var birth = DB.getBirthEvent(indi); if (birth && birth.date) sub.push('\u2605 ' + fmtEventDate(birth));
      var death = DB.getDeathEvent(indi); if (death && death.date) sub.push('\u271D ' + fmtEventDate(death));
      subEl.textContent = sub.join('  \u00b7  ');
      var thumb = DB.getThumbnailForPerson(indi.id);
      if (thumb) {
        avatarEl.style.backgroundImage    = 'url(' + thumb + ')';
        avatarEl.style.backgroundSize     = 'cover';
        avatarEl.style.backgroundPosition = 'center';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.style.background = indi.sex === 'F' ? '#e26aa6' : indi.sex === 'M' ? '#4493f8' : '#9aa0a6';
      }
    } else {
      nameEl.textContent = 'Nova Pessoa';
      subEl.textContent  = '';
      avatarEl.style.backgroundImage = '';
      avatarEl.style.background = 'var(--bg-surface-2)';
    }

    /* Identity form */
    var given       = (indi && DB) ? (DB.getGivenName(indi)  || '') : '';
    var surname     = (indi && DB) ? (DB.getSurname(indi)    || '') : '';
    var nameRec     = (indi && indi.names && indi.names[0])  || {};
    var marriedName = nameRec.marriedName || '';
    var aka         = nameRec.aka         || '';
    var sex         = indi ? (indi.sex    || '') : '';
    var notes       = indi ? (indi.notes  || '') : '';
    var isDeceased  = indi ? !!(indi.events && indi.events.some(function (e) { return e.type === 'DEAT'; })) : false;
    var deceasedPid = indi ? '\'' + _esc(indi.id) + '\'' : 'null';
    var ro = editable ? '' : ' readonly';
    var dis = editable ? '' : ' disabled';

    var body = document.getElementById('drawerBody');
    body.innerHTML = [
      '<div class="drawer-section-label">Identidade</div>',
      '<div class="form-row">',
        '<div><label>Primeiro nome</label><input type="text" id="df_firstName" value="' + _esc(given)   + '" placeholder="Nome"' + ro + ' /></div>',
        '<div><label>Apelido</label><input type="text" id="df_lastName" value="'        + _esc(surname) + '" placeholder="Apelido"' + ro + ' /></div>',
      '</div>',
      '<div class="form-row">',
        '<div><label>Nome de casada</label><input type="text" id="df_marriedName" value="' + _esc(marriedName) + '" placeholder="Nome de casada"' + ro + ' /></div>',
        '<div><label>Tamb\u00e9m conhecido como</label><input type="text" id="df_aka" value="' + _esc(aka) + '" placeholder="Outros nomes"' + ro + ' /></div>',
      '</div>',
      '<div><label>G\u00e9nero</label>',
        '<select id="df_gender"' + dis + '>',
          '<option value=""'   + (!sex         ? ' selected' : '') + '>\u200b(n/a)</option>',
          '<option value="M"'  + (sex === 'M'  ? ' selected' : '') + '>Masculino</option>',
          '<option value="F"'  + (sex === 'F'  ? ' selected' : '') + '>Feminino</option>',
          '<option value="X"'  + (sex === 'X'  ? ' selected' : '') + '>Outro</option>',
        '</select></div>',
      editable ? [
      '<div style="margin-top:10px;padding:8px 0 4px;display:flex;align-items:center;gap:12px;">',
        '<span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#999;">Falecido/a</span>',
        '<label style="position:relative;display:inline-block;width:42px;height:22px;cursor:pointer;flex-shrink:0;">',
          '<input type="checkbox" id="df_deceased"' + (isDeceased ? ' checked' : '') + ' style="opacity:0;position:absolute;width:0;height:0;" onchange="_drawerToggleDeceased(this.checked,' + deceasedPid + ')"/>',
          '<span id="df_deceasedTrack" style="position:absolute;inset:0;border-radius:11px;background:' + (isDeceased ? 'var(--accent,#4493f8)' : '#444') + ';transition:background 0.2s;"></span>',
          '<span id="df_deceasedThumb" style="position:absolute;top:3px;left:' + (isDeceased ? '23' : '3') + 'px;width:16px;height:16px;background:#fff;border-radius:50%;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,.5);"></span>',
        '</label>',
      '</div>'].join('') : '',
      '<div class="drawer-section-label" style="margin-top:8px;">Notas</div>',
      '<div><textarea id="df_notes" rows="3" placeholder="Notas..."' + ro + '>' + _esc(notes) + '</textarea></div>',
      indi ? [
        '<div style="margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">',
          '<button class="btn btn-ghost btn-sm" style="font-size:0.82rem;" onclick="openDrawerSection(\'' + _esc(indi.id) + '\',\'relacoes\')"><i class="mdi mdi-account-multiple-outline"></i> Rela\u00e7\u00f5es</button>',
          '<button class="btn btn-ghost btn-sm" style="font-size:0.82rem;" onclick="openDrawerSection(\'' + _esc(indi.id) + '\',\'eventos\')"><i class="mdi mdi-calendar-check-outline"></i> Eventos</button>',
          '<button class="btn btn-ghost btn-sm" style="font-size:0.82rem;" onclick="openDrawerSection(\'' + _esc(indi.id) + '\',\'fotos\')"><i class="mdi mdi-image-multiple-outline"></i> Fotos</button>',
          '<button class="btn btn-ghost btn-sm" style="font-size:0.82rem;" onclick="openDrawerSection(\'' + _esc(indi.id) + '\',\'contactos\')"><i class="mdi mdi-card-account-phone-outline"></i> Contactos</button>',
        '</div>',
        editable ? [
        '<div style="margin-top:10px;display:flex;gap:8px;">',
          '<button class="btn btn-sm" style="font-size:0.82rem;gap:5px;" onclick="_drawerShowAddPerson(\'' + _esc(indi.id) + '\')"><i class="mdi mdi-account-plus-outline"></i> Adicionar</button>',
          '<button class="btn btn-sm" style="font-size:0.82rem;gap:5px;" onclick="_drawerShowLinkPerson(\'' + _esc(indi.id) + '\')"><i class="mdi mdi-link-variant"></i> Ligar</button>',
        '</div>'].join('') : ''
      ].join('') : ''
    ].join('');

    document.getElementById('personDrawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    setTimeout(function () { var fi = document.getElementById('df_firstName'); if (fi) fi.focus(); }, 50);
  }

  function closeDrawer() {
    document.getElementById('personDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
  }

  window.openDrawer  = openDrawer;
  window.closeDrawer = closeDrawer;

  /* ── Section dispatcher ──────────────────────────────────────────────────── */
  window.openDrawerSection = function (personId, section) {
    var DB   = _db();
    var indi = DB ? DB.getIndividual(personId) : null;
    if (!indi) return;
    var footer  = document.querySelector('.drawer-footer');
    var phdr    = document.getElementById('drawerPersonHeader');
    var backBtn = document.getElementById('drawerBackBtn');
    var treeBtn = document.getElementById('drawerTreeBtn');
    if (footer)  footer.style.display  = 'none';
    if (phdr)    phdr.style.display    = 'none';
    if (treeBtn) treeBtn.style.display = 'none';
    if (backBtn) { backBtn.style.display = ''; backBtn._personId = personId; }

    var label = section === 'relacoes' ? 'Rela\u00e7\u00f5es'
              : section === 'fotos'    ? 'Fotos'
              : section === 'contactos'? 'Contactos'
              : 'Eventos';
    document.getElementById('drawerTitle').textContent = label + ' \u2014 ' + DB.getDisplayName(indi);

    var body = document.getElementById('drawerBody');
    if      (section === 'relacoes')  body.innerHTML = _renderRelations(personId);
    else if (section === 'fotos')   { body.innerHTML = _renderPhotos(personId); _buildPhotoGrid(personId); }
    else if (section === 'contactos') body.innerHTML = _renderContacts(personId);
    else                              body.innerHTML = _renderEvents(personId);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     EVENTS SECTION
  ══════════════════════════════════════════════════════════════════════════ */
  var EVENT_TYPES = {BIRT:'Nascimento',BAPM:'Batismo',CHR:'Crisma',DEAT:'Óbito',ADOP:'Adoção',DIV:'Divórcio',EVEN:'Outro'};

  function _renderEvents(personId) {
    var DB   = _db();
    var indi = DB ? DB.getIndividual(personId) : null;
    var evs  = (indi && indi.events) || [];
    var editable = _canEdit();
    var marrEvs = [];
    if (DB) {
      DB.getFamilies().filter(function (f) { return f.husb === personId || f.wife === personId; })
        .forEach(function (fam) {
          (fam.events || []).forEach(function (ev, i) { if (ev.type === 'MARR') marrEvs.push({ ev: ev, famId: fam.id, famIdx: i }); });
        });
    }
    var pid  = _esc(personId);
    var html = editable ? '<div style="margin-bottom:12px;"><button class="btn btn-sm" onclick="_drawerShowAddEvent(\'' + pid + '\')" style="font-size:0.83rem;"><i class="mdi mdi-plus"></i> Adicionar Evento</button></div>' : '';
    if (!evs.length && !marrEvs.length) { html += '<div style="color:#888;padding:4px 0 12px;">Nenhum evento cadastrado.</div>'; return html; }
    html += '<div class="mini-list">';
    evs.forEach(function (ev, i) {
      var label = EVENT_TYPES[ev.type] || ev.type || '';
      var _placeDisplay = (ev.place || ev.country)
        ? (ev.place ? _esc(ev.place) + (ev.country ? ' &mdash; ' + _esc(ev.country) : '') : _esc(ev.country))
        : null;
      var actionBtns = editable ? '<div style="display:flex;gap:2px;flex-shrink:0;"><button onclick="_drawerEditEvent(' + i + ',\'' + pid + '\')" title="Editar" style="background:none;border:none;cursor:pointer;color:#4493f8;padding:2px 4px;font-size:1rem;"><i class="mdi mdi-pencil-outline"></i></button><button onclick="_drawerDeleteEvent(' + i + ',\'' + pid + '\')" title="Apagar" style="background:none;border:none;cursor:pointer;color:#e06060;padding:2px 4px;font-size:1rem;"><i class="mdi mdi-trash-can-outline"></i></button></div>' : '';
      html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><span style="font-weight:600;font-size:0.9rem;">' + _esc(label) + '</span><span style="color:#888;font-size:0.82rem;margin-left:8px;">' + _esc(fmtEventDate(ev)) + '</span></div>' + actionBtns + '</div>'
        + (_placeDisplay  ? '<div style="color:#aaa;font-size:0.82rem;margin-top:3px;">&#128205; ' + _placeDisplay + '</div>' : '')
        + (ev.description ? '<div style="color:#aaa;font-size:0.82rem;margin-top:3px;"><i class="mdi mdi-tag-outline" style="margin-right:3px;"></i>'            + _esc(ev.description) + '</div>' : '')
        + (ev.cause       ? '<div style="color:#aaa;font-size:0.82rem;margin-top:3px;"><i class="mdi mdi-alert-circle-outline" style="margin-right:3px;"></i>'   + _esc(ev.cause)       + '</div>' : '')
        + (ev.age         ? '<div style="color:#aaa;font-size:0.82rem;margin-top:3px;"><i class="mdi mdi-account-clock-outline" style="margin-right:3px;"></i>'  + _esc(ev.age)         + '</div>' : '')
        + (ev.notes       ? '<div style="color:#bbb;font-size:0.82rem;margin-top:3px;">'                                                                         + _esc(ev.notes)       + '</div>' : '')
        + '</div>';
    });
    marrEvs.forEach(function (item) {
      var ev = item.ev; var famId = item.famId; var famIdx = item.famIdx;
      var marrBtns = editable ? '<div style="display:flex;gap:2px;flex-shrink:0;"><button onclick="_drawerEditMarrEvent(\'' + _esc(famId) + '\',' + famIdx + ',\'' + pid + '\')" title="Editar" style="background:none;border:none;cursor:pointer;color:#4493f8;padding:2px 4px;font-size:1rem;"><i class="mdi mdi-pencil-outline"></i></button><button onclick="_drawerDeleteMarrEvent(\'' + _esc(famId) + '\',' + famIdx + ',\'' + pid + '\')" title="Apagar" style="background:none;border:none;cursor:pointer;color:#e06060;padding:2px 4px;font-size:1rem;"><i class="mdi mdi-trash-can-outline"></i></button></div>' : '';
      html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><span style="font-weight:600;font-size:0.9rem;">Casamento</span><span style="color:#888;font-size:0.82rem;margin-left:8px;">' + _esc(fmtEventDate(ev)) + '</span></div>' + marrBtns + '</div>'
        + (ev.place ? '<div style="color:#aaa;font-size:0.82rem;margin-top:3px;">&#128205; ' + _esc(ev.place) + '</div>' : '')
        + (ev.notes ? '<div style="color:#bbb;font-size:0.82rem;margin-top:3px;">' + _esc(ev.notes) + '</div>' : '')
        + '</div>';
    });
    html += '</div>';
    return html;
  }

  window._drawerDeleteEvent = function (idx, personId) {
    var DB = _db(); if (!DB) return;
    if (!confirm('Apagar este evento?')) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var removedType = (indi.events[idx] || {}).type || 'EVEN';
    indi.events.splice(idx, 1);
    indi._changeDetail = 'Evento removido: ' + (EVENT_TYPES[removedType] || removedType);
    DB.saveIndividual(indi);
    document.getElementById('drawerBody').innerHTML = _renderEvents(personId);
  };

  window._drawerEditEvent = function (idx, personId) {
    var DB = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var ev = indi.events[idx]; if (!ev) return;
    var p    = parseGedcomDate(ev.date);
    var pid  = _esc(personId);
    var opts = Object.entries(EVENT_TYPES).map(function (e) { return '<option value="' + e[0] + '"' + (ev.type === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('');
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Editar Evento</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Tipo</label><select id="editEvType" onchange="_drawerToggleAgeField(\'edit\',this.value);_drawerToggleCauseField(\'edit\',this.value)" style="width:100%;">' + opts + '</select></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Data</label><select id="editEvQual" style="width:100%;margin-bottom:6px;"><option value="Exatamente"' + ((!p.qualifier || p.qualifier === 'Exatamente') ? ' selected' : '') + '>Exatamente</option><option value="Antes de"' + (p.qualifier === 'Antes de' ? ' selected' : '') + '>Antes de</option><option value="Depois de"' + (p.qualifier === 'Depois de' ? ' selected' : '') + '>Depois de</option><option value="Cerca de"' + (p.qualifier === 'Cerca de' ? ' selected' : '') + '>Cerca de</option></select>'
      + '<div style="display:flex;gap:6px;"><input id="editEvDay" type="number" min="1" max="31" placeholder="Dia" value="' + (p.day || '') + '" style="flex:1;min-width:0;text-align:center;"/><input id="editEvMonth" type="number" min="1" max="12" placeholder="M\u00eas" value="' + (p.month || '') + '" style="flex:1;min-width:0;text-align:center;"/><input id="editEvYear" type="number" min="1" max="9999" placeholder="Ano" value="' + (p.year || '') + '" style="flex:2;min-width:0;text-align:center;"/></div></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Local</label><input id="editEvPlace" type="text" value="' + _esc(ev.place || '') + '" style="width:100%;"/></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Pa\u00eds</label><input id="editEvCountry" type="text" list="ctCountryList" autocomplete="off" value="' + _esc(ev.country || '') + '" style="width:100%;"/></div>'
      + _CT_DATALIST
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Descri\u00e7\u00e3o</label><input id="editEvDescription" type="text" value="' + _esc(ev.description || '') + '" placeholder="Descri\u00e7\u00e3o do evento" style="width:100%;"/></div>'
      + '<div id="editEvCauseRow" style="margin-bottom:10px;' + (ev.type === 'DEAT' ? '' : 'display:none;') + '"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Causa</label><input id="editEvCause" type="text" value="' + _esc(ev.cause || '') + '" placeholder="Causa (ex: doen\u00e7a)" style="width:100%;"/></div>'
      + '<div id="editEvAgeRow" style="margin-bottom:10px;' + (ev.type === 'BIRT' ? 'display:none;' : '') + '"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Idade</label><input id="editEvAge" type="text" value="' + _esc(ev.age || '') + '" placeholder="Idade na altura" style="width:100%;"/></div>'
      + '<div style="margin-bottom:14px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Notas</label><textarea id="editEvNotes" rows="3" style="width:100%;resize:vertical;">' + _esc(ev.notes || '') + '</textarea></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-ghost btn-sm" onclick="openDrawerSection(\'' + pid + '\',\'eventos\')">Cancelar</button><button class="btn btn-sm" onclick="_drawerSaveEditEvent(' + idx + ',\'' + pid + '\')"><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
  };

  window._drawerSaveEditEvent = function (idx, personId) {
    var DB = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var type  = (document.getElementById('editEvType')        || {}).value || 'EVEN';
    var qual  = (document.getElementById('editEvQual')        || {}).value;
    var day   = parseInt((document.getElementById('editEvDay')  || {}).value) || null;
    var month = parseInt((document.getElementById('editEvMonth')|| {}).value) || null;
    var year  = parseInt((document.getElementById('editEvYear') || {}).value) || null;
    var place       = ((document.getElementById('editEvPlace')      || {}).value || '').trim();
    var country     = ((document.getElementById('editEvCountry')     || {}).value || '').trim();
    var notes       = ((document.getElementById('editEvNotes')      || {}).value || '').trim();
    var description = ((document.getElementById('editEvDescription')|| {}).value || '').trim();
    var cause       = ((document.getElementById('editEvCause')      || {}).value || '').trim();
    var age         = ((document.getElementById('editEvAge')        || {}).value || '').trim();
    var dateStr = buildGedcomDate(day, month, year, qual);
    indi.events[idx] = { type: type, date: dateStr || undefined, place: place || undefined, country: country || undefined, notes: notes || undefined, description: description || undefined, cause: cause || undefined, age: age || undefined };
    indi._changeDetail = 'Evento editado: ' + (EVENT_TYPES[type] || type);
    DB.saveIndividual(indi);
    openDrawerSection(personId, 'eventos');
  };

  window._drawerShowAddEvent = function (personId) {
    var DB   = _db(); if (!DB) return;
    var pid  = _esc(personId);
    var opts = Object.entries(EVENT_TYPES).filter(function (e) { return e[0] !== 'EVEN'; }).map(function (e) { return '<option value="' + e[0] + '">' + e[1] + '</option>'; }).join('');
    var evenOpt = '<option value="EVEN">Outro</option>';
    var spouseFams = DB.getFamilies().filter(function (f) { return f.husb === personId || f.wife === personId; });
    var marrOpt  = spouseFams.length ? '<option value="MARR">Casamento</option>' : '';
    var famOpts  = spouseFams.map(function (fam) {
      var spouseId = (fam.husb === personId) ? fam.wife : fam.husb;
      var spouse   = spouseId ? DB.getIndividual(spouseId) : null;
      var label    = spouse ? DB.getDisplayName(spouse) : '(fam\u00edlia ' + fam.id + ')';
      return '<option value="' + _esc(fam.id) + '">' + _esc(label) + '</option>';
    }).join('');
    var famRow = spouseFams.length ? '<div id="addEvFamRow" style="margin-bottom:10px;display:none;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">C\u00f4njuge</label><select id="addEvFamId" style="width:100%;">' + famOpts + '</select></div>' : '';
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Novo Evento</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Tipo</label><select id="addEvType" onchange="_drawerToggleMarrFamily(this.value);_drawerToggleAgeField(\'add\',this.value);_drawerToggleCauseField(\'add\',this.value)" style="width:100%;">' + opts + marrOpt + evenOpt + '</select></div>'
      + famRow
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Data</label><select id="addEvQual" style="width:100%;margin-bottom:6px;"><option value="Exatamente" selected>Exatamente</option><option value="Antes de">Antes de</option><option value="Depois de">Depois de</option><option value="Cerca de">Cerca de</option></select><div style="display:flex;gap:6px;"><input id="addEvDay" type="number" min="1" max="31" placeholder="Dia" style="flex:1;min-width:0;text-align:center;"/><input id="addEvMonth" type="number" min="1" max="12" placeholder="M\u00eas" style="flex:1;min-width:0;text-align:center;"/><input id="addEvYear" type="number" min="1" max="9999" placeholder="Ano" style="flex:2;min-width:0;text-align:center;"/></div></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Local</label><input id="addEvPlace" type="text" placeholder="Local do evento" style="width:100%;"/></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Pa\u00eds</label><input id="addEvCountry" type="text" list="ctCountryList" autocomplete="off" placeholder="Pa\u00eds do evento" style="width:100%;"/></div>'
      + _CT_DATALIST
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Descri\u00e7\u00e3o</label><input id="addEvDescription" type="text" placeholder="Descri\u00e7\u00e3o do evento" style="width:100%;"/></div>'
      + '<div id="addEvCauseRow" style="margin-bottom:10px;display:none;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Causa</label><input id="addEvCause" type="text" placeholder="Causa (ex: doen\u00e7a)" style="width:100%;"/></div>'
      + '<div id="addEvAgeRow" style="margin-bottom:10px;display:none;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Idade</label><input id="addEvAge" type="text" placeholder="Idade na altura" style="width:100%;"/></div>'
      + '<div style="margin-bottom:14px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Notas</label><textarea id="addEvNotes" rows="3" placeholder="Notas..." style="width:100%;resize:vertical;"></textarea></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-ghost btn-sm" onclick="openDrawerSection(\'' + pid + '\',\'eventos\')">Cancelar</button><button class="btn btn-sm" onclick="_drawerSaveNewEvent(\'' + pid + '\')"><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
  };

  window._drawerToggleMarrFamily = function (type) {
    var row = document.getElementById('addEvFamRow');
    if (row) row.style.display = (type === 'MARR') ? '' : 'none';
  };

  window._drawerToggleAgeField = function (prefix, type) {
    var row = document.getElementById(prefix + 'EvAgeRow');
    if (row) row.style.display = (type === 'BIRT') ? 'none' : '';
  };

  window._drawerToggleCauseField = function (prefix, type) {
    var row = document.getElementById(prefix + 'EvCauseRow');
    if (row) row.style.display = (type === 'DEAT') ? '' : 'none';
  };

  var EVENT_LABELS = { BIRT: 'Nascimento', BAPM: 'Batismo', CHR: 'Crisma', DEAT: 'Óbito', ADOP: 'Adoção', DIV: 'Divórcio', EVEN: 'Evento', MARR: 'Casamento' };
  window._drawerSaveNewEvent = function (personId) {
    var DB   = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var type  = (document.getElementById('addEvType')  || {}).value || 'EVEN';
    var qual  = (document.getElementById('addEvQual')  || {}).value;
    var day   = parseInt((document.getElementById('addEvDay')  || {}).value) || null;
    var month = parseInt((document.getElementById('addEvMonth')|| {}).value) || null;
    var year  = parseInt((document.getElementById('addEvYear') || {}).value) || null;
    var place       = ((document.getElementById('addEvPlace')      || {}).value || '').trim();
    var country     = ((document.getElementById('addEvCountry')     || {}).value || '').trim();
    var notes       = ((document.getElementById('addEvNotes')      || {}).value || '').trim();
    var description = ((document.getElementById('addEvDescription')|| {}).value || '').trim();
    var cause       = ((document.getElementById('addEvCause')      || {}).value || '').trim();
    var age         = ((document.getElementById('addEvAge')        || {}).value || '').trim();
    var dateStr = buildGedcomDate(day, month, year, qual);
    var newEv = { type: type, date: dateStr || undefined, place: place || undefined, country: country || undefined, notes: notes || undefined, description: description || undefined, cause: cause || undefined, age: age || undefined };
    if (type === 'MARR') {
      var famId = ((document.getElementById('addEvFamId') || {}).value || '');
      var fam   = famId ? DB.getFamily(famId) : (DB.getFamilies().filter(function (f) { return f.husb === personId || f.wife === personId; })[0] || null);
      if (!fam) { alert('N\u00e3o foi encontrado c\u00f4njuge.'); return; }
      if (!fam.events) fam.events = [];
      fam.events.push(newEv);
      DB.saveFamily(fam);
    } else {
      if (!indi.events) indi.events = [];
      indi.events.push(newEv);
      indi._changeDetail = 'Novo evento: ' + (EVENT_TYPES[type] || type);
      DB.saveIndividual(indi);
    }
    openDrawerSection(personId, 'eventos');
  };

  window._drawerEditMarrEvent = function (famId, famIdx, personId) {
    var DB  = _db(); if (!DB) return;
    var fam = DB.getFamily(famId); if (!fam) return;
    var ev  = fam.events[famIdx]; if (!ev) return;
    var p   = parseGedcomDate(ev.date);
    var pid = _esc(personId);
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Editar Casamento</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Data</label><select id="marrEvQual" style="width:100%;margin-bottom:6px;"><option value="Exatamente"' + ((!p.qualifier || p.qualifier === 'Exatamente') ? ' selected' : '') + '>Exatamente</option><option value="Antes de"' + (p.qualifier === 'Antes de' ? ' selected' : '') + '>Antes de</option><option value="Depois de"' + (p.qualifier === 'Depois de' ? ' selected' : '') + '>Depois de</option><option value="Cerca de"' + (p.qualifier === 'Cerca de' ? ' selected' : '') + '>Cerca de</option></select>'
      + '<div style="display:flex;gap:6px;"><input id="marrEvDay" type="number" min="1" max="31" placeholder="Dia" value="' + (p.day || '') + '" style="flex:1;min-width:0;text-align:center;"/><input id="marrEvMonth" type="number" min="1" max="12" placeholder="M\u00eas" value="' + (p.month || '') + '" style="flex:1;min-width:0;text-align:center;"/><input id="marrEvYear" type="number" min="1" max="9999" placeholder="Ano" value="' + (p.year || '') + '" style="flex:2;min-width:0;text-align:center;"/></div></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Local</label><input id="marrEvPlace" type="text" value="' + _esc(ev.place || '') + '" style="width:100%;"/></div>'
      + '<div style="margin-bottom:14px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Notas</label><textarea id="marrEvNotes" rows="3" style="width:100%;resize:vertical;">' + _esc(ev.notes || '') + '</textarea></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-ghost btn-sm" onclick="openDrawerSection(\'' + pid + '\',\'eventos\')">Cancelar</button><button class="btn btn-sm" onclick="_drawerSaveEditMarrEvent(\'' + _esc(famId) + '\',' + famIdx + ',\'' + pid + '\')"><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
  };

  window._drawerSaveEditMarrEvent = function (famId, famIdx, personId) {
    var DB  = _db(); if (!DB) return;
    var fam = DB.getFamily(famId); if (!fam) return;
    var qual  = (document.getElementById('marrEvQual')  || {}).value;
    var day   = parseInt((document.getElementById('marrEvDay')  || {}).value) || null;
    var month = parseInt((document.getElementById('marrEvMonth')|| {}).value) || null;
    var year  = parseInt((document.getElementById('marrEvYear') || {}).value) || null;
    if (!day && !month && !year) { alert('Preencha pelo menos um campo de data.'); return; }
    var place = ((document.getElementById('marrEvPlace')|| {}).value || '').trim();
    var notes = ((document.getElementById('marrEvNotes')|| {}).value || '').trim();
    fam.events[famIdx] = { type: 'MARR', date: buildGedcomDate(day, month, year, qual), place: place || undefined, notes: notes || undefined };
    DB.saveFamily(fam);
    openDrawerSection(personId, 'eventos');
  };

  window._drawerDeleteMarrEvent = function (famId, famIdx, personId) {
    var DB  = _db(); if (!DB) return;
    if (!confirm('Apagar este evento de casamento?')) return;
    var fam = DB.getFamily(famId); if (!fam) return;
    fam.events.splice(famIdx, 1);
    DB.saveFamily(fam);
    document.getElementById('drawerBody').innerHTML = _renderEvents(personId);
  };
  window._drawerToggleDeceased = function (isDeceased, personId) {
    var track = document.getElementById('df_deceasedTrack');
    var thumb = document.getElementById('df_deceasedThumb');
    if (track) track.style.background = isDeceased ? 'var(--accent,#4493f8)' : '#444';
    if (thumb) thumb.style.left = isDeceased ? '23px' : '3px';
    if (!personId) return;
    var DB   = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    if (!indi.events) indi.events = [];
    if (isDeceased) {
      var hasDeat = indi.events.some(function (e) { return e.type === 'DEAT'; });
      if (!hasDeat) {
        indi.events.push({ type: 'DEAT' });
        indi._changeDetail = 'Marcado/a como falecido/a';
        DB.saveIndividual(indi);
      }
    } else {
      var hadDeat = indi.events.some(function (e) { return e.type === 'DEAT'; });
      if (hadDeat) {
        indi.events = indi.events.filter(function (e) { return e.type !== 'DEAT'; });
        indi._changeDetail = 'Falecido/a desmarcado/a';
        DB.saveIndividual(indi);
      }
    }
  };
  /* ══════════════════════════════════════════════════════════════════════════
     RELATIONS SECTION
  ══════════════════════════════════════════════════════════════════════════ */
  function _renderRelations(personId) {
    var DB = _db(); if (!DB) return '<div style="color:#888;">Sem rela\u00e7\u00f5es.</div>';
    var editable = _canEdit();
    var typeDesc = { siblin: 'Irm\u00e3o / Irm\u00e3', ancestor: 'Pai / M\u00e3e', child: 'Filho(a)', mate: 'Companheiro(a)' };
    var rels = [];
    DB.getParents(personId).forEach(function  (p) { rels.push({ type: 'ancestor', targetId: p.id, name: DB.getDisplayName(p), sex: p.sex }); });
    DB.getChildren(personId).forEach(function (c) { rels.push({ type: 'child',    targetId: c.id, name: DB.getDisplayName(c), sex: c.sex }); });
    /* Mates: enrich with relationship order from FAM */
    var spouseFamsByTarget = {};
    DB.getFamiliesAsSpouse(personId).forEach(function (fam) {
      var spouseId = (fam.husb === personId) ? fam.wife : fam.husb;
      if (spouseId) spouseFamsByTarget[spouseId] = fam;
    });
    var totalMates = DB.getSpouses(personId).length;
    DB.getSpouses(personId).forEach(function  (s) {
      var fam = spouseFamsByTarget[s.id];
      var relOrder = fam && fam.relationshipOrder ? fam.relationshipOrder : null;
      rels.push({ type: 'mate', targetId: s.id, name: DB.getDisplayName(s), sex: s.sex, famId: fam ? fam.id : null, relationshipOrder: relOrder, totalMates: totalMates });
    });
    DB.getSiblings(personId).forEach(function (s) { rels.push({ type: 'siblin',   targetId: s.id, name: DB.getDisplayName(s), sex: s.sex }); });
    var pid  = _esc(personId);
    var html = editable ? '<div style="margin-bottom:12px;"><button class="btn btn-sm" onclick="_drawerShowAddRelation(\'' + pid + '\')" style="font-size:0.83rem;"><i class="mdi mdi-plus"></i> Adicionar Rela\u00e7\u00e3o</button></div>' : '';
    if (!rels.length) { html += '<div style="color:#888;padding:4px 0 12px;">Nenhuma rela\u00e7\u00e3o cadastrada.</div>'; return html; }
    html += '<div class="mini-list">';
    rels.forEach(function (r) {
      var desc = typeDesc[r.type] || r.type;
      if (r.sex === 'F') { if (desc.includes('Filho')) desc = 'Filha'; else if (desc.includes('Pai')) desc = 'M\u00e3e'; else if (desc.includes('Compan')) desc = 'Companheira'; else if (desc.includes('Irm')) desc = 'Irm\u00e3'; }
      else if (r.sex === 'M') { if (desc.includes('Filho')) desc = 'Filho'; else if (desc.includes('M\u00e3e') || desc.includes('Pai')) desc = 'Pai'; else if (desc.includes('Compan')) desc = 'Companheiro'; else if (desc.includes('Irm')) desc = 'Irm\u00e3o'; }
      var delBtn = editable ? '<button onclick="_drawerDeleteRelation(\'' + pid + '\',\'' + _esc(r.targetId) + '\',\'' + _esc(r.type) + '\')" title="Apagar" style="background:none;border:none;cursor:pointer;color:#e06060;padding:2px 4px;font-size:1rem;flex-shrink:0;"><i class="mdi mdi-trash-can-outline"></i></button>' : '';
      /* Relationship order badge + controls for mates with multiple partners */
      var orderHtml = '';
      if (r.type === 'mate' && r.totalMates > 1 && editable && r.famId) {
        var curOrd = r.relationshipOrder || '';
        orderHtml = '<div style="display:flex;align-items:center;gap:4px;margin-top:4px;">'
          + '<span style="color:#aaa;font-size:0.78rem;">Ordem da rela\u00e7\u00e3o:</span>'
          + '<select onchange="_drawerSetRelationshipOrder(\'' + pid + '\',\'' + _esc(r.famId) + '\',this.value)" style="font-size:0.8rem;padding:1px 4px;min-width:48px;background:var(--bg-card,#23263a);color:var(--text-main,#e2e4f0);border:1px solid rgba(200,210,230,0.2);border-radius:4px;">'
          + '<option value=""' + (!curOrd ? ' selected' : '') + '>—</option>';
        for (var oi = 1; oi <= Math.max(r.totalMates, curOrd || 0); oi++) {
          orderHtml += '<option value="' + oi + '"' + (curOrd == oi ? ' selected' : '') + '>' + oi + '\u00aa</option>';
        }
        orderHtml += '</select></div>';
      } else if (r.type === 'mate' && r.totalMates > 1 && r.relationshipOrder) {
        orderHtml = '<div style="margin-top:2px;"><span style="color:#aaa;font-size:0.78rem;">' + r.relationshipOrder + '\u00aa rela\u00e7\u00e3o</span></div>';
      }
      html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><span style="font-weight:600;font-size:0.9rem;">' + _esc(r.name) + '</span><span style="color:#aaa;font-size:0.82rem;margin-left:8px;">' + _esc(desc) + '</span>' + orderHtml + '</div>' + delBtn + '</div></div>';
    });
    html += '</div>';
    return html;
  }

  window._drawerSetRelationshipOrder = function (personId, famId, value) {
    var DB = _db(); if (!DB) return;
    var fam = DB.getFamily(famId); if (!fam) return;
    fam.relationshipOrder = value ? parseInt(value, 10) : null;
    DB.saveFamily(fam);
    document.getElementById('drawerBody').innerHTML = _renderRelations(personId);
    if (window.DRAWER_CONFIG && window.DRAWER_CONFIG.afterSave) window.DRAWER_CONFIG.afterSave(personId);
  };

  window._drawerDeleteRelation = function (personId, targetId, relType) {
    var DB = _db(); if (!DB) return;
    if (!confirm('Apagar esta rela\u00e7\u00e3o?')) return;
    if (relType === 'ancestor') {
      var indi = DB.getIndividual(personId);
      if (indi && indi.famc) {
        var fam = DB.getFamily(indi.famc);
        if (fam) {
          if (fam.husb === targetId) fam.husb = null;
          if (fam.wife === targetId) fam.wife = null;
          DB.saveFamily(fam);
          var parent = DB.getIndividual(targetId);
          if (parent && parent.fams) { parent.fams = parent.fams.filter(function (f) { return f !== fam.id; }); DB.saveIndividual(parent); }
        }
      }
    } else if (relType === 'child') {
      DB.getFamiliesAsSpouse(personId).forEach(function (fam) {
        if (fam.children && fam.children.includes(targetId)) {
          fam.children = fam.children.filter(function (c) { return c !== targetId; });
          DB.saveFamily(fam);
          var child = DB.getIndividual(targetId);
          if (child && child.famc === fam.id) { child.famc = null; DB.saveIndividual(child); }
        }
      });
    } else if (relType === 'mate') {
      DB.getFamiliesAsSpouse(personId).forEach(function (fam) {
        if (fam.husb === targetId || fam.wife === targetId) {
          if (fam.husb === targetId) fam.husb = null;
          if (fam.wife === targetId) fam.wife = null;
          DB.saveFamily(fam);
          var sp = DB.getIndividual(targetId);
          if (sp && sp.fams) { sp.fams = sp.fams.filter(function (f) { return f !== fam.id; }); DB.saveIndividual(sp); }
        }
      });
    } else if (relType === 'siblin') {
      var indiS = DB.getIndividual(personId);
      if (indiS && indiS.famc) {
        var famS = DB.getFamily(indiS.famc);
        if (famS && famS.children && famS.children.includes(targetId)) {
          famS.children = famS.children.filter(function (c) { return c !== targetId; });
          DB.saveFamily(famS);
          var sib = DB.getIndividual(targetId);
          if (sib && sib.famc === famS.id) { sib.famc = null; DB.saveIndividual(sib); }
        }
      }
    }
    document.getElementById('drawerBody').innerHTML = _renderRelations(personId);
  };

  window._drawerShowAddRelation = function (personId) {
    var DB = _db(); if (!DB) return;
    var pid     = _esc(personId);
    var parents = DB.getParents(personId);
    var kinOpts = '';
    if (parents.length < 2) kinOpts += '<option value="ancestor">Pai / M\u00e3e</option>';
    kinOpts += '<option value="child">Filho(a)</option><option value="siblin">Irm\u00e3o / Irm\u00e3</option><option value="mate">Companheiro(a)</option>';
    var others = DB.getIndividuals().filter(function (i) { return i.id !== personId; });
    var opts = others.map(function (i) { return '<option value="' + i.id + '">' + _esc(DB.getDisplayName(i)) + '</option>'; }).join('');
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Nova Rela\u00e7\u00e3o</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Tipo</label><select id="addRelType" style="width:100%;">' + kinOpts + '</select></div>'
      + '<div style="margin-bottom:14px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Pessoa</label><select id="addRelTarget" style="width:100%;">' + opts + '</select></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-ghost btn-sm" onclick="openDrawerSection(\'' + pid + '\',\'relacoes\')">Cancelar</button><button class="btn btn-sm" onclick="_drawerSaveLinkRelation(\'' + pid + '\')"><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
  };

  window._drawerSaveLinkRelation = function (personId) {
    var relType  = (document.getElementById('addRelType')  || {}).value;
    var targetId = (document.getElementById('addRelTarget')|| {}).value;
    if (!relType || !targetId) return alert('Selecione tipo e pessoa.');
    _linkRelation(personId, targetId, relType);
    openDrawerSection(personId, 'relacoes');
  };

  /**
   * Helper: ensure person A has a parent family with both husb and wife.
   * If famc is missing, creates a new family with placeholder parents.
   * If famc exists but is missing husb or wife, fills the gaps.
   * Returns the family record.
   */
  function _ensureParentFamily(personId) {
    var DB = _db(); if (!DB) return null;
    var indi = DB.getIndividual(personId); if (!indi) return null;
    if (indi.famc) {
      var fam = DB.getFamily(indi.famc);
      if (fam) {
        // Sanity-check: if both husb and wife are the same sex the family is
        // corrupted (legacy race-condition artefact).  Detach person from it
        // and fall through to create a proper new family below.
        var hI = fam.husb ? DB.getIndividual(fam.husb) : null;
        var wI = fam.wife ? DB.getIndividual(fam.wife) : null;
        if (hI && wI && hI.sex === wI.sex) {
          // Remove person from corrupted family children
          if (fam.children) fam.children = fam.children.filter(function(c){ return c !== personId; });
          DB.saveFamily(fam);
          indi.famc = null;
          // fall through to create new proper family
        } else {
          var changed = false;
          if (!fam.husb) {
            var sn = DB.getSurname(indi) || '';
            var ph = DB.saveIndividual({ names: [{ given: '?', surname: sn, type: 'birth' }], sex: 'M', events: [] });
            fam.husb = ph.id; ph.fams = [fam.id]; DB.saveIndividual(ph); changed = true;
          }
          if (!fam.wife) {
            var pm = DB.saveIndividual({ names: [{ given: '?', surname: '', type: 'birth' }], sex: 'F', events: [] });
            fam.wife = pm.id; pm.fams = [fam.id]; DB.saveIndividual(pm); changed = true;
          }
          if (changed) DB.saveFamily(fam);
          return fam;
        }
      }
    }
    // No famc — create family with placeholder parents
    var sn2 = DB.getSurname(indi) || '';
    var father = DB.saveIndividual({ names: [{ given: '?', surname: sn2, type: 'birth' }], sex: 'M', events: [] });
    var mother = DB.saveIndividual({ names: [{ given: '?', surname: '', type: 'birth' }], sex: 'F', events: [] });
    var newFam = DB.saveFamily({ husb: father.id, wife: mother.id, children: [personId], events: [] });
    father.fams = [newFam.id]; DB.saveIndividual(father);
    mother.fams = [newFam.id]; DB.saveIndividual(mother);
    indi.famc = newFam.id; DB.saveIndividual(indi);
    return newFam;
  }

  /**
   * Helper: ensure person A has a spouse family.
   * If no spouse family exists, creates one with a placeholder spouse.
   * Returns the family record.
   */
  function _ensureSpouseFamily(personId) {
    var DB = _db(); if (!DB) return null;
    var indi = DB.getIndividual(personId); if (!indi) return null;
    var fams = DB.getSpouseFamilies(personId);
    // Return the first family where this person is in the correct role
    for (var i = 0; i < fams.length; i++) {
      var f = fams[i];
      if (indi.sex === 'M' && f.husb === personId) return f;
      if (indi.sex === 'F' && f.wife === personId) return f;
    }
    // Fallback: accept any family where person appears
    if (fams.length) return fams[0];
    // No spouse family — create with placeholder spouse
    var spouseSex = indi.sex === 'F' ? 'M' : 'F';
    var sn = DB.getSurname(indi) || '';
    var spouse = DB.saveIndividual({ names: [{ given: '?', surname: spouseSex === 'F' ? '' : sn, type: 'birth' }], sex: spouseSex, events: [] });
    var husb = indi.sex === 'F' ? spouse.id : personId;
    var wife = indi.sex === 'F' ? personId : spouse.id;
    var fam = DB.saveFamily({ husb: husb, wife: wife, children: [], events: [] });
    if (!indi.fams) indi.fams = [];
    indi.fams.push(fam.id); DB.saveIndividual(indi);
    spouse.fams = [fam.id]; DB.saveIndividual(spouse);
    return fam;
  }

  function _linkRelation(personId, targetId, relType) {
    var DB     = _db(); if (!DB) return;
    var indi   = DB.getIndividual(personId);
    var target = DB.getIndividual(targetId);
    if (!indi || !target) return;

    if (relType === 'mate') {
      DB.ensureFamily(personId, targetId);

    } else if (relType === 'ancestor') {
      // Create Pai or Mãe — always creates both parents together
      if (!indi.famc) {
        // Create family with target as one parent and placeholder as the other
        var otherSex = target.sex === 'F' ? 'M' : 'F';
        var sn = target.sex === 'F' ? (DB.getSurname(indi) || '') : '';
        var otherParent = DB.saveIndividual({ names: [{ given: '?', surname: sn, type: 'birth' }], sex: otherSex, events: [] });
        var husb = target.sex === 'F' ? otherParent.id : targetId;
        var wife = target.sex === 'F' ? targetId : otherParent.id;
        var fam = DB.saveFamily({ husb: husb, wife: wife, children: [personId], events: [] });
        indi.famc = fam.id; DB.saveIndividual(indi);
        if (!target.fams) target.fams = [];
        if (!target.fams.includes(fam.id)) { target.fams.push(fam.id); DB.saveIndividual(target); }
        otherParent.fams = [fam.id]; DB.saveIndividual(otherParent);
      } else {
        // famc already exists — fill the missing slot
        var famA = DB.getFamily(indi.famc);
        if (famA) {
          if (!famA.husb && target.sex !== 'F') famA.husb = targetId;
          else if (!famA.wife && target.sex !== 'M') famA.wife = targetId;
          else if (!famA.husb) famA.husb = targetId;
          else if (!famA.wife) famA.wife = targetId;
          DB.saveFamily(famA);
          if (!target.fams) target.fams = [];
          if (!target.fams.includes(famA.id)) { target.fams.push(famA.id); DB.saveIndividual(target); }
        }
      }

    } else if (relType === 'child') {
      // Create Filho(a) — auto-create spouse if A has none
      var famC = _ensureSpouseFamily(personId);
      if (!famC.children) famC.children = [];
      if (!famC.children.includes(targetId)) { famC.children.push(targetId); DB.saveFamily(famC); }
      target.famc = famC.id; DB.saveIndividual(target);

    } else if (relType === 'siblin') {
      // Create Irmão/Irmã — auto-create parents if A has none
      var parentFam = _ensureParentFamily(personId);
      if (!parentFam.children) parentFam.children = [];
      if (!parentFam.children.includes(targetId)) { parentFam.children.push(targetId); DB.saveFamily(parentFam); }
      target.famc = parentFam.id; DB.saveIndividual(target);
    }
  }

  /* ── Add new person + link ───────────────────────────────────────────────── */
  window._drawerShowAddPerson = function (personId) {
    var DB   = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var parents = DB.getParents(personId);
    var footer  = document.querySelector('.drawer-footer'); if (footer) footer.style.display = 'none';
    var phdr    = document.getElementById('drawerPersonHeader'); if (phdr) phdr.style.display = 'none';
    var backBtn = document.getElementById('drawerBackBtn'); if (backBtn) { backBtn.style.display = ''; backBtn._personId = personId; }
    document.getElementById('drawerTitle').textContent = 'Adicionar \u2014 ' + DB.getDisplayName(indi);
    var pid     = _esc(personId);
    var kinOpts = '';
    if (parents.length < 2) kinOpts += '<option value="ancestor_male">Pai</option><option value="ancestor_female">M\u00e3e</option>';
    kinOpts += '<option value="child_male">Filho</option><option value="child_female">Filha</option>'
      + '<option value="sibling_male">Irm\u00e3o</option><option value="sibling_female">Irm\u00e3</option>'
      + '<option value="mate_male">Companheiro</option><option value="mate_female">Companheira</option>';
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Nova Pessoa</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Grau de parentesco</label><select id="addPersKinship" style="width:100%;">' + kinOpts + '</select></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Primeiro nome</label><input id="addPersFirstName" type="text" placeholder="Nome" style="width:100%;"/></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Apelido</label><input id="addPersLastName" type="text" placeholder="Apelido" style="width:100%;"/></div>'
      + '<div style="margin-bottom:14px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Notas</label><textarea id="addPersNotes" rows="2" placeholder="Notas..." style="width:100%;resize:vertical;"></textarea></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-ghost btn-sm" onclick="openDrawer(\'edit\',\'' + pid + '\')">Cancelar</button><button class="btn btn-sm" onclick="_drawerSaveNewPerson(\'' + pid + '\')"><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
    setTimeout(function () { var fi = document.getElementById('addPersFirstName'); if (fi) fi.focus(); }, 50);
  };

  window._drawerSaveNewPerson = function (personId) {
    var DB      = _db(); if (!DB) return;
    var kinship   = ((document.getElementById('addPersKinship')  || {}).value || '');
    var firstName = ((document.getElementById('addPersFirstName')|| {}).value || '').trim();
    var lastName  = ((document.getElementById('addPersLastName') || {}).value || '').trim();
    var notes     = ((document.getElementById('addPersNotes')    || {}).value || '').trim();
    if (!firstName && !lastName) { alert('Introduza pelo menos um nome.'); return; }
    var sexMap = { sibling_male: 'M', sibling_female: 'F', child_male: 'M', child_female: 'F', ancestor_male: 'M', ancestor_female: 'F', mate_male: 'M', mate_female: 'F' };
    var relMap = { sibling_male: 'siblin', sibling_female: 'siblin', child_male: 'child', child_female: 'child', ancestor_male: 'ancestor', ancestor_female: 'ancestor', mate_male: 'mate', mate_female: 'mate' };
    var sex     = sexMap[kinship] || 'U';
    var relType = relMap[kinship] || '';
    var newIndi = DB.saveIndividual({ names: [{ given: firstName, surname: lastName, type: 'birth' }], sex: sex, notes: notes || undefined, events: [] });
    if (relType) _linkRelation(personId, newIndi.id, relType);
    openDrawer('edit', personId);
    var cfg = window.DRAWER_CONFIG || {};
    if (typeof cfg.afterSave === 'function') cfg.afterSave(personId);
  };

  /* ── Link existing person ────────────────────────────────────────────────── */
  window._drawerShowLinkPerson = function (personId) {
    var DB   = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var parents = DB.getParents(personId);
    var footer  = document.querySelector('.drawer-footer'); if (footer) footer.style.display = 'none';
    var phdr    = document.getElementById('drawerPersonHeader'); if (phdr) phdr.style.display = 'none';
    var backBtn = document.getElementById('drawerBackBtn'); if (backBtn) { backBtn.style.display = ''; backBtn._personId = personId; }
    document.getElementById('drawerTitle').textContent = 'Ligar \u2014 ' + DB.getDisplayName(indi);
    var pid     = _esc(personId);
    var kinOpts = '';
    if (parents.length < 2) kinOpts += '<option value="ancestor">Pai / M\u00e3e</option>';
    kinOpts += '<option value="child">Filho(a)</option><option value="siblin">Irm\u00e3o / Irm\u00e3</option><option value="mate">Companheiro(a)</option>';
    var others = DB.getIndividuals().filter(function (i) { return i.id !== personId; });
    var opts   = others.map(function (i) { return '<option value="' + i.id + '">' + _esc(DB.getDisplayName(i)) + '</option>'; }).join('');
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Ligar Pessoa Existente</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Grau de parentesco</label><select id="linkPersKinship" style="width:100%;">' + kinOpts + '</select></div>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Pesquisar pessoa</label><input id="linkPersSearch" type="text" placeholder="Pesquisar por nome..." style="width:100%;margin-bottom:6px;" /><select id="linkPersTarget" size="6" style="width:100%;min-height:110px;">' + opts + '</select></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;"><button class="btn btn-ghost btn-sm" onclick="openDrawer(\'edit\',\'' + pid + '\')">Cancelar</button><button class="btn btn-sm" onclick="_drawerSaveLinkPerson(\'' + pid + '\')"><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
    var sel = document.getElementById('linkPersTarget');
    if (sel) sel._allOpts = others.map(function (i) { return { value: i.id, text: DB.getDisplayName(i) }; });
    var si = document.getElementById('linkPersSearch');
    if (si) {
      si.addEventListener('input', function () {
        var q   = this.value.toLowerCase();
        var all = sel._allOpts || [];
        sel.innerHTML = all.filter(function (o) { return o.text.toLowerCase().includes(q); })
                           .map(function (o) { return '<option value="' + o.value + '">' + _esc(o.text) + '</option>'; }).join('');
      });
      si.focus();
    }
  };

  window._drawerSaveLinkPerson = function (personId) {
    var relType  = (document.getElementById('linkPersKinship')|| {}).value;
    var targetId = (document.getElementById('linkPersTarget') || {}).value;
    if (!relType || !targetId) { alert('Selecione tipo e pessoa.'); return; }
    if (targetId === personId) { alert('N\u00e3o pode ligar uma pessoa a si pr\u00f3pria.'); return; }
    _linkRelation(personId, targetId, relType);
    openDrawer('edit', personId);
    var cfg = window.DRAWER_CONFIG || {};
    if (typeof cfg.afterSave === 'function') cfg.afterSave(personId);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     CONTACTS SECTION
  ══════════════════════════════════════════════════════════════════════════ */
  function _renderContacts(personId) {
    var DB       = _db(); if (!DB) return '<div style="color:#888;">Nenhum contacto registado.</div>';
    var indi     = DB.getIndividual(personId); if (!indi) return '';
    var editable = _canEdit();
    var contacts = (indi && indi.contacts)   || [];
    var attrs    = (indi && indi.attributes) || [];
    var pid      = _esc(personId);
    var html     = editable ? '<div style="margin-bottom:12px;"><button class="btn btn-sm" onclick="_drawerShowAddContact(\'' + pid + '\')" style="font-size:0.83rem;"><i class="mdi mdi-plus"></i> Adicionar Contacto</button></div>' : '';
    if (!contacts.length && !attrs.some(function (a) { return a.email || a.www || a.address; })) {
      html += '<div style="color:#888;padding:4px 0 12px;">Nenhum contacto registado.</div>'; return html;
    }
    html += '<div class="mini-list">';
    contacts.forEach(function (c, i) {
      var actionBtns = editable ? '<div style="display:flex;gap:2px;flex-shrink:0;">'
        + '<button onclick="_drawerEditContact(' + i + ',\'' + pid + '\')" title="Editar" style="background:none;border:none;cursor:pointer;color:#4493f8;padding:2px 4px;font-size:1rem;"><i class="mdi mdi-pencil-outline"></i></button>'
        + '<button onclick="_drawerDeleteContact(' + i + ',\'' + pid + '\')" title="Apagar" style="background:none;border:none;cursor:pointer;color:#e06060;padding:2px 4px;font-size:1rem;"><i class="mdi mdi-trash-can-outline"></i></button>'
        + '</div>' : '';
      if (c.type === 'address') {
        var a = c.address || {}; var parts = [];
        if (a.addr) parts.push(a.addr);
        var loc = []; if (a.city) loc.push(a.city); if (a.state) loc.push(a.state); if (a.postal) loc.push(a.postal); if (a.country) loc.push(a.country);
        if (loc.length) parts.push(loc.join(', '));
        html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><i class="mdi mdi-home-outline" style="color:#4493f8;margin-right:6px;"></i><span style="font-weight:600;font-size:0.9rem;">Morada</span><span style="color:#aaa;font-size:0.82rem;margin-left:8px;">' + _esc(c.label || '') + '</span></div>' + actionBtns + '</div>'
          + (parts.length ? '<div style="color:#bbb;font-size:0.82rem;margin-top:4px;line-height:1.5;">' + _esc(parts.join(' \u00b7 ')) + '</div>' : '')
          + '</div>';
      } else {
        var icon     = c.type === 'phone' ? 'mdi-phone-outline' : 'mdi-email-outline';
        var defLabel = c.type === 'phone' ? 'Telm\u00f3vel' : 'Email';
        html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><i class="mdi ' + icon + '" style="color:#4493f8;margin-right:6px;"></i><span style="font-weight:600;font-size:0.9rem;">' + _esc(c.value) + '</span><span style="color:#aaa;font-size:0.82rem;margin-left:8px;">' + _esc(c.label || defLabel) + '</span></div>' + actionBtns + '</div></div>';
      }
    });
    attrs.forEach(function (attr, ai) {
      var attrDel = function (field) { return editable ? '<div style="display:flex;gap:2px;flex-shrink:0;"><button onclick="_drawerDeleteAttrField(' + ai + ',\'' + field + '\',\'' + pid + '\')" title="Apagar" style="background:none;border:none;cursor:pointer;color:#e06060;padding:2px 4px;font-size:1rem;"><i class="mdi mdi-trash-can-outline"></i></button></div>' : ''; };
      if (attr.email) html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><i class="mdi mdi-email-outline" style="color:#4493f8;margin-right:6px;"></i><span style="font-weight:600;font-size:0.9rem;">' + _esc(attr.email) + '</span><span style="color:#aaa;font-size:0.82rem;margin-left:8px;">Email (' + _esc(EVENT_TYPES[attr.type] || attr.type) + ')</span></div>' + attrDel('email') + '</div></div>';
      if (attr.www)   html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><i class="mdi mdi-web" style="color:#4493f8;margin-right:6px;"></i><span style="font-weight:600;font-size:0.9rem;">' + _esc(attr.www) + '</span><span style="color:#aaa;font-size:0.82rem;margin-left:8px;">Website (' + _esc(EVENT_TYPES[attr.type] || attr.type) + ')</span></div>' + attrDel('www') + '</div></div>';
      if (attr.address) {
        var aa = attr.address; var aparts = [];
        if (aa.adr1) aparts.push(aa.adr1); if (aa.adr2) aparts.push(aa.adr2); if (aa.addr && aa.addr !== aa.adr1) aparts.push(aa.addr);
        var aloc = []; if (aa.city) aloc.push(aa.city); if (aa.stae) aloc.push(aa.stae); if (aa.post) aloc.push(aa.post); if (aa.ctry) aloc.push(aa.ctry);
        if (aloc.length) aparts.push(aloc.join(', '));
        if (aparts.length) html += '<div class="mini-card" style="padding:10px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="flex:1;"><i class="mdi mdi-home-outline" style="color:#4493f8;margin-right:6px;"></i><span style="font-weight:600;font-size:0.9rem;">Morada</span><span style="color:#aaa;font-size:0.82rem;margin-left:8px;">' + _esc(EVENT_TYPES[attr.type] || attr.type) + '</span></div>' + attrDel('address') + '</div><div style="color:#bbb;font-size:0.82rem;margin-top:4px;line-height:1.5;">' + _esc(aparts.join(' \u00b7 ')) + '</div></div>';
      }
    });
    html += '</div>';
    return html;
  }

  window._drawerDeleteContact = function (idx, personId) {
    var DB = _db(); if (!DB) return;
    if (!confirm('Apagar este contacto?')) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    if (!indi.contacts) indi.contacts = [];
    indi.contacts.splice(idx, 1);
    DB.saveIndividual(indi);
    document.getElementById('drawerBody').innerHTML = _renderContacts(personId);
  };

  window._drawerDeleteAttrField = function (attrIdx, field, personId) {
    var DB = _db(); if (!DB) return;
    if (!confirm('Apagar este contacto?')) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    if (!indi.attributes || !indi.attributes[attrIdx]) return;
    delete indi.attributes[attrIdx][field];
    DB.saveIndividual(indi);
    document.getElementById('drawerBody').innerHTML = _renderContacts(personId);
  };

  /* Country list for address contacts — matches NAME_TO_ISO in mundo.html */
  var _CT_COUNTRY_OPTS = ['Portugal','Brasil','Angola','Moçambique','Cabo Verde','Guiné-Bissau',
    'São Tomé e Príncipe','Timor-Leste','Macau','Espanha','Alemanha','França',
    'Reino Unido','Itália','Países Baixos','Bélgica','Suíça','Áustria','Suécia',
    'Noruega','Dinamarca','Finlândia','Polónia','República Checa','Hungria',
    'Roménia','Grécia','Irlanda','Luxemburgo','Rússia','Ucrânia',
    'Estados Unidos','Canadá','Argentina','Chile','Peru','Colômbia','Venezuela',
    'Uruguai','Paraguai','Bolívia','Equador','México','África do Sul',
    'Marrocos','Egito','Nigéria','Quénia','Etiópia','Ghana','Senegal',
    'China','Índia','Japão','Coreia do Sul','Austrália','Nova Zelândia',
    'Indonésia','Vietname','Tailândia','Singapura'];
  var _CT_DATALIST = '<datalist id="ctCountryList">' +
    _CT_COUNTRY_OPTS.map(function(c){ return '<option value="' + c + '">'; }).join('') +
    '</datalist>';

  window._toggleCtFields = function (prefix) {
    var type  = document.getElementById(prefix + 'CtType').value;
    var valW  = document.getElementById(prefix + 'CtValueWrap');
    var addrW = document.getElementById(prefix + 'CtAddrWrap');
    if (valW)  valW.style.display  = (type === 'address') ? 'none' : '';
    if (addrW) addrW.style.display = (type === 'address') ? '' : 'none';
  };

  window._drawerShowAddContact = function (personId) {
    var pid = _esc(personId);
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Novo Contacto</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Tipo</label>'
      + '<select id="addCtType" onchange="_toggleCtFields(\'add\')" style="width:100%;"><option value="phone" selected>Telm\u00f3vel</option><option value="email">Email</option><option value="address">Morada</option></select></div>'
      + '<div id="addCtValueWrap" style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Valor</label>'
      + '<input id="addCtValue" type="text" placeholder="+351 910 000 000 / email@exemplo.com" style="width:100%;"/></div>'
      + '<div id="addCtAddrWrap" style="display:none;">'
      + '<div style="margin-bottom:8px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Rua</label><input id="addCtAddr" type="text" style="width:100%;"/></div>'
      + '<div style="margin-bottom:8px;display:flex;gap:8px;"><div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Cidade</label><input id="addCtCity" type="text" style="width:100%;"/></div>'
      + '<div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Distrito / Estado</label><input id="addCtState" type="text" style="width:100%;"/></div></div>'
      + '<div style="margin-bottom:8px;display:flex;gap:8px;"><div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">C\u00f3digo Postal</label><input id="addCtPostal" type="text" style="width:100%;"/></div>'
      + '<div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Pa\u00eds</label><input id="addCtCountry" type="text" list="ctCountryList" autocomplete="off" style="width:100%;"/></div></div></div>'
      + _CT_DATALIST
      + '<div style="margin-bottom:14px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Etiqueta (opcional)</label>'
      + '<input id="addCtLabel" type="text" placeholder="ex: Casa, Trabalho..." style="width:100%;"/></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
      + '<button class="btn btn-ghost btn-sm" onclick="openDrawerSection(\'' + pid + '\',\'contactos\')">Cancelar</button>'
      + '<button class="btn btn-sm" onclick="_drawerSaveNewContact(\'' + pid + '\')" ><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
    setTimeout(function () { var v = document.getElementById('addCtValue'); if (v) v.focus(); }, 50);
  };

  window._drawerSaveNewContact = function (personId) {
    var DB   = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var type  = (document.getElementById('addCtType') || {}).value || 'phone';
    var label = ((document.getElementById('addCtLabel')|| {}).value || '').trim();
    if (!indi.contacts) indi.contacts = [];
    if (type === 'address') {
      var addr    = ((document.getElementById('addCtAddr')   || {}).value || '').trim();
      var city    = ((document.getElementById('addCtCity')   || {}).value || '').trim();
      var state   = ((document.getElementById('addCtState')  || {}).value || '').trim();
      var postal  = ((document.getElementById('addCtPostal') || {}).value || '').trim();
      var country = ((document.getElementById('addCtCountry')|| {}).value || '').trim();
      if (!addr && !city && !postal && !country) { alert('Preencha pelo menos um campo da morada.'); return; }
      indi.contacts.push({ type: 'address', address: { addr: addr, city: city, state: state, postal: postal, country: country }, label: label || undefined });
    } else {
      var value = ((document.getElementById('addCtValue') || {}).value || '').trim();
      if (!value) { alert('Introduza um valor para o contacto.'); return; }
      indi.contacts.push({ type: type, value: value, label: label || undefined });
    }
    DB.saveIndividual(indi);
    openDrawerSection(personId, 'contactos');
  };

  window._drawerEditContact = function (idx, personId) {
    var DB   = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var c    = (indi.contacts || [])[idx]; if (!c) return;
    var pid  = _esc(personId);
    var isAddr = (c.type === 'address');
    var a    = (isAddr && c.address) || {};
    var addrFields = '<div id="editCtAddrWrap" style="' + (isAddr ? '' : 'display:none;') + '">'
      + '<div style="margin-bottom:8px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Rua</label><input id="editCtAddr" type="text" value="' + _esc(a.addr || '') + '" style="width:100%;"/></div>'
      + '<div style="margin-bottom:8px;display:flex;gap:8px;"><div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Cidade</label><input id="editCtCity" type="text" value="' + _esc(a.city || '') + '" style="width:100%;"/></div>'
      + '<div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Distrito / Estado</label><input id="editCtState" type="text" value="' + _esc(a.state || '') + '" style="width:100%;"/></div></div>'
      + '<div style="margin-bottom:8px;display:flex;gap:8px;"><div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">C\u00f3digo Postal</label><input id="editCtPostal" type="text" value="' + _esc(a.postal || '') + '" style="width:100%;"/></div>'
      + '<div style="flex:1;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Pa\u00eds</label><input id="editCtCountry" type="text" list="ctCountryList" autocomplete="off" value="' + _esc(a.country || '') + '" style="width:100%;"/></div></div></div>'
      + _CT_DATALIST;
    document.getElementById('drawerBody').innerHTML = '<div style="padding:4px 0 8px;"><h3 style="font-size:0.95rem;margin:0 0 14px;">Editar Contacto</h3>'
      + '<div style="margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Tipo</label>'
      + '<select id="editCtType" onchange="_toggleCtFields(\'edit\')" style="width:100%;"><option value="phone"' + (c.type === 'phone' ? ' selected' : '') + '>Telm\u00f3vel</option><option value="email"' + (c.type === 'email' ? ' selected' : '') + '>Email</option><option value="address"' + (isAddr ? ' selected' : '') + '>Morada</option></select></div>'
      + '<div id="editCtValueWrap" style="' + (isAddr ? 'display:none;' : '') + 'margin-bottom:10px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Valor</label>'
      + '<input id="editCtValue" type="text" value="' + _esc(isAddr ? '' : (c.value || '')) + '" style="width:100%;"/></div>'
      + addrFields
      + '<div style="margin-bottom:14px;"><label style="font-size:0.82rem;color:#aaa;display:block;margin-bottom:4px;">Etiqueta (opcional)</label>'
      + '<input id="editCtLabel" type="text" value="' + _esc(c.label || '') + '" placeholder="ex: Casa, Trabalho..." style="width:100%;"/></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
      + '<button class="btn btn-ghost btn-sm" onclick="openDrawerSection(\'' + pid + '\',\'contactos\')">Cancelar</button>'
      + '<button class="btn btn-sm" onclick="_drawerSaveEditContact(' + idx + ',\'' + pid + '\')" ><i class="mdi mdi-content-save-outline"></i> Guardar</button></div></div>';
  };

  window._drawerSaveEditContact = function (idx, personId) {
    var DB   = _db(); if (!DB) return;
    var indi = DB.getIndividual(personId); if (!indi) return;
    var type  = (document.getElementById('editCtType') || {}).value || 'phone';
    var label = ((document.getElementById('editCtLabel')|| {}).value || '').trim();
    if (!indi.contacts) indi.contacts = [];
    if (type === 'address') {
      var addr    = ((document.getElementById('editCtAddr')   || {}).value || '').trim();
      var city    = ((document.getElementById('editCtCity')   || {}).value || '').trim();
      var state   = ((document.getElementById('editCtState')  || {}).value || '').trim();
      var postal  = ((document.getElementById('editCtPostal') || {}).value || '').trim();
      var country = ((document.getElementById('editCtCountry')|| {}).value || '').trim();
      if (!addr && !city && !postal && !country) { alert('Preencha pelo menos um campo da morada.'); return; }
      indi.contacts[idx] = { type: 'address', address: { addr: addr, city: city, state: state, postal: postal, country: country }, label: label || undefined };
    } else {
      var value = ((document.getElementById('editCtValue') || {}).value || '').trim();
      if (!value) { alert('Introduza um valor para o contacto.'); return; }
      indi.contacts[idx] = { type: type, value: value, label: label || undefined };
    }
    DB.saveIndividual(indi);
    openDrawerSection(personId, 'contactos');
  };

  /* ══════════════════════════════════════════════════════════════════════════
     PHOTOS SECTION — upload, delete and view are available everywhere
  ══════════════════════════════════════════════════════════════════════════ */

  /* ── Nova Foto modal (file upload + clipboard paste with crop) ──────── */
  var _novaFotoModalInject = false;

  function _ensureNovaFotoModal() {
    if (_novaFotoModalInject) return;
    _novaFotoModalInject = true;

    /* CSS */
    var style = document.createElement('style');
    style.textContent = [
      '#nfModal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.72); z-index:2147483645; align-items:center; justify-content:center; padding:16px; }',
      '#nfModal.nf-open { display:flex; }',
      '#nfInner { background:var(--bg-surface,#161b22); border:1px solid var(--border,rgba(255,255,255,0.08)); border-radius:14px; box-shadow:0 24px 64px rgba(0,0,0,0.7); width:480px; max-width:96vw; max-height:90vh; overflow:auto; animation:nfIn .18s ease; }',
      '@keyframes nfIn { from { opacity:0; transform:scale(.96) translateY(8px); } to { opacity:1; transform:none; } }',
      '#nfHeader { display:flex; align-items:center; justify-content:space-between; padding:14px 18px 10px; border-bottom:1px solid var(--border,rgba(255,255,255,0.08)); }',
      '#nfHeader h3 { margin:0; font-size:1rem; font-weight:600; }',
      '#nfCloseBtn { background:none; border:none; color:var(--text-secondary,#8b949e); font-size:1.2rem; cursor:pointer; padding:4px; border-radius:6px; }',
      '#nfCloseBtn:hover { color:var(--text-main,#e6edf3); background:var(--bg-surface-2,#21262d); }',
      '#nfBody { padding:18px; }',
      '.nf-tabs { display:flex; gap:8px; margin-bottom:16px; }',
      '.nf-tab { flex:1; padding:8px 12px; border:1px solid var(--border,rgba(255,255,255,0.08)); border-radius:8px; background:var(--bg-surface-2,#21262d); color:var(--text-secondary,#8b949e); cursor:pointer; text-align:center; font-size:0.85rem; transition:all .15s; }',
      '.nf-tab:hover { background:var(--accent-soft,rgba(68,147,248,0.12)); color:var(--text-main,#e6edf3); }',
      '.nf-tab.active { background:var(--accent,#4493f8); color:#fff; border-color:var(--accent,#4493f8); }',
      '#nfPasteZone { border:2px dashed var(--border,rgba(255,255,255,0.08)); border-radius:10px; min-height:140px; display:flex; align-items:center; justify-content:center; color:var(--text-secondary,#8b949e); font-size:0.88rem; cursor:pointer; position:relative; outline:none; transition:border-color .15s; }',
      '#nfPasteZone:focus, #nfPasteZone.nf-drag { border-color:var(--accent,#4493f8); }',
      '#nfCropWrap { position:relative; display:inline-block; max-width:100%; margin-top:10px; user-select:none; }',
      '#nfCropWrap img { display:block; max-width:100%; max-height:340px; border-radius:6px; }',
      '#nfCropSel { position:absolute; border:2px solid var(--accent,#4493f8); box-shadow:0 0 0 9999px rgba(0,0,0,0.45); cursor:move; min-width:20px; min-height:20px; touch-action:none; }',
      '#nfCropWrap { touch-action:none; }',
      '.nf-handle { position:absolute; width:12px; height:12px; background:var(--accent,#4493f8); border-radius:50%; }',
      '.nf-handle.nf-tl { top:-6px; left:-6px; cursor:nw-resize; }',
      '.nf-handle.nf-tr { top:-6px; right:-6px; cursor:ne-resize; }',
      '.nf-handle.nf-bl { bottom:-6px; left:-6px; cursor:sw-resize; }',
      '.nf-handle.nf-br { bottom:-6px; right:-6px; cursor:se-resize; }',
      '#nfActions { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }',
      '#nfPreviewFile { margin-top:10px; text-align:center; }',
      '#nfPreviewFile img { max-width:100%; max-height:240px; border-radius:6px; }'
    ].join('\n');
    document.head.appendChild(style);

    /* HTML */
    var overlay = document.createElement('div');
    overlay.id = 'nfModal';
    overlay.innerHTML =
      '<div id="nfInner">'
      + '<div id="nfHeader"><h3>Nova Foto</h3><button id="nfCloseBtn" title="Fechar"><i class="mdi mdi-close"></i></button></div>'
      + '<div id="nfBody">'
      +   '<div class="nf-tabs">'
      +     '<div class="nf-tab active" data-nf-tab="upload"><i class="mdi mdi-file-upload-outline"></i> Ficheiro</div>'
      +     '<div class="nf-tab" data-nf-tab="paste"><i class="mdi mdi-content-paste"></i> Colar (Clipboard)</div>'
      +   '</div>'
      +   '<div id="nfTabUpload">'
      +     '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      +       '<label for="nfFileInput" class="btn btn-sm" style="cursor:pointer;font-size:0.83rem;"><i class="mdi mdi-image-plus"></i> Escolher Ficheiro</label>'
      +       '<span id="nfFileName" style="color:#aaa;font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Nenhum ficheiro</span>'
      +       '<input type="file" id="nfFileInput" accept="image/*" style="display:none;"/>'
      +     '</div>'
      +     '<div id="nfPreviewFile"></div>'
      +     '<div id="nfActionsUpload" style="display:none;"><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">'
      +       '<button class="btn btn-sm" id="nfUploadSave" style="font-size:0.83rem;"><i class="mdi mdi-upload"></i> Gravar</button>'
      +     '</div></div>'
      +   '</div>'
      +   '<div id="nfTabPaste" style="display:none;">'
      +     '<div id="nfPasteZone" tabindex="0">Clique aqui e cole (Ctrl+V) uma imagem do clipboard</div>'
      +     '<div id="nfCropArea" style="display:none;">'
      +       '<div id="nfCropWrap"><img id="nfCropImg"/>'
      +         '<div id="nfCropSel">'
      +           '<div class="nf-handle nf-tl"></div><div class="nf-handle nf-tr"></div>'
      +           '<div class="nf-handle nf-bl"></div><div class="nf-handle nf-br"></div>'
      +         '</div>'
      +       '</div>'
      +       '<div id="nfActions">'
      +         '<button class="btn btn-sm btn-ghost" id="nfCropReset" style="font-size:0.83rem;"><i class="mdi mdi-refresh"></i> Nova imagem</button>'
      +         '<button class="btn btn-sm" id="nfCropSave" style="font-size:0.83rem;"><i class="mdi mdi-content-save"></i> Gravar</button>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);

    /* ── Wire events ─────────────────────────────────────────────────── */
    var _nfPersonId = null;
    var _pastedBlob = null;

    /* Close */
    document.getElementById('nfCloseBtn').addEventListener('click', _nfClose);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _nfClose(); });

    /* Tabs */
    overlay.querySelectorAll('.nf-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        overlay.querySelectorAll('.nf-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var isUpload = tab.dataset.nfTab === 'upload';
        document.getElementById('nfTabUpload').style.display = isUpload ? '' : 'none';
        document.getElementById('nfTabPaste').style.display  = isUpload ? 'none' : '';
      });
    });

    /* File input */
    var nfFileInput = document.getElementById('nfFileInput');
    nfFileInput.addEventListener('change', function () {
      var nameEl = document.getElementById('nfFileName');
      var preview = document.getElementById('nfPreviewFile');
      var actions = document.getElementById('nfActionsUpload');
      if (nfFileInput.files && nfFileInput.files.length) {
        nameEl.textContent = nfFileInput.files[0].name;
        var reader = new FileReader();
        reader.onload = function (ev) { preview.innerHTML = '<img src="' + ev.target.result + '"/>'; };
        reader.readAsDataURL(nfFileInput.files[0]);
        actions.style.display = '';
      } else {
        nameEl.textContent = 'Nenhum ficheiro';
        preview.innerHTML = '';
        actions.style.display = 'none';
      }
    });

    /* Upload save */
    document.getElementById('nfUploadSave').addEventListener('click', async function () {
      if (!nfFileInput.files || !nfFileInput.files.length) return;
      var DB = _db(); if (!DB) return;
      var f = nfFileInput.files[0];
      try {
        var uploaded = await DB.uploadFile(f);
        var media = DB.saveMultimedia({ title: f.name, files: [{ file: uploaded.url, format: f.type }] });
        var indi = DB.getIndividual(_nfPersonId);
        if (indi) {
          if (!indi.multimediaRefs) indi.multimediaRefs = [];
          indi.multimediaRefs.push(media.id);
          DB.saveIndividual(indi);
        }
        _nfClose();
        openDrawerSection(_nfPersonId, 'fotos');
      } catch (err) { alert('Erro no upload: ' + err); }
    });

    /* ── Paste handling ──────────────────────────────────────────────── */
    var pasteZone = document.getElementById('nfPasteZone');
    pasteZone.addEventListener('paste', function (e) {
      var items = (e.clipboardData || {}).items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          _pastedBlob = items[i].getAsFile();
          _showCropUI(_pastedBlob);
          return;
        }
      }
    });

    /* ── Crop UI ─────────────────────────────────────────────────────── */
    var cropImg  = document.getElementById('nfCropImg');
    var cropSel  = document.getElementById('nfCropSel');
    var cropWrap = document.getElementById('nfCropWrap');
    var _sel = { x: 0, y: 0, w: 0, h: 0 };
    var _imgW = 0, _imgH = 0;

    function _showCropUI(blob) {
      var url = URL.createObjectURL(blob);
      cropImg.onload = function () {
        /* show container FIRST so clientWidth/clientHeight are non-zero */
        document.getElementById('nfPasteZone').style.display = 'none';
        document.getElementById('nfCropArea').style.display = '';
        /* force reflow, then read rendered size */
        _imgW = cropImg.clientWidth;
        _imgH = cropImg.clientHeight;
        /* default selection: 70% centered so user can move/resize it */
        var dw = Math.round(_imgW * 0.7);
        var dh = Math.round(_imgH * 0.7);
        _sel = { x: Math.round((_imgW - dw) / 2), y: Math.round((_imgH - dh) / 2), w: dw, h: dh };
        _applySel();
      };
      cropImg.src = url;
    }

    function _applySel() {
      cropSel.style.left   = _sel.x + 'px';
      cropSel.style.top    = _sel.y + 'px';
      cropSel.style.width  = _sel.w + 'px';
      cropSel.style.height = _sel.h + 'px';
    }

    /* Drag move / resize */
    var _drag = null;
    function _pointerXY(e) {
      if (e.touches && e.touches.length) return { cx: e.touches[0].clientX, cy: e.touches[0].clientY };
      return { cx: e.clientX, cy: e.clientY };
    }
    function _startMove(e) {
      if (e.target.classList.contains('nf-handle')) return;
      e.preventDefault();
      var p = _pointerXY(e);
      _drag = { type: 'move', sx: p.cx, sy: p.cy, ox: _sel.x, oy: _sel.y };
    }
    cropSel.addEventListener('mousedown', _startMove);
    cropSel.addEventListener('touchstart', _startMove, { passive: false });

    cropSel.querySelectorAll('.nf-handle').forEach(function (h) {
      function _startResize(e) {
        e.preventDefault(); e.stopPropagation();
        var p = _pointerXY(e);
        var corner = h.classList.contains('nf-tl') ? 'tl' : h.classList.contains('nf-tr') ? 'tr' : h.classList.contains('nf-bl') ? 'bl' : 'br';
        _drag = { type: corner, sx: p.cx, sy: p.cy, oSel: Object.assign({}, _sel) };
      }
      h.addEventListener('mousedown', _startResize);
      h.addEventListener('touchstart', _startResize, { passive: false });
    });
    function _onPointerMove(e) {
      if (!_drag) return;
      e.preventDefault();
      var p = _pointerXY(e);
      var dx = p.cx - _drag.sx;
      var dy = p.cy - _drag.sy;
      if (_drag.type === 'move') {
        _sel.x = Math.max(0, Math.min(_imgW - _sel.w, _drag.ox + dx));
        _sel.y = Math.max(0, Math.min(_imgH - _sel.h, _drag.oy + dy));
      } else {
        var o = _drag.oSel;
        var nx, ny, nw, nh;
        if (_drag.type === 'br') {
          nw = Math.max(20, o.w + dx); nh = Math.max(20, o.h + dy);
          _sel.w = Math.min(nw, _imgW - o.x); _sel.h = Math.min(nh, _imgH - o.y);
        } else if (_drag.type === 'tl') {
          nx = o.x + dx; ny = o.y + dy;
          nx = Math.max(0, nx); ny = Math.max(0, ny);
          _sel.w = Math.max(20, o.w - (nx - o.x)); _sel.h = Math.max(20, o.h - (ny - o.y));
          _sel.x = o.x + o.w - _sel.w; _sel.y = o.y + o.h - _sel.h;
        } else if (_drag.type === 'tr') {
          ny = o.y + dy; ny = Math.max(0, ny);
          nw = Math.max(20, o.w + dx);
          _sel.w = Math.min(nw, _imgW - o.x); _sel.h = Math.max(20, o.h - (ny - o.y));
          _sel.y = o.y + o.h - _sel.h;
        } else if (_drag.type === 'bl') {
          nx = o.x + dx; nx = Math.max(0, nx);
          nh = Math.max(20, o.h + dy);
          _sel.w = Math.max(20, o.w - (nx - o.x)); _sel.h = Math.min(nh, _imgH - o.y);
          _sel.x = o.x + o.w - _sel.w;
        }
      }
      _applySel();
    }
    document.addEventListener('mousemove', _onPointerMove);
    document.addEventListener('touchmove', _onPointerMove, { passive: false });
    function _onPointerUp() { _drag = null; }
    document.addEventListener('mouseup', _onPointerUp);
    document.addEventListener('touchend', _onPointerUp);

    /* Reset paste */
    document.getElementById('nfCropReset').addEventListener('click', function () {
      _pastedBlob = null;
      document.getElementById('nfCropArea').style.display = 'none';
      document.getElementById('nfPasteZone').style.display = '';
    });

    /* Save cropped */
    document.getElementById('nfCropSave').addEventListener('click', async function () {
      if (!_pastedBlob) return;
      var DB = _db(); if (!DB) return;
      /* compute crop in natural-image coordinates */
      var scaleX = cropImg.naturalWidth  / _imgW;
      var scaleY = cropImg.naturalHeight / _imgH;
      var sx = Math.round(_sel.x * scaleX);
      var sy = Math.round(_sel.y * scaleY);
      var sw = Math.round(_sel.w * scaleX);
      var sh = Math.round(_sel.h * scaleY);

      /* draw cropped area to canvas */
      var canvas = document.createElement('canvas');
      canvas.width  = sw; canvas.height = sh;
      var ctx = canvas.getContext('2d');
      var tmpImg = new Image();
      tmpImg.onload = async function () {
        ctx.drawImage(tmpImg, sx, sy, sw, sh, 0, 0, sw, sh);
        canvas.toBlob(async function (blob) {
          if (!blob) return alert('Erro ao recortar imagem.');
          var file = new File([blob], 'clipboard-foto.png', { type: 'image/png' });
          try {
            var uploaded = await DB.uploadFile(file);
            var media = DB.saveMultimedia({ title: file.name, files: [{ file: uploaded.url, format: file.type }] });
            var indi = DB.getIndividual(_nfPersonId);
            if (indi) {
              if (!indi.multimediaRefs) indi.multimediaRefs = [];
              indi.multimediaRefs.push(media.id);
              DB.saveIndividual(indi);
            }
            _nfClose();
            openDrawerSection(_nfPersonId, 'fotos');
          } catch (err) { alert('Erro no upload: ' + err); }
        }, 'image/png');
      };
      tmpImg.src = URL.createObjectURL(_pastedBlob);
    });

    /* ── helpers ──────────────────────────────────────────────────────── */
    function _nfClose() {
      overlay.classList.remove('nf-open');
      _pastedBlob = null;
      nfFileInput.value = '';
      document.getElementById('nfFileName').textContent = 'Nenhum ficheiro';
      document.getElementById('nfPreviewFile').innerHTML = '';
      document.getElementById('nfActionsUpload').style.display = 'none';
      document.getElementById('nfCropArea').style.display = 'none';
      document.getElementById('nfPasteZone').style.display = '';
    }

    window._nfOpen = function (personId) {
      _nfPersonId = personId;
      _nfClose();                    /* reset state */
      overlay.classList.add('nf-open');
      /* reset to upload tab */
      overlay.querySelectorAll('.nf-tab').forEach(function (t) { t.classList.remove('active'); });
      overlay.querySelector('[data-nf-tab="upload"]').classList.add('active');
      document.getElementById('nfTabUpload').style.display = '';
      document.getElementById('nfTabPaste').style.display  = 'none';
    };
  }

  function _renderPhotos(personId) {
    var pid = _esc(personId);
    var editable = _canEdit();
    var uploadHtml = editable
      ? '<div style="margin-bottom:14px;">'
      + '<button class="btn btn-sm" id="drawerNovaFotoBtn" style="font-size:0.83rem;"><i class="mdi mdi-image-plus"></i> Nova Foto</button>'
      + '</div>'
      : '';
    return uploadHtml
      + '<div id="_photoGrid" style="display:flex;flex-wrap:wrap;gap:10px;"></div>';
  }

  function _buildPhotoGrid(personId) {
    var DB = _db();
    /* Wire "Nova Foto" button to open the modal */
    var novaBtn = document.getElementById('drawerNovaFotoBtn');
    if (novaBtn) {
      _ensureNovaFotoModal();
      novaBtn.addEventListener('click', function () { window._nfOpen(personId); });
    }

    var grid = document.getElementById('_photoGrid');
    if (!grid) return;
    var media = DB ? DB.getMultimediaForIndividual(personId) : [];
    if (!media.length) {
      grid.innerHTML = '<div style="color:#888;padding:4px 0 12px;">Nenhuma foto associada.</div>';
      return;
    }

    media.forEach(function (m) {
      var src      = m.dataUrl || (m.files && m.files[0] ? m.files[0].file : '') || '';
      var hasImage = src.startsWith('data:') || src.startsWith('http') || src.startsWith('/');
      var wrap     = document.createElement('div');
      wrap.style.cssText = 'position:relative;display:inline-block;';

      if (hasImage) {
        var img = document.createElement('img');
        img.src           = src;
        img.title         = m.title || '';
        img.style.cssText = 'width:72px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:block;transition:transform 0.15s;';
        img.onmouseover = function () { this.style.transform = 'scale(1.06)'; };
        img.onmouseout  = function () { this.style.transform = 'scale(1)'; };
        (function (mid, pid) {
          img.onclick = function (ev) { ev.stopPropagation(); window._drawerViewPhoto(mid, pid); };
        })(m.id, personId);
        wrap.appendChild(img);
      } else {
        var placeholder = document.createElement('div');
        placeholder.style.cssText = 'width:72px;height:72px;border-radius:6px;background:#2a2a3a;border:1px dashed #555;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;';
        var iconEl = document.createElement('i'); iconEl.className = 'mdi mdi-image-off'; iconEl.style.cssText = 'font-size:1.4rem;color:#888;pointer-events:none;';
        var label  = document.createElement('span'); label.style.cssText = 'font-size:0.55rem;color:#888;text-align:center;word-break:break-all;padding:0 3px;max-height:28px;overflow:hidden;pointer-events:none;';
        label.textContent  = src || '(sem nome)';
        placeholder.title  = 'Clique para carregar: ' + (src || '(sem nome)');
        placeholder.appendChild(iconEl);
        placeholder.appendChild(label);
        (function (mid, pid) {
          placeholder.onclick = function (ev) { ev.stopPropagation(); window._drawerLinkGedcomPhoto(mid, pid); };
        })(m.id, personId);
        wrap.appendChild(placeholder);
      }

      /* Remove / unlink button (only for editors) */
      if (_canEdit()) {
        var removeBtn = document.createElement('button');
        removeBtn.title         = 'Remover v\u00ednculo';
        removeBtn.innerHTML     = '<i class="mdi mdi-close" style="pointer-events:none;"></i>';
        removeBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#e06060;border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:0.65rem;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;';
        removeBtn.addEventListener('click', (function (mid, pid) {
          return function (ev) { ev.stopPropagation(); window._drawerUnlinkPhoto(mid, pid); };
        })(m.id, personId));
        wrap.appendChild(removeBtn);
      }
      grid.appendChild(wrap);
    });
  }

  /* _drawerUploadPhoto — now handled inside Nova Foto modal */

  window._drawerLinkGedcomPhoto = function (mediaId, personId) {
    var DB    = _db(); if (!DB) return;
    var input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.onchange = async function () {
      if (!input.files || !input.files.length) return;
      var f = input.files[0];
      try {
        var uploaded = await DB.uploadFile(f);
        var m = DB.getMultimediaItem(mediaId); if (!m) return;
        m.files = [{ file: uploaded.url, format: f.type }]; if (!m.title) m.title = f.name;
        DB.saveMultimedia(m);
        openDrawerSection(personId, 'fotos');
      } catch (err) { alert('Erro ao carregar imagem: ' + err); }
    };
    input.click();
  };

  window._drawerUnlinkPhoto = function (mediaId, personId) {
    var DB = _db(); if (!DB) return;
    if (!confirm('Remover v\u00ednculo desta foto?')) return;
    var indi = DB.getIndividual(personId);
    if (indi && indi.multimediaRefs) {
      indi.multimediaRefs = indi.multimediaRefs.filter(function (id) { return id !== mediaId; });
      DB.saveIndividual(indi);
    }
    openDrawerSection(personId, 'fotos');
  };

  window._drawerViewPhoto = function (mediaId, personId) {
    if (window.PhotoLightbox) window.PhotoLightbox.open(mediaId, personId);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     SAVE / DELETE
  ══════════════════════════════════════════════════════════════════════════ */
  function drawerSave() {
    var DB          = _db(); if (!DB) return;
    var given       = (document.getElementById('df_firstName')  || {}).value || '';
    var surname     = (document.getElementById('df_lastName')   || {}).value || '';
    var sex         = (document.getElementById('df_gender')     || {}).value || 'U';
    var notes       = (document.getElementById('df_notes')      || {}).value || '';
    var marriedName = ((document.getElementById('df_marriedName') || {}).value || '').trim();
    var aka         = ((document.getElementById('df_aka')          || {}).value || '').trim();
    var savedId     = _drawerPersonId;
    if (_drawerMode === 'create') {
      var isDeceasedOnCreate = (document.getElementById('df_deceased') || {}).checked || false;
      var initEvents = isDeceasedOnCreate ? [{ type: 'DEAT' }] : [];
      var saved = DB.saveIndividual({ names: [{ given: given.trim(), surname: surname.trim(), marriedName: marriedName || undefined, aka: aka || undefined, type: 'birth' }], sex: sex, notes: notes, events: initEvents });
      savedId = saved ? saved.id : null;
    } else if (_drawerPersonId) {
      var indi = DB.getIndividual(_drawerPersonId);
      if (indi) {
        var oldN = (indi.names && indi.names[0]) || {};
        var newGiven   = given.trim();
        var newSurname = surname.trim();
        var newMarried = marriedName || undefined;
        var newAka     = aka || undefined;
        var unchanged  = (oldN.given        || '') === newGiven
                      && (oldN.surname      || '') === newSurname
                      && (oldN.marriedName  || '') === (newMarried || '')
                      && (oldN.aka          || '') === (newAka     || '')
                      && (indi.sex          || 'U') === sex
                      && (indi.notes        || '') === notes;
        if (!unchanged) {
          indi.names = [Object.assign({}, oldN, { given: newGiven, surname: newSurname, marriedName: newMarried, aka: newAka, type: 'birth' })];
          indi.sex   = sex;
          indi.notes = notes;
          indi._changeDetail = 'Dados pessoais actualizados';
          DB.saveIndividual(indi);
          savedId = indi.id;
        }
      }
    }
    closeDrawer();
    var cfg = window.DRAWER_CONFIG || {};
    if (typeof cfg.afterSave === 'function') cfg.afterSave(savedId);
  }

  function drawerDeletePerson() {
    var DB = _db(); if (!DB) return;
    if (!_drawerPersonId || !confirm('Apagar esta pessoa?')) return;
    var deletedId = _drawerPersonId;
    DB.deleteIndividual(deletedId);
    closeDrawer();
    var cfg = window.DRAWER_CONFIG || {};
    if (typeof cfg.afterDelete === 'function') cfg.afterDelete(deletedId);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INIT — wire footer buttons once DOM is ready
  ══════════════════════════════════════════════════════════════════════════ */
  function _initDrawerButtons() {
    var closeBtn  = document.getElementById('drawerCloseBtn');
    var cancelBtn = document.getElementById('drawerCancelBtn');
    var overlay   = document.getElementById('drawerOverlay');
    var saveBtn   = document.getElementById('drawerSaveBtn');
    var deleteBtn = document.getElementById('drawerDeleteBtn');
    var backBtn   = document.getElementById('drawerBackBtn');
    if (closeBtn)  closeBtn.addEventListener('click',  closeDrawer);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDrawer);
    if (overlay)   overlay.addEventListener('click',   closeDrawer);
    if (saveBtn)   saveBtn.addEventListener('click',   drawerSave);
    if (deleteBtn) deleteBtn.addEventListener('click', drawerDeletePerson);
    if (backBtn)   backBtn.addEventListener('click', function () { var pid = this._personId; if (pid) openDrawer('edit', pid); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initDrawerButtons);
  } else {
    _initDrawerButtons();
  }

})();
