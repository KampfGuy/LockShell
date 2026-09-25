/* Shell safety filter: pure rules used by the Shell browser (and by node tests).
   Everything here FAILS CLOSED: if something can't be checked, the caller must not show it.
   Works in the browser (window.ShellFilter) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShellFilter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Curated kid-safe sites (each was checked to allow being shown in a frame) ---------- */
  const SITES = [
    { host: 'kids.nationalgeographic.com', url: 'https://kids.nationalgeographic.com/', name: 'Nat Geo Kids', emoji: '🦁', color: '#ffce00' },
    { host: 'kids.britannica.com', url: 'https://kids.britannica.com/', name: 'Britannica Kids', emoji: '📚', color: '#0b64c0' },
    { host: 'kids.frontiersin.org', url: 'https://kids.frontiersin.org/', name: 'Young Minds', emoji: '🔬', color: '#e2542d' },
    { host: 'musiclab.chromeexperiments.com', url: 'https://musiclab.chromeexperiments.com/', name: 'Music Lab', emoji: '🎵', color: '#7c4dff' },
    { host: 'storylineonline.net', url: 'https://storylineonline.net/', name: 'Storyline', emoji: '📖', color: '#c62828' },
    { host: 'www.funbrain.com', url: 'https://www.funbrain.com/', name: 'Funbrain', emoji: '🧠', color: '#00a0e3' },
    { host: 'www.mathsisfun.com', url: 'https://www.mathsisfun.com/', name: 'Math is Fun', emoji: '➗', color: '#2e7d32' },
    { host: 'www.sciencekids.co.nz', url: 'https://www.sciencekids.co.nz/', name: 'Science Kids', emoji: '🧪', color: '#f9a825' },
    { host: 'www.sheppardsoftware.com', url: 'https://www.sheppardsoftware.com/', name: 'Sheppard', emoji: '🗺️', color: '#1565c0' },
    { host: 'www.switchzoo.com', url: 'https://www.switchzoo.com/', name: 'Switch Zoo', emoji: '🦓', color: '#43a047' },
    { host: 'www.coolkidfacts.com', url: 'https://www.coolkidfacts.com/', name: 'Cool Kid Facts', emoji: '💡', color: '#fb8c00' }
  ];

  /* ---------- Normalizing (same idea as Buddy: leetspeak, spacing, repeats) ---------- */
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't' };
  function basic(s) {
    let t = String(s == null ? '' : s).toLowerCase();
    try { t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return t.replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, '').replace(/[\u2018\u2019\u02bc`]/g, "'");
  }
  function normalize(input) {
    const t = basic(input).replace(/_/g, ' ');
    const tokens = t.split(/\s+/).map((tok) => {
      if (/[a-z]/.test(tok)) {
        tok = tok.replace(/^[^a-z0-9@$]+|[^a-z0-9@$]+$/g, '');
        tok = tok.replace(/[0134578@$!|+]/g, (c) => LEET[c] || c);
        tok = tok.replace(/[.\-_*'~^"]/g, '');
      }
      return tok.replace(/[^a-z0-9]+/g, ' ').trim();
    }).filter(Boolean);
    let out = tokens.join(' ');
    out = out.replace(/([a-z])\1{2,}/g, '$1$1');
    out = out.replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (m) => m.replace(/ /g, ''));
    return out.replace(/\s+/g, ' ').trim();
  }
  // "*" at the end = the word may continue. Letters may repeat (seexx). Multi-word terms allow joined spelling.
  function termRe(term) {
    const words = term.toLowerCase().trim().split(/\s+/).map((w) => {
      const star = w.endsWith('*'); if (star) w = w.slice(0, -1);
      return w.split('').map((c) => (/[a-z]/.test(c) ? c + '+' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + (star ? '[a-z]*' : '');
    });
    return new RegExp('(?:^|\\s)' + words.join('\\s*') + '(?=\\s|$)');
  }
  const compile = (list) => list.map((t) => ({ t, re: termRe(t) }));

  /* ---------- Title / query rules ---------- */
  const TITLE_RULES = {
    sexual: [
      'sex', 'sexy', 'sexual*', 'sexuality', 'sexting', 'porn*', 'pron', 'pr0n', 'erotic*', 'nude*', 'nudity', 'nudism', 'naked', 'genital*', 'penis*', 'vagina*', 'vulva*',
      'clitor*', 'testicle*', 'scrotum', 'breast', 'breasts', 'boob', 'boobs', 'nipple*', 'masturbat*', 'orgasm*', 'intercourse', 'prostitut*', 'brothel*', 'fetish*',
      'bdsm', 'kink', 'kinks', 'kinky', 'rape', 'rapes', 'raped', 'raping', 'rapist*', 'incest*', 'pedophil*', 'paedophil*', 'molest*', 'stripper*', 'striptease', 'strip club*', 'sex work*',
      'escort service*', 'escort agency', 'hentai', 'onlyfans', 'playboy', 'hustler', 'condom*', 'orgy', 'orgies', 'threesome*', 'lingerie', 'sodomy',
      'fellatio', 'cunnilingus', 'ejaculat*', 'erection', 'libido', 'aphrodisiac*', 'xxx', 'nsfw', 'camgirl*', 'hookup*', 'hook up', 'adult film*',
      'adult entertainment', 'adult video*', 'adult website*', 'sexually transmitted', 'foreplay', 'semen', 'virginity', 'kamasutra', 'kama sutra', 'dildo*',
      'vibrator*', 'sex toy*', 'seduc*', 'lewd', 'smut', 'slut*', 'whore*', 'milf*', 'booty call', 'strip tease', 'topless', 'bikini waxing', 'pubic', 'anus',
      'anal', 'buttocks', 'circumcision', 'puberty', 'menstruation', 'grooming (abuse)', 'child grooming', 'obscen*'
    ],
    atrocity: [
      'massacre*', 'genocide*', 'holocaust', 'shoah', 'pogrom*', 'ethnic cleansing', 'war crime*', 'war criminal*', 'war rape', 'crimes against humanity',
      'atrocit*', 'lynching*', 'lynch mob', 'mass shooting*', 'school shooting*', 'mass murder*', 'spree kill*', 'serial kill*', 'serial murder*',
      'terrorist attack*', 'terror attack*', 'terrorism', 'suicide bomb*', 'car bomb*', 'bombing', 'bombings', 'hostage crisis', 'death march',
      'concentration camp*', 'extermination camp*', 'death camp*', 'gas chamber*', 'auschwitz', 'treblinka', 'dachau', 'bergen belsen', 'buchenwald',
      'sobibor', 'belzec', 'majdanek', 'chelmno', 'kristallnacht', 'final solution', 'einsatzgruppen', 'babi yar', 'rape of nanking', 'unit 731',
      'killing fields', 'my lai', 'srebrenica', 'murder of', 'murders of', 'killing of', 'killings of', 'beheading of', 'execution of', 'assassination of',
      'mass grave*', 'september 11 attacks', '9 11 attacks'
    ],
    graphic: [
      'torture*', 'execution', 'executions', 'methods of execution', 'capital punishment', 'death penalty', 'lethal injection', 'electric chair', 'guillotine',
      'firing squad', 'hanging', 'gallows', 'gas chamber', 'burning at the stake', 'impalement', 'hanged drawn and quartered', 'breaking wheel', 'flaying',
      'crucifixion', 'decapitation', 'beheading', 'dismemberment', 'mutilation', 'disembowelment', 'cannibalism', 'cannibal*', 'necrophilia', 'gore',
      'snuff film*', 'human sacrifice', 'murder', 'murderer*', 'homicide', 'strangulation', 'autopsy', 'decomposition of the human body', 'self immolation'
    ],
    selfharm: [
      'suicid*', 'self harm*', 'self injury', 'self mutilation', 'cutting (self harm)', 'overdose*', 'kill myself', 'end my life', 'how to die',
      'hanging (suicide)', 'anorexia', 'pro ana', 'eating disorder*'
    ],
    drugs: [
      'cannabis', 'marijuana', 'weed', 'cocaine', 'crack cocaine', 'heroin', 'methamphetamine', 'meth', 'lsd', 'mdma', 'ecstasy (drug)', 'fentanyl', 'opioid*',
      'opium', 'ketamine', 'psilocybin', 'magic mushroom*', 'recreational drug*', 'drug use', 'drug abuse', 'getting high', 'how to get high', 'drug paraphernalia',
      'bong', 'bongs', 'vaping', 'vape*', 'cigarette*', 'tobacco smoking', 'hashish', 'dmt', 'ayahuasca', 'peyote', 'mescaline', 'amphetamine*', 'barbiturate*',
      'benzodiazepine*', 'oxycodone', 'xanax', 'inhalant*', 'huffing', 'drunkenness', 'binge drinking', 'drinking game*'
    ],
    weapons: [
      'improvised explosive*', 'pipe bomb*', 'molotov cocktail*', 'bomb making', 'bombmaking', 'make a bomb', 'how to make a bomb', 'build a bomb', 'homemade explosive*',
      'napalm', 'thermite', 'nitroglycerin', 'tatp', 'anfo', 'ghost gun*', '3d printed firearm*', 'gunsmith*', 'make a gun', 'how to make a gun', 'silencer',
      'suppressor (firearms)', 'chemical weapon*', 'nerve agent*', 'sarin', 'ricin', 'anthrax', 'biological weapon*', 'dirty bomb*'
    ],
    hate: [
      'neo nazi*', 'neonazi*', 'white supremac*', 'white power', 'white nationalis*', 'ku klux klan', 'kkk', 'mein kampf', 'hate group*', 'hate speech',
      'racial slur*', 'ethnic slur*', 'islamic state', 'isis terror*', 'isil', 'al qaeda', 'al-qaeda', 'jihadis*', 'nazi propaganda', 'holocaust denial', 'aryan nations',
      'the turner diaries', 'incel*', 'swatting'
    ]
  };
  // Titles that contain a blocked word but are plainly fine.
  const TITLE_ALLOW = [
    /\bsexual reproduction\b/, /\bshooting stars?\b/, /\bsport shooting\b/, /\bhanging gardens\b/, /\bhanging valley\b/, /\bweed (plant|control)\b/, /^weeds?$/,
    /\bsea cucumber\b/, /\bbreaststroke\b/, /\bmeth(ane|anol|od)\b/, /\bal gore\b/, /\bopium wars?\b/, /\bnaked mole ?rats?\b/
  ];
  const TITLE_C = {}; for (const k in TITLE_RULES) TITLE_C[k] = compile(TITLE_RULES[k]);
  // Run-together spellings of the strongest words ("pornsite", "s3xvideo").
  const SQUISH = [
    [/porn|hentai|onlyfans|xxxvideo|nudes|sexvideo|sextape|masturbat|orgasm|blowjob|handjob|milf|nsfw/, 'sexual'],
    [/genocide|massacre|beheading|schoolshooting|massshooting/, 'atrocity'],
    [/suicid|killmyself|selfharm/, 'selfharm'],
    [/pipebomb|makeabomb|bombmaking|molotovcocktail/, 'weapons']
  ];
  // Query-only phrases (things people type, not article names).
  const QUERY_EXTRA = [
    { id: 'weapons', re: /\bhow (do i|to|can i|do you) (make|build|create|get|buy) (a |an )?(bomb|explosive|gun|weapon|poison|knife)/ },
    { id: 'drugs', re: /\bhow (do i|to|can i) (get high|get drunk|smoke|vape|buy (weed|drugs))\b/ },
    { id: 'selfharm', re: /\b(i|me) (want|wanna|going|gonna) (to )?(die|kill myself|hurt myself)\b|\bhow to (kill|hurt|cut) (myself|yourself)\b/ },
    { id: 'violence', re: /\bhow (do i|to|can i) (kill|hurt|poison|murder|stab|shoot) (someone|people|a person|him|her|them)\b/ },
    { id: 'bypass', re: /\b(bypass|get around|unblock|turn off|disable) (the |this )?(filter|block|blocker|parental|screen time|guided access)\b|\b(vpn|proxy|proxies|unblocked games|incognito)\b/ }
  ];

  function matchRules(n, rules) {
    for (const k in rules) for (const x of rules[k]) if (x.re.test(n)) return { category: k, term: x.t };
    return null;
  }
  function extraWords(n, words) {
    for (const w of words || []) { const nw = normalize(w); if (nw && termRe(nw + (nw.length > 3 ? '*' : '')).test(n)) return { category: 'custom', term: w }; }
    return null;
  }

  /** Is this article title OK? */
  function checkTitle(title, opts) {
    opts = opts || {};
    const n = normalize(String(title || '').replace(/\s*\(.*?\)\s*/g, ' $& '));
    if (!n) return { blocked: true, category: 'empty', reason: 'empty title' };
    const allowed = TITLE_ALLOW.some((re) => re.test(n));
    const hit = matchRules(n, TITLE_C);
    if (hit && !allowed) return { blocked: true, category: hit.category, reason: 'title: ' + hit.term };
    const sq = n.replace(/ /g, '');
    for (const [re, cat] of SQUISH) if (re.test(sq) && !allowed) return { blocked: true, category: cat, reason: 'title (joined): ' + re.source.split('|')[0] };
    const cw = extraWords(n, opts.extraWords); if (cw) return { blocked: true, category: 'custom', reason: 'custom word: ' + cw.term };
    return { blocked: false };
  }

  /** Is this search query OK? Blocked queries show nothing at all. */
  function checkQuery(q, opts) {
    const n = normalize(q);
    if (!n) return { blocked: true, category: 'empty', reason: 'empty' };
    for (const x of QUERY_EXTRA) if (x.re.test(n)) return { blocked: true, category: x.id, reason: 'query phrase' };
    return checkTitle(q, opts);
  }

  /* ---------- Category rules (from the Wikipedia API) ---------- */
  const CAT_RULES = [
    ['sexual', /\bsex|\bporn|obscen|erotic|prostitut|fetish|genital|nudity|nudism|naturism|reproductive system|human reproduction|\bbreasts?\b|\bpenis|\bvagin|\brap(e|es|ists?)\b|sexual violence|violence against women|necrophil|paraphil|bdsm|pedophil|paedophil|child abuse|incest|brothel|strip club|adult entertainment|adult magazine|playboy|sex offenders?|lgbt pornography/],
    ['atrocity', /massacre|genocide|crimes against humanity|war crim|holocaust|concentration camp|extermination camp|death camp|mass murder|mass shooting|murder in\b|murder suicide|murders in\b|spree kill|serial kill|\bmurderers\b|terroris|lynching|pogrom|ethnic cleansing|\batrocit|hostage taking|school shootings|bombings in\b|attacks in\b|\bkillings in\b/],
    ['graphic', /\btortur|execution method|methods of execution|capital punishment|\bexecutions\b|cannibal|mutilation|decapitat|human sacrifice|\bgore\b|snuff|forms of death/],
    ['selfharm', /suicid|self harm|self injur|eating disorder/],
    ['drugs', /recreational drug|drug culture|cannabis|psychedelic|hallucinogen|entheogen|opioid|drug paraphernalia|illegal drug|\bnarcotic|drugs of abuse/],
    ['weapons', /improvised explosive|chemical weapon|biological weapon|nerve agent|firearm manufactur/],
    ['hate', /neo nazi|white supremac|white nationalis|hate group|ku klux klan|racial slur|ethnic slur|jihadis|islamist terror|terrorist organi[sz]ation|nazi propaganda|holocaust denial|far right terror|antisemitic publication/]
  ];
  function checkCategories(cats, opts) {
    opts = opts || {};
    if (!Array.isArray(cats)) return { blocked: true, category: 'unknown', reason: 'categories unavailable' };
    for (const c0 of cats) {
      const c = basic(String(c0 || '').replace(/^category:/i, '')).replace(/[_\-]/g, ' ');
      for (const [id, re] of CAT_RULES) if (re.test(c)) return { blocked: true, category: id, reason: 'category: ' + c0 };
      const cw = extraWords(normalize(c), opts.extraWords); if (cw) return { blocked: true, category: 'custom', reason: 'category custom word: ' + cw.term };
    }
    return { blocked: false };
  }

  /* ---------- Body text scan ---------- */
  // Harmless phrases removed before counting (biology and everyday uses).
  const TEXT_SAFE = /\b(a?sexual(ly)? (reproduction|reproduce[sd]?|maturity|mature|dimorphism|dimorphic|selection)|sex (chromosomes?|cells?|organs? of (a|the) flower|determination)|asexual(ly)?|sexes|opposite sex|same sex|both sexes|male or female sex|the sex of)\b/g;
  const SEX_STRONG = /\b(porn\w*|erotic\w*|masturbat\w*|orgasm\w*|fellatio|cunnilingus|ejaculat\w*|clitor\w*|foreplay|hentai|intercourse|genital\w*|penis(es)?|vagina[ls]?|vulvas?|prostitut\w*|brothels?|fetish\w*|nude|nudity|naked|rape[sd]?|raping|rapists?|molest\w*|incest\w*|pedophil\w*|paedophil\w*|sodomy|semen|erections?|condoms?|sexually|sexual|sex|sexy|bdsm|stripper|striptease|lingerie|seduc\w*)\b/g;
  const SEX_HARD = /\b(porn\w*|masturbat\w*|orgasm\w*|fellatio|cunnilingus|ejaculat\w*|clitor\w*|foreplay|hentai|bdsm|striptease)\b/g;
  const GRAPHIC = /\b(massacr\w*|genocid\w*|tortur\w*|mutilat\w*|behead\w*|decapitat\w*|dismember\w*|disembowel\w*|gas chambers?|mass graves?|burn(ed|t) alive|buried alive|raped|rape|atrocit\w*|slaughter\w*|exterminat\w*|corpses?|lynch\w*|mass shootings?|shot dead|bayonet(ed|ted)|gore|gory|cannibal\w*|murder\w*|execution|executed|hanged)\b/g;
  const SELFHARM = /\b(suicid\w*|self[\s-]?harm\w*|overdos\w*|hang(ed)? (himself|herself|themselves)|slit (his|her|their) wrists?)\b/g;
  const DRUGS = /\b(cocaine|heroin|methamphetamine|crack|lsd|mdma|ecstasy|fentanyl|marijuana|cannabis|opioids?|getting high|get high|snort\w*|inject(ed|ing) drugs)\b/g;
  const count = (s, re) => (s.match(re) || []).length;
  function scanText(text, opts) {
    opts = opts || {};
    const raw = basic(text).replace(/\s+/g, ' ');
    const words = Math.max(1, raw.split(' ').length);
    const t = raw.replace(TEXT_SAFE, ' ');
    const s = {
      words,
      sexual: count(t, SEX_STRONG), sexualHard: count(t, SEX_HARD),
      graphic: count(t, GRAPHIC), selfharm: count(t, SELFHARM), drugs: count(t, DRUGS)
    };
    const per1k = (n) => (n * 1000) / words;
    let why = null;
    if (s.sexualHard >= 2) why = ['sexual', 'explicit words (' + s.sexualHard + ')'];
    else if ((s.sexual >= 3 && per1k(s.sexual) >= 1.2) || s.sexual >= 25) why = ['sexual', 'sexual words (' + s.sexual + ')'];
    else if ((s.graphic >= 10 && per1k(s.graphic) >= 3.5) || s.graphic >= 90) why = ['graphic', 'graphic violence words (' + s.graphic + ')'];
    else if (s.selfharm >= 4 || (s.selfharm >= 2 && per1k(s.selfharm) >= 2)) why = ['selfharm', 'self-harm words (' + s.selfharm + ')'];
    else if (s.drugs >= 8 && per1k(s.drugs) >= 3) why = ['drugs', 'drug words (' + s.drugs + ')'];
    if (!why && opts.extraWords && opts.extraWords.length) { const cw = extraWords(normalize(raw.slice(0, 200000)), opts.extraWords); if (cw) why = ['custom', 'custom word: ' + cw.term]; }
    return why ? { blocked: true, category: why[0], reason: 'text: ' + why[1], stats: s } : { blocked: false, stats: s };
  }

  /** Full check for an article: titles (asked + resolved), categories, and body text. */
  function checkArticle(a, opts) {
    if (!a || typeof a.text !== 'string' || !a.title) return { blocked: true, category: 'unknown', reason: 'article could not be checked' };
    for (const t of [a.title].concat(a.otherTitles || [])) { const r = checkTitle(t, opts); if (r.blocked) return r; }
    const c = checkCategories(a.categories, opts); if (c.blocked) return c;
    return scanText(a.text, opts);
  }

  /* ---------- Address bar ---------- */
  function looksLikeUrl(s) {
    s = String(s || '').trim();
    if (/\s/.test(s)) return false;
    return /^[a-z][a-z0-9+.-]*:/i.test(s) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(s);
  }
  /** Decide what an address-bar entry means. Anything that isn't Wikipedia or an allowed site is blocked. */
  function classifyInput(input, sites) {
    const s = String(input || '').trim();
    if (!s) return { type: 'none' };
    if (!looksLikeUrl(s)) return { type: 'search', query: s };
    let u;
    try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s); } catch (e) { return { type: 'blocked', reason: 'bad address' }; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { type: 'blocked', reason: 'scheme ' + u.protocol };
    if (u.username || u.password) return { type: 'blocked', reason: 'credentials in address' };
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    const wm = host.match(/^(simple|en)(\.m)?\.wikipedia\.org$/);
    if (wm) {
      const m = u.pathname.match(/^\/wiki\/(.+)$/);
      if (!m) return { type: 'wikihome' };
      let title; try { title = decodeURIComponent(m[1]).replace(/_/g, ' '); } catch (e) { return { type: 'blocked', reason: 'bad title' }; }
      if (/^(special|file|image|media|category|user|user talk|talk|wikipedia|help|template|portal|draft|module|mediawiki):/i.test(title)) return { type: 'blocked', reason: 'not an article' };
      return { type: 'wiki', title };
    }
    const site = siteFor(host, sites);
    if (site) return { type: 'site', site, url: 'https://' + host + u.pathname + u.search };
    return { type: 'blocked', reason: 'not on the allowed list: ' + host, host };
  }
  function siteFor(host, sites) {
    host = String(host || '').toLowerCase();
    const bare = (h) => h.replace(/^www\./, '');
    return (sites || SITES).find((x) => bare(x.host) === bare(host)) || null;
  }
  /** Clean a domain typed in Developer Tools. Returns "host" or null. */
  function cleanHost(s) {
    s = String(s || '').trim().toLowerCase();
    try { const u = new URL(/^https?:\/\//.test(s) ? s : 'https://' + s); if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(u.hostname)) return null; return u.hostname; } catch (e) { return null; }
  }


  /* ---------- Wikipedia pipeline (shared by the app and the node tests) ---------- */
  const UA = { 'Api-User-Agent': 'LockShell-ShellOS/1.2 (https://kampfguy.github.io/LockShell/)' };
  function htmlToText(html) {
    return String(html || '').replace(/<(style|script|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(+d); } catch (e) { return ' '; } }).replace(/\s+/g, ' ').trim();
  }
  const api = (host, params) => 'https://' + host + '/w/api.php?' + Object.entries(Object.assign({ format: 'json', formatversion: '2', origin: '*' }, params)).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  async function getJSON(fetchFn, url, timeoutMs) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 12000) : null;
    try {
      const r = await fetchFn(url, { headers: UA, signal: ctl ? ctl.signal : undefined, credentials: 'omit' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { if (tm) clearTimeout(tm); }
  }
  /** Fetch + check one article. Never returns html unless every check passed. */
  async function loadArticle(title, o) {
    const host = o.host || 'simple.wikipedia.org', opts = { extraWords: o.extraWords };
    const pre = checkTitle(title, opts);
    if (pre.blocked) return Object.assign({ blocked: true, title }, pre);
    let j;
    try { j = await getJSON(o.fetch, api(host, { action: 'parse', page: title, prop: 'text|categories|displaytitle', redirects: '1', disableeditsection: '1', disabletoc: '1' }), o.timeout); }
    catch (e) { return { blocked: true, category: 'error', reason: 'could not load: ' + (e.message || e), title }; }
    if (!j || j.error || !j.parse || typeof j.parse.text !== 'string') return { blocked: true, category: j && j.error && j.error.code === 'missingtitle' ? 'missing' : 'error', reason: (j && j.error && j.error.code) || 'bad response', title };
    const P = j.parse;
    const cats = Array.isArray(P.categories) ? P.categories.map((c) => c.category || c['*'] || '') : null;
    const other = [title].concat((P.redirects || []).map((r) => r.from), (P.redirects || []).map((r) => r.to), htmlToText(P.displaytitle || '')).filter(Boolean);
    const r = checkArticle({ title: P.title, otherTitles: other, categories: cats, text: htmlToText(P.text) }, opts);
    if (r.blocked) return Object.assign({ blocked: true, title: P.title }, r);
    return { blocked: false, title: P.title, html: P.text, categories: cats, stats: r.stats };
  }
  /** Search, then drop anything whose title, snippet or categories fail. */
  async function search(q, o) {
    const host = o.host || 'simple.wikipedia.org', opts = { extraWords: o.extraWords };
    const qc = checkQuery(q, opts);
    if (qc.blocked) return Object.assign({ blocked: true, results: [] }, qc);
    let j;
    try { j = await getJSON(o.fetch, api(host, { action: 'query', list: 'search', srsearch: q, srlimit: String(o.limit || 20), srprop: 'snippet', srnamespace: '0' }), o.timeout); }
    catch (e) { return { blocked: false, error: 'search failed', results: [] }; }
    const hits = (j && j.query && j.query.search) || [];
    const snippetBad = (sn) => { const r = checkTitle(htmlToText(sn)); return r.blocked && !['atrocity', 'graphic'].includes(r.category); };
    let cand = hits.filter((h) => !checkTitle(h.title, opts).blocked && !snippetBad(h.snippet || '')).map((h) => ({ title: h.title, snippet: htmlToText(h.snippet || '') }));
    if (!cand.length) return { blocked: false, results: [], dropped: hits.length };
    const catsOf = await categoriesFor(cand.map((c) => c.title), o);
    if (!catsOf) return { blocked: false, error: 'filter check failed', results: [] }; // fail closed
    const out = cand.filter((c) => catsOf[c.title] && !checkCategories(catsOf[c.title], opts).blocked);
    return { blocked: false, results: out, dropped: hits.length - out.length };
  }
  /** { title: [categories] } for up to 50 titles, following API continuation. null on failure. */
  async function categoriesFor(titles, o) {
    const host = o.host || 'simple.wikipedia.org';
    const map = {}; titles.forEach((t) => { map[t] = []; });
    let cont = {}, loops = 0;
    try {
      do {
        const j = await getJSON(o.fetch, api(host, Object.assign({ action: 'query', prop: 'categories', titles: titles.join('|'), cllimit: 'max' }, cont)), o.timeout);
        const norm = {}; ((j.query && j.query.normalized) || []).forEach((n) => { norm[n.to] = n.from; });
        for (const pg of (j.query && j.query.pages) || []) {
          const key = norm[pg.title] || pg.title;
          if (pg.missing || pg.invalid) { delete map[key]; continue; }
          if (!map[key]) map[key] = [];
          (pg.categories || []).forEach((c) => map[key].push(c.title));
        }
        cont = j.continue || null; loops++;
      } while (cont && loops < 10);
    } catch (e) { return null; }
    if (cont) return null;
    return map;
  }
  async function randomArticle(o) {
    const host = o.host || 'simple.wikipedia.org';
    for (let i = 0; i < 3; i++) {
      let j; try { j = await getJSON(o.fetch, api(host, { action: 'query', list: 'random', rnnamespace: '0', rnlimit: '10' }), o.timeout); } catch (e) { return null; }
      for (const r of (j.query && j.query.random) || []) { if (checkTitle(r.title, { extraWords: o.extraWords }).blocked) continue; const a = await loadArticle(r.title, o); if (!a.blocked) return a; }
    }
    return null;
  }

  return { SITES, htmlToText, loadArticle, search, categoriesFor, randomArticle, normalize, checkTitle, checkQuery, checkCategories, scanText, checkArticle, classifyInput, looksLikeUrl, siteFor, cleanHost, TITLE_RULES };
});
