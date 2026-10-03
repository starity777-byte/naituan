const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const challenge = require('../cq-challenge.js');

function replay(board, route, requireNoLoops = false) {
  const lanes = board.variants[0].lanes.map(row => row.slice());
  const kinds = lanes.flat();
  for (const kind of board.kinds) assert.equal(kinds.filter(k => k === kind).length % board.cap, 0);
  assert.ok(lanes.every((row, i) => row.length <= board.caps[i]));
  const seen = new Set([JSON.stringify(lanes)]);
  for (const [a, b] of route) {
    assert.notEqual(a, b);
    assert.ok(lanes[a].length && lanes[b].length < board.caps[b]);
    assert.ok(!lanes[b].length || lanes[a][0] === lanes[b][0]);
    lanes[b].unshift(lanes[a].shift());
    if (lanes[b].length === board.cap && lanes[b].every(k => k === lanes[b][0])) lanes[b] = [];
    if (requireNoLoops) assert.ok(!seen.has(JSON.stringify(lanes)), 'Reference path has an artificial loop');
    seen.add(JSON.stringify(lanes));
  }
  assert.ok(lanes.every(row => !row.length), 'Certified route must clear the board');
  assert.equal(board.variants[0].par, route.length);
}

test('all seventy-five static layouts remain solvable; later boards carry more distinct cats', () => {
  const root = path.resolve(__dirname, '..'), box = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'levels.js'), 'utf8'), box);
  const levels = JSON.parse(JSON.stringify(box.window.NT_LEVELS));
  const routes = JSON.parse(fs.readFileSync(path.join(root, 'tools/challenge-solutions.json')));
  assert.equal(levels.length, 40);
  for (let i = 15; i < levels.length; i++) {
    const level = levels[i];
    assert.ok(level.caps.length <= 14);
    assert.ok(level.kinds.every(k => k >= 0 && k <= 18));
    if (i >= 29) assert.equal(level.kinds.length, 12);
    for (let v = 0; v < 3; v++) {
      assert.equal(level.variants[v].limit, null);
      replay({ ...level, variants: [level.variants[v]] }, routes[i - 15][v], true);
    }
  }
  assert.ok(levels[39].variants.every(v => v.par >= 50));
});

test('fresh low and high rounds are solvable, loop-free, reproducible, and within a small runtime budget', () => {
  const durations = [];
  for (const round of [1, 4, 15, 50, 1000]) {
    for (const seed of ['milk', 'cream', 777]) {
      const start = performance.now(), board = challenge.create(round, seed);
      durations.push(performance.now() - start);
      assert.ok(board.caps.length <= 14);
      assert.ok(board.kinds.length <= 12);
      assert.equal(board.revealDepth, 1);
      replay(board, board.route, true);
      assert.ok(challenge.rules(round, 'timed', board.variants[0].par).stepLimit >= board.route.length);
    }
  }
  assert.deepEqual(challenge.create(12, 'fixed'), challenge.create(12, 'fixed'));
  assert.ok(durations.reduce((sum, value) => sum + value, 0) / durations.length < 200);
  assert.ok(Math.max(...durations) < 750);
});

test('different seeds change queue structure, beyond renaming cat colours', () => {
  function structure(board) {
    const renamed = new Map();
    return board.variants[0].lanes.map(row => row.map(kind => {
      if (!renamed.has(kind)) renamed.set(kind, renamed.size);
      return renamed.get(kind);
    }));
  }
  const boards = ['A', 'B', 'C', 'D'].map(seed => challenge.create(25, seed));
  const shapes = new Set(boards.map(board => JSON.stringify(structure(board))));
  assert.equal(shapes.size, boards.length);
});

test('timed and endless rules become tighter, reward growth continues, and the certified route fits', () => {
  let previous = challenge.rules(1, 'timed', 60);
  for (let round = 2; round <= 100; round++) {
    const next = challenge.rules(round, 'timed', 60);
    assert.ok(next.stepLimit <= previous.stepLimit && next.stepLimit >= 60);
    assert.ok(next.timeLimit <= previous.timeLimit && next.timeLimit >= 90);
    assert.ok(next.reward > previous.reward);
    assert.ok(next.star3 <= next.star2 && next.star2 <= next.stepLimit);
    assert.equal(challenge.rules(round, 'endless', 60).timeLimit, null);
    previous = next;
  }
  assert.equal(challenge.rules(1, 'timed', 60).timeLimit, 180);
  assert.ok(challenge.rules(2, 'timed', 20).reward > challenge.rules(1, 'timed', 120).reward);
  assert.equal(challenge.rules(100, 'timed', 60).stepLimit, 68);
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../cq-challenge.js'), 'utf8'), browser);
  assert.equal(typeof browser.window.NTCQChallenge.create, 'function');
  assert.equal(typeof browser.window.NTCQChallenge.rules, 'function');
});
