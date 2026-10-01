const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../bgm.js'), 'utf8');

function fixture(supported = true) {
  const calls = { contexts: 0, starts: 0, stops: 0, resumes: 0, suspends: 0 }, events = {}, intervals = {}, timeouts = [];
  const document = { hidden: false, addEventListener: (name, fn) => { events[name] = fn; } };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = extra => Object.assign({ connect() {}, disconnect() {} }, extra);
  const masters = [];
  class AudioContext {
    constructor() { calls.contexts++; this.currentTime = 1; this.state = 'suspended'; this.destination = {}; }
    resume() { calls.resumes++; this.state = 'running'; return Promise.resolve(); }
    suspend() { calls.suspends++; this.state = 'suspended'; return Promise.resolve(); }
    createGain() { const n = node({ gain: param() }); masters.push(n); return n; }
    createDelay() { return node({ delayTime: param() }); }
    createBiquadFilter() { return node({ frequency: param(), Q: param() }); }
    createOscillator() { return node({ frequency: param(), detune: param(), start() { calls.starts++; }, stop() { calls.stops++; } }); }
  }
  const window = supported ? { AudioContext } : {};
  window.document = document;
  const setInterval = (fn, ms) => { intervals[ms] = fn; return ms; };
  const clearInterval = ms => { delete intervals[ms]; };
  const setTimeout = fn => { timeouts.push(fn); return timeouts.length; };
  vm.runInNewContext(source, { window, document, Math, Number, isFinite, Set, setInterval, clearInterval, setTimeout, clearTimeout() {} });
  return { api: window.NaituanBGM, calls, document, events, intervals, timeouts, masters, poll: () => intervals[500](), flush: () => timeouts.splice(0).forEach(fn => fn()) };
}

test('loading is silent: nothing starts until a real gesture unlocks audio', () => {
  const f = fixture();
  f.api.configure({ enabled: true, volume: 60 });
  f.poll();
  assert.equal(f.calls.contexts, 0);
  assert.equal(f.api.status().playing, false);
  assert.equal(f.api.status().waitingForTap, true);
});

test('a gesture starts one context and the pad plus music-box notes begin', () => {
  const f = fixture();
  assert.equal(f.api.unlock(), true);
  assert.equal(f.calls.contexts, 1);
  assert.ok(f.calls.starts >= 12, 'first chord is 6 notes x 2 oscillators, got ' + f.calls.starts);
  assert.equal(f.api.status().playing, true);
  f.api.unlock();
  assert.equal(f.calls.contexts, 1);
});

test('turned off, silent or unsupported audio never creates a context', () => {
  let f = fixture(); f.api.configure({ enabled: false }); assert.equal(f.api.unlock(), false); assert.equal(f.calls.contexts, 0);
  f = fixture(); f.api.configure({ enabled: true, volume: 0 }); assert.equal(f.api.unlock(), false); assert.equal(f.calls.contexts, 0);
  f = fixture(false); assert.equal(f.api.unlock(), false); assert.equal(f.api.status().playing, false);
});

test('music steps aside while the gate is closed and returns when it opens', () => {
  const f = fixture();
  let open = true;
  f.api.setGate(() => open);
  f.api.unlock();
  assert.equal(f.api.status().playing, true);
  open = false; f.poll();
  assert.equal(f.api.status().playing, false);
  f.flush();
  assert.equal(f.calls.suspends, 1);
  open = true; f.poll();
  assert.equal(f.api.status().playing, true);
});

test('switching off fades out and silences; hidden pages stop at once', () => {
  const f = fixture();
  f.api.unlock();
  f.api.configure({ enabled: false });
  assert.equal(f.api.status().playing, false);
  f.flush();
  assert.ok(f.calls.stops > 0);
  f.api.configure({ enabled: true });
  assert.equal(f.api.status().playing, true);
  f.document.hidden = true; f.events.visibilitychange();
  assert.equal(f.api.status().playing, false);
  f.document.hidden = false; f.api.unlock();
  assert.equal(f.api.status().playing, true);
});
