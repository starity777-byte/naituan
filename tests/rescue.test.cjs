const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function load(initial, options) {
  const opts = options || {};
  const map = new Map(Object.entries(initial || {}));
  const writes = [];
  const calls = [];
  const localStorage = {
    getItem(key) {
      if (opts.throwGet && opts.throwGet.has(key)) throw new Error('denied');
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (opts.throwSet && opts.throwSet.has(key)) throw new Error('quota');
      writes.push(key);
      map.set(key, String(value));
    },
    removeItem(key) { map.delete(key); }
  };
  const window = { localStorage };
  if (!opts.noNT) {
    window.NT = {
      isBusy() { return !!opts.busy; },
      restoreState(data) {
        calls.push(JSON.parse(JSON.stringify(data)));
        if (opts.restoreThrows) throw new Error('boom');
        if (opts.restore === false) return false;
        map.set('naituan-house-v1', opts.nextKey != null ? opts.nextKey : JSON.stringify({ hunger: data.hunger, t: 999 }));
        return true;
      }
    };
    if (opts.noRestore) delete window.NT.restoreState;
  }
  const sandbox = {
    window, localStorage, JSON, Math, Date, Object, Number, Array, String, isNaN, isFinite, Error
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'rescue.js'), 'utf8'), sandbox, { filename: 'rescue.js' });
  return { Rescue: window.NaituanRescue, map, writes, calls };
}

function house(hunger, extra) {
  return JSON.stringify(Object.assign({ hunger: hunger, fish: 4, own: { bed: 1, rug: 0 }, t: 1 }, extra || {}));
}

test('key names match the house save slots', () => {
  const { Rescue } = load({});
  assert.equal(Rescue.KEY, 'naituan-house-v1');
  assert.equal(Rescue.BACKUP_KEY, 'naituan-house-v1-backup');
  assert.equal(Rescue.BEFORE_KEY, 'naituan-house-v1-before-restore');
});

test('readBackup accepts only a plain object with finite hunger', () => {
  const cases = {
    '': null,
    '{': null,
    'null': null,
    '[]': null,
    '12': null,
    '{"mood":1}': null,
    '{"hunger":"12"}': null,
    '{"hunger":null}': null,
    '{"hunger":1e309}': null,
    '{"hunger":0,"fish":3}': { hunger: 0, fish: 3 }
  };
  for (const [raw, expected] of Object.entries(cases)) {
    const { Rescue, writes } = load({ 'naituan-house-v1-backup': raw });
    if (expected == null) assert.equal(Rescue.readBackup(), null, raw);
    else assert.deepEqual(Rescue.readBackup(), expected);
    assert.deepEqual(writes, []);
  }
  assert.equal(load({}).Rescue.readBackup(), null);
});

test('summary counts fish and owned furniture and formats local time', () => {
  const { Rescue } = load({});
  const t = new Date(2026, 0, 3, 9, 5).getTime();
  const text = Rescue.summary({
    hunger: 40,
    fish: 8.9,
    own: { bed: 1, rug: 0, lamp: true, empty: '', gone: false },
    t: t
  });
  assert.equal(text, '找到一份存档：小鱼干 8 · 家具 2 件 · 上次保存于 2026/1/3 09:05');
  assert.equal(
    Rescue.summary({ hunger: 1, fish: -3.2 }),
    '找到一份存档：小鱼干 0 · 家具 0 件 · 上次保存于 时间不明'
  );
  assert.equal(
    Rescue.summary({ hunger: 1, fish: 2, own: null, t: '不是时间' }),
    '找到一份存档：小鱼干 2 · 家具 0 件 · 上次保存于 时间不明'
  );
  assert.equal(Rescue.summary({ hunger: 1, t: '' }).endsWith('时间不明'), true);
  assert.equal(text.includes('替换'), false);
});

test('differs ignores timestamp and whitespace, and treats a missing current save as different', () => {
  const { Rescue } = load({});
  const backup = { hunger: 61, fish: 8, own: { bed: 1, rug: 0, lamp: 1 }, t: 1000 };
  const same = JSON.stringify({ hunger: 61, fish: 8, own: { bed: 1, rug: 0, lamp: 1 }, t: 5000 });
  const spaced = '{ "hunger": 61, "fish": 8, "own": { "bed": 1, "rug": 0, "lamp": 1 }, "t": 9 }';
  assert.equal(Rescue.differs(backup, same), false);
  assert.equal(Rescue.differs(backup, spaced), false);
  assert.equal(Rescue.differs(backup, null), true);
  assert.equal(Rescue.differs(backup, ''), true);
  assert.equal(Rescue.differs(backup, '{'), true);
  assert.equal(Rescue.differs(backup, '[]'), true);
  assert.equal(Rescue.differs(backup, 'null'), true);
  assert.equal(Rescue.differs(backup, JSON.stringify({ hunger: 60, fish: 8, own: { bed: 1, rug: 0, lamp: 1 }, t: 1000 })), true);
  assert.equal(Rescue.differs({ hunger: 1, life: { t: 1 }, t: 5 }, JSON.stringify({ hunger: 1, life: { t: 2 }, t: 9 })), true);
  const untouched = { hunger: 1, fish: 2, t: 3 };
  Rescue.differs(untouched, '{"hunger":9}');
  assert.deepEqual(untouched, { hunger: 1, fish: 2, t: 3 });
  const cycle = { hunger: 1 };
  cycle.self = cycle;
  assert.equal(Rescue.differs(cycle, '{"hunger":1}'), true);
});

