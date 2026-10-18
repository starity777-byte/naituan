/* Versioned media cache and visitor-facing download status. No game saves live here. */
(function (root) {
  'use strict';
  var VERSION = '20261018-v1';
  var base = new URL('.', document.currentScript.src);
  var cacheName = 'naituan-media-' + encodeURIComponent(base.pathname) + '-' + VERSION;
  var pending = new Map(), failures = new Map(), startupError = '';
  var notice, message, retryButton;
  var cache = root.caches ? root.caches.open(cacheName).catch(function () { return null; }) : Promise.resolve(null);

  function notify() { root.dispatchEvent(new CustomEvent('naituan:loading')); }
  function describe(error) {
    if (navigator.onLine === false) return '设备已离线，请检查网络连接后重试。';
    if (error.status === 404 || error.status === 410) return '网站有资源缺失，需要作者修复；你可以稍后重试。';
    if (error.status >= 500) return '网站资源服务暂时异常，请稍后重试。';
    if (error.status === 403) return '网站资源暂时无法访问，请稍后重试。';
    if (error.name === 'AbortError') return '资源下载等待太久，请检查连接后重试；也可能是网站资源服务响应较慢。';
    return '资源连接失败，暂时无法判断是网络还是网站问题，请重试。';
  }
  function report(key, text) { failures.set(key, text); notify(); }
  function forget(path) {
    var url = new URL(path, base); url.searchParams.set('nv', VERSION);
    failures.delete(url.href); notify();
  }
  function foreground(path) {
    var url = new URL(path, base); url.searchParams.set('nv', VERSION);
    var job = pending.get(url.href);
    if (job) { job.background = false; notify(); }
  }
  function discard(path) {
    var url = new URL(path, base); url.searchParams.set('nv', VERSION);
    return cache.then(function (store) { return store && store.delete(url.href); }).catch(function () {});
  }
  function fetchMedia(path, label, background) {
    var url = new URL(path, base);
    url.searchParams.set('nv', VERSION);
    var key = url.href;
    if (pending.has(key)) {
      if (!background) pending.get(key).background = false;
      return pending.get(key).promise.then(function (response) { return response.clone(); });
    }
    var job = { label: label || '资源', background: !!background, started: Date.now() };
    pending.set(key, job);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 90000);
    job.promise = cache.then(function (store) {
      return (store ? store.match(key).catch(function () { return null; }) : Promise.resolve(null)).then(function (hit) {
        if (hit) return hit;
        return root.fetch(key, { signal: controller.signal }).then(function (response) {
          if (!response.ok) { var error = new Error('HTTP ' + response.status); error.status = response.status; throw error; }
          return response.arrayBuffer().then(function (bytes) {
            var ready = new Response(bytes, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' } });
            // Cache writes may fail in private browsing or when storage is full; downloads still work.
            if (store) store.put(key, ready.clone()).catch(function () {});
            return ready;
          });
        });
      });
    }).then(function (response) {
      failures.delete(key); return response;
    }, function (error) {
      if (!job.background) failures.set(key, (label || '资源') + '：' + describe(error));
      throw error;
    }).finally(function () {
      clearTimeout(timer); pending.delete(key); notify();
    });
    notify();
    return job.promise.then(function (response) { return response.clone(); });
  }
  function image(path, label, background) {
    return fetchMedia(path, label, background).then(function (response) { return response.blob(); }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var img = new Image(), url = URL.createObjectURL(blob);
        img.onload = function () { resolve(img); };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          discard(path);
          if (!background) report(path, '动画文件无法显示，可能是文件损坏或浏览器不支持，请重试。');
          reject(new Error('Image decode failed'));
        };
        img.src = url;
      });
    });
  }
  function status() {
    if (navigator.onLine === false) return { kind: 'offline', text: '设备已离线，已加载的内容仍可使用；新资源需要联网后下载。' };
    if (startupError) return { kind: 'startup', text: startupError };
    if (failures.size) return { kind: 'error', text: failures.values().next().value };
    var slow;
    pending.forEach(function (job) { if (!job.background && Date.now() - job.started >= 5000) slow = job; });
    if (slow) return { kind: 'slow', text: slow.label + '仍在下载，连接较慢，请稍等；小屋还在运行。' };
    return { kind: 'ok', text: '' };
  }
  function retry() {
    if (startupError) { root.location.reload(); return; }
    failures.clear();
    root.dispatchEvent(new CustomEvent('naituan:retry'));
    if (root.NaituanBGM) root.NaituanBGM.unlock();
    notify();
  }
  function paint() {
    if (!notice) return;
    var state = status(), splash = document.getElementById('splash');
    // During startup the same diagnosis is shown next to the progress bar.
    var text = state.text;
    var music = root.NaituanBGM && root.NaituanBGM.status();
    if (!text && !splash && music) {
      if (music.error) text = music.error;
      else if (music.waitingForTap) text = '轻点开启音乐，也可以在「我的」里关闭。';
      else if (music.loading) text = '背景音乐正在加载，可以先和奶团玩。';
    }
    notice.hidden = !!splash && state.kind !== 'startup' || !text;
    message.textContent = text;
    retryButton.hidden = state.kind === 'slow' || state.kind === 'offline' || (!music || !music.error && !music.waitingForTap) && state.kind === 'ok';
    retryButton.textContent = state.kind === 'startup' ? '重新打开' : music && music.waitingForTap && !music.error && !state.text ? '开启音乐' : '重试';
  }
  root.NaituanAssets = { fetch: fetchMedia, image: image, status: status, retry: retry, report: report, forget: forget, foreground: foreground, version: VERSION };
  root.addEventListener('error', function (event) {
    var target = event.target;
    var source = target && (target.src || target.href) || event.filename || '';
    if (source && (new URL(source, base).origin !== base.origin || /\/stats\.js|\/vendor\/51la\//.test(source))) return;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' && target.rel === 'stylesheet')) {
      startupError = '页面组件加载失败，可能是连接或网站资源异常，请重新打开。'; notify();
    } else if (event.message && event.filename && event.filename.indexOf(base.href) === 0) {
      startupError = '小屋运行时遇到了错误，请重新打开；若反复出现，需要作者修复页面。'; notify();
    }
  }, true);
  root.addEventListener('offline', notify);
  root.addEventListener('online', retry);
  root.addEventListener('naituan:loading', paint);
  document.addEventListener('DOMContentLoaded', function () {
    notice = document.getElementById('resourceNotice');
    message = document.getElementById('resourceMessage');
    retryButton = document.getElementById('resourceRetry');
    retryButton.addEventListener('click', retry);
    paint();
  });
  setInterval(function () { paint(); notify(); }, 1000);
})(window);
