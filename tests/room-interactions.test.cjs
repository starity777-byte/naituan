const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  class Element {
    constructor(id) {
      this.id = id; this.style = {}; this.dataset = {}; this.attributes = {}; this.listeners = {};
      this.hidden = false; this.children = []; this.captures = new Set(); this.classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(n => this.classes.add(n)),
        remove: (...names) => names.forEach(n => this.classes.delete(n)),
        toggle: (name, yes) => yes ? this.classes.add(name) : this.classes.delete(name)
      };
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(type, fields = {}) {
      const event = { type, target: this, button: 0, pointerType: 'touch', preventDefault() {}, ...fields };
      (this.listeners[type] || []).forEach(fn => fn(event));
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    appendChild(el) { this.children.push(el); el.parentElement = this; }
    querySelector(selector) { return controls[selector.slice(1)]; }
    contains(el) { return this === el || this.children.some(child => child.contains(el)); }
    closest() { return this.dataset.roomItem ? this : this.parentElement && this.parentElement.closest(); }
    focus() {}
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
    getBoundingClientRect() {
      if (this === stage) return rect(20, 30, 1004, 804);
      const match = (scene.style.transform || '').match(/translate\(([^p]+)px,([^p]+)px\) scale\(([^)]+)\)/);
      const [tx, ty, scale] = match ? match.slice(1).map(Number) : [0, 0, 1];
      if (this === scene) return rect(22 + tx, 32 + ty, 1000 * scale, 800 * scale);
      if (this === cat) return catBox.getBoundingClientRect();
      let [left, top, width, height] = this.base;
      if (this.style.top) {
        left = parseFloat(this.style.left) / 100 * 1000 - width / 2;
        top = parseFloat(this.style.top) / 100 * 800 - height * (this === catBox ? 1 : 0.5);
      }
      return rect(22 + tx + left * scale, 32 + ty + top * scale, width * scale, height * scale);
    }
  }
  function rect(left, top, width, height) { return { left, top, width, height, right: left + width, bottom: top + height }; }
  const controls = {};
  ['roomZoomIn', 'roomZoomOut', 'roomZoomLabel', 'roomArrange', 'roomEditTools', 'roomItem', 'roomTip', 'roomResetView', 'roomResetItem', 'roomCancel']
    .forEach(id => { controls[id] = new Element(id); });
  const stage = new Element('stage'), scene = new Element('scene'), tools = new Element('tools'), props = new Element('props');
  stage.clientLeft = stage.clientTop = 2; scene.clientWidth = 1000; scene.clientHeight = 800;
  const catBox = new Element('catBox'), cat = new Element('cat'), rug = new Element('rug'), win = new Element('win');
  catBox.base = [400, 440, 200, 160]; rug.base = [280, 590, 500, 120]; win.base = [100, 80, 250, 200];
  [catBox, rug, win].forEach(el => { el.offsetWidth = el.base[2]; el.offsetHeight = el.base[3]; });
  catBox.appendChild(cat);
  const window = new Element('window'), document = new Element('document');
  document.createElement = id => new Element(id); window.NaituanDecor = { items: [] };
  let time = 0, timerId = 0, resize, savedCat = null, savedLayout = {};
  const timers = new Map();
  const calls = { taps: 0, holds: 0, ends: [], drags: 0, drops: [], furniture: [], layouts: [] };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../room.js'), 'utf8'), {
    window, document,
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, at: time + ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} }
  });
  const room = window.NaituanRoom.create({
    stage, scene, tools, props, cat, catBox, enabled: () => true,
    layout: () => savedLayout, commit: p => { savedLayout = p; calls.layouts.push(p); },
    catPosition: () => savedCat, commitCat: p => { savedCat = p; calls.drops.push(p); },
    pet: () => calls.taps++, petHold: () => { calls.holds++; return true; },
    endPetHold: cancelled => calls.ends.push(cancelled), catDragStart: () => calls.drags++,
    interactItem: key => calls.furniture.push(key),
    items: [{ key: 'rug', name: '地毯', el: rug }, { key: 'win', name: '窗户', el: win, anchors: { watch: { x: 0.2, y: 0.8 } } }]
  });
  room.refresh();
  return {
    room, calls, cat, rug, win, scene, controls, window, api: window.NaituanRoom,
    resize: () => resize(),
    tick(ms) {
      time += ms;
      for (const [id, timer] of timers) if (timer.at <= time) { timers.delete(id); timer.fn(); }
    },
    pointer(type, id, x, y, target = cat) { stage.emit(type, { pointerId: id, clientX: x, clientY: y, target }); }
  };
}

function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }
function point(actual, x, y) { close(actual.x, x); close(actual.y, y); }

test('tap and 450ms hold are exclusive; movement cancels hold before dragging', () => {
  const f = fixture();
  f.pointer('pointerdown', 1, 520, 570); f.tick(449); f.pointer('pointerup', 1, 520, 570);
  assert.equal(f.calls.taps, 1); assert.equal(f.calls.holds, 0);
  f.tick(1000); assert.equal(f.calls.holds, 0);
  f.pointer('pointerdown', 2, 520, 570); f.tick(450); f.pointer('pointerup', 2, 520, 570);
  assert.equal(f.calls.taps, 1); assert.equal(f.calls.holds, 1); assert.deepEqual(f.calls.ends, [false]);
  f.pointer('pointerdown', 3, 520, 570); f.tick(450); f.pointer('pointermove', 3, 550, 570);
  f.pointer('pointerup', 3, 550, 570);
  assert.deepEqual(f.calls.ends, [false, true]); assert.equal(f.calls.taps, 1); assert.equal(f.calls.drags, 1);
});

