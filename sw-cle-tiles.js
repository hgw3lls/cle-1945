<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Going to the Movies in Cleveland, 1945</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>

  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>

  <style>
    html, body { margin:0; padding:0; height:100%; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
    #map { position:absolute; top:0; bottom:0; right:0; left:360px; }
    #sidebar {
      position:absolute; top:0; left:0; bottom:0; width:360px;
      background:#f8f9fa; border-right:1px solid #ddd; overflow:auto; padding:12px;
    }
    #homeBtn {
      width:100%; padding:10px 12px; border-radius:10px;
      border:1px solid #1d4ed8; background:#2563eb; color:#fff;
      font-weight:700; cursor:pointer;
    }
    #homeBtn:hover { background:#1d4ed8; }
    .section-title { font-weight:700; text-transform:uppercase; font-size:12px; letter-spacing:.05em; margin:12px 0 6px; color:#333; }
    .btns button {
      width:100%; padding:8px 10px; margin:4px 0;
      border:1px solid #444; border-radius:8px;
      cursor:pointer; background:#eee;
    }
    .btns button:hover { background:#ddd; }
    .search { width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #ccc; margin-bottom:8px; }
    .status { font-size:12px; color:#333; margin:8px 0; }
    .list { margin-top:6px; }
    .item { padding:8px; border-radius:8px; border:1px solid #eee; margin-bottom:6px; cursor:pointer; background:#fff; }
    .item:hover { background:#f3f4f6; }
    .title { font-weight:700; }
    .small { color:#555; font-size:12px; }
    .badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
    .badge { display:inline-block; padding:2px 6px; border-radius:999px; background:#eef2ff; border:1px solid #c7d2fe; font-size:11px; color:#3730a3; }

    /* hide any old editor UI if present */
    #editor, .section-title:has(+ #editor) { display:none !important; }
  </style>
</head>
<body>
  <div id="sidebar">
    <div style="margin-bottom:12px;"><button id="homeBtn">Home View</button></div>

    <div class="section-title">GOING TO THE MOVIES IN CLEVELAND, 1945</div>
    <div style="font-size:14px; line-height:1.45; margin-bottom:12px; color:#333;">
      It&rsquo;s August 1945. The war is ending, the lights are back on downtown, and Cleveland&rsquo;s theaters are buzzing with crowds.
      This interactive map lets you relive that moment.<br><br>
      Just tap a theater dot to see what was on the marquee: the films playing that week, the house itself, and&mdash;when available&mdash;a photo, address, and a bit of its history.<br><br>
      Close the window to return to the map and stroll to the next showplace. When your tour is done, step back to the map&rsquo;s beginning and imagine the city as it was&mdash;alive with moviegoing.
    </div>

    <div class="section-title">Search</div>
    <input id="filter" class="search" placeholder="Filter by theatre or film&hellip;"/>

    <div class="btns">
      <button id="seedHome">Seed Home Area (z13–z15)</button>
      <button id="seedView">Save tiles in view</button>
      <button id="clearCache">Clear tile cache</button>
    </div>

    <div class="status" id="status">Loading&hellip;</div>
    <div id="list" class="list"></div>
  </div>

  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
  // ========== Map & Layers ==========
  const HOME_CENTER = [41.4993, -81.6944];
  const HOME_ZOOM   = 13;

  const map = L.map('map', { zoomControl:true }).setView(HOME_CENTER, HOME_ZOOM);

  // Hybrid = Imagery + labels + roads (Esri)
  const imagery   = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 });
  const refLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 });
  const refRoads  = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 });
  const hybrid = L.layerGroup([imagery, refLabels, refRoads]);
  const streets = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 });

  hybrid.addTo(map);
  L.control.layers({ "Hybrid (Imagery + Labels)": hybrid, "Streets": streets }, null, { collapsed:false }).addTo(map);

  document.getElementById('homeBtn').addEventListener('click', () => {
    map.setView(HOME_CENTER, HOME_ZOOM);
    map.closePopup && map.closePopup();
  });

  // ========== Data loading (inline JSON -> theaters.json -> auto-import from older HTML) ==========
  const markers = [];
  const markerLayer = L.featureGroup().addTo(map);
  const listEl   = document.getElementById('list');
  const statusEl = document.getElementById('status');
  const filterEl = document.getElementById('filter');

  function escapeHtml(s){return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function normalizeFeature(feat, idx=idx){
    if (!feat || !feat.geometry || !feat.properties) return null;
    if (feat.geometry.type !== 'Point') return null;
    const coords = feat.geometry.coordinates || [];
    const lng = Number(coords[0]), lat = Number(coords[1]);
    if (!isFinite(lat) || !isFinite(lng)) return null;

    const p = feat.properties || {};
    // Films may be "A; B; C" -> split
    const films = Array.isArray(p.Movie) ? p.Movie : (typeof p.Movie === 'string' ? p.Movie.split(';').map(s=>s.trim()).filter(Boolean) : []);
    return {
      id: p.ObjectID ?? idx,
      name: (p.Theatre || p.Theater || p.Name || 'Untitled Theater').toString().trim(),
      films,
      lat, lng,
      address: (p.Address || p.CT_Address || '').toString().trim(),
      notes: (p.Description_Long || p['Description Long'] || p.Description || '').toString().trim(),
      status: (p.CT_Status || p.Status || '').toString().trim(),
      url: (p.URL || '').toString().trim()
      // images intentionally ignored/removed for now
    };
  }

  function popupHtml(item){
    const filmBadges = item.films.map(f => `<span class="badge">${escapeHtml(f)}</span>`).join(' ');
    const status = item.status ? `<div class="small" style="margin-top:4px;"><b>Status:</b> ${escapeHtml(item.status)}</div>` : '';
    const url = item.url ? `<div class="small" style="margin-top:4px;"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">More info</a></div>` : '';
    const notes = item.notes ? `<div class="small" style="margin-top:6px;">${escapeHtml(item.notes)}</div>` : '';
    return `
      <div class="title" style="margin-bottom:4px;">${escapeHtml(item.name)}</div>
      ${filmBadges ? `<div class="badges">${filmBadges}</div>` : ''}
      <table class="details-table" style="width:100%; border-collapse:collapse; margin-top:6px;">
        ${item.address ? `<tr><th style="text-align:left; font-size:12px; color:#333; padding-right:6px;">Address</th><td style="font-size:12px; color:#333;">${escapeHtml(item.address)}</td></tr>` : ''}
      </table>
      ${status}${url}${notes}
    `;
  }

  function addMarker(item){
    const m = L.marker([item.lat, item.lng]);
    m.bindPopup(popupHtml(item), { maxWidth: 340 });
    m._item = item;
    m.addTo(markerLayer);
    markers.push(m);
  }

  function renderList(items){
    listEl.innerHTML = '';
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'item';
      const filmsLine = it.films.join('; ');
      div.innerHTML = `
        <div class="title">${escapeHtml(it.name)}</div>
        ${filmsLine ? `<div class="small">${escapeHtml(filmsLine)}</div>` : ''}
        ${it.address ? `<div class="small">${escapeHtml(it.address)}</div>` : ''}
      `;
      div.addEventListener('click', () => {
        map.setView([it.lat, it.lng], Math.max(map.getZoom(), 15));
        const mm = markers.find(m => m._item && m._item.id === it.id);
        if (mm) mm.openPopup();
      });
      listEl.appendChild(div);
    });
    statusEl.textContent = items.length ? `${items.length} theaters` : 'No theaters found.';
  }

  function applyFilter(){
    const q = (filterEl.value || '').toLowerCase().trim();
    const filtered = markers.map(m=>m._item).filter(it=>{
      if (!q) return true;
      const hay = [it.name, it.address || '', (it.films||[]).join(' '), it.notes||''].join(' ').toLowerCase();
      return hay.includes(q);
    });
    renderList(filtered);
  }
  filterEl.addEventListener('input', applyFilter);

  async function tryLoadInline(){
    const tag = document.getElementById('data');
    if (!tag) return null;
    const txt = (tag.textContent || '').trim();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  }

  async function tryLoadJSON(){
    try {
      const res = await fetch('theaters.json', { cache:'no-cache' });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  }

  async function tryLoadFromOldHTML(){
    // Same-origin fetch of the older file; extract <script id="data"> JSON
    const path = 'InfoMap_CLE1945_offline_SW_GHPAGES.html';
    try {
      const res = await fetch(path, { cache:'no-cache' });
      if (!res.ok) return null;
      const html = await res.text();
      const m = html.match(/<script[^>]*id=["']data["'][^>]*>([\s\S]*?)<\/script>/i);
      if (!m) return null;
      return JSON.parse(m[1]);
    } catch { return null; }
  }

  (async function init(){
    statusEl.textContent = 'Loading…';
    // Try sources in order: inline -> theaters.json -> old HTML (auto-import)
    let geo = await tryLoadInline();
    if (!geo) geo = await tryLoadJSON();
    if (!geo) geo = await tryLoadFromOldHTML();

    if (!geo || !Array.isArray(geo.features)) {
      statusEl.textContent = 'No data found.';
      return;
    }

    const items = geo.features.map((f,i)=>normalizeFeature(f,i)).filter(Boolean);
    if (!items.length){
      statusEl.textContent = 'No valid points found.';
      return;
    }

    items.forEach(addMarker);
    renderList(items);
    try { map.fitBounds(markerLayer.getBounds().pad(0.1), { maxZoom: HOME_ZOOM }); } catch(e){}

    statusEl.textContent = `${items.length} theaters`;
  })();

  // ========== Tile caching helpers (works on http/https only) ==========
  (function(){
    const sb = document.getElementById('sidebar');
    const note = document.createElement('div');
    note.style.cssText = 'font-size:12px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:8px;border-radius:8px;margin-bottom:8px;display:none;';
    note.innerHTML = '<b>Offline caching disabled:</b> open over http(s), not file://';
    sb.insertBefore(note, sb.firstChild);
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    if (!isHttp) {
      note.style.display = 'block';
      ['seedHome','seedView','clearCache'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
    }
    window._isHttp = isHttp;
  })();

  function getVisibleTileUrls(mapRef, minZoom, maxZoom){
    const urls = [];
    const b = mapRef.getBounds();
    const layers = [];
    mapRef.eachLayer(l => { if (l instanceof L.TileLayer && typeof l.getTileUrl === 'function') layers.push(l); });
    for (let z=minZoom; z<=maxZoom; z++){
      const nw = mapRef.project(b.getNorthWest(), z).divideBy(256).floor();
      const se = mapRef.project(b.getSouthEast(), z).divideBy(256).floor();
      for (let x=nw.x; x<=se.x; x++){
        for (let y=nw.y; y<=se.y; y++){
          for (const l of layers){
            let u = l.getTileUrl({x,y,z});
            if (u.indexOf('{s}') !== -1) u = u.replace('{s}','a');
            urls.push(u);
          }
        }
      }
    }
    return urls;
  }

  document.getElementById('seedView').addEventListener('click', async () => {
    if (!window._isHttp) return alert('Serve over http(s) to cache tiles.');
    const z = Math.max(0, Math.floor(map.getZoom()));
    const urls = getVisibleTileUrls(map, z, Math.min(z+2, 19));
    if (!urls.length) return alert('No tiles for this view.');
    await Promise.all(urls.map(u => fetch(u, { mode:'no-cors', cache:'reload' }).catch(()=>null)));
    alert('Requested ~' + urls.length + ' tiles for caching.');
  });

  const HOME_BBOX = { north:41.56, south:41.45, west:-81.75, east:-81.63 };
  function getUrlsForBBox(bbox, minZ, maxZ){
    const urls = [];
    const lyrs = []; map.eachLayer(l => { if (l instanceof L.TileLayer && typeof l.getTileUrl === 'function') lyrs.push(l); });
    const b = L.latLngBounds(L.latLng(bbox.north,bbox.west), L.latLng(bbox.south,bbox.east));
    for (let z=minZ; z<=maxZ; z++){
      const pNW = map.project(b.getNorthWest(), z).divideBy(256).floor();
      const pSE = map.project(b.getSouthEast(), z).divideBy(256).floor();
      for (let x=pNW.x; x<=pSE.x; x++){
        for (let y=pNW.y; y<=pSE.y; y++){
          for (const l of lyrs){
            let u = l.getTileUrl({x,y,z});
            if (u.indexOf('{s}') !== -1) u = u.replace('{s}','a');
            urls.push(u);
          }
        }
      }
    }
    return urls;
  }
  document.getElementById('seedHome').addEventListener('click', async () => {
    if (!window._isHttp) return alert('Serve over http(s) to cache tiles.');
    const urls = getUrlsForBBox(HOME_BBOX, 13, 15);
    if (!urls.length) return alert('No tiles computed for Home Area.');
    await Promise.all(urls.map(u => fetch(u, { mode:'no-cors', cache:'reload' }).catch(()=>null)));
    alert('Requested ~' + urls.length + ' Home Area tiles (z13–z15).');
  });

  document.getElementById('clearCache').addEventListener('click', async () => {
    if (!('caches' in window)) return alert('Cache API not supported.');
    const keys = await caches.keys();
    const targets = keys.filter(k => k.startsWith('cle-tiles-'));
    await Promise.all(targets.map(k => caches.delete(k)));
    alert('Tile cache cleared.');
  });

  // ========== Service worker (GitHub Pages–safe) ==========
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      var basePath = (function () {
        var p = location.pathname;
        if (p.endsWith('.html')) p = p.slice(0, p.lastIndexOf('/') + 1);
        if (!p.endsWith('/')) p += '/';
        var parts = p.split('/').filter(Boolean);
        return parts.length ? '/' + parts[0] + '/' : '/';
      })();
      var swUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? './sw-cle-tiles.js'
        : basePath + 'sw-cle-tiles.js';
      var scope = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? './' : basePath;
      navigator.serviceWorker.register(swUrl, { scope })
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.warn('ServiceWorker registration failed:', err));
    });
  }
  </script>

  <!-- Optional: you can paste your FeatureCollection here and it will be used first -->
  <script id="data" type="application/json"></script>
</body>
</html>