test('shouldShow is read-only and only true for a usable backup that differs from the current save', () => {
  const sameBackup = house(61, { t: 10 });
  const sameCurrent = house(61, { t: 99 });
  const hidden = load({ 'naituan-house-v1-backup': sameBackup, 'naituan-house-v1': sameCurrent });
  assert.equal(hidden.Rescue.shouldShow(), false);
  assert.deepEqual(hidden.writes, []);

  const shown = load({ 'naituan-house-v1-backup': house(61, { fish: 8 }), 'naituan-house-v1': house(10, { fish: 1 }) });
  assert.equal(shown.Rescue.shouldShow(), true);
  assert.deepEqual(shown.writes, []);

  const missingCurrent = load({ 'naituan-house-v1-backup': '{"hunger":12,"fish":4}' });
  assert.equal(missingCurrent.Rescue.shouldShow(), true);
  assert.equal(missingCurrent.map.has('naituan-house-v1-before-restore'), false);

  const corruptCurrent = load({ 'naituan-house-v1-backup': '{"hunger":12}', 'naituan-house-v1': '{' });
  assert.equal(corruptCurrent.Rescue.shouldShow(), true);

  for (const raw of ['', '{', '[]', '{"hunger":"3"}', '{"hunger":null}']) {
    assert.equal(load({ 'naituan-house-v1-backup': raw, 'naituan-house-v1': house(1) }).Rescue.shouldShow(), false, raw);
  }
  assert.equal(load({}).Rescue.shouldShow(), false);

  const thrown = load({ 'naituan-house-v1-backup': '{"hunger":12,"fish":1}' }, { throwGet: new Set(['naituan-house-v1']) });
  assert.equal(thrown.Rescue.shouldShow(), true);
  assert.deepEqual(thrown.writes, []);
});

test('restore snapshots the current save, then applies it only through NT.restoreState', () => {
  const backup = JSON.stringify({ hunger: 40, fish: 7.8, own: { bed: 1, lamp: 0, desk: 1 }, t: 100 });
  const current = JSON.stringify({ hunger: 10, fish: 1, t: 200 });
  const next = JSON.stringify({ hunger: 40, fish: 7, own: { bed: 1, desk: 1 }, t: 999, migrated: true });
  const { Rescue, map, writes, calls } = load({
    'naituan-house-v1': current,
    'naituan-house-v1-backup': backup
  }, { nextKey: next });
  const result = Rescue.restore();
  assert.equal(result.ok, true);
  assert.equal(result.message, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hunger, 40);
  assert.equal(calls[0].fish, 7.8);
  assert.equal(calls[0].t, 100);
  assert.deepEqual(writes, ['naituan-house-v1-before-restore', 'naituan-house-v1-backup']);
  assert.equal(map.get('naituan-house-v1-before-restore'), current);
  assert.equal(map.get('naituan-house-v1'), next);
  assert.equal(map.get('naituan-house-v1-backup'), next);
  assert.equal(Rescue.shouldShow(), false);
});

test('a failed restore leaves the current save and backup in place', () => {
  const backup = '{"hunger":40,"fish":7,"t":100}';
  const current = '{"hunger":10,"fish":1,"t":200}';
  const { Rescue, map, writes, calls } = load({
    'naituan-house-v1': current,
    'naituan-house-v1-backup': backup
  }, { restore: false });
  const result = Rescue.restore();
  assert.equal(result.ok, false);
  assert.equal(result.message, '这次没能找回，现在的进度还在。');
  assert.equal(calls.length, 1);
  assert.deepEqual(writes, ['naituan-house-v1-before-restore']);
  assert.equal(map.get('naituan-house-v1'), current);
  assert.equal(map.get('naituan-house-v1-backup'), backup);
  assert.equal(map.get('naituan-house-v1-before-restore'), current);
});

test('restore aborts before touching memory when the safety snapshot cannot be written', () => {
  const backup = '{"hunger":40,"fish":2,"t":1}';
  const current = '{"hunger":3,"fish":1,"t":2}';
  const stored = {
    'naituan-house-v1': current,
    'naituan-house-v1-backup': backup
  };
  const quota = load(stored, { throwSet: new Set(['naituan-house-v1-before-restore']) });
  assert.doesNotThrow(() => quota.Rescue.restore());
  const quotaResult = quota.Rescue.restore();
  assert.equal(quotaResult.ok, false);
  assert.equal(quotaResult.message, '现在的进度暂时收不起来，没有改动。');
  assert.equal(quota.calls.length, 0);
  assert.deepEqual(quota.writes, []);
  assert.equal(quota.map.get('naituan-house-v1'), current);
  assert.equal(quota.map.get('naituan-house-v1-backup'), backup);
  assert.equal(quota.map.has('naituan-house-v1-before-restore'), false);

  const denied = load(stored, { throwGet: new Set(['naituan-house-v1']) });
  const deniedResult = denied.Rescue.restore();
  assert.equal(deniedResult.ok, false);
  assert.equal(deniedResult.message, '现在的进度暂时收不起来，没有改动。');
  assert.equal(denied.calls.length, 0);
  assert.deepEqual(denied.writes, []);
  assert.equal(denied.map.get('naituan-house-v1-backup'), backup);
});

