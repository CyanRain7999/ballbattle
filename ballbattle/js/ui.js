// ---------------- 转场 ----------------
let transitionSeq = 0; // 转场令牌：连点"再战"时旧定时器失效
let transRandom = false; // 随机启动模式：转场 10s（轮转停止时才随机化）；手动启动/再战时清零走短转场
const transCanvas = $('#trans-stage');
const tctx = transCanvas.getContext('2d');
let transOrbs = []; // 特写球列表（从 players 构造）
let transLayoutCache = []; // 当前排布
let transSlot = null; // 老虎机状态：每球 { final, cur, stopAt, stopped }
let transW = 0, transH = 0; // 画布 CSS 像素尺寸（绘制坐标基准）

function resizeTrans() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  transCanvas.width = innerWidth * dpr;
  transCanvas.height = innerHeight * dpr;
  transCanvas.style.width = innerWidth + 'px';
  transCanvas.style.height = innerHeight + 'px';
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  transW = innerWidth; transH = innerHeight;
}

// 特写球（轻量，供 drawOrb 与老虎机使用）
function transOrbFromCfg(side, cfg) {
  return { side, name: cfg.name, color: cfg.color, decor: cfg.decor, ability: cfg.ability, skill2: cfg.skill2, skill3: cfg.skill3 };
}
function transitionOrbs() {
  const list = panelKeys(gameMode).map((k, i) => {
    const c = players[k] || { name: 'PLAYER-' + (i + 1), color: COLORS[i % COLORS.length], decor: 'ring', ability: ABILITIES[0].id };
    return transOrbFromCfg(k, c);
  });
  if (gameMode === 6) { // BOSS 特写（能力随机，不显示具体能力名）
    const bc = makeBossCfg();
    list.push(transOrbFromCfg('boss', { name: 'BOSS', color: bc.color, decor: bc.decor, ability: null }));
  }
  return list;
}
function randomTransOrb(proto) {
  const a = ABILITIES[Math.floor(Math.random() * ABILITIES.length)];
  const extra = Math.random() < .4 ? ABILITIES[Math.floor(Math.random() * ABILITIES.length)].id : null;
  const extra3 = extra && Math.random() < .4 ? ABILITIES[Math.floor(Math.random() * ABILITIES.length)].id : null;
  return {
    name: (proto && proto.name) || 'PLAYER', // 轮转阶段 final 尚未决定，名字从当前滚动对象取
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    decor: DECORS[Math.floor(Math.random() * DECORS.length)].id,
    ability: a.id, skill2: extra, skill3: extra3,
  };
}

// 选人特写排布：斜角 / 三角 / 菱形 / 2v2 左右斜列 / BOSS 四角+中央（刻意避免横平竖直）
function transLayout(mode, n) {
  const W = transW, H = transH;
  const cx = W / 2, cy = H * .42;
  const R = Math.min(W, H);
  if (mode === 2) return [
    { x: cx - R * .20, y: cy - R * .10, r: R * .13, a: -.5 },
    { x: cx + R * .20, y: cy + R * .10, r: R * .13, a: .5 },
  ];
  if (mode === 3) return [
    { x: cx, y: cy - R * .15, r: R * .115, a: 0 },
    { x: cx - R * .17, y: cy + R * .14, r: R * .115, a: -1.05 },
    { x: cx + R * .17, y: cy + R * .14, r: R * .115, a: 1.05 },
  ];
  if (mode === 5) return [ // 蓝队左侧斜列、红队右侧斜列
    { x: cx - R * .26, y: cy - R * .11, r: R * .10, a: -.45, team: 'blue' },
    { x: cx - R * .15, y: cy + R * .11, r: R * .10, a: -.9, team: 'blue' },
    { x: cx + R * .26, y: cy - R * .11, r: R * .10, a: .45, team: 'red' },
    { x: cx + R * .15, y: cy + R * .11, r: R * .10, a: .9, team: 'red' },
  ];
  if (mode === 6) return [
    { x: cx - R * .23, y: cy - R * .17, r: R * .095, a: -1.4, team: 'players' },
    { x: cx + R * .23, y: cy - R * .17, r: R * .095, a: 1.4, team: 'players' },
    { x: cx - R * .17, y: cy + R * .16, r: R * .095, a: -1.1, team: 'players' },
    { x: cx + R * .17, y: cy + R * .16, r: R * .095, a: 1.1, team: 'players' },
    { x: cx, y: cy - R * .02, r: R * .16, a: 0, boss: true, team: 'boss' },
  ];
  return [ // mode 4 菱形
    { x: cx, y: cy - R * .16, r: R * .10, a: 0 },
    { x: cx - R * .18, y: cy + R * .05, r: R * .10, a: -1.57 },
    { x: cx + R * .18, y: cy + R * .05, r: R * .10, a: 1.57 },
    { x: cx, y: cy + R * .20, r: R * .10, a: 3.14 },
  ];
}
function transTeamColor(side) {
  if (gameMode === 5) return side === 'blue' ? '#2f6bff' : '#ff2d55';
  if (gameMode === 6) return side === 'boss' ? '#ff2d55' : '#2dff8f';
  return null;
}

