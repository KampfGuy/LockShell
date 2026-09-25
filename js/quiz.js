/* Quiz: kid trivia in 5 categories (plus Mix). 10 questions a round, multiple choice, score + best score. */
(function () {
  'use strict';
  const { el } = LS;
  const D = window.QuizData;
  const RIGHT = ['Correct! 🎉', 'You got it! ⭐', 'Awesome! 🙌', 'Brilliant! 🧠', 'Yes! Nice one! 😄', 'Super smart! 🚀'];
  const WRONG = ['Good try!', 'Almost!', 'Not quite!', 'Nice guess!'];
  let ui = null, round = null, timer = null;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const catOf = (id) => D.CATS.find((c) => c.id === id) || { id: 'mix', name: 'Mix', emoji: '🎲', color: '#8e8e93' };

  function home() {
    clearTimeout(timer); round = null; if (!ui) return;
    LS.$('#appTitle').textContent = 'Quiz'; LS.backLabel('Home');
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll quiz-app';
    const g = el('div', { class: 'qz-cats' });
    D.CATS.concat([{ id: 'mix', name: 'Mix it up', emoji: '🎲', color: 'linear-gradient(135deg,#ff375f,#5e5ce6)' }]).forEach((c) => {
      const n = c.id === 'mix' ? Object.values(D.Q).reduce((a, x) => a + x.length, 0) : D.Q[c.id].length;
      g.append(el('button', { class: 'qz-cat', 'data-cat': c.id, style: { background: c.color }, onclick: () => start(c.id) },
        el('span', { class: 'e', text: c.emoji }), el('b', { text: c.name }), el('small', { text: n + ' questions · Best ' + LS.gameBest('quiz-' + c.id) + '/10' })));
    });
    body.append(el('div', { class: 'pad' }, el('p', { class: 'muted qz-intro', text: 'Pick a topic. 10 questions each round. How many can you get?' }), g));
  }

  function start(cat) {
    const pool = cat === 'mix' ? Object.values(D.Q).flat() : D.Q[cat];
    round = { cat, qs: shuffle(pool).slice(0, 10), i: 0, score: 0, streak: 0 };
    LS.backLabel('Quiz');
    question();
  }

  function question() {
    clearTimeout(timer); if (!ui || !round) return;
    const r = round, q = r.qs[r.i], c = catOf(r.cat);
    LS.$('#appTitle').textContent = c.name;
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll quiz-app';
    const opts = shuffle(q.slice(1));
    const fb = el('div', { class: 'qz-fb', 'aria-live': 'polite' });
    const answers = el('div', { class: 'qz-answers' });
    let done = false;
    opts.forEach((o) => answers.append(el('button', { class: 'qz-ans', text: o, onclick: (e) => {
      if (done) return; done = true;
      const ok = o === q[1];
      e.currentTarget.classList.add(ok ? 'right' : 'wrong');
      LS.$$('.qz-ans', answers).forEach((b) => { if (b.textContent === q[1]) b.classList.add('right'); b.disabled = true; });
      if (ok) { r.score++; r.streak++; fb.textContent = pick(RIGHT) + (r.streak >= 3 ? ' ' + r.streak + ' in a row! 🔥' : ''); fb.className = 'qz-fb ok'; }
      else { r.streak = 0; fb.textContent = pick(WRONG) + ' The answer is ' + q[1] + '.'; fb.className = 'qz-fb no'; }
      if (navigator.vibrate) navigator.vibrate(ok ? 30 : [40, 60, 40]);
      next.hidden = false;
    } })));
    const next = el('button', { class: 'primary-btn qz-next', text: r.i === r.qs.length - 1 ? 'See my score' : 'Next question', hidden: true, onclick: () => { r.i++; if (r.i >= r.qs.length) finish(); else question(); } });
    const prog = el('div', { class: 'qz-prog' }, el('i', { style: { width: ((r.i) / r.qs.length * 100) + '%', background: c.color } }));
    body.append(el('div', { class: 'pad qz-q' },
      el('div', { class: 'qz-top' }, el('span', { text: c.emoji + ' Question ' + (r.i + 1) + ' of ' + r.qs.length }), el('b', { class: 'qz-score', text: '⭐ ' + r.score })),
      prog, el('h2', { class: 'qz-text', text: q[0] }), answers, fb, next));
    body.scrollTop = 0;
  }

  function finish() {
    if (!ui || !round) return;
    const r = round, c = catOf(r.cat);
    const prev = LS.gameBest('quiz-' + r.cat); LS.gameBest('quiz-' + r.cat, r.score);
    try { const k = 'lockshell.best.quiz-' + r.cat; if (localStorage.getItem(k) === null) localStorage.setItem(k, String(r.score)); } catch (e) {} // remember a first round even at 0
    const msg = r.score === 10 ? 'PERFECT SCORE! You are a quiz champion! 🏆' : r.score >= 8 ? 'Amazing job! 🌟' : r.score >= 5 ? 'Great work! Keep learning! 👍' : 'Nice try! Every quiz makes you smarter! 💪';
    const body = ui.body; body.innerHTML = ''; body.className = 'app-body scroll quiz-app';
    body.append(el('div', { class: 'pad qz-end' },
      el('div', { class: 'qz-big', text: r.score >= 8 ? '🏆' : r.score >= 5 ? '🎉' : '🌱' }),
      el('h2', { text: r.score + ' out of ' + r.qs.length }), el('p', { text: msg }),
      el('p', { class: 'muted', text: r.score > prev ? 'New best score for ' + c.name + '!' : 'Best for ' + c.name + ': ' + Math.max(prev, r.score) + '/10' }),
      el('div', { class: 'btns' }, el('button', { class: 'ghost-btn', text: 'Play again', onclick: () => start(r.cat) }), el('button', { class: 'ghost-btn', text: 'Topics', onclick: home }))));
    body.scrollTop = 0; round = null;
  }

  LS.register('quiz', {
    title: 'Quiz', icon: 'quiz', color: 'linear-gradient(135deg,#ffcc00,#ff9500)', extra: true,
    open(body, actions, arg) { ui = { body }; if (arg && arg.cat && (D.Q[arg.cat] || arg.cat === 'mix')) start(arg.cat); else home(); },
    back() { if (round || (ui && LS.$('.qz-end', ui.body))) { home(); return true; } return false; },
    close() { clearTimeout(timer); round = null; ui = null; }
  });
})();
