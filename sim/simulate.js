// ---------------- 批量战斗模拟 · 胜率统计 ----------------
// 用法：
//   node sim/simulate.js --a pulse --b missile --n 500          # 能力直选（默认数值）
//   node sim/simulate.js --a left --b right --n 300 --balance balance.json   # 编辑器配置
//   node sim/simulate.js --matrix --n 20 --csv matrix.csv       # 全能力两两矩阵
//   node sim/simulate.js --matrix --bench shield --n 100        # 所有能力 vs 基准能力
//   node sim/simulate.js --mode 4 --n 200                       # 4P 混战（left/right/p2/p3）
//   node sim/simulate.js --a file:myBuild.json --b file:other.json
//
// 选项：
//   --a <cfg>     A 方：球位名(left/right/p2/p3) | 能力 id | file:路径.json
//   --b <cfg>     B 方（同上）
//   --n <N>       每对模拟场数（1v1 默认 200，矩阵默认 10）
//   --balance <f> 数值配置 JSON（编辑器导出），默认自动读取 ./balance.json
//   --seed <N>    随机种子（可复现）
//   --max-time <s> 覆盖超时秒数
//   --mode <2|3|4> 混战模式（忽略 --a/--b）
//   --matrix      全能力两两对阵；--bench <id> 固定 B 为基准能力
//   --csv <file>  矩阵结果另存 CSV
'use strict';

const fs = require('fs');
const path = require('path');
const h = require('./harness');

// ---------------- 参数解析 ----------------
function parseArgs(argv) {
  const get = (k, d) => {
    const i = argv.indexOf('--' + k);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
  };
  const has = k => argv.includes('--' + k);
  return {
    a: get('a'), b: get('b'),
    n: parseInt(get('n', ''), 10),
    balance: get('balance'),
    seed: has('seed') ? parseInt(get('seed'), 10) : undefined,
    maxTime: has('max-time') ? parseFloat(get('max-time')) : null,
    mode: has('mode') ? parseInt(get('mode'), 10) : 2,
    matrix: has('matrix'),
    bench: get('bench'),
    csv: get('csv'),
    quiet: has('quiet'),
  };
}

// ---------------- 配置解析 ----------------
const SIDES = ['left', 'right', 'p2', 'p3'];

function isSide(s) { return SIDES.includes(s); }

// 能力 id 直选：默认数值 + 指定能力
function cfgFromAbility(sim, ability) {
  return sim.makeCfg(ability, true);
}

// 球位引用：编辑器配置的数值 + 能力（快照 stats，保证换位模拟时数值不串位）
function cfgFromSide(sim, side) {
  return sim.makeCfgFixed(side);
}

// JSON 文件：{ ability, maxHp, r, cruise, dmgMult, skillMult, collideMult, healMult, cdMult, name? } 或 { ability, stats: {...} }
function cfgFromFile(sim, file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || typeof data !== 'object') throw new Error(file + ' 不是有效 JSON 对象');
  if (data.global || data.orbs) {
    throw new Error(file + ' 是完整 balance 配置（含 global/orbs），请用 --balance 指定，而不是 --a/--b');
  }
  const ability = data.ability || 'pulse';
  const raw = data.stats || data;
  const stats = {
    maxHp: raw.maxHp, r: raw.r, cruise: raw.cruise,
    dmgMult: raw.dmgMult, skillMult: raw.skillMult, collideMult: raw.collideMult,
    healMult: raw.healMult, cdMult: raw.cdMult,
  };
  return {
    name: raw.name || 'CUSTOM',
    color: { name: '离子青', main: '#00e5ff', bright: '#8df6ff' },
    decor: 'ring',
    ability,
    stats,
  };
}

function parseCfg(sim, spec, defSide) {
  if (!spec) return cfgFromSide(sim, defSide);
  if (spec.startsWith('file:')) return cfgFromFile(sim, spec.slice(5));
  if (isSide(spec)) return cfgFromSide(sim, spec);
  // 能力 id
  const ids = sim.abilityIds();
  if (ids.includes(spec)) return cfgFromAbility(sim, spec);
  throw new Error('无法识别的配置: ' + spec + '（应为 球位名/能力 id/file:路径）');
}

function loadBalanceFile(p) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!data || typeof data !== 'object' || !data.global) {
    throw new Error(p + ' 不是有效的 balance 配置（缺少 global 字段），请用编辑器导出');
  }
  return data;
}

