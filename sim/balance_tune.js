// ---------------- 自动平衡脚本 ----------------
// 动态调整各球种数值，让每个球种对全体对手的**平均胜率**落在 35%–65%，
// 并尽量消除 0%/100% 的一边倒对局（机制硬克制的对保持 15%–85% 即可接受）。
//
// 调整范围（严格遵守）：
//   可调：dmgMult（伤害）、cruise（巡航速度）、cdMult（技能CD）
//   固定：maxHp（血量）、r（半径）——脚本绝不修改
//   可用 --tune damage,speed,cd 限定只调其中某几类
//
// 方法：
//   阶段1 标杆迭代：每个球种对阵一组"标杆"能力（默认 12 个代表覆盖 V1–V8 机制；
//   增量模式下标杆 = 全部老球，锁定不动），用平均胜率作为强度分，
//   按阻尼比例调整伤害（伤害到界再用速度/CD），每轮平滑去噪、记录历史最优。
//   阶段2 逐对修复（--pairs N 开启）：只修 0%/100% 级的硬克制对，多轮收敛。
//
// 用法：
//   node sim/balance_tune.js                          # 全量平衡：所有球种互相比（默认）
//   node sim/balance_tune.js --new chemist,tsunami    # 增量平衡：只调新球，老球全部锁定为标杆（以后加新球用这个）
//   node sim/balance_tune.js --n 8 --rounds 20        # 更精细
//   node sim/balance_tune.js --bench pulse,missile    # 自定义标杆（全量模式默认 12 个代表；增量模式默认全部老球）
//   node sim/balance_tune.js --tune damage            # 只调伤害
//   node sim/balance_tune.js --pairs 6                # 额外逐对打磨硬克制对
//   node sim/balance_tune.js --no-verify --no-write   # 只迭代不验证不写文件
//   node sim/balance_tune.js --seed 7                 # 可复现
//
// 输出：balance.json（编辑器「📥 导入」即可应用到游戏）；--verify 附各球种平均胜率 + 硬克制对报告
'use strict';

const fs = require('fs');
const path = require('path');
const h = require('./harness');

// ---------------- 参数 ----------------
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
let N = parseInt(get('n', '6'), 10); if (!isFinite(N) || N < 1) N = 6;                    // 每对场数（非法值回退默认）
let ROUNDS = parseInt(get('rounds', '15'), 10); if (!isFinite(ROUNDS) || ROUNDS < 0) ROUNDS = 15; // 迭代轮数上限（0=跳过阶段1）
const BENCHES = (get('bench', 'pulse,missile,shield,vampire,railgun,curse,coffin,tech1,bond,liquidbag,lance,clone') || '').split(',').filter(Boolean); // 默认标杆覆盖 V1–V8 各机制
const NEW_IDS = has('new') ? (get('new', '') || '').split(',').filter(Boolean) : null; // 增量平衡：只调这些新球，老球锁定
const PAIR_ROUNDS = parseInt(get('pairs', '0'), 10);                              // 逐对修复轮数（默认关闭：达标判定用"对全体对手的平均胜率 35%–65%"；需要逐对打磨时开启）
const FINAL_TUNE = parseInt(get('final', '4'), 10);                                // 阶段1.5：全体平均分精调轮数（0=关闭）
const SEED = has('seed') ? parseInt(get('seed'), 10) : undefined;
const OUT = get('out', path.join(h.ROOT, 'balance.json'));
const VERIFY = !has('no-verify');                                                   // 最终全矩阵验证
const VERIFY_N = parseInt(get('verify-n', '8'), 10);                               // 最终验证每对场数（≥8 才可信，n=3 时一半"硬克制"是噪声）
const WRITE = !has('no-write');
const TUNE = (get('tune', 'damage,speed,cd') || '').split(',').filter(Boolean);     // 允许调整的类别
const MARGIN = 15;                                                                  // 目标 |分-50| ≤ 15（35%–65%）

