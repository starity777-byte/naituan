(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, L = window.NaituanLife, J = window.NaituanJournalState, Photos = window.NaituanPhotos;
  var tab = 'notes', allPhotos = false, period = 'recent', draft = null, previewURL = '', photoTicket = 0, saving = false, preparing = false, active = null, undo = null, undoTimer;
  var esc = function (value) { return String(value || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function icon(name) { return '<svg class="ui-icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function today() { return L.dateKey(); }
  function uid() { return 'entry-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  function reply(text) {
    if (/好累|累了|疲惫|辛苦/.test(text)) return '今天辛苦啦，我陪你歇一会儿。';
    if (/开心|高兴|快乐/.test(text)) return '这一点开心，我们一起收好。';
    if (/吃|早餐|午餐|晚餐|面条|番茄面/.test(text)) return '小小的一餐，也收好啦。';
    return '这一刻，奶团陪你收好了。';
  }
  function time(entry) { if (!entry.createdAt) return '当天留下'; var d = new Date(entry.createdAt); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function dateLabel(date) { var d = J.date(date); return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + '日一二三四五六'[d.getDay()]; }
  function photoHTML(entry, large) {
    return '<img alt="日常照片" loading="lazy"' + (large ? '' : ' decoding="async"') + (entry.photoId ? ' data-photo-id="' + esc(entry.photoId) + '"' : ' src="' + esc(entry.photo) + '"') + '>';
  }
  function hydrate(container) {
    container.querySelectorAll('img[data-photo-id]').forEach(function (image) {
      var id = image.dataset.photoId;
      Photos.url(id).then(function (url) { if (image.isConnected && image.dataset.photoId === id) image.src = url; }).catch(function () { if (image.isConnected) { image.alt = '照片待恢复'; image.classList.add('journal-missing-photo'); } });
    });
  }
  function dayStats(date) { var data = L.read(); return { count: J.entries(data, date).length, photos: J.entries(data, date).filter(function (row) { return row.photoId || row.photo; }).length }; }
  function render() {
    var date = L.selectedDate(), data = L.read(), rows = J.entries(data, date), day = data.days[date] || {};
    var stats = window.NaituanPlanner ? window.NaituanPlanner.summary(date) : { ms: (day.focusMinutes || 0) * 60000, done: 0 };
    $('journalDayTitle').textContent = allPhotos && tab === 'photos' ? '日期相册' : date === today() ? '今天' : date === J.shift(today(), -1) ? '昨天' : '这一天';
    $('journalDate').textContent = allPhotos && tab === 'photos' ? '按日期收好' : dateLabel(date);
    $('journalToday').hidden = date === today() && !allPhotos;
    var facts = [];
    if (stats.ms) facts.push('专注 ' + Math.floor(stats.ms / 60000) + ' 分钟');
    if (stats.done) facts.push('完成 ' + stats.done + ' 件小事');
    if (day.words) facts.push('学了 ' + day.words + ' 个单词');
    if (rows.length) facts.push('留下 ' + rows.length + ' 个片刻');
    $('journalDayReview').textContent = facts.join(' · ') || '留一点空白也很好。';
    $('journalPlanCount').textContent = stats.done ? '完成 ' + stats.done + ' 件' : '慢慢来就好';
    $('journalList').innerHTML = rows.length ? rows.map(function (entry) {
      return '<article class="journal-record"><div class="journal-record-head"><time>' + time(entry) + '</time><button type="button" class="journal-more" data-journal-menu="' + esc(entry.id) + '" aria-label="修改或删除记录">···</button></div>' + (entry.text ? '<p>' + esc(entry.text) + '</p>' : '') + (entry.photoId || entry.photo ? '<button class="journal-photo" type="button" data-journal-photo="' + esc(entry.id) + '" aria-label="查看照片">' + photoHTML(entry) + '</button>' : '') + (entry.reply ? '<div class="journal-reply"><img src="assets/shy.webp" alt=""><span>' + esc(entry.reply) + '</span></div>' : '') + '</article>';
    }).join('') : '<p class="journal-empty">这一天还没有记录。<br>一句话，一张照片，都可以。</p>';
    var photos = (allPhotos ? J.all(data) : rows).filter(function (entry) { return entry.photoId || entry.photo; }), previous = '';
    $('journalAlbum').innerHTML = photos.length ? photos.map(function (entry) {
      var heading = allPhotos && previous !== entry.date ? '<h3 class="journal-album-date">' + esc(entry.date.replace(/-/g, '.')) + '</h3>' : ''; previous = entry.date;
      return heading + '<button class="journal-album-photo" type="button" data-journal-photo="' + esc(entry.id) + '" aria-label="查看 ' + esc(entry.date) + ' 的照片">' + photoHTML(entry) + '<span>' + esc(entry.text || '留下的一刻') + '</span></button>';
    }).join('') : '<p class="journal-empty">这里还没有照片。</p>';
    $('journalList').hidden = tab !== 'notes'; $('journalAlbum').hidden = tab !== 'photos';
    $('journalNotesTab').setAttribute('aria-pressed', String(tab === 'notes')); $('journalPhotosTab').setAttribute('aria-pressed', String(tab === 'photos'));
    $('journalUndo').hidden = !undo;
    hydrate(tab === 'photos' ? $('journalAlbum') : $('journalList')); renderOverview();
  }
  function heatmap(start, end, counts) {
    var first = J.shift(start, -((J.date(start).getDay() + 6) % 7)), weeks = Math.ceil((Math.round((J.date(end) - J.date(first)) / 86400000) + 1) / 7), cells = '', months = '', previous = -1;
    for (var w = 0; w < weeks; w++) {
      var week = J.shift(first, w * 7), month = J.date(week < start ? start : week).getMonth();
      for (var k = 0; k < 7; k++) { var m = J.shift(week, k); if (m >= start && m <= end && J.date(m).getDate() === 1) month = J.date(m).getMonth(); }
      months += '<span>' + (month !== previous ? month + 1 + '月' : '') + '</span>'; previous = month;
      for (var r = 0; r < 7; r++) {
        var date = J.shift(week, r), count = counts[date] || 0, label = date.replace(/-/g, '.') + ' · ' + count + ' 条日常记录';
        cells += date < start || date > end ? '<span></span>' : '<button type="button" class="journal-heat-cell" data-journal-date="' + date + '" data-level="' + Math.min(count, 4) + '" aria-label="' + label + '" title="' + label + '"' + (date === today() ? ' aria-current="date"' : '') + (date > today() ? ' disabled' : '') + '></button>';
      }
    }
    return '<div class="journal-heat-block" style="--journal-weeks:' + weeks + '"><div class="journal-heat-months">' + months + '</div><div class="journal-heat-body"><div class="journal-week-labels" aria-hidden="true"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div><div class="journal-heat-grid">' + cells + '</div></div></div>';
  }
  function renderOverview() {
    var data = L.read(), stats = J.summary(data), counts = J.counts(data), current = today(), year = J.date(current).getFullYear(), html = '';
    $('profileRecordCount').textContent = stats.count; $('profileRecordDays').textContent = stats.days; $('profilePhotoCount').textContent = stats.photos;
    $('journalYear').textContent = year + '年'; $('journalRecent').setAttribute('aria-pressed', String(period === 'recent')); $('journalYear').setAttribute('aria-pressed', String(period === 'year'));
    if (period === 'year') for (var q = 0; q < 4; q++) html += heatmap(J.key(new Date(year, q * 3, 1, 12)), J.key(new Date(year, q * 3 + 3, 0, 12)), counts);
    else { var monday = J.shift(current, -((J.date(current).getDay() + 6) % 7)); html = heatmap(J.shift(monday, -84), J.shift(monday, 6), counts); }
    $('journalHeatmap').innerHTML = html;
  }
  function clearPreview() { if (previewURL) URL.revokeObjectURL(previewURL); previewURL = ''; }
  async function paintDraft() {
    var image = $('journalEntryPreview'); image.hidden = !draft || !(draft.blob || draft.photoId || draft.photo);
    $('journalRemovePhoto').hidden = image.hidden;
    if (image.hidden) { image.removeAttribute('src'); return; }
    var current = draft;
    if (current.blob) { clearPreview(); previewURL = URL.createObjectURL(current.blob); image.src = previewURL; }
    else if (current.photoId) { try { var url = await Photos.url(current.photoId); if (draft === current) image.src = url; } catch (error) { $('journalEntryMessage').textContent = error.message; } }
    else image.src = current.photo;
  }
  function open(entry) {
    if (saving) return;
    clearPreview(); photoTicket++; preparing = false;
    draft = entry ? Object.assign({}, entry) : { id: uid(), date: L.selectedDate(), text: '', createdAt: Date.now(), photoId: '', photo: '' };
    $('journalEntryTitle').textContent = entry ? '修改这条日常' : '留下一点今天'; $('journalEntryText').value = draft.text;
    $('journalEntryDate').value = draft.date; $('journalEntryDate').disabled = !!entry; $('journalEntryFile').value = ''; $('journalEntryMessage').textContent = '';
    $('journalEntrySave').disabled = false; $('journalEntryClose').disabled = false; paintDraft(); $('journalEntryDialog').showModal(); $('journalEntryText').focus();
  }
  function removeEntry(next, entry) {
    var day = next.days[entry.date]; if (!day) return;
    if (entry.legacy) delete day.food;
    else day.entries = (day.entries || []).filter(function (row) { return row.id !== entry.id; });
  }
  async function saveDraft(event) {
    event.preventDefault(); if (!draft || saving || preparing) return;
    var text = $('journalEntryText').value.trim(), date = $('journalEntryDate').value;
    if (!text && !draft.blob && !draft.photoId && !draft.photo) { $('journalEntryMessage').textContent = '写一句话，或留一张照片就好。'; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    saving = true; $('journalEntrySave').disabled = $('journalEntryClose').disabled = true; $('journalEntryMessage').textContent = '正在收好…';
    var added = '', previousPhoto = draft.originalPhotoId || draft.photoId;
    try {
      var id = draft.photoId || ''; if (draft.blob) { id = await Photos.put(draft.blob); added = id; }
      var entry = { id: draft.id, text: text, photoId: id, createdAt: draft.createdAt || Date.now(), updatedAt: Date.now(), reply: reply(text) };
      if (!L.update(function (next) {
        var day = next.days[date] || (next.days[date] = {});
        if (draft.legacy) { day.food = Object.assign({}, day.food, { note: text, photoId: id, photo: draft.photo || '', createdAt: entry.createdAt }); }
        else { if (!Array.isArray(day.entries)) day.entries = []; var index = day.entries.findIndex(function (row) { return row.id === entry.id; }); if (index >= 0) day.entries[index] = entry; else day.entries.push(entry); }
      }, entry.reply)) throw new Error('还没有保存成功，文字和照片都留在这里，可以再试一次。');
      if (previousPhoto && previousPhoto !== id && !J.photoIds(L.read()).includes(previousPhoto)) Photos.remove(previousPhoto).catch(function () {});
      saving = false; $('journalEntryDialog').close(); draft = null; clearPreview(); tab = 'notes'; allPhotos = false; L.selectDate(date);
      if (!window.NT.isBusy() && !window.NT.S().sleeping) window.NT.setPose('happy', 1800);
    } catch (error) { if (added) await Photos.remove(added).catch(function () {}); $('journalEntryMessage').textContent = error.message || '这次没有保存成功，可以再试一次。'; }
    finally { saving = false; $('journalEntrySave').disabled = $('journalEntryClose').disabled = false; }
  }
  async function migratePhotos() {
    var data = L.read();
    for (var date of Object.keys(data.days)) {
      var food = data.days[date].food;
      if (!food || food.photoId || !/^data:image\//.test(food.photo || '')) continue;
      var id = '';
      try {
        id = await Photos.put(Photos.fromDataURL(food.photo));
        var changed = false, saved = L.update(function (next) { var current = next.days[date] && next.days[date].food; if (current && current.photo === food.photo && !current.photoId) { current.photoId = id; delete current.photo; changed = true; } });
        if (!saved || !changed) await Photos.remove(id);
      } catch (error) { if (id) Photos.remove(id).catch(function () {}); }
    }
  }
  $('journalEntryForm').addEventListener('submit', saveDraft);
  $('journalEntryClose').addEventListener('click', function () { if (!saving) $('journalEntryDialog').close(); });
  $('journalEntryDialog').addEventListener('cancel', function (event) { if (saving) event.preventDefault(); });
  $('journalEntryDialog').addEventListener('close', function () { photoTicket++; clearPreview(); });
  $('journalPickPhoto').addEventListener('click', function () { $('journalEntryFile').click(); });
  $('journalEntryFile').addEventListener('change', async function () {
    var file = this.files[0]; if (!file || !draft || saving) return;
    var ticket = ++photoTicket; preparing = true; $('journalEntrySave').disabled = true; $('journalEntryMessage').textContent = '正在准备照片…';
    try { var blob = await Photos.compress(file); if (ticket !== photoTicket) return; draft.blob = blob; draft.originalPhotoId = draft.originalPhotoId || draft.photoId; draft.photoId = ''; draft.photo = ''; await paintDraft(); $('journalEntryMessage').textContent = '照片准备好了，只保存在本机。'; }
    catch (error) { if (ticket === photoTicket) $('journalEntryMessage').textContent = error.message; }
    finally { if (ticket === photoTicket) { preparing = false; $('journalEntrySave').disabled = false; } }
  });
  $('journalRemovePhoto').addEventListener('click', function () { if (!draft || saving) return; draft.originalPhotoId = draft.originalPhotoId || draft.photoId; draft.blob = null; draft.photoId = ''; draft.photo = ''; paintDraft(); });
  $('journalAdd').addEventListener('click', function () { open(); });
  $('journalNotesTab').addEventListener('click', function () { tab = 'notes'; allPhotos = false; render(); });
  $('journalPhotosTab').addEventListener('click', function () { tab = 'photos'; allPhotos = false; render(); });
  $('journalToday').addEventListener('click', function () { allPhotos = false; L.selectDate(today()); });
  $('journalCalendarOpen').addEventListener('click', function () { var card = $('journalCalendar'); card.hidden = !card.hidden; $('journalCalendarOpen').setAttribute('aria-expanded', String(!card.hidden)); });
  $('journalStudyOpen').addEventListener('click', function () { if (window.NaituanPlanner) window.NaituanPlanner.open(); });
  $('journalPlansOpen').addEventListener('click', function () { var card = $('journalPlans'); card.hidden = !card.hidden; $('journalPlansOpen').setAttribute('aria-expanded', String(!card.hidden)); if (!card.hidden) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  $('journalWordOpen').addEventListener('click', function () { L.selectDate(today()); $('wordCheckin').click(); });
  $('journalRecent').addEventListener('click', function () { period = 'recent'; renderOverview(); });
  $('journalYear').addEventListener('click', function () { period = 'year'; renderOverview(); });
  $('journalHeatmap').addEventListener('click', function (event) { var button = event.target.closest('[data-journal-date]'); if (button) { allPhotos = false; tab = 'notes'; L.selectDate(button.dataset.journalDate); window.NaituanHouse.navigate('life'); } });
  $('profileAlbum').addEventListener('click', function () { allPhotos = true; tab = 'photos'; window.NaituanHouse.navigate('life'); render(); });
  ['journalList', 'journalAlbum'].forEach(function (id) { $(id).addEventListener('click', async function (event) {
    var photo = event.target.closest('[data-journal-photo]'), menu = event.target.closest('[data-journal-menu]');
    if (!photo && !menu) return;
    active = J.all(L.read()).find(function (entry) { return entry.id === (photo ? photo.dataset.journalPhoto : menu.dataset.journalMenu); }); if (!active) return;
    if (menu) { $('journalRecordMenu').showModal(); return; }
    $('journalPhotoCaption').textContent = active.date.replace(/-/g, '.') + ' · ' + (active.text || '留下的一刻'); $('journalPhotoFull').removeAttribute('src'); $('journalPhotoDialog').showModal();
    try { var url = active.photoId ? await Photos.url(active.photoId) : active.photo; if ($('journalPhotoDialog').open) $('journalPhotoFull').src = url; } catch (error) { $('journalPhotoCaption').textContent = error.message; }
  }); });
  $('journalEdit').addEventListener('click', function () { $('journalRecordMenu').close(); if (active) open(active); });
  $('journalDelete').addEventListener('click', function () {
    if (!active) return; $('journalRecordMenu').close();
    if (undo) finishUndo();
    var data = L.read(), day = data.days[active.date], raw = active.legacy ? day.food : day.entries.find(function (entry) { return entry.id === active.id; });
    undo = { entry: active, raw: raw };
    if (!L.update(function (next) { removeEntry(next, active); }, '已移除这条记录，可以撤销。')) { undo = null; return; }
    undoTimer = setTimeout(finishUndo, 10000);
  });
  function finishUndo() { clearTimeout(undoTimer); var deleted = undo; undo = null; $('journalUndo').hidden = true; if (deleted && deleted.entry.photoId && !J.photoIds(L.read()).includes(deleted.entry.photoId)) Photos.remove(deleted.entry.photoId).catch(function () {}); }
  $('journalUndo').addEventListener('click', function () {
    if (!undo) return; var deleted = undo;
    if (L.update(function (next) { var day = next.days[deleted.entry.date] || (next.days[deleted.entry.date] = {}); if (deleted.entry.legacy) day.food = deleted.raw; else { if (!Array.isArray(day.entries)) day.entries = []; day.entries.push(deleted.raw); } }, '记录放回来啦。')) { clearTimeout(undoTimer); undo = null; render(); }
  });
  window.addEventListener('naituan:life-change', render);
  window.addEventListener('naituan:life-date', function () { allPhotos = false; render(); });
  window.addEventListener('naituan:page', function (event) { if (event.detail.page === 'life' || event.detail.page === 'profile') render(); });
  window.addEventListener('naituan:save-import', function () { clearTimeout(undoTimer); undo = null; draft = null; ['journalEntryDialog', 'journalRecordMenu', 'journalPhotoDialog'].forEach(function (id) { if ($(id).open) $(id).close(); }); migratePhotos(); render(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  window.NaituanJournal = { render: render, renderOverview: renderOverview, dayStats: dayStats, summary: function () { return J.summary(L.read()); } };
  render(); migratePhotos();
})();
