// ---------------- 选择屏 ----------------
const decOf = id => DECORS.find(d => d.id === id);
const abOf  = id => ABILITIES.find(a => a.id === id);
const DEFAULT_NAMES = ['BLUE-01', 'RED-02', 'GREEN-03', 'GOLD-04'];
function panelKeys(n) { return n === 2 ? ['left', 'right'] : ['p0', 'p1', 'p2', 'p3'].slice(0, n); }

function buildPanel(side, idx) {
  const pid = 'panel-' + side;
  const p = $('#' + pid);
  const fp = gameRules.firepower;
  const abOpts = ABILITIES.map(a => `<option value="${a.id}">${a.icon} ${a.name}（${a.type === 'melee' ? '近战' : '远程'}）</option>`).join('');
  p.innerHTML = `
    <div class="panel-flux"></div>
    <div class="panel-head">
      <span class="pnum">P${idx + 1}</span>
      <input class="pname-input" id="pname-${side}" maxlength="14" value="${DEFAULT_NAMES[idx] || 'PLAYER-' + (idx + 1)}">
    </div>
    <div class="preview-wrap"><canvas id="preview-${side}" width="160" height="160"></canvas></div>
    <div class="psec">
      <div class="seclabel">◈ 颜色 COLOR</div>
      <div class="swatches" id="sw-${side}"></div>
    </div>
    ${fp ? `
    <div class="psec psec-fp">
      <div class="seclabel">◈ 火力全开 · 能力槽 <span class="sechint">槽①必选 · 槽②③可留空（副槽 CD+30% 伤害×0.5）</span></div>
      <label class="fp-slot"><span class="fp-no">①</span><select class="skill2-sel" id="skill1-${side}">${abOpts}</select></label>
      <label class="fp-slot"><span class="fp-no">②</span><select class="skill2-sel" id="skill2-${side}"><option value="none">⚪ 无</option>${abOpts}</select></label>
      <label class="fp-slot"><span class="fp-no">③</span><select class="skill2-sel" id="skill3-${side}"><option value="none">⚪ 无</option>${abOpts}</select></label>
    </div>` : `
    <div class="psec">
      <div class="seclabel">◈ 装饰 DECOR</div>
      <div class="cards" id="dc-${side}"></div>
    </div>
    <div class="psec">
      <div class="seclabel">◈ 能力 ABILITY</div>
      <div class="cards" id="ab-${side}"></div>
    </div>
    <div class="psec psec-skill2" id="sec-skill2-${side}">
      <div class="seclabel">◈ 副能力 ABILITY II <span class="sechint">双能力模式</span></div>
      <select class="skill2-sel" id="skill2-${side}">
        <option value="none">⚪ 无（单能力）</option>
        ${abOpts}
      </select>
    </div>`}`;
  // 颜色（两种形态都有）
  // 颜色
  const sw = $('#sw-' + side);
  COLORS.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'swatch' + (i === idx ? ' sel' : '');
    el.style.background = `radial-gradient(circle at 32% 30%, ${c.bright}, ${c.main} 70%)`;
    el.style.color = c.main;
    el.title = c.name;
    el.onclick = () => { sw.querySelectorAll('.swatch').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); sfx('ui'); renderPreview(side); };
    sw.appendChild(el);
  });
  // 装饰（火力全开形态隐藏）
  const dc = $('#dc-' + side);
  if (dc) DECORS.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'card' + (i === 1 ? ' sel' : '');
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    el.appendChild(cv);
    el.innerHTML += `<div class="cname">${d.name}</div><div class="cdesc">${d.desc}</div>`;
    el.onclick = () => { dc.querySelectorAll('.card').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); sfx('ui'); renderPreview(side); };
    dc.appendChild(el);
    // 小预览
    const g = cv.getContext('2d');
    drawOrb(g, { x: 32, y: 32, r: 20, angle: Math.PI / 4, color: { main: '#9be8ff', bright: '#ffffff' }, decor: d.id, history: null, shieldT: 0, rushT: 0, flash: 0 }, 0);
  });
  // 能力卡片（火力全开形态隐藏，改由能力槽 select 配置）
  const ab = $('#ab-' + side);
  if (ab) ABILITIES.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'card' + (i === 0 ? ' sel' : '');
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    el.appendChild(cv);
    el.innerHTML += `<div class="cname">${a.name} <span class="atype ${a.type}">${a.type === 'melee' ? '近' : '远'}</span></div><div class="cdesc">${a.desc}</div>`;
    el.onclick = () => { ab.querySelectorAll('.card').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); sfx('ui'); };
    ab.appendChild(el);
    const g = cv.getContext('2d');
    g.fillStyle = '#ffb020'; g.font = 'bold 32px Consolas, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(a.icon, 32, 34);
  });
}

