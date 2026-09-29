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
  function create(raw) {
    var s = raw && typeof raw === 'object' ? raw : {};
    s.version = 1;
    if (!Array.isArray(s.tasks)) s.tasks = [];
    if (!Array.isArray(s.sessions)) s.sessions = [];
    s.minutes = minutes(s.minutes);
    if (s.timer && (!Number.isFinite(s.timer.plannedMs) || s.timer.plannedMs <= 0 || !Array.isArray(s.timer.days))) s.timer = null;
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
