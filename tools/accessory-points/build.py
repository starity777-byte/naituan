"""Build accessory-slots.js from the head-point marks.

track.json   the program's first guess: five head points for every frame of every pose
             (plus the frame grid of assets/sheets/<pose>.webp and each frame's duration).
marks/*.json Lynix's corrections from the 奶团点位标注 page: keyframes, cuts and the fill mode
             of each segment, one file per pose.

Between keyframes the correction is spread smoothly, never across a cut. In "follow" segments
the program's motion is kept and only the correction is blended; in "keys" segments the points
are drawn straight between Lynix's keyframes.

Each frame gets the five points plus a rotation and scale, measured against Lynix's own
marks on the first frame of the sitting pose, so an accessory turns and grows with the head.

Run:  python3 tools/accessory-points/build.py
"""
import glob
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TRACK = json.load(open(os.path.join(HERE, 'track.json'), encoding='utf-8'))
MARKS = {os.path.basename(f)[:-5]: json.load(open(f, encoding='utf-8'))
         for f in glob.glob(os.path.join(HERE, 'marks', '*.json'))}


def edits(pose):
    return MARKS.get(pose['key'], {'cuts': pose['cuts'], 'modes': {}, 'keys': {}})


def segment(e, f, n):
    start = max([0] + [c for c in e['cuts'] if c <= f])
    end = min([n - 1] + [c - 1 for c in e['cuts'] if c > f])
    return start, end


def point(pose, f, k):
    e = edits(pose)
    auto = pose['auto'][f][k]
    start, end = segment(e, f, pose['n'])
    mode = e.get('modes', {}).get(str(start), 'follow')
    keys = [i for i in range(start, end + 1) if str(k + 1) in e['keys'].get(str(i), {})]
    if not keys:
        return list(auto)

    def value(i):
        v = e['keys'][str(i)][str(k + 1)]
        if mode == 'keys':
            return v
        return [v[0] - pose['auto'][i][k][0], v[1] - pose['auto'][i][k][1]]

    lo = max([i for i in keys if i <= f], default=None)
    hi = min([i for i in keys if i >= f], default=None)
    if lo is None:
        v = value(hi)
    elif hi is None or lo == hi:
        v = value(lo)
    else:
        w = (f - lo) / (hi - lo)
        a, b = value(lo), value(hi)
        v = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
    return v if mode == 'keys' else [auto[0] + v[0], auto[1] + v[1]]


def similarity(src, dst):
    """Rotation (degrees) and scale of the best-fitting turn-and-grow from src to dst."""
    n = len(src)
    sx = sum(p[0] for p in src) / n; sy = sum(p[1] for p in src) / n
    dx = sum(p[0] for p in dst) / n; dy = sum(p[1] for p in dst) / n
    den = c = s = 0.0
    for (ax, ay), (bx, by) in zip(src, dst):
        ax -= sx; ay -= sy; bx -= dx; by -= dy
        den += ax * ax + ay * ay
        c += ax * bx + ay * by
        s += ax * by - ay * bx
    c /= den; s /= den
    return math.degrees(math.atan2(s, c)), math.hypot(c, s)


def main():
    poses = {p['key']: p for p in TRACK['poses']}
    ref = [point(poses['sit'], 0, k) for k in range(5)]
    out = {'frame': TRACK['size'], 'poses': {}}
    for p in TRACK['poses']:
        frames = []
        for f in range(p['n']):
            pts = [point(p, f, k) for k in range(5)]
            rot, scale = similarity(ref, pts)
            frames.append([round(c, 1) for q in pts for c in q] + [round(rot, 1), round(scale, 3)])
        out['poses'][p['key']] = {'cols': p['cols'], 'ms': [max(20, int(m)) for m in p['ms']], 'f': frames}
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(ROOT, 'accessory-slots.js'), 'w', encoding='utf-8') as fh:
        fh.write('/* 由 tools/accessory-points/build.py 生成：每个动作每一帧头上 5 个点位的 x,y（共 10 个数），再加旋转角度和缩放。 */\n')
        fh.write('window.NT_ACC_SLOTS = ' + body + ';\n')
    print('wrote accessory-slots.js,', sum(len(v['f']) for v in out['poses'].values()), 'frames')


if __name__ == '__main__':
    main()
