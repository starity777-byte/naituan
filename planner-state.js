/* Calendar / study data. Time is measured from timestamps, never interval ticks. */
(function (root) {
  'use strict';
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(value) {
    var d = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function date(value) { var p = value.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function shift(value, days) { var d = date(value); d.setDate(d.getDate() + days); return dateKey(d); }
  function uid() { return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  function minutes(value) { return Math.max(1, Math.min(180, Math.round(Number(value) || 25))); }
  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function finiteNonNeg(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
  function dateKeyOk(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value); }
  function cleanDayEntry(entry) {
    if (!isPlainObject(entry) || !dateKeyOk(entry.date) || !finiteNonNeg(entry.ms)) return null;
    return { date: entry.date, ms: entry.ms };
  }
  function cleanDayList(list) {
    if (!Array.isArray(list)) return null;
    var days = [];
    for (var i = 0; i < list.length; i++) {
      var day = cleanDayEntry(list[i]);
      if (day) days.push(day);
    }
    return days;
  }
  function cleanTask(task) {
    // Stored tasks use title (not text); see planner.js tasks.push.
    if (!isPlainObject(task) || typeof task.id !== 'string' || typeof task.title !== 'string' || !dateKeyOk(task.date) || typeof task.done !== 'boolean') return null;
    var clean = { id: task.id, title: task.title, date: task.date, done: task.done };
    if (finiteNonNeg(task.createdAt)) clean.createdAt = task.createdAt;
    return clean;
  }
  function cleanTasks(list) {
    if (!Array.isArray(list)) return [];
    var tasks = [];
    for (var i = 0; i < list.length; i++) {
      var task = cleanTask(list[i]);
      if (task) tasks.push(task);
    }
    return tasks;
  }
  function idOrNull(value) { return value === null || typeof value === 'string' ? value : false; }
  function cleanSession(session) {
    if (!isPlainObject(session) || typeof session.id !== 'string' || typeof session.title !== 'string' || typeof session.completed !== 'boolean') return null;
    if (idOrNull(session.taskId) === false) return null;
    if (!finiteNonNeg(session.startedAt) || !finiteNonNeg(session.endedAt) || !finiteNonNeg(session.durationMs) || !finiteNonNeg(session.plannedMs)) return null;
    var days = cleanDayList(session.days);
    if (!days) return null;
    var clean = { id: session.id, taskId: session.taskId, title: session.title, startedAt: session.startedAt,
      endedAt: session.endedAt, durationMs: session.durationMs, plannedMs: session.plannedMs, completed: session.completed, days: days };
    if (typeof session.legacy === 'boolean') clean.legacy = session.legacy;
    return clean;
  }
  function cleanSessions(list) {
    if (!Array.isArray(list)) return [];
    var sessions = [];
    for (var i = 0; i < list.length; i++) {
      var session = cleanSession(list[i]);
      if (session) sessions.push(session);
    }
    return sessions;
  }
  function cleanTimer(timer) {
    if (!isPlainObject(timer) || typeof timer.id !== 'string' || (timer.kind !== 'focus' && timer.kind !== 'break')) return null;
    if (idOrNull(timer.taskId) === false || typeof timer.title !== 'string') return null;
    if (!finiteNonNeg(timer.plannedMs) || timer.plannedMs <= 0 || !finiteNonNeg(timer.elapsedMs) || !finiteNonNeg(timer.startedAt)) return null;
    if (!(timer.runningSince === null || finiteNonNeg(timer.runningSince))) return null;
    var days = cleanDayList(timer.days);
    if (!days) return null;
    return { id: timer.id, kind: timer.kind, taskId: timer.taskId, title: timer.title, plannedMs: timer.plannedMs,
      elapsedMs: timer.elapsedMs, startedAt: timer.startedAt, runningSince: timer.runningSince, days: days };
  }
  function cleanResult(result) {
    if (result == null) return null;
    if (!isPlainObject(result) || (result.kind !== 'focus' && result.kind !== 'break')) return null;
    if (idOrNull(result.sessionId) === false || idOrNull(result.taskId) === false) return null;
    if (typeof result.title !== 'string' || typeof result.completed !== 'boolean' || !finiteNonNeg(result.durationMs)) return null;
    return { kind: result.kind, sessionId: result.sessionId, taskId: result.taskId, title: result.title, durationMs: result.durationMs, completed: result.completed };
  }
  function cleanAmbience(raw) {
    if (!isPlainObject(raw)) return null;
    var rain = finiteNonNeg(raw.rain) && raw.rain <= 100 ? raw.rain : 30;
    var purr = finiteNonNeg(raw.purr) && raw.purr <= 100 ? raw.purr : 35;
    return {
      scene: typeof raw.scene === 'string' ? raw.scene : 'sunny-desk',
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : false,
      rain: rain, purr: purr
    };
  }
  function create(raw) {
    raw = isPlainObject(raw) ? raw : {};
    var s = { version: 1, tasks: cleanTasks(raw.tasks), sessions: cleanSessions(raw.sessions), minutes: minutes(raw.minutes) };
    if (Object.prototype.hasOwnProperty.call(raw, 'timer')) s.timer = cleanTimer(raw.timer);
    if (typeof raw.migrated === 'boolean') s.migrated = raw.migrated;
    if (Object.prototype.hasOwnProperty.call(raw, 'deletedTask')) s.deletedTask = cleanTask(raw.deletedTask);
    if (Object.prototype.hasOwnProperty.call(raw, 'result')) s.result = cleanResult(raw.result);
    if (Object.prototype.hasOwnProperty.call(raw, 'ambience')) {
      var ambience = cleanAmbience(raw.ambience);
      if (ambience) s.ambience = ambience;
    }
    return s;
  }
  function elapsed(timer, now) {
    if (!timer) return 0;
    return Math.min(timer.plannedMs, timer.elapsedMs + (timer.runningSince == null ? 0 : Math.max(0, now - timer.runningSince)));
  }
  function addDay(days, key, ms) {
    var entry = days.find(function (d) { return d.date === key; });
    if (entry) entry.ms += ms; else days.push({ date: key, ms: ms });
  }
  function attribute(days, from, to) {
    while (from < to) {
      var d = new Date(from), midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      var end = Math.min(to, midnight);
      addDay(days, dateKey(d), end - from);
      from = end;
    }
  }
  function advance(timer, now) {
    if (!timer || timer.runningSince == null) return null;
    var amount = Math.min(Math.max(0, now - timer.runningSince), timer.plannedMs - timer.elapsedMs);
    var end = timer.runningSince + amount;
    attribute(timer.days, timer.runningSince, end);
    timer.elapsedMs += amount;
    timer.runningSince = Math.max(timer.runningSince, now);
    return end;
  }
  function start(s, options, now) {
    if (s.timer) return false;
    var kind = options.kind === 'break' ? 'break' : 'focus';
    var duration = kind === 'break' ? 5 : minutes(options.minutes);
    if (kind === 'focus') s.minutes = duration;
    s.result = null;
    s.timer = { id: uid(), kind: kind, taskId: options.taskId || null, title: String(options.title || '专注一小会儿').slice(0, 120),
      plannedMs: duration * 60000, elapsedMs: 0, startedAt: now, runningSince: now, days: [] };
    return true;
  }
  function pause(s, now) { if (s.timer) { advance(s.timer, now); s.timer.runningSince = null; } }
  function resume(s, now) { if (s.timer && s.timer.runningSince == null) s.timer.runningSince = now; }
  function finish(s, now) {
    var t = s.timer;
    if (!t) return null;
    var end = advance(t, now);
    var completed = t.elapsedMs >= t.plannedMs;
    var session = null;
    if (t.kind === 'focus' && t.elapsedMs >= 1000) {
      session = { id: t.id, taskId: t.taskId, title: t.title, startedAt: t.startedAt,
        endedAt: completed && end != null ? end : now, durationMs: t.elapsedMs,
        plannedMs: t.plannedMs, completed: completed, days: t.days };
      s.sessions.push(session);
    }
    s.result = { kind: t.kind, sessionId: session ? session.id : null, taskId: t.taskId, title: t.title,
      durationMs: t.elapsedMs, completed: completed };
    s.timer = null;
    return s.result;
  }
  function settle(s, now) {
    return s.timer && elapsed(s.timer, now) >= s.timer.plannedMs ? finish(s, now) : null;
  }
  function dayMs(session, key) {
    return (session.days || []).reduce(function (sum, day) { return sum + (day.date === key ? day.ms : 0); }, 0);
  }
  function stats(s, key) {
    var tasks = s.tasks.filter(function (t) { return t.date === key; });
    var sessions = s.sessions.filter(function (v) { return dayMs(v, key) > 0; });
    return { tasks: tasks.length, done: tasks.filter(function (t) { return t.done; }).length, count: sessions.length,
      ms: sessions.reduce(function (sum, session) { return sum + dayMs(session, key); }, 0) };
  }
  function totalMs(s) { return s.sessions.reduce(function (sum, session) { return sum + session.durationMs; }, 0); }
  var api = { create: create, dateKey: dateKey, date: date, shift: shift, uid: uid, minutes: minutes,
    elapsed: elapsed, start: start, pause: pause, resume: resume, finish: finish, settle: settle, dayMs: dayMs, stats: stats, totalMs: totalMs };
  root.NaituanPlannerState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
