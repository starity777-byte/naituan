const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(initialLayout = {}, options = {}) {
  class Element {
    constructor(id) {
      this.id = id; this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
      this.dataset = {}; this.attributes = {}; this.listeners = {};
      this.hidden = false; this.children = []; this.captures = new Set(); this.classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(n => this.classes.add(n)),
        remove: (...names) => names.forEach(n => this.classes.delete(n)),
        contains: name => this.classes.has(name),
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
      const itemScale = (this.style.transform || '').match(/scale\(([^,]+),([^)]+)\)/);
      if (itemScale) {
        const sx = Math.abs(Number(itemScale[1])), sy = Math.abs(Number(itemScale[2]));
        left -= width * (sx - 1) / 2; top -= height * (sy - 1) * (this === catBox ? 1 : 0.5);
        width *= sx; height *= sy;
      }
      return rect(22 + tx + left * scale, 32 + ty + top * scale, width * scale, height * scale);
    }
  }
  function rect(left, top, width, height) { return { left, top, width, height, right: left + width, bottom: top + height }; }
  const controls = {};
  ['roomZoomIn', 'roomZoomOut', 'roomZoomLabel', 'roomArrange', 'roomEditTools', 'roomItem', 'roomTip', 'roomResetView', 'roomResetItem', 'roomCancel',
    'roomSize', 'roomSizeLabel', 'roomSmaller', 'roomBigger', 'roomFlipX', 'roomFlipY', 'roomLeft', 'roomRight', 'roomUp', 'roomDown']
    .forEach(id => { controls[id] = new Element(id); });
  const stage = new Element('stage'), scene = new Element('scene'), tools = new Element('tools'), props = new Element('props');
  stage.clientLeft = stage.clientTop = 2; scene.clientWidth = 1000; scene.clientHeight = 800;
  const catBox = new Element('catBox'), cat = new Element('cat'), catShadow = new Element('catShadow');
  const rug = new Element('rug'), win = new Element('win'), bed = new Element('bed');
  catBox.base = [400, 440, 200, 160]; rug.base = [280, 590, 500, 120]; win.base = [100, 80, 250, 200];
  catShadow.base = [450, 591, 100, 18]; bed.base = [540, 600, 240, 100];
  [catBox, catShadow, rug, win, bed].forEach(el => { el.offsetWidth = el.base[2]; el.offsetHeight = el.base[3]; });
  catBox.appendChild(cat);
  const window = new Element('window'), document = new Element('document');
  document.createElement = id => new Element(id); window.NaituanDecor = { items: [] };
  let time = 0, timerId = 0, resize, savedCat = null, savedLayout = initialLayout;
  const timers = new Map();
  const calls = { taps: 0, holds: 0, ends: [], drags: 0, drops: [], landings: 0, furniture: [], layouts: [], onLayout: 0 };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../room.js'), 'utf8'), {
    window, document,
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, at: time + ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} }
  });
  const room = window.NaituanRoom.create({
    stage, scene, tools, props, cat, catBox, catShadow, enabled: () => true,
    floorBoundary: options.floorBoundary,
    layout: () => savedLayout, commit: p => { savedLayout = p; calls.layouts.push(p); },
    catPosition: () => savedCat, commitCat: p => { savedCat = p; calls.drops.push(p); },
    pet: () => calls.taps++, petHold: () => { calls.holds++; return true; },
    endPetHold: cancelled => calls.ends.push(cancelled), catDragStart: () => calls.drags++,
    catDrop: () => calls.landings++,
    interactItem: key => calls.furniture.push(key),
    onLayout: () => calls.onLayout++,
    items: [{ key: 'rug', name: '地毯', el: rug }, { key: 'win', name: '窗户', el: win, anchors: { watch: { x: 0.2, y: 0.8 } } },
      { key: 'prop:cushion', name: '猫窝', el: bed, depthAware: true, anchors: { rest: { x: 0.2, y: 0.7 } } }]
  });
  room.refresh();
  return {
    room, calls, cat, catBox, catShadow, rug, win, bed, scene, controls, window, api: window.NaituanRoom,
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
  assert.equal(f.calls.landings, 1);
  point(f.calls.drops[0], 0.6, 0.8); assert.equal(f.calls.taps, 0);
  f.room.placeCat({ x: 0.1, y: 0.2 }); f.room.refresh(); point(f.room.getCatPosition(), 0.6, 0.8);
  f.resize(); point(f.room.getCatPosition(), 0.6, 0.8);
  const edge = f.room.placeCat({ x: -5, y: 8 });
  close(edge.y, 0.985);
  assert.ok(f.catBox.getBoundingClientRect().left >= f.scene.getBoundingClientRect().left - 1e-9);
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
  assert.equal(f.calls.landings, 0);
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
  assert.equal(f.calls.landings, 0);
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

test('furniture scale and mirrored anchors survive editing, save and refresh', () => {
  const f = fixture({ win: { x: 0.5, y: 0.5, scale: 1.5, flipX: true, flipY: true } });
  for (let n = 0; n < 4; n++) f.controls.roomZoomIn.emit('click');
  let geometry = f.room.getItemGeometry('win');
  point(geometry.center, 0.5, 0.5); close(geometry.size.width, 0.375); close(geometry.size.height, 0.375);
  point(f.room.itemPoint('win', 'watch'), 0.6125, 0.3875);

  f.controls.roomArrange.emit('click');
  f.controls.roomItem.value = 'win'; f.controls.roomItem.emit('change');
  f.controls.roomSize.value = '200'; f.controls.roomSize.emit('input');
  f.controls.roomFlipX.emit('click');
  f.controls.roomRight.emit('click'); f.controls.roomUp.emit('click');
  geometry = f.room.getItemGeometry('win');
  point(geometry.center, 0.51, 0.49); close(geometry.size.width, 0.5); close(geometry.size.height, 0.5);
  point(f.room.itemPoint('win', 'watch'), 0.36, 0.34);
  f.controls.roomArrange.emit('click');
  const saved = f.calls.layouts[0].win;
  point(saved, 0.51, 0.49); assert.equal(saved.scale, 2); assert.equal(saved.flipX, false); assert.equal(saved.flipY, true);
  const cleaned = f.api.cleanLayout(f.calls.layouts[0]).win;
  assert.equal(cleaned.scale, 2); assert.equal(cleaned.flipX, false); assert.equal(cleaned.flipY, true);
  f.room.refresh(); f.resize();
  point(f.room.itemPoint('win', 'watch'), 0.36, 0.34);
  assert.equal(f.calls.onLayout, 3);
});

test('cat gets smaller at the wall and larger in front; surface visits bypass floor depth', () => {
  const f = fixture({}, { floorBoundary: () => [[0, 0.64], [0.5, 0.58], [1, 0.7]] });
  point(f.room.placeCat({ x: 0.5, y: 0.1 }), 0.5, 0.588);
  close(f.catBox.getBoundingClientRect().width, 200 * 0.56);
  point(f.room.getCatPosition(), 0.5, 0.588);
  f.room.placeCat({ x: 0.5, y: (0.588 + 0.985) / 2 });
  close(f.catBox.getBoundingClientRect().width, 200 * 0.8);
  f.room.placeCat({ x: 0.5, y: 1 }, true);
  point(f.room.getCatPosition(), 0.5, 0.985);
  close(f.catBox.getBoundingClientRect().width, 200 * 1.04);
  point(f.room.placeCat({ x: 0.25, y: 0.1 }), 0.25, 0.618);
  f.room.placeCat({ x: 0.5, y: 0.3 }, false, { surface: true });
  point(f.room.getCatPosition(), 0.5, 0.3); close(f.catBox.getBoundingClientRect().width, 200);
  assert.equal(f.catShadow.hidden, true);
  f.room.restoreCat(); point(f.room.getCatPosition(), 0.5, 0.985);
  assert.equal(f.catShadow.hidden, false);
  assert.equal(f.calls.drops.length, 1);
});

test('zoomed dragging keeps the shadow at the feet and a second finger rolls both back', () => {
  const f = fixture();
  const shadowPoint = () => {
    const r = f.catShadow.getBoundingClientRect(), s = f.scene.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / s.width, y: (r.top + r.height / 2 - s.top) / s.height };
  };
  f.room.placeCat({ x: 0.5, y: 0.75 }, true);
  for (let n = 0; n < 4; n++) f.controls.roomZoomIn.emit('click');
  f.pointer('pointerdown', 1, 500, 600); f.pointer('pointermove', 1, 620, 480);
  point(f.room.getCatPosition(), 0.56, 0.675); point(shadowPoint(), 0.56, 0.675);
  assert.equal(f.catBox.classList.contains('room-cat-dragging'), true);
  assert.equal(f.catShadow.classList.contains('lifted'), true);
  f.pointer('pointerdown', 2, 780, 480);
  point(f.room.getCatPosition(), 0.5, 0.75); point(shadowPoint(), 0.5, 0.75);
  assert.equal(f.catBox.classList.contains('room-cat-dragging'), false);
  assert.equal(f.catShadow.classList.contains('lifted'), false);
  f.pointer('pointerup', 2, 780, 480); f.pointer('pointerup', 1, 620, 480);
  assert.equal(f.calls.drops.length, 1); assert.equal(f.calls.taps, 0);
});

