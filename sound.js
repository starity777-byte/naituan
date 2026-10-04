(function () {
  'use strict';
  var context = null, output = null, noiseBuffer = null, voices = new Set(), last = {};
  // Master level. The cues are written as soft notes (peaks .03-.2), so the master stage lifts them:
  // volume 100 -> x2.6, the default 80 -> x2.08, about 20 -> the old x.5. A limiter keeps stacked voices from clipping.
  var MAX_GAIN = 2.6, volume = .8;
  function level() { return volume * MAX_GAIN; }
  function setVolume(value) {
    value = Number(value);
    volume = Math.max(0, Math.min(100, isFinite(value) ? value : 80)) / 100;
    if (output) output.gain.value = level();
  }
  // Frequency, end frequency, duration, delay, volume, voice.
  // Voice: omitted = sine, 't' = triangle, 'n' = band-passed noise (frequencies are the filter sweep),
  // 'b' = triangle "boing" whose pitch wobbles like a spring. Short, soft notes only.
  var notes = {
    tap: [[720, 580, .07, 0, .12]],
    head: [[440, 520, .16, 0, .12], [660, 740, .18, .1, .07]],
    ear: [[850, 1150, .09, 0, .08], [1100, 920, .1, .08, .055]],
    nose: [[620, 220, .13, 0, .14]],
    paw: [[520, 590, .13, 0, .1], [780, 880, .15, .1, .075]],
    belly: [[440, 660, .11, 0, .09], [560, 840, .11, .12, .09], [660, 990, .14, .24, .07]],
    tail: [[380, 560, .16, 0, .1], [560, 430, .2, .12, .07]],
    lift: [[230, 480, .2, 0, .1]],
    // Duang-Duang: a body thump plus a springy boing, then a smaller rebound (matches the .duang squash animation).
    land: [[210, 62, .26, 0, .2], [430, 250, .2, 0, .07, 'b'], [250, 80, .22, .27, .13], [520, 320, .16, .27, .045, 'b']],
    feed: [[520, 650, .1, 0, .09], [650, 780, .1, .12, .09], [780, 980, .2, .24, .09]],
    sleep: [[520, 440, .28, 0, .065], [390, 330, .35, .2, .065]],
    wake: [[330, 440, .18, 0, .07], [520, 660, .2, .14, .08]],
    sniff: [[260, 360, .1, 0, .06], [320, 400, .12, .16, .05]],
    watch: [[660, 660, .3, 0, .07], [990, 990, .35, .18, .045]],
    save: [[520, 660, .13, 0, .07], [780, 780, .22, .12, .06]],
    reward: [[523, 523, .2, 0, .09], [659, 659, .2, .12, .09], [784, 784, .3, .24, .08]],
    // Opening the house: a little mew, then a soft G-major music-box arpeggio (G5 B5 D6 G6).
    hello: [[520, 880, .11, 0, .09, 't'], [880, 660, .18, .1, .08, 't'], [784, 784, .2, .34, .06], [988, 988, .2, .44, .06], [1175, 1175, .24, .54, .06], [1568, 1568, .5, .64, .05]],
    // Box stacking.
    boxgo: [[392, 523, .1, 0, .08], [523, 784, .14, .09, .08]],
    boxland: [[175, 60, .2, 0, .2], [700, 260, .09, 0, .09, 'n'], [320, 200, .2, .01, .05, 'b'], [210, 78, .16, .28, .1], [420, 280, .1, .28, .03, 'b']],
    // Jelly: a squishy "boing" (merge) and a quieter one for a soft landing. A low body, then a wobbling spring that sags and rebounds.
    jelly: [[250, 170, .12, 0, .13], [330, 560, .12, 0, .12, 'b'], [560, 300, .34, .1, .1, 'b'], [840, 520, .22, .06, .04, 'b']],
    jellysoft: [[210, 150, .09, 0, .08], [300, 430, .1, 0, .07, 'b'], [430, 280, .2, .08, .05, 'b']],
    chime: [[880, 880, .16, 0, .07], [1319, 1319, .3, .07, .07]],
    chop: [[3200, 900, .07, 0, .08, 'n'], [330, 170, .09, 0, .05]],
    boxmiss: [[1800, 260, .42, 0, .09, 'n'], [440, 110, .45, 0, .08], [392, 392, .17, .4, .07, 't'], [330, 330, .17, .56, .07, 't'], [262, 262, .4, .72, .07, 't']],
    fanfare: [[523, 523, .14, 0, .08], [659, 659, .14, .11, .08], [784, 784, .14, .22, .08], [1047, 1047, .4, .33, .09], [1319, 1319, .3, .44, .05]],
    // Extra voices for petting. Each touch spot picks one of several so repeated taps never sound the same.
    mew: [[520, 880, .11, 0, .09, 't'], [880, 620, .2, .1, .085, 't']],
    mrrp: [[300, 480, .07, 0, .09, 't'], [480, 420, .09, .07, .08, 't'], [420, 560, .08, .15, .06, 't']],
    boop: [[880, 1250, .06, 0, .09], [1250, 1250, .07, .05, .05]],
    squeak: [[1200, 1700, .05, 0, .07], [1700, 1250, .08, .05, .06]],
    chirp: [[1100, 1500, .05, 0, .06], [1500, 1200, .06, .06, .05], [1250, 1650, .05, .12, .05]],
    twinkle: [[1046, 1046, .09, 0, .06], [1318, 1318, .09, .07, .06], [1568, 1568, .16, .14, .06]],
    pat: [[330, 240, .06, 0, .09], [420, 300, .06, .09, .08]],
    trill: [[700, 900, .05, 0, .06, 't'], [760, 960, .05, .06, .06, 't'], [820, 1020, .05, .12, .06, 't'], [880, 1100, .08, .18, .06, 't']],
    giggle: [[900, 1100, .06, 0, .07], [1000, 1250, .06, .09, .07], [900, 1100, .06, .18, .07], [1000, 1250, .06, .27, .07], [1100, 1400, .09, .36, .07]],
    whine: [[600, 420, .25, 0, .07, 't'], [500, 340, .3, .2, .06, 't']],
    spark: [[1568, 1568, .08, 0, .05], [2093, 2093, .12, .06, .05], [2637, 2637, .2, .12, .04]],
    // Small UI cues.
    coin: [[1319, 1319, .08, 0, .09], [1760, 1760, .24, .06, .09]],
    pick: [[660, 780, .06, 0, .1]],
    nope: [[260, 200, .1, 0, .07, 't'], [220, 170, .14, .09, .07, 't']]
  };
  // Touch spots with several voices: a different one from the last is picked each time.
  var pools = { head: ['head', 'mew', 'mrrp'], ear: ['ear', 'chirp', 'twinkle'], nose: ['nose', 'boop', 'squeak'], paw: ['paw', 'pat', 'trill'], belly: ['belly', 'giggle'], tail: ['tail', 'whine'] };
  var lastVoice = {};
  function voiceFor(kind) {
    var pool = pools[kind], pick;
    if (!pool) return kind;
    do pick = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && pick === lastVoice[kind]);
    return (lastVoice[kind] = pick);
  }
  function init() {
    if (!context) {
      var Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      context = new Audio(); output = context.createGain();
      output.gain.value = level();
      if (context.createDynamicsCompressor) {
        var limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -9; limiter.knee.value = 10; limiter.ratio.value = 8;
        limiter.attack.value = .002; limiter.release.value = .18;
        output.connect(limiter); limiter.connect(context.destination);
      } else output.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(function () {});
    return true;
  }
  function envelope(gain, t, duration, peak, purr) {
    gain.gain.setValueAtTime(.0001, t);
    if (purr) {
      // A gently pulsing low tone evokes a purr without a continuous sound loop.
      for (var i = 0; i < 22; i++) {
        gain.gain.linearRampToValueAtTime(peak, t + i * .04 + .012);
        gain.gain.linearRampToValueAtTime(.012, t + i * .04 + .037);
      }
    } else gain.gain.exponentialRampToValueAtTime(peak, t + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
  }
  function play1(source, gain, t, duration) {
    source.connect(gain); gain.connect(output); voices.add(source);
    source.onended = function () { source.disconnect(); gain.disconnect(); voices.delete(source); };
    source.start(t); source.stop(t + duration + .025);
  }
  function noise(data, t) {
    // Needs buffer sources and filters; on a limited engine the tonal notes still play.
    if (!context.createBufferSource || !context.createBiquadFilter || !context.createBuffer) return;
    var duration = data[2];
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * .4), context.sampleRate);
      var ch = noiseBuffer.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    var source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noiseBuffer; source.loop = true;
    filter.type = 'bandpass'; filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(data[0], t);
    filter.frequency.exponentialRampToValueAtTime(data[1], t + duration);
    envelope(gain, t, duration, data[4], false);
    source.connect(filter); filter.connect(gain);
    gain.connect(output); voices.add(source);
    source.onended = function () { source.disconnect(); filter.disconnect(); gain.disconnect(); voices.delete(source); };
    source.start(t); source.stop(t + duration + .025);
  }
  function note(data, purr, shift, delay) {
    var t = context.currentTime + .015 + (delay || 0) + data[3], duration = data[2], kind = data[5];
    if (kind === 'n') { noise(data, t); return; }
    var ratio = shift ? Math.pow(2, shift / 12) : 1, from = data[0] * ratio, to = data[1] * ratio;
    var voice = context.createOscillator(), gain = context.createGain();
    voice.type = purr || kind === 't' || kind === 'b' ? 'triangle' : 'sine';
    voice.frequency.setValueAtTime(from, t);
    if (kind === 'b') {
      // Slide from -> to while wobbling ~22 Hz, fading out: the "boing" of a spring.
      var steps = Math.ceil(duration / .008);
      for (var i = 1; i <= steps; i++) {
        var p = i / steps;
        voice.frequency.setValueAtTime(from * Math.pow(to / from, p) * (1 + .09 * Math.sin(6.2832 * 22 * p * duration) * (1 - p)), t + p * duration);
      }
    } else voice.frequency.exponentialRampToValueAtTime(to, t + duration);
    envelope(gain, t, duration, data[4], purr);
    play1(voice, gain, t, duration);
  }
  function stop() {
    voices.forEach(function (voice) { try { voice.stop(); } catch (e) {} });
    voices.clear();
  }
  function unlock(muted) {
    if (muted || document.hidden) return false;
    try { return init(); } catch (e) { return false; }
  }
  // shift: optional semitones to transpose tonal notes (rising combo chimes); delay: optional seconds before the cue.
  function play(kind, muted, shift, delay) {
    if (muted || document.hidden || volume === 0) return false;
    var purr = kind === 'rub' || kind === 'chin' || kind === 'knead';
    if (!purr && !notes[kind]) return false;
    var time = Date.now();
    if (last[kind] != null && time - last[kind] < (purr ? 950 : 140)) return false;
    try {
      if (!init()) return false;
      last[kind] = time;
      if (purr) note([115, 105, .95, 0, .11], true, 0, 0);
      else notes[voiceFor(kind)].forEach(function (data) { note(data, false, +shift || 0, +delay || 0); });
      return true;
    } catch (e) { return false; }
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  window.NaituanSound = { play: play, stop: stop, unlock: unlock, setVolume: setVolume };
})();
