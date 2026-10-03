#!/usr/bin/env python3
"""Rebuild the harder cake-shop levels 21–40, preserving the first twenty.

Every board comes with a replayed solution. A bounded weighted search shortens
that route when practical; `par` is explicitly a reference, not an optimum.
Run with Python 3; no compiler or external package is required.
"""
import collections
import heapq
import importlib.util
import json
import pathlib
import random

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
spec = importlib.util.spec_from_file_location('cake_generator', HERE / 'gen_levels.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def canonical(state, caps):
    rows = sorted(zip(caps, state))
    mapping = {}
    renamed = []
    for cap, lane in rows:
        row = []
        for kind in lane:
            if kind not in mapping:
                mapping[kind] = len(mapping) + 1
            row.append(mapping[kind])
        renamed.append((cap, tuple(row)))
    return tuple(sorted(renamed))


def heuristic(state, cap):
    totals, runs = collections.Counter(), collections.defaultdict(list)
    for lane in state:
        totals.update(lane)
        if lane:
            count = 1
            while count < len(lane) and lane[-count - 1] == lane[-1]:
                count += 1
            runs[lane[-1]].append(count)
    return sum(n - sum(sorted(runs[k], reverse=True)[:n // cap]) for k, n in totals.items())


def shorten(lanes, caps, cap, known, max_nodes=1800):
    start = tuple(map(tuple, lanes))
    serial = 0
    queue = [(heuristic(start, cap) * 2, 0, serial, start, ())]
    seen = {canonical(start, caps): 0}
    nodes = 0
    while queue and nodes < max_nodes:
        _, depth, _, state, path = heapq.heappop(queue)
        if not any(state):
            return list(path), nodes
        if depth != seen.get(canonical(state, caps)):
            continue
        nodes += 1
        for a, source in enumerate(state):
            if not source:
                continue
            for b, target in enumerate(state):
                if a == b or len(target) >= caps[b] or (target and target[0] != source[0]):
                    continue
                if not target and len(source) == 1:
                    continue
                rows = list(state)
                rows[a] = source[1:]
                rows[b] = (source[0],) + target
                if len(rows[b]) == cap and len(set(rows[b])) == 1:
                    rows[b] = ()
                child = tuple(rows)
                distance = depth + 1
                h = heuristic(child, cap)
                if distance + h >= len(known):
                    continue
                key = canonical(child, caps)
                if distance >= seen.get(key, 10 ** 9):
                    continue
                seen[key] = distance
                serial += 1
                heapq.heappush(queue, (distance + h * 2, distance, serial, child, path + ((a, b),)))
    return known, nodes


def trim_route(lanes, caps, cap, route):
    """Erase loops from the certified route, including redundant back-and-forth."""
    state = tuple(map(tuple, lanes))
    states, route_out, positions = [state], [], {state: 0}
    for a, b in route:
        rows = list(state)
        rows[a], rows[b] = rows[a][1:], (rows[a][0],) + rows[b]
        if len(rows[b]) == cap and len(set(rows[b])) == 1:
            rows[b] = ()
        state = tuple(rows)
        if state in positions:
            end = positions[state]
            for old in states[end + 1:]:
                positions.pop(old, None)
            states, route_out = states[:end + 1], route_out[:end]
        else:
            route_out.append((a, b))
            states.append(state)
            positions[state] = len(route_out)
    return route_out


NAMES = [
    '纸袋里的新朋友', '谁在后面呀', '轻轻揭开纸袋', '陌生的小耳朵', '第一次猜队伍',
    '交错的长队', '留一个转身的位置', '藏在队尾的猫', '先腾哪一队', '短队也有用',
    '两边都要照顾', '绕个小弯', '新朋友排排站', '队首的秘密', '打烊前的谜题',
    '只看得见第一只', '一步之后再一步', '借来的小空位', '深深的队伍', '先后有讲究',
    '纸袋大聚会', '窄门前的长队', '腾挪的小高手', '最后一个周转位', '奶团的压轴题',
]


def main():
    text = (ROOT / 'levels.js').read_text(encoding='utf-8-sig')
    previous = json.loads(text[text.index('['):text.rindex(']') + 1])
    original_routes = json.loads((HERE / 'challenge-solutions.json').read_text(encoding='utf-8'))
    if len(previous) < 20 or len(original_routes) < 5:
        raise ValueError('Keep the existing first twenty levels and their five introductory solution sets before rebuilding.')
    rng = random.Random(2026100319)
    generated, solutions = [], original_routes[:5]
    for number in range(21, 41):
        cap = 5
        groups = 9 if number < 24 else 10 if number < 27 else 11 if number < 30 else 12 if number < 35 else 13
        caps = [cap] * groups + [2 if number < 25 else 1]
        # Every face gets its own full group. The final boards add a thirteenth
        # group, but still have at most twelve distinct cats and fourteen queues.
        cast = rng.sample(list(range(19)), min(groups, 12))
        pool = list(range(1, len(cast) + 1))
        base.CAP = cap
        candidates, seen = [], set()
        extra = 48 + (number - 21) * 3
        for _ in range(450 if number < 30 else 1100):
            kinds = pool + [rng.choice(pool) for _ in range(groups - len(pool))]
            result = base.scramble(kinds, caps, extra, rng)
            if not result:
                continue
            lanes, route = result
            key = tuple(map(tuple, lanes))
            if key in seen or any(base.full_same(lane) for lane in lanes):
                continue
            seen.add(key)
            route = trim_route(lanes, caps, cap, route)
            assert base.replay(lanes, caps, route)
            changes = sum(sum(a != b for a, b in zip(lane, lane[1:])) for lane in lanes)
            scattered = sum(len({i for i, lane in enumerate(lanes) if kind in lane}) for kind in pool)
            lower = heuristic(tuple(map(tuple, lanes)), cap)
            candidates.append((changes * 4 + lower * 3 + scattered, lanes, route, changes, lower))
        if len(candidates) < 3:
            raise RuntimeError(f'Level {number}: insufficient distinct solvable boards')
        candidates.sort(key=lambda value: value[0], reverse=True)
        evaluated = []
        # Rank by a solved, shortened route rather than the raw reverse walk.
        # A bounded search that cannot finish is not a difficulty certificate.
        for score, lanes, known, changes, lower in candidates[:55]:
            route, nodes = shorten(lanes, caps, cap, known, max_nodes=2400)
            if nodes >= 2400:
                continue
            route = trim_route(lanes, caps, cap, route)
            assert base.replay(lanes, caps, route)
            evaluated.append((len(route) * 5 + score, lanes, route, lower, changes))
        evaluated.sort(key=lambda value: value[0], reverse=True)
        if len(evaluated) < 3:
            raise RuntimeError(f'Level {number}: fewer than three short solved routes')
        variants, routes = [], []
        for score, lanes, route, lower, changes in evaluated[:3]:
            variants.append({'par': len(route), 'exact': False, 'limit': None,
                             'lanes': [[cast[k - 1] for k in lane] for lane in lanes]})
            routes.append(route)
        level = {'name': NAMES[number - 16], 'cap': cap, 'caps': caps, 'kinds': cast,
                 'revealDepth': 2 if number < 30 else 1, 'blindTail': 0,
                 'variants': variants}
        generated.append(level)
        solutions.append(routes)
        print(f'Level {number}: {len(caps)} lanes / {len(cast)} species / {groups*cap} cats; routes {[len(p) for p in routes]}', flush=True)
    # Order equal-size boards by their shortened reference difficulty. The
    # capacity / visibility milestones stay in their original positions.
    grouped = collections.defaultdict(list)
    for level, routes in zip(generated, solutions[5:]):
        grouped[tuple(level['caps'])].append((level, routes))
    for bucket in grouped.values():
        bucket.sort(key=lambda pair: sum(v['par'] for v in pair[0]['variants']))
    ordered, ordered_routes = [], []
    for offset, level in enumerate(generated):
        item, routes = grouped[tuple(level['caps'])].pop(0)
        item['name'] = NAMES[offset + 5]
        ordered.append(item)
        ordered_routes.append(routes)
    generated, solutions = ordered, original_routes[:5] + ordered_routes
    # Keep the first twenty objects and their exact original formatting.
    decoder = json.JSONDecoder()
    cursor = text.index('[', text.index('window.NT_LEVELS')) + 1
    for _ in range(20):
        while text[cursor].isspace() or text[cursor] == ',':
            cursor += 1
        _, cursor = decoder.raw_decode(text, cursor)
    rows = []
    for level in generated:
        heading = json.dumps({k: v for k, v in level.items() if k != 'variants'},
                             ensure_ascii=False, separators=(',', ':'))[:-1]
        variants = ',\n'.join('    ' + json.dumps(v, separators=(',', ':')) for v in level['variants'])
        rows.append(' ' + heading + ',"variants":[\n' + variants + ']}')
    output = text[:cursor] + ',\n' + ',\n'.join(rows) + '\n];\n'
    (ROOT / 'levels.js').write_bytes(output.encode('utf-8'))
    (HERE / 'challenge-solutions.json').write_text(json.dumps(solutions, separators=(',', ':')), encoding='utf-8')
    print('Rebuilt 20 harder levels; all 75 new layouts retain certified solutions.', flush=True)


if __name__ == '__main__':
    main()
