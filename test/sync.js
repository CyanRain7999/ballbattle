// ballbattle/ 副本同步脚本：node test/sync.js
// 复制主目录文件到 ballbattle/，并对 index.html 做副本化处理：
//   - 移除 HAS_EDITOR 标记（副本无 editor.html，隐藏 ⚙ 数值按钮）
//   - 移除 multi-actions 静态 ⚙ 数值按钮
// 用法：node test/sync.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DST = path.join(ROOT, 'ballbattle');
// 需同步的文件（与主目录保持字节一致）
const FILES = [
  'css/style.css',
  'js/core.js', 'js/data.js', 'js/draw.js', 'js/battle.js', 'js/entities.js',
  'js/hud.js', 'js/select.js', 'js/ui.js', 'js/balance.js',
  'test/smoke.js', 'test/check_modes.js', 'test/check_teams.js',
  'test/verify_v4.js', 'test/verify_v5.js', 'test/verify_v8.js',
  'package.json',
];

let n = 0;
for (const f of FILES) {
  fs.copyFileSync(path.join(ROOT, f), path.join(DST, f));
  n++;
}
// index.html 副本化（剔除主站专属内容）
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<script>window\.HAS_EDITOR = true;<\/script>\s*<!-- 主站带数值编辑器（editor\.html）；ballbattle 副本无此标记 -->\s*/, '')
  .replace(/\s*<button class="btn" id="btn-balance">⚙ 数值<\/button>/, '');
fs.writeFileSync(path.join(DST, 'index.html'), html);
n++;

// 校验
let diff = 0;
for (const f of FILES) {
  const a = fs.readFileSync(path.join(ROOT, f));
  const b = fs.readFileSync(path.join(DST, f));
  if (!a.equals(b)) { console.log('DIFF: ' + f); diff++; }
}
if (fs.readFileSync(path.join(DST, 'index.html'), 'utf8').includes('HAS_EDITOR') ||
    fs.readFileSync(path.join(DST, 'index.html'), 'utf8').includes('btn-balance')) {
  console.log('DIFF: ballbattle/index.html 含主站专属内容'); diff++;
}
console.log(diff === 0 ? `ALL SYNCED (${n} files)` : `${diff} 个文件不一致！`);
process.exit(diff === 0 ? 0 : 1);
