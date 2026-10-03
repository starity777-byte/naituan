(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app'), NT = window.NT, Life = window.NaituanLife;
  var page = 'home', toastTimer = 0;
  var views = { home: $('homeView'), life: $('lifeView'), games: $('gamesView'), profile: $('profileView') };
  function menu(open, restoreFocus) {
    $('pawMenu').hidden = !open;
    $('pawToggle').setAttribute('aria-expanded', String(open));
    $('pawToggle').setAttribute('aria-label', open ? '收起爪爪菜单' : '打开爪爪菜单');
    $('pawToggle').querySelector('use').setAttribute('href', open ? '#i-close' : '#i-paw');
    if (restoreFocus) $('pawToggle').focus({ preventScroll: true });
  }
  function navigate(next) {
    if (!views[next] || NT.isBusy()) return;
    if (next !== page) NT.sound('tap');
    if (next !== 'home') NT.finishRoom();
    menu(false);
    page = next;
    if (window.NaituanStats) window.NaituanStats.page(next);
    Object.keys(views).forEach(function (key) { views[key].hidden = key !== next; });
    app.dataset.page = next;
    ['navHome', 'navLife', 'navProfile'].forEach(function (id) { $(id).removeAttribute('aria-current'); });
    if (next === 'profile') $('navProfile').setAttribute('aria-current', 'page');
    if (next === 'home') { $('navHome').setAttribute('aria-current', 'page'); NT.room.refresh(); }
    if (next === 'life') { $('navLife').setAttribute('aria-current', 'page'); Life.render(); }
    sync();
    window.dispatchEvent(new CustomEvent('naituan:page', { detail: { page: next } }));
  }
  function notify(message) {
    clearTimeout(toastTimer);
    $('houseToast').textContent = message; $('houseToast').hidden = false;
    toastTimer = setTimeout(function () { $('houseToast').hidden = true; }, 4200);
  }
  function syncFullscreen() {
    var active = !!(document.fullscreenElement || document.webkitFullscreenElement);
    var button = $('houseFullscreen');
    button.hidden = !active && window.matchMedia('(display-mode: fullscreen)').matches;
    button.querySelector('span').textContent = active ? '退出全屏' : '全屏';
    button.setAttribute('aria-pressed', String(active));
  }
  async function toggleFullscreen() {
    var root = document.documentElement;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.webkitFullscreenElement) await document.webkitExitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
      else { notify('这个浏览器暂不支持直接全屏，可以添加到桌面后打开。'); return; }
      syncFullscreen();
    } catch (_) { notify('没能进入全屏，请用手机浏览器打开后再点一次「全屏」。'); }
  }
  // Keep a slider in step with the saved value, but never fight a thumb that is being dragged.
  function paintSlider(input, output, value) {
    output.textContent = value + '%';
    if (document.activeElement !== input) input.value = value;
  }
  function sync() {
    var state = NT.S(), life = state.life;
    $('gamesCoinNum').textContent = state.fish.toLocaleString();
    $('gemNum').textContent = life.gems.toLocaleString();
    [
      ['quickFeed', 'hunger', '饱腹', '点一下喂小鱼'],
      ['quickPet', 'mood', '心情', '点一下摸摸奶团'],
      ['quickSleep', 'energy', '精神', state.sleeping ? '点一下叫醒奶团' : '点一下让奶团睡觉']
    ].forEach(function (entry) {
      var button = $(entry[0]), amount = Math.round(state[entry[1]]);
      button.style.setProperty('--amount', amount / 100);
      button.title = entry[2] + ' ' + amount + '% · ' + entry[3];
      button.setAttribute('aria-label', button.title);
    });
    if (page === 'profile') {
      $('profileFish').textContent = state.fish.toLocaleString();
      $('profileGems').textContent = life.gems.toLocaleString();
      var minutes = Object.keys(life.days).reduce(function (sum, key) { return sum + (Number(life.days[key].focusMinutes) || 0); }, 0);
      if (window.NaituanPlanner && typeof window.NaituanPlanner.totalFocusMinutes === 'function') minutes = window.NaituanPlanner.totalFocusMinutes();
      $('profileFocus').textContent = Math.floor(minutes);
      $('profileSound').textContent = state.mute ? '音效：关' : '音效：开';
      $('profileSound').setAttribute('aria-pressed', String(!state.mute));
      $('profileMusic').textContent = state.bgm ? '背景音乐：开' : '背景音乐：关';
      $('profileMusic').setAttribute('aria-pressed', String(state.bgm));
      paintSlider($('profileVolume'), $('profileVolumeValue'), state.vol);
      paintSlider($('profileMusicVolume'), $('profileMusicVolumeValue'), state.bgmVol);
      if ($('profileBgmTrack') && window.NaituanBGM) {
        var music = window.NaituanBGM.status();
        $('profileBgmTrack').textContent = music.period + ' · ' + music.title + '（随当地时间变化）';
      }
    }
  }
  function action(name) {
    if (name === 'home' || name === 'life' || name === 'games' || name === 'profile') { navigate(name); return; }
    menu(false);
    if (name === 'shop') $('btnShop').click();
    if (name === 'book') window.NTQ.openBook();
    if (name === 'arrange') { $('roomArrange').click(); $('roomArrange').focus({ preventScroll: true }); }
    if (name === 'fullscreen') toggleFullscreen();
  }
  $('pawToggle').addEventListener('click', function () { NT.sound('tap'); menu($('pawMenu').hidden); });
  document.querySelectorAll('[data-house-action]').forEach(function (button) {
    button.addEventListener('click', function () { action(button.dataset.houseAction); });
  });
  document.querySelectorAll('[data-play]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (NT.S().sleeping) { notify('奶团还在睡觉，回窝点月亮叫醒它吧。'); return; }
      navigate('home');
      $(button.dataset.play).click();
    });
  });
  $('quickFeed').addEventListener('click', function () { $('btnFeed').click(); sync(); });
  $('quickPet').addEventListener('click', function () { $('catbtn').click(); sync(); });
  $('quickSleep').addEventListener('click', function () { $('btnSleep').click(); sync(); });
  $('gemChip').addEventListener('click', function () { navigate('life'); });
  $('profileSound').addEventListener('click', function () { NT.setMute(!NT.S().mute); NT.sound('ear'); sync(); });
  $('profileMusic').addEventListener('click', function () { NT.setBgm(!NT.S().bgm); NT.sound('tap'); sync(); });
  $('profileVolume').addEventListener('input', function (event) { NT.setVolume(event.target.value, false); sync(); });
  $('profileVolume').addEventListener('change', function (event) { NT.setVolume(event.target.value, true); sync(); });
  $('profileMusicVolume').addEventListener('input', function (event) { NT.setBgmVolume(event.target.value, false); sync(); });
  $('profileMusicVolume').addEventListener('change', function (event) { NT.setBgmVolume(event.target.value, true); sync(); });
  // Mini-games keep the afternoon loop; the study room keeps its own ambience.
  if (window.NaituanBGM) window.NaituanBGM.setGate(function () { var study = $('plannerStudy'); return !(study && study.open); });
  $('profileSave').addEventListener('click', function () { $('btnSave').click(); });
  document.addEventListener('pointerdown', function (event) {
    if (!$('pawMenu').hidden && !$('pawMenu').contains(event.target) && !$('pawToggle').contains(event.target)) menu(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('pawMenu').hidden) { menu(false, true); event.preventDefault(); }
    if (!$('saveModal').hidden && event.key === 'Tab') {
      var nodes = Array.from($('saveModal').querySelectorAll('button:not(:disabled), textarea')).filter(function (node) { return node.getClientRects().length; });
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  function closeDialog(dialog) {
    if (dialog.id === 'foodDialog' && $('foodSubmit').disabled) return;
    dialog.close();
  }
  document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
    button.addEventListener('click', function () { closeDialog(button.closest('dialog')); });
  });
  document.querySelectorAll('.house-dialog').forEach(function (dialog) {
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      var rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
    });
  });
  new MutationObserver(function () {
    if ($('saveModal').hidden) {
      Life.render(); sync();
      window.dispatchEvent(new CustomEvent('naituan:life-change'));
      $('pawToggle').focus({ preventScroll: true });
    }
  }).observe($('saveModal'), { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('naituan:notice', function (event) {
    if (page !== 'life') notify(event.detail.message);
  });
  window.addEventListener('naituan:life-change', sync);
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);
  window.matchMedia('(display-mode: fullscreen)').addEventListener('change', syncFullscreen);
  window.NaituanHouse = { navigate: navigate, notify: notify, currentPage: function () { return page; } };
  setInterval(sync, 1000);
  sync();
  syncFullscreen();
})();
