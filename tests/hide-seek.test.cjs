const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../hide-seek-levels.js');

const L = H.LEVELS;
const plain = v => JSON.parse(JSON.stringify(v));
function seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 关卡表 ---------- */
test('5 个关卡按规格表：名字、箱子数、BPM、拍数、能不能输', () => {
  assert.deepEqual(L.map(l => [l.id, l.name, l.boxes, l.bpm, l.chart.length, l.canFail]), [
    [1, '小试身手', 3, 76, 24, false],
    [2, '箱子变多啦', 6, 84, 32, false],
    [3, '纸片猫来了', 6, 84, 32, true],
    [4, '加快脚步', 9, 96, 40, true],
    [5, '躲猫猫大师', 9, 108, 48, true]
  ]);
  for (const l of L) assert.ok(l.bpm <= 108, '关卡最快不超过 108 BPM');
  assert.equal(H.ENDLESS_BPM0, 96);
  assert.equal(H.ENDLESS_BPM1, 120);
  for (let i = 0; i < 400; i++) assert.ok(H.endlessBpm(i) <= 120 && H.endlessBpm(i) >= 96);
});

test('前三关的谱子和规格里写的一字不差', () => {
  assert.deepEqual(L[0].chart, ['1','', '2','', '3','', '2','', '1','', '2','', '3','', '2','', '3','', '2','', '1','', '2','']);
  assert.deepEqual(L[1].chart, ['1','', '2','', '3','', '6','', '5','4', '','', '1','2', '3','', '4','', '5','', '6','', '3','', '2','1', '','', '4','5', '6','']);
  assert.deepEqual(L[2].chart, ['f2','', '','', 'f5','', '','', '1','', 'f3','', '4','', 'f6','', '1','', '2+f3','', '4','', '5+f6','', '3','2', 'f1','', '6','5', 'f4','']);
  assert.deepEqual(L.map(l => l.tip).slice(0, 3), ['奶团探出头时，点它！', '多了一排箱子，跟着节拍找奶团', '插在小棍上的是纸片猫，别点它！']);
});

/* ---------- parseChart ---------- */
test('parseChart：空拍、真猫、纸片猫、组合、半拍', () => {
  const bpm = 60, ivl = 1, half = H.halfFor(bpm);
  assert.deepEqual(H.parseChart(['', '', ''], bpm), []);
  assert.deepEqual(plain(H.parseChart(['2'], bpm)), [{ t: 0, half, slot: 1, fake: false, i: 0 }]);
  assert.deepEqual(plain(H.parseChart(['', 'f5'], bpm)), [{ t: ivl, half, slot: 4, fake: true, i: 1 }]);
  const combo = H.parseChart(['', '', '2+f5'], bpm);
  assert.deepEqual(plain(combo), [{ t: 2, half, slot: 1, fake: false, i: 2 }, { t: 2, half, slot: 4, fake: true, i: 2 }]);
  assert.deepEqual(plain(H.parseChart(['', '3h'], bpm)), [{ t: 1.5, half, slot: 2, fake: false, i: 1 }]);
  assert.deepEqual(plain(H.parseChart(['9'], bpm, { countIn: 4 })), [{ t: 4, half, slot: 8, fake: false, i: 0 }]);
  /* 编号按阅读顺序：1 2 3 / 4 5 6 / 7 8 9 → slot 0..8 */
  assert.deepEqual(H.parseChart(['1', '', '9'], bpm).map(e => e.slot), [0, 8]);
});

test('parseChart：看不懂的格子、超出箱子数、同一拍同一箱子都会报错', () => {
  assert.throws(() => H.parseChart(['x'], 80), /看不懂/);
  assert.throws(() => H.parseChart(['0'], 80), /看不懂/);
  assert.throws(() => H.parseChart(['2+'], 80), /看不懂/);
  assert.throws(() => H.parseChart(['4'], 80, { boxes: 3 }), /只有 3 个/);
  assert.throws(() => H.parseChart(['2+f2'], 80), /两次/);
  for (const l of L) assert.doesNotThrow(() => H.parseChart(l.chart, l.bpm, { boxes: l.boxes }));
});

