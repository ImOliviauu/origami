// 把 engine.js + levels.js 注入模板，生成单文件 index.html
const fs = require('fs');
const path = require('path');
const dir = __dirname;

let eng = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8');
eng = eng.replace(/module\.exports[\s\S]*$/, '').trimEnd();

const lv = fs.readFileSync(path.join(dir, 'levels.js'), 'utf8').trimEnd();
let tpl = fs.readFileSync(path.join(dir, '_tpl.html'), 'utf8');

if (!tpl.includes('/*__ENGINE__*/') || !tpl.includes('/*__LEVELS__*/')) {
  throw new Error('模板里缺少占位标记');
}
tpl = tpl.replace('/*__ENGINE__*/', () => eng).replace('/*__LEVELS__*/', () => lv);
fs.writeFileSync(path.join(dir, 'index.html'), tpl);
console.log('已生成 index.html：', (Buffer.byteLength(tpl)/1024).toFixed(1), 'KB');
