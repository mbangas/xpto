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
      height: 80vh;
      max-height: 92vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: plbIn 0.18s ease;
      transition: max-width 0.2s ease, height 0.2s ease, max-height 0.2s ease, border-radius 0.2s ease;
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
    #plbOverlay.plb-maximized #plbImg { max-height: 100%; }
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
      align-items: stretch;
      overflow: hidden;
      padding: 12px;
      position: relative;
    }
    #plbPhotoWrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      line-height: 0;
    }
    #plbImg {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 6px;
    }
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
    .plb-tag-zone.plb-highlight {
      background: rgba(59,130,246,0.32);
      border-color: rgba(99,179,255,1);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
    }
    .plb-person-chip-label.plb-highlight {
      background: rgba(59,130,246,0.28);
      color: #93c5fd;
      border-color: rgba(59,130,246,0.65);
      box-shadow: 0 0 0 2px rgba(59,130,246,0.22);
    }
    .plb-person-chip-label.plb-bbox-tag.plb-highlight {
      background: rgba(59,130,246,0.32);
      color: #93c5fd;
      border-color: rgba(59,130,246,0.72);
    }
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
      opacity: 1;
      transform: translateY(0);
      transition: opacity 0.15s, transform 0.15s;
    }
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
    /* Livro eligibility toggle */
    .plb-livro-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .plb-livro-toggle-label {
      font-size: 0.82rem;
      color: var(--text-main, #e8eaf6);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .plb-livro-toggle-label .mdi { font-size: 1rem; color: var(--accent, #818cf8); }
    .plb-livro-switch {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .plb-livro-switch input { opacity: 0; width: 0; height: 0; }
    .plb-livro-switch .slider {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,0.12);
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .plb-livro-switch .slider::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 2px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .plb-livro-switch input:checked + .slider { background: var(--accent, #818cf8); }
    .plb-livro-switch input:checked + .slider::before { transform: translateX(16px); }
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
    /* ── Person tagging ─────────────────────────────────────────────── */
    .plb-people-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 6px;
    }
    .plb-person-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .plb-person-chip-label {
      flex: 1;
      font-size: 0.78rem;
      padding: 3px 9px;
      border-radius: 12px;
      background: var(--accent-soft, rgba(99,102,241,0.15));
      color: var(--accent, #818cf8);
      border: 1px solid var(--border-accent, rgba(99,102,241,0.25));
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .plb-person-chip-label.plb-bbox-tag {
      background: rgba(59,130,246,0.12);
      color: #60a5fa;
      border-color: rgba(59,130,246,0.3);
    }
    .plb-person-unlink-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-secondary, #777);
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 1rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s;
    }
    .plb-person-unlink-btn:hover { color: #e53935; }
    .plb-add-person-area { position: relative; }
    .plb-add-person-btn {
      width: 100%;
      padding: 5px 10px;
      border-radius: 7px;
      border: 1px dashed var(--border, rgba(255,255,255,0.18));
      background: transparent;
      color: var(--text-secondary, #888);
      font-size: 0.82rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .plb-add-person-btn:hover {
      background: var(--accent-soft, rgba(68,147,248,0.12));
      color: var(--accent, #4493f8);
      border-color: var(--accent, #4493f8);
    }
    #plbPersonSearchWrap {
      display: none;
      border: 1px solid var(--border-accent, rgba(68,147,248,0.3));
      border-radius: 8px;
      background: var(--bg-surface, #161b22);
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3);
      overflow: hidden;
      margin-bottom: 4px;
    }
    .plb-person-search-input {
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      background: var(--bg-surface-2, #21262d);
      color: var(--text-main, #e6edf3);
      box-sizing: border-box;
      font-size: 0.85rem;
      font-family: inherit;
      outline: none;
    }
    .plb-person-search-input:focus { border-bottom-color: var(--accent, #4493f8); }
    .plb-person-dropdown {
      background: transparent;
      max-height: 180px;
      overflow-y: auto;
      display: none;
    }
    .plb-person-dropdown.open { display: block; }
    .plb-person-option {
      padding: 7px 12px;
      font-size: 0.82rem;
      cursor: pointer;
      color: var(--text-main, #e6edf3);
      transition: background 0.13s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
    }
    .plb-person-option:last-child { border-bottom: none; }
    .plb-person-option:hover { background: var(--accent-hover, rgba(68,147,248,0.18)); }
    .plb-person-option.already-linked {
      color: var(--text-secondary, #8b949e);
      cursor: default;
      font-style: italic;
    }
    /* Draw mode */
    .plb-draw-btn {
      width: 100%;
      margin-top: 4px;
      padding: 5px 10px;
      border-radius: 7px;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      background: transparent;
      color: var(--text-secondary, #888);
      font-size: 0.82rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s, color 0.15s;
    }
    .plb-draw-btn:hover { background: rgba(59,130,246,0.12); color: #60a5fa; }
    .plb-draw-btn.active {
      background: rgba(59,130,246,0.2);
      color: #3b82f6;
      border-color: rgba(59,130,246,0.4);
    }
    #plbDrawOverlay {
      position: absolute;
      inset: 0;
      z-index: 20;
      cursor: crosshair;
      display: none;
    }
    #plbDrawOverlay.active { display: block; }
    #plbDrawRectEl {
      position: absolute;
      border: 2px dashed rgba(59,130,246,0.9);
      background: rgba(59,130,246,0.15);
      box-sizing: border-box;
      pointer-events: none;
      display: none;
    }
    .plb-tag-remove-btn {
      position: absolute;
      top: -7px;
      right: -7px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #e53935;
      border: none;
      color: #fff;
      font-size: 0.6rem;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 5;
      line-height: 1;
      padding: 0;
    }
    .plb-tag-zone:hover .plb-tag-remove-btn { display: flex; }
    /* Bbox person popup */
    #plbBboxPersonPopup {
      position: fixed;
      background: var(--bg-surface, #161b22);
      border: 1px solid var(--border-accent, rgba(68,147,248,0.3));
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3);
      padding: 0;
      z-index: 2147483647;
      width: 240px;
      display: none;
      overflow: hidden;
    }
    #plbBboxPersonPopup.open { display: block; }
    #plbBboxSearchInput {
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      background: var(--bg-surface-2, #21262d);
      color: var(--text-main, #e6edf3);
      box-sizing: border-box;
      font-size: 0.82rem;
      font-family: inherit;
      outline: none;
      display: block;
    }
    #plbBboxSearchInput:focus { border-bottom-color: var(--accent, #4493f8); }
    #plbBboxPersonList { max-height: 150px; overflow-y: auto; padding: 4px 0; }
    .plb-bbox-person-opt {
      padding: 6px 12px;
      font-size: 0.8rem;
      cursor: pointer;
      color: var(--text-main, #e6edf3);
      border-radius: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background 0.13s;
    }
    .plb-bbox-person-opt:hover { background: var(--accent-hover, rgba(68,147,248,0.18)); }
    .plb-bbox-popup-cancel {
      padding: 8px 12px;
      font-size: 0.75rem;
      color: var(--text-secondary, #8b949e);
      cursor: pointer;
      text-align: center;
      border-top: 1px solid var(--border, rgba(255,255,255,0.08));
      transition: background 0.13s, color 0.13s;
    }
    .plb-bbox-popup-cancel:hover {
      color: var(--text-main, #e6edf3);
      background: var(--bg-surface-2, #21262d);
    }
    /* ── Zone move/resize handles ─────────────────────────────────────── */
    .plb-tag-zone-handle {
      position: absolute;
      width: 10px; height: 10px;
      background: #3b82f6;
      border: 2px solid #fff;
      border-radius: 2px;
      z-index: 7;
      opacity: 0;
      transition: opacity 0.12s;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
      pointer-events: auto;
    }
    .plb-tag-zone:hover .plb-tag-zone-handle { opacity: 1; }
    .plb-tag-zone-handle.nw { top:-5px;    left:-5px;  cursor: nwse-resize; }
    .plb-tag-zone-handle.ne { top:-5px;    right:-5px; cursor: nesw-resize; }
    .plb-tag-zone-handle.sw { bottom:-5px; left:-5px;  cursor: nesw-resize; }
    .plb-tag-zone-handle.se { bottom:-5px; right:-5px; cursor: nwse-resize; }
    .plb-tag-zone.plb-zone-dragging { cursor: move !important; user-select: none; opacity: 0.85; }
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
            <div id="plbDrawOverlay"></div>
            <div id="plbDrawRectEl"></div>
            <div id="plbBboxPersonPopup">
              <input type="text" id="plbBboxSearchInput" placeholder="Pesquisar pessoa..." autocomplete="off" />
              <div id="plbBboxPersonList"></div>
              <div class="plb-bbox-popup-cancel" id="plbBboxCancel">Cancelar</div>
            </div>
          </div>
        </div>
        <aside id="plbSidebar">
          <div>
            <div class="plb-info-lbl">Ficheiro</div>
            <div class="plb-info-val" id="plbFileName">—</div>
          </div>
          <div id="plbPeopleSection">
            <div class="plb-info-lbl">Pessoas</div>
            <div class="plb-people-list" id="plbPeopleList"></div>
            <div class="plb-add-person-area" id="plbAddPersonArea">
              <button class="plb-add-person-btn" id="plbAddPersonBtn">
                <i class="mdi mdi-account-plus-outline"></i> Associar pessoa
              </button>
              <div id="plbPersonSearchWrap">
                <input type="text" class="plb-person-search-input" id="plbPersonSearchInput" placeholder="Pesquisar pessoa..." autocomplete="off" />
                <div class="plb-person-dropdown" id="plbPersonDropdown"></div>
              </div>
            </div>
            <button class="plb-draw-btn" id="plbMarkRegionBtn">
              <i class="mdi mdi-vector-rectangle"></i> Marcar região na foto
            </button>
          </div>
          <div>
            <div class="plb-info-lbl">Notas</div>
            <textarea id="plbNotesArea" placeholder="Sem notas…"></textarea>
            <button id="plbSaveNotes"><i class="mdi mdi-content-save-outline"></i> Guardar notas</button>
          </div>
          <div id="plbLivroSection">
            <div class="plb-info-lbl">Livro</div>
            <div class="plb-livro-toggle-row">
              <span class="plb-livro-toggle-label">
                <i class="mdi mdi-book-open-page-variant-outline"></i> Elegível para o Livro
              </span>
              <label class="plb-livro-switch">
                <input type="checkbox" id="plbLivroToggle" checked />
                <span class="slider"></span>
              </label>
            </div>
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
  // draw-mode state
  let _drawMode    = false;
  let _pendingBbox = null;  // { x, y, w, h } normalized (0–1)

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
    document.getElementById('plbLivroToggle').addEventListener('change', _saveLivroEligible);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
    _initPersonPickerEvents();
    _initDrawMode();

    // Re-fit tag overlay whenever the image pane is resized (maximize, restore, window resize)
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => _fitTagOverlay()).observe(document.getElementById('plbImgPane'));
    }

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

    // Livro eligibility toggle
    const livroToggle = document.getElementById('plbLivroToggle');
    if (livroToggle) livroToggle.checked = m.livroEligible !== false;

    // People (from tags + from individuals refs)
    _renderPeopleSection(m);

    // Reset person picker UI and draw mode on photo change
    const addBtn = document.getElementById('plbAddPersonBtn');
    const searchWrap = document.getElementById('plbPersonSearchWrap');
    const dropdown = document.getElementById('plbPersonDropdown');
    if (addBtn)     addBtn.style.display = '';
    if (searchWrap) searchWrap.style.display = 'none';
    if (dropdown)   dropdown.classList.remove('open');
    // Reset draw mode
    _drawMode    = false;
    _pendingBbox = null;
    const drawBtn    = document.getElementById('plbMarkRegionBtn');
    const drawOv     = document.getElementById('plbDrawOverlay');
    const drawRect   = document.getElementById('plbDrawRectEl');
    const bboxPopup  = document.getElementById('plbBboxPersonPopup');
    if (drawBtn)   drawBtn.classList.remove('active');
    if (drawOv)    drawOv.classList.remove('active');
    if (drawRect)  drawRect.style.display = 'none';
    if (bboxPopup) bboxPopup.classList.remove('open');

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

  /**
   * Resize #plbTagOverlay to match the rendered image exactly so that
   * zone percentages are relative to the image, not the surrounding wrap.
   */
  function _fitTagOverlay() {
    const img  = document.getElementById('plbImg');
    const wrap = document.getElementById('plbPhotoWrap');
    if (!img || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const imgRect  = img.getBoundingClientRect();
    const el = document.getElementById('plbTagOverlay');
    if (!el) return;
    el.style.inset  = 'auto';
    el.style.top    = (imgRect.top    - wrapRect.top)  + 'px';
    el.style.left   = (imgRect.left   - wrapRect.left) + 'px';
    el.style.width  = imgRect.width   + 'px';
    el.style.height = imgRect.height  + 'px';
  }

  function _renderTagZones(m) {
    _fitTagOverlay();
    const overlay = document.getElementById('plbTagOverlay');
    overlay.innerHTML = '';
    const img  = document.getElementById('plbImg');
    const natW = img.naturalWidth  || 1;
    const natH = img.naturalHeight || 1;
    (m.tags || []).forEach((t, originalIdx) => {
      let left, top, width, height;
      if (t.bbox && t.bbox.w > 0 && t.bbox.h > 0) {
        left   = t.bbox.x * 100;
        top    = t.bbox.y * 100;
        width  = t.bbox.w * 100;
        height = t.bbox.h * 100;
      } else if (t.pixelCoords) {
        const pc = t.pixelCoords;
        left   = (pc.x1 / natW) * 100;
        top    = (pc.y1 / natH) * 100;
        width  = ((pc.x2 - pc.x1) / natW) * 100;
        height = ((pc.y2 - pc.y1) / natH) * 100;
      } else { return; }
      const zone = document.createElement('div');
      zone.className = 'plb-tag-zone';
      zone.style.left   = left + '%';
      zone.style.top    = top + '%';
      zone.style.width  = width + '%';
      zone.style.height = height + '%';
      const lbl = document.createElement('div');
      lbl.className = 'plb-tag-lbl';
      lbl.textContent = t.personName || 'Pessoa';
      zone.appendChild(lbl);
      // Remove button (visible on hover via CSS)
      const rmBtn = document.createElement('button');
      rmBtn.className = 'plb-tag-remove-btn';
      rmBtn.title = 'Remover região';
      rmBtn.innerHTML = '<i class="mdi mdi-close" style="pointer-events:none;font-size:0.65rem;"></i>';
      rmBtn.addEventListener('click', e => { e.stopPropagation(); _removeBboxTag(originalIdx); });
      zone.appendChild(rmBtn);
      // Cross-highlight with sidebar chip
      const pid = t.personId || ('__idx_' + originalIdx);
      zone.dataset.plbPid = pid;
      zone.addEventListener('mouseenter', () => _highlightByPid(pid, true,  zone));
      zone.addEventListener('mouseleave', () => _highlightByPid(pid, false, zone));
      // Corner resize handles + drag-to-move
      zone.style.cursor = 'move';
      ['nw', 'ne', 'sw', 'se'].forEach(corner => {
        const h = document.createElement('div');
        h.className = 'plb-tag-zone-handle ' + corner;
        h.addEventListener('mousedown', e => {
          e.stopPropagation(); e.preventDefault();
          _startZoneEdit(e, 'resize', corner, m, t, zone);
        });
        zone.appendChild(h);
      });
      zone.addEventListener('mousedown', e => {
        if (e.target.classList.contains('plb-tag-zone-handle')) return;
        if (e.target.classList.contains('plb-tag-remove-btn')) return;
        e.stopPropagation(); e.preventDefault();
        _startZoneEdit(e, 'move', null, m, t, zone);
      });
      overlay.appendChild(zone);
    });

    // Delegated hover from the photo pane itself (catches cases where zone
    // pointer-events might be suppressed by a parent)
    const pane = document.getElementById('plbImgPane');
    if (pane && !pane._plbHoverWired) {
      pane._plbHoverWired = true;
      pane.addEventListener('mouseover', e => {
        const z = e.target.closest('.plb-tag-zone');
        if (z && z.dataset.plbPid) _highlightByPid(z.dataset.plbPid, true,  z);
      });
      pane.addEventListener('mouseout', e => {
        const z = e.target.closest('.plb-tag-zone');
        if (z && z.dataset.plbPid) _highlightByPid(z.dataset.plbPid, false, z);
      });
    }
  }

  /**
   * Drag-move or corner-resize an existing tag zone.
   * @param {MouseEvent}      e       - initiating mousedown event
   * @param {'move'|'resize'} mode
   * @param {string|null}     corner  - 'nw'|'ne'|'sw'|'se', null for move
   * @param {object}          m       - multimedia record (mutated on save)
   * @param {object}          tag     - the tag object (mutated in place)
   * @param {HTMLElement}     zoneEl  - the zone DOM element
   */
  function _startZoneEdit(e, mode, corner, m, tag, zoneEl) {
    const imgEl   = document.getElementById('plbImg');
    const overlay = document.getElementById('plbTagOverlay');
    if (!imgEl || !overlay) return;

    const overlayRect = overlay.getBoundingClientRect();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const MIN = 0.03; // minimum dimension (3 % of overlay)

    // Snapshot current zone dimensions as fractions of overlay
    const s = {
      l: parseFloat(zoneEl.style.left)   / 100,
      t: parseFloat(zoneEl.style.top)    / 100,
      w: parseFloat(zoneEl.style.width)  / 100,
      h: parseFloat(zoneEl.style.height) / 100
    };

    zoneEl.classList.add('plb-zone-dragging');

    function onMove(mv) {
      const dx = (mv.clientX - startMouseX) / overlayRect.width;
      const dy = (mv.clientY - startMouseY) / overlayRect.height;
      let l = s.l, t = s.t, w = s.w, h = s.h;

      if (mode === 'move') {
        l = Math.max(0, Math.min(1 - w, l + dx));
        t = Math.max(0, Math.min(1 - h, t + dy));
      } else {
        if (corner === 'se') {
          w = Math.max(MIN, Math.min(1 - l, w + dx));
          h = Math.max(MIN, Math.min(1 - t, h + dy));
        } else if (corner === 'sw') {
          const nl = Math.max(0, Math.min(l + w - MIN, l + dx));
          w = l + w - nl; l = nl;
          h = Math.max(MIN, Math.min(1 - t, h + dy));
        } else if (corner === 'ne') {
          w = Math.max(MIN, Math.min(1 - l, w + dx));
          const nt = Math.max(0, Math.min(t + h - MIN, t + dy));
          h = t + h - nt; t = nt;
        } else if (corner === 'nw') {
          const nl = Math.max(0, Math.min(l + w - MIN, l + dx));
          w = l + w - nl; l = nl;
          const nt = Math.max(0, Math.min(t + h - MIN, t + dy));
          h = t + h - nt; t = nt;
        }
      }
      zoneEl.style.left   = (l * 100) + '%';
      zoneEl.style.top    = (t * 100) + '%';
      zoneEl.style.width  = (w * 100) + '%';
      zoneEl.style.height = (h * 100) + '%';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      zoneEl.classList.remove('plb-zone-dragging');

      // Convert final overlay-% position back to image-relative bbox (0–1)
      const imgRect = imgEl.getBoundingClientRect();
      const newL = parseFloat(zoneEl.style.left)   / 100;
      const newT = parseFloat(zoneEl.style.top)    / 100;
      const newW = parseFloat(zoneEl.style.width)  / 100;
      const newH = parseFloat(zoneEl.style.height) / 100;

      const screenX = overlayRect.left + newL * overlayRect.width  - imgRect.left;
      const screenY = overlayRect.top  + newT * overlayRect.height - imgRect.top;

      tag.bbox = {
        x: parseFloat(Math.max(0, screenX / imgRect.width ).toFixed(5)),
        y: parseFloat(Math.max(0, screenY / imgRect.height).toFixed(5)),
        w: parseFloat((newW * overlayRect.width  / imgRect.width ).toFixed(5)),
        h: parseFloat((newH * overlayRect.height / imgRect.height).toFixed(5))
      };
      delete tag.pixelCoords; // normalise to bbox

      const DB = window.GedcomDB;
      if (DB && DB.saveMultimedia) DB.saveMultimedia(m);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  /**
   * Toggle highlight class on all tag zones and person chips sharing the same pid,
   * excluding the element that triggered the hover (it already has its own :hover CSS).
   * @param {string}  pid    – person key (personId or '__idx_N')
   * @param {boolean} on     – true = add highlight, false = remove
   * @param {Element} source – the element that triggered the event (skip it)
   */
  function _highlightByPid(pid, on, source) {
    const ovEl   = document.getElementById('plbTagOverlay');
    const listEl = document.getElementById('plbPeopleList');
    if (ovEl) {
      ovEl.querySelectorAll('.plb-tag-zone').forEach(el => {
        if (el !== source && el.dataset.plbPid === pid) {
          if (on) {
            el.style.background  = 'rgba(59,130,246,0.38)';
            el.style.borderColor = 'rgba(99,179,255,1)';
            el.style.boxShadow   = '0 0 0 3px rgba(59,130,246,0.32)';
          } else {
            el.style.background  = '';
            el.style.borderColor = '';
            el.style.boxShadow   = '';
          }
        }
      });
    }
    if (listEl) {
      listEl.querySelectorAll('.plb-person-chip-label').forEach(el => {
        if (el !== source && el.dataset.plbPid === pid) {
          if (on) {
            el.style.background  = 'rgba(59,130,246,0.38)';
            el.style.color       = '#93c5fd';
            el.style.borderColor = 'rgba(59,130,246,0.75)';
            el.style.boxShadow   = '0 0 0 2px rgba(59,130,246,0.32)';
          } else {
            el.style.background  = '';
            el.style.color       = '';
            el.style.borderColor = '';
            el.style.boxShadow   = '';
          }
        }
      });
    }
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

  /* ── Person tagging helpers ───────────────────────────────────────────── */

  /**
   * Get a sorted list of all persons in the database.
   * @returns {{ id: string, name: string }[]}
   */
  function _getPersonList() {
    const DB = window.GedcomDB;
    if (!DB || !DB.getIndividuals) return [];
    return DB.getIndividuals()
      .map(indi => ({
        id:   indi.id,
        name: DB.getDisplayName ? DB.getDisplayName(indi) : (indi.id || '')
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }

  /**
   * Render the interactive people section in the sidebar.
   * @param {object} m – multimedia record
   */
  function _renderPeopleSection(m) {
    const DB = window.GedcomDB;
    if (!DB) return;
    const listEl = document.getElementById('plbPeopleList');
    if (!listEl) return;
    listEl.innerHTML = '';

    // Collect linked persons: first from individual.multimediaRefs, then bbox tags
    const linked = [];
    const seenIds = new Set();

    if (DB.getIndividuals) {
      for (const indi of DB.getIndividuals()) {
        if ((indi.multimediaRefs || []).includes(m.id)) {
          const name = DB.getDisplayName ? DB.getDisplayName(indi) : indi.id;
          linked.push({ id: indi.id, name, source: 'ref' });
          seenIds.add(indi.id);
        }
      }
    }

    // bbox-only tags (person not yet in multimediaRefs)
    (m.tags || []).forEach((t, tagIdx) => {
      if (t.personId && seenIds.has(t.personId)) return;
      if (!t.personId && !t.personName) return;
      const name = t.personName || t.personId;
      linked.push({ id: t.personId || null, name, source: 'tag', tagIdx });
      if (t.personId) seenIds.add(t.personId);
    });

    if (!linked.length) {
      const empty = document.createElement('span');
      empty.style.cssText = 'font-size:0.82rem;color:var(--text-secondary,#888);font-style:italic;padding:2px 0;';
      empty.textContent = 'Nenhuma pessoa associada';
      listEl.appendChild(empty);
    } else {
      linked.forEach(p => {
        const row   = document.createElement('div');
        row.className = 'plb-person-row';

        const chip = document.createElement('span');
        chip.className = 'plb-person-chip-label' + (p.source === 'tag' ? ' plb-bbox-tag' : '');
        chip.title = p.source === 'tag' ? 'Marcação por região' : 'Associação direta';
        chip.textContent = p.name;
        // Cross-highlight with tag zone on photo
        const pid = p.id || ('__idx_' + p.tagIdx);
        if (pid) {
          chip.dataset.plbPid = pid;
          chip.addEventListener('mouseover', e => { e.stopPropagation(); _highlightByPid(pid, true,  chip); });
          chip.addEventListener('mouseout',  e => { e.stopPropagation(); _highlightByPid(pid, false, chip); });
        }

        const unlinkBtn = document.createElement('button');
        unlinkBtn.className = 'plb-person-unlink-btn';
        unlinkBtn.title = 'Remover associação';
        unlinkBtn.innerHTML = '<i class="mdi mdi-close" style="pointer-events:none;"></i>';
        unlinkBtn.addEventListener('click', () => _unlinkPerson(p));

        row.appendChild(chip);
        row.appendChild(unlinkBtn);
        listEl.appendChild(row);
      });
    }
  }

  /**
   * Link an individual to the current photo (adds to multimediaRefs).
   * @param {string} indiId
   */
  function _linkPerson(indiId) {
    const DB = window.GedcomDB;
    if (!DB || !_currentId) return;
    const indi = DB.getIndividual ? DB.getIndividual(indiId) : null;
    if (!indi) return;
    if (!indi.multimediaRefs) indi.multimediaRefs = [];
    if (!indi.multimediaRefs.includes(_currentId)) {
      indi.multimediaRefs.push(_currentId);
      if (DB.saveIndividual) DB.saveIndividual(indi);
    }
    const m = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
    if (m) _renderPeopleSection(m);
  }

  /**
   * Unlink a person entry from the current photo.
   * @param {{ id: string|null, source: string, tagIdx?: number, name: string }} p
   */
  function _unlinkPerson(p) {
    const DB = window.GedcomDB;
    if (!DB || !_currentId) return;
    if (p.id) {
      const indi = DB.getIndividual ? DB.getIndividual(p.id) : null;
      if (indi && indi.multimediaRefs) {
        indi.multimediaRefs = indi.multimediaRefs.filter(mid => mid !== _currentId);
        if (DB.saveIndividual) DB.saveIndividual(indi);
      }
    }
    // Also remove bbox tag if this association came from one
    if (p.source === 'tag' && p.tagIdx !== undefined) {
      const m = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
      if (m && m.tags) {
        m.tags.splice(p.tagIdx, 1);
        if (DB.saveMultimedia) DB.saveMultimedia(m);
        _renderTagZones(m);
      }
    }
    const m2 = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
    if (m2) _renderPeopleSection(m2);
  }

  /**
   * Remove a bbox tag by index and refresh.
   * @param {number} tagIdx
   */
  function _removeBboxTag(tagIdx) {
    const DB = window.GedcomDB;
    if (!_currentId || !DB) return;
    const m = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
    if (!m || !m.tags) return;
    m.tags.splice(tagIdx, 1);
    if (DB.saveMultimedia) DB.saveMultimedia(m);
    _renderTagZones(m);
    _renderPeopleSection(m);
  }

  /* ── Person picker (sidebar) ──────────────────────────────────────────── */

  /** Wire events for the "Associar pessoa" picker in the sidebar. */
  function _initPersonPickerEvents() {
    const addBtn     = document.getElementById('plbAddPersonBtn');
    const searchWrap = document.getElementById('plbPersonSearchWrap');
    const searchInput = document.getElementById('plbPersonSearchInput');
    const dropdown   = document.getElementById('plbPersonDropdown');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
      addBtn.style.display = 'none';
      searchWrap.style.display = 'block';
      searchInput.value = '';
      _populatePersonDropdown('');
      dropdown.classList.add('open');
      searchInput.focus();
    });

    searchInput.addEventListener('input', () => {
      _populatePersonDropdown(searchInput.value.trim().toLowerCase());
      dropdown.classList.add('open');
    });

    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        searchWrap.style.display = 'none';
        const ab = document.getElementById('plbAddPersonBtn');
        if (ab) ab.style.display = '';
        dropdown.classList.remove('open');
      }, 200);
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchWrap.style.display = 'none';
        addBtn.style.display = '';
        dropdown.classList.remove('open');
      }
    });
  }

  /**
   * Populate the sidebar person dropdown with filtered results.
   * @param {string} search – lowercase search term
   */
  function _populatePersonDropdown(search) {
    const dropdown = document.getElementById('plbPersonDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    const DB = window.GedcomDB;
    if (!DB) return;

    const linkedSet = new Set();
    if (DB.getIndividuals) {
      for (const indi of DB.getIndividuals()) {
        if ((indi.multimediaRefs || []).includes(_currentId)) linkedSet.add(indi.id);
      }
    }

    const persons = _getPersonList();
    const filtered = search
      ? persons.filter(p => p.name.toLowerCase().includes(search))
      : persons;

    if (!filtered.length) {
      dropdown.innerHTML = '<div class="plb-person-option" style="color:#888;cursor:default;">Nenhuma pessoa encontrada</div>';
      return;
    }

    filtered.slice(0, 30).forEach(p => {
      const opt = document.createElement('div');
      const isLinked = linkedSet.has(p.id);
      opt.className = 'plb-person-option' + (isLinked ? ' already-linked' : '');
      opt.textContent = p.name + (isLinked ? ' ✓' : '');
      if (!isLinked) {
        opt.addEventListener('mousedown', e => {
          e.preventDefault();
          _linkPerson(p.id);
          const sw = document.getElementById('plbPersonSearchWrap');
          const ab = document.getElementById('plbAddPersonBtn');
          const dd = document.getElementById('plbPersonDropdown');
          if (sw) sw.style.display = 'none';
          if (ab) ab.style.display = '';
          if (dd) dd.classList.remove('open');
        });
      }
      dropdown.appendChild(opt);
    });
  }

  /* ── Draw-mode (bbox region tagging) ─────────────────────────────────── */

  /** Wire events for the "Marcar região" draw mode. */
  function _initDrawMode() {
    const drawBtn  = document.getElementById('plbMarkRegionBtn');
    const overlay  = document.getElementById('plbDrawOverlay');
    const rectEl   = document.getElementById('plbDrawRectEl');
    const popup    = document.getElementById('plbBboxPersonPopup');
    const cancelEl = document.getElementById('plbBboxCancel');
    const bboxInput = document.getElementById('plbBboxSearchInput');
    if (!drawBtn) return;

    drawBtn.addEventListener('click', () => {
      _drawMode = !_drawMode;
      drawBtn.classList.toggle('active', _drawMode);
      overlay.classList.toggle('active', _drawMode);
      if (!_drawMode) {
        rectEl.style.display = 'none';
        popup.classList.remove('open');
        _pendingBbox = null;
      }
    });

    cancelEl.addEventListener('click', () => {
      popup.classList.remove('open');
      rectEl.style.display = 'none';
      _pendingBbox = null;
    });

    let isDrawing = false;
    let startX = 0, startY = 0;

    overlay.addEventListener('mousedown', e => {
      if (!_drawMode) return;
      const img = document.getElementById('plbImg');
      if (!img) return;
      const imgRect = img.getBoundingClientRect();
      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;
      rectEl.style.left   = (e.clientX - imgRect.left) + 'px';
      rectEl.style.top    = (e.clientY - imgRect.top)  + 'px';
      rectEl.style.width  = '0';
      rectEl.style.height = '0';
      rectEl.style.display = 'block';
      popup.classList.remove('open');
      e.preventDefault();
    });

    overlay.addEventListener('mousemove', e => {
      if (!isDrawing) return;
      const img = document.getElementById('plbImg');
      if (!img) return;
      const imgRect = img.getBoundingClientRect();
      const x1 = Math.min(startX, e.clientX) - imgRect.left;
      const y1 = Math.min(startY, e.clientY) - imgRect.top;
      const x2 = Math.max(startX, e.clientX) - imgRect.left;
      const y2 = Math.max(startY, e.clientY) - imgRect.top;
      rectEl.style.left   = Math.max(0, x1) + 'px';
      rectEl.style.top    = Math.max(0, y1) + 'px';
      rectEl.style.width  = (x2 - x1) + 'px';
      rectEl.style.height = (y2 - y1) + 'px';
    });

    overlay.addEventListener('mouseup', e => {
      if (!isDrawing) return;
      isDrawing = false;
      const img = document.getElementById('plbImg');
      if (!img) return;
      const imgRect = img.getBoundingClientRect();
      const x1 = Math.min(startX, e.clientX) - imgRect.left;
      const y1 = Math.min(startY, e.clientY) - imgRect.top;
      const x2 = Math.max(startX, e.clientX) - imgRect.left;
      const y2 = Math.max(startY, e.clientY) - imgRect.top;
      const w  = x2 - x1;
      const h  = y2 - y1;
      if (w < 10 || h < 10) { rectEl.style.display = 'none'; return; }

      // Normalize to image dimensions (0–1)
      _pendingBbox = {
        x: Math.max(0, x1) / imgRect.width,
        y: Math.max(0, y1) / imgRect.height,
        w: Math.min(w / imgRect.width,  1 - Math.max(0, x1) / imgRect.width),
        h: Math.min(h / imgRect.height, 1 - Math.max(0, y1) / imgRect.height)
      };

      // Position and open person popup (fixed positioning to avoid clip by overflow:hidden)
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const popW = 240;
      const popH = 200;  // approximate max height
      let popLeft = e.clientX + 12;
      let popTop  = e.clientY + 12;
      if (popLeft + popW > vpW - 8) popLeft = e.clientX - popW - 8;
      if (popTop  + popH > vpH - 8) popTop  = e.clientY - popH - 8;
      popup.style.left = Math.max(4, popLeft) + 'px';
      popup.style.top  = Math.max(4, popTop)  + 'px';
      bboxInput.value = '';
      _populateBboxPersonList('');
      popup.classList.add('open');
      requestAnimationFrame(() => bboxInput.focus());
    });

    bboxInput.addEventListener('input', () => {
      _populateBboxPersonList(bboxInput.value.trim().toLowerCase());
    });
  }

  /**
   * Populate the bbox popup person list.
   * @param {string} search – lowercase search term
   */
  function _populateBboxPersonList(search) {
    const listEl = document.getElementById('plbBboxPersonList');
    if (!listEl) return;
    listEl.innerHTML = '';
    const persons = _getPersonList();
    const filtered = search ? persons.filter(p => p.name.toLowerCase().includes(search)) : persons;
    if (!filtered.length) {
      listEl.innerHTML = '<div class="plb-bbox-person-opt" style="color:#888;cursor:default;">Nenhuma pessoa encontrada</div>';
      return;
    }
    filtered.slice(0, 20).forEach(p => {
      const opt = document.createElement('div');
      opt.className = 'plb-bbox-person-opt';
      opt.textContent = p.name;
      // Use mousedown+preventDefault so the click fires before any blur handler closes things
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        _saveBboxTag(p.id, p.name);
      });
      listEl.appendChild(opt);
    });
  }

  /**
   * Save a drawn bbox tag and close the popup.
   * @param {string} personId
   * @param {string} personName
   */
  function _saveBboxTag(personId, personName) {
    const DB = window.GedcomDB;
    if (!DB || !_currentId || !_pendingBbox) return;
    const m = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
    if (!m) return;
    if (!m.tags) m.tags = [];
    m.tags.push({ personId, personName, bbox: { ..._pendingBbox } });
    if (DB.saveMultimedia) DB.saveMultimedia(m);

    // Also link the person via multimediaRefs so the photo shows in their profile
    if (personId) {
      const indi = DB.getIndividual ? DB.getIndividual(personId) : null;
      if (indi) {
        if (!indi.multimediaRefs) indi.multimediaRefs = [];
        if (!indi.multimediaRefs.includes(_currentId)) {
          indi.multimediaRefs.push(_currentId);
          if (DB.saveIndividual) DB.saveIndividual(indi);
        }
      }
    }

    // Close popup and exit draw mode
    const popup   = document.getElementById('plbBboxPersonPopup');
    const rectEl  = document.getElementById('plbDrawRectEl');
    const drawBtn = document.getElementById('plbMarkRegionBtn');
    const overlay = document.getElementById('plbDrawOverlay');
    if (popup)   popup.classList.remove('open');
    if (rectEl)  rectEl.style.display = 'none';
    if (drawBtn) drawBtn.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    _drawMode    = false;
    _pendingBbox = null;

    _renderTagZones(m);
    _renderPeopleSection(m);
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
    // Re-fit overlay after CSS transition completes (transition is 0.2s)
    setTimeout(_fitTagOverlay, 220);
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

  /* ── Livro eligibility toggle ────────────────────────────────────────── */
  function _saveLivroEligible() {
    const DB = window.GedcomDB;
    if (!_currentId || !DB) return;
    const m = DB.getMultimediaItem ? DB.getMultimediaItem(_currentId) : null;
    if (!m) return;
    const toggle = document.getElementById('plbLivroToggle');
    m.livroEligible = toggle ? toggle.checked : true;
    if (DB.saveMultimedia) DB.saveMultimedia(m);
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
    // Reset draw mode
    _drawMode    = false;
    _pendingBbox = null;
    const drawBtn = document.getElementById('plbMarkRegionBtn');
    const drawOverlay = document.getElementById('plbDrawOverlay');
    const rectEl  = document.getElementById('plbDrawRectEl');
    const popup   = document.getElementById('plbBboxPersonPopup');
    if (drawBtn)    { drawBtn.classList.remove('active'); }
    if (drawOverlay){ drawOverlay.classList.remove('active'); }
    if (rectEl)     { rectEl.style.display = 'none'; }
    if (popup)      { popup.classList.remove('open'); }
    _currentId = null;
  }

  /* ── Expose ───────────────────────────────────────────────────────────── */
  window.PhotoLightbox = { open, close };

})();
