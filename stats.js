(function () {
  'use strict';
  // Anonymous visit statistics (51.LA, see assets/vendor/51la/README.md).
  // Each screen gets its own address, #/home, #/games/cake, ... 51.LA's hashMode counts every address change as a
  // page view, so its dashboard shows visits and time spent per screen. replaceState adds no history entries and
  // never scrolls; if the statistics script fails to load, only the address changes and the game is unaffected.
  var base = 'home', overlay = null;
  function write() {
    try { history.replaceState(history.state, '', location.pathname + location.search + '#/' + (overlay || base)); } catch (e) {}
  }
  write();
  window.NaituanStats = {
    page: function (name) { base = name; overlay = null; write(); }, // a bottom-nav page: home, life, games, profile
    enter: function (name) { overlay = name; write(); },               // a mini-game or the shop, on top of a page
    leave: function () { overlay = null; write(); }
  };
})();