// ---------------- 玩法规则 --------------
// 规则按钮状态同步（规则按钮为静态 HTML，事件在 ui.js 绑定一次）
const OBSTACLE_LABELS = {
  none: '▣ 障碍 OBSTACLE',
  cross: '▣ 障碍·十字墙',
  corners: '▣ 障碍·四角块',
  blocks: '▣ 障碍·迷宫块',
  spinner: '▣ 障碍·旋转隔板',
  grid3: '▣ 障碍·九宫格',
  ring: '▣ 障碍·八块环',
  slalom: '▣ 障碍·之字柱',
  random: '▣ 障碍·随机',
  randomsym: '▣ 障碍·对称随机',
};
function syncRulesUI() {
  document.querySelectorAll('#rules-switch .rule-btn').forEach(b => {
    const r = b.dataset.rule;
    if (r === 'obstacles') {
      b.textContent = OBSTACLE_LABELS[gameRules.obstacles] || OBSTACLE_LABELS.none;
      b.classList.toggle('sel', gameRules.obstacles !== 'none');
    } else b.classList.toggle('sel', !!gameRules[r]);
  });
  // 双能力开关联动各面板副能力区
  document.querySelectorAll('.psec-skill2').forEach(el => {
    el.style.display = gameRules.multiSkill ? '' : 'none';
  });
  autoFillSlots(); // 开箱即用：自动填充空能力槽
}
// 自动分配：双能力模式副槽、火力全开模式槽②③默认给随机能力（与已选互不相同）
function autoFillSlots() {
  const pick = exclude => {
    let v = ABILITIES[Math.floor(Math.random() * ABILITIES.length)].id;
    let g = 0;
    while (exclude.includes(v) && g++ < 30) v = ABILITIES[Math.floor(Math.random() * ABILITIES.length)].id;
    return v;
  };
  panelKeys(gameMode).forEach(side => {
    if (gameRules.firepower) {
      const s1 = $('#skill1-' + side), s2 = $('#skill2-' + side), s3 = $('#skill3-' + side);
      if (!s1 || !s2 || !s3) return;
      const main = s1.value || 'none';
      if (!s2.value || s2.value === 'none') s2.value = pick([main]);
      if (!s3.value || s3.value === 'none') s3.value = pick([main, s2.value]);
    } else if (gameRules.multiSkill) {
      const sel = $('#skill2-' + side);
      if (!sel) return;
      if (sel.value === 'none') {
        const cards = $('#ab-' + side);
        const main = cards && cards.querySelector('.card.sel')
          ? ABILITIES[[...cards.querySelectorAll('.card')].findIndex(c => c.classList.contains('sel'))].id
          : ABILITIES[0].id;
        sel.value = pick([main]);
      }
    }
  });
}

