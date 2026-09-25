/* Photos: camera photos + saved drawings in one grid. Tap for full view, swipe (or arrows) between them.
   Deleting needs the passcode (skipped only while Developer Tools is open). Nothing ever leaves the phone. */
(function () {
  'use strict';
  const { el, icon } = LS;
  let items = [], urls = [], view = null, idx = 0, unSwipe = null, tab = 'all', body0 = null;
  function freeUrls() { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; }
  async function load() {
    let p = [], d = [];
    try { p = await LS.db.all('photos'); } catch (e) {}
    try { d = await LS.db.all('drawings'); } catch (e) {}
    freeUrls();
    items = p.map((x) => ({ store: 'photos', kind: 'Photo', x })).concat(d.map((x) => ({ store: 'drawings', kind: 'Drawing', x })))
      .filter((it) => it.x && it.x.blob).sort((a, b) => (b.x.created || 0) - (a.x.created || 0));
    items.forEach((it) => { it.url = URL.createObjectURL(it.x.blob); urls.push(it.url); });
  }
  const shown = () => items.filter((it) => tab === 'all' || (tab === 'photos' ? it.store === 'photos' : it.store === 'drawings'));

  async function grid(body) {
    closeViewer();
    body0 = body; LS.backLabel('Home'); LS.$('#appTitle').textContent = 'Photos';
    body.innerHTML = ''; body.className = 'app-body scroll photos-app';
    await load();
    if (body0 !== body || !document.body.contains(body)) return;
    const seg = el('div', { class: 'seg ph-seg' });
    [['all', 'All'], ['photos', 'Photos'], ['drawings', 'Drawings']].forEach(([k, t]) => seg.append(el('button', { class: tab === k ? 'on' : '', text: t, onclick: () => { tab = k; grid(body); } })));
    const list = shown();
    const g = el('div', { class: 'ph-grid' });
    list.forEach((it, i) => g.append(el('button', { class: 'ph-cell', 'aria-label': it.kind + ' ' + LS.fmtDate(it.x.created), onclick: () => openViewer(i) },
      el('img', { src: it.url, alt: '' }), it.store === 'drawings' ? el('span', { class: 'ph-badge', text: '🎨' }) : '')));
    body.append(el('div', { class: 'pad' }, seg,
      list.length ? g : LS.notice('🖼️', tab === 'drawings' ? 'No drawings yet' : 'No photos yet', tab === 'drawings' ? 'Save a drawing in Drawing and it shows up here.' : 'Take a picture with Camera, or save a drawing, and it shows up here.'),
      el('p', { class: 'set-foot', text: list.length ? list.length + (list.length === 1 ? ' item' : ' items') + '. Only on this phone.' : '' })));
  }

  function openViewer(i) {
    const list = shown(); if (!list.length) return;
    idx = Math.max(0, Math.min(list.length - 1, i));
    LS.backLabel('Photos');
    view = el('div', { class: 'ph-view' });
    const img = el('img', { class: 'ph-full', alt: '' });
    const cap = el('div', { class: 'ph-cap' });
    const prev = el('button', { class: 'ph-nav l', 'aria-label': 'Previous', html: icon('back'), onclick: () => step(-1) });
    const next = el('button', { class: 'ph-nav r', 'aria-label': 'Next', html: icon('fwd'), onclick: () => step(1) });
    const del = el('button', { class: 'ph-del', 'aria-label': 'Delete', html: icon('trash'), onclick: remove });
    view.append(img, prev, next, el('div', { class: 'ph-bar' }, cap, del));
    body0.append(view);
    function draw() { const l = shown(), it = l[idx]; if (!it) return closeViewer(); img.src = it.url; cap.textContent = it.kind + ' · ' + LS.fmtDate(it.x.created) + ' · ' + (idx + 1) + ' of ' + l.length; prev.hidden = idx === 0; next.hidden = idx === l.length - 1; }
    function step(d) { const l = shown(); const n = idx + d; if (n < 0 || n >= l.length) return; idx = n; draw(); }
    async function remove() {
      const it = shown()[idx]; if (!it) return;
      if (!(await LS.requirePin('Passcode needed to delete'))) return;
      try { await LS.db.del(it.store, it.x.id); LS.toast(it.kind + ' deleted'); } catch (e) { LS.toast('Could not delete'); return; }
      const keep = idx; await grid(body0); if (shown().length) openViewer(Math.min(keep, shown().length - 1));
    }
    unSwipe = LS.onSwipe(view, (dir) => { if (dir === 'left') step(1); else if (dir === 'right') step(-1); else if (dir === 'down') closeViewer(); });
    view._draw = draw; draw();
  }
  function closeViewer() { if (unSwipe) { unSwipe(); unSwipe = null; } if (view) { view.remove(); view = null; } LS.backLabel('Home'); }

  LS.register('photos', {
    title: 'Photos', icon: 'photos', color: 'linear-gradient(135deg,#ff9500,#ff2d55 55%,#af52de)', extra: true,
    open(body) { tab = 'all'; grid(body); },
    back() { if (view) { closeViewer(); return true; } return false; },
    close() { closeViewer(); freeUrls(); items = []; body0 = null; }
  });
})();
