/* Extra apps (added from Developer Tools): Piano, Calendar, Dice & Coin */
(function () {
  'use strict';
  const { el, icon } = LS;

  /* ======================= PIANO ======================= */
  let actx = null;
  function audio() {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function unlockAudio() { // iOS: start audio inside the first tap
    const a = audio(); if (!a) return;
    try { const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } catch (e) {}
  }
  const SOUNDS = {
    piano: { waves: [['triangle', 1, 0.55], ['sine', 2, 0.18], ['sine', 3, 0.06]], attack: 0.005, decay: 1.6, sustain: 0.0001 },
    organ: { waves: [['sine', 1, 0.4], ['sine', 2, 0.25], ['sine', 4, 0.12]], attack: 0.02, decay: 0, sustain: 0.35 },
    chip: { waves: [['square', 1, 0.16]], attack: 0.003, decay: 0.4, sustain: 0.05 }
  };
  function noteOn(freq, kind) {
    const a = audio(); if (!a) return null;
    const S = SOUNDS[kind] || SOUNDS.piano, t = a.currentTime, out = a.createGain();
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.5, t + S.attack);
    if (S.decay) out.gain.exponentialRampToValueAtTime(Math.max(0.0001, S.sustain), t + S.attack + S.decay); else out.gain.setValueAtTime(S.sustain, t + S.attack);
    out.connect(a.destination);
    const oscs = S.waves.map(([type, mult, vol]) => { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq * mult; g.gain.value = vol; o.connect(g); g.connect(out); o.start(t); return o; });
    return { stop() { const n = a.currentTime; out.gain.cancelScheduledValues(n); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), n); out.gain.exponentialRampToValueAtTime(0.0001, n + 0.25); oscs.forEach((o) => o.stop(n + 0.3)); } };
  }
  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  LS.register('piano', {
    title: 'Piano', icon: 'piano', color: 'linear-gradient(135deg,#3a3a3c,#000000)', extra: true,
    open(body, actions) {
      body.classList.add('piano-body');
      let kind = localStorage.getItem('lockshell.piano.sound') || 'piano';
      const seg = el('div', { class: 'seg' });
      [['piano', 'Piano'], ['organ', 'Organ'], ['chip', 'Chiptune']].forEach(([k, l]) => seg.append(el('button', { class: k === kind ? 'on' : '', text: l, onclick: (e) => { kind = k; localStorage.setItem('lockshell.piano.sound', k); seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } })));
      const wrap = el('div', { class: 'piano-wrap' });
      body.append(el('div', { class: 'pad', style: { paddingBottom: '6px' } }, seg), wrap);
      // Two octaves stacked as two rows so keys are big enough on a phone: C5 row on top, C4 row below.
      [72, 60].forEach((base) => {
        const oct = el('div', { class: 'octave' });
        const whites = [0, 2, 4, 5, 7, 9, 11], blacks = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
        whites.forEach((s) => oct.append(el('div', { class: 'wkey', 'data-m': base + s }, el('span', { text: NAMES[s] + (base / 12 - 1) }))));
        Object.keys(blacks).forEach((s) => { const k = el('div', { class: 'bkey', 'data-m': base + (+s) }); k.style.left = `calc(${(blacks[s] + 1) * (100 / 7)}% - 6.5%)`; oct.append(k); });
        wrap.append(oct);
      });
      const active = new Map(); // pointerId -> {key, voice}
      const keyAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest && e.closest('.wkey,.bkey'); };
      function press(id, key) {
        release(id); if (!key) return;
        const v = noteOn(freqOf(+key.dataset.m), kind); key.classList.add('down'); active.set(id, { key, v });
      }
      function release(id) { const a = active.get(id); if (!a) return; if (a.v) a.v.stop(); if (![...active.entries()].some(([k, o]) => k !== id && o.key === a.key)) a.key.classList.remove('down'); active.delete(id); }
      wrap.addEventListener('pointerdown', (e) => { e.preventDefault(); unlockAudio(); press(e.pointerId, keyAt(e.clientX, e.clientY)); });
      wrap.addEventListener('pointermove', (e) => { if (!active.has(e.pointerId)) return; const k = keyAt(e.clientX, e.clientY); if (k && k !== active.get(e.pointerId).key) press(e.pointerId, k); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => wrap.addEventListener(ev, (e) => release(e.pointerId)));
      this._stop = () => { [...active.keys()].forEach(release); };
    },
    close() { if (this._stop) this._stop(); }
  });

  /* ======================= CALENDAR ======================= */
  const CKEY = 'lockshell.calendar.v1';
  const loadEv = () => { try { return JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { return {}; } };
  const saveEv = (o) => localStorage.setItem(CKEY, JSON.stringify(o));
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  LS.register('calendar', {
    title: 'Calendar', icon: 'calendar', color: 'linear-gradient(135deg,#ff3b30,#ff6961)', extra: true,
    open(body, actions) {
      body.classList.add('scroll');
      const today = new Date(); let view = new Date(today.getFullYear(), today.getMonth(), 1), sel = ymd(today);
      const wrap = el('div', { class: 'pad cal' });
      body.append(wrap);
      actions.append(el('button', { class: 'pill-btn', text: 'Today', onclick: () => { view = new Date(today.getFullYear(), today.getMonth(), 1); sel = ymd(today); draw(); } }));
      function draw() {
        const ev = loadEv(); wrap.innerHTML = '';
        const head = el('div', { class: 'cal-head' },
          el('button', { class: 'icon-btn', 'aria-label': 'Previous month', html: icon('back'), onclick: () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw(); } }),
          el('h2', { text: view.toLocaleDateString([], { month: 'long', year: 'numeric' }) }),
          el('button', { class: 'icon-btn flip-x', 'aria-label': 'Next month', html: icon('chevron'), onclick: () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw(); } }));
        const grid = el('div', { class: 'cal-grid' });
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => grid.append(el('div', { class: 'cal-dow', text: d })));
        const first = view.getDay(), days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
        for (let i = 0; i < first; i++) grid.append(el('div'));
        for (let d = 1; d <= days; d++) {
          const key = ymd(new Date(view.getFullYear(), view.getMonth(), d));
          const b = el('button', { class: 'cal-day' + (key === ymd(today) ? ' today' : '') + (key === sel ? ' sel' : ''), 'data-date': key, onclick: () => { sel = key; draw(); } }, el('span', { text: d }));
          if (ev[key] && ev[key].length) b.append(el('i'));
          grid.append(b);
        }
        const selD = new Date(sel + 'T12:00');
        const list = el('div', { class: 'list' });
        const items = (ev[sel] || []).slice().sort((a, c) => (a.time || '99').localeCompare(c.time || '99'));
        if (!items.length) list.append(el('p', { class: 'muted', style: { textAlign: 'center', margin: '8px 0' }, text: 'No events' }));
        items.forEach((it) => list.append(el('div', { class: 'item' },
          el('div', { class: 'cal-time', text: it.time ? new Date('2000-01-01T' + it.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All day' }),
          el('div', { class: 'meta' }, el('b', { text: it.title })),
          el('button', { class: 'icon-btn', 'aria-label': 'Delete event', html: icon('trash'), onclick: () => { const o = loadEv(); o[sel] = (o[sel] || []).filter((x) => x.id !== it.id); if (!o[sel].length) delete o[sel]; saveEv(o); draw(); } }))));
        wrap.append(head, el('div', { class: 'card cal-card' }, grid),
          el('div', { class: 'section-title', text: selD.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) }), list,
          el('button', { class: 'primary-btn', style: { marginTop: '14px' }, text: '+ Add event', onclick: addEvent }));
      }
      function addEvent() {
        LS.modal((sh, close) => {
          const t = el('input', { class: 'txt-in', type: 'text', placeholder: 'Event name', maxlength: 80 });
          const tm = el('input', { class: 'txt-in', type: 'time', style: { marginTop: '10px' } });
          const ok = () => { const title = t.value.trim(); if (!title) { t.focus(); return; } const o = loadEv(); (o[sel] = o[sel] || []).push({ id: LS.uid(), title, time: tm.value || '' }); saveEv(o); close(); draw(); };
          sh.append(el('h2', { text: 'New event' }), el('p', { class: 'muted', text: new Date(sel + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) }), t, tm,
            el('p', { class: 'muted', style: { fontSize: '13px' }, text: 'Time is optional.' }),
            el('div', { class: 'btns' }, el('button', { class: 'ghost-btn', text: 'Cancel', onclick: close }), el('button', { class: 'primary-btn', text: 'Add', onclick: ok })));
          t.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
          setTimeout(() => t.focus(), 60);
        });
      }
      draw();
    }
  });

  /* ======================= DICE & COIN ======================= */
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function dieFace(n) { const f = el('div', { class: 'die' }); for (let i = 0; i < 9; i++) f.append(el('i', { class: PIPS[n].includes(i) ? 'on' : '' })); f.setAttribute('aria-label', 'Die showing ' + n); return f; }
  LS.register('dice', {
    title: 'Dice & Coin', label: 'Dice', icon: 'dice', color: 'linear-gradient(135deg,#30d158,#0a9f3a)', extra: true,
    open(body) {
      body.classList.add('scroll');
      let mode = 'dice', count = +(localStorage.getItem('lockshell.dice.count') || 2), coinTally = { h: 0, t: 0 }, rolling = false;
      const wrap = el('div', { class: 'pad dice-app' }); body.append(wrap);
      const seg = el('div', { class: 'seg' });
      [['dice', 'Dice'], ['coin', 'Coin']].forEach(([k, l]) => seg.append(el('button', { class: k === mode ? 'on' : '', text: l, onclick: (e) => { mode = k; seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); draw(); } })));
      const view = el('div'); wrap.append(seg, view);
      function draw() { view.innerHTML = ''; if (mode === 'dice') drawDice(); else drawCoin(); }
      function drawDice() {
        const cnt = el('div', { class: 'presets', style: { margin: '14px 0' } });
        for (let i = 1; i <= 6; i++) cnt.append(el('button', { class: i === count ? 'on' : '', text: i + (i === 1 ? ' die' : ' dice'), onclick: () => { count = i; localStorage.setItem('lockshell.dice.count', i); draw(); } }));
        const tray = el('div', { class: 'dice-tray' });
        const total = el('div', { class: 'dice-total', text: 'Tap Roll!' });
        for (let i = 0; i < count; i++) tray.append(dieFace(1 + ((i * 2) % 6)));
        const roll = el('button', { class: 'primary-btn big-roll', text: '🎲 Roll' });
        roll.onclick = () => {
          if (rolling) return; rolling = true; total.textContent = 'Rolling…';
          const faces = [...tray.children]; let n = 0;
          faces.forEach((f) => f.classList.add('rolling'));
          const iv = setInterval(() => {
            n++;
            faces.forEach((f, i) => { const v = 1 + Math.floor(Math.random() * 6); const nf = dieFace(v); nf.classList.add('rolling'); tray.replaceChild(nf, tray.children[i]); });
            if (n >= 9) {
              clearInterval(iv);
              const vals = [...tray.children].map((f) => { f.classList.remove('rolling'); f.classList.add('landed'); return f.querySelectorAll('i.on').length; });
              total.textContent = count === 1 ? 'You rolled ' + vals[0] : 'Total: ' + vals.reduce((a, b) => a + b, 0) + '  (' + vals.join(' + ') + ')';
              if (navigator.vibrate) navigator.vibrate(30); rolling = false;
            }
          }, 70);
        };
        view.append(cnt, tray, total, roll);
      }
      function drawCoin() {
        const coin = el('div', { class: 'coin' }, el('div', { class: 'coin-face heads', text: 'H' }), el('div', { class: 'coin-face tails', text: 'T' }));
        const res = el('div', { class: 'dice-total', text: 'Tap Flip!' });
        const tally = el('div', { class: 'coin-tally muted', text: `Heads ${coinTally.h} · Tails ${coinTally.t}` });
        let rot = 0;
        const flip = el('button', { class: 'primary-btn big-roll', text: '🪙 Flip' });
        flip.onclick = () => {
          if (rolling) return; rolling = true; res.textContent = 'Flipping…';
          const heads = Math.random() < 0.5; rot += 1800 + (heads ? (rot % 360 === 0 ? 0 : 180) : (rot % 360 === 0 ? 180 : 0));
          coin.style.transform = `rotateY(${rot}deg)`;
          setTimeout(() => { const isHeads = rot % 360 === 0; if (isHeads) coinTally.h++; else coinTally.t++; res.textContent = isHeads ? 'Heads!' : 'Tails!'; tally.textContent = `Heads ${coinTally.h} · Tails ${coinTally.t}`; rolling = false; }, 1250);
        };
        view.append(el('div', { class: 'coin-stage' }, coin), res, tally, flip);
      }
      draw();
    }
  });
})();
