(function () {
  'use strict';
  var SPR = /*SPR:BEGIN*/{
    sit: 'assets/sit.webp',
    happy: 'assets/happy.webp',
    fish: 'assets/fish.webp',
    cry: 'assets/cry.webp',
    shy: 'assets/shy.webp',
    stretch: 'assets/stretch.webp',
    box: 'assets/box.webp',
    peek: 'assets/peek.webp',
    peekc: 'assets/peekc.webp'
  }/*SPR:END*/;
  var KEY = 'naituan-house-v1';
  var $ = function (s) { return document.querySelector(s); };
  var cat = $('#cat'), catimg = $('#catimg'), stage = $('#stage'), bubble = $('#bubble'), zzz = $('#zzz');
  var btnFeed = $('#btnFeed'), btnSleep = $('#btnSleep'), btnHide = $('#btnHide'), sleepLabel = $('#sleepLabel');
  var btnStack = $('#btnStack'), coinEl = $('#coins');
  var hsEl = $('#hs'), slots = [];
  var meters = { hunger: $('#m-hunger'), mood: $('#m-mood'), energy: $('#m-energy') };
  var S, curPose = '', override = null, sayUntil = 0, sayText = '', lastTap = [], RH = { active: false }, SG = { active: false, over: false };
  var busy = function () { return RH.active || SG.active; };
  function setBusyUI(b) { btnFeed.disabled = btnSleep.disabled = btnHide.disabled = btnStack.disabled = b; }

  var clamp = function (v) { return Math.max(0, Math.min(100, v)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var now = function () { return Date.now(); };

  /* preload sprites */
  var IMG = {};
  Object.keys(SPR).forEach(function (k) { var im = new Image(); im.src = SPR[k]; IMG[k] = im; });

  /* ---------- state ---------- */
  function fresh() { return { hunger: 72, mood: 70, energy: 80, sleeping: false, secs: 0, fish: 0, best: 0, bestBeat: 0, mute: false, t: now() }; }
  function load(hotData) {
    var d = null;
    if (hotData && typeof hotData.hunger === 'number') d = hotData;
    else { try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; } }
    S = fresh(); loadDecor(d);
    if (d && typeof d.hunger === 'number') {
      S.hunger = clamp(d.hunger); S.mood = clamp(d.mood); S.energy = clamp(d.energy);
      S.sleeping = !!d.sleeping; S.secs = +d.secs || 0; S.fish = Math.max(0, Math.floor(+d.fish || 0)); S.best = Math.max(0, Math.floor(+d.best || 0)); S.bestBeat = Math.max(0, Math.floor(+d.bestBeat || 0)); S.mute = !!d.mute;
      var away = Math.min(Math.max((now() - (+d.t || now())) / 1000, 0), 1800);
      if (away > 20) { /* time away: slower decay, never below 20 */
        if (S.sleeping) { S.energy = clamp(S.energy + away * 0.6); S.hunger = Math.max(20, S.hunger - away * 0.03); if (S.energy >= 100) S.sleeping = false; }
        else { S.hunger = Math.max(20, S.hunger - away * 0.08); S.mood = Math.max(20, S.mood - away * 0.05); S.energy = Math.max(20, S.energy - away * 0.04); }
      }
    }
  }
  function save() { S.t = now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- speech ---------- */
  function say(t, ms) { sayText = t; sayUntil = now() + (ms || 3800); bubble.textContent = t; }
  function idleLine() {
    if (S.sleeping) return '呼……呼……';
    if (S.hunger < 25) return '肚子咕咕叫，想吃小鱼……';
    if (S.mood < 25) return '没人陪我，有点难过';
    if (S.energy < 20) return '眼睛快睁不开了……';
    if (S.hunger < 50) return '有点饿了呢';
    if (S.mood > 85 && S.hunger > 60) return '今天也是好奶团！';
    return '点点我，可以摸摸';
  }

  /* ---------- pose ---------- */
  function setPose(name, ms) { override = { name: name, until: now() + ms }; render(); }
  function computePose() {
    if (S.sleeping) return 'box';
    if (override && now() < override.until) return override.name;
    override = null;
    if (S.hunger < 25 || S.mood < 25) return 'cry';
    return 'sit';
  }
  function applyPose(p) {
    if (p === curPose) return;
    curPose = p;
    catimg.src = SPR[p];
    cat.setAttribute('data-pose', p);
    catimg.classList.remove('pop'); void catimg.offsetWidth; catimg.classList.add('pop');
  }

  /* ---------- render ---------- */
  function paintMeter(el, v) {
    var r = Math.round(v);
    el.querySelector('.fill').style.width = r + '%';
    el.querySelector('.num').textContent = r;
    el.setAttribute('data-low', r < 25 ? '1' : '0');
  }
  function addFish(n) { if (!n) return; S.fish += n; renderCoins(); coinEl.classList.remove('bump'); void coinEl.offsetWidth; coinEl.classList.add('bump'); }
  function renderCoins() { $('#coinNum').textContent = S.fish; var sc = $('#shopCoinNum'); if (sc) sc.textContent = S.fish; }
  function render() {
    applyPose(computePose());
    renderCoins();
    paintMeter(meters.hunger, S.hunger); paintMeter(meters.mood, S.mood); paintMeter(meters.energy, S.energy);
    zzz.hidden = !S.sleeping;
    btnSleep.setAttribute('aria-pressed', S.sleeping ? 'true' : 'false');
    sleepLabel.textContent = S.sleeping ? '叫醒' : '睡觉';
    btnSleep.classList.toggle('nudge', !S.sleeping && S.energy < 25);
    btnFeed.classList.toggle('nudge', !S.sleeping && S.hunger < 25);
    var m = Math.floor(S.secs / 60);
    $('#together').textContent = '已陪伴 ' + (m >= 60 ? Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分钟' : m + ' 分钟');
    if (now() > sayUntil) { var l = idleLine(); if (l !== sayText) { sayText = l; bubble.textContent = l; } }
  }

  /* ---------- effects ---------- */
  var HEART = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 21C5 15.5 2.5 12 2.5 8.6A5.1 5.1 0 0 1 12 6.4a5.1 5.1 0 0 1 9.5 2.2C21.5 12 19 15.5 12 21z" fill="#e2897d" stroke="#54392f" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  function heartAt(x, y) {
    var h = document.createElement('span');
    h.className = 'fx'; h.innerHTML = HEART;
    h.style.left = x + 'px'; h.style.top = y + 'px'; h.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
    stage.appendChild(h);
    setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 1050);
  }
  function textAt(t, x, y) {
    var h = document.createElement('span');
    h.className = 'fx txt'; h.textContent = t; h.style.left = x + 'px'; h.style.top = y + 'px'; h.style.setProperty('--dx', '0px');
    stage.appendChild(h);
    setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 1050);
  }
  function shake() { cat.classList.remove('shake'); void cat.offsetWidth; cat.classList.add('shake'); setTimeout(function () { cat.classList.remove('shake'); }, 420); }

  /* ---------- actions ---------- */
  function pet(ev) {
    if (busy()) return;
    var r = stage.getBoundingClientRect();
    var x = (ev && ev.clientX != null ? ev.clientX : r.left + r.width / 2) - r.left;
    var y = (ev && ev.clientY != null ? ev.clientY : r.top + r.height / 2) - r.top - 10;
    if (S.sleeping) { S.sleeping = false; setPose('stretch', 2000); say('被戳醒啦……'); render(); save(); return; }
    var t = now(); lastTap = lastTap.filter(function (v) { return t - v < 4000; }); lastTap.push(t);
    heartAt(x, y);
    if (S.hunger < 25) { say('先给我小鱼嘛……', 2600); setPose('cry', 1200); S.mood = clamp(S.mood + 1); }
    else if (lastTap.length >= 6) { lastTap = []; S.mood = clamp(S.mood + 5); setPose('shy', 2600); say(pick(['嘿嘿，不好意思了', '再摸脸要红了'])); }
    else { S.mood = clamp(S.mood + 3); setPose('happy', 1500); say(pick(['呼噜呼噜~', '好舒服', '再摸摸']), 2200); }
    render(); save();
  }
  function feed() {
    if (S.sleeping) { say('睡着啦，等它醒了再吃'); return; }
    if (S.hunger >= 92) { say('吃不下啦，肚子圆圆的'); shake(); return; }
    S.hunger = clamp(S.hunger + 28); S.mood = clamp(S.mood + 2);
    setPose('fish', 3200); say(pick(['好吃！', '小鱼最棒了', '咔哧咔哧……']), 3200);
    render(); save();
  }
  function toggleSleep() {
    if (S.sleeping) { S.sleeping = false; setPose('stretch', 2200); say(S.energy >= 100 ? '睡饱啦！' : '才睡了一会儿……'); render(); save(); return; }
    if (S.energy >= 90) { say('还不困呢，再玩一会儿'); return; }
    override = null; S.sleeping = true; say('钻进纸箱，晚安……', 3000); render(); save();
  }

  /* ---------- rhythm hide-and-seek ---------- */
  var NB = 80, COUNTIN = 4, BPM0 = 84, BPM1 = 150, ROWS_AT = [0, 20, 44];
  var slotsEl = $('#slots'), rhScoreEl = $('#rhScore'), rhLivesEl = $('#rhLives'), rhFill = $('#rhFill'), rhJudge = $('#rhJudge');
  var rhBpmEl = $('#rhBpm'), rhComboEl = $('#rhCombo'), rhIntro = $('#rhIntro'), rhOver = $('#rhOver'), rhSoundBtn = $('#rhSound');
  var metersEl0 = $('#meters'), actionsEl0 = $('#actions'), hintEl0 = $('#hint'), btnShop0 = $('#btnShop'), btnSave0 = $('#btnSave'), app0 = $('#app');
  var RHS = null, slotEv = [], useAC = false;
  var LIFE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.5 2.5 12 2.5 8.6A5.1 5.1 0 0 1 12 6.4a5.1 5.1 0 0 1 9.5 2.2C21.5 12 19 15.5 12 21z" fill="#e2897d" stroke="#54392f" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  /* --- synth: a tiny drum + bass loop, every tap plays a note --- */
  var AC = null, master = null, noiseBuf = null;
  var BASS = [130.81, 110, 87.31, 98];
  var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
  function audioInit() {
    if (!AC) {
      try {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) {
          AC = new C(); master = AC.createGain(); master.gain.value = S.mute ? 0 : 0.55; master.connect(AC.destination);
          noiseBuf = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.2), AC.sampleRate);
          var ch = noiseBuf.getChannelData(0); for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        }
      } catch (e) { AC = null; }
    }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  }
  function setMute(m) { S.mute = !!m; if (master) master.gain.value = S.mute ? 0 : 0.55; rhSoundBtn.textContent = S.mute ? '音效：关' : '音效：开'; save(); }
  function clock() { return useAC ? AC.currentTime : performance.now() / 1000; }
  function env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, t, dur, type, vol, freqEnd) {
    if (!useAC) return;
    var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    env(g, t, 0.005, dur, vol); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.06);
  }
  function hat(t, vol) {
    if (!useAC) return;
    var s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
    env(g, t, 0.002, 0.05, vol); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.1);
  }

  /* --- timeline: 4 count-in beats, then NB beats that speed up from BPM0 to BPM1 --- */
  function bpmAt(i) { return BPM0 + (BPM1 - BPM0) * (i / (NB - 1)); }
  function rowsAt(i) { return i >= ROWS_AT[2] ? 3 : i >= ROWS_AT[1] ? 2 : 1; }
  function buildBeats() {
    var beats = [], t = 0, i, ci = 60 / BPM0;
    for (i = 0; i < COUNTIN; i++) { beats.push({ t: t, ivl: ci }); t += ci; }
    for (i = 0; i < NB; i++) { var iv = 60 / bpmAt(i); beats.push({ t: t, ivl: iv }); t += iv; }
    return beats;
  }
  function genEvents(beats) {
    var evs = [], lastReal = -1, prevReal = -1, i, k, tries;
    for (i = 0; i < NB; i++) {
      var bt = beats[COUNTIN + i], n = rowsAt(i) * 3, half = bt.ivl * 0.5, used = [];
      if (i === ROWS_AT[1] - 1 || i === ROWS_AT[2] - 1) continue; /* rest while the grid grows */
      var fakeOnly = i >= 30 && Math.random() < 0.1;
      var restP = i < 8 ? 0 : i < 40 ? 0.1 : 0.14;
      if (!fakeOnly && Math.random() >= restP) {
        var r; tries = 0; do { r = Math.floor(Math.random() * n); tries++; } while ((r === lastReal || r === prevReal) && tries < 30);
        prevReal = lastReal; lastReal = r; used.push(r);
        evs.push({ t: bt.t, half: half, slot: r, fake: false, i: i });
      }
      var fp = i < 12 ? 0 : i < 30 ? 0.25 : i < 50 ? 0.4 : 0.5, nf = 0;
      if (fakeOnly) nf = Math.random() < 0.3 ? 2 : 1; else if (Math.random() < fp) nf = i >= 50 && Math.random() < 0.2 ? 2 : 1;
      for (k = 0; k < nf; k++) {
        var f; tries = 0; do { f = Math.floor(Math.random() * n); tries++; } while (used.indexOf(f) >= 0 && tries < 30);
        if (used.indexOf(f) < 0) { used.push(f); evs.push({ t: bt.t, half: half, slot: f, fake: true, i: i }); }
      }
      if (i >= 56 && !fakeOnly && Math.random() < 0.3) { /* an extra cat on the off-beat */
        var o; tries = 0; do { o = Math.floor(Math.random() * n); tries++; } while ((used.indexOf(o) >= 0 || o === lastReal) && tries < 30);
        evs.push({ t: bt.t + bt.ivl * 0.5, half: bt.ivl * 0.3, slot: o, fake: false, i: i });
      }
    }
    evs.sort(function (a, b) { return (a.t - a.half) - (b.t - b.half); });
    var busyUntil = {}, out = [];
    evs.forEach(function (e) { /* never put two cats in the same box at the same time */
      var st = e.t - e.half, n = rowsAt(e.i) * 3;
      if ((busyUntil[e.slot] || -1) > st) {
        var free = []; for (var q = 0; q < n; q++) if ((busyUntil[q] || -1) <= st) free.push(q);
        if (!free.length) return; e.slot = pick(free);
      }
      busyUntil[e.slot] = e.t + e.half; out.push(e);
    });
    return out;
  }

  /* --- ui helpers --- */
  function slotImgT(i, y) { return 'translate(-50%, ' + y + '%)' + (i % 3 === 2 ? ' scaleX(-1)' : ''); }
  (function buildSlots() {
    for (var i = 0; i < 9; i++) (function (i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.setAttribute('data-i', i); b.setAttribute('aria-label', '箱子 ' + (i + 1));
      var im = document.createElement('img'); im.alt = ''; im.src = SPR.peekc; im.style.transform = slotImgT(i, 118); b.appendChild(im);
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); rhTap(i); });
      slotsEl.appendChild(b); slots.push(b); slotEv.push(null);
    })(i);
  })();
  function rhLayout(rows) { slotsEl.setAttribute('data-rows', rows); slots.forEach(function (s, i) { s.hidden = i >= rows * 3; }); }
  function rhClearSlots() { slots.forEach(function (s, i) { s.className = 'slot'; s.querySelector('img').style.transform = slotImgT(i, 118); slotEv[i] = null; }); }
  function rhJudgeSay(t) { rhJudge.textContent = t; rhJudge.classList.remove('pop'); void rhJudge.offsetWidth; rhJudge.classList.add('pop'); }
  function rhPaint() {
    rhScoreEl.textContent = RHS ? RHS.score : 0;
    rhComboEl.textContent = '连击 ' + (RHS ? RHS.combo : 0);
    var lv = RHS ? RHS.lives : 5, h = ''; for (var i = 0; i < 5; i++) h += i < lv ? LIFE : LIFE.replace('<svg ', '<svg class="off" ');
    rhLivesEl.innerHTML = h; rhLivesEl.setAttribute('aria-label', '剩余生命 ' + lv);
  }
  function setChrome(hide) {
    metersEl0.hidden = actionsEl0.hidden = hintEl0.hidden = btnShop0.hidden = btnSave0.hidden = hide;
    app0.classList.toggle('rhmode', hide);
  }

  /* --- flow --- */
  function rhStart() {
    if (S.sleeping) { say('奶团睡着了，先叫醒它'); return; }
    RH.active = true; RHS = null;
    hsEl.hidden = false; stage.classList.add('playing'); $('#catbox').style.visibility = 'hidden'; bubble.hidden = true;
    setBusyUI(true); setChrome(true); window.scrollTo(0, 0);
    rhLayout(1); rhClearSlots(); rhFill.style.width = '0'; rhBpmEl.textContent = 'BPM ' + BPM0; rhJudge.textContent = '';
    rhPaint(); rhOver.hidden = true; rhIntro.hidden = false;
    $('#rhBest').textContent = S.bestBeat ? '最高分 ' + S.bestBeat : '还没有记录，来一局吧';
    rhSoundBtn.textContent = S.mute ? '音效：关' : '音效：开';
  }
  function rhGo() {
    audioInit(); rhIntro.hidden = true; rhOver.hidden = true; rhClearSlots(); rhLayout(1); rhFill.style.width = '0'; rhJudgeSay('准备…');
    RHS = null; rhPaint();
    setTimeout(function () { if (RH.active) rhBegin(); }, 260); /* let the audio clock start */
  }
  function rhBegin() {
    useAC = !!(AC && AC.state === 'running' && AC.currentTime > 0.02);
    var beats = buildBeats(), evs = genEvents(beats);
    RHS = { beats: beats, evs: evs, evIdx: 0, active: [], t0: clock() + 0.6, score: 0, combo: 0, maxCombo: 0, lives: 5, hits: 0, perfects: 0, realSeen: 0, dodged: 0,
            nextBeat: 0, lastBeat: -1, rows: 1, ended: false, settled: false, sched: 0, raf: 0 };
    rhPaint();
    RHS.sched = setInterval(rhSchedule, 25); rhSchedule();
    RHS.raf = requestAnimationFrame(rhFrame);
  }
  function rhSchedule() {
    if (!RHS || RHS.ended) return;
    var nowT = clock();
    while (RHS.nextBeat < RHS.beats.length && RHS.t0 + RHS.beats[RHS.nextBeat].t < nowT + 0.15) {
      var k = RHS.nextBeat++, b = RHS.beats[k], T = RHS.t0 + b.t;
      if (k < COUNTIN) { tone(k === COUNTIN - 1 ? 1240 : 880, T, 0.08, 'square', 0.1); continue; }
      var gi = k - COUNTIN;
      if (gi % 2 === 0) tone(150, T, 0.16, 'sine', 0.85, 45);
      hat(T + b.ivl / 2, 0.12);
      if (gi % 4 === 0 || gi % 4 === 2) tone(BASS[Math.floor(gi / 4) % 4], T, b.ivl * 1.7, 'triangle', 0.4);
      if (gi % 4 === 0) { var root = BASS[Math.floor(gi / 4) % 4] * 4; tone(root, T, b.ivl * 3, 'sine', 0.08); tone(root * 1.5, T, b.ivl * 3, 'sine', 0.06); }
    }
  }
  function onBeat(k) {
    if (k < COUNTIN) { rhJudgeSay(k < COUNTIN - 1 ? String(COUNTIN - 1 - k) : '开始！'); return; }
    var gi = k - COUNTIN;
    rhBpmEl.textContent = 'BPM ' + Math.round(bpmAt(gi)); rhBpmEl.classList.remove('beat'); void rhBpmEl.offsetWidth; rhBpmEl.classList.add('beat');
    rhFill.style.width = Math.round(gi / (NB - 1) * 100) + '%';
    var want = rowsAt(gi + 1);
    if (want !== RHS.rows) { RHS.rows = want; rhLayout(want); rhJudgeSay('箱子变多了！'); }
  }
  function ease(p) { return 1 - (1 - p) * (1 - p); }
  function rhFrame() {
    if (!RHS || RHS.ended) return;
    var t = clock() - RHS.t0, i, e;
    while (RHS.lastBeat + 1 < RHS.beats.length && RHS.beats[RHS.lastBeat + 1].t <= t) onBeat(++RHS.lastBeat);
    while (RHS.evIdx < RHS.evs.length && RHS.evs[RHS.evIdx].t - RHS.evs[RHS.evIdx].half <= t) {
      e = RHS.evs[RHS.evIdx++]; e.done = false; e.y = 118; RHS.active.push(e); slotEv[e.slot] = e;
      var el = slots[e.slot]; el.classList.remove('ok', 'bad'); el.classList.toggle('fake', e.fake);
      el.style.setProperty('--gray', e.i < ROWS_AT[1] ? 1 : e.i < ROWS_AT[2] ? 0.9 : 0.75);
    }
    for (i = RHS.active.length - 1; i >= 0; i--) {
      e = RHS.active[i];
      var img = slots[e.slot].querySelector('img'), y;
      if (!e.done) {
        var p = Math.max(0, Math.min(1, 1 - Math.abs(t - e.t) / e.half)); y = (1 - ease(p)) * 118; e.y = y;
        if (t > e.t + e.half) { rhExpire(e); RHS.active.splice(i, 1); slotEv[e.slot] = null; slots[e.slot].classList.remove('fake'); img.style.transform = slotImgT(e.slot, 118); if (RHS.ended) return; continue; }
      } else {
        var q = Math.min(1, (t - e.doneT) / 0.16); y = e.y + (118 - e.y) * q;
        if (q >= 1) { RHS.active.splice(i, 1); slotEv[e.slot] = null; slots[e.slot].classList.remove('fake', 'ok', 'bad'); img.style.transform = slotImgT(e.slot, 118); continue; }
      }
      img.style.transform = slotImgT(e.slot, y);
    }
    var last = RHS.beats[RHS.beats.length - 1];
    if (RHS.evIdx >= RHS.evs.length && !RHS.active.length && t > last.t + last.ivl + 0.5) { rhFinish(false); return; }
    RHS.raf = requestAnimationFrame(rhFrame);
  }
  function rhExpire(e) {
    if (e.fake) { RHS.dodged++; return; }
    RHS.realSeen++; RHS.combo = 0; RHS.lives--; rhJudgeSay('溜走了'); tone(110, clock(), 0.18, 'sine', 0.25, 70); rhPaint();
    if (RHS.lives <= 0) rhFinish(true);
  }
  function rhTap(idx) {
    if (!RHS || RHS.ended || !RH.active) return;
    var t = clock() - RHS.t0;
    if (t < RHS.beats[COUNTIN].t - 0.3) return;
    var e = slotEv[idx];
    if (e && !e.done && Math.abs(t - e.t) <= e.half * 0.9) {
      var dt = Math.abs(t - e.t); e.done = true; e.doneT = t;
      if (e.fake) {
        RHS.combo = 0; RHS.lives--; slots[idx].classList.add('bad'); rhJudgeSay('假的！'); tone(190, clock(), 0.22, 'sawtooth', 0.22, 70);
        rhPaint(); if (RHS.lives <= 0) rhFinish(true);
      } else {
        var q = dt <= 0.07 ? 0 : dt <= 0.13 ? 1 : 2, base = [100, 70, 40][q];
        RHS.realSeen++; RHS.hits++; if (q === 0) RHS.perfects++; RHS.combo++; if (RHS.combo > RHS.maxCombo) RHS.maxCombo = RHS.combo;
        RHS.score += Math.round(base * (1 + Math.min(RHS.combo, 20) * 0.05));
        rhJudgeSay(['完美！', '很好', '还行'][q]); slots[idx].classList.remove('bad'); slots[idx].classList.add('ok');
        var f = SCALE[(RHS.hits * 2 + idx) % 5 + (q === 0 ? 0 : 0)], now0 = clock(); tone(f, now0, 0.28, 'sine', 0.32); tone(f * 2, now0, 0.14, 'triangle', 0.07);
        if (q < 2) { var r = stage.getBoundingClientRect(), b = slots[idx].getBoundingClientRect(); heartAt(b.left - r.left + b.width / 2, b.top - r.top + 12); }
        rhPaint();
      }
    } else {
      RHS.score = Math.max(0, RHS.score - 20); RHS.combo = 0; rhJudgeSay('空的'); tone(140, clock(), 0.1, 'sine', 0.15, 100); rhPaint();
    }
  }
  function rhSettle(dead) {
    if (!RHS || RHS.settled) return RHS && RHS.result;
    RHS.settled = true;
    var acc = RHS.realSeen ? RHS.hits / RHS.realSeen : 0;
    var grade = dead ? 'C' : acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : 'C';
    var coins = Math.round(RHS.hits * 0.5 + RHS.perfects * 0.5) + { S: 10, A: 6, B: 3, C: 0 }[grade];
    var record = RHS.score > (S.bestBeat || 0);
    if (record) S.bestBeat = RHS.score;
    S.mood = clamp(S.mood + Math.min(25, Math.round(RHS.hits / 3))); S.hunger = clamp(S.hunger - 6); S.energy = clamp(S.energy - 6);
    addFish(coins); save();
    return (RHS.result = { grade: grade, coins: coins, record: record, dead: dead, acc: acc });
  }
  function rhFinish(dead) {
    if (!RHS || RHS.ended) return;
    RHS.ended = true; clearInterval(RHS.sched); cancelAnimationFrame(RHS.raf);
    var r = rhSettle(dead);
    rhClearSlots();
    $('#rhTitle').textContent = dead ? '奶团躲远了……' : '等级 ' + r.grade;
    $('#rhSub').textContent = '得分 ' + RHS.score + (r.record ? ' · 新纪录！' : ' · 最高 ' + S.bestBeat);
    $('#rhStats').textContent = '命中 ' + RHS.hits + ' / ' + RHS.realSeen + ' · 完美 ' + RHS.perfects + ' · 最高连击 ' + RHS.maxCombo + ' · 识破假猫 ' + RHS.dodged;
    $('#rhRew').textContent = '小鱼干 +' + r.coins;
    setTimeout(function () { if (RH.active && RHS && RHS.ended) rhOver.hidden = false; }, 500);
  }
  function rhLeave() {
    if (RHS && !RHS.ended) { RHS.ended = true; clearInterval(RHS.sched); cancelAnimationFrame(RHS.raf); rhSettle(false); }
    var r = RHS && RHS.result;
    RH.active = false; hsEl.hidden = true; rhIntro.hidden = true; rhOver.hidden = true; rhClearSlots();
    stage.classList.remove('playing'); bubble.hidden = false; $('#catbox').style.visibility = ''; setChrome(false); setBusyUI(false);
    if (r && RHS.hits > 0) {
      if (r.grade === 'S' || r.grade === 'A') { setPose('happy', 2600); say('节奏躲猫猫 ' + r.grade + '，小鱼干 +' + r.coins + '！', 4200); }
      else { setPose('shy', 2600); say('躲猫猫玩完了，小鱼干 +' + r.coins, 4200); }
    } else { setPose('sit', 2000); say('下次一起玩吧', 3200); }
    RHS = null; render(); save();
  }
  document.addEventListener('visibilitychange', function () {
    if (!RH.active || !RHS || RHS.ended) return;
    if (document.hidden) { if (useAC) { try { AC.suspend(); } catch (e) {} } else rhLeave(); }
    else if (useAC) { try { AC.resume(); } catch (e) {} }
  });
  $('#rhGo').addEventListener('click', rhGo);
  $('#rhAgain').addEventListener('click', rhGo);
  $('#rhBack').addEventListener('click', rhLeave);
  $('#rhIntroQuit').addEventListener('click', rhLeave);
  $('#hsQuit').addEventListener('click', rhLeave);
  rhSoundBtn.addEventListener('click', function () { setMute(!S.mute); });


  /* ---------- box stacking ---------- */
  var BH = 26, TONES = ['#dcae82', '#d4a173', '#e3b98f'];
  var sgEl = $('#sg'), cv = $('#sgCanvas'), cx = cv.getContext('2d'), sgScore = $('#sgScore'), sgOver = $('#sgOver'), sgHint = $('#sgHint');
  var COL = { ink: '#54392f', floor: '#ecd8b8' };
  try { var cs = getComputedStyle(document.documentElement); COL.ink = cs.getPropertyValue('--ink').trim() || COL.ink; COL.floor = cs.getPropertyValue('--floor').trim() || COL.floor; } catch (e) {}

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }
  function drawBox(x, y, w, h, i) {
    rrect(x, y, w, h, 5); cx.fillStyle = TONES[i % 3]; cx.fill();
    cx.strokeStyle = COL.ink; cx.lineWidth = 2.5; cx.stroke();
    if (w > 30) { cx.fillStyle = 'rgba(255,250,240,.45)'; cx.fillRect(x + w / 2 - 7, y + 1.5, 14, h - 3); }
    if (w > 60) { cx.strokeStyle = 'rgba(84,57,47,.35)'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(x + 10, y + h - 7); cx.lineTo(x + 22, y + h - 7); cx.moveTo(x + w - 22, y + h - 7); cx.lineTo(x + w - 10, y + h - 7); cx.stroke(); }
  }
  function spawn() {
    var lvl = SG.tower.length, w = SG.tower[lvl - 1].w, margin = 6, maxX = SG.W - w - margin, fromLeft = lvl % 2 === 1;
    SG.m = { w: w, x: fromLeft ? margin : maxX, dir: fromLeft ? 1 : -1, level: lvl, min: margin, max: maxX };
  }
  function sgReset() {
    SG.W = cv.clientWidth; SG.H = cv.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(SG.W * dpr); cv.height = Math.round(SG.H * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SG.ground = Math.round(SG.H * 0.86);
    var bw = Math.min(150, Math.round(SG.W * 0.4));
    SG.baseW = bw; SG.tower = [{ x: Math.round((SG.W - bw) / 2), w: bw }];
    SG.perfects = 0; SG.combo = 0; SG.cam = 0; SG.debris = []; SG.pose = 'sit'; SG.poseUntil = 0; SG.over = false; SG.settled = false; SG.floors = 0;
    spawn();
    sgScore.textContent = '0 层'; sgOver.hidden = true; sgHint.hidden = false;
  }
  function sgStart() {
    if (S.sleeping) { say('奶团睡着了，先叫醒它'); return; }
    SG.active = true;
    sgEl.hidden = false; stage.classList.add('stacking'); $('#catbox').style.visibility = 'hidden'; bubble.hidden = true; setBusyUI(true);
    sgReset(); SG.last = performance.now();
    cancelAnimationFrame(SG.raf); SG.raf = requestAnimationFrame(sgLoop);
  }
  function sgSettle() {
    if (SG.settled) return; SG.settled = true;
    SG.floors = SG.tower.length - 1;
    var earned = SG.floors + SG.perfects;
    SG.earned = earned; SG.record = SG.floors > S.best;
    if (SG.record) S.best = SG.floors;
    S.mood = clamp(S.mood + Math.min(20, SG.floors * 2)); S.hunger = clamp(S.hunger - 6); S.energy = clamp(S.energy - 6);
    addFish(earned); save();
  }
  function sgFinish() {
    SG.over = true; SG.pose = 'cry'; SG.poseUntil = Infinity;
    sgSettle();
    setTimeout(function () {
      if (!SG.active || !SG.over) return;
      $('#sgTitle').textContent = SG.floors > 0 ? '堆了 ' + SG.floors + ' 层' : '一层都没堆上';
      $('#sgBest').textContent = SG.record && SG.floors > 0 ? '新纪录！' : '最高 ' + S.best + ' 层';
      $('#sgRew').textContent = '小鱼干 +' + SG.earned;
      sgOver.hidden = false;
    }, 900);
  }
  function sgDrop() {
    if (!SG.active || SG.over || !SG.m) return;
    sgHint.hidden = true;
    var m = SG.m, prev = SG.tower[SG.tower.length - 1], dx = m.x - prev.x, overlap = m.w - Math.abs(dx);
    var topY = SG.ground - (m.level + 1) * BH, placed, r = stage.getBoundingClientRect();
    if (overlap <= 0) {
      SG.debris.push({ x: m.x, y: topY, w: m.w, h: BH, vx: dx > 0 ? 70 : -70, vy: 0, rot: 0, vr: dx > 0 ? 2.2 : -2.2, i: m.level });
      SG.m = null; sgFinish(); return;
    }
    if (Math.abs(dx) <= 5) {
      SG.combo++; SG.perfects++;
      placed = { x: prev.x, w: m.w };
      if (SG.combo >= 3 && placed.w < SG.baseW) { var nw = Math.min(SG.baseW, placed.w + 8); placed.x = Math.max(0, Math.min(SG.W - nw, placed.x - (nw - placed.w) / 2)); placed.w = nw; }
      SG.pose = 'happy'; SG.poseUntil = performance.now() + 700;
      textAt(SG.combo >= 3 ? '连击 ×' + SG.combo : '好准！', SG.W / 2 + 2, SG.H * 0.3);
    } else {
      SG.combo = 0;
      if (dx > 0) { placed = { x: m.x, w: overlap }; SG.debris.push({ x: prev.x + prev.w, y: topY, w: dx, h: BH, vx: 40, vy: 0, rot: 0, vr: 1.6, i: m.level }); }
      else { placed = { x: prev.x, w: overlap }; SG.debris.push({ x: m.x, y: topY, w: -dx, h: BH, vx: -40, vy: 0, rot: 0, vr: -1.6, i: m.level }); }
      SG.pose = 'sit'; SG.poseUntil = 0;
    }
    SG.tower.push(placed);
    sgScore.textContent = (SG.tower.length - 1) + ' 层';
    spawn();
  }
  function sgLoop(t) {
    if (!SG.active) return;
    var dt = Math.min(0.05, (t - SG.last) / 1000); SG.last = t;
    var m = SG.m;
    if (m && !SG.over) {
      var v = Math.min(380, 150 + m.level * 9);
      m.x += m.dir * v * dt;
      if (m.x >= m.max) { m.x = m.max; m.dir = -1; } else if (m.x <= m.min) { m.x = m.min; m.dir = 1; }
    }
    var camT = Math.max(0, (SG.tower.length - 5) * BH); SG.cam += (camT - SG.cam) * Math.min(1, dt * 6);
    SG.debris.forEach(function (d) { d.vy += 1500 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vr * dt; });
    SG.debris = SG.debris.filter(function (d) { return d.y < SG.ground + SG.H * 2; });
    sgDraw(t);
    SG.raf = requestAnimationFrame(sgLoop);
  }
  function sgDraw(t) {
    cx.clearRect(0, 0, SG.W, SG.H);
    cx.save(); cx.translate(0, SG.cam);
    cx.fillStyle = COL.floor; cx.fillRect(0, SG.ground, SG.W, SG.H * 2);
    cx.strokeStyle = COL.ink; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(0, SG.ground); cx.lineTo(SG.W, SG.ground); cx.stroke();
    SG.tower.forEach(function (b, i) { drawBox(b.x, SG.ground - (i + 1) * BH, b.w, BH, i); });
    var top = SG.tower[SG.tower.length - 1], size = 100, catX, catY;
    if (SG.m) {
      drawBox(SG.m.x, SG.ground - (SG.m.level + 1) * BH, SG.m.w, BH, SG.m.level);
      catX = SG.m.x + SG.m.w / 2 - size / 2; catY = SG.ground - (SG.m.level + 1) * BH - size * 0.83;
    } else {
      catX = top.x + top.w / 2 - size / 2; catY = SG.ground - SG.tower.length * BH - size * 0.83;
    }
    var pose = SG.pose; if (pose === 'happy' && t > SG.poseUntil) { SG.pose = pose = 'sit'; }
    var im = IMG[pose] || IMG.sit; if (im && im.complete) cx.drawImage(im, catX, catY, size, size);
    SG.debris.forEach(function (d) {
      cx.save(); cx.translate(d.x + d.w / 2, d.y + d.h / 2); cx.rotate(d.rot); cx.translate(-d.w / 2, -d.h / 2);
      var sx = cx; drawBoxAt(d);
      cx.restore();
    });
    cx.restore();
  }
  function drawBoxAt(d) { var ox = d.x, oy = d.y; drawBox(0, 0, d.w, d.h, d.i); }
  function sgLeave() {
    if (!SG.over) { sgSettle(); }
    SG.active = false; cancelAnimationFrame(SG.raf);
    sgEl.hidden = true; sgOver.hidden = true; stage.classList.remove('stacking'); $('#catbox').style.visibility = ''; bubble.hidden = false; setBusyUI(false);
    var f = SG.floors || 0;
    if (f >= 8) { setPose('happy', 2600); say('堆了 ' + f + ' 层，小鱼干 +' + SG.earned + '！', 4200); }
    else if (f >= 1) { setPose('shy', 2600); say('堆了 ' + f + ' 层，小鱼干 +' + SG.earned, 4200); }
    else { setPose('sit', 2000); say('下次一定堆高', 3600); }
    render(); save();
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); sgDrop(); });
  document.addEventListener('keydown', function (e) { if (SG.active && !SG.over && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); sgDrop(); } });
  btnStack.addEventListener('click', sgStart);
  $('#sgQuit').addEventListener('click', sgLeave);
  $('#sgBack').addEventListener('click', sgLeave);
  $('#sgAgain').addEventListener('click', function () { sgReset(); SG.last = performance.now(); });


  /* ---------- shop ---------- */
  var CATALOG = {
    wall: [{ id: 'dots', name: '天空点点', price: 0 }, { id: 'stripe', name: '奶油条纹', price: 20 }, { id: 'check', name: '薄荷格子', price: 30 }, { id: 'sakura', name: '樱花粉', price: 40 }, { id: 'night', name: '夜空星星', price: 60 }],
    rug: [{ id: 'pink', name: '粉粉圆毯', price: 0 }, { id: 'cream', name: '奶油方毯', price: 15 }, { id: 'berry', name: '草莓毯', price: 25 }, { id: 'dot', name: '蓝色波点', price: 25 }, { id: 'rainbow', name: '彩虹圈', price: 45 }],
    win: [{ id: 'plain', name: '普通窗', price: 0 }, { id: 'curtain', name: '粉窗帘', price: 20 }, { id: 'pot', name: '花盆窗', price: 25 }, { id: 'moon', name: '月亮窗', price: 30 }, { id: 'rain', name: '下雨窗', price: 35 }],
    prop: [{ id: 'yarn', name: '毛线球', price: 15 }, { id: 'cushion', name: '小抱枕', price: 20 }, { id: 'plant', name: '绿植', price: 25 }, { id: 'lamp', name: '小台灯', price: 30 }, { id: 'frame', name: '小鱼挂画', price: 35 }, { id: 'lights', name: '星星灯串', price: 50 }]
  };
  var TABS = [['wall', '墙纸'], ['rug', '地毯'], ['win', '窗户'], ['prop', '摆件']];
  var INK = 'fill="none" stroke="#54392f" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
  var PROPS = {
    lamp: '<svg viewBox="0 0 40 90" ' + INK + '><circle cx="20" cy="20" r="19" fill="#f4b04a" fill-opacity=".22" stroke="none"/><path d="M9 30 14 6h12l5 24z" fill="#f7d08a"/><path d="M20 30v48"/><path d="M9 86q11-12 22 0z" fill="#e7b48a"/></svg>',
    plant: '<svg viewBox="0 0 44 58" ' + INK + '><path d="M22 36C10 30 7 15 13 6c9 4 12 18 9 30z" fill="#9ccbb0"/><path d="M22 36c12-5 16-19 10-28-9 4-13 17-10 28z" fill="#9ccbb0"/><path d="M22 36C17 24 19 11 22 2c4 10 5 23 0 34z" fill="#b7dcc5"/><path d="M10 35h24l-3 21H13z" fill="#e7b48a"/></svg>',
    lights: '<svg viewBox="0 0 100 12" preserveAspectRatio="xMidYMin meet" fill="none" stroke="#54392f" stroke-width="1" stroke-linecap="round"><path d="M0 2Q12 11 25 5T50 5T75 5T100 2"/><circle cx="12" cy="7.4" r="2.3" fill="#f4b04a"/><circle cx="25" cy="5" r="2.3" fill="#e2897d"/><circle cx="37.500" cy="8" r="2.3" fill="#8fa3bf"/><circle cx="50" cy="5" r="2.3" fill="#9ccbb0"/><circle cx="62.500" cy="8" r="2.3" fill="#f4b04a"/><circle cx="75" cy="5" r="2.3" fill="#e2897d"/><circle cx="88" cy="7.400" r="2.3" fill="#8fa3bf"/></svg>',
    yarn: '<svg viewBox="0 0 30 30" ' + INK + '><circle cx="14" cy="14" r="11" fill="#e2897d"/><path d="M6 10q8 6 16-2M4 15q10 7 20-1M8 22q7-4 13 0" stroke-width="1.6"/><path d="M22 22q8 2 5 7" stroke-width="2"/></svg>',
    cushion: '<svg viewBox="0 0 44 34" ' + INK + '><rect x="3" y="4" width="38" height="26" rx="10" fill="#8fa3bf"/><circle cx="22" cy="17" r="2" fill="#54392f" stroke="none"/><path d="M8 9q3-3 6 0M30 25q3 3 6 0" stroke-width="1.8"/></svg>',
    frame: '<svg viewBox="0 0 40 48" ' + INK + '><path d="M20 2 10 8M20 2l10 6" stroke-width="1.6"/><rect x="4" y="8" width="32" height="38" rx="3" fill="#e7b48a"/><rect x="9" y="13" width="22" height="28" rx="1.500" fill="#f2f7fb"/><path d="M13 27c3-5 8-6 11-2l4-3v9l-4-2c-3 4-8 3-11-2z" fill="#8fa3bf" stroke-width="1.6"/></svg>'
  };
  var WIN_INNER = '<div class="cloud"></div><div class="moon"></div><div class="rain"></div><div class="wpot"><svg viewBox="0 0 40 30" fill="none" stroke="#54392f" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M12 18v-6M20 18v-9M28 18v-7"/><circle cx="12" cy="9.500" r="3.600" fill="#e2897d"/><circle cx="20" cy="7" r="3.800" fill="#f4b04a"/><circle cx="28" cy="8.600" r="3.600" fill="#8fa3bf"/><path d="M10 17h20l-2 12H12z" fill="#e7b48a"/></svg></div><div class="curtain"></div>';
  var FISH_MINI = '<svg viewBox="0 0 32 32" fill="none" stroke="#54392f" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M3 16c4-7 12-9 18-4l6-4v16l-6-4c-6 5-14 3-18-4z" fill="#8fa3bf"/></svg>';
  var rugEl = $('#rug'), winEl = $('#window'), propsEl = $('#props'), shopEl = $('#shop'), metersEl = $('#meters'), actionsEl = $('#actions'), hintEl = $('#hint'), btnShop = $('#btnShop'), appEl = $('#app');
  var SH = { open: false, tab: 'wall', sel: null, msg: '' };

  winEl.innerHTML = WIN_INNER;
  Object.keys(PROPS).forEach(function (id) {
    var d = document.createElement('div'); d.className = 'prop p-' + id; d.setAttribute('data-prop', id); d.innerHTML = PROPS[id]; d.hidden = true; propsEl.appendChild(d);
  });

  function hasItem(cat, id) { return (CATALOG[cat] || []).some(function (i) { return i.id === id; }); }
  function findItem(cat, id) { return CATALOG[cat].filter(function (i) { return i.id === id; })[0]; }
  function loadDecor(d) {
    S.own = { 'wall:dots': 1, 'rug:pink': 1, 'win:plain': 1 }; S.eq = { wall: 'dots', rug: 'pink', win: 'plain', prop: [] }; S.shopSeen = 0;
    if (!d) return;
    if (d.own && typeof d.own === 'object') Object.keys(d.own).forEach(function (k) { var p = k.split(':'); if (d.own[k] && hasItem(p[0], p[1])) S.own[k] = 1; });
    if (d.eq && typeof d.eq === 'object') {
      ['wall', 'rug', 'win'].forEach(function (c) { if (hasItem(c, d.eq[c]) && S.own[c + ':' + d.eq[c]]) S.eq[c] = d.eq[c]; });
      if (Array.isArray(d.eq.prop)) S.eq.prop = d.eq.prop.filter(function (id) { return hasItem('prop', id) && S.own['prop:' + id]; });
    }
    S.shopSeen = d.shopSeen ? 1 : 0;
  }
  function owned(cat, id) { return !!S.own[cat + ':' + id]; }
  function equipped(cat, id) { return cat === 'prop' ? S.eq.prop.indexOf(id) >= 0 : S.eq[cat] === id; }
  function itemState(cat, id) { return equipped(cat, id) ? 'eq' : owned(cat, id) ? 'own' : 'buy'; }

  function paintDecor() {
    var e = { wall: S.eq.wall, rug: S.eq.rug, win: S.eq.win, prop: S.eq.prop.slice() };
    if (SH.open && SH.sel) { if (SH.sel.cat === 'prop') { if (e.prop.indexOf(SH.sel.id) < 0) e.prop.push(SH.sel.id); } else e[SH.sel.cat] = SH.sel.id; }
    stage.setAttribute('data-wall', e.wall); rugEl.setAttribute('data-rug', e.rug); winEl.setAttribute('data-win', e.win);
    [].forEach.call(propsEl.children, function (el) { el.hidden = e.prop.indexOf(el.getAttribute('data-prop')) < 0; });
  }
  function swatch(cat, id) {
    var d = document.createElement('div'); d.className = 'sw sw-' + cat;
    if (cat === 'wall') d.setAttribute('data-wall', id);
    else if (cat === 'rug') d.innerHTML = '<div class="rug" data-rug="' + id + '"></div>';
    else if (cat === 'win') d.innerHTML = '<div class="window" data-win="' + id + '">' + WIN_INNER + '</div>';
    else d.innerHTML = '<div class="prop p-' + id + '">' + PROPS[id] + '</div>';
    return d;
  }
  function updateBuy() {
    var nameEl = $('#buyName'), descEl = $('#buyDesc'), btn = $('#buyBtn'), s = SH.sel;
    if (!s) { nameEl.textContent = SH.msg || '选一件试试'; descEl.textContent = SH.msg ? '还想逛逛别的吗' : '点上面的东西，先在房间里看看效果'; btn.disabled = true; btn.textContent = '—'; return; }
    var it = findItem(s.cat, s.id), st = itemState(s.cat, s.id);
    nameEl.textContent = it.name;
    if (st === 'eq') {
      if (s.cat === 'prop') { descEl.textContent = '正摆在房间里'; btn.disabled = false; btn.textContent = '收起来'; }
      else { descEl.textContent = '正在使用'; btn.disabled = true; btn.textContent = '使用中'; }
    } else if (st === 'own') { descEl.textContent = '已经拥有，可以换上'; btn.disabled = false; btn.textContent = '使用'; }
    else if (S.fish >= it.price) { descEl.textContent = '买下后马上放进房间'; btn.disabled = false; btn.innerHTML = '买 ' + FISH_MINI + it.price; }
    else { descEl.textContent = '小鱼干还差 ' + (it.price - S.fish) + ' 个'; btn.disabled = true; btn.textContent = '不够'; }
  }
  function renderShop() {
    var tabsEl = $('#tabs'); tabsEl.innerHTML = '';
    TABS.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', SH.tab === t[0] ? 'true' : 'false'); b.textContent = t[1];
      b.addEventListener('click', function () { SH.tab = t[0]; SH.sel = null; SH.msg = ''; renderShop(); });
      tabsEl.appendChild(b);
    });
    var box = $('#items'); box.innerHTML = '';
    CATALOG[SH.tab].forEach(function (it) {
      var st = itemState(SH.tab, it.id), b = document.createElement('button');
      b.type = 'button'; b.className = 'item'; b.setAttribute('data-eq', st === 'eq' ? '1' : '0');
      b.setAttribute('aria-pressed', SH.sel && SH.sel.cat === SH.tab && SH.sel.id === it.id ? 'true' : 'false');
      b.appendChild(swatch(SH.tab, it.id));
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.name; b.appendChild(nm);
      var t = document.createElement('span'); t.className = 'st'; t.innerHTML = st === 'eq' ? '使用中' : st === 'own' ? '已拥有' : FISH_MINI + '<b>' + it.price + '</b>'; b.appendChild(t);
      b.addEventListener('click', function () { SH.sel = { cat: SH.tab, id: it.id }; SH.msg = ''; renderShop(); var p = $('#items .item[aria-pressed="true"]'); if (p && p.focus) p.focus({ preventScroll: true }); });
      box.appendChild(b);
    });
    updateBuy(); paintDecor(); renderCoins();
  }
  function celebrate() {
    var r = stage.getBoundingClientRect();
    for (var i = 0; i < 4; i++) (function (i) { setTimeout(function () { heartAt(r.width * (0.25 + Math.random() * 0.5), r.height * (0.4 + Math.random() * 0.2)); }, i * 110); })(i);
    setPose('happy', 2200); say(pick(['好喜欢！', '房间变漂亮了', '这里超舒服']), 3200);
  }
  function shopAct() {
    var s = SH.sel; if (!s) return;
    var it = findItem(s.cat, s.id), st = itemState(s.cat, s.id);
    if (st === 'eq') {
      if (s.cat !== 'prop') return;
      S.eq.prop = S.eq.prop.filter(function (x) { return x !== s.id; }); SH.msg = '收起来了';
    } else {
      if (st === 'buy') { if (S.fish < it.price) return; addFish(-it.price); S.own[s.cat + ':' + s.id] = 1; }
      if (s.cat === 'prop') { if (S.eq.prop.indexOf(s.id) < 0) S.eq.prop.push(s.id); } else S.eq[s.cat] = s.id;
      SH.msg = st === 'buy' ? '买到了，已经放进房间' : '换好了';
      celebrate();
    }
    SH.sel = null; save(); renderShop();
  }
  function openShop() {
    if (busy()) return;
    SH.open = true; SH.sel = null; SH.msg = ''; S.shopSeen = 1; btnShop.removeAttribute('data-new');
    metersEl.hidden = actionsEl.hidden = hintEl.hidden = btnShop.hidden = true; shopEl.hidden = false; appEl.classList.add('shopping');
    renderShop(); save();
    var top = stage.getBoundingClientRect().top; if (top < 0) window.scrollBy(0, top - 8);
  }
  function closeShop() {
    SH.open = false; SH.sel = null; shopEl.hidden = true;
    metersEl.hidden = actionsEl.hidden = hintEl.hidden = btnShop.hidden = false; appEl.classList.remove('shopping');
    paintDecor(); render();
  }
  btnShop.addEventListener('click', openShop);
  $('#coins').addEventListener('click', function () { if (!SH.open) openShop(); });
  $('#shopClose').addEventListener('click', closeShop);
  $('#buyBtn').addEventListener('click', shopAct);


  /* ---------- save code ---------- */
  var saveModal = $('#saveModal'), saveText = $('#saveText'), saveMsg = $('#saveMsg'), saveLoad = $('#saveLoad'), armed = false;
  function exportCode() { save(); return 'NT1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, data: S })))); }
  function parseCode(txt) {
    txt = (txt || '').replace(/\s+/g, '');
    if (txt.indexOf('NT1:') !== 0) return null;
    try { var o = JSON.parse(decodeURIComponent(escape(atob(txt.slice(4))))); if (o && o.v === 1 && o.data && typeof o.data.hunger === 'number') return o.data; } catch (e) {}
    return null;
  }
  function disarm() { armed = false; saveLoad.textContent = '导入这串码'; }
  function openSave() {
    if (busy()) return;
    saveText.value = exportCode(); saveMsg.textContent = '这是这台设备上现在的进度。'; disarm(); saveModal.hidden = false;
  }
  function closeSave() { saveModal.hidden = true; disarm(); }
  function copySave() {
    var fallback = function () { saveText.focus(); saveText.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} saveMsg.textContent = ok ? '已复制。' : '已经全选了，长按选择「拷贝」就行。'; };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(saveText.value).then(function () { saveMsg.textContent = '已复制。'; }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function importSave() {
    var d = parseCode(saveText.value);
    if (!d) { disarm(); saveMsg.textContent = '这串码不对，请把以 NT1: 开头的整串完整粘贴进来。'; return; }
    if (!armed) { armed = true; saveLoad.textContent = '再点一次，确认覆盖'; saveMsg.textContent = '会覆盖这台设备现在的进度（小鱼干 ' + S.fish + '，最高 ' + S.best + ' 层）。'; return; }
    d.t = now(); load(d); save(); paintDecor(); closeSave(); say('存档导入好了', 3200); render();
  }
  $('#btnSave').addEventListener('click', openSave);
  $('#saveClose').addEventListener('click', closeSave);
  $('#saveCopy').addEventListener('click', copySave);
  saveLoad.addEventListener('click', importSave);
  saveText.addEventListener('input', disarm);
  saveModal.addEventListener('pointerdown', function (e) { if (e.target === saveModal) closeSave(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !saveModal.hidden) closeSave(); });

  /* ---------- wiring ---------- */
  $('#catbtn').addEventListener('pointerdown', function (e) { e.preventDefault(); pet(e); });
  $('#catbtn').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(null); } });
  btnFeed.addEventListener('click', feed);
  btnSleep.addEventListener('click', toggleSleep);
  btnHide.addEventListener('click', rhStart);

  /* ---------- clock ---------- */
  function tick() {
    if (document.hidden) return;
    S.secs += 1;
    if (S.sleeping) {
      S.energy = clamp(S.energy + 2.4); S.hunger = clamp(S.hunger - 0.05);
      if (S.energy >= 100) { S.sleeping = false; setPose('stretch', 2400); say('睡饱啦！'); }
    } else {
      S.hunger = clamp(S.hunger - (busy() ? 0.1 : 0.22));
      S.mood = clamp(S.mood - (busy() ? 0 : 0.12));
      S.energy = clamp(S.energy - (busy() ? 0.05 : 0.1));
      if (!busy() && !override && S.hunger >= 25 && S.mood >= 25 && Math.random() < 0.06) {
        if (Math.random() < 0.5) { setPose('stretch', 2300); say('伸个懒腰~'); } else { setPose('shy', 2300); say('嘿嘿'); }
      }
    }
    render();
    if (S.secs % 5 === 0) save();
  }

  function start(hotData) {
    load(hotData);
    say('回来啦', 2600);
    paintDecor(); if (!S.shopSeen) btnShop.setAttribute('data-new', '1');
    render();
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
    window.addEventListener('pagehide', save);
    try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(function () { return S; }); } catch (e) {}
  }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start(hot && hot.data ? hot.data : null);
})();