const TARGET = 50;
const LIMITS = { dmgMult: [0.2, 4], cruise: [100, 800], cdMult: [0.2, 4] };      // 编辑器滑块边界
const TLIMIT = { dmgMult: [0.4, 2.5], cruise: [150, 600], cdMult: [0.5, 2] };       // 自动平衡温和边界（避免调出荒谬值）
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------- 初始化 ----------------
const sim = h.createSandbox({ seed: SEED });
const balPath = get('balance') || (fs.existsSync(path.join(h.ROOT, 'balance.json')) ? path.join(h.ROOT, 'balance.json') : null);
if (balPath) {
  sim.loadBalance(JSON.parse(fs.readFileSync(balPath, 'utf8')));
  console.log(`基于配置: ${balPath}`);
} else {
  console.log('基于: 内置默认（未找到 balance.json）');
}
const ids = sim.abilityIds();
const dt = 1 / 60, maxTime = sim.balance.global.maxTime;

// 调整范围与标杆：
//  - 全量模式（无 --new）：调整全部球种，标杆 = --bench（默认 12 个代表，用默认数值固定，基准稳定）
//  - 增量模式（--new）：只调新球，标杆 = 全部老球（用其当前 balance 配置，锁定不动）——
//    以后加新球用这个：老球永远不被调整
const tuneIds = NEW_IDS ? NEW_IDS.filter(id => ids.includes(id)) : ids.slice();
const benchIds = NEW_IDS
  ? (has('bench') ? BENCHES.filter(id => ids.includes(id) && !NEW_IDS.includes(id)) : ids.filter(id => !NEW_IDS.includes(id)))
  : BENCHES.filter(id => ids.includes(id));
if (!tuneIds.length) { console.error('✗ --new 指定的球种不存在:', NEW_IDS.join(',')); process.exit(1); }
if (!benchIds.length) { console.error('✗ 标杆为空（--new 覆盖了全部球种？）'); process.exit(1); }
const benchCfgs = benchIds.map(id => sim.makeCfg(id, !NEW_IDS)); // 全量：默认数值；增量：老球当前配置

// 记录初始值（报告用，只记会被调整的球种）
const initial = {};
for (const id of tuneIds) initial[id] = { ...sim.balance.abilities[id] };

// ---------------- 评估：某能力 vs 全部标杆的平均胜率 ----------------
function scoreOf(abilityId) {
  const a = sim.makeCfg(abilityId, false); // 跟随 BALANCE 当前配置
  let pts = 0;
  for (const b of benchCfgs) {
    let w = 0, dr = 0;
    for (let k = 0; k < N; k++) {
      const swap = Math.random() < .5;
      const r = sim.runMatch(swap ? b : a, swap ? a : b, { maxTime, dt });
      const wA = r.winner === (swap ? 'right' : 'left');
      if (wA) w++; else if (r.winner === null) dr++;
    }
    pts += (w + dr * .5) / N;
  }
  return pts / benchCfgs.length * 100;
}

// ---------------- 迭代 ----------------
console.log(`${NEW_IDS ? '增量平衡' : '全量平衡'}：调整 ${tuneIds.length} 个球种 · 标杆 ${benchIds.length} 个${NEW_IDS ? '（老球锁定不动）' : '（默认数值）'} · 每对 ${N} 场 | 调参: ${TUNE.join('+')} | 目标 35%–65%`);
console.log('──────────────────────────────────────────────');
const prevScore = new Map();
let best = { outOf: Infinity, balance: null, round: 0 };
const history = [];
let converged = false;

