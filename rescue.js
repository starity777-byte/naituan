(function () {
  'use strict';
  var KEY = 'naituan-house-v1';
  var BACKUP = 'naituan-house-v1-backup';
  var BEFORE = 'naituan-house-v1-before-restore';

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }
  function isPlain(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function usable(data) {
    return isPlain(data) && typeof data.hunger === 'number' && Number.isFinite(data.hunger);
  }
  function readBackup() {
    var box = storage();
    if (!box) return null;
    var raw;
    try { raw = box.getItem(BACKUP); } catch (e) { return null; }
    if (raw == null || raw === '') return null;
    try {
      var data = JSON.parse(raw);
      return usable(data) ? data : null;
    } catch (e2) { return null; }
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function savedAt(t) {
    if (t == null || t === '') return '时间不明';
    var date = new Date(t);
    if (isNaN(date.getTime())) return '时间不明';
    return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }
  function summary(data) {
    data = isPlain(data) ? data : {};
    var fish = Math.max(0, Math.floor(+data.fish || 0));
    var own = data.own, furniture = 0;
    if (own && typeof own === 'object') Object.keys(own).forEach(function (key) { if (own[key]) furniture += 1; });
    return '找到一份存档：小鱼干 ' + fish + ' · 家具 ' + furniture + ' 件 · 上次保存于 ' + savedAt(data.t);
  }
  function normalized(value) {
    try {
      var copy = JSON.parse(JSON.stringify(value));
      if (!isPlain(copy)) return null;
      delete copy.t;
      return JSON.stringify(copy);
    } catch (e) { return null; }
  }
  function differs(backupData, currentRaw) {
    if (currentRaw == null || currentRaw === '') return true;
    var current;
    try { current = JSON.parse(currentRaw); } catch (e) { return true; }
    if (!isPlain(current)) return true;
    var left = normalized(backupData), right = normalized(current);
    if (left == null || right == null) return true;
    return left !== right;
  }
  function shouldShow() {
    var data = readBackup();
    if (!data) return false;
    var box = storage(), current = null;
    if (!box) return true;
    try { current = box.getItem(KEY); } catch (e) { return true; }
    return differs(data, current);
  }
  function fail(message) { return { ok: false, message: message }; }
  function restore() {
    try {
      var data = readBackup();
      if (!data) return fail('这份备份暂时读不了，先不用找了。');
      var NT = window.NT;
      if (!NT || typeof NT.restoreState !== 'function') return fail('这次没能找回，现在的进度还在。');
      if (typeof NT.isBusy === 'function' && NT.isBusy()) return fail('先把小游戏玩完，再来找回存档。');
      var box = storage();
      if (!box) return fail('现在的进度暂时收不起来，没有改动。');
      var previous;
      try { previous = box.getItem(KEY) || ''; }
      catch (e) { return fail('现在的进度暂时收不起来，没有改动。'); }
      try { box.setItem(BEFORE, previous); }
      catch (e2) { return fail('现在的进度暂时收不起来，没有改动。'); }
      var restored = false;
      try { restored = NT.restoreState(data) === true; }
      catch (e3) { restored = false; }
      if (!restored) return fail('这次没能找回，现在的进度还在。');
      try {
        var saved = box.getItem(KEY);
        if (saved != null && saved !== '') box.setItem(BACKUP, saved);
      } catch (e4) {}
      return { ok: true };
    } catch (e5) {
      return fail('这次没能找回，现在的进度还在。');
    }
  }

  window.NaituanRescue = {
    KEY: KEY,
    BACKUP_KEY: BACKUP,
    BEFORE_KEY: BEFORE,
    readBackup: readBackup,
    summary: summary,
    differs: differs,
    shouldShow: shouldShow,
    restore: restore
  };
})();
