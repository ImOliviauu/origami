// 折纸几何引擎（纯函数，可 node 测试）
// 坐标：y 轴向上，点 {x,y}，直线标准式 {a,b,c}，ax+by+c=0，a²+b²=1
//
// Huzita–Justin 七公理：
//  O1 过两点折                  pp  -> 连线（1 解）
//  O2 点折到点                  pp  -> 垂直平分线（1 解）
//  O3 线折到线                  ll  -> 角平分线（2 解）
//  O4 过点折，使线落到自身       pl  -> 过点且垂直于线（1 解）
//  O5 点折到线，折痕过另一个点   plq -> 线∩圆（0/1/2 解）
//  O6 两点分别折到两条线         plpl-> 三次方程（0/1/2/3 解）
//  O7 点折到线 + 线折到自身      pll -> 唯一解（折痕 ⊥ 该线）

const EPS = 1e-9;
const TOL = 1e-4;

function P(x, y){ return { x, y }; }
function L(a, b, c){ const n = Math.hypot(a, b) || 1; return { a: a/n, b: b/n, c: c/n }; }
function lineThrough(p, q){ return L(q.y - p.y, p.x - q.x, -(q.y - p.y)*p.x - (p.x - q.x)*p.y); }

function interLines(l1, l2){
  const det = l1.a*l2.b - l2.a*l1.b;
  if (Math.abs(det) < 1e-10) return null;
  return { x:(l1.b*l2.c - l2.b*l1.c)/det, y:(l1.c*l2.a - l2.c*l1.a)/det };
}
function distPL(l, p){ return l.a*p.x + l.b*p.y + l.c; }
function samePt(a, b){ return Math.hypot(a.x-b.x, a.y-b.y) < 1e-7; }
function sameLine(l1, l2){
  const n1 = Math.hypot(l1.a,l1.b)||1, n2 = Math.hypot(l2.a,l2.b)||1;
  const a1=l1.a/n1, b1=l1.b/n1, c1=l1.c/n1;
  const a2=l2.a/n2, b2=l2.b/n2, c2=l2.c/n2;
  const s = (a1*a2 + b1*b2) >= 0 ? 1 : -1;
  return Math.abs(a1-s*a2)<TOL && Math.abs(b1-s*b2)<TOL && Math.abs(c1-s*c2)<TOL;
}

function reflect(l, p){ const d = distPL(l, p); return { x: p.x - 2*l.a*d, y: p.y - 2*l.b*d }; }

// 把直线化成唯一表示：单位法向，且 (a>0) 或 (a=0 且 b>0)
// 这样「两条角平分线/两条候选折痕」的顺序不依赖玩家点到的线是哪个符号方向
function canon(l){
  const n = Math.hypot(l.a, l.b) || 1;
  let a = l.a/n, b = l.b/n, c = l.c/n;
  if (a < -1e-12 || (Math.abs(a) <= 1e-12 && b < 0)){ a = -a; b = -b; c = -c; }
  return { a, b, c };
}
function project(l, p){ const d = distPL(l, p); return { x: p.x - l.a*d, y: p.y - l.b*d }; }

// 直线关于折痕的镜像
function reflectLine(c, m){
  const q0 = project(m, { x:0, y:0 });
  const dir = { x: m.b, y: -m.a };
  const q1 = { x: q0.x + dir.x, y: q0.y + dir.y };
  const r0 = reflect(c, q0), r1 = reflect(c, q1);
  if (Math.hypot(r0.x-r1.x, r0.y-r1.y) < 1e-9) return null;
  return lineThrough(r0, r1);
}

function addUnique(arr, f){
  for (const g of arr) if (sameLine(g, f)) return;
  arr.push(f);
}

// ---------- 各类折叠的解析解 ----------

// O1：过两点
function creaseThroughPoints(p, q){
  if (samePt(p, q)) return [];
  return [lineThrough(p, q)];
}

// O2：点折到点 —— 垂直平分线
function ppBisector(p, q){
  if (samePt(p, q)) return null;
  const mx=(p.x+q.x)/2, my=(p.y+q.y)/2, dx=q.x-p.x, dy=q.y-p.y;
  return L(dx, dy, -(dx*mx + dy*my));
}

// O3：线折到线 —— 两条角平分线
function angleBisectors(l1, l2){
  l1 = canon(l1); l2 = canon(l2);
  const out = [];
  addUnique(out, L(l1.a-l2.a, l1.b-l2.b, l1.c-l2.c));
  addUnique(out, L(l1.a+l2.a, l1.b+l2.b, l1.c+l2.c));
  return out;
}

// O4：过点折，使 l 落到自身 —— 过 p 且垂直于 l
function plPerp(p, l){ return L(l.b, -l.a, -(l.b*p.x - l.a*p.y)); }