/* ---------- 时机 ---------- */
function eventsFor(level) { return H.parseChart(level.chart, level.bpm, { countIn: H.COUNTIN, boxes: level.boxes }); }
function assertNoOverlap(evs, label) {
  const bySlot = {};
  for (const e of evs) (bySlot[e.slot] || (bySlot[e.slot] = [])).push(e);
  for (const slot in bySlot) {
    const list = bySlot[slot].slice().sort((a, b) => a.t - b.t);
    for (let k = 1; k < list.length; k++) {
      assert.ok(list[k].t - list[k].half >= list[k - 1].t + list[k - 1].half - 1e-9,
        `${label}：${+slot + 1} 号箱子在第 ${list[k - 1].i + 1} 拍和第 ${list[k].i + 1} 拍同时有两只猫`);
    }
  }
}

test('任何关卡、任何时刻，同一个箱子里不会同时有两只猫', () => {
  for (const l of L) assertNoOverlap(eventsFor(l), '第 ' + l.id + ' 关');
  for (const seed of [1, 7, 42, 2026]) {
    const gen = H.createEndless(seeded(seed));
    const evs = [];
    for (let c = 0; c < 10; c++) evs.push(...gen.extend(32));
    assertNoOverlap(evs, '无尽模式 seed ' + seed);
    for (let k = 1; k < evs.length; k++) assert.ok(evs[k].t - evs[k].half >= evs[k - 1].t - evs[k - 1].half - 1e-9, '无尽模式的事件按出现顺序排列');
  }
});

test('露头时间在每个关卡和无尽模式的 BPM 下都不少于 0.3 秒（单边），并且是一拍的 0.55', () => {
  for (const l of L) {
    assert.ok(H.halfFor(l.bpm) >= 0.3, '第 ' + l.id + ' 关');
    assert.equal(H.halfFor(l.bpm), Math.max(0.3, 60 / l.bpm * 0.55));
    for (const e of eventsFor(l)) assert.ok(e.half >= 0.3);
  }
  for (const bpm of [96, 108, 120, 150, 200]) assert.ok(H.halfFor(bpm) >= 0.3);
  const gen = H.createEndless(seeded(3));
  const evs = [];
  for (let c = 0; c < 8; c++) evs.push(...gen.extend(40));
  assert.ok(evs.length > 100);
  for (const e of evs) assert.ok(e.half >= 0.3);
});

test('一关之内速度和箱子数都不变', () => {
  for (const l of L) {
    const beats = H.levelBeats(l);
    assert.equal(beats.length, H.COUNTIN + l.chart.length);
    for (const b of beats) assert.ok(Math.abs(b.ivl - 60 / l.bpm) < 1e-12);
    for (let k = 1; k < beats.length; k++) assert.ok(Math.abs(beats[k].t - beats[k - 1].t - 60 / l.bpm) < 1e-9);
    for (const e of eventsFor(l)) assert.ok(e.slot < l.boxes);
  }
});

/* ---------- 第 4、5 关的写谱规则 ---------- */
const POS = n => [Math.floor((n - 1) / 3), (n - 1) % 3];
const adjacent = (a, b) => { const [r1, c1] = POS(a), [r2, c2] = POS(b); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; };
function cells(level) { return level.chart.map((c, i) => H.parseCell(c, i)); }

/* 前半关和后半关重复或稍作变化：哪拍有猫的节奏最多差几拍 */
function assertHalvesEcho(cs, maxDiff) {
  const shape = c => (c.length ? 1 : 0), h = cs.length / 2;
  const a = cs.slice(0, h).map(shape), b = cs.slice(h).map(shape);
  assert.ok(a.filter((v, i) => v !== b[i]).length <= maxDiff, '前后半关的节奏差太多');
}
function checkChartRules(level, maxPaper) {
  const cs = cells(level), n = cs.length, name = '第 ' + level.id + ' 关';
  assert.equal(n % 4, 0, name + '：拍数是 4 拍乐句的整数倍');
  let papers = 0, total = 0;
  for (let i = 0; i < n; i++) {
    const here = cs[i], reals = here.filter(c => !c.fake), fakes = here.filter(c => c.fake);
    papers += fakes.length; total += here.length;
    assert.ok(fakes.length <= 1, `${name} 第 ${i + 1} 拍：纸片猫每拍最多 1 只`);
    assert.ok(reals.length <= 1, `${name} 第 ${i + 1} 拍：每拍最多 1 只真猫`);
    if (i + 1 < n) {
      const next = cs[i + 1], nextReals = next.filter(c => !c.fake);
      /* 同一个箱子不能连续两拍都有猫（真猫、纸片猫都算，否则露头时间会重叠、预告会抖在正有猫的箱子上） */
      for (const a of here) for (const b of next) assert.notEqual(a.box, b.box, `${name} 第 ${i + 1}–${i + 2} 拍：${a.box} 号箱子连续两拍`);
      /* 连续两拍都有真猫：两个箱子上下或左右相邻 */
      if (reals.length && nextReals.length) assert.ok(adjacent(reals[0].box, nextReals[0].box), `${name} 第 ${i + 1}–${i + 2} 拍：${reals[0].box} → ${nextReals[0].box} 不相邻`);
    }
  }
  /* 每 8 拍至少 1 拍空拍：按 8 拍一段数，也按任意连续 8 拍数 */
  for (let s = 0; s + 8 <= n; s++) assert.ok(cs.slice(s, s + 8).some(c => !c.length), `${name} 第 ${s + 1}–${s + 8} 拍没有空拍`);
  /* 纸片猫占比：按猫的只数和按拍数都不超过上限 */
  assert.ok(papers / total <= maxPaper, `${name}：纸片猫占全部猫的 ${(papers / total * 100).toFixed(1)}%`);
  assert.ok(papers / n <= maxPaper, `${name}：纸片猫占拍数的 ${(papers / n * 100).toFixed(1)}%`);
  return { cs, papers, total };
}