// 按当前模式重建选择面板（2P: 左右 + VS 列；3P/4P: 网格 + 底部按钮）
function buildPanels() {
  const body = $('#select-body');
  body.innerHTML = '';
  const keys = panelKeys(gameMode);
  const multi = gameMode > 2;
  body.className = 'select-body' + (multi ? ' multi' : '');
  if (multi) body.dataset.n = String(gameMode === 5 || gameMode === 6 ? 4 : gameMode); // 2v2/BOSS 用 4 面板 2 列网格
  keys.forEach((k, i) => {
    const el = document.createElement('div');
    el.className = 'panel' + (k === 'left' ? ' panel-left' : k === 'right' ? ' panel-right' : '');
    el.id = 'panel-' + k;
    body.appendChild(el);
    buildPanel(k, i);
  });
  if (!multi) {
    const vs = document.createElement('div');
    vs.className = 'vs-col';
    const hasEditor = !!window.HAS_EDITOR; // 副本（无 editor.html）不生成数值按钮
    vs.innerHTML = `
      <div class="vs">VS</div>
      <div class="vs-line"></div>
      <button class="btn vs-btn" id="btn-random">⚄ 随机启动</button>
      ${hasEditor ? '<button class="btn vs-btn" id="btn-balance">⚙ 数值</button>' : ''}
      <button class="btn primary vs-btn" id="btn-start">▶ 启动战斗</button>`;
    body.insertBefore(vs, body.children[1]);
    $('#btn-random').onclick = startRandomTransition; // 随机启动：进入加载界面后在轮转停止时才决定结果
    $('#btn-start').onclick = startGame;
    const bal = $('#btn-balance');
    if (bal) bal.onclick = () => location.href = 'editor.html'; // 数值编辑器（buildPanels 重建后重新绑定）
  }
  $('#multi-actions').style.display = multi ? 'flex' : 'none';
  // 队伍模式提示（2v2 / BOSS）
  const hint = $('#multi-hint');
  if (hint) {
    if (gameMode === 5) hint.textContent = '◈ P1 + P3 蓝队 VS P2 + P4 红队 · 同队不互伤，按队伍总血量判胜';
    else if (gameMode === 6) hint.textContent = '◈ 四位玩家联手 VS BOSS（玩家同队不互伤）· BOSS 拥有强化能力与巨额生命';
    else hint.textContent = '';
    hint.style.display = multi && gameMode >= 5 ? 'block' : 'none';
  }
  document.querySelectorAll('#mode-switch .mode-btn').forEach(b => b.classList.toggle('sel', +b.dataset.mode === gameMode));
  keys.forEach(k => renderPreview(k));
  syncRulesUI();
}

// ---------------- 选择屏星尘粒子背景 ----------------
(function () {
  const cv = document.getElementById('select-fx');
  if (!cv || typeof requestAnimationFrame === 'undefined') return;
  const g = cv.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  const parts = [];
  for (let i = 0; i < 52; i++) parts.push({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    r: Math.random() * 1.7 + .3,
    vx: (Math.random() - .5) * .16, vy: (Math.random() - .5) * .1 + .04,
    ph: Math.random() * TAU, sp: Math.random() * 1.1 + .35
  });
  (function loop(t) {
    requestAnimationFrame(loop);
    if (state !== 'select') return;
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5;
      if (p.y < -5) p.y = H + 5; else if (p.y > H + 5) p.y = -5;
      const tw = .5 + .5 * Math.sin(t / 1000 * p.sp + p.ph);
      const a = (.12 + .3 * tw) * .8;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU);
      g.fillStyle = 'rgba(150,225,255,' + a.toFixed(3) + ')';
      g.fill();
      if (p.r > 1.15) {
        g.strokeStyle = 'rgba(0,229,255,' + (a * .45).toFixed(3) + ')';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(p.x - p.r * 3.2, p.y); g.lineTo(p.x + p.r * 3.2, p.y);
        g.moveTo(p.x, p.y - p.r * 3.2); g.lineTo(p.x, p.y + p.r * 3.2);
        g.stroke();
      }
    }
  })(0);
})();

