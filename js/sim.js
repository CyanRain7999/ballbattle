// ---------------- 图形化胜率模拟器 ----------------
// 纯前端：直接加载游戏的 core/data/balance/effects/entities/battle 逻辑，
// 用假定时器 + 固定场地做 headless 批量模拟（与 sim/simulate.js 同引擎、同行为）。
'use strict';

// $ 由 core.js 提供（const $ = s => document.querySelector(s)）

// ---------------- 常量 ----------------
const SIDES = ['left', 'right', 'p2', 'p3'];
const ORB_FIELDS = [
  { key: 'maxHp',      label: '生命值',        min: 50,  max: 3000, step: 10,   unit: '',  fmt: v => String(v) },
  { key: 'r',          label: '半径',          min: 20,  max: 120,  step: 1,    unit: 'px', fmt: v => String(v) },
  { key: 'cruise',     label: '巡航速度',      min: 100, max: 800,  step: 5,    unit: '',  fmt: v => String(v) },
  { key: 'dmgMult',    label: '伤害总倍率',    min: 0.2, max: 4,    step: 0.05, unit: '×', fmt: v => v.toFixed(2) },
  { key: 'skillMult',  label: '技能伤害倍率',  min: 0.2, max: 4,    step: 0.05, unit: '×', fmt: v => v.toFixed(2) },
  { key: 'collideMult',label: '碰撞伤害倍率',  min: 0.2, max: 4,    step: 0.05, unit: '×', fmt: v => v.toFixed(2) },
  { key: 'healMult',   label: '回复/吸血倍率', min: 0,   max: 4,    step: 0.05, unit: '×', fmt: v => v.toFixed(2) },
  { key: 'cdMult',     label: '技能CD倍率',    min: 0.2, max: 4,    step: 0.05, unit: '×', fmt: v => v.toFixed(2) },
];
const AB_NAMES = ABILITIES.map(a => ({ id: a.id, label: a.icon + ' ' + a.name }));
const abLabel = id => (AB_NAMES.find(a => a.id === id) || { label: id }).label;

// ---------------- 模拟引擎（与 Node 版同行为） ----------------
function buildBattle(cfgs) {
  const F = fieldRect();
  const n = cfgs.length;
  const sides = SIDES.slice(0, n);
  const orbs = cfgs.map((cfg, i) => makeOrb(sides[i], cfg));
  for (let i = 0; i < n; i++) {
    const o = orbs[i];
    const ang0 = i / n * TAU - Math.PI / 2;
    const cx = F.x + F.s / 2, cy = F.y + F.s / 2;
    const rr = F.s * (n === 2 ? .26 : .3);
    const sp = o.stats.cruise * BALANCE.global.speedMult;
    o.x = cx + Math.cos(ang0) * rr; o.y = cy + Math.sin(ang0) * rr;
    const outA = ang0 + rand(-.9, .9);
    o.vx = Math.cos(outA) * sp; o.vy = Math.sin(outA) * sp;
  }
  battle = { orbs, left: orbs[0], right: orbs[1] || null, proj: [], fx: [], structs: [], time: 0, shake: 0, over: false, winner: null, paused: false, ambient: [], mode: n };
}

function runMatch(cfgA, cfgB, maxTime, dt) {
  simActive = true; simNow = 0; simTimers.length = 0;
  try {
    buildBattle([cfgA, cfgB]);
    const limit = maxTime || BALANCE.global.maxTime || 120;
    let guard = 0;
    while (!battle.over && battle.time < limit && guard++ < Math.ceil(limit / dt) + 180) {
      simTick(dt);
      updateBattle(dt);
    }
    return {
      winner: battle.winner ? battle.winner.side : null,
      time: battle.time, over: battle.over,
      hp: battle.orbs.map(o => Math.max(0, o.hp) / o.maxHp),
    };
  } finally {
    simActive = false; // 异常也必须复位，否则页面 setTimeout 全被假定时器吞掉
  }
}

