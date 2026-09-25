/* Buddy UI: chat, speech output, tap-to-talk and the "Buddy" wake word. Brain lives in buddy-brain.js. */
(function () {
  'use strict';
  const { el, icon } = LS;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let history = [];          // in memory only; cleared on lock
  const ctx = {};            // riddle state etc.
  let ui = null;             // live DOM refs while Buddy is open
  let tap = null;            // tap-to-talk recognizer

  /* ---------- Speech output ---------- */
  const synth = window.speechSynthesis || null;
  LS.voices = () => (synth ? synth.getVoices() : []);
  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', () => { LS.voicesChanged && LS.voicesChanged(); });
  const forSpeech = (t) => String(t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  LS.speak = function (text, force) {
    const b = LS.settings.buddy;
    if (!synth || (!b.speak && !force)) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(forSpeech(text));
      const v = LS.voices().find((x) => x.voiceURI === b.voiceURI);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = Number(b.rate) || 1; u.pitch = Number(b.pitch) || 1;
      speaking = true; if (LS.wake) LS.wake.sync();
      u.onend = u.onerror = () => { speaking = false; if (LS.wake) setTimeout(LS.wake.sync, 300); };
      synth.speak(u);
    } catch (e) { speaking = false; }
  };
  let speaking = false;
  LS.isSpeaking = () => speaking;

  /* ---------- Conversation ---------- */
  function ask(text, opts) {
    opts = opts || {};
    text = String(text || '').trim();
    if (!text) return;
    const r = window.BuddyBrain.reply(text, { style: LS.settings.buddy.style, ctx });
    history.push({ who: 'me', text }, { who: 'bot', text: r.text, refused: !!r.refused });
    if (ui) { addBubble('me', text); addBubble('bot', r.text, r.refused); }
    if (opts.speak !== false) LS.speak(r.text, opts.forceSpeak);
    if (r.action && r.action.type === 'open' && LS.apps[r.action.app]) {
      setTimeout(() => { if (!LS.isLocked()) LS.openApp(r.action.app, r.action.arg); }, 1100);
    }
    return r;
  }
  LS.buddyAsk = ask;
  function addBubble(who, text, refused) {
    const b = el('div', { class: 'bubble ' + who + (refused ? ' refuse' : ''), text });
    ui.chat.append(b);
    requestAnimationFrame(() => { ui.chat.scrollTop = ui.chat.scrollHeight; });
  }
  LS.onLock.push(() => { history = []; for (const k in ctx) delete ctx[k]; if (synth) synth.cancel(); stopTap(); });

  /* ---------- Tap to talk ---------- */
  function stopTap() { if (tap) { try { tap.abort(); } catch (e) {} tap = null; } if (ui) ui.mic.classList.remove('on'); if (LS.wake) LS.wake.sync(); }
  function startTap() {
    LS.primeSpeech && LS.primeSpeech();
    if (!SR) { LS.toast('Voice input is not available here. You can type instead.'); return; }
    if (tap) { stopTap(); return; }
    if (LS.wake) LS.wake.pause(true);
    if (synth) synth.cancel();
    const r = new SR(); tap = r;
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let final = '';
    ui.mic.classList.add('on'); ui.input.placeholder = 'Listening…';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += t; else interim += t; }
      if (ui) ui.input.value = (final + interim).trim();
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') LS.toast('Microphone is blocked. See Settings > Microphone.');
      else if (e.error === 'no-speech') LS.toast("I didn't hear anything. Try again!");
    };
    r.onend = () => {
      if (tap !== r) return;
      tap = null;
      if (ui) { ui.mic.classList.remove('on'); ui.input.placeholder = 'Message Buddy'; }
      if (LS.wake) LS.wake.pause(false);
      const t = final.trim();
      if (t && ui) { ui.input.value = ''; ask(t, { forceSpeak: false }); }
    };
    try { r.start(); } catch (e) { tap = null; ui.mic.classList.remove('on'); if (LS.wake) LS.wake.pause(false); LS.toast('Voice input could not start.'); }
  }

  /* ---------- Buddy app ---------- */
  LS.register('buddy', {
    title: 'Buddy', icon: 'chat', color: 'linear-gradient(135deg,#34c759,#30b0c7)',
    open(body, actions, arg) {
      const chat = el('div', { class: 'chat', 'aria-live': 'polite' });
      const input = el('input', { type: 'text', placeholder: 'Message Buddy', enterkeyhint: 'send', autocomplete: 'off', autocorrect: 'on', maxlength: 400, 'aria-label': 'Message' });
      const mic = el('button', { class: 'mic', 'aria-label': 'Talk to Buddy', html: icon('mic') });
      const send = el('button', { class: 'send', 'aria-label': 'Send', html: icon('send') });
      const chips = el('div', { class: 'chips' });
      ['What can you do?', 'Tell me a joke', '12 × 7', '5 miles to km', 'Tell me a riddle', 'Play snake', 'Weather'].forEach((c) =>
        chips.append(el('button', { text: c, onclick: () => ask(c) })));
      body.append(chat, chips, el('form', { class: 'composer', onsubmit: (e) => { e.preventDefault(); go(); } }, mic, input, send));
      ui = { chat, input, mic };
      function go() { LS.primeSpeech && LS.primeSpeech(); const t = input.value; input.value = ''; ask(t); }
      send.type = 'submit'; mic.type = 'button';
      mic.onclick = startTap;
      if (!history.length) {
        const hi = { friendly: "Hi! I'm Buddy 😊 Ask me anything, or tap a suggestion below.", calm: "Hello, I'm Buddy. Ask me anything, whenever you're ready.", funny: "Yo! Buddy here, the smartest helper in this phone! 🤖 Ask away!" }[LS.settings.buddy.style] || "Hi! I'm Buddy.";
        chat.append(el('div', { class: 'chat-day', text: 'Buddy runs on this phone. Chats clear when it locks.' }));
        chat.append(el('div', { class: 'bubble bot', text: hi }));
      } else {
        history.forEach((m) => addBubble(m.who, m.text, m.refused));
      }
      if (arg && arg.ask) setTimeout(() => ask(arg.ask, { forceSpeak: true }), 150);
      else if (arg && arg.greet) { const r = 'Yes? I\'m listening. Tap the mic or type your question.'; addBubble('bot', r); LS.speak(r, true); }
    },
    back() { return false; },
    close() { stopTap(); ui = null; }
  });

  /* ---------- Wake word: "Buddy" / "Hey Buddy" ---------- */
  const wake = LS.wake = { active: false, failed: false, paused: false, rec: null, backoff: 1000, timer: null };
  function wanted() {
    const cur = LS.current();
    return !!(SR && LS.settings.wakeWord && !wake.failed && !wake.paused && !speaking && !document.hidden && !LS.isLocked() &&
      LS.settings.micPerm !== 'denied' && !(cur && (cur.id === 'recorder' || cur.id === 'camera')));
  }
  function indicator() { document.querySelectorAll('.sb-mic').forEach((e) => { e.hidden = !wake.active; }); }
  function stopWake() {
    clearTimeout(wake.timer); wake.timer = null;
    if (wake.rec) { const r = wake.rec; wake.rec = null; try { r.onend = null; r.onerror = null; r.onresult = null; r.abort(); } catch (e) {} }
    wake.active = false; indicator();
  }
  function startWake() {
    if (wake.rec || wake.timer) return;
    let r;
    try { r = new SR(); } catch (e) { wake.failed = true; return; }
    wake.rec = r;
    r.lang = 'en-US'; r.continuous = true; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart = () => { wake.active = true; indicator(); };
    r.onresult = (e) => {
      wake.backoff = 1000;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const t = e.results[i][0].transcript.toLowerCase();
        const m = t.match(/\b(?:hey |hi |okay |ok )?buddy\b[\s,.!?]*(.*)$/);
        if (!m || speaking) continue;
        const rest = m[1].trim();
        LS.bumpIdle();
        if (!LS.current() || LS.current().id !== 'buddy') LS.openApp('buddy', rest ? { ask: rest } : { greet: true });
        else if (rest) ask(rest, { forceSpeak: true });
        else { LS.speak("Yes? I'm listening.", true); }
      }
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wake.failed = true; if (e.error === 'not-allowed') { LS.settings.micPerm = 'denied'; LS.saveSettings(); } }
    };
    r.onend = () => {
      wake.rec = null; wake.active = false; indicator();
      if (!wanted()) return;
      // Restart with backoff (iOS ends sessions often).
      wake.timer = setTimeout(() => { wake.timer = null; if (wanted()) startWake(); }, wake.backoff);
      wake.backoff = Math.min(wake.backoff * 2, 30000);
    };
    try { r.start(); } catch (e) { wake.rec = null; wake.timer = setTimeout(() => { wake.timer = null; if (wanted()) startWake(); }, wake.backoff); wake.backoff = Math.min(wake.backoff * 2, 30000); }
  }
  wake.sync = function () { if (wanted()) startWake(); else stopWake(); };
  wake.pause = function (p) { wake.paused = !!p; wake.sync(); };
  wake.reset = function () { wake.failed = false; wake.backoff = 1000; wake.sync(); };
  wake.supported = !!SR;
  LS.onRoute.push(() => wake.sync());
})();
