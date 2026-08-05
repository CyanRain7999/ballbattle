// ---------------- 转场 ----------------
let transitionSeq = 0; // 转场令牌：连点"再战"时旧定时器失效
function startTransition() {
  const seq = ++transitionSeq;
  showScreen('transition');
  const log = $('#trans-log'), fill = $('#trans-fill'), pct = $('#trans-pct');
  log.textContent = ''; fill.style.width = '0%'; pct.textContent = '0%';
  const lines = [
    '[ OK ] 初始化轨道核心 ORB-CORE v2.4 ......',
    '[ OK ] 校准战斗场域 FIELD-CALIB ..........',
    '[ OK ] 加载能力模块 WEAPON-MOD ...........',
    '[ OK ] 同步光学传感器 SENSOR-SYNC ........',
    '>>> 战斗协议启动，祝好运',
  ];
  lines.forEach((s, i) => setTimeout(() => { if (seq !== transitionSeq) return; log.textContent += s + '\n'; sfx('ui'); }, 120 + i * 330));
  const t0 = performance.now(), dur = 1900;
  (function step(now) {
    if (seq !== transitionSeq) return; // 旧转场链失效
    const p = Math.min(1, (now - t0) / dur);
    fill.style.width = (p * 100) + '%';
    pct.textContent = Math.floor(p * 100) + '%';
    if (p < 1) requestAnimationFrame(step);
    else { sfx('win'); setTimeout(() => { if (seq === transitionSeq) startBattle(); }, 220); }
  })(t0);
}

// ---------------- 结算 ----------------
const fxCanvas = $('#fx-canvas');
const fctx = fxCanvas.getContext('2d');
let fireworks = [];
function resizeFx() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  fxCanvas.width = innerWidth * dpr;
  fxCanvas.height = innerHeight * dpr;
  fxCanvas.style.width = innerWidth + 'px';
  fxCanvas.style.height = innerHeight + 'px';
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function spawnFirework() {
  fireworks.push({
    x: rand(innerWidth * .2, innerWidth * .8), y: rand(innerHeight * .12, innerHeight * .42),
    color: COLORS[Math.floor(Math.random() * COLORS.length)].bright,
  });
}
function updateFireworks(dt) {
  if (Math.random() < dt * 1.6) spawnFirework();
  for (const f of fireworks) {
    if (!f.parts) {
      f.parts = [];
      for (let i = 0; i < 42; i++) {
        const a = Math.random() * TAU, sp = rand(40, 210);
        f.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0, maxLife: rand(.7, 1.4), size: rand(1.5, 3) });
      }
    }
    for (const p of f.parts) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 60 * dt;
    }
  }
  fireworks = fireworks.filter(f => f.parts.some(p => p.life < p.maxLife));
}
function drawFireworks() {
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const f of fireworks) {
    for (const p of f.parts) {
      const k = 1 - p.life / p.maxLife;
      if (k <= 0) continue;
      fctx.save();
      fctx.globalAlpha = k;
      fctx.fillStyle = f.color;
      fctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      fctx.restore();
    }
  }
}

function showResult() {
  const w = battle.winner;
  const title = $('#result-title');
  const cv = $('#result-canvas'), g = cv.getContext('2d');
  g.clearRect(0, 0, 200, 200);
  const drawMini = (o, x, y, r) => drawOrb(g, { x, y, r, angle: Math.PI / 6, color: o.color, decor: o.decor, history: null, shieldT: 0, rushT: 0, flash: 0 }, performance.now() / 1000);
  if (w) {
    const team = battle.winnerTeam;
    title.textContent = team ? TEAM_LABELS[team] + ' 胜利' : w.name + ' 胜利';
    title.style.color = w.color.main;
    if (team) { // 队伍模式：子标题显示胜队剩余总血量比例
      const tOrbs = battle.orbs.filter(o => o.alive && teamOf(o.side) === team);
      const pct = tOrbs.reduce((s, o) => s + o.hp / o.maxHp, 0) / (tOrbs.length || 1) * 100;
      $('#result-sub').textContent = `${TEAM_LABELS[team]} · 剩余生命 ${Math.max(0, Math.round(pct))}% · 用时 ${fmtTime(battle.time)}`;
    } else {
      $('#result-sub').textContent = `${w.name} · 剩余生命 ${Math.max(0, Math.round(w.hp / w.maxHp * 100))}% · 用时 ${fmtTime(battle.time)}`;
    }
    drawMini(w, 100, 100, 72);
  } else { // 平局（120 秒超时且剩余血量相同；多球模式所有存活球并列显示）
    title.textContent = '平局 DRAW';
    title.style.color = '#cfe8ff';
    const alive = battle.orbs.filter(o => o.alive);
    const shown = alive.length ? alive : battle.orbs;
    let sub;
    if (battle.teams) { // 队伍平局：按队伍总血量比例
      if (alive.length === 0) sub = '双方全部阵亡'; // 全灭平局（shown 此时为全部阵亡球）
      else {
        const teamPct = {};
        for (const o of shown) {
          const t = teamOf(o.side);
          teamPct[t] = (teamPct[t] || 0) + o.hp / o.maxHp;
        }
        sub = Object.entries(teamPct).map(([t, v]) => `${TEAM_LABELS[t] || t} ${(v * 100 / (battle.teams[t].length || 1)).toFixed(0)}%`).join(' · ');
      }
    } else {
      sub = shown.map(o => o.name + ' ' + Math.max(0, Math.round(o.hp / o.maxHp * 100)) + '%').join(' · ');
    }
    $('#result-sub').textContent = `双方剩余生命持平 ${sub} · 用时 ${fmtTime(battle.time)}`;
    if (shown.length === 1) drawMini(shown[0], 100, 100, 72);
    else if (shown.length === 2) { drawMini(shown[0], 78, 100, 52); drawMini(shown[1], 122, 100, 52); }
    else if (shown.length === 3) { drawMini(shown[0], 100, 78, 48); drawMini(shown[1], 72, 122, 48); drawMini(shown[2], 128, 122, 48); }
    else { [[72, 72], [128, 72], [72, 128], [128, 128]].forEach(([px, py], i) => { if (shown[i]) drawMini(shown[i], px, py, 44); }); }
  }
  fireworks = [];
  resizeFx();
  sfx('boom'); sfx('win');
  showScreen('result');
}

