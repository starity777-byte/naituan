const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../sound.js'), 'utf8');

function fixture(supported = true) {
  let time = 1000;
  const calls = { contexts: 0, starts: 0, stops: 0, resumes: 0 }, events = {};
  const document = { hidden: false, addEventListener: (name, fn) => { events[name] = fn; } };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  class AudioContext {
    constructor() { calls.contexts++; this.currentTime = 1; this.state = 'suspended'; this.destination = {}; }
    resume() { calls.resumes++; this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      return { frequency: param(), connect() {}, disconnect() {}, start() { calls.starts++; }, stop(at) { if (at == null) calls.stops++; } };
    }
  }
  const window = supported ? { AudioContext } : {};
  vm.runInNewContext(source, { window, document, Date: { now: () => time }, Set });
  return { api: window.NaituanSound, calls, document, events, advance: ms => { time += ms; } };
}

test('loading is silent; a user gesture unlocks audio and all cues produce short voices', () => {
  const f = fixture();
  assert.equal(f.calls.contexts, 0);
  assert.equal(f.api.unlock(false), true);
  assert.equal(f.calls.starts, 0);
  for (const name of ['tap', 'head', 'ear', 'nose', 'paw', 'belly', 'tail', 'lift', 'land', 'feed', 'sleep', 'wake', 'sniff', 'watch', 'save', 'reward', 'rub', 'chin', 'knead']) {
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
