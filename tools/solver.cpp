// 猫猫蛋糕求解器：A* 求最少步数。
// 输入：cap n 然后 n 行队伍（队首在前，0 表示空位，用空格分隔 cap 个数），最后一行 node_limit
// 输出：最少步数；超出节点上限输出 -1
#include <bits/stdc++.h>
using namespace std;
int CAP, N;
typedef vector<array<uint8_t,4>> State; // 每队最多 4 只；[0] 是队首
static string key(const State& s){
  vector<uint32_t> v; v.reserve(s.size());
  for(auto&l:s){ uint32_t x=0; for(int i=0;i<CAP;i++) x=x*9+l[i]; v.push_back(x);}  
  sort(v.begin(),v.end());
  return string((char*)v.data(), v.size()*4);
}
static State decode(const string& k){
  int n=k.size()/4; State s(n); const uint32_t* v=(const uint32_t*)k.data();
  for(int i=0;i<n;i++){ uint32_t x=v[i]; array<uint8_t,4> l={0,0,0,0}; for(int j=CAP-1;j>=0;j--){ l[j]=x%9; x/=9; } s[i]=l; }
  return s;
}
static int cnt(const array<uint8_t,4>&l){int c=0;for(int i=0;i<CAP;i++) if(l[i]) c++;return c;}
static int heur(const State& s){
  // 每种猫至少要有 (CAP - 它在某队“队尾连续同种”的最大长度) 只挪动过
  int best[10]={0}; bool present[10]={0};
  for(auto&l:s){
    int c=cnt(l); if(!c) continue; int last=l[c-1]; int r=0;
    for(int i=c-1;i>=0&&l[i]==last;i--) r++;
    present[last]=1; best[last]=max(best[last],r);
    for(int i=0;i<c;i++) present[l[i]]=1;
  }
  int h=0; for(int k=1;k<=9;k++) if(present[k]) h+=CAP-best[k];
  return h;
}
int main(int argc,char**argv){
  scanf("%d %d",&CAP,&N);
  State s(N);
  for(int i=0;i<N;i++){ s[i]={0,0,0,0}; for(int j=0;j<CAP;j++){int x;scanf("%d",&x);s[i][j]=x;} }
  long long limit; scanf("%lld",&limit);
  typedef pair<int,int> PI;
  unordered_map<string,int> g;
  priority_queue<tuple<int,int,string,int>,vector<tuple<int,int,string,int>>,greater<>> pq; vector<State> acts; unordered_map<string,tuple<string,int,int>> par;
  string k0=key(s); g[k0]=0; acts.push_back(s); pq.push({heur(s),0,k0,0});
  long long nodes=0;
  while(!pq.empty()){
    auto [f,d,k,ai]=pq.top(); pq.pop();
    if(g[k]!=d) continue;
    State cur=acts[ai];
    bool empty=true; for(auto&l:cur) if(l[0]) {empty=false;break;}
    if(empty){ printf("%d\n",d); if(argc>1){ vector<pair<int,int>> mv; string q=k; while(q!=k0){ auto&t=par[q]; mv.push_back({get<1>(t),get<2>(t)}); q=get<0>(t);} reverse(mv.begin(),mv.end()); for(auto&m:mv) printf("%d %d ",m.first,m.second); printf("\n"); } fprintf(stderr,"nodes %lld\n",nodes); return 0; }
    if(++nodes>limit){ printf("-1\n"); return 0; }
    for(int a=0;a<N;a++){
      if(!cur[a][0]) continue;
      for(int b=0;b<N;b++){
        if(a==b) continue;
        int cb=cnt(cur[b]); if(cb>=CAP) continue;
        // 空队之间的搬动没意义：若 a 只有这一只且 b 为空，跳过
        if(cb==0 && cnt(cur[a])==1) continue;
        State nx=cur; int x=nx[a][0];
        int ca=cnt(nx[a]);
        for(int i=0;i<CAP-1;i++) nx[a][i]=nx[a][i+1]; nx[a][CAP-1]=0;
        for(int i=CAP-1;i>0;i--) nx[b][i]=nx[b][i-1]; nx[b][0]=x;
        if(cb+1==CAP){ bool same=true; for(int i=0;i<CAP;i++) if(nx[b][i]!=x) same=false; if(same) for(int i=0;i<CAP;i++) nx[b][i]=0; }
        string nk=key(nx); int nd=d+1;
        auto it=g.find(nk); if(it!=g.end() && it->second<=nd) continue;
        g[nk]=nd; par[nk]={k,a,b}; acts.push_back(nx); pq.push({nd+heur(nx),nd,nk,(int)acts.size()-1});
      }
    }
  }
  printf("-1\n"); return 0;
}
