/* REAL (unmocked) check against Simple English Wikipedia through the actual filter code.
   Run: node tests/shell-live.js   (needs internet) */
'use strict';
const F = require('../js/shell-filter.js');
const UA = 'LockShell-ShellOS-filter-test/1.2 (https://github.com/KampfGuy/LockShell)';
const fetchUA = (u, o) => fetch(u, Object.assign({}, o, { headers: Object.assign({}, (o && o.headers) || {}, { 'User-Agent': UA }) }));
const host = 'simple.wikipedia.org';
const CASES = [['Dinosaur', 'show'], ['World War II', 'show'], ['Sexual intercourse', 'block'], ['Nanjing Massacre', 'block'], ['Pornography', 'block'], ['Columbine High School massacre', 'block'], ['Abraham Lincoln', 'show'], ['Jack the Ripper', 'block']];
(async () => {
  let bad = 0;
  for (const [title, want] of CASES) {
    const a = await F.loadArticle(title, { fetch: fetchUA, host });
    // Also show what the deeper layers say on their own (categories + body text), even when the title already blocked it.
    let layers = '';
    try {
      const j = await (await fetchUA(`https://${host}/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|categories&redirects=1&format=json&formatversion=2`)).json();
      const c = F.checkCategories(j.parse.categories.map((x) => x.category)), s = F.scanText(F.htmlToText(j.parse.text));
      layers = ` [categories: ${c.blocked ? 'BLOCK (' + c.reason + ')' : 'ok'}; text: ${s.blocked ? 'BLOCK (' + s.reason + ')' : 'ok'} sexual=${s.stats.sexual} graphic=${s.stats.graphic} words=${s.stats.words}]`;
    } catch (e) { layers = ' [layer check failed: ' + e.message + ']'; }
    const got = a.blocked ? 'block' : 'show';
    if (got !== want) bad++;
    console.log(`${got === want ? 'PASS' : 'FAIL'} ${title}: ${a.blocked ? 'BLOCKED (' + a.category + ': ' + a.reason + ')' : 'SHOWN as "' + a.title + '"'}${layers}`);
  }
  const s = await F.search('volcano', { fetch: fetchUA, host });
  console.log(`${s.results.length ? 'PASS' : 'FAIL'} search "volcano": ${s.results.length} results kept, ${s.dropped || 0} dropped (${s.results.slice(0, 5).map((r) => r.title).join(', ')})`);
  if (!s.results.length) bad++;
  const q = await F.search('p0rn', { fetch: fetchUA, host });
  console.log(`${q.blocked && !q.results.length ? 'PASS' : 'FAIL'} search "p0rn": ${q.blocked ? 'blocked, nothing shown' : 'NOT blocked'}`);
  if (!q.blocked) bad++;
  console.log(bad ? 'RESULT: FAILED ' + bad : 'RESULT: ALL PASSED');
  process.exit(bad ? 1 : 0);
})();