function runMatchN(cfgs, maxTime, dt) {
  simActive = true; simNow = 0; simTimers.length = 0;
  try {
    buildBattle(cfgs);
    const limit = maxTime || BALANCE.global.maxTime || 120;
    let guard = 0;
    while (!battle.over && battle.time < limit && guard++ < Math.ceil(limit / dt) + 180) {
      simTick(dt);
      updateBattle(dt);
    }
    return {
      winner: battle.winner ? battle.winner.side : null,
      time: battle.time, over: battle.over,
      hp: battle.orbs.map(o => Math.max(0, o.hp) / o.maxHp),
    };
  } finally {
    simActive = false;
  }
}

// ---------------- UI：面板构建 ----------------
let mode = '1v1';
let cancelFlag = false;

function fillAbilitySelect(sel, current) {
  sel.innerHTML = AB_NAMES.map(a => `<option value="${a.id}" ${a.id === current ? 'selected' : ''}>${a.label}</option>`).join('');
}

function buildSliders(host, values) {
  host.innerHTML = '';
  ORB_FIELDS.forEach(f => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    wrap.innerHTML = `
      <span class="fname">${f.label}</span>
      <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${values[f.key]}">
      <span class="fval"></span>`;
    host.appendChild(wrap);
    const input = wrap.querySelector('input'), val = wrap.querySelector('.fval');
    const refresh = () => { val.textContent = f.fmt(parseFloat(input.value)) + f.unit; };
    input.oninput = refresh;
    refresh();
  });
}

function readPanel(side) { // side: 'A' | 'B'，从 DOM 读取当前配置（快照 stats）
  const sel = $('#' + side + '-ability');
  const host = $('#' + side + '-sliders');
  const stats = {};
  ORB_FIELDS.forEach((f, i) => {
    const input = host.querySelectorAll('input[type=range]')[i];
    stats[f.key] = parseFloat(input.value);
  });
  const nm = $('#' + side + '-name').value.trim() || (side === 'A' ? 'PLAYER-A' : 'PLAYER-B');
  const color = COLORS[side === 'A' ? 0 : 1];
  return { name: nm, color, decor: 'ring', ability: sel.value, stats };
}

// 球位 → 默认能力（与游戏选择屏各球位默认一致）
const SIDE_AB = { left: 'pulse', right: 'shield', p2: 'missile', p3: 'ghost' };

function initPanels() {
  const stA = orbStats(SIDE_AB.left), stB = orbStats(SIDE_AB.right);
  fillAbilitySelect($('#A-ability'), SIDE_AB.left);
  fillAbilitySelect($('#B-ability'), SIDE_AB.right);
  $('#A-name').value = stA.name || SIDE_AB.left;
  $('#B-name').value = stB.name || SIDE_AB.right;
  buildSliders($('#A-sliders'), stA);
  buildSliders($('#B-sliders'), stB);
  // 切换能力 → 滑块刷新为该球种的配置数值
  $('#A-ability').onchange = e => {
    const st = orbStats(e.target.value);
    $('#A-name').value = st.name || e.target.value;
    buildSliders($('#A-sliders'), st);
  };
  $('#B-ability').onchange = e => {
    const st = orbStats(e.target.value);
    $('#B-name').value = st.name || e.target.value;
    buildSliders($('#B-sliders'), st);
  };
  // 混战球位：默认能力 + 该球种配置摘要；切换能力 → 摘要刷新
  const grid = $('#brawl-grid');
  grid.innerHTML = '';
  SIDES.forEach(s => {
    const st = orbStats(SIDE_AB[s]);
    const row = document.createElement('div');
    row.className = 'brawl-row';
    row.innerHTML = `
      <span class="brawl-side">${s}</span>
      <select id="br-${s}"></select>
      <span class="brawl-sum"></span>`;
    grid.appendChild(row);
    const sel = row.querySelector('select');
    const sum = row.querySelector('.brawl-sum');
    const refresh = () => {
      const st2 = orbStats(sel.value);
      sum.textContent = `${st2.name || sel.value} · HP${st2.maxHp} · R${st2.r} · V${st2.cruise} · D×${st2.dmgMult} · CD×${st2.cdMult}`;
    };
    fillAbilitySelect(sel, SIDE_AB[s]);
    sel.onchange = refresh;
    refresh();
  });
}

