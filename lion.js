/* 合成大狮子：把一样的动物碰在一起，合成更大的一种，一路合成到最大的白虎。
   物理在 lion-physics.js（只处理圆）；这里负责画面、操作、计分和存档。
   动物的图放在 assets/animals/animal01.webp … animal13.webp（也认 .png）；缺哪张就先用带名字的彩色圆代替，不用改代码。
   Q 弹只是画面效果：每只动物挂一个弹簧，碰撞时沿撞击方向被压扁、再弹回来晃几下；物理里的圆大小和弹起高度都不变。 */
(function () {
  'use strict';
  var NT = window.NT, PH = window.NaituanLionPhysics;
  var root = document.getElementById('ml'), btn = document.getElementById('btnLion');
  if (!NT || !PH || !root || !btn) return;

  var NAMES = ['小橘猫', '兔狲', '奶白猫', '狞猫', '云豹', '猞猁', '雪豹', '猎豹', '金钱豹', '黑豹', '狮子', '老虎', '白虎'];
  var COLORS = ['#f3c9a0', '#c9c6c4', '#fbe9dc', '#e8ad72', '#c9a77a', '#cdb59b', '#dcdcdc', '#efc27c', '#e9b45f', '#6b6670', '#d79a4f', '#f2a548', '#f6efe6'];
  var POOL = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
  var CHIME = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
  var INK = '#54392f', STEP = 1 / 60, HEAD = 46, FOOT = 42, FONT = '"Noto Sans SC", system-ui, sans-serif';
  var TOP = PH.RADIUS_RATIO.length - 1;

  root.innerHTML =
    '<div class="ml-play">' +
      '<div class="ml-bar"><span class="cq-chip" id="mlScore">0</span><span class="cq-chip" id="mlBest">最高 0</span><button class="hs-quit" id="mlQuit" type="button">不玩了</button></div>' +
      '<canvas id="mlCanvas" aria-label="合成大狮子：点一下或拖动选位置，放开就放下动物"></canvas>' +
    '</div>' +
    '<div class="sg-over" id="mlIntro" hidden><div class="sg-card" role="dialog" aria-label="合成大狮子的玩法">' +
      '<h2>合成大狮子</h2><p>点一下或拖动选位置，放开就放下动物。</p><p>两只一样的碰在一起，会变成更大的一种，一路合成到最大的白虎。</p><p>动物堆过虚线太久，这一局就结束啦。</p><p id="mlIntroBest"></p>' +
      '<div class="sg-btns"><button id="mlIntroBack" type="button">回房间</button><button id="mlGo" class="main" type="button">开始</button></div></div></div>' +
    '<div class="sg-over" id="mlOver" hidden><div class="sg-card" role="dialog" aria-label="本局结果">' +
      '<h2 id="mlTitle"></h2><p id="mlSub"></p><p id="mlTopLine"></p><p class="rew" id="mlRew"></p>' +
      '<div class="sg-btns"><button id="mlBack" type="button">回房间</button><button id="mlAgain" class="main" type="button">再来一次</button></div></div></div>';
  function $(selector) { return root.querySelector(selector); }
  var cv = $('#mlCanvas'), cx = cv.getContext('2d'), elScore = $('#mlScore'), elBest = $('#mlBest');
  var elIntro = $('#mlIntro'), elOver = $('#mlOver');

  var world = null, G = null, art = [], artStarted = false, raf = 0, last = 0, acc = 0, active = false;
  var view = { w: 0, h: 0, dpr: 1, scale: 1, ox: 0, oy: 0 };

  /* ---------- 动物的图 ---------- */
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tryLoad(index, exts) {
    if (!exts.length) { art[index] = null; return; }
    var image = new Image();
    image.onload = function () { art[index] = image; };
    image.onerror = function () { tryLoad(index, exts.slice(1)); };
    image.src = 'assets/animals/animal' + pad(index + 1) + '.' + exts[0];
  }
  function loadArt() {
    if (artStarted) return; artStarted = true;
    for (var i = 0; i <= TOP; i++) tryLoad(i, ['webp', 'png']);
  }
  function drawAnimal(level, x, y, r) {
    var image = art[level];
    if (image) { var k = 1.1; cx.drawImage(image, x - r * k, y - r * k, r * 2 * k, r * 2 * k); return; }
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fillStyle = COLORS[level]; cx.fill(); cx.lineWidth = Math.max(1.5, Math.min(3, r * .12)); cx.strokeStyle = INK; cx.stroke();
    cx.beginPath(); cx.arc(x - r * .3, y - r * .32, r * .38, Math.PI * 1.05, Math.PI * 1.55);
    cx.strokeStyle = 'rgba(255,255,255,.65)'; cx.lineWidth = Math.max(1.5, r * .1); cx.lineCap = 'round'; cx.stroke();
    if (level === TOP) { /* 最大一只的小皇冠 */
      cx.beginPath(); cx.moveTo(x - r * .42, y - r * .78); cx.lineTo(x - r * .42, y - r * 1.1); cx.lineTo(x - r * .14, y - r * .92); cx.lineTo(x, y - r * 1.16); cx.lineTo(x + r * .14, y - r * .92); cx.lineTo(x + r * .42, y - r * 1.1); cx.lineTo(x + r * .42, y - r * .78); cx.closePath();
      cx.fillStyle = '#ffe27a'; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = Math.max(1.5, r * .06); cx.stroke();
    }
    if (r >= 9) {
      cx.fillStyle = INK; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.font = '600 ' + Math.max(8, Math.min(r * .46, 20)) + 'px ' + FONT;
      cx.fillText(r >= 21 ? NAMES[level] : String(level + 1), x, y + r * .04);
    }
  }

  /* ---------- 一局的状态 ---------- */
  function pick() { return POOL[Math.floor(Math.random() * POOL.length)]; }
  function newGame() {
    world = PH.create();
    G = { state: 'idle', score: 0, held: pick(), next: pick(), aimX: world.width / 2, aiming: false, cool: 0, combo: 0, comboAt: -9, topLevel: -1, lion: false, parts: [], pops: [], settled: false, earned: 0, record: false, shake: 0, overAt: 0, landAt: -9 };
    acc = 0; paintBar(); elOver.hidden = true;
  }
  function paintBar() {
    var S = NT.S();
    elScore.textContent = G ? G.score : 0;
    elBest.textContent = '最高 ' + Math.max(S.bestLion || 0, G ? G.score : 0);
  }
  function canDrop() { return active && G && G.state === 'play' && G.held != null && G.cool <= 0 && !world.over; }
  function clampAim(x) { var r = G.held != null ? world.radius(G.held) : 20; return Math.max(r, Math.min(world.width - r, x)); }
  function drop() {
    if (!canDrop()) return;
    G.aimX = clampAim(G.aimX);
    world.add(G.held, G.aimX, world.holdY, 0, 0);
    G.held = null; G.cool = .5; NT.sound('tap');
  }
  function addPop(text, x, y, color, size) { G.pops.push({ text: text, x: x, y: y, life: 0, max: 1, color: color || INK, size: size || 15 }); }
  function burst(x, y, color, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (.4 + Math.random() * .6) * speed;
      G.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * .25, life: 0, max: .45 + Math.random() * .3, color: color, size: 2 + Math.random() * 3 });
    }
  }
  function handleEvents() {
    world.drain().forEach(function (e) {
      if (e.type === 'merge') {
        var points = e.level * (e.level + 1) / 2, now = world.time;
        G.combo = now - G.comboAt < .9 ? G.combo + 1 : 1; G.comboAt = now;
        var bonus = G.combo >= 2 ? G.combo * 2 : 0;
        G.score += points + bonus;
        var body = world.bodies.filter(function (b) { return b.id === e.id; })[0]; if (body) kick(body, 1, Math.PI / 2, 1.15);
        burst(e.x, e.y, COLORS[e.level], 8 + e.level, 120 + e.level * 12);
        addPop('+' + (points + bonus), e.x, e.y - world.radius(e.level), INK, 14 + Math.min(8, e.level));
        if (G.combo >= 2) addPop('连击 ×' + G.combo, e.x, e.y - world.radius(e.level) - 20, '#c4694f', 14);
        NT.sound('jelly', CHIME[Math.min(e.level - 1, CHIME.length - 1)] - 7);
        NT.sound('chime', CHIME[Math.min(e.level - 1, CHIME.length - 1)], .05);
        if (e.level > G.topLevel) { G.topLevel = e.level; G.topAt = performance.now(); }
        if (e.level === TOP && !G.lion) { G.lion = true; G.shake = .5; addPop('合成了' + NAMES[TOP] + '！', world.width / 2, world.height * .38, '#b9731f', 26); burst(e.x, e.y, '#ffd84d', 36, 260); NT.sound('fanfare'); }
      } else if (e.type === 'vanish') {
        G.score += 100; G.shake = .4; burst(e.x, e.y, '#ffd84d', 40, 280); addPop('+100 两只' + NAMES[TOP] + '一起消失！', e.x, e.y - 40, '#b9731f', 20); NT.sound('fanfare');
      } else if (e.type === 'over') {
        finish();
      }
    });
    paintBar();
  }
  function settle() {
    if (!G || G.settled || !G.score) return;
    G.settled = true;
    var S = NT.S(), top = Math.max(0, G.topLevel);
    G.record = G.score > (S.bestLion || 0);
    if (G.record) S.bestLion = G.score;
    if (top > (S.lionTop || 0)) S.lionTop = top;
    G.earned = Math.min(40, Math.floor(G.score / 100) + (top >= 7 ? top - 6 : 0) + (G.lion ? 10 : 0));
    S.mood = NT.clamp(S.mood + Math.min(20, Math.floor(G.score / 60))); S.hunger = NT.clamp(S.hunger - 2); S.energy = NT.clamp(S.energy - 3);
    NT.addFish(G.earned); NT.save();
  }
  function finish() {
    if (!G || G.state === 'over') return;
    G.state = 'over'; G.aiming = false; G.overAt = performance.now(); settle(); NT.sound('nope');
    setTimeout(function () {
      if (!active || !G || G.state !== 'over') return;
      var S = NT.S();
      $('#mlTitle').textContent = G.lion ? '合成了' + NAMES[TOP] + '！' : '堆满啦';
      $('#mlSub').textContent = '得分 ' + G.score + (G.record ? ' · 新纪录！' : ' · 最高 ' + (S.bestLion || 0));
      $('#mlTopLine').textContent = '这局合到了：' + NAMES[Math.max(0, G.topLevel)];
      $('#mlRew').textContent = '小鱼干 +' + G.earned;
      NT.paintWish($('#mlOver .sg-card'), leave);
      elOver.hidden = false;
      if (G.record || G.lion) NT.sound('fanfare'); else if (G.earned > 0) NT.sound('coin');
    }, 900);
  }
  function startGame() { elIntro.hidden = true; G.state = 'play'; G.cool = .2; }

  /* ---------- 画面 ---------- */
  function layout() {
    var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var availW = w - 16, availH = h - HEAD - FOOT - 6, scale = Math.min(availW / world.width, availH / world.height);
    var block = HEAD + world.height * scale + FOOT, top = Math.max(0, (h - block) / 2); /* 标题、容器、进化表作为一组，整体居中 */
    view = { w: w, h: h, dpr: dpr, scale: scale, ox: (w - world.width * scale) / 2, oy: top + HEAD, top: top };
  }
  function toWorldX(clientX) { var rect = cv.getBoundingClientRect(); return (clientX - rect.left - view.ox) / view.scale; }
  function X(x) { return view.ox + x * view.scale; }
  function Y(y) { return view.oy + y * view.scale; }
  /* ---------- Q 弹：每只动物一个小弹簧（只影响画面） ---------- */
  function springOf(body) {
    if (!body.jq) body.jq = { q: 0, v: 0, a: Math.PI / 2, lvx: body.vx, lvy: body.vy };
    return body.jq;
  }
  /* strength 0~1：压扁的力度；angle：被压的方向（撞击方向）；power：整体放大 */
  function kick(body, strength, angle, power) {
    var j = springOf(body), amount = strength * (power || 1) * (1 - body.lvl * .025);
    if (Math.abs(j.q) < amount * .6) j.a = angle;
    j.v += 30 * amount;
  }
  function wobble(body) {
    var j = springOf(body), dvx = body.vx - j.lvx, dvy = body.vy - j.lvy, dv = Math.sqrt(dvx * dvx + dvy * dvy);
    j.lvx = body.vx; j.lvy = body.vy;
    if (dv > 110) {
      var strength = Math.min(1, (dv - 110) / 520);
      kick(body, strength, Math.atan2(dvy, dvx));
      if (strength > .3 && world.time - G.landAt > .12) { G.landAt = world.time; NT.sound('jellysoft', CHIME[Math.min(body.lvl, 4)] - 5); }
    }
    var w = 25 - body.lvl * .45; /* 越大的动物晃得越慢 */
    j.v += (-w * w * j.q - 2 * .17 * w * j.v) * STEP;
    j.q += j.v * STEP;
    if (j.q > 1.25) { j.q = 1.25; if (j.v > 0) j.v = 0; } else if (j.q < -1.1) { j.q = -1.1; if (j.v < 0) j.v = 0; }
  }
  function jellyDraw(body, x, y, r) {
    var j = body.jq;
    if (!j || (Math.abs(j.q) < .01 && Math.abs(j.v) < .1)) { drawAnimal(body.lvl, x, y, r); return; }
    var along = 1 - .22 * j.q, across = 1 + .17 * j.q;
    cx.save(); cx.translate(x, y); cx.rotate(j.a); cx.scale(along, across); cx.rotate(-j.a); cx.translate(-x, -y);
    drawAnimal(body.lvl, x, y, r); cx.restore();
  }
  function draw() {
    if (!view.w) return;
    var s = view.scale, W = world.width, H = world.height;
    cx.clearRect(0, 0, view.w, view.h);
    cx.save();
    if (G.shake > 0) cx.translate((Math.random() - .5) * 6 * G.shake, (Math.random() - .5) * 6 * G.shake);
    /* 容器 */
    var left = X(0), right = X(W), bottom = Y(H), top = Y(0), rad = 16 * s;
    cx.beginPath(); cx.moveTo(left, top); cx.lineTo(left, bottom - rad); cx.arcTo(left, bottom, left + rad, bottom, rad); cx.lineTo(right - rad, bottom); cx.arcTo(right, bottom, right, bottom - rad, rad); cx.lineTo(right, top);
    cx.fillStyle = '#fff4de'; cx.fill();
    var danger = world.danger, pulse = danger > 0 ? .5 + .5 * Math.sin(performance.now() / 110) : 0;
    cx.lineWidth = 3; cx.lineJoin = 'round'; cx.strokeStyle = danger > 0 ? 'rgb(' + Math.round(84 + 120 * danger * pulse) + ',57,47)' : INK; cx.stroke();
    /* 虚线 */
    cx.save(); cx.setLineDash([7, 6]); cx.lineWidth = 2; cx.strokeStyle = danger > 0 ? 'rgba(204,70,56,' + (.5 + .5 * pulse) + ')' : 'rgba(84,57,47,.38)';
    cx.beginPath(); cx.moveTo(left + 2, Y(world.lineY)); cx.lineTo(right - 2, Y(world.lineY)); cx.stroke(); cx.restore();
    /* 瞄准线和手里的动物 */
    if (G.held != null && G.state === 'play') {
      var ax = clampAim(G.aimX), ar = world.radius(G.held);
      cx.save(); cx.setLineDash([3, 6]); cx.lineWidth = 1.5; cx.strokeStyle = 'rgba(84,57,47,.25)'; cx.beginPath(); cx.moveTo(X(ax), Y(world.holdY + ar)); cx.lineTo(X(ax), bottom - 2); cx.stroke(); cx.restore();
      drawAnimal(G.held, X(ax), Y(world.holdY), ar * s);
    }
    /* 动物们 */
    world.bodies.forEach(function (b) { jellyDraw(b, X(b.x), Y(b.y), b.r * s); });
    /* 火花和飘字 */
    G.parts.forEach(function (p) { var a = 1 - p.life / p.max; cx.globalAlpha = Math.max(0, a); cx.fillStyle = p.color; cx.beginPath(); cx.arc(X(p.x), Y(p.y), p.size * s, 0, Math.PI * 2); cx.fill(); });
    cx.globalAlpha = 1;
    G.pops.forEach(function (p) {
      var a = 1 - Math.max(0, p.life / p.max - .6) / .4; cx.globalAlpha = Math.max(0, Math.min(1, a));
      cx.font = '700 ' + p.size * Math.max(.85, s) + 'px ' + FONT; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      var tx = X(Math.max(60, Math.min(W - 60, p.x))), ty = Y(p.y - p.life * 46);
      cx.lineWidth = 4; cx.strokeStyle = '#fff4de'; cx.strokeText(p.text, tx, ty); cx.fillStyle = p.color; cx.fillText(p.text, tx, ty);
    });
    cx.globalAlpha = 1; cx.restore();
    /* 下一个 */
    cx.font = '600 13px ' + FONT; cx.textAlign = 'right'; cx.textBaseline = 'middle'; cx.fillStyle = '#7c6354';
    cx.fillText('下一个', right - 44, view.top + HEAD / 2 + 2);
    drawAnimal(G.next, right - 20, view.top + HEAD / 2 + 2, Math.min(18, world.radius(G.next) * s * .62));
    /* 进化表 */
    var span = right - left, cy = bottom + FOOT / 2 + 3, gap = span / (TOP + 1);
    cx.strokeStyle = 'rgba(84,57,47,.2)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(left + gap / 2, cy); cx.lineTo(right - gap / 2, cy); cx.stroke();
    for (var i = 0; i <= TOP; i++) drawAnimal(i, left + gap * (i + .5), cy, Math.min(13, gap / 2 - 1) * (.52 + .48 * i / TOP));
    if (G.topLevel >= 0) { /* 淡淡的红圈：这一局目前合成出的最大动物；刚升级时圈会弹一下 */
      var ringR = Math.min(13, gap / 2 - 1) * (.52 + .48 * G.topLevel / TOP), grow = Math.max(0, 1 - (performance.now() - (G.topAt || 0)) / 350), rr = ringR + 4.5 + 4 * grow * grow;
      cx.beginPath(); cx.arc(left + gap * (G.topLevel + .5), cy, rr, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(224,92,84,.10)'; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = 'rgba(224,92,84,.6)'; cx.stroke();
    }
  }

  /* ---------- 主循环 ---------- */
  function frame(t) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(.05, Math.max(0, (t - last) / 1000)); last = t;
    if (!view.w || Math.abs(cv.clientWidth - view.w) > 1 || Math.abs(cv.clientHeight - view.h) > 1) layout();
    if (G.state === 'play') {
      acc += dt; var n = 0;
      while (acc >= STEP && n < 3 && !world.over) { world.step(STEP); acc -= STEP; n++; handleEvents(); world.bodies.forEach(wobble); }
      if (n === 3) acc = 0;
      if (world.over && G.state === 'play') handleEvents(); /* 保险：结束事件一定要被处理 */
      if (G.cool > 0) { G.cool -= dt; if (G.cool <= 0 && G.held == null) { G.held = G.next; G.next = pick(); G.aimX = clampAim(G.aimX); } }
    }
    if (G.state === 'play' && G.held == null && G.cool <= 0) { G.held = G.next; G.next = pick(); }
    G.shake = Math.max(0, G.shake - dt);
    G.parts = G.parts.filter(function (p) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; return p.life < p.max; });
    G.pops = G.pops.filter(function (p) { p.life += dt * .9; return p.life < p.max; });
    draw();
  }
  function startLoop() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

  /* ---------- 进入 / 离开 ---------- */
  function enter() {
    if (NT.isBusy()) return;
    var S = NT.S();
    if (S.sleeping) { NT.sound('nope'); NT.say('奶团睡着了，先叫醒它'); return; }
    NT.ext.active = true; NT.hideCat(true); NT.setChrome(true); NT.setBusyUI(true);
    active = true; root.hidden = false; window.scrollTo(0, 0); NT.stage.classList.add('lionmode');
    loadArt(); newGame(); layout();
    $('#mlIntroBest').textContent = S.bestLion ? '最高分 ' + S.bestLion + ' · 合到过：' + NAMES[Math.min(TOP, S.lionTop || 0)] : '还没有记录，来一局吧';
    elIntro.hidden = false; startLoop();
    if (window.NaituanStats) window.NaituanStats.enter('games/lion');
  }
  function leave() {
    var played = G && G.score > 0, top = G ? Math.max(0, G.topLevel) : 0, score = G ? G.score : 0;
    settle(); stopLoop(); active = false; if (G) G.state = 'idle';
    elIntro.hidden = true; elOver.hidden = true; root.hidden = true; NT.stage.classList.remove('lionmode');
    NT.ext.active = false; NT.hideCat(false); NT.setChrome(false); NT.setBusyUI(false);
    if (window.NaituanStats) window.NaituanStats.leave();
    NT.setPose('happy', 2200);
    NT.say(played ? '合成到了' + NAMES[top] + '，' + score + ' 分，下次还想玩' : '合成大狮子，下次再来', 3600);
    NT.render(); NT.save();
  }
  function again() { elOver.hidden = true; newGame(); layout(); startGame(); }

  btn.addEventListener('click', enter);
  $('#mlQuit').addEventListener('click', leave);
  $('#mlIntroBack').addEventListener('click', leave);
  $('#mlBack').addEventListener('click', leave);
  $('#mlGo').addEventListener('click', startGame);
  $('#mlAgain').addEventListener('click', again);
  cv.addEventListener('pointerdown', function (event) {
    if (!G || G.state !== 'play') return;
    G.aiming = true; G.aimX = clampAim(toWorldX(event.clientX));
    try { cv.setPointerCapture(event.pointerId); } catch (e) { /* 忽略 */ }
    event.preventDefault();
  });
  cv.addEventListener('pointermove', function (event) {
    if (!G || G.state !== 'play') return;
    if (G.aiming || event.pointerType === 'mouse') G.aimX = clampAim(toWorldX(event.clientX));
  });
  cv.addEventListener('pointerup', function (event) {
    if (!G || !G.aiming) return;
    G.aiming = false; G.aimX = clampAim(toWorldX(event.clientX)); drop();
  });
  cv.addEventListener('pointercancel', function () { if (G) G.aiming = false; });
  document.addEventListener('keydown', function (event) {
    if (!active || !G || G.state !== 'play') return;
    if (event.key === 'ArrowLeft') { G.aimX = clampAim(G.aimX - 14); event.preventDefault(); }
    else if (event.key === 'ArrowRight') { G.aimX = clampAim(G.aimX + 14); event.preventDefault(); }
    else if (event.key === ' ' || event.key === 'Enter') { drop(); event.preventDefault(); }
  });
  window.addEventListener('resize', function () { if (active && G) layout(); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { if (active && G) layout(); }, 250); });
  document.addEventListener('visibilitychange', function () { if (!active) return; if (document.hidden) stopLoop(); else startLoop(); });
  window.NaituanLion = { get: function () { return { world: world, game: G }; }, drop: function (x) { if (G) { G.aimX = clampAim(x); drop(); } }, NAMES: NAMES };
})();
