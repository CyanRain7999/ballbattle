// ---------------- 数值配置层 ----------------
// 全局平衡倍率 + 每个球种（能力）一套数值。
// 默认值 = 游戏原有硬编码数值：不做任何配置时，战斗行为与之前完全一致。
//
// 结构：
//   global:     全局倍率（作用于所有球）
//   abilities:  按能力 id 索引的每球种数值——游戏中任何使用该能力的球都采用这套数值。
//               编辑器里选"药剂师"改的就是所有药剂师球的数值。
//
// 每球种倍率说明（与全局同名参数乘算，默认 1 不影响全局调节）：
//   dmgMult     该球造成的所有伤害总倍率
//   skillMult   该球技能/投射物/DoT 伤害倍率（碰撞之外）
//   collideMult 该球碰撞伤害倍率
//   healMult    该球受到的回复/吸血倍率（纳米修复、吸血鬼、药水回复等）
//   cdMult      该球技能冷却倍率（仅初始 maxCd，能力自身动态 CD 不受影响）
//
// 持久化：localStorage['orb_balance_v1']（游戏与编辑器同源共享）
// 导出：  balance.json（模拟器 sim/simulate.js 读取）
//
// 注意：BALANCE 用顶层 var 声明，是为了让 headless 沙箱（sim/harness.js）
// 能够通过 sandbox.BALANCE = xxx 注入自定义数值。浏览器中 var 与 let 等价可用。

'use strict';

const BALANCE_KEY = 'orb_balance_v1';

// 单球种默认数值（= 游戏原始硬编码）
const AB_DEFAULT_STATS = { maxHp: 400, r: 50, cruise: 300, dmgMult: 1, skillMult: 1, collideMult: 1, healMult: 1, cdMult: 1 };

const BALANCE_DEFAULTS = {
  global: {
    dmgMult: 1.5,    // 全局基础伤害倍率（原硬编码：全局伤害 +50%）
    skillMult: 1,    // 技能 / 投射物 / DoT 伤害倍率（碰撞之外的伤害）
    collideMult: 1,  // 碰撞伤害倍率（撞击结算的伤害）
    healMult: 1,     // 回复 / 吸血倍率（纳米修复、吸血鬼、药水回复、传送门+血等）
    speedMult: 1,    // 巡航速度倍率（球自然回归的飞行速度）
    cdMult: 1,       // 技能冷却倍率（仅作用于初始 maxCd，能力自身的动态 CD 不受影响）
    maxTime: 120,    // 超时秒数：到时按剩余血量比例判胜
  },
  // 每个能力（球种）一套数值；ABILITIES 来自 data.js（加载顺序：data.js → balance.js）
  abilities: Object.fromEntries(ABILITIES.map(a => [a.id, { ...AB_DEFAULT_STATS }])),
};

// 深合并：以 defaults 为骨架，用 saved 覆盖已有键（忽略未知键，容错旧版本数据）
// 数值字段做 isFinite 校验，防止 localStorage 坏值导致 NaN 传播
function deepMerge(defaults, saved) {
  const out = Array.isArray(defaults) ? [] : {};
  for (const k of Object.keys(defaults)) {
    const dv = defaults[k], sv = saved && saved[k];
    if (dv && typeof dv === 'object') out[k] = deepMerge(dv, sv);
    else if (typeof dv === 'number') out[k] = (typeof sv === 'number' && isFinite(sv)) ? sv : dv;
    else out[k] = sv === undefined || sv === null ? dv : sv;
  }
  return out;
}

// 旧版数据迁移：v1 结构按球位（orbs.left/right/p2/p3）→ 新版按能力（abilities）
// 映射：left→pulse、right→shield、p2→missile、p3→ghost（旧版各球位默认能力）
function migrateLegacy(saved) {
  if (!saved || typeof saved !== 'object' || saved.abilities) return saved;
  if (!saved.orbs || typeof saved.orbs !== 'object') return saved;
  const map = { left: 'pulse', right: 'shield', p2: 'missile', p3: 'ghost' };
  const newAb = {};
  for (const [side, st] of Object.entries(saved.orbs)) {
    const ab = map[side];
    if (ab && st && typeof st === 'object') {
      const clean = {};
      for (const k of Object.keys(AB_DEFAULT_STATS)) if (st[k] !== undefined) clean[k] = st[k];
      if (Object.keys(clean).length) newAb[ab] = clean;
    }
  }
  if (!Object.keys(newAb).length) return saved;
  const out = { ...saved };
  delete out.orbs;
  out.abilities = newAb;
  try { localStorage.setItem(BALANCE_KEY, JSON.stringify(deepMerge(BALANCE_DEFAULTS, out))); } catch (e) { /* 迁移失败不阻塞 */ }
  return out;
}

function loadBalance() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(BALANCE_KEY) || 'null'); } catch (e) { saved = null; }
  return deepMerge(BALANCE_DEFAULTS, migrateLegacy(saved));
}

// 全局配置（var：允许 headless 沙箱覆写注入）
var BALANCE = loadBalance();

// 取某球种（能力）的实际数值（缺失字段回退默认，兼容手工删字段的 JSON）
// over：可选显式覆盖（模拟器传入自定义 stats），为空则读 BALANCE.abilities[ability]
function orbStats(ability, over) {
  const o = over || (BALANCE.abilities && BALANCE.abilities[ability]) || {};
  const num = (v, dv) => (typeof v === 'number' && isFinite(v)) ? v : dv;
  return {
    maxHp: num(o.maxHp, AB_DEFAULT_STATS.maxHp),
    r: num(o.r, AB_DEFAULT_STATS.r),
    cruise: num(o.cruise, AB_DEFAULT_STATS.cruise),
    dmgMult: num(o.dmgMult, AB_DEFAULT_STATS.dmgMult),
    skillMult: num(o.skillMult, AB_DEFAULT_STATS.skillMult),
    collideMult: num(o.collideMult, AB_DEFAULT_STATS.collideMult),
    healMult: num(o.healMult, AB_DEFAULT_STATS.healMult),
    cdMult: num(o.cdMult, AB_DEFAULT_STATS.cdMult),
  };
}

function saveBalance() {
  try { localStorage.setItem(BALANCE_KEY, JSON.stringify(BALANCE)); return true; }
  catch (e) { console.warn('保存数值配置失败:', e); return false; }
}

// 导出的 JSON 字符串（模拟器 / 备份用）
function exportBalanceJSON() {
  return JSON.stringify(BALANCE, null, 2);
}

// 导入 JSON 字符串并应用到 BALANCE（不自动保存）
function importBalanceJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('配置格式错误');
  BALANCE = deepMerge(BALANCE_DEFAULTS, migrateLegacy(data));
  return true;
}

function resetBalance() {
  BALANCE = deepMerge(BALANCE_DEFAULTS, null);
}
