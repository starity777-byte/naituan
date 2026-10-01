/* Locally synthesized background music for the little house: a slow, soft chord pad with a few
   sparse music-box notes floating on top. No audio files, no downloads.
   It only starts from a real tap / key press (browser autoplay rules), fades out when the page is hidden,
   and steps aside while a mini-game or the study room has its own sound. */
(function (root) {
  'use strict';
  // Cmaj9 -> Am9 -> Fmaj9 -> G6: warm and unresolved, the kind of loop you stop noticing.
  // Voiced mostly in the 260-600 Hz range so a phone speaker can still carry it.
  var CHORDS = [
    [130.81, 261.63, 329.63, 392.00, 493.88, 587.33],
    [110.00, 261.63, 329.63, 392.00, 440.00, 493.88],
    [174.61, 261.63, 329.63, 392.00, 440.00, 523.25],
    [196.00, 293.66, 329.63, 392.00, 493.88, 587.33]
  ];
  // C major pentatonic, so any note sits well over any of the chords.
  var MELODY = [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  var CHORD_SECONDS = 8, AHEAD = 1.8, TICK_MS = 250, POLL_MS = 500;
  var MAX_LEVEL = 1.7;
  var ctx = null, master = null, bus = null, echo = null, voices = new Set();
  var enabled = true, volume = 60, gate = null, running = false, tickTimer = 0, stopTimer = 0;
  var chordIndex = 0, nextChord = 0, nextNote = 0, step = 3;

  function clamp(value, fallback) {
    value = Number(value);
    return Math.max(0, Math.min(100, isFinite(value) ? value : fallback));
  }
  function level() { return Math.pow(volume / 100, 1.5) * MAX_LEVEL; }
  function want() {
    if (!enabled || volume <= 0 || (root.document && root.document.hidden)) return false;
    try { return !gate || !!gate(); } catch (e) { return true; }
  }
  function create() {
    var Audio = root.AudioContext || root.webkitAudioContext;
    if (!Audio) return false;
    try {
      ctx = new Audio();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master);
      if (ctx.createDelay && ctx.createBiquadFilter) {
        // A soft, dark echo gives the music-box notes some room.
        var delay = ctx.createDelay(1), feedback = ctx.createGain(), tone = ctx.createBiquadFilter(), wet = ctx.createGain();
        delay.delayTime.value = .44; feedback.gain.value = .34; wet.gain.value = .5;
        tone.type = 'lowpass'; tone.frequency.value = 1700;
        delay.connect(tone); tone.connect(feedback); feedback.connect(delay); tone.connect(wet); wet.connect(bus);
        echo = delay;
      }
      return true;
    } catch (e) { ctx = null; master = null; bus = null; echo = null; return false; }
  }
  function track(source, nodes) {
    voices.add(source);
    source.onended = function () {
      voices.delete(source);
      try { source.disconnect(); } catch (e) {}
      nodes.forEach(function (node) { try { node.disconnect(); } catch (e) {} });
    };
  }
  function playChord(t, index) {
    var notes = CHORDS[index % CHORDS.length], tone = ctx.createBiquadFilter(), end = t + CHORD_SECONDS + 3.4;
    tone.type = 'lowpass'; tone.frequency.value = 1300; tone.Q.value = .4; tone.connect(bus);
    notes.forEach(function (freq, n) {
      var peak = n === 0 ? .048 : .038;
      [-4, 4].forEach(function (cents) {
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq; osc.detune.value = cents;
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.linearRampToValueAtTime(peak, t + 2.6);
        gain.gain.linearRampToValueAtTime(peak * .8, t + CHORD_SECONDS);
        gain.gain.linearRampToValueAtTime(.0001, end);
        osc.connect(gain); gain.connect(tone);
        track(osc, [gain]);
        osc.start(t); osc.stop(end + .05);
      });
    });
  }
  function playNote(t, freq, velocity) {
    var peak = .045 * velocity, decay = 2.6, dry = ctx.createGain(), osc = ctx.createOscillator(), over = ctx.createOscillator(), overGain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    over.type = 'sine'; over.frequency.value = freq * 2; overGain.gain.value = .22;
    dry.gain.setValueAtTime(.0001, t);
    dry.gain.exponentialRampToValueAtTime(peak, t + .012);
    dry.gain.exponentialRampToValueAtTime(.0001, t + decay);
    osc.connect(dry); over.connect(overGain); overGain.connect(dry);
    dry.connect(bus); if (echo) dry.connect(echo);
    track(osc, [dry, overGain]); track(over, []);
    osc.start(t); over.start(t); osc.stop(t + decay + .05); over.stop(t + decay + .05);
  }
  function tick() {
    if (!ctx || !running) return;
    var now = ctx.currentTime;
    while (nextChord < now + AHEAD) {
      playChord(nextChord, chordIndex);
      chordIndex = (chordIndex + 1) % CHORDS.length; nextChord += CHORD_SECONDS;
    }
    while (nextNote < now + AHEAD) {
      var gap = 1.7 + Math.random() * 2.9;
      if (Math.random() > .2) {
        var move = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
        step = Math.max(0, Math.min(MELODY.length - 1, step + move));
        playNote(nextNote, MELODY[step], .75 + Math.random() * .25);
        if (Math.random() < .2) {
          var second = Math.max(0, Math.min(MELODY.length - 1, step + (Math.random() < .5 ? -1 : 1)));
          playNote(nextNote + .36, MELODY[second], .55);
        }
      }
      nextNote += gap;
    }
  }
  function clearVoices() {
    voices.forEach(function (voice) { try { voice.stop(); } catch (e) {} });
    voices.clear();
  }
  function start() {
    if (!ctx || running) return;
    clearTimeout(stopTimer);
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    running = true;
    var t = ctx.currentTime;
    nextChord = t + .15; nextNote = t + 1.2;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.setTargetAtTime(level(), t, .9);
    tick();
    tickTimer = setInterval(tick, TICK_MS);
  }
  function stop(immediate) {
    if (!running) return;
    running = false; clearInterval(tickTimer); tickTimer = 0;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.setTargetAtTime(0, t, immediate ? .05 : .5);
    clearTimeout(stopTimer);
    stopTimer = setTimeout(function () {
      if (running || !ctx) return;
      clearVoices();
      if (ctx.state === 'running') ctx.suspend().catch(function () {});
    }, immediate ? 250 : 2200);
  }
  function refresh() {
    if (!ctx) return;
    var wanted = want();
    if (wanted && !running) start();
    else if (!wanted && running) stop(!!(root.document && root.document.hidden));
    else if (wanted && running && ctx.state === 'suspended') ctx.resume().catch(function () {});
  }
  function configure(options) {
    options = options || {};
    if ('enabled' in options) enabled = !!options.enabled;
    if ('volume' in options) volume = clamp(options.volume, 60);
    if (ctx && running) {
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.setTargetAtTime(level(), t, .12);
    }
    refresh();
  }
  // Call from a real tap / key press. The audio context can only be created or resumed inside one.
  function unlock() {
    if (!enabled || volume <= 0 || (root.document && root.document.hidden)) return false;
    if (!ctx && !create()) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    refresh();
    return true;
  }
  function status() {
    return { playing: !!(running && ctx && ctx.state === 'running'), waitingForTap: !!(enabled && volume > 0 && (!ctx || ctx.state !== 'running')) };
  }
  if (root.document) root.document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, POLL_MS);
  root.NaituanBGM = { configure: configure, unlock: unlock, setGate: function (fn) { gate = typeof fn === 'function' ? fn : null; refresh(); }, status: status, stop: function () { stop(true); } };
})(typeof window !== 'undefined' ? window : globalThis);
