/* Developer Tools: opened only from Settings > Developer with the developer code.
   The code itself is never stored in plain text: only its SHA-256 hash lives here. */
(function () {
  'use strict';
  const { el, icon } = LS;
  const DEV_HASH = '2a520b20ce6a02bf4eb4e26fff0c9f0cd0087cd15f6682aa68a888d4203b7900';
  let granted = false, root = null, gateFails = 0, gateWaitUntil = 0;

  /* ---------- Code gate (Settings only; the lock screen never checks this code) ---------- */
  LS.openDevGate = function () {
    const ov = LS.$('#pinOverlay'); ov.innerHTML = '';
    let entry = '', busy = false;
    const dots = el('div', { class: 'pin-dots dev-dots' });
    const enter = el('button', { class: 'primary-btn', text: 'Enter', disabled: true });
    const pad = LS.makePad(press, { cancel: true });
    ov.append(el('div', { class: 'pin-card' }, el('div', { class: 'pin-icon', html: icon('code') }), el('h2', { text: 'Developer' }), el('p', { class: 'pin-sub', text: 'Enter code' }), dots, pad, enter));
    function render() { dots.innerHTML = ''; for (let i = 0; i < Math.max(1, entry.length); i++) dots.append(el('i', { class: i < entry.length ? 'on' : 'ghost' })); enter.disabled = !entry.length; }
    function close() { ov.hidden = true; ov.innerHTML = ''; document.removeEventListener('keydown', onKey); }
    async function submit() {
      if (busy || !entry) return;
      if (Date.now() < gateWaitUntil) { entry = ''; render(); shake(); return; }
      busy = true; const ok = (await LS.sha256(entry)) === DEV_HASH; busy = false;
      if (ok) { gateFails = 0; close(); granted = true; LS.openApp('dev'); return; }
      gateFails++; if (gateFails >= 5) { gateWaitUntil = Date.now() + 30000; gateFails = 0; }
      entry = ''; render(); shake();
    }
    function shake() { dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(80); }
    function press(k) {
      if (busy) return;
      if (k === 'cancel') return close();
      if (k === 'back') { entry = entry.slice(0, -1); render(); return; }
      if (/^\d$/.test(String(k)) && entry.length < 8) { entry += k; render(); }
    }
    enter.onclick = submit;
    function onKey(e) { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('back'); else if (e.key === 'Enter') submit(); else if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    render(); ov.hidden = false;
  };
  LS.onLock.push(() => { granted = false; LS.devActive = false; });

  /* ---------- Helpers ---------- */
  const U = () => LS.ui;
  const save = () => LS.saveSettings();
  const btn = (text, onclick, cls) => el('button', { class: 'pill-btn' + (cls ? ' ' + cls : ''), text, onclick });
  const kv = (k, v) => U().row(k, el('span', { class: 'val dev-val', text: v }));
  const out = () => el('div', { class: 'dev-out', hidden: true });
  function show(o, text, cls) { o.hidden = false; o.classList.remove('ok', 'bad'); if (cls) o.classList.add(cls); o.textContent = text; }
  const yes = (b) => (b ? '✅ Yes' : '— No');
  const bytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  const repaint = () => { if (root) { const y = root.scrollTop; build(); root.scrollTop = y; } };

  const EXTRA_INFO = {
    piano: ['Piano', 'App: two octaves, multitouch', 'piano', 'linear-gradient(135deg,#3a3a3c,#000000)'],
    calendar: ['Calendar', 'App: month view + events', 'calendar', 'linear-gradient(135deg,#ff3b30,#ff6961)'],
    dice: ['Dice & Coin', 'App: roll dice, flip a coin', 'dice', 'linear-gradient(135deg,#30d158,#0a9f3a)'],
    breakout: ['Breakout', 'Game: drag the paddle', '🧱', '#ff6b6b'],
    mines: ['Minesweeper', 'Game: 3 sizes, flag mode', '💣', '#8e9aaf'],
    connect4: ['Connect Four', 'Game: vs AI or 2 players', '🔴', '#1e88e5'],
    skyhop: ['Sky Hop', 'Game: tap to fly', '🐤', '#4fc3f7']
  };

  /* ---------- Main page ---------- */
  function build() {
    const { group, head, foot, row, toggle, seg, select } = U();
    const s = LS.settings, b = s.buddy;
    root.innerHTML = '';
    const p = el('div', { class: 'pad set-page dev-page' });
    root.append(p);

    p.append(el('div', { class: 'dev-banner' }, el('div', { class: 'dev-badge', html: icon('code') }),
      el('div', null, el('b', { text: 'Developer Tools' }), el('small', { text: 'Full control. Passcode prompts are skipped here. Closes when LockShell locks.' }))));

    // ----- Settings -----
    const idle = select([[1, '1 minute'], [2, '2 minutes'], [5, '5 minutes'], [10, '10 minutes'], [0, 'Never']], s.idleMin, (v) => { s.idleMin = Number(v); save(); LS.toast('Auto-Lock: ' + (Number(v) ? v + ' min' : 'Never')); }, 'Auto-Lock');
    p.append(head('Appearance & Security'), group(
      row('Theme', seg([['light', 'Light'], ['dark', 'Dark']], s.theme, (v) => { s.theme = v; save(); LS.applyTheme(); })),
      row('Auto-Lock', idle),
      row('Set new passcode', btn('Set…', async () => { if (await LS.pinPad({ mode: 'setup', title: 'New passcode', sub: 'Choose 4 to 6 digits' })) { LS.toast('Passcode changed'); LS.resetLockEntry(); } })),
      row('Reset passcode to default', btn('Reset', async () => { if (await LS.confirm('Reset passcode?', 'The LockShell passcode goes back to the default.', 'Reset', true)) { await LS.setPin('1234'); LS.resetLockEntry(); LS.toast('Passcode reset to default'); } }, 'danger')),
      row('Reset lockout timer', btn('Reset', () => { LS.resetLockout && LS.resetLockout(); LS.toast('Lockout cleared'); }))));

    const voiceSel = el('select', { 'aria-label': 'Voice' });
    voiceSel.append(el('option', { value: '', text: 'Default voice' }));
    LS.voices().forEach((v) => { const o = el('option', { value: v.voiceURI, text: v.name + ' (' + v.lang + ')' }); if (v.voiceURI === b.voiceURI) o.selected = true; voiceSel.append(o); });
    voiceSel.onchange = () => { b.voiceURI = voiceSel.value; save(); };
    const range = (key, min, max, step) => { const o = el('span', { class: 'rv', text: Number(b[key]).toFixed(1) }); const r = el('input', { type: 'range', min, max, step, value: b[key], 'aria-label': key }); r.oninput = () => { b[key] = Number(r.value); o.textContent = Number(r.value).toFixed(1); save(); }; return el('span', { class: 'val' }, r, o); };
    p.append(head('Buddy'), group(
      row('Style', seg([['friendly', 'Friendly'], ['calm', 'Calm'], ['funny', 'Funny']], b.style, (v) => { b.style = v; save(); })),
      row('Speak replies', toggle(b.speak, (v) => { b.speak = v; save(); }, 'Speak replies')),
      row('Voice', voiceSel), row('Speed', range('rate', 0.5, 1.6, 0.1)), row('Pitch', range('pitch', 0.5, 1.8, 0.1)),
      row('Test voice', btn('▶︎ Test', () => { LS.primeSpeech && LS.primeSpeech(); LS.speak('Developer voice test. One, two, three.', true); }))));

    const micOut = out();
    p.append(head('Microphone'), group(
      row('Listen for "Buddy"', toggle(s.wakeWord, (v) => { s.wakeWord = v; save(); if (LS.wake) LS.wake.reset(); }, 'Wake word')),
      row('Permission', el('span', { class: 'val', text: s.micPerm })),
      row('Request microphone', btn('Request', async () => { const r = await LS.requestMic(); show(micOut, 'Microphone: ' + r, r === 'granted' ? 'ok' : 'bad'); })),
      row('Test wake word / speech', btn('Listen 5s', () => testSpeech(micOut)))), micOut);

    const cityIn = el('input', { class: 'txt-in', type: 'search', placeholder: 'City (e.g. Denver)', maxlength: 80 });
    const cityList = el('div', { class: 'list' }), wxOut = out();
    const lp = s.lastPlace;
    p.append(head('Weather'), group(
      row('Units', seg([['F', '°F'], ['C', '°C']], s.weatherUnit, (v) => { s.weatherUnit = v; save(); })),
      row('Location', el('span', { class: 'val dev-val', text: s.manualPlace && lp ? lp.place + ' (manual)' : 'GPS (automatic)' })),
      row('Use GPS again', btn('Use GPS', () => { s.manualPlace = false; save(); LS.toast('Weather will use your location'); repaint(); })),
      row('Test weather fetch', btn('Test', () => testWeather(wxOut)))),
      el('form', { class: 'wx-search dev-city', onsubmit: async (e) => {
        e.preventDefault(); const q = cityIn.value.trim(); if (!q) return; cityList.innerHTML = '';
        try {
          const res = await LS.geoSearch(q);
          if (!res.length) cityList.append(el('p', { class: 'muted', text: 'No places found.' }));
          res.forEach((r) => cityList.append(el('button', { class: 'item', onclick: () => { s.lastPlace = { lat: r.latitude, lon: r.longitude, place: r.name }; s.manualPlace = true; s.lastWeather = null; save(); LS.toast('Weather city: ' + r.name); repaint(); } },
            el('div', { class: 'meta' }, el('b', { text: r.name }), el('small', { text: [r.admin1, r.country_code || r.country].filter(Boolean).join(', ') })))));
        } catch (err) { cityList.append(el('p', { class: 'muted', text: 'Search failed: ' + err.message })); }
      } }, cityIn, el('button', { class: 'pill-btn', type: 'submit', text: 'Set city' })), cityList, wxOut);

    // ----- Home screen apps -----
    const hidden = s.hidden || [];
    const appRows = LS.homeOrder.filter((id) => LS.apps[id] && !LS.apps[id].hiddenApp && (!LS.apps[id].extra || LS.hasExtra(id))).map((id) => {
      const a = LS.apps[id];
      if (id === 'settings') return row(a.title, el('span', { class: 'val', text: 'Always shown' }), { icon: [a.icon, a.color] });
      return row(a.title, toggle(!hidden.includes(id), (v) => { s.hidden = v ? (s.hidden || []).filter((x) => x !== id) : (s.hidden || []).concat(id); save(); LS.renderHome(); }, 'Show ' + a.title), { icon: [a.icon, a.color] });
    });
    p.append(head('Home Screen Apps'), group(...appRows));

    // ----- Add apps & games -----
    const addRows = [...LS.EXTRAS.apps, ...LS.EXTRAS.games].map((id) => {
      const [name, desc, ic, bg] = EXTRA_INFO[id];
      return el('div', { class: 'set-row dev-add', 'data-extra': id },
        el('span', { class: 'lab' }, U().mini(ic, bg), el('span', { class: 'two' }, el('span', { text: name }), el('small', { text: desc }))),
        toggle(LS.hasExtra(id), (v) => { LS.setExtra(id, v); LS.renderHome(); LS.toast((v ? 'Added ' : 'Removed ') + name); setTimeout(repaint, 250); }, 'Add ' + name));
    });
    p.append(el('div', { class: 'set-head', id: 'devAdd', text: 'Add Apps & Games' }), group(...addRows),
      foot('Apps appear on the Home screen and games appear inside the Games app once added. Buddy can open them only after they are added.'));

    // ----- Data -----
    const lsKeys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lsKeys.push([k, (localStorage.getItem(k) || '').length * 2]); }
    lsKeys.sort((a, c) => a[0].localeCompare(c[0]));
    const lsRows = lsKeys.map(([k, n]) => row(k, el('span', { class: 'val' }, el('span', { text: bytes(n) }), el('span', { html: icon('chevron') })), { onclick: () => viewKey(k) }));
    const counts = el('div', { class: 'dev-counts muted', text: 'Counting…' });
    (async () => { const parts = []; for (const st of ['photos', 'recordings', 'drawings', 'notes']) { let n = 0; try { n = await LS.db.count(st); } catch (e) {} parts.push(st + ': ' + n); } counts.textContent = parts.join(' · '); })();
    const del = (st, label) => row('Delete all ' + label, btn('Delete', async () => { if (await LS.confirm('Delete all ' + label + '?', 'This cannot be undone.', 'Delete', true)) { await LS.db.clear(st); LS.toast(label + ' deleted'); repaint(); } }, 'danger'));
    p.append(head('Data'), el('div', { class: 'set-foot', style: { marginTop: '0' }, text: 'localStorage (' + lsKeys.length + ' keys). Tap a key to view it.' }), group(...(lsRows.length ? lsRows : [row('Empty', null)])),
      counts, group(del('photos', 'photos'), del('recordings', 'recordings'), del('drawings', 'drawings'), del('notes', 'notes'),
        row('Reset all app data', btn('Reset all', resetAll, 'danger'), { icon: ['trash', '#ff3b30'] })));

    // ----- Diagnostics -----
    const swRow = el('span', { class: 'val dev-val', text: '…' }), cacheRow = el('span', { class: 'val dev-val', text: '…' }), storeRow = el('span', { class: 'val dev-val', text: '…' });
    (async () => {
      try { const keys = window.caches ? await caches.keys() : []; const v = keys.find((k) => /^lockshell-v[\d.]+$/.test(k)); swRow.textContent = (v ? v.replace('lockshell-', '') : 'not cached') + (navigator.serviceWorker && navigator.serviceWorker.controller ? ' · active' : ' · not controlling');
        let n = 0; for (const k of keys) { try { n += (await (await caches.open(k)).keys()).length; } catch (e) {} } cacheRow.textContent = keys.length ? keys.length + ' caches, ' + n + ' files' : 'none'; } catch (e) { swRow.textContent = 'unavailable'; cacheRow.textContent = 'unavailable'; }
      try { const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; storeRow.textContent = est ? bytes(est.usage || 0) + ' of ' + bytes(est.quota || 0) : 'unknown'; } catch (e) { storeRow.textContent = 'unknown'; }
    })();
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    p.append(head('Diagnostics'), group(
      kv('App version', LS.VERSION), row('Service worker', swRow), row('Cache', cacheRow), row('Storage used', storeRow)),
      head('Device'), group(
        kv('Screen', screen.width + '×' + screen.height + ' · viewport ' + innerWidth + '×' + innerHeight),
        kv('Pixel ratio', String(window.devicePixelRatio || 1)), kv('Standalone (Home Screen)', yes(standalone)), kv('Online', yes(navigator.onLine)),
        el('div', { class: 'set-row dev-ua' }, el('small', { text: navigator.userAgent }))),
      head('Feature support'), group(
        kv('Speech recognition', yes(!!(window.SpeechRecognition || window.webkitSpeechRecognition))),
        kv('Speech synthesis', yes('speechSynthesis' in window)), kv('Battery API', yes(typeof navigator.getBattery === 'function')),
        kv('Wake Lock', yes(!!(navigator.wakeLock))), kv('Geolocation', yes('geolocation' in navigator)),
        kv('Camera / mic (getUserMedia)', yes(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))), kv('MediaRecorder', yes(!!window.MediaRecorder)),
        kv('Service worker', yes('serviceWorker' in navigator)), kv('IndexedDB', yes('indexedDB' in window)), kv('Web Audio', yes(!!(window.AudioContext || window.webkitAudioContext))),
        kv('Storage estimate', yes(!!(navigator.storage && navigator.storage.estimate)))));

    // Buddy console
    const bIn = el('input', { class: 'txt-in', type: 'text', placeholder: 'Type a prompt to test Buddy', maxlength: 400, 'aria-label': 'Buddy test prompt' });
    const bOut = out(); bOut.classList.add('dev-buddy-out');
    const runB = () => {
      const q = bIn.value.trim(); if (!q) return;
      const safe = window.BuddyBrain.checkSafety(q), r = window.BuddyBrain.reply(q, { style: b.style, ctx: {} });
      show(bOut, (safe.blocked ? '⛔ BLOCKED · ' + safe.category : '✅ ALLOWED') + '\nnormalized: "' + safe.normalized + '"\nreply: ' + r.text + (r.action ? '\naction: ' + JSON.stringify(r.action) : ''), safe.blocked ? 'bad' : 'ok');
    };
    p.append(head('Buddy test console'), el('form', { class: 'wx-search', onsubmit: (e) => { e.preventDefault(); runB(); } }, bIn, el('button', { class: 'pill-btn', type: 'submit', text: 'Test' })), bOut);

    // Error log
    const logBox = el('div', { class: 'dev-log' });
    const drawLog = () => { logBox.innerHTML = ''; if (!LS.errlog.length) { logBox.append(el('div', { class: 'muted', text: 'No errors or warnings captured.' })); return; } LS.errlog.slice().reverse().forEach((e) => logBox.append(el('div', { class: 'dev-log-' + e.level }, el('small', { text: new Date(e.t).toLocaleTimeString() + ' · ' + e.level }), el('div', { text: e.msg })))); };
    drawLog();
    p.append(el('div', { class: 'dev-head-row' }, el('div', { class: 'set-head', text: 'Error log (' + LS.errlog.length + ')' }), btn('Clear', () => { LS.errlog.length = 0; drawLog(); })), logBox);

    // Tools
    const toolOut = out();
    p.append(head('Tools'), group(
      row('Test microphone', btn('Test', async () => { try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); const tr = st.getAudioTracks()[0]; show(toolOut, 'Mic OK: ' + (tr ? tr.label || 'audio track' : 'no track'), 'ok'); st.getTracks().forEach((t) => t.stop()); } catch (e) { show(toolOut, 'Mic failed: ' + (e.name || e.message), 'bad'); } })),
      row('Force update', btn('Update now', forceUpdate, 'danger'))), toolOut);

    p.append(el('button', { class: 'primary-btn dev-exit', text: 'Exit Developer Tools', onclick: exit }));
  }

  function viewKey(k) {
    let v = localStorage.getItem(k) || '';
    if (k === 'lockshell.pin.v1') v = 'set';
    else { try { v = JSON.stringify(JSON.parse(v), null, 2); } catch (e) {} if (v.length > 6000) v = v.slice(0, 6000) + '\n… (truncated)'; }
    LS.modal((sh, close) => {
      sh.append(el('h2', { class: 'dev-key', text: k }), el('pre', { class: 'dev-pre', text: v }),
        el('div', { class: 'btns' }, el('button', { class: 'ghost-btn', text: 'Close', onclick: close }),
          k === 'lockshell.pin.v1' ? '' : el('button', { class: 'ghost-btn danger-btn', text: 'Delete key', onclick: async () => { close(); if (await LS.confirm('Delete "' + k + '"?', 'This removes the saved value.', 'Delete', true)) { localStorage.removeItem(k); repaint(); } } })));
    });
  }
  async function resetAll() {
    if (!(await LS.confirm('Reset ALL app data?', 'Deletes every setting, score, note, photo, recording, drawing and event, and resets the passcode to the default. This cannot be undone.', 'Reset everything', true))) return;
    Object.keys(localStorage).filter((k) => k.startsWith('lockshell')).forEach((k) => localStorage.removeItem(k));
    for (const st of ['photos', 'recordings', 'drawings', 'notes']) { try { await LS.db.clear(st); } catch (e) {} }
    location.reload();
  }
  async function forceUpdate() {
    if (!(await LS.confirm('Force update?', 'Removes the offline cache and reloads the newest version from the internet.', 'Update', false))) return;
    try { if (navigator.serviceWorker) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); } } catch (e) {}
    try { if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } } catch (e) {}
    location.reload();
  }
  async function testWeather(o) {
    const lp = LS.settings.lastPlace || { lat: 40.7128, lon: -74.006, place: 'New York (test)' };
    show(o, 'Fetching Open-Meteo for ' + (lp.place || 'location') + '…');
    const t0 = performance.now();
    try { const d = await LS.fetchForecast(lp.lat, lp.lon); const w = LS.wmo(d.current.weather_code, d.current.is_day); show(o, `OK in ${Math.round(performance.now() - t0)} ms: ${Math.round(d.current.temperature_2m)}°C, ${w.emoji} ${w.text}, ${d.daily.time.length} days`, 'ok'); }
    catch (e) { show(o, 'Weather fetch failed: ' + e.message, 'bad'); }
  }
  function testSpeech(o) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { show(o, 'Speech recognition is not supported in this browser.', 'bad'); return; }
    if (LS.wake) LS.wake.pause(true);
    const r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.continuous = false;
    let heard = '';
    show(o, '🎙️ Listening… say "Hey Buddy, what time is it?"');
    r.onresult = (e) => { heard = Array.from(e.results).map((x) => x[0].transcript).join(' '); show(o, '🎙️ ' + heard); };
    r.onerror = (e) => show(o, 'Speech error: ' + e.error, 'bad');
    r.onend = () => { if (LS.wake) LS.wake.pause(false); if (heard) show(o, 'Heard: "' + heard + '"' + (/\bbuddy\b/i.test(heard) ? '\nWake word detected ✅' : '\nNo wake word'), 'ok'); };
    try { r.start(); setTimeout(() => { try { r.stop(); } catch (e) {} }, 5000); } catch (e) { show(o, 'Could not start: ' + e.message, 'bad'); if (LS.wake) LS.wake.pause(false); }
  }
  function exit() { LS.openApp('settings'); }

  LS.register('dev', {
    title: 'Developer Tools', icon: 'code', color: '#48484a', hiddenApp: true,
    open(body) {
      if (!granted) { setTimeout(() => LS.openApp('settings'), 0); return; }
      LS.devActive = true;
      body.classList.add('scroll'); root = body;
      LS.backLabel('Settings');
      build();
    },
    back() { exit(); return true; },
    close() { LS.devActive = false; granted = false; root = null; }
  });
})();
