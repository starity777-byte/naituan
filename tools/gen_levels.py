#!/usr/bin/env python3
"""关卡生成器：先摆好“通关状态”，再按规则倒着随机走若干步，保证有解；
再用 solver（A* 搜索）算出最少步数和搜索量，用它们给关卡分难度。

规则：只能动队首，只能放进空队或者同种猫的队首；一队凑齐同种猫就买走。
用法：
    g++ -O2 -std=c++17 -o solver solver.cpp
    python3 gen_levels.py [种子]        → 在上一层目录写出 levels.js，同时写 solutions.json（测试用的解法）
"""
import random, subprocess, os, sys, json

CAP = 3
HERE = os.path.dirname(os.path.abspath(__file__))
SOLVER = os.path.join(HERE, 'solver')


def solve(lanes, limit=1_500_000, weight=1.0):
    """返回 (步数, 展开的节点数)；步数 -1 表示超出搜索上限。
    weight=1 得到的是最少步数；weight>1 搜得更快，但只是“参考步数”。"""
    inp = f"{CAP} {len(lanes)}\n" + "\n".join(" ".join(map(str, l + [0] * (CAP - len(l)))) for l in lanes) + f"\n{limit} {weight}\n"
    r = subprocess.run([SOLVER], input=inp, capture_output=True, text=True)
    m = int(r.stdout.split()[0])
    nodes = int(r.stderr.split()[1]) if r.stderr.startswith('nodes') else limit
    return m, nodes


def full_same(l):
    return len(l) == CAP and len(set(l)) == 1


def scramble(kinds, nlanes, extra, rng):
    """倒着来：从空场开始，一组一组“反向买回”，每次先反向走一步，再随机打乱几步。
    lane[0] 是队首。kinds 是每一组猫的种类（可以重复）。
    返回 (开局, 从开局通关的一个解法[(从哪队, 到哪队)...])。"""
    lanes = [[] for _ in range(nlanes)]
    rev = []  # 倒着走的每一步：(从 b 拿走队首, 放到 a)

    def push(b, a):
        x = lanes[b].pop(0); lanes[a].insert(0, x); rev.append((b, a))

    def pick_dst(cands):
        # 偏爱已经有猫的队：把猫集中起来，才能留出空队给后面的组
        cands = sorted(cands, key=lambda i: -(rng.random() ** (1.0 / (1 + 3 * len(lanes[i])))))
        return cands

    def rand_move():
        """倒着走一步：从 b 的队首拿一只放到别的队（正着走就是它从那队回到 b）。
        正着走要求 b 里只能放进空队或者同种猫，所以倒着拿走这只以后，
        b 必须是空的，或者新队首还是同一种。"""
        srcs = [i for i, l in enumerate(lanes) if l and (len(l) == 1 or l[1] == l[0])]
        rng.shuffle(srcs)
        for b in srcs:
            for a in pick_dst([a for a, l in enumerate(lanes) if a != b and len(l) < CAP]):
                if not lanes[a] and len(lanes[b]) == 1:
                    continue  # 空队之间倒来倒去没意义
                x = lanes[b][0]
                lanes[a].insert(0, x); lanes[b].pop(0)
                if full_same(lanes[a]):
                    lanes[a].pop(0); lanes[b].insert(0, x); continue
                rev.append((b, a)); return True
        return False

    order = list(kinds); rng.shuffle(order)
    for k in order:
        empties = [i for i, l in enumerate(lanes) if not l]
        if not empties: return None
        e = rng.choice(empties); lanes[e] = [k] * CAP
        # 反向的“买走”：最后一步是有一只猫放到这队，把它拿走放到别的队
        dsts = [b for b, l in enumerate(lanes) if b != e and len(l) < CAP]
        if not dsts: return None
        a = pick_dst(dsts)[0]; push(e, a)
        if full_same(lanes[a]): return None
        for _ in range(rng.randint(2, extra)): rand_move()
    for _ in range(extra * 2): rand_move()
    fwd = [(a, b) for (b, a) in reversed(rev)]
    return lanes, fwd


def replay(lanes, moves):
    """按规则把解法走一遍，确认真的能通关。"""
    L = [list(l) for l in lanes]
    for a, b in moves:
        assert L[a] and len(L[b]) < CAP and (not L[b] or L[b][0] == L[a][0]), 'illegal'
        x = L[a].pop(0); L[b].insert(0, x)
        if full_same(L[b]): L[b] = []
    return all(not l for l in L)


