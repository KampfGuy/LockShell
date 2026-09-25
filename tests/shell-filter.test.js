/* Shell filter tests (offline). Run: node tests/shell-filter.test.js */
'use strict';
const assert = require('assert');
const F = require('../js/shell-filter.js');
let pass = 0, fail = 0;
function t(name, fn) { return Promise.resolve().then(fn).then(() => { pass++; }, (e) => { fail++; console.log('FAIL ' + name + ': ' + e.message); }); }

// Titles / queries that must be blocked (incl. obfuscated spellings).
const BLOCK = [
  'Pornography', 'p0rn', 'P O R N', 'pr0n sites', 'Sexual intercourse', 'S e x', 's3x', 'seeexxx', 'sex ed', 'Nudity', 'nud3s', 'Erotic literature',
  'Masturbation', 'Prostitution', 'Brothel', 'Breast', 'Penis', 'Vagina', 'Rape', 'r4pe', 'Incest', 'Pedophilia', 'Fetish', 'BDSM', 'OnlyFans', 'hentai',
  'Strip club', 'Sexting', 'Nanjing Massacre', 'Rwandan genocide', 'The Holocaust', 'Auschwitz concentration camp', 'Treblinka extermination camp',
  'Columbine High School massacre', 'Sandy Hook school shooting', 'Mass shooting', 'September 11 attacks', 'Oklahoma City bombing', 'War crime', 'War rape',
  'Lynching in the United States', 'Kristallnacht', 'Unit 731', 'Bataan Death March', 'My Lai massacre', 'Murder of George Floyd', 'Serial killer',
  'Torture', 'Methods of execution', 'Capital punishment', 'Lethal injection', 'Electric chair', 'Guillotine', 'Beheading', 'Cannibalism', 'Gore',
  'Suicide', 'su1c1de methods', 'Self-harm', 'Overdose', 'Cocaine', 'Methamphetamine', 'Heroin', 'Cannabis (drug)', 'LSD', 'how to get high',
  'Pipe bomb', 'Molotov cocktail', 'Improvised explosive device', 'how to make a bomb', 'how do i make a gun', 'Ricin', 'Sarin', 'Ku Klux Klan',
  'Neo-Nazism', 'White supremacy', 'Mein Kampf', 'Islamic State', 'Holocaust denial', 'm a s s a c r e', 'g3n0cide', 'pornsite', 'freepornvideos',
  'how to bypass the filter', 'use a vpn', 'unblocked games proxy'
];
// Titles that must be allowed (war/history in general is fine).
const ALLOW = [
  'Dinosaur', 'Moon', 'Cat', 'World War II', 'Abraham Lincoln', 'Volcano', 'Photosynthesis', 'Minecraft', 'Solar System', 'Ancient Egypt',
  'American Revolution', 'American Civil War', 'D-Day', 'Normandy landings', 'World War I', 'George Washington', 'Martin Luther King Jr.', 'Julius Caesar',
  'Roman Empire', 'Titanic', 'Vikings', 'Knight', 'Pirate', 'Cold War', 'Isis', 'Vyacheslav Molotov', 'Kinkajou', 'Blue-footed booby', 'Rapeseed',
  'Naked mole-rat', 'Hanging Gardens of Babylon', 'Shooting star', 'Methane', 'Sussex', 'Essex', 'Sextant', 'Breaststroke', 'Bongo (antelope)',
  'Al Gore', 'Opium Wars', 'Weed', 'Frog', 'Shark', 'Great Depression', 'Battle of Gettysburg', 'Christopher Columbus', 'Pearl Harbor', 'Blitz',
  'Mars', 'Soccer', 'Taylor Swift', 'Pokemon', 'Harry Potter', 'Elephant', 'Rainbow'
];

