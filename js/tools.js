/* Tools: Calculator, Timer/Stopwatch, Drawing, Light */
(function () {
  'use strict';
  const { el, icon } = LS;

  /* ======================= CALCULATOR (iPhone-style, no eval) ======================= */
  function CalcEngine() {
    const st = { cur: '0', stack: [], waiting: false, repeat: null, error: false, lastOpKey: null };
    const prec = (o) => (o === '+' || o === '-' ? 1 : 2);
    const apply = (a, o, b) => { if (o === '/' && b === 0) throw new Error('div0'); const r = o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : a / b; return parseFloat(r.toPrecision(15)); };
    const num = () => parseFloat(st.cur);
    function setVal(v) { if (!isFinite(v)) throw new Error('inf'); st.cur = String(v); }
    function guard(fn) { if (st.error && fn !== 'clear') { reset(); } try { fn(); } catch (e) { reset(); st.error = true; st.cur = 'Error'; } }
    function reset() { st.cur = '0'; st.stack = []; st.waiting = false; st.repeat = null; st.error = false; st.lastOpKey = null; }
    return {
      st,
      digit(d) { guard(() => {
        if (st.waiting) { st.cur = d; st.waiting = false; st.lastOpKey = null; return; }
        if (st.cur.replace(/[-.]/g, '').length >= 9) return;
        st.cur = st.cur === '0' ? d : st.cur === '-0' ? '-' + d : st.cur + d;
      }); },
      dot() { guard(() => { if (st.waiting) { st.cur = '0.'; st.waiting = false; st.lastOpKey = null; return; } if (!st.cur.includes('.')) st.cur += '.'; }); },
      op(o) { guard(() => {
        if (st.waiting && st.stack.length && st.lastOpKey) { st.stack[st.stack.length - 1].op = o; st.lastOpKey = o; return; }
        let v = num();
        while (st.stack.length && prec(st.stack[st.stack.length - 1].op) >= prec(o)) { const t = st.stack.pop(); v = apply(t.v, t.op, v); }
        st.stack.push({ v, op: o }); setVal(v); st.waiting = true; st.lastOpKey = o; st.repeat = null;
      }); },
      equals() { guard(() => {
        if (st.stack.length) {
          let v = num(); const lastOp = st.stack[st.stack.length - 1].op; const operand = v;
          while (st.stack.length) { const t = st.stack.pop(); v = apply(t.v, t.op, v); }
          st.repeat = { op: lastOp, v: operand }; setVal(v);
        } else if (st.repeat) setVal(apply(num(), st.repeat.op, st.repeat.v));
        st.waiting = true; st.lastOpKey = null;
      }); },
      clear() { if (st.error) return reset(); if (st.cur !== '0' && !st.waiting) { st.cur = '0'; return; } reset(); },
      isAC() { return st.error || st.cur === '0' || st.waiting; },
      negate() { guard(() => {
        if (st.waiting && st.lastOpKey) { st.cur = '-0'; st.waiting = false; st.lastOpKey = null; return; }
        st.cur = st.cur.startsWith('-') ? st.cur.slice(1) : '-' + st.cur;
      }); },
      percent() { guard(() => {
        const top = st.stack[st.stack.length - 1];
        const v = top && (top.op === '+' || top.op === '-') && !st.lastOpKey ? top.v * num() / 100 : num() / 100;
        setVal(parseFloat(v.toPrecision(12))); st.waiting = true; st.lastOpKey = null;
      }); },
      back() { if (st.waiting || st.error) return; st.cur = st.cur.length > 1 && st.cur !== '-0' ? st.cur.slice(0, -1) : '0'; if (st.cur === '-') st.cur = '0'; },
      display() {
        if (st.error) return 'Error';
        const s = st.cur;
        if (st.waiting) {
          const n = parseFloat(s), a = Math.abs(n);
          if (a >= 1e9 || (a < 1e-8 && a !== 0)) return n.toExponential(5).replace(/\.?0+e/, 'e').replace('+', '');
          const intDigits = String(Math.trunc(a)).length;
          const out = n.toLocaleString('en-US', { maximumFractionDigits: Math.max(0, 9 - intDigits) });
          return (s.startsWith('-') && n === 0) ? '-0' : out;
        }
        const neg = s.startsWith('-'), body = neg ? s.slice(1) : s;
        const parts = body.split('.');
        const ip = Number(parts[0] || '0').toLocaleString('en-US');
        return (neg ? '-' : '') + ip + (parts.length > 1 ? '.' + parts[1] : '');
      }
    };
  }
  LS.CalcEngine = CalcEngine;

  LS.register('calculator', {
    title: 'Calculator', icon: 'calc', color: 'linear-gradient(135deg,#8e8e93,#3a3a3c)',
    open(body) {
      const E = CalcEngine();
      body.classList.add('calc-body'); LS.$('#appScreen').classList.add('calc-mode');
      const disp = el('div', { class: 'calc-display', 'aria-live': 'polite' });
      const keys = el('div', { class: 'calc-keys' });
      const layout = [['ac', 'fn', 'AC'], ['neg', 'fn', '+/−'], ['pct', 'fn', '%'], ['/', 'op', '÷'],
        ['7'], ['8'], ['9'], ['*', 'op', '×'], ['4'], ['5'], ['6'], ['-', 'op', '−'], ['1'], ['2'], ['3'], ['+', 'op', '+'],
        ['0', 'zero'], ['.', '', '.'], ['=', 'op eq', '=']];
      const btn = {};
      layout.forEach(([k, cls, label]) => { const b = el('button', { class: cls || '', 'data-k': k, text: label || k, 'aria-label': label || k }); btn[k] = b; keys.append(b); });
      body.append(el('div', { class: 'calc' }, disp, keys));
      function render() {
        const t = E.display(); disp.textContent = t;
        const len = t.length; disp.style.fontSize = (len <= 6 ? 84 : len <= 8 ? 70 : len <= 10 ? 58 : 46) + 'px';
        btn.ac.textContent = E.isAC() ? 'AC' : 'C';
        ['/', '*', '-', '+'].forEach((o) => btn[o].classList.toggle('sel', E.st.lastOpKey === o && E.st.waiting));
      }
      keys.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const k = b.dataset.k;
        if (/^\d$/.test(k)) E.digit(k); else if (k === '.') E.dot(); else if (k === 'ac') E.clear(); else if (k === 'neg') E.negate();
        else if (k === 'pct') E.percent(); else if (k === '=') E.equals(); else E.op(k);
        render();
      });
      let sx = null; // swipe on display to delete a digit, like iPhone
      disp.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      disp.addEventListener('touchend', (e) => { if (sx != null && Math.abs(e.changedTouches[0].clientX - sx) > 30) { E.back(); render(); } sx = null; });
      const onKey = (e) => {
        const m = { Enter: '=', '=': '=', Escape: 'ac', '%': 'pct', '.': '.', ',': '.', '+': '+', '-': '-', '*': '*', x: '*', '/': '/' }[e.key] || (/^\d$/.test(e.key) ? e.key : null);
        if (e.key === 'Backspace') { E.back(); render(); return; }
        if (m && btn[m]) { e.preventDefault(); btn[m].click(); }
      };
      document.addEventListener('keydown', onKey); this._off = () => document.removeEventListener('keydown', onKey);
      render();
    },
    close() { if (this._off) this._off(); LS.$('#appScreen').classList.remove('calc-mode'); }
  });

  /* ======================= TIMER + STOPWATCH ======================= */
  const T = { mode: 'timer', set: { h: 0, m: 5, s: 0 }, end: 0, remain: 0, running: false, tick: null,
    sw: { start: 0, acc: 0, running: false, laps: [] } };
  let tUI = null, audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      for (let i = 0; i < 6; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = i % 2 ? 1320 : 880; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.0001, t0 + i * 0.3); g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.3 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.25);
        o.start(t0 + i * 0.3); o.stop(t0 + i * 0.3 + 0.27);
      }
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }
  function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {} }
  const fmtHMS = (ms, cs) => {
    const tot = Math.max(0, ms), h = Math.floor(tot / 3600000), m = Math.floor(tot / 60000) % 60, s = Math.floor(tot / 1000) % 60, c = Math.floor(tot / 10) % 100;
    const p = (n) => String(n).padStart(2, '0');
    return cs ? (h ? h + ':' : '') + p(m) + ':' + p(s) + '.' + p(c) : (h ? h + ':' + p(m) : p(m)) + ':' + p(s);
  };
  function timerLoop() {
    clearInterval(T.tick);
    T.tick = setInterval(() => {
      if (T.running) {
        T.remain = T.end - Date.now();
        if (T.remain <= 0) { T.running = false; T.remain = 0; beep(); LS.toast("⏰ Time's up!", 4000); if (tUI) tUI.done(); }
      }
      if (tUI) tUI.update();
      if (!T.running && !T.sw.running && !tUI) { clearInterval(T.tick); T.tick = null; }
    }, 50);
  }
  LS.register('timer', {
    title: 'Timer', icon: 'timer', color: 'linear-gradient(135deg,#ff9500,#ff5e3a)',
    open(body) {
      body.classList.add('scroll');
      const wrap = el('div', { class: 'pad' });
      const seg = el('div', { class: 'seg', style: { marginBottom: '8px' } });
      const view = el('div');
      body.append(wrap); wrap.append(seg, view);
      ['timer', 'stopwatch'].forEach((m) => seg.append(el('button', { class: T.mode === m ? 'on' : '', text: m === 'timer' ? 'Timer' : 'Stopwatch', onclick: () => { T.mode = m; draw(); } })));
      function draw() {
        seg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', (i === 0) === (T.mode === 'timer')));
        view.innerHTML = ''; tUI = null;
        if (T.mode === 'timer') drawTimer(); else drawSW();
        timerLoop();
      }
      function drawTimer() {
        const big = el('div', { class: 'big-time' });
        const pick = el('div', { class: 'pickers' });
        const start = el('button', { class: 'circ go' }), cancel = el('button', { class: 'circ', text: 'Cancel' });
        const steppers = {};
        [['h', 'hours', 23], ['m', 'min', 59], ['s', 'sec', 59]].forEach(([k, lab, max]) => {
          const v = el('b', { text: String(T.set[k]).padStart(2, '0') });
          const st = el('div', { class: 'stepper' },
            el('button', { text: '+', 'aria-label': 'More ' + lab, onclick: () => { T.set[k] = (T.set[k] + (k === 'h' ? 1 : k === 'm' ? 1 : 5)) % (max + 1); upd(); } }), v,
            el('button', { text: '−', 'aria-label': 'Less ' + lab, onclick: () => { T.set[k] = (T.set[k] - (k === 's' ? 5 : 1) + max + 1) % (max + 1); upd(); } }));
          steppers[k] = v; pick.append(el('label', null, st, lab));
        });
        const presets = el('div', { class: 'presets' });
        [[1, '1 min'], [3, '3 min'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min']].forEach(([m, l]) => presets.append(el('button', { text: l, onclick: () => { T.set = { h: 0, m, s: 0 }; upd(); } })));
        const setMs = () => (T.set.h * 3600 + T.set.m * 60 + T.set.s) * 1000;
        function upd() {
          ['h', 'm', 's'].forEach((k) => { steppers[k].textContent = String(T.set[k]).padStart(2, '0'); });
          const active = T.running || T.remain > 0;
          pick.hidden = active; presets.hidden = active; big.hidden = !active;
          big.textContent = fmtHMS(T.running ? T.end - Date.now() + 999 : T.remain + 999);
          start.textContent = T.running ? 'Pause' : T.remain > 0 ? 'Resume' : 'Start';
          start.className = 'circ ' + (T.running ? 'stop' : 'go');
          cancel.disabled = !active;
        }
        start.onclick = () => {
          unlockAudio();
          if (T.running) { T.running = false; T.remain = T.end - Date.now(); }
          else { const ms = T.remain > 0 ? T.remain : setMs(); if (!ms) { LS.toast('Pick a time first'); return; } T.end = Date.now() + ms; T.remain = ms; T.running = true; }
          upd(); timerLoop();
        };
        cancel.onclick = () => { T.running = false; T.remain = 0; upd(); };
        view.append(big, pick, presets, el('div', { class: 'btn-row', style: { marginTop: '26px' } }, cancel, start));
        tUI = { update: upd, done: upd }; upd();
      }
      function drawSW() {
        const big = el('div', { class: 'big-time sw', text: '00:00.00' });
        const left = el('button', { class: 'circ' }), right = el('button', { class: 'circ go' });
        const laps = el('div', { class: 'laps' });
        const S = T.sw;
        const elapsed = () => S.acc + (S.running ? performance.now() - S.start : 0);
        function lapsDraw() {
          laps.innerHTML = '';
          S.laps.slice().reverse().forEach((l, i) => laps.append(el('div', null, el('span', { text: 'Lap ' + (S.laps.length - i) }), el('span', { text: fmtHMS(l, true) }))));
        }
        function upd() {
          big.textContent = fmtHMS(elapsed(), true);
          right.textContent = S.running ? 'Stop' : 'Start'; right.className = 'circ ' + (S.running ? 'stop' : 'go');
          left.textContent = S.running ? 'Lap' : 'Reset'; left.disabled = !S.running && !S.acc;
        }
        right.onclick = () => { if (S.running) { S.acc += performance.now() - S.start; S.running = false; } else { S.start = performance.now(); S.running = true; timerLoop(); } upd(); };
        left.onclick = () => {
          if (S.running) { const tot = elapsed(); const prev = S.laps.reduce((a, b) => a + b, 0); S.laps.push(tot - prev); lapsDraw(); }
          else { S.acc = 0; S.laps = []; lapsDraw(); }
          upd();
        };
        view.append(big, el('div', { class: 'btn-row' }, left, right), laps);
        tUI = { update: upd, done() {} }; lapsDraw(); upd();
      }
      draw();
    },
    close() { tUI = null; }
  });

  /* ======================= DRAWING ======================= */
  LS.register('draw', {
    title: 'Drawing', icon: 'draw', color: 'linear-gradient(135deg,#ff2d55,#af52de)',
    open(body, actions) {
      const wrap = el('div', { class: 'draw-wrap' });
      const cv = el('canvas', { 'aria-label': 'Drawing canvas' });
      wrap.append(cv);
      const bar = el('div', { class: 'draw-bar' });
      body.append(wrap, bar);
      const g = cv.getContext('2d');
      let color = '#1c1c1e', size = 8, drawing = false, lastPt = null, undo = [], dpr = 1;
      const COLORS = ['#1c1c1e', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff2d55', '#8e5a2b', '#ffffff'];
      COLORS.forEach((c) => bar.append(el('button', { class: 'swatch' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': c === '#ffffff' ? 'Eraser (white)' : 'Color', onclick: (e) => { color = c; bar.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === e.currentTarget)); } })));
      [[3, 5], [8, 9], [18, 14]].forEach(([s, d]) => bar.append(el('button', { class: 'size-btn' + (s === size ? ' on' : ''), 'aria-label': 'Brush ' + s, onclick: (e) => { size = s; bar.querySelectorAll('.size-btn').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } }, el('i', { style: { width: d + 'px', height: d + 'px' } }))));
      actions.append(
        el('button', { class: 'pill-btn', text: 'Undo', onclick: () => { const u = undo.pop(); if (u) g.putImageData(u, 0, 0); } }),
        el('button', { class: 'pill-btn danger', text: 'Clear', onclick: async () => { if (await LS.confirm('Clear drawing?', 'This erases the whole canvas.', 'Clear', true)) { snap(); fillWhite(); } } }),
        el('button', { class: 'pill-btn', text: 'Save', onclick: save }));
      function fillWhite() { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.restore(); }
      function size0() {
        const r = wrap.getBoundingClientRect(); dpr = Math.min(3, window.devicePixelRatio || 1);
        const old = cv.width ? g.getImageData(0, 0, cv.width, cv.height) : null;
        cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
        fillWhite(); if (old) g.putImageData(old, 0, 0);
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
      }
      requestAnimationFrame(size0);
      const ro = window.ResizeObserver ? new ResizeObserver(() => size0()) : null; if (ro) ro.observe(wrap);
      this._ro = ro;
      function snap() { try { undo.push(g.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 15) undo.shift(); } catch (e) {} }
      const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); snap(); drawing = true; lastPt = pt(e); g.fillStyle = color; g.beginPath(); g.arc(lastPt.x, lastPt.y, size / 2, 0, Math.PI * 2); g.fill(); });
      cv.addEventListener('pointermove', (e) => {
        if (!drawing) return; e.preventDefault();
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        g.strokeStyle = color; g.lineWidth = size;
        events.forEach((ev) => { const p = pt(ev); g.beginPath(); g.moveTo(lastPt.x, lastPt.y); g.lineTo(p.x, p.y); g.stroke(); lastPt = p; });
      });
      const end = () => { drawing = false; lastPt = null; };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
      function save() {
        cv.toBlob(async (blob) => {
          if (!blob) return;
          try { await LS.db.put('drawings', { id: LS.uid(), created: Date.now(), blob }); LS.toast('Drawing saved 🎨'); }
          catch (e) { LS.toast('Could not save the drawing'); }
        }, 'image/png');
      }
    },
    close() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }
  });

  /* ======================= LIGHT ======================= */
  let wakeLock = null;
  LS.register('light', {
    title: 'Light', icon: 'light', color: 'linear-gradient(135deg,#ffd60a,#ff9f0a)',
    open(body) {
      const L = el('div', { class: 'light' });
      const hint = el('div', { class: 'hint', text: 'Turn your screen brightness all the way up' });
      const ctl = el('div', { class: 'ctl' });
      [['#ffffff', 'White'], ['#fff4d6', 'Warm'], ['#ffd1d1', 'Soft red']].forEach(([c, n]) => ctl.append(el('button', { style: { background: c }, 'aria-label': n, onclick: (e) => { e.stopPropagation(); L.style.background = c; } })));
      const done = el('button', { class: 'light-done', text: 'Done', onclick: (e) => { e.stopPropagation(); LS.closeApp(); } });
      L.append(hint, ctl, done);
      L.addEventListener('click', () => L.classList.toggle('bare'));
      document.body.classList.add('light-on');
      body.append(L);
      LS.busy.add('light');
      if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then((w) => { wakeLock = w; }).catch(() => {});
    },
    close() { LS.busy.delete('light'); document.body.classList.remove('light-on'); if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  });
})();
