/* Locally synthesized, seamless rain and purring. No audio downloads or microphone. */
(function (root) {
  'use strict';
  function samples(kind, rate, seconds, random) {
    random = random || Math.random;
    var out = new Float32Array(Math.round(rate * seconds)), low = 0;
    for (var i = 0; i < out.length; i++) {
      var t = i / rate, white = random() * 2 - 1;
      low = low * .96 + white * .04;
      if (kind === 'rain') {
        var breeze = .78 + .12 * Math.sin(t * Math.PI / 3) + .08 * Math.sin(t * Math.PI / 2);
        out[i] = (white * .32 + low * 1.2) * breeze;
      } else {
        var phase = 2 * Math.PI * 27 * t + .38 * Math.sin(2 * Math.PI * .25 * t);
        var breath = .38 + .48 * Math.pow((1 + Math.sin(2 * Math.PI * .25 * t)) / 2, 1.4);
        var pulse = Math.pow((1 + Math.sin(phase)) / 2, 3);
        out[i] = breath * (.12 * Math.sin(phase * 2) + .09 * Math.sin(phase * 4) + low * 1.5 * (.25 + pulse));
      }
    }
    return out;
  }
  function create(onchange) {
    var ctx = null, master, rain, purr, sources = [], stopTimer = 0;
    var mix = { rain: 30, purr: 35 }, requested = false, started = false, error = '';
    function tell() { if (onchange) onchange(); }
    function clamp(value) { return Math.max(0, Math.min(100, Number(value) || 0)); }
    function ramp(param, value, seconds) {
      param.cancelScheduledValues(ctx.currentTime);
      param.setTargetAtTime(value, ctx.currentTime, seconds || .18);
    }
    function channel(kind, level) {
      var buffer = ctx.createBuffer(2, ctx.sampleRate * 12, ctx.sampleRate);
      for (var i = 0; i < 2; i++) buffer.copyToChannel(samples(kind, ctx.sampleRate, 12), i);
      var source = ctx.createBufferSource(), high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
      var gain = ctx.createGain();
      source.buffer = buffer; source.loop = true;
      high.type = 'highpass'; high.frequency.value = kind === 'rain' ? 180 : 32; high.Q.value = .5;
      low.type = 'lowpass'; low.frequency.value = kind === 'rain' ? 4200 : 650; low.Q.value = .5;
      gain.gain.value = level;
      source.connect(high); high.connect(low); low.connect(gain); gain.connect(master);
      source.start(); sources.push(source);
      return gain;
    }
    function init() {
      if (ctx) return true;
      var Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) { error = '这个浏览器暂时无法播放环境音。'; tell(); return false; }
      try {
        ctx = new Audio(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        rain = channel('rain', mix.rain / 100 * .55);
        purr = channel('purr', mix.purr / 100 * 1.4);
        ctx.onstatechange = tell;
        return true;
      } catch (e) { error = '声音还没准备好，点一下声音按钮重试。'; tell(); return false; }
    }
    function setMix(value) {
      mix = { rain: clamp(value.rain), purr: clamp(value.purr) };
      if (ctx && rain && purr) { ramp(rain.gain, mix.rain / 100 * .55); ramp(purr.gain, mix.purr / 100 * 1.4); }
    }
    function setPlaying(value, gesture) {
      requested = !!value;
      clearTimeout(stopTimer);
      if (!requested) {
        started = false;
        if (ctx) {
          ramp(master.gain, 0, .12);
          stopTimer = setTimeout(function () { if (!requested && ctx && ctx.state === 'running') ctx.suspend().catch(function () {}); }, 600);
        }
        tell(); return;
      }
      // Context creation / resume must stay inside a real start or sound-button gesture.
      if (!ctx && !gesture) { tell(); return; }
      if (!init()) return;
      if (ctx.state === 'running') { started = true; error = ''; ramp(master.gain, .65); tell(); }
      else if (gesture) {
        ctx.resume().then(function () {
          if (requested) { started = ctx.state === 'running'; error = ''; ramp(master.gain, .65); }
          tell();
        }).catch(function () { error = '轻点声音按钮，就能重新播放。'; tell(); });
      } else tell();
    }
    function status() { return { playing: requested && started && ctx && ctx.state === 'running' && (mix.rain > 0 || mix.purr > 0), needsGesture: requested && (!ctx || ctx.state !== 'running'), error: error }; }
    function destroy() {
      clearTimeout(stopTimer); requested = false; started = false;
      sources.forEach(function (source) { try { source.stop(); } catch (e) {} }); sources = [];
      if (ctx) { ctx.onstatechange = null; ctx.close().catch(function () {}); ctx = null; }
    }
    return { setMix: setMix, setPlaying: setPlaying, status: status, destroy: destroy };
  }
  root.NaituanStudyAmbience = { create: create, samples: samples };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NaituanStudyAmbience;
})(typeof window !== 'undefined' ? window : globalThis);