// ---------------- 主循环 ----------------
let last = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (t - last) / 1000 || 0);
  last = t;
  if (state === 'battle' && battle) {
    if (!battle.paused) updateBattle(dt);
    drawBattle();
    updateHUD();
  } else if (state === 'result') {
    updateFireworks(dt);
    drawFireworks();
  }
}

// ---------------- 事件 ----------------
$('#btn-again').onclick = () => startTransition();
$('#btn-reconfig').onclick = () => { showScreen('select'); buildPanels(); };
$('#btn-random2').onclick = randomizeAll;
$('#btn-start2').onclick = startGame;
// 数值编辑器入口（2P 的 btn-balance 在 select.js 动态生成，3P/4P 在 index.html 静态定义）
const balanceBtn = $('#btn-balance');
if (balanceBtn) balanceBtn.onclick = () => { location.href = 'editor.html'; };
document.querySelectorAll('#mode-switch .mode-btn').forEach(b => {
  b.onclick = () => {
    gameMode = +b.dataset.mode;
    buildPanels();
    sfx('ui');
  };
});
// 玩法规则按钮：缩圈 = 开关；障碍 = 循环切换布局（none→十字墙→四角块→迷宫块→旋转隔板→九宫格→八块环→之字柱→随机→对称随机）；双能力/火力全开 = 开关且互斥（界面形态切换）
document.querySelectorAll('#rules-switch .rule-btn').forEach(b => {
  b.onclick = () => {
    const r = b.dataset.rule;
    if (r === 'obstacles') {
      const order = ['none', 'cross', 'corners', 'blocks', 'spinner', 'grid3', 'ring', 'slalom', 'random', 'randomsym'];
      gameRules.obstacles = order[(order.indexOf(gameRules.obstacles) + 1) % order.length];
    } else if (r === 'multiSkill') {
      gameRules.multiSkill = !gameRules.multiSkill;
      if (gameRules.multiSkill) gameRules.firepower = false; // 互斥
    } else if (r === 'firepower') {
      gameRules.firepower = !gameRules.firepower;
      if (gameRules.firepower) gameRules.multiSkill = false; // 互斥
    } else {
      gameRules[r] = !gameRules[r];
    }
    syncRulesUI();
    if (r === 'multiSkill' || r === 'firepower') buildPanels(); // 切换界面形态（能力槽视图）
    sfx('ui');
  };
});
$('#btn-pause').onclick = () => {
  if (!battle) return;
  battle.paused = !battle.paused;
  $('#pause-overlay').classList.toggle('on', battle.paused);
  sfx('ui');
};
$('#btn-sound').onclick = () => {
  audioOn = !audioOn;
  $('#btn-sound').textContent = audioOn ? '♪' : '✕';
  sfx('ui');
};
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'KeyP') {
    if (state === 'battle' && battle) $('#btn-pause').click();
  }
});
addEventListener('resize', () => { if (state === 'battle') resizeCanvas(); if (state === 'result') resizeFx(); });

// ---------------- 启动 ----------------
buildPanels();
requestAnimationFrame(loop);

// URL 参数 ?auto=1 直接开战（用于演示/测试）
const qs = new URLSearchParams(location.search);
if (qs.get('auto') === '1') {
  randomizeAll();
  // 直接调用选择屏按钮（与手动点击等效）
  $('#btn-start').click();
}

// PWA：仅在 http(s) 环境启用（file:// 双击打开时完全跳过，游戏照常运行）
if (location.protocol.startsWith('http')) {
  // 动态注入 manifest（file:// 下浏览器会阻止 manifest 请求，故不注入）
  const ml = document.createElement('link');
  ml.rel = 'manifest'; ml.href = 'manifest.webmanifest';
  document.head.appendChild(ml);
  // 注册 service worker（离线缓存）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
