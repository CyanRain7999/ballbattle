// ---------------- 数值编辑器 ----------------
'use strict';

// ---------------- 球种选择（按能力编辑，不再按场上球位） ----------------
let curAbility = 'pulse';

const GLOBAL_FIELDS = [
  { key: 'dmgMult',    min: 0.2, max: 4,   step: 0.05, fmt: v => v.toFixed(2) },
  { key: 'skillMult',  min: 0.2, max: 4,   step: 0.05, fmt: v => v.toFixed(2) },
  { key: 'collideMult',min: 0.2, max: 4,   step: 0.05, fmt: v => v.toFixed(2) },
  { key: 'healMult',   min: 0,   max: 4,   step: 0.05, fmt: v => v.toFixed(2) },
  { key: 'speedMult',  min: 0.2, max: 4,   step: 0.05, fmt: v => v.toFixed(2) },
  { key: 'cdMult',     min: 0.2, max: 4,   step: 0.05, fmt: v => v.toFixed(2) },
  { key: 'maxTime',    min: 30,  max: 300, step: 5,    fmt: v => v + 's' },
];

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

let dirty = false;

function status(msg, ok = true) {
  const el = $('#status');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'err';
}

// ---- 预览：按半径/颜色画球 ----
function drawPreview(cv, st, abilityId) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const cx = cv.width / 2, cy = cv.height / 2;
  const ab = ABILITIES.find(a => a.id === abilityId) || ABILITIES[0];
  const melee = ab.type === 'melee';
  const main = melee ? '#ffb020' : '#00e5ff';
  const bright = melee ? '#ffe0a0' : '#8df6ff';
  const rr = 12 + Math.min(34, (st.r - 20) / 100 * 34); // 半径映射
  g.beginPath(); g.arc(cx, cy, rr + 8, 0, TAU);
  g.strokeStyle = main + '33'; g.lineWidth = 2; g.stroke();
  const grad = g.createRadialGradient(cx - rr * .3, cy - rr * .3, rr * .15, cx, cy, rr);
  grad.addColorStop(0, bright); grad.addColorStop(1, main);
  g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fillStyle = grad; g.fill();
  g.font = 'bold 22px Consolas, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#04070f';
  g.fillText(ab.icon, cx, cy + 1);
  g.font = '10px Consolas, monospace';
  g.fillStyle = '#9fd8ff';
  g.fillText(st.maxHp + 'HP', cx, cy + rr + 16);
}

// ---- 全局滑块 ----
function renderGlobal() {
  GLOBAL_FIELDS.forEach(f => {
    const input = $('#g-' + f.key);
    input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = BALANCE.global[f.key];
    $('#v-g-' + f.key).textContent = f.fmt(BALANCE.global[f.key]);
    input.oninput = () => {
      BALANCE.global[f.key] = parseFloat(input.value);
      $('#v-g-' + f.key).textContent = f.fmt(BALANCE.global[f.key]);
      dirty = true;
    };
  });
}

// ---------------- 球种选择 ----------------
function fillAbilityPicker() {
  const sel = $('#ab-pick');
  sel.innerHTML = ABILITIES.map(a => `<option value="${a.id}">${a.icon} ${a.name}（${a.type === 'melee' ? '近战' : '远程'}）</option>`).join('');
  // 恢复上次编辑的球种
  try {
    const last = localStorage.getItem('orb_editor_last_ab');
    if (last && ABILITIES.some(a => a.id === last)) curAbility = last;
  } catch (e) { /* 忽略 */ }
  sel.value = curAbility;
  sel.onchange = () => {
    curAbility = sel.value;
    try { localStorage.setItem('orb_editor_last_ab', curAbility); } catch (e) { /* 忽略 */ }
    renderAbilityPanel();
    dirty = true;
  };
}

// 渲染当前球种的完整参数面板
function renderAbilityPanel() {
  const panel = $('#ab-panel');
  const ab = ABILITIES.find(a => a.id === curAbility) || ABILITIES[0];
  const st = orbStats(curAbility);
  $('#ab-desc').textContent = `${ab.icon} ${ab.name} · ${ab.desc} · CD ${ab.cd}s · ${ab.type === 'melee' ? '近战 MELEE' : '远程 RANGED'}`;
  panel.innerHTML = `
    <div class="ab-head">
      <canvas class="ab-prev" width="120" height="120"></canvas>
      <div class="ab-meta">
        <div class="ab-name">${ab.icon} ${ab.name}</div>
        <div class="ab-tag">${ab.type === 'melee' ? '近战 MELEE' : '远程 RANGED'}</div>
        <div class="ab-note">游戏中所有选择「${ab.name}」的球都使用以下数值</div>
      </div>
    </div>
    <div class="ab-fields">
      ${ORB_FIELDS.map(f => `
        <label class="field">
          <span class="fname">${f.label}</span>
          <input type="range" id="ab-${curAbility}-${f.key}" min="${f.min}" max="${f.max}" step="${f.step}">
          <span class="fval" id="v-ab-${curAbility}-${f.key}"></span>
        </label>`).join('')}
    </div>`;
  // 绑定滑块
  ORB_FIELDS.forEach(f => {
    const input = $('#ab-' + curAbility + '-' + f.key);
    input.value = st[f.key];
    $('#v-ab-' + curAbility + '-' + f.key).textContent = f.fmt(st[f.key]) + f.unit;
    input.oninput = () => {
      const v = parseFloat(input.value);
      if (!BALANCE.abilities[curAbility]) BALANCE.abilities[curAbility] = {};
      BALANCE.abilities[curAbility][f.key] = v;
      $('#v-ab-' + curAbility + '-' + f.key).textContent = f.fmt(v) + f.unit;
      if (f.key === 'r' || f.key === 'maxHp') drawPreview(panel.querySelector('canvas'), orbStats(curAbility), curAbility);
      dirty = true;
    };
  });
  drawPreview(panel.querySelector('canvas'), st, curAbility);
}

function renderAll() {
  renderGlobal();
  fillAbilityPicker();
  renderAbilityPanel();
  dirty = false;
}

// ---- 顶部操作 ----
$('#btn-save').onclick = () => {
  const ok = saveBalance();
  status(ok ? '✓ 已保存 — 刷新游戏页面（index.html）即可生效' : '✗ 保存失败（浏览器存储不可用）', ok);
  dirty = false;
};

$('#btn-export').onclick = () => {
  const blob = new Blob([exportBalanceJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'balance.json';
  a.click();
  URL.revokeObjectURL(a.href);
  status('✓ 已导出 balance.json（用于 sim/simulate.js）');
};

$('#btn-import').onclick = () => $('#file-import').click();
$('#file-import').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      importBalanceJSON(rd.result);
      renderAll();
      status('✓ 已导入 ' + file.name + '（尚未保存到游戏）');
    } catch (err) {
      status('✗ 导入失败：' + err.message, false);
    }
  };
  rd.readAsText(file);
  e.target.value = '';
};

$('#btn-reset').onclick = () => {
  if (!confirm('恢复全部默认数值？（未保存的修改将丢失）')) return;
  resetBalance();
  renderAll();
  status('↺ 已恢复默认（尚未保存）');
};

window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

renderAll();
status('就绪 — 修改后点「保存」，再刷新游戏页面');