test('restore refuses an invalid backup, a busy game, and a throwing restoreState without dropping the backup', () => {
  const backup = '{"hunger":40,"fish":2,"t":1}';
  const current = '{"hunger":3,"t":2}';
  const none = load({ 'naituan-house-v1': current });
  const noneResult = none.Rescue.restore();
  assert.equal(noneResult.ok, false);
  assert.equal(noneResult.message, '这份备份暂时读不了，先不用找了。');
  assert.deepEqual(none.writes, []);
  assert.equal(none.map.has('naituan-house-v1-before-restore'), false);

  const bad = load({ 'naituan-house-v1': current, 'naituan-house-v1-backup': '{' });
  assert.equal(bad.Rescue.restore().ok, false);
  assert.equal(bad.calls.length, 0);
  assert.equal(bad.map.get('naituan-house-v1'), current);

  const busy = load({ 'naituan-house-v1': current, 'naituan-house-v1-backup': backup }, { busy: true });
  const busyResult = busy.Rescue.restore();
  assert.equal(busyResult.ok, false);
  assert.equal(busyResult.message, '先把小游戏玩完，再来找回存档。');
  assert.equal(busy.calls.length, 0);
  assert.deepEqual(busy.writes, []);
  assert.equal(busy.map.get('naituan-house-v1-backup'), backup);

  const exploded = load({ 'naituan-house-v1': current, 'naituan-house-v1-backup': backup }, { restoreThrows: true });
  assert.equal(exploded.Rescue.restore().ok, false);
  assert.equal(exploded.Rescue.restore().message, '这次没能找回，现在的进度还在。');
  assert.equal(exploded.map.get('naituan-house-v1'), current);
  assert.equal(exploded.map.get('naituan-house-v1-backup'), backup);

  const missingApi = load({ 'naituan-house-v1': current, 'naituan-house-v1-backup': backup }, { noRestore: true });
  assert.equal(missingApi.Rescue.restore().ok, false);
  assert.deepEqual(missingApi.writes, []);
});

test('a backup write after a successful restore is best-effort', () => {
  const backup = '{"hunger":40,"fish":2,"t":1}';
  const current = '{"hunger":3,"t":2}';
  const next = '{"hunger":40,"fish":2,"t":999}';
  const { Rescue, map, writes, calls } = load({
    'naituan-house-v1': current,
    'naituan-house-v1-backup': backup
  }, { nextKey: next, throwSet: new Set(['naituan-house-v1-backup']) });
  const result = Rescue.restore();
  assert.equal(result.ok, true);
  assert.equal(result.message, undefined);
  assert.equal(calls.length, 1);
  assert.deepEqual(writes, ['naituan-house-v1-before-restore']);
  assert.equal(map.get('naituan-house-v1'), next);
  assert.equal(map.get('naituan-house-v1-backup'), backup);
  assert.equal(map.get('naituan-house-v1-before-restore'), current);
});

test('profile markup offers the rescue row only as a hidden button wired through rescue.js', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const house = fs.readFileSync(path.join(root, 'house.js'), 'utf8');
  const row = html.match(/<button id="profileSave"[\s\S]*?<\/button>\s*(<button id="profileRescue"[\s\S]*?<\/button>)/);
  assert.ok(row);
  assert.match(row[1], /class="journal-profile-row"/);
  assert.match(row[1], /\shidden[\s>]/);
  assert.match(row[1], /#i-book/);
  assert.match(row[1], /找回上次的存档/);
  const gameAt = html.indexOf('src="game.js?');
  const rescueAt = html.indexOf('src="rescue.js?v=rescue-20261031-v1"');
  const houseAt = html.indexOf('src="house.js?v=rescue-20261031-v1"');
  assert.ok(gameAt > 0 && rescueAt > gameAt && houseAt > rescueAt);
  assert.equal(html.includes('house.js?v=acc-20261004'), false);
  assert.match(house, /NaituanRescue\.shouldShow\(\)/);
  assert.match(house, /Rescue\.restore\(\)/);
  assert.match(house, /用这份存档替换现在的进度？现在的进度会先收好，还能再找回来。/);
  assert.match(house, /NT\.say\('找回来啦！', 3200\)/);
  assert.match(house, /notify\('上次的存档找回来啦。'\)/);
  assert.match(house, /syncRescue\(\)/);
});
