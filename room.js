(function () {
  'use strict';
  var KEYS = ['win', 'rug', 'prop:yarn', 'prop:cushion', 'prop:plant', 'prop:lamp', 'prop:frame', 'prop:lights'];
  KEYS = KEYS.concat(window.NaituanDecor.items.map(function (it) { return 'prop:' + it.id; }));
  function limit(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function cleanLayout(value) {
    var out = {};
    KEYS.forEach(function (key) {
      var p = value && value[key];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[key] = { x: limit(p.x, 0, 1), y: limit(p.y, 0, 1) };
    });
    return out;
  }
  function create(o) {
    var stage = o.stage, scene = o.scene, tools = o.tools;
    var $ = function (id) { return tools.querySelector('#' + id); };
    var zoomIn = $('roomZoomIn'), zoomOut = $('roomZoomOut'), label = $('roomZoomLabel');
    var arrange = $('roomArrange'), editTools = $('roomEditTools'), picker = $('roomItem'), tip = $('roomTip');
    var view = { scale: 1, x: 0, y: 0 }, points = new Map(), gesture = null;
    var editing = false, draft = {}, selected = null, moved = false, multi = false, enabled = false;
    var items = o.items, byKey = {};
    items.forEach(function (it) {
      byKey[it.key] = it; it.el.dataset.roomItem = it.key;
      it.el.setAttribute('role', 'button'); it.el.setAttribute('aria-label', '摆放' + it.name);
      it.el.addEventListener('keydown', function (e) {
        if (!editing) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(it); return; }
        var delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!delta) return;
        e.preventDefault(); select(it);
        var p = center(it), step = e.shiftKey ? 0.05 : 0.01;
        place(it, { x: p.x + delta[0] * step, y: p.y + delta[1] * step });
      });
    });
    function drawView() {
      view.scale = limit(view.scale, 1, 3);
      view.x = limit(view.x, 1 - view.scale, 0); view.y = limit(view.y, 1 - view.scale, 0);
      scene.style.transform = 'translate(' + view.x * scene.clientWidth + 'px,' + view.y * scene.clientHeight + 'px) scale(' + view.scale + ')';
      label.textContent = Math.round(view.scale * 100) + '%';
      zoomOut.disabled = view.scale <= 1; zoomIn.disabled = view.scale >= 3;
    }
    function local(p) {
      var r = stage.getBoundingClientRect();
      return { x: (p.x - r.left - stage.clientLeft) / scene.clientWidth, y: (p.y - r.top - stage.clientTop) / scene.clientHeight };
    }
    function zoom(scale, at) {
      at = at || { x: 0.5, y: 0.5 };
      var next = limit(scale, 1, 3), ratio = next / view.scale;
      view.x = at.x - (at.x - view.x) * ratio; view.y = at.y - (at.y - view.y) * ratio;
      view.scale = next; drawView();
    }
    function center(it) {
      var r = it.el.getBoundingClientRect(), s = scene.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - s.left) / s.width, y: (r.top + r.height / 2 - s.top) / s.height };
    }
    function bounded(it, p) {
      var hx = Math.min(0.5, it.el.offsetWidth / scene.clientWidth / 2);
      var hy = Math.min(0.5, it.el.offsetHeight / scene.clientHeight / 2);
      return { x: limit(p.x, hx, 1 - hx), y: limit(p.y, hy, 1 - hy) };
    }
    function apply(it, p) {
      if (p) {
        p = bounded(it, p);
        it.el.style.left = p.x * 100 + '%'; it.el.style.top = p.y * 100 + '%';
        it.el.style.right = 'auto'; it.el.style.bottom = 'auto'; it.el.style.transform = 'translate(-50%,-50%)';
      } else ['left', 'top', 'right', 'bottom', 'transform'].forEach(function (key) { it.el.style[key] = ''; });
    }
    function paintLayout() {
      var layout = editing ? draft : o.layout();
      items.forEach(function (it) { apply(it, layout[it.key]); });
    }
    function place(it, p) { draft[it.key] = bounded(it, p); apply(it, draft[it.key]); }
    function select(it) {
      selected = it;
      items.forEach(function (item) { item.el.classList.toggle('room-selected', item === it); });
      if (it) picker.value = it.key;
    }
    function editUI() {
      scene.classList.toggle('arranging', editing); editTools.hidden = !editing;
      arrange.textContent = editing ? '完成' : '布置'; arrange.setAttribute('aria-pressed', String(editing));
      tip.textContent = editing ? '拖动家具摆放，双指仍可缩放；点「完成」保存' : '双指缩放，放大后单指移动；轻点奶团互动';
      o.props.setAttribute('aria-hidden', String(!editing));
      items.forEach(function (it) { it.el.tabIndex = editing ? 0 : -1; it.el.setAttribute('aria-hidden', String(!editing)); });
      o.cat.disabled = editing;
      picker.innerHTML = '';
      items.filter(function (it) { return !it.el.hidden; }).forEach(function (it) {
        var option = document.createElement('option'); option.value = it.key; option.textContent = it.name; picker.appendChild(option);
      });
      if (editing) select(selected && !selected.el.hidden ? selected : items.filter(function (it) { return !it.el.hidden; })[0] || null);
      else select(null);
    }
    function stopPointers() {
      var ids = Array.from(points.keys()); points.clear(); gesture = null;
      ids.forEach(function (id) { if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id); });
      stage.classList.remove('room-dragging');
    }
    function finish(cancel) {
      if (!editing) return;
      stopPointers();
      if (!cancel) o.commit(cleanLayout(draft));
      editing = false; editUI(); paintLayout();
    }
    function refresh() {
      enabled = o.enabled(); tools.hidden = !enabled; stage.classList.toggle('room-ready', enabled);
      if (!enabled) { finish(); stopPointers(); view = { scale: 1, x: 0, y: 0 }; }
      if (!editing) paintLayout();
      editUI(); drawView();
    }
    function beginGesture(target) {
      var ps = Array.from(points.values());
      if (ps.length >= 2) {
        multi = moved = true;
        var mid = local({ x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 });
        gesture = { kind: 'pinch', distance: Math.max(1, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)), scale: view.scale,
          anchor: { x: (mid.x - view.x) / view.scale, y: (mid.y - view.y) / view.scale } };
      } else if (ps.length === 1) {
        var el = target && target.closest('[data-room-item]'), it = editing && !multi && el && byKey[el.dataset.roomItem];
        if (it) { select(it); it.el.focus({ preventScroll: true }); }
        gesture = { kind: it ? 'item' : 'pan', start: ps[0], x: view.x, y: view.y, item: it, center: it ? center(it) : null,
          pet: !editing && !multi && target && o.cat.contains(target) };
      } else gesture = null;
    }
    stage.addEventListener('pointerdown', function (e) {
      if (!enabled || !o.enabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      if (!points.size) { moved = false; multi = false; }
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.setPointerCapture(e.pointerId); beginGesture(e.target);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!points.has(e.pointerId) || !gesture) return;
      e.preventDefault(); points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var ps = Array.from(points.values()), g = gesture;
      if (g.kind === 'pinch') {
        var mid = local({ x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 });
        view.scale = limit(g.scale * Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) / g.distance, 1, 3);
        view.x = mid.x - g.anchor.x * view.scale; view.y = mid.y - g.anchor.y * view.scale; drawView();
      } else {
        var dx = ps[0].x - g.start.x, dy = ps[0].y - g.start.y;
        if (!moved && Math.hypot(dx, dy) < 8) return;
        moved = true; stage.classList.add('room-dragging');
        if (g.kind === 'item') place(g.item, { x: g.center.x + dx / scene.clientWidth / view.scale, y: g.center.y + dy / scene.clientHeight / view.scale });
        else { view.x = g.x + dx / scene.clientWidth; view.y = g.y + dy / scene.clientHeight; drawView(); }
      }
    });
    function endPointer(e) {
      if (!points.has(e.pointerId)) return;
      var tap = e.type === 'pointerup' && points.size === 1 && !moved && !multi && gesture && gesture.pet;
      points.delete(e.pointerId);
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      beginGesture(null);
      if (!points.size) stage.classList.remove('room-dragging');
      if (tap) o.pet(e);
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('lostpointercapture', endPointer);
    stage.addEventListener('wheel', function (e) {
      if (!enabled || !o.enabled()) return;
      e.preventDefault(); zoom(view.scale * Math.exp(-e.deltaY * 0.002), local({ x: e.clientX, y: e.clientY }));
    }, { passive: false });
    zoomIn.addEventListener('click', function () { zoom(view.scale + 0.25); });
    zoomOut.addEventListener('click', function () { zoom(view.scale - 0.25); });
    $('roomResetView').addEventListener('click', function () { stopPointers(); view = { scale: 1, x: 0, y: 0 }; drawView(); });
    arrange.addEventListener('click', function () {
      if (editing) finish();
      else { stopPointers(); draft = cleanLayout(o.layout()); editing = true; editUI(); }
    });
    picker.addEventListener('change', function () { select(byKey[picker.value]); if (selected) selected.el.focus({ preventScroll: true }); });
    $('roomResetItem').addEventListener('click', function () { if (selected) { delete draft[selected.key]; apply(selected, null); } });
    $('roomCancel').addEventListener('click', function () { finish(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && editing) finish(true); });
    window.addEventListener('blur', stopPointers);
    window.addEventListener('pagehide', function () { finish(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { finish(); stopPointers(); } });
    new ResizeObserver(function () { stopPointers(); drawView(); paintLayout(); }).observe(stage);
    return { refresh: refresh, finish: finish, isEditing: function () { return editing; } };
  }
  window.NaituanRoom = { create: create, cleanLayout: cleanLayout };
})();