function readConfig(side) {
  const pid = 'panel-' + side;
  const p = $('#' + pid);
  const idx = panelKeys(gameMode).indexOf(side);
  const cIdx = [...p.querySelectorAll('.swatch')].findIndex(x => x.classList.contains('sel'));
  const dIdx = [...p.querySelectorAll('#dc-' + side + ' .card')].findIndex(x => x.classList.contains('sel'));
  const aIdx = [...p.querySelectorAll('#ab-' + side + ' .card')].findIndex(x => x.classList.contains('sel'));
  const fp = gameRules.firepower;
  const s1 = fp && $('#skill1-' + side) ? $('#skill1-' + side).value : null;
  const s2el = $('#skill2-' + side);
  return {
    name: $('#pname-' + side).value.trim() || (DEFAULT_NAMES[idx] || 'PLAYER-' + (idx + 1)),
    color: COLORS[Math.max(0, cIdx)],
    decor: DECORS[Math.max(0, dIdx)].id,
    ability: s1 || ABILITIES[Math.max(0, aIdx)].id,
    skill2: (fp || gameRules.multiSkill) ? (s2el ? s2el.value : 'none') : null,
    skill3: fp ? ($('#skill3-' + side) ? $('#skill3-' + side).value : 'none') : null,
  };
}

function renderPreview(side) {
  const cfg = readConfig(side);
  const cv = $('#preview-' + side);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 160, 160);
  // 底座光环
  g.strokeStyle = 'rgba(0,229,255,.22)'; g.lineWidth = 1;
  g.beginPath(); g.arc(80, 80, 58, 0, TAU); g.stroke();
  drawOrb(g, { x: 80, y: 80, r: 52, angle: performance.now() / 900, color: cfg.color, decor: cfg.decor, history: null, shieldT: 0, rushT: 0, flash: 0 }, performance.now() / 1000);
}

function randomizeAll() {
  const pick = (arr, exclude) => {
    let v = arr[Math.floor(Math.random() * arr.length)];
    let guard = 0;
    while (exclude && exclude.includes(v.id) && guard++ < 20) v = arr[Math.floor(Math.random() * arr.length)];
    return v;
  };
  const keys = panelKeys(gameMode);
  const usedC = [], usedD = [], usedA = [];
  keys.forEach((side, i) => {
    const c = pick(COLORS.map(c => ({ ...c, id: c.name })), usedC);
    const d = pick(DECORS, usedD);
    const a = pick(ABILITIES, usedA);
    usedC.push(c.id); usedD.push(d.id); usedA.push(a.id);
    const p = $('#' + 'panel-' + side);
    [...p.querySelectorAll('.swatch')].forEach((x, i2) => x.classList.toggle('sel', COLORS[i2].name === c.name));
    if (gameRules.firepower) { // 火力全开：随机 3 槽（60% 三能力 / 40% 双能力）
      const s1 = $('#skill1-' + side), s2 = $('#skill2-' + side), s3 = $('#skill3-' + side);
      if (s1 && s2 && s3) {
        const b = pick(ABILITIES.filter(x => x.id !== a.id));
        s1.value = a.id; s2.value = b.id;
        if (Math.random() < .6) s3.value = pick(ABILITIES.filter(x => x.id !== a.id && x.id !== b.id)).id;
        else s3.value = 'none';
      }
    } else {
      [...p.querySelectorAll('#dc-' + side + ' .card')].forEach((x, i2) => x.classList.toggle('sel', DECORS[i2].id === d.id));
      [...p.querySelectorAll('#ab-' + side + ' .card')].forEach((x, i2) => x.classList.toggle('sel', ABILITIES[i2].id === a.id));
      // 双能力：总是给一个与主能力不同的副能力（开箱即用）
      const s2sel = $('#skill2-' + side);
      if (s2sel) {
        if (gameRules.multiSkill) s2sel.value = pick(ABILITIES.filter(x => x.id !== a.id)).id;
        else s2sel.value = 'none';
      }
    }
    renderPreview(side);
  });
  transRandom = true; // 随机抽取：转场进入老虎机动画（手动配置启动时会清零）
  sfx('ui');
}

// 启动战斗：读取全部面板配置 → 转场（手动配置：关闭老虎机模式）
function startGame() {
  players = {};
  for (const k of panelKeys(gameMode)) players[k] = readConfig(k);
  transRandom = false;
  startTransition();
}
