/* Boot: lock screen keypad, clock, status bar, home grid, permissions, kiosk guards, service worker */
(function () {
  'use strict';
  const { $, $$, el, icon } = LS;
  LS.applyTheme();

  /* ---------- Clock + status bar ---------- */
  function tick() {
    const d = new Date();
    const hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    const date = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    $$('.sb-time').forEach((e) => { e.textContent = hm; });
    $('#clockTime').textContent = hm;
    $('#clockDate').textContent = date;
    $('#homeDate').textContent = date;
  }
  tick(); setInterval(tick, 1000);

  // Battery: only if the browser really provides it (iPhone Safari does NOT). Never show a fake value.
  if (typeof navigator.getBattery === 'function') {
    navigator.getBattery().then((b) => {
      const upd = () => {
        const pct = Math.round(b.level * 100);
        $$('.sb-batt').forEach((e) => {
          e.hidden = false; e.classList.toggle('low', pct <= 20 && !b.charging);
          e.innerHTML = `${pct}%${b.charging ? ' ⚡' : ''} <i><b style="width:calc(${pct}% - 3px)"></b></i>`;
          e.setAttribute('aria-label', 'Battery ' + pct + ' percent');
        });
      };
      upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
    }).catch(() => {});
  }

  /* ---------- Lock screen ---------- */
  $('#lockGlyph').innerHTML = icon('lock');
  let entry = '', checking = false, fails = 0, cooldown = 0;
  const dots = $('#lockDots'), sub = $('#lockSub');
  function renderDots() {
    const n = LS.pinLen(); dots.innerHTML = '';
    for (let i = 0; i < n; i++) dots.append(el('i', { class: i < entry.length ? 'on' : '' }));
  }
  function shake() { dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(150); }
  LS.resetLockEntry = () => { entry = ''; sub.textContent = 'Enter passcode'; sub.classList.remove('err'); renderDots(); $('#lockGlyph').innerHTML = icon('lock'); };
  async function tryUnlock() {
    checking = true;
    const ok = await LS.checkPin(entry);
    checking = false;
    if (ok && LS.timeBlocked && LS.timeBlocked()) { entry = ''; renderDots(); LS.showTimeUp(); return; } // Screen Time: passcode can't get past it
    if (ok) {
      fails = 0; $('#lockGlyph').innerHTML = icon('unlock');
      LS.unlock();
      firstUnlockMic();
      if (LS.voice) LS.voice.afterFirstUnlock();
      entry = ''; setTimeout(LS.resetLockEntry, 400);
      return;
    }
    fails++; entry = ''; shake(); renderDots();
    sub.classList.add('err');
    if (fails >= 5) {
      cooldown = Date.now() + 30000; sub.textContent = 'Too many tries. Wait 30 seconds.';
      setTimeout(() => { if (Date.now() >= cooldown) { fails = 3; sub.textContent = 'Enter passcode'; sub.classList.remove('err'); } }, 30100);
    } else sub.textContent = 'Wrong passcode. Try again.';
  }
  LS.resetLockout = () => { fails = 0; cooldown = 0; if (LS.isLocked()) LS.resetLockEntry(); };
  function press(k) {
    primeSpeech();
    if (checking || Date.now() < cooldown) return;
    if (k === 'back') { entry = entry.slice(0, -1); renderDots(); return; }
    if (!/^\d$/.test(String(k))) return;
    if (entry.length >= LS.pinLen()) return;
    entry += k; renderDots();
    if (entry.length === LS.pinLen()) setTimeout(tryUnlock, 80);
  }
  $('#lockPad').append(LS.makePad(press));
  document.addEventListener('keydown', (e) => {
    if (!LS.isLocked() || !$('#pinOverlay').hidden) return;
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('back');
  });

  /* ---------- Microphone permission right after the FIRST successful unlock ---------- */
  function firstUnlockMic() {
    if (LS.settings.micAsked) return;
    LS.settings.micAsked = true; LS.saveSettings();
    LS.requestMic();
  }
  LS.requestMic = async function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { LS.settings.micPerm = 'unavailable'; LS.saveSettings(); return 'unavailable'; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      LS.settings.micPerm = 'granted';
    } catch (e) {
      LS.settings.micPerm = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'denied' : 'unavailable';
    }
    LS.saveSettings();
    if (LS.wake) LS.wake.sync();
    return LS.settings.micPerm;
  };

  /* ---------- Speech priming (iOS needs the first utterance inside a user gesture) ---------- */
  let primed = false;
  function primeSpeech() {
    if (primed || !('speechSynthesis' in window)) return;
    primed = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  }
  LS.primeSpeech = primeSpeech;
  document.addEventListener('pointerdown', primeSpeech, { once: true, capture: true });

  /* ---------- Home screen ---------- */
  LS.renderHome = function () {
    const tiles = $('#tiles'); tiles.innerHTML = '';
    const hidden = LS.settings.hidden || [];
    LS.homeOrder.forEach((id) => {
      const a = LS.apps[id]; if (!a) return;
      if (a.hiddenApp || (a.extra && !LS.hasExtra(id))) return;
      if (id !== 'settings' && hidden.includes(id)) return;
      tiles.append(el('button', { class: 'tile', 'data-app': id, 'aria-label': a.title, onclick: () => LS.openApp(id) },
        el('span', { class: 'ic', style: { background: a.color }, html: a.emoji ? `<span class="emo">${a.emoji}</span>` : icon(a.icon) }),
        el('span', { class: 'lbl', text: a.label || a.title })));
    });
  };
  $('#homeLock').innerHTML = icon('lock');
  $('#homeLock').onclick = () => LS.goLock();
  $('#appBack').innerHTML = icon('back') + '<span>Home</span>';
  $('#appBack').onclick = () => LS.appBack();

  /* ---------- Visibility: lock again if hidden for longer than auto-lock ---------- */
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (LS.devActive) LS.goLock(); } // Developer Tools never survives backgrounding
    else if (hiddenAt && !LS.isLocked() && Date.now() - hiddenAt > LS.idleLimitMs()) LS.goLock();
    if (LS.wake) LS.wake.sync();
  });

  /* ---------- Resume after sleep / background / unlock ---------- */
  // iOS can leave speech recognition, motion and audio in a dead state after the phone locks or ShellOS goes to the
  // background. Whenever ShellOS is visible again (visibilitychange, pageshow, focus) or is unlocked, restart them once.
  // Bursts of these events (they usually arrive together) are merged into one resume.
  LS.onResume = []; LS.resumeCount = 0;
  let resumeT = null;
  LS.resumeAll = function () {
    clearTimeout(resumeT);
    resumeT = setTimeout(() => {
      resumeT = null;
      if (document.hidden) return;
      LS.resumeCount++;
      try { if (LS.wake && LS.wake.resume) LS.wake.resume(); } catch (e) {}
      try { if (LS.voice && LS.voice.resumeMotion) LS.voice.resumeMotion(); } catch (e) {}
      try { LS.audioResume && LS.audioResume(); } catch (e) {}
      LS.onResume.forEach((f) => { try { f(); } catch (e) {} });
    }, 250);
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) LS.resumeAll(); });
  window.addEventListener('pageshow', () => LS.resumeAll());
  window.addEventListener('focus', () => LS.resumeAll());
  LS.onUnlock.push(() => LS.resumeAll());

  /* ---------- Kiosk guards ---------- */
  // No pinch zoom / double-tap zoom / context menus / pull-to-refresh / overscroll bounce.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
  document.addEventListener('selectstart', (e) => { if (!e.target.closest || !e.target.closest('input,textarea')) e.preventDefault(); });
  function scrollableAncestor(node) {
    for (let n = node; n && n !== document.body; n = n.parentElement) {
      if (n.nodeType !== 1) continue;
      if (n.matches('input,textarea,select,[data-touch]')) return n;
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
      if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) return n;
    }
    return null;
  }
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !scrollableAncestor(e.target)) e.preventDefault(); }, { passive: false });
  // No way out to other sites: block external link navigation and window.open.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a && new URL(a.href, location.href).origin !== location.origin) { e.preventDefault(); LS.toast('Links are turned off in ShellOS'); }
  }, true);
  try { window.open = function () { return null; }; } catch (e) {}

  // Containers that must never scroll (programmatic scrolls or iOS focus can nudge them).
  [$('#root')].concat($$('.screen')).forEach((n) => n.addEventListener('scroll', () => { if (n.scrollTop) n.scrollTop = 0; }));

  /* ---------- Start ---------- */
  LS.ensureDefaultPin().then(() => { LS.resetLockEntry(); });
  LS.renderHome();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