test('bed depth changes displayed size while preserving manual scale, mirrors and interaction anchors', () => {
  const key = 'prop:cushion';
  const f = fixture({ [key]: { x: 0.5, y: 0.87, scale: 1.4, flipX: true, flipY: true } });
  const near = f.room.getItemGeometry(key);
  point(near.center, 0.5, 0.87);
  f.controls.roomArrange.emit('click'); f.controls.roomItem.value = key; f.controls.roomItem.emit('change');
  assert.equal(Number(f.controls.roomSize.value), 140);
  for (let n = 0; n < 16; n++) f.controls.roomUp.emit('click');
  const far = f.room.getItemGeometry(key);
  point(far.center, 0.5, 0.71); assert.ok(far.size.width < near.size.width);
  const anchor = f.room.itemPoint(key, 'rest');
  point(anchor, far.center.x + far.size.width * 0.3, far.center.y - far.size.height * 0.2);
  f.room.placeCat(anchor, false, { surface: true }); point(f.room.getCatPosition(), anchor.x, anchor.y);
  f.controls.roomArrange.emit('click');
  const saved = f.calls.layouts[0][key];
  point(saved, 0.5, 0.71); assert.equal(saved.scale, 1.4); assert.equal(saved.flipX, true); assert.equal(saved.flipY, true);
  f.room.refresh();
  const restored = f.room.getItemGeometry(key);
  close(restored.size.width, far.size.width); point(f.room.itemPoint(key, 'rest'), anchor.x, anchor.y);
});
