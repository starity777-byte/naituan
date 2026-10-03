const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'levels.js'), 'utf8'), box);
const levels = JSON.parse(JSON.stringify(box.window.NT_LEVELS));
const challenge = require('../cq-challenge.js');

test('forty levels, original indices and progressive reveal ranges', () => {
  assert.equal(levels.length, 40);
  assert.equal(levels[0].name, '小试身手');
  assert.equal(levels[14].name, '挤挤挨挨');
  for (let i = 0; i < 40; i++) {
    const level = levels[i];
    assert.equal(level.variants.length, 3);
    if (i >= 15) {
      assert.equal(level.revealDepth, i < 29 ? 2 : 1);
      assert.ok(level.caps.length <= 14);
      for (const v of level.variants) assert.equal(v.limit, null);
    } else assert.equal(level.revealDepth, undefined);
  }
});

function gameHarness(fixtures = levels) {
  class Element {
    constructor() {
      this.children = []; this.handlers = {}; this.style = { setProperty() {} };
      this.clientWidth = 366; this.clientHeight = 550; this.innerHTML = '';
      const classes = new Set();
      this.classList = { add: (...values) => values.forEach(v => classes.add(v)),
        remove: (...values) => values.forEach(v => classes.delete(v)),
        toggle: (v, on) => (on ?? !classes.has(v)) ? classes.add(v) : classes.delete(v),
        contains: v => classes.has(v) };
    }
    setAttribute(key, value) { this[key] = value; }
    getAttribute(key) { return this[key]; }
    addEventListener(event, action) { this.handlers[event] = action; }
    appendChild(child) { this.children.push(child); child.parentNode = this; }
    removeChild(child) { this.children = this.children.filter(value => value !== child); child.parentNode = null; }
    insertBefore(child) { this.children.unshift(child); child.parentNode = this; }
    get firstChild() { return this.children[0]; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 366, height: 550 }; }
    querySelector(selector) { return element(selector.replace('#', '')); }
  }
  const nodes = new Map();
  function element(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); }
  const state = { fish: 50, mood: 70, energy: 80, hunger: 72, mute: true,
    cq: { ver: 2, cleared: Array(40).fill(3), cakes: [], seen: [] } };
  const NT = { S: () => state, save: () => true, isBusy: () => false, miniGain: () => 1,
    addFish: n => { state.fish += n; }, clamp: n => Math.max(0, Math.min(100, n)),
    setBusyUI() {}, setChrome() {}, hideCat() {}, setPose() {}, say() {}, render() {},
    ext: {}, stage: new Element() };
  const window = { NT, NT_LEVELS: fixtures, NTCQChallenge: challenge, addEventListener() {}, scrollTo() {} };
  const math = Object.create(Math); math.random = () => 0;
  const jobs = new Map(); let time = 100000, serial = 0;
  function schedule(fn, delay, interval = 0) { const id = ++serial; jobs.set(id, { fn, at: time + delay, interval }); return id; }
  function advance(milliseconds) {
    const until = time + milliseconds;
    while (true) {
      const next = [...jobs.entries()].filter(([, job]) => job.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, job] = next; time = job.at;
      if (job.interval) job.at += job.interval; else jobs.delete(id);
      job.fn();
    }
    time = until;
  }
  const document = { hidden: false, getElementById: element, createElement: () => new Element(), addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'queue.js'), 'utf8'), {
    window, document, Date: class extends Date { static now() { return time; } },
    Image: class {}, navigator: {}, Math: math, setTimeout: (fn, delay) => schedule(fn, delay),
    clearTimeout: id => jobs.delete(id), setInterval: (fn, delay) => schedule(fn, delay, delay),
    clearInterval: id => jobs.delete(id), requestAnimationFrame: () => 1,
  });
  element('btnCake').handlers.click();
  return { state, window, element, document, advance, challenge: mode => {
    element(mode === 'timed' ? 'cqTimed' : 'cqEndless').handlers.click(); return window.NTQ.get();
  }, open: number => {
    const button = element('cqLvs').children.find(el => el.type === 'button' && el.innerHTML.includes(`<b>${number}</b>`));
    button.handlers.click(); return window.NTQ.get();
  } };
}

function movable(game) {
  for (let a = 0; a < game.lanes.length; a++) for (let b = 0; b < game.lanes.length; b++) {
    const source = game.lanes[a], target = game.lanes[b];
    if (a === b || source.length < 2 || target.length >= game.caps[b]) continue;
    if (target.length && target[0].kind !== source[0].kind) continue;
    if (target.length === game.S - 1 && target.every(c => c.kind === source[0].kind)) continue;
    return [a, b];
  }
  throw new Error('No reversible revealing move in fixture');
}

