/* 蛋糕店：猫猫排队买蛋糕（排序谜题）
   规则：每队只能动队首那一只，只能放进空队，或者放在同一种猫的前面（黑猫只能放在黑猫前面）；一队凑齐同一种猫，就进店买到一块蛋糕角。
   关卡来自 levels.js；前 15 关的 par 是最少步数，新关卡的 par 是已验证解法的参考步数。
   原猫头是阿琳画的图（assets/cats/cat0-7.webp），新猫头像为同风格生成素材（cat8-10.png），蛋糕使用手绘切角（assets/cakes/cake0-7.webp）。 */
(function () {
  'use strict';
  var NT = window.NT, LV = window.NT_LEVELS;
  if (!NT || !LV || !LV.length) return;
  var $ = function (s) { return root.querySelector(s); };
  var root = document.getElementById('cq'), btnCake = document.getElementById('btnCake');
  var INK = '#54392f', UNDO_COST = 2;

  /* ---------- 猫和蛋糕的设定 ---------- */
  /* 旧编号对应 catN.webp，新猫指定 PNG；t 决定稀有度，奶团本人最稀有。 */
  var CATS = [
    { n: '橘猫', t: 0 }, { n: '灰虎斑', t: 0 }, { n: '奶牛猫', t: 0 }, { n: '黑猫', t: 0 },
    { n: '三花', t: 1 }, { n: '银渐层', t: 1 }, { n: '暹罗', t: 2 }, { n: '奶团', t: 3 },
    { n: '布偶', t: 1, image: 'cat8.png' }, { n: '缅因', t: 2, image: 'cat9.png' }, { n: '波斯', t: 1, image: 'cat10.png' },
    { n: '英短蓝猫', t: 1, tile: 0 }, { n: '玳瑁', t: 1, tile: 1 },
    { n: '豹猫', t: 2, tile: 2 }, { n: '折耳', t: 1, tile: 3 },
    { n: '卷耳', t: 2, tile: 4 }, { n: '长毛蓝眼', t: 2, tile: 5 },
    { n: '异瞳猫', t: 2, tile: 6 }, { n: '巧克力猫', t: 1, tile: 7 }
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
    { n: '金蛋糕', p: 12, c: ['#f5c95a', '#ffe9a3', '#f4b04a', '#e2b048'] },
    { n: '蓝莓慕斯', p: 10, tile: 0 }, { n: '蜜桃千层', p: 11, tile: 1 },
    { n: '柠檬芝士', p: 12, tile: 2 }, { n: '黑芝麻蛋糕', p: 13, tile: 3 },
    { n: '红丝绒', p: 14, tile: 4 }, { n: '焦糖布丁', p: 15, tile: 5 },
    { n: '芋泥奶油', p: 16, tile: 6 }, { n: '椰香奶油', p: 18, tile: 7 }
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
    if (lv >= 15 && Math.random() < Math.min(0.72, 0.42 + (lv - 15) * 0.008)) return 8 + Math.floor(Math.random() * 8);
    var t = CATS[kind].t, f = Math.min(1, lv / 14), w = [], sum = 0, i;
    for (i = 0; i < 8; i++) { w[i] = EARLY[t][i] + (LATE[t][i] - EARLY[t][i]) * f; sum += w[i]; }
    var r = Math.random() * sum;
    for (i = 0; i < 8; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }

  function catSrc(k) { return 'assets/cats/' + (CATS[k].tile != null ? 'alin-heads-20261003.png' : CATS[k].image || 'cat' + k + '.webp'); }
  var CAKE_SPRITES = [{"rect":[39,56,411,404],"clip":"0.0% 59.16%,0.24% 57.92%,0.49% 57.18%,1.7% 54.7%,2.92% 53.22%,4.87% 51.24%,46.72% 9.9%,47.69% 9.16%,48.42% 8.66%,61.8% 1.49%,63.75% 0.5%,65.21% 0.0%,66.91% 0.0%,67.64% 0.25%,88.32% 8.42%,89.78% 9.16%,91.0% 10.4%,91.24% 10.89%,98.78% 29.21%,99.27% 30.69%,99.51% 31.93%,99.76% 42.57%,99.76% 68.56%,99.51% 70.3%,99.27% 71.29%,99.03% 72.03%,98.54% 73.27%,98.05% 74.01%,97.08% 75.25%,95.62% 76.73%,94.16% 77.72%,91.24% 79.21%,90.02% 79.7%,84.18% 81.93%,78.83% 83.66%,76.4% 84.41%,74.7% 84.9%,72.75% 85.4%,52.55% 90.35%,36.98% 94.06%,13.63% 99.5%,12.41% 99.75%,7.79% 99.75%,7.06% 99.5%,5.6% 98.76%,4.87% 98.27%,4.14% 97.52%,3.41% 96.53%,2.92% 95.79%,2.43% 94.55%,2.19% 93.56%,0.0% 61.39%"},{"rect":[478,66,408,388],"clip":"0.0% 55.41%,0.49% 53.87%,1.23% 52.32%,1.72% 51.55%,2.94% 50.0%,29.66% 22.42%,51.47% 3.87%,55.39% 0.77%,56.37% 0.26%,57.35% 0.0%,58.33% 0.0%,59.31% 0.26%,83.82% 7.47%,84.56% 7.73%,85.05% 7.99%,86.52% 9.54%,96.32% 22.16%,97.06% 23.2%,98.04% 24.74%,98.77% 26.29%,99.51% 28.61%,99.75% 40.72%,99.75% 69.07%,99.51% 70.36%,98.77% 72.42%,98.28% 73.45%,95.59% 76.29%,94.85% 76.8%,91.91% 78.35%,87.5% 80.15%,84.8% 81.19%,79.66% 82.99%,75.74% 84.28%,74.75% 84.54%,50.98% 90.72%,37.99% 93.81%,14.71% 99.23%,13.48% 99.48%,12.01% 99.74%,9.07% 99.74%,7.84% 99.48%,7.11% 99.23%,6.13% 98.71%,5.15% 97.94%,4.41% 97.16%,3.68% 96.13%,3.19% 95.36%,2.94% 94.85%,2.45% 93.3%,0.0% 60.05%"},{"rect":[918,82,405,370],"clip":"0.0% 56.49%,0.49% 54.86%,1.23% 53.24%,1.73% 52.43%,2.72% 51.08%,40.99% 8.92%,42.72% 7.03%,45.19% 4.86%,46.67% 3.78%,49.63% 2.16%,51.6% 1.35%,53.09% 0.81%,55.56% 0.27%,57.04% 0.0%,60.49% 0.0%,62.47% 0.27%,63.7% 0.54%,66.67% 1.62%,69.14% 2.97%,85.68% 12.43%,87.41% 13.51%,88.64% 14.32%,90.86% 15.95%,91.85% 16.76%,94.32% 19.19%,95.06% 20.0%,96.79% 22.16%,97.53% 23.24%,98.27% 24.86%,98.77% 26.22%,99.01% 27.03%,99.26% 28.38%,99.75% 40.81%,99.75% 45.41%,99.51% 60.27%,99.26% 69.46%,99.01% 70.54%,98.52% 72.16%,98.02% 72.97%,96.79% 74.59%,96.3% 75.14%,94.81% 76.49%,92.84% 77.57%,91.6% 78.11%,90.86% 78.38%,86.17% 80.0%,77.53% 82.7%,76.54% 82.97%,59.51% 87.57%,45.68% 91.08%,12.35% 99.46%,10.86% 99.73%,8.4% 99.73%,7.16% 99.46%,6.42% 99.19%,5.43% 98.65%,3.46% 96.49%,2.72% 95.14%,2.47% 94.32%,2.22% 93.24%,0.0% 60.81%"},{"rect":[1367,77,392,383],"clip":"0.0% 55.87%,0.26% 54.57%,0.77% 53.26%,1.53% 51.96%,2.04% 51.17%,6.12% 47.0%,50.77% 5.22%,52.04% 4.18%,52.81% 3.66%,54.34% 2.87%,60.2% 0.52%,60.97% 0.26%,62.5% 0.0%,63.27% 0.0%,64.54% 0.26%,65.31% 0.52%,66.33% 1.04%,85.97% 12.01%,87.76% 13.05%,89.8% 14.36%,90.82% 15.14%,92.35% 16.45%,95.92% 20.1%,96.94% 21.41%,98.21% 23.24%,98.98% 24.8%,99.23% 25.85%,99.49% 27.15%,99.74% 37.86%,99.74% 67.89%,99.49% 69.71%,99.23% 70.76%,98.47% 72.32%,97.45% 73.89%,95.15% 76.24%,93.88% 77.02%,90.31% 78.85%,86.99% 80.16%,78.57% 83.03%,76.02% 83.81%,74.23% 84.33%,42.09% 92.69%,38.01% 93.73%,24.49% 97.13%,20.15% 98.17%,14.54% 99.48%,13.01% 99.74%,9.18% 99.74%,8.16% 99.48%,7.4% 99.22%,6.89% 98.96%,5.87% 98.17%,4.08% 96.34%,3.57% 95.56%,3.32% 95.04%,2.81% 93.73%,2.55% 92.69%,0.0% 59.01%"},{"rect":[42,462,410,395],"clip":"0.0% 55.44%,0.24% 54.68%,1.22% 52.66%,1.95% 51.65%,5.61% 47.85%,10.73% 43.04%,38.05% 17.72%,40.98% 15.19%,42.2% 14.18%,43.17% 13.42%,60.73% 0.76%,62.2% 0.0%,65.12% 0.0%,66.83% 0.76%,68.05% 1.52%,89.76% 15.7%,91.95% 17.22%,93.17% 18.23%,94.88% 19.75%,96.1% 21.01%,97.07% 22.28%,98.05% 23.8%,98.78% 25.32%,99.27% 26.84%,99.51% 28.1%,99.76% 40.25%,99.76% 55.19%,99.51% 67.85%,99.27% 69.11%,99.02% 69.87%,98.29% 71.39%,97.8% 72.15%,96.34% 73.92%,95.12% 74.94%,93.9% 75.7%,90.98% 77.22%,89.76% 77.72%,86.59% 78.99%,82.68% 80.51%,79.02% 81.77%,70.73% 84.3%,69.02% 84.81%,50.73% 89.87%,33.66% 94.43%,32.68% 94.68%,18.05% 98.23%,14.88% 98.99%,12.44% 99.49%,10.49% 99.75%,8.78% 99.75%,7.32% 99.49%,6.1% 98.99%,5.61% 98.73%,3.66% 96.71%,2.68% 95.19%,2.2% 93.67%,1.95% 92.66%,0.0% 59.49%"},{"rect":[481,465,407,389],"clip":"0.0% 52.96%,0.25% 51.93%,0.49% 51.16%,1.23% 49.61%,1.72% 48.84%,8.35% 41.9%,43.98% 5.4%,45.21% 4.37%,45.95% 3.86%,47.67% 2.83%,48.65% 2.31%,53.07% 0.77%,54.05% 0.51%,55.53% 0.26%,57.74% 0.0%,63.64% 0.0%,65.6% 0.26%,67.32% 0.51%,69.29% 1.03%,70.76% 1.54%,73.71% 3.08%,74.45% 3.6%,91.15% 15.42%,93.12% 17.22%,95.58% 19.79%,97.05% 21.85%,97.54% 22.62%,98.77% 25.19%,99.26% 26.74%,99.51% 28.53%,99.75% 41.39%,99.75% 42.42%,99.51% 56.04%,99.26% 67.61%,99.02% 69.41%,98.77% 70.44%,98.53% 71.21%,97.79% 72.75%,97.3% 73.52%,95.33% 75.58%,94.35% 76.35%,92.87% 77.38%,91.15% 78.41%,90.66% 78.66%,88.94% 79.43%,82.06% 82.01%,79.85% 82.78%,77.4% 83.55%,71.5% 85.35%,51.35% 90.49%,34.15% 94.6%,15.23% 98.97%,11.55% 99.74%,8.11% 99.74%,7.13% 99.49%,5.65% 98.71%,4.67% 97.94%,3.93% 97.17%,3.19% 96.14%,2.46% 94.6%,2.21% 93.83%,1.97% 92.8%,0.0% 57.84%"},{"rect":[917,465,409,396],"clip":"0.0% 56.82%,0.24% 54.8%,0.49% 54.04%,0.98% 52.78%,1.71% 51.52%,2.69% 50.25%,2.93% 50.0%,54.03% 0.76%,55.5% 0.0%,58.68% 0.0%,59.41% 0.25%,73.59% 5.56%,74.82% 6.06%,75.31% 6.31%,76.53% 7.07%,78.24% 8.33%,89.98% 17.17%,91.93% 18.69%,93.64% 20.2%,96.09% 22.73%,97.07% 23.99%,98.04% 25.51%,99.02% 27.53%,99.27% 28.28%,99.51% 29.29%,99.76% 40.4%,99.76% 68.18%,99.51% 70.2%,99.02% 72.22%,98.29% 73.74%,97.56% 74.75%,95.6% 76.77%,94.62% 77.53%,93.89% 78.03%,90.71% 79.8%,90.22% 80.05%,88.51% 80.81%,86.06% 81.82%,80.93% 83.59%,71.39% 86.36%,58.68% 89.9%,53.3% 91.16%,43.52% 93.43%,41.32% 93.94%,38.88% 94.44%,14.91% 99.24%,12.22% 99.75%,8.8% 99.75%,7.82% 99.49%,7.09% 99.24%,6.11% 98.74%,4.89% 97.73%,4.16% 96.97%,3.18% 95.45%,2.93% 94.95%,2.44% 93.43%,2.2% 92.17%,0.0% 57.83%"},{"rect":[1360,453,406,404],"clip":"0.0% 54.7%,0.25% 53.71%,1.23% 51.73%,1.72% 50.99%,2.71% 49.75%,35.22% 13.86%,35.96% 13.12%,36.95% 12.62%,65.52% 1.98%,67.73% 1.24%,71.67% 0.0%,73.15% 0.0%,74.14% 0.5%,75.37% 1.73%,95.07% 22.03%,97.04% 24.26%,97.54% 25.0%,99.01% 27.97%,99.26% 28.71%,99.51% 29.7%,99.75% 31.19%,99.75% 68.81%,99.51% 70.54%,99.26% 71.53%,98.77% 72.77%,97.78% 74.75%,95.81% 76.73%,94.83% 77.48%,93.6% 78.22%,89.66% 80.2%,88.42% 80.69%,81.77% 82.92%,72.17% 85.64%,65.76% 87.38%,50.99% 91.09%,39.9% 93.81%,16.5% 99.01%,14.04% 99.5%,12.32% 99.75%,9.61% 99.75%,8.37% 99.5%,7.64% 99.26%,6.65% 98.76%,5.91% 98.27%,4.43% 96.78%,3.94% 96.04%,3.45% 95.05%,2.96% 93.56%,2.71% 92.33%,0.0% 58.91%"}];
  function tileHTML(type, tile, name) {
    var style = '--tile-x:' + (tile % 4) + ';--tile-y:' + Math.floor(tile / 4);
    if (type === 'cake') {
      var sprite = CAKE_SPRITES[tile], r = sprite.rect, side = Math.max(r[2], r[3]);
      style += ';width:' + r[2] / side * 100 + '%;height:' + r[3] / side * 100 + '%;margin-left:' + (side-r[2]) / side * 50 + '%;margin-top:' + (side-r[3]) / side * 50 + '%';
      style += ';background-size:' + 1774 / r[2] * 100 + '% ' + 887 / r[3] * 100 + '%;background-position:' + r[0] / (1774-r[2]) * 100 + '% ' + r[1] / (887-r[3]) * 100 + '%;clip-path:polygon(' + sprite.clip + ')';
    }
    return '<span class="cq-sprite cq-' + type + '-sprite" role="img" aria-label="' + name + '" style="' + style + '"></span>';
  }
  var CATIMG = CATS.map(function (c, i) { var im = new Image(); im.src = catSrc(i); return im; }); /* 提前加载 */
  function catHTML(k) { return CATS[k].tile != null ? tileHTML('cat', CATS[k].tile, CATS[k].n) : '<img src="' + catSrc(k) + '" alt="' + CATS[k].n + '" draggable="false">'; }
  var BAG = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M17 25l8-10 10 8 10-8 10 8 10-8 10 8 8-8 3 62q0 10-11 10H25q-11 0-11-10z" fill="#ecd3ab" stroke="#735642" stroke-width="3.8" stroke-linejoin="round"/><path d="M19 35h62M28 42v29" fill="none" stroke="#c29c78" stroke-width="3" stroke-linecap="round"/><path d="M40 49q0-10 10-10t10 9q0 6-9 10v5" fill="none" stroke="#735642" stroke-width="5" stroke-linecap="round"/><circle cx="51" cy="74" r="3" fill="#735642"/></svg>';
  function drawFace(cat, animate) {
    cat.inn.innerHTML = cat.revealed ? catHTML(cat.kind) : BAG;
    cat.el.classList.toggle('cq-covered', !cat.revealed);
    if (animate) { bounce(cat, true); SND.pick(); }
  }

  function cakeHTML(id) {
    return CAKES[id].tile != null ? tileHTML('cake', CAKES[id].tile, CAKES[id].n) : '<img class="cq-cake-image" src="assets/cakes/cake' + id + '.webp" alt="" draggable="false">';
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
    if (!c.challenges || typeof c.challenges !== 'object') c.challenges = {};
    ['timed', 'endless'].forEach(function (mode) {
      var entry = c.challenges[mode];
      if (!entry || typeof entry !== 'object') entry = c.challenges[mode] = {};
      entry.best = Math.max(0, Math.floor(+entry.best || 0));
    });
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
    if (master) master.gain.value = NT.S().mute ? 0 : 0.5 * NT.miniGain();
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
      '<div class="cq-bar"><span class="cq-chip" id="cqLv">第 1 关</span><span class="cq-chip" id="cqSteps">步数 0</span><span class="cq-chip cq-clock" id="cqClock" hidden></span><button class="hs-quit" id="cqMenuBtn" type="button">选关</button></div>' +
      '<p class="cq-blind-note" id="cqBlindNote" hidden></p>' +
      '<div class="cq-shop" id="cqShop">' + SHOP + '<div class="cq-door" id="cqDoor"></div><div class="cq-tip" id="cqTip" role="status"></div></div>' +
      '<div class="cq-field" id="cqField"></div>' +
      '<div class="cq-foot"><button class="cq-btn" id="cqUndo" type="button">撤销 ' + FISH + UNDO_COST + '</button><button class="cq-btn" id="cqRedo" type="button">重来</button><span class="cq-got" id="cqGot" aria-live="polite"></span></div>' +
    '</div>' +
    '<div class="sg-over" id="cqMenu" hidden><div class="sg-card cq-scroll cq-menucard" role="dialog" aria-label="蛋糕店">' +
      '<h2>猫猫蛋糕店</h2><p>点队首的猫，再点另一队，把它放过去。<b>只能放进空队，或者放在一样的猫前面</b>（黑猫只能放在黑猫前面）。凑齐一队一样的猫，它们就能进店买蛋糕，会分你一块蛋糕角。</p><p class="cq-menu-note">纸袋里的猫靠近队首才揭晓，揭晓后会记住。21 关起探索也计步，后段满星要精打细算。</p>' +
      '<div class="cq-challenges"><button id="cqTimed" class="cq-mode" type="button"><b>限时营业</b><small>每关限时限步 · 越往后越紧</small><span id="cqTimedBest"></span></button><button id="cqEndless" class="cq-mode" type="button"><b>无限闯关</b><small>随机新棋盘 · 限步不限时</small><span id="cqEndlessBest"></span></button></div>' +
      '<div class="cq-lvs" id="cqLvs"></div>' +
      '<div class="sg-btns"><button id="cqBookBtn" type="button">蛋糕图鉴</button><button id="cqSnd" type="button">音效：开</button></div>' +
      '<button class="hs-quit" id="cqHome" type="button">回房间</button>' +
    '</div></div>' +
    '<div class="sg-over" id="cqWin" hidden><div class="sg-card" role="dialog" aria-label="本关结果">' +
      '<h2 id="cqWinT">通关！</h2><div class="cq-stars" id="cqStars"></div><p id="cqWinS"></p><div class="rew" id="cqWinR"></div><div class="cq-wcakes" id="cqWinC"></div>' +
      '<div class="sg-btns"><button id="cqWinMenu" type="button">选关</button><button id="cqWinNext" class="main" type="button">下一关</button></div>' +
    '</div></div>' +
    '<div class="sg-over" id="cqLose" hidden><div class="sg-card" role="dialog" aria-label="本局未完成">' +
      '<h2 id="cqLoseT">步数用完啦</h2><p id="cqLoseS"></p>' +
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
  var G = null, RUN = null, clockT = 0, lastVar = {}, laneEls = [], TOKEN = 0;
  var stepsText = function () {
    return '步数 ' + G.steps + (G.limit ? '/' + G.limit : '') + (G.challenge ? '' : (G.exact ? ' · 最少 ' : ' · 参考 ') + G.par);
  };
  function stopClock() { clearInterval(clockT); clockT = 0; }
  function paintClock() {
    var clock = $('#cqClock'), seconds = Math.ceil(Math.max(0, G.timeLeft));
    clock.hidden = !G.challenge || !G.rules.timeLimit;
    clock.textContent = Math.floor(seconds / 60) + ':' + ('0' + seconds % 60).slice(-2);
    clock.classList.toggle('warn', !clock.hidden && seconds <= 15);
  }
  function startClock() {
    stopClock(); paintClock();
    if (!G.challenge || !G.rules.timeLimit) return;
    G.lastClock = Date.now();
    clockT = setInterval(function () {
      if (!G || G.over) { stopClock(); return; }
      var current = Date.now(), elapsed = (current - G.lastClock) / 1000; G.lastClock = current;
      if (document.hidden) return;
      G.timeLeft = Math.max(0, G.timeLeft - elapsed); paintClock();
      if (!G.timeLeft) failLevel('time');
    }, 200);
  }
  function starTargets() {
    if (G.challenge) return [G.rules.star3, G.rules.star2];
    if (!G.blind) return null;
    var early = G.lv < 20, middle = G.lv < 29;
    return [Math.ceil(G.par * (early ? 1.25 : middle ? 1.12 : 1.05)) + (middle ? 2 : 0),
      Math.ceil(G.par * (early ? 1.6 : middle ? 1.4 : 1.25)) + (middle ? 2 : 0)];
  }
  function startChallenge(mode, advance) {
    var factory = window.NTCQChallenge;
    if (!factory) return;
    if (!advance || !RUN || RUN.mode !== mode) RUN = { mode: mode, round: 1 };
    else RUN.round++;
    var level = factory.create(RUN.round);
    loadVariant(14 + RUN.round, 0, level);
  }

  function makeCat(kind) {
    var d = document.createElement('div'); d.className = 'cq-cat';
    var inn = document.createElement('div'); inn.className = 'in'; inn.innerHTML = catHTML(kind); d.appendChild(inn);
    el.field.appendChild(d);
    return { kind: kind, el: d, inn: inn, revealed: true };
  }
  function startLevel(lv) {
    RUN = null;
    var L = LV[lv], vs = L.variants, vi = Math.floor(Math.random() * vs.length);
    if (vs.length > 1 && vi === lastVar[lv]) vi = (vi + 1) % vs.length;
    lastVar[lv] = vi; loadVariant(lv, vi);
  }
  function loadVariant(lv, vi, level) {
    stopClock();
    var L = level || LV[lv], v = L.variants[vi];
    el.field.innerHTML = ''; laneEls = [];
    var caps = L.caps ? L.caps.slice() : L.lanes ? new Array(L.lanes).fill(L.cap) : v.lanes.map(function () { return L.cap; });
    G = { lv: lv, vi: vi, S: L.cap, caps: caps, maxCap: Math.max.apply(null, caps), limit: v.limit || 0, par: v.par, exact: v.exact !== false, lanes: v.lanes.map(function (l) { return l.map(makeCat); }), sel: -1, steps: 0, hist: [], blind: !!L.revealDepth, revealDepth: L.revealDepth || 0, hiddenCount: 0, busy: false, over: false, got: [], token: ++TOKEN };
    G.level = L;
    G.challenge = level && RUN ? { mode: RUN.mode, round: RUN.round } : null;
    G.rules = G.challenge ? window.NTCQChallenge.rules(RUN.round, RUN.mode, G.par) : null;
    if (G.challenge) G.limit = G.rules.stepLimit;
    G.timeLeft = G.rules ? G.rules.timeLimit : 0;
    G.lanes.forEach(function (lane) { lane.forEach(function (cat, position) {
      cat.revealed = !!(!G.blind || position < G.revealDepth || (L.blindTail && position < lane.length - L.blindTail));
      if (!cat.revealed) G.hiddenCount++;
      drawFace(cat, false);
    }); });
    var note = $('#cqBlindNote'); note.hidden = !G.blind;
    var targets = starTargets();
    note.textContent = (G.revealDepth === 1 ? '只看队首' : '前两只看得见') + ' · 揭晓后会记住 · 撤销免费' +
      (G.challenge || lv >= 20 ? '，探索计步' : '，慢慢想') +
      (targets ? ' · 3 星 ≤ ' + targets[0] + ' 步' : '') + (G.challenge ? ' · 本关奖励 +' + G.rules.reward : '');
    for (var i = 0; i < G.lanes.length; i++) (function (i) {
      var d = document.createElement('div'); d.className = 'cq-lane'; d.setAttribute('data-i', i);
      d.setAttribute('role', 'button'); d.tabIndex = 0;
      d.addEventListener('pointerdown', function (e) { e.preventDefault(); onLane(i); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLane(i); } });
      el.field.insertBefore(d, el.field.firstChild); laneEls.push(d);
    })(i);
    el.menu.hidden = el.win.hidden = el.book.hidden = el.lose.hidden = true; el.play.hidden = false; el.play.classList.remove('idle');
    el.lv.textContent = G.challenge ? (RUN.mode === 'timed' ? '限时 ' : '无限 ') + RUN.round + ' 关' : '第 ' + (lv + 1) + ' 关'; el.steps.textContent = stepsText(); el.got.textContent = ''; tip('');
    layout(true); paintBtns(); startClock();
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
      if (!e.revealed && s < G.revealDepth) { e.revealed = true; drawFace(e, !instant); }
      placeCat(e, i, s);
      e.el.classList.toggle('sel', G.sel === i && s === 0);
      if (instant) { void e.el.offsetWidth; e.el.style.transition = ''; }
    }); });
    laneEls.forEach(function (d, i) {
      d.classList.toggle('can', G.sel >= 0 && canPut(G.sel, i));
      d.classList.toggle('from', G.sel === i);
      var lane = G.lanes[i];
      d.setAttribute('aria-label', '第' + (i + 1) + '队，' + (lane.length ? '队首' + CATS[lane[0].kind].n + '，' + lane.length + '只猫' : '空队') + '，容量' + G.caps[i]);
    });
  }
  function paintBtns() {
    var fish = NT.S().fish, cost = G && G.blind ? 0 : UNDO_COST;
    el.undo.innerHTML = cost ? '撤销 ' + FISH + cost : '撤销 · 免费';
    el.undo.disabled = !G || G.busy || G.over || !G.hist.length || fish < cost;
    el.undo.title = G && !G.hist.length ? '还没有能撤销的步数（买走蛋糕之后就不能撤销了）' : fish < cost ? '小鱼干不够' : '';
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
    G.hist.push({ lanes: G.lanes.map(function (l) { return l.slice(); }), steps: G.steps });
    var e = G.lanes[a].shift(); G.lanes[b].unshift(e);
    G.steps++; G.sel = -1;
    e.el.style.zIndex = 4; later(function () { e.el.style.zIndex = ''; }, 420);
    var target = G.lanes[b];
    if (target.length === G.S && target.every(function (cat) { return cat.kind === e.kind; })) buyGroup(b);
    else later(function () { SND.pop(); bounce(e); }, 160);
    placeAll(); paintBtns(); tip(''); checkStuck();
    if (G.lanes.every(function (lane) { return !lane.length; })) {
      G.over = true; stopClock(); paintBtns(); finishLevel();
    } else checkEnd();
  }

  function buyGroup(b) {
    // Commit the removal and reward now; departure is only a visual effect.
    var cats = G.lanes[b], kind = cats[0].kind, door = G.door, cell = G.cell;
    G.lanes[b] = []; G.hist = [];
    cats.forEach(function (cat, index) {
      cat.el.classList.remove('sel'); cat.el.style.zIndex = 5;
      cat.el.style.transitionDelay = index * 35 + 'ms'; cat.el.classList.add('leave');
      cat.el.style.setProperty('--x', (door.x - cell / 2) + 'px');
      cat.el.style.setProperty('--y', (door.y - cell / 2) + 'px');
      later(function () { if (cat.el.parentNode) cat.el.parentNode.removeChild(cat.el); }, 620 + index * 35);
    });
    SND.buy(); giveCake(kind);
  }
  function giveCake(kind) {
    var id = rollCake(kind, G.lv), c = cq(), isNew = !c.seen[id];
    c.cakes[id]++; c.seen[id] = 1; G.got.push(id);
    var S = NT.S(); S.mood = NT.clamp(S.mood + 1);
    var pop = document.createElement('div'); pop.className = 'cq-pop'; pop.style.left = G.door.x + 'px'; pop.style.top = (G.door.y + 4) + 'px';
    pop.innerHTML = '<span class="pc">' + cakeHTML(id) + '</span><b>' + CAKES[id].n + (isNew ? ' <i>新！</i>' : '') + '</b>';
    el.field.appendChild(pop); setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 1700);
    paintGot(); NT.save();
  }
  function failLevel(reason) {
    if (!G || G.over) return;
    G.over = true; G.sel = -1; stopClock(); placeAll(); paintBtns(); SND.bad(); tip('');
    $('#cqLoseT').textContent = reason === 'time' ? '打烊时间到啦' : '步数用完啦';
    $('#cqLoseS').textContent = reason === 'time' ? '这关限时 ' + G.rules.timeLimit + ' 秒。已经买到的蛋糕收好了，换个思路再来。' :
      '这一关最多 ' + G.limit + ' 步，参考 ' + G.par + ' 步。探索和撤销不会返还已用步数。';
    el.lose.hidden = false;
  }
  function checkEnd() {
    if (!G || G.over || !G.limit || G.steps < G.limit || G.lanes.every(function (lane) { return !lane.length; })) return;
    failLevel('steps');
  }
  function paintGot() {
    var cnt = {}; G.got.forEach(function (i) { cnt[i] = (cnt[i] || 0) + 1; });
    el.got.innerHTML = Object.keys(cnt).map(function (i) { return '<span class="cq-mini">' + cakeHTML(+i) + (cnt[i] > 1 ? '<i>' + cnt[i] + '</i>' : '') + '</span>'; }).join('');
  }

  function undo() {
    if (!G || G.busy || G.over || !G.hist.length) return;
    var S = NT.S(), cost = G.blind ? 0 : UNDO_COST; if (S.fish < cost) return;
    if (cost) NT.addFish(-cost);
    var previous = G.hist.pop(); G.lanes = previous.lanes; G.sel = -1;
    if (G.blind && !G.challenge && G.lv < 20) G.steps = previous.steps; /* Later exploration counts; revealed identities still stay. */
    SND.pick(); placeAll(); paintBtns(); tip(''); NT.save();
  }

  function stars(steps, par, limit) {
    if (limit) return steps <= Math.ceil(par * 1.12) ? 3 : steps <= Math.ceil((par + limit) / 2) ? 2 : 1;
    return steps <= Math.ceil(par * 1.3) ? 3 : steps <= Math.ceil(par * 2) ? 2 : 1;
  }
  function finishLevel() {
    var targets = starTargets(), c = cq(), S = NT.S(), lv = G.lv;
    var st = targets ? (G.steps <= targets[0] ? 3 : G.steps <= targets[1] ? 2 : 1) : stars(G.steps, G.par, G.limit);
    var first = !G.challenge && c.cleared[lv] === 0;
    var fish = G.challenge ? G.rules.reward + st * 3 : 3 + (lv + 1) * 2 + st * 2;
    if (G.challenge) c.challenges[G.challenge.mode].best = Math.max(c.challenges[G.challenge.mode].best, G.challenge.round);
    else c.cleared[lv] = Math.max(c.cleared[lv], st);
    NT.addFish(fish); S.mood = NT.clamp(S.mood + 8); S.hunger = NT.clamp(S.hunger - 1); S.energy = NT.clamp(S.energy - 2);
    NT.save(); SND.win();
    var last = !G.challenge && lv === LV.length - 1;
    $('#cqWinT').textContent = G.challenge ? (G.challenge.mode === 'timed' ? '限时营业' : '无限闯关') + ' · 第 ' + G.challenge.round + ' 关完成' : last ? '打烊啦！全部通关' : '第 ' + (lv + 1) + ' 关通关';
    $('#cqStars').innerHTML = [1, 2, 3].map(function (i) { return '<span class="' + (i <= st ? 'on' : '') + '">★</span>'; }).join('');
    $('#cqWinS').textContent = '用了 ' + G.steps + ' 步（' + (G.limit ? '限 ' + G.limit + '，' : '') + (G.exact ? '最少 ' : '参考 ') + G.par + ' 步）' + (first && !last ? ' · 解锁下一关' : '');
    $('#cqWinR').innerHTML = '小鱼干 +' + fish;
    var cnt = {}; G.got.forEach(function (i) { cnt[i] = (cnt[i] || 0) + 1; });
    $('#cqWinC').innerHTML = G.got.length ? '<small>这一局买到的蛋糕角</small><div>' + Object.keys(cnt).map(function (i) { return '<span class="cq-mini big">' + cakeHTML(+i) + '<i>×' + cnt[i] + '</i></span>'; }).join('') + '</div>' : '';
    $('#cqWinNext').textContent = G.challenge ? '继续闯关' : last ? '再玩一次' : '下一关';
    $('#cqWinNext').setAttribute('data-act', G.challenge ? 'challenge' : last ? 'again' : 'next');
    later(function () { el.win.hidden = false; }, 520);
  }

  /* ---------- 选关 / 图鉴 ---------- */
  function nLanes(L) { return L.caps ? L.caps.length : L.lanes; }
  function extraTag(L) { var t = []; if (L.revealDepth) t.push(L.revealDepth === 1 ? '队首揭晓' : '前两只揭晓'); if (L.caps && Math.min.apply(null, L.caps) < L.cap) t.push('短队'); if (L.variants[0].limit) t.push('限步数'); return t.join(' · '); }
  function paintMenu() {
    var c = cq();
    $('#cqTimedBest').textContent = '最好连过 ' + c.challenges.timed.best + ' 关';
    $('#cqEndlessBest').textContent = '最好连过 ' + c.challenges.endless.best + ' 关';
    el.lvs.innerHTML = '';
    LV.forEach(function (L, i) {
      var headings = { 0: '经典排队 · 1–15', 15: '初识纸袋猫 · 16–20', 20: '认真想几步 · 21–29', 29: '压轴挑战 · 30–40' };
      if (headings[i]) { var heading = document.createElement('h3'); heading.className = 'cq-chapter'; heading.textContent = headings[i]; el.lvs.appendChild(heading); }
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
  function openMenu() { stopClock(); RUN = null; $('#cqClock').hidden = true; $('#cqBlindNote').hidden = true; tip(''); G && (G.token++); G = null; el.field.innerHTML = ''; el.play.hidden = false; el.play.classList.add('idle'); el.win.hidden = el.book.hidden = el.lose.hidden = true; paintMenu(); el.menu.hidden = false; }
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
    if (window.NaituanStats) window.NaituanStats.enter('games/cake');
  }
  function leave() {
    stopClock(); RUN = null;
    if (G) G.token++; G = null; el.field.innerHTML = '';
    var c = cq(), stars3 = c.cleared.reduce(function (a, b) { return a + b; }, 0), got = c.seen.filter(Boolean).length;
    NT.ext.active = false; root.hidden = true; root.classList.remove('on'); NT.stage.classList.remove('cqmode');
    NT.hideCat(false); NT.setChrome(false); NT.setBusyUI(false);
    if (window.NaituanStats) window.NaituanStats.leave();
    NT.setPose('happy', 2200); NT.say('蛋糕图鉴 ' + got + '/' + CAKES.length + '，下次还想去', 3600);
    NT.render(); NT.save();
  }

  btnCake.addEventListener('click', enter);
  $('#cqHome').addEventListener('click', leave);
  $('#cqMenuBtn').addEventListener('click', openMenu);
  $('#cqWinMenu').addEventListener('click', openMenu);
  $('#cqLoseMenu').addEventListener('click', openMenu);
  $('#cqLoseAgain').addEventListener('click', function () { if (G) { G.token++; loadVariant(G.lv, G.vi, G.challenge ? G.level : null); } });
  $('#cqWinNext').addEventListener('click', function () {
    var lv = G ? G.lv : 0, action = this.getAttribute('data-act');
    if (action === 'challenge' && G.challenge) startChallenge(G.challenge.mode, true);
    else if (action === 'again') startLevel(lv);
    else startLevel(Math.min(LV.length - 1, lv + 1));
  });
  $('#cqTimed').addEventListener('click', function () { audioInit(); startChallenge('timed'); });
  $('#cqEndless').addEventListener('click', function () { audioInit(); startChallenge('endless'); });
  $('#cqRedo').addEventListener('click', function () { if (G && !G.over) { G.token++; loadVariant(G.lv, G.vi, G.challenge ? G.level : null); } });
  $('#cqUndo').addEventListener('click', undo);
  $('#cqBookBtn').addEventListener('click', function () { paintBook(); el.menu.hidden = true; el.book.hidden = false; });
  $('#cqBookX').addEventListener('click', function () { if (bookOnly) { bookOnly = false; leave(); return; } el.book.hidden = true; paintMenu(); el.menu.hidden = false; });
  $('#cqBookSell').addEventListener('click', sellAll);
  el.snd.addEventListener('click', function () { NT.setMute(!NT.S().mute); paintMenu(); });
  window.addEventListener('naituan:sound-change', function () { if (master) master.gain.value = NT.S().mute ? 0 : 0.5 * NT.miniGain(); });
  window.addEventListener('resize', function () { if (G && !root.hidden) layout(true); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { if (G && !root.hidden) layout(true); }, 250); });
  document.addEventListener('visibilitychange', function () { if (G && G.challenge) G.lastClock = Date.now(); });
  function openCollection() {
    if (NT.isBusy()) return;
    bookOnly = true; NT.ext.active = true; NT.hideCat(true); NT.setChrome(true); NT.setBusyUI(true);
    root.hidden = false; root.classList.add('on'); NT.stage.classList.add('cqmode');
    el.play.hidden = el.menu.hidden = el.win.hidden = el.lose.hidden = true;
    paintBook(); el.book.hidden = false;
    if (window.NaituanStats) window.NaituanStats.enter('cake-book');
  }
  window.NTQ = { get: function () { return G; }, CAKES: CAKES, cq: cq, openBook: openCollection };
})();
