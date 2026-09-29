// 猫猫蛋糕求解器：A* 求最少步数。
// 规则：只能动队首，只能放进空队或者同种猫的队首；一队凑齐同种猫就买走。
// 输入：S n（S 是一组几只，n 是队伍数），然后 n 行队伍：先写这队最多放几只，再写队里的猫（队首在前，0 表示空位），
//       最后一行 节点上限 [权重]。每队的容量可以不一样（“短队”），容量 < S 的队永远凑不成一组，只能当中转站用。
// 输出：找到的步数（权重为 1 时就是最少步数；权重 > 1 是加速搜索，得到的是“参考步数”）；
//       超出节点上限输出 -1。搜索展开的节点数打印在 stderr（越多说明死路越多、越难）。
// 小技巧：猫的种类编号可以互换，所以每个状态先把队伍排序、把种类按出现顺序重新编号，能省掉大量重复搜索。
#include <bits/stdc++.h>
using namespace std;
const int MAXC = 6;
int CAP, N; // CAP 是一组几只
typedef array<uint8_t, MAXC + 1> Lane; // [MAXC] 存这队的容量
typedef vector<Lane> State;
static uint32_t code(const Lane& l) { uint32_t x = 0; for (int i = 0; i < MAXC; i++) x = x * 10 + l[i]; return x + (uint32_t)l[MAXC] * 1000000u; }
static void canon(State& s) {
  for (int it = 0; it < 3; it++) {
    sort(s.begin(), s.end(), [](const Lane& a, const Lane& b) { return code(a) < code(b); });
    int mp[10] = {0}, nx = 0;
    for (auto& l : s) for (int i = 0; i < MAXC; i++) if (l[i] && !mp[l[i]]) mp[l[i]] = ++nx;
    for (auto& l : s) for (int i = 0; i < MAXC; i++) if (l[i]) l[i] = mp[l[i]];
  }
  sort(s.begin(), s.end(), [](const Lane& a, const Lane& b) { return code(a) < code(b); });
}
static string key(const State& s) {
  string k; k.reserve(s.size() * 4);
  for (auto& l : s) { uint32_t x = code(l); k.append((const char*)&x, 4); }
  return k;
}
static State decode(const string& k) {
  int n = k.size() / 4; State s(n); const uint32_t* v = (const uint32_t*)k.data();
  for (int i = 0; i < n; i++) { uint32_t x = v[i]; Lane l; l.fill(0); l[MAXC] = x / 1000000u; x %= 1000000u; for (int j = MAXC - 1; j >= 0; j--) { l[j] = x % 10; x /= 10; } s[i] = l; }
  return s;
}
static int cnt(const Lane& l) { int c = 0; for (int i = 0; i < MAXC; i++) if (l[i]) c++; return c; }
// 启发函数：每种猫，至少有 (总数 - 最好的几队“队尾连续同种”长度之和) 只要动过
static int heur(const State& s) {
  int total[10] = {0}; vector<int> runs[10];
  for (auto& l : s) {
    int c = cnt(l); if (!c) continue;
    for (int i = 0; i < c; i++) total[l[i]]++;
    int last = l[c - 1], r = 0; for (int i = c - 1; i >= 0 && l[i] == last; i--) r++;
    runs[last].push_back(r);
  }
  int h = 0;
  for (int k = 1; k <= 9; k++) if (total[k]) {
    int g = total[k] / CAP; sort(runs[k].rbegin(), runs[k].rend());
    int sum = 0; for (int i = 0; i < g && i < (int)runs[k].size(); i++) sum += runs[k][i];
    h += total[k] - sum;
  }
  return h;
}
int main() {
  if (scanf("%d %d", &CAP, &N) != 2) return 1;
  State s(N);
  for (int i = 0; i < N; i++) { s[i].fill(0); int c; if (scanf("%d", &c) != 1) return 1; s[i][MAXC] = c; for (int j = 0; j < c; j++) { int x; if (scanf("%d", &x) != 1) return 1; s[i][j] = x; } }
  long long limit; double w = 1.0;
  if (scanf("%lld", &limit) != 1) return 1;
  if (scanf("%lf", &w) != 1) w = 1.0;
  canon(s);
  unordered_map<string, int> g;
  typedef tuple<double, int, string> Item;
  priority_queue<Item, vector<Item>, greater<Item>> pq;
  string k0 = key(s); g[k0] = 0; pq.push({w * heur(s), 0, k0});
  long long nodes = 0;
  while (!pq.empty()) {
    auto it = pq.top(); pq.pop();
    int nd0 = -get<1>(it); string k = get<2>(it);
    // 用 -d 做第二关键字（同样的 f 先走更深的）
    (void)nd0;
    int d = g[k];
    { State c = decode(k); bool empty = true; for (auto& l : c) if (l[0]) { empty = false; break; }
      if (empty) { printf("%d\n", d); fprintf(stderr, "nodes %lld\n", nodes); return 0; } }
    if (get<1>(it) != -d) continue;
    if (++nodes > limit) { printf("-1\n"); fprintf(stderr, "nodes %lld\n", nodes); return 0; }
    State cur = decode(k);
    for (int a = 0; a < N; a++) {
      if (!cur[a][0]) continue;
      for (int b = 0; b < N; b++) {
        if (a == b) continue;
        int cb = cnt(cur[b]); if (cb >= cur[b][MAXC]) continue;
        if (cb > 0 && cur[b][0] != cur[a][0]) continue;
        if (cb == 0 && cnt(cur[a]) == 1) continue;
        State nx = cur; int x = nx[a][0];
        for (int i = 0; i < MAXC - 1; i++) nx[a][i] = nx[a][i + 1]; nx[a][MAXC - 1] = 0;
        for (int i = MAXC - 1; i > 0; i--) nx[b][i] = nx[b][i - 1]; nx[b][0] = x;
        if (cb + 1 == CAP) { bool same = true; for (int i = 0; i < CAP; i++) if (nx[b][i] != x) same = false; if (same) for (int i = 0; i < CAP; i++) nx[b][i] = 0; }
        canon(nx);
        string nk = key(nx); int nd = d + 1;
        auto f = g.find(nk); if (f != g.end() && f->second <= nd) continue;
        g[nk] = nd; pq.push({nd + w * heur(nx), -nd, nk});
      }
    }
  }
  printf("-1\n"); return 0;
}
