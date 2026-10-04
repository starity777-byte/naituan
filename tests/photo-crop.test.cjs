const { test } = require('node:test');
const assert = require('node:assert/strict');
const crop = require('../photo-crop.js');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, a + ' ≠ ' + b);
const inside = (r, dw, dh) => { assert.ok(r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= dw + 1e-6 && r.y + r.h <= dh + 1e-6, JSON.stringify(r)); };

test('默认第一个形状是方形，并包含原图 / 自由', () => {
  assert.equal(crop.shapes[0].id, 'square');
  assert.equal(crop.shapes[0].ratio, 1);
  assert.deepEqual(crop.shapes.map((s) => s.ratio).filter((r) => r <= 0), [0, -1]);
});

test('fit：横图里的方形取满短边，竖图里的 3:4 取满宽，并留出一圈边', () => {
  const sq = crop.fit(1, 400, 200, 200, 100, 1);
  near(sq.w, 200); near(sq.h, 200); near(sq.x, 100); near(sq.y, 0);
  const tall = crop.fit(3 / 4, 300, 600, 150, 300, .92);
  near(tall.w, 276); near(tall.h, 368); inside(tall, 300, 600);
  const edge = crop.fit(1, 400, 200, 0, 0, .92);
  near(edge.x, 0); near(edge.y, 0); inside(edge, 400, 200);
});

test('move：不会拖出图片', () => {
  const r = { x: 50, y: 20, w: 100, h: 100 };
  assert.deepEqual(crop.move(r, -500, 500, 400, 200), { x: 0, y: 100, w: 100, h: 100 });
  assert.deepEqual(crop.move(r, 1000, -1000, 400, 200), { x: 300, y: 0, w: 100, h: 100 });
});

test('resize：锁定比例时四个角都保持比例、对角不动、不出界', () => {
  const rect = { x: 100, y: 50, w: 100, h: 100 };
  for (const ratio of [1, 4 / 3, 3 / 4, 16 / 9]) {
    const start = crop.fit(ratio, 400, 300, 200, 150, .5);
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      for (const [px, py] of [[0, 0], [400, 300], [200, 150], [-50, 500], [123, 77]]) {
        const out = crop.resize(start, corner, px, py, ratio, 400, 300, 40);
        near(out.w / out.h, ratio, 1e-6); inside(out, 400, 300);
        assert.ok(Math.min(out.w, out.h) >= 40 - 1e-6 || out.w >= 40 * Math.max(1, ratio) - 1e-6, 'too small ' + JSON.stringify(out));
        const ax = corner.includes('l') ? start.x + start.w : start.x, ay = corner.includes('t') ? start.y + start.h : start.y;
        const ox = corner.includes('l') ? out.x + out.w : out.x, oy = corner.includes('t') ? out.y + out.h : out.y;
        near(ox, ax); near(oy, ay);
      }
    }
  }
  const grown = crop.resize(rect, 'br', 220, 170, 1, 400, 300, 40);
  near(grown.x, 100); near(grown.y, 50); near(grown.w, 120);
});

test('resize：自由模式两个方向独立，且受最小尺寸和边界限制', () => {
  const rect = { x: 100, y: 100, w: 100, h: 100 };
  const out = crop.resize(rect, 'br', 260, 130, 0, 400, 300, 40);
  near(out.w, 160); near(out.h, 40); near(out.x, 100); near(out.y, 100);
  const flipped = crop.resize(rect, 'tl', 500, 500, 0, 400, 300, 40);
  near(flipped.w, 40); near(flipped.h, 40); near(flipped.x + flipped.w, 200); near(flipped.y + flipped.h, 200);
  const clipped = crop.resize(rect, 'br', 900, 900, 0, 400, 300, 40);
  near(clipped.x + clipped.w, 400); near(clipped.y + clipped.h, 300);
});
