(function () {
  'use strict';
  var context = null, output = null, voices = new Set(), last = {};
  // Frequency, end frequency, duration, delay, volume. Short, soft notes only.
  var notes = {
    tap: [[720, 580, .07, 0, .07]],
    head: [[440, 520, .16, 0, .12], [660, 740, .18, .1, .07]],
    ear: [[850, 1150, .09, 0, .08], [1100, 920, .1, .08, .055]],
    nose: [[620, 220, .13, 0, .14]],
    paw: [[520, 590, .13, 0, .1], [780, 880, .15, .1, .075]],
    belly: [[440, 660, .11, 0, .09], [560, 840, .11, .12, .09], [660, 990, .14, .24, .07]],
    tail: [[380, 560, .16, 0, .1], [560, 430, .2, .12, .07]],
    lift: [[230, 480, .2, 0, .1]],
    land: [[145, 65, .17, 0, .18], [360, 180, .09, 0, .04]],
    feed: [[520, 650, .1, 0, .09], [650, 780, .1, .12, .09], [780, 980, .2, .24, .09]],
    sleep: [[520, 440, .28, 0, .065], [390, 330, .35, .2, .065]],
    wake: [[330, 440, .18, 0, .07], [520, 660, .2, .14, .08]],
    sniff: [[260, 360, .1, 0, .06], [320, 400, .12, .16, .05]],
    watch: [[660, 660, .3, 0, .07], [990, 990, .35, .18, .045]],
    save: [[520, 660, .13, 0, .07], [780, 780, .22, .12, .06]],
    reward: [[523, 523, .2, 0, .09], [659, 659, .2, .12, .09], [784, 784, .3, .24, .08]]
  };
  function init() {
    if (!context) {
      var Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      context = new Audio(); output = context.createGain();
      output.gain.value = .5; output.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(function () {});
    return true;
  }
  function note(data, purr) {
    var t = context.currentTime + .015 + data[3], duration = data[2];
    var voice = context.createOscillator(), gain = context.createGain();
    voice.type = purr ? 'triangle' : 'sine';
    voice.frequency.setValueAtTime(data[0], t);
    voice.frequency.exponentialRampToValueAtTime(data[1], t + duration);
    gain.gain.setValueAtTime(.0001, t);
    if (purr) {
      // A gently pulsing low tone evokes a purr without a continuous sound loop.
      for (var i = 0; i < 22; i++) {
        gain.gain.linearRampToValueAtTime(data[4], t + i * .04 + .012);
        gain.gain.linearRampToValueAtTime(.012, t + i * .04 + .037);
      }
    } else gain.gain.exponentialRampToValueAtTime(data[4], t + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    voice.connect(gain); gain.connect(output); voices.add(voice);
    voice.onended = function () { voice.disconnect(); gain.disconnect(); voices.delete(voice); };
    voice.start(t); voice.stop(t + duration + .025);
  }
  function stop() {
    voices.forEach(function (voice) { try { voice.stop(); } catch (e) {} });
    voices.clear();
  }
  function unlock(muted) {
    if (muted || document.hidden) return false;
    try { return init(); } catch (e) { return false; }
  }
  function play(kind, muted) {
    if (muted || document.hidden) return false;
    var purr = kind === 'rub' || kind === 'chin' || kind === 'knead';
    if (!purr && !notes[kind]) return false;
    var time = Date.now();
    if (last[kind] != null && time - last[kind] < (purr ? 950 : 140)) return false;
    try {
      if (!init()) return false;
      last[kind] = time;
      if (purr) note([115, 105, .95, 0, .11], true);
      else notes[kind].forEach(function (data) { note(data, false); });
      return true;
    } catch (e) { return false; }
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  window.NaituanSound = { play: play, stop: stop, unlock: unlock };
})();
