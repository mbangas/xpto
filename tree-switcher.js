/**
 * tree-switcher.js — Tree context indicator + switcher for myLineage.
 *
 * Renders the current tree name badge inside the topbar and a compact
 * dropdown to switch between trees or go back to the landing page.
 *
 * Usage: include this script on any tree-scoped page AFTER auth.js and
 * remote-storage.js.  Requires window.GedcomDB to be available.
 *
 * Reads/writes localStorage key 'ml_current_tree'.
 */
(function () {
  'use strict';

  var TREE_KEY = 'ml_current_tree';
  var _open = false;
  var _trees = [];

  function token() { return localStorage.getItem('ml_access') || ''; }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Get currently selected tree id from localStorage. */
  function currentTreeId() {
    return localStorage.getItem(TREE_KEY) || '';
  }

  /** Select a tree — store in localStorage and reload the page so
   *  remote-storage.js re-fetches all data for the new tree. */
  function switchTree(treeId) {
    if (treeId === currentTreeId()) return;
    localStorage.setItem(TREE_KEY, treeId);
    window.location.reload();
  }

  /* ── Bootstrap: ensure a tree is selected ─────────────────────────── */
  function ensureTreeSelected() {
    var DB = window.GedcomDB;
    if (!DB) return;

    var treeId = currentTreeId();

    // If we have a stored tree, tell GedcomDB to use it
    if (treeId) {
      try { DB.setCurrentTree(treeId); } catch (_) {}
      return;
    }

    // No tree selected — try to pick the first available
    var trees = DB.listTrees ? DB.listTrees() : [];
    if (trees.length === 1) {
      localStorage.setItem(TREE_KEY, trees[0].id);
      try { DB.setCurrentTree(trees[0].id); } catch (_) {}
    } else if (trees.length > 1) {
      // Multiple trees — redirect to landing so user can choose
      window.location.replace('landing.html');
    }
    // 0 trees — landing will handle it
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  function render() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Remove previous instance if any
    var prev = document.getElementById('treeSwitcher');
    if (prev) prev.remove();

    var DB = window.GedcomDB;
    var curId = currentTreeId();
    if (!curId || !DB) return;

    // Current tree info
    var trees = DB.listTrees ? DB.listTrees() : [];
    var curTree = null;
    for (var i = 0; i < trees.length; i++) {
      if (trees[i].id === curId) { curTree = trees[i]; break; }
    }
    _trees = trees;

    var container = document.createElement('div');
    container.id = 'treeSwitcher';
    container.style.cssText = 'position:relative;display:inline-flex;align-items:center;margin-left:12px;';

    // Tree badge button
    var btn = document.createElement('button');
    btn.id = 'treeSwitcherBtn';
    btn.title = 'Mudar de árvore';
    btn.style.cssText = [
      'display:flex;align-items:center;gap:6px;',
      'background:var(--bg-surface-2);border:1px solid var(--border);',
      'border-radius:20px;padding:4px 12px 4px 8px;',
      'font-size:0.78rem;font-weight:600;color:var(--text-main);',
      'cursor:pointer;transition:border-color 0.15s,background 0.15s;',
      'max-width:220px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;'
    ].join('');
    btn.innerHTML = '<i class="mdi mdi-tree" style="color:var(--green);font-size:0.95rem;flex-shrink:0;"></i>'
      + '<span style="overflow:hidden;text-overflow:ellipsis;">' + esc(curTree ? curTree.name : 'Árvore') + '</span>'
      + '<i class="mdi mdi-chevron-down" style="font-size:0.85rem;flex-shrink:0;color:var(--text-secondary);"></i>';

    btn.onmouseover = function () { this.style.borderColor = 'var(--border-accent)'; };
    btn.onmouseout = function () { if (!_open) this.style.borderColor = 'var(--border)'; };
    btn.onclick = function (e) { e.stopPropagation(); toggleDropdown(container); };

    container.appendChild(btn);

    // Insert after the first child (title area) of the topbar
    var firstDiv = topbar.querySelector('div');
    if (firstDiv) {
      firstDiv.appendChild(container);
    } else {
      topbar.insertBefore(container, topbar.firstChild);
    }

    // Close on outside click
    document.addEventListener('click', function () {
      closeDropdown();
    });
  }

  function toggleDropdown(container) {
    if (_open) { closeDropdown(); return; }
    _open = true;

    var dd = document.createElement('div');
    dd.id = 'treeSwitcherDD';
    dd.style.cssText = [
      'position:absolute;top:100%;left:0;margin-top:6px;',
      'min-width:240px;max-width:320px;max-height:360px;overflow-y:auto;',
      'background:var(--bg-surface);border:1px solid var(--border);',
      'border-radius:var(--radius-sm);box-shadow:0 12px 40px rgba(0,0,0,0.4);',
      'z-index:9999;'
    ].join('');

    dd.onclick = function (e) { e.stopPropagation(); };

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:10px 14px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;';
    hdr.innerHTML = '<span style="font-size:0.72rem;font-weight:700;color:var(--text-disabled);text-transform:uppercase;letter-spacing:0.08em;">Árvores</span>'
      + '<a href="landing.html" style="font-size:0.75rem;color:var(--accent);text-decoration:none;display:flex;align-items:center;gap:4px;">'
      + '<i class="mdi mdi-view-grid-outline" style="font-size:0.85rem;"></i> Ver todas</a>';
    dd.appendChild(hdr);

    // Tree list
    var curId = currentTreeId();
    if (_trees.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:16px;text-align:center;color:var(--text-secondary);font-size:0.82rem;';
      empty.textContent = 'Sem árvores disponíveis';
      dd.appendChild(empty);
    } else {
      _trees.forEach(function (t) {
        var item = document.createElement('div');
        var isActive = t.id === curId;
        item.style.cssText = [
          'padding:9px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;',
          'transition:background 0.12s;',
          isActive ? 'background:var(--accent-soft);' : ''
        ].join('');
        item.onmouseover = function () { if (!isActive) this.style.background = 'rgba(255,255,255,0.04)'; };
        item.onmouseout = function () { if (!isActive) this.style.background = ''; };

        var iconColor = isActive ? 'var(--accent)' : 'var(--text-disabled)';
        item.innerHTML = '<i class="mdi mdi-tree" style="font-size:1rem;color:' + iconColor + ';flex-shrink:0;"></i>'
          + '<div style="min-width:0;flex:1;">'
          + '<div style="font-weight:' + (isActive ? '700' : '500') + ';font-size:0.82rem;color:var(--text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(t.name) + '</div>'
          + '</div>'
          + (isActive ? '<i class="mdi mdi-check" style="color:var(--accent);font-size:0.9rem;flex-shrink:0;"></i>' : '');

        item.onclick = function () {
          if (!isActive) switchTree(t.id);
        };
        dd.appendChild(item);
      });
    }

    container.appendChild(dd);
  }

  function closeDropdown() {
    _open = false;
    var dd = document.getElementById('treeSwitcherDD');
    if (dd) dd.remove();
    var btn = document.getElementById('treeSwitcherBtn');
    if (btn) btn.style.borderColor = 'var(--border)';
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    ensureTreeSelected();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render);
    } else {
      render();
    }
  }

  init();

  // Expose for external use
  window.TreeSwitcher = {
    getCurrentTreeId: currentTreeId,
    switchTree: switchTree,
    render: render,
  };
})();
