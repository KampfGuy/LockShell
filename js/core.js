/* LockShell core: state, storage, passcode, router, idle, UI helpers */
(function () {
  'use strict';
  const LS = (window.LS = {});
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  LS.$ = $; LS.$$ = $$;

  LS.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
  };
  LS.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Icons ---------- */
  const P = {
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.8"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"/>',
    notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7M9 8h3"/>',
    games: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5V6"/>',
    light: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    draw: '<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
    chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
    weather: '<circle cx="8" cy="8.5" r="3.2"/><path d="M8 2.5v1.4M8 13.1v1.4M2.5 8.5h1.4M12.1 8.5h1.4M4.4 4.9l1 1M10.6 11.1l1 1M11.6 4.9l-1 1M4.4 12.1l1-1"/><path d="M17.5 12a4 4 0 0 0-7.7 1.3A3.2 3.2 0 0 0 10 19.5h7.5a3.5 3.5 0 0 0 0-7z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    flip: '<path d="M4 7h11a4 4 0 0 1 4 4v1M20 17H9a4 4 0 0 1-4-4v-1"/><path d="M16 4l3 3-3 3M8 20l-3-3 3-3"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="#fff"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  LS.icon = (name, extra) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra || ''}>${P[name] || ''}</svg>`;

  /* ---------- Settings ---------- */
  const SKEY = 'lockshell.settings.v2';
  const DEFAULTS = {
    theme: 'light', idleMin: 2, hidden: [], weatherUnit: 'F',
    buddy: { speak: false, voiceURI: '', rate: 1, pitch: 1, style: 'friendly' },
    wakeWord: false, lastWeather: null, lastCity: ''
  };
  LS.settings = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const saved = JSON.parse(localStorage.getItem(SKEY) || '{}');
    Object.assign(LS.settings, saved);
    LS.settings.buddy = Object.assign({}, DEFAULTS.buddy, saved.buddy || {});
  } catch (e) {}
  LS.saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(LS.settings)); } catch (e) {} };
  LS.applyTheme = () => { document.documentElement.setAttribute('data-theme', LS.settings.theme === 'dark' ? 'dark' : 'light'); const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', LS.settings.theme === 'dark' ? '#000000' : '#f2f2f7'); };

  /* ---------- IndexedDB ---------- */
  const DBN = 'lockshell', DBV = 1, STORES = ['photos', 'recordings', 'notes'];
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB unavailable'));
      const r = indexedDB.open(DBN, DBV);
      r.onupgradeneeded = () => { STORES.forEach((s) => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(store, mode), s = t.objectStore(store);
      let out; const r = fn(s);
      if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  LS.db = {
    put: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
    get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
    del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
    all: (store) => tx(store, 'readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => (y.updated || y.created) - (x.updated || x.created))),
    clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
    count: (store) => tx(store, 'readonly', (s) => s.count())
  };
  LS.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- Passcode (SHA-256 + salt; default 1234) ---------- */
  const PKEY = 'lockshell.pin.v1';
  function sha256Fallback(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    const mp = Math.pow, maxWord = mp(2, 32); let result = '', words = [], asciiBitLength = ascii.length * 8;
    let hash = [], k = [], primeCounter = 0; const isComposite = {};
    for (let c = 2; primeCounter < 64; c++) { if (!isComposite[c]) { for (let i = 0; i < 313; i += c) isComposite[i] = c; hash[primeCounter] = (mp(c, .5) * maxWord) | 0; k[primeCounter++] = (mp(c, 1 / 3) * maxWord) | 0; } }
    hash = hash.slice(0, 8); ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) { const j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((asciiBitLength / maxWord) | 0); words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16), oldHash = hash; hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }
  async function sha256(str) {
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return sha256Fallback(unescape(encodeURIComponent(str)));
  }
  LS.sha256 = sha256;
  function pinRec() { try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) { return null; } }
  LS.pinLen = () => (pinRec() ? pinRec().len : 4);
  LS.setPin = async (pin) => {
    const salt = (window.crypto && crypto.getRandomValues)
      ? Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('')
      : String(Math.random()) + Date.now();
    const hash = await sha256(salt + ':' + pin);
    localStorage.setItem(PKEY, JSON.stringify({ salt, hash, len: pin.length }));
  };
  LS.checkPin = async (pin) => { const r = pinRec(); if (!r) return false; return (await sha256(r.salt + ':' + pin)) === r.hash; };
  LS.ensureDefaultPin = async () => { if (!pinRec()) await LS.setPin('1234'); };

  /* ---------- Toast / flash / modal ---------- */
  let tt;
  LS.toast = (msg, ms) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), ms || 2200); };
  LS.flash = () => { const f = $('#flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); };
  LS.modal = function (build) {
    const m = $('#modal'), sh = $('#modalSheet');
    sh.innerHTML = ''; const close = () => { m.hidden = true; sh.innerHTML = ''; };
    build(sh, close); m.hidden = false;
    m.onclick = (e) => { if (e.target === m) close(); };
    return close;
  };
  LS.closeModal = () => { $('#modal').hidden = true; $('#modalSheet').innerHTML = ''; };
  LS.confirm = (title, msg, okLabel, danger) => new Promise((res) => {
    LS.modal((sh, close) => {
      sh.append(LS.el('h2', { text: title }), LS.el('p', { class: 'muted', text: msg }),
        LS.el('div', { class: 'btns' },
          LS.el('button', { class: 'ghost-btn', text: 'Cancel', onclick: () => { close(); res(false); } }),
          LS.el('button', { class: 'ghost-btn' + (danger ? ' danger-btn' : ''), text: okLabel || 'OK', onclick: () => { close(); res(true); } })));
    });
  });
  LS.prompt = (title, opts) => new Promise((res) => {
    opts = opts || {};
    LS.modal((sh, close) => {
      const inp = LS.el('input', { class: 'txt-in', type: opts.type || 'text', inputmode: opts.inputmode || '', placeholder: opts.placeholder || '', value: opts.value || '', maxlength: opts.maxlength || 200 });
      sh.append(LS.el('h2', { text: title }), opts.msg ? LS.el('p', { class: 'muted', text: opts.msg }) : '', inp,
        LS.el('div', { class: 'btns' },
          LS.el('button', { class: 'ghost-btn', text: 'Cancel', onclick: () => { close(); res(null); } }),
          LS.el('button', { class: 'primary-btn', text: opts.ok || 'OK', onclick: () => { const v = inp.value.trim(); close(); res(v); } })));
      setTimeout(() => inp.focus(), 60);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = inp.value.trim(); close(); res(v); } });
    });
  });

  /* ---------- Passcode pad builder ---------- */
  LS.makePad = function (onPress, opts) {
    opts = opts || {};
    const pad = LS.el('div', { class: 'pin-pad' });
    const sub = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
    for (let n = 1; n <= 9; n++) pad.append(LS.el('button', { 'data-k': n, html: n + (sub[n - 1] ? '<small>' + sub[n - 1] + '</small>' : '') }));
    pad.append(opts.cancel ? LS.el('button', { 'data-k': 'cancel', class: 'txt', text: 'Cancel' }) : LS.el('span'));
    pad.append(LS.el('button', { 'data-k': 0, text: '0' }));
    pad.append(LS.el('button', { 'data-k': 'back', class: 'txt', 'aria-label': 'Delete', html: '&#9003;' }));
    pad.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { LS.bumpIdle(); onPress(b.dataset.k); } });
    return pad;
  };

  /* ---------- Passcode overlay (verify / setup) ---------- */
  LS.pinPad = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const ov = $('#pinOverlay');
      ov.innerHTML = '';
      const setup = opts.mode === 'setup';
      let entry = '', first = null, busy = false, fails = 0;
      const maxLen = 6, minLen = 4;
      const icon = LS.el('div', { class: 'pin-icon', html: LS.icon(setup ? 'key' : 'lock') });
      const title = LS.el('h2', { text: setup ? (opts.title || 'New passcode') : (opts.title || 'Enter passcode') });
      const sub = LS.el('p', { class: 'pin-sub', text: setup ? (opts.sub || 'Choose 4 to 6 digits') : (opts.sub || '') });
      const dots = LS.el('div', { class: 'pin-dots' });
      const next = LS.el('button', { class: 'primary-btn', text: 'Continue', hidden: true });
      const pad = LS.makePad(press, { cancel: !opts.noCancel });
      const card = LS.el('div', { class: 'pin-card' }, icon, title, sub, dots, pad, next);
      ov.append(card);
      function stage(t, s, err) { title.textContent = t; sub.textContent = s || ''; sub.classList.toggle('err', !!err); }
      function render() {
        const n = setup ? Math.max(minLen, entry.length) : LS.pinLen();
        dots.innerHTML = '';
        for (let i = 0; i < n; i++) dots.append(LS.el('i', { class: i < entry.length ? 'on' : '' }));
        next.hidden = !(setup && entry.length >= minLen);
      }
      function shake() { dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(120); }
      function done(v) { ov.hidden = true; ov.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); }
      async function submitVerify() {
        busy = true; const ok = await LS.checkPin(entry); busy = false;
        if (ok) return done(true);
        fails++; entry = ''; shake(); render();
        if (fails >= 5) { stage('Too many tries', 'Wait 30 seconds', true); busy = true; setTimeout(() => { busy = false; fails = 3; stage(opts.title || 'Enter passcode', opts.sub || ''); }, 30000); }
        else stage(opts.title || 'Enter passcode', 'Wrong passcode, try again', true);
      }
      async function submitSetup() {
        if (entry.length < minLen) return;
        if (first === null) { first = entry; entry = ''; stage('Confirm passcode', 'Enter it again'); render(); return; }
        if (first !== entry) { first = null; entry = ''; shake(); stage('New passcode', 'Did not match, start again', true); render(); return; }
        busy = true; await LS.setPin(entry); busy = false; done(true);
      }
      function press(k) {
        if (busy) return;
        if (k === 'cancel') return done(false);
        if (k === 'back') { entry = entry.slice(0, -1); render(); return; }
        if (!/^\d$/.test(k) || entry.length >= maxLen) return;
        entry += k; render();
        if (!setup && entry.length === LS.pinLen()) setTimeout(submitVerify, 90);
      }
      next.onclick = () => { if (!busy) submitSetup(); };
      function onKey(e) { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('back'); else if (e.key === 'Enter' && setup) submitSetup(); else if (e.key === 'Escape' && !opts.noCancel) press('cancel'); }
      document.addEventListener('keydown', onKey);
      render(); ov.hidden = false;
    });
  };
  LS.requirePin = (why) => LS.pinPad({ mode: 'verify', title: 'Enter passcode', sub: why || '' });

  /* ---------- App registry + router ---------- */
  LS.apps = {};
  LS.homeOrder = ['buddy', 'camera', 'recorder', 'notes', 'weather', 'games', 'calculator', 'timer', 'draw', 'light', 'settings'];
  LS.register = (id, def) => { LS.apps[id] = def; };
  let current = null;
  LS.current = () => current;
  function show(id) { $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }
  LS.showScreen = show;
  LS.openApp = function (id, arg) {
    const app = LS.apps[id]; if (!app) return;
    if (current && current.id !== id) LS.closeApp(true);
    const body = $('#appBody'), actions = $('#appActions');
    body.innerHTML = ''; actions.innerHTML = ''; body.className = 'app-body';
    $('#appTitle').textContent = app.title;
    current = { id, app };
    show('appScreen');
    try { app.open(body, actions, arg); } catch (e) { console.warn(e); body.append(LS.notice('⚠️', 'Something went wrong', 'This tool could not start on this device.')); }
    LS.bumpIdle();
  };
  LS.appBack = function () {
    if (current && current.app.back && current.app.back()) return;
    LS.closeApp();
  };
  LS.closeApp = function (silent) {
    if (current && current.app.close) { try { current.app.close(); } catch (e) {} }
    current = null;
    $('#appBody').innerHTML = '';
    if (!silent) { show('home'); LS.renderHome && LS.renderHome(); }
  };
  LS.onLock = [];
  LS.goLock = function () {
    LS.closeApp(true);
    LS.closeModal();
    if (!$('#pinOverlay').hidden) { $('#pinOverlay').hidden = true; $('#pinOverlay').innerHTML = ''; }
    LS.onLock.forEach((f) => { try { f(); } catch (e) {} });
    show('lock');
    LS.resetLockEntry && LS.resetLockEntry();
  };
  LS.unlock = function () {
    show('home');
    LS.renderHome && LS.renderHome();
    LS.onUnlock && LS.onUnlock.forEach((f) => { try { f(); } catch (e) {} });
    LS.bumpIdle();
  };
  LS.onUnlock = [];

  LS.notice = (emoji, title, text, btn) => {
    const n = LS.el('div', { class: 'notice' }, LS.el('div', { class: 'big', text: emoji }), LS.el('h3', { text: title }), LS.el('p', { text: text }));
    if (btn) n.append(LS.el('button', { class: 'primary-btn', style: { marginTop: '14px' }, text: btn.label, onclick: btn.onclick }));
    return LS.el('div', { class: 'center', style: { flex: '1', display: 'flex' } }, n);
  };

  /* ---------- Idle timer ---------- */
  let last = Date.now();
  LS.bumpIdle = () => { last = Date.now(); };
  LS.idleBusy = () => false;
  setInterval(() => {
    const onLock = $('#lock').classList.contains('active');
    if (onLock) { last = Date.now(); return; }
    const min = LS.settings.idleMin;
    if (min === 0 || min === 'never') return;
    const limit = Math.max(0.5, Number(min) || 2) * 60000;
    if (Date.now() - last > limit && !LS.idleBusy()) { LS.goLock(); LS.toast('Locked (idle)'); }
  }, 4000);
  ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((ev) => document.addEventListener(ev, LS.bumpIdle, { passive: true, capture: true }));

  /* ---------- Swipe helper ---------- */
  LS.onSwipe = function (el, cb) {
    let sx = 0, sy = 0, active = false;
    el.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; active = true; }, { passive: true });
    el.addEventListener('touchmove', (e) => { if (active) e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', (e) => {
      if (!active) return; active = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    const keyh = (e) => { const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (m && document.body.contains(el)) { e.preventDefault(); cb(m); } };
    document.addEventListener('keydown', keyh);
    return () => document.removeEventListener('keydown', keyh);
  };

  LS.fmtDur = (ms) => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  LS.fmtDate = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
})();
