// 从 levels.src.js（带给定线的原始设计）生成 levels.js（只给点）：
// 每条原给定直线 -> 用纸上的两个点定义 -> 参考解法前面补一次 O1
// 补完再用「逐折删减」把用不上的前置折法去掉，optimal 才是真的少
const fs = require('fs');
const E = require('./engine.js');
const { L, P, lineThrough, angleBisectors, o5Solver, plplSolver, reflect, reflectLine, interLines, sameLine, distPL } = E;

const src = fs.readFileSync(__dirname + '/levels.src.js', 'utf8');
const build = new Function('L','P','lineThrough','angleBisectors','o5Solver','plplSolver',
  src + '\nreturn { LEVELS, CHAPTERS };');
const { LEVELS, CHAPTERS } = build(L, P, lineThrough, angleBisectors, o5Solver, plplSolver);

const num = v => { const r = Number(v.toPrecision(12)); return Object.is(r, -0) ? 0 : r; };
const onPaper = (p, w, h, m = 1e-7) => p.x >= -m && p.x <= w + m && p.y >= -m && p.y <= h + m;

/* ---------- 场景 / 判定（与页面同一套规则） ---------- */
function makeScene(lv, extra){
  const w = lv.paper.w, h = lv.paper.h;
  return {
    w, h, lands: [],
    pts: (extra || lv.points.map(([id,x,y]) => ({ id, x, y }))),
    lines: [{a:0,b:1,c:0,edge:1},{a:0,b:1,c:-h,edge:1},{a:1,b:0,c:0,edge:1},{a:1,b:0,c:-w,edge:1}]
  };
}
function applyFold(s, c){
  const before = s.lines.filter(m => !m.reflected);
  s.lines.push({ a:c.a, b:c.b, c:c.c, crease:1 });
  for (const m of before){ const r = reflectLine(c, m); if (r) s.lines.push({ a:r.a, b:r.b, c:r.c, reflected:1 }); }
  for (const p of s.pts) s.lands.push(reflect(c, p));
}
function derived(s){
  const out = [], seen = new Set();
  const push = X => {
    if (!X) return;
    if (X.x < -0.4 || X.x > s.w + 0.4 || X.y < -0.4 || X.y > s.h + 0.4) return;
    const k = Math.round(X.x*1e4) + ',' + Math.round(X.y*1e4);
    if (seen.has(k)) return;
    seen.add(k); out.push(X);
  };
  for (let i=0;i<s.lines.length;i++) for (let j=i+1;j<s.lines.length;j++) push(interLines(s.lines[i], s.lines[j]));
  s.lands.forEach(push);
  return out;
}
function goalOK(g, s){
  const dp = derived(s);
  const one = gg => {
    if (gg.type === 'point') return dp.some(p => Math.hypot(p.x-gg.at[0], p.y-gg.at[1]) < 1e-3);
    if (gg.type === 'line') return s.lines.some(l => sameLine(l, gg.line));
    if (gg.type === 'and') return gg.of.every(one);
    if (gg.type === 'or') return gg.of.some(one);
    return false;
  };
  return one(g);
}
function evalSol(lv, steps, pts){
  const s = makeScene(lv, pts);
  let first = null;
  for (let i=0;i<steps.length;i++){
    const st = steps[i];
    const cands = E.resolveOp(st);
    if (!cands.length) return { error:'第 '+(i+1)+' 折无解' };
    const c = cands[st.k||0] || cands[0];
    const refs = [st.l, st.m, st.a && st.a.l, st.b && st.b.l].filter(Boolean);
    for (const rf of refs) if (!s.lines.some(g => sameLine(g, rf))) return { error:'第 '+(i+1)+' 折引用了纸上不存在的线' };
    // 点也必须已经存在：给定点，或前几折派生出的交点/落点
    const dp = derived(s);
    const pts = [];
    if (st.p) pts.push(st.p);
    if (st.q) pts.push(st.q);
    if (st.a && st.a.p) pts.push(st.a.p);
    if (st.b && st.b.p) pts.push(st.b.p);
    for (const pt of pts){
      const here = s.pts.some(g => Math.hypot(g.x-pt[0], g.y-pt[1]) < 1e-6)
        || dp.some(d => Math.hypot(d.x-pt[0], d.y-pt[1]) < 1e-6);
      if (!here) return { error:'第 '+(i+1)+' 折引用了纸上不存在的点 ('+pt[0]+','+pt[1]+')' };
    }
    applyFold(s, c);
    if (first === null && goalOK(lv.goal, s)) first = i;
  }
  return { first, finalSolved: first === steps.length - 1 };
}

