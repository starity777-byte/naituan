(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, NT = window.NT, J = window.NaituanJournalState, Photos = window.NaituanPhotos;
  var pending = null, armedCode = '', busy = false;
  function message(text) { $('saveMsg').textContent = text; }
  function disarm() { armedCode = ''; pending = null; $('saveLoad').textContent = '导入旧存档码'; $('backupRestore').hidden = true; }
  function setBusy(value) { busy = value; ['saveCopy', 'saveLoad', 'backupPick', 'backupRestore', 'saveClose'].forEach(function (id) { $(id).disabled = value; }); }
  function open() {
    if (NT.isBusy()) return;
    NT.finishRoom(); NT.sound('tap'); disarm(); $('saveText').value = ''; $('backupFile').value = '';
    message('小屋、游戏、计划、记录和照片，一起收进完整备份。'); $('saveModal').hidden = false; $('saveCopy').focus();
  }
  function close() { if (busy) return; $('saveModal').hidden = true; disarm(); NT.sound('tap'); NT.room.refresh(); }
  async function create() {
    var data = NT.exportState();
    return { format: 'naituan-house', version: 2, createdAt: new Date().toISOString(), data: data, photos: await Photos.exportPhotos(J.photoIds(data.life)) };
  }
  async function download() {
    if (busy) return;
    setBusy(true); message('正在把照片一起收好…');
    try {
      var backup = await create(), url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      var anchor = document.createElement('a'); anchor.href = url; anchor.download = '奶团小屋-' + window.NaituanLife.dateKey() + '.json';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      message('完整备份已准备好，请保存在手机的文件里。'); NT.sound('save');
    } catch (error) { message(error.message || '这次没能导出，请稍后重试。'); }
    finally { setBusy(false); }
  }
  function decodeLegacy(code) {
    code = (code || '').replace(/\s+/g, '');
    if (!code.startsWith('NT1:')) throw new Error('请粘贴以 NT1: 开头的完整旧存档码。');
    var value; try { value = JSON.parse(decodeURIComponent(escape(atob(code.slice(4))))); } catch (error) { throw new Error('这串存档码读不了，请检查是否复制完整。'); }
    return { format: 'naituan-house', version: 1, data: value && value.v === 1 ? value.data : null, photos: [] };
  }
  function prepare(value) {
    if (!value || value.format !== 'naituan-house' || ![1, 2].includes(value.version) || !value.data || !Number.isFinite(value.data.hunger)) throw new Error('这不是奶团小屋的有效备份。');
    var data = JSON.parse(JSON.stringify(value.data)), ids = J.photoIds(data.life), photos = new Map();
    (Array.isArray(value.photos) ? value.photos : []).forEach(function (photo) { if (photo && photo.id) photos.set(photo.id, photo.dataURL); });
    var blobs = ids.map(function (id) { if (!photos.has(id)) throw new Error('这份备份缺少照片，无法完整恢复。请选择完整备份文件。'); return { id: id, blob: Photos.fromDataURL(photos.get(id)) }; });
    return { data: data, blobs: blobs };
  }
  function describe(value) { var stats = J.summary(value.data.life); return '将恢复 ' + stats.count + ' 条日常记录、' + stats.photos + ' 张照片，以及小屋、游戏和自习进度。确认后会覆盖本机当前存档。'; }
  async function restore(value) {
    if (busy) return false;
    setBusy(true); message('正在恢复记录和照片…');
    var added = [], oldIds = J.photoIds(NT.S().life), committed = false;
    try {
      var map = {};
      for (var photo of value.blobs) { var id = await Photos.put(photo.blob); added.push(id); map[photo.id] = id; }
      J.remapPhotos(value.data.life, map);
      if (!NT.restoreState(value.data)) throw new Error('本机存档暂时保存不了，原来的进度仍在，请稍后重试。');
      committed = true;
      var retained = new Set(J.photoIds(NT.S().life));
      oldIds.filter(function (id) { return !retained.has(id); }).forEach(function (id) { Photos.remove(id).catch(function () {}); });
      window.dispatchEvent(new CustomEvent('naituan:life-change'));
      window.dispatchEvent(new CustomEvent('naituan:save-import'));
      setBusy(false); close(); NT.say('记录和照片，都收好啦。', 3200); NT.sound('save'); return true;
    } catch (error) { if (!committed) await Promise.all(added.map(function (id) { return Photos.remove(id).catch(function () {}); })); message(error.message || (committed ? '记录已恢复，请刷新页面查看。' : '这次没有恢复成功，原来的进度仍在。')); return committed; }
    finally { setBusy(false); }
  }
  async function importLegacy(code) {
    if (busy) return;
    try {
      if (armedCode === code && pending) { await restore(pending); return; }
      pending = prepare(decodeLegacy(code)); armedCode = code; $('saveLoad').textContent = '确认覆盖并恢复'; $('backupRestore').hidden = true; message(describe(pending));
    } catch (error) { disarm(); message(error.message); }
  }
  $('backupPick').addEventListener('click', function () { $('backupFile').click(); });
  $('backupFile').addEventListener('change', async function () {
    var file = this.files[0]; if (!file || busy) return;
    try { pending = prepare(JSON.parse(await file.text())); armedCode = ''; $('backupRestore').hidden = false; message(describe(pending)); }
    catch (error) { disarm(); message(error.message || '这份备份文件暂时读不了。'); }
  });
  $('backupRestore').addEventListener('click', function () { if (pending) restore(pending); });
  window.NaituanBackup = { open: open, close: close, download: download, importLegacy: importLegacy, disarm: disarm, create: create };
})();
