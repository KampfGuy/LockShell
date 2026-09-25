/* Screen Time: an optional daily ShellOS limit and an optional bedtime window, both set in Developer Tools.
   Time counts only while ShellOS is unlocked and on screen, and resets at local midnight.
   When time is up (or during bedtime) ShellOS locks and shows a full-screen notice; the normal passcode can't
   get past it. A small "Parent" button opens the same developer-code gate as Settings (hash check only). */
(function () {
  'use strict';
  const { el, icon } = LS;
  const KEY = 'lockshell.screentime.v1';
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const cfg = () => LS.settings.screen;
  let st = load(), lastTick = Date.now(), warned = false, ov = null;

  function load() {
    let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!o || o.day !== dayKey()) o = { day: dayKey(), usedMs: 0, bonusMs: 0, skipBedUntil: (o && o.skipBedUntil) || 0 };
    return o;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function rollover() { if (st.day !== dayKey()) { st = { day: dayKey(), usedMs: 0, bonusMs: 0, skipBedUntil: st.skipBedUntil || 0 }; warned = false; save(); } }
  const toMin = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  function fmtHM(hm) { const m = toMin(hm); if (m == null) return hm; const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function inBedtime(now) {
    const c = cfg(); if (!c.bedtime) return false;
    now = now || new Date();
    if (st.skipBedUntil && now.getTime() < st.skipBedUntil) return false;
    const a = toMin(c.bedStart), b = toMin(c.bedEnd); if (a == null || b == null || a === b) return false;
    const m = now.getHours() * 60 + now.getMinutes();
    return a < b ? (m >= a && m < b) : (m >= a || m < b);
  }
  // When the current bedtime window ends (ms timestamp).
  function bedEndsAt(now) {
    now = now || new Date(); const b = toMin(cfg().bedEnd); const d = new Date(now); d.setHours(Math.floor(b / 60), b % 60, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); return d.getTime();
  }
  const limitMs = () => { const m = Number(cfg().limitMin) || 0; return m > 0 ? m * 60000 + (st.bonusMs || 0) : Infinity; };
  const remainingMs = () => { rollover(); return Math.max(0, limitMs() - st.usedMs); };
  function blocked() {
    rollover();
    if (inBedtime()) return 'bedtime';
    if (limitMs() !== Infinity && st.usedMs >= limitMs()) return 'limit';
    return null;
  }
  const fmtLeft = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min'; };

  LS.screenTime = {
    usedMs: () => { rollover(); return st.usedMs; }, limitMs, remainingMs, blocked, inBedtime, fmtHM, fmtLeft, dayKey,
    addMinutes(min) { rollover(); st.bonusMs = (st.bonusMs || 0) + min * 60000; save(); check(); },
    resetToday() { st = { day: dayKey(), usedMs: 0, bonusMs: 0, skipBedUntil: st.skipBedUntil || 0 }; warned = false; save(); check(); },
    skipBedtimeTonight() { st.skipBedUntil = bedEndsAt(); save(); check(); },
    clearSkip() { st.skipBedUntil = 0; save(); check(); },
    skipping: () => !!(st.skipBedUntil && Date.now() < st.skipBedUntil),
    // test hook: pretend this much time was already used today
    _setUsed(ms) { rollover(); st.usedMs = ms; save(); check(); },
    _reload() { st = load(); check(); }
  };
  LS.timeBlocked = () => !!blocked() && !LS.devActive;

  /* ---------- Full-screen notice ---------- */
  function build(reason) {
    if (!ov) { ov = document.getElementById('timeUp'); if (!ov) return; }
    const bed = reason === 'bedtime';
    const until = bed ? 'ShellOS wakes up at ' + fmtHM(cfg().bedEnd) + '.' : 'ShellOS will be ready again tomorrow.';
    ov.innerHTML = '';
    ov.dataset.reason = reason;
    ov.append(el('div', { class: 'tu-card' },
      el('div', { class: 'tu-emoji', text: bed ? '🌙' : '⏰' }),
      el('h2', { text: bed ? 'Time to rest' : 'Screen time is done for today' }),
      el('p', { text: bed ? "It's bedtime, so ShellOS is sleeping too. Sweet dreams!" : 'Great job today! Time to play, read a book, or go outside.' }),
      el('p', { class: 'tu-until', text: until }),
      el('div', { class: 'tu-clock', id: 'tuClock' })),
    el('button', { class: 'tu-parent', 'aria-label': 'Parent', text: 'Parent', onclick: () => LS.openDevGate() }));
    clock();
  }
  function clock() { const c = document.getElementById('tuClock'); if (c) c.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  LS.showTimeUp = function () {
    const r = blocked(); if (!r) return;
    if (!LS.isLocked()) LS.goLock();
    if (!ov) ov = document.getElementById('timeUp');
    if (!ov) return;
    if (ov.hidden || ov.dataset.reason !== r) build(r);
    ov.hidden = false;
  };
  function hideTimeUp() { if (!ov) ov = document.getElementById('timeUp'); if (ov && !ov.hidden) { ov.hidden = true; ov.innerHTML = ''; delete ov.dataset.reason; } }

  /* ---------- Lock screen hint ---------- */
  function lockHint() {
    const h = document.getElementById('lockLimit'); if (!h) return;
    const parts = [];
    if (limitMs() !== Infinity) parts.push(remainingMs() > 0 ? fmtLeft(remainingMs()) + ' of screen time left today' : 'No screen time left today');
    if (cfg().bedtime) parts.push('Bedtime ' + fmtHM(cfg().bedStart) + '–' + fmtHM(cfg().bedEnd));
    h.textContent = parts.join(' · ');
    h.hidden = !parts.length;
  }

  function check() {
    const r = blocked();
    if (r && !LS.devActive) LS.showTimeUp();
    else hideTimeUp();
    lockHint();
  }
  LS.screenTimeCheck = check;

  /* ---------- Counting ---------- */
  setInterval(() => {
    const now = Date.now(), dt = Math.min(5000, Math.max(0, now - lastTick)); lastTick = now;
    rollover();
    if (!document.hidden && !LS.isLocked() && !LS.devActive) {
      st.usedMs += dt;
      if ((st.usedMs / 1000 | 0) % 5 === 0) save();
      const left = remainingMs();
      if (left !== Infinity && left > 0 && left <= 5 * 60000 && !warned) { warned = true; LS.toast('5 minutes of screen time left today'); }
    }
    check(); clock();
  }, 1000);
  document.addEventListener('visibilitychange', () => { lastTick = Date.now(); save(); });
  LS.onLock.push(() => save());
  LS.onRoute.push(check);
  window.addEventListener('load', check);
  setTimeout(check, 0);
})();