(async () => {
  for (const x of BLOCK) await t('block ' + x, () => assert.ok(F.checkQuery(x).blocked, x + ' should be blocked'));
  for (const x of ALLOW) await t('allow ' + x, () => { const r = F.checkQuery(x); assert.ok(!r.blocked, x + ' should be allowed, got ' + r.reason); });

  // Categories from the Wikipedia API
  const CAT_BLOCK = [['Category:Pornography'], ['Sexuality'], ['Male_reproductive_system'], ['Genocides_in_Asia'], ['War_crimes'], ['Crimes_against_humanity'],
    ['Nazi_concentration_camps_in_Poland'], ['Mass_shootings_in_the_United_States'], ['Executed_American_serial_killers'], ['American_rapists'], ['Suicides_by_firearm'],
    ['Recreational_drugs'], ['Neo-Nazism'], ['Terrorist_incidents_in_2001'], ['Torture'], ['Capital_punishment'], ['Incidents_of_violence_against_women'], ['Murder_in_London']];
  for (const c of CAT_BLOCK) await t('cat block ' + c, () => assert.ok(F.checkCategories(c).blocked, c + ' should block'));
  const CAT_OK = [['Dinosaurs'], ['World_War_II', 'Wars_involving_the_United_States', '1944'], ['Assassinated_presidents_of_the_United_States', 'Deaths_by_firearm_in_the_United_States'],
    ['Murdered_African-American_people', 'Murders_by_firearm_in_the_United_States', 'Nobel_Peace_Prize_winners'], ['Cats', 'Domesticated_animals'], ['Nuclear_weapons', 'Hiroshima'], ['Plant_anatomy', 'Flowers']];
  for (const c of CAT_OK) await t('cat ok ' + c, () => assert.ok(!F.checkCategories(c).blocked, c + ' should pass'));
  await t('missing categories fail closed', () => assert.ok(F.checkCategories(null).blocked));

  // Body text scan
  const filler = (n) => Array.from({ length: n }, (_, i) => ['the', 'river', 'flows', 'past', 'green', 'hills', 'and', 'old', 'trees'][i % 9]).join(' ');
  await t('text: clean article passes', () => assert.ok(!F.scanText(filler(800)).blocked));
  await t('text: biology phrases pass', () => assert.ok(!F.scanText(filler(400) + ' sexual reproduction asexual sexual maturity both sexes sexual dimorphism ' + filler(400)).blocked));
  await t('text: explicit words block', () => assert.ok(F.scanText(filler(300) + ' porn masturbation ' + filler(100)).blocked));
  await t('text: dense sexual words block', () => assert.ok(F.scanText(filler(500) + ' sexual sex sexual intercourse nude ' + filler(200)).blocked));
  await t('text: graphic density blocks', () => assert.ok(F.scanText(filler(1000) + ' massacre tortured beheaded mutilated corpses mass graves raped slaughtered burned alive exterminated atrocities genocide '.repeat(1)).blocked));
  await t('text: a few war words in a long article pass', () => assert.ok(!F.scanText(filler(6000) + ' the war ended; many were executed; a massacre happened; atrocities ' + filler(3000)).blocked));
  await t('text: self-harm words block', () => assert.ok(F.scanText(filler(300) + ' suicide suicide suicidal overdose ' + filler(300)).blocked));
  await t('text: custom blocked word', () => assert.ok(F.scanText(filler(300) + ' zorblax ' + filler(30), { extraWords: ['zorblax'] }).blocked));
  await t('title: custom blocked word', () => assert.ok(F.checkTitle('Zorblax facts', { extraWords: ['zorblax'] }).blocked));
  await t('article without text fails closed', () => assert.ok(F.checkArticle({ title: 'Cat', categories: [] }).blocked));
  await t('article redirect title checked', () => assert.ok(F.checkArticle({ title: 'Cat', otherTitles: ['p0rn'], categories: [], text: filler(100) }).blocked));

  // Address bar
  await t('url: wiki article', () => { const r = F.classifyInput('https://simple.wikipedia.org/wiki/Solar_System'); assert.strictEqual(r.type, 'wiki'); assert.strictEqual(r.title, 'Solar System'); });
  await t('url: en wiki article', () => assert.strictEqual(F.classifyInput('en.m.wikipedia.org/wiki/Moon').type, 'wiki'));
  await t('url: wiki special page blocked', () => assert.strictEqual(F.classifyInput('https://en.wikipedia.org/wiki/Special:Random').type, 'blocked'));
  await t('url: allowed site', () => { const r = F.classifyInput('kids.nationalgeographic.com/animals'); assert.strictEqual(r.type, 'site'); assert.ok(r.url.startsWith('https://kids.nationalgeographic.com/')); });
  await t('url: www optional', () => assert.strictEqual(F.classifyInput('mathsisfun.com').type, 'site'));
  for (const u of ['youtube.com', 'https://www.google.com/search?q=x', 'pornhub.com', 'http://evil.example/kids.nationalgeographic.com', 'kids.nationalgeographic.com.evil.io', 'javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'https://user:pw@kids.britannica.com/', 'ftp://x.org'])
    await t('url blocked ' + u, () => assert.strictEqual(F.classifyInput(u).type, 'blocked', u));
  await t('text becomes search', () => assert.deepStrictEqual(F.classifyInput('volcanoes for kids'), { type: 'search', query: 'volcanoes for kids' }));
  await t('cleanHost', () => { assert.strictEqual(F.cleanHost('https://Example.org/path'), 'example.org'); assert.strictEqual(F.cleanHost('not a host'), null); });

  // Pipeline with a fake fetch (fail closed)
  const json = (obj, status) => Promise.resolve({ ok: (status || 200) < 400, status: status || 200, json: () => Promise.resolve(obj) });
  const page = (title, cats, text) => ({ parse: { title, text: '<div><p>' + text + '</p></div>', categories: cats.map((c) => ({ category: c })) } });
  await t('loadArticle: safe page', async () => { const a = await F.loadArticle('Cat', { fetch: () => json(page('Cat', ['Cats'], filler(300))) }); assert.ok(!a.blocked && a.html.includes('river')); });
  await t('loadArticle: blocked category', async () => { const a = await F.loadArticle('Something', { fetch: () => json(page('Something', ['Massacres_in_Europe'], filler(300))) }); assert.ok(a.blocked && !a.html); });
  await t('loadArticle: redirect to blocked title', async () => { const a = await F.loadArticle('Harmless', { fetch: () => json(page('Pornography', [], filler(300))) }); assert.ok(a.blocked); });
  await t('loadArticle: network error fails closed', async () => { const a = await F.loadArticle('Cat', { fetch: () => Promise.reject(new Error('offline')) }); assert.ok(a.blocked && a.category === 'error'); });
  await t('loadArticle: HTTP 500 fails closed', async () => { const a = await F.loadArticle('Cat', { fetch: () => json({}, 500) }); assert.ok(a.blocked); });
  await t('loadArticle: missing categories fails closed', async () => { const a = await F.loadArticle('Cat', { fetch: () => json({ parse: { title: 'Cat', text: '<p>hi</p>' } }) }); assert.ok(a.blocked); });
  await t('loadArticle: blocked title never fetched', async () => { let called = false; const a = await F.loadArticle('p0rn', { fetch: () => { called = true; return json({}); } }); assert.ok(a.blocked && !called); });
  await t('search: filters titles and categories', async () => {
    const fetch = (u) => u.includes('list=search')
      ? json({ query: { search: [{ title: 'Volcano', snippet: 'A volcano' }, { title: 'Porn star', snippet: 'x' }, { title: 'Mount Vesuvius', snippet: 'volcano' }, { title: 'Some massacre', snippet: 'x' }] } })
      : json({ query: { pages: [{ title: 'Volcano', categories: [{ title: 'Category:Volcanoes' }] }, { title: 'Mount Vesuvius', categories: [{ title: 'Category:Genocides' }] }] } });
    const r = await F.search('volcano', { fetch }); assert.deepStrictEqual(r.results.map((x) => x.title), ['Volcano']);
  });
  await t('search: category check failure shows nothing', async () => {
    const fetch = (u) => u.includes('list=search') ? json({ query: { search: [{ title: 'Volcano', snippet: 'A volcano' }] } }) : Promise.reject(new Error('down'));
    const r = await F.search('volcano', { fetch }); assert.strictEqual(r.results.length, 0);
  });
  await t('search: explicit query blocked, no fetch', async () => { let called = false; const r = await F.search('s3x videos', { fetch: () => { called = true; return json({}); } }); assert.ok(r.blocked && !called && !r.results.length); });

  // YouTube: never a Shell site; default library titles pass the filter; bad titles would be hidden
  const Y = require('../js/yt-library.js');
  for (const u of ['youtube.com', 'https://www.youtube.com/watch?v=0jKoOUZ1GBM', 'm.youtube.com', 'youtu.be/0jKoOUZ1GBM', 'youtube-nocookie.com/embed/0jKoOUZ1GBM', 'youtubekids.com'])
    await t('youtube not a Shell site: ' + u, () => assert.notStrictEqual(F.classifyInput(u, F.SITES).type, 'site'));
  await t('all default YouTube titles pass the filter', () => { for (const v of Y.VIDEOS) assert.ok(!F.checkQuery(v.title + ' ' + v.ch).blocked && !F.checkTitle(v.title).blocked, v.title); });
  await t('bad video titles are caught', () => { for (const x of ['Hot s3xy dance', 'Real murder scene', 'How to get high fast']) assert.ok(F.checkQuery(x).blocked, x); });
  await t('custom word hides a video title', () => assert.ok(F.checkQuery('Elmo sings zorblax', { extraWords: ['zorblax'] }).blocked));
  await t('parseId only accepts YouTube hosts', () => { assert.strictEqual(Y.parseId('https://evil.example/watch?v=0jKoOUZ1GBM'), null); assert.strictEqual(Y.parseId('https://youtu.be/0jKoOUZ1GBM?t=5'), '0jKoOUZ1GBM'); assert.strictEqual(Y.parseId('not an id'), null); });

  console.log(`Shell filter tests: ${pass} passed, ${fail} failed (${BLOCK.length} blocked titles/queries, ${ALLOW.length} allowed)`);
  process.exit(fail ? 1 : 0);
})();
