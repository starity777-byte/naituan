(function () {
  'use strict';
  function distance(a, b, aspect) { return Math.hypot(b.x - a.x, (b.y - a.y) * aspect); }
  function inside(p, r) { return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom; }

  // A small visibility graph around furniture feet and the room's wall line.
  // All values are room coordinates; camera zoom never changes the route.
  function planRoute(from, target, options) {
    var constrain = options.constrain, aspect = options.aspect || 1;
    from = constrain(from); target = constrain(target);
    var blocks = (options.obstacles || []).filter(function (r) { return !inside(from, r); });
    function free(p) {
      var q = constrain(p);
      return distance(p, q, aspect) < 0.0001 && !blocks.some(function (r) { return inside(p, r); });
    }
    function clear(a, b) {
      var count = Math.max(1, Math.ceil(distance(a, b, aspect) / 0.012));
      for (var n = 1; n <= count; n++) {
        var t = n / count;
        if (!free({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
      }
      return true;
    }
    if (!free(target)) return null;
    if (clear(from, target)) return [target];
    var nodes = [from, target];
    function add(p) { if (free(p)) nodes.push(p); }
    blocks.forEach(function (r) {
      [r.left - 0.008, r.right + 0.008].forEach(function (x) {
        [r.top - 0.008, r.bottom + 0.008].forEach(function (y) { add({ x: x, y: y }); });
      });
    });
    for (var x = 0.05; x < 1; x += 0.05) {
      add(constrain({ x: x, y: options.floorY(x) + 0.025 }));
      add(constrain({ x: x, y: 0.97 }));
    }
    var costs = nodes.map(function () { return Infinity; }), previous = [], visited = [];
    costs[0] = 0;
    for (var step = 0; step < nodes.length; step++) {
      var best = -1;
      for (var i = 0; i < nodes.length; i++) if (!visited[i] && (best < 0 || costs[i] < costs[best])) best = i;
      if (best < 0 || !Number.isFinite(costs[best])) return null;
      if (best === 1) {
        var route = [], at = 1;
        while (at !== 0) { route.unshift(nodes[at]); at = previous[at]; }
        return route;
      }
      visited[best] = true;
      for (var j = 1; j < nodes.length; j++) {
        var cost = costs[best] + distance(nodes[best], nodes[j], aspect);
        if (!visited[j] && cost < costs[j] && clear(nodes[best], nodes[j])) { costs[j] = cost; previous[j] = best; }
      }
    }
    return null;
  }

  function create(o) {
    var motion = null, frame = 0;
    function stop(reason) {
      if (!motion) return;
      var old = motion; motion = null;
      cancelAnimationFrame(frame); frame = 0;
      o.stopped(old.point, reason || 'cancelled');
    }
    function advance(time) {
      var m = motion;
      if (!m) return;
      if (!o.enabled()) { stop(); return; }
      var dt = m.last == null ? 0 : Math.min(0.05, (time - m.last) / 1000);
      m.last = time;
      var to = m.route[m.index], dx = to.x - m.point.x, dy = to.y - m.point.y;
      var length = distance(m.point, to, o.aspect()), step = dt * 0.16 * o.depthScale(m.point);
      var ratio = length < 0.0001 ? 1 : Math.min(1, step / length);
      m.point = o.place({ x: m.point.x + dx * ratio, y: m.point.y + dy * ratio });
      o.moved(m.point, { x: dx, y: dy });
      if (ratio === 1 && ++m.index === m.route.length) {
        var arrive = m.arrive, point = m.point;
        stop('arrived');
        if (arrive) arrive(point);
        return;
      }
      if (motion === m) frame = requestAnimationFrame(advance);
    }
    function go(target, arrive, key) {
      stop('retargeted');
      var point = o.position(), route = o.route(point, target, key);
      if (!route) return false;
      motion = { point: point, route: route, index: 0, arrive: arrive, last: null };
      frame = requestAnimationFrame(advance);
      return true;
    }
    return { go: go, stop: stop, active: function () { return !!motion; } };
  }
  window.NaituanWalk = { planRoute: planRoute, create: create };
})();
