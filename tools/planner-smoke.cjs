// Run with: node tools/planner-smoke.cjs. Exercises time accounting without waiting.
const assert = require('node:assert/strict');
const P = require('../planner-state.js');
const minute = 60000;
const at = new Date(2026, 8, 29, 10, 0).getTime();

let s = P.create();
P.start(s, { minutes: 25, taskId: 'read', title: '看书' }, at);
P.pause(s, at + 3 * minute);
assert.equal(P.elapsed(s.timer, at + 10 * minute), 3 * minute, 'paused time must not count');
P.resume(s, at + 10 * minute);
s = P.create(JSON.parse(JSON.stringify(s)));
assert.equal(P.elapsed(s.timer, at + 12 * minute), 5 * minute, 'reload restores the real remaining time');
P.finish(s, at + 12 * minute);
assert.equal(s.sessions[0].durationMs, 5 * minute);
assert.equal(s.sessions[0].completed, false);
assert.equal(s.sessions[0].taskId, 'read');
assert.equal(P.stats(s, '2026-09-29').ms, 5 * minute);
P.finish(s, at + 13 * minute);
assert.equal(s.sessions.length, 1, 'repeated finish cannot duplicate a record');

s = P.create();
P.start(s, { minutes: 25 }, at);
P.settle(s, at + 8 * 60 * minute);
assert.equal(s.sessions[0].durationMs, 25 * minute, 'background recovery stops at the planned end');
assert.equal(s.sessions[0].endedAt, at + 25 * minute);
P.settle(s, at + 9 * 60 * minute);
assert.equal(s.sessions.length, 1);

s = P.create();
const beforeMidnight = new Date(2026, 8, 29, 23, 50).getTime();
P.start(s, { minutes: 25 }, beforeMidnight);
P.settle(s, beforeMidnight + 30 * minute);
assert.equal(P.stats(s, '2026-09-29').ms, 10 * minute);
assert.equal(P.stats(s, '2026-09-30').ms, 15 * minute);

s = P.create();
P.start(s, { minutes: 15 }, beforeMidnight);
P.pause(s, beforeMidnight + 5 * minute);
P.resume(s, beforeMidnight + 30 * minute);
P.settle(s, beforeMidnight + 40 * minute);
assert.equal(P.stats(s, '2026-09-29').ms, 5 * minute);
assert.equal(P.stats(s, '2026-09-30').ms, 10 * minute, 'a pause across midnight is excluded');

const oldCount = s.sessions.length, oldTotal = P.totalMs(s);
P.start(s, { kind: 'break' }, at);
P.settle(s, at + 6 * minute);
assert.equal(s.sessions.length, oldCount, 'breaks do not create focus records');
assert.equal(P.totalMs(s), oldTotal);
assert.equal(s.result.kind, 'break');

s = P.create();
P.start(s, { minutes: 1 }, at);
P.finish(s, at + 15000);
assert.equal(s.sessions[0].durationMs, 15000, 'short focus retains seconds');
assert.equal(P.shift('2026-12-31', 1), '2027-01-01');
assert.equal(P.shift('2028-02-28', 1), '2028-02-29');
console.log('Planner smoke passed: pause/resume, reload, capped background completion, midnight split, single settlement, rest, short sessions and calendar boundaries.');
