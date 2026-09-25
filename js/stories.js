/* Stories: short original stories with large text. "Read to me" speaks one sentence at a time with Buddy's voice
   settings and highlights the sentence being read. Tap any sentence to start reading from there. */
(function () {
  'use strict';
  const { el, icon } = LS;
  const S = window.StoriesData || [];
  const synth = window.speechSynthesis;
  const RKEY = 'lockshell.storiesread.v1';
  let ui = null, reading = null, size = 1;
  const readSet = () => { try { return new Set(JSON.parse(localStorage.getItem(RKEY) || '[]')); } catch (e) { return new Set(); } };
  const markRead = (id) => { const s = readSet(); s.add(id); try { localStorage.setItem(RKEY, JSON.stringify([...s])); } catch (e) {} };
  const sentences = (p) => (p.match(/[^.!?]+[.!?]+["”’']?\s*|[^.!?]+$/g) || [p]).map((x) => x.trim()).filter(Boolean);

  function stopReading() {
    if (reading) { reading.token++; reading = null; }
    try { if (synth) synth.cancel(); } catch (e) {}
    LS.$$('.st-s.on').forEach((n) => n.classList.remove('on'));
    const b = LS.$('#stRead'); if (b) { b.innerHTML = icon('speaker') + '<span>Read to me</span>'; b.classList.remove('on'); }
  }
  function speakOne(text, done) {
    const b = LS.settings.buddy;
    let fired = false; const fin = () => { if (!fired) { fired = true; done(); } };
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = LS.voices().find((x) => x.voiceURI === b.voiceURI);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      const rate = Number(b.rate) || 1; u.rate = rate; u.pitch = Number(b.pitch) || 1;
      u.onend = fin;
      u.onerror = (e) => { if (fired) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) return fin(); fired = true; stopReading(); LS.busy.delete('stories'); LS.toast("Reading aloud isn't working right now"); };
      synth.speak(u);
      setTimeout(fin, 3000 + (text.length * 95) / rate); // safety net for browsers that never fire onend
    } catch (e) { fin(); }
  }
  function readFrom(i) {
    if (!synth) { LS.toast('Reading aloud is not available on this device'); return; }
    stopReading();
    const spans = LS.$$('.st-s'); if (!spans.length) return;
    const r = reading = { token: 0 }; const my = r.token;
    const b = LS.$('#stRead'); if (b) { b.innerHTML = icon('pause') + '<span>Stop</span>'; b.classList.add('on'); }
    LS.busy.add('stories');
    const step = (k) => {
      if (reading !== r || r.token !== my) return;
      LS.$$('.st-s.on').forEach((n) => n.classList.remove('on'));
      if (k >= spans.length) { LS.busy.delete('stories'); stopReading(); markRead(ui && ui.story ? ui.story.id : ''); return; }
      const sp = spans[k]; sp.classList.add('on');
      try { sp.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
      LS.bumpIdle();
      speakOne(sp.textContent, () => step(k + 1));
    };
    step(i || 0);
  }

  function list() {
    stopReading(); if (!ui) return;
    ui.story = null; LS.backLabel('Home'); LS.$('#appTitle').textContent = 'Stories';
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll stories-app';
    const done = readSet();
    const g = el('div', { class: 'st-grid' });
    S.forEach((s) => g.append(el('button', { class: 'st-card', 'data-story': s.id, onclick: () => open(s) },
      el('span', { class: 'st-ic', style: { background: s.color }, text: s.emoji }),
      el('span', { class: 'st-meta' }, el('b', { text: s.title }), el('small', { text: s.mins + ' min read' + (done.has(s.id) ? ' · ✓ Read' : '') })))));
    body.scrollTop = 0;
    body.append(el('div', { class: 'pad' }, el('p', { class: 'muted st-intro', text: 'Pick a story. Tap “Read to me” and Buddy will read it out loud.' }), g));
  }

  function open(s) {
    stopReading(); if (!ui) return;
    ui.story = s; LS.backLabel('Stories'); LS.$('#appTitle').textContent = 'Stories';
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll stories-app';
    const art = el('article', { class: 'st-read', style: { fontSize: (21 * size) + 'px' } });
    let n = 0;
    s.text.split(/\n\s*\n/).forEach((p) => {
      const para = el('p');
      sentences(p).forEach((t) => { const k = n++; para.append(el('span', { class: 'st-s', 'data-i': k, text: t, onclick: () => readFrom(k) }), ' '); });
      art.append(para);
    });
    const readBtn = el('button', { class: 'st-btn primary', id: 'stRead', html: icon('speaker') + '<span>Read to me</span>', onclick: () => (reading ? stopReading() : readFrom(0)) });
    const smaller = el('button', { class: 'st-btn', 'aria-label': 'Smaller text', text: 'A−', onclick: () => { size = Math.max(0.8, size - 0.15); art.style.fontSize = (21 * size) + 'px'; } });
    const bigger = el('button', { class: 'st-btn', 'aria-label': 'Bigger text', text: 'A+', onclick: () => { size = Math.min(1.6, size + 0.15); art.style.fontSize = (21 * size) + 'px'; } });
    body.append(el('div', { class: 'st-head', style: { background: s.color } }, el('div', { class: 'st-emoji', text: s.emoji }), el('h2', { text: s.title })),
      el('div', { class: 'st-tools' }, readBtn, smaller, bigger), art,
      el('div', { class: 'pad st-end' }, el('p', { class: 'muted', text: 'The End ✨' }), el('button', { class: 'ghost-btn', text: 'More stories', onclick: () => { markRead(s.id); list(); } })));
    body.scrollTop = 0;
  }

  LS.register('stories', {
    title: 'Stories', icon: 'book', color: 'linear-gradient(135deg,#ff9f0a,#ff6b00)', extra: true,
    open(body, actions, arg) { ui = { body }; const s = arg && S.find((x) => x.id === arg.id); if (s) open(s); else list(); },
    back() { if (ui && ui.story) { list(); return true; } return false; },
    close() { stopReading(); LS.busy.delete('stories'); ui = null; }
  });
  LS.onLock.push(stopReading);
})();
