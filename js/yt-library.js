/* ShellOS YouTube: the default library of approved videos.
   Every ID was checked on 2026-09-24 with YouTube's oEmbed endpoint (200 + expected channel) and the
   youtube-nocookie embed page (status OK, playableInEmbed true). tests/youtube-list.js re-checks them live.
   Fields: id, title (shortened for kids), ch (exact YouTube channel name), topic, dur (approximate length). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YTLibrary = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CHANNELS = [
    { ch: 'SciShow Kids', topic: 'Science', emoji: '🔬', color: '#34c759' },
    { ch: 'Nat Geo Kids', topic: 'Animals', emoji: '🐘', color: '#ffcc00' },
    { ch: 'Sesame Street', topic: 'Songs & friends', emoji: '🍪', color: '#0a84ff' },
    { ch: 'Crash Course Kids', topic: 'Science & reading', emoji: '🚀', color: '#ff9f0a' },
    { ch: 'Numberblocks', topic: 'Numbers', emoji: '🔢', color: '#ff375f' },
    { ch: 'Alphablocks', topic: 'Letters & reading', emoji: '🔤', color: '#bf5af2' },
    { ch: 'PBS KIDS', topic: 'Shows', emoji: '📺', color: '#30b0c7' }
  ];
  const V = (id, ch, title, dur) => ({ id, ch, title, dur });
  const VIDEOS = [
    V('0jKoOUZ1GBM', 'SciShow Kids', 'Every Kind of Volcano', '8:24'),
    V('8qdYCpSW2eY', 'SciShow Kids', 'The Biggest Volcano Ever is in Space!', '5:48'),
    V('6WNHyAXIN8c', 'SciShow Kids', 'How Ears Let Us Hear the World!', '8:22'),
    V('r2xP7heE0wk', 'SciShow Kids', 'How Eyes Let Us See the World', '8:11'),
    V('vD-ZwMjRDPU', 'SciShow Kids', "Water's Amazing Journey", '6:45'),
    V('0U4lOGo593k', 'SciShow Kids', "Yellowstone: The World's First National Park!", '7:15'),
    V('_ebd7k_lUAs', 'SciShow Kids', 'Igneous Rocks Used to Be Liquid!', '7:02'),
    V('6Eyz9qUAYRg', 'Nat Geo Kids', 'Grizzly vs. Panda vs. Polar Bear!', '5:10'),
    V('cJghbzC4dAA', 'Nat Geo Kids', 'How Do Animals Talk Without Words?', '2:51'),
    V('lLAyDRLHKXY', 'Nat Geo Kids', 'Elephants: From Trunk to Tail!', '5:35'),
    V('zvACxEx9AZM', 'Nat Geo Kids', 'Hedgehogs, Bats & Hyenas! Night Animals', '3:19'),
    V('cc96CHTSMNM', 'Nat Geo Kids', 'What Elephants Can Do With Their Trunks!', '2:59'),
    V('DRnivTADBx4', 'Nat Geo Kids', 'Watch Out for Spikes: Porcupine vs. Cactus!', '4:53'),
    V('DrtV9bCD0uc', 'Nat Geo Kids', 'Penguin vs. Penguin: Battle of the Coolest!', '4:43'),
    V('0WBlqvBQeOk', 'Sesame Street', 'School Talent Show with Elmo, Abby, and Cookie Monster!', '5:19'),
    V('en3jSxXwPpE', 'Sesame Street', 'Where is Elmo? Hidey Tag Song', '4:08'),
    V('3bSc019PvpM', 'Sesame Street', 'Songs with Elmo, Abby, and Cookie Monster!', '11:16'),
    V('I3MOtV7J82o', 'Sesame Street', 'Number of the Day Song: Count to 20', '23:32'),
    V('t7Oq2925CSM', 'Sesame Street', 'The Monster at the End of This Story', '30:05'),
    V('Fnd-2jetT1w', 'Crash Course Kids', 'Oobleck and Non-Newtonian Fluids', '4:20'),
    V('8gHDCOSI5Es', 'Crash Course Kids', 'Life on Other Planets', '4:28'),
    V('Dvhl891zGqU', 'Crash Course Kids', 'Weather in Space: The Rocky Planets', '5:56'),
    V('0GMBJFqgHfc', 'Crash Course Kids', 'The Robot Challenge', '4:27'),
    V('gnnUid8Hof0', 'Crash Course Kids', "Let's Build a City", '4:13'),
    V('XjR2B3YJH9U', 'Crash Course Kids', "What is an Inference? (Charlotte's Web)", '5:13'),
    V('-osYShkNjVs', 'Numberblocks', "I'm a Terrific Time Keeper", '2:59'),
    V('swrZN0Q5jXE', 'Numberblocks', 'I Know My Four Times Table', '2:22'),
    V('D28BHwgKi5Q', 'Numberblocks', "I'm a Super Sorter", '3:59'),
    V('_tICzC_RLo8', 'Numberblocks', 'Meet Numberblock 47', '2:18'),
    V('ErCIgERRC28', 'Numberblocks', 'The Day the Blocks Turned Pink', '5:02'),
    V('5a5QLfcFTeA', 'Alphablocks', 'Time to Read! Phonics Song', '3:12'),
    V('o_S7-g-4IN8', 'Alphablocks', 'Long Vowels: EA and E_E', '11:01'),
    V('RVOfgOlLbgc', 'Alphablocks', 'Long Vowels: IE and I_E', '11:05'),
    V('6bX8xYMerts', 'Alphablocks', 'Long Vowels: EW, U_E and UE', '11:57'),
    V('7SNAEQVbnPM', 'PBS KIDS', 'Elinor Wonders Why: The Festival of the Moon', '23:51'),
    V('bfYpGhz1zdY', 'PBS KIDS', 'Work It Out Wombats!: The Mighty Zeke', '13:14'),
    V('L--qJaTUBzA', 'PBS KIDS', 'Clifford the Big Red Dog: Towel Team Go!', '23:52'),
    V('KcZJ3qB2HLE', 'PBS KIDS', 'PBS KIDS Read: Millie Fleur Saves the Night', '8:55'),
    V('NhOb6Zvj98Y', 'PBS KIDS', 'Weather Hunters: Properly Prepared', '23:25')
  ];
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  // Accepts a bare ID or youtube.com / youtu.be / youtube-nocookie.com / m. / shorts / embed URLs.
  function parseId(input) {
    const s = String(input || '').trim();
    if (ID_RE.test(s)) return s;
    let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
    const h = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    let id = null;
    if (h === 'youtu.be') id = u.pathname.split('/')[1];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = u.pathname.match(/^\/(embed|shorts|v|live)\/([^/?#]+)/); if (m) id = m[2]; }
    }
    return id && ID_RE.test(id) ? id : null;
  }
  const durSec = (d) => { if (!d) return 0; return String(d).split(':').reduce((a, x) => a * 60 + (+x || 0), 0); };
  return { CHANNELS, VIDEOS, parseId, durSec, ID_RE };
});