// ---------------- 统计 ----------------（按 A/B 配置归并，已消除左右位置偏差）
function tally(results, names) {
  const win = { A: 0, B: 0 };
  let draw = 0, timeSum = 0, kill = 0;
  let hpSum = { A: 0, B: 0 };
  for (const r of results) {
    if (r.winner === 'A') win.A++;
    else if (r.winner === 'B') win.B++;
    else draw++;
    timeSum += r.time;
    if (r.over) kill++;
    hpSum.A += r.hpA; hpSum.B += r.hpB;
  }
  const n = results.length;
  return {
    n, win, draw,
    avgTime: timeSum / n,
    killRate: kill / n * 100,
    avgHp: { A: hpSum.A / n * 100, B: hpSum.B / n * 100 },
    names,
  };
}

function bar(pct, width = 18) {
  const full = Math.round(pct / 100 * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
}

function printTally(t, labelA, labelB) {
  const pctA = t.win.A / t.n * 100, pctB = t.win.B / t.n * 100, pctD = t.draw / t.n * 100;
  console.log(`模拟 ${t.n} 场 · 平均时长 ${t.avgTime.toFixed(1)}s · 提前击杀率 ${t.killRate.toFixed(1)}%`);
  console.log('──────────────────────────────────────────────');
  console.log(`${labelA}  胜 ${t.win.A} 场  ${pctA.toFixed(1).padStart(5)}%  ${bar(pctA)}  均剩 ${t.avgHp.A.toFixed(0)}%`);
  console.log(`${labelB}  胜 ${t.win.B} 场  ${pctB.toFixed(1).padStart(5)}%  ${bar(pctB)}  均剩 ${t.avgHp.B.toFixed(0)}%`);
  if (t.draw) console.log(`平局 ${t.draw} 场  ${pctD.toFixed(1).padStart(5)}%`);
}

// ---------------- 主流程 ----------------
function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  // 数值配置
  let balance = null, balanceSrc = '内置默认（未找到 balance.json）';
  const balPath = args.balance || (fs.existsSync(path.join(h.ROOT, 'balance.json')) ? path.join(h.ROOT, 'balance.json') : null);
  if (balPath) {
    balance = loadBalanceFile(balPath);
    balanceSrc = balPath;
  }

  const sim = h.createSandbox({ seed: args.seed, balance });
  if (args.maxTime) sim.balance.global.maxTime = args.maxTime;
  const dt = 1 / 60;
  const maxTime = sim.balance.global.maxTime;

  const cfgLabel = c => {
    const nm = sim.abilityName(c.ability);
    const s = c.stats || sim.balance.abilities[c.ability] || { maxHp: '?', r: '?', cruise: '?', dmgMult: '?', cdMult: '?' };
    return `[${nm}] ${c.name || '?'}  HP${s.maxHp} R${s.r} V${s.cruise} D×${s.dmgMult} CD×${s.cdMult}`;
  };

  console.log(`━━ 球斗竞技场 · 批量胜率模拟 ━━`);
  console.log(`数值配置: ${balanceSrc} | 场地 720×720 | 超时 ${maxTime}s | 种子 ${args.seed !== undefined ? args.seed : '无(真随机)'}`);

  // ---- 混战模式 ----
  if (args.mode >= 3) {
    const n = args.mode;
    const sides = SIDES.slice(0, n);
    const cfgs = sides.map(side => cfgFromSide(sim, side));
    const N = args.n || 200;
    console.log(`混战 ${n}P：${sides.map(s => s + '(' + sim.abilityName(sim.makeCfgFixed(s).ability) + ')').join(' · ')}`);
    console.log('──────────────────────────────────────────────');
    const winCount = {};
    sides.forEach(s => winCount[s] = 0);
    let draw = 0, timeSum = 0;
    for (let i = 0; i < N; i++) {
      const r = sim.runMatchN(cfgs, { maxTime, dt });
      if (r.winner) winCount[r.winner]++; else draw++;
      timeSum += r.time;
    }
    for (const s of sides) {
      const pct = winCount[s] / N * 100;
      console.log(`${s.padEnd(6)} 胜 ${String(winCount[s]).padStart(4)} 场  ${pct.toFixed(1).padStart(5)}%  ${bar(pct)}`);
    }
    if (draw) console.log(`平局/多人存活 ${draw} 场  ${(draw / N * 100).toFixed(1)}%`);
    console.log(`平均时长 ${(timeSum / N).toFixed(1)}s`);
    console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return;
  }

  // ---- 矩阵模式 ----
  if (args.matrix) {
    const ids = sim.abilityIds();
    const bench = args.bench;
    const N = args.n || 10;
    if (!args.quiet) console.log(`矩阵模式：${ids.length} 能力 × ${ids.length} 能力 × ${N} 场 = ${ids.length * ids.length * N} 场（${bench ? 'B 固定 ' + bench + ' → 实际 ' + ids.length * N + ' 场' : ''}）预计 ${((ids.length * ids.length * N * 0.04) / 60).toFixed(1)} 分钟…`);
    const m = ids.map(() => new Array(ids.length).fill(0)); // m[i][j] = i 胜 j 的场数
    let done = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (bench && ids[j] !== bench) continue;
        const a = cfgFromAbility(sim, ids[i]);
        const b = cfgFromAbility(sim, ids[j]);
        for (let k = 0; k < N; k++) {
          // 每场随机换位：消除 left 先手/击退位置偏差，胜率归到配置本身
          const swap = Math.random() < .5;
          const r = sim.runMatch(swap ? b : a, swap ? a : b, { maxTime, dt });
          if (r.winner === (swap ? 'right' : 'left')) m[i][j]++;
        }
        done++;
      }
      if (!args.quiet) process.stdout.write(`\r  进度 ${done}/${bench ? ids.length : ids.length * ids.length}`);
    }
    if (!args.quiet) process.stdout.write('\r' + ' '.repeat(40) + '\r');

    // 摘要：平均胜率排序
    const rows = ids.map((id, i) => {
      let sum = 0, cnt = 0, best = null, bestP = -1, worst = null, worstP = 101;
      for (let j = 0; j < ids.length; j++) {
        if (bench && ids[j] !== bench) continue;
        const p = m[i][j] / N * 100;
        sum += p; cnt++;
        if (j !== i) {
          if (p > bestP) { bestP = p; best = ids[j]; }
          if (p < worstP) { worstP = p; worst = ids[j]; }
        }
      }
      return { id, avg: sum / cnt, best, bestP, worst, worstP };
    }).sort((x, y) => y.avg - x.avg);

    console.log(`能力强度排行（对 ${bench ? '基准 [' + sim.abilityName(bench) + ']' : '全部对手'} 的平均胜率，各 ${N} 场）`);
    console.log('──────────────────────────────────────────────');
    for (const r of rows) {
      console.log(`${r.avg.toFixed(1).padStart(5)}%  ${bar(r.avg, 26)}  ${sim.abilityName(r.id).padEnd(24)} 克 ${sim.abilityName(r.best)} ${r.bestP.toFixed(0)}% · 怕 ${sim.abilityName(r.worst)} ${r.worstP.toFixed(0)}%`);
    }
    if (args.csv) {
      const csv = ['能力,' + ids.map(id => sim.abilityName(id)).join(',')]
        .concat(ids.map((id, i) => sim.abilityName(id) + ',' + ids.map((_, j) => (m[i][j] / N * 100).toFixed(1)).join(',')));
      fs.writeFileSync(args.csv, '\uFEFF' + csv.join('\n'), 'utf8');
      console.log(`完整矩阵已存 ${args.csv}`);
    }
    console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return;
  }

  // ---- 1v1 模式 ----
  const cfgA = parseCfg(sim, args.a, 'left');
  const cfgB = parseCfg(sim, args.b, 'right');
  const N = args.n || 200;
  console.log(`A: ${cfgLabel(cfgA)}`);
  console.log(`B: ${cfgLabel(cfgB)}`);
  console.log('（每场随机交换左右位置，消除位置先手偏差）');
  const results = [];
  for (let i = 0; i < N; i++) {
    const swap = Math.random() < .5;
    const r = sim.runMatch(swap ? cfgB : cfgA, swap ? cfgA : cfgB, { maxTime, dt });
    const w = r.winner === 'left' ? (swap ? 'B' : 'A') : r.winner === 'right' ? (swap ? 'A' : 'B') : null;
    results.push({ winner: w, time: r.time, over: r.over, hpA: r.hp[swap ? 1 : 0], hpB: r.hp[swap ? 0 : 1] });
  }
  printTally(tally(results), 'A 方', 'B 方');
  console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

try { main(); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
