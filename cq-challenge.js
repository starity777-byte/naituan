/* Fresh, solvable cake queues. No DOM, storage, network, or dependency. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NTCQChallenge = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function randomSource(seed) {
    let word = 2166136261;
    const input = String(seed == null ? `${Date.now()}-${Math.random()}` : seed);
    for (let i = 0; i < input.length; i++) word = Math.imul(word ^ input.charCodeAt(i), 16777619);
    return function () {
      word = (word + 0x6D2B79F5) | 0;
      let value = Math.imul(word ^ word >>> 15, 1 | word);
      value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(rows, random) {
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows;
  }
  function fullSame(lane, cap) {
    return lane.length === cap && lane.every(k => k === lane[0]);
  }
  function advance(state, caps, cap, a, b) {
    if (a === b || !state[a].length || state[b].length >= caps[b] ||
      (state[b].length && state[a][0] !== state[b][0])) return null;
    const next = state.slice();
    next[a] = state[a].slice(1);
    next[b] = [state[a][0], ...state[b]];
    if (fullSame(next[b], cap)) next[b] = [];
    return next;
  }
  function trimRoute(lanes, caps, cap, route) {
    let state = lanes, states = [state], answer = [];
    const positions = new Map([[JSON.stringify(state), 0]]);
    for (const move of route) {
      state = advance(state, caps, cap, move[0], move[1]);
      if (!state) throw new Error('Reverse generator produced an illegal move');
      const key = JSON.stringify(state);
      if (positions.has(key)) {
        const index = positions.get(key);
        for (let i = index + 1; i < states.length; i++) positions.delete(JSON.stringify(states[i]));
        states.length = index + 1;
        answer.length = index;
      } else {
        answer.push(move);
        states.push(state);
        positions.set(key, answer.length);
      }
    }
    return answer;
  }
  function scramble(kinds, caps, cap, extra, random) {
    const lanes = caps.map(() => []), reverse = [];
    function destinations(b) {
      return lanes.map((row, a) => ({ a, rank: random() ** (1 / (1 + row.length * 3)) }))
        .filter(({ a }) => a !== b && lanes[a].length < caps[a])
        .sort((x, y) => y.rank - x.rank).map(value => value.a);
    }
    function push(b, a) {
      lanes[a].unshift(lanes[b].shift());
      reverse.push([b, a]);
    }
    function backwardsMove() {
      const sources = shuffle(lanes.map((lane, i) => i).filter(i => lanes[i].length &&
        (lanes[i].length === 1 || lanes[i][1] === lanes[i][0])), random);
      for (const b of sources) {
        for (const a of destinations(b)) {
          if (!lanes[a].length && lanes[b].length === 1) continue;
          if (lanes[a].length === cap - 1 && lanes[a].every(k => k === lanes[b][0])) continue;
          push(b, a);
          return true;
        }
      }
      return false;
    }
    for (const kind of shuffle(kinds.slice(), random)) {
      const empty = lanes.map((lane, i) => i).filter(i => !lanes[i].length && caps[i] >= cap);
      if (!empty.length) return null;
      const e = empty[Math.floor(random() * empty.length)];
      lanes[e] = Array(cap).fill(kind);
      const destinationsForGroup = destinations(e);
      if (!destinationsForGroup.length) return null;
      push(e, destinationsForGroup[0]);
      if (fullSame(lanes[destinationsForGroup[0]], cap)) return null;
      const count = 2 + Math.floor(random() * (extra - 1));
      for (let i = 0; i < count; i++) backwardsMove();
    }
    for (let i = 0; i < extra * 2; i++) backwardsMove();
    if (lanes.some(lane => fullSame(lane, cap))) return null;
    const route = trimRoute(lanes, caps, cap, reverse.reverse().map(([b, a]) => [a, b]));
    return { lanes, route };
  }
  function lowerBound(state, cap) {
    const totals = new Map(), runs = new Map();
    for (const lane of state) {
      for (const kind of lane) totals.set(kind, (totals.get(kind) || 0) + 1);
      if (!lane.length) continue;
      const kind = lane[lane.length - 1];
      let length = 1;
      while (length < lane.length && lane[lane.length - length - 1] === kind) length++;
      if (!runs.has(kind)) runs.set(kind, []);
      runs.get(kind).push(length);
    }
    let sum = 0;
    for (const [kind, total] of totals) {
      const tails = (runs.get(kind) || []).sort((a, b) => b - a);
      sum += total - tails.slice(0, total / cap).reduce((a, b) => a + b, 0);
    }
    return sum;
  }
  function stateKey(state, caps) {
    return state.map((row, i) => `${caps[i]}:${row.join(',')}`).sort().join('|');
  }
  class Heap {
    constructor() { this.items = []; }
    push(value) {
      const values = this.items;
      let i = values.length;
      values.push(value);
      while (i) {
        const p = (i - 1) >> 1;
        if (values[p].rank <= value.rank) break;
        values[i] = values[p]; i = p;
      }
      values[i] = value;
    }
    pop() {
      const values = this.items, first = values[0], last = values.pop();
      if (values.length) {
        let i = 0;
        while (i * 2 + 1 < values.length) {
          let child = i * 2 + 1;
          if (child + 1 < values.length && values[child + 1].rank < values[child].rank) child++;
          if (last.rank <= values[child].rank) break;
          values[i] = values[child]; i = child;
        }
        values[i] = last;
      }
      return first;
    }
  }
  function shorten(lanes, caps, cap, known, budget) {
    const heap = new Heap(), seen = new Map();
    heap.push({ rank: lowerBound(lanes, cap) * 2.4, state: lanes, path: [] });
    seen.set(stateKey(lanes, caps), 0);
    let nodes = 0;
    while (heap.items.length && nodes < budget) {
      const current = heap.pop(), depth = current.path.length;
      if (!current.state.some(row => row.length)) return current.path;
      if (depth !== seen.get(stateKey(current.state, caps))) continue;
      nodes++;
      for (let a = 0; a < current.state.length; a++) {
        if (!current.state[a].length) continue;
        for (let b = 0; b < current.state.length; b++) {
          if (!current.state[b].length && current.state[a].length === 1) continue;
          const state = advance(current.state, caps, cap, a, b);
          if (!state) continue;
          const nextDepth = depth + 1, lower = lowerBound(state, cap);
          if (nextDepth + lower >= known.length) continue;
          const key = stateKey(state, caps);
          if (nextDepth >= (seen.get(key) ?? Infinity)) continue;
          seen.set(key, nextDepth);
          heap.push({ rank: nextDepth + lower * 2.4, state, path: [...current.path, [a, b]] });
        }
      }
    }
    return known;
  }
  function difficulty(lanes, cap, route) {
    let changes = 0;
    for (const lane of lanes) for (let i = 1; i < lane.length; i++) changes += lane[i] !== lane[i - 1];
    return lowerBound(lanes, cap) * 3 + changes * 4 + route.length;
  }
  function create(round, seed) {
    round = Math.max(1, Math.floor(Number(round) || 1));
    const random = randomSource(seed), cap = 5;
    const groups = round < 4 ? 10 : round < 8 ? 11 : round < 15 ? 12 : 13;
    const kinds = shuffle(Array.from({ length: 19 }, (_, i) => i), random).slice(0, Math.min(groups, 12));
    const caps = Array(groups).fill(cap).concat(round < 4 ? [2] : [1]);
    const groupKinds = kinds.concat(groups > kinds.length ? [kinds[Math.floor(random() * kinds.length)]] : []);
    const candidates = [];
    // Sampling and a bounded search keep generation small even at round 1000.
    const extra = 30 + Math.min(round, 24) * 2;
    for (let attempt = 0; attempt < 28; attempt++) {
      const candidate = scramble(groupKinds, caps, cap, extra, random);
      if (candidate) {
        candidate.score = difficulty(candidate.lanes, cap, candidate.route);
        candidates.push(candidate);
      }
    }
    if (!candidates.length) {
      // The same legal reverse process with gentler mixing is a reliable fallback.
      for (let attempt = 0; attempt < 120 && !candidates.length; attempt++) {
        const candidate = scramble(groupKinds, caps, cap, 8, random);
        if (candidate) candidates.push(candidate);
      }
    }
    if (!candidates.length) throw new Error('Could not generate a cake challenge');
    candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
    let picked = null, best = -Infinity;
    for (const candidate of candidates.slice(0, 3)) {
      const route = shorten(candidate.lanes, caps, cap, candidate.route, 650);
      const score = difficulty(candidate.lanes, cap, route);
      if (score > best) { best = score; picked = { lanes: candidate.lanes, route }; }
    }
    return {
      name: `营业挑战 · 第 ${round} 轮`, cap, caps, kinds, revealDepth: 1, blindTail: 0,
      variants: [{ lanes: picked.lanes, par: picked.route.length, exact: false, limit: null }],
      route: picked.route,
    };
  }
  function rules(round, mode, par) {
    round = Math.max(1, Math.floor(Number(round) || 1));
    par = Math.max(1, Math.ceil(Number(par) || 1));
    const pressure = Math.min(1, (round - 1) / 39);
    return {
      stepLimit: Math.max(par, Math.ceil(par * (1.65 - pressure * .53))),
      timeLimit: mode === 'timed' ? Math.max(90, 180 - Math.floor((round - 1) * 2.4)) : null,
      reward: 24 + round * 8,
      star3: Math.ceil(par * (1.20 - pressure * .15)),
      star2: Math.ceil(par * (1.40 - pressure * .28)),
    };
  }
  return { create, rules };
});
