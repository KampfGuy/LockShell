/* Block World: a 2D side-view block-building sandbox (original; not affiliated with any other block game).
   Generated world (grass, dirt, stone, trees, leaves, sand, water, ores), pixel textures drawn in code, a hotbar,
   Move / Dig / Build modes (drag to pan, tap or drag to dig or build, hold to dig in Build mode), a little explorer
   with left / right / jump buttons, and the world is saved on this phone. No monsters, nothing scary. */
(function () {
  'use strict';
  const { el } = LS;
  const KEY = 'lockshell.blockworld.v1';
  const WW = 160, WH = 60, T = 28;                // world size (tiles), tile size (CSS px)
  const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LEAVES: 5, SAND: 6, WATER: 7, GOLD: 8, PLANKS: 9, GLASS: 10, BRICK: 11, BEDROCK: 12, GEM: 13, TRUNK: 14 };
  const NAMES = ['Air', 'Grass', 'Dirt', 'Stone', 'Wood', 'Leaves', 'Sand', 'Water', 'Gold ore', 'Planks', 'Glass', 'Brick', 'Bedrock', 'Gem ore', 'Wood'];
  const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.WOOD, B.PLANKS, B.LEAVES, B.SAND, B.GLASS, B.BRICK, B.WATER, B.GOLD, B.GEM];
  // Trees that grow in the world (trunks and leaves) are like background: you can walk through them and jump up
  // under them, so nobody gets stuck. Wood you place yourself is solid.
  const solid = (id) => id !== B.AIR && id !== B.WATER && id !== B.LEAVES && id !== B.TRUNK;

  /* ---------- random + world generation ---------- */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function noise1(r, n, scale) { const pts = Array.from({ length: Math.ceil(n / scale) + 2 }, r); return (x) => { const i = Math.floor(x / scale), f = x / scale - i, s = f * f * (3 - 2 * f); return pts[i] + (pts[i + 1] - pts[i]) * s; }; }
  function generate(seed) {
    const r = rng(seed), tiles = new Uint8Array(WW * WH), surf = new Int16Array(WW);
    const n1 = noise1(r, WW, 18), n2 = noise1(r, WW, 6), WL = 30;
    for (let x = 0; x < WW; x++) surf[x] = Math.round(24 + (n1(x) - 0.5) * 14 + (n2(x) - 0.5) * 4);
    // always one calm lake with a sandy beach, away from the middle where the explorer starts
    const lw = 12 + Math.floor(r() * 6), lx = r() < 0.5 ? 12 + Math.floor(r() * 30) : WW - 12 - lw - Math.floor(r() * 30);
    for (let x = lx; x < lx + lw; x++) surf[x] = Math.max(surf[x], WL + 1 + Math.round(3 * Math.sin(Math.PI * (x - lx + 0.5) / lw)));
    const set = (x, y, id) => { if (x >= 0 && y >= 0 && x < WW && y < WH) tiles[y * WW + x] = id; };
    const wet = (x) => x >= 0 && x < WW && surf[x] > WL;
    for (let x = 0; x < WW; x++) {
      const h = surf[x], beach = wet(x) || wet(x - 1) || wet(x + 1) || wet(x - 2) || wet(x + 2);
      for (let y = 0; y < WH; y++) {
        let id = B.AIR;
        if (y === WH - 1) id = B.BEDROCK;
        else if (y > h + 3) { id = B.STONE; if (y > h + 6) { const q = r(); if (q < 0.022) id = B.GOLD; else if (q < 0.032 && y > h + 14) id = B.GEM; } }
        else if (y > h) id = beach ? B.SAND : B.DIRT;
        else if (y === h) id = beach ? B.SAND : B.GRASS;
        else if (y > WL && y < h) id = B.WATER;
        tiles[y * WW + x] = id;
      }
    }
    // ore veins: grow each ore a little
    for (let i = 0; i < WW * WH; i++) if ((tiles[i] === B.GOLD || tiles[i] === B.GEM) && r() < 0.6) { const j = i + (r() < 0.5 ? 1 : WW); if (tiles[j] === B.STONE) tiles[j] = tiles[i]; }
    // trees
    let lastTree = -5;
    for (let x = 3; x < WW - 3; x++) {
      if (tiles[surf[x] * WW + x] !== B.GRASS || x - lastTree < 4 || r() > 0.16) continue;
      lastTree = x; const th = 3 + Math.floor(r() * 3), top = surf[x] - th;
      for (let y = surf[x] - 1; y >= top; y--) set(x, y, B.TRUNK);
      for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { if (Math.abs(dx) + Math.abs(dy) > 3 || (dy === 1 && Math.abs(dx) === 2)) continue; const yy = top + dy, xx = x + dx; if (yy >= 0 && tiles[yy * WW + xx] === B.AIR) set(xx, yy, B.LEAVES); }
    }
    let sx = Math.floor(WW / 2); while (sx < WW - 1 && surf[sx] > WL) sx++;
    return { seed, tiles, surf, px: sx + 0.15, py: surf[sx] - 1.8 };
  }
  function encode(tiles) { let s = '', i = 0; while (i < tiles.length) { const id = tiles[i]; let n = 1; while (i + n < tiles.length && tiles[i + n] === id) n++; s += String.fromCharCode(65 + id) + n; i += n; } return s; }
  function decode(str) {
    const out = new Uint8Array(WW * WH); let i = 0; const re = /([A-Z])(\d+)/g; let m;
    while ((m = re.exec(str))) { const id = m[1].charCodeAt(0) - 65, n = +m[2]; if (id < 0 || id > 14 || i + n > out.length) return null; out.fill(id, i, i + n); i += n; }
    return i === out.length ? out : null;
  }

  /* ---------- pixel textures (16x16, drawn in code) ---------- */
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function makeTex(id) {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'), img = g.createImageData(16, 16), r = rng(id * 7919 + 13);
    const put = (x, y, col, a) => { const k = (y * 16 + x) * 4, v = hex(col); img.data[k] = v[0]; img.data[k + 1] = v[1]; img.data[k + 2] = v[2]; img.data[k + 3] = a == null ? 255 : a; };
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const DIRT = ['#8b5a2b', '#7a4e24', '#96653a', '#6f4520'], STONE = ['#8e8e8e', '#7d7d7d', '#9a9a9a', '#858585'];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      switch (id) {
        case B.GRASS: put(x, y, y < 3 + (((x * 5 + 3) % 3) === 0 ? 1 : 0) ? pick(['#5fbf3a', '#4fae2e', '#6ccb45']) : pick(DIRT)); break;
        case B.DIRT: put(x, y, pick(DIRT)); break;
        case B.STONE: put(x, y, pick(STONE)); break;
        case B.WOOD: case B.TRUNK: put(x, y, (x % 5 === 0 || (x + y * 3) % 11 === 0) ? '#5a3a1c' : pick(['#7a5230', '#6e4a2b', '#835a35'])); break;
        case B.LEAVES: put(x, y, r() < 0.12 ? '#2e6b1f' : pick(['#3f9a2c', '#48a832', '#378d27'])); break;
        case B.SAND: put(x, y, pick(['#e8d49a', '#dcc68a', '#f0dca6', '#e2cd92'])); break;
        case B.WATER: put(x, y, ((y + (x >> 2)) % 6 === 0) ? '#6fb6ff' : pick(['#2f7fe0', '#3386e8']), 190); break;
        case B.GOLD: case B.GEM: {
          const speck = ((x * 7 + y * 3) % 9 === 0 || (x * 3 + y * 5) % 13 === 0) && x % 15 && y % 15;
          put(x, y, speck ? (id === B.GOLD ? pick(['#ffd23f', '#ffbf00']) : pick(['#3de0e0', '#5cf2c9'])) : pick(STONE)); break; }
        case B.PLANKS: put(x, y, (y % 4 === 3) ? '#8a6232' : ((x === (y < 4 || (y >= 8 && y < 12) ? 5 : 12)) ? '#8a6232' : pick(['#c4944f', '#b98945', '#cf9f5a']))); break;
        case B.GLASS: { const edge = x === 0 || y === 0 || x === 15 || y === 15, glint = (x - y === 3 || x - y === 4) && x > 4 && x < 13; put(x, y, edge ? '#e6f4ff' : glint ? '#ffffff' : '#a9d8ff', edge ? 255 : glint ? 200 : 70); break; }
        case B.BRICK: { const row = y >> 2, off = row % 2 ? 4 : 0, mort = y % 4 === 3 || ((x + off) % 8 === 7); put(x, y, mort ? '#d9d2c5' : pick(['#b5452f', '#a63d29', '#c24e37'])); break; }
        case B.BEDROCK: put(x, y, pick(['#3a3a3a', '#2a2a2a', '#4a4a4a', '#555555'])); break;
      }
    }
    g.putImageData(img, 0, 0); return c;
  }
  let TEX = null;
  function textures(dpr) {
    if (TEX && TEX.dpr === dpr) return TEX;
    TEX = { dpr, big: [], wall: null };
    for (let id = 1; id <= 14; id++) {
      const src = makeTex(id), c = document.createElement('canvas'); c.width = c.height = Math.round(T * dpr);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, c.width, c.height); TEX.big[id] = c; TEX['s' + id] = src;
    }
    const w = document.createElement('canvas'); w.width = w.height = Math.round(T * dpr); const wg = w.getContext('2d'); wg.imageSmoothingEnabled = false;
    wg.drawImage(TEX.s3, 0, 0, w.width, w.height); wg.fillStyle = 'rgba(20,16,30,.55)'; wg.fillRect(0, 0, w.width, w.height); TEX.wall = w;
    return TEX;
  }

  /* ---------- the game ---------- */
  function blockworld(body, actions) {
    body.classList.add('bw-body');
    const wrap = el('div', { class: 'bw-wrap' }), cv = el('canvas', { class: 'bw-canvas', 'aria-label': 'Block World' });
    const findBtn = el('button', { class: 'bw-find', 'aria-label': 'Find me', text: '🎯' });
    wrap.append(cv, findBtn);
    const hot = el('div', { class: 'bw-hotbar', role: 'toolbar', 'aria-label': 'Blocks' });
    const modeBox = el('div', { class: 'bw-modes' });
    const pad = el('div', { class: 'bw-pad' });
    const ctrls = el('div', { class: 'bw-ctrls' }, pad, modeBox);
    body.append(wrap, hot, ctrls);
    actions.append(el('button', { class: 'pill-btn', text: 'New world', onclick: newWorld }));

    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(200, wrap.clientWidth || Math.min(window.innerWidth, 430)), H = Math.max(240, wrap.clientHeight || 420);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const tex = textures(dpr);
    const VW = W / T, VH = H / T;

    let world, tiles, surf, pl, cam, follow = true, mode = 'build', sel = B.PLANKS, dirty = true, saveT = null, raf, last = 0, t = 0;
    const parts = [];
    const keys = { l: false, r: false, j: false };

    function load() {
      try {
        const o = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (o && o.v === 1 && o.w === WW && o.h === WH) {
          const tl = decode(o.data); if (tl) {
            const gw = generate(o.seed); // surface line is used for the dark background wall
            world = { seed: o.seed, tiles: tl, surf: gw.surf }; pl = { x: +o.px || gw.px, y: +o.py || gw.py, vx: 0, vy: 0, face: 1, ground: false, walk: 0 };
            sel = HOTBAR.includes(o.sel) ? o.sel : sel; mode = ['move', 'dig', 'build'].includes(o.mode) ? o.mode : mode; return true;
          }
        }
      } catch (e) {}
      return false;
    }
    function fresh(seed) { world = generate(seed); pl = { x: world.px, y: world.py, vx: 0, vy: 0, face: 1, ground: false, walk: 0 }; }
    if (!load()) fresh((Math.random() * 1e9) | 0);
    tiles = world.tiles; surf = world.surf;
    cam = { x: pl.x - VW / 2, y: pl.y - VH * 0.55 }; clampCam();

    function save() {
      clearTimeout(saveT); saveT = null;
      try { localStorage.setItem(KEY, JSON.stringify({ v: 1, w: WW, h: WH, seed: world.seed, data: encode(tiles), px: +pl.x.toFixed(2), py: +pl.y.toFixed(2), sel, mode, t: Date.now() })); } catch (e) { LS.toast && LS.toast("Couldn't save the world (storage full)"); }
    }
    const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 800); };
    async function newWorld() {
      if (!(await LS.confirm('Start a new world?', 'This world will be replaced with a brand new one.', 'New world'))) return;
      fresh((Math.random() * 1e9) | 0); tiles = world.tiles; surf = world.surf; follow = true; cam = { x: pl.x - VW / 2, y: pl.y - VH * 0.55 }; clampCam(); save(); dirty = true; LS.toast('New world!');
    }

    const get = (x, y) => (x < 0 || x >= WW ? B.BEDROCK : y < 0 ? B.AIR : y >= WH ? B.BEDROCK : tiles[y * WW + x]);
    const setT = (x, y, id) => { if (x < 0 || y < 0 || x >= WW || y >= WH) return false; tiles[y * WW + x] = id; dirty = true; saveSoon(); return true; };
    function clampCam() { cam.x = Math.max(0, Math.min(WW - VW, cam.x)); cam.y = Math.max(-4, Math.min(WH - VH, cam.y)); }
    const overlapsPlayer = (x, y) => x + 1 > pl.x && x < pl.x + 0.7 && y + 1 > pl.y && y < pl.y + 1.7;

    function dig(x, y) {
      const id = get(x, y); if (id === B.AIR || id === B.BEDROCK || x < 0 || x >= WW || y >= WH) return false;
      setT(x, y, B.AIR); burst(x, y, id); LS.tone(id === B.WATER ? 520 : 180 + (id * 23) % 120, 0.08, { type: 'square', vol: 0.08 }); return true;
    }
    function place(x, y, id) {
      if (x < 0 || y < 0 || x >= WW || y >= WH - 1) return false;
      const cur = get(x, y); if (cur !== B.AIR && cur !== B.WATER) return false;
      if (solid(id) && overlapsPlayer(x, y)) return false;
      setT(x, y, id); LS.tone(330 + (id * 37) % 200, 0.06, { type: 'triangle', vol: 0.1 }); return true;
    }
    function burst(x, y, id) { const s = tex['s' + id]; const col = { 1: '#5fbf3a', 2: '#8b5a2b', 3: '#8e8e8e', 4: '#7a5230', 14: '#7a5230', 5: '#3f9a2c', 6: '#e8d49a', 7: '#3386e8', 8: '#ffd23f', 9: '#c4944f', 10: '#cfeaff', 11: '#b5452f', 13: '#3de0e0' }[id] || '#999'; for (let i = 0; i < 8; i++) parts.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6, life: 0.6, c: col }); void s; }

    /* ----- UI: hotbar, modes, movement pad ----- */
    function iconFor(id) { const c = el('canvas', { class: 'bw-ic' }); c.width = c.height = 32; const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false; cg.drawImage(tex['s' + id], 0, 0, 32, 32); return c; }
    function paintHot() { hot.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.id === sel)); }
    HOTBAR.forEach((id) => hot.append(el('button', { class: 'bw-slot', 'data-id': id, 'aria-label': NAMES[id], onclick: () => { sel = id; if (mode !== 'build') setMode('build'); paintHot(); saveSoon(); } }, iconFor(id), el('small', { text: NAMES[id].replace(' ore', '') }))));
    const MODES = [['move', '✋', 'Move'], ['dig', '⛏️', 'Dig'], ['build', '🧱', 'Build']];
    MODES.forEach(([k, e, l]) => modeBox.append(el('button', { class: 'bw-mode', 'data-mode': k, 'aria-label': l, onclick: () => setMode(k) }, el('span', { class: 'e', text: e }), el('small', { text: l }))));
    function setMode(k) { mode = k; modeBox.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === k)); saveSoon(); }
    function holdBtn(label, aria, key) {
      const b = el('button', { class: 'bw-move', 'aria-label': aria, text: label });
      const on = (e) => { e.preventDefault(); keys[key] = true; follow = true; b.classList.add('down'); LS.audioCtx && LS.audioCtx(); };
      const off = () => { keys[key] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, off));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    }
    pad.append(holdBtn('◀', 'Left', 'l'), holdBtn('▶', 'Right', 'r'), holdBtn('⤒', 'Jump', 'j'));
    findBtn.onclick = () => { follow = true; };
    setMode(mode); paintHot();

    /* ----- touch on the world ----- */
    const ptrs = new Map(); let pan = null, stroke = null, holdT = null;
    const local = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
    const tileAt = (p) => ({ x: Math.floor(cam.x + p.x / T), y: Math.floor(cam.y + p.y / T) });
    function act(tl) { if (mode === 'dig') return dig(tl.x, tl.y); if (mode === 'build') return place(tl.x, tl.y, sel); return false; }
    function line(a, b, f) { const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); for (let i = 1; i <= n; i++) f({ x: Math.round(a.x + (b.x - a.x) * i / n), y: Math.round(a.y + (b.y - a.y) * i / n) }); }
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      LS.audioCtx && LS.audioCtx();
      const p = local(e); ptrs.set(e.pointerId, p);
      clearTimeout(holdT); holdT = null;
      if (ptrs.size >= 2 || mode === 'move') { stroke = null; pan = { p, cam: { x: cam.x, y: cam.y }, id: e.pointerId }; follow = false; return; }
      const tl = tileAt(p); stroke = { last: tl, moved: false, start: p };
      if (mode === 'build' && solid(get(tl.x, tl.y))) {
        // hold to dig in Build mode
        holdT = setTimeout(() => { holdT = null; if (stroke && !stroke.moved) { dig(tl.x, tl.y); stroke.dug = true; if (navigator.vibrate) navigator.vibrate(20); } }, 450);
      } else act(tl);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const p = local(e); ptrs.set(e.pointerId, p);
      if (pan) { if (pan.id !== e.pointerId && ptrs.size < 2) return; const q = ptrs.get(pan.id) || p; cam.x = pan.cam.x - (q.x - pan.p.x) / T; cam.y = pan.cam.y - (q.y - pan.p.y) / T; clampCam(); dirty = true; return; }
      if (!stroke) return;
      if (Math.hypot(p.x - stroke.start.x, p.y - stroke.start.y) > 8) { stroke.moved = true; clearTimeout(holdT); holdT = null; }
      const tl = tileAt(p); if (tl.x === stroke.last.x && tl.y === stroke.last.y) return;
      line(stroke.last, tl, act); stroke.last = tl;
    });
    const end = (e) => { ptrs.delete(e.pointerId); clearTimeout(holdT); holdT = null; if (!ptrs.size) { pan = null; stroke = null; } else if (pan && pan.id === e.pointerId) { const [id, p] = [...ptrs.entries()][0]; pan = { p, cam: { x: cam.x, y: cam.y }, id }; } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    /* ----- physics ----- */
    const PW = 0.7, PH = 1.7;
    function hitAt(x, y) { const E = 0.001; for (let ty = Math.floor(y + E); ty <= Math.floor(y + PH - E); ty++) for (let tx = Math.floor(x + E); tx <= Math.floor(x + PW - E); tx++) if (solid(get(tx, ty))) return true; return false; }
    function inWater() { return get(Math.floor(pl.x + PW / 2), Math.floor(pl.y + PH * 0.6)) === B.WATER; }
    function step(dt) {
      t += dt;
      const wet = inWater(), sp = wet ? 2.6 : 4.5;
      pl.vx = (keys.r ? sp : 0) - (keys.l ? sp : 0);
      if (pl.vx) pl.face = pl.vx > 0 ? 1 : -1;
      if (keys.j) { if (wet) pl.vy = -4; else if (pl.ground) { pl.vy = -10.5; LS.tone(520, 0.08, { to: 700, vol: 0.06 }); } }
      pl.vy += (wet ? 9 : 30) * dt; pl.vy = Math.min(pl.vy, wet ? 3 : 18);
      // x
      if (pl.vx) {
        const nx = pl.x + pl.vx * dt;
        if (!hitAt(nx, pl.y)) pl.x = nx;
        else if (pl.ground && !hitAt(nx, pl.y - 1.05) && !hitAt(pl.x, pl.y - 1.05)) { pl.vy = -8.2; } // hop up one block by itself
        pl.walk += dt * 10;
      }
      pl.x = Math.max(0, Math.min(WW - PW, pl.x));
      // y
      const ny = pl.y + pl.vy * dt; pl.ground = false;
      if (!hitAt(pl.x, ny)) pl.y = ny;
      else { if (pl.vy > 0) { pl.y = Math.floor(ny + PH) - PH; pl.ground = true; } else pl.y = Math.ceil(ny); pl.vy = 0; }
      if (pl.y > WH) { pl.y = world.surf[Math.floor(pl.x)] - 2; pl.vy = 0; }
      if (follow) { const tx = pl.x - VW / 2 + PW / 2, ty = pl.y - VH * 0.55; cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 6); clampCam(); }
      parts.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 20 * dt; q.life -= dt; });
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      if (keys.l || keys.r || keys.j || Math.abs(pl.vy) > 0.01) saveSoon();
    }

    /* ----- drawing ----- */
    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#6ec6ff'); sky.addColorStop(1, '#cdeeff');
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false; g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffe066'; g.fillRect(W - 70, 26, 34, 34);
      g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 4; i++) { const cx = ((i * 157 - cam.x * 6 + t * 4) % (W + 140) + W + 140) % (W + 140) - 70, cy = 40 + i * 28 - cam.y * 2; g.fillRect(cx, cy, 64, 14); g.fillRect(cx + 14, cy - 10, 36, 12); }
      const x0 = Math.floor(cam.x), y0 = Math.floor(cam.y), x1 = Math.ceil(cam.x + VW), y1 = Math.ceil(cam.y + VH);
      const ox = -cam.x * T, oy = -cam.y * T, water = [];
      for (let y = Math.max(0, y0); y <= Math.min(WH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(WW - 1, x1); x++) {
        const id = tiles[y * WW + x], sx = Math.round(ox + x * T), sy = Math.round(oy + y * T);
        if (id === B.AIR || id === B.WATER || id === B.GLASS) { if (y > surf[x] + 1) g.drawImage(tex.wall, sx, sy, T, T); }
        if (id === B.WATER) { water.push([sx, sy]); continue; }
        if (id !== B.AIR) g.drawImage(tex.big[id], sx, sy, T, T);
      }
      drawPlayer(ox, oy);
      water.forEach(([sx, sy]) => g.drawImage(tex.big[B.WATER], sx, sy, T, T));
      parts.forEach((q) => { g.fillStyle = q.c; g.fillRect(ox + q.x * T - 2, oy + q.y * T - 2, 5, 5); });
    }
    function drawPlayer(ox, oy) {
      const px = Math.round(ox + pl.x * T), py = Math.round(oy + pl.y * T), w = PW * T, h = PH * T, u = w / 7;
      g.save(); g.translate(px + w / 2, py); g.scale(pl.face, 1); g.translate(-w / 2, 0);
      const leg = pl.vx && pl.ground ? Math.sin(pl.walk) * u * 1.2 : 0;
      g.fillStyle = '#2d5bd7'; g.fillRect(u * 1.2, h * 0.68, u * 2, h * 0.32 + leg * 0.2); g.fillRect(u * 3.8, h * 0.68, u * 2, h * 0.32 - leg * 0.2); // legs
      g.fillStyle = '#3a3a3a'; g.fillRect(u * 1.2 + leg, h - u * 0.9, u * 2.2, u * 0.9); g.fillRect(u * 3.8 - leg, h - u * 0.9, u * 2.2, u * 0.9); // shoes
      g.fillStyle = '#ff8a1f'; g.fillRect(u * 0.8, h * 0.36, u * 5.4, h * 0.34); // shirt
      g.fillStyle = '#ffb36b'; g.fillRect(u * 2.8, h * 0.36, u * 1.4, u * 0.8); // collar
      g.fillStyle = '#f1c27d'; g.fillRect(u * 0.9, h * 0.02, u * 5.2, h * 0.34); // head
      g.fillStyle = '#6b3e1f'; g.fillRect(u * 0.9, 0, u * 5.2, h * 0.09); g.fillRect(u * 0.9, 0, u * 1.2, h * 0.2); // hair
      g.fillStyle = '#fff'; g.fillRect(u * 3.6, h * 0.14, u * 1.2, u * 1.2); g.fillStyle = '#1c1c1e'; g.fillRect(u * 4.2, h * 0.15, u * 0.7, u * 0.9); // eye
      g.fillStyle = '#d9776b'; g.fillRect(u * 3.6, h * 0.27, u * 1.6, u * 0.5); // smile
      g.fillStyle = '#f1c27d'; g.fillRect(u * 5.6, h * 0.42 + (pl.vx ? -leg * 0.5 : 0), u * 1.1, h * 0.22); // arm
      g.restore();
    }
    function loop(ts) { const dt = Math.min(0.033, (ts - (last || ts)) / 1000); last = ts; if (!document.hidden) { step(dt); draw(); } raf = requestAnimationFrame(loop); }
    const onVis = () => { if (document.hidden) { keys.l = keys.r = keys.j = false; save(); } };
    document.addEventListener('visibilitychange', onVis);
    draw(); raf = requestAnimationFrame(loop);

    cv._bw = {
      W: WW, H: WH, T, get: (x, y) => get(x, y), B, NAMES, dig, place: (x, y, id) => place(x, y, id == null ? sel : id),
      player: () => ({ x: pl.x, y: pl.y, ground: pl.ground }), cam: () => ({ x: cam.x, y: cam.y }), get mode() { return mode; }, get sel() { return sel; }, get seed() { return world.seed; },
      tileAtClient: (cx, cy) => tileAt(local({ clientX: cx, clientY: cy })), clientOf: (x, y) => { const r = cv.getBoundingClientRect(); return { x: r.left + (x + 0.5 - cam.x) * T * (r.width / W), y: r.top + (y + 0.5 - cam.y) * T * (r.height / H) }; },
      save, step: (dt, n) => { for (let i = 0; i < (n || 1); i++) step(dt); draw(); }, surf: (x) => surf[x], setFollow: (v) => { follow = v; }
    };
    LS.gameCleanup(() => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); save(); body.classList.remove('bw-body'); });
  }

  LS.blockWorldCodec = { encode, decode, generate, WW, WH }; // for tests
  LS.addGame('blockworld', { name: 'Block World', emoji: '⛏️', desc: 'Dig and build blocks', bg: 'linear-gradient(135deg,#5fbf3a,#8b5a2b 70%)', run: blockworld, extra: true,
    hs: () => (localStorage.getItem(KEY) ? 'Your world is saved' : 'Build your own world') });
})();
