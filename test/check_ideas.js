// IDEAS.md 结构校验：机制条目计数、旧文本残留检查
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'IDEAS.md'), 'utf8');
const lines = src.split(/\r?\n/);

// 1) 机制条目（### 标题）应为 23 个（A6 + B7 + C5 = 23）
const titles = lines.filter(l => /^### /.test(l)).length;
// 2) 旧文本残留（应为 0）
const stalePatterns = [/偷取对方 5 点能量/, /转化为自己 cd 缩减/, /复用现有反弹函数/];
const stale = stalePatterns.reduce((n, p) => n + (p.test(src) ? 1 : 0), 0);
// 3) 五大类分区齐全
const sections = ['A. 场地交互', 'B. 状态效果', 'C. 资源 / 召唤物', 'D. 形态 / 胜负', 'E. 不对称能力设计思路']
  .filter(s => src.includes(s)).length;

let fail = 0;
const check = (cond, label, detail) => {
  console.log(cond ? '[PASS]' : '[FAIL]', label, cond ? '' : detail);
  if (!cond) fail++;
};
check(titles === 23, `机制条目 23 个（实际 ${titles}）`, '条目数不符');
check(stale === 0, `旧文本残留 0（实际 ${stale}）`, '存在旧表述');
check(sections === 5, `五大类分区齐全（${sections}/5）`, '分区缺失');
check(/落地优先级建议/.test(src), '落地优先级章节存在', '缺失');
check(/来源参考/.test(src) || /备注/.test(src), '来源/备注说明存在', '缺失');

console.log(fail === 0 ? '\n=== IDEAS.md 校验通过 ===' : `\n=== ${fail} 项校验失败 ===`);
process.exit(fail === 0 ? 0 : 1);
