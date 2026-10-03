const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../bgm.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const lengths = {morning: 3291429 / 48000, afternoon: 4006957 / 48000, night: 5421176 / 48000};

function fixture(options = {}) {
  let hour = options.hour ?? 8;
  const calls = {contexts: 0, starts: [], stops: [], fetches: [], suspends: 0}, events = {}, timers = [], pending = [];
  const document = {hidden: false, addEventListener(name, fn) {events[name] = fn;}};
  const param = () => ({value: 0, setValueAtTime(v) {this.value=v;}, linearRampToValueAtTime(v) {this.value=v;}, setTargetAtTime(v) {this.value=v;}, cancelScheduledValues() {}});
  const node = extra => Object.assign({connect() {}, disconnect() {}}, extra);
  let context;
  const gains = [];
  class AudioContext {
    constructor() {calls.contexts++; context=this; this.currentTime=1; this.state='suspended'; this.destination={};}
    resume() {this.state='running'; return Promise.resolve();}
    suspend() {calls.suspends++; this.state='suspended'; return Promise.resolve();}
    createGain() {const g=node({gain:param()}); gains.push(g); return g;}
    createBufferSource() {const n=node({start(at, offset) {calls.starts.push({node:n,at,offset});},stop(at) {calls.stops.push({node:n,at});}});return n;}
    decodeAudioData(data) {
      if (options.rejectOgg && data.extension==='ogg') return Promise.reject(new Error('unsupported codec'));
      return Promise.resolve({duration:lengths[data.id], length: Math.round(lengths[data.id] * 48000), sampleRate:48000});
    }
  }
  const window = options.supported === false ? {} : {AudioContext};
  window.document=document;
  window.fetch = url => {
    calls.fetches.push(url);
    const match = url.match(/naituan-(\w+)\.(\w+)(?:\?.*)?$/);
    const response = {ok:true,arrayBuffer: () => Promise.resolve({id:match[1],extension:match[2]})};
    if (options.pending) return new Promise(resolve => pending.push(() => resolve(response)));
    return Promise.resolve(response);
  };
  class Clock extends Date {getHours() {return hour;}}
  let poll;
  vm.runInNewContext(source, {window,document,Date:Clock,URL,Map,Set,Math,Number,isFinite,setInterval(fn) {poll=fn;return 1;},setTimeout(fn) {timers.push(fn);return timers.length;},clearTimeout() {}});
  return {api:window.NaituanBGM,calls,events,document,gains,poll: () => poll(),hour: h=>hour=h,context:()=>context,flush:()=>timers.splice(0).forEach(fn=>fn()),resolve:()=>pending.splice(0).forEach(fn=>fn())};
}

test('silent until a gesture, with time slots following the device clock', () => {
  for (const [hour, id] of [[0,'night'],[5,'night'],[6,'morning'],[11,'morning'],[12,'afternoon'],[19,'afternoon'],[20,'night']]) {
    const f=fixture({hour}); f.api.configure({enabled:true,volume:60}); f.poll();
    assert.equal(f.api.status().track,id); assert.equal(f.calls.contexts,0); assert.equal(f.calls.fetches.length,0); assert.equal(f.api.status().waitingForTap,true);
  }
});

test('one gesture decodes one exact loop, and later gestures reuse the context', async () => {
  const f=fixture(); assert.equal(f.api.unlock(),true); await settle();
  assert.equal(f.api.status().playing,true); assert.equal(f.calls.starts.length,1);
  const buffer=f.calls.starts[0].node;
  assert.equal(buffer.loop,true); assert.equal(buffer.loopStart,0); assert.equal(buffer.loopEnd,lengths.morning);
  f.api.unlock(); await settle(); assert.equal(f.calls.contexts,1); assert.equal(f.calls.fetches.length,1); assert.equal(f.calls.starts.length,1);
});

test('off, zero volume and unsupported browsers remain silent', () => {
  let f=fixture(); f.api.configure({enabled:false}); assert.equal(f.api.unlock(),false); assert.equal(f.calls.contexts,0);
  f=fixture(); f.api.configure({volume:0}); assert.equal(f.api.unlock(),false); assert.equal(f.calls.contexts,0);
  f=fixture({supported:false}); assert.equal(f.api.unlock(),false); assert.equal(f.api.status().playing,false);
});

