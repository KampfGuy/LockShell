/* Extra games (added from Developer Tools): Breakout, Minesweeper, Connect Four, Sky Hop */
(function () {
  'use strict';
  const { el } = LS;
  const scoreBox = (label, val) => { const b = el('b', { text: val }); return [el('div', { class: 'score' }, el('small', { text: label }), b), b]; };
  const dprCanvas = (w, h) => {
    const cv = el('canvas', { class: 'board2' }), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d'); g.scale(dpr, dpr); return [cv, g];
  };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ======================= BREAKOUT ======================= */
  function breakout(body, actions) {
    const W = Math.min(window.innerWidth - 24, 380), H = Math.max(360, Math.min(window.innerHeight - 250, Math.round(W * 1.45)));
    const [cv, g] = dprCanvas(W, H);
    const [sb, sv] = scoreBox('Score', 0), [lb, lv] = scoreBox('Lives', 3), [bb, bv] = scoreBox('Best', LS.gameBest('breakout'));
    const msg = el('div', { class: 'game-msg', text: 'Drag to move the paddle. Tap to launch.' });
    body.append(el('div', { class: 'game-area' }, el('div', { class: 'score-row' }, sb, lb, bb), cv, msg));
    actions.append(el('button', { class: 'pill-btn', text: 'Restart', onclick: () => reset(true) }));
    const COLS = 7, ROWS = 6, GAP = 5, PADX = 10, TOP = 44, BH = 16;
    const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'];
    const bw = (W - PADX * 2 - GAP * (COLS - 1)) / COLS;
    let bricks, pad, ball, score, lives, level, stuck, raf, last, over;
    function makeBricks() { bricks = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bricks.push({ x: PADX + c * (bw + GAP), y: TOP + r * (BH + GAP), c: COLORS[r], alive: true, pts: (ROWS - r) }); }
    function resetBall() { stuck = true; ball = { x: pad.x, y: pad.y - 10, r: 7, vx: 0, vy: 0 }; }
    function reset(full) {
      if (full) { score = 0; lives = 3; level = 1; over = false; makeBricks(); msg.textContent = 'Drag to move the paddle. Tap to launch.'; }
      pad = { x: W / 2, y: H - 26, w: Math.max(56, 84 - (level - 1) * 6), h: 12 };
      resetBall(); sv.textContent = score; lv.textContent = lives;
    }
    function launch() {
      if (over) { reset(true); return; }
      if (!stuck) return;
      const sp = 300 + level * 40, a = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
      ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp; stuck = false; msg.textContent = '';
    }
    const px = (e) => e.clientX - cv.getBoundingClientRect().left;
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, px(e))); launch(); });
    cv.addEventListener('pointermove', (e) => { pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, px(e))); });
    function step(dt) {
      if (stuck) { ball.x = pad.x; ball.y = pad.y - pad.h / 2 - ball.r - 1; return; }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && ball.y + ball.r >= pad.y - pad.h / 2 && ball.y < pad.y + pad.h && Math.abs(ball.x - pad.x) <= pad.w / 2 + ball.r) {
        const hit = (ball.x - pad.x) / (pad.w / 2), sp = Math.hypot(ball.vx, ball.vy) * 1.01, a = -Math.PI / 2 + hit * 1.05;
        ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp; ball.y = pad.y - pad.h / 2 - ball.r;
      }
      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + bw && ball.y + ball.r > b.y && ball.y - ball.r < b.y + BH) {
          b.alive = false; score += b.pts * 10; sv.textContent = score;
          const ox = Math.min(ball.x + ball.r - b.x, b.x + bw - (ball.x - ball.r)), oy = Math.min(ball.y + ball.r - b.y, b.y + BH - (ball.y - ball.r));
          if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
          if (navigator.vibrate) navigator.vibrate(8);
          break;
        }
      }
      if (bricks.every((b) => !b.alive)) { level++; makeBricks(); reset(false); msg.textContent = 'Level ' + level + '! Tap to launch.'; }
      if (ball.y > H + 20) {
        lives--; lv.textContent = lives;
        if (lives <= 0) { over = true; stuck = true; bv.textContent = LS.gameBest('breakout', score); msg.textContent = 'Game over! Tap the board to play again.'; }
        else { resetBall(); msg.textContent = 'Tap to launch.'; }
      }
    }
    function draw() {
      g.fillStyle = '#f5f7fb'; g.fillRect(0, 0, W, H);
      bricks.forEach((b) => { if (!b.alive) return; g.fillStyle = b.c; rr(g, b.x, b.y, bw, BH, 5); g.fill(); });
      g.fillStyle = '#1c1c1e'; rr(g, pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h, 6); g.fill();
      g.fillStyle = '#007aff'; g.beginPath(); g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); g.fill();
      if (over) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, 0, W, H); g.fillStyle = '#1c1c1e'; g.font = '700 26px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('Game over', W / 2, H / 2); }
    }
    function loop(t) {
      const dt = Math.min(0.033, (t - (last || t)) / 1000); last = t;
      for (let i = 0; i < 3; i++) step(dt / 3);
      draw(); raf = requestAnimationFrame(loop);
    }
    reset(true); raf = requestAnimationFrame(loop);
    LS.gameCleanup(() => cancelAnimationFrame(raf));
  }

  /* ======================= MINESWEEPER ======================= */
  const MS = { easy: { c: 8, r: 10, m: 10, n: 'Easy' }, medium: { c: 10, r: 13, m: 20, n: 'Medium' }, hard: { c: 12, r: 16, m: 36, n: 'Hard' } };
  function mines(body, actions) {
    let size = localStorage.getItem('lockshell.mines.size') || 'easy';
    const seg = el('div', { class: 'seg', style: { width: 'min(92vw,360px)', marginBottom: '10px' } });
    Object.keys(MS).forEach((k) => seg.append(el('button', { class: k === size ? 'on' : '', text: MS[k].n, onclick: (e) => { size = k; localStorage.setItem('lockshell.mines.size', k); seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); reset(); } })));
    const [mb, mv] = scoreBox('Mines', 0), [tb, tv] = scoreBox('Time', 0), [bb, bv] = scoreBox('Best', '–');
    const flagBtn = el('button', { class: 'flag-toggle', 'aria-pressed': 'false', text: '⛏️ Dig' });
    const grid = el('div', { class: 'ms-grid' });
    const msg = el('div', { class: 'game-msg', text: 'Tap to dig. Long-press (or Flag mode) to flag.' });
    body.append(el('div', { class: 'game-area' }, seg, el('div', { class: 'score-row' }, mb, tb, bb, flagBtn), grid, msg));
    actions.append(el('button', { class: 'pill-btn', text: 'New', onclick: () => reset() }));
    let cells, cols, rows, total, started, over, flagMode = false, t0, timer, flags;
    flagBtn.onclick = () => { flagMode = !flagMode; flagBtn.textContent = flagMode ? '🚩 Flag' : '⛏️ Dig'; flagBtn.classList.toggle('on', flagMode); flagBtn.setAttribute('aria-pressed', String(flagMode)); };
    LS.gameCleanup(() => clearInterval(timer));
    const nbrs = (i) => { const x = i % cols, y = (i / cols) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx); } return out; };
    function reset() {
      clearInterval(timer); const S = MS[size]; cols = S.c; rows = S.r; total = S.m; started = false; over = false; flags = 0;
      const best = LS.gameBestLow('mines-' + size); bv.textContent = best ? best + 's' : '–';
      mv.textContent = total; tv.textContent = 0; msg.textContent = 'Tap to dig. Long-press (or Flag mode) to flag.';
      const cell = Math.floor(Math.min((Math.min(window.innerWidth, 420) - 28) / cols, (window.innerHeight - 330) / rows, 44));
      grid.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`; grid.style.setProperty('--cell', cell + 'px');
      grid.innerHTML = ''; cells = [];
      for (let i = 0; i < cols * rows; i++) {
        const b = el('button', { class: 'ms-c', 'aria-label': 'Cell' });
        const c = { i, mine: false, n: 0, open: false, flag: false, b };
        let lp = null, longDone = false;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); longDone = false; lp = setTimeout(() => { longDone = true; toggleFlag(c); if (navigator.vibrate) navigator.vibrate(30); }, 420); });
        const cancel = () => { clearTimeout(lp); lp = null; };
        b.addEventListener('pointerup', () => { if (lp) { cancel(); if (!longDone) (flagMode ? toggleFlag(c) : dig(c)); } });
        b.addEventListener('pointerleave', cancel); b.addEventListener('pointercancel', cancel);
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); });
        cells.push(c); grid.append(b);
      }
    }
    function plant(safe) {
      const banned = new Set([safe, ...nbrs(safe)]); let placed = 0;
      while (placed < total) { const i = (Math.random() * cells.length) | 0; if (cells[i].mine || banned.has(i)) continue; cells[i].mine = true; placed++; }
      cells.forEach((c) => { c.n = nbrs(c.i).filter((j) => cells[j].mine).length; });
    }
    function toggleFlag(c) { if (over || c.open) return; c.flag = !c.flag; flags += c.flag ? 1 : -1; c.b.textContent = c.flag ? '🚩' : ''; c.b.classList.toggle('flag', c.flag); mv.textContent = total - flags; }
    function dig(c) {
      if (over || c.flag || c.open) return;
      if (!started) { started = true; plant(c.i); t0 = Date.now(); timer = setInterval(() => { tv.textContent = Math.floor((Date.now() - t0) / 1000); }, 500); }
      if (c.mine) return lose(c);
      const stack = [c];
      while (stack.length) {
        const k = stack.pop(); if (k.open || k.flag) continue;
        k.open = true; k.b.classList.add('open'); if (k.n) { k.b.textContent = k.n; k.b.dataset.n = k.n; }
        if (!k.n) nbrs(k.i).forEach((j) => { if (!cells[j].open && !cells[j].mine) stack.push(cells[j]); });
      }
      if (cells.every((x) => x.mine || x.open)) win();
    }
    function lose(c) {
      over = true; clearInterval(timer); c.b.classList.add('boom');
      cells.forEach((x) => { if (x.mine) { x.b.textContent = '💣'; x.b.classList.add('open'); } else if (x.flag) x.b.classList.add('wrong'); });
      msg.textContent = '💥 Boom! Tap New to try again.'; if (navigator.vibrate) navigator.vibrate(200);
    }
    function win() {
      over = true; clearInterval(timer); const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
      cells.forEach((x) => { if (x.mine && !x.flag) { x.b.textContent = '🚩'; } });
      bv.textContent = LS.gameBestLow('mines-' + size, secs) + 's'; msg.textContent = `🎉 Cleared in ${secs} seconds!`;
    }
    reset();
  }

  /* ======================= CONNECT FOUR ======================= */
  function connect4(body) {
    const C = 7, R = 6;
    let mode = localStorage.getItem('lockshell.c4.mode') || 'easy';
    const seg = el('div', { class: 'seg', style: { width: 'min(92vw,360px)', marginBottom: '10px' } });
    [['easy', 'AI Easy'], ['hard', 'AI Hard'], ['2p', '2 Players']].forEach(([k, l]) => seg.append(el('button', { class: k === mode ? 'on' : '', text: l, onclick: (e) => { mode = k; localStorage.setItem('lockshell.c4.mode', k); seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); tally = { a: 0, b: 0 }; reset(); } })));
    const [ab, av] = scoreBox('Red', 0), [bb2, bv2] = scoreBox('Yellow', 0), [wb, wv] = scoreBox('Wins vs AI', LS.gameBest('c4wins'));
    const board = el('div', { class: 'c4' });
    const msg = el('div', { class: 'game-msg' });
    const again = el('button', { class: 'pill-btn', style: { marginTop: '10px' }, text: 'Play again', hidden: true, onclick: () => reset() });
    body.append(el('div', { class: 'game-area' }, seg, el('div', { class: 'score-row' }, ab, bb2, wb), board, msg, again));
    let b, turn, over, busy, tally = { a: 0, b: 0 };
    const cellEls = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const d = el('div', { class: 'c4-cell', 'data-c': c }, el('i')); cellEls.push(d); board.append(d); }
    board.addEventListener('click', (e) => { const d = e.target.closest('.c4-cell'); if (d) human(+d.dataset.c); });
    const at = (bd, r, c) => bd[r * C + c];
    const drop = (bd, c) => { for (let r = R - 1; r >= 0; r--) if (!bd[r * C + c]) return r; return -1; };
    function winLine(bd) {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const p = at(bd, r, c); if (!p) continue;
        for (const [dr, dc] of dirs) { const line = [[r, c]]; for (let k = 1; k < 4; k++) { const rr2 = r + dr * k, cc = c + dc * k; if (rr2 < 0 || rr2 >= R || cc < 0 || cc >= C || at(bd, rr2, cc) !== p) break; line.push([rr2, cc]); } if (line.length === 4) return { p, line }; }
      }
      return null;
    }
    function scoreBoard(bd, me) {
      const op = me === 1 ? 2 : 1; let s = 0;
      for (let r = 0; r < R; r++) if (at(bd, r, 3) === me) s += 3;
      const win4 = (cells) => { const m = cells.filter((x) => x === me).length, o = cells.filter((x) => x === op).length, e = cells.filter((x) => !x).length;
        if (m === 4) return 1000; if (m === 3 && e === 1) return 6; if (m === 2 && e === 2) return 2; if (o === 3 && e === 1) return -8; return 0; };
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (c + 3 < C) s += win4([0, 1, 2, 3].map((k) => at(bd, r, c + k)));
        if (r + 3 < R) s += win4([0, 1, 2, 3].map((k) => at(bd, r + k, c)));
        if (r + 3 < R && c + 3 < C) s += win4([0, 1, 2, 3].map((k) => at(bd, r + k, c + k)));
        if (r + 3 < R && c - 3 >= 0) s += win4([0, 1, 2, 3].map((k) => at(bd, r + k, c - k)));
      }
      return s;
    }
    const valid = (bd) => [3, 2, 4, 1, 5, 0, 6].filter((c) => drop(bd, c) >= 0);
    function minimax(bd, depth, a, bt, maxP) {
      const w = winLine(bd); if (w) return w.p === 2 ? 100000 + depth : -100000 - depth;
      const vs = valid(bd); if (!vs.length) return 0; if (!depth) return scoreBoard(bd, 2);
      if (maxP) { let v = -Infinity; for (const c of vs) { const r = drop(bd, c); bd[r * C + c] = 2; v = Math.max(v, minimax(bd, depth - 1, a, bt, false)); bd[r * C + c] = 0; a = Math.max(a, v); if (a >= bt) break; } return v; }
      let v = Infinity; for (const c of vs) { const r = drop(bd, c); bd[r * C + c] = 1; v = Math.min(v, minimax(bd, depth - 1, a, bt, true)); bd[r * C + c] = 0; bt = Math.min(bt, v); if (a >= bt) break; } return v;
    }
    function aiCol() {
      const vs = valid(b);
      const winsWith = (p) => vs.find((c) => { const r = drop(b, c); b[r * C + c] = p; const w = !!winLine(b); b[r * C + c] = 0; return w; });
      if (mode === 'easy') { const w = winsWith(2); if (w != null) return w; const bl = winsWith(1); if (bl != null && Math.random() < 0.8) return bl; return vs[Math.floor(Math.random() * vs.length)]; }
      let best = vs[0], bestV = -Infinity;
      for (const c of vs) { const r = drop(b, c); b[r * C + c] = 2; const v = minimax(b, 4, -Infinity, Infinity, false); b[r * C + c] = 0; if (v > bestV) { bestV = v; best = c; } }
      return best;
    }
    function place(c, p) {
      const r = drop(b, c); if (r < 0) return false;
      b[r * C + c] = p; const d = cellEls[r * C + c];
      d.className = 'c4-cell ' + (p === 1 ? 'red' : 'yel') + ' drop'; d.style.setProperty('--fall', (r + 1));
      return true;
    }
    function check() {
      const w = winLine(b);
      if (w) {
        over = true; again.hidden = false; w.line.forEach(([r, c]) => cellEls[r * C + c].classList.add('win'));
        if (w.p === 1) tally.a++; else tally.b++;
        av.textContent = tally.a; bv2.textContent = tally.b;
        if (mode === '2p') msg.textContent = (w.p === 1 ? '🔴 Red' : '🟡 Yellow') + ' wins!';
        else if (w.p === 1) { wv.textContent = LS.gameBest('c4wins', LS.gameBest('c4wins') + 1); msg.textContent = '🎉 You win!'; }
        else msg.textContent = 'AI wins this time';
        return true;
      }
      if (b.every((x) => x)) { over = true; again.hidden = false; msg.textContent = "It's a draw"; return true; }
      return false;
    }
    function human(c) {
      if (over || busy) return;
      const p = mode === '2p' ? turn : 1;
      if (!place(c, p)) return;
      if (check()) return;
      if (mode === '2p') { turn = turn === 1 ? 2 : 1; msg.textContent = (turn === 1 ? '🔴 Red' : '🟡 Yellow') + "'s turn"; return; }
      busy = true; msg.textContent = 'AI is thinking…';
      setTimeout(() => { place(aiCol(), 2); busy = false; if (!check()) msg.textContent = 'Your turn (🔴)'; }, 380);
    }
    function reset() {
      b = Array(C * R).fill(0); turn = 1; over = false; busy = false; again.hidden = true;
      cellEls.forEach((d) => { d.className = 'c4-cell'; });
      msg.textContent = mode === '2p' ? "🔴 Red's turn" : 'Your turn (🔴). Tap a column.';
      av.textContent = tally.a; bv2.textContent = tally.b;
    }
    reset();
  }

  /* ======================= SKY HOP ======================= */
  function skyhop(body, actions) {
    const W = Math.min(window.innerWidth - 24, 380), H = Math.max(380, Math.min(window.innerHeight - 220, 580));
    const [cv, g] = dprCanvas(W, H);
    const [sb, sv] = scoreBox('Score', 0), [bb, bv] = scoreBox('Best', LS.gameBest('skyhop'));
    const msg = el('div', { class: 'game-msg', text: 'Tap to hop through the gaps!' });
    body.append(el('div', { class: 'game-area' }, el('div', { class: 'score-row' }, sb, bb), cv, msg));
    actions.append(el('button', { class: 'pill-btn', text: 'Restart', onclick: () => reset() }));
    const GRAV = 1500, HOP = -430, SPEED = 150, GAPH = Math.round(H * 0.3), PW = 58, SPACING = 210;
    let hopper, pillars, score, state, raf, last, t = 0;
    function reset() { hopper = { x: W * 0.3, y: H * 0.45, vy: 0, r: 15 }; pillars = []; score = 0; sv.textContent = 0; state = 'ready'; msg.textContent = 'Tap to hop through the gaps!'; for (let i = 0; i < 3; i++) addPillar(W + 60 + i * SPACING); }
    function addPillar(x) { const top = 50 + Math.random() * (H - GAPH - 110); pillars.push({ x, gapY: top, scored: false }); }
    function hop() {
      if (state === 'over') { if (Date.now() - overAt > 500) reset(); return; }
      if (state === 'ready') { state = 'play'; msg.textContent = ''; }
      hopper.vy = HOP;
    }
    let overAt = 0;
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); hop(); });
    const keyh = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); hop(); } };
    document.addEventListener('keydown', keyh);
    function step(dt) {
      t += dt;
      if (state === 'ready') { hopper.y = H * 0.45 + Math.sin(t * 4) * 6; return; }
      if (state === 'over') { if (hopper.y < H - 30 - hopper.r) { hopper.vy += GRAV * dt; hopper.y = Math.min(H - 30 - hopper.r, hopper.y + hopper.vy * dt); } return; }
      hopper.vy += GRAV * dt; hopper.y += hopper.vy * dt;
      const sp = SPEED + Math.min(90, score * 3);
      pillars.forEach((p) => { p.x -= sp * dt; });
      if (pillars[0].x < -PW) { pillars.shift(); addPillar(pillars[pillars.length - 1].x + SPACING); }
      for (const p of pillars) {
        if (!p.scored && p.x + PW < hopper.x) { p.scored = true; score++; sv.textContent = score; }
        const inX = hopper.x + hopper.r * 0.8 > p.x && hopper.x - hopper.r * 0.8 < p.x + PW;
        if (inX && (hopper.y - hopper.r * 0.8 < p.gapY || hopper.y + hopper.r * 0.8 > p.gapY + GAPH)) return die();
      }
      if (hopper.y + hopper.r > H - 30 || hopper.y - hopper.r < 0) die();
    }
    function die() { if (state === 'over') return; state = 'over'; overAt = Date.now(); bv.textContent = LS.gameBest('skyhop', score); msg.textContent = 'Oops! Tap to try again.'; if (navigator.vibrate) navigator.vibrate(120); }
    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8fd3ff'); sky.addColorStop(1, '#e8f7ff');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,214,10,.9)'; g.beginPath(); g.arc(W - 50, 60, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)';
      [[(80 - t * 12) % (W + 120), 90], [(260 - t * 8) % (W + 120), 150]].forEach(([x, y]) => { const xx = x < -60 ? x + W + 120 : x; g.beginPath(); g.arc(xx, y, 18, 0, 7); g.arc(xx + 20, y - 8, 22, 0, 7); g.arc(xx + 42, y, 16, 0, 7); g.fill(); });
      pillars.forEach((p) => {
        g.fillStyle = '#34c759'; rr(g, p.x, -10, PW, p.gapY + 10, 10); g.fill(); rr(g, p.x, p.gapY + GAPH, PW, H - p.gapY - GAPH - 20, 10); g.fill();
        g.fillStyle = '#28a745'; rr(g, p.x - 4, p.gapY - 18, PW + 8, 18, 6); g.fill(); rr(g, p.x - 4, p.gapY + GAPH, PW + 8, 18, 6); g.fill();
      });
      g.fillStyle = '#c9a66b'; g.fillRect(0, H - 30, W, 30); g.fillStyle = '#7bc86c'; g.fillRect(0, H - 30, W, 8);
      // the hopper: a round little bird-like puff with a wing and a beak (original art)
      const h = hopper, tilt = Math.max(-0.5, Math.min(0.9, h.vy / 700));
      g.save(); g.translate(h.x, h.y); g.rotate(tilt);
      g.fillStyle = '#ff9f0a'; g.beginPath(); g.arc(0, 0, h.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd60a'; g.beginPath(); g.ellipse(-4, 5, 9, 6, -0.3 + Math.sin(t * 20) * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(6, -5, 5.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1c1c1e'; g.beginPath(); g.arc(7.5, -5, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff3b30'; g.beginPath(); g.moveTo(h.r - 2, -1); g.lineTo(h.r + 8, 2); g.lineTo(h.r - 2, 5); g.fill();
      g.restore();
      g.fillStyle = 'rgba(0,0,0,.55)'; g.font = '800 40px -apple-system,system-ui,sans-serif'; g.textAlign = 'center';
      if (state !== 'ready') g.fillText(String(score), W / 2, 64);
      if (state === 'ready') { g.font = '700 22px -apple-system,system-ui,sans-serif'; g.fillText('Sky Hop', W / 2, H * 0.3); }
    }
    function loop(ts) { const dt = Math.min(0.033, (ts - (last || ts)) / 1000); last = ts; step(dt); draw(); raf = requestAnimationFrame(loop); }
    reset(); raf = requestAnimationFrame(loop);
    LS.gameCleanup(() => { cancelAnimationFrame(raf); document.removeEventListener('keydown', keyh); });
  }

  LS.addGame('breakout', { name: 'Breakout', emoji: '🧱', desc: 'Drag the paddle', bg: 'linear-gradient(135deg,#ff6b6b,#e03131)', run: breakout, extra: true, hs: () => 'Best: ' + LS.gameBest('breakout') });
  LS.addGame('mines', { name: 'Minesweeper', emoji: '💣', desc: 'Find the safe squares', bg: 'linear-gradient(135deg,#8e9aaf,#495466)', run: mines, extra: true, hs: () => { const b = LS.gameBestLow('mines-easy'); return b ? 'Easy best: ' + b + 's' : 'No best yet'; } });
  LS.addGame('connect4', { name: 'Connect Four', emoji: '🔴', desc: 'Four in a row', bg: 'linear-gradient(135deg,#1e88e5,#1565c0)', run: connect4, extra: true, hs: () => 'Wins: ' + LS.gameBest('c4wins') });
  LS.addGame('skyhop', { name: 'Sky Hop', emoji: '🐤', desc: 'Tap to fly', bg: 'linear-gradient(135deg,#4fc3f7,#0288d1)', run: skyhop, extra: true, hs: () => 'Best: ' + LS.gameBest('skyhop') });
})();
