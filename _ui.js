// 用极简 DOM 垫片跑一遍真实 UI 流程：每关都按参考解法点着过关
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function mkEl(tag){
  const el = {
    tagName: tag, className:'', id:'', textContent:'', innerHTML:'', title:'',
    style:{}, dataset:{}, children:[], clientWidth:960, clientHeight:620,
    classList:{ _s:new Set(),
      add(...c){ c.forEach(x=>this._s.add(x)); }, remove(...c){ c.forEach(x=>this._s.delete(x)); },
      toggle(c,v){ v===undefined ? (this._s.has(c)?this._s.delete(c):this._s.add(c)) : (v?this._s.add(c):this._s.delete(c)); },
      contains(c){ return this._s.has(c); } },
    appendChild(c){ this.children.push(c); return c; },
    setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return mkEl('div'); },
    querySelectorAll(){ return []; },
    getBoundingClientRect(){ return { left:0, top:0, width:960, height:620 }; },
    closest(){ return null; }
  };
  return el;
}
const cache = new Map();
const document = {
  querySelector(sel){ if(!cache.has(sel)) cache.set(sel, mkEl('div')); return cache.get(sel); },
  createElement(t){ return mkEl(t); },
  addEventListener(){}, body: mkEl('body')
};
const store = new Map();
const localStorage = {
  getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k)
};
const ctx = {
  document, localStorage, console,
  window: { addEventListener(){} },
  requestAnimationFrame: fn => fn(),
  setTimeout: (fn)=>0, clearTimeout: ()=>{}, Math, JSON, Number, String, Array, Object, Set, Map, Date, parseFloat, parseInt, isNaN
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(script, ctx);

const code = (s) => vm.runInContext(s, ctx);

// ---- 逐关 UI 复现 ----
let ok = 0, bad = 0;
const names = code('LEVELS.map(l=>l.id)');
for (const id of names){
  const res = code(`(function(){
    initLevel('${id}');
    const L = state.level;
    const log = [];
    const solvedAtStart = state.solved;
    for (const st of L.solution){
      // 把 step 里的坐标/直线映射成「真实场景对象」，模拟玩家点击
      const s = scene();
      const asPt = (p) => ({ kind:'pt', x:p[0], y:p[1] });
      const asLine = (l) => {
        const real = s.lines.find(g => sameLine(g, l));
        return real ? { kind:'line', line: real } : null;
      };
      let sel = [];
      if (st.op === 'O1' || st.op === 'O2') sel = [asPt(st.p), asPt(st.q)];
      else if (st.op === 'O3') sel = [asLine(st.l), asLine(st.m)];
      else if (st.op === 'O4') sel = [asPt(st.p), asLine(st.l)];
      else if (st.op === 'O5') sel = [asPt(st.p), asLine(st.l), asPt(st.q)];
      else if (st.op === 'O6') sel = [asPt(st.a.p), asLine(st.a.l), asPt(st.b.p), asLine(st.b.l)];
      else if (st.op === 'O7') sel = [asPt(st.p), asLine(st.l), asLine(st.m)];
      if (sel.some(o => !o)) { log.push('对象找不到:'+st.op); break; }
      state.mode = st.op; state.sel = sel;
      const step = buildStep();
      const cands = resolveOp(step);
      if (!cands.length){ log.push('无解:'+st.op); break; }
      const c = cands[st.k || 0] || cands[0];
      applyFold(step, c);
      log.push(st.op + '(' + cands.length + '解)');
    }
    return { id:'${id}', solved: state.solved, atStart: solvedAtStart,
             folds: state.folds.length, optimal: L.optimal,
             win: document.querySelector('#win').classList.contains('show'),
             log, svgLen: (document.querySelector('#board').innerHTML||'').length };
  })()`);
  const pass = res.solved && !res.atStart && res.folds === res.optimal && res.svgLen > 500 && !res.log.some(l=>l.startsWith('对象找不到')||l.startsWith('无解'));
  if (pass) ok++; else bad++;
  console.log((pass?'✓ ':'✗ ') + res.id + '  折痕 ' + res.folds + '/' + res.optimal +
    '  解法=' + res.log.join(' → ') + (pass?'':'  ← 失败'));
}
console.log('\nUI 流程：通过 ' + ok + '，失败 ' + bad);

// ---- 交互边界：撤销 / 重来 / 提示 / 参考折法 ----
const edge = code(`(function(){
  initLevel('l02');
  const out = [];
  const L = state.level;
  const pick = (st) => {
    const s0 = scene();
    const asPt = p => ({ kind:'pt', x:p[0], y:p[1] });
    const asLine = l => { const r = s0.lines.find(g => sameLine(g, l)); return r ? { kind:'line', line:r } : null; };
    if (st.op === 'O1' || st.op === 'O2') return [asPt(st.p), asPt(st.q)];
    if (st.op === 'O4') return [asPt(st.p), asLine(st.l)];
    if (st.op === 'O5') return [asPt(st.p), asLine(st.l), asPt(st.q)];
    if (st.op === 'O3') return [asLine(st.l), asLine(st.m)];
    if (st.op === 'O6') return [asPt(st.a.p), asLine(st.a.l), asPt(st.b.p), asLine(st.b.l)];
    if (st.op === 'O7') return [asPt(st.p), asLine(st.l), asLine(st.m)];
    return [];
  };
  // 先做一步，再撤销
  state.mode = L.solution[0].op; state.sel = pick(L.solution[0]);
  const step = buildStep();
  const cands = resolveOp(step);
  out.push(L.solution[0].op + ' 候选数=' + cands.length);
  applyFold(step, cands[0]);
  out.push('一步后 folds=' + state.folds.length + ' solved=' + state.solved);
  undo();
  out.push('撤销后 folds=' + state.folds.length + ' solved=' + state.solved);
  // 提示
  openHint(); out.push('提示层=' + document.querySelector('#hintmodal').classList.contains('show'));
  state.revealed = true; render();
  out.push('参考折法渲染=' + (document.querySelector('#board').innerHTML.indexOf('232,160,32') >= 0));
  reset();
  out.push('重来后 folds=' + state.folds.length);
  // 无解组合的容错
  state.mode='O3'; state.sel=[{kind:'line',line:scene().lines[0]},{kind:'line',line:scene().lines[0]}];
  let threw=false; try{ commitStep(); }catch(e){ threw=true; out.push('异常:'+e.message); }
  out.push('同线折角未抛异常=' + !threw);
  return out;
})()`);
console.log('\n交互边界：');
edge.forEach(l => console.log('  ' + l));
