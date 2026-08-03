// ---------------- 选择屏 ----------------
const decOf = id => DECORS.find(d => d.id === id);
const abOf  = id => ABILITIES.find(a => a.id === id);
const DEFAULT_NAMES = ['BLUE-01', 'RED-02', 'GREEN-03', 'GOLD-04'];
function panelKeys(n) { return n === 2 ? ['left', 'right'] : ['p0', 'p1', 'p2', 'p3'].slice(0, n); }

function buildPanel(side, idx) {
  const pid = 'panel-' + side;
  const p = $('#' + pid);
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
    <div class="psec">
      <div class="seclabel">◈ 装饰 DECOR</div>
      <div class="cards" id="dc-${side}"></div>
    </div>
    <div class="psec">
      <div class="seclabel">◈ 能力 ABILITY</div>
      <div class="cards" id="ab-${side}"></div>
    </div>`;
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
  // 装饰
  const dc = $('#dc-' + side);
  DECORS.forEach((d, i) => {
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
  // 能力
  const ab = $('#ab-' + side);
  ABILITIES.forEach((a, i) => {
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

// 按当前模式重建选择面板（2P: 左右 + VS 列；3P/4P: 网格 + 底部按钮）
function buildPanels() {
  const body = $('#select-body');
  body.innerHTML = '';
  const keys = panelKeys(gameMode);
  const multi = gameMode > 2;
  body.className = 'select-body' + (multi ? ' multi' : '');
  if (multi) body.dataset.n = String(gameMode);
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
    vs.innerHTML = `
      <div class="vs">VS</div>
      <div class="vs-line"></div>
      <button class="btn vs-btn" id="btn-random">⚄ 随机配置</button>
      <button class="btn primary vs-btn" id="btn-start">▶ 启动战斗</button>`;
    body.insertBefore(vs, body.children[1]);
    $('#btn-random').onclick = randomizeAll;
    $('#btn-start').onclick = startGame;
  }
  $('#multi-actions').style.display = multi ? 'flex' : 'none';
  document.querySelectorAll('#mode-switch .mode-btn').forEach(b => b.classList.toggle('sel', +b.dataset.mode === gameMode));
  keys.forEach(k => renderPreview(k));
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
  return {
    name: $('#pname-' + side).value.trim() || (DEFAULT_NAMES[idx] || 'PLAYER-' + (idx + 1)),
    color: COLORS[Math.max(0, cIdx)],
    decor: DECORS[Math.max(0, dIdx)].id,
    ability: ABILITIES[Math.max(0, aIdx)].id,
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
    [...p.querySelectorAll('#dc-' + side + ' .card')].forEach((x, i2) => x.classList.toggle('sel', DECORS[i2].id === d.id));
    [...p.querySelectorAll('#ab-' + side + ' .card')].forEach((x, i2) => x.classList.toggle('sel', ABILITIES[i2].id === a.id));
    renderPreview(side);
  });
  sfx('ui');
}

// 启动战斗：读取全部面板配置 → 转场
function startGame() {
  players = {};
  for (const k of panelKeys(gameMode)) players[k] = readConfig(k);
  startTransition();
}