for (let round = 1; round <= ROUNDS; round++) {
  // 增量模式：标杆平均分驱动的阶段 1 只快速起手（2 轮），主要靠阶段 2 逐对修复
  if (NEW_IDS && round > 2) break;
  let out = 0, sum = 0;
  const roundScores = [];
  for (const id of tuneIds) {
    const cur = scoreOf(id);
    const prev = prevScore.get(id);
    const score = prev === undefined ? cur : cur * .6 + prev * .4; // 平滑去噪
    prevScore.set(id, score);
    sum += score;
    roundScores.push({ id, score });
    const err = score - TARGET;
    const outOf = Math.abs(err) > MARGIN;
    if (outOf) out++;
    if (!outOf || round === ROUNDS) continue;

    const st = sim.balance.abilities[id];
    // 主杠杆：伤害（阻尼比例，防阈值过冲）
    if (TUNE.includes('damage')) {
      const ratio = TARGET / Math.max(5, score);
      const factor = clamp(Math.pow(ratio, .6), .72, 1.39);
      const nd = clamp(st.dmgMult * factor, TLIMIT.dmgMult[0], TLIMIT.dmgMult[1]);
      st.dmgMult = nd;
      // 副杠杆：伤害已到界仍越界 → 速度 / CD（弱则提速减 CD，强则反之）
      const atBound = nd <= TLIMIT.dmgMult[0] + 1e-9 || nd >= TLIMIT.dmgMult[1] - 1e-9;
      if (atBound && outOf && (TUNE.includes('speed') || TUNE.includes('cd'))) {
        const spd = TUNE.includes('speed'), cd = TUNE.includes('cd');
        if (err > 0) {
          if (spd) st.cruise = clamp(st.cruise * .97, TLIMIT.cruise[0], TLIMIT.cruise[1]);
          if (cd) st.cdMult = clamp(st.cdMult * 1.03, TLIMIT.cdMult[0], TLIMIT.cdMult[1]);
        } else {
          if (spd) st.cruise = clamp(st.cruise * 1.03, TLIMIT.cruise[0], TLIMIT.cruise[1]);
          if (cd) st.cdMult = clamp(st.cdMult * .97, TLIMIT.cdMult[0], TLIMIT.cdMult[1]);
        }
      }
    } else if (TUNE.includes('speed')) {
      st.cruise = clamp(st.cruise * (err > 0 ? .97 : 1.03), TLIMIT.cruise[0], TLIMIT.cruise[1]);
    } else if (TUNE.includes('cd')) {
      st.cdMult = clamp(st.cdMult * (err > 0 ? 1.03 : .97), TLIMIT.cdMult[0], TLIMIT.cdMult[1]);
    }
  }
  history.push({ round, out, avg: sum / tuneIds.length, min: Math.min(...roundScores.map(s => s.score)), max: Math.max(...roundScores.map(s => s.score)) });
  console.log(`轮 ${round}: 越界 ${out}/${tuneIds.length} · 平均分 ${(sum / tuneIds.length).toFixed(1)} · 范围 ${history[history.length - 1].min.toFixed(0)}–${history[history.length - 1].max.toFixed(0)}`);
  if (out < best.outOf) best = { outOf: out, balance: JSON.parse(JSON.stringify(sim.balance)), round };
  if (out === 0 && round > 1) { converged = true; console.log('✓ 全部达标，提前收敛'); break; }
}

// 回溯历史最优状态（防震荡漂移）
if (best.balance) sim.loadBalance(best.balance);
console.log(`收敛: ${converged ? '是' : '否（达到轮数上限）'} · 最优状态在第 ${best.round} 轮（越界 ${best.outOf === Infinity ? '—（未迭代）' : best.outOf}）`);

