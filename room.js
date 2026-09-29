(function () {
  'use strict';
  var KEYS = ['win', 'rug', 'prop:yarn', 'prop:cushion', 'prop:plant', 'prop:lamp', 'prop:frame', 'prop:lights'];
  KEYS = KEYS.concat(window.NaituanDecor.items.map(function (it) { return 'prop:' + it.id; }));
  function limit(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function cleanPoint(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: limit(p.x, 0, 1), y: limit(p.y, 0, 1) } : null;
  }
  function cleanLayout(value) {
    var out = {};
    KEYS.forEach(function (key) {
      var p = value && value[key], point = cleanPoint(p);
      if (point) {
        point.scale = Number.isFinite(p.scale) ? limit(p.scale, 0.5, 2) : 1;
        point.flipX = p.flipX === true; point.flipY = p.flipY === true;
        out[key] = point;
      }
    });
    return out;
  }
  function create(o) {
    var stage = o.stage, scene = o.scene, tools = o.tools, catBox = o.catBox || o.cat.parentElement, catShadow = o.catShadow;
    var $ = function (id) { return tools.querySelector('#' + id); };
    var zoomIn = $('roomZoomIn'), zoomOut = $('roomZoomOut'), label = $('roomZoomLabel');
    var arrange = $('roomArrange'), editTools = $('roomEditTools'), picker = $('roomItem'), tip = $('roomTip');
    var size = $('roomSize'), sizeLabel = $('roomSizeLabel'), smaller = $('roomSmaller'), bigger = $('roomBigger');
    var flipX = $('roomFlipX'), flipY = $('roomFlipY');
    var view = { scale: 1, x: 0, y: 0 }, points = new Map(), gesture = null;
    var editing = false, draft = {}, selected = null, moved = false, multi = false, enabled = false, walker = null;
    var items = o.items, byKey = {};
    items.forEach(function (it) {
      byKey[it.key] = it; it.el.dataset.roomItem = it.key;
      it.el.setAttribute('role', 'button');
      it.el.addEventListener('keydown', function (e) {
        if (!enabled || !o.enabled() || it.el.hidden) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (editing) select(it);
          else if (o.interactItem) o.interactItem(it.key);
          return;
        }
        if (!editing) return;
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
      if (o.onCatMove) o.onCatMove();
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
    function floorY(x) {
      var edge = o.floorBoundary ? o.floorBoundary() : [[0, 0.63], [1, 0.63]];
      x = limit(x, 0, 1);
      for (var i = 1; i < edge.length; i++) {
        if (x <= edge[i][0]) {
          var a = edge[i - 1], b = edge[i], t = (x - a[0]) / (b[0] - a[0]);
          return a[1] + (b[1] - a[1]) * t + 0.008;
        }
      }
      return edge[edge.length - 1][1] + 0.008;
    }
    function depthScale(p) {
      var wall = floorY(p.x);
      return 0.56 + 0.48 * limit((p.y - wall) / (0.985 - wall), 0, 1);
    }
    // Positions use room coordinates, independent of the camera's pan and zoom.
    // Furniture positions are rectangle centers; the cat position is its feet.
    function getCatPosition() {
      var r = catBox.getBoundingClientRect(), s = scene.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - s.left) / s.width, y: (r.bottom - s.top) / s.height };
    }
    function boundCat(p, surface) {
      for (var i = 0; i < 2; i++) {
        var scale = surface ? 1 : depthScale(p);
        var hx = Math.min(0.5, catBox.offsetWidth * scale / scene.clientWidth / 2);
        var height = Math.min(0.985, catBox.offsetHeight * scale / scene.clientHeight);
        var x = limit(p.x, hx, 1 - hx);
        p = { x: x, y: limit(p.y, Math.max(height, surface ? 0 : floorY(x)), 0.985) };
      }
      return p;
    }
    function placeCat(p, persist, options) {
      p = cleanPoint(p);
      if (!p) return null;
      var surface = !!(options && options.surface);
      p = boundCat(p, surface);
      var scale = surface ? 1 : depthScale(p);
      catBox.style.left = p.x * 100 + '%'; catBox.style.top = p.y * 100 + '%';
      catBox.style.right = 'auto'; catBox.style.bottom = 'auto';
      catBox.style.transform = 'translate(-50%,-100%) scale(' + scale + ',' + scale + ')';
      catBox.dataset.depthScale = scale.toFixed(3);
      var support = options && options.onItem && getItemGeometry(options.onItem);
      catBox.style.zIndex = editing ? 3 : 20 + Math.round(Math.max(p.y, support ? support.center.y + support.size.height * 0.45 : 0) * 1000);
      if (catShadow) {
        catShadow.hidden = surface;
        catShadow.style.left = p.x * 100 + '%'; catShadow.style.top = p.y * 100 + '%';
        var width = catBox.offsetWidth * scale * 0.46;
        catShadow.style.width = width + 'px'; catShadow.style.height = width * 0.16 + 'px';
      }
      if (persist && o.commitCat) o.commitCat(p);
      if (o.onCatMove) o.onCatMove();
      return p;
    }
    function restoreCat() {
      var p = cleanPoint(o.catPosition && o.catPosition());
      if (p) return placeCat(p);
      ['left', 'top', 'right', 'bottom', 'transform'].forEach(function (key) { catBox.style[key] = ''; });
      return placeCat(getCatPosition());
    }
    function getItemGeometry(key) {
      var it = byKey[key];
      if (!it || it.el.hidden) return null;
      var r = it.el.getBoundingClientRect(), s = scene.getBoundingClientRect();
      if (!r.width || !r.height || !s.width || !s.height) return null;
      var anchors = {}, definitions = Object.assign({ approach: { x: 0.5, y: 0.95 }, rest: { x: 0.5, y: 0.68 }, watch: { x: 0.5, y: 0.92 } }, it.anchors);
      var layout = editing ? draft : o.layout(), transform = layout[key] || {};
      Object.keys(definitions).forEach(function (name) {
        var p = cleanPoint(definitions[name]);
        if (p) {
          if (transform.flipX) p.x = 1 - p.x;
          if (transform.flipY) p.y = 1 - p.y;
          anchors[name] = { x: (r.left + r.width * p.x - s.left) / s.width, y: (r.top + r.height * p.y - s.top) / s.height };
        }
      });
      return { key: key, center: center(it), size: { width: r.width / s.width, height: r.height / s.height }, anchors: anchors };
    }
    function itemPoint(key, anchor) {
      var geometry = getItemGeometry(key);
      return geometry && geometry.anchors[anchor || 'approach'] || null;
    }
    function walkObstacles(except) {
      var padding = catBox.offsetWidth / scene.clientWidth * 0.09;
      return items.filter(function (it) { return it.obstacle && it.key !== except && !it.el.hidden; }).map(function (it) {
        var g = getItemGeometry(it.key);
        if (!g || g.size.width < 0.09) return null;
        var bottom = g.center.y + g.size.height * 0.45;
        if (bottom < floorY(g.center.x) + 0.02) return null;
        return { left: g.center.x - g.size.width * 0.34 - padding, right: g.center.x + g.size.width * 0.34 + padding,
          top: bottom - Math.min(0.09, g.size.height * 0.3) - 0.015, bottom: bottom + 0.02 };
      }).filter(Boolean);
    }
    function stopWalk() { if (walker) walker.stop(); }
    function walkTo(point, arrive, key) {
      if (!walker) walker = window.NaituanWalk.create({
        position: getCatPosition, place: placeCat, depthScale: depthScale,
        aspect: function () { return scene.clientHeight / scene.clientWidth; },
        enabled: function () { return enabled && o.enabled() && !editing && !points.size && !document.hidden; },
        route: function (from, to, target) { return window.NaituanWalk.planRoute(from, to, {
          constrain: boundCat, floorY: floorY, aspect: scene.clientHeight / scene.clientWidth, obstacles: walkObstacles(target)
        }); },
        moved: function (p, direction) { if (o.walkStep) o.walkStep(p, direction); },
        stopped: function (p) {
          catBox.classList.remove('room-cat-walking');
          if (o.commitCat) o.commitCat(p);
          if (o.walkStop) o.walkStop();
        }
      });
      var started = walker.go(point, arrive, key);
      catBox.classList.toggle('room-cat-walking', started);
      return started;
    }
    function itemScale(it, p) {
      var manual = p.scale || 1, scale = manual;
      if (!it.depthAware) return scale;
      var halfHeight = it.el.offsetHeight / scene.clientHeight / 2;
      // Resolve the bed's ground contact, since scaling changes its bottom edge.
      for (var i = 0; i < 4; i++) scale = manual * depthScale({ x: p.x, y: p.y + halfHeight * scale });
      return scale;
    }
    function bounded(it, p) {
      var scale = itemScale(it, p);
      var hx = Math.min(0.5, it.el.offsetWidth * scale / scene.clientWidth / 2);
      var hy = Math.min(0.5, it.el.offsetHeight * scale / scene.clientHeight / 2);
      var x = limit(p.x, hx, 1 - hx);
      var minY = it.depthAware ? Math.max(hy, floorY(x) - hy) : hy;
      return { x: x, y: limit(p.y, minY, (it.depthAware ? 0.985 : 1) - hy), scale: p.scale || 1, flipX: !!p.flipX, flipY: !!p.flipY };
    }
    function apply(it, p) {
      if (!p && it.depthAware && !it.el.hidden) {
        ['left', 'top', 'right', 'bottom', 'transform'].forEach(function (key) { it.el.style[key] = ''; });
        p = Object.assign(center(it), { scale: 1 });
      }
      if (p) {
        p = bounded(it, p);
        it.el.style.left = p.x * 100 + '%'; it.el.style.top = p.y * 100 + '%';
        it.el.style.right = 'auto'; it.el.style.bottom = 'auto';
        var scale = itemScale(it, p);
        it.el.style.transform = 'translate(-50%,-50%) scale(' + scale * (p.flipX ? -1 : 1) + ',' + scale * (p.flipY ? -1 : 1) + ')';
        it.el.dataset.depthScale = (scale / p.scale).toFixed(3);
      } else ['left', 'top', 'right', 'bottom', 'transform'].forEach(function (key) { it.el.style[key] = ''; });
    }
    function paintLayout() {
      var layout = editing ? draft : o.layout();
      items.forEach(function (it) { apply(it, layout[it.key]); });
      items.forEach(function (it) {
        if (!it.obstacle || it.el.hidden) return;
        var g = getItemGeometry(it.key);
        if (g) it.el.style.zIndex = editing ? '' : 10 + Math.round((g.center.y + g.size.height * 0.45) * 1000);
      });
    }
    function place(it, p) {
      draft[it.key] = bounded(it, Object.assign({ scale: 1, flipX: false, flipY: false }, draft[it.key], p));
      apply(it, draft[it.key]);
    }
    function transformUI() {
      var p = selected && draft[selected.key] || {}, percent = Math.round((p.scale || 1) * 100);
      size.value = percent; sizeLabel.textContent = percent + '%';
      size.disabled = flipX.disabled = flipY.disabled = $('roomResetItem').disabled = !selected;
      smaller.disabled = !selected || percent <= 50; bigger.disabled = !selected || percent >= 200;
      flipX.setAttribute('aria-pressed', String(!!p.flipX)); flipY.setAttribute('aria-pressed', String(!!p.flipY));
      ['roomLeft', 'roomRight', 'roomUp', 'roomDown'].forEach(function (id) { $(id).disabled = !selected; });
    }
    function resizeItem(percent) {
      if (!editing || !selected) return;
      place(selected, Object.assign(center(selected), { scale: limit(percent / 100, 0.5, 2) })); transformUI();
    }
    function select(it) {
      selected = it;
      items.forEach(function (item) { item.el.classList.toggle('room-selected', item === it); });
      if (it) picker.value = it.key;
      transformUI();
    }
    function editUI() {
      scene.classList.toggle('arranging', editing); editTools.hidden = !editing;
      catBox.style.zIndex = editing ? 3 : 20 + Math.round(getCatPosition().y * 1000);
      arrange.textContent = editing ? '完成' : '布置'; arrange.setAttribute('aria-pressed', String(editing));
      tip.textContent = editing ? '拖动家具 · 下方调大小和镜像 · 双指缩放房间' : '轻点摸摸，长按脸颊蹭蹭，拖动抱起；双指只缩放房间';
      o.props.setAttribute('aria-hidden', 'false');
      items.forEach(function (it) {
        if (editing) it.el.style.zIndex = '';
        it.el.tabIndex = it.el.hidden ? -1 : 0;
        it.el.setAttribute('aria-hidden', String(!!it.el.hidden));
        it.el.setAttribute('aria-label', (editing ? '摆放' : '与') + it.name + (editing ? '' : '互动'));
      });
      o.cat.disabled = editing;
      picker.innerHTML = '';
      items.filter(function (it) { return !it.el.hidden; }).forEach(function (it) {
        var option = document.createElement('option'); option.value = it.key; option.textContent = it.name; picker.appendChild(option);
      });
      if (editing) select(selected && !selected.el.hidden ? selected : items.filter(function (it) { return !it.el.hidden; })[0] || null);
      else select(null);
    }
    function endHold(g, cancelled) {
      if (!g) return;
      clearTimeout(g.holdTimer); g.holdTimer = null;
      if (g.held) {
        g.held = false;
        if (o.endPetHold) o.endPetHold(cancelled);
      }
    }
    function cancelGesture() {
      var g = gesture;
      if (!g) return;
      endHold(g, true);
      if (g.kind === 'cat' && g.dragging) placeCat(g.center);
      catBox.classList.remove('room-cat-dragging');
      if (catShadow) catShadow.classList.remove('lifted');
      if (o.onCatMove) o.onCatMove();
    }
    function stopPointers() {
      stopWalk();
      cancelGesture();
      var ids = Array.from(points.keys()); points.clear(); gesture = null; multi = moved = false;
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
      editUI(); drawView(); restoreCat();
      if (o.onLayout) o.onLayout();
    }
    function beginGesture(target) {
      var ps = Array.from(points.values());
      if (ps.length >= 2) {
        cancelGesture();
        multi = moved = true;
        var mid = local({ x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 });
        gesture = { kind: 'pinch', distance: Math.max(1, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)), scale: view.scale,
          anchor: { x: (mid.x - view.x) / view.scale, y: (mid.y - view.y) / view.scale } };
      } else if (ps.length === 1) {
        var el = target && target.closest('[data-room-item]'), it = !multi && el && byKey[el.dataset.roomItem];
        var pet = !editing && !multi && target && o.cat.contains(target);
        if (it && editing) { select(it); it.el.focus({ preventScroll: true }); }
        gesture = { kind: pet ? 'cat' : it && editing ? 'item' : 'pan', start: ps[0], x: view.x, y: view.y, item: it,
          center: pet ? getCatPosition() : it ? center(it) : null, pet: pet, dragging: false, held: false };
        if (pet && o.petHold) {
          var g = gesture;
          g.holdTimer = setTimeout(function () {
            if (gesture !== g || points.size !== 1 || moved || multi || !enabled || !o.enabled() || editing) return;
            g.held = !!o.petHold({ clientX: g.start.x, clientY: g.start.y, target: target });
          }, 450);
        }
      } else gesture = null;
    }
    stage.addEventListener('pointerdown', function (e) {
      if (!enabled || !o.enabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      stopWalk();
      if (!points.size) { moved = false; multi = false; }
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.setPointerCapture(e.pointerId); beginGesture(e.target);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!points.has(e.pointerId) || !gesture) return;
      if (!o.enabled()) { stopPointers(); return; }
      e.preventDefault(); points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var ps = Array.from(points.values()), g = gesture;
      if (g.kind === 'pinch') {
        var mid = local({ x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 });
        view.scale = limit(g.scale * Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) / g.distance, 1, 3);
        view.x = mid.x - g.anchor.x * view.scale; view.y = mid.y - g.anchor.y * view.scale; drawView();
      } else {
        var dx = ps[0].x - g.start.x, dy = ps[0].y - g.start.y;
        if (!moved && Math.hypot(dx, dy) <= 8) return;
        moved = true; stage.classList.add('room-dragging');
        if (g.kind === 'cat') {
          endHold(g, true);
          if (!g.dragging) {
            g.dragging = true; catBox.classList.add('room-cat-dragging');
            if (catShadow) catShadow.classList.add('lifted');
            if (o.catDragStart) o.catDragStart();
          }
          placeCat({ x: g.center.x + dx / scene.clientWidth / view.scale, y: g.center.y + dy / scene.clientHeight / view.scale });
        } else if (g.kind === 'item') place(g.item, { x: g.center.x + dx / scene.clientWidth / view.scale, y: g.center.y + dy / scene.clientHeight / view.scale });
        else { view.x = g.x + dx / scene.clientWidth; view.y = g.y + dy / scene.clientHeight; drawView(); }
      }
    });
    function endPointer(e) {
      if (!points.has(e.pointerId)) return;
      var g = gesture, cancelled = e.type !== 'pointerup';
      var tap = !cancelled && points.size === 1 && !moved && !multi && g && !g.held;
      var petTap = tap && g.pet, itemTap = tap && !editing && g.item;
      var catDrop = !cancelled && points.size === 1 && !multi && g && g.kind === 'cat' && g.dragging;
      if (cancelled) { cancelGesture(); multi = true; }
      else endHold(g, false);
      if (catDrop) {
        if (o.commitCat) o.commitCat(getCatPosition());
        if (o.catDrop) o.catDrop();
      }
      points.delete(e.pointerId);
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      beginGesture(null);
      if (!points.size) { stage.classList.remove('room-dragging'); catBox.classList.remove('room-cat-dragging'); if (catShadow) catShadow.classList.remove('lifted'); }
      if (o.onCatMove) o.onCatMove();
      if (petTap) o.pet(e);
      else if (itemTap && o.interactItem) o.interactItem(itemTap.key);
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('lostpointercapture', endPointer);
    stage.addEventListener('wheel', function (e) {
      if (!enabled || !o.enabled()) return;
      stopPointers();
      e.preventDefault(); zoom(view.scale * Math.exp(-e.deltaY * 0.002), local({ x: e.clientX, y: e.clientY }));
    }, { passive: false });
    zoomIn.addEventListener('click', function () { stopPointers(); zoom(view.scale + 0.25); });
    zoomOut.addEventListener('click', function () { stopPointers(); zoom(view.scale - 0.25); });
    $('roomResetView').addEventListener('click', function () { stopPointers(); view = { scale: 1, x: 0, y: 0 }; drawView(); });
    arrange.addEventListener('click', function () {
      if (editing) finish();
      else { stopPointers(); draft = cleanLayout(o.layout()); editing = true; editUI(); }
    });
    picker.addEventListener('change', function () { select(byKey[picker.value]); });
    size.addEventListener('input', function () { resizeItem(Number(size.value)); });
    smaller.addEventListener('click', function () { resizeItem(Number(size.value) - 10); });
    bigger.addEventListener('click', function () { resizeItem(Number(size.value) + 10); });
    [['roomFlipX', 'flipX'], ['roomFlipY', 'flipY']].forEach(function (pair) {
      $(pair[0]).addEventListener('click', function () {
        if (!editing || !selected) return;
        var p = center(selected); p[pair[1]] = !(draft[selected.key] || {})[pair[1]];
        place(selected, p); transformUI();
      });
    });
    [['roomLeft', -1, 0], ['roomRight', 1, 0], ['roomUp', 0, -1], ['roomDown', 0, 1]].forEach(function (dir) {
      $(dir[0]).addEventListener('click', function () {
        if (!editing || !selected) return;
        var p = center(selected); place(selected, { x: p.x + dir[1] * 0.01, y: p.y + dir[2] * 0.01 });
      });
    });
    $('roomResetItem').addEventListener('click', function () { if (selected) { delete draft[selected.key]; apply(selected, null); transformUI(); } });
    $('roomCancel').addEventListener('click', function () { finish(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && editing) finish(true); });
    window.addEventListener('blur', stopPointers);
    window.addEventListener('pagehide', function () { finish(); stopPointers(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { finish(); stopPointers(); } });
    new ResizeObserver(function () {
      if (!scene.clientWidth || !scene.clientHeight) return;
      stopPointers(); drawView(); paintLayout(); restoreCat(); if (o.onLayout) o.onLayout();
    }).observe(stage);
    return { refresh: refresh, finish: finish, isEditing: function () { return editing; }, cancelInteraction: stopPointers,
      getCatPosition: getCatPosition, placeCat: placeCat, restoreCat: restoreCat, itemPoint: itemPoint, getItemGeometry: getItemGeometry,
      floorY: floorY, depthScale: depthScale, groundPoint: boundCat, walkTo: walkTo, stopWalk: stopWalk,
      isWalking: function () { return !!walker && walker.active(); }, isInteracting: function () { return editing || points.size > 0; },
      visibleItems: function () { return items.filter(function (it) { return !it.el.hidden; }).map(function (it) { return it.key; }); } };
  }
  window.NaituanRoom = { create: create, cleanLayout: cleanLayout, cleanPoint: cleanPoint };
})();
