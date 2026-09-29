/* 蛋糕店：猫猫排队买蛋糕（排序谜题）
   规则：每队只能动队首那一只，只能放进空队，或者放在同一种猫的前面（黑猫只能放在黑猫前面）；一队凑齐同一种猫，就进店买到一块蛋糕角。
   关卡来自 levels.js（tools/gen_levels.py 生成，保证有解，par 是求解器算出的最少步数）。
   猫头是阿琳画的图（assets/cats/cat0-7.webp），蛋糕使用手绘切角（assets/cakes/cake0-7.webp）。 */
(function () {
  'use strict';
  var NT = window.NT, LV = window.NT_LEVELS;
  if (!NT || !LV || !LV.length) return;
  var $ = function (s) { return root.querySelector(s); };
  var root = document.getElementById('cq'), btnCake = document.getElementById('btnCake');
  var INK = '#54392f', UNDO_COST = 2;

  /* ---------- 猫和蛋糕的设定 ---------- */
  /* 编号对应 assets/cats/catN.webp；越靠后的越稀有（奶团本人最稀有） */
  var CATS = [
    { n: '橘猫', t: 0 }, { n: '灰虎斑', t: 0 }, { n: '奶牛猫', t: 0 }, { n: '黑猫', t: 0 },
    { n: '三花', t: 1 }, { n: '银渐层', t: 1 }, { n: '暹罗', t: 2 }, { n: '奶团', t: 3 }
  ];
  var TIER = ['常见', '少见', '稀有', '传说'];
  /* 名字, 卖价, [面包, 奶油, 顶面, 侧面] */
  var CAKES = [
    { n: '奶油蛋糕', p: 2, c: ['#f6dfae', '#fffaf0', '#fffaf0', '#ecc98d'] },
    { n: '草莓蛋糕', p: 3, c: ['#f6dfae', '#f7b7b0', '#f9c6c0', '#ecc98d'] },
    { n: '巧克力蛋糕', p: 4, c: ['#8a5540', '#b98467', '#6a3f30', '#744534'] },
    { n: '抹茶蛋糕', p: 5, c: ['#cfe3a6', '#fffaf0', '#aacd7b', '#b4cf8a'] },
    { n: '芒果慕斯', p: 6, c: ['#f6dfae', '#fbd56b', '#ffe08a', '#ecc98d'] },
    { n: '冰淇淋蛋糕', p: 8, c: ['#bcd7ee', '#f9c6d8', '#fffaf0', '#a3c2df'] },
    { n: '银蛋糕', p: 10, c: ['#e3e7ef', '#fafbff', '#c9d0dc', '#c4cad6'] },
    { n: '金蛋糕', p: 12, c: ['#f5c95a', '#ffe9a3', '#f4b04a', '#e2b048'] }
  ];
  /* 每种猫买到各种蛋糕的权重：越靠后的关、越稀有的猫，越容易出好蛋糕。
     金蛋糕：常见猫前期约 0.01%，后期约 1%。 */
  var EARLY = [
    [42, 28, 18, 9.7, 2, 0.2, 0.09, 0.01],
    [25, 25, 22, 16, 9, 2.8, 0.15, 0.05],
    [12, 16, 20, 22, 18, 9, 2.6, 0.4],
    [5, 10, 15, 20, 24, 18, 6.5, 1.5]
  ];
  var LATE = [
    [28, 24, 20, 14, 8, 4.5, 1.5, 1],
    [12, 16, 20, 20, 16, 10, 4, 2],
    [4, 8, 14, 20, 22, 18, 9, 5],
    [1, 3, 8, 15, 24, 24, 15, 10]
  ];
  function rollCake(kind, lv) {
    var t = CATS[kind].t, f = LV.length > 1 ? lv / (LV.length - 1) : 0, w = [], sum = 0, i;
    for (i = 0; i < 8; i++) { w[i] = EARLY[t][i] + (LATE[t][i] - EARLY[t][i]) * f; sum += w[i]; }
    var r = Math.random() * sum;
    for (i = 0; i < 8; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }

  var CATIMG = CATS.map(function (c, i) { var im = new Image(); im.src = 'assets/cats/cat' + i + '.webp'; return im; }); /* 提前加载 */
  function catHTML(k) { return '<img src="assets/cats/cat' + k + '.webp" alt="" draggable="false">'; }

  function cakeHTML(id) {
    return '<img class="cq-cake-image" src="assets/cakes/cake' + id + '.webp" alt="" draggable="false">';
  }

  /* ---------- 存档里的蛋糕店数据 ---------- */
  function cq() {
    var S = NT.S(), c = S.cq;
    if (!c || typeof c !== 'object') c = S.cq = {};
    ['cleared', 'cakes', 'seen'].forEach(function (k) { if (!Array.isArray(c[k])) c[k] = []; });
    if (c.ver !== 2) { c.ver = 2; c.cleared = []; } /* 关卡换过一版，旧的星星不作数（蛋糕和图鉴保留） */
    var i;
    for (i = 0; i < LV.length; i++) c.cleared[i] = Math.max(0, Math.min(3, Math.floor(+c.cleared[i] || 0)));
    for (i = 0; i < CAKES.length; i++) { c.cakes[i] = Math.max(0, Math.floor(+c.cakes[i] || 0)); c.seen[i] = (c.seen[i] || c.cakes[i] > 0) ? 1 : 0; }
    c.cleared.length = LV.length; c.cakes.length = c.seen.length = CAKES.length;
    return c;
  }
  function unlocked(i) { return i === 0 || cq().cleared[i - 1] > 0; }

  /* ---------- 声音（现场合成，不需要音频文件） ---------- */
  var AC = null, master = null;
  function audioInit() {
    if (!AC) {
      try { var C = window.AudioContext || window.webkitAudioContext; if (C) { AC = new C(); master = AC.createGain(); master.connect(AC.destination); } } catch (e) { AC = null; }
    }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    if (master) master.gain.value = NT.S().mute ? 0 : 0.5;
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (!AC || NT.S().mute) return;
    var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function buzz(ms) { if (!NT.S().mute) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} } }
  var SND = {
    pick: function () { tone(620, 980, 0.07, 'triangle', 0.22); },
    pop: function () { tone(280, 820, 0.11, 'sine', 0.55); tone(560, 1500, 0.05, 'sine', 0.12); buzz(12); },
    bad: function () { tone(210, 120, 0.14, 'sine', 0.3); buzz(25); },
    buy: function () { [660, 830, 990, 1320].forEach(function (f, i) { tone(f, 0, 0.32, 'sine', 0.26, i * 0.075); tone(f * 2, 0, 0.18, 'triangle', 0.06, i * 0.075); }); buzz(30); },
    win: function () { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0, 0.42, 'sine', 0.26, i * 0.11); tone(f * 2, 0, 0.2, 'triangle', 0.05, i * 0.11); }); buzz(45); }
  };

  /* ---------- 界面骨架 ---------- */
  var SHOP = '<svg viewBox="0 0 360 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' +
    '<rect x="36" y="10" width="288" height="92" rx="14" fill="#fff3e6" stroke="' + INK + '" stroke-width="2.6"/>' +
    (function () { var s = '', i; for (i = 0; i < 8; i++) s += '<path d="M' + (28 + i * 38) + ' 8h38v22q-19 12-38 0z" fill="' + (i % 2 ? '#fffaf2' : '#f0b0a8') + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>'; return s; })() +
    '<rect x="108" y="40" width="144" height="20" rx="8" fill="#fffaf2" stroke="' + INK + '" stroke-width="2.4"/>' +
    '<text x="180" y="55" text-anchor="middle" font-size="14" fill="' + INK + '" font-family="ZCOOL KuaiLe, PingFang SC, Microsoft YaHei, sans-serif">猫猫蛋糕店</text>' +
    '<rect x="54" y="42" width="42" height="40" rx="6" fill="#d7e3ec" stroke="' + INK + '" stroke-width="2.4"/><rect x="264" y="42" width="42" height="40" rx="6" fill="#d7e3ec" stroke="' + INK + '" stroke-width="2.4"/>' +
    '<path d="M62 76h26M272 76h26" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/><circle cx="75" cy="66" r="6" fill="#f0b0a8" stroke="' + INK + '" stroke-width="2"/><circle cx="285" cy="66" r="6" fill="#f7d67a" stroke="' + INK + '" stroke-width="2"/>' +
    '<path d="M158 102V72q0-14 22-14t22 14v30z" fill="#e7b48a" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round"/><circle cx="193" cy="84" r="2.400" fill="' + INK + '"/>' +
    '</svg>';
  var FISH = '<svg viewBox="0 0 32 32" fill="none" stroke="#54392f" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" class="cq-fish"><path d="M3 16c4-7 12-9 18-4l6-4v16l-6-4c-6 5-14 3-18-4z" fill="#8fa3bf"/></svg>';

  root.innerHTML =
    '<div class="cq-play" id="cqPlay">' +
      '<div class="cq-bar"><span class="cq-chip" id="cqLv">第 1 关</span><span class="cq-chip" id="cqSteps">步数 0</span><button class="hs-quit" id="cqMenuBtn" type="button">选关</button></div>' +
      '<div class="cq-shop" id="cqShop">' + SHOP + '<div class="cq-door" id="cqDoor"></div><div class="cq-tip" id="cqTip" role="status"></div></div>' +
      '<div class="cq-field" id="cqField"></div>' +
      '<div class="cq-foot"><button class="cq-btn" id="cqUndo" type="button">撤销 ' + FISH + UNDO_COST + '</button><button class="cq-btn" id="cqRedo" type="button">重来</button><span class="cq-got" id="cqGot" aria-live="polite"></span></div>' +
    '</div>' +
    '<div class="sg-over" id="cqMenu" hidden><div class="sg-card cq-scroll cq-menucard" role="dialog" aria-label="蛋糕店">' +
      '<h2>猫猫蛋糕店</h2><p>点队首的猫，再点另一队，把它放过去。<b>只能放进空队，或者放在一样的猫前面</b>（黑猫只能放在黑猫前面）。凑齐一队一样的猫，它们就能进店买蛋糕，会分你一块蛋糕角。</p>' +
      '<div class="cq-lvs" id="cqLvs"></div>' +
      '<div class="sg-btns"><button id="cqBookBtn" type="button">蛋糕图鉴</button><button id="cqSnd" type="button">音效：开</button></div>' +
      '<button class="hs-quit" id="cqHome" type="button">回房间</button>' +
    '</div></div>' +
    '<div class="sg-over" id="cqWin" hidden><div class="sg-card" role="dialog" aria-label="本关结果">' +
      '<h2 id="cqWinT">通关！</h2><div class="cq-stars" id="cqStars"></div><p id="cqWinS"></p><div class="rew" id="cqWinR"></div><div class="cq-wcakes" id="cqWinC"></div>' +
      '<div class="sg-btns"><button id="cqWinMenu" type="button">选关</button><button id="cqWinNext" class="main" type="button">下一关</button></div>' +
    '</div></div>' +
    '<div class="sg-over" id="cqLose" hidden><div class="sg-card" role="dialog" aria-label="步数用完了">' +
      '<h2>步数用完啦</h2><p id="cqLoseS"></p>' +
      '<div class="sg-btns"><button id="cqLoseMenu" type="button">选关</button><button id="cqLoseAgain" class="main" type="button">重来</button></div>' +
    '</div></div>' +
    '<div class="sg-over" id="cqBook" hidden><div class="sg-card cq-scroll cq-bookcard" role="dialog" aria-label="蛋糕图鉴">' +
      '<h2>蛋糕图鉴</h2><p id="cqBookS"></p><div class="cq-bookgrid" id="cqBookG"></div><p class="cq-note">卖掉只会换小鱼干，图鉴里的蛋糕不会变回剪影。</p>' +
      '<div class="sg-btns"><button id="cqBookSell" type="button">全部卖掉</button><button id="cqBookX" class="main" type="button">关闭</button></div>' +
    '</div></div>';

  var el = {
    lose: $('#cqLose'), play: $('#cqPlay'), tip: $('#cqTip'), field: $('#cqField'), door: $('#cqDoor'), shop: $('#cqShop'), lv: $('#cqLv'), steps: $('#cqSteps'), undo: $('#cqUndo'), got: $('#cqGot'),
    menu: $('#cqMenu'), lvs: $('#cqLvs'), snd: $('#cqSnd'), win: $('#cqWin'), book: $('#cqBook')
  };

  /* ---------- 一局游戏 ---------- */
  var G = null, lastVar = {}, laneEls = [], TOKEN = 0;
  var stepsText = function () { return '步数 ' + G.steps + (G.limit ? '/' + G.limit : '') + (G.exact ? ' · 最少 ' : ' · 参考 ') + G.par; };

  function makeCat(kind) {
    var d = document.createElement('div'); d.className = 'cq-cat';
    var inn = document.createElement('div'); inn.className = 'in'; inn.innerHTML = catHTML(kind); d.appendChild(inn);
    el.field.appendChild(d);
    return { kind: kind, el: d, inn: inn };
  }
  function startLevel(lv) {
    var L = LV[lv], vs = L.variants, vi = Math.floor(Math.random() * vs.length);
    if (vs.length > 1 && vi === lastVar[lv]) vi = (vi + 1) % vs.length;
    lastVar[lv] = vi; loadVariant(lv, vi);
  }
  function loadVariant(lv, vi) {
    var L = LV[lv], v = L.variants[vi];
    el.field.innerHTML = ''; laneEls = [];
    var caps = L.caps ? L.caps.slice() : L.lanes ? new Array(L.lanes).fill(L.cap) : v.lanes.map(function () { return L.cap; });
    G = { lv: lv, vi: vi, S: L.cap, caps: caps, maxCap: Math.max.apply(null, caps), limit: v.limit || 0, pending: 0, par: v.par, exact: v.exact !== false, lanes: v.lanes.map(function (l) { return l.map(makeCat); }), sel: -1, steps: 0, hist: [], busy: false, over: false, got: [], token: ++TOKEN };
    for (var i = 0; i < G.lanes.length; i++) (function (i) {
      var d = document.createElement('div'); d.className = 'cq-lane'; d.setAttribute('data-i', i);
      d.addEventListener('pointerdown', function (e) { e.preventDefault(); onLane(i); });
      el.field.insertBefore(d, el.field.firstChild); laneEls.push(d);
    })(i);
    el.menu.hidden = el.win.hidden = el.book.hidden = el.lose.hidden = true; el.play.hidden = false; el.play.classList.remove('idle');
    el.lv.textContent = '第 ' + (lv + 1) + ' 关'; el.steps.textContent = stepsText(); el.got.textContent = ''; tip('');
    layout(true); paintBtns();
  }
  function later(fn, ms) { var tk = G && G.token; var id = setTimeout(function () { if (G && G.token === tk) fn(); }, ms); return id; }

  /* 排版：一行放得下就一行，否则分两行；猫的大小按空间来定 */
  function layout(instant) {
    if (!G) return;
    var W = el.field.clientWidth, H = el.field.clientHeight, n = G.lanes.length, cap = G.maxCap;
    if (!W || !H) { requestAnimationFrame(function () { layout(instant); }); return; }
    var gap = 8, rowGap = 10, best = null;
    [1, 2, 3].forEach(function (rr) { /* 排一行、两行还是三行：哪种能让猫更大就用哪种 */
      if (rr > n) return;
      var pp = Math.ceil(n / rr), lw = Math.min(88, (W - gap * (pp - 1)) / pp);
      var cc = Math.max(24, Math.min(lw - 8, Math.floor((H - (rr - 1) * rowGap - rr * 10) / (rr * cap)), 68));
      if (!best || cc > best.cell + 1) best = { rows: rr, per: pp, laneW: lw, cell: cc };
    });
    var rows = best.rows, per = best.per, cell = best.cell, laneW = Math.min(best.laneW, cell + 18);
    var laneH = cap * cell + 10, total = rows * laneH + (rows - 1) * rowGap, top0 = Math.max(0, Math.min(14, (H - total) / 3));
    G.cell = cell; G.rects = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / per), c = i - r * per, inRow = r === rows - 1 ? n - per * (rows - 1) : per;
      var rowW = inRow * laneW + (inRow - 1) * gap, x = (W - rowW) / 2 + c * (laneW + gap), y = top0 + r * (laneH + rowGap);
      var hh = G.caps[i] * cell + 10, yy = y + laneH - hh; /* 短队画得矮一点，底边对齐 */
      G.rects[i] = { x: x, y: yy, w: laneW, h: hh };
      var d = laneEls[i]; d.style.cssText = 'left:' + x + 'px;top:' + yy + 'px;width:' + laneW + 'px;height:' + hh + 'px';
    }
    var fr = el.field.getBoundingClientRect(), dr = el.door.getBoundingClientRect();
    G.door = { x: dr.left + dr.width / 2 - fr.left, y: dr.top + dr.height / 2 - fr.top };
    placeAll(instant);
  }
  /* 猫从队尾（下面）往上排，空位留在队首那一头，像落进去一样：新来的猫放在最上面，别的猫不用动 */
  function slotPos(i, s) { var r = G.rects[i], d = G.lanes[i].length - 1 - s; return { x: r.x + (r.w - G.cell) / 2, y: r.y + 5 + (G.caps[i] - 1 - d) * G.cell }; }
  function placeCat(e, i, s) {
    var p = slotPos(i, s), st = e.el.style;
    st.width = st.height = G.cell + 'px'; st.setProperty('--x', p.x + 'px'); st.setProperty('--y', p.y + 'px');
  }
  function placeAll(instant) {
    G.lanes.forEach(function (l, i) { l.forEach(function (e, s) {
      if (instant) e.el.style.transition = 'none';
      placeCat(e, i, s);
      e.el.classList.toggle('sel', G.sel === i && s === 0);
      if (instant) { void e.el.offsetWidth; e.el.style.transition = ''; }
    }); });
    laneEls.forEach(function (d, i) {
      d.classList.toggle('can', G.sel >= 0 && canPut(G.sel, i));
      d.classList.toggle('from', G.sel === i);
    });
  }
  function paintBtns() {
    var fish = NT.S().fish;
    el.undo.disabled = !G || G.busy || G.over || !G.hist.length || fish < UNDO_COST;
    el.undo.title = G && !G.hist.length ? '还没有能撤销的步数（买走蛋糕之后就不能撤销了）' : fish < UNDO_COST ? '小鱼干不够' : '';
    el.steps.textContent = G ? stepsText() : ''; el.steps.classList.toggle('warn', !!(G && G.limit && G.limit - G.steps <= 3));
  }
  function bounce(e, big) {
    if (!e.inn.animate) return;
    e.inn.animate([{ transform: 'scale(1.16,.8)' }, { transform: 'scale(.92,1.12)' }, { transform: 'scale(1.04,.97)' }, { transform: 'scale(1)' }], { duration: big ? 380 : 300, easing: 'ease-out' });
  }

  function canPut(a, b) {
    var A = G.lanes[a], B = G.lanes[b];
    return a !== b && A.length > 0 && B.length < G.caps[b] && (!B.length || B[0].kind === A[0].kind);
  }
  function hasMove() { if (G.lanes.every(function (l) { return !l.length; })) return true; for (var a = 0; a < G.lanes.length; a++) for (var b = 0; b < G.lanes.length; b++) if (canPut(a, b)) return true; return false; }
  var tipT = 0;
  function tip(t, ms) { el.tip.textContent = t; el.tip.classList.toggle('on', !!t); clearTimeout(tipT); if (t && ms) tipT = setTimeout(function () { el.tip.classList.remove('on'); }, ms); }
  function checkStuck() { if (G && !G.over && !G.busy && G.lanes.some(function (l) { return l.length; }) && !hasMove()) tip('没有能走的了，撤销一步，或者重来', 0); else if (G && el.tip.textContent.indexOf('没有能走') === 0) tip(''); }
  function onLane(i) {
    if (!G || G.busy || G.over) return;
    audioInit();
    var L = G.lanes[i];
    if (G.sel < 0) { if (L.length) { G.sel = i; SND.pick(); placeAll(); tip(''); } else { wiggle(i); } return; }
    if (G.sel === i) { G.sel = -1; placeAll(); return; }
    if (!canPut(G.sel, i)) { /* 放不下：说明原因，如果那队有猫，就改选那队的队首 */
      if (L.length >= G.caps[i]) tip('这队满了', 1600); else if (L.length) tip('只能放进空队，或者放在一样的猫前面', 2000);
      SND.bad(); wiggle(i); if (L.length) { G.sel = i; placeAll(); }
      return;
    }
    doMove(G.sel, i);
  }
  function wiggle(i) { var d = laneEls[i]; d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }

  function doMove(a, b) {
    G.hist.push(G.lanes.map(function (l) { return l.slice(); }));
    var e = G.lanes[a].shift(); G.lanes[b].unshift(e);
    G.steps++; G.sel = -1;
    e.el.style.zIndex = 4; later(function () { e.el.style.zIndex = ''; }, 420);
    placeAll();
    later(function () { SND.pop(); bounce(e); }, 200);
    var T = G.lanes[b];
    if (T.length === G.S && T.every(function (x) { return x.kind === e.kind; })) { G.busy = true; G.pending++; G.hist = []; later(function () { buyGroup(b); }, 330); }
    paintBtns(); tip('');
    if (!G.busy) { later(checkStuck, 380); checkEnd(); }
  }

  function buyGroup(b) {
    var cats = G.lanes[b].slice(), kind = cats[0].kind; G.lanes[b] = [];
    cats.forEach(function (c, k) { later(function () { bounce(c, true); }, k * 70); });
    SND.pop();
    later(function () { G.busy = false; paintBtns(); checkStuck(); }, 440);
    later(function () {
      SND.buy();
      cats.forEach(function (c, k) {
        c.el.style.transitionDelay = (k * 60) + 'ms'; c.el.classList.add('leave');
        c.el.style.setProperty('--x', (G.door.x - G.cell / 2) + 'px'); c.el.style.setProperty('--y', (G.door.y - G.cell / 2) + 'px');
      });
      later(function () { cats.forEach(function (c) { if (c.el.parentNode) c.el.parentNode.removeChild(c.el); }); }, 700);
      later(function () { giveCake(kind); }, 480);
    }, 620);
    placeAll();
  }
  function giveCake(kind) {
    var id = rollCake(kind, G.lv), c = cq(), isNew = !c.seen[id];
    c.cakes[id]++; c.seen[id] = 1; G.got.push(id);
    var S = NT.S(); S.mood = NT.clamp(S.mood + 1);
    var pop = document.createElement('div'); pop.className = 'cq-pop'; pop.style.left = G.door.x + 'px'; pop.style.top = (G.door.y + 4) + 'px';
    pop.innerHTML = '<span class="pc">' + cakeHTML(id) + '</span><b>' + CAKES[id].n + (isNew ? ' <i>新！</i>' : '') + '</b>';
    el.field.appendChild(pop); setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 1700);
    paintGot(); NT.save(); paintBtns();
    G.pending--;
    if (G.pending === 0) { if (G.lanes.every(function (l) { return !l.length; })) { G.over = true; later(finishLevel, 900); } else checkEnd(); }
  }
  /* 步数用完了、棋盘还没清空：失败（正在买蛋糕的那一组要等它结算完） */
  function checkEnd() {
    if (!G || G.over || G.pending > 0 || !G.limit || G.steps < G.limit) return;
    if (G.lanes.every(function (l) { return !l.length; })) return;
    G.over = true; G.sel = -1; placeAll(); paintBtns(); SND.bad(); tip('');
    later(function () {
      $('#cqLoseS').textContent = '这一关最多走 ' + G.limit + ' 步（最少 ' + G.par + ' 步）。撤销不会返还步数，先想好再走。';
      el.lose.hidden = false;
    }, 800);
  }
  function paintGot() {
    var cnt = {}; G.got.forEach(function (i) { cnt[i] = (cnt[i] || 0) + 1; });
    el.got.innerHTML = Object.keys(cnt).map(function (i) { return '<span class="cq-mini">' + cakeHTML(+i) + (cnt[i] > 1 ? '<i>' + cnt[i] + '</i>' : '') + '</span>'; }).join('');
  }

  function undo() {
    if (!G || G.busy || G.over || !G.hist.length) return;
    var S = NT.S(); if (S.fish < UNDO_COST) return;
    NT.addFish(-UNDO_COST);
    G.lanes = G.hist.pop(); G.sel = -1; /* 撤销只放回位置，走过的步数不返还 */
    SND.pick(); placeAll(); paintBtns(); tip(''); NT.save();
  }

  function stars(steps, par, limit) {
    if (limit) return steps <= Math.ceil(par * 1.12) ? 3 : steps <= Math.ceil((par + limit) / 2) ? 2 : 1;
    return steps <= Math.ceil(par * 1.3) ? 3 : steps <= Math.ceil(par * 2) ? 2 : 1;
  }
  function finishLevel() {
    var st = stars(G.steps, G.par, G.limit), c = cq(), S = NT.S(), lv = G.lv;
    var first = c.cleared[lv] === 0, fish = 3 + (lv + 1) * 2 + st * 2;
    c.cleared[lv] = Math.max(c.cleared[lv], st);
    NT.addFish(fish); S.mood = NT.clamp(S.mood + 8); S.hunger = NT.clamp(S.hunger - 1); S.energy = NT.clamp(S.energy - 2);
    NT.save(); SND.win();
    var last = lv === LV.length - 1;
    $('#cqWinT').textContent = last ? '打烊啦！全部通关' : '第 ' + (lv + 1) + ' 关通关';
    $('#cqStars').innerHTML = [1, 2, 3].map(function (i) { return '<span class="' + (i <= st ? 'on' : '') + '">★</span>'; }).join('');
    $('#cqWinS').textContent = '用了 ' + G.steps + ' 步（' + (G.limit ? '限 ' + G.limit + '，' : '') + (G.exact ? '最少 ' : '参考 ') + G.par + ' 步）' + (first && !last ? ' · 解锁下一关' : '');
    $('#cqWinR').innerHTML = '小鱼干 +' + fish;
    var cnt = {}; G.got.forEach(function (i) { cnt[i] = (cnt[i] || 0) + 1; });
    $('#cqWinC').innerHTML = G.got.length ? '<small>这一局买到的蛋糕角</small><div>' + Object.keys(cnt).map(function (i) { return '<span class="cq-mini big">' + cakeHTML(+i) + '<i>×' + cnt[i] + '</i></span>'; }).join('') + '</div>' : '';
    $('#cqWinNext').textContent = last ? '再玩一次' : '下一关'; $('#cqWinNext').setAttribute('data-act', last ? 'again' : 'next');
    el.win.hidden = false;
  }

  /* ---------- 选关 / 图鉴 ---------- */
  function nLanes(L) { return L.caps ? L.caps.length : L.lanes; }
  function extraTag(L) { var t = []; if (L.caps && Math.min.apply(null, L.caps) < L.cap) t.push('短队'); if (L.variants[0].limit) t.push('限步数'); return t.join(' · '); }
  function paintMenu() {
    var c = cq();
    el.lvs.innerHTML = '';
    LV.forEach(function (L, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cq-lvbtn'; var ok = unlocked(i); b.disabled = !ok;
      var s = c.cleared[i];
      b.innerHTML = '<span class="nm"><b>' + (i + 1) + '</b>' + L.name + '</span><span class="st">' + (ok ? [1, 2, 3].map(function (k) { return '<i class="' + (k <= s ? 'on' : '') + '">★</i>'; }).join('') : '🔒') + '<small>' + (ok ? nLanes(L) + ' 队 · 每队 ' + L.cap + ' 只' : '先通上一关') + '</small>' + (ok && extraTag(L) ? '<em>' + extraTag(L) + '</em>' : '') + '</span>';
      b.addEventListener('click', function () { audioInit(); startLevel(i); });
      el.lvs.appendChild(b);
    });
    el.snd.textContent = NT.S().mute ? '音效：关' : '音效：开';
    var got = c.seen.filter(Boolean).length;
    $('#cqBookBtn').textContent = '蛋糕图鉴 ' + got + '/' + CAKES.length;
  }
  function openMenu() { tip(''); G && (G.token++); G = null; el.field.innerHTML = ''; el.play.hidden = false; el.play.classList.add('idle'); el.win.hidden = el.book.hidden = el.lose.hidden = true; paintMenu(); el.menu.hidden = false; }
  function paintBook() {
    var c = cq(), got = c.seen.filter(Boolean).length, dup = 0, worth = 0;
    $('#cqBookS').textContent = '已收集 ' + got + ' / ' + CAKES.length + ' 种 · 小鱼干 ' + NT.S().fish;
    var g = $('#cqBookG'); g.innerHTML = '';
    CAKES.forEach(function (k, i) {
      var have = c.seen[i], n = c.cakes[i]; dup += n; worth += n * k.p;
      var d = document.createElement('div'); d.className = 'cq-cake' + (have ? '' : ' lock');
      d.innerHTML = '<span class="cv">' + cakeHTML(i) + '</span><b>' + (have ? k.n : '？？？') + '</b><small>' + (have ? '×' + n : '还没买到') + '</small>';
      var s = document.createElement('button'); s.type = 'button'; s.className = 'cq-sell'; s.disabled = n < 1; s.innerHTML = '卖 ' + FISH + k.p; s.setAttribute('aria-label', '卖掉 1 个' + k.n + '，得到小鱼干 ' + k.p);
      s.addEventListener('click', function () { if (c.cakes[i] < 1) return; c.cakes[i]--; NT.addFish(k.p); NT.save(); SND.pick(); paintBook(); });
      d.appendChild(s); g.appendChild(d);
    });
    var b = $('#cqBookSell'); b.disabled = !dup; b.textContent = dup ? '全部卖掉 +' + worth : '没有可卖的';
  }
  function sellAll() {
    var c = cq(), w = 0; CAKES.forEach(function (k, i) { w += c.cakes[i] * k.p; c.cakes[i] = 0; });
    if (w) { NT.addFish(w); NT.save(); SND.buy(); } paintBook();
  }

  /* ---------- 进入 / 离开小屋 ---------- */
  var bookOnly = false;
  function enter() {
    if (NT.isBusy()) return;
    var S = NT.S();
    if (S.sleeping) { NT.say('奶团睡着了，先叫醒它'); return; }
    bookOnly = false;
    NT.ext.active = true; NT.hideCat(true); NT.setChrome(true); NT.setBusyUI(true);
    root.hidden = false; window.scrollTo(0, 0); root.classList.add('on'); NT.stage.classList.add('cqmode');
    audioInit(); openMenu();
  }
  function leave() {
    if (G) G.token++; G = null; el.field.innerHTML = '';
    var c = cq(), stars3 = c.cleared.reduce(function (a, b) { return a + b; }, 0), got = c.seen.filter(Boolean).length;
    NT.ext.active = false; root.hidden = true; root.classList.remove('on'); NT.stage.classList.remove('cqmode');
    NT.hideCat(false); NT.setChrome(false); NT.setBusyUI(false);
    NT.setPose('happy', 2200); NT.say('蛋糕图鉴 ' + got + '/' + CAKES.length + '，下次还想去', 3600);
    NT.render(); NT.save();
  }

  btnCake.addEventListener('click', enter);
  $('#cqHome').addEventListener('click', leave);
  $('#cqMenuBtn').addEventListener('click', openMenu);
  $('#cqWinMenu').addEventListener('click', openMenu);
  $('#cqLoseMenu').addEventListener('click', openMenu);
  $('#cqLoseAgain').addEventListener('click', function () { if (G) { G.token++; loadVariant(G.lv, G.vi); } });
  $('#cqWinNext').addEventListener('click', function () { var lv = G ? G.lv : 0; if (this.getAttribute('data-act') === 'again') startLevel(lv); else startLevel(Math.min(LV.length - 1, lv + 1)); });
  $('#cqRedo').addEventListener('click', function () { if (G && !G.over) { G.token++; loadVariant(G.lv, G.vi); } });
  $('#cqUndo').addEventListener('click', undo);
  $('#cqBookBtn').addEventListener('click', function () { paintBook(); el.menu.hidden = true; el.book.hidden = false; });
  $('#cqBookX').addEventListener('click', function () { if (bookOnly) { bookOnly = false; leave(); return; } el.book.hidden = true; paintMenu(); el.menu.hidden = false; });
  $('#cqBookSell').addEventListener('click', sellAll);
  el.snd.addEventListener('click', function () { NT.setMute(!NT.S().mute); paintMenu(); });
  window.addEventListener('naituan:sound-change', function () { if (master) master.gain.value = NT.S().mute ? 0 : 0.5; });
  window.addEventListener('resize', function () { if (G && !root.hidden) layout(true); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { if (G && !root.hidden) layout(true); }, 250); });
  function openCollection() {
    if (NT.isBusy()) return;
    bookOnly = true; NT.ext.active = true; NT.hideCat(true); NT.setChrome(true); NT.setBusyUI(true);
    root.hidden = false; root.classList.add('on'); NT.stage.classList.add('cqmode');
    el.play.hidden = el.menu.hidden = el.win.hidden = el.lose.hidden = true;
    paintBook(); el.book.hidden = false;
  }
  window.NTQ = { get: function () { return G; }, CAKES: CAKES, cq: cq, openBook: openCollection };
})();