test('study gate pauses and resumes at the previous musical position', async () => {
  const f=fixture(); let open=true; f.api.setGate(()=>open); f.api.unlock(); await settle();
  f.context().currentTime=14; const position=f.api.status().position;
  open=false; f.poll(); assert.equal(f.api.status().playing,false); f.flush(); assert.equal(f.calls.suspends,1);
  open=true; f.poll(); await settle(); assert.equal(f.api.status().playing,true);
  assert.ok(Math.abs(f.calls.starts.at(-1).offset-position)<1e-9);
});

test('crossing noon changes to afternoon with a fade, and hidden pages silence both voices', async () => {
  const f=fixture({hour:11}); f.api.unlock(); await settle();
  f.hour(12); f.poll(); await settle(); assert.equal(f.api.status().track,'afternoon'); assert.equal(f.calls.starts.length,2);
  assert.ok(f.calls.stops.some(call=>call.node===f.calls.starts[0].node));
  f.document.hidden=true; f.events.visibilitychange(); assert.equal(f.api.status().playing,false); f.flush();
  assert.equal(f.calls.suspends,1);
  f.document.hidden=false; f.events.visibilitychange(); await settle(); assert.equal(f.api.status().playing,true);
});

test('a download completing after music is disabled never starts playing', async () => {
  const f=fixture({pending:true}); f.api.unlock(); f.api.configure({enabled:false}); f.resolve(); await settle();
  assert.equal(f.calls.starts.length,0); assert.equal(f.api.status().playing,false);
  f.api.configure({enabled:true}); await settle(); assert.equal(f.calls.starts.length,1);
});

test('MP3 fallback, manual audition and volume changes use the same playback path', async () => {
  const f=fixture({rejectOgg:true}); f.api.configure({mode:'night'}); f.api.unlock(); await settle();
  assert.equal(f.api.status().track,'night'); assert.equal(f.api.status().playing,true);
  assert.ok(f.calls.fetches[0].includes('.ogg?v=' + '20261002-soft-response-v4')); assert.ok(f.calls.fetches[1].includes('.mp3?v=' + '20261002-soft-response-v4'));
  const starts=f.calls.starts.length; f.api.configure({volume:35}); assert.equal(f.calls.starts.length,starts); assert.ok(f.gains[0].gain.value>0 && f.gains[0].gain.value<1);
  f.api.configure({enabled:false}); f.flush(); assert.equal(f.api.status().playing,false);
});

test('mini-games play afternoon at morning and night, then resume the local time track', async () => {
  for (const [hour, roomTrack] of [[8, 'morning'], [22, 'night']]) {
    const f = fixture({hour});
    f.api.configure({volume:35}); f.api.unlock(); await settle();
    f.context().currentTime=14;
    const roomPosition=f.api.status().position, volume=f.gains[0].gain.value;
    f.api.configure({game:true}); await settle();
    assert.equal(f.api.status().track, 'afternoon');
    assert.equal(f.api.status().playing, true);
    assert.equal(f.api.status().mode, 'auto');
    assert.equal(f.gains[0].gain.value, volume);
    f.hour(hour === 8 ? 9 : 23); f.poll(); await settle();
    assert.equal(f.api.status().track, 'afternoon');
    f.api.configure({game:false}); await settle();
    assert.equal(f.api.status().track, roomTrack);
    assert.equal(f.api.status().playing, true);
    assert.ok(Math.abs(f.calls.starts.at(-1).offset-roomPosition)<1e-9);
    assert.equal(f.calls.contexts,1);
  }
});

test('game transitions preserve silence preferences and cancel an obsolete track download', async () => {
  for (const options of [{enabled:false}, {volume:0}]) {
    const f=fixture(); f.api.configure(options); f.api.configure({game:true});
    assert.equal(f.api.unlock(),false);
    assert.equal(f.calls.contexts,0);
    f.api.configure({game:false}); assert.equal(f.api.unlock(),false);
  }
  const f=fixture({hour:22,pending:true});
  f.api.unlock(); f.api.configure({game:true}); f.resolve(); await settle();
  assert.equal(f.api.status().track,'afternoon');
  assert.equal(f.calls.starts.length,1);
  assert.equal(f.calls.starts[0].node.loopEnd,lengths.afternoon);
});