/* ---------- 给一条线挑两个定义点 ---------- */
function boundaryPts(l, w, h){
  const q = E.project(l, { x:0, y:0 });
  const dir = { x:l.b, y:-l.a };
  const ts = [];
  if (Math.abs(dir.x) > 1e-9){ ts.push((0 - q.x)/dir.x, (w - q.x)/dir.x); }
  if (Math.abs(dir.y) > 1e-9){ ts.push((0 - q.y)/dir.y, (h - q.y)/dir.y); }
  const out = [];
  for (const t of ts){
    const p = { x:q.x + dir.x*t, y:q.y + dir.y*t };
    if (onPaper(p, w, h) && !out.some(o => Math.hypot(o.x-p.x, o.y-p.y) < 1e-6)) out.push(p);
  }
  // 线只在纸的一角擦过时，沿线往纸内退一点
  if (out.length < 2){
    for (const t of [-3, -2, -1, 1, 2, 3]){
      const p = { x:q.x + dir.x*t, y:q.y + dir.y*t };
      if (onPaper(p, w, h, -0.05) && !out.some(o => Math.hypot(o.x-p.x, o.y-p.y) < 1e-6)) out.push(p);
    }
  }
  return out;
}
function farthestPair(list){
  let best = null, bd = -1;
  for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++){
    const d = Math.hypot(list[i].x-list[j].x, list[i].y-list[j].y);
    if (d > bd){ bd = d; best = [list[i], list[j]]; }
  }
  return bd > 1e-6 ? best : null;
}

/* ---------- 序列化 ---------- */
const isV = l => Math.abs(l.b) < 1e-12;
const isH = l => Math.abs(l.a) < 1e-12;
const lineSrc = l => isH(l) ? `H(${num(-l.c/l.b)})` : isV(l) ? `V(${num(-l.c/l.a)})`
  : `LN(${num(l.a)}, ${num(l.b)}, ${num(l.c)})`;
const ptSrc = p => `[${num(p[0])}, ${num(p[1])}]`;
function stepSrc(st){
  const p = a => `p:${ptSrc(a)}`;
  switch (st.op){
    case 'O1':
    case 'O2': return `{ op:'${st.op}', ${p(st.p)}, q:${ptSrc(st.q)} }`;
    case 'O3': return `{ op:'O3', l:${lineSrc(st.l)}, m:${lineSrc(st.m)}, k:${st.k||0} }`;
    case 'O4': return `{ op:'O4', ${p(st.p)}, l:${lineSrc(st.l)} }`;
    case 'O5': return `{ op:'O5', ${p(st.p)}, l:${lineSrc(st.l)}, q:${ptSrc(st.q)}, k:${st.k||0} }`;
    case 'O6': return `{ op:'O6', a:{ ${p(st.a.p)}, l:${lineSrc(st.a.l)} }, b:{ ${p(st.b.p)}, l:${lineSrc(st.b.l)} }, k:${st.k||0} }`;
    case 'O7': return `{ op:'O7', ${p(st.p)}, l:${lineSrc(st.l)}, m:${lineSrc(st.m)} }`;
    default: throw new Error('未知 op ' + st.op);
  }
}
function goalSrc(g){
  if (g.type === 'point') return `G.point(${num(g.at[0])}, ${num(g.at[1])})`;
  if (g.type === 'line') return `G.line(${lineSrc(g.line)})`;
  if (g.type === 'and' || g.type === 'or') return `G.${g.type}(${g.of.map(goalSrc).join(', ')})`;
  throw new Error('未知 goal ' + g.type);
}
const usedPts = st => {
  const out = [];
  if (st.p) out.push(st.p);
  if (st.q) out.push(st.q);
  if (st.a && st.a.p) out.push(st.a.p);
  if (st.b && st.b.p) out.push(st.b.p);
  return out;
};

