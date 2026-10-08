const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeStyle() {
  const values = {};
  return new Proxy(values, {
    get(target, prop) {
      if (prop === 'setProperty') return (key, value) => { target[key] = String(value); };
      if (prop === 'getPropertyValue') return key => target[key] || '';
      if (prop === 'removeProperty') return key => { const value = target[key]; delete target[key]; return value || ''; };
      return target[prop];
    },
    set(target, prop, value) { target[prop] = String(value); return true; }
  });
}

function makeEl() {
  const listeners = {};
  const queried = new Map();
  return {
    hidden: false, disabled: false, textContent: '', innerHTML: '', value: '', className: '', id: '',
    draggable: false, open: false,
    clientWidth: 400, clientHeight: 640, clientLeft: 0, clientTop: 0,
    offsetWidth: 120, offsetHeight: 160, naturalWidth: 800, naturalHeight: 800,
    dataset: {}, attributes: {}, children: [], style: makeStyle(),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
    removeEventListener() {},
    dispatch(type, event) { (listeners[type] || []).forEach(fn => fn(event || {})); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    prepend(child) { this.children.unshift(child); return child; },
    insertAdjacentElement() { return null; },
    append() {},
    querySelector(sel) {
      if (!queried.has(sel)) queried.set(sel, makeEl());
      return queried.get(sel);
    },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 8, left: 8, width: 200, height: 220, right: 208, bottom: 228 }; },
    contains() { return false; },
    closest() { return null; },
    focus() {},
    showModal() { this.open = true; },
    close() { this.open = false; },
    getContext() { return new Proxy({}, { get: () => () => {} }); }
  };
}