function move(harness, a, b) {
  const field = harness.element('cqField');
  const lane = i => field.children.find(el => el['data-i'] === i);
  lane(a).handlers.pointerdown({ preventDefault() {} });
  lane(b).handlers.pointerdown({ preventDefault() {} });
}

test('reveal survives free undo and later exploration stays counted', () => {
  const h = gameHarness(), game = h.open(30), [a, b] = movable(game);
  const covered = game.lanes[a][1], kind = covered.kind;
  assert.equal(covered.revealed, false);
  assert.ok(!covered.inn.innerHTML.includes('assets/cats/'));
  move(h, a, b);
  assert.equal(covered.revealed, true);
  assert.equal(covered.kind, kind);
  h.element('cqUndo').handlers.click();
  assert.equal(game.steps, 1);
  assert.equal(h.state.fish, 50);
  assert.equal(game.lanes[a][1], covered);
  assert.equal(covered.revealed, true);
});

test('classic levels keep paid undo and their original step counting', () => {
  const h = gameHarness(), game = h.open(1), [a, b] = movable(game);
  move(h, a, b);
  h.element('cqUndo').handlers.click();
  assert.equal(h.state.fish, 48);
  assert.equal(game.steps, 1);
});

test('two groups can clear in the same instant, with both rewards credited before animation', () => {
  const fixture = [{ name: '连续消除', cap: 3, caps: [3, 3, 3, 3],
    variants: [{ par: 2, exact: true, lanes: [[0], [0, 0], [1, 1], [1]], limit: null }] }];
  const h = gameHarness(fixture), game = h.open(1);
  move(h, 0, 1);
  assert.equal(game.busy, false);
  assert.equal(game.lanes[1].length, 0);
  assert.equal(game.got.length, 1);
  move(h, 3, 2);
  assert.ok(game.lanes.every(lane => !lane.length));
  assert.equal(game.got.length, 2);
  assert.equal(h.state.cq.cakes.reduce((a, b) => a + b), 2);
  h.advance(520);
  assert.equal(h.element('cqWin').hidden, false);
});

test('fifty-five steps against reference thirty-six no longer receives three stars', () => {
  const fixture = JSON.parse(JSON.stringify(levels));
  fixture[39] = { name: '满星门槛', cap: 3, caps: [3, 3], revealDepth: 1,
    variants: [{ par: 36, exact: false, limit: null, lanes: [[0], [0, 0]] }] };
  const h = gameHarness(fixture), game = h.open(40); game.steps = 54;
  move(h, 0, 1); h.advance(520);
  assert.equal(h.element('cqStars').innerHTML.match(/class="on"/g).length, 1);
});

test('timed mode expires, hidden pages pause, endless mode does not run a clock', () => {
  const h = gameHarness(), game = h.challenge('timed');
  h.document.hidden = true; h.advance(20000);
  assert.equal(game.timeLeft, 180);
  h.document.hidden = false; h.advance(181000);
  assert.equal(game.over, true);
  assert.equal(h.element('cqLoseT').textContent, '打烊时间到啦');
  assert.equal(h.state.cq.challenges.timed.best, 0);
  const untimed = h.challenge('endless'); h.advance(181000);
  assert.equal(untimed.over, false);
  assert.equal(h.element('cqClock').hidden, true);
});

test('a complete challenge advances to a fresh board and saves its best round and enlarged collection', () => {
  const h = gameHarness(), game = h.challenge('endless');
  h.state.cq.cakes[0] = 3; h.state.cq.seen[0] = 1;
  for (const [a, b] of game.level.route) move(h, a, b);
  assert.ok(game.lanes.every(lane => !lane.length));
  h.advance(520);
  assert.equal(h.state.cq.challenges.endless.best, 1);
  assert.equal(h.state.cq.cakes[0], 3);
  assert.equal(h.state.cq.cakes.length, 16);
  assert.ok(h.state.fish > 50);
  h.element('cqWinNext').handlers.click.call(h.element('cqWinNext'));
  assert.equal(h.window.NTQ.get().challenge.round, 2);
  assert.notDeepEqual(h.window.NTQ.get().level.variants[0].lanes, game.level.variants[0].lanes);
  assert.equal(JSON.parse(JSON.stringify(h.state)).cq.challenges.endless.best, 1);
});