# (关卡名, 每队几只, 几组猫, 队伍数, 打乱强度, 采样次数, 用哪几种猫[0-7])
# 越往后：猫越多、每队越长、空队越少（最后都只有 1 个空队）。
LEVELS = [
    ('小试身手',     3,  2,  3, 6,   60, [0, 1]),
    ('排排站',       3,  4,  5, 12, 120, [0, 1, 2, 3]),
    ('人多起来了',   4,  5,  6, 20, 200, [0, 1, 2, 3, 4]),
    ('只剩一个空位', 4,  6,  7, 30, 250, [0, 1, 2, 3, 4, 5]),
    ('加班的猫',     5,  6,  7, 40, 150, [0, 1, 2, 3, 4, 5]),
    ('打烊前的长队', 4,  8,  9, 30, 300, [0, 1, 2, 3, 4, 5, 6, 7]),
    ('排到街角',     5,  8,  9, 40, 100, [0, 1, 2, 3, 4, 5, 6, 7]),
    ('新品上架',     4,  9, 10, 40, 200, [0, 1, 2, 3, 4, 5, 6, 7]),
    ('最长的队',     5, 10, 11, 50,  80, [0, 1, 2, 3, 4, 5, 6, 7]),
    ('满街都是猫',   4, 11, 12, 50, 150, [0, 1, 2, 3, 4, 5, 6, 7]),
]
VARIANTS = 3


def main():
    global CAP
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    only = [int(x) for x in sys.argv[2:]] if len(sys.argv) > 2 else None
    rng = random.Random(seed)
    out, sols = [], []
    for li, (name, cap, groups, nl, extra, tries, cats) in enumerate(LEVELS):
        CAP = cap
        if only and li + 1 not in only:
            continue
        seen, cand = set(), []
        pool = list(range(1, len(cats) + 1))
        for _ in range(tries):
            kinds = pool[:groups] if groups <= len(pool) else pool + [rng.choice(pool) for _ in range(groups - len(pool))]
            if groups < len(pool): kinds = rng.sample(pool, groups)
            r = scramble(kinds, nl, extra, rng)
            if not r: continue
            lanes, fwd = r
            if any(full_same(l) for l in lanes): continue
            key = tuple(map(tuple, lanes))
            if key in seen: continue
            seen.add(key)
            assert replay(lanes, fwd), '生成的解法走不通'
            m, nodes = solve(lanes)
            exact = m > 0
            if not exact:  # 太大了：加权搜索，只能得到参考步数
                m, nodes = solve(lanes, 3_000_000, 2.5)
                if m < 0: continue
            m = min(m, len(fwd))
            cand.append((nodes, m, exact, lanes, fwd))
        cand.sort(key=lambda x: (-x[0], -x[1]))
        pick = cand[:VARIANTS]
        print(f'第{li+1}关 {name}: 候选 {len(cand)} 个，选中 步数 {[c[1] for c in pick]} 精确 {[c[2] for c in pick]} 搜索量 {[c[0] for c in pick]}', flush=True)
        vs = []
        for nodes, m, exact, lanes, fwd in pick:
            vs.append({'par': m, 'exact': exact, 'lanes': [[cats[k - 1] for k in l] for l in lanes], 'sol': fwd})
        out.append({'name': name, 'cap': cap, 'kinds': cats, 'lanes': nl, 'variants': vs})
    if only:
        print('只测试，不写文件'); return
    path = os.path.join(HERE, '..', 'levels.js')
    def lv(l):
        vs = ',\n    '.join('{"par":%d,"exact":%s,"lanes":%s}' % (v['par'], 'true' if v['exact'] else 'false', json.dumps(v['lanes'], separators=(',', ':'))) for v in l['variants'])
        return ' {"name":%s,"cap":%d,"kinds":%s,"lanes":%d,"variants":[\n    %s]}' % (json.dumps(l['name'], ensure_ascii=False), l['cap'], json.dumps(l['kinds']), l['lanes'], vs)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* 由 tools/gen_levels.py 生成：每关几个开局，par 是求解器算出的最少步数（exact 为 false 时是参考步数） */\n')
        f.write('window.NT_LEVELS = [\n' + ',\n'.join(lv(l) for l in out) + '\n];\n')
    with open(os.path.join(HERE, 'solutions.json'), 'w') as f:
        json.dump([[v['sol'] for v in l['variants']] for l in out], f)
    print('写入', os.path.abspath(path))


if __name__ == '__main__':
    main()
