/* Games: hub + Snake, 2048, Tic-Tac-Toe (AI), Memory match */
(function () {
  'use strict';
  const { el } = LS;
  let cleanup = [], inGame = false, hubFn = null;
  function clean() { cleanup.forEach((f) => { try { f(); } catch (e) {} }); cleanup = []; }
  const best = (k, v) => { const key = 'lockshell.best.' + k; if (v != null) { if (v > (+localStorage.getItem(key) || 0)) localStorage.setItem(key, v); } return +localStorage.getItem(key) || 0; };
  // lower-is-better (Memory moves)
  const bestLow = (k, v) => { const key = 'lockshell.best.' + k; const cur = +localStorage.getItem(key) || 0; if (v != null && (!cur || v < cur)) localStorage.setItem(key, v); return +localStorage.getItem(key) || 0; };
  function scoreBox(label, val) { const b = el('b', { text: val }); return [el('div', { class: 'score' }, el('small', { text: label }), b), b]; }

  const GAMES = {
    snake: { name: 'Snake', emoji: '🐍', desc: 'Swipe to steer', bg: 'linear-gradient(135deg,#10b981,#047857)', run: snake },
    g2048: { name: '2048', emoji: '🔢', desc: 'Swipe to merge', bg: 'linear-gradient(135deg,#f59e0b,#ea580c)', run: game2048 },
    ttt: { name: 'Tic-Tac-Toe', emoji: '❌', desc: 'Beat the AI', bg: 'linear-gradient(135deg,#6366f1,#4338ca)', run: ttt },
    memory: { name: 'Memory', emoji: '🧠', desc: 'Match the pairs', bg: 'linear-gradient(135deg,#ec4899,#be185d)', run: memory }
  };

  // Other files can add games (extra ones can be turned off in Developer Tools).
  LS.addGame = (key, def) => { GAMES[key] = def; };
  LS.gameAvailable = (key) => !!GAMES[key] && (!GAMES[key].extra || LS.hasExtra(key));
  LS.gameList = () => Object.keys(GAMES).filter(LS.gameAvailable).map((k) => ({ key: k, name: GAMES[k].name }));
  LS.allGames = () => Object.keys(GAMES).map((k) => ({ key: k, name: GAMES[k].name, extra: !!GAMES[k].extra }));
  LS.gameBest = best; LS.gameBestLow = bestLow;
  LS.gameCleanup = (fn) => cleanup.push(fn);

  LS.register('games', {
    title: 'Games', icon: 'games', color: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
    open(body, actions, which) {
      function hub() {
        clean(); inGame = false;
        LS.$('#appTitle').textContent = 'Games'; actions.innerHTML = ''; LS.backLabel('Home');
        body.innerHTML = ''; body.className = 'app-body scroll';
        const g = el('div', { class: 'game-grid' });
        Object.keys(GAMES).filter(LS.gameAvailable).forEach((k) => {
          const G = GAMES[k];
          const hs = G.hs ? G.hs() : k === 'memory' ? (bestLow('memory') ? 'Best: ' + bestLow('memory') + ' moves' : 'No best yet') : k === 'ttt' ? 'Wins: ' + best('tttwins') : 'Best: ' + best(k === 'g2048' ? '2048' : k);
          g.append(el('button', { class: 'game-card', style: { background: G.bg }, onclick: () => play(k) },
            el('div', { class: 'e', text: G.emoji }), el('div', null, el('b', { text: G.name }), el('small', { text: G.desc }), el('small', { class: 'hs', text: hs }))));
        });
        body.append(el('div', { class: 'pad' }, g));
      }
      function play(k) {
        clean(); inGame = true;
        const G = GAMES[k];
        LS.$('#appTitle').textContent = G.name; actions.innerHTML = ''; LS.backLabel('Games');
        body.innerHTML = ''; body.className = 'app-body';
        G.run(body, actions);
      }
      hubFn = hub;
      if (which && LS.gameAvailable(which)) play(which); else hub();
    },
    back() { if (inGame && hubFn) { hubFn(); return true; } return false; },
    close() { clean(); inGame = false; }
  });

  /* ---------------- Snake ---------------- */
  function snake(body, actions) {
    const N = 18;
    const [sb, sv] = scoreBox('Score', 0), [bb, bv] = scoreBox('Best', best('snake'));
    const size = Math.floor(Math.min(window.innerWidth - 40, window.innerHeight - 420, 420) / N) * N;
    const cv = el('canvas', { class: 'board' });
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = cv.style.height = size + 'px';
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const cell = size / N;
    const msg = el('div', { class: 'game-msg', text: 'Swipe or tap an arrow to start' });
    const pad = el('div', { class: 'dpad' });
    [['up', '▲'], ['left', '◀'], ['down', '▼'], ['right', '▶']].forEach(([d, t]) => pad.append(el('button', { class: 'd-' + d, 'aria-label': d, text: t, onpointerdown: (e) => { e.preventDefault(); turn(d); } })));
    const area = el('div', { class: 'game-area' }, el('div', { class: 'score-row' }, sb, bb), cv, msg, pad);
    actions.append(el('button', { class: 'pill-btn', text: 'Restart', onclick: reset }));
    body.append(area);
    let s, dir, next, food, score, loop, alive, started;
    function place() { do { food = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 }; } while (s.some((p) => p.x === food.x && p.y === food.y)); }
    function reset() {
      clearInterval(loop); s = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]; dir = { x: 1, y: 0 }; next = dir; score = 0; alive = true; started = false;
      sv.textContent = 0; msg.textContent = 'Swipe or tap an arrow to start'; place(); draw();
    }
    function speed() { return Math.max(70, 150 - score * 3); }
    function start() { started = true; msg.textContent = ''; clearInterval(loop); loop = setInterval(step, speed()); }
    function step() {
      dir = next;
      const h = { x: s[0].x + dir.x, y: s[0].y + dir.y };
      if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || s.some((p) => p.x === h.x && p.y === h.y)) {
        alive = false; clearInterval(loop); best('snake', score); bv.textContent = best('snake');
        msg.textContent = 'Game over! Tap an arrow to play again'; if (navigator.vibrate) navigator.vibrate(200); draw(); return;
      }
      s.unshift(h);
      if (h.x === food.x && h.y === food.y) { score++; sv.textContent = score; place(); clearInterval(loop); loop = setInterval(step, speed()); }
      else s.pop();
      draw();
    }
    function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); }
    function draw() {
      g.fillStyle = '#eef6ee'; g.fillRect(0, 0, size, size);
      g.fillStyle = 'rgba(52,199,89,.08)';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) g.fillRect(i * cell, j * cell, cell, cell);
      g.fillStyle = '#f43f5e'; g.beginPath(); g.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * 0.38, 0, 7); g.fill();
      s.forEach((p, i) => { g.fillStyle = i === 0 ? '#1f9d48' : `hsl(${135 + i * 2},60%,${45 + Math.min(i, 20)}%)`; rr(p.x * cell + 1, p.y * cell + 1, cell - 2, cell - 2, cell * 0.3); });
      if (!alive) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, 0, size, size); }
    }
    const D = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    function turn(d) {
      if (!alive) { reset(); }
      const nd = D[d]; if (nd.x === -dir.x && nd.y === -dir.y && s.length > 1) return;
      next = nd; if (!started) start();
    }
    const off = LS.onSwipe(cv, turn);
    cleanup.push(() => clearInterval(loop), off);
    reset();
  }

  /* ---------------- 2048 ---------------- */
  function game2048(body, actions) {
    const [sb, sv] = scoreBox('Score', 0), [bb, bv] = scoreBox('Best', best('2048'));
    const grid = el('div', { class: 'g2048' });
    const msg = el('div', { class: 'game-msg', text: 'Swipe to slide tiles. Reach 2048!' });
    const area = el('div', { class: 'game-area' }, el('div', { class: 'score-row' }, sb, bb), grid, msg);
    actions.append(el('button', { class: 'pill-btn', text: 'New', onclick: reset }));
    body.append(area);
    const COL = { 2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'] };
    let b, score, won, pops;
    const cells = []; for (let i = 0; i < 16; i++) { const c = el('div', { class: 'c' }); cells.push(c); grid.append(c); }
    function add() { const e = []; b.forEach((v, i) => { if (!v) e.push(i); }); if (!e.length) return; const i = e[(Math.random() * e.length) | 0]; b[i] = Math.random() < 0.9 ? 2 : 4; pops.add(i); }
    function reset() { b = Array(16).fill(0); score = 0; won = false; pops = new Set(); add(); add(); msg.textContent = 'Swipe to slide tiles. Reach 2048!'; render(); }
    function render() {
      sv.textContent = score;
      b.forEach((v, i) => {
        const c = cells[i]; c.textContent = v || '';
        const col = COL[v] || (v ? ['#3c3a32', '#fff'] : null);
        c.style.background = col ? col[0] : ''; c.style.color = col ? col[1] : '';
        c.style.fontSize = v >= 1024 ? '20px' : v >= 128 ? '24px' : '30px';
        c.classList.remove('pop'); if (pops.has(i)) { void c.offsetWidth; c.classList.add('pop'); }
      });
      pops = new Set();
    }
    function line(idx) { return idx.map((i) => b[i]); }
    function slide(row) {
      const a = row.filter((x) => x), out = [];
      for (let i = 0; i < a.length; i++) { if (a[i] === a[i + 1]) { out.push(a[i] * 2); score += a[i] * 2; if (a[i] * 2 === 2048) won = true; i++; } else out.push(a[i]); }
      while (out.length < 4) out.push(0); return out;
    }
    function move(d) {
      const before = b.join(',');
      for (let k = 0; k < 4; k++) {
        let idx;
        if (d === 'left') idx = [0, 1, 2, 3].map((j) => k * 4 + j);
        if (d === 'right') idx = [3, 2, 1, 0].map((j) => k * 4 + j);
        if (d === 'up') idx = [0, 1, 2, 3].map((j) => j * 4 + k);
        if (d === 'down') idx = [3, 2, 1, 0].map((j) => j * 4 + k);
        const r = slide(line(idx)); idx.forEach((i, j) => { b[i] = r[j]; });
      }
      if (b.join(',') === before) return;
      add(); best('2048', score); bv.textContent = best('2048'); render();
      if (won) { msg.textContent = '🎉 You made 2048! Keep going?'; won = false; }
      else if (over()) msg.textContent = 'No moves left. Tap New to retry.';
    }
    function over() {
      if (b.includes(0)) return false;
      for (let i = 0; i < 16; i++) { if (i % 4 < 3 && b[i] === b[i + 1]) return false; if (i < 12 && b[i] === b[i + 4]) return false; }
      return true;
    }
    cleanup.push(LS.onSwipe(area, move));
    reset();
  }

  /* ---------------- Tic-Tac-Toe ---------------- */
  function ttt(body) {
    const W = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    let b, over, level = localStorage.getItem('lockshell.ttt.level') || 'normal', tally = { you: 0, ai: 0, tie: 0 };
    const seg = el('div', { class: 'seg', style: { width: 'min(86vw,330px)', marginBottom: '14px' } });
    ['easy', 'normal', 'hard'].forEach((l) => seg.append(el('button', { class: l === level ? 'on' : '', text: l[0].toUpperCase() + l.slice(1), onclick: (e) => { level = l; localStorage.setItem('lockshell.ttt.level', l); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === e.currentTarget)); reset(); } })));
    const [y, yv] = scoreBox('You (X)', 0), [t, tv] = scoreBox('Tie', 0), [a, av] = scoreBox('AI (O)', 0);
    const board = el('div', { class: 'ttt' });
    const msg = el('div', { class: 'game-msg', text: 'Your move' });
    const again = el('button', { class: 'pill-btn', style: { marginTop: '12px' }, text: 'Play again', onclick: reset, hidden: true });
    body.append(el('div', { class: 'game-area' }, seg, el('div', { class: 'score-row' }, y, t, a), board, msg, again));
    const btns = [];
    for (let i = 0; i < 9; i++) { const c = el('button', { 'aria-label': 'Cell ' + (i + 1), onclick: () => human(i) }); btns.push(c); board.append(c); }
    function winner(bd) { for (const w of W) if (bd[w[0]] && bd[w[0]] === bd[w[1]] && bd[w[0]] === bd[w[2]]) return { p: bd[w[0]], w }; return bd.every((x) => x) ? { p: 'tie' } : null; }
    function render() { b.forEach((v, i) => { btns[i].textContent = v || ''; btns[i].className = v ? v.toLowerCase() : ''; }); }
    function minimax(bd, p) {
      const r = winner(bd); if (r) return { s: r.p === 'O' ? 10 : r.p === 'X' ? -10 : 0 };
      let bestM = { s: p === 'O' ? -99 : 99 };
      for (let i = 0; i < 9; i++) if (!bd[i]) {
        bd[i] = p; const s = minimax(bd, p === 'O' ? 'X' : 'O').s; bd[i] = null;
        if (p === 'O' ? s > bestM.s : s < bestM.s) bestM = { s, i };
      }
      return bestM;
    }
    function aiMove() {
      const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      const rnd = level === 'easy' ? 0.7 : level === 'normal' ? 0.25 : 0;
      if (Math.random() < rnd) return empty[(Math.random() * empty.length) | 0];
      return minimax(b.slice(), 'O').i;
    }
    function finish(r) {
      over = true; again.hidden = false;
      if (r.w) r.w.forEach((i) => btns[i].classList.add('win'));
      if (r.p === 'X') { tally.you++; best('tttwins', best('tttwins') + 1); msg.textContent = '🎉 You win!'; } else if (r.p === 'O') { tally.ai++; msg.textContent = 'AI wins this time'; } else { tally.tie++; msg.textContent = "It's a tie"; }
      yv.textContent = tally.you; av.textContent = tally.ai; tv.textContent = tally.tie;
    }
    function human(i) {
      if (over || b[i]) return;
      b[i] = 'X'; render();
      let r = winner(b); if (r) return finish(r);
      msg.textContent = 'AI is thinking…'; over = true;
      setTimeout(() => { over = false; b[aiMove()] = 'O'; render(); const r2 = winner(b); if (r2) finish(r2); else msg.textContent = 'Your move'; }, 350);
    }
    function reset() { b = Array(9).fill(null); over = false; again.hidden = true; msg.textContent = 'Your move'; render(); }
    reset();
  }

  /* ---------------- Memory ---------------- */
  function memory(body, actions) {
    const E = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦄', '🐙', '🦋'];
    const [mb, mv] = scoreBox('Moves', 0), [pb, pv] = scoreBox('Pairs', '0/8'), [bb2, bv2] = scoreBox('Best', bestLow('memory') || '–');
    const grid = el('div', { class: 'mem' });
    const msg = el('div', { class: 'game-msg', text: 'Flip two cards to find a match' });
    actions.append(el('button', { class: 'pill-btn', text: 'Shuffle', onclick: reset }));
    body.append(el('div', { class: 'game-area' }, el('div', { class: 'score-row' }, mb, pb, bb2), grid, msg));
    let open = [], moves = 0, pairs = 0, lock = false, timers = [];
    cleanup.push(() => timers.forEach(clearTimeout));
    function reset() {
      timers.forEach(clearTimeout); timers = [];
      const deck = E.concat(E).map((e) => ({ e, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.e);
      grid.innerHTML = ''; open = []; moves = 0; pairs = 0; lock = false; mv.textContent = 0; pv.textContent = '0/8'; msg.textContent = 'Flip two cards to find a match';
      deck.forEach((e) => {
        const c = el('button', { 'aria-label': 'Card' }, el('div', { class: 'in' }, el('div', { class: 'f' }), el('div', { class: 'b', text: e })));
        c.dataset.e = e;
        c.onclick = () => flip(c);
        grid.append(c);
      });
    }
    function flip(c) {
      if (lock || c.classList.contains('up') || c.classList.contains('done')) return;
      c.classList.add('up'); open.push(c);
      if (open.length < 2) return;
      moves++; mv.textContent = moves;
      const [a, b] = open;
      if (a.dataset.e === b.dataset.e) {
        a.classList.add('done'); b.classList.add('done'); open = []; pairs++; pv.textContent = pairs + '/8';
        if (pairs === 8) { bv2.textContent = bestLow('memory', moves); msg.textContent = `🎉 All pairs in ${moves} moves!`; }
      } else {
        lock = true;
        timers.push(setTimeout(() => { a.classList.remove('up'); b.classList.remove('up'); open = []; lock = false; }, 800));
      }
    }
    reset();
  }
})();