test('第 4 关：40 拍、96 BPM、9 个箱子，满足全部写谱规则', () => {
  const l = L[3];
  assert.equal(l.chart.length, 40); assert.equal(l.bpm, 96); assert.equal(l.boxes, 9);
  const { cs } = checkChartRules(l, 0.25);
  assert.ok(cs.every(c => c.every(x => !x.offbeat)), '半拍猫只在第 5 关');
  assert.ok(cs.some(c => c.some(x => x.box >= 7)), '用到了第三排');
  assertHalvesEcho(cs, 3);
});

test('第 5 关：48 拍、108 BPM、9 个箱子，满足全部写谱规则和半拍规则', () => {
  const l = L[4];
  assert.equal(l.chart.length, 48); assert.equal(l.bpm, 108); assert.equal(l.boxes, 9);
  const { cs } = checkChartRules(l, 0.35);
  const offbeats = [];
  cs.forEach((c, i) => { if (c.some(x => x.offbeat)) offbeats.push(i); });
  assert.ok(offbeats.length > 0, '第 5 关有半拍猫');
  for (const i of offbeats) {
    assert.ok(i > 0 && cs[i - 1].length === 0, `第 ${i + 1} 拍的半拍猫前一拍必须是空拍`);
    assert.ok(cs[i].every(x => x.offbeat && !x.fake) && cs[i].length === 1, `第 ${i + 1} 拍：半拍猫单独一只`);
  }
  for (let s = 0; s + 8 <= cs.length; s++) assert.ok(offbeats.filter(i => i >= s && i < s + 8).length <= 1, `第 ${s + 1}–${s + 8} 拍半拍猫超过 1 个`);
  assert.ok(cs.some(c => c.length === 2 && c.filter(x => x.fake).length === 1), '有一拍里 1 真 1 假');
  assertHalvesEcho(cs, 3);
  /* 半拍猫和下一拍的真猫也算连续，要相邻 */
  for (const i of offbeats) {
    const nr = cs[i + 1].filter(x => !x.fake);
    if (nr.length) assert.ok(adjacent(cs[i][0].box, nr[0].box));
  }
});

/* ---------- 一局的规则 ---------- */
function playLevel(level, plan) {
  /* plan(e) → 'hit' | 'miss' | 'paper' | 'dodge'; 'empty' taps are added between beats */
  const run = H.createRun(level);
  for (const e of eventsFor(level)) {
    if (run.failed) break;
    const what = plan(e);
    if (e.fake) { if (what === 'paper') H.onPaperTap(run); else H.onPaperDodged(run); }
    else if (what === 'hit') H.onHit(run, 0); else H.onEscape(run);
    H.onEmptyTap(run);
  }
  return run;
}

test('第 1、2 关无论漏掉多少只猫、点多少下空箱子都不会失败', () => {
  for (const l of [L[0], L[1]]) {
    const run = playLevel(l, () => 'miss');
    assert.equal(run.failed, false);
    assert.equal(run.lives, 3);
    assert.equal(run.hits, 0);
    assert.equal(run.realSeen, H.realCount(l));
    for (let k = 0; k < 50; k++) { H.onEscape(run); H.onPaperTap(run); H.onEmptyTap(run); }
    assert.equal(run.failed, false);
    assert.equal(run.lives, 3);
  }
});

