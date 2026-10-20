const fs = require('fs');
const E = require('./engine.js');
const { L, P, lineThrough, angleBisectors, o5Solver, plplSolver, reflect, reflectLine, sameLine, interLines, resolveOp, pickCrease, distPL } = E;

const src = fs.readFileSync(__dirname + '/levels.js', 'utf8');
const build = new Function('L','P','lineThrough','angleBisectors','o5Solver','plplSolver',
  src + '\nreturn { LEVELS, CHAPTERS };');
const { LEVELS, CHAPTERS } = build(L, P, lineThrough, angleBisectors, o5Solver, plplSolver);

const PTOL = 1e-3;

function scene(level){
  const w = level.paper.w, h = level.paper.h;
  const lines = [];
  (level.lines || []).forEach(l => lines.push({ a:l.a, b:l.b, c:l.c, given:true }));
  lines.push({ a:0,b:1,c:0, edge:true }, { a:0,b:1,c:-h, edge:true }, { a:1,b:0,c:0, edge:true }, { a:1,b:0,c:-w, edge:true });
  const pts = (level.points || []).map(([id,x,y]) => ({ id, x, y }));
  return { lines, pts, w, h };
}

function applyFold(s, crease){
  const before = s.lines.filter(m => !m.reflected);
  s.lines.push({ a:crease.a, b:crease.b, c:crease.c, crease:true });
  for (const m of before){
    const r = reflectLine(crease, m);
    if (r && Math.abs(Math.hypot(r.a,r.b)-1) < 1e-6) s.lines.push({ a:r.a, b:r.b, c:r.c, reflected:true });
  }
  s.lands = s.lands || [];
  for (const p of s.pts){ const q = reflect(crease, p); s.lands.push(q); }
}

function derivedPoints(s){
  const out = [], seen = new Set();
  const rect = { x0:-0.5, y0:-0.5, x1:s.w+0.5, y1:s.h+0.5 };
  const keep = X => {
    if (!X) return;
    if (X.x < rect.x0 || X.x > rect.x1 || X.y < rect.y0 || X.y > rect.y1) return;
    const k = Math.round(X.x*1e5) + ',' + Math.round(X.y*1e5);
    if (seen.has(k)) return;
    seen.add(k); out.push(X);
  };
  const L2 = s.lines;
  for (let i=0;i<L2.length;i++) for (let j=i+1;j<L2.length;j++) keep(interLines(L2[i], L2[j]));
  (s.lands||[]).forEach(keep);
  return out;
}

function checkGoal(g, s){
  const dp = derivedPoints(s);
  const one = gg => {
    if (gg.type === 'point') return dp.some(p => Math.hypot(p.x-gg.at[0], p.y-gg.at[1]) < PTOL);
    if (gg.type === 'line') return s.lines.some(l => sameLine(l, gg.line));
    if (gg.type === 'and') return gg.of.every(one);
    if (gg.type === 'or') return gg.of.some(one);
    return false;
  };
  return one(g);
}

let fail = 0;
const report = [];
for (const lv of LEVELS){
  const problems = [];
  const s = scene(lv);
  if (checkGoal(lv.goal, s)) problems.push('初始状态就已满足目标');
  if (lv.solution.length !== lv.optimal) problems.push(`optimal=${lv.optimal} 但解法 ${lv.solution.length} 步`);

  lv.solution.forEach((step, i) => {
    // 玩家点得到的前提：这一步引用的线，此刻必须真的存在于纸上
    const refs = [];
    if (step.l) refs.push(step.l);
    if (step.m) refs.push(step.m);
    if (step.a && step.a.l) refs.push(step.a.l);
    if (step.b && step.b.l) refs.push(step.b.l);
    refs.forEach((rf, j) => {
      if (!s.lines.some(g => sameLine(g, rf))) problems.push(`第 ${i+1} 步引用第 ${j+1} 条线时它还不存在`);
    });
    // 点同理：必须是给定点或已派生的交点/落点
    const dp0 = derivedPoints(s);
    const usedPts = [];
    if (step.p) usedPts.push(step.p);
    if (step.q) usedPts.push(step.q);
    if (step.a && step.a.p) usedPts.push(step.a.p);
    if (step.b && step.b.p) usedPts.push(step.b.p);
    usedPts.forEach(pt => {
      const here = s.pts.some(g => Math.hypot(g.x-pt[0], g.y-pt[1]) < 1e-6)
        || dp0.some(d => Math.hypot(d.x-pt[0], d.y-pt[1]) < 1e-6);
      if (!here) problems.push(`第 ${i+1} 步用到的点 (${pt[0]},${pt[1]}) 在纸上还不存在`);
    });
    const cands = resolveOp(step);
    if (!cands.length){ problems.push(`第 ${i+1} 步 ${step.op} 无解`); return; }
    const crease = cands[step.k || 0];
    if (!crease){ problems.push(`第 ${i+1} 步 k=${step.k} 越界(共 ${cands.length} 解)`); return; }
    // 折痕必须真的与纸相交
    const reach = Math.abs(distPL(crease, P(lv.paper.w/2, lv.paper.h/2)));
    if (reach > Math.hypot(lv.paper.w, lv.paper.h)) problems.push(`第 ${i+1} 步折痕离纸太远`);
    applyFold(s, crease);
    const ok = checkGoal(lv.goal, s);
    if (i === lv.solution.length - 1 && !ok) problems.push('最终步仍未达标');
    if (ok && i < lv.solution.length - 1) problems.push(`第 ${i+1} 步就提前达标（optimal 可降低）`);
  });

  report.push({ id: lv.id, name: lv.name, ok: problems.length === 0, problems });
  if (problems.length) fail++;
}

report.forEach(r => {
  console.log((r.ok ? '✓ ' : '✗ ') + r.id + '  ' + r.name + (r.ok ? '' : '   ← ' + r.problems.join(' / ')));
});
console.log(`\n共 ${LEVELS.length} 关，失败 ${fail} 关；章节 ${CHAPTERS.length} 个`);
const perChapter = CHAPTERS.map(c => c.name + ':' + LEVELS.filter(l=>l.ch===c.id).length);
console.log(perChapter.join('  '));
const axioms = new Set();
LEVELS.forEach(l => l.solution.forEach(s => axioms.add(s.op)));
console.log('解法用到的公理：', [...axioms].sort().join(' '));