/* ---------- 主流程 ---------- */
// 少数关卡的文字要跟着「只给点」改写
const TEXT = {
  l18: { hints: ['E 在 O 正上方 2 处：它是构造里唯一需要的额外点。',
    '双落线：E → OB，O → L1。',
    '把 L1 沿折痕镜像，得到过 O 的 40° 线。'] },
  l20: { hints: ['P2 在左边缘 y=2，正好是纸高的 1/3；把 L2(y=4) 折出来当第二条准线。',
    '双落线：P1 → 右边缘 x=6，P2 → L2(y=4)。',
    'P1 落在右边缘高度 y=6/(1+∛2)≈2.655，于是 ∛2 = 6/y − 1。'] },
  l20b: { hints: ['E=(1,3) 在过 O 的竖直线上、到 OA 的距离为 2。',
    '三步不变：E → OB，O → L1。',
    '三条候选折痕里，只有一条把 L1 映成过 O 的 200/3° 线。'] },
  l34: { hints: ['A=(1.5,3) 在横中线 b 上，离竖中线 a 还差 1.5；B=(3.75,1.5) 离横中线 b 差 1.5。',
    '双落线会给出 3 条候选折痕，A 的落点分别在 y=4.8705（肩）、2.3324（胯）、0.2971（脚）。',
    '取最高的那条：肩高 = 3+3cos(2π/7)≈4.8705。'] },
};

const LETTERS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ'.split('');
const outText = [];
const stats = [];
let totalNewPts = 0, totalAdded = 0, totalPruned = 0;

for (const L0 of LEVELS){
  const w = L0.paper.w, h = L0.paper.h;
  const edges = [L(0,1,0), L(0,1,-h), L(1,0,0), L(1,0,-w)];
  const isEdge = l => edges.some(e => sameLine(e, l));
  const kept = (L0.lines || []).filter(l => !isEdge(l));

  const pts = L0.points.map(([id,x,y]) => ({ id, x, y }));
  const usedLabels = new Set(pts.map(p => p.id));
  let li = 0;
  const newLabel = () => {
    while (li < LETTERS.length && usedLabels.has(LETTERS[li])) li++;
    const s = li < LETTERS.length ? LETTERS[li] : 'X' + li;
    usedLabels.add(s); li++;
    return s;
  };
  // 新点用所在直线的名字命名：直线 l 的两个点就是 l₁、l₂，题目文字里的「直线 l」继续成立
  const mkPt = (p, want) => {
    const hit = pts.find(g => Math.hypot(g.x-p.x, g.y-p.y) < 1e-6);
    if (hit) return hit;
    let id = want || newLabel();
    if (usedLabels.has(id)) id = newLabel();
    usedLabels.add(id);
    const o = { id, x:p.x, y:p.y };
    pts.push(o);
    return o;
  };

  const prefix = [], note = new Map(), lineOfStep = new Map();
  for (const l of kept){
    const on = pts.filter(p => Math.abs(distPL(l, p)) < 1e-7);
    const bp = boundaryPts(l, w, h);
    let pair = null;
    if (on.length >= 2) pair = farthestPair(on);
    else if (on.length === 1){
      const rest = bp.filter(q => Math.hypot(q.x-on[0].x, q.y-on[0].y) > 1e-3);
      let best = null, bd = -1;
      for (const q of rest){
        const d = Math.hypot(q.x-on[0].x, q.y-on[0].y);
        if (d > bd){ bd = d; best = q; }
      }
      if (best) pair = [on[0], mkPt(best, l.id + '′')];
      else {
        const q = E.project(l, { x:0, y:0 }), dir = { x:l.b, y:-l.a };
        for (const t of [2, 1.5, 1, -1, -1.5, -2]){
          const c = { x:q.x+dir.x*t, y:q.y+dir.y*t };
          if (onPaper(c, w, h, -0.05)){ pair = [on[0], mkPt(c, l.id + '′')]; break; }
        }
      }
    } else {
      const f = farthestPair(bp);
      if (f) pair = [mkPt(f[0], l.id + '₁'), mkPt(f[1], l.id + '₂')];
      else if (bp.length === 1) pair = [mkPt(bp[0], l.id + '₁'), mkPt({ x:bp[0].x + l.b*2, y:bp[0].y - l.a*2 }, l.id + '₂')];
    }
    if (!pair) throw new Error(L0.id + ' 无法为直线取两个点');

    const step = { op:'O1', p:[pair[0].x, pair[0].y], q:[pair[1].x, pair[1].y] };
    prefix.push(step);
    lineOfStep.set(step, l);
    const desc = isH(l) ? `水平线 y=${num(-l.c/l.b)}` : isV(l) ? `竖直线 x=${num(-l.c/l.a)}` : '那条斜线';
    note.set(step, `过 ${pair[0].id}、${pair[1].id} 折一次（O1），把${desc} 折出来${l.id ? `（直线 ${l.id}）` : ''}。`);
  }

  // 先把所有前置折法都放进去
  let steps = prefix.concat(L0.solution);
  let r = evalSol(L0, steps, pts);
  if (!r.finalSolved) throw new Error(L0.id + ' 补完前置折法仍未达标：' + (r.error || ''));

  // 逐折删减：删掉它还能在最后一步达标，就说明这一折是多余的
  // 但如果后面的某一步要点这条线，就不能删（哪怕它恰好也以镜像线的身份存在）
  const refLines = st => [st.l, st.m, st.a && st.a.l, st.b && st.b.l].filter(Boolean);
  for (const p of prefix){
    const mine = lineOfStep.get(p);
    const usedLater = steps.some(st => st !== p && refLines(st).some(rf => sameLine(rf, mine)));
    if (usedLater) continue;
    const test = steps.filter(x => x !== p);
    const rr = evalSol(L0, test, pts);
    if (!rr.error && rr.finalSolved){ steps = test; totalPruned++; }
  }
  r = evalSol(L0, steps, pts);
  if (!r.finalSolved) throw new Error(L0.id + ' 删减后不达标');

  // 只保留还被引用的新点
  const usedCoord = new Set();
  steps.forEach(st => usedPts(st).forEach(p => usedCoord.add(Math.round(p[0]*1e5)+','+Math.round(p[1]*1e5))));
  const origLabels = new Set(L0.points.map(p => p[0]));
  const ptsOut = pts.filter(p => origLabels.has(p.id) || usedCoord.has(Math.round(p.x*1e5)+','+Math.round(p.y*1e5)));
  totalNewPts += ptsOut.length - L0.points.length;
  totalAdded += steps.length - L0.solution.length;

  const T = TEXT[L0.id] || {};
  const hints = steps.filter(st => note.has(st)).map(st => note.get(st)).concat(T.hints || L0.hints);
  outText.push(`  {
    id: '${L0.id}', ch: ${L0.ch}, axiom: '${L0.axiom}', name: ${JSON.stringify(L0.name)},
    task: ${JSON.stringify(T.task || L0.task)},
    paper: { w: ${num(w)}, h: ${num(h)} },
    points: [${ptsOut.map(p => `['${p.id}', ${num(p.x)}, ${num(p.y)}]`).join(', ')}],
    goal: ${goalSrc(L0.goal)}, optimal: ${steps.length},
    hints: ${JSON.stringify(hints)},
    solution: [
      ${steps.map(stepSrc).join(',\n      ')}
    ]
  }`);
  stats.push(`${L0.id} ${steps.length} 折`);
}