// 特写舞台绘制（老虎机动画 + 斜角排布 + 弧线连接 + 扫描光 + 模式标签/VS/锁定光效 + 随进度依次点亮/高光脉冲）
const MODE_LABELS = { 2: '双球对决', 3: '三方混战', 4: '四方混战', 5: '2V2 团战', 6: '4V1 BOSS' };
function drawTransitionStage(t, dur) {
  const W = transW, H = transH;
  tctx.clearRect(0, 0, W, H);
  const orbs = transOrbs || [], layout = transLayoutCache || [];
  const p = Math.min(1, t / (dur / 1000 || 1)); // 加载进度 0~1（决定点亮顺序）
  // 从暗到亮：球 i 在进度 (i+1.1)/(2.2n) 处点亮（4P 约每 1.1s 亮一个，5s 内全部亮起）；
  // 点亮瞬间产生 0.45s 高光脉冲（白泛光 + 十字光斑 + 扩散环），随后回落到正常颜色
  const liArr = [], hgArr = [];
  for (let i = 0; i < orbs.length; i++) {
    liArr.push(Math.max(0, Math.min(1, (p * 2.2 * orbs.length - i) / 1.1)));
    const ti = Math.max(i / (2.2 * orbs.length) * (dur / 1000), .45); // 点亮时刻（秒，至少 0.45s 让首球也有升起过程）
    hgArr.push(Math.max(0, 1 - Math.abs(t - ti) / .45)); // 对称高光脉冲：点亮瞬间达峰，前后各 0.45s 升起/衰减
  }
  // 背景浮尘
  for (let i = 0; i < 30; i++) {
    const px = ((i * 173.31 + t * 24) % (W + 40)) - 20;
    const py = ((i * 97.71 + t * 16 * (i % 2 ? 1 : -1)) % (H + 40)) - 20;
    tctx.fillStyle = `rgba(0,229,255,${.06 + .1 * Math.sin(t * 2 + i)})`;
    tctx.fillRect(px, py, 2, 2);
  }
  // 弧线连接（贝塞尔，非直线非水平竖直）
  for (let i = 0; i < orbs.length; i++) {
    for (let j = i + 1; j < orbs.length; j++) {
      const A = layout[i], B = layout[j];
      const cA = layout[i].team ? transTeamColor(layout[i].team) : orbs[i].color.main;
      const cB = layout[j].team ? transTeamColor(layout[j].team) : orbs[j].color.main;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const off = (B.x - A.x) * .28; // 弧线垂直偏摆
      tctx.save();
      tctx.strokeStyle = cA; tctx.globalAlpha = .14;
      tctx.lineWidth = 1.4; tctx.setLineDash([10, 12]); tctx.lineDashOffset = -t * 40;
      tctx.beginPath(); tctx.moveTo(A.x, A.y); tctx.quadraticCurveTo(mx + off, my - off, B.x, B.y); tctx.stroke();
      tctx.strokeStyle = cB; tctx.globalAlpha = .2;
      tctx.beginPath(); tctx.moveTo(A.x, A.y); tctx.quadraticCurveTo(mx - off, my + off, B.x, B.y); tctx.stroke();
      tctx.restore();
    }
  }
  // 顶部模式标签（微倾斜，不横平竖直）
  tctx.save();
  tctx.translate(W / 2, 44); tctx.rotate(-.045);
  tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
  tctx.font = '700 15px Consolas,monospace';
  tctx.letterSpacing = '.3em';
  tctx.fillStyle = 'rgba(0,229,255,.85)'; tctx.shadowColor = '#00e5ff'; tctx.shadowBlur = 14;
  tctx.fillText('◆ ' + (MODE_LABELS[gameMode] || gameMode + 'P') + ' ◆', 0, 0);
  tctx.restore();
  // 第一遍：光晕、队伍底环、展示框（全部画完再画球，避免后画的大光晕盖住前面的球）
  orbs.forEach((o, i) => {
    const L = layout[i];
    const slot = transSlot ? transSlot[i] : null;
    const cur = slot ? slot.cur : o;
    const wob = L.r * .05;
    const x = L.x + Math.sin(t * 1.3 + i * 2.1) * wob * 2;
    const y = L.y + Math.cos(t * 1.1 + i * 1.7) * wob * 2;
    const g = tctx.createRadialGradient(x, y, L.r * .2, x, y, L.r * 2.5);
    g.addColorStop(0, hexA(cur.color.main, (L.boss ? .2 : .32) * liArr[i])); // BOSS 光晕压低避免吞掉玩家球；亮度随点亮进度
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = g;
    tctx.beginPath(); tctx.arc(x, y, L.r * 2.5, 0, TAU); tctx.fill();
    if (L.team) {
      const tc = transTeamColor(L.team);
      tctx.save();
      tctx.strokeStyle = hexA(tc, .5 * liArr[i]); tctx.lineWidth = 3; tctx.setLineDash([26, 18]); tctx.lineDashOffset = -t * 46;
      tctx.beginPath(); tctx.arc(x, y, L.r + 12, 0, TAU); tctx.stroke();
      tctx.restore();
    }
    // 展示框：旋转八角形（轮转期虚线闪烁，定格后实线辉光；顶点带亮点，不横平竖直；亮度随点亮进度）
    const stopped = !slot || slot.stopped;
    const fr = L.r * 1.35;
    const li = liArr[i];
    tctx.save();
    tctx.translate(x, y); tctx.rotate(t * .4 + i * 1.1);
    tctx.strokeStyle = hexA(cur.color.main, (stopped ? .8 : .38) * (.25 + .75 * li));
    tctx.lineWidth = stopped ? 2.5 : 1.5;
    if (!stopped) tctx.setLineDash([12, 9]);
    tctx.shadowColor = cur.color.main; tctx.shadowBlur = stopped ? 14 * li : 0;
    tctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU - Math.PI / 2;
      const px = Math.cos(a) * fr, py = Math.sin(a) * fr;
      k ? tctx.lineTo(px, py) : tctx.moveTo(px, py);
    }
    tctx.closePath(); tctx.stroke();
    tctx.setLineDash([]); tctx.shadowBlur = 0;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU - Math.PI / 2;
      tctx.fillStyle = hexA(cur.color.bright, (stopped ? .85 : .3) * (.25 + .75 * li));
      tctx.beginPath(); tctx.arc(Math.cos(a) * fr, Math.sin(a) * fr, stopped ? 3.2 : 2, 0, TAU); tctx.fill();
    }
    tctx.restore();
  });
  // 第二遍：球体 + 名字 + 能力名 + 锁定光效（保证球体不被光晕遮挡）
  orbs.forEach((o, i) => {
    const L = layout[i];
    const slot = transSlot ? transSlot[i] : null;
    const cur = slot ? slot.cur : o;
    const wob = L.r * .05;
    const x = L.x + Math.sin(t * 1.3 + i * 2.1) * wob * 2;
    const y = L.y + Math.cos(t * 1.1 + i * 1.7) * wob * 2;
    const li = liArr[i], hg = hgArr[i];
    // 老虎机未停：残影拖尾（亮度随点亮进度）
    if (slot && !slot.stopped) {
      for (let k = 1; k <= 2; k++) {
        const ox = x + Math.cos(t * 15 + i * 3) * k * 9;
        const oy = y + Math.sin(t * 13 + i * 4) * k * 9;
        tctx.globalAlpha = .15 / k * li;
        drawOrb(tctx, { x: ox, y: oy, r: L.r * .96, angle: t * 2 + i, color: cur.color, decor: cur.decor, history: null, shieldT: 0, rushT: 0, flash: 0 }, t);
      }
      tctx.globalAlpha = 1;
    }
    // 主体球
    const orb = { x, y, r: L.r, angle: t * .9 + L.a + i, color: cur.color, decor: cur.decor, history: null, shieldT: 0, rushT: 0, flash: 0 };
    drawOrb(tctx, orb, t);
    // 暗罩：未点亮时球体压暗（从暗到亮）
    if (li < 1) {
      tctx.save();
      tctx.globalAlpha = (1 - li) * .62;
      tctx.fillStyle = '#05070d';
      tctx.beginPath(); tctx.arc(x, y, L.r, 0, TAU); tctx.fill();
      tctx.restore();
    }
    // 高光脉冲：点亮瞬间白光大泛光 + 十字光斑 + 扩散环，0.45s 衰减回正常（光污染）
    if (hg > 0) {
      tctx.save();
      const wg = tctx.createRadialGradient(x, y, 0, x, y, L.r * 3);
      wg.addColorStop(0, `rgba(255,255,255,${.8 * hg})`);
      wg.addColorStop(.35, `rgba(255,255,255,${.3 * hg})`);
      wg.addColorStop(1, 'rgba(255,255,255,0)');
      tctx.fillStyle = wg;
      tctx.beginPath(); tctx.arc(x, y, L.r * 3, 0, TAU); tctx.fill();
      tctx.strokeStyle = `rgba(255,255,255,${.6 * hg})`;
      tctx.lineWidth = 2.5;
      tctx.beginPath();
      tctx.moveTo(x - L.r * 2.6, y); tctx.lineTo(x + L.r * 2.6, y);
      tctx.moveTo(x, y - L.r * 2.6); tctx.lineTo(x, y + L.r * 2.6);
      tctx.stroke();
      const er = L.r * (1.3 + (1 - hg) * .9); // 扩散环（从内向外撑开）
      tctx.strokeStyle = cur.color.bright; tctx.globalAlpha = .55 * hg;
      tctx.lineWidth = 2.5;
      tctx.beginPath(); tctx.arc(x, y, er, 0, TAU); tctx.stroke();
      tctx.restore();
    }
    // 老虎机定格光效：停止后 0.5s 内扩散光环 + LOCKED
    if (slot && slot.stoppedAt) {
      const d = t * 1000 - slot.stoppedAt;
      if (d >= 0 && d < 500) {
        const k = d / 500;
        tctx.save();
        tctx.strokeStyle = cur.color.bright; tctx.globalAlpha = (1 - k) * .9;
        tctx.lineWidth = 3.5;
        tctx.beginPath(); tctx.arc(x, y, L.r + 10 + k * L.r * .9, 0, TAU); tctx.stroke();
        tctx.globalAlpha = (1 - k) * .5;
        tctx.font = '700 15px Consolas,monospace'; tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
        tctx.fillStyle = '#fff';
        tctx.fillText('◈ LOCKED', x, y - L.r - 26);
        tctx.restore();
      }
    }
    // 名字（BOSS 大字放球上方避免与底部日志重叠）
    tctx.save();
    tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
    const nameY = L.boss ? y - L.r - 34 : y + L.r + 26;
    if (L.boss) {
      tctx.font = '900 44px "Segoe UI",sans-serif';
      tctx.fillStyle = '#ff5060'; tctx.shadowColor = '#ff2d55'; tctx.shadowBlur = 26;
      tctx.fillText('BOSS', x, nameY);
    } else {
      tctx.font = '700 21px "Segoe UI","Microsoft YaHei",sans-serif';
      tctx.fillStyle = cur.color.bright; tctx.shadowColor = cur.color.main; tctx.shadowBlur = 12;
      tctx.fillText(o.name, x, nameY);
    }
    tctx.shadowBlur = 0;
    // 能力名（半透明底衬提升可读性；老虎机滚动中显示当前滚动能力；BOSS 不显示）
    if (!L.boss) {
      const abName = [cur.ability, cur.skill2, cur.skill3].filter(id => id && id !== 'none').map(id => (abOf(id) || { name: '' }).name).join(' & ');
      const ay = nameY + 26;
      tctx.font = '12px Consolas,monospace'; // 先设字体再测量，底衬宽度才准确
      const tx = tctx.measureText('◈ ' + abName).width;
      tctx.fillStyle = 'rgba(2,6,14,.62)';
      tctx.fillRect(x - tx / 2 - 8, ay - 11, tx + 16, 22);
      tctx.fillStyle = slot && !slot.stopped ? '#ffe9a0' : '#9fc4e8';
      tctx.fillText('◈ ' + abName, x, ay);
    }
    tctx.restore();
    // 队伍名标签（2v2 蓝/红）
    if (L.team && !L.boss) {
      tctx.save();
      tctx.font = '700 15px "Microsoft YaHei",sans-serif';
      tctx.fillStyle = hexA(transTeamColor(L.team), .95);
      const ly = y - L.r - (slot && slot.stoppedAt && t * 1000 - slot.stoppedAt < 500 ? 52 : 26);
      tctx.fillText(transTeamColor(L.team) === '#2f6bff' ? '蓝队' : L.team === 'players' ? '玩家队' : '红队', x, ly);
      tctx.restore();
    }
  });
  // 2P 斜角 VS 大字（不横平竖直）
  if (gameMode === 2 && layout.length >= 2) {
    const vx = (layout[0].x + layout[1].x) / 2, vy = (layout[0].y + layout[1].y) / 2 + Math.min(transW, transH) * .13;
    tctx.save();
    tctx.translate(vx, vy); tctx.rotate(.16);
    tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
    tctx.font = '900 84px "Segoe UI",sans-serif';
    tctx.fillStyle = 'rgba(0,229,255,.16)';
    tctx.fillText('VS', 3, 3);
    tctx.fillStyle = '#cfeaff'; tctx.shadowColor = '#00e5ff'; tctx.shadowBlur = 30;
    tctx.fillText('VS', 0, 0);
    tctx.restore();
  }
  // 全屏泛光：点亮瞬间的全局光污染（微弱白光叠加）
  const hgMax = hgArr.reduce((a, b) => Math.max(a, b), 0);
  if (hgMax > .01) {
    tctx.fillStyle = `rgba(190,225,255,${hgMax * .06})`;
    tctx.fillRect(0, 0, W, H);
  }
  // 扫描光带
  tctx.save();
  tctx.globalAlpha = .055;
  const sx = (t * 300) % (W + 400) - 200;
  tctx.fillStyle = '#00e5ff';
  tctx.beginPath();
  tctx.moveTo(sx, 0); tctx.lineTo(sx + 140, 0); tctx.lineTo(sx - 50, H); tctx.lineTo(sx - 190, H);
  tctx.closePath(); tctx.fill();
  tctx.restore();
}

