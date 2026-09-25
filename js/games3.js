/* More games: Word Search (themed lists, 3 sizes, drag or tap to select) and Simon (4 colors, Web Audio tones). */
(function () {
  'use strict';
  const { el } = LS;
  const scoreBox = (label, val) => { const b = el('b', { text: val }); return [el('div', { class: 'score' }, el('small', { text: label }), b), b]; };

  /* ======================= WORD SEARCH ======================= */
  const THEMES = {
    Animals: ['LION', 'TIGER', 'ZEBRA', 'PANDA', 'KOALA', 'OTTER', 'MOOSE', 'CAMEL', 'HORSE', 'SLOTH', 'EAGLE', 'SHARK', 'WHALE', 'FROG', 'BEAR', 'DUCK', 'GOAT', 'SEAL', 'OWL', 'FOX'],
    Space: ['MOON', 'STAR', 'SUN', 'MARS', 'COMET', 'ORBIT', 'EARTH', 'VENUS', 'PLANET', 'ROCKET', 'GALAXY', 'SATURN', 'ALIEN', 'COSMOS', 'NOVA', 'CRATER'],
    Food: ['APPLE', 'BREAD', 'PIZZA', 'PASTA', 'MANGO', 'GRAPE', 'LEMON', 'HONEY', 'SALAD', 'TACO', 'RICE', 'PEAR', 'CORN', 'MILK', 'SOUP', 'BERRY', 'CARROT', 'CHEESE'],
    Ocean: ['WAVE', 'SAND', 'FISH', 'CRAB', 'CORAL', 'SHELL', 'TIDE', 'SQUID', 'OCTOPUS', 'DOLPHIN', 'REEF', 'KELP', 'BOAT', 'BEACH', 'STARFISH', 'TURTLE'],
    Colors: ['RED', 'BLUE', 'GREEN', 'PINK', 'GOLD', 'GRAY', 'BLACK', 'WHITE', 'PURPLE', 'ORANGE', 'YELLOW', 'BROWN', 'SILVER', 'VIOLET', 'CYAN', 'TEAL'],
    Weather: ['RAIN', 'SNOW', 'WIND', 'CLOUD', 'STORM', 'SUNNY', 'FOGGY', 'FROST', 'HAIL', 'THUNDER', 'RAINBOW', 'BREEZE', 'MIST', 'SLEET', 'HOT', 'COLD']
  };
  const SIZES = { 8: { n: 8, words: 6, dirs: [[0, 1], [1, 0]] }, 10: { n: 10, words: 8, dirs: [[0, 1], [1, 0], [1, 1]] }, 12: { n: 12, words: 10, dirs: [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, 1]] } };
  // Random filler letters must never spell something rude.
  const NOPE = ['SEX', 'FUCK', 'FUK', 'SHIT', 'DICK', 'COCK', 'CUM', 'TIT', 'FAG', 'PISS', 'PORN', 'RAPE', 'KILL', 'DAMN', 'BUTT', 'NUDE', 'SLUT', 'HOE', 'ASS', 'POO', 'DIE', 'GUN'];
  const FILL = 'ABCDEFGHIJKLMNOPRSTUVWY';
  function makeGrid(size, theme) {
    const cfg = SIZES[size], n = cfg.n;
    for (let attempt = 0; attempt < 60; attempt++) {
      const g = Array.from({ length: n }, () => Array(n).fill(''));
      const pool = THEMES[theme].filter((w) => w.length <= n).sort(() => Math.random() - 0.5);
      const placed = [];
      for (const w of pool) {
        if (placed.length >= cfg.words) break;
        let ok = false;
        for (let t = 0; t < 120 && !ok; t++) {
          const [dr, dc] = cfg.dirs[Math.floor(Math.random() * cfg.dirs.length)];
          const r0 = Math.floor(Math.random() * n), c0 = Math.floor(Math.random() * n);
          const r1 = r0 + dr * (w.length - 1), c1 = c0 + dc * (w.length - 1);
          if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
          let fits = true;
          for (let i = 0; i < w.length; i++) { const ch = g[r0 + dr * i][c0 + dc * i]; if (ch && ch !== w[i]) { fits = false; break; } }
          if (!fits) continue;
          const cells = [];
          for (let i = 0; i < w.length; i++) { g[r0 + dr * i][c0 + dc * i] = w[i]; cells.push((r0 + dr * i) * n + (c0 + dc * i)); }
          placed.push({ w, cells }); ok = true;
        }
      }
      if (placed.length < Math.min(cfg.words, 5)) continue;
      for (let fillTry = 0; fillTry < 30; fillTry++) {
        const f = g.map((row) => row.map((ch) => ch || FILL[Math.floor(Math.random() * FILL.length)]));
        if (!rude(f, placed)) return { grid: f, words: placed, n };
      }
    }
    return null;
  }
  function rude(g, placed) {
    const n = g.length, lines = [];
    for (let i = 0; i < n; i++) { lines.push(g[i].join('')); lines.push(g.map((r) => r[i]).join('')); }
    for (let k = -n + 1; k < n; k++) { let a = '', b = ''; for (let r = 0; r < n; r++) { const c = r + k, c2 = n - 1 - r + k; if (c >= 0 && c < n) a += g[r][c]; if (c2 >= 0 && c2 < n) b += g[r][c2]; } lines.push(a, b); }
    const all = lines.concat(lines.map((l) => l.split('').reverse().join(''))).join('|');
    const themeWords = placed.map((p) => p.w).join('|');
    return NOPE.some((w) => all.includes(w) && !themeWords.includes(w));
  }

  function wordsearch(body, actions) {
    let size = 8, theme = 'Animals', game = null, found = new Set(), start = 0, tmr = null, sel = null, tapStart = null;
    const [tb, tv] = scoreBox('Time', '0s'), [fb, fv] = scoreBox('Found', '0'), [bb, bv] = scoreBox('Best', '—');
    const sizeSeg = el('div', { class: 'seg ws-seg' }), themeSel = el('select', { class: 'ws-theme', 'aria-label': 'Word theme' });
    Object.keys(THEMES).forEach((t) => themeSel.append(el('option', { value: t, text: t })));
    themeSel.onchange = () => { theme = themeSel.value; newGame(); };
    const gridEl = el('div', { class: 'ws-grid', 'data-touch': '' }), list = el('div', { class: 'ws-words' }), msg = el('div', { class: 'game-msg', text: 'Drag across a word, or tap its first and last letter.' });
    body.append(el('div', { class: 'game-area ws-area' }, el('div', { class: 'ws-opts' }, sizeSeg, themeSel), el('div', { class: 'score-row' }, tb, fb, bb), gridEl, list, msg));
    actions.append(el('button', { class: 'pill-btn', text: 'New', onclick: () => newGame() }));
    function drawSeg() { sizeSeg.innerHTML = ''; [[8, 'Small'], [10, 'Medium'], [12, 'Big']].forEach(([k, t]) => sizeSeg.append(el('button', { class: size === k ? 'on' : '', text: t, onclick: () => { size = k; drawSeg(); newGame(); } }))); }
    function newGame() {
      clearInterval(tmr); found = new Set(); sel = null; tapStart = null;
      game = makeGrid(size, theme);
      if (!game) { msg.textContent = 'Could not make a puzzle, try again.'; return; }
      const n = game.n; gridEl.innerHTML = ''; gridEl.style.gridTemplateColumns = 'repeat(' + n + ',1fr)'; gridEl.className = 'ws-grid n' + n;
      game.grid.forEach((row, r) => row.forEach((ch, c) => gridEl.append(el('div', { class: 'ws-c', 'data-i': r * n + c, text: ch }))));
      gridEl._game = game; // for tests
      list.innerHTML = ''; game.words.forEach((p) => list.append(el('span', { class: 'ws-w', 'data-w': p.w, text: p.w })));
      const b = LS.gameBestLow('ws-' + size); bv.textContent = b ? b + 's' : '—';
      fv.textContent = '0/' + game.words.length; start = Date.now(); tv.textContent = '0s';
      tmr = setInterval(() => { tv.textContent = Math.round((Date.now() - start) / 1000) + 's'; }, 1000);
      msg.textContent = 'Drag across a word, or tap its first and last letter.';
    }
    const cellAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.classList && e.classList.contains('ws-c') && gridEl.contains(e) ? +e.dataset.i : null; };
    function line(a, b) {
      const n = game.n, r0 = Math.floor(a / n), c0 = a % n, r1 = Math.floor(b / n), c1 = b % n;
      const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0), len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return null;
      const out = []; for (let i = 0; i <= len; i++) out.push((r0 + dr * i) * n + (c0 + dc * i)); return out;
    }
    function paint(cells) { LS.$$('.ws-c.sel', gridEl).forEach((x) => x.classList.remove('sel')); (cells || []).forEach((i) => { const x = gridEl.children[i]; if (x) x.classList.add('sel'); }); }
    function tryWord(cells) {
      paint(null); if (!cells || cells.length < 2) return false;
      const key = cells.join(','), rev = cells.slice().reverse().join(',');
      const hit = game.words.find((p) => !found.has(p.w) && (p.cells.join(',') === key || p.cells.join(',') === rev));
      if (!hit) return false;
      found.add(hit.w); const hue = (found.size * 47) % 360;
      hit.cells.forEach((i) => { const x = gridEl.children[i]; x.classList.add('found'); x.style.setProperty('--h', hue); });
      const w = LS.$('.ws-w[data-w="' + hit.w + '"]', list); if (w) w.classList.add('done');
      fv.textContent = found.size + '/' + game.words.length;
      if (navigator.vibrate) navigator.vibrate(25);
      if (found.size === game.words.length) {
        clearInterval(tmr); const s = Math.round((Date.now() - start) / 1000);
        const prev = LS.gameBestLow('ws-' + size); LS.gameBestLow('ws-' + size, s); bv.textContent = LS.gameBestLow('ws-' + size) + 's';
        msg.textContent = '🎉 You found them all in ' + s + ' seconds!' + (!prev || s < prev ? ' New best!' : '');
      } else msg.textContent = 'Found ' + hit.w + '! ✨';
      return true;
    }
    gridEl.addEventListener('pointerdown', (e) => { if (!game) return; const i = cellAt(e.clientX, e.clientY); if (i == null) return; e.preventDefault(); sel = { a: i, b: i, moved: false }; paint([i]); try { gridEl.setPointerCapture(e.pointerId); } catch (x) {} });
    gridEl.addEventListener('pointermove', (e) => { if (!sel) return; const i = cellAt(e.clientX, e.clientY); if (i == null || i === sel.b) return; sel.b = i; sel.moved = true; paint(line(sel.a, i) || [sel.a]); });
    const up = () => {
      if (!sel) return; const s = sel; sel = null;
      if (s.moved && s.a !== s.b) { tapStart = null; tryWord(line(s.a, s.b)); return; }
      // tap mode: first tap marks the start, second tap the end
      if (tapStart == null) { tapStart = s.a; paint([s.a]); return; }
      const a = tapStart; tapStart = null;
      if (a === s.a) { paint(null); return; }
      if (!tryWord(line(a, s.a))) { tapStart = s.a; paint([s.a]); }
    };
    gridEl.addEventListener('pointerup', up); gridEl.addEventListener('pointercancel', () => { sel = null; paint(null); });
    LS.gameCleanup(() => clearInterval(tmr));
    drawSeg(); newGame();
  }

  /* ======================= SIMON ======================= */
  function simon(body, actions) {
    const PADS = [{ c: '#34c759', f: 329.63, n: 'Green' }, { c: '#ff3b30', f: 440, n: 'Red' }, { c: '#ffcc00', f: 554.37, n: 'Yellow' }, { c: '#0a84ff', f: 659.25, n: 'Blue' }];
    let ac = null, seq = [], pos = 0, busy = true, alive = true, timers = [];
    const [sb, sv] = scoreBox('Score', 0), [bb, bv] = scoreBox('Best', LS.gameBest('simon'));
    const board = el('div', { class: 'sim-board' });
    const pads = PADS.map((p, i) => el('button', { class: 'sim-pad p' + i, style: '--c:' + p.c, 'aria-label': p.n, onpointerdown: (e) => { e.preventDefault(); press(i); } }));
    const center = el('button', { class: 'sim-center', text: 'Start', onclick: () => begin() });
    pads.forEach((p) => board.append(p)); board.append(center);
    board._state = () => ({ seq: seq.slice(), pos, busy }); // for tests
    const msg = el('div', { class: 'game-msg', text: 'Watch the colors, then copy them!' });
    body.append(el('div', { class: 'game-area sim-area' }, el('div', { class: 'score-row' }, sb, bb), board, msg));
    const later = (fn, ms) => { const t = setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); };
    function audio() { ac = LS.audioCtx ? LS.audioCtx() : null; return ac; } // shared context; follows Settings > Game Sounds
    function tone(f, ms, type) {
      const lvl = LS.soundLevel ? LS.soundLevel() : 1; if (!lvl) return;
      const a = audio(); if (!a) return;
      try {
        const o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.value = f;
        const t = a.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * lvl, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + ms / 1000 + 0.05);
      } catch (e) {}
    }
    function flash(i, ms) { const p = pads[i]; p.classList.add('lit'); tone(PADS[i].f, ms); later(() => p.classList.remove('lit'), ms); }
    function begin() { audio(); seq = []; sv.textContent = 0; center.textContent = '…'; msg.textContent = 'Watch…'; nextRound(); }
    function nextRound() {
      busy = true; pos = 0; seq.push(Math.floor(Math.random() * 4));
      const speed = Math.max(260, 620 - seq.length * 25);
      center.textContent = String(seq.length);
      seq.forEach((i, k) => later(() => flash(i, speed * 0.75), 600 + k * speed));
      later(() => { busy = false; msg.textContent = 'Your turn! (' + seq.length + ')'; }, 600 + seq.length * speed);
    }
    function press(i) {
      if (busy || !seq.length) { if (!seq.length) msg.textContent = 'Tap Start to play!'; return; }
      flash(i, 220);
      if (i !== seq[pos]) {
        busy = true; tone(110, 600, 'square');
        const score = seq.length - 1; LS.gameBest('simon', score); bv.textContent = LS.gameBest('simon');
        msg.textContent = 'Oops! You remembered ' + score + (score === 1 ? ' color' : ' colors') + '. Tap Start to try again.';
        center.textContent = 'Start'; seq = []; board.classList.add('shake'); later(() => board.classList.remove('shake'), 500);
        return;
      }
      pos++;
      if (pos === seq.length) { sv.textContent = seq.length; busy = true; msg.textContent = seq.length % 5 === 0 ? 'Wow, ' + seq.length + ' in a row! 🌟' : 'Nice! ✨'; later(nextRound, 700); }
    }
    LS.gameCleanup(() => { alive = false; timers.forEach(clearTimeout); }); // the shared AudioContext stays open
  }

  LS.addGame('wordsearch', { name: 'Word Search', emoji: '🔤', desc: 'Find hidden words', bg: 'linear-gradient(135deg,#00c7be,#007aff)', run: wordsearch, extra: true, hs: () => { const b = LS.gameBestLow('ws-8'); return b ? 'Small best: ' + b + 's' : 'No best yet'; } });
  LS.addGame('simon', { name: 'Simon', emoji: '🟢', desc: 'Copy the colors', bg: 'linear-gradient(135deg,#34c759,#ffcc00 50%,#ff3b30)', run: simon, extra: true, hs: () => 'Best: ' + LS.gameBest('simon') });
  LS.wordSearchMake = makeGrid; // exposed for tests
})();