test('第 3 关起：漏 3 只就失败；点纸片猫扣心并清连击；点空箱子清连击但不扣分', () => {
  for (const l of [L[2], L[3], L[4]]) {
    const run = playLevel(l, () => 'miss');
    assert.equal(run.failed, true);
    assert.equal(run.lives, 0);
    assert.equal(run.misses, 3);
  }
  const run = H.createRun(L[2]);
  H.onHit(run, 0); H.onHit(run, 1);
  const score = run.score;
  assert.equal(run.combo, 2);
  H.onEmptyTap(run);
  assert.equal(run.combo, 0); assert.equal(run.score, score); assert.equal(run.lives, 3);
  H.onHit(run, 2);
  H.onPaperTap(run);
  assert.equal(run.combo, 0); assert.equal(run.lives, 2); assert.equal(run.paperTaps, 1);
  /* 第 1–2 关点空箱子不影响连击 */
  const easy = H.createRun(L[0]);
  H.onHit(easy, 0); H.onEmptyTap(easy);
  assert.equal(easy.combo, 1);
  /* 每关 3 颗心，开局补满 */
  for (const l of L) assert.equal(H.createRun(l).lives, 3);
});

test('判定窗口：≤90ms 完美，≤150ms 很好，其余摸到啦；连击到 10/20/30 有提示', () => {
  assert.equal(H.quality(0), 0); assert.equal(H.quality(0.09), 0);
  assert.equal(H.quality(0.091), 1); assert.equal(H.quality(0.15), 1);
  assert.equal(H.quality(0.151), 2); assert.equal(H.quality(0.3), 2);
  const run = H.createRun(L[0]), marks = [];
  for (let k = 1; k <= 31; k++) if (H.onHit(run, 0).milestone) marks.push(k);
  assert.deepEqual(marks, [10, 20, 30]);
  assert.equal(run.maxCombo, 31);
});

/* ---------- 星星和小鱼干 ---------- */
test('星星：通过 1 星；命中率 ≥80% 2 星；≥95% 且没点纸片猫 3 星', () => {
  assert.equal(H.starsFor(false, 20, 20, 0), 0);
  assert.equal(H.starsFor(true, 0, 20, 0), 1);
  assert.equal(H.starsFor(true, 15, 20, 0), 1);
  assert.equal(H.starsFor(true, 16, 20, 0), 2);
  assert.equal(H.starsFor(true, 18, 20, 0), 2);
  assert.equal(H.starsFor(true, 19, 20, 0), 3);
  assert.equal(H.starsFor(true, 20, 20, 1), 2);
  assert.equal(H.starsFor(true, 20, 20, 0), 3);
});

test('首次通关奖励 15/20/25/30/40，首次三星 +10，重复游玩 命中×0.5 四舍五入、最多 10', () => {
  const total = L.map(l => H.realCount(l));
  for (let i = 0; i < 5; i++) {
    const r = H.settleLevel(H.freshHs(), i, true, Math.ceil(total[i] * 0.85), 0);
    assert.equal(r.firstClear, true);
    assert.equal(r.stars, 2);
    assert.equal(r.fish, [15, 20, 25, 30, 40][i]);
  }
  /* 第一次就三星：首通 + 10 */
  const perfect = H.settleLevel(H.freshHs(), 0, true, total[0], 0);
  assert.equal(perfect.stars, 3); assert.equal(perfect.fish, 25); assert.equal(perfect.firstPerfect, true);
  assert.equal(perfect.hs.perfect[0], true);
  /* 已经通过，这次第一次三星：重复奖励 + 10 */
  let hs = H.settleLevel(H.freshHs(), 3, true, Math.floor(total[3] * 0.78), 0).hs;
  assert.equal(hs.stars[3], 1);
  const later = H.settleLevel(hs, 3, true, total[3], 0);
  assert.equal(later.firstClear, false); assert.equal(later.firstPerfect, true);
  assert.equal(later.fish, Math.min(10, Math.round(total[3] * 0.5)) + 10);
  /* 再拿一次三星，不再给 +10 */
  const again = H.settleLevel(later.hs, 3, true, total[3], 0);
  assert.equal(again.firstPerfect, false); assert.equal(again.fish, 10);
  /* 重复游玩上限与四舍五入 */
  hs = H.settleLevel(H.freshHs(), 0, true, 12, 0).hs;
  assert.equal(H.settleLevel(hs, 0, true, 5, 0).fish, 3);   /* 2.5 → 3 */
  assert.equal(H.settleLevel(hs, 0, true, 7, 0).fish, 4);   /* 3.5 → 4 */
  assert.equal(H.settleLevel(hs, 0, true, 12, 1).fish, 6);
  hs = H.settleLevel(H.freshHs(), 4, true, total[4], 1).hs;
  assert.equal(H.settleLevel(hs, 4, true, 28, 1).fish, 10); /* 14 → 最多 10 */
  /* 没过关：不算首通，按重复游玩算，星星和进度不变 */
  const fail = H.settleLevel(H.freshHs(), 2, false, 4, 1);
  assert.equal(fail.stars, 0); assert.equal(fail.fish, 2); assert.equal(fail.firstClear, false);
  assert.deepEqual(plain(fail.hs), plain(H.freshHs()));
  /* 星星只记最好成绩 */
  const best = H.settleLevel(H.settleLevel(H.freshHs(), 0, true, 12, 0).hs, 0, true, 2, 0);
  assert.equal(best.stars, 1); assert.equal(best.hs.stars[0], 3);
});

