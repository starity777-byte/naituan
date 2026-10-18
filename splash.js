/* Only three tiny stills gate entry; full animations and scenery arrive progressively. */
(function () {
  'use strict';
  var splash = document.getElementById('splash');
  if (!splash) return;
  var status = document.getElementById('splashStatus');
  var detail = document.getElementById('splashDetail');
  var progress = document.getElementById('splashProgress');
  var enterButton = document.getElementById('splashEnter');
  var retryButton = document.getElementById('splashRetry');
  var ready = false, loading = false, failed = false, leaving = false;
  var done = 0, total = 0, started = Date.now();
  var assets = window.NaituanAssets;

  function paint() {
    if (leaving) return;
    var state = assets ? assets.status() : { kind: 'startup', text: '加载组件未能启动，请重新打开。' };
    var broken = state.kind === 'startup';
    enterButton.disabled = !ready || broken;
    retryButton.hidden = !failed && !broken;
    retryButton.textContent = broken ? '重新打开' : '重试下载';
    if (ready) status.textContent = '准备好了，轻点进入小屋';
    else status.textContent = '准备小屋画面 ' + done + ' / ' + total;
    progress.max = total || 1; progress.value = done;
    detail.textContent = state.text || (ready ? '可以进屋啦，动画和音乐会陆续加载。' : '只准备轻量画面，动画会在进入后加载。');
    if (!ready && !state.text && Date.now() - started > 5000) detail.textContent = '连接较慢，基础画面仍在下载，请稍等。';
    splash.classList.toggle('ready', ready);
  }
  function prepare() {
    if (loading || leaving || ready) return;
    if (!window.NT || !assets) { paint(); return; }
    loading = true; failed = false;
    total = window.NT.sprites.core.length;
    window.NT.sprites.prepare(function (n) { done = n; paint(); }).then(function () {
      ready = true; loading = false; paint();
    }, function () { loading = false; failed = true; paint(); });
  }
  function enter() {
    if (!ready || enterButton.disabled || leaving) return;
    leaving = true;
    var NT = window.NT, S = NT.S();
    if (window.NaituanSound) window.NaituanSound.unlock(S.mute);
    if (window.NaituanBGM) window.NaituanBGM.unlock();
    NT.sound('hello');
    if (!S.sleeping && !NT.isBusy()) { NT.setPose('wave', 3600); NT.say('你回来啦！给你挥挥爪~', 3600); }
    splash.classList.add('leaving');
    setTimeout(function () { splash.remove(); window.dispatchEvent(new CustomEvent('naituan:entered')); }, 520);
    clearInterval(timer);
  }
  enterButton.addEventListener('click', enter);
  retryButton.addEventListener('click', function () { if (assets) assets.retry(); else window.location.reload(); });
  window.addEventListener('naituan:retry', prepare);
  window.addEventListener('naituan:loading', paint);
  var timer = setInterval(function () { if (!ready && !failed && !loading) prepare(); paint(); }, 1000);
  prepare();
})();
