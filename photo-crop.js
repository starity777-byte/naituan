(function (root) {
  'use strict';
  /* 照片裁剪：选好照片后弹出裁剪框。默认方形（推荐），也可以换成别的形状或保持原图。
     几何计算（fit / resize / move）是纯函数，放在前面，方便在 Node 里测试。 */
  var MIN_FACTOR = .92;
  var SHAPES = [
    { id: 'square', label: '方形', ratio: 1 },
    { id: 'r43', label: '4:3', ratio: 4 / 3 },
    { id: 'r34', label: '3:4', ratio: 3 / 4 },
    { id: 'r169', label: '16:9', ratio: 16 / 9 },
    { id: 'free', label: '自由', ratio: 0 },
    { id: 'original', label: '原图', ratio: -1 }
  ];
  function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
  /* 在 dw×dh 的图里放一个比例为 ratio 的最大框，中心尽量靠近 (cx, cy)。 */
  function fit(ratio, dw, dh, cx, cy, factor) {
    var w, h; factor = factor || 1;
    if (dw / dh > ratio) { h = dh; w = h * ratio; } else { w = dw; h = w / ratio; }
    w *= factor; h *= factor;
    return { x: clamp(cx - w / 2, 0, dw - w), y: clamp(cy - h / 2, 0, dh - h), w: w, h: h };
  }
  /* 拖动某个角：对角固定。ratio > 0 锁定比例，ratio = 0 自由。 */
  function resize(rect, corner, px, py, ratio, dw, dh, min) {
    var left = corner.indexOf('l') >= 0, top = corner.indexOf('t') >= 0;
    var ax = left ? rect.x + rect.w : rect.x, ay = top ? rect.y + rect.h : rect.y;
    var maxW = left ? ax : dw - ax, maxH = top ? ay : dh - ay;
    var dx = left ? ax - px : px - ax, dy = top ? ay - py : py - ay, w, h;
    if (ratio > 0) {
      var minW = ratio >= 1 ? min * ratio : min, maxFit = Math.min(maxW, maxH * ratio);
      w = clamp((dx + dy * ratio) / 2, Math.min(minW, maxFit), maxFit); h = w / ratio;
    } else {
      w = clamp(dx, Math.min(min, maxW), maxW); h = clamp(dy, Math.min(min, maxH), maxH);
    }
    return { x: left ? ax - w : ax, y: top ? ay - h : ay, w: w, h: h };
  }
  function move(rect, dx, dy, dw, dh) {
    return { x: clamp(rect.x + dx, 0, dw - rect.w), y: clamp(rect.y + dy, 0, dh - rect.h), w: rect.w, h: rect.h };
  }
  var geometry = { fit: fit, resize: resize, move: move, shapes: SHAPES };
  if (typeof document === 'undefined') { if (typeof module !== 'undefined' && module.exports) module.exports = geometry; return; }

  var dialog, els = {}, session = null;
  var READ_ERROR = '这张照片暂时读不了，请换一张图片。';
  function build() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'crop-dialog'; dialog.id = 'cropDialog'; dialog.setAttribute('aria-labelledby', 'cropTitle');
    dialog.innerHTML = '<h2 id="cropTitle">裁一裁照片</h2>' +
      '<div class="crop-ratios" role="group" aria-label="裁剪形状">' + SHAPES.map(function (shape) {
        return '<button type="button" data-shape="' + shape.id + '" aria-pressed="false">' + shape.label + '</button>';
      }).join('') + '</div>' +
      '<div class="crop-stage"><div class="crop-canvas"><img alt="要裁剪的照片" draggable="false">' +
      '<div class="crop-box" tabindex="0" role="group" aria-label="裁剪框，可用方向键移动"><span class="crop-handle" data-h="tl"></span><span class="crop-handle" data-h="tr"></span><span class="crop-handle" data-h="bl"></span><span class="crop-handle" data-h="br"></span></div></div></div>' +
      '<p class="crop-hint" role="status"></p>' +
      '<div class="crop-actions"><button type="button" class="crop-cancel">取消</button><button type="button" class="crop-ok">用这张</button></div>';
    document.body.appendChild(dialog);
    els = { stage: dialog.querySelector('.crop-stage'), canvas: dialog.querySelector('.crop-canvas'), img: dialog.querySelector('img'), box: dialog.querySelector('.crop-box'), hint: dialog.querySelector('.crop-hint'), ok: dialog.querySelector('.crop-ok'), cancel: dialog.querySelector('.crop-cancel'), shapes: dialog.querySelectorAll('[data-shape]') };
    els.cancel.addEventListener('click', function () { finish(null); });
    els.ok.addEventListener('click', accept);
    dialog.addEventListener('close', function () { finish(null); });
    dialog.addEventListener('cancel', function (event) { if (session && session.busy) event.preventDefault(); });
    dialog.querySelector('.crop-ratios').addEventListener('click', function (event) { var button = event.target.closest('[data-shape]'); if (button && session) setShape(button.dataset.shape); });
    els.box.addEventListener('pointerdown', pointerDown);
    els.box.addEventListener('keydown', keyDown);
    window.addEventListener('resize', function () { if (session && dialog.open) { layout(); paint(); } });
  }
  function currentShape() { return SHAPES.find(function (shape) { return shape.id === session.shape; }); }
  function hintText() {
    var shape = currentShape();
    if (shape.ratio === -1) return '保持照片原来的样子，不裁剪。';
    return (shape.ratio === 1 ? '推荐方形，排在一起最整齐。' : '') + '拖动框移动位置，拖四个角调整大小。';
  }
  function layout() {
    var s = session, availW = Math.max(120, els.stage.clientWidth - 8), availH = Math.max(160, Math.min(window.innerHeight * .5, 440));
    var k = Math.min(availW / s.nw, availH / s.nh), dw = Math.max(1, Math.round(s.nw * k)), dh = Math.max(1, Math.round(s.nh * k));
    if (s.rect && s.dw) { var f = dw / s.dw; s.rect = { x: s.rect.x * f, y: s.rect.y * f, w: s.rect.w * f, h: s.rect.h * f }; }
    s.dw = dw; s.dh = dh; s.min = Math.max(24, Math.min(56, Math.min(dw, dh) / 3));
    els.canvas.style.width = dw + 'px'; els.canvas.style.height = dh + 'px';
  }
  function paint() {
    var s = session, r = s.rect;
    els.box.style.left = r.x + 'px'; els.box.style.top = r.y + 'px'; els.box.style.width = r.w + 'px'; els.box.style.height = r.h + 'px';
  }
  function setShape(id) {
    var s = session, shape = SHAPES.find(function (item) { return item.id === id; });
    if (!shape) return;
    var previous = s.rect, cx = previous ? previous.x + previous.w / 2 : s.dw / 2, cy = previous ? previous.y + previous.h / 2 : s.dh / 2;
    s.shape = id;
    if (shape.ratio === -1) s.rect = { x: 0, y: 0, w: s.dw, h: s.dh };
    else if (shape.ratio === 0) { if (!previous || (previous.w >= s.dw - 1 && previous.h >= s.dh - 1)) s.rect = fit(s.dw / s.dh, s.dw, s.dh, s.dw / 2, s.dh / 2, MIN_FACTOR); }
    else s.rect = fit(shape.ratio, s.dw, s.dh, cx, cy, MIN_FACTOR);
    els.shapes.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.shape === id)); });
    els.box.classList.toggle('is-fixed', shape.ratio === -1);
    els.box.tabIndex = shape.ratio === -1 ? -1 : 0;
    els.hint.textContent = hintText(); paint();
  }
  var drag = null;
  function pointerDown(event) {
    var s = session; if (!s || s.busy || drag || currentShape().ratio === -1 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    var corner = event.target.dataset && event.target.dataset.h || '', r = s.rect, bounds = els.canvas.getBoundingClientRect();
    var px = event.clientX - bounds.left, py = event.clientY - bounds.top;
    drag = { id: event.pointerId, corner: corner, rect: r, px: px, py: py, gx: 0, gy: 0 };
    if (corner) { drag.gx = px - (corner.indexOf('l') >= 0 ? r.x : r.x + r.w); drag.gy = py - (corner.indexOf('t') >= 0 ? r.y : r.y + r.h); }
    try { els.box.setPointerCapture(event.pointerId); } catch (error) { /* 个别浏览器不支持，忽略 */ }
    els.box.addEventListener('pointermove', pointerMove); els.box.addEventListener('pointerup', pointerEnd); els.box.addEventListener('pointercancel', pointerEnd);
    event.preventDefault();
  }
  function pointerMove(event) {
    var s = session; if (!s || !drag || event.pointerId !== drag.id) return;
    var bounds = els.canvas.getBoundingClientRect(), px = event.clientX - bounds.left, py = event.clientY - bounds.top, shape = currentShape();
    s.rect = drag.corner ? resize(drag.rect, drag.corner, px - drag.gx, py - drag.gy, shape.ratio, s.dw, s.dh, s.min) : move(drag.rect, px - drag.px, py - drag.py, s.dw, s.dh);
    paint();
  }
  function pointerEnd(event) {
    if (!drag || event.pointerId !== drag.id) return;
    els.box.removeEventListener('pointermove', pointerMove); els.box.removeEventListener('pointerup', pointerEnd); els.box.removeEventListener('pointercancel', pointerEnd);
    try { els.box.releasePointerCapture(event.pointerId); } catch (error) { /* 已经释放 */ }
    drag = null;
  }
  function keyDown(event) {
    var s = session, step = event.shiftKey ? 24 : 8, delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!s || !delta || currentShape().ratio === -1) return;
    s.rect = move(s.rect, delta[0], delta[1], s.dw, s.dh); paint(); event.preventDefault();
  }
  function output() {
    var s = session, k = s.nw / s.dw, r = s.rect, whole = currentShape().ratio === -1;
    var sx = whole ? 0 : clamp(Math.round(r.x * k), 0, s.nw - 1), sy = whole ? 0 : clamp(Math.round(r.y * k), 0, s.nh - 1);
    var sw = whole ? s.nw : clamp(Math.round(r.w * k), 1, s.nw - sx), sh = whole ? s.nh : clamp(Math.round(r.h * k), 1, s.nh - sy);
    var scale = Math.min(1, s.maxEdge / Math.max(sw, sh)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
    var context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(s.probe, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return new Promise(function (resolve, reject) { canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error(READ_ERROR)); }, 'image/jpeg', s.quality); });
  }
  function accept() {
    var s = session; if (!s || s.busy) return;
    s.busy = true; els.ok.disabled = true; els.ok.textContent = '处理中…';
    output().then(function (blob) { finish(blob); }, function (error) { s.busy = false; els.ok.disabled = false; els.ok.textContent = '用这张'; els.hint.textContent = error.message || READ_ERROR; });
  }
  function finish(value, failure) {
    var s = session; if (!s) return;
    session = null; drag = null;
    URL.revokeObjectURL(s.source); els.img.removeAttribute('src');
    els.ok.disabled = false; els.ok.textContent = '用这张';
    if (dialog.open) dialog.close();
    if (failure) s.reject(failure); else s.resolve(value);
  }
  /* 弹出裁剪框。选好返回 JPEG Blob；取消返回 null；读不了图片会 reject。 */
  function pick(file, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('请选择一张图片。')); return; }
      build();
      if (session) { reject(new Error('正在裁剪另一张照片。')); return; }
      var source = URL.createObjectURL(file), probe = new Image();
      probe.onload = function () {
        if (session) { URL.revokeObjectURL(source); reject(new Error('正在裁剪另一张照片。')); return; }
        session = { source: source, probe: probe, nw: probe.naturalWidth, nh: probe.naturalHeight, maxEdge: options.maxEdge || 1280, quality: options.quality || .82, shape: 'square', rect: null, dw: 0, dh: 0, min: 40, busy: false, resolve: resolve, reject: reject };
        if (!session.nw || !session.nh) { finish(null, new Error(READ_ERROR)); return; }
        els.img.src = source;
        dialog.showModal(); layout(); setShape('square');
      };
      probe.onerror = function () { URL.revokeObjectURL(source); reject(new Error(READ_ERROR)); };
      probe.src = source;
    });
  }
  function toDataURL(blob) {
    return new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = function () { reject(new Error(READ_ERROR)); }; reader.readAsDataURL(blob); });
  }
  root.NaituanCrop = { pick: pick, toDataURL: toDataURL };
})(typeof window !== 'undefined' ? window : globalThis);
