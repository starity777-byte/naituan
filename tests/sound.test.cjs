const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../sound.js'), 'utf8');

function fixture(supported = true) {
  let time = 1000;
  const calls = { contexts: 0, starts: 0, stops: 0, resumes: 0 }, events = {}, gains = [];
  const document = { hidden: false, addEventListener: (name, fn) => { events[name] = fn; } };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  class AudioContext {
    constructor() { calls.contexts++; this.currentTime = 1; this.state = 'suspended'; this.destination = {}; }
    resume() { calls.resumes++; this.state = 'running'; return Promise.resolve(); }
    createGain() { const node = { gain: param(), connect() {}, disconnect() {} }; gains.push(node); return node; }
    createOscillator() {
      return { frequency: param(), connect() {}, disconnect() {}, start() { calls.starts++; }, stop(at) { if (at == null) calls.stops++; } };
    }
  }
  const window = supported ? { AudioContext } : {};
  vm.runInNewContext(source, { window, document, Date: { now: () => time }, Set });
  return { api: window.NaituanSound, calls, gains, document, events, advance: ms => { time += ms; } };
}

test('loading is silent; a user gesture unlocks audio and all cues produce short voices', () => {
  const f = fixture();
  assert.equal(f.calls.contexts, 0);
  assert.equal(f.api.unlock(false), true);
  assert.equal(f.calls.starts, 0);
  for (const name of ['tap', 'head', 'ear', 'nose', 'paw', 'belly', 'tail', 'lift', 'land', 'feed', 'sleep', 'wake', 'sniff', 'watch', 'save', 'reward', 'rub', 'chin', 'knead',
    'boxgo', 'boxland', 'chime', 'chop', 'boxmiss', 'fanfare', 'coin', 'pick', 'nope',
    'mew', 'mrrp', 'boop', 'squeak', 'chirp', 'twinkle', 'pat', 'trill', 'giggle', 'whine', 'spark']) {
    const before = f.calls.starts;
    assert.equal(f.api.play(name, false), true, name);
    assert.ok(f.calls.starts > before, name);
  }
  assert.equal(f.calls.contexts, 1);
  assert.equal(f.calls.resumes, 1);
});

test('muted and background interactions are silent, and stop interrupts active voices', () => {
  const f = fixture();
  assert.equal(f.api.unlock(true), false);
  assert.equal(f.api.play('ear', true), false);
  assert.equal(f.calls.contexts, 0);
  f.api.play('rub', false);
  f.api.stop();
  assert.equal(f.calls.stops, 1);
  f.advance(1000); f.api.play('rub', false);
  f.document.hidden = true; f.events.visibilitychange();
  assert.equal(f.calls.stops, 2);
  assert.equal(f.api.play('ear', false), false);
  assert.equal(f.calls.starts, 2);
});

test('rapid repeated touches are bounded and lack of audio support keeps the app usable', () => {
  const f = fixture();
  assert.equal(f.api.play('ear', false), true);
  assert.equal(f.api.play('ear', false), false);
  f.advance(150);
  assert.equal(f.api.play('ear', false), true);
  const noAudio = fixture(false);
  assert.equal(noAudio.api.play('ear', false), false);
  noAudio.api.stop();
});

test('landing plays two duang hits, and pitch shift and delay reach the voices', () => {
  const freqs = [], starts = [];
  let time = 1000;
  const param = (log) => ({ value: 0, setValueAtTime(v, at) { if (log) log.push([v, at]); }, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  class AudioContext {
    constructor() { this.currentTime = 1; this.state = 'running'; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() { const f = param(freqs); return { frequency: f, connect() {}, disconnect() {}, start(at) { starts.push(at); }, stop() {} }; }
  }
  const window = { AudioContext };
  vm.runInNewContext(source, { window, document: { hidden: false, addEventListener() {} }, Date: { now: () => time }, Set });
  const api = window.NaituanSound;
  assert.equal(api.play('land', false, 0, .1), true);
  // Noise-free engine: only oscillators, four voices (thump + boing, twice), the rebound .27s after the first hit.
  assert.equal(starts.length, 4);
  assert.ok(Math.abs(starts[0] - (1 + .015 + .1)) < 1e-9);
  assert.ok(Math.abs(starts[2] - starts[0] - .27) < 1e-9);
  // The boing wobbles: many frequency steps, not a single ramp.
  assert.ok(freqs.length > 40);
  time += 200; freqs.length = 0;
  api.play('chime', false, 12);
  assert.equal(freqs[0][0], 880 * 2);
  // Noise cues degrade gracefully when buffer sources are missing (tonal voices still play).
  time += 200; starts.length = 0;
  assert.equal(api.play('boxland', false), true);
  assert.equal(starts.length, 4);
});

test('every touch spot cycles through several voices and never repeats the previous one back to back', () => {
  const played = [];
  let time = 1000;
  const param = () => ({ value: 0, setValueAtTime(v) { played.push(v); }, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  class AudioContext {
    constructor() { this.currentTime = 1; this.state = 'running'; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createOscillator() { return { frequency: param(), connect() {}, disconnect() {}, start() {}, stop() {} }; }
  }
  const window = { AudioContext };
  vm.runInNewContext(source, { window, document: { hidden: false, addEventListener() {} }, Date: { now: () => time }, Set, Math });
  const first = kind => { played.length = 0; time += 200; assert.equal(window.NaituanSound.play(kind, false), true); return played[0]; };
  for (const kind of ['head', 'ear', 'nose', 'paw', 'belly', 'tail']) {
    const seen = new Set(); let previous = null;
    for (let i = 0; i < 40; i++) { const f = first(kind); assert.notEqual(f, previous, kind + ' repeated the same voice'); previous = f; seen.add(f); }
    assert.ok(seen.size >= 2, kind + ' should have more than one voice');
  }
});

test('master volume lifts the soft cues, follows the slider, and 0 is silent', () => {
  const f = fixture();
  const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9, value + ' vs ' + expected);
  f.api.setVolume(40); // set before the first gesture: used when audio starts
  f.api.unlock(false);
  near(f.gains[0].gain.value, .4 * 2.6);
  f.api.setVolume(100); near(f.gains[0].gain.value, 2.6);
  f.api.setVolume(20); near(f.gains[0].gain.value, .52);
  f.api.setVolume(500); near(f.gains[0].gain.value, 2.6);
  f.api.setVolume(-5); near(f.gains[0].gain.value, 0);
  assert.equal(f.api.play('ear', false), false);
  f.api.setVolume('nope'); near(f.gains[0].gain.value, .8 * 2.6);
  assert.equal(f.api.play('ear', false), true);
});

test('the default master level is far louder than the old fixed 0.5', () => {
  const f = fixture();
  f.api.unlock(false);
  assert.ok(f.gains[0].gain.value >= 2, 'default gain ' + f.gains[0].gain.value);
});