// 随机启动：不预先随机，进入加载界面后由转场轮转在停止时刻才决定结果
function startRandomTransition() {
  transRandom = true;
  startTransition();
}

function startTransition() {
  const seq = ++transitionSeq;
  const isRandom = transRandom;
  showScreen('transition');
  const log = $('#trans-log'), fill = $('#trans-fill'), pct = $('#trans-pct');
  log.textContent = ''; fill.style.width = '0%'; pct.textContent = '0%';
  // 随机模式：10s 长转场（前 5s 老虎机轮转 + 后 5s 定格展示）；手动模式 1.7s
  const dur = isRandom ? 10000 : 1700;
  const lines = isRandom ? [
    '[ ⚄ ] 随机抽取战斗配置 SHUFFLING .......',
    '[ OK ] 初始化轨道核心 ORB-CORE v2.4 ......',
    '[ OK ] 校准战斗场域 FIELD-CALIB ..........',
    '[ OK ] 加载能力模块 WEAPON-MOD ...........',
    '[ OK ] 同步光学传感器 SENSOR-SYNC ........',
    '>>> 战斗协议启动，祝好运',
  ] : [
    '[ OK ] 初始化轨道核心 ORB-CORE v2.4 ......',
    '[ OK ] 校准战斗场域 FIELD-CALIB ..........',
    '[ OK ] 加载能力模块 WEAPON-MOD ...........',
    '[ OK ] 同步光学传感器 SENSOR-SYNC ........',
    '>>> 战斗协议启动，祝好运',
  ];
  lines.forEach((s, i) => setTimeout(() => { if (seq !== transitionSeq) return; log.textContent += s + '\n'; sfx('ui'); }, 120 + i * (isRandom ? 1900 : 380)));
  // 特写初始化（随机模式：前 5s 高速轮转，逐球在 3.6~4.9s 错峰定格；结果在轮转停止时刻才随机生成）
  resizeTrans(); // 先定画布尺寸（transW/transH），布局计算依赖它
  transOrbs = transitionOrbs();
  transLayoutCache = transLayout(gameMode, transOrbs.length);
  transSlot = isRandom ? transOrbs.map((o, i) => ({ final: null, cur: randomTransOrb(o), stopAt: 3600 + i * 320, stopped: false, stoppedAt: 0 })) : null;
  let transRolled = false; // 轮转停止时刻才调用 randomizeAll（结果不预先决定）
  const t0 = performance.now();
  (function step(now) {
    if (seq !== transitionSeq) return; // 旧转场链失效
    const el = now - t0;
    const p = Math.min(1, el / dur);
    fill.style.width = (p * 100) + '%';
    pct.textContent = Math.floor(p * 100) + '%';
    if (transSlot) { // 老虎机：第一个槽停止瞬间决定随机结果，再逐槽错峰定格
      if (!transRolled && el >= transSlot[0].stopAt) {
        randomizeAll(); // 此刻才真正随机（更新选择屏面板配置）
        transRolled = true;
        players = {}; // 同步 players：readConfig 读面板 → 转场定格展示真实随机结果
        for (const k of panelKeys(gameMode)) players[k] = readConfig(k);
        transOrbs = transitionOrbs(); // 重读随机后的最终配置
        transSlot.forEach((s, i) => { s.final = transOrbs[i]; });
      }
      for (const s of transSlot) {
        if (s.stopped) continue;
        if (el >= s.stopAt) { s.stopped = true; s.stoppedAt = el; s.cur = s.final || s.cur; sfx('ui'); }
        else if (Math.random() < .55) s.cur = randomTransOrb(s.final || s.cur);
      }
    }
    drawTransitionStage(el / 1000, dur);
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
$('#btn-again').onclick = () => { transRandom = false; startTransition(); }; // 再战：沿用当前配置（短转场展示，不重新洗牌）
$('#btn-reconfig').onclick = () => { showScreen('select'); buildPanels(); };
$('#btn-random2').onclick = startRandomTransition; // 随机启动（3P/4P 多球入口）
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
    } else if (r === 'fieldScale') { // 场地尺寸：100% → 90% → 80% → 70% 循环（以中心收缩）
      const scales = [1, .9, .8, .7];
      gameRules.fieldScale = scales[(scales.indexOf(gameRules.fieldScale || 1) + 1) % scales.length];
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
addEventListener('resize', () => {
  if (state === 'battle') resizeCanvas();
  if (state === 'result') resizeFx();
  if (state === 'transition') { resizeTrans(); if (transLayoutCache.length) transLayoutCache = transLayout(gameMode, transOrbs.length); } // 转场中 resize：同步重排特写
});

// ---------------- 启动 ----------------
buildPanels();
requestAnimationFrame(loop);

// URL 参数 ?auto=1 直接开战（用于演示/测试；走随机启动流程以展示老虎机转场，结果在轮转停止时随机）
const qs = new URLSearchParams(location.search);
if (qs.get('auto') === '1') {
  startRandomTransition();
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
