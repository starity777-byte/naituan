#!/usr/bin/env python3
"""关卡生成器：先摆好“通关状态”，再倒着随机走若干步，保证有解；
再用 solver（A*）算出最少步数，用它给关卡分难度。

用法：python3 gen_levels.py  →  在上一层目录写出 levels.js
"""
import random, subprocess, os, sys, json

CAP = 3
HERE = os.path.dirname(os.path.abspath(__file__))
SOLVER = os.path.join(HERE, 'solver')

def solve(lanes, limit=3_000_000):
    inp = f"{CAP} {len(lanes)}\n" + "\n".join(" ".join(map(str, l + [0] * (CAP - len(l)))) for l in lanes) + f"\n{limit}\n"
    out = subprocess.run([SOLVER], input=inp, capture_output=True, text=True).stdout.strip()
    return int(out)

def full_same(l):
    return len(l) == CAP and len(set(l)) == 1

def scramble(kinds, nlanes, extra, rng):
    """倒着来：从空场开始，一组一组“反向买回”，每次先反向走一步，再随机打乱几步。
    lane[0] 是队首。"""
    lanes = [[] for _ in range(nlanes)]
    order = list(range(1, kinds + 1)); rng.shuffle(order)
    steps = 0
    def rand_move():
        srcs = [i for i, l in enumerate(lanes) if l]
        rng.shuffle(srcs)
        for a in srcs:
            dsts = [b for b, l in enumerate(lanes) if b != a and len(l) < CAP]
            rng.shuffle(dsts)
            for b in dsts:
                if not lanes[a] or (not lanes[b] and len(lanes[a]) == 1):
                    continue  # 空队之间倒来倒去没意义
                x = lanes[a].pop(0); lanes[b].insert(0, x)
                if full_same(lanes[b]) or full_same(lanes[a]):
                    lanes[b].pop(0); lanes[a].insert(0, x); continue
                return True
        return False
    for k in order:
        empties = [i for i, l in enumerate(lanes) if not l]
        if not empties: return None
        e = rng.choice(empties); lanes[e] = [k] * CAP
        # 反向的“买走”：队首那只是刚放上去的，把它拿走放到别的队首
        dsts = [b for b, l in enumerate(lanes) if b != e and len(l) < CAP]
        if not dsts: return None
        b = rng.choice(dsts); x = lanes[e].pop(0); lanes[b].insert(0, x); steps += 1
        if full_same(lanes[b]): return None
        for _ in range(rng.randint(2, extra)):
            if rand_move(): steps += 1
    for _ in range(extra * 2):
        if rand_move(): steps += 1
    return lanes, steps

# (关卡名, 每队几只, 猫种类, 队伍数, 打乱强度, 采样次数, 至少要多少最少步数, 用哪几种猫[0-7])
# 越往后：猫越多、空位越少、每队越长；第 5 关每队 4 只，最难。
LEVELS = [
    ('小试身手',     3, 2, 3, 6, 60, 4,  [0, 1]),
    ('排排站',       3, 3, 4, 12, 80, 7,  [0, 1, 2]),
    ('人多起来了',   3, 5, 6, 20, 120, 11, [0, 1, 2, 3, 4]),
    ('只剩一个空位', 3, 8, 9, 20, 150, 16, [0, 1, 2, 3, 4, 5, 6, 7]),
    ('打烊前的长队', 4, 7, 8, 30, 250, 21, [1, 2, 3, 4, 5, 6, 7]),
]
VARIANTS = 3

def main():
    global CAP
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    rng = random.Random(seed)
    out = []
    for li, (name, cap, kinds, nl, extra, tries, need, cats) in enumerate(LEVELS):
        CAP = cap
        seen, cand = set(), []
        for _ in range(tries):
            r = scramble(kinds, nl, extra, rng)
            if not r: continue
            lanes, up = r
            if any(full_same(l) for l in lanes): continue
            key = tuple(map(tuple, lanes))
            if key in seen: continue
            seen.add(key)
            m = solve(lanes, 3_000_000)
            if m > 0: cand.append((m, lanes))
        cand.sort(key=lambda x: -x[0])
        pick = [c for c in cand if c[0] >= need][:VARIANTS] or cand[:VARIANTS]
        print(f'第{li+1}关 {name}: 候选 {len(cand)} 个，最少步数 {[c[0] for c in pick]}', flush=True)
        vs = []
        for m, lanes in pick:
            vs.append({'par': m, 'lanes': [[cats[k - 1] for k in l] for l in lanes]})
        out.append({'name': name, 'cap': cap, 'kinds': cats, 'lanes': nl, 'variants': vs})
    path = os.path.join(HERE, '..', 'levels.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* 由 tools/gen_levels.py 生成：每关几个开局，par 是求解器算出的最少步数 */\n')
        def lv(l):
            vs = ',\n    '.join('{"par":%d,"lanes":%s}' % (v['par'], json.dumps(v['lanes'], separators=(',', ':'))) for v in l['variants'])
            return ' {"name":%s,"cap":%d,"kinds":%s,"lanes":%d,"variants":[\n    %s]}' % (json.dumps(l['name'], ensure_ascii=False), l['cap'], json.dumps(l['kinds']), l['lanes'], vs)
        f.write('window.NT_LEVELS = [\n' + ',\n'.join(lv(l) for l in out) + '\n];\n')
    print('写入', os.path.abspath(path))

if __name__ == '__main__':
    main()
