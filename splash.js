/* Prepare common animations before entry. Progress counts completed files, never elapsed time. */
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
    else status.textContent = '准备奶团的常用动作 ' + done + ' / ' + total;
    progress.max = total || 1; progress.value = done;
    detail.textContent = state.text || (ready ? '常用动作已备好。音乐会在进入后加载。' : '首次需要下载，之后会优先使用本机缓存。');
    if (!ready && !state.text && Date.now() - started > 5000) detail.textContent = '资源仍在下载，连接较慢，请稍等；正在准备常用动作。';
    splash.classList.toggle('ready', ready);
  }
  function prepare() {
    if (loading || leaving || ready) return;
    if (!window.NT || !assets) { paint(); return; }
    loading = true; failed = false;
    var roomPictures = Array.from(document.querySelectorAll('#roomScene img[src]')).filter(function (img) { return img.id !== 'catimg' && !img.hidden; });
    total = window.NT.sprites.core.length + roomPictures.length;
    var spritesDone = 0, roomDone = 0;
    function update() { done = spritesDone + roomDone; paint(); }
    function roomNext() {
      var img = roomPictures.shift();
      if (!img) return Promise.resolve();
      if (img.dataset.prepared) { roomDone++; update(); return roomNext(); }
      return assets.image(img.getAttribute('src'), '房间画面').then(function (loaded) {
        img.src = loaded.src; img.dataset.prepared = '1'; roomDone++; update(); return roomNext();
      });
    }
    Promise.allSettled([
      window.NT.sprites.prepare(function (n) { spritesDone = n; update(); }),
      roomNext()
    ]).then(function (results) {
      loading = false;
      failed = results.some(function (result) { return result.status === 'rejected'; });
      ready = !failed;
      paint();
    });
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
