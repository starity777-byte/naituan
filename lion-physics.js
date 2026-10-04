(function (root) {
  'use strict';
  /* 合成大狮子的物理：一个只处理圆的小世界。
     世界尺寸固定（宽 340、高 470 个单位），和屏幕大小无关；画面再按比例缩放。
     用位置修正（PBD）：先按重力积分，再反复把重叠的圆推开，最后由位移反推速度，叠起来比较稳。
     相同等级的圆碰到就合成下一级；最高级的两个碰到就一起消失。 */
  var DEFAULTS = {
    width: 340, height: 470, lineY: 76, holdY: 36,
    gravity: 1500, damping: .06, contactDamping: 2.2, substeps: 4, iterations: 5,
    mergeGap: 1.5, graceSeconds: .9, restSpeed: 28, overSeconds: 2.2,
    maxSpeed: 1200, ceiling: -60, growStart: .72, growSeconds: .16
  };
  /* 各级半径（占容器宽度的比例）：13 级，每级大约大 16%，最大的一只直径略过容器一半。 */
  var RADIUS_RATIO = [.044, .051, .059, .069, .08, .092, .107, .124, .144, .167, .194, .224, .26];

  function create(options) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in (options || {})) if (options[k] !== undefined) o[k] = options[k];
    var radii = o.radii || RADIUS_RATIO.map(function (ratio) { return ratio * o.width; });
    var top = radii.length - 1, rng = o.rng || Math.random;
    var world = { width: o.width, height: o.height, lineY: o.lineY, holdY: o.holdY, radii: radii, top: top, bodies: [], events: [], time: 0, nextId: 1, over: false, danger: 0 };

    function radius(level) { return radii[level]; }
    /* grow：合成出来的新动物从小一点开始，慢慢长到该有的大小，周围的动物是被一点点挤开的。
       起始半径取「不压到任何邻居」的最大值（比如卡在两个圆缝里的小球），再慢慢长；
       一下子变大会产生很深的重叠，位置修正会把邻居弹飞。 */
    function add(level, x, y, vx, vy, grow) {
      var rt = radii[level], r = rt;
      if (grow) {
        r = rt * o.growStart;
        for (var n = 0; n < world.bodies.length; n++) {
          var other = world.bodies[n], gap = Math.sqrt((other.x - x) * (other.x - x) + (other.y - y) * (other.y - y)) - other.r - .3;
          if (gap < r) r = gap;
        }
        r = Math.max(rt * .3, r);
      }
      var body = { grow: rt * (1 - o.growStart) / o.growSeconds, id: world.nextId++, lvl: level, rt: rt, r: r, x: Math.min(Math.max(x, r), o.width - r), y: Math.min(y, o.height - r), vx: vx || 0, vy: vy || 0, px: x, py: y, born: world.time, age: 0, over: 0, contact: 0 };
      world.bodies.push(body);
      return body;
    }
    function emit(event) { world.events.push(event); }

    function solveWalls(b) {
      if (b.x < b.r) { b.x = b.r; b.contact++; }
      else if (b.x > o.width - b.r) { b.x = o.width - b.r; b.contact++; }
      if (b.y > o.height - b.r) { b.y = o.height - b.r; b.contact++; }
      else if (b.y < o.ceiling + b.r) { b.y = o.ceiling + b.r; if (b.vy < 0) b.vy = 0; } /* 保险：不会飞出画面太远 */
    }
    function solvePair(a, b) {
      var dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= min * min) return;
      var d = Math.sqrt(d2), nx, ny;
      if (d < 1e-6) { var angle = rng() * Math.PI * 2; nx = Math.cos(angle); ny = Math.sin(angle); d = 0; }
      else { nx = dx / d; ny = dy / d; }
      var overlap = min - d, ia = 1 / (a.r * a.r), ib = 1 / (b.r * b.r), sum = ia + ib;
      a.x -= nx * overlap * ia / sum; a.y -= ny * overlap * ia / sum;
      b.x += nx * overlap * ib / sum; b.y += ny * overlap * ib / sum;
      a.contact++; b.contact++;
    }
    function mergePass() {
      var list = world.bodies, dead = {}, born = [], i, j, a, b;
      for (i = 0; i < list.length; i++) {
        a = list[i]; if (dead[a.id]) continue;
        for (j = i + 1; j < list.length; j++) {
          b = list[j]; if (dead[b.id] || a.lvl !== b.lvl) continue;
          var dx = b.x - a.x, dy = b.y - a.y, reach = a.r + b.r + o.mergeGap;
          if (dx * dx + dy * dy > reach * reach) continue;
          dead[a.id] = dead[b.id] = true;
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (a.lvl >= top) { emit({ type: 'vanish', level: a.lvl, x: mx, y: my }); }
          else { born.push({ level: a.lvl + 1, x: mx, y: my, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2, from: a.lvl }); }
          break;
        }
      }
      if (!Object.keys(dead).length) return;
      world.bodies = list.filter(function (body) { return !dead[body.id]; });
      born.forEach(function (item) {
        var body = add(item.level, item.x, item.y, item.vx, item.vy, true);
        body.age = o.graceSeconds; /* 合成出来的不算刚放下的 */
        emit({ type: 'merge', level: item.level, from: item.from, x: item.x, y: item.y, id: body.id });
      });
    }
    function step(dt) {
      if (world.over) return;
      var sub = o.substeps, h = dt / sub, s, it, i, j, list, b;
      for (s = 0; s < sub; s++) {
        list = world.bodies;
        for (i = 0; i < list.length; i++) {
          b = list[i]; b.contact = 0;
          if (b.r < b.rt) b.r = Math.min(b.rt, b.r + b.grow * h);
          b.vy += o.gravity * h;
          var damp = Math.max(0, 1 - o.damping * h);
          b.vx *= damp; b.vy *= damp;
          b.px = b.x; b.py = b.y; b.x += b.vx * h; b.y += b.vy * h;
        }
        for (it = 0; it < o.iterations; it++) {
          for (i = 0; i < list.length; i++) for (j = i + 1; j < list.length; j++) solvePair(list[i], list[j]);
          for (i = 0; i < list.length; i++) solveWalls(list[i]); /* 墙放在最后，保证不会挤出容器 */
        }
        for (i = 0; i < list.length; i++) {
          b = list[i];
          b.vx = (b.x - b.px) / h; b.vy = (b.y - b.py) / h;
          if (b.contact) { var f = Math.max(0, 1 - o.contactDamping * h); b.vx *= f; b.vy *= f; }
          var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (speed > o.maxSpeed) { b.vx *= o.maxSpeed / speed; b.vy *= o.maxSpeed / speed; }
        }
        mergePass();
      }
      world.time += dt;
      var worst = 0;
      world.bodies.forEach(function (body) {
        body.age += dt;
        var speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
        if (body.age > o.graceSeconds && speed < o.restSpeed && body.y - body.r < o.lineY) body.over += dt;
        else body.over = Math.max(0, body.over - dt * 2);
        worst = Math.max(worst, body.over);
      });
      world.danger = Math.min(1, worst / o.overSeconds);
      if (worst >= o.overSeconds) { world.over = true; emit({ type: 'over' }); }
    }
    world.add = add; world.step = step; world.radius = radius;
    world.drain = function () { var list = world.events; world.events = []; return list; };
    return world;
  }

  var api = { create: create, RADIUS_RATIO: RADIUS_RATIO, DEFAULTS: DEFAULTS };
  root.NaituanLionPhysics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
