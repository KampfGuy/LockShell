/* Live check of the default YouTube library (needs internet).
   For every video: oEmbed must return 200 with the expected channel name, the youtube-nocookie embed page must
   report status OK + playableInEmbed, the thumbnail must load from i.ytimg.com, and the title must pass the Shell filter.
   Run: node tests/youtube-list.js */
const Y = require('../js/yt-library.js');
const F = require('../js/shell-filter.js');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
async function check(v) {
  const out = { id: v.id, ch: v.ch, title: v.title, problems: [] };
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v.id));
    if (r.status !== 200) out.problems.push('oembed ' + r.status);
    else { const j = await r.json(); out.author = j.author_name; out.ytTitle = j.title; if (j.author_name !== v.ch) out.problems.push('channel is "' + j.author_name + '"'); }
  } catch (e) { out.problems.push('oembed error ' + e.message); }
  try {
    // YouTube needs a Referer on embeds (the ShellOS page sends its origin).
    const r = await fetch('https://www.youtube-nocookie.com/embed/' + v.id + '?rel=0', { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US', Referer: 'https://kampfguy.github.io/' } });
    const t = await r.text();
    if (!t.includes('\\"status\\":\\"OK\\",\\"playableInEmbed\\":true')) out.problems.push('embed not playable (' + ((t.match(/\\"reason\\":\\"([^\\]+)/) || [])[1] || 'unknown') + ')');
  } catch (e) { out.problems.push('embed error ' + e.message); }
  try { const r = await fetch('https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg', { method: 'HEAD' }); if (r.status !== 200) out.problems.push('thumbnail ' + r.status); } catch (e) { out.problems.push('thumbnail error'); }
  const q = F.checkQuery(v.title + ' ' + v.ch); if (q.blocked) out.problems.push('Shell filter blocks title: ' + q.reason);
  return out;
}
(async () => {
  let bad = 0; const res = [];
  for (let i = 0; i < Y.VIDEOS.length; i += 6) res.push(...(await Promise.all(Y.VIDEOS.slice(i, i + 6).map(check))));
  for (const r of res) {
    if (r.problems.length) bad++;
    console.log((r.problems.length ? 'FAIL ' : 'PASS ') + r.id + ' | ' + r.ch + ' | ' + r.title + (r.problems.length ? '  -> ' + r.problems.join('; ') : ''));
  }
  const dup = Y.VIDEOS.length - new Set(Y.VIDEOS.map((v) => v.id)).size;
  if (dup) { bad++; console.log('FAIL duplicate IDs: ' + dup); }
  console.log(`YouTube library: ${res.length - bad} of ${res.length} verified${bad ? ', ' + bad + ' FAILED' : ''} (${Y.CHANNELS.length} channels)`);
  process.exit(bad ? 1 : 0);
})();