// O5：把 p 折到 l 上，折痕必须经过 q
// 等价于：p 的镜像 p' ∈ l 且 |qp'| = |qp| —— 线 ∩ 圆，0/1/2 解
function o5Solver(p, l, q){
  l = canon(l);
  const r = Math.hypot(q.x-p.x, q.y-p.y);
  const d = distPL(l, q);
  const h2 = r*r - d*d;
  if (h2 < -1e-9) return [];
  const foot = project(l, q);
  const dir = { x: l.b, y: -l.a };
  const h = Math.sqrt(Math.max(0, h2));
  const out = [];
  const ts = h < 1e-9 ? [0] : [h, -h];
  for (const t of ts){
    const tgt = { x: foot.x + dir.x*t, y: foot.y + dir.y*t };
    const crease = ppBisector(p, tgt);
    if (crease) addUnique(out, crease);
  }
  return out;
}

// O7：把 p 折到 l 上，同时让线 m 落到自身（折痕 ⊥ m）—— 唯一解
function o7Solver(p, l, m){
  const n = { x: m.b, y: -m.a };          // 折痕法向 ∥ m 方向
  const ln = l.a*n.x + l.b*n.y;
  if (Math.abs(ln) < 1e-9) return [];
  const d = distPL(l, p) / (2*ln);        // 折痕到 p 的有符号距离
  return [L(n.x, n.y, d - (n.x*p.x + n.y*p.y))];
}

// O6：p 折到 l，同时 q 折到 m —— 扫描法向角求折痕（0~3 解）
function plplSolver(p, l, q, m){
  l = canon(l); m = canon(m);
  const sp = distPL(l, p), sq = distPL(m, q);
  const N = 20000, out = [];
  let prev = null;
  const f = (phi) => {
    const a = Math.cos(phi), b = Math.sin(phi);
    const ln = l.a*a + l.b*b, mn = m.a*a + m.b*b;
    if (Math.abs(ln) < 1e-7 || Math.abs(mn) < 1e-7) return null;
    const c1 = sp/(2*ln) - (a*p.x + b*p.y);
    const c2 = sq/(2*mn) - (a*q.x + b*q.y);
    return { a, b, r: c1 - c2, c: (c1+c2)/2, ln, mn };
  };
  const root = (phi) => {
    let lo = phi - 2*Math.PI/N, hi = phi;
    let flo = f(lo), fhi = f(hi);
    for (let it = 0; it < 80; it++){
      const mid = (lo+hi)/2, fm = f(mid);
      if (!fm) { lo = mid; continue; }
      if (fm.r * flo.r <= 0){ hi = mid; fhi = fm; }
      else { lo = mid; flo = fm; }
    }
    const fm = f((lo+hi)/2);
    return fm ? L(fm.a, fm.b, fm.c) : null;
  };
  for (let i = 0; i <= N; i++){
    const phi = 2*Math.PI*i/N;
    const v = f(phi);
    if (!v){ prev = null; continue; }
    if (prev !== null && prev.r * v.r < 0){
      const r = root(phi);
      if (r) addValid(out, r, p, l, q, m);
    }
    if (Math.abs(v.r) < 1e-12) addValid(out, L(v.a, v.b, v.c), p, l, q, m);
    prev = v;
  }
  return out;
}
// 极点在扫描中会造成伪根：用「镜像点确实落在目标线上」复核
function addValid(out, c, p, l, q, m){
  const pp = reflect(c, p), qq = reflect(c, q);
  if (Math.abs(distPL(l, pp)) > 1e-6) return;
  if (Math.abs(distPL(m, qq)) > 1e-6) return;
  addUnique(out, c);
}

// ---------- 统一入口：把一个「折叠指令」解成候选折痕 ----------
// step = {op, ...}
function resolveOp(step){
  if (!step || !step.op) return [];
  const pt = a => P(a[0], a[1]);
  switch (step.op){
    case 'O1': return creaseThroughPoints(pt(step.p), pt(step.q));
    case 'O2': { const c = ppBisector(pt(step.p), pt(step.q)); return c ? [c] : []; }
    case 'O3': return angleBisectors(step.l, step.m);
    case 'O4': return [plPerp(pt(step.p), step.l)];
    case 'O5': return o5Solver(pt(step.p), step.l, pt(step.q));
    case 'O6': return plplSolver(pt(step.a.p), step.a.l, pt(step.b.p), step.b.l);
    case 'O7': return o7Solver(pt(step.p), step.l, step.m);
    default: return [];
  }
}
function pickCrease(step){
  const cands = resolveOp(step);
  if (!cands.length) return null;
  return cands[step.k || 0] || cands[0];
}

function hasLine(lines, target){ return lines.some(g => sameLine(g, target)); }

module.exports = {
  P, L, lineThrough, interLines, distPL, samePt, sameLine, reflect, project, reflectLine, canon,
  creaseThroughPoints, ppBisector, angleBisectors, plPerp, o5Solver, o7Solver, plplSolver,
  resolveOp, pickCrease, hasLine, addUnique
};
