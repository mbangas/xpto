/**
 * photo-lightbox.js – Shared photo viewer for myLineage
 * Provides window.PhotoLightbox.open(mediaId, personId)
 * Requires window.GedcomDB to be available.
 */
(function () {
  'use strict';

  /* ── CSS ──────────────────────────────────────────────────────────────── */
  const STYLE = `
    #plbOverlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.82);
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      padding: 16px;
      box-sizing: border-box;
    }
    #plbOverlay.plb-open { display: flex; }
    #plbOverlay.plb-maximized { padding: 0; }
    #plbInner {
      background: var(--bg-surface, #1e2030);
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      border-radius: 12px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.7);
      max-width: 960px;
      width: 100%;
      max-height: 92vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: plbIn 0.18s ease;
      transition: max-width 0.2s ease, max-height 0.2s ease, border-radius 0.2s ease;
    }
    #plbOverlay.plb-maximized #plbInner {
      max-width: 100vw;
      width: 100vw;
      max-height: 100vh;
      height: 100vh;
      border-radius: 0;
      box-shadow: none;
      border: none;
    }
    @keyframes plbIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    #plbHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      flex-shrink: 0;
      gap: 8px;
      background: var(--bg-surface, #1e2030);
    }
    #plbTitle {
      flex: 1;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-main, #e8eaf6);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
    }
    #plbCounter {
      font-size: 0.78rem;
      color: var(--text-secondary, #888);
      background: rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 2px 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .plb-hbtn {
      background: none;
      border: none;
      color: var(--text-secondary, #888);
      cursor: pointer;
      font-size: 1.3rem;
      line-height: 1;
      padding: 5px 7px;
      border-radius: 6px;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .plb-hbtn:hover { color: var(--text-main, #e8eaf6); background: rgba(255,255,255,0.08); }
    #plbBody {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    #plbImgPane {
      flex: 1;
      min-width: 0;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 12px;
      position: relative;
    }
    #plbPhotoWrap {
      position: relative;
      display: inline-block;
      line-height: 0;
      max-width: 100%;
    }
    #plbImg {
      display: block;
      max-width: 100%;
      max-height: calc(92vh - 57px);
      object-fit: contain;
      border-radius: 6px;
    }
    #plbOverlay.plb-maximized #plbImg { max-height: calc(100vh - 57px); }
    #plbTagOverlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    /* Nav arrows */
    .plb-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      background: rgba(0,0,0,0.45);
      border: none;
      color: #fff;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      cursor: pointer;
      transition: background 0.18s, opacity 0.18s;
      opacity: 0.7;
    }
    .plb-nav:hover { background: rgba(0,0,0,0.72); opacity: 1; }
    .plb-nav:disabled { opacity: 0.15; cursor: default; pointer-events: none; }
    #plbPrev { left: 10px; }
    #plbNext { right: 10px; }
    /* Sidebar */
    #plbSidebar {
      width: 260px;
      flex-shrink: 0;
      border-left: 1px solid var(--border, rgba(255,255,255,0.08));
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--bg-surface, #1e2030);
    }
    .plb-info-lbl {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary, #888);
      margin-bottom: 4px;
    }
    .plb-info-val {
      font-size: 0.85rem;
      color: var(--text-main, #e8eaf6);
      word-break: break-word;
    }
    .plb-info-val.plb-muted { color: var(--text-secondary, #888); font-style: italic; }
    .plb-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .plb-chip {
      font-size: 0.75rem;
      padding: 3px 9px;
      border-radius: 12px;
      background: var(--accent-soft, rgba(99,102,241,0.15));
      color: var(--accent, #818cf8);
      border: 1px solid var(--border-accent, rgba(99,102,241,0.25));
    }
    /* Tag zones */
    .plb-tag-zone {
      position: absolute;
      border: 2px solid rgba(59,130,246,0.85);
      background: rgba(59,130,246,0.10);
      border-radius: 4px;
      box-sizing: border-box;
      pointer-events: auto;
      cursor: default;
      transition: background 0.15s;
    }
    .plb-tag-zone:hover { background: rgba(59,130,246,0.22); }
    .plb-tag-lbl {
      position: absolute;
      bottom: calc(100% + 3px);
      left: 0;
      white-space: nowrap;
      background: rgba(20,25,45,0.92);
      color: #e8eaf6;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      pointer-events: none;
      line-height: 1.5;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.15s, transform 0.15s;
    }
    .plb-tag-zone:hover .plb-tag-lbl { opacity: 1; transform: translateY(0); }
    /* Notes textarea */
    #plbNotesArea {
      width: 100%;
      min-height: 72px;
      padding: 7px 9px;
      border-radius: 7px;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      background: rgba(30,35,55,0.7);
      color: var(--text-main, #e8eaf6);
      box-sizing: border-box;
      resize: vertical;
      font-size: 0.85rem;
      font-family: inherit;
      line-height: 1.5;
    }
    #plbSaveNotes {
      margin-top: 6px;
      padding: 5px 14px;
      border-radius: 7px;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      background: rgba(99,102,241,0.18);
      color: var(--accent, #818cf8);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    #plbSaveNotes:hover { background: rgba(99,102,241,0.32); }
    /* Thumbnail strip */
    #plbStrip {
      display: none;
      gap: 6px;
      padding: 8px 12px;
      border-top: 1px solid var(--border, rgba(255,255,255,0.08));
      flex-shrink: 0;
      overflow-x: auto;
      background: rgba(0,0,0,0.2);
    }
    .plb-strip-thumb {
      flex-shrink: 0;
      width: 52px;
      height: 52px;
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      border: 2px solid transparent;
      transition: border-color 0.15s;
      background: #2a2a3a;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .plb-strip-thumb.plb-active { border-color: var(--accent, #818cf8); }
    .plb-strip-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    @media (max-width: 600px) {
      #plbBody { flex-direction: column; }
      #plbSidebar { width: 100%; border-left: none; border-top: 1px solid var(--border, rgba(255,255,255,0.08)); max-height: 38vh; }
    }
  `;

  /* ── HTML ─────────────────────────────────────────────────────────────── */
  const HTML = `
    <div id="plbInner">
      <div id="plbHeader">
        <h2 id="plbTitle">Foto</h2>
        <span id="plbCounter" style="display:none;"></span>
        <button class="plb-hbtn" id="plbDownload" title="Descarregar foto">
          <i class="mdi mdi-download"></i>
        </button>
        <button class="plb-hbtn" id="plbMaximize" title="Maximizar (F)">
          <i class="mdi mdi-arrow-expand" id="plbMaxIcon"></i>
        </button>
        <button class="plb-hbtn" id="plbClose" title="Fechar (Esc)">
          <i class="mdi mdi-close"></i>
        </button>
      </div>
      <div id="plbBody">
        <div id="plbImgPane">
          <button class="plb-nav" id="plbPrev" title="Foto anterior (←)">
            <i class="mdi mdi-chevron-left"></i>
          </button>
          <button class="plb-nav" id="plbNext" title="Próxima foto (→)">
            <i class="mdi mdi-chevron-right"></i>
          </button>
          <div id="plbPhotoWrap">
            <img id="plbImg" src="" alt="" />
            <div id="plbTagOverlay"></div>
          </div>
        </div>
        <aside id="plbSidebar">
          <div>
            <div class="plb-info-lbl">Ficheiro</div>
            <div class="plb-info-val" id="plbFileName">—</div>
          </div>
          <div id="plbPeopleSection">
            <div class="plb-info-lbl">Pessoas</div>
            <div class="plb-chips" id="plbPeopleChips"></div>
          </div>
          <div>
            <div class="plb-info-lbl">Notas</div>
            <textarea id="plbNotesArea" placeholder="Sem notas…"></textarea>
            <button id="plbSaveNotes"><i class="mdi mdi-content-save-outline"></i> Guardar notas</button>
          </div>
        </aside>
      </div>
      <div id="plbStrip"></div>
    </div>
  `;

  /* ── State ────────────────────────────────────────────────────────────── */
  let _overlay, _initialized = false;
  let _photoList = [];   // array of multimedia ids
  let _currentId = null;
  let _personId  = null;

  /* ── Init ─────────────────────────────────────────────────────────────── */
  function _init() {
    if (_initialized) return;
    _initialized = true;

    // Inject CSS
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    // Inject HTML
    _overlay = document.createElement('div');
    _overlay.id = 'plbOverlay';
    _overlay.setAttribute('role', 'dialog');
    _overlay.setAttribute('aria-modal', 'true');
    _overlay.setAttribute('aria-labelledby', 'plbTitle');
    _overlay.innerHTML = HTML;
    document.body.appendChild(_overlay);

    // Wiring
    document.getElementById('plbClose').addEventListener('click', close);
    document.getElementById('plbPrev').addEventListener('click', () => _nav(-1));
    document.getElementById('plbNext').addEventListener('click', () => _nav(1));
    document.getElementById('plbMaximize').addEventListener('click', () => _toggleMaximize());
    document.getElementById('plbDownload').addEventListener('click', _download);
    document.getElementById('plbSaveNotes').addEventListener('click', _saveNotes);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });

    document.addEventListener('keydown', e => {
      if (!_overlay.classList.contains('plb-open')) return;
      if (e.key === 'Escape')           { close(); }
      else if (e.key === 'ArrowLeft')   { e.preventDefault(); _nav(-1); }
      else if (e.key === 'ArrowRight')  { e.preventDefault(); _nav(1); }
      else if (e.key.toLowerCase() === 'f') { _toggleMaximize(); }
    });
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function _buildSrc(m) {
    if (!m) return '';
    if (m.dataUrl) return m.dataUrl;
    if (m.files && m.files[0] && m.files[0].file) return m.files[0].file;
    return '';
  }

  function _buildName(m) {
    if (!m) return '';
    const raw = (m.files && m.files[0] && m.files[0].file) ? m.files[0].file : (m.title || m.id || '');
    if (/^https?:\/\//i.test(raw)) {
      return m.title || decodeURIComponent(raw.split('/').pop().split('?')[0]) || m.id || '';
    }
    return raw || m.title || m.id || '';
  }

  function _getNotes(m) {
    if (!m) return '';
    const n = m.notes;
    if (!n) return '';
    if (typeof n === 'string') return n;
    if (Array.isArray(n)) return n.join('\n');
    return '';
  }

  function _esc(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  /* ── Person map (id→name) for the whole base ──────────────────────────── */
  function _buildPersonMap() {
    const DB = window.GedcomDB;
    const map = {};
    if (!DB) return map;
    const indis = DB.getIndividuals ? DB.getIndividuals() : [];
    for (const i of indis) {
      const name = DB.getDisplayName ? DB.getDisplayName(i) : ((i.names && i.names[0]) ? (i.names[0].given + ' ' + i.names[0].surname).trim() : i.id);
      map[i.id] = name;
    }
    return map;
  }

  /* ── Load one photo into the viewer ──────────────────────────────────── */
  function _load(mediaId) {
    const DB = window.GedcomDB;
    if (!DB) return;
    const m = DB.getMultimediaItem ? DB.getMultimediaItem(mediaId) : null;
    if (!m) return;

    _currentId = mediaId;

    const idx   = _photoList.indexOf(mediaId);
    const total = _photoList.length;

    // Title / counter
    document.getElementById('plbTitle').textContent = _buildName(m) || 'Foto';
    const counter = document.getElementById('plbCounter');
    if (total > 1) {
      counter.textContent = (idx + 1) + ' / ' + total;
      counter.style.display = 'inline-block';
    } else {
      counter.style.display = 'none';
    }

    // Nav buttons
    const prev = document.getElementById('plbPrev');
    const next = document.getElementById('plbNext');
    prev.disabled = (idx <= 0);
    next.disabled = (idx >= total - 1);

    // Filename in sidebar
    document.getElementById('plbFileName').textContent = _buildName(m) || '—';

    // Notes
    document.getElementById('plbNotesArea').value = _getNotes(m);

    // People (from tags + from individuals refs)
    const personMap = _buildPersonMap();
    const people = [];
    const seen = new Set();
    // from tags
    (m.tags || []).forEach(t => {
      const name = t.personName || personMap[t.personId] || '';
      if (name && !seen.has(name)) { seen.add(name); people.push(name); }
    });
    // from individual refs (reverse lookup)
    if (DB.getIndividuals) {
      for (const i of DB.getIndividuals()) {
        if ((i.multimediaRefs || []).includes(mediaId)) {
          const n = DB.getDisplayName ? DB.getDisplayName(i) : i.id;
          if (n && !seen.has(n)) { seen.add(n); people.push(n); }
        }
      }
    }
    const chipsEl = document.getElementById('plbPeopleChips');
    chipsEl.innerHTML = '';
    if (people.length) {
      people.forEach(name => {
        const c = document.createElement('span');
        c.className = 'plb-chip';
        c.textContent = name;
        chipsEl.appendChild(c);
      });
    } else {
      chipsEl.innerHTML = '<span style="font-size:0.82rem;color:var(--text-secondary,#888);font-style:italic;">Nenhuma pessoa associada</span>';
    }

    // Image
    const img = document.getElementById('plbImg');
    img.onload = () => _renderTagZones(m);
    img.src = _buildSrc(m);
    img.alt = _buildName(m);
    document.getElementById('plbTagOverlay').innerHTML = '';
    if (img.complete && img.naturalWidth > 0) _renderTagZones(m);

    // Thumbnail strip
    _renderStrip(mediaId);
  }

  /* ── Tag zones ────────────────────────────────────────────────────────── */
  function _renderTagZones(m) {
    const overlay = document.getElementById('plbTagOverlay');
    overlay.innerHTML = '';
    const tags = (m.tags || []).filter(t => t.bbox && t.bbox.w > 0 && t.bbox.h > 0);
    tags.forEach(t => {
      const zone = document.createElement('div');
      zone.className = 'plb-tag-zone';
      zone.style.left   = (t.bbox.x * 100) + '%';
      zone.style.top    = (t.bbox.y * 100) + '%';
      zone.style.width  = (t.bbox.w * 100) + '%';
      zone.style.height = (t.bbox.h * 100) + '%';
      const lbl = document.createElement('div');
      lbl.className = 'plb-tag-lbl';
      lbl.textContent = t.personName || 'Pessoa';
      zone.appendChild(lbl);
      overlay.appendChild(zone);
    });
  }

  /* ── Thumbnail strip ──────────────────────────────────────────────────── */
  function _renderStrip(activeId) {
    const strip = document.getElementById('plbStrip');
    strip.innerHTML = '';
    const total = _photoList.length;
    if (total <= 1) { strip.style.display = 'none'; return; }
    strip.style.display = 'flex';
    const DB = window.GedcomDB;
    _photoList.forEach(mid => {
      const mi = DB && DB.getMultimediaItem ? DB.getMultimediaItem(mid) : null;
      const thumb = document.createElement('div');
      thumb.className = 'plb-strip-thumb' + (mid === activeId ? ' plb-active' : '');
      const src = _buildSrc(mi);
      if (src) {
        const ti = document.createElement('img');
        ti.src = src;
        ti.alt = '';
        thumb.appendChild(ti);
      } else {
        thumb.innerHTML = '<i class="mdi mdi-image-off" style="color:#666;font-size:1rem;"></i>';
      }
      thumb.addEventListener('click', () => _load(mid));
      strip.appendChild(thumb);
    });
    // scroll active into view
    const activeThumb = strip.querySelector('.plb-active');
    if (activeThumb) activeThumb.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /* ── Navigation ───────────────────────────────────────────────────────── */
  function _nav(dir) {
    const idx = _photoList.indexOf(_currentId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next >= 0 && next < _photoList.length) _load(_photoList[next]);
  }

  /* ── Maximize ─────────────────────────────────────────────────────────── */
  function _toggleMaximize() {
    const isMax = _overlay.classList.toggle('plb-maximized');
    const icon  = document.getElementById('plbMaxIcon');
    const btn   = document.getElementById('plbMaximize');
    if (isMax) {
      icon.classList.replace('mdi-arrow-expand', 'mdi-arrow-collapse');
      btn.title = 'Restaurar (F)';
    } else {
      icon.classList.replace('mdi-arrow-collapse', 'mdi-arrow-expand');
      btn.title = 'Maximizar (F)';
    }
  }

  /* ── Download ────────────────────────────────────────────────────────── */
  async function _download() {
    const DB = window.GedcomDB;
    if (!_currentId || !DB) return;
    const m = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
    const src = _buildSrc(m);
    const name = _buildName(m) || 'foto';
    if (!src) return;
    try {
      let url = src;
      let revoke = false;
      if (/^https?:\/\//i.test(src)) {
        const resp = await fetch(src);
        const blob = await resp.blob();
        url = URL.createObjectURL(blob);
        revoke = true;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revoke) setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch(e) { console.error('[PhotoLightbox] Erro ao descarregar:', e); }
  }

  /* ── Save notes ───────────────────────────────────────────────────────── */
  function _saveNotes() {
    const DB = window.GedcomDB;
    if (!_currentId || !DB) return;
    const m = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
    if (!m) return;
    m.notes = document.getElementById('plbNotesArea').value;
    if (DB.saveMultimedia) DB.saveMultimedia(m);
    const btn = document.getElementById('plbSaveNotes');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="mdi mdi-check"></i> Guardado';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  }

  /* ── Open / Close (public API) ────────────────────────────────────────── */
  function open(mediaId, personId) {
    _init();
    const DB = window.GedcomDB;
    if (!DB) { console.error('[PhotoLightbox] GedcomDB not available'); return; }

    _personId = personId || null;

    // Build photo list
    if (personId && DB.getMultimediaForIndividual) {
      const media = DB.getMultimediaForIndividual(personId);
      _photoList = media.map(m => m.id);
    } else {
      _photoList = [mediaId];
    }
    if (!_photoList.includes(mediaId)) _photoList.unshift(mediaId);

    _load(mediaId);
    _overlay.classList.remove('plb-maximized');
    document.getElementById('plbMaxIcon').classList.replace('mdi-arrow-collapse', 'mdi-arrow-expand');
    document.getElementById('plbMaximize').title = 'Maximizar (F)';
    _overlay.classList.add('plb-open');
    _overlay.focus();
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove('plb-open', 'plb-maximized');
    const img = document.getElementById('plbImg');
    if (img) { img.onload = null; img.src = ''; }
    const overlay = document.getElementById('plbTagOverlay');
    if (overlay) overlay.innerHTML = '';
    _currentId = null;
  }

  /* ── Expose ───────────────────────────────────────────────────────────── */
  window.PhotoLightbox = { open, close };

})();