function boot(stored) {
  const store = new Map();
  if (stored != null) store.set('naituan-house-v1', stored);
  const byId = new Map();
  function idEl(id) {
    const key = String(id);
    if (!byId.has(key)) byId.set(key, makeEl());
    return byId.get(key);
  }
  const document = {
    hidden: false, readyState: 'loading', documentElement: makeEl(),
    addEventListener() {}, removeEventListener() {},
    querySelector(sel) { return typeof sel === 'string' && sel.startsWith('#') ? idEl(sel.slice(1)) : null; },
    querySelectorAll() { return []; },
    getElementById: idEl,
    createElement: () => makeEl(),
    execCommand() { return false; }
  };
  class Image { set src(value) { this._src = value; } get src() { return this._src || ''; } }
  class ResizeObserver { observe() {} unobserve() {} disconnect() {} }
  class MutationObserver { constructor() {} observe() {} disconnect() {} }
  const audio = { play() { return false; }, stop() {}, unlock() { return false; }, setVolume() {} };
  const window = {
    document, Image, ResizeObserver, MutationObserver,
    NaituanSound: audio,
    NaituanBGM: { configure() {}, unlock() {}, status() { return {}; }, setGate() {}, stop() {} },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    scrollTo() {}, scrollBy() {}, devicePixelRatio: 1,
    location: { href: 'http://localhost/' }, navigator: { clipboard: null },
    CustomEvent: global.CustomEvent,
    setInterval() { return 0; }, clearInterval() {}, setTimeout() { return 0; }, clearTimeout() {},
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    getComputedStyle() { return { getPropertyValue() { return ''; }, objectFit: 'contain', objectPosition: '50% 50%' }; },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    }
  };
  window.window = window;
  const sandbox = {
    window, document, Image, ResizeObserver, MutationObserver,
    localStorage: window.localStorage, navigator: window.navigator, CustomEvent: global.CustomEvent,
    Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Error, TypeError, Map, Set, Promise, Symbol, Proxy,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, escape, unescape, atob, btoa,
    setInterval: window.setInterval, clearInterval: window.clearInterval,
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
    getComputedStyle: window.getComputedStyle, performance: { now: () => 0 }, console
  };
  vm.createContext(sandbox);
  for (const file of ['decor-catalog.js', 'room.js', 'hide-seek-levels.js', 'game.js', 'planner-state.js', 'life.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  }
  return { window, document, audio, store };
}

function encode(data) {
  return 'NT1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, data }))));
}
function decode(code) {
  return JSON.parse(decodeURIComponent(escape(atob(code.slice(4))))).data;
}
function click(document, id) { document.getElementById(id).dispatch('click'); }
function withoutTime(data) {
  const copy = JSON.parse(JSON.stringify(data));
  delete copy.t;
  return copy;
}

test('prototype own-keys and a prototype wallpaper id are ignored', () => {
  const save = {
    hunger: 40, mood: 40, energy: 40, sleeping: false, secs: 1, fish: 2, best: 1, bestBeat: 0,
    mute: false, vol: 80, bgm: true, bgmVol: 60, cq: null, t: Date.now(),
    own: { 'toString:x': 1, '__proto__:x': 1, 'constructor:x': 1, 'wall:dots': 1, 'rug:pink': 1, 'win:plain': 1 },
    eq: { wall: 'toString', rug: 'pink', win: 'plain', prop: [null, 1, 'missing'] },
    life: { version: 1, days: {}, gems: 0, todos: [], timer: { duration: 1500, remaining: 1500, endAt: 0 } }
  };
  const { window } = boot(JSON.stringify(save));
  const state = window.NT.S();
  assert.equal(state.eq.wall, 'dots');
  assert.equal(state.own['toString:x'], undefined);
  assert.equal(state.own['__proto__:x'], undefined);
  assert.equal(state.own['constructor:x'], undefined);
  assert.deepEqual(state.eq.prop, []);
  assert.equal(state.own['wall:dots'], 1);
});

test('https food photos and null planner rows are dropped', () => {
  const save = {
    hunger: 40, mood: 50, energy: 60, sleeping: false, secs: 4, fish: 3, best: 2, bestBeat: 0,
    mute: false, vol: 80, bgm: true, bgmVol: 60, cq: null, t: Date.now(),
    own: { 'wall:dots': 1, 'rug:pink': 1, 'win:plain': 1 },
    eq: { wall: 'dots', rug: 'pink', win: 'plain', prop: [] },
    life: {
      version: 1, gems: 2,
      days: { '2026-10-03': { food: { note: '南瓜粥', photo: 'https://example.com/p.png' }, words: 4, wordRewarded: true } },
      todos: [null, { id: 'keep', text: '喝水', done: false }, { id: 'bad', text: 'nope', done: 'no' }],
      timer: { duration: '1500', remaining: 1500, endAt: 0 },
      planner: {
        version: 1, minutes: 25, migrated: true,
        tasks: [null, { id: 'ok', title: '看书', date: '2026-10-03', done: false, createdAt: 10 }, { id: 'num', title: '日期是数字', date: 20261003, done: false }],
        sessions: [null],
        timer: { days: [null] }
      }
    }
  };
  const { window } = boot(JSON.stringify(save));
  const life = window.NT.S().life;
  const plain = value => JSON.parse(JSON.stringify(value));
  assert.equal(life.days['2026-10-03'].food.photo, '');
  assert.equal(life.days['2026-10-03'].food.note, '南瓜粥');
  assert.equal(life.timer.duration, 1500);
  assert.deepEqual(plain(life.todos), [{ id: 'keep', text: '喝水', done: false }]);
  assert.deepEqual(plain(life.planner.tasks), [{ id: 'ok', title: '看书', date: '2026-10-03', done: false, createdAt: 10 }]);
  assert.deepEqual(plain(life.planner.sessions), []);
  assert.equal(life.planner.timer, null);
});

test('corrupt stored JSON falls back to a fresh house', () => {
  const { window } = boot('{');
  const state = window.NT.S();
  assert.equal(state.hunger, 72);
  assert.equal(state.eq.wall, 'scene-attic');
  assert.equal(state.life.gems, 0);
  assert.equal(Array.isArray(state.life.todos), true);
});

test('a throwing stored save is backed up before falling back to a fresh house', () => {
  const original = '{"hunger":61,"fish":8,"life":{"gems":6,"note":"玩家原档"';
  const { window, store } = boot(original);
  assert.equal(store.get('naituan-house-v1-backup'), original);
  assert.equal(store.get('naituan-house-v1'), original);
  const state = window.NT.S();
  assert.equal(state.hunger, 72);
  assert.equal(state.eq.wall, 'scene-attic');
  assert.equal(state.life.gems, 0);
  assert.equal(Array.isArray(state.life.todos), true);
});

test('a normal save code imports back to the same data', () => {
  const photo = 'data:image/jpeg;base64,aaaa';
  const { window, document } = boot(null);
  const state = window.NT.S();
  state.fish = 8;
  state.best = 4;
  state.secs = 30;
  state.hunger = 61;
  state.mood = 64;
  state.energy = 70;
  state.shopSeen = 1;
  state.hiddenFixtures = { win: true, rug: false };
  state.catPosition = { x: 0.4, y: 0.8 };
  state.roomLayout = window.NaituanRoom.cleanLayout(state.roomLayout);
  state.life = window.NaituanLife.sanitize({
    version: 1, gems: 3,
    days: { '2026-10-03': { words: 12, wordRewarded: true, focusMinutes: 5, focusSessions: 1, food: { note: '南瓜粥', photo } } },
    todos: [{ id: 'first-words', text: '背 50 个单词', done: false }, { id: 'custom', text: '读一页', done: true }],
    timer: { duration: 1500, remaining: 900, endAt: 0 },
    planner: {
      version: 1, minutes: 25, migrated: true, deletedTask: null, result: null,
      ambience: { scene: 'sunny-desk', enabled: false, rain: 30, purr: 35 },
      tasks: [{ id: 'p-1', title: '看书', date: '2026-10-03', done: false, createdAt: 1700000000000 }],
      sessions: [{
        id: 'legacy-2026-10-02', taskId: null, title: '之前的专注', startedAt: 1699000000000, endedAt: 1699000000000,
        durationMs: 60000, plannedMs: 60000, completed: true, legacy: true, days: [{ date: '2026-10-02', ms: 60000 }]
      }]
    }
  });
  click(document, 'btnSave');
  const code = document.getElementById('saveText').value;
  const original = decode(code);
  state.fish = 999;
  document.getElementById('saveText').value = code;
  click(document, 'saveLoad');
  click(document, 'saveLoad');
  assert.equal(document.getElementById('bubble').textContent, '存档导入好了');
  assert.equal(window.NT.S().fish, 8);
  assert.deepEqual(withoutTime(window.NT.S()), withoutTime(original));
  assert.equal(window.NT.S().life.days['2026-10-03'].food.photo, photo);
});

test('a thrown import restores the previous house and does not save', () => {
  const { window, document, audio, store } = boot(null);
  window.NT.S().fish = 7;
  click(document, 'btnSave');
  const before = store.get('naituan-house-v1');
  document.getElementById('saveText').value = document.getElementById('saveText').value;
  click(document, 'saveLoad');
  audio.setVolume = () => { throw new Error('audio failed'); };
  click(document, 'saveLoad');
  assert.equal(document.getElementById('saveMsg').textContent, '这串码有问题，没有导入');
  assert.equal(window.NT.S().fish, 7);
  assert.equal(store.get('naituan-house-v1'), before);
});

test('planner create drops null rows and numeric dates without throwing', () => {
  const planner = require('../planner-state.js');
  const created = planner.create({
    tasks: [null, { id: 'ok', title: '看书', date: '2026-10-03', done: true, createdAt: 5 }, { id: 'num', title: 'x', date: 20261003, done: false }],
    sessions: [null, {
      id: 's', taskId: null, title: '专注', startedAt: 10, endedAt: 20, durationMs: 10, plannedMs: 20, completed: false,
      days: [null, { date: '2026-10-03', ms: 10 }]
    }],
    timer: {
      id: 'timer', kind: 'focus', taskId: null, title: '专注', plannedMs: 1000, elapsedMs: 0, startedAt: 10, runningSince: null,
      days: [null, { date: '2026-10-03', ms: 0 }]
    }
  });
  assert.deepEqual(created.tasks.map(task => task.id), ['ok']);
  assert.equal(created.sessions.length, 1);
  assert.deepEqual(created.sessions[0].days, [{ date: '2026-10-03', ms: 10 }]);
  assert.deepEqual(created.timer.days, [{ date: '2026-10-03', ms: 0 }]);
  assert.equal(planner.create({ tasks: [null], sessions: [null], timer: { days: [null] } }).timer, null);
});

// Smallest practical JPEG (1x1). life.js stores canvas.toDataURL('image/jpeg', .8),
// which always starts with this prefix.
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=';

function realisticHouse(photo) {
  // Planner tasks are stored with title, never text. See planner.js tasks.push.
  return {
    hunger: 61, mood: 64, energy: 70, sleeping: false, secs: 30, fish: 8, best: 4, bestBeat: 2,
    mute: false, vol: 70, bgm: false, bgmVol: 40,
    cq: { ver: 2, cleared: [3, 1], cakes: [2, 0, 0, 0, 0, 0, 0, 1], seen: [1, 0, 0, 0, 0, 0, 0, 1] },
    t: Date.now(),
    shopSeen: 1,
    hiddenFixtures: { win: false, rug: true },
    catPosition: { x: 0.42, y: 0.81 },
    own: {
      'wall:dots': 1, 'rug:pink': 1, 'win:plain': 1,
      'wall:stripe': 1, 'rug:cream': 1, 'prop:lamp': 1, 'prop:yarn': 1
    },
    eq: { wall: 'stripe', rug: 'cream', win: 'plain', prop: ['lamp', 'yarn'] },
    roomLayout: {
      'prop:lamp': { x: 0.22, y: 0.7, scale: 1.2, flipX: true, flipY: false },
      'prop:yarn': { x: 0.66, y: 0.84, scale: 1, flipX: false, flipY: false }
    },
    life: {
      version: 1, gems: 6,
      days: {
        '2026-10-03': {
          words: 48, wordRewarded: true, focusMinutes: 20, focusSessions: 1,
          food: { note: '南瓜粥和鸡蛋', photo }
        },
        '2026-10-02': { words: 10, wordRewarded: false, focusMinutes: 5, focusSessions: 1 }
      },
      todos: [
        { id: 'first-words', text: '背 50 个单词', done: true },
        { id: 'custom', text: '读一页书', done: false }
      ],
      timer: { duration: 1500, remaining: 900, endAt: 0 },
      planner: {
        version: 1, minutes: 40, migrated: true,
        deletedTask: { id: 'p-old', title: '已删的小事', date: '2026-10-01', done: false, createdAt: 1700000000000 },
        result: null,
        ambience: { scene: 'rainy-desk', enabled: true, rain: 0, purr: 40 },
        tasks: [{ id: 'p-read', title: '看完第 3 章', date: '2026-10-03', done: false, createdAt: 1700000001000 }],
        sessions: [{
          id: 'p-sess', taskId: 'p-read', title: '看完第 3 章',
          startedAt: 1700000100000, endedAt: 1700000400000, durationMs: 300000, plannedMs: 1500000,
          completed: false, days: [{ date: '2026-10-02', ms: 300000 }]
        }],
        timer: {
          id: 'p-live', kind: 'focus', taskId: 'p-read', title: '看完第 3 章',
          plannedMs: 40 * 60000, elapsedMs: 5 * 60000, startedAt: 1700001000000, runningSince: 1700001300000,
          days: [{ date: '2026-10-03', ms: 5 * 60000 }]
        }
      }
    }
  };
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }
function assertPlayerData(state, photo) {
  const life = plain(state.life);
  const today = life.days['2026-10-03'];
  const yesterday = life.days['2026-10-02'];
  assert.equal(today.words, 48);
  assert.equal(today.wordRewarded, true);
  assert.equal(yesterday.words, 10);
  assert.equal(yesterday.wordRewarded, false);
  assert.equal(today.food.photo, photo);
  assert.equal(today.food.note, '南瓜粥和鸡蛋');
  assert.equal(life.gems, 6);
  assert.deepEqual(life.todos, [
    { id: 'first-words', text: '背 50 个单词', done: true },
    { id: 'custom', text: '读一页书', done: false }
  ]);
  assert.equal(life.planner.tasks[0].title, '看完第 3 章');
  assert.equal(Object.prototype.hasOwnProperty.call(life.planner.tasks[0], 'text'), false);
  assert.equal(life.planner.sessions[0].id, 'p-sess');
  assert.equal(life.planner.sessions[0].taskId, 'p-read');
  assert.deepEqual(life.planner.sessions[0].days, [{ date: '2026-10-02', ms: 300000 }]);
  assert.equal(life.planner.timer.kind, 'focus');
  assert.equal(life.planner.timer.runningSince, 1700001300000);
  assert.deepEqual(life.planner.timer.days, [{ date: '2026-10-03', ms: 5 * 60000 }]);
  assert.equal(life.planner.ambience.rain, 0);
  assert.equal(life.planner.deletedTask.title, '已删的小事');
  assert.equal(state.own['prop:lamp'], 1);
  assert.equal(state.own['prop:yarn'], 1);
  assert.equal(state.eq.wall, 'stripe');
  assert.equal(state.eq.rug, 'cream');
  assert.equal(state.eq.win, 'plain');
  assert.deepEqual(plain(state.eq.prop), ['lamp', 'yarn']);
  assert.equal(state.roomLayout['prop:lamp'].x, 0.22);
  assert.equal(state.roomLayout['prop:lamp'].flipX, true);
  assert.equal(state.fish, 8);
}

test('a full app save round-trips through export and import', () => {
  assert.equal(JPEG.indexOf('data:image/jpeg;base64,'), 0);
  const house = realisticHouse(JPEG);
  const { window, document } = boot(null);
  const state = window.NT.S();
  Object.assign(state, house);
  click(document, 'btnSave');
  const firstCode = document.getElementById('saveText').value;
  assert.equal(firstCode.indexOf('NT1:'), 0);
  const first = decode(firstCode);
  document.getElementById('saveText').value = firstCode;
  click(document, 'saveLoad');
  click(document, 'saveLoad');
  assert.equal(document.getElementById('bubble').textContent, '存档导入好了');
  assertPlayerData(window.NT.S(), JPEG);
  click(document, 'btnSave');
  const second = decode(document.getElementById('saveText').value);
  assert.deepEqual(withoutTime(second), withoutTime(first));
  assert.equal(second.life.days['2026-10-03'].words, 48);
  assert.equal(second.life.days['2026-10-03'].wordRewarded, true);
  assert.equal(second.life.days['2026-10-03'].food.photo, JPEG);
  assert.notEqual(Object.prototype.hasOwnProperty.call(second, 't'), false);
});

test('an old localStorage save survives startup without dropping player data', () => {
  const photo = JPEG;
  const stored = realisticHouse(photo);
  stored.mystery = { drop: true };
  stored.life.note = 'not-a-field';
  stored.life.days['2026-10-03'].mood = 'happy';
  stored.life.days['2026-10-03'].food.mime = 'image/jpeg';
  stored.life.planner.tasks.push({ id: 'text-only', text: '只有 text 没有 title', date: '2026-10-03', done: false });
  const { window } = boot(JSON.stringify(stored));
  const state = window.NT.S();
  assertPlayerData(state, photo);
  assert.equal(state.mystery, undefined);
  assert.equal(state.life.note, undefined);
  assert.equal(state.life.days['2026-10-03'].mood, undefined);
  assert.equal(state.life.days['2026-10-03'].food.mime, undefined);
  assert.equal(plain(state.life).planner.tasks.some(task => task.id === 'text-only'), false);
  assert.deepEqual(plain(state.life).planner.tasks.map(task => task.title), ['看完第 3 章']);
});

test('non-finite or 1e400 stats fall back to defaults and huge finite values cap at 1e9', () => {
  const raw = '{' +
    '"hunger":1e400,"mood":1e309,"energy":1e308,"sleeping":false,' +
    '"secs":1500000000.9,"fish":1e400,"best":5e9,"bestBeat":3.7,' +
    '"mute":false,"vol":1e400,"bgm":false,"bgmVol":101,' +
    '"cq":null,"t":' + Date.now() + ',' +
    '"life":{"version":1,"gems":5e9,"days":{' +
      '"2026-10-03":{"words":1e400,"focusMinutes":2e9,"focusSessions":4},' +
      '"2026-10-02":{"words":4e9,"focusMinutes":1e400,"focusSessions":9}' +
    '},"todos":[],"timer":{"duration":1500,"remaining":1500,"endAt":0}}' +
  '}';
  const parsed = JSON.parse(raw);
  assert.equal(Number.isFinite(parsed.hunger), false);
  assert.equal(Number.isFinite(parsed.fish), false);
  const { window } = boot(raw);
  const state = window.NT.S();
  assert.equal(state.hunger, 72);
  assert.equal(state.mood, 70);
  assert.equal(state.energy, 100);
  assert.equal(state.secs, 1e9);
  assert.equal(state.fish, 0);
  assert.equal(state.best, 1e9);
  assert.equal(state.bestBeat, 3);
  assert.equal(state.vol, 80);
  assert.equal(state.bgm, false);
  assert.equal(state.bgmVol, 100);
  assert.equal(state.life.gems, 1e9);
  assert.equal(Object.prototype.hasOwnProperty.call(state.life.days['2026-10-03'], 'words'), false);
  assert.equal(state.life.days['2026-10-03'].focusMinutes, 1e9);
  assert.equal(state.life.days['2026-10-03'].focusSessions, 4);
  assert.equal(state.life.days['2026-10-02'].words, 1e9);
  assert.equal(Object.prototype.hasOwnProperty.call(state.life.days['2026-10-02'], 'focusMinutes'), false);
  assert.equal(state.life.days['2026-10-02'].focusSessions, 9);
  assert.equal(state.eq.wall, 'dots');
  assert.equal(Number.isFinite(state.hunger), true);
  assert.equal(Number.isFinite(state.fish), true);
});

test('importSave restores the previous house when save() returns false', () => {
  const { window, document, audio, store } = boot(null);
  window.NT.S().fish = 7;
  window.NT.S().hunger = 61;
  click(document, 'btnSave');
  const before = store.get('naituan-house-v1');
  const code = encode({
    hunger: 11, mood: 22, energy: 33, sleeping: false, secs: 9, fish: 99, best: 5, bestBeat: 1,
    mute: false, vol: 10, bgm: true, bgmVol: 10, cq: null, t: Date.now(),
    life: { version: 1, gems: 50, days: {}, todos: [], timer: { duration: 1500, remaining: 1500, endAt: 0 } }
  });
  document.getElementById('saveText').value = code;
  click(document, 'saveLoad');
  const plays = [];
  audio.play = (kind) => { plays.push(kind); return false; };
  let sets = 0;
  window.localStorage.setItem = (key, value) => {
    sets += 1;
    if (key === 'naituan-house-v1') throw new Error('quota');
    store.set(key, String(value));
  };
  click(document, 'saveLoad');
  assert.equal(document.getElementById('saveMsg').textContent, '存储空间不够，没有导入，可以先清理浏览器空间再试');
  assert.equal(document.getElementById('saveLoad').textContent, '导入这串码');
  assert.equal(plays.includes('nope'), true);
  assert.equal(window.NT.S().fish, 7);
  assert.equal(window.NT.S().hunger, 61);
  assert.equal(window.NT.S().life.gems, 0);
  assert.equal(store.get('naituan-house-v1'), before);
  assert.equal(sets, 1);
  assert.notEqual(document.getElementById('bubble').textContent, '存档导入好了');
});

/* ---------- 躲猫猫关卡进度 S.hs ---------- */
test('an old save without hs gets hide-and-seek progress; bestBeat > 0 unlocks level 3', () => {
  const stored = realisticHouse(JPEG);
  assert.equal(stored.bestBeat, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, 'hs'), false);
  const { window } = boot(JSON.stringify(stored));
  const state = window.NT.S();
  assert.deepEqual(plain(state.hs), { unlocked: 3, stars: [0, 0, 0, 0, 0], cleared: [false, false, false, false, false], perfect: [false, false, false, false, false], paperSeen: false });
  assert.equal(state.bestBeat, 2);
  assertPlayerData(state, JPEG);
  const fresh = boot(null).window.NT.S();
  assert.equal(fresh.hs.unlocked, 1);
  const neverPlayed = Object.assign(realisticHouse(JPEG), { bestBeat: 0 });
  assert.equal(boot(JSON.stringify(neverPlayed)).window.NT.S().hs.unlocked, 1);
});

