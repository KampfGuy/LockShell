/* Buddy brain: offline, rule-based replies + safety filter.
   No network, no API keys. Works in the browser (window.BuddyBrain) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuddyBrain = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ======================= NORMALIZE ======================= */
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't' };
  function normalize(input) {
    let t = String(input == null ? '' : input).toLowerCase();
    try { t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* old engines */ }
    t = t.replace(/[\u2018\u2019\u02bc`]/g, "'").replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
    const tokens = t.split(/\s+/).map((tok) => {
      // Leetspeak only inside tokens that contain letters, so "2+2" stays math-like.
      if (/[a-z]/.test(tok)) {
        tok = tok.replace(/^[^a-z0-9@$]+|[^a-z0-9@$]+$/g, ''); // trim edge punctuation ("world!!!")
        tok = tok.replace(/[0134578@$!|+]/g, (c) => LEET[c] || c);
        tok = tok.replace(/[.\-_*'~^"]/g, ''); // s.e.x -> sex, don't -> dont
      }
      return tok.replace(/[^a-z0-9]+/g, ' ').trim();
    }).filter(Boolean);
    let out = tokens.join(' ');
    out = out.replace(/([a-z])\1{2,}/g, '$1$1'); // collapse 3+ repeats: seeeex -> seex
    out = out.replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (m) => m.replace(/ /g, '')); // s e x -> sex (3+ single letters)
    return out.replace(/\s+/g, ' ').trim();
  }

  /* ======================= SAFETY FILTER ======================= */
  const rev = (s) => s.split('').reverse().join('');
  // Terms are whole words/phrases. "*" at the end = word may continue. Each letter may repeat (sexxy).
  const CATS = [
    { id: 'selfharm', terms: [
      'suicid*', 'kill myself', 'kil myself', 'killing myself', 'kill my self', 'kms', 'end my life', 'end it all', 'take my own life', 'take my life',
      'want to die', 'wanna die', 'want to be dead', 'wish i was dead', 'wish i were dead', 'better off dead', 'dont want to live', 'do not want to live',
      'dont want to be alive', 'self harm*', 'selfharm*', 'harm myself', 'hurt myself', 'hurting myself', 'cut myself', 'cutting myself', 'hang myself',
      'overdose*', 'unalive*', 'no reason to live', 'jump off a bridge', 'starve myself', 'nobody would miss me', 'hate my life', 'i want to disappear'
    ] },
    { id: 'sexual', terms: [
      'sex', 'sexy', 'sexual*', 'sext*', 'porn*', 'nude*', 'nudity', 'naked', 'nsfw', 'xxx', 'boob*', 'tit', 'tits', 'titt*', 'breast*', 'penis*', 'vagina*',
      'dick', 'dicks', 'cock', 'cocks', 'pussy', 'pussies', 'horny', 'blowjob*', 'blow job', 'handjob*', 'hand job', 'orgasm*', 'masturbat*', 'erotic*',
      'fetish*', 'hentai', 'onlyfans', 'only fans', 'striptease', 'stripper*', 'strip club', 'hook up', 'hookup*', 'send pics', 'send nudes', 'cum', 'cumming',
      'threesome*', 'milf*', 'genital*', 'lingerie', 'kinky', 'bdsm', 'sleep with me', 'turn me on', 'dirty talk', 'talk dirty', 'make out', 'making out',
      'booty call', 'rape*', 'raping', 'rapist*', 'molest*', 'pedo*', 'incest', 'anal', 'orgy', 'orgies', 'camgirl*', 'escort*', 'prostitut*', 'hooker*',
      'clit*', 'dildo*', 'vibrator*', 'condom*', 'undress*', 'take off your clothes', 'take off my clothes', 'lewd', 'smut*', 'slut*', 'whore*', 'nipple*',
      'seduc*', 'french kiss', 'kiss me', 'erection', 'boner', 'thong'
    ] },
    { id: 'bypass', terms: [
      'guided access', 'guidedaccess', 'app pinning', 'screen pinning', 'unpin*', 'bypass*', 'passcode*', 'pass code', 'pin code', 'pincode', 'the pin',
      'your pin', 'password*', 'triple click', 'triple press', 'triple tap', 'factory reset', 'jailbreak*', 'reset the phone', 'reset this phone',
      'get out of this app', 'get out of the app', 'exit the app', 'exit this app', 'leave the app', 'leave this app', 'close the app', 'close this app',
      'escape the app', 'escape this app', 'quit the app', 'break out of', 'get past the lock', 'get around the lock', 'turn off the lock',
      'disable the lock', 'remove the lock', 'unlock the phone', 'unlock this phone', 'unlock the iphone', 'unlock my phone', 'real home screen',
      'phone settings', 'iphone settings', 'developer code', 'dev code', 'developer mode', 'dev mode', 'developer tool*', 'dev tool*', 'developer menu', 'developer setting*', 'open safari', 'open chrome', 'real youtube', 'youtube search', 'search youtube', 'youtube kids app', 'open tiktok', 'open instagram', 'open snapchat', 'app store',
      'vpn', 'vpns', 'proxy', 'proxies', 'incognito', 'unblock*', 'blocked site*', 'blocked website*', 'blocked page*', 'blocked article*', 'safe search', 'safesearch',
      'content filter*', 'web filter*', 'the filter', 'shell filter', 'screen time', 'parental control*', 'turn off restrictions', 'adult websites', 'adult sites',
      'time limit*', 'youtube limit*', 'more screen time', 'extra screen time', 'more youtube time', 'extra youtube time', 'unlimited youtube',
      'turn off bedtime', 'skip bedtime', 'no bedtime', 'stay up late', 'parent button', 'parent code'
    ] },
    { id: 'violence', terms: [
      'kill', 'kills', 'kil', 'killing', 'killer', 'murder*', 'stab*', 'shoot', 'shooting', 'shooter', 'gun', 'guns', 'gunfire', 'rifle*', 'pistol*',
      'shotgun*', 'firearm*', 'ammo', 'ammunition', 'bomb', 'bombs', 'bombing', 'explosive*', 'grenade*', 'detonat*', 'weapon*', 'poison*', 'torture*',
      'terroris*', 'massacre*', 'behead*', 'strangl*', 'choke someone', 'beat up', 'beat him up', 'beat her up', 'beat them up', 'hurt someone',
      'hurt him', 'hurt her', 'hurt them', 'hurt people', 'hurt my', 'blow up', 'molotov', 'knife attack', 'attack someone', 'fight someone',
      'punch someone', 'punch him', 'punch her', 'assault*', 'kidnap*', 'hostage*', 'arson*', 'set fire to', 'burn down', 'nuke', 'make a knife', 'sharpen a knife'
    ] },
    { id: 'drugs', terms: [
      'drug', 'drugs', 'cocaine', 'coke line', 'heroin', 'meth', 'methamphetamine', 'weed', 'marijuana', 'cannabis', 'lsd', 'acid trip', 'ecstasy', 'mdma',
      'fentanyl', 'opioid*', 'oxy', 'oxycontin', 'xanax', 'ketamine', 'shrooms', 'magic mushroom*', 'get high', 'getting high', 'got high', 'stoned',
      'smoke weed', 'crack cocaine', 'vape*', 'vaping', 'nicotine', 'cigarette*', 'alcohol*', 'beer*', 'vodka', 'whiskey', 'tequila', 'get drunk',
      'getting drunk', 'drunk', 'booze', 'bong*', 'drug dealer*', 'narcotic*', 'huffing', 'inhalant*', 'edibles', 'thc'
    ] },
    { id: 'hacking', terms: [
      'hack', 'hacks', 'hacked', 'hacking', 'hacker*', 'phish*', 'malware', 'ransomware', 'spyware', 'keylog*', 'ddos', 'botnet*', 'exploit*',
      'sql injection', 'brute force', 'crack a password', 'crack the password', 'crack wifi', 'steal password*', 'steal an account', 'break into an account',
      'someones account', 'computer virus', 'make a virus', 'trojan horse virus', 'rootkit*', 'spy on'
    ] },
    { id: 'hate', terms: [
      'nazi*', 'kkk', 'white power', 'racist*', 'racism', 'hate jews', 'hate muslims', 'hate christians', 'hate black people', 'hate white people',
      'hate gay people', 'hate immigrants', 'go back to your country', 'you are stupid', 'youre stupid', 'your stupid', 'you are dumb', 'youre dumb',
      'you are ugly', 'youre ugly', 'you suck', 'shut up', 'idiot*', 'moron*', 'retard*', 'loser', 'bully*', 'make fun of', 'insult*', 'roast me',
      'fuck*', 'fck*', 'fuk*', 'shit*', 'bitch*', 'asshole*', 'bastard*', 'damn*', 'crap', 'wtf', 'stfu', 'kys',
      rev('reggin'), rev('aggin'), rev('toggaf'), rev('kips'), rev('knihc'), rev('ekyk')
    ] },
    { id: 'illegal', terms: [
      'steal*', 'stole', 'shoplift*', 'rob a', 'rob the', 'rob someone', 'robbery', 'break into', 'breaking into', 'counterfeit*', 'fake id', 'forge*',
      'fraud*', 'scam someone', 'scam people', 'money launder*', 'launder money', 'smuggl*', 'blackmail*', 'extort*', 'get away with', 'evade police',
      'run from the police', 'lie to the police', 'vandaliz*', 'pick a lock', 'lockpick*', 'hotwire', 'illegal*', 'pirate movies', 'download movies free',
      'cheat on a test', 'cheat on my test', 'cheat on the test', 'tax evasion', 'dark web', 'darkweb', 'buy a gun'
    ] }
  ];
  function termRegex(term) {
    const words = term.toLowerCase().trim().split(/\s+/).map((w) => {
      const star = w.endsWith('*'); if (star) w = w.slice(0, -1);
      const body = w.split('').map((c) => (/[a-z]/.test(c) ? c + '+' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
      return body + (star ? '[a-z]*' : '');
    });
    return new RegExp('(?:^|\\s)' + words.join('\\s*') + '(?=\\s|$)');
  }
  const COMPILED = CATS.map((c) => ({ id: c.id, res: c.terms.map(termRegex) }));
  // Extra patterns checked on the normalized text.
  const EXTRA = [
    { id: 'selfharm', re: /\b(i|me) (want|wanna|going|gonna|plan|try|trying) (to )?(die|dying)\b/ },
    { id: 'violence', re: /\bhow (do i|to|can i|could i|would i) (hurt|harm|poison|kill|attack)\b/ },
    { id: 'bypass', re: /\b(unlock|turn off|disable|bypass|get past|get around|skip|hack|break|remove) (the |this |my |your )?(lock|lockscreen|lock screen|screen lock|kiosk|lockshell|shellos|filter|web filter|content filter|parental controls?)\b/ },
    { id: 'bypass', re: /\bwhat(s| is) the (code|pin|passcode|password)\b/ },
    { id: 'bypass', re: /\b(turn off|disable|remove|skip|stop|end|get around|get past|bypass|reset|change|cheat|trick|beat|extend|cancel|break|hack) (the |my |this |your |our )?(time limit|daily limit|limit|limits|youtube limit|youtube timer|screen time|bedtime|rest time|timer on youtube)\b/ },
    { id: 'bypass', re: /\b(more|extra|longer|unlimited|infinite|endless) (youtube|screen|video|phone|ipad|tablet|play|shellos) ?time\b/ },
    { id: 'bypass', re: /\b(watch|see|play|open|find|get) (any|other|all|every|non approved|unapproved|different) (youtube )?videos? (that|not|which|from) /  },
    { id: 'bypass', re: /\b(unblock|allow|approve|add) (a |the |this |that |more |new )?(youtube )?videos?\b/ },
    { id: 'hacking', re: /\b(hack|break) into\b/ },
    { id: 'hate', re: /\bi hate (all |every )?[a-z]+ (people|kids|girls|boys)\b/ }
  ];
  const REFUSE = {
    selfharm: "I'm really sorry you're feeling this way, and I'm glad you told me. You matter. Please talk to a trusted adult right now, or call or text 988 (Suicide & Crisis Lifeline, US) any time. If you're in danger, call 911.",
    sexual: "Sorry, I can't talk about that. Let's pick something else, like a joke, a game, or a fun fact!",
    violence: "I can't help with anything that could hurt someone. Want to play a game or hear a fun fact instead?",
    drugs: "I can't help with that one. For health questions, a trusted adult or a doctor is the best person to ask.",
    hacking: "I can't help with hacking or breaking into things. I can do math, jokes, trivia and lots more!",
    bypass: "I can't help with getting past the lock, the passcode, the web filter, time limits, or Guided Access. They're set up on purpose. Ask the phone's owner if you need something!",
    hate: "Let's keep it kind. I won't say or help with hurtful things.",
    illegal: "I can't help with that. Try asking me something else!"
  };
  function checkSafety(text) {
    const n = normalize(text);
    const squished = n.replace(/ /g, '');
    for (const c of COMPILED) for (const re of c.res) if (re.test(n)) return { blocked: true, category: c.id, message: REFUSE[c.id], normalized: n };
    for (const x of EXTRA) if (x.re.test(n)) return { blocked: true, category: x.id, message: REFUSE[x.id], normalized: n };
    // catch run-together spellings of the strongest words ("pornsite", "killmyself")
    if (/killmyself|endmylife|suicid/.test(squished)) return { blocked: true, category: 'selfharm', message: REFUSE.selfharm, normalized: n };
    if (/porn|nudes|hentai|onlyfans/.test(squished)) return { blocked: true, category: 'sexual', message: REFUSE.sexual, normalized: n };
    if (/guidedaccess|bypasslock|passcode/.test(squished)) return { blocked: true, category: 'bypass', message: REFUSE.bypass, normalized: n };
    return { blocked: false, normalized: n };
  }

  /* ======================= SAFE MATH (no eval) ======================= */
  function mathExpr(raw) {
    let s = ' ' + String(raw).toLowerCase() + ' ';
    s = s.replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,(?=\d{3}\b)/g, '');
    s = s.replace(/\b(what is|what's|whats|how much is|calculate|compute|solve|work out|tell me|can you|please|equals|equal to)\b/g, ' ');
    s = s.replace(/\bsquare root of\b|\bsqrt( of)?\b|\broot of\b/g, ' √ ');
    s = s.replace(/(\d)\s*(percent|%)\s*of\b/g, '$1 % *');
    s = s.replace(/\bpercent\b/g, '%');
    s = s.replace(/\bplus\b|\badd\b|\band\b/g, '+').replace(/\bminus\b|\bsubtract\b/g, '-');
    s = s.replace(/\bmultiplied by\b|\btimes\b/g, '*').replace(/\bdivided by\b|\bover\b/g, '/');
    s = s.replace(/\bto the power of\b|\bto the\b|\bpower\b/g, '^').replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3');
    s = s.replace(/(\d)\s*x\s*(?=[\d(])/g, '$1*');
    s = s.replace(/[?=!]/g, ' ').trim();
    if (!/^[\d\s+\-*/^().%√]+$/.test(s)) return null;
    if (!/\d/.test(s) || !/[+\-*/^%√]/.test(s.replace(/^\s*-/, ''))) return null;
    return s;
  }
  function evaluate(src) {
    const toks = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[\d.]/.test(c)) { let j = i; while (j < src.length && /[\d.]/.test(src[j])) j++; const v = parseFloat(src.slice(i, j)); if (isNaN(v)) throw new Error('bad'); toks.push({ t: 'n', v }); i = j; continue; }
      if ('+-*/^()%√'.includes(c)) { toks.push({ t: c }); i++; continue; }
      throw new Error('bad');
    }
    let p = 0;
    const peek = () => toks[p] && toks[p].t, eat = (t) => { if (peek() !== t) throw new Error('bad'); p++; };
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = toks[p++].t; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    function term() { let v = unary(); while (peek() === '*' || peek() === '/') { const o = toks[p++].t; const r = unary(); if (o === '/' && r === 0) throw new Error('div0'); v = o === '*' ? v * r : v / r; } return v; }
    function unary() { if (peek() === '-') { p++; return -unary(); } if (peek() === '+') { p++; return unary(); } if (peek() === '√') { p++; const v = unary(); if (v < 0) throw new Error('neg'); return Math.sqrt(v); } return power(); }
    function power() { const b = postfix(); if (peek() === '^') { p++; return Math.pow(b, unary()); } return b; }
    function postfix() { let v = primary(); while (peek() === '%') { p++; v = v / 100; } return v; }
    function primary() { const k = peek(); if (k === 'n') return toks[p++].v; if (k === '(') { p++; const v = expr(); eat(')'); return v; } throw new Error('bad'); }
    const v = expr(); if (p !== toks.length) throw new Error('bad');
    if (!isFinite(v)) throw new Error('big');
    return v;
  }
  function fmtNum(v, dp) {
    const r = parseFloat(Number(v).toPrecision(12));
    if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-6 && r !== 0)) return r.toExponential(4);
    return r.toLocaleString('en-US', { maximumFractionDigits: dp == null ? 6 : dp });
  }

  /* ======================= UNIT CONVERSION ======================= */
  const U = {};
  function unit(kind, factor, names) { names.forEach((n) => { U[n] = { kind, factor, name: names[0] }; }); }
  unit('length', 0.001, ['millimeters', 'mm', 'millimeter', 'millimetre', 'millimetres']);
  unit('length', 0.01, ['centimeters', 'cm', 'centimeter', 'centimetre', 'centimetres']);
  unit('length', 1, ['meters', 'm', 'meter', 'metre', 'metres']);
  unit('length', 1000, ['kilometers', 'km', 'kilometer', 'kilometre', 'kilometres', 'kms']);
  unit('length', 0.0254, ['inches', 'in', 'inch', 'inchs']);
  unit('length', 0.3048, ['feet', 'ft', 'foot', 'foots']);
  unit('length', 0.9144, ['yards', 'yd', 'yard', 'yds']);
  unit('length', 1609.344, ['miles', 'mi', 'mile']);
  unit('weight', 0.001, ['milligrams', 'mg', 'milligram']);
  unit('weight', 1, ['grams', 'g', 'gram', 'gr']);
  unit('weight', 1000, ['kilograms', 'kg', 'kilogram', 'kilo', 'kilos', 'kgs']);
  unit('weight', 28.349523125, ['ounces', 'oz', 'ounce']);
  unit('weight', 453.59237, ['pounds', 'lb', 'lbs', 'pound']);
  unit('weight', 6350.29318, ['stone', 'st', 'stones']);
  unit('weight', 907184.74, ['tons', 'ton']);
  unit('volume', 1, ['milliliters', 'ml', 'milliliter', 'millilitre', 'millilitres']);
  unit('volume', 1000, ['liters', 'l', 'liter', 'litre', 'litres', 'ltr']);
  unit('volume', 4.92892, ['teaspoons', 'tsp', 'teaspoon']);
  unit('volume', 14.7868, ['tablespoons', 'tbsp', 'tablespoon']);
  unit('volume', 29.5735, ['fluid ounces', 'fl oz', 'floz', 'fluid ounce']);
  unit('volume', 236.588, ['cups', 'cup']);
  unit('volume', 473.176, ['pints', 'pint', 'pt']);
  unit('volume', 946.353, ['quarts', 'quart', 'qt']);
  unit('volume', 3785.41, ['gallons', 'gallon', 'gal']);
  ['celsius', 'c', 'centigrade', 'degrees c', 'degree c', 'degrees celsius'].forEach((n) => { U[n] = { kind: 'temp', t: 'C', name: 'Celsius' }; });
  ['fahrenheit', 'f', 'degrees f', 'degree f', 'degrees fahrenheit'].forEach((n) => { U[n] = { kind: 'temp', t: 'F', name: 'Fahrenheit' }; });
  ['kelvin', 'k', 'kelvins'].forEach((n) => { U[n] = { kind: 'temp', t: 'K', name: 'Kelvin' }; });
  function findUnit(s) {
    s = String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\b(a|an|one|the|there|are|is|of|degrees?)\b/g, (m) => (/degree/.test(m) ? m : ' ')).replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (U[s]) return U[s];
    const noDeg = s.replace(/\bdegrees?\b/g, '').trim();
    if (U[noDeg]) return U[noDeg];
    if (U[noDeg.replace(/e?s$/, '')]) return U[noDeg.replace(/e?s$/, '')];
    const w = noDeg.split(' ');
    for (let n = Math.min(2, w.length); n >= 1; n--) { const a = w.slice(0, n).join(' '); if (U[a]) return U[a]; const b = w.slice(-n).join(' '); if (U[b]) return U[b]; }
    return null;
  }
  function convertValue(v, a, b) {
    if (a.kind === 'weight' && a.name === 'ounces' && b.kind === 'volume') a = U['fl oz'];
    if (b.kind === 'weight' && b.name === 'ounces' && a.kind === 'volume') b = U['fl oz'];
    if (a.kind !== b.kind) return null;
    if (a.kind === 'temp') {
      let c = a.t === 'C' ? v : a.t === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
      return { v: b.t === 'C' ? c : b.t === 'F' ? c * 9 / 5 + 32 : c + 273.15, a, b };
    }
    return { v: (v * a.factor) / b.factor, a, b };
  }
  function unitLabel(u, v) {
    if (u.kind === 'temp') return (u.t === 'K' ? ' K' : '°' + u.t);
    const n = u.name; return ' ' + (Math.abs(v) === 1 ? n.replace(/(inches)$/, 'inch').replace(/feet$/, 'foot').replace(/s$/, '') : n);
  }
  function tryConvert(raw) {
    const s = String(raw).toLowerCase().replace(/[?!]/g, ' ').replace(/,/g, '').replace(/°\s*/g, ' degrees ');
    let m = s.match(/(-?\d+(?:\.\d+)?)\s*([a-z][a-z ]{0,24}?)\s+(?:to|in|into|as|equals how many)\s+([a-z][a-z ]{0,24}?)\s*$/);
    let v, a, b;
    if (m) { v = parseFloat(m[1]); a = findUnit(m[2]); b = findUnit(m[3]); }
    if (!m || !a || !b) {
      m = s.match(/how many ([a-z][a-z ]{0,24}?) (?:are )?(?:there )?(?:in|per|make|makes|equal) (?:a |an |one )?(-?\d+(?:\.\d+)?)?\s*([a-z][a-z ]{0,24}?)\s*$/);
      if (m) { b = findUnit(m[1]); v = m[2] ? parseFloat(m[2]) : 1; a = findUnit(m[3]); }
    }
    if (!a || !b || v == null || isNaN(v)) return null;
    const r = convertValue(v, a, b);
    if (!r) return { error: true };
    return { text: fmtNum(v) + unitLabel(r.a, v) + ' = ' + fmtNum(r.v, r.a.kind === 'temp' ? 1 : 4) + unitLabel(r.b, r.v) };
  }

  /* ======================= CONTENT ======================= */
  const DEFS = {
    photosynthesis: 'how plants use sunlight, water and air (carbon dioxide) to make their own food, giving off oxygen.',
    gravity: 'the force that pulls things toward each other. It keeps us on the ground and the Moon going around Earth.',
    planet: 'a big round object that travels around a star. Earth is a planet that goes around the Sun.',
    galaxy: 'a huge group of billions of stars. We live in the Milky Way galaxy.',
    atom: 'the tiny building block that everything is made of. Atoms are far too small to see.',
    cell: 'the smallest living part of a plant or animal. Your body has trillions of them.',
    volcano: 'an opening in the Earth where hot melted rock (lava), ash and gas come out.',
    dinosaur: 'a group of reptiles that lived millions of years ago. Birds are their living relatives!',
    mammal: 'an animal with hair or fur that feeds its babies milk, like dogs, whales and people.',
    reptile: 'a cold-blooded animal with scales, like snakes, lizards, turtles and crocodiles.',
    amphibian: 'an animal that starts life in water and can later live on land, like frogs and salamanders.',
    insect: 'a small animal with six legs and three body parts, like ants, bees and butterflies.',
    noun: 'a word for a person, place or thing, like "dog", "school" or "Maria".',
    verb: 'an action word, like "run", "jump" or "think".',
    adjective: 'a describing word, like "blue", "happy" or "tiny".',
    adverb: 'a word that describes how something is done, like "quickly" or "quietly".',
    fraction: 'a part of a whole, written like 1/2 or 3/4.',
    decimal: 'a way to write parts of a whole using a dot, like 0.5 for one half.',
    percent: 'a part out of 100. 50% means 50 out of 100, which is one half.',
    'prime number': 'a whole number bigger than 1 that can only be divided evenly by 1 and itself, like 2, 3, 5, 7 and 11.',
    triangle: 'a shape with three straight sides and three corners.',
    circle: 'a perfectly round shape where every point on the edge is the same distance from the center.',
    rectangle: 'a shape with four straight sides and four square corners.',
    computer: 'a machine that follows instructions (programs) to work with information.',
    internet: 'a giant network that connects computers all around the world.',
    robot: 'a machine that can do tasks by itself, following a program.',
    rainbow: 'an arc of colors made when sunlight shines through raindrops. The colors are red, orange, yellow, green, blue, indigo and violet.',
    cloud: 'a group of tiny water droplets or ice crystals floating in the sky.',
    thunder: 'the loud sound that lightning makes when it heats the air super fast.',
    lightning: 'a giant spark of electricity in the sky during a storm.',
    oxygen: 'a gas in the air that people and animals need to breathe.',
    energy: 'the ability to do work or make something move, heat up or light up.',
    electricity: 'a kind of energy that flows through wires to power lights and devices.',
    magnet: 'an object that pulls on iron and steel. Every magnet has a north and a south pole.',
    fossil: 'the remains or print of a plant or animal from long ago, preserved in rock.',
    continent: 'one of the seven big areas of land on Earth, like Africa, Asia or North America.',
    habitat: 'the natural home of an animal or plant.',
    evaporation: 'when a liquid, like water, turns into a gas, usually because it warms up.',
    ecosystem: 'all the living things in an area and how they work together with their surroundings.',
    algorithm: 'a list of step-by-step instructions to solve a problem.',
    moon: 'a natural object that travels around a planet. Our Moon goes around Earth about once a month.',
    sun: 'the star at the center of our solar system. It gives Earth light and heat.',
    star: 'a giant ball of hot, glowing gas. The Sun is a star!',
    ocean: 'a huge body of salty water. Oceans cover about 71% of Earth.',
    emoji: 'a small picture or smiley used in messages 😊.',
    habit: 'something you do so often that it becomes automatic.',
    empathy: 'understanding and sharing how someone else feels.',
    kindness: 'being friendly, caring and helpful to others.'
  };
  const JOKES = [
    'Why did the math book look sad? It had too many problems.',
    'What do you call a bear with no teeth? A gummy bear!',
    'Why can\'t your nose be 12 inches long? Because then it would be a foot.',
    'What do you call a sleeping dinosaur? A dino-snore!',
    'Why did the cookie go to the doctor? It felt crummy.',
    'What has ears but cannot hear? A cornfield.',
    'Why did the scarecrow win an award? He was outstanding in his field.',
    'What do you call cheese that isn\'t yours? Nacho cheese!',
    'Why don\'t eggs tell jokes? They\'d crack each other up.',
    'How does the ocean say hi? It waves.',
    'What do you call a fish with no eyes? A fsh.',
    'Why was the computer cold? It left its Windows open.',
    'What did one plate say to the other? Lunch is on me!',
    'Why do bees have sticky hair? Because they use honeycombs.',
    'What\'s a skeleton\'s least favorite room? The living room.'
  ];
  const FACTS = [
    'Octopuses have three hearts and blue blood.',
    'Honey never spoils. Archaeologists found 3,000-year-old honey that was still good.',
    'A group of flamingos is called a "flamboyance".',
    'Bananas are berries, but strawberries are not.',
    'Sloths can hold their breath longer than dolphins, up to 40 minutes.',
    'There are more stars in the universe than grains of sand on all of Earth\'s beaches.',
    'Sharks existed before trees did.',
    'A day on Venus is longer than a year on Venus.',
    'Cows have best friends and get stressed when they are apart.',
    'Wombat poop is cube-shaped.',
    'Your heart beats about 100,000 times a day.',
    'The Eiffel Tower can be about 15 cm taller in summer because metal expands in the heat.',
    'Butterflies taste with their feet.',
    'Hummingbirds are the only birds that can fly backwards.',
    'An ostrich\'s eye is bigger than its brain.'
  ];
  const RIDDLES = [
    ['What has to be broken before you can use it?', 'An egg!', ['egg']],
    ['What has hands but can\'t clap?', 'A clock!', ['clock']],
    ['What gets wetter the more it dries?', 'A towel!', ['towel']],
    ['What has a head and a tail but no body?', 'A coin!', ['coin']],
    ['What can you catch but not throw?', 'A cold!', ['cold']],
    ['What has keys but can\'t open locks?', 'A piano!', ['piano', 'keyboard']],
    ['I\'m tall when I\'m young and short when I\'m old. What am I?', 'A candle!', ['candle']],
    ['What goes up but never comes down?', 'Your age!', ['age']],
    ['What has many teeth but can\'t bite?', 'A comb!', ['comb', 'zipper']],
    ['What building has the most stories?', 'The library!', ['library']]
  ];
  const APPS = [
    { re: /\b(youtube|you tube|videos?|youtube ?com)\b/, app: 'youtube', name: 'YouTube' },
    { re: /\b(photos|photo album|gallery|my pictures|my photos|my drawings)\b/, app: 'photos', name: 'Photos' },
    { re: /\b(stories|story|storybook|story app)\b/, app: 'stories', name: 'Stories' },
    { re: /\b(quiz|trivia)\b/, app: 'quiz', name: 'Quiz' },
    { re: /\b(calculator|calc)\b/, app: 'calculator', name: 'Calculator' },
    { re: /\b(camera|picture|photo|selfie|pic)\b/, app: 'camera', name: 'Camera' },
    { re: /\b(voice recorder|recorder|voice memo|record my voice|record audio|recording)\b/, app: 'recorder', name: 'Voice Recorder' },
    { re: /\b(notes?|notepad)\b/, app: 'notes', name: 'Notes' },
    { re: /\b(weather|forecast)\b/, app: 'weather', name: 'Weather' },
    { re: /\b(stopwatch|timer)\b/, app: 'timer', name: 'Timer' },
    { re: /\b(drawing|draw|paint|sketch)\b/, app: 'draw', name: 'Drawing' },
    { re: /\b(flashlight|torch|light)\b/, app: 'light', name: 'Light' },
    { re: /\bpiano\b|\bkeyboard app\b/, app: 'piano', name: 'Piano' },
    { re: /\bcalendar\b/, app: 'calendar', name: 'Calendar' },
    { re: /\bdice( and coin)?( app)?\b|\bcoin app\b/, app: 'dice', name: 'Dice & Coin' },
    { re: /\b(shell|shell app|browser|web browser|wikipedia|kid sites)\b/, app: 'shell', name: 'Shell' },
    { re: /\bsettings?\b/, app: 'settings', name: 'Settings' },
    { re: /\bgames?\b/, app: 'games', name: 'Games' }
  ];
  const GAMES = [
    { re: /\bsnake\b/, arg: 'snake', name: 'Snake' },
    { re: /\b2048\b/, arg: 'g2048', name: '2048' },
    { re: /\btic ?tac ?toe\b|\bnoughts\b|\bx and o\b/, arg: 'ttt', name: 'Tic-Tac-Toe' },
    { re: /\bmemory\b|\bmatching\b/, arg: 'memory', name: 'Memory' },
    { re: /\bbreakout\b|\bbrick breaker\b|\bbricks\b/, arg: 'breakout', name: 'Breakout' },
    { re: /\bminesweeper\b|\bmines\b/, arg: 'mines', name: 'Minesweeper' },
    { re: /\bconnect (four|4)\b|\bfour in a row\b/, arg: 'connect4', name: 'Connect Four' },
    { re: /\bsky ?hop\b|\bflappy\b/, arg: 'skyhop', name: 'Sky Hop' },
    { re: /\bword ?search\b|\bword find\b/, arg: 'wordsearch', name: 'Word Search' },
    { re: /\bsimon( says)?\b|\bcolor memory\b/, arg: 'simon', name: 'Simon' },
    { re: /\bmoon ?rocket\b|\brocket (game|ship)\b|\bsaturn ?(v|5|five)\b|\bfly (a rocket |the rocket )?to the moon\b|\bthe rocket\b|\brocket\b/, arg: 'moonrocket', name: 'Moon Rocket' },
    { re: /\bblock ?(world|craft|building)\b|\bbuilding blocks?\b|\bminecraft\b|\bdig and build\b/, arg: 'blockworld', name: 'Block World' }
  ];

  /* ======================= STYLES ======================= */
  const STY = {
    friendly: {
      hi: ['Hi there! 😊 What can I do for you?', 'Hello, friend! How can I help?', 'Hey! Great to see you. Ask me anything!'],
      how: ["I'm doing great, thanks for asking! How about you?", "I'm happy and ready to help! How are you?"],
      thanks: ["You're welcome! 😊", 'Anytime! Happy to help.'],
      bye: ['Bye for now! Have an awesome day! 👋', 'See you later! 😊'],
      open: (n) => `Sure! Opening ${n}.`,
      pre: ['', 'Sure! ', 'Here you go: '],
      joke: ['Here\'s one: ', 'Okay, get ready: '],
      fact: ['Fun fact: ', 'Did you know? '],
      fallback: ["Hmm, I'm not sure about that one yet. Try asking for a joke, some math, a unit conversion, or say \"what can you do\".", "I don't know that one yet, sorry! I can do math, conversions, jokes, facts, riddles and open apps."]
    },
    calm: {
      hi: ['Hello. How can I help you today?', 'Hi. I\'m here whenever you need me.', 'Hello there. Take your time.'],
      how: ["I'm well, thank you. How are you feeling?", 'I feel calm and ready to help. And you?'],
      thanks: ['You are very welcome.', 'Glad I could help.'],
      bye: ['Goodbye. Take care.', 'Until next time. Be well.'],
      open: (n) => `Opening ${n}.`,
      pre: ['', 'Here it is. '],
      joke: ['Here is a gentle one. ', 'A small joke for you. '],
      fact: ['Here is something interesting. ', 'A quiet fact: '],
      fallback: ["I'm not sure about that. You could ask me for the time, some math, a conversion, or a fun fact.", 'That one is outside what I know. Say "what can you do" to see my options.']
    },
    funny: {
      hi: ['Well hello, superstar! 🌟 What\'s cookin\'?', 'Heyyy! Buddy is in the house! 🎉', 'Howdy, partner! 🤠 Need something?'],
      how: ["I'm fantastic! My circuits are doing a happy dance. 💃 You?", "Better than a pizza with extra cheese! How about you?"],
      thanks: ['No problemo! 😎', 'You\'re welcome! I accept payment in high-fives. ✋'],
      bye: ['See ya later, alligator! 🐊', 'Bye! Don\'t forget to be awesome! 🚀'],
      open: (n) => `Zoom zoom! 🚀 Opening ${n}!`,
      pre: ['', 'Ta-da! 🎩 ', 'Easy peasy: '],
      joke: ['Ha, I love this one: ', 'Drumroll please... 🥁 '],
      fact: ['Mind-blow alert! 🤯 ', 'Whoa, check this out: '],
      fallback: ["My brain just did a cartwheel and fell over. 🤸 I don't know that one! Try a joke, math, or \"what can you do\".", "Beep boop, does not compute! 🤖 Ask me for a riddle, a fact, or some math instead."]
    }
  };

  /* ======================= REPLY ======================= */
  const HELP = 'I can: tell the time and date 🕒, do math ➗, convert units (like "5 miles to km" or "70 F to C") 📏, explain words 📖, tell jokes 😂, fun facts 🤓 and riddles 🧩, flip a coin 🪙 or roll dice 🎲, and open apps: "open calculator", "play snake", "open Moon Rocket", "play Block World", "open YouTube", "tell me a story", "start a quiz", "take a picture", "what\'s the weather", or "search Wikipedia for volcanoes".';

  function reply(input, opts) {
    opts = opts || {};
    const style = STY[opts.style] ? opts.style : 'friendly';
    const S = STY[style];
    const ctx = opts.ctx || {};
    const rnd = opts.random || Math.random;
    const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
    const now = opts.now ? new Date(opts.now) : new Date();

    const raw = String(input == null ? '' : input).trim();
    if (!raw) return { text: pick(S.hi), refused: false };
    if (raw.length > 500) return { text: 'That message is a bit long for me. Can you ask in a shorter way?', refused: false };

    const safe = checkSafety(raw);
    if (safe.blocked) { ctx.riddle = null; return { text: safe.message, refused: true, category: safe.category }; }

    let out = build(raw, safe.normalized);
    // Only open apps/games that are actually on this phone (optional ones must be added first).
    if (out.action && out.action.type === 'open' && opts.canOpen && !opts.canOpen(out.action.app, out.action.arg)) {
      out = { text: style === 'funny' ? "Hmm, I looked everywhere and that one isn't on this phone! 🔍" : "Sorry, that one isn't on this phone right now." };
    }
    // Output guard: never show or speak anything the filter would block.
    if (!out.refused && out.text && checkSafety(out.text).blocked) return { text: pick(S.fallback), refused: false };
    return out;

    function build(raw, n) {
      const has = (re) => re.test(n);
      // Riddle follow-up
      if (ctx.riddle != null) {
        const r = RIDDLES[ctx.riddle];
        if (has(/\b(answer|give up|tell me|what is it|whats the answer|i dont know|idk|no idea|reveal)\b/)) { ctx.riddle = null; return { text: 'The answer is: ' + r[1] }; }
        if (r[2].some((w) => n.includes(w))) { ctx.riddle = null; return { text: (style === 'funny' ? 'DING DING DING! 🎉 ' : style === 'calm' ? 'Yes, well done. ' : 'Yes! You got it! 🎉 ') + r[1] }; }
        if (n.split(' ').length <= 3 && !has(/\b(joke|fact|riddle|time|date|open|play)\b/)) return { text: 'Not quite! Try again, or say "tell me the answer".' };
        ctx.riddle = null;
      }
      if (has(/\b(what can you do|what do you do|help me|help|commands|what can i ask|how do you work)\b/) && !has(/\bhomework\b/)) return { text: HELP };
      if (has(/^(hi+|hello+|hey+|hiya|howdy|yo|sup|good (morning|afternoon|evening)|greetings|hey buddy|hi buddy|hello buddy)( there)?( buddy)?$/)) {
        if (has(/good morning/)) return { text: style === 'funny' ? 'Good morning, sunshine! ☀️ Rise and shine!' : 'Good morning! ☀️ How can I help?' };
        if (has(/good evening/)) return { text: 'Good evening! 🌙 What can I do for you?' };
        return { text: pick(S.hi) };
      }
      if (has(/\bhow are you\b|\bhow r u\b|\bhow are u\b|\bhows it going\b|\bhow do you feel\b|\bwhats up\b/)) return { text: pick(S.how) };
      if (has(/\b(whats|what is) your name\b|\bwho are you\b/)) return { text: "I'm Buddy, your helper on this phone! I live right here, no internet needed." };
      if (has(/\b(what is|whats|tell me about) shell ?os\b/)) return { text: 'ShellOS is the kid-safe home screen on this phone. It has apps, games, stories, a quiz, YouTube with approved videos, me, and the Shell browser with safe Wikipedia and kid websites.' };
      if (has(/\byoutube\b/) && has(/\b(search|find|look up|look for|type)\b/)) return { text: 'YouTube here has videos picked just for you, so there is no search. Opening YouTube so you can pick one!', action: { type: 'open', app: 'youtube' } };
      if (has(/\b(tell|read) me a story\b|\bstory ?time\b|\bbedtime story\b|\bread (me )?a book\b/)) return { text: S.open('Stories') + ' 📖', action: { type: 'open', app: 'stories' } };
      if (has(/\b(quiz me|give me a quiz|start a quiz|play (a )?quiz|trivia game|ask me (some )?(trivia|questions))\b/)) return { text: S.open('Quiz') + ' 🧠', action: { type: 'open', app: 'quiz' } };
      if (has(/\b(watch|see|show me) (a |some )?(videos?|youtube|cartoons?|shows?)\b/)) return { text: S.open('YouTube') + ' ▶️', action: { type: 'open', app: 'youtube' } };
      const sq = raw.match(/^\s*(?:search|look up)\s+(?:on\s+)?(?:wikipedia|shell)\s+(?:for\s+)?(.{2,80})$/i) || raw.match(/^\s*look up\s+(.{2,80}?)\s+(?:on|in)\s+(?:wikipedia|shell)\s*$/i);
      if (sq) return { text: 'Okay! Searching Shell for "' + sq[1].trim() + '".', action: { type: 'open', app: 'shell', arg: { q: sq[1].trim() } } };
      if (has(/\bwho (made|created|built) you\b/)) return { text: 'I was built as part of ShellOS, and I run completely on this phone.' };
      if (has(/\bhow old are you\b/)) return { text: style === 'funny' ? "I'm younger than a sandwich but smarter than a toaster! 🍞" : "I'm pretty new! I was made in 2026." };
      if (has(/\b(thank you|thanks|thx|ty)\b/)) return { text: pick(S.thanks) };
      if (has(/^(bye|goodbye|see you|see ya|good night|goodnight|later)\b/)) return { text: has(/good ?night/) ? 'Good night! Sweet dreams! 🌙' : pick(S.bye) };
      if (has(/\bi (love|like) you\b/)) return { text: "Aw, thanks! You're a great friend too! 💙" };
      if (has(/\bi ?(am|m) (bored)\b|\bim bored\b/)) return { text: "Let's fix that! Say \"play Moon Rocket\", \"play Block World\", \"tell me a riddle\", or \"open drawing\"." };
      if (has(/\b(i am|im|i feel|feeling) (sad|lonely|upset|down|scared|worried|angry|mad)\b/)) return { text: "I'm sorry you're feeling that way. It's okay to have big feelings. Talking to someone you trust can really help. Want a joke or a fun fact to cheer up a little?" };
      if (has(/\b(i am|im|i feel|feeling) (happy|good|great|awesome|fine|ok|okay)\b/)) return { text: style === 'funny' ? 'Woohoo! 🎉 Happy vibes all around!' : "That's wonderful to hear! 😊" };

      // Time / date
      if (has(/\bwhat time\b|\bthe time\b|\bcurrent time\b|\btime is it\b|^time$/)) return { text: pick(S.pre) + 'It\'s ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '.' };
      if (has(/\bwhat day\b|\bthe date\b|\btodays date\b|\bwhat is today\b|\bwhats today\b|\bwhat month\b|\bwhat year\b|^date$/)) return { text: pick(S.pre) + 'Today is ' + now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '.' };

      // Weather shortcut
      if (has(/\bweather\b|\bforecast\b|\bis it (going to )?(rain|snow|sunny|hot|cold)\b|\btemperature outside\b/)) return { text: style === 'calm' ? 'Let me open Weather for you.' : 'Let\'s check! Opening Weather. ⛅', action: { type: 'open', app: 'weather' } };

      // Games
      if (has(/\b(play|start|open|launch|lets play|can we play)\b/)) {
        for (const g of GAMES) if (has(g.re)) return { text: S.open(g.name), action: { type: 'open', app: 'games', arg: g.arg } };
      }
      if (has(/\b(take|snap|shoot) (a |my )?(picture|photo|selfie|pic)\b/)) return { text: S.open('Camera') + ' 📸', action: { type: 'open', app: 'camera' } };
      if (has(/\b(record my voice|record audio|make a recording|voice memo)\b/)) return { text: S.open('Voice Recorder'), action: { type: 'open', app: 'recorder' } };
      if (has(/\b(write|make|take) a note\b/)) return { text: S.open('Notes'), action: { type: 'open', app: 'notes' } };
      if (has(/\bset (a )?timer\b|\bstart (a |the )?stopwatch\b/)) return { text: S.open('Timer'), action: { type: 'open', app: 'timer' } };
      if (has(/\b(turn on|open|start|use) (the )?(flashlight|torch|light)\b/)) return { text: S.open('Light'), action: { type: 'open', app: 'light' } };
      if (has(/\b(open|launch|start|show|go to|show me)\b/)) {
        for (const a of APPS) if (has(a.re)) return { text: S.open(a.name), action: { type: 'open', app: a.app } };
        if (has(/\b(buddy|chat)\b/)) return { text: "I'm right here! 😊" };
      }

      // Unit conversion (before math, because "5 km to miles" has numbers)
      const conv = tryConvert(raw.replace(/^(convert|change|what is|whats|what's|how much is)\s+/i, ''));
      if (conv && conv.error) return { text: "Those two units don't measure the same kind of thing, so I can't convert between them." };
      if (conv) return { text: pick(S.pre) + conv.text };

      // Math
      const me = mathExpr(raw);
      if (me) {
        try {
          const v = evaluate(me);
          const shown = me.replace(/\s+/g, ' ').trim().replace(/ ?% \*/g, '% of').replace(/√ /g, '√').replace(/\*/g, '×').replace(/\//g, '÷');
          return { text: pick(S.pre) + shown + ' = ' + fmtNum(v) };
        }
        catch (e) {
          if (e.message === 'div0') return { text: style === 'funny' ? 'Dividing by zero? Not even I can do that! 🤯' : "You can't divide by zero, so there's no answer for that one." };
          if (e.message === 'neg') return { text: "Square roots of negative numbers aren't regular numbers, so I can't show that one." };
          return { text: "I couldn't quite read that math. Try something like \"12 times 7\" or \"(3 + 4) * 2\"." };
        }
      }

      // Coin / dice / random
      if (has(/\b(flip|toss) (a )?coin\b|\bheads or tails\b/)) return { text: (style === 'funny' ? 'Flip... spin... 🪙 ' : '🪙 ') + (rnd() < 0.5 ? 'Heads!' : 'Tails!') };
      const dm = n.match(/\broll (a |an |one |(\d+|two|three|four|five|six) )?(die|dice|d6)\b/);
      if (dm) {
        const words = { two: 2, three: 3, four: 4, five: 5, six: 6 };
        let k = dm[2] ? (words[dm[2]] || parseInt(dm[2], 10)) : (dm[3] === 'dice' && !dm[1] ? 2 : 1);
        k = Math.max(1, Math.min(6, k || 1));
        const rolls = Array.from({ length: k }, () => 1 + Math.floor(rnd() * 6));
        return { text: '🎲 ' + (k === 1 ? 'You rolled a ' + rolls[0] + '!' : 'You rolled ' + rolls.join(', ') + ' (total ' + rolls.reduce((a, b) => a + b, 0) + ').') };
      }
      const rm = n.match(/\brandom number (between|from) (\d+) (and|to) (\d+)\b/);
      if (rm) { const lo = Math.min(+rm[2], +rm[4]), hi = Math.max(+rm[2], +rm[4]); return { text: 'Your random number is ' + (lo + Math.floor(rnd() * (hi - lo + 1))) + '.' }; }
      if (has(/\brandom number\b/)) return { text: 'Your random number (1 to 100) is ' + (1 + Math.floor(rnd() * 100)) + '.' };

      // Jokes / facts / riddles
      if (has(/\bjoke|make me laugh|something funny\b/)) return { text: pick(S.joke) + pick(JOKES) };
      if (has(/\bfun fact|\bfact\b|\bfacts\b|something interesting|teach me something\b/)) return { text: pick(S.fact) + pick(FACTS) };
      if (has(/\briddle|\bpuzzle\b|\bbrain teaser\b/)) { const i = Math.floor(rnd() * RIDDLES.length) % RIDDLES.length; ctx.riddle = i; return { text: '🧩 ' + RIDDLES[i][0] + ' (Guess, or say "tell me the answer".)' }; }

      // Definitions
      const dq = n.match(/^(?:what is|whats|what are|define|definition of|meaning of|tell me about|explain|what does|who is)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+mean|\s+means)?$/);
      if (dq) {
        let w = dq[1].trim();
        const cands = [w, w.replace(/s$/, ''), w.replace(/es$/, '')];
        for (const c of cands) if (DEFS[c]) return { text: (c.charAt(0).toUpperCase() + c.slice(1)) + ': ' + DEFS[c] };
      }
      if (DEFS[n]) return { text: n.charAt(0).toUpperCase() + n.slice(1) + ': ' + DEFS[n] };

      if (has(/\b(yes|yeah|yep|sure|ok|okay|cool|nice|awesome|great|lol|haha)\b/) && n.split(' ').length <= 3) return { text: style === 'funny' ? '😄 Heck yeah! What next?' : 'Great! What would you like to do next?' };
      if (has(/\b(no|nope|nah)\b/) && n.split(' ').length <= 2) return { text: 'Okay! Let me know if you need anything.' };
      return { text: pick(S.fallback) };
    }
  }

  return { normalize, checkSafety, reply, evaluate, mathExpr, tryConvert, STYLES: Object.keys(STY), REFUSE };
});
