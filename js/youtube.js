/* YouTube (approved videos only).
   - Only videos in the approved library can play: the default list (js/yt-library.js) plus ones a parent adds in
     Developer Tools. There is no YouTube search; the filter box only searches titles in the library.
   - Titles and channel names must also pass the Shell filter (and custom blocked words), or the video is hidden.
   - Playback uses youtube-nocookie.com in a sandboxed frame WITHOUT allow-popups / allow-top-navigation, so the
     YouTube logo, title and share links can't open youtube.com. The page's frame policy (CSP frame-src) also stops
     the frame from navigating anywhere except youtube-nocookie.com.
   - The player reports its state over postMessage (enablejsapi). When a video ends we remove the player and show our
     own "Up next" from the approved list (never YouTube's suggestions). If the player ever switches to a video that
     is not the approved one (for example from YouTube's end or pause screens), the player is removed at once.
   - Daily YouTube time limit (set in Developer Tools, default 60 min) counts while a video screen is open.
   - Watch history (last 200) is shown in Developer Tools. */
(function () {
  'use strict';
  const { el, icon } = LS;
  const Y = window.YTLibrary, F = window.ShellFilter;
  const UKEY = 'lockshell.yt.v1', HKEY = 'lockshell.ythist.v1';
  const ORIGIN = 'https://www.youtube-nocookie.com';
  const cfg = () => LS.settings.yt;
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };

  /* ---------- Library ---------- */
  function textOk(v) {
    if (!v || !Y.ID_RE.test(v.id)) return false;
    const o = { extraWords: (LS.settings.shell && LS.settings.shell.blockWords) || [] };
    return !F.checkQuery(String(v.title || '') + ' ' + String(v.ch || ''), o).blocked && !F.checkTitle(String(v.title || ''), o).blocked;
  }
  LS.ytTextOk = textOk;
  LS.ytLibrary = function () {
    const removed = cfg().removed || [];
    const seen = new Set();
    return Y.VIDEOS.filter((v) => !removed.includes(v.id)).concat((cfg().added || []).map((v) => Object.assign({ custom: true }, v)))
      .filter((v) => { if (seen.has(v.id)) return false; seen.add(v.id); return textOk(v); });
  };
  const byId = (id) => LS.ytLibrary().find((v) => v.id === id) || null;
  const thumb = (id) => 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
  const chInfo = (ch) => Y.CHANNELS.find((c) => c.ch === ch) || { ch, topic: 'Added by a parent', emoji: '⭐', color: '#8e8e93' };

  /* ---------- Daily time ---------- */
  function usage() {
    let u = null; try { u = JSON.parse(localStorage.getItem(UKEY) || 'null'); } catch (e) {}
    if (!u || u.day !== dayKey()) u = { day: dayKey(), usedMs: 0, bonusMs: 0 };
    return u;
  }
  let U = usage();
  const saveU = () => { try { localStorage.setItem(UKEY, JSON.stringify(U)); } catch (e) {} };
  const roll = () => { if (U.day !== dayKey()) { U = { day: dayKey(), usedMs: 0, bonusMs: 0 }; saveU(); } };
  const limitMs = () => { const m = Number(cfg().limitMin) || 0; return m > 0 ? m * 60000 + (U.bonusMs || 0) : Infinity; };
  LS.ytTime = {
    usedMs: () => { roll(); return U.usedMs; }, limitMs: () => { roll(); return limitMs(); },
    remainingMs: () => { roll(); return Math.max(0, limitMs() - U.usedMs); },
    done: () => { roll(); return limitMs() !== Infinity && U.usedMs >= limitMs(); },
    reset() { U = { day: dayKey(), usedMs: 0, bonusMs: 0 }; saveU(); },
    addMinutes(m) { roll(); U.bonusMs = (U.bonusMs || 0) + m * 60000; saveU(); },
    _setUsed(ms) { roll(); U.usedMs = ms; saveU(); } // test hook
  };

  /* ---------- History (last 200) ---------- */
  const hist = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };
  const saveHist = (h) => { try { localStorage.setItem(HKEY, JSON.stringify(h.slice(-200))); } catch (e) {} };
  LS.ytHistory = hist;
  LS.clearYtHistory = () => localStorage.removeItem(HKEY);

  /* ---------- App state ---------- */
  let ui = null, cur = null, frame = null, tick = null, hs = null, lastTouch = 0, played = new Set(), filterText = '', chip = 'All';
  const fmtMin = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; };

  function card(v, small) {
    return el('button', { class: 'yt-card' + (small ? ' small' : ''), 'data-id': v.id, 'aria-label': v.title + ', ' + v.ch, onclick: () => play(v.id) },
      el('span', { class: 'yt-thumb' }, el('img', { src: thumb(v.id), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: function () { this.style.visibility = 'hidden'; } }), v.dur ? el('span', { class: 'yt-dur', text: v.dur }) : ''),
      el('span', { class: 'yt-meta' }, el('b', { text: v.title }), el('small', { text: v.ch })));
  }

  function timePill() {
    const left = LS.ytTime.remainingMs();
    return el('div', { class: 'yt-pill', id: 'ytLeft', text: left === Infinity ? '⏱ No daily limit' : '⏱ ' + fmtMin(left) + ' of YouTube left today' });
  }

  let libScroll = 0;
  function library() {
    stopPlayer();
    if (!ui) return;
    LS.$('#appTitle').textContent = 'YouTube'; LS.backLabel('Home');
    if (LS.ytTime.done()) return doneView();
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll yt-app';
    const all = LS.ytLibrary();
    const inp = el('input', { class: 'txt-in yt-find', type: 'search', placeholder: 'Find a video', value: filterText, maxlength: 60, 'aria-label': 'Find a video', autocomplete: 'off', autocorrect: 'off' });
    const chips = el('div', { class: 'yt-chips' });
    const list = el('div', { class: 'yt-list' });
    const chans = ['All'].concat([...new Set(all.map((v) => v.ch))]);
    chans.forEach((c) => chips.append(el('button', { class: 'yt-chip' + (c === chip ? ' on' : ''), text: c === 'All' ? 'All' : chInfo(c).emoji + ' ' + c, onclick: () => { chip = c; libScroll = 0; library(); } })));
    function draw() {
      list.innerHTML = '';
      const q = inp.value.trim().toLowerCase(); filterText = inp.value;
      const vids = all.filter((v) => (chip === 'All' || v.ch === chip) && (!q || (v.title + ' ' + v.ch).toLowerCase().includes(q)));
      if (!vids.length) { list.append(el('p', { class: 'muted yt-none', text: q ? 'No approved videos match "' + inp.value.trim() + '".' : 'No videos yet.' })); return; }
      const groups = [...new Set(vids.map((v) => v.ch))];
      groups.forEach((g) => {
        const ci = chInfo(g);
        list.append(el('div', { class: 'yt-sec' }, el('span', { class: 'yt-sec-ic', style: { background: ci.color }, text: ci.emoji }), el('b', { text: g }), el('small', { text: ci.topic })));
        const grid = el('div', { class: 'yt-grid' }); vids.filter((v) => v.ch === g).forEach((v) => grid.append(card(v))); list.append(grid);
      });
    }
    inp.addEventListener('input', draw);
    body.append(el('div', { class: 'pad yt-top' }, timePill(), inp, chips), el('div', { class: 'pad yt-body' }, list,
      el('p', { class: 'set-foot yt-foot', text: 'Only videos a parent approved can play here. ' + all.length + ' videos.' })));
    draw();
    body.scrollTop = libScroll;
  }

  function doneView() {
    stopPlayer(); if (!ui) return;
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body yt-app';
    body.append(el('div', { class: 'center yt-done', style: { flex: '1', display: 'flex' } }, el('div', { class: 'notice' },
      el('div', { class: 'big', text: '⏰' }), el('h3', { text: 'YouTube time is done for today' }),
      el('p', { text: 'Great watching! Videos come back tomorrow. How about a story, a quiz, or a game?' }),
      el('button', { class: 'primary-btn', style: { marginTop: '14px' }, text: 'Back to Home', onclick: () => LS.closeApp() }))));
  }

  function upNext(exceptId, n) {
    const all = LS.ytLibrary().filter((v) => v.id !== exceptId);
    const c = cur ? cur.v.ch : '';
    const fresh = (v) => !played.has(v.id);
    const order = all.filter((v) => v.ch === c && fresh(v)).concat(all.filter((v) => v.ch !== c && fresh(v)), all.filter((v) => !fresh(v)));
    return order.slice(0, n || 4);
  }

  function play(id) {
    if (ui && !ui.body.classList.contains('yt-playing') && !LS.$('.yt-end', ui.body)) libScroll = ui.body.scrollTop;
    const v = byId(id);
    if (!v) { LS.toast('That video is not on the approved list'); return library(); }
    if (LS.ytTime.done()) return doneView();
    stopPlayer(); if (!ui) return;
    played.add(id);
    const h = hist(); h.push({ t: Date.now(), id: v.id, title: v.title, ch: v.ch, watchedMs: 0 }); saveHist(h);
    cur = { v, start: Date.now(), heard: false, durS: Y.durSec(v.dur), idx: h.length - 1, watched: 0 };
    LS.$('#appTitle').textContent = 'YouTube'; LS.backLabel('Videos');
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll yt-app yt-playing';
    const params = 'rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0&disablekb=0&controls=1&autoplay=1&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
    frame = el('iframe', { class: 'yt-frame', title: v.title, src: ORIGIN + '/embed/' + v.id + '?' + params,
      sandbox: 'allow-scripts allow-same-origin allow-presentation', referrerpolicy: 'strict-origin-when-cross-origin',
      allow: "autoplay; encrypted-media; camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; display-capture 'none'; fullscreen 'none'" });
    frame.addEventListener('load', handshake);
    const next = el('div', { class: 'yt-next' });
    upNext(v.id, 6).forEach((x) => next.append(card(x, true)));
    body.append(el('div', { class: 'yt-stage' }, frame),
      el('div', { class: 'pad yt-info' }, el('h2', { class: 'yt-title', text: v.title }), el('div', { class: 'yt-ch muted', text: v.ch }), timePill()),
      el('div', { class: 'pad' }, el('div', { class: 'set-head', text: 'Up next (approved)' }), next));
    body.scrollTop = 0;
    LS.busy.add('youtube'); lastTouch = Date.now();
    let lastT = Date.now(), saveN = 0;
    tick = setInterval(() => {
      const now = Date.now(), dt = Math.min(5000, now - lastT); lastT = now;
      if (!cur) return;
      if (!document.hidden && !LS.isLocked()) {
        roll(); U.usedMs += dt; cur.watched += dt;
        if (++saveN % 5 === 0) { saveU(); saveWatched(); }
        const p = LS.$('#ytLeft'); if (p && limitMs() !== Infinity) p.textContent = '⏱ ' + fmtMin(Math.max(0, limitMs() - U.usedMs)) + ' of YouTube left today';
        if (limitMs() !== Infinity && U.usedMs >= limitMs()) { saveU(); saveWatched(); return doneView(); }
      }
      // Touches inside the video don't reach ShellOS: stay awake for up to 30 minutes after the last ShellOS touch.
      if (now - lastTouch > 30 * 60000) LS.busy.delete('youtube');
      // If the player never talks to us, we can't see when it ends: after the video's length (or 30 min) + 2 min, show Up next.
      if (!cur.heard && now - cur.start > ((cur.durS || 1800) + 120) * 1000) ended();
    }, 1000);
  }
  function saveWatched() { if (!cur) return; const h = hist(); const e = h[cur.idx] && h[cur.idx].id === cur.v.id ? h[cur.idx] : h[h.length - 1]; if (e && e.id === cur.v.id) { e.watchedMs = cur.watched; saveHist(h); } }
  function markHist(extra) { if (!cur) return; const h = hist(); const e = h[cur.idx] && h[cur.idx].id === cur.v.id ? h[cur.idx] : null; if (e) { Object.assign(e, extra, { watchedMs: cur.watched }); saveHist(h); } }

  function send(obj) { try { if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify(obj), ORIGIN); } catch (e) {} }
  function handshake() {
    clearInterval(hs); let n = 0;
    const go = () => { if (!cur || cur.heard || ++n > 30) { clearInterval(hs); return; } send({ event: 'listening', id: 1, channel: 'widget' }); };
    go(); hs = setInterval(go, 500);
  }
  window.addEventListener('message', (e) => {
    if (!frame || !cur || e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
    let m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
    if (!m || typeof m !== 'object') return;
    cur.heard = true;
    const info = m.info && typeof m.info === 'object' ? m.info : null;
    const vid = info && info.videoData && info.videoData.video_id;
    if (vid && vid !== cur.v.id) return offList(vid);
    if (info && typeof info.duration === 'number' && info.duration > 0) cur.durS = info.duration;
    const state = m.event === 'onStateChange' ? m.info : info ? info.playerState : undefined;
    if (state === 0) ended();
  });

  function stopPlayer() {
    clearInterval(tick); clearInterval(hs); tick = hs = null;
    if (cur) { saveU(); saveWatched(); }
    if (frame) { try { frame.src = 'about:blank'; } catch (e) {} frame.remove(); }
    frame = null; cur = null; LS.busy.delete('youtube');
  }

  function endScreen(emoji, title, text, v) {
    const was = v; stopPlayer(); if (!ui) return;
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll yt-app';
    const next = el('div', { class: 'yt-grid' }); upNext(was && was.id, 4).forEach((x) => next.append(card(x)));
    body.append(el('div', { class: 'pad yt-end' }, el('div', { class: 'yt-end-head' }, el('div', { class: 'big', text: emoji }), el('h3', { text: title }), el('p', { class: 'muted', text: text }),
      el('div', { class: 'btns' }, was ? el('button', { class: 'ghost-btn', text: '↺ Watch again', onclick: () => play(was.id) }) : '', el('button', { class: 'ghost-btn', text: 'All videos', onclick: library }))),
      el('div', { class: 'set-head', text: 'Up next (approved)' }), next));
    body.scrollTop = 0;
  }
  function ended() { if (!cur) return; const v = cur.v; markHist({ ended: true }); endScreen('🎉', "That's the end!", 'Pick another approved video.', v); }
  function offList(vid) {
    if (!cur) return; const v = cur.v;
    markHist({ stopped: 'player tried to switch to another video (' + String(vid).slice(0, 11) + ')' });
    endScreen('🛑', 'Only approved videos play here', 'That video is not on the list, so it was stopped.', v);
  }

  LS.register('youtube', {
    title: 'YouTube', icon: 'video', color: 'linear-gradient(135deg,#ff3b30,#c7001e)', extra: true,
    open(body, actions, arg) {
      ui = { body }; filterText = ''; chip = 'All';
      body.addEventListener('pointerdown', () => { lastTouch = Date.now(); LS.busy.add('youtube'); }, true);
      if (arg && arg.id && byId(arg.id)) play(arg.id); else library();
    },
    back() { if (ui && (cur || ui.body.classList.contains('yt-playing') || LS.$('.yt-end', ui.body))) { library(); return true; } return false; },
    close() { stopPlayer(); ui = null; played = new Set(); }
  });

  /* ---------- For Developer Tools: check a pasted video with YouTube oEmbed ---------- */
  LS.ytLookup = async function (input) {
    const id = Y.parseId(input);
    if (!id) return { ok: false, why: "That doesn't look like a YouTube link or video ID." };
    if (LS.ytLibrary().some((v) => v.id === id)) return { ok: false, why: 'That video is already on the list.', id };
    let r;
    try { r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)); }
    catch (e) { return { ok: false, why: "Couldn't reach YouTube to check this video.", id }; }
    if (r.status === 401 || r.status === 403) return { ok: false, why: "This video can't be played inside other apps (the owner turned off embedding).", id };
    if (r.status !== 200) return { ok: false, why: 'YouTube says this video is unavailable (' + r.status + ').', id };
    let j; try { j = await r.json(); } catch (e) { return { ok: false, why: 'YouTube sent a reply ShellOS could not read.', id }; }
    const v = { id, title: String(j.title || '').slice(0, 140), ch: String(j.author_name || '').slice(0, 80) };
    if (!v.title || !v.ch) return { ok: false, why: 'YouTube did not send a title for this video.', id };
    if (!textOk(v)) return { ok: false, why: 'The title or channel is blocked by the Shell filter.', id, v };
    return { ok: true, v, thumb: thumb(id) };
  };
  LS.ytThumb = thumb;
  LS.ytState = () => ({ open: !!cur, id: cur ? cur.v.id : null, heard: !!(cur && cur.heard), dur: cur ? cur.durS : 0 }); // for tests / Developer Tools
})();