test('无尽模式沿用原来的小鱼干公式', () => {
  assert.deepEqual(H.endlessReward(40, 20, 41, false), { grade: 'S', acc: 40 / 41, fish: 40 });
  assert.equal(H.endlessReward(17, 4, 20, false).grade, 'A');
  assert.equal(H.endlessReward(17, 4, 20, false).fish, 17);
  assert.equal(H.endlessReward(30, 10, 31, true).grade, 'C');
  assert.equal(H.endlessReward(30, 10, 31, true).fish, 20);
  assert.equal(H.endlessReward(0, 0, 0, true).fish, 0);
});

/* ---------- 解锁 ---------- */
test('通过第 N 关解锁第 N+1 关；通过第 5 关解锁无尽模式', () => {
  let hs = H.freshHs();
  assert.equal(H.isUnlocked(hs, 0), true);
  assert.equal(H.isUnlocked(hs, 1), false);
  assert.equal(H.isUnlocked(hs, H.ENDLESS), false);
  for (let i = 0; i < 5; i++) {
    const failed = H.settleLevel(hs, i, false, 0, 0);
    assert.equal(H.isUnlocked(failed.hs, i + 1), false, '没过关不解锁');
    const r = H.settleLevel(hs, i, true, 1, 0);
    assert.equal(r.unlockedNext, true);
    hs = r.hs;
    assert.equal(hs.unlocked, i + 2);
    if (i < 4) { assert.equal(H.isUnlocked(hs, i + 1), true); assert.equal(H.isUnlocked(hs, H.ENDLESS), false); }
  }
  assert.equal(H.isUnlocked(hs, H.ENDLESS), true);
  assert.equal(hs.unlocked, 6);
  /* 重玩前面的关不会把进度往回退 */
  assert.equal(H.settleLevel(hs, 0, true, 1, 0).hs.unlocked, 6);
  assert.equal(H.settleLevel(hs, 0, true, 1, 0).unlockedNext, false);
});

/* ---------- 存档迁移 ---------- */
test('老存档迁移：没有 hs 时补上；bestBeat > 0 时解锁到第 3 关', () => {
  assert.deepEqual(plain(H.migrate(undefined, 0)), plain(H.freshHs()));
  assert.deepEqual(plain(H.migrate(null, 0)), plain(H.freshHs()));
  const old = H.migrate(undefined, 1520);
  assert.equal(old.unlocked, 3);
  assert.deepEqual(old.stars, [0, 0, 0, 0, 0]);
  assert.equal(H.isUnlocked(old, 2), true);
  assert.equal(H.isUnlocked(old, 3), false);
  /* 已有 hs 的存档照原样读回，坏数据被清理 */
  const kept = { unlocked: 4, stars: [3, 2, 1, 0, 0], cleared: [true, true, true, false, false], perfect: [true, false, false, false, false], paperSeen: true };
  assert.deepEqual(plain(H.migrate(kept, 999)), kept);
  const messy = H.migrate({ unlocked: 99, stars: [7, -1, 'x', 2.6, null], cleared: 'yes', perfect: [1] }, 0);
  assert.deepEqual(plain(messy), { unlocked: 6, stars: [3, 0, 0, 2, 0], cleared: [true, false, false, true, false], perfect: [true, false, false, false, false], paperSeen: false });
  assert.equal(H.migrate({ unlocked: 0 }, 0).unlocked, 1);
  assert.equal(H.migrate([], 5).unlocked, 3);
});