test('cat drag uses zoom-correct room deltas, persists feet, and survives refresh', () => {
  const f = fixture();
  for (let n = 0; n < 4; n++) f.controls.roomZoomIn.emit('click');
  assert.equal(f.controls.roomZoomLabel.textContent, '200%');
  f.pointer('pointerdown', 1, 500, 500); f.pointer('pointermove', 1, 600, 540);
  f.pointer('pointermove', 1, 700, 580); f.pointer('pointerup', 1, 700, 580);
  assert.equal(f.calls.drags, 1); assert.equal(f.calls.drops.length, 1);
  point(f.calls.drops[0], 0.6, 0.8); assert.equal(f.calls.taps, 0);
  f.room.placeCat({ x: 0.1, y: 0.2 }); f.room.refresh(); point(f.room.getCatPosition(), 0.6, 0.8);
  f.resize(); point(f.room.getCatPosition(), 0.6, 0.8);
  point(f.room.placeCat({ x: -5, y: 8 }), 0.1, 1);
  assert.equal(f.calls.drops.length, 1);
});

test('second finger cancels hold/drag, rolls back cat and suppresses the remaining finger', () => {
  const f = fixture();
  f.pointer('pointerdown', 1, 450, 500); f.tick(450);
  f.pointer('pointerdown', 2, 650, 500); assert.deepEqual(f.calls.ends, [true]);
  f.pointer('pointerup', 2, 650, 500); f.tick(1000); f.pointer('pointerup', 1, 450, 500);
  assert.equal(f.calls.holds, 1); assert.equal(f.calls.taps, 0);
  f.pointer('pointerdown', 3, 450, 500); f.pointer('pointermove', 3, 550, 540);
  point(f.room.getCatPosition(), 0.6, 0.8);
  f.pointer('pointerdown', 4, 700, 540); point(f.room.getCatPosition(), 0.5, 0.75);
  f.pointer('pointermove', 4, 850, 540); assert.equal(f.controls.roomZoomLabel.textContent, '200%');
  f.pointer('pointerup', 4, 850, 540); f.pointer('pointermove', 3, 600, 560);
  f.pointer('pointerup', 3, 600, 560); assert.equal(f.calls.drops.length, 0); assert.equal(f.calls.taps, 0);
  f.pointer('pointerdown', 5, 450, 500); f.pointer('pointerup', 5, 450, 500);
  assert.equal(f.calls.taps, 1);
});

test('cancel, blur and explicit cancellation discard unfinished interactions', () => {
  const f = fixture();
  f.pointer('pointerdown', 1, 450, 500); f.pointer('pointermove', 1, 550, 500);
  f.pointer('pointercancel', 1, 550, 500); point(f.room.getCatPosition(), 0.5, 0.75);
  f.pointer('pointerdown', 2, 450, 500); f.pointer('pointermove', 2, 550, 500);
  f.window.emit('blur'); point(f.room.getCatPosition(), 0.5, 0.75);
  f.pointer('pointerdown', 3, 450, 500); f.tick(450); f.room.cancelInteraction();
  f.pointer('pointerup', 3, 450, 500);
  assert.deepEqual(f.calls.ends, [true]); assert.equal(f.calls.drops.length, 0); assert.equal(f.calls.taps, 0);
});

test('furniture tap/keyboard interact; arranging instead moves and commits furniture', () => {
  const f = fixture();
  assert.equal(f.rug.tabIndex, 0); assert.equal(f.rug.attributes['aria-hidden'], 'false');
  f.pointer('pointerdown', 1, 600, 650, f.rug); f.pointer('pointerup', 1, 600, 650, f.rug);
  f.win.emit('keydown', { key: 'Enter' }); assert.deepEqual(f.calls.furniture, ['rug', 'win']);
  f.pointer('pointerdown', 2, 600, 650, f.rug); f.pointer('pointermove', 2, 650, 650, f.rug);
  f.pointer('pointerup', 2, 650, 650, f.rug); assert.equal(f.calls.furniture.length, 2);
  f.controls.roomArrange.emit('click');
  f.win.emit('keydown', { key: ' ' });
  f.pointer('pointerdown', 3, 600, 650, f.rug); f.pointer('pointermove', 3, 700, 650, f.rug);
  f.pointer('pointerup', 3, 700, 650, f.rug); f.controls.roomArrange.emit('click');
  assert.equal(f.calls.furniture.length, 2); assert.equal(f.calls.layouts.length, 1);
  point(f.calls.layouts[0].rug, 0.63, 0.8125);
});

test('furniture geometry and anchors remain in room coordinates through camera zoom', () => {
  const f = fixture();
  f.controls.roomZoomIn.emit('click');
  const geometry = f.room.getItemGeometry('win');
  point(geometry.center, 0.225, 0.225); close(geometry.size.width, 0.25); close(geometry.size.height, 0.25);
  point(f.room.itemPoint('win', 'watch'), 0.15, 0.3);
  point(f.room.itemPoint('win'), 0.225, 0.3375);
  f.win.hidden = true; assert.equal(f.room.itemPoint('win'), null);
  assert.equal(f.api.cleanPoint({ x: NaN, y: 0 }), null);
  point(f.api.cleanPoint({ x: -1, y: 2 }), 0, 1);
});
