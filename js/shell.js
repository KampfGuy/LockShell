/* Shell: a kid-safe browser. Simple English Wikipedia rendered in-app (never an iframe) after the
   ShellFilter checks pass, plus a short list of checked kid websites in a locked-down frame.
   Everything fails closed: if a check can't finish, the page is not shown. */
(function () {
  'use strict';
  const { el, icon } = LS;
  const F = window.ShellFilter;
  const HKEY = 'lockshell.shellhist.v1';
  let ui = null, stack = [], idx = -1, token = 0, cache = new Map(), siteTimer = null, lastTouch = 0;

  /* ---------- Settings helpers ---------- */
  const cfg = () => LS.settings.shell;
  const wikiHost = () => (cfg().wiki === 'en' ? 'en.wikipedia.org' : 'simple.wikipedia.org');
  const wikiName = () => (cfg().wiki === 'en' ? 'English Wikipedia' : 'Simple English Wikipedia');
  const filterOpts = () => ({ fetch: (u, o) => window.fetch(u, o), host: wikiHost(), extraWords: cfg().blockWords || [] });
  LS.shellSites = function () {
    const off = cfg().removedSites || [];
    return F.SITES.filter((x) => !off.includes(x.host)).concat((cfg().addSites || []).filter((h) => !isYouTube(h)).map((h) => ({ host: h, url: 'https://' + h + '/', name: h.replace(/^www\./, ''), emoji: '🌐', color: '#8e8e93', custom: true })));
  };
  // YouTube never opens in Shell (videos live in the YouTube app, approved videos only).
  const isYouTube = (s) => /(^|[^a-z0-9])(youtube|youtu\.be|youtube-nocookie|ytimg)/i.test(String(s || ''));
  LS.shellIsYouTube = isYouTube;
  // Sites the frame policy (set when ShellOS started) actually allows right now.
  const frameReady = (host) => (window.SHELL_FRAME_HOSTS || []).some((h) => h.replace(/^www\./, '') === String(host).replace(/^www\./, ''));

  /* ---------- History log (last 100, shown in Developer Tools) ---------- */
  function log(kind, target, blocked, reason) {
    let h = []; try { h = JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) {}
    h.push({ t: Date.now(), kind, target: String(target || '').slice(0, 200), blocked: !!blocked, reason: reason ? String(reason).slice(0, 160) : '' });
    if (h.length > 100) h = h.slice(-100);
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) {}
  }
  LS.shellHistory = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };
  LS.clearShellHistory = () => localStorage.removeItem(HKEY);

  /* ---------- Sanitizer ---------- */
  const KEEP = new Set(['P', 'B', 'I', 'STRONG', 'EM', 'U', 'S', 'SUB', 'SUP', 'BR', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION', 'A', 'SPAN', 'DIV', 'BLOCKQUOTE', 'SMALL', 'ABBR', 'FIGURE', 'FIGCAPTION', 'IMG', 'CODE', 'PRE', 'HR', 'CITE', 'Q', 'MARK', 'BDI']);
  const DROP = 'script,style,link,meta,iframe,frame,frameset,object,embed,applet,form,input,button,textarea,select,option,audio,video,source,track,noscript,svg,math,canvas,template,base,portal,dialog,' +
    '.mw-editsection,sup.reference,.reference,.reflist,.references,.mw-references-wrap,.navbox,.navbox-styles,.vertical-navbox,.metadata,.ambox,.noprint,.mw-empty-elt,.sistersitebox,' +
    '.side-box,.authority-control,.mw-kartographer-maplink,.mbox-small,.plainlinks.hlist,.catlinks,.toc,#toc,.mw-cite-backlink,.error';
  const SKIP_SECTIONS = /^(references?|notes?|sources?|other websites|related pages|external links|further reading|bibliography|citations|footnotes|gallery|see also)$/i;
  function sanitize(html, opts) {
    const doc = new DOMParser().parseFromString('<div id="wk">' + html + '</div>', 'text/html'); // inert: nothing runs or loads
    const root = doc.getElementById('wk');
    if (!root) return null;
    root.querySelectorAll(DROP).forEach((n) => n.remove());
    if (!opts.images) root.querySelectorAll('img,figure,.thumb,.gallery,.mw-file-element,.mw-default-size,.floatright,.floatleft,.image,.mw-halign-right,.mw-halign-left,.mw-halign-center').forEach((n) => n.remove());
    // Drop reference-style sections at the end.
    root.querySelectorAll('h2').forEach((h) => {
      if (!SKIP_SECTIONS.test((h.textContent || '').trim())) return;
      const start = h.closest('.mw-heading') || h;
      let n = start.nextSibling;
      while (n && !(n.nodeType === 1 && (n.matches('h2,.mw-heading2') || n.querySelector && n.querySelector('h2')))) { const nx = n.nextSibling; n.remove(); n = nx; }
      start.remove();
    });
    const walk = (node) => {
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === 8) { c.remove(); continue; }
        if (c.nodeType !== 1) continue;
        walk(c);
        let tag = c.tagName;
        if (tag === 'H1') { const h = doc.createElement('h2'); h.append(...c.childNodes); c.replaceWith(h); continue; }
        if (!KEEP.has(tag)) { c.replaceWith(...c.childNodes); continue; }
        const cls = c.getAttribute('class') || '';
        const keep = {};
        if (tag === 'A') keep.href = c.getAttribute('href') || '';
        if (tag === 'IMG') { keep.src = c.getAttribute('src') || ''; keep.alt = c.getAttribute('alt') || ''; keep.width = c.getAttribute('width'); keep.height = c.getAttribute('height'); }
        if ((tag === 'TD' || tag === 'TH') && /^\d{1,2}$/.test(c.getAttribute('colspan') || '')) keep.colspan = c.getAttribute('colspan');
        if ((tag === 'TD' || tag === 'TH') && /^\d{1,2}$/.test(c.getAttribute('rowspan') || '')) keep.rowspan = c.getAttribute('rowspan');
        for (const a of Array.from(c.attributes)) c.removeAttribute(a.name);
        if (tag === 'TABLE') c.setAttribute('class', /infobox/.test(cls) ? 'wk-info' : 'wk-table');
        if (keep.colspan) c.setAttribute('colspan', keep.colspan);
        if (keep.rowspan) c.setAttribute('rowspan', keep.rowspan);
        if (tag === 'IMG') {
          let src = keep.src; if (src.startsWith('//')) src = 'https:' + src;
          let ok = false; try { ok = new URL(src).hostname === 'upload.wikimedia.org'; } catch (e) {}
          if (!ok || !opts.images) { c.remove(); continue; }
          c.setAttribute('src', src); c.setAttribute('alt', keep.alt); c.setAttribute('loading', 'lazy'); c.setAttribute('referrerpolicy', 'no-referrer');
          if (/^\d+$/.test(keep.width || '')) c.setAttribute('width', keep.width);
          if (/^\d+$/.test(keep.height || '')) c.setAttribute('height', keep.height);
        }
        if (tag === 'A') {
          const t = linkTarget(keep.href);
          if (!t) { c.replaceWith(...c.childNodes); continue; }
          c.setAttribute('href', '#');
          if (t.wiki) c.setAttribute('data-wiki', t.wiki); else { c.setAttribute('data-site', t.site); c.setAttribute('class', 'wk-ext'); }
        }
      }
    };
    walk(root);
    return root;
  }
  function linkTarget(href) {
    if (!href || href.startsWith('#')) return null;
    let m = href.match(/^(?:\.|https?:\/\/(?:simple|en)(?:\.m)?\.wikipedia\.org)?\/wiki\/([^?#]+)/);
    if (m) {
      let t; try { t = decodeURIComponent(m[1]).replace(/_/g, ' '); } catch (e) { return null; }
      if (/^(special|file|image|media|category|user|user talk|talk|wikipedia|help|template|portal|draft|module|mediawiki|wiktionary|wikt|commons|wikibooks|wikiquote|wikisource|wikinews|wikiversity|meta|d|s|q|n|b|v|voy|species):/i.test(t)) return null;
      return { wiki: t };
    }
    if (/^(https?:)?\/\//i.test(href)) {
      const c = F.classifyInput(href.startsWith('//') ? 'https:' + href : href, LS.shellSites());
      if (c.type === 'site' && frameReady(c.site.host)) return { site: c.url };
    }
    return null;
  }

  /* ---------- Views ---------- */
  function setAddr(text) { if (ui) { ui.addr.value = text || ''; ui.addr.blur(); } }
  function navButtons() { if (!ui) return; ui.back.disabled = idx <= 0; ui.fwd.disabled = idx >= stack.length - 1; }
  function go(entry) { stack = stack.slice(0, idx + 1); stack.push(entry); idx = stack.length - 1; render(); }
  function render() {
    if (!ui) return;
    const e = stack[idx]; token++;
    stopSite();
    navButtons();
    ui.view.innerHTML = ''; ui.view.scrollTop = 0; ui.view.className = 'sh-view';
    if (e.kind === 'home') return homeView();
    if (e.kind === 'search') return searchView(e.q);
    if (e.kind === 'wiki') return wikiView(e.title);
    if (e.kind === 'site') return siteView(e);
    return blockedView(e);
  }
  function loading(text) { ui.view.append(el('div', { class: 'sh-loading' }, el('div', { class: 'spinner' }), el('p', { class: 'muted', text: text || 'Checking…' }))); }

  function homeView() {
    setAddr('');
    const tiles = el('div', { class: 'sh-tiles' });
    LS.shellSites().forEach((s) => {
      tiles.append(el('button', { class: 'sh-tile', 'data-host': s.host, 'aria-label': s.name, onclick: () => openSite(s.url) },
        el('span', { class: 'sh-ic', style: { background: s.color }, text: s.emoji }), el('span', { class: 'sh-lbl', text: s.name })));
    });
    const topics = el('div', { class: 'sh-chips' });
    [['🦕', 'Dinosaur'], ['🪐', 'Solar System'], ['🌋', 'Volcano'], ['🐱', 'Cat'], ['🏺', 'Ancient Egypt'], ['🌊', 'Ocean'], ['🌙', 'Moon'], ['🌳', 'Rainforest']].forEach(([em, t]) =>
      topics.append(el('button', { text: em + ' ' + t, onclick: () => go({ kind: 'wiki', title: t }) })));
    ui.view.append(el('div', { class: 'sh-home' },
      el('div', { class: 'sh-hero' }, el('div', { class: 'sh-logo', html: icon('globe') }), el('h2', { text: 'Shell' }), el('p', { class: 'muted', text: 'Search ' + wikiName() + ' or open a kid website. Everything is checked first.' })),
      el('div', { class: 'sh-sec' }, el('h3', { text: 'Explore Wikipedia' }), topics,
        el('button', { class: 'ghost-btn sh-surprise', text: '🎲 Surprise me', onclick: surprise })),
      el('div', { class: 'sh-sec' }, el('h3', { text: 'Kid websites' }), tiles)));
  }

  async function searchView(q) {
    const my = token; setAddr(q);
    loading('Searching safely…');
    const r = await F.search(q, filterOpts());
    if (my !== token || !ui) return;
    ui.view.innerHTML = '';
    if (r.blocked) { log('search', q, true, r.reason); stack[idx] = { kind: 'blocked', what: q, reason: r.reason, category: r.category }; return blockedView(stack[idx]); }
    log('search', q, false, r.dropped ? r.dropped + ' results hidden' : '');
    const list = el('div', { class: 'sh-results' });
    if (r.error) list.append(LS.notice('📡', "Search isn't working right now", 'Check the internet connection and try again.'));
    else if (!r.results.length) list.append(LS.notice('🔎', 'No results', 'Try a different word, like "volcano" or "sharks".'));
    r.results.forEach((x) => list.append(el('button', { class: 'sh-result', onclick: () => go({ kind: 'wiki', title: x.title }) }, el('b', { text: x.title }), el('small', { text: x.snippet }))));
    ui.view.append(el('div', { class: 'sh-head muted', text: 'Results from ' + wikiName() }), list);
  }

  async function wikiView(title) {
    const my = token; setAddr(title);
    loading('Checking this page…');
    const key = wikiHost() + '|' + title;
    const a = cache.get(key) || await F.loadArticle(title, filterOpts());
    if (my !== token || !ui) return;
    ui.view.innerHTML = '';
    if (a.blocked) { log('wiki', title, true, a.reason); stack[idx] = { kind: 'blocked', what: title, reason: a.reason, category: a.category }; return blockedView(stack[idx]); }
    cache.set(key, a); if (cache.size > 30) cache.delete(cache.keys().next().value);
    const body = sanitize(a.html, { images: !!cfg().images });
    if (!body) { log('wiki', title, true, 'could not display'); return blockedView({ kind: 'blocked', what: title, reason: 'could not display', category: 'error' }); }
    log('wiki', a.title, false, '');
    setAddr(a.title);
    const art = el('article', { class: 'wk-article' + (cfg().images ? '' : ' no-img') }, el('h1', { text: a.title }));
    art.append(...Array.from(body.childNodes));
    art.append(el('p', { class: 'wk-credit', text: 'From ' + wikiName() + ' (CC BY-SA). Checked by ShellOS.' }));
    art.addEventListener('click', (ev) => {
      const l = ev.target.closest('a'); if (!l) return;
      ev.preventDefault(); ev.stopPropagation();
      if (l.dataset.wiki) go({ kind: 'wiki', title: l.dataset.wiki });
      else if (l.dataset.site) openSite(l.dataset.site);
    });
    ui.view.append(art);
  }

  function openSite(url) {
    const c = F.classifyInput(url, LS.shellSites());
    if (c.type !== 'site') { log('site', url, true, c.reason || 'not allowed'); return go({ kind: 'blocked', what: url, reason: c.reason }); }
    go({ kind: 'site', url: c.url, host: c.site.host, name: c.site.name });
  }
  function siteView(e) {
    setAddr(e.url.replace(/^https:\/\//, '').replace(/\/$/, ''));
    if (!frameReady(e.host)) { log('site', e.url, true, 'not in frame policy yet'); return blockedView({ kind: 'blocked', what: e.url, reason: 'restart needed', category: 'restart' }); }
    log('site', e.url, false, '');
    ui.view.classList.add('sh-site');
    const fr = el('iframe', { class: 'sh-frame', title: e.name || e.host, src: e.url, sandbox: 'allow-scripts allow-same-origin allow-forms', referrerpolicy: 'no-referrer', allow: "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; display-capture 'none'", loading: 'eager' });
    fr.addEventListener('load', () => { LS.bumpIdle(); lastTouch = Date.now(); });
    ui.view.append(fr);
    // Touches inside the frame don't reach ShellOS, so keep it awake while a site is open, but only up to 10 minutes
    // after the last touch in ShellOS itself (then normal Auto-Lock applies again).
    LS.busy.add('shell-site'); lastTouch = Date.now();
    siteTimer = setInterval(() => { if (Date.now() - lastTouch > 10 * 60000) LS.busy.delete('shell-site'); }, 15000);
  }
  function stopSite() { clearInterval(siteTimer); siteTimer = null; LS.busy.delete('shell-site'); }

  function blockedView(e) {
    setAddr(e.what && !F.looksLikeUrl(e.what) ? '' : (e.what || ''));
    const sh = e.category === 'selfharm';
    const net = e.category === 'error';
    const yt = isYouTube(e.what);
    const n = el('div', { class: 'sh-blocked' },
      el('div', { class: 'big', text: net ? '📡' : '🐚' }),
      el('h3', { text: "This page isn't available on ShellOS" }),
      el('p', { class: 'muted', text: yt ? 'Videos are in the YouTube app on the Home screen. It has videos picked just for you.' : sh ? "If you're feeling sad or thinking about hurting yourself, please talk to a trusted adult right now, or call or text 988 any time." : net ? "ShellOS couldn't check this page, so it isn't shown. Check the internet and try again." : e.category === 'restart' ? 'This website needs ShellOS to restart before it can open.' : "Let's find something else to explore!" }),
      el('div', { class: 'btns' }, el('button', { class: 'primary-btn', text: 'Back', onclick: backOrHome }),
        yt && LS.appAvailable('youtube') ? el('button', { class: 'ghost-btn', text: '▶ Open YouTube', onclick: () => LS.openApp('youtube') }) : ''));
    ui.view.append(el('div', { class: 'center sh-center' }, n));
  }
  function backOrHome() { if (idx > 0) { idx--; render(); } else { stack = [{ kind: 'home' }]; idx = 0; render(); } }

  async function surprise() {
    const my = token; ui.view.innerHTML = ''; loading('Finding a safe page…');
    const a = await F.randomArticle(filterOpts());
    if (my !== token || !ui) return;
    if (!a) { ui.view.innerHTML = ''; ui.view.append(LS.notice('📡', "Couldn't find a page", 'Check the internet connection and try again.', { label: 'Back', onclick: render })); return; }
    cache.set(wikiHost() + '|' + a.title, a);
    go({ kind: 'wiki', title: a.title });
  }

  function submit(v) {
    v = String(v || '').trim(); if (!v) return;
    const c = F.classifyInput(v, LS.shellSites());
    if (c.type === 'search') return go({ kind: 'search', q: c.query });
    if (c.type === 'wiki') return go({ kind: 'wiki', title: c.title });
    if (c.type === 'wikihome') return go({ kind: 'home' });
    if (c.type === 'site') return openSite(c.url);
    log('address', v, true, c.reason);
    go({ kind: 'blocked', what: v, reason: c.reason, category: 'address' });
  }

  LS.register('shell', {
    title: 'Shell', icon: 'globe', color: 'linear-gradient(135deg,#0a84ff,#5e5ce6)',
    open(body, actions, arg) {
      body.classList.add('shell-app');
      const addr = el('input', { class: 'sh-addr', type: 'search', placeholder: 'Search or type a kid site', enterkeyhint: 'go', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', maxlength: 200, 'aria-label': 'Address' });
      const back = el('button', { type: 'button', class: 'sh-nav', 'aria-label': 'Back', html: icon('back'), onclick: () => { if (idx > 0) { idx--; render(); } } });
      const fwd = el('button', { type: 'button', class: 'sh-nav', 'aria-label': 'Forward', html: icon('fwd'), onclick: () => { if (idx < stack.length - 1) { idx++; render(); } } });
      const home = el('button', { type: 'button', class: 'sh-nav', 'aria-label': 'Shell home', html: icon('home'), onclick: () => go({ kind: 'home' }) });
      const form = el('form', { class: 'sh-bar', onsubmit: (e) => { e.preventDefault(); submit(addr.value); } }, back, fwd, el('label', { class: 'sh-addr-wrap' }, el('span', { html: icon('search') }), addr), home);
      const view = el('div', { class: 'sh-view' });
      body.append(form, view);
      ui = { addr, back, fwd, view };
      addr.addEventListener('focus', () => addr.select());
      body.addEventListener('pointerdown', () => { lastTouch = Date.now(); }, true);
      stack = [{ kind: 'home' }]; idx = 0;
      render();
      if (arg && arg.q) submit(arg.q);
      else if (arg && arg.title) go({ kind: 'wiki', title: arg.title });
    },
    back() { return false; },
    close() { token++; stopSite(); ui = null; stack = []; idx = -1; }
  });
  LS.shellSanitize = sanitize; // exposed for tests
})();
