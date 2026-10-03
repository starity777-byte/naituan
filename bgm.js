/* Three locally arranged loops from Alin's two song-maker MIDIs.
   First gesture unlocks audio. The original volume, visibility and study
   gate APIs are preserved. Mini-games share the afternoon loop. Time slots use the device's local clock. */
(function (root) {
  'use strict';
  var MUSIC_VERSION = '20261002-soft-response-v4';
  var TRACKS = {
    morning: { title: '晴窗小步', period: '晨间', seconds: Math.round(128 * 60 / 112 * 48000) / 48000 },
    afternoon: { title: '蜜糖软垫', period: '午后', seconds: Math.round(128 * 60 / 92 * 48000) / 48000 },
    night: { title: '月牙摇篮', period: '夜晚', seconds: Math.round(128 * 60 / 68 * 48000) / 48000 }
  };
  var document = root.document, script = document && document.currentScript;
  var assetBase = root.NAITUAN_MUSIC_BASE || (script && script.src ? new URL('assets/music/', script.src).href : 'assets/music/');
  var ctx = null, master = null, active = null, gate = null;
  var enabled = true, volume = 60, unlocked = false, mode = 'auto', gamePlaying = false;
  var buffers = new Map(), positions = {}, voices = new Set();
  var loadingId = '', failedId = '', error = '', request = 0, suspendTimer = 0;

  function selected() {
    if (gamePlaying) return 'afternoon';
    if (mode !== 'auto') return mode;
    var hour = new Date().getHours();
    return hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 20 ? 'afternoon' : 'night';
  }
  function level() { return Math.pow(volume / 100, 1.5); }
  function want() {
    if (!enabled || volume <= 0 || (document && document.hidden)) return false;
    try { return !gate || !!gate(); } catch (_) { return true; }
  }
  function create() {
    var Audio = root.AudioContext || root.webkitAudioContext;
    if (!Audio) return false;
    try {
      ctx = new Audio();
      master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination);
      return true;
    } catch (_) { ctx = null; master = null; return false; }
  }
  function load(id) {
    if (buffers.has(id)) return buffers.get(id);
    function decode(extension) {
      return root.fetch(assetBase + 'naituan-' + id + '.' + extension + '?v=' + MUSIC_VERSION).then(function (response) {
        if (!response.ok) throw new Error('Music file unavailable');
        return response.arrayBuffer();
      }).then(function (bytes) { return ctx.decodeAudioData(bytes); });
    }
    // Ogg preserves the exact loop. MP3 includes gapless encoder metadata and
    // provides a fallback for browsers which cannot decode Vorbis.
    var promise = decode('ogg').catch(function () { return decode('mp3'); }).catch(function (failure) {
      buffers.delete(id); throw failure;
    });
    buffers.set(id, promise);
    if (buffers.size > 2) {
      buffers.forEach(function (_, oldId) { if (buffers.size > 2 && oldId !== id && (!active || oldId !== active.id)) buffers.delete(oldId); });
    }
    return promise;
  }
  function retire(voice, seconds) {
    if (!voice) return;
    var now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + seconds);
    try { voice.source.stop(now + seconds + .02); } catch (_) {}
  }
  function stop(immediate) {
    if (loadingId) { request++; loadingId = ''; }
    if (!active) return;
    var old = active; active = null;
    positions[old.id] = (Math.max(0, ctx.currentTime - old.startedAt) + old.offset) % old.duration;
    retire(old, immediate ? .025 : .65);
    if (immediate) voices.forEach(function (voice) { if (voice !== old) retire(voice, .025); });
    clearTimeout(suspendTimer);
    suspendTimer = setTimeout(function () {
      if (!active && !loadingId && ctx && ctx.state === 'running') ctx.suspend().catch(function () {});
    }, immediate ? 90 : 750);
  }
  function play(id, buffer) {
    clearTimeout(suspendTimer);
    var now = ctx.currentTime, old = active;
    var source = ctx.createBufferSource(), gain = ctx.createGain();
    var duration = Math.min(TRACKS[id].seconds, buffer.duration);
    var offset = (positions[id] || 0) % duration;
    source.buffer = buffer; source.loop = true; source.loopStart = 0; source.loopEnd = duration;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + (old ? 3 : .85));
    source.connect(gain); gain.connect(master);
    var voice = { id: id, source: source, gain: gain, startedAt: now + .05, offset: offset, duration: duration };
    voices.add(voice);
    source.onended = function () { voices.delete(voice); source.disconnect(); gain.disconnect(); };
    source.start(voice.startedAt, offset);
    active = voice;
    if (old) {
      positions[old.id] = (Math.max(0, now - old.startedAt) + old.offset) % old.duration;
      retire(old, 3);
    }
    error = '';
  }
  function refresh() {
    if (!ctx || !unlocked) return;
    if (!want()) { stop(!!(document && document.hidden)); return; }
    var id = selected();
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if ((active && active.id === id) || loadingId === id || failedId === id) return;
    var token = ++request; loadingId = id;
    load(id).then(function (buffer) {
      if (token !== request) return;
      loadingId = '';
      if (!want()) return;
      if (selected() !== id) { refresh(); return; }
      play(id, buffer);
    }).catch(function () {
      if (token !== request) return;
      loadingId = ''; failedId = id; error = '音乐暂时没加载好，点一下可重试。';
    });
  }
  function configure(options) {
    options = options || {};
    if ('enabled' in options) enabled = !!options.enabled;
    if ('volume' in options) {
      var value = Number(options.volume);
      volume = Math.max(0, Math.min(100, isFinite(value) ? value : 60));
    }
    if ('game' in options && gamePlaying !== !!options.game) {
      gamePlaying = !!options.game; request++; loadingId = ''; failedId = '';
    }
    if ('mode' in options && (options.mode === 'auto' || TRACKS[options.mode])) {
      if (mode !== options.mode) { request++; loadingId = ''; failedId = ''; }
      mode = options.mode;
    }
    if (master) {
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.setTargetAtTime(level(), t, .12);
    }
    refresh();
  }
  function unlock() {
    if (!enabled || volume <= 0 || (document && document.hidden)) return false;
    if (!ctx && !create()) return false;
    unlocked = true; failedId = ''; error = '';
    // Resume remains inside the real pointer/key gesture, before any fetch.
    if (ctx.state === 'suspended') ctx.resume().then(refresh).catch(function () {});
    refresh(); return true;
  }
  function status() {
    var id = active ? active.id : selected(), track = TRACKS[id];
    return {
      playing: !!(active && ctx && ctx.state === 'running'),
      waitingForTap: !!(enabled && volume > 0 && !unlocked),
      loading: !!loadingId, error: error, mode: mode, track: id,
      title: track.title, period: track.period,
      loopEnd: active ? active.duration : track.seconds,
      position: active ? ((Math.max(0, ctx.currentTime - active.startedAt) + active.offset) % active.duration) : (positions[id] || 0)
    };
  }
  if (document) document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 500);
  root.NaituanBGM = {
    configure: configure, unlock: unlock, status: status,
    setGate: function (fn) { gate = typeof fn === 'function' ? fn : null; refresh(); },
    stop: function () { stop(true); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