// ---------------- 阶段 1.5：全体平均分精调 ----------------
// 阶段 1 用 12 标杆近似，覆盖不全；此阶段评估口径与最终验证完全一致
// （当前配置互打、对全体对手平均分），直接优化验证指标。
// 全量模式专用；增量模式的标杆本来就是全体老球，无需此阶段。
if (FINAL_TUNE > 0 && !NEW_IDS) {
  console.log(`\n=== 阶段 1.5：全体平均分精调（${FINAL_TUNE} 轮 · 每对 ${N} 场，评估口径=最终验证）===`);
  const evalAvg = (targetIds) => {
    const avg = {};
    for (const id of targetIds) avg[id] = { sum: 0, n: 0 };
    const seen = new Set();
    for (const i of targetIds) {
      for (const j of ids) {
        if (i === j) continue;
        const key = [i, j].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = sim.makeCfg(i, false), b = sim.makeCfg(j, false);
        let w = 0, dr = 0;
        for (let k = 0; k < N; k++) {
          const swap = Math.random() < .5;
          const r = sim.runMatch(swap ? b : a, swap ? a : b, { maxTime, dt });
          if (r.winner === (swap ? 'right' : 'left')) w++; else if (r.winner === null) dr++;
        }
        const p = (w + dr * .5) / N * 100;
        avg[i].sum += p; avg[i].n++;
      }
    }
    return avg;
  };
  let targets = ids.slice();
  let bestF = { out: Infinity, balance: null, round: 0 };
  for (let fr = 1; fr <= FINAL_TUNE; fr++) {
    const avg = evalAvg(targets);
    const bad = targets.map(id => ({ id, avg: avg[id].n ? avg[id].sum / avg[id].n : 50 })).filter(x => x.avg < 35 || x.avg > 65);
    console.log(`  精调轮 ${fr}: 平均越界 ${bad.length}/${ids.length}`);
    if (bad.length < bestF.out) bestF = { out: bad.length, balance: JSON.parse(JSON.stringify(sim.balance)), round: fr };
    if (!bad.length) { console.log('  ✓ 全体平均分达标（35%–65%）'); break; }
    const next = new Set();
    for (const x of bad) {
      const st = sim.balance.abilities[x.id];
      const err = x.avg - 50;
      const ratio = TARGET / Math.max(5, x.avg);
      const factor = clamp(Math.pow(ratio, .5), .75, 1.33);
      if (TUNE.includes('damage')) {
        const nd = clamp(st.dmgMult * factor, TLIMIT.dmgMult[0], TLIMIT.dmgMult[1]);
        const atBound = nd <= TLIMIT.dmgMult[0] + 1e-9 || nd >= TLIMIT.dmgMult[1] - 1e-9;
        st.dmgMult = nd;
        if (atBound) { // 伤害到界 → 速度/CD 补充
          if (err > 0) {
            if (TUNE.includes('speed')) st.cruise = clamp(st.cruise * .97, TLIMIT.cruise[0], TLIMIT.cruise[1]);
            if (TUNE.includes('cd')) st.cdMult = clamp(st.cdMult * 1.03, TLIMIT.cdMult[0], TLIMIT.cdMult[1]);
          } else {
            if (TUNE.includes('speed')) st.cruise = clamp(st.cruise * 1.03, TLIMIT.cruise[0], TLIMIT.cruise[1]);
            if (TUNE.includes('cd')) st.cdMult = clamp(st.cdMult * .97, TLIMIT.cdMult[0], TLIMIT.cdMult[1]);
          }
        }
      } else if (TUNE.includes('speed')) {
        st.cruise = clamp(st.cruise * (err > 0 ? .97 : 1.03), TLIMIT.cruise[0], TLIMIT.cruise[1]);
      } else if (TUNE.includes('cd')) {
        st.cdMult = clamp(st.cdMult * (err > 0 ? 1.03 : .97), TLIMIT.cdMult[0], TLIMIT.cdMult[1]);
      }
      next.add(x.id);
    }
    targets = [...next]; // 下轮只评估被调球种相关对（省时）
  }
  // 回溯历史最优（防连锁振荡调坏最优状态）
  if (bestF.balance) sim.loadBalance(bestF.balance);
  console.log(`  最优状态在第 ${bestF.round} 轮（平均越界 ${bestF.out === Infinity ? '—' : bestF.out}）`);
}

