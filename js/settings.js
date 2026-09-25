/* Settings app */
(function () {
  'use strict';
  const { el, icon } = LS;
  let stack = [], root = null, urls = [];
  const revoke = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };

  function group(...rows) { return el('div', { class: 'set-group' }, ...rows); }
  function head(t) { return el('div', { class: 'set-head', text: t }); }
  function foot(t) { return el('div', { class: 'set-foot', text: t }); }
  function mini(ic, bg) { return el('span', { class: 'mini', style: { background: bg }, html: typeof ic === 'string' && ic.length > 2 ? icon(ic) : '' }, ic.length <= 2 ? ic : ''); }
  function row(label, right, opts) {
    opts = opts || {};
    const r = el(opts.onclick ? 'button' : 'div', { class: 'set-row', onclick: opts.onclick || null },
      el('span', { class: 'lab' }, opts.icon ? mini(opts.icon[0], opts.icon[1]) : '', el('span', { text: label })),
      right == null ? '' : right);
    return r;
  }
  function chev(val) { return el('span', { class: 'val' }, val ? el('span', { text: val }) : '', el('span', { html: icon('chevron') })); }
  function toggle(on, onchange, label) {
    const b = el('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on), 'aria-label': label || 'Toggle' });
    b.onclick = (e) => { e.stopPropagation(); const v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); onchange(v); };
    return b;
  }
  function seg(options, value, onchange) {
    const s = el('div', { class: 'seg' });
    options.forEach(([v, l]) => s.append(el('button', { class: v === value ? 'on' : '', text: l, onclick: (e) => { s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); onchange(v); } })));
    return s;
  }
  function select(options, value, onchange, label) {
    const s = el('select', { 'aria-label': label || '' });
    options.forEach(([v, l]) => { const o = el('option', { value: v, text: l }); if (String(v) === String(value)) o.selected = true; s.append(o); });
    s.onchange = () => onchange(s.value);
    return s;
  }
  const save = () => LS.saveSettings();

  /* ---------- Navigation inside Settings ---------- */
  function push(title, build) { stack.push({ title, build }); paint(); }
  function paint() {
    revoke();
    const top = stack[stack.length - 1];
    LS.$('#appTitle').textContent = top.title;
    LS.backLabel(stack.length > 1 ? 'Settings' : 'Home');
    root.innerHTML = ''; root.scrollTop = 0;
    const page = el('div', { class: 'pad set-page' });
    root.append(page);
    top.build(page);
  }

  /* ---------- Main page ---------- */
  function main(p) {
    const s = LS.settings;
    p.append(
      head('Appearance'),
      group(row('Theme', seg([['light', 'Light'], ['dark', 'Dark']], s.theme, (v) => { s.theme = v; save(); LS.applyTheme(); }), { icon: ['☀️', '#007aff'] })),
      head('Security'),
      group(
        row('Change Passcode', chev(), { icon: ['key', '#8e8e93'], onclick: changePin }),
        row('Auto-Lock', select([[1, '1 minute'], [2, '2 minutes'], [5, '5 minutes'], [10, '10 minutes'], [0, 'Never']], s.idleMin, async (v) => {
          if (await LS.requirePin('Enter passcode to change Auto-Lock')) { s.idleMin = Number(v); save(); LS.toast('Auto-Lock updated'); } else paint();
        }, 'Auto-Lock'), { icon: ['lock', '#34c759'] })),
      foot('LockShell returns to its lock screen after this much idle time. The real phone lock comes from Guided Access (see Help).'),
      head('Buddy & Voice'),
      group(
        row('Buddy', chev(cap(s.buddy.style)), { icon: ['chat', '#30b0c7'], onclick: () => push('Buddy', buddyPage) }),
        row('Microphone', chev(permLabel()), { icon: ['mic', '#ff3b30'], onclick: () => push('Microphone', micPage) })),
      head('Apps'),
      group(
        row('Weather Units', seg([['F', '°F'], ['C', '°C']], s.weatherUnit, (v) => { s.weatherUnit = v; save(); }), { icon: ['⛅', '#5ac8fa'] }),
        row('Home Screen Apps', chev(), { icon: ['▦', '#5856d6'], onclick: async () => { if (await LS.requirePin('Enter passcode to change Home Screen apps')) push('Home Screen Apps', appsPage); } }),
        row('Storage', chev(), { icon: ['image', '#ff9500'], onclick: async () => { if (await LS.requirePin('Enter passcode to manage storage')) push('Storage', storagePage); } })),
      head('Info'),
      group(
        row('Help & Setup', chev(), { icon: ['help', '#007aff'], onclick: () => push('Help & Setup', helpPage) }),
        row('About', chev(), { icon: ['ℹ️', '#8e8e93'], onclick: () => push('About', aboutPage) }))
    );
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function permLabel() { return { granted: 'Allowed', denied: 'Blocked', unavailable: 'Unavailable', unknown: 'Not asked' }[LS.settings.micPerm] || 'Not asked'; }

  async function changePin() {
    if (!(await LS.pinPad({ mode: 'verify', title: 'Current passcode', sub: 'Enter your current passcode' }))) return;
    if (await LS.pinPad({ mode: 'setup', title: 'New passcode', sub: 'Choose 4 to 6 digits' })) { LS.toast('Passcode changed'); LS.resetLockEntry && LS.resetLockEntry(); }
  }

  /* ---------- Buddy ---------- */
  function buddyPage(p) {
    const b = LS.settings.buddy;
    const voiceSel = el('select', { 'aria-label': 'Voice' });
    function fillVoices() {
      const vs = LS.voices().slice().sort((a, c) => (a.lang.startsWith('en') ? 0 : 1) - (c.lang.startsWith('en') ? 0 : 1) || a.name.localeCompare(c.name));
      voiceSel.innerHTML = '';
      voiceSel.append(el('option', { value: '', text: 'Default voice' }));
      vs.forEach((v) => { const o = el('option', { value: v.voiceURI, text: v.name + ' (' + v.lang + ')' }); if (v.voiceURI === b.voiceURI) o.selected = true; voiceSel.append(o); });
    }
    fillVoices(); LS.voicesChanged = fillVoices;
    voiceSel.onchange = () => { b.voiceURI = voiceSel.value; save(); };
    const range = (key, min, max, step) => {
      const out = el('span', { class: 'rv', text: Number(b[key]).toFixed(1) });
      const r = el('input', { type: 'range', min, max, step, value: b[key], 'aria-label': key });
      r.oninput = () => { b[key] = Number(r.value); out.textContent = Number(r.value).toFixed(1); save(); };
      return el('span', { class: 'val' }, r, out);
    };
    const hasTTS = 'speechSynthesis' in window;
    p.append(
      head('Personality'),
      group(row('Style', seg([['friendly', 'Friendly'], ['calm', 'Calm'], ['funny', 'Funny']], b.style, (v) => { b.style = v; save(); }))),
      foot('Changes how Buddy talks. Buddy runs entirely on this phone, with no internet and no accounts.'),
      head('Spoken replies'),
      group(
        row('Speak replies', toggle(b.speak, (v) => { b.speak = v; save(); }, 'Speak replies')),
        row('Voice', voiceSel),
        row('Speed', range('rate', 0.5, 1.6, 0.1)),
        row('Pitch', range('pitch', 0.5, 1.8, 0.1)),
        row('Test voice', el('button', { class: 'pill-btn', text: '▶︎ Test', onclick: () => { LS.primeSpeech && LS.primeSpeech(); LS.speak("Hi! I'm Buddy. This is how I sound.", true); } }))),
      foot(hasTTS ? 'On iPhone, more voices can be downloaded in Settings > Accessibility > Spoken Content > Voices.' : 'Spoken replies are not supported in this browser.'),
      head('Chat safety'),
      foot('Every message is checked first. Buddy refuses anything explicit or harmful and never helps get past the lock. Chats are kept in memory only and are erased whenever LockShell locks.')
    );
  }

  /* ---------- Microphone ---------- */
  function micPage(p) {
    const s = LS.settings, sup = LS.wake && LS.wake.supported;
    const st = el('span', { class: 'val ' + (s.micPerm === 'granted' ? 'perm-ok' : s.micPerm === 'denied' ? 'perm-bad' : 'perm-unk'), text: permLabel() });
    p.append(
      head('Wake word'),
      group(row('Listen for "Buddy"', toggle(s.wakeWord, (v) => {
        s.wakeWord = v; save();
        if (v && s.micPerm !== 'granted') LS.requestMic().then(() => paint());
        if (LS.wake) LS.wake.reset();
      }, 'Listen for Buddy'))),
      foot(sup ? 'While LockShell is open and unlocked, say "Hey Buddy" and a question, like "Hey Buddy, what time is it?". A green dot shows at the top while listening. iPhone may stop listening at any time; tap the mic in Buddy instead if it does. It never listens while locked or in the background.'
        : 'Speech recognition is not available in this browser, so the wake word and voice input are off. You can still type to Buddy.'),
      head('Permission'),
      group(
        row('Microphone access', st),
        row('Ask again', el('button', { class: 'pill-btn', text: 'Request', onclick: async () => { const r = await LS.requestMic(); LS.toast('Microphone: ' + permLabel()); if (r === 'granted' && LS.wake) LS.wake.reset(); paint(); } }))),
      s.micPerm === 'denied'
        ? el('div', { class: 'help' }, el('div', { class: 'warn' }, 'The microphone is blocked for LockShell. To allow it on iPhone: open the Settings app > Safari > Microphone > Allow (or Ask). In Safari you can also tap the "aA" button in the address bar > Website Settings > Microphone > Allow. Then come back and tap Request.'))
        : foot('The microphone is used for Voice Recorder, talking to Buddy and the wake word. Nothing is uploaded.')
    );
  }

  /* ---------- Home screen apps ---------- */
  function appsPage(p) {
    const s = LS.settings; s.hidden = s.hidden || [];
    const rows = LS.homeOrder.filter((id) => id !== 'settings' && LS.apps[id]).map((id) => {
      const a = LS.apps[id];
      return row(a.title, toggle(!s.hidden.includes(id), (v) => {
        s.hidden = v ? s.hidden.filter((x) => x !== id) : s.hidden.concat(id); save(); LS.renderHome();
      }, 'Show ' + a.title), { icon: [a.icon, a.color] });
    });
    p.append(head('Show on Home Screen'), group(...rows), foot('Settings is always shown so you can get back here.'));
  }

  /* ---------- Storage ---------- */
  function storagePage(p) {
    const kinds = [['photos', 'Photos'], ['drawings', 'Drawings'], ['recordings', 'Recordings'], ['notes', 'Notes']];
    const box = el('div');
    p.append(box);
    (async () => {
      for (const [store, label] of kinds) {
        let items = []; try { items = await LS.db.all(store); } catch (e) {}
        box.append(head(label + ' (' + items.length + ')'));
        if (!items.length) { box.append(foot('Nothing saved.')); continue; }
        if (store === 'photos' || store === 'drawings') {
          const grid = el('div', { class: 'media-grid' });
          items.forEach((it) => {
            const u = URL.createObjectURL(it.blob); urls.push(u);
            grid.append(el('img', { src: u, alt: label, onclick: () => viewImg(store, it, u) }));
          });
          box.append(grid);
        } else {
          const list = el('div', { class: 'list' });
          items.forEach((it) => {
            const name = store === 'notes' ? (it.title || 'Untitled') : it.name;
            const sub = store === 'notes' ? LS.fmtDate(it.updated) : LS.fmtDur(it.dur) + ' · ' + LS.fmtDate(it.created);
            list.append(el('div', { class: 'item' }, el('div', { class: 'meta' }, el('b', { text: name }), el('small', { text: sub })),
              el('button', { class: 'icon-btn', 'aria-label': 'Delete', html: icon('trash'), onclick: async () => { if (await LS.confirm('Delete?', '"' + name + '" will be deleted.', 'Delete', true)) { await LS.db.del(store, it.id); paint(); } } })));
          });
          box.append(list);
        }
        box.append(el('button', { class: 'ghost-btn danger-btn', style: { marginTop: '10px' }, text: 'Delete all ' + label.toLowerCase(), onclick: async () => {
          if (await LS.confirm('Delete all ' + label.toLowerCase() + '?', 'This cannot be undone.', 'Delete all', true)) { await LS.db.clear(store); LS.toast(label + ' deleted'); paint(); }
        } }));
      }
    })();
    function viewImg(store, it, u) {
      LS.modal((sh, close) => {
        sh.classList.add('viewer');
        sh.append(el('img', { src: u, alt: '' }), el('p', { class: 'muted', text: LS.fmtDate(it.created) }),
          el('div', { class: 'btns' }, el('button', { class: 'ghost-btn', text: 'Close', onclick: close }),
            el('button', { class: 'ghost-btn danger-btn', text: 'Delete', onclick: async () => { close(); await LS.db.del(store, it.id); LS.toast('Deleted'); paint(); } })));
      });
    }
  }

  /* ---------- Help ---------- */
  function helpPage(p) {
    const h = el('div', { class: 'help' });
    h.innerHTML = `
      <div class="warn"><b>Important:</b> a web app cannot lock your iPhone by itself. LockShell's lock screen only protects LockShell. To stop someone leaving the app (pressing Home, swiping up, opening other apps), turn on <b>Guided Access</b>, which is built into iOS.</div>
      <h3>iPhone setup</h3>
      <ol>
        <li><b>Install:</b> open LockShell in <b>Safari</b>, tap the <b>Share</b> button, then <b>Add to Home Screen</b> &gt; <b>Add</b>.</li>
        <li><b>Turn on Guided Access:</b> open the <b>Settings</b> app &gt; <b>Accessibility</b> &gt; <b>Guided Access</b> and switch it on.</li>
        <li>Tap <b>Passcode Settings</b> &gt; <b>Set Guided Access Passcode</b>. Use a code that is different from LockShell's passcode and from your iPhone passcode.</li>
        <li>Open <b>LockShell from the Home Screen</b> icon (not from Safari).</li>
        <li><b>Triple-click the side button</b> and tap <b>Start</b>. The phone now stays inside LockShell.</li>
        <li>To end: <b>triple-click the side button</b>, enter the Guided Access passcode, and tap <b>End</b>.</li>
      </ol>
      <p class="muted">Tip: in Guided Access Options you can turn off the side button, volume buttons, or set a time limit.</p>
      <h3>LockShell basics</h3>
      <ol>
        <li>The default LockShell passcode is <b>1234</b>. Change it in Settings &gt; Change Passcode.</li>
        <li>Tap the lock button on the Home screen to hand the phone back safely. LockShell also locks itself after the Auto-Lock time.</li>
        <li>Photos, recordings, drawings and notes stay on this phone. Manage them in Settings &gt; Storage.</li>
        <li>If Camera or Microphone are blocked: Settings app &gt; Safari &gt; Camera / Microphone &gt; Allow, or the "aA" menu in Safari &gt; Website Settings.</li>
      </ol>
      <h3>Android</h3>
      <ol>
        <li>Open LockShell in Chrome, tap the ⋮ menu &gt; <b>Add to Home screen</b> (or Install app).</li>
        <li>Turn on <b>App pinning</b>: Settings &gt; Security (or Security &amp; privacy &gt; More security settings) &gt; <b>App pinning</b>, and turn on "Ask for PIN before unpinning".</li>
        <li>Open LockShell, open the Recents/Overview screen, tap the LockShell icon at the top of its card, then <b>Pin</b>.</li>
        <li>To unpin: hold Back and Overview (or swipe up and hold), then enter your PIN.</li>
      </ol>
      <h3>Known limits</h3>
      <ol>
        <li>iPhone doesn't let web apps read the battery level, so no battery is shown there.</li>
        <li>The "Hey Buddy" wake word only works while LockShell is open, unlocked and on screen, and iOS may stop it at any time.</li>
        <li>Weather needs the internet. The last forecast is saved for offline use.</li>
      </ol>`;
    p.append(h);
  }
  function aboutPage(p) {
    p.append(
      el('div', { class: 'about-hero' }, el('img', { src: 'icons/icon-192.png', alt: '' }), el('h2', { text: 'LockShell' }), el('p', { class: 'muted', text: 'Version ' + (LS.VERSION || '1.0') })),
      group(row('Works offline', el('span', { class: 'val', text: 'Yes' })), row('Accounts or tracking', el('span', { class: 'val', text: 'None' })), row('Data location', el('span', { class: 'val', text: 'This phone only' }))),
      foot('A calm, kiosk-style home for a shared iPhone: a lock screen and a set of safe apps. Weather comes from Open-Meteo.com (free, no key). Buddy is a small offline helper with a safety filter. Use iOS Guided Access to keep the phone inside LockShell.')
    );
  }

  LS.register('settings', {
    title: 'Settings', icon: 'gear', color: 'linear-gradient(135deg,#aeaeb2,#636366)',
    open(body) { body.classList.add('scroll'); root = body; stack = []; push('Settings', main); },
    back() { if (stack.length > 1) { stack.pop(); paint(); return true; } return false; },
    close() { revoke(); stack = []; root = null; LS.voicesChanged = null; }
  });
})();
