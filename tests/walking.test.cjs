const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const window = {}, frames = new Map();
  let nextId = 0, time = 0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../walking.js'), 'utf8'), {
    window,
    requestAnimationFrame(fn) { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame(id) { frames.delete(id); }
  });
  return {
    api: window.NaituanWalk,
    frame(ms = 16) {
      time += ms;
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(fn => fn(time));
    },
    queued: () => frames.size
  };
}

function room(floorY = () => 0.63, obstacles = []) {
  return {
    aspect: 0.96, floorY, obstacles,
    constrain(p) {
      const x = Math.max(0.05, Math.min(0.95, p.x));
      return { x, y: Math.max(floorY(x), Math.min(0.985, p.y)) };
    }
  };
}

function fixture(options = room(), start = { x: 0.12, y: 0.72 }) {
  const timer = load(), moves = [], stops = [];
  let position = { ...start }, enabled = true;
  const walker = timer.api.create({
    enabled: () => enabled, position: () => ({ ...position }),
    aspect: () => options.aspect, depthScale: () => 0.8,
    route: (from, target) => timer.api.planRoute(from, target, options),
    place(p) { position = options.constrain(p); return position; },
    moved(p) { moves.push({ ...p }); },
    stopped(p, reason) { stops.push({ point: { ...p }, reason }); }
  });
  return {
    ...timer, walker, moves, stops, position: () => position,
    enable(value) { enabled = value; },
    finish() {
      for (let n = 0; n < 1500 && walker.active(); n++) timer.frame();
      assert.equal(walker.active(), false, 'walk should reach its destination');
    }
  };
}

function close(a, b) { assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`); }
function point(p, expected) { close(p.x, expected.x); close(p.y, expected.y); }
function distance(a, b, aspect = 0.96) { return Math.hypot(a.x - b.x, (a.y - b.y) * aspect); }

// Check rectangle intersection analytically, independently of the route planner's sampling.
function entersRectangle(a, b, r) {
  let lo = 0, hi = 1;
  for (const [axis, low, high] of [['x', r.left, r.right], ['y', r.top, r.bottom]]) {
    const delta = b[axis] - a[axis];
    if (!delta) { if (a[axis] <= low || a[axis] >= high) return false; }
    else {
      const ts = [(low - a[axis]) / delta, (high - a[axis]) / delta].sort((x, y) => x - y);
      lo = Math.max(lo, ts[0]); hi = Math.min(hi, ts[1]);
    }
  }
  return lo < hi && hi > 0 && lo < 1;
}

test('route stays below a bent wall and goes around furniture feet; blocked targets are rejected', () => {
  const { api } = load();
  const floorY = x => 0.62 + 0.16 * Math.max(0, 1 - Math.abs(x - 0.5) / 0.25);
  const block = { left: 0.4, right: 0.61, top: 0.77, bottom: 0.88 };
  const options = room(floorY, [block]), from = { x: 0.12, y: 0.72 }, target = { x: 0.88, y: 0.72 };
  const route = api.planRoute(from, target, options);
  assert.ok(route && route.length > 1, 'a direct line would cross the wall and furniture');
  point(route.at(-1), target);
  let previous = from;
  for (const next of route) {
    assert.equal(entersRectangle(previous, next, block), false, 'segment must not enter furniture feet');
    const checkpoints = [previous, next];
    // For a piecewise linear wall, endpoints and wall corners cover the entire segment.
    for (const x of [0.25, 0.5, 0.75]) {
      const t = (x - previous.x) / (next.x - previous.x);
      if (t > 0 && t < 1) checkpoints.push({ x, y: previous.y + (next.y - previous.y) * t });
    }
    for (const p of checkpoints) {
      assert.ok(p.y >= floorY(p.x) - 1e-9, 'segment must not cross the wall');
      assert.ok(p.x >= 0.05 && p.x <= 0.95 && p.y <= 0.985);
    }
    previous = next;
  }
  assert.equal(api.planRoute(from, { x: 0.5, y: 0.83 }, options), null);
});

test('animation advances continuously around an obstacle and arrives exactly once', () => {
  const block = { left: 0.4, right: 0.6, top: 0.69, bottom: 0.84 };
  const f = fixture(room(undefined, [block])), target = { x: 0.88, y: 0.72 }, arrivals = [];
  assert.equal(f.walker.go(target, p => arrivals.push({ ...p })), true);
  point(f.position(), { x: 0.12, y: 0.72 });
  f.finish();
  assert.ok(f.moves.length > 30);
  let previous = { x: 0.12, y: 0.72 };
  for (const p of f.moves) {
    assert.ok(distance(previous, p) <= 0.003, 'one frame cannot jump across the room');
    assert.equal(entersRectangle(previous, p, block), false);
    previous = p;
  }
  point(f.position(), target); assert.equal(arrivals.length, 1); point(arrivals[0], target);
  assert.equal(f.stops.at(-1).reason, 'arrived'); assert.equal(f.queued(), 0);
});

test('retargeting and cancellation discard callbacks for old destinations', () => {
  const f = fixture(), arrivals = [];
  f.walker.go({ x: 0.9, y: 0.72 }, () => arrivals.push('old'));
  for (let n = 0; n < 20; n++) f.frame();
  const halfway = { ...f.position() };
  assert.ok(halfway.x > 0.12);
  f.walker.go({ x: 0.24, y: 0.86 }, () => arrivals.push('new'));
  point(f.position(), halfway); assert.equal(f.stops[0].reason, 'retargeted');
  f.finish(); assert.deepEqual(arrivals, ['new']);
  f.walker.go({ x: 0.8, y: 0.86 }, () => arrivals.push('cancelled'));
  f.frame(); f.frame(); f.walker.stop();
  const stopped = { ...f.position() };
  f.frame(10000);
  point(f.position(), stopped); assert.deepEqual(arrivals, ['new']);
  assert.equal(f.walker.active(), false); assert.equal(f.queued(), 0);
});

test('disabled walking stops without moving or resuming an old destination', () => {
  const f = fixture(); let arrivals = 0;
  f.walker.go({ x: 0.9, y: 0.72 }, () => arrivals++);
  f.frame(); f.frame();
  const stopped = { ...f.position() };
  f.enable(false); f.frame(3600000);
  point(f.position(), stopped); assert.equal(f.walker.active(), false);
  f.enable(true); f.frame();
  point(f.position(), stopped); assert.equal(arrivals, 0); assert.equal(f.queued(), 0);
});

test('a background-sized frame gap cannot teleport the cat to its destination', () => {
  const f = fixture(); let arrivals = 0;
  f.walker.go({ x: 0.9, y: 0.72 }, () => arrivals++);
  f.frame(); f.frame();
  const before = { ...f.position() };
  f.frame(3600000);
  assert.ok(distance(before, f.position()) > 0);
  assert.ok(distance(before, f.position()) <= 0.0065, 'elapsed background time must be capped');
  assert.equal(f.walker.active(), true); assert.equal(arrivals, 0);
  f.walker.stop();
});
