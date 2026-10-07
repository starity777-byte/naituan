/* 节奏躲猫猫：关卡、谱子和规则。只有纯函数和数据，不碰 DOM 和存档；浏览器和 Node 测试共用。
   Boxes are numbered 1..9 in reading order (1 2 3 / 4 5 6 / 7 8 9); slots inside the game are 0-based. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NTHideSeek = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var COUNTIN = 4;
  var LEVELS = [
    { id: 1, name: '小试身手', boxes: 3, bpm: 76, canFail: false,
      tip: '奶团探出头时，点它！',
      chart: ['1','', '2','', '3','', '2','',
              '1','', '2','', '3','', '2','',
              '3','', '2','', '1','', '2',''] },
    { id: 2, name: '箱子变多啦', boxes: 6, bpm: 84, canFail: false,
      tip: '多了一排箱子，跟着节拍找奶团',
      chart: ['1','', '2','', '3','', '6','',
              '5','4', '','', '1','2', '3','',
              '4','', '5','', '6','', '3','',
              '2','1', '','', '4','5', '6',''] },
    { id: 3, name: '纸片猫来了', boxes: 6, bpm: 84, canFail: true,
      tip: '插在小棍上的是纸片猫，别点它！',
      chart: ['f2','', '','', 'f5','', '','',
              '1','', 'f3','', '4','', 'f6','',
              '1','', '2+f3','', '4','', '5+f6','',
              '3','2', 'f1','', '6','5', 'f4',''] },
    /* 第 4 关：9 个箱子。前后半关是同一套乐句的变奏（A A' B C D / A'' A''' B' C' D'）。 */
    { id: 4, name: '加快脚步', boxes: 9, bpm: 96, canFail: true,
      tip: '九个箱子，先看哪个箱子在抖',
      chart: ['1','', '5','f6',   '9','', '5','',
              '4','5', '6','',    'f2','', '8','',
              '7','8', '9','f5',
              '3','', '5','f9',   '7','', '5','f1',
              '6','5', '4','',    'f8','', '2','',
              '9','8', '7+f3',''] },
    /* 第 5 关：半拍猫（h，前一拍一定是空拍）和一拍里 1 真 1 假。前后半关节奏相同、位置变奏。 */
    { id: 5, name: '躲猫猫大师', boxes: 9, bpm: 108, canFail: true,
      tip: '有的奶团会在半拍探头',
      chart: ['5','', '2+f8','',  '4','5', '6','f2',
              '','3h', '2','f9',  '1','4', '7+f5','',
              '8','', '6+f4','f3','','5h', '6+f2','',
              '5','', '8+f2','',  '6','5', '4','f8',
              '','1h', '2','f7',  '3','6', '9+f5','',
              '8','', '4+f6','f1','','5h', '4+f8',''] }
  ];
  var ENDLESS = 5;                          /* level index used for 无尽模式 */
  var FIRST_CLEAR = [15, 20, 25, 30, 40];   /* 第一次通过第 1–5 关 */
  var PERFECT_BONUS = 10;                   /* 第一次拿到这关的三星 */
  var REPLAY_CAP = 10;                      /* 重复游玩每局最多 */
  var MAX_LIVES = 3;

  /* 露头时间（单边）：不少于 0.3 秒，也就是从探头到缩回至少 0.6 秒。 */
  function halfFor(bpm) { return Math.max(0.3, 60 / bpm * 0.55); }

  /* 'N' 真猫 · 'fN' 纸片猫 · 'Nh' 后半拍的真猫 · 'a+b' 同一拍两只 · '' 空拍。返回 genEvents 的事件格式。 */
  function parseCell(cell, beat) {
    if (cell === '' || cell == null) return [];
    return String(cell).split('+').map(function (tok) {
      var m = /^(f?)([1-9])(h?)$/.exec(tok.trim());
      if (!m) throw new Error('谱子第 ' + (beat + 1) + ' 拍看不懂：' + cell);
      return { box: +m[2], fake: m[1] === 'f', offbeat: m[3] === 'h' };
    });
  }
  function parseChart(chart, bpm, opts) {
    opts = opts || {};
    var countIn = opts.countIn || 0, boxes = opts.boxes || 9, ivl = 60 / bpm, half = halfFor(bpm), evs = [];
    chart.forEach(function (cell, i) {
      var seen = {};
      parseCell(cell, i).forEach(function (c) {
        if (c.box > boxes) throw new Error('谱子第 ' + (i + 1) + ' 拍用了 ' + c.box + ' 号箱子，这一关只有 ' + boxes + ' 个');
        if (seen[c.box]) throw new Error('谱子第 ' + (i + 1) + ' 拍同一个箱子写了两次');
        seen[c.box] = 1;
        evs.push({ t: (countIn + i + (c.offbeat ? 0.5 : 0)) * ivl, half: half, slot: c.box - 1, fake: c.fake, i: i });
      });
    });
    evs.sort(function (a, b) { return (a.t - a.half) - (b.t - b.half) || a.slot - b.slot; });
    return evs;
  }
  /* A constant-tempo timeline: 4 count-in beats, then one beat per chart cell. */
  function levelBeats(level) {
    var ivl = 60 / level.bpm, beats = [];
    for (var i = 0; i < COUNTIN + level.chart.length; i++) beats.push({ t: i * ivl, ivl: ivl });
    return beats;
  }
  function realCount(level) { return parseChart(level.chart, level.bpm).filter(function (e) { return !e.fake; }).length; }
  function paperCount(level) { return parseChart(level.chart, level.bpm).filter(function (e) { return e.fake; }).length; }

  /* ---- 无尽模式：沿用原来 genEvents 的随机规则，只是 9 个箱子不变、96→120 BPM 封顶、露头时间用 halfFor ---- */
  var ENDLESS_BPM0 = 96, ENDLESS_BPM1 = 120, ENDLESS_RAMP = 80;
  function endlessBpm(i) { return Math.min(ENDLESS_BPM1, ENDLESS_BPM0 + (ENDLESS_BPM1 - ENDLESS_BPM0) * (i / (ENDLESS_RAMP - 1))); }
  function createEndless(random) {
    random = random || Math.random;
    var st = { beats: [], i: 0, t: 0, lastReal: -1, prevReal: -1, busyUntil: {} }, n = 9;
    for (var c = 0; c < COUNTIN; c++) { st.beats.push({ t: st.t, ivl: 60 / ENDLESS_BPM0 }); st.t += 60 / ENDLESS_BPM0; }
    function rnd(k) { return Math.floor(random() * k); }
    /* Appends `count` beats; returns the new events (already in start order, never two cats in one box). */
    function extend(count) {
      var evs = [], k, tries;
      for (var c = 0; c < count; c++) {
        var i = st.i++, ivl = 60 / endlessBpm(i), bt = { t: st.t, ivl: ivl }, half = halfFor(endlessBpm(i)), used = [];
        st.beats.push(bt); st.t += ivl;
        var fakeOnly = i >= 30 && random() < 0.1;
        var restP = i < 8 ? 0 : i < 40 ? 0.1 : 0.14;
        if (!fakeOnly && random() >= restP) {
          var r; tries = 0; do { r = rnd(n); tries++; } while ((r === st.lastReal || r === st.prevReal) && tries < 30);
          st.prevReal = st.lastReal; st.lastReal = r; used.push(r);
          evs.push({ t: bt.t, half: half, slot: r, fake: false, i: i });
        }
        var fp = i < 12 ? 0 : i < 30 ? 0.25 : i < 50 ? 0.4 : 0.5, nf = 0;
        if (fakeOnly) nf = random() < 0.3 ? 2 : 1; else if (random() < fp) nf = i >= 50 && random() < 0.2 ? 2 : 1;
        for (k = 0; k < nf; k++) {
          var f; tries = 0; do { f = rnd(n); tries++; } while (used.indexOf(f) >= 0 && tries < 30);
          if (used.indexOf(f) < 0) { used.push(f); evs.push({ t: bt.t, half: half, slot: f, fake: true, i: i }); }
        }
        if (i >= 56 && !fakeOnly && random() < 0.3) { /* an extra cat on the off-beat */
          var o; tries = 0; do { o = rnd(n); tries++; } while ((used.indexOf(o) >= 0 || o === st.lastReal) && tries < 30);
          evs.push({ t: bt.t + ivl * 0.5, half: half, slot: o, fake: false, i: i });
        }
      }
      evs.sort(function (a, b) { return (a.t - a.half) - (b.t - b.half); });
      var out = [];
      evs.forEach(function (e) {
        var s0 = e.t - e.half, bu = st.busyUntil;
        if ((bu[e.slot] == null ? -1 : bu[e.slot]) > s0) {
          var free = []; for (var q = 0; q < n; q++) if ((bu[q] == null ? -1 : bu[q]) <= s0) free.push(q);
          if (!free.length) return;
          e.slot = free[rnd(free.length)];
        }
        bu[e.slot] = e.t + e.half; out.push(e);
      });
      return out;
    }
    return { beats: st.beats, extend: extend };
  }

  /* ---- 一局之中的规则（判定、扣心）。游戏和测试都走这里。 ---- */
  function createRun(level) {
    return { canFail: !!(level && level.canFail !== false), lives: MAX_LIVES, score: 0, combo: 0, maxCombo: 0,
      hits: 0, perfects: 0, realSeen: 0, dodged: 0, paperTaps: 0, misses: 0, failed: false };
  }
  function loseLife(run) {
    if (!run.canFail) return false;
    run.lives = Math.max(0, run.lives - 1);
    if (run.lives <= 0) run.failed = true;
    return true;
  }
  /* q: 0 完美（≤90ms）, 1 很好（≤150ms）, 2 摸到啦 */
  function quality(dt) { return dt <= 0.09 ? 0 : dt <= 0.15 ? 1 : 2; }
  function onHit(run, q) {
    run.realSeen++; run.hits++; if (q === 0) run.perfects++;
    run.combo++; if (run.combo > run.maxCombo) run.maxCombo = run.combo;
    run.score += Math.round([100, 70, 40][q] * (1 + Math.min(run.combo, 20) * 0.05));
    return { milestone: run.combo === 10 || run.combo === 20 || run.combo === 30 };
  }
  function onEscape(run) { run.realSeen++; run.misses++; run.combo = 0; return { lostLife: loseLife(run) }; }
  function onPaperTap(run) { run.paperTaps++; run.combo = 0; return { lostLife: loseLife(run) }; }
  function onPaperDodged(run) { run.dodged++; }
  /* 点空箱子：第 1–2 关不影响；第 3 关起连击清零，不扣分。 */
  function onEmptyTap(run) { if (run.canFail) run.combo = 0; }

  /* ---- 星星和小鱼干 ---- */
  function starsFor(cleared, hits, total, paperTaps) {
    if (!cleared) return 0;
    var acc = total ? hits / total : 1;
    if (acc >= 0.95 && !paperTaps) return 3;
    if (acc >= 0.8) return 2;
    return 1;
  }
  function freshHs() { return { unlocked: 1, stars: [0, 0, 0, 0, 0], cleared: [false, false, false, false, false], perfect: [false, false, false, false, false], paperSeen: false }; }
  function copyHs(hs) { return { unlocked: hs.unlocked, stars: hs.stars.slice(), cleared: hs.cleared.slice(), perfect: hs.perfect.slice(), paperSeen: !!hs.paperSeen }; }
  /* unlocked: 1–5 = 能玩到第几关；6 = 第 5 关也过了，无尽模式解锁。 */
  function isUnlocked(hs, idx) { return idx < 0 ? false : idx === ENDLESS ? hs.unlocked >= 6 : idx < LEVELS.length && idx < hs.unlocked; }
  /* 结算一关。hs 不会被改动，返回新的 hs 和这局的奖励。 */
  function settleLevel(hs, idx, cleared, hits, paperTaps) {
    var total = realCount(LEVELS[idx]), stars = starsFor(cleared, hits, total, paperTaps), next = copyHs(hs);
    var firstClear = cleared && !hs.cleared[idx], firstPerfect = stars === 3 && !hs.perfect[idx];
    var base = firstClear ? FIRST_CLEAR[idx] : Math.min(REPLAY_CAP, Math.round(hits * 0.5));
    var fish = base + (firstPerfect ? PERFECT_BONUS : 0);
    if (cleared) {
      next.cleared[idx] = true;
      next.stars[idx] = Math.max(next.stars[idx], stars);
      if (stars === 3) next.perfect[idx] = true;
      next.unlocked = Math.max(next.unlocked, idx + 2);
    }
    return { hs: next, stars: stars, total: total, fish: fish, firstClear: firstClear, firstPerfect: firstPerfect,
      unlockedNext: cleared && hs.unlocked < idx + 2 };
  }
  /* 无尽模式：原来 rhSettle 的公式。 */
  function endlessReward(hits, perfects, realSeen, dead) {
    var acc = realSeen ? hits / realSeen : 0;
    var grade = dead ? 'C' : acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : 'C';
    return { grade: grade, acc: acc, fish: Math.round(hits * 0.5 + perfects * 0.5) + { S: 10, A: 6, B: 3, C: 0 }[grade] };
  }

  /* ---- 存档：清理 / 老存档迁移 ---- */
  function migrate(raw, bestBeat) {
    var hs = freshHs();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      if (typeof bestBeat === 'number' && bestBeat > 0) hs.unlocked = 3; /* 老玩家直接解锁到第 3 关 */
      return hs;
    }
    for (var i = 0; i < 5; i++) {
      var s = raw.stars && raw.stars[i];
      hs.stars[i] = typeof s === 'number' && isFinite(s) ? Math.max(0, Math.min(3, Math.floor(s))) : 0;
      hs.cleared[i] = !!(raw.cleared && raw.cleared[i] === true) || hs.stars[i] > 0;
      hs.perfect[i] = !!(raw.perfect && raw.perfect[i] === true) || hs.stars[i] === 3;
      if (hs.cleared[i]) hs.unlocked = Math.max(hs.unlocked, i + 2);
    }
    var u = raw.unlocked;
    if (typeof u === 'number' && isFinite(u)) hs.unlocked = Math.max(hs.unlocked, Math.min(6, Math.floor(u)));
    hs.paperSeen = raw.paperSeen === true;
    return hs;
  }

  return { COUNTIN: COUNTIN, LEVELS: LEVELS, ENDLESS: ENDLESS, FIRST_CLEAR: FIRST_CLEAR, PERFECT_BONUS: PERFECT_BONUS, REPLAY_CAP: REPLAY_CAP, MAX_LIVES: MAX_LIVES,
    ENDLESS_BPM0: ENDLESS_BPM0, ENDLESS_BPM1: ENDLESS_BPM1,
    halfFor: halfFor, parseCell: parseCell, parseChart: parseChart, levelBeats: levelBeats, realCount: realCount, paperCount: paperCount,
    endlessBpm: endlessBpm, createEndless: createEndless,
    createRun: createRun, quality: quality, onHit: onHit, onEscape: onEscape, onPaperTap: onPaperTap, onPaperDodged: onPaperDodged, onEmptyTap: onEmptyTap,
    starsFor: starsFor, freshHs: freshHs, isUnlocked: isUnlocked, settleLevel: settleLevel, endlessReward: endlessReward, migrate: migrate };
});
