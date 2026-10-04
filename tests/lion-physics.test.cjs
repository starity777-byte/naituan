const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../lion-physics.js');

function seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function run(world, seconds) { for (let t = 0; t < seconds; t += 1 / 60) world.step(1 / 60); }

test('一共 13 级，半径从小到大，最大的略过容器一半宽', () => {
  const w = P.create();
  assert.equal(w.radii.length, 13);
  for (let i = 1; i < w.radii.length; i++) assert.ok(w.radii[i] > w.radii[i - 1]);
  assert.ok(w.radii[12] * 2 > w.width * .5 && w.radii[12] * 2 < w.width * .6);
});

test('同一级碰到会合成下一级，不同级不会', () => {
  const w = P.create({ rng: seeded(1) });
  w.add(2, 150, 400); w.add(2, 160, 400);
  w.add(5, 300, 400);
  run(w, 1);
  const events = w.drain();
  assert.equal(events.filter((e) => e.type === 'merge' && e.level === 3).length, 1);
  assert.deepEqual(w.bodies.map((b) => b.lvl).sort(), [3, 5]);
  const other = P.create({ rng: seeded(1) });
  other.add(1, 100, 400); other.add(2, 130, 400);
  run(other, 2);
  assert.equal(other.drain().filter((e) => e.type === 'merge').length, 0);
});

test('两个最高级碰到一起会消失', () => {
  const w = P.create({ rng: seeded(2) });
  w.add(12, 120, 300); w.add(12, 215, 300);
  run(w, 2);
  const events = w.drain();
  assert.equal(events.filter((e) => e.type === 'vanish').length, 1);
  assert.equal(w.bodies.length, 0);
});

test('随机放几百只：不出界、没有 NaN、能合成到很高的级别', () => {
  for (const seed of [1, 2, 3]) {
    const rng = seeded(seed), w = P.create({ rng }), pool = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
    let merges = 0, top = 0, drops = 0;
    for (let t = 0; t < 240 && !w.over; t += 1 / 60) {
      if (Math.floor(t) > drops) { drops++; const lvl = pool[Math.floor(rng() * pool.length)], r = w.radius(lvl); w.add(lvl, r + rng() * (w.width - 2 * r), w.holdY); }
      w.step(1 / 60);
      for (const e of w.drain()) if (e.type === 'merge') { merges++; top = Math.max(top, e.level); }
      for (const b of w.bodies) {
        assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'NaN');
        assert.ok(b.x >= b.r - 1 && b.x <= w.width - b.r + 1 && b.y <= w.height - b.r + 1, 'out of bounds ' + JSON.stringify([b.x, b.y, b.r]));
      }
    }
    assert.ok(merges > 20 && top >= 5, 'seed ' + seed + ' merges ' + merges + ' top ' + top);
  }
});

test('堆过虚线并停住足够久才算输；刚放下的不算', () => {
  const w = P.create({ rng: seeded(3) });
  const body = w.add(12, 170, 20); /* 一只最大的从线上方放下，很快落到底 */
  run(w, .3);
  assert.equal(w.over, false);
  assert.ok(body.y > w.lineY);
  /* 几只不同级别的圆叠到虚线以上：用几乎不动的高处圆模拟 */
  const high = P.create({ rng: seeded(4), gravity: 0, graceSeconds: .1, overSeconds: 1 });
  high.add(4, 170, 40);
  run(high, .5);
  assert.equal(high.over, false);
  assert.ok(high.danger > 0);
  run(high, 1);
  assert.equal(high.over, true);
  assert.ok(high.drain().some((e) => e.type === 'over'));
});

test('合成出来的动物从小慢慢长大，不会把邻居弹飞', () => {
  const w = P.create({ rng: seeded(5) });
  w.add(4, 150, 440); w.add(4, 204, 440);
  w.add(0, 177, 410); /* 一只小球正好卡在两只中间的缝上，合成出来的大圆会压到它 */
  w.step(1 / 60);
  const born = w.bodies.find((b) => b.lvl === 5);
  assert.ok(born, '应该合成出第 5 级');
  assert.ok(born.r < born.rt, '刚合成出来时比最终的小');
  const small = w.bodies.find((b) => b.lvl === 0);
  let fastest = 0;
  for (let t = 0; t < 1.5; t += 1 / 60) { w.step(1 / 60); fastest = Math.max(fastest, Math.hypot(small.vx, small.vy)); }
  assert.ok(Math.abs(born.r - born.rt) < 1e-6, '最后长到该有的大小');
  assert.ok(fastest < 600, '小球被挤开的速度要正常，实际 ' + Math.round(fastest));
});

test('随机玩很多局：没有动物被弹到容器上方很远的地方', () => {
  const pool = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
  for (let seed = 1; seed <= 12; seed++) {
    const rng = seeded(seed), w = P.create({ rng });
    let drops = 0, highest = 0;
    for (let t = 0; t < 240 && !w.over; t += 1 / 60) {
      if (Math.floor(t / .8) > drops) { drops++; const lvl = pool[Math.floor(rng() * pool.length)], r = w.radius(lvl); w.add(lvl, r + rng() * (w.width - 2 * r), w.holdY); }
      w.step(1 / 60); w.drain();
      for (const b of w.bodies) if (b.age > .4) highest = Math.min(highest, b.y);
    }
    assert.ok(highest > -20, 'seed ' + seed + ' 有动物飞到了 y=' + Math.round(highest));
  }
});