const header = `// ===== 题库：纸上只有点，所有直线都要自己折 =====
// 目标：{type:'point',at:[x,y]} | {type:'line',line} | {type:'and',of} | {type:'or',of}
// 解法 step：
//   O1 {op:'O1',p,q}                 过两点
//   O2 {op:'O2',p,q}                 点→点
//   O3 {op:'O3',l,m,k}               线→线（k 选哪条角平分线）
//   O4 {op:'O4',p,l}                 过点作垂线
//   O5 {op:'O5',p,l,q,k}             点→线，折痕过 q
//   O6 {op:'O6',a:{p,l},b:{p,l},k}   双落线
//   O7 {op:'O7',p,l,m}               点→线 + 线→自身
const LN = (a, b, c) => L(a, b, c);
const H = y => L(0, 1, -y);
const V = x => L(1, 0, -x);
const SGL = (p, q) => lineThrough(P(p[0], p[1]), P(q[0], q[1]));
const RAY = deg => { const t = deg * Math.PI / 180; return L(Math.sin(t), -Math.cos(t), 0); };
const G = {
  point: (x, y) => ({ type: 'point', at: [x, y] }),
  line: l => ({ type: 'line', line: l }),
  and: (...of) => ({ type: 'and', of: of.flat() }),
  or: (...of) => ({ type: 'or', of: of.flat() }),
  orLines: cs => ({ type: 'or', of: cs.map(c => ({ type: 'line', line: c })) })
};
const CHAPTERS = [
${CHAPTERS.map(c => `  { id: ${c.id}, name: ${JSON.stringify(c.name)}, sub: ${JSON.stringify(c.sub)} }`).join(',\n')}
];

const LEVELS = [
${outText.join(',\n')}
];
`;
fs.writeFileSync(__dirname + '/levels.js', header);
console.log(`39 → 生成 ${LEVELS.length} 关：新增 ${totalNewPts} 个给定点、${totalAdded} 次前置 O1（删减掉 ${totalPruned} 次多余的）`);
console.log(stats.join('  '));