// ---------------- 阶段 2：逐对修复 ----------------
// 标杆迭代只约束"对标杆"的平均强度；阶段 2 直接对仍越界的每一对微调弱势方
// （伤害→速度→CD），多轮收敛。同一轮内同一球合并调整，防叠加过冲。
if (PAIR_ROUNDS > 0) {
  console.log(`\n=== 阶段 2：逐对修复（${PAIR_ROUNDS} 轮 · 评估 ${NEW_IDS ? '新球相关对' : '全部两两'} × ${N} 场）===`);
  const pairIds = NEW_IDS ? tuneIds : ids;
  const totalPairs = NEW_IDS
    ? tuneIds.length * ids.length - tuneIds.length * (tuneIds.length + 1) / 2
    : ids.length * (ids.length - 1) / 2;
  // 初筛（低场数快速找候选）+ 复测（高场数确认，消除噪声）
  const evalPairs = (pairs, nn) => {
    const seen = new Set();
    const out = [];
    for (const [ia, ib] of pairs) {
      const key = [ia, ib].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = sim.makeCfg(ia, false), b = sim.makeCfg(ib, false);
      let w = 0, dr = 0;
      for (let k = 0; k < nn; k++) {
        const swap = Math.random() < .5;
        const r = sim.runMatch(swap ? b : a, swap ? a : b, { maxTime, dt });
        const wA = r.winner === (swap ? 'right' : 'left');
        if (wA) w++; else if (r.winner === null) dr++;
      }
      out.push({ a: ia, b: ib, p: (w + dr * .5) / nn * 100 });
    }
    return out;
  };
  const allPairs = [];
  for (const i of pairIds) for (const j of ids) if (i !== j) allPairs.push([i, j]);
  const confirmN = Math.max(N * 4, 16); // 复测场数
  const accMul = (acc, id, k, field) => {
    const e = acc.get(id) || { dmg: 1, cruise: 1, cd: 1 };
    e[field] *= k;
    acc.set(id, e);
  };
  let bestP = { out: Infinity, balance: null, round: 0 };
  let noImprove = 0;
  for (let pr = 1; pr <= PAIR_ROUNDS; pr++) {
    // 初筛全部对 → 复测越界候选（高场数确认，排除噪声）
    const quick = evalPairs(allPairs, N);
    const cands = quick.filter(x => x.p < 35 || x.p > 65).map(x => [x.a, x.b]);
    const pairs = cands.length ? evalPairs(cands, confirmN) : [];
    const bad = pairs.filter(x => x.p < 15 || x.p > 85);              // 只修硬克制（0%/100% 一边倒）；15%–85% 可接受不干预
    const soft = pairs.filter(x => x.p >= 15 && x.p <= 85 && (x.p < 35 || x.p > 65)).length; // 参考：可接受但未达理想
    console.log(`  修复轮 ${pr}: 硬克制 ${bad.length}/${totalPairs}（可接受未达标 ${soft} · 初筛 ${cands.length} 对复测确认）`);
    if (bad.length < bestP.out) bestP = { out: bad.length, balance: JSON.parse(JSON.stringify(sim.balance)), round: pr };
    if (!bad.length) { console.log('  ✓ 无硬克制对（全部 ≥15%，可接受），停止逐对修复'); break; }
    // 无改善检测：连续 3 轮硬克制数不减少 → 调整已达当前参数空间的极限，停止防负优化
    noImprove = bad.length >= bestP.out ? noImprove + 1 : 0;
    if (noImprove >= 3) { console.log('  ↺ 连续 3 轮无改善（剩余硬克制约为机制克制），停止逐对修复'); break; }
    const acc = new Map();
    for (const x of bad) {
      const loser = x.p < 50 ? x.a : x.b;
      const winner = loser === x.a ? x.b : x.a;
      const st = sim.balance.abilities[loser], stW = sim.balance.abilities[winner];
      // 分级步长：越极端调越多；双方同时微调（弱方多调、强方少调）
      const gap = Math.min(1, Math.abs(x.p - 50) / 50); // 0..1：偏离程度
      const loseK = 1 + .25 * gap, winK = 1 - .12 * gap;
      if (TUNE.includes('damage')) {
        if (st.dmgMult < TLIMIT.dmgMult[1] - 1e-9) accMul(acc, loser, loseK, 'dmg');
        else if (TUNE.includes('speed') && st.cruise < TLIMIT.cruise[1] - 1e-9) accMul(acc, loser, 1 + .05 * gap, 'cruise');
        else if (TUNE.includes('cd') && st.cdMult > TLIMIT.cdMult[0] + 1e-9) accMul(acc, loser, 1 - .05 * gap, 'cd');
        if (stW.dmgMult > TLIMIT.dmgMult[0] + 1e-9) accMul(acc, winner, winK, 'dmg');
        else if (TUNE.includes('speed') && stW.cruise > TLIMIT.cruise[0] + 1e-9) accMul(acc, winner, 1 - .03 * gap, 'cruise');
        else if (TUNE.includes('cd') && stW.cdMult < TLIMIT.cdMult[1] - 1e-9) accMul(acc, winner, 1 + .03 * gap, 'cd');
      } else if (TUNE.includes('speed')) {
        if (st.cruise < TLIMIT.cruise[1] - 1e-9) accMul(acc, loser, 1 + .06 * gap, 'cruise');
        if (stW.cruise > TLIMIT.cruise[0] + 1e-9) accMul(acc, winner, 1 - .04 * gap, 'cruise');
      } else if (TUNE.includes('cd')) {
        if (st.cdMult > TLIMIT.cdMult[0] + 1e-9) accMul(acc, loser, 1 - .06 * gap, 'cd');
        if (stW.cdMult < TLIMIT.cdMult[1] - 1e-9) accMul(acc, winner, 1 + .04 * gap, 'cd');
      }
    }
    for (const [id, e] of acc) {
      const st = sim.balance.abilities[id];
      if (TUNE.includes('damage') && e.dmg !== 1) st.dmgMult = clamp(st.dmgMult * e.dmg, TLIMIT.dmgMult[0], TLIMIT.dmgMult[1]);
      if (TUNE.includes('speed') && e.cruise !== 1) st.cruise = clamp(st.cruise * e.cruise, TLIMIT.cruise[0], TLIMIT.cruise[1]);
      if (TUNE.includes('cd') && e.cd !== 1) st.cdMult = clamp(st.cdMult * e.cd, TLIMIT.cdMult[0], TLIMIT.cdMult[1]);
    }
  }
  if (bestP.balance) sim.loadBalance(bestP.balance);
  console.log(`  最优状态在第 ${bestP.round} 轮（越界对 ${bestP.out}）`);
}

