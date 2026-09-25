/* Notes: list + editor with autosave (IndexedDB) */
(function () {
  'use strict';
  const { el, icon } = LS;
  let saveT = null, flush = null;

  LS.register('notes', {
    title: 'Notes', icon: 'notes', color: 'linear-gradient(135deg,#f59e0b,#d97706)',
    open(body, actions) {
      async function showList() {
        if (flush) { await flush(); flush = null; }
        LS.$('#appTitle').textContent = 'Notes';
        actions.innerHTML = '';
        body.innerHTML = ''; body.className = 'app-body scroll';
        const list = el('div', { class: 'list' });
        body.append(el('div', { class: 'pad' }, list), el('button', { class: 'fab', 'aria-label': 'New note', html: icon('plus'), onclick: () => edit(null) }));
        let notes = []; try { notes = await LS.db.all('notes'); } catch (e) {}
        if (!notes.length) list.append(LS.notice('📝', 'No notes yet', 'Tap + to write your first note. Notes save automatically.'));
        notes.forEach((n) => {
          list.append(el('button', { class: 'item note-item', onclick: () => edit(n) },
            el('div', { class: 'meta' }, el('b', { text: n.title || 'Untitled' }), el('small', { text: LS.fmtDate(n.updated) + '  ' + (n.body || '').replace(/\s+/g, ' ').slice(0, 60) }))));
        });
      }
      function edit(note) {
        note = note || { id: LS.uid(), created: Date.now(), updated: Date.now(), title: '', body: '' };
        LS.$('#appTitle').textContent = note.title || 'New note';
        body.innerHTML = ''; body.className = 'app-body';
        const ind = el('span', { class: 'saved-ind', text: '' });
        const title = el('input', { type: 'text', placeholder: 'Title', value: note.title, maxlength: 120, autocomplete: 'off' });
        const text = el('textarea', { placeholder: 'Start typing…' }); text.value = note.body;
        actions.innerHTML = '';
        actions.append(ind, el('button', { class: 'pill-btn', text: 'Done', onclick: showList }));
        let dirty = false;
        async function save() {
          clearTimeout(saveT);
          if (!dirty) return;
          dirty = false;
          note.title = title.value.trim(); note.body = text.value; note.updated = Date.now();
          if (!note.title && !note.body.trim()) { try { await LS.db.del('notes', note.id); } catch (e) {} ind.textContent = ''; return; }
          try { await LS.db.put('notes', note); ind.textContent = 'Saved'; } catch (e) { ind.textContent = 'Not saved'; }
        }
        flush = save;
        const onInput = () => { dirty = true; ind.textContent = 'Editing…'; clearTimeout(saveT); saveT = setTimeout(save, 600); };
        title.addEventListener('input', onInput); text.addEventListener('input', onInput);
        body.append(el('div', { class: 'editor' }, title, text));
        if (!note.title && !note.body) setTimeout(() => title.focus(), 50);
      }
      LS.$('#appBack').dataset.notes = '1';
      showList();
    },
    close() { if (flush) { flush(); flush = null; } }
  });
})();