// ---------------- 模式切换 ----------------
function setMode(m) {
  mode = m;
  document.querySelectorAll('#mode-switch .mode-btn').forEach(b => b.classList.toggle('sel', b.dataset.mode === m));
  $('#duo').style.display = (m === '1v1' || m === 'rank') ? 'grid' : 'none';
  $('#brawl-panel').style.display = m === 'brawl' ? 'block' : 'none';
  $('#matrix-hint').style.display = m === 'matrix' ? 'block' : 'none';
  // 排行模式：A 面板禁用（自动遍历），B 为基准
  const aPanel = $('#panel-A');
  aPanel.style.opacity = m === 'rank' ? .45 : 1;
  aPanel.querySelectorAll('select, input').forEach(el => el.disabled = m === 'rank');
  $('#hint-A').textContent = m === 'rank' ? '（排行模式：自动遍历全部能力）' : '（左侧）';
  $('#hint-B').textContent = m === 'rank' ? '（基准对手）' : '（右侧）';
  $('#result-card').style.display = 'none';
}

// ---------------- 批量运行 ----------------
function setProgress(p) {
  $('#progress').style.width = (p * 100).toFixed(1) + '%';
  $('#pct').textContent = (p * 100).toFixed(0) + '%';
}

// 分块批量跑：每 10 场让出主线程刷新 UI；返回 { cnt, sec }
async function runBatch(total, stepFn) {
  cancelFlag = false;
  $('#btn-run').style.display = 'none';
  $('#btn-cancel').style.display = 'inline-block';
  setProgress(0);
  const t0 = performance.now();
  let cnt = 0;
  try {
    for (let i = 0; i < total; i++) {
      if (cancelFlag) break;
      stepFn(i);
      cnt = i + 1;
      if (cnt % 10 === 0 || cnt === total) {
        setProgress(cnt / total);
        await new Promise(r => origSetTimeout(r, 0));
      }
    }
  } finally {
    $('#btn-run').style.display = '';
    $('#btn-cancel').style.display = 'none';
  }
  return { cnt, sec: ((performance.now() - t0) / 1000).toFixed(1) };
}

