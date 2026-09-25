/* Voice-only Buddy: a full-screen overlay with a listening orb, captions, and spoken replies.
   Opened by shaking the phone, the floating mic button on the Home screen, or the "Hey Buddy" wake word.
   Uses the same Buddy brain, so the same safety filter checks what it hears and what it says. */
(function () {
  'use strict';
  const { el, icon } = LS;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const IDLE_CLOSE_MS = 8000;
  let ov = null, ui = null, rec = null, state = 'closed', idleT = null, lastClose = 0;

  function build() {
    ui = {};
    ui.x = el('button', { class: 'voice-x', 'aria-label': 'Close voice Buddy', html: icon('x') });
    ui.orb = el('button', { class: 'voice-orb', 'aria-label': 'Tap to talk' }, el('span', { class: 'ring r1' }), el('span', { class: 'ring r2' }), el('span', { class: 'core', html: icon('mic') }));
    ui.status = el('p', { class: 'voice-status', 'aria-live': 'polite' });
    ui.heard = el('p', { class: 'voice-heard' });
    ui.reply = el('p', { class: 'voice-reply', 'aria-live': 'polite' });
    ui.type = el('button', { class: 'ghost-btn voice-type', text: 'Type to Buddy instead', hidden: true });
    ov = el('div', { id: 'voiceOverlay', class: 'voice-ov', hidden: true, role: 'dialog', 'aria-label': 'Voice Buddy' },
      el('div', { class: 'voice-top' }, el('span', { class: 'voice-name', text: 'Buddy' }), ui.x),
      el('div', { class: 'voice-mid' }, ui.orb, ui.status),
      el('div', { class: 'voice-captions' }, ui.heard, ui.reply, ui.type));
    document.body.append(ov);
    ui.x.onclick = () => close();
    ui.orb.onclick = () => { LS.primeSpeech && LS.primeSpeech(); if (state === 'listening') stopListening(); else if (SR) listen(); };
    ui.type.onclick = () => { close(); LS.openApp('buddy'); };
    ov.addEventListener('pointerdown', () => { LS.bumpIdle(); if (state === 'idle') armIdle(); });
  }

  function setState(s, msg) {
    state = s;
    ov.dataset.state = s;
    if (msg != null) ui.status.textContent = msg;
    clearTimeout(idleT);
    if (s === 'idle' || s === 'unsupported') armIdle();
  }
  function armIdle() { clearTimeout(idleT); idleT = setTimeout(() => { if (state === 'idle' || state === 'unsupported') close(); }, IDLE_CLOSE_MS); }

  function canOpenNow() {
    return !LS.isLocked() && LS.$('#pinOverlay').hidden && !LS.devActive && LS.$('#modal').hidden;
  }

  function open(opts) {
    opts = opts || {};
    if (!canOpenNow()) return false;
    if (!ov) build();
    LS.bumpIdle();
    if (state !== 'closed') { if (opts.ask) ask(opts.ask); return true; }
    ov.hidden = false; requestAnimationFrame(() => ov.classList.add('show'));
    ui.heard.textContent = ''; ui.reply.textContent = ''; ui.type.hidden = true;
    LS.busy.add('voice');
    if (LS.wake) LS.wake.pause(true);
    if (!SR) {
      setState('unsupported', "Voice isn't available on this device.");
      ui.reply.textContent = "Sorry, I can't hear you here because this browser doesn't support voice. You can still type to me in the Buddy app!";
      ui.type.hidden = false;
      LS.speak("Sorry, voice isn't available here. You can type to me in the Buddy app.", true);
      return true;
    }
    if (opts.ask) ask(opts.ask); else listen();
    return true;
  }

  function listen() {
    stopListening(true);
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    let r;
    try { r = new SR(); } catch (e) { setState('idle', 'Tap the orb to talk'); return; }
    rec = r; r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let fin = '', interim = '';
    ui.heard.textContent = ''; ui.reply.textContent = '';
    setState('listening', 'Listening…');
    r.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else interim += t; }
      LS.bumpIdle();
      const shown = (fin + interim).trim();
      // Never echo words the filter would refuse.
      ui.heard.textContent = shown ? (window.BuddyBrain.checkSafety(shown).blocked ? '…' : '“' + shown + '”') : '';
    };
    r.onerror = (e) => {
      if (rec !== r) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { rec = null; setState('idle', 'Microphone is off'); ui.reply.textContent = 'I need the microphone to hear you. A grown-up can turn it on in Settings > Microphone. You can also type to me.'; ui.type.hidden = false; }
    };
    r.onend = () => {
      if (rec !== r) return;
      rec = null;
      const t = (fin || interim).trim();
      if (t) ask(t); else if (state === 'listening') setState('idle', "I didn't hear anything. Tap the orb to try again.");
    };
    try { r.start(); } catch (e) { rec = null; setState('idle', 'Tap the orb to talk'); }
  }
  function stopListening(silent) {
    if (rec) { const r = rec; rec = null; try { r.onend = null; r.onresult = null; r.onerror = null; r.abort(); } catch (e) {} }
    if (!silent && state === 'listening') setState('idle', 'Tap the orb to talk');
  }

  function ask(text) {
    if (!ov || state === 'closed') return;
    stopListening(true);
    setState('thinking', 'Thinking…');
    const r = LS.buddyAsk(text, { speak: false, noOpen: true }) || { text: '' };
    ui.heard.textContent = r.refused ? '' : '“' + text + '”';
    ui.reply.textContent = r.text;
    ov.classList.toggle('refused', !!r.refused);
    setState('speaking', 'Buddy is talking…');
    LS.speak(r.text, true, () => {
      if (state !== 'speaking') return;
      if (r.action && r.action.type === 'open' && LS.apps[r.action.app] && !r.refused) { const a = r.action; close(); if (!LS.isLocked()) LS.openApp(a.app, a.arg); return; }
      setState('idle', 'Tap the orb to ask something else');
    });
  }

  function close() {
    if (!ov || state === 'closed') return;
    stopListening(true);
    clearTimeout(idleT);
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    state = 'closed'; ov.dataset.state = 'closed';
    ov.classList.remove('show', 'refused'); ov.hidden = true;
    LS.busy.delete('voice');
    lastClose = Date.now();
    if (LS.wake) LS.wake.pause(false);
  }
  LS.onLock.push(close);
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });

  /* ---------- Shake detection ---------- */
  const SENS = { low: 30, med: 22, high: 15 }; // change in acceleration (m/s²) that counts as a jolt
  let last = null, peaks = [], lastTrigger = 0;
  function onMotion(e) {
    if (!LS.settings.shake) return;
    const a = (e && (e.accelerationIncludingGravity || e.acceleration)) || null;
    if (!a || a.x == null) return;
    const now = Date.now();
    if (last) {
      const d = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z);
      if (d > (SENS[LS.settings.shakeSens] || SENS.med)) {
        if (!peaks.length || now - peaks[peaks.length - 1] > 70) peaks.push(now);
        peaks = peaks.filter((t) => now - t < 1000);
        if (peaks.length >= 3 && now - lastTrigger > 3000 && now - lastClose > 1500 && state === 'closed' && canOpenNow()) {
          peaks = []; lastTrigger = now;
          if (navigator.vibrate) navigator.vibrate(60);
          open({ from: 'shake' });
        }
      }
    }
    last = { x: a.x, y: a.y, z: a.z };
  }
  let listening = false;
  function attachMotion() { if (listening || !('DeviceMotionEvent' in window)) return; window.addEventListener('devicemotion', onMotion); listening = true; }
  const needsPermission = () => !!(window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function');
  // Must be called from a tap (iOS rule).
  async function requestMotion() {
    if (!('DeviceMotionEvent' in window)) { LS.settings.motionPerm = 'unavailable'; LS.saveSettings(); return 'unavailable'; }
    if (!needsPermission()) { LS.settings.motionPerm = 'granted'; LS.saveSettings(); attachMotion(); return 'granted'; }
    try { const r = await DeviceMotionEvent.requestPermission(); LS.settings.motionPerm = r === 'granted' ? 'granted' : 'denied'; }
    catch (e) { LS.settings.motionPerm = 'denied'; }
    LS.saveSettings();
    if (LS.settings.motionPerm === 'granted') attachMotion();
    return LS.settings.motionPerm;
  }
  // Right after the first unlock: iPhone needs a tap to allow motion, so ask with a small sheet.
  function afterFirstUnlock() {
    if (LS.settings.motionAsked) return;
    LS.settings.motionAsked = true; LS.saveSettings();
    if (!LS.settings.shake || !needsPermission()) { requestMotion(); return; }
    setTimeout(() => {
      if (LS.isLocked()) return;
      LS.modal((sh, closeM) => {
        sh.append(el('div', { class: 'motion-ic', html: icon('shake') }), el('h2', { text: 'Shake for Buddy' }),
          el('p', { class: 'muted', text: 'Shake the phone any time to talk to Buddy with your voice. Tap Allow, then allow Motion & Orientation.' }),
          el('div', { class: 'btns' },
            el('button', { class: 'ghost-btn', text: 'Not now', onclick: () => closeM() }),
            el('button', { class: 'primary-btn', text: 'Allow', onclick: async () => { closeM(); const r = await requestMotion(); LS.toast(r === 'granted' ? 'Shake for Buddy is on' : 'Motion is off. Use the mic button instead.'); } })));
      });
    }, 900);
  }
  if (!needsPermission() || LS.settings.motionPerm === 'granted') attachMotion();

  /* ---------- Floating mic button on Home ---------- */
  const fab = LS.$('#voiceFab');
  if (fab) { fab.innerHTML = icon('mic'); fab.onclick = () => { LS.primeSpeech && LS.primeSpeech(); open({ from: 'button' }); }; }

  LS.voice = { open, close, ask: (t) => ask(t), isOpen: () => state !== 'closed', state: () => state, onMotion, requestMotion, afterFirstUnlock, needsPermission, supported: !!SR };
})();
