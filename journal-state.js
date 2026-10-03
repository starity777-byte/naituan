(function (root) {
  'use strict';
  function entries(life, date) {
    var day = life && life.days && life.days[date] || {}, rows = [];
    (Array.isArray(day.entries) ? day.entries : []).forEach(function (entry) {
      if (entry && entry.id && (entry.text || entry.photoId)) rows.push(Object.assign({}, entry, { date: date }));
    });
    var food = day.food;
    if (food && (food.note || food.photo || food.photoId)) rows.push({ id: 'food:' + date, date: date, legacy: true,
      text: food.note || '', photoId: food.photoId || '', photo: food.photo || '', createdAt: food.createdAt || 0 });
    return rows.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }
  function all(life) {
    return Object.keys(life && life.days || {}).sort().reverse().reduce(function (result, date) { return result.concat(entries(life, date)); }, []);
  }
  function summary(life) {
    var rows = all(life), dates = new Set(rows.map(function (entry) { return entry.date; }));
    return { count: rows.length, days: dates.size, photos: rows.filter(function (entry) { return entry.photoId || entry.photo; }).length };
  }
  function counts(life) {
    var result = {};
    Object.keys(life && life.days || {}).forEach(function (date) { var count = entries(life, date).length; if (count) result[date] = count; });
    return result;
  }
  function photoIds(life) { return Array.from(new Set(all(life).map(function (entry) { return entry.photoId; }).filter(Boolean))); }
  function remapPhotos(life, map) {
    Object.keys(life && life.days || {}).forEach(function (date) {
      var day = life.days[date];
      if (day.food && map[day.food.photoId]) day.food.photoId = map[day.food.photoId];
      (Array.isArray(day.entries) ? day.entries : []).forEach(function (entry) { if (map[entry.photoId]) entry.photoId = map[entry.photoId]; });
    });
  }
  function date(value) { var parts = value.split('-').map(Number); return new Date(parts[0], parts[1] - 1, parts[2], 12); }
  function key(value) { return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0'); }
  function shift(value, amount) { var d = date(value); d.setDate(d.getDate() + amount); return key(d); }
  var api = { entries: entries, all: all, summary: summary, counts: counts, photoIds: photoIds, remapPhotos: remapPhotos, date: date, key: key, shift: shift };
  root.NaituanJournalState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