// ---------------- 结果渲染 ----------------
function bar(pct, width = 22) {
  const full = Math.round(pct / 100 * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
}

function showResult(title, meta, bodyHTML) {
  $('#result-meta').textContent = meta;
  $('#result-body').innerHTML = bodyHTML;
  $('#result-card').style.display = 'block';
  $('#result-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function render1v1(results, labelA, labelB, sec) {
  const n = results.length;
  let wA = 0, wB = 0, draw = 0, timeSum = 0, kill = 0, hpA = 0, hpB = 0;
  for (const r of results) {
    if (r.winner === 'A') wA++; else if (r.winner === 'B') wB++; else draw++;
    timeSum += r.time; if (r.over) kill++;
    hpA += r.hpA; hpB += r.hpB;
  }
  const pA = wA / n * 100, pB = wB / n * 100, pD = draw / n * 100;
  showResult('1v1 对决结果', `模拟 ${n} 场 · 平均时长 ${(timeSum / n).toFixed(1)}s · 击杀率 ${(kill / n * 100).toFixed(1)}% · 用时 ${sec}s`, `
    <div class="row-res">
      <div class="res-line"><span class="res-name a">A · ${labelA}</span><span class="res-bar">${bar(pA)}</span><span class="res-pct">${pA.toFixed(1)}% · ${wA} 胜 · 均剩 ${(hpA / n * 100).toFixed(0)}%</span></div>
      <div class="res-line"><span class="res-name b">B · ${labelB}</span><span class="res-bar">${bar(pB)}</span><span class="res-pct">${pB.toFixed(1)}% · ${wB} 胜 · 均剩 ${(hpB / n * 100).toFixed(0)}%</span></div>
      ${draw ? `<div class="res-draw">平局 ${draw} 场（${pD.toFixed(1)}%）</div>` : ''}
    </div>`);
}

// 排行：vs 基准的一列胜率，附带倾向判定
function renderRank(rows, benchLabel, n, sec) {
  const head = `<tr><th>#</th><th>能力</th><th>对基准胜率</th><th>条形</th><th>倾向</th></tr>`;
  const body = rows.map((r, i) => {
    const tend = r.avg >= 55 ? '🟢 克制' : r.avg <= 45 ? '🔴 被克' : '⚪ 均势';
    return `
    <tr>
      <td>${i + 1}</td>
      <td class="ab">${abLabel(r.id)}</td>
      <td class="num">${r.avg.toFixed(1)}%</td>
      <td class="barcell">${bar(r.avg, 20)}</td>
      <td class="dim">${tend}</td>
    </tr>`;
  }).join('');
  showResult('强度排行（vs 基准）', `基准 [${benchLabel}] · 各 ${n} 场 · 用时 ${sec}s`, `<table class="tbl">${head}${body}</table>`);
}

function renderMatrix(rows, ids, m, n, sec) {
  // 释放上一次生成的 Blob URL，避免累积泄漏
  if (window.__matrixUrl) { URL.revokeObjectURL(window.__matrixUrl); window.__matrixUrl = null; }
  const head = `<tr><th>#</th><th>能力</th><th>平均胜率</th><th>条形</th><th>克制</th><th>惧怕</th></tr>`;
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="ab">${abLabel(r.id)}</td>
      <td class="num">${r.avg.toFixed(1)}%</td>
      <td class="barcell">${bar(r.avg, 20)}</td>
      <td class="dim">${abLabel(r.best)} ${r.bestP.toFixed(0)}%</td>
      <td class="dim">${abLabel(r.worst)} ${r.worstP.toFixed(0)}%</td>
    </tr>`).join('');
  const csv = ['能力,' + ids.map(id => abLabel(id)).join(',')]
    .concat(ids.map((id, i) => abLabel(id) + ',' + ids.map((_, j) => (m[i][j] / n * 100).toFixed(1)).join(',')));
  const blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv' });
  window.__matrixUrl = URL.createObjectURL(blob);
  showResult('全能力矩阵', `${ids.length}×${ids.length}×${n} 场 · 用时 ${sec}s`, `
    <div class="dl-row"><a class="tbtn link" id="btn-csv" download="matrix.csv" href="${window.__matrixUrl}">⬇ 下载完整矩阵 CSV</a></div>
    <table class="tbl">${head}${body}</table>`);
}

function renderBrawl(winCount, draw, n, pn, sec) {
  const lines = SIDES.slice(0, pn).map(s => {
    const pct = (winCount[s] || 0) / n * 100;
    const abId = $('#br-' + s) ? $('#br-' + s).value : SIDE_AB[s];
    const st = orbStats(abId);
    return `<div class="res-line"><span class="res-name">${s}</span><span class="res-bar">${bar(pct)}</span><span class="res-pct">${pct.toFixed(1)}% · ${winCount[s] || 0} 胜（${abLabel(abId)} · HP${st.maxHp}）</span></div>`;
  }).join('');
  showResult('混战结果', `${pn}P 混战 · 模拟 ${n} 场 · 用时 ${sec}s`, `<div class="row-res">${lines}${draw ? `<div class="res-draw">平局/多人存活 ${draw} 场</div>` : ''}</div>`);
}

// ---------------- 运行入口 ----------------
async function run() {
  const n = Math.max(10, parseInt($('#p-n').value, 10) || 200);
  const maxTime = parseInt($('#p-maxtime').value, 10) || 120;
  const seedVal = $('#p-seed').value;
  if (seedVal !== '') Math.random = mulberry32(parseInt(seedVal, 10) || 1);

  const dt = 1 / 60;
  // 名称等用户输入拼入 innerHTML 前转义
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cfgLabel = c => `[${abLabel(c.ability)}] ${esc(c.name)}`;

  if (mode === '1v1') {
    const cfgA = readPanel('A'), cfgB = readPanel('B');
    status(`模拟中：${cfgLabel(cfgA)} vs ${cfgLabel(cfgB)} · ${n} 场…`);
    const results = [];
    const { cnt, sec } = await runBatch(n, i => {
      const swap = Math.random() < .5;
      const r = runMatch(swap ? cfgB : cfgA, swap ? cfgA : cfgB, maxTime, dt);
      const w = r.winner === 'left' ? (swap ? 'B' : 'A') : r.winner === 'right' ? (swap ? 'A' : 'B') : null;
      results.push({ winner: w, time: r.time, over: r.over, hpA: r.hp[swap ? 1 : 0], hpB: r.hp[swap ? 0 : 1] });
    });
    status(cnt >= n ? '✓ 完成' : '⏹ 已停止');
    render1v1(results.slice(0, cnt), cfgLabel(cfgA), cfgLabel(cfgB), sec);
  } else if (mode === 'rank') {
    const bench = readPanel('B');
    const ids = ABILITIES.map(a => a.id);
    status(`排行模拟中：全部能力 vs 基准 ${cfgLabel(bench)} · 各 ${n} 场…`);
    const win = new Array(ids.length).fill(0);
    const { cnt, sec } = await runBatch(ids.length * n, k => {
      const i = Math.floor(k / n);
      if (i >= ids.length) return;
      // 遍历能力用默认数值（与命令行矩阵一致），不继承基准的滑块数值
      const a = { ...bench, ability: ids[i], name: abLabel(ids[i]), stats: { ...AB_DEFAULT_STATS } };
      const swap = Math.random() < .5;
      const r = runMatch(swap ? bench : a, swap ? a : bench, maxTime, dt);
      if (r.winner === (swap ? 'right' : 'left')) win[i]++;
    });
    status(cnt >= ids.length * n ? '✓ 完成' : '⏹ 已停止');
    const rows = ids.map((id, i) => ({ id, avg: win[i] / n * 100 }))
      .sort((x, y) => y.avg - x.avg);
    renderRank(rows, cfgLabel(bench), n, sec);
  } else if (mode === 'matrix') {
    const ids = ABILITIES.map(a => a.id);
    status(`矩阵模拟中：${ids.length}×${ids.length}×${n} 场，请耐心等待…`);
    const mk = id => ({ name: id, color: COLORS[0], decor: 'ring', ability: id, stats: { ...AB_DEFAULT_STATS } });
    const m = ids.map(() => new Array(ids.length).fill(0));
    const { cnt, sec } = await runBatch(ids.length * ids.length * n, k => {
      const i = Math.floor(k / ids.length / n), j = Math.floor(k / n) % ids.length;
      if (i >= ids.length || j >= ids.length) return;
      const a = mk(ids[i]), b = mk(ids[j]);
      const swap = Math.random() < .5;
      const r = runMatch(swap ? b : a, swap ? a : b, maxTime, dt);
      if (r.winner === (swap ? 'right' : 'left')) m[i][j]++;
    });
    status(cnt >= ids.length * ids.length * n ? '✓ 完成' : '⏹ 已停止');
    const rows = ids.map((id, i) => {
      let sum = 0, best = null, bestP = -1, worst = null, worstP = 101;
      for (let j = 0; j < ids.length; j++) {
        const p = m[i][j] / n * 100;
        sum += p;
        if (j !== i) {
          if (p > bestP) { bestP = p; best = ids[j]; }
          if (p < worstP) { worstP = p; worst = ids[j]; }
        }
      }
      return { id, avg: sum / ids.length, best, bestP, worst, worstP };
    }).sort((x, y) => y.avg - x.avg);
    renderMatrix(rows, ids, m, n, sec);
  } else if (mode === 'brawl') {
    const pn = parseInt($('#p-pn').value, 10) || 4;
    const sides = SIDES.slice(0, pn);
    const cfgs = sides.map(s => {
      const st = orbStats($('#br-' + s).value); // 数值跟随球位所选能力
      return { name: st.name || $('#br-' + s).value, color: COLORS[0], decor: 'ring', ability: $('#br-' + s).value, stats: st };
    });
    status(`混战模拟中：${pn}P × ${n} 场…`);
    const winCount = {}; sides.forEach(s => winCount[s] = 0);
    let draw = 0;
    const { cnt, sec } = await runBatch(n, () => {
      const r = runMatchN(cfgs, maxTime, dt);
      if (r.winner) winCount[r.winner]++; else draw++;
    });
    status(cnt >= n ? '✓ 完成' : '⏹ 已停止');
    renderBrawl(winCount, draw, cnt, pn, sec);
  }
}

// 可复现随机（mulberry32，与 Node 版一致）
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function status(msg, ok = true) {
  const el = $('#status');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'err';
}

// ---------------- 事件 ----------------
document.querySelectorAll('#mode-switch .mode-btn').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#btn-run').onclick = run;
$('#btn-cancel').onclick = () => { cancelFlag = true; status('正在停止…'); };

// ---------------- 启动 ----------------
initPanels();
setMode('1v1');
status('就绪 — 选择模式与配置后点击「开始模拟」');