// ---------------- 报告：调整内容 ----------------
console.log('\n=== 调整内容（仅 伤害/速度/CD；血量、半径未动）===');
let changed = 0;
for (const id of tuneIds) {
  const a = initial[id], b = sim.balance.abilities[id];
  const parts = [];
  if (b.dmgMult !== a.dmgMult) parts.push(`伤害 ${a.dmgMult.toFixed(2)}→${b.dmgMult.toFixed(2)}`);
  if (b.cruise !== a.cruise) parts.push(`速度 ${a.cruise}→${b.cruise}`);
  if (b.cdMult !== a.cdMult) parts.push(`CD ${a.cdMult.toFixed(2)}→${b.cdMult.toFixed(2)}`);
  if (parts.length) { changed++; console.log(`  ${sim.abilityName(id).padEnd(22)} ${parts.join(' · ')}`); }
}
console.log(changed ? `共调整 ${changed} 个球种` : '无需调整');

// ---------------- 最终验证：各球种平均胜率 + 硬克制对清单 ----------------
// 达标判定：每个球种对全体对手的平均胜率 ∈ [35, 65]（多轮多对手的平均值即可，不要求每对达标）
// 全量模式：全部两两；增量模式：只测新球参与的对（老球之间未动，无需重测）
if (VERIFY) {
  const verifyIds = NEW_IDS ? tuneIds : ids;
  const totalPairs = NEW_IDS
    ? tuneIds.length * ids.length - tuneIds.length * (tuneIds.length + 1) / 2
    : ids.length * (ids.length - 1) / 2;
  console.log(`\n=== 最终验证（${verifyIds.length} × ${ids.length} 相关对 × ${VERIFY_N} 场，约 ${(totalPairs * VERIFY_N * 0.04 / 60).toFixed(1)} 分钟）===`);
  const mkCfg = id => sim.makeCfg(id, false); // 验证用当前 BALANCE 配置
  const avg = {}; ids.forEach(id => avg[id] = { sum: 0, n: 0 });
  const outPairs = [];
  const t0 = Date.now();
  let done = 0;
  const seen = new Set();
  for (const i of verifyIds) {
    for (const j of ids) {
      if (i === j) continue;
      const key = [i, j].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = mkCfg(i), b = mkCfg(j);
      let w = 0, dr = 0;
      for (let k = 0; k < VERIFY_N; k++) {
        const swap = Math.random() < .5;
        const r = sim.runMatch(swap ? b : a, swap ? a : b, { maxTime, dt });
        const wA = r.winner === (swap ? 'right' : 'left');
        if (wA) w++; else if (r.winner === null) dr++;
      }
      const p = (w + dr * .5) / VERIFY_N * 100;
      avg[i].sum += p; avg[i].n++;
      if (p < 15 || p > 85) outPairs.push({ a: i, b: j, p });
      done++;
    }
    if (done % 100 === 0) process.stdout.write(`\r  进度 ${done}/${totalPairs}`);
  }
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
  // 只报告被调整球种的平均胜率（增量模式下老球未动，其"对新球"的胜率无统计意义）
  const rows = (NEW_IDS ? tuneIds : ids).map(id => ({ id, avg: avg[id].n ? avg[id].sum / avg[id].n : 50 })).sort((x, y) => x.avg - y.avg);
  const badAvg = rows.filter(r => r.avg < 35 || r.avg > 65);
  console.log(`验证完成（${((Date.now() - t0) / 1000).toFixed(0)}s）· 平均胜率越界球种 ${badAvg.length}/${rows.length} · 硬克制对 ${outPairs.length}/${totalPairs}`);
  console.log('--- 各球种平均胜率（对全体对手）---');
  for (const r of rows) {
    const mark = r.avg < 35 || r.avg > 65 ? (r.avg < 35 ? '🔴 偏弱' : '🔴 偏强') : '🟢';
    console.log(`  ${mark} ${sim.abilityName(r.id).padEnd(18)} ${r.avg.toFixed(1)}%`);
  }
  if (outPairs.length) {
    console.log(`--- 硬克制对 ${outPairs.length} 对（0%/100% 级，数值难修复，多为机制克制）---`);
    for (const o of outPairs.slice(0, 25)) {
      console.log(`  ${sim.abilityName(o.a).padEnd(18)} vs ${sim.abilityName(o.b).padEnd(18)} ${o.p.toFixed(0)}%`);
    }
    if (outPairs.length > 25) console.log(`  …还有 ${outPairs.length - 25} 对`);
  } else {
    console.log('✓ 无硬克制对');
  }
}

// ---------------- 写回 ----------------
if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify(sim.balance, null, 2), 'utf8');
  console.log(`\n✓ 已写入 ${OUT} —— 在数值编辑器中「📥 导入」即可应用到游戏（或模拟器 --balance ${OUT}）`);
} else {
  console.log('\n（--no-write 未写文件）');
}
