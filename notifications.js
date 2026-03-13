/**
 * notifications.js — In-app notification bell for myLineage.
 *
 * Renders a bell icon with unread badge and dropdown in the topbar.
 * Polls /api/notifications/unread-count every 60 seconds.
 *
 * Usage: include this script on any page that has <div id="notifBell"></div>
 * inside the topbar. The container is auto-created if missing.
 *
 * Depends on: localStorage ml_access (JWT token from auth.js)
 */
(function () {
  'use strict';

  var POLL_INTERVAL = 60000; // 60 seconds
  var _timer  = null;
  var _open   = false;
  var _items  = [];
  var _count  = 0;

  function _token() { return localStorage.getItem('ml_access') || ''; }

  function _headers() {
    var tk = _token();
    return tk ? { 'Authorization': 'Bearer ' + tk, 'Content-Type': 'application/json' } : {};
  }

  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function _relTime(iso) {
    var diff = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return mins + ' min';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h';
    var days = Math.floor(hours / 24);
    return days + 'd';
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  function _ensureContainer() {
    var el = document.getElementById('notifBell');
    if (el) return el;

    // Auto-create inside the topbar's right-side area
    var topbar = document.querySelector('.topbar');
    if (!topbar) return null;
    var rightDiv = topbar.querySelector('div:last-child');
    if (!rightDiv) rightDiv = topbar;

    el = document.createElement('div');
    el.id = 'notifBell';
    el.style.cssText = 'position:relative;display:inline-flex;align-items:center;';
    rightDiv.insertBefore(el, rightDiv.firstChild);
    return el;
  }

  function _render() {
    var container = _ensureContainer();
    if (!container) return;

    container.innerHTML = '';

    // Bell button
    var btn = document.createElement('button');
    btn.id = 'notifBellBtn';
    btn.title = 'Notificações';
    btn.style.cssText = 'position:relative;background:none;border:none;color:#ccc;font-size:1.3rem;cursor:pointer;padding:6px 8px;border-radius:8px;transition:background 0.15s;';
    btn.innerHTML = '<i class="mdi mdi-bell-outline"></i>';
    btn.onmouseover = function () { this.style.background = 'rgba(255,255,255,0.08)'; };
    btn.onmouseout  = function () { if (!_open) this.style.background = 'none'; };
    btn.onclick = function (e) { e.stopPropagation(); _toggleDropdown(); };

    // Badge
    if (_count > 0) {
      var badge = document.createElement('span');
      badge.id = 'notifBadge';
      badge.textContent = _count > 99 ? '99+' : String(_count);
      badge.style.cssText = 'position:absolute;top:2px;right:2px;min-width:16px;height:16px;background:#e06060;color:#fff;font-size:0.6rem;font-weight:700;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;';
      btn.appendChild(badge);
    }

    container.appendChild(btn);

    // Dropdown
    var dd = document.createElement('div');
    dd.id = 'notifDropdown';
    dd.style.cssText = 'display:' + (_open ? 'block' : 'none') +
      ';position:absolute;top:100%;right:0;width:340px;max-height:400px;overflow-y:auto;' +
      'background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.4);z-index:9999;margin-top:6px;';

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border);';
    hdr.innerHTML = '<span style="font-weight:600;font-size:0.88rem;color:var(--text-main);">Notificações</span>';

    if (_count > 0) {
      var markAll = document.createElement('button');
      markAll.textContent = 'Marcar tudo como lido';
      markAll.style.cssText = 'background:none;border:none;color:#4493f8;font-size:0.75rem;cursor:pointer;padding:0;';
      markAll.onclick = function (e) { e.stopPropagation(); _markAllRead(); };
      hdr.appendChild(markAll);
    }
    dd.appendChild(hdr);

    // Items
    if (_items.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:24px 14px;text-align:center;color:var(--text-secondary);font-size:0.85rem;';
      empty.textContent = 'Sem notificações';
      dd.appendChild(empty);
    } else {
      _items.forEach(function (item) {
        dd.appendChild(_renderItem(item));
      });
    }

    container.appendChild(dd);
  }

  function _renderItem(item) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.1s;' +
      (!item.read ? 'background:rgba(68,147,248,0.06);' : '');
    row.onmouseover = function () { this.style.background = 'var(--bg-surface)'; };
    row.onmouseout  = function () { this.style.background = !item.read ? 'rgba(68,147,248,0.06)' : ''; };

    var icon = _getIcon(item.type);
    var msg  = _getMessage(item);

    row.innerHTML =
      '<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--bg-surface-2);display:flex;align-items:center;justify-content:center;font-size:0.9rem;color:#4493f8;"><i class="mdi ' + icon + '"></i></div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.82rem;color:var(--text-main);line-height:1.4;">' + msg + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">' + _esc(_relTime(item.createdAt)) + '</div>' +
      '</div>' +
      (!item.read ? '<div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:#4493f8;align-self:center;"></div>' : '');

    row.onclick = function (e) {
      e.stopPropagation();
      _handleItemClick(item);
    };

    return row;
  }

  function _getIcon(type) {
    switch (type) {
      case 'invitation':          return 'mdi-email-outline';
      case 'invitation_accepted': return 'mdi-account-check-outline';
      case 'invitation_declined': return 'mdi-account-remove-outline';
      default:                    return 'mdi-bell-outline';
    }
  }

  function _getMessage(item) {
    var d = item.data || {};
    switch (item.type) {
      case 'invitation':
        return '<strong>' + _esc(d.inviterName) + '</strong> convidou-o para a árvore <strong>' + _esc(d.treeName) + '</strong>';
      case 'invitation_accepted':
        return '<strong>' + _esc(d.acceptedBy) + '</strong> aceitou o convite para <strong>' + _esc(d.treeName) + '</strong>';
      case 'invitation_declined':
        return '<strong>' + _esc(d.declinedBy) + '</strong> recusou o convite para <strong>' + _esc(d.treeName) + '</strong>';
      default:
        return _esc(JSON.stringify(d));
    }
  }

  function _handleItemClick(item) {
    // Mark as read
    if (!item.read) {
      _markRead(item.id);
    }

    // Navigate based on type
    var d = item.data || {};
    if (item.type === 'invitation' && d.invitationId) {
      // Redirect to invitations page or fetch invite by-token
      fetch('/api/invitations', { headers: _headers() })
        .then(function (r) { return r.json(); })
        .then(function (invitations) {
          var inv = (invitations || []).find(function (i) { return i.id === d.invitationId; });
          if (inv) {
            // Show the accept/decline UI in the dropdown itself
            _toggleDropdown();
          }
        })
        .catch(function () {});
    } else if ((item.type === 'invitation_accepted' || item.type === 'invitation_declined') && d.treeId) {
      _closeDropdown();
    }
  }

  /* ── API calls ───────────────────────────────────────────────────────── */

  function _fetchCount() {
    if (!_token()) return;
    fetch('/api/notifications/unread-count', { headers: _headers() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && typeof d.count === 'number') {
          _count = d.count;
          _updateBadge();
        }
      })
      .catch(function () {});
  }

  function _fetchItems() {
    if (!_token()) return;
    fetch('/api/notifications?limit=20', { headers: _headers() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (items) {
        _items = items || [];
        _render();
      })
      .catch(function () {});
  }

  function _markRead(id) {
    fetch('/api/notifications/' + id + '/read', {
      method: 'PUT',
      headers: _headers(),
    }).then(function () {
      var item = _items.find(function (i) { return i.id === id; });
      if (item) item.read = true;
      _count = Math.max(0, _count - 1);
      _render();
    }).catch(function () {});
  }

  function _markAllRead() {
    fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: _headers(),
    }).then(function () {
      _items.forEach(function (i) { i.read = true; });
      _count = 0;
      _render();
    }).catch(function () {});
  }

  function _updateBadge() {
    var badge = document.getElementById('notifBadge');
    if (_count > 0) {
      if (!badge) {
        _render();
      } else {
        badge.textContent = _count > 99 ? '99+' : String(_count);
        badge.style.display = 'flex';
      }
    } else if (badge) {
      badge.style.display = 'none';
    }
  }

  /* ── Dropdown toggle ─────────────────────────────────────────────────── */

  function _toggleDropdown() {
    if (_open) {
      _closeDropdown();
    } else {
      _open = true;
      _fetchItems(); // refresh on open
    }
  }

  function _closeDropdown() {
    _open = false;
    var dd = document.getElementById('notifDropdown');
    if (dd) dd.style.display = 'none';
    var btn = document.getElementById('notifBellBtn');
    if (btn) btn.style.background = 'none';
  }

  // Close dropdown on outside click
  document.addEventListener('click', function () {
    if (_open) _closeDropdown();
  });

  /* ── Init ────────────────────────────────────────────────────────────── */

  function _init() {
    if (!_token()) return;
    _render();
    _fetchCount();

    // Poll for unread count
    _timer = setInterval(_fetchCount, POLL_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // Expose for external use
  window.NotificationBell = {
    refresh: function () { _fetchCount(); if (_open) _fetchItems(); },
  };

})();
