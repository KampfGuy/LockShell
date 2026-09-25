/* Voice recorder: MediaRecorder with iOS (audio/mp4) / Android (audio/webm) handling */
(function () {
  'use strict';
  const { el, icon } = LS;
  let rec = null, stream = null, timer = null, player = null, urls = [];

  function pickMime() {
    if (!window.MediaRecorder) return null;
    const c = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (const m of c) { try { if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
    return ''; // let the browser choose
  }
  function cleanup() {
    clearInterval(timer); timer = null;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) {} }
    rec = null;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (player) { player.pause(); player = null; }
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
  }
  function permMsg(err) {
    const n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Microphone access is off. On iPhone: Settings > Safari > Microphone > Allow, then try again.';
    if (n === 'NotFoundError') return 'No microphone was found on this device.';
    if (!navigator.mediaDevices || !window.MediaRecorder) return 'Recording is not supported here. Update iOS or your browser, and open ShellOS over HTTPS.';
    return 'The microphone could not start. Please try again.';
  }

  LS.register('recorder', {
    title: 'Voice Recorder', icon: 'mic', color: 'linear-gradient(135deg,#ef4444,#b91c1c)',
    open(body) {
      body.classList.add('scroll');
      const time = el('div', { class: 'rec-time', text: '00:00' });
      const state = el('div', { class: 'rec-state', text: 'Tap to record' });
      const btn = el('button', { class: 'rec-btn', 'aria-label': 'Record' }, el('i'));
      const list = el('div', { class: 'list' });
      body.append(el('div', { class: 'rec-top' }, time, state, btn), el('div', { class: 'pad' }, el('div', { class: 'section-title', text: 'Recordings' }), list));
      

      async function renderList() {
        urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
        let items = []; try { items = await LS.db.all('recordings'); } catch (e) {}
        list.innerHTML = '';
        if (!items.length) { list.append(el('p', { class: 'muted', style: { textAlign: 'center' }, text: 'No recordings yet' })); return; }
        items.forEach((r) => {
          const u = URL.createObjectURL(r.blob); urls.push(u);
          const play = el('button', { class: 'icon-btn play', 'aria-label': 'Play', html: icon('play') });
          play.onclick = () => {
            if (player && player._u === u && !player.paused) { player.pause(); return; }
            if (player) player.pause();
            player = new Audio(u); player._u = u; player.playsInline = true;
            list.querySelectorAll('.icon-btn.play').forEach((b) => (b.innerHTML = icon('play')));
            play.innerHTML = icon('pause');
            player.onended = player.onpause = () => (play.innerHTML = icon('play'));
            player.play().catch(() => LS.toast('Cannot play this recording on this device'));
          };
          const del = el('button', { class: 'icon-btn', 'aria-label': 'Delete', html: icon('trash'), onclick: async () => {
            if (await LS.requirePin('Passcode needed to delete recordings')) { await LS.db.del('recordings', r.id); LS.toast('Deleted'); renderList(); }
          } });
          list.append(el('div', { class: 'item' }, play, el('div', { class: 'meta' }, el('b', { text: r.name }), el('small', { text: LS.fmtDur(r.dur) + ' · ' + LS.fmtDate(r.created) })), del));
        });
      }
      async function startRec() {
        if (!navigator.mediaDevices || !window.MediaRecorder) { state.textContent = permMsg(null); return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (err) { state.textContent = permMsg(err); LS.toast('Microphone unavailable'); return; }
        const mime = pickMime();
        try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
        catch (e) { rec = new MediaRecorder(stream); }
        const chunks = []; const t0 = Date.now();
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
          const dur = Date.now() - t0;
          const type = (rec && rec.mimeType) || mime || (chunks[0] && chunks[0].type) || 'audio/mp4';
          const blob = new Blob(chunks, { type });
          if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
          if (blob.size) {
            const n = new Date();
            try { await LS.db.put('recordings', { id: LS.uid(), created: Date.now(), dur, blob, mime: type, name: 'Memo ' + n.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + n.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }); LS.toast('Recording saved'); }
            catch (e) { LS.toast('Could not save recording'); }
          }
          rec = null; renderList();
        };
        rec.start(1000);
        btn.classList.add('on'); state.textContent = 'Recording…'; LS.busy.add('rec');
        timer = setInterval(() => { time.textContent = LS.fmtDur(Date.now() - t0); }, 250);
      }
      function stopRec() {
        clearInterval(timer); timer = null; LS.busy.delete('rec');
        if (rec && rec.state !== 'inactive') rec.stop();
        btn.classList.remove('on'); state.textContent = 'Tap to record'; time.textContent = '00:00';
      }
      btn.onclick = () => { if (rec && rec.state === 'recording') stopRec(); else startRec(); };
      renderList();
    },
    close() { LS.busy.delete('rec'); cleanup(); }
  });
})();
