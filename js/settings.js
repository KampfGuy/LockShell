/* Settings app */
(function () {
  'use strict';
  const { el, icon } = LS;
  let stack = [], root = null, urls = [];
  const revoke = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };

  function group(...rows) { return el('div', { class: 'set-group' }, ...rows); }
  function head(t) { return el('div', { class: 'set-head', text: t }); }
  function foot(t) { return el('div', { class: 'set-foot', text: t }); }
  function mini(ic, bg) { const isIc = LS.iconNames.includes(ic); return el('span', { class: 'mini', style: { background: bg }, html: isIc ? icon(ic) : '' }, isIc ? '' : ic); }
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
      foot('ShellOS returns to its lock screen after this much idle time. The real phone lock comes from Guided Access (see Help).'),
      head('Buddy & Voice'),
      group(
        row('Buddy', chev(cap(s.buddy.style)), { icon: ['chat', '#30b0c7'], onclick: () => push('Buddy', buddyPage) }),
        row('Microphone', chev(permLabel()), { icon: ['mic', '#ff3b30'], onclick: () => push('Microphone', micPage) }),
        row('Shake for Buddy', chev(s.shake ? 'On' : 'Off'), { icon: ['shake', '#af52de'], onclick: () => push('Shake for Buddy', shakePage) })),
      head('Apps'),
      group(
        row('Weather Units', seg([['F', '°F'], ['C', '°C']], s.weatherUnit, (v) => { s.weatherUnit = v; save(); }), { icon: ['⛅', '#5ac8fa'] }),
        row('Game Sounds', toggle(s.gameSound !== false, (v) => { s.gameSound = v; save(); if (v) LS.tone(660, 0.12); }, 'Game Sounds'), { icon: ['🔊', '#ff2d55'] }),
        row('Game Volume', volRange(), { icon: ['🎚️', '#ff9500'] }),
        row('Home Screen Apps', chev(), { icon: ['▦', '#5856d6'], onclick: async () => { if (await LS.requirePin('Enter passcode to change Home Screen apps')) push('Home Screen Apps', appsPage); } }),
        row('Storage', chev(), { icon: ['image', '#ff9500'], onclick: async () => { if (await LS.requirePin('Enter passcode to manage storage')) push('Storage', storagePage); } })),
      head('Info'),
      group(
        row('Help & Setup', chev(), { icon: ['help', '#007aff'], onclick: () => push('Help & Setup', helpPage) }),
        row('About', chev(), { icon: ['ℹ️', '#8e8e93'], onclick: () => push('About', aboutPage) }),
        row('Developer', chev(), { icon: ['code', '#48484a'], onclick: () => LS.openDevGate && LS.openDevGate() }))
    );
  }
  function volRange() {
    const s = LS.settings, v = Math.round((s.gameVolume == null ? 0.8 : s.gameVolume) * 100);
    const r = el('input', { type: 'range', min: 0, max: 100, step: 10, value: v, 'aria-label': 'Game Volume' });
    r.onchange = () => { s.gameVolume = Number(r.value) / 100; save(); LS.tone(660, 0.12); };
    return el('span', { class: 'val' }, r);
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
      foot('Every message is checked first. Buddy refuses anything explicit or harmful and never helps get past the lock. Chats are kept in memory only and are erased whenever ShellOS locks.')
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
      foot(sup ? 'While ShellOS is open and unlocked, say "Hey Buddy" and a question, like "Hey Buddy, what time is it?". A green dot shows at the top while listening. iPhone may stop listening at any time; tap the mic in Buddy instead if it does. It never listens while locked or in the background.'
        : 'Speech recognition is not available in this browser, so the wake word and voice input are off. You can still type to Buddy.'),
      head('Permission'),
      group(
        row('Microphone access', st),
        row('Ask again', el('button', { class: 'pill-btn', text: 'Request', onclick: async () => { const r = await LS.requestMic(); LS.toast('Microphone: ' + permLabel()); if (r === 'granted' && LS.wake) LS.wake.reset(); paint(); } }))),
      s.micPerm === 'denied'
        ? el('div', { class: 'help' }, el('div', { class: 'warn' }, 'The microphone is blocked for ShellOS. To allow it on iPhone: open the Settings app > Safari > Microphone > Allow (or Ask). In Safari you can also tap the "aA" button in the address bar > Website Settings > Microphone > Allow. Then come back and tap Request.'))
        : foot('The microphone is used for Voice Recorder, talking to Buddy and the wake word. Nothing is uploaded.')
    );
  }

  /* ---------- Shake for Buddy ---------- */
  function shakePage(p) {
    const s = LS.settings, V = LS.voice || {};
    const perm = { granted: 'Allowed', denied: 'Blocked', unavailable: 'Not on this device', unknown: V.needsPermission && V.needsPermission() ? 'Not asked' : 'Allowed' }[s.motionPerm] || 'Not asked';
    p.append(
      head('Voice-only Buddy'),
      group(
        row('Shake for Buddy', toggle(s.shake, async (v) => { s.shake = v; save(); if (v && s.motionPerm !== 'granted' && V.requestMotion) { await V.requestMotion(); paint(); } }, 'Shake for Buddy')),
        row('Sensitivity', seg([['low', 'Low'], ['med', 'Medium'], ['high', 'High']], s.shakeSens, (v) => { s.shakeSens = v; save(); })),
        row('Motion access', el('span', { class: 'val', text: perm })),
        row('Allow motion', el('button', { class: 'pill-btn', text: 'Request', onclick: async () => { if (V.requestMotion) { const r = await V.requestMotion(); LS.toast('Motion: ' + r); paint(); } } })),
        row('Try it now', el('button', { class: 'pill-btn', text: '🎙️ Open', onclick: () => { LS.closeApp(); setTimeout(() => V.open && V.open({ from: 'settings' }), 80); } }))),
      foot('Shake the phone (while it is unlocked) to talk to Buddy with just your voice. You can also tap the mic button on the Home screen, or say "Hey Buddy" if the wake word is on. Low needs a harder shake. iPhone cannot use the volume buttons for this, because web apps are not allowed to read them.')
    );
  }

  /* ---------- Home screen apps ---------- */
  function appsPage(p) {
    const s = LS.settings; s.hidden = s.hidden || [];
    const rows = LS.homeOrder.filter((id) => id !== 'settings' && LS.apps[id] && !LS.apps[id].hiddenApp && (!LS.apps[id].extra || LS.hasExtra(id))).map((id) => {
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
      <div class="warn"><b>Important:</b> a web app cannot lock your iPhone by itself. ShellOS's lock screen only protects ShellOS. To stop someone leaving the app (pressing Home, swiping up, opening other apps), turn on <b>Guided Access</b>, which is built into iOS.</div>
      <h3>iPhone setup</h3>
      <ol>
        <li><b>Install:</b> open ShellOS in <b>Safari</b>, tap the <b>Share</b> button, then <b>Add to Home Screen</b> &gt; <b>Add</b>.</li>
        <li><b>Turn on Guided Access:</b> open the <b>Settings</b> app &gt; <b>Accessibility</b> &gt; <b>Guided Access</b> and switch it on.</li>
        <li>Tap <b>Passcode Settings</b> &gt; <b>Set Guided Access Passcode</b>. Use a code that is different from ShellOS's passcode and from your iPhone passcode.</li>
        <li>Open <b>ShellOS from the Home Screen</b> icon (not from Safari).</li>
        <li><b>Triple-click the side button</b> and tap <b>Start</b>. The phone now stays inside ShellOS.</li>
        <li>To end: <b>triple-click the side button</b>, enter the Guided Access passcode, and tap <b>End</b>.</li>
      </ol>
      <p class="muted">Tip: in Guided Access Options you can turn off the side button, volume buttons, or set a time limit.</p>
      <h3>ShellOS basics</h3>
      <ol>
        <li>The default ShellOS passcode is <b>1234</b>. Change it in Settings &gt; Change Passcode.</li>
        <li>Tap the lock button on the Home screen to hand the phone back safely. ShellOS also locks itself after the Auto-Lock time.</li>
        <li>Photos, recordings, drawings and notes stay on this phone. Manage them in Settings &gt; Storage.</li>
        <li>If Camera or Microphone are blocked: Settings app &gt; Safari &gt; Camera / Microphone &gt; Allow, or the "aA" menu in Safari &gt; Website Settings.</li>
      </ol>
      <h3>Shell (safe browser)</h3>
      <ol>
        <li>Type a topic to search <b>Simple English Wikipedia</b>. Every article is checked before it is shown; blocked pages show "This page isn't available on ShellOS".</li>
        <li>The tiles on the Shell home page open checked kid websites. Other website addresses are blocked.</li>
        <li>For extra protection, also turn on <b>Screen Time &gt; Content &amp; Privacy Restrictions &gt; Web Content &gt; Limit Adult Websites</b> (see About).</li>
      </ol>
      <h3>YouTube (approved videos only)</h3>
      <ol>
        <li>The YouTube app only plays videos a parent approved: a starter list from kids' channels like SciShow Kids, Nat Geo Kids, Sesame Street, Crash Course Kids, Numberblocks, Alphablocks and PBS KIDS.</li>
        <li>There is no YouTube search. The "Find a video" box only searches the approved list.</li>
        <li>When a video ends, ShellOS shows its own "Up next" from the approved list. YouTube's own suggestions can't be opened.</li>
        <li>There is a daily YouTube time limit (1 hour to start). When it's used up, YouTube says "YouTube time is done for today" until midnight.</li>
        <li>Parents: add or remove videos, change the limit, see the watch history, or hide the app in the Developer Tools.</li>
      </ol>
      <h3>Photos, Stories and Quiz</h3>
      <ol>
        <li><b>Photos</b> shows camera pictures and saved drawings. Swipe to flip through them. Deleting needs the passcode.</li>
        <li><b>Stories</b> has short stories with big text. Tap <b>Read to me</b> and Buddy reads out loud, lighting up each sentence. Tap any sentence to start there.</li>
        <li><b>Quiz</b> has over 100 questions about animals, space, geography, math and science, and remembers your best score.</li>
      </ol>
      <h3>Moon Rocket and Block World</h3>
      <ol>
        <li><b>Moon Rocket:</b> drag the Saturn V rocket with your finger. Dodge planes, birds and weather balloons in the sky and asteroids in space, and fly all the way to the Moon. If you bump into something, tap to try again from the last checkpoint.</li>
        <li><b>Block World:</b> build your own block world. Pick a block at the bottom, then choose <b>Move</b> (drag to look around), <b>Dig</b> (tap or drag to dig) or <b>Build</b> (tap or drag to place; hold on a block to dig it). Walk and jump with the big arrow buttons. Your world is saved on this phone. <b>New world</b> starts a fresh one.</li>
        <li>Best scores go back to 0 each time ShellOS is locked and unlocked (a parent can change this in the Developer Tools). Game sounds and their volume are in Settings.</li>
      </ol>
      <h3>Screen Time in ShellOS</h3>
      <ol>
        <li>A parent can set a daily ShellOS time limit and a bedtime in the Developer Tools. Both are off to start.</li>
        <li>Time only counts while ShellOS is unlocked and on screen, and starts fresh at midnight. The lock screen shows the time left.</li>
        <li>When time is up, or at bedtime, ShellOS shows a "Time to rest" screen and the passcode can't open it. A parent can tap <b>Parent</b> on that screen.</li>
      </ol>
      <h3>Voice Buddy</h3>
      <ol>
        <li>Shake the phone, tap the mic button on the Home screen, or say "Hey Buddy" (if the wake word is on) to talk with just your voice.</li>
        <li>Change this in Settings &gt; Shake for Buddy. iPhone asks once to allow Motion &amp; Orientation.</li>
      </ol>
      <h3>Android</h3>
      <ol>
        <li>Open ShellOS in Chrome, tap the ⋮ menu &gt; <b>Add to Home screen</b> (or Install app).</li>
        <li>Turn on <b>App pinning</b>: Settings &gt; Security (or Security &amp; privacy &gt; More security settings) &gt; <b>App pinning</b>, and turn on "Ask for PIN before unpinning".</li>
        <li>Open ShellOS, open the Recents/Overview screen, tap the ShellOS icon at the top of its card, then <b>Pin</b>.</li>
        <li>To unpin: hold Back and Overview (or swipe up and hold), then enter your PIN.</li>
      </ol>
      <h3>Known limits</h3>
      <ol>
        <li>iPhone doesn't let web apps read the battery level, so no battery is shown there.</li>
        <li>The "Hey Buddy" wake word only works while ShellOS is open, unlocked and on screen, and iOS may stop it at any time.</li>
        <li>Weather needs the internet. The last forecast is saved for offline use.</li>
        <li>Web apps can't read the volume buttons, so voice Buddy opens with a shake or the mic button.</li>
        <li>Shell, YouTube and Weather need the internet.</li>
        <li>YouTube plays inside a locked frame. ShellOS can't filter what is inside a video itself, which is why only approved videos can play.</li>
      </ol>`;
    p.append(h);
  }
  function aboutPage(p) {
    const apps = LS.homeOrder.filter((id) => LS.apps[id] && !LS.apps[id].hiddenApp).map((id) => LS.apps[id].label || LS.apps[id].title);
    const games = (LS.gameList ? LS.gameList() : []).map((g) => g.name);
    const sec = (title, html) => { const d = el('div', { class: 'help about-sec' }); d.innerHTML = '<h3>' + title + '</h3>' + html; return d; };
    const li = (arr) => '<ul>' + arr.map((x) => '<li>' + x + '</li>').join('') + '</ul>';
    p.append(
      el('div', { class: 'about-hero' }, el('img', { src: 'icons/icon-192.png', alt: '' }), el('h2', { text: 'ShellOS' }), el('p', { class: 'muted', text: 'Version ' + (LS.VERSION || '1.0') + ' · Built ' + (LS.BUILD_DATE || '') })),
      group(row('Works offline', el('span', { class: 'val', text: 'Yes (except Weather, Shell, YouTube)' })), row('Accounts or tracking', el('span', { class: 'val', text: 'None' })), row('Data location', el('span', { class: 'val', text: 'This phone only' }))),
      sec('Apps (' + apps.length + ')', '<p>' + LS.esc(apps.join(', ')) + '</p>'),
      sec('Games (' + games.length + ')', '<p>' + LS.esc(games.join(', ')) + '</p>'),
      sec('Buddy', '<p><b>Can:</b> tell the time and date, do math, convert units, explain simple words, tell jokes, fun facts and riddles, flip coins and roll dice, open apps and games (like "open YouTube", "tell me a story", "quiz me", "open Moon Rocket" or "play Block World"), and search Shell for you. Shake the phone or tap the mic button to talk with just your voice.</p><p><b>Can\'t:</b> go on the internet, remember chats after the phone locks, or help with anything unsafe. It refuses sexual, violent, drug, hacking, hateful or self-harm topics, and never helps get past the lock, the passcode, the web filter, time limits or Guided Access. If someone sounds sad or unsafe, it points them to a trusted adult and 988.</p>'),
      sec('Safety', li([
        '<b>Buddy filter:</b> every message is checked before Buddy answers (including leetspeak and spaced-out words), and every reply is checked again before it is shown or spoken.',
        '<b>Shell filter:</b> Wikipedia (Simple English) is shown inside ShellOS only after the title, the article categories and the whole article text pass the filter. Sexual topics are always blocked. War and history are allowed, but pages about massacres, genocide, torture, terrorism, executions or other graphic events are blocked. Searches are filtered too. If a check cannot finish, the page is not shown.',
        '<b>Kid websites:</b> only a short list of checked kid sites can open, inside a locked frame that cannot open pop-ups, leave ShellOS, or go to other websites. Any other address is blocked.',
        'Images in Wikipedia are off by default.',
        '<b>Stories and Quiz</b> are written for ShellOS and live on the phone, so they work offline.',
        '<b>Games</b> have no chat, ads, accounts or scary monsters. Moon Rocket crashes are a gentle "Bonk!" with a retry, and Block World is a calm building game. Best scores reset to 0 every time ShellOS is unlocked after a lock (a Developer Tools setting, on by default).'
      ])),
      sec('YouTube safety', li([
        '<b>Approved videos only:</b> ' + (window.YTLibrary ? window.YTLibrary.VIDEOS.length : 39) + ' checked videos to start, from ' + (window.YTLibrary ? window.YTLibrary.CHANNELS.map((c) => c.ch).join(', ') : 'kids\' channels') + '. A parent can add or remove videos. There is no YouTube search.',
        'Video titles and channel names must also pass the Shell filter, or the video is hidden.',
        'Videos play from <b>youtube-nocookie.com</b> in a locked frame that cannot open pop-ups or new pages, so the YouTube logo and title links do nothing. The page\'s frame policy only allows that player, and youtube.com stays blocked in Shell.',
        'When a video ends, ShellOS removes the player and shows its own "Up next". If the player ever tries to switch to a video that isn\'t approved (for example from YouTube\'s end or pause screens), ShellOS stops it right away.',
        'A daily YouTube limit (1 hour to start) and a watch history are in the Developer Tools.'
      ])),
      sec('Screen Time in ShellOS', li([
        'Optional daily limit for all of ShellOS (30 minutes to 3 hours) and an optional bedtime window. Both are off to start.',
        'Time counts only while ShellOS is unlocked and on screen, and resets at midnight. The lock screen shows the time left.',
        'When time is up or during bedtime, ShellOS shows a "Time to rest" screen. The normal passcode cannot get past it. Only a parent can, with the Parent button.'
      ])),
      sec('Privacy', '<p>Everything you make (photos, recordings, drawings, notes, events, scores, settings) stays on this phone. There are no accounts, ads or tracking in ShellOS. The only network use is <b>Open-Meteo</b> for weather, <b>Wikipedia</b> for Shell articles, the kid websites you choose to open in Shell, and <b>YouTube</b> (youtube-nocookie.com for playing approved videos, i.ytimg.com for thumbnails, and youtube.com only when a parent checks a new video). Those services have their own privacy rules.</p>'),
      sec('iPhone limits', li([
        'No battery level: iPhone does not let web apps read the battery.',
        'No volume buttons: web apps cannot read them, so voice Buddy uses a shake or the mic button instead.',
        'The "Hey Buddy" wake word only works while ShellOS is open, unlocked and on screen.',
        'ShellOS cannot lock the phone by itself. Turn on <b>Guided Access</b> (Settings &gt; Accessibility &gt; Guided Access) so the phone stays inside ShellOS. See Help &amp; Setup.'
      ])),
      sec('Recommended: Screen Time', '<ol><li>Open the <b>Settings</b> app &gt; <b>Screen Time</b> &gt; turn it on and set a Screen Time passcode.</li><li>Tap <b>Content &amp; Privacy Restrictions</b> and turn it on.</li><li>Tap <b>App Store, Media, Web &amp; Games</b> (or <b>Content Restrictions</b>) &gt; <b>Web Content</b> &gt; <b>Limit Adult Websites</b>.</li><li>This adds Apple\'s own filter on top of ShellOS for every website.</li></ol>'),
      sec('Credits', '<p>Made by <b>Kampf Kaiser</b> (KampfGuy). Project name: LockShell. Weather data by Open-Meteo.com. Articles from Wikipedia (CC BY-SA). Kid websites and videos belong to their owners. Stories and quiz questions are original to ShellOS. The Moon Rocket Saturn V is rendered from Kampf Kaiser\'s own Blender model. Block World is an original game with textures drawn in code.</p>')
    );
  }

  LS.ui = { group, head, foot, row, chev, toggle, seg, select, mini };
  LS.register('settings', {
    title: 'Settings', icon: 'gear', color: 'linear-gradient(135deg,#aeaeb2,#636366)',
    open(body) { body.classList.add('scroll'); root = body; stack = []; push('Settings', main); },
    back() { if (stack.length > 1) { stack.pop(); paint(); return true; } return false; },
    close() { revoke(); stack = []; root = null; LS.voicesChanged = null; }
  });
})();