test('hide-and-seek progress survives export and import, and an old NT1 code without hs still imports', () => {
  const { window, document } = boot(null);
  const state = window.NT.S();
  Object.assign(state, realisticHouse(JPEG));
  state.hs = { unlocked: 6, stars: [3, 3, 2, 1, 2], cleared: [true, true, true, true, true], perfect: [true, true, false, false, false], paperSeen: true };
  state.bestBeat = 4321;
  click(document, 'btnSave');
  const code = document.getElementById('saveText').value;
  assert.deepEqual(decode(code).hs, state.hs);
  assert.deepEqual(plain(window.NT.exportState().hs), plain(state.hs));
  state.hs = { unlocked: 1, stars: [0, 0, 0, 0, 0], cleared: [false, false, false, false, false], perfect: [false, false, false, false, false], paperSeen: false };
  document.getElementById('saveText').value = code;
  click(document, 'saveLoad');
  click(document, 'saveLoad');
  assert.equal(document.getElementById('bubble').textContent, '存档导入好了');
  assert.deepEqual(plain(window.NT.S().hs), { unlocked: 6, stars: [3, 3, 2, 1, 2], cleared: [true, true, true, true, true], perfect: [true, true, false, false, false], paperSeen: true });
  assert.equal(window.NT.S().bestBeat, 4321);

  const old = realisticHouse(JPEG);
  old.bestBeat = 999;
  document.getElementById('saveText').value = encode(old);
  click(document, 'saveLoad');
  click(document, 'saveLoad');
  assert.equal(document.getElementById('bubble').textContent, '存档导入好了');
  assert.equal(window.NT.S().hs.unlocked, 3);
  assert.equal(window.NT.S().bestBeat, 999);
  assertPlayerData(window.NT.S(), JPEG);

  /* the full-backup path (backup.js → NT.restoreState) migrates the same way */
  const restored = realisticHouse(JPEG);
  assert.equal(window.NT.restoreState(restored), true);
  assert.equal(window.NT.S().hs.unlocked, 3);
  restored.hs = { unlocked: 2, stars: [1, 0, 0, 0, 0], cleared: [true, false, false, false, false], perfect: [false, false, false, false, false] };
  assert.equal(window.NT.restoreState(restored), true);
  assert.deepEqual(plain(window.NT.S().hs.stars), [1, 0, 0, 0, 0]);
  assert.equal(window.NT.S().hs.unlocked, 2);
});
