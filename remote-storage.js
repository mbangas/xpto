// remote-storage.js
// Shim that synchronizes `localStorage` with a backend storing JSON files under JSON-DATA.
(function(){
  const API_BASE = '/api/data';
  const origGet = localStorage.getItem.bind(localStorage);
  const origSet = localStorage.setItem.bind(localStorage);
  const origRemove = localStorage.removeItem.bind(localStorage);

  function xhrSyncGet(url){
    try{
      const req = new XMLHttpRequest();
      req.open('GET', url, false); // synchronous on purpose to populate storage before page scripts run
      req.send(null);
      if(req.status >= 200 && req.status < 300) return req.responseText;
    }catch(e){ }
    return null;
  }

  // Load list of keys and populate localStorage synchronously
  try{
    const listRaw = xhrSyncGet(API_BASE);
    if(listRaw){
      const list = JSON.parse(listRaw);
      if(Array.isArray(list.keys) || (list.keys && Array.isArray(list.keys))){
        const keys = list.keys || [];
        keys.forEach(k => {
          try{
            const resp = xhrSyncGet(API_BASE + '/' + encodeURIComponent(k));
            if(!resp) return;
            const parsed = JSON.parse(resp);
            if(parsed && parsed.data !== undefined){
              try{ origSet(k, JSON.stringify(parsed.data)); } catch(e){}
            }
          }catch(e){ /* ignore per-key errors */ }
        });
      }
    }
  }catch(e){ /* ignore */ }

  // helper async save to server
  function saveToServer(key, value){
    // try parse JSON string value
    let body;
    try{ body = JSON.parse(value); }
    catch(e){ body = { __raw__: value }; }
    fetch(API_BASE + '/' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(()=>{});
  }

  function deleteOnServer(key){ fetch(API_BASE + '/' + encodeURIComponent(key), { method: 'DELETE' }).catch(()=>{}); }

  // Override setItem/removeItem/getItem to synchronize
  localStorage.getItem = function(key){
    try{ return origGet(key); }catch(e){ return null; }
  };
  localStorage.setItem = function(key, value){
    const old = origGet(key);
    try{ origSet(key, value); }catch(e){}
    try{ saveToServer(key, value); }catch(e){}
    try{ window.dispatchEvent(new StorageEvent('storage', { key: key, oldValue: old, newValue: value, url: location.href, storageArea: localStorage })); }catch(e){}
  };
  localStorage.removeItem = function(key){
    const old = origGet(key);
    try{ origRemove(key); }catch(e){}
    try{ deleteOnServer(key); }catch(e){}
    try{ window.dispatchEvent(new StorageEvent('storage', { key: key, oldValue: old, newValue: null, url: location.href, storageArea: localStorage })); }catch(e){}
  };

  // expose a small helper for debug / manual sync
  window.__remoteStorage = {
    syncNow: function(){
      fetch(API_BASE).then(r=>r.json()).then(j=>{ (j.keys||[]).forEach(k=> fetch(API_BASE+'/'+encodeURIComponent(k)).then(r=>r.json()).then(d=>{ localStorage.setItem(k, JSON.stringify(d.data)); }).catch(()=>{})); }).catch(()=>{});
    }
  };
})();
