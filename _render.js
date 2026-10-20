// 渲染产物体检：所有关卡在初始/通关两种状态下都不能出现 NaN/undefined，且图形要落在视口内
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function mkEl(t){const e={tagName:t,className:'',id:'',textContent:'',innerHTML:'',style:{},dataset:{},children:[],clientWidth:960,clientHeight:620,
classList:{_s:new Set(),add(...c){c.forEach(x=>this._s.add(x))},remove(...c){c.forEach(x=>this._s.delete(x))},toggle(c,v){v?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
appendChild(c){this.children.push(c);return c},setAttribute(){},addEventListener(){},querySelector(){return mkEl('div')},querySelectorAll(){return[]},getBoundingClientRect(){return{left:0,top:0,width:960,height:620}}};return e}
const cache=new Map();
const ctx={document:{querySelector(s){if(!cache.has(s))cache.set(s,mkEl('div'));return cache.get(s)},createElement:t=>mkEl(t),addEventListener(){}},
localStorage:{getItem:()=>null,setItem(){}},console,window:{addEventListener(){}},requestAnimationFrame:f=>f(),setTimeout:()=>0,clearTimeout:()=>{},
Math,JSON,Number,String,Array,Object,Set,Map,Date};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);

const res = vm.runInContext(`(function(){
  const bad=[];
  for (const L of LEVELS){
    initLevel(L.id);
    const check=(tag)=>{
      const h = document.querySelector('#board').innerHTML || '';
      if (/NaN|undefined|Infinity/.test(h)) bad.push(L.id+"@"+tag+" 含 NaN/undefined");
      const neg = h.match(/(?:width|height|r)="(-[d.]+)"/g);
      if (neg) bad.push(L.id+"@"+tag+" 负尺寸 "+neg[0]);
      // 检查所有坐标是否落在 0..960 / 0..620 附近
      const nums = h.match(/(?:x1|y1|x2|y2|cx|cy)="(-?[\\d.]+)"/g) || [];
      for (const n of nums){
        const v = parseFloat(n.split('"')[1]);
        if (!isFinite(v) || v < -2000 || v > 3000) { bad.push(L.id+'@'+tag+' 坐标越界 '+n); break; }
      }
    };
    check('初始');
    // 通关状态
    for (const st of L.solution){
      const s=scene();
      const asPt=p=>({kind:'pt',x:p[0],y:p[1]});
      const asLine=l=>{const g=s.lines.find(x=>sameLine(x,l));return g?{kind:'line',line:g}:null;};
      let sel=[];
      if(st.op==='O1'||st.op==='O2') sel=[asPt(st.p),asPt(st.q)];
      else if(st.op==='O3') sel=[asLine(st.l),asLine(st.m)];
      else if(st.op==='O4') sel=[asPt(st.p),asLine(st.l)];
      else if(st.op==='O5') sel=[asPt(st.p),asLine(st.l),asPt(st.q)];
      else if(st.op==='O6') sel=[asPt(st.a.p),asLine(st.a.l),asPt(st.b.p),asLine(st.b.l)];
      else if(st.op==='O7') sel=[asPt(st.p),asLine(st.l),asLine(st.m)];
      state.mode=st.op; state.sel=sel;
      const step=buildStep(), cands=resolveOp(step);
      applyFold(step, cands[st.k||0]||cands[0]);
    }
    check('通关');
    state.revealed=true; render(); check('参考');
  }
  return {bad, n: LEVELS.length};
})()`, ctx);
console.log(res.bad.length ? '问题：\n' + res.bad.join('\n') : '渲染体检通过：' + res.n + ' 关 × 初始/通关/参考三种状态，无 NaN、无越界坐标');
