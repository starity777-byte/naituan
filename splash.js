/* Startup splash: 奶团 peeks out while the house loads, then hops and waits for a tap.
   The tap plays the opening jingle and (through game.js's own pointerdown handler) unlocks
   sound effects and background music — browsers only allow audio after a gesture.
   Tapping early also works; after 7s the splash is ready even if some pictures are still coming. */
(function () {
  'use strict';
  var splash = document.getElementById('splash');
  if (!splash) return;
  var status = document.getElementById('splashStatus');
  var ready = false, leaving = false, readyTimer = 0;
  splash.classList.add('js');

  function markReady() {
    if (ready || leaving) return;
    ready = true; clearTimeout(readyTimer);
    splash.classList.add('ready');
    status.textContent = '轻点进入小屋';
    splash.setAttribute('aria-label', '轻点进入奶团小屋');
  }
  function enter() {
    if (leaving) return;
    leaving = true; clearTimeout(readyTimer);
    if (!ready) splash.classList.add('ready');
    var NT = window.NT;
    try {
      if (NT) {
        var muted = NT.S && NT.S() && NT.S().mute;
        if (window.NaituanSound) window.NaituanSound.unlock(muted);
        if (window.NaituanBGM) window.NaituanBGM.unlock();
        NT.sound('hello');
        var S = NT.S && NT.S();
        // Greet again now that the player can actually see it (the greeting at load time was behind the splash).
        if (S && !S.sleeping && !(NT.isBusy && NT.isBusy())) { NT.setPose('wave', 3600); NT.say('你回来啦！给你挥挥爪~', 3600); }
      }
    } catch (e) {}
    requestAnimationFrame(function () { splash.classList.add('leaving'); });
    setTimeout(function () { splash.remove(); }, 520);
  }

  splash.addEventListener('click', enter);
  splash.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); }
  });
  try { splash.focus({ preventScroll: true }); } catch (e) {}

  // Ready once 奶团 and the room pictures on screen have arrived. (Not window "load": a slow font server would hold that up.)
  function roomShown() {
    var cat = document.getElementById('catimg');
    if (!cat || !cat.getAttribute('src') || !cat.complete) return false;
    var pics = document.querySelectorAll('#roomScene img[src]');
    for (var i = 0; i < pics.length; i++) if (!pics[i].hidden && !pics[i].complete) return false;
    return true;
  }
  (function check() {
    if (ready || leaving) return;
    if (roomShown()) markReady(); else setTimeout(check, 120);
  })();
  readyTimer = setTimeout(markReady, 7000);
})();
