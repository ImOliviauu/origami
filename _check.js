// 检查题面里提到的点标签是否真的在纸上
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('index.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function mkEl(t){
  const e = { tagName:t, className:'', id:'', textContent:'', innerHTML:'', style:{}, dataset:{}, children:[], clientWidth:960, clientHeight:620,
    classList:{ _s:new Set(), add(...c){ c.forEach(x=>this._s.add(x)); }, remove(...c){ c.forEach(x=>this._s.delete(x)); }, toggle(c,v){ v?this._s.add(c):this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    appendChild(c){ this.children.push(c); return c; }, setAttribute(){}, addEventListener(){}, querySelector(){ return mkEl('div'); }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return { left:0, top:0, width:960, height:620 }; } };
  return e;
}
const cache = new Map();
const ctx = { document:{ querySelector(s){ if (!cache.has(s)) cache.set(s, mkEl('div')); return cache.get(s); }, createElement:t=>mkEl(t), addEventListener(){} },
  localStorage:{ getItem:()=>null, setItem(){} }, console, window:{ addEventListener(){} }, requestAnimationFrame:f=>f(), setTimeout:()=>0, clearTimeout:()=>{},
  Math, JSON, Number, String, Array, Object, Set, Map, Date };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const rows = vm.runInContext('LEVELS.map(l=>({id:l.id,name:l.name,task:l.task,pts:l.points.map(p=>p[0])}))', ctx);
let bad = 0;
rows.forEach(r => {
  const txt = r.task.replace(/<[^>]+>/g, '');
  // 形如 l₁ / l₂ / a′ / m₁ / mid₁ / OB′ 的标签
  const toks = txt.match(/[A-Za-z]{1,4}[₁₂′]/g) || [];
  const unknown = [...new Set(toks)].filter(t => !r.pts.includes(t));
  if (unknown.length){ bad++; console.log('✗ ' + r.id + ' 《' + r.name + '》 题面提到 ' + unknown.join('、') + '，纸上只有 ' + r.pts.join('、')); }
});
console.log(bad ? ('可疑 ' + bad + ' 关') : '题面引用的点全部存在于纸上');
