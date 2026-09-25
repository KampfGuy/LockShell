/* Moon Rocket: drag the Saturn V (sprite rendered from the user's own Blender model, img/saturn-v.png) up through the
   sky, the high atmosphere and space to the Moon. Dodge planes, birds, weather balloons and asteroids. Gentle crashes,
   checkpoints, best distance, sounds that follow Settings > Game Sounds, and it pauses whenever ShellOS is hidden. */
(function () {
  'use strict';
  const { el } = LS;
  const scoreBox = (label, val) => { const b = el('b', { text: val }); return [el('div', { class: 'score' }, el('small', { text: label }), b), b]; };
  const MOON_KM = 384400;
  const TOTAL = 10000;                         // scroll distance (px) from the pad to the Moon
  const STAGES = [                             // progress where each part of the trip starts
    { p: 0, name: 'Lift-off!' }, { p: 0.3, name: 'High in the sky' }, { p: 0.5, name: 'Space!' }, { p: 0.78, name: 'Almost there' }
  ];
  // Saturn V separations: after S-IC / S-II drop away only the top part of the sprite is drawn (fractions from the model:
  // S-IC top at 46.2 m and S-II top at 72.3 m of 120.9 m).
  const KEEP = [1, 0.618, 0.402];
  const SEP_AT = [0.3, 0.5];
  const sprite = new Image(); sprite.src = 'img/saturn-v.png';
  const fmtKm = (km) => Math.round(km).toLocaleString('en-US') + ' km';
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  const mix = (c1, c2, t) => { const a = c1.match(/\w\w/g).map((h) => parseInt(h, 16)), b = c2.match(/\w\w/g).map((h) => parseInt(h, 16)); return 'rgb(' + a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',') + ')'; };

  function moonrocket(body, actions) {
    const W = Math.min(window.innerWidth - 24, 380), H = Math.max(420, Math.min(window.innerHeight - 210, 600));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cv = el('canvas', { class: 'board2 mr-canvas', 'aria-label': 'Moon Rocket game' });
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const [ab, av] = scoreBox('Altitude', '0 km'), [bb, bv] = scoreBox('Best', bestText());
    const msg = el('div', { class: 'game-msg', text: 'Drag the rocket with your finger to fly to the Moon!' });
    body.append(el('div', { class: 'game-area' }, el('div', { class: 'score-row' }, ab, bb), cv, msg));
    actions.append(el('button', { class: 'pill-btn', text: 'Restart', onclick: () => reset(0) }));

    const RH = Math.round(Math.max(120, Math.min(170, H * 0.3)));   // full rocket height on screen
    const RW = RH * 56 / 480;                                          // true proportions of the rendered model
    let st, raf, last = 0, t = 0;
    const rnd = Math.random;

    function bestText() { const b = LS.gameBest('moonrocket'); return b >= MOON_KM ? 'Moon! 🌕' : b ? fmtKm(b) : '—'; }
    function keep(p) { return p >= SEP_AT[1] ? KEEP[2] : p >= SEP_AT[0] ? KEEP[1] : KEEP[0]; }
    function reset(fromP) {
      const p0 = fromP || 0;
      st = { state: 'ready', dist: p0 * TOTAL, from: p0, obs: [], parts: [], puffs: [], nextSpawn: p0 * TOTAL + 260, x: W / 2, y: H - 46 - RH * keep(p0), tx: null, ty: null, drag: false, paused: false, sepDone: SEP_AT.map((s) => p0 >= s), stageShown: STAGES.filter((s) => s.p <= p0).length, crashWhat: '', winT: 0, arriveT: 0 };
      if (p0 > 0) st.y = H * 0.55;
      msg.textContent = p0 > 0 ? 'Checkpoint! Drag the rocket to keep going.' : 'Drag the rocket with your finger to fly to the Moon!';
      av.textContent = fmtKm(p0 * MOON_KM); bv.textContent = bestText();
    }
    const prog = () => Math.min(1, st.dist / TOTAL);
    const rh = () => RH * keep(prog());

    /* ----- input: the rocket follows the finger (horizontal) with some up/down freedom ----- */
    function pos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
    function aim(p) { st.tx = p.x; st.ty = p.y - 26 - rh(); } // keep the finger just below the engines
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      LS.audioCtx && LS.audioCtx();
      if (st.paused) { st.paused = false; msg.textContent = ''; }
      if (st.state === 'crash') { if (Date.now() - st.crashAt > 600) retry(); return; }
      if (st.state === 'win') { if (Date.now() - st.winAt > 1200) reset(0); return; }
      st.drag = true; aim(pos(e));
      if (st.state === 'ready') launch();
    });
    cv.addEventListener('pointermove', (e) => { if (st.drag) aim(pos(e)); });
    const up = () => { st.drag = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const onVis = () => { if (document.hidden && st.state === 'play') { st.paused = true; st.drag = false; msg.textContent = 'Paused. Tap the game to keep flying.'; } };
    document.addEventListener('visibilitychange', onVis);

    function launch() {
      st.state = 'play'; msg.textContent = '';
      LS.tone(90, 1.2, { type: 'sawtooth', to: 260, vol: 0.18 }); LS.tone(60, 1.4, { type: 'triangle', to: 120, vol: 0.2 });
    }
    function retry() { reset(Math.max(...STAGES.map((s) => s.p).filter((p) => p * TOTAL <= st.dist + 1e-6))); }

    /* ----- obstacles ----- */
    function spawn(type, x, y, extra) {
      const o = Object.assign({ type, x, y, a: 0, t: rnd() * 6 }, extra || {});
      if (type === 'plane') { o.dir = o.dir || (x < W / 2 ? 1 : -1); o.vx = o.vx != null ? o.vx : o.dir * (60 + rnd() * 50); o.r = 13; }
      if (type === 'bird') { o.dir = o.dir || (x < W / 2 ? 1 : -1); o.vx = o.vx != null ? o.vx : o.dir * (35 + rnd() * 35); o.r = 9; }
      if (type === 'balloon') { o.vx = (rnd() - 0.5) * 20; o.r = 14; }
      if (type === 'asteroid') { o.r = o.r || 13 + rnd() * 15; o.vx = o.vx != null ? o.vx : (rnd() - 0.5) * 40; o.vy = o.vy != null ? o.vy : rnd() * 30; o.spin = (rnd() - 0.5) * 2; o.pts = Array.from({ length: 9 }, () => 0.75 + rnd() * 0.3); }
      st.obs.push(o); return o;
    }
    function spawnWave(p) {
      if (p < 0.3) {
        if (rnd() < (p < 0.18 ? 0.55 : 0.25)) { const dir = rnd() < 0.5 ? 1 : -1; spawn('bird', dir > 0 ? -20 : W + 20, -10 - rnd() * 60, { dir }); }
        else { const dir = rnd() < 0.5 ? 1 : -1; spawn('plane', dir > 0 ? -40 : W + 40, -20 - rnd() * 80, { dir }); }
      } else if (p < 0.48) {
        if (rnd() < 0.5) spawn('balloon', 30 + rnd() * (W - 60), -30);
        else { const dir = rnd() < 0.5 ? 1 : -1; spawn('plane', dir > 0 ? -40 : W + 40, -20 - rnd() * 60, { dir, vx: dir * (90 + rnd() * 40) }); }
      } else if (p < 0.96) {
        const x1 = 20 + rnd() * (W - 40); spawn('asteroid', x1, -40);
        if (p > 0.68 && rnd() < 0.35) { let x2 = 20 + rnd() * (W - 40); if (Math.abs(x2 - x1) < RW + 110) x2 = x1 > W / 2 ? x1 - RW - 120 : x1 + RW + 120; if (x2 > 10 && x2 < W - 10) spawn('asteroid', x2, -90); }
      }
    }
    const gapFor = (p) => (p < 0.3 ? lerp(300, 210, p / 0.3) : p < 0.48 ? 260 : lerp(230, 140, (p - 0.48) / 0.48));
    const speedFor = (p) => 115 + 75 * p;   // px per second; ramps up gently

    function hitCircles() {
      const h = rh(), n = Math.max(3, Math.round(h / (RW * 1.1))), out = [];
      for (let i = 0; i < n; i++) { const yy = st.y + h * (0.12 + 0.8 * i / (n - 1)); out.push({ x: st.x, y: yy, r: RW * (i === n - 1 && keep(prog()) === 1 ? 0.45 : 0.36) }); }
      return out;
    }
    function obsCircles(o) {
      if (o.type === 'plane') return [{ x: o.x, y: o.y, r: 11 }, { x: o.x - 18 * o.dir, y: o.y, r: 7 }, { x: o.x + 16 * o.dir, y: o.y, r: 7 }];
      if (o.type === 'asteroid') return [{ x: o.x, y: o.y, r: o.r * 0.8 }];
      if (o.type === 'balloon') return [{ x: o.x, y: o.y - 6, r: 12 }];
      return [{ x: o.x, y: o.y, r: o.r * 0.8 }];
    }
    function collides(o) { const rc = hitCircles(), oc = obsCircles(o); return rc.some((a) => oc.some((b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + b.r) ** 2)); }

    function crash(o) {
      st.state = 'crash'; st.crashAt = Date.now(); st.drag = false;
      st.crashWhat = { plane: 'an airplane', bird: 'a bird', balloon: 'a weather balloon', asteroid: 'an asteroid' }[o.type] || 'something';
      for (let i = 0; i < 18; i++) st.puffs.push({ x: st.x + (rnd() - 0.5) * RW, y: st.y + rh() * (0.2 + rnd() * 0.6), vx: (rnd() - 0.5) * 120, vy: (rnd() - 0.5) * 120, r: 6 + rnd() * 10, life: 1 });
      const km = Math.round(prog() * MOON_KM); LS.gameBest('moonrocket', km); bv.textContent = bestText();
      msg.textContent = 'Bonk! You bumped into ' + st.crashWhat + '. Tap the game to try again from the last checkpoint.';
      LS.tone(320, 0.35, { type: 'triangle', to: 90, vol: 0.3 });
      if (navigator.vibrate) navigator.vibrate(80);
    }
    function win() {
      st.state = 'win'; st.winAt = Date.now(); st.drag = false; st.banner = null;
      LS.gameBest('moonrocket', MOON_KM); bv.textContent = bestText(); av.textContent = fmtKm(MOON_KM);
      localStorage.setItem('lockshell.moonrocket.wins', String((+localStorage.getItem('lockshell.moonrocket.wins') || 0) + 1));
      msg.textContent = '🎉 You made it to the Moon! Tap the game to fly again.';
      [523, 659, 784, 1047].forEach((f, i) => LS.tone(f, 0.25, { type: 'square', vol: 0.12, delay: i * 0.13 }));
      for (let i = 0; i < 80; i++) st.parts.push({ x: W / 2, y: H * 0.45, vx: (rnd() - 0.5) * 360, vy: -rnd() * 320 - 60, c: ['#ff3b30', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff9500'][i % 6], life: 2 + rnd(), s: 4 + rnd() * 4 });
    }

    /* ----- simulation ----- */
    function step(dt) {
      t += dt;
      st.puffs.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * 0.9; q.r += dt * 10; }); st.puffs = st.puffs.filter((q) => q.life > 0);
      st.parts.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 260 * dt; q.life -= dt; }); st.parts = st.parts.filter((q) => q.life > 0);
      if (st.paused || st.state === 'ready' || st.state === 'crash') return;
      if (st.state === 'win') { st.winT += dt; if (st.parts.length < 30 && st.winT < 6) st.parts.push({ x: rnd() * W, y: -10, vx: (rnd() - 0.5) * 60, vy: 40 + rnd() * 60, c: ['#ffcc00', '#ffffff', '#ff9500'][(rnd() * 3) | 0], life: 3, s: 3 + rnd() * 3 }); return; }
      const p = prog();
      if (st.banner) { st.banner.t -= dt; if (st.banner.t <= 0) st.banner = null; }
      if (st.state === 'arrive') {
        // hands-off: fly up to the Moon's surface
        // fly straight up until the nose touches the bottom of the Moon, then win (never floats below it)
        st.arriveT += dt; st.x += (W / 2 - st.x) * Math.min(1, dt * 4);
        const target = moonBottom() - 3, sp = Math.max(60, Math.abs(target - st.y) * 2.5);
        st.y = target < st.y ? Math.max(target, st.y - sp * dt) : Math.min(target, st.y + sp * dt);
        if ((Math.abs(st.y - target) < 0.5 && Math.abs(st.x - W / 2) < 2) || st.arriveT > 4) { st.x = W / 2; st.y = target; win(); }
        return;
      }
      const v = speedFor(p);
      st.dist += v * dt;
      // follow the finger
      if (st.tx != null) {
        st.x += (Math.max(RW, Math.min(W - RW, st.tx)) - st.x) * Math.min(1, dt * 14);
        const ty = Math.max(H * 0.06, Math.min(H - rh() - 30, st.ty));
        st.y += (ty - st.y) * Math.min(1, dt * 7);
      } else if (st.y > H * 0.55) st.y -= 40 * dt; // just after lift-off, climb to the middle on its own
      const np = prog();
      av.textContent = fmtKm(np * MOON_KM);
      // stage separations (the dropped stage falls away)
      SEP_AT.forEach((s, i) => { if (!st.sepDone[i] && np >= s) { st.sepDone[i] = true; st.drop = { x: st.x, y: st.y + RH * KEEP[i + 1], keepFrom: KEEP[i + 1], keepTo: KEEP[i], vy: 30, a: 0 }; LS.tone(180, 0.2, { type: 'square', to: 90, vol: 0.15 }); } });
      if (st.drop) { st.drop.vy += 160 * dt; st.drop.y += st.drop.vy * dt; st.drop.a += dt * 0.8; if (st.drop.y > H + 200) st.drop = null; }
      // stage banners (and checkpoints)
      while (st.stageShown < STAGES.length && np >= STAGES[st.stageShown].p) { st.banner = { text: STAGES[st.stageShown].name, t: 2.2 }; if (st.stageShown > 0) LS.tone(880, 0.15, { vol: 0.12 }); st.stageShown++; }
      // spawn + move obstacles
      if (st.dist >= st.nextSpawn) { spawnWave(np); st.nextSpawn = st.dist + gapFor(np) * (0.8 + rnd() * 0.4); }
      st.obs.forEach((o) => {
        o.t += dt;
        if (o.type === 'plane') { o.x += o.vx * dt; o.y += v * 0.55 * dt; }
        else if (o.type === 'bird') { o.x += o.vx * dt; o.y += v * 0.6 * dt + Math.sin(o.t * 3) * 12 * dt; }
        else if (o.type === 'balloon') { o.x += o.vx * dt; o.y += v * 0.7 * dt; }
        else { o.x += o.vx * dt; o.y += (v * 0.8 + o.vy) * dt; o.a += o.spin * dt; }
      });
      st.obs = st.obs.filter((o) => o.y < H + 80 && o.x > -90 && o.x < W + 90);
      for (const o of st.obs) if (collides(o)) return crash(o);
      if (np >= 1) { st.state = 'arrive'; st.obs = []; st.tx = null; msg.textContent = 'Here comes the Moon…'; }
    }

    /* ----- drawing ----- */
    function moonBottom() { const m = moonGeom(1); return m.cy + m.r; }
    function moonGeom(p) { const r = W * 0.8, k = Math.max(0, (p - 0.8) / 0.2); return { r, cx: W / 2, cy: lerp(-r - 20, -r * 0.45, k) }; }
    function drawBg(p) {
      const top = p < 0.3 ? mix('4aa8ff', '2b5cb8', p / 0.3) : p < 0.5 ? mix('2b5cb8', '070b1f', (p - 0.3) / 0.2) : '#050716';
      const bot = p < 0.3 ? mix('bfe6ff', '7fb0ff', p / 0.3) : p < 0.5 ? mix('7fb0ff', '0b1233', (p - 0.3) / 0.2) : '#0a0f2a';
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // stars fade in
      const sa = Math.max(0, Math.min(1, (p - 0.28) / 0.2));
      if (sa > 0) { g.fillStyle = 'rgba(255,255,255,' + sa + ')'; for (let i = 0; i < 70; i++) { const sx = (i * 97.3) % W, sy = ((i * 53.7 + st.dist * 0.05) % (H + 10)); g.fillRect(sx, sy, i % 7 === 0 ? 2 : 1.2, i % 7 === 0 ? 2 : 1.2); } }
      // clouds low down
      if (p < 0.4) { const ca = 1 - p / 0.4; g.fillStyle = 'rgba(255,255,255,' + 0.85 * ca + ')'; for (let i = 0; i < 6; i++) { const cy = ((i * 170 + st.dist * 0.5) % (H + 160)) - 80, cx = (i * 131 + 40) % (W + 60) - 30; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.arc(cx + 24, cy - 9, 25, 0, 7); g.arc(cx + 50, cy, 18, 0, 7); g.fill(); } }
      // Earth below once in space
      if (p > 0.42) { const k = Math.min(1, (p - 0.42) / 0.5), r = lerp(W * 1.4, W * 0.35, k), cy = H + r * lerp(0.55, 0.3, k);
        const eg = g.createRadialGradient(W / 2 - r * 0.3, cy - r * 0.4, r * 0.1, W / 2, cy, r); eg.addColorStop(0, '#6ec3ff'); eg.addColorStop(1, '#1d4fa3');
        g.fillStyle = eg; g.beginPath(); g.arc(W / 2, cy, r, 0, 7); g.fill();
        g.fillStyle = 'rgba(80,180,90,.8)'; g.beginPath(); g.ellipse(W / 2 - r * 0.25, cy - r * 0.7, r * 0.22, r * 0.1, 0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(W / 2 + r * 0.3, cy - r * 0.8, r * 0.15, r * 0.08, -0.4, 0, 7); g.fill();
        g.strokeStyle = 'rgba(140,200,255,.5)'; g.lineWidth = 4; g.beginPath(); g.arc(W / 2, cy, r + 3, 0, 7); g.stroke(); }
      // the Moon at the end
      if (p > 0.8) { const m = moonGeom(p); const mg = g.createRadialGradient(m.cx - m.r * 0.3, m.cy + m.r * 0.5, m.r * 0.1, m.cx, m.cy, m.r); mg.addColorStop(0, '#f4f4ef'); mg.addColorStop(1, '#a9a9a2');
        g.fillStyle = mg; g.beginPath(); g.arc(m.cx, m.cy, m.r, 0, 7); g.fill();
        g.fillStyle = 'rgba(120,120,112,.45)'; [[-0.3, 0.8, 0.09], [0.25, 0.85, 0.06], [0.05, 0.93, 0.05], [-0.55, 0.7, 0.05], [0.5, 0.72, 0.07]].forEach(([dx, dy, rr]) => { g.beginPath(); g.arc(m.cx + dx * m.r, m.cy + dy * m.r, rr * m.r, 0, 7); g.fill(); }); }
      // launch pad + tower at the start
      const gy = H - 40 + (st.dist - 0);
      if (gy < H + 10) {
        g.fillStyle = '#5fb760'; g.fillRect(0, gy, W, H); g.fillStyle = '#8d8d8d'; g.fillRect(W / 2 - 60, gy - 6, 120, 8);
        const tx = W / 2 + RW / 2 + 18; g.strokeStyle = '#c0392b'; g.lineWidth = 2; g.strokeRect(tx, gy - RH * 1.05, 14, RH * 1.05);
        for (let yy = gy - RH * 1.05; yy < gy; yy += 12) { g.beginPath(); g.moveTo(tx, yy); g.lineTo(tx + 14, yy + 12); g.stroke(); }
      }
    }
    function drawRocket() {
      const k = keep(prog()), h = RH * k, x = st.x - RW / 2, y = st.y;
      // flame
      if (st.state === 'play' || st.state === 'arrive' || (st.state === 'ready' && st.drag)) {
        const fl = (st.state === 'ready' ? 10 : 26) + Math.sin(t * 40) * 5 + rnd() * 6, fw = RW * (k === 1 ? 0.8 : 0.45);
        const fg = g.createLinearGradient(0, y + h, 0, y + h + fl); fg.addColorStop(0, 'rgba(255,255,220,.95)'); fg.addColorStop(0.35, 'rgba(255,190,40,.9)'); fg.addColorStop(1, 'rgba(255,80,0,0)');
        g.fillStyle = fg; g.beginPath(); g.moveTo(st.x - fw / 2, y + h - 2); g.quadraticCurveTo(st.x, y + h + fl * 1.2, st.x + fw / 2, y + h - 2); g.fill();
      }
      if (sprite.complete && sprite.naturalWidth) g.drawImage(sprite, 0, 0, sprite.naturalWidth, sprite.naturalHeight * k, x, y, RW, h);
      else { g.fillStyle = '#fff'; g.fillRect(x + RW * 0.2, y, RW * 0.6, h); }
      if (st.drop) { const d = st.drop, sh = sprite.naturalHeight; g.save(); g.translate(d.x, d.y); g.rotate(d.a); if (sprite.complete && sh) g.drawImage(sprite, 0, sh * d.keepFrom, sprite.naturalWidth, sh * (d.keepTo - d.keepFrom), -RW / 2, 0, RW, RH * (d.keepTo - d.keepFrom)); g.restore(); }
    }
    function drawObs(o) {
      g.save(); g.translate(o.x, o.y);
      if (o.type === 'plane') {
        g.scale(o.dir, 1);
        g.fillStyle = '#f5f7fa'; g.beginPath(); g.ellipse(0, 0, 26, 7, 0, 0, 7); g.fill();
        g.fillStyle = '#2f80ed'; g.fillRect(-20, -1.5, 40, 3);
        g.fillStyle = '#dfe6ee'; g.beginPath(); g.moveTo(-4, 0); g.lineTo(-12, 16); g.lineTo(-2, 16); g.lineTo(8, 0); g.fill(); g.beginPath(); g.moveTo(-4, 0); g.lineTo(-10, -12); g.lineTo(-3, -12); g.lineTo(6, 0); g.fill();
        g.fillStyle = '#e74c3c'; g.beginPath(); g.moveTo(-20, -2); g.lineTo(-27, -14); g.lineTo(-21, -14); g.lineTo(-14, -3); g.fill();
        g.fillStyle = '#34495e'; for (let i = -12; i < 18; i += 5) { g.beginPath(); g.arc(i, -2.5, 1.2, 0, 7); g.fill(); }
        g.beginPath(); g.ellipse(22, -1.5, 3.5, 2.5, 0, 0, 7); g.fill();
      } else if (o.type === 'bird') {
        g.scale(o.dir, 1); const f = Math.sin(o.t * 12) * 7;
        g.strokeStyle = '#3a3a3c'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-11, -f); g.quadraticCurveTo(-5, -2, 0, 1); g.quadraticCurveTo(5, -2, 11, -f); g.stroke();
        g.fillStyle = '#3a3a3c'; g.beginPath(); g.ellipse(0, 2, 4, 2.5, 0, 0, 7); g.fill(); g.fillStyle = '#ff9500'; g.fillRect(3.5, 1, 3, 1.6);
      } else if (o.type === 'balloon') {
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 22); g.stroke();
        g.fillStyle = '#ff6b6b'; g.beginPath(); g.ellipse(0, -6, 12, 15, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-4, -11, 3, 5, -0.3, 0, 7); g.fill();
        g.fillStyle = '#ddd'; g.fillRect(-3, 21, 6, 5);
      } else {
        g.rotate(o.a); g.fillStyle = '#8a7f76'; g.beginPath();
        o.pts.forEach((k, i) => { const an = (i / o.pts.length) * Math.PI * 2; const px = Math.cos(an) * o.r * k, py = Math.sin(an) * o.r * k; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill();
        g.fillStyle = '#6d635b'; g.beginPath(); g.arc(-o.r * 0.25, -o.r * 0.2, o.r * 0.22, 0, 7); g.fill(); g.beginPath(); g.arc(o.r * 0.3, o.r * 0.25, o.r * 0.15, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(-o.r * 0.35, -o.r * 0.45, o.r * 0.18, 0, 7); g.fill();
      }
      g.restore();
    }
    function drawHud(p) {
      // progress bar: Earth at the bottom, Moon at the top
      const bx = W - 18, by0 = 34, by1 = H - 34;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.roundRect ? g.roundRect(bx - 5, by0, 10, by1 - by0, 5) : g.rect(bx - 5, by0, 10, by1 - by0); g.fill();
      g.fillStyle = '#ffd60a'; const fy = by1 - (by1 - by0) * p; g.fillRect(bx - 3, fy, 6, by1 - fy);
      g.font = '16px system-ui'; g.textAlign = 'center'; g.fillText('🌕', bx, by0 - 6); g.fillText('🌍', bx, by1 + 20);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, fy, 5, 0, 7); g.fill();
      g.textAlign = 'left'; g.font = '700 14px -apple-system,system-ui,sans-serif'; g.fillStyle = p > 0.35 ? '#fff' : 'rgba(0,0,0,.65)';
      g.fillText(fmtKm(p * MOON_KM), 10, 22);
      if (st.banner) { g.globalAlpha = Math.min(1, st.banner.t); g.textAlign = 'center'; g.font = '800 24px -apple-system,system-ui,sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.strokeText(st.banner.text, W / 2, H * 0.3); g.fillText(st.banner.text, W / 2, H * 0.3); g.globalAlpha = 1; }
    }
    function centerText(big, small, y) {
      g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.45)'; const bw = W - 60; g.beginPath(); g.roundRect ? g.roundRect(30, y - 38, bw, small ? 74 : 54, 16) : g.rect(30, y - 38, bw, small ? 74 : 54); g.fill();
      g.fillStyle = '#fff'; g.font = '800 24px -apple-system,system-ui,sans-serif'; g.fillText(big, W / 2, y);
      if (small) { g.font = '600 14px -apple-system,system-ui,sans-serif'; g.fillText(small, W / 2, y + 24); }
    }
    function draw() {
      const p = prog();
      drawBg(p);
      st.obs.forEach(drawObs);
      if (st.state !== 'crash') drawRocket();
      st.puffs.forEach((q) => { g.fillStyle = 'rgba(255,' + (180 + ((q.r * 7) % 60)) + ',120,' + Math.max(0, q.life * 0.8) + ')'; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill(); });
      st.parts.forEach((q) => { g.fillStyle = q.c; g.globalAlpha = Math.max(0, Math.min(1, q.life)); g.fillRect(q.x, q.y, q.s, q.s * 0.6); g.globalAlpha = 1; });
      drawHud(p);
      if (st.state === 'ready') centerText('Moon Rocket', 'Drag the rocket to launch!', H * 0.22);
      if (st.state === 'crash') centerText('Bonk!', 'Tap to try again', H * 0.4);
      if (st.state === 'win') centerText('You made it! 🌕', 'You reached the Moon! Tap to fly again.', H * 0.62);
      if (st.paused) centerText('Paused', 'Tap to keep flying', H * 0.45);
    }
    function loop(ts) { const dt = Math.min(0.033, (ts - (last || ts)) / 1000); last = ts; if (!document.hidden) { step(dt); draw(); } raf = requestAnimationFrame(loop); }

    reset(0); draw(); raf = requestAnimationFrame(loop);
    sprite.onload = () => draw();
    // test hooks (Playwright): read state, spawn things, jump ahead
    cv._game = {
      get state() { return st.state; }, get dist() { return st.dist; }, get paused() { return st.paused; }, get banner() { return st.banner ? st.banner.text : null; }, TOTAL, MOON_KM,
      rocket: () => ({ x: st.x, y: st.y, h: rh(), w: RW, keep: keep(prog()) }), obs: () => st.obs.map((o) => ({ type: o.type, x: o.x, y: o.y })),
      spawn: (type, x, y, extra) => { spawn(type, x, y, Object.assign({ vx: 0, vy: 0 }, extra || {})); }, clear: () => { st.obs = []; st.nextSpawn = Infinity; },
      setDist: (d) => { st.dist = d; st.nextSpawn = d + 99999; }, step: (dt) => step(dt), draw, collides: () => st.obs.some(collides), moonBottom, noSpawn: () => { st.nextSpawn = Infinity; }
    };
    LS.gameCleanup(() => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); });
  }

  LS.addGame('moonrocket', { name: 'Moon Rocket', emoji: '🚀', desc: 'Fly to the Moon', bg: 'linear-gradient(135deg,#0b1a4a,#3a5bd9 60%,#8fb8ff)', run: moonrocket, extra: true,
    hs: () => { const b = LS.gameBest('moonrocket'); return b >= MOON_KM ? 'Best: reached the Moon! 🌕' : b ? 'Best: ' + fmtKm(b) : 'No flights yet'; } });
})();
