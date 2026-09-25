/* Camera: getUserMedia (after user tap), front/back switch, capture, IndexedDB, thumbnails */
(function () {
  'use strict';
  const { el, icon } = LS;
  let stream = null, facing = 'environment', urls = [];

  function stop() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
  }
  function permMsg(err) {
    const n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return ['📷', 'Camera access is off', 'LockShell needs permission to use the camera. On iPhone: Settings > Safari > Camera > Allow (or tap "aA" in Safari > Website Settings). Then try again.'];
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return ['🔍', 'No camera found', 'This device does not seem to have a camera available.'];
    if (n === 'NotReadableError') return ['⏳', 'Camera is busy', 'Another app may be using the camera. Close it and try again.'];
    if (!navigator.mediaDevices) return ['🔒', 'Camera unavailable', 'The camera only works when LockShell is opened over HTTPS (or installed to the Home Screen).'];
    return ['⚠️', 'Camera could not start', 'Please try again.'];
  }

  async function renderThumbs(strip) {
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
    let photos = [];
    try { photos = await LS.db.all('photos'); } catch (e) {}
    strip.innerHTML = '';
    if (!photos.length) { strip.append(el('div', { class: 'empty', text: 'Photos you take appear here' })); return; }
    photos.forEach((p) => {
      const u = URL.createObjectURL(p.blob); urls.push(u);
      strip.append(el('img', { src: u, alt: 'Photo', onclick: () => viewPhoto(p, u, strip) }));
    });
  }
  function viewPhoto(p, u, strip) {
    LS.modal((sh, close) => {
      sh.classList.add('viewer');
      sh.append(el('img', { src: u, alt: 'Photo' }), el('p', { class: 'muted', text: LS.fmtDate(p.created) }),
        el('div', { class: 'btns' },
          el('button', { class: 'ghost-btn', text: 'Close', onclick: close }),
          el('button', { class: 'ghost-btn danger-btn', text: 'Delete', onclick: async () => {
            close();
            if (await LS.requirePin('Passcode needed to delete photos')) { await LS.db.del('photos', p.id); LS.toast('Photo deleted'); renderThumbs(strip); }
          } })));
    });
  }

  LS.register('camera', {
    title: 'Camera', icon: 'camera', color: 'linear-gradient(135deg,#475569,#1e293b)', darkBar: true,
    open(body, actions) {
      body.style.background = '#000';
      const wrap = el('div', { class: 'cam-wrap' });
      const video = el('video', { playsinline: true, 'webkit-playsinline': true, muted: true, autoplay: true });
      video.muted = true; video.playsInline = true;
      const strip = el('div', { class: 'thumbs' });
      const shutter = el('button', { class: 'shutter', 'aria-label': 'Take photo', disabled: true });
      const flipBtn = el('button', { class: 'round-btn', 'aria-label': 'Switch camera', html: icon('flip') });
      const galBtn = el('button', { class: 'round-btn', 'aria-label': 'Photos', html: icon('image'), onclick: () => strip.scrollTo({ left: 0, behavior: 'smooth' }) });
      const controls = el('div', { class: 'cam-controls' }, galBtn, shutter, flipBtn);

      function showStart() {
        wrap.innerHTML = '';
        wrap.append(LS.notice('📷', 'Camera', 'Starting the camera… Your photos stay on this phone.', { label: 'Start camera', onclick: start }));
        wrap.querySelector('.notice').style.color = '#fff';
        shutter.disabled = true;
      }
      async function start() {
        stop();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { const m = permMsg(null); wrap.innerHTML = ''; wrap.append(LS.notice(m[0], m[1], m[2])); return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
          if (!document.body.contains(wrap)) return stop();
          wrap.innerHTML = ''; wrap.append(video);
          video.srcObject = stream;
          video.classList.toggle('mirror', facing === 'user');
          await video.play().catch(() => {});
          shutter.disabled = false;
        } catch (err) {
          const m = permMsg(err); wrap.innerHTML = '';
          wrap.append(LS.notice(m[0], m[1], m[2], { label: 'Try again', onclick: start }));
        }
      }
      flipBtn.onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; if (stream) start(); };
      shutter.onclick = async () => {
        if (!stream || !video.videoWidth) return;
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        const g = c.getContext('2d');
        if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
        g.drawImage(video, 0, 0);
        LS.flash();
        c.toBlob(async (blob) => {
          if (!blob) return;
          try { await LS.db.put('photos', { id: LS.uid(), created: Date.now(), blob, w: c.width, h: c.height }); LS.toast('Photo saved'); }
          catch (e) { LS.toast('Could not save photo (storage full?)'); }
          renderThumbs(strip);
        }, 'image/jpeg', 0.88);
      };
      body.append(wrap, controls, strip);
      showStart(); renderThumbs(strip);
      start(); // start right away; the button stays as a retry if it fails
    },
    close: stop
  });
})();
