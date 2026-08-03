function makeOrb(side, cfg) {
  const ab = abOf(cfg.ability);
  return {
    side, name: cfg.name, color: cfg.color, decor: cfg.decor, ability: cfg.ability,
    x: 0, y: 0, vx: 0, vy: 0, r: 50,
    hp: 400, maxHp: 400,
    cd: ab.cd * .55, maxCd: ab.cd,
    flash: 0, shieldT: 0, rushT: 0, regenT: 0, invT: 0,
    // 新能力状态
    burnT: 0, slowT: 0, slowPct: 0, sealT: 0,
    comboN: 0, comboX: 0, vampT: 0, batT: 0, frostT: 0, sonicT: 0,
    railT1: 0, railT2: 0, railT3: 0, echoX: 0, echoY: 0, echoHp: 0, fangCd: 0,
    chemN: 0, charge: 0, portalCd: 0, splitCd: 0,
    // V4 新能力状态
    venomN: 0, venomT: 0, ghostT: 0, webT: 0, stunT: 0, starT: 0,
    // V5 新能力状态
    evolveX: 0, evolveLv: 0, lanceT: 0, lanceA: 0,
    // V6 强化状态
    launchT: 0, webVulnT: 0,
    // V8 新能力状态
    pinned: null, pinT: 0, // 诅咒之钉：被钉住的钉子引用（撞墙才释放，pinT 为兼容保留）
    corrodeN: 0, corrodeT: 0, corrodeSlowN: 0, corrodeSlowT: 0, // 腐蚀：易伤层数 / 减速层数
    coffinStage: 0, butterflyCd: 0, // 棺椁：已触发阈值档位 / 蝴蝶生成冷却
    techWall: null, // 科技I/II：待放置激光台的墙面位置
    liquidHp: 0, atkBonus: 0, liquidCd: 0, // 液袋：护盾血量 / 永久攻击加成 / 击破后重新裹袋冷却
    vulnT: 0, // 电线杆：易伤（受击 +50%）
    bondPts: [], bondWall: null, // 拘束：锚点数组 / 待放置锚点
    angle: Math.random() * TAU, history: [],
    alive: true,
  };
}

// 战斗 HUD：按模式动态生成四角面板（2P: 左上右上 / 3P: 左上左下右下 / 4P: 四角）
function buildHUD() {
  const hud = $('#hud');
  hud.querySelectorAll('.hud-side').forEach(el => el.remove());
  const n = battle.mode;
  const posOf = side => {
    if (n === 2) return side === 'left' ? 'tl' : 'tr';
    if (n === 3) return side === 'left' ? 'tl' : side === 'right' ? 'bl' : 'br';
    return side === 'left' ? 'tl' : side === 'right' ? 'tr' : side === 'p2' ? 'bl' : 'br';
  };
  battle.orbs.forEach(o => {
    const pos = posOf(o.side);
    const right = pos === 'tr' || pos === 'br';
    const el = document.createElement('div');
    el.className = 'hud-side ' + pos + (right ? ' right' : '');
    el.id = 'hud-side-' + o.side;
    el.innerHTML = `
      <div class="hud-name" id="hud-name-${o.side}">PLAYER</div>
      <div class="hud-type" id="hud-type-${o.side}">近战 MELEE</div>
      <div class="hpbar"><div class="hpfill" id="hp-${o.side}"></div><div class="hpnum" id="hpnum-${o.side}">100%</div></div>
      <div class="hud-job" id="hud-job-${o.side}"></div>
      <div class="hud-status" id="hud-status-${o.side}"></div>
      <div class="cdrow">
        <div class="cd-icon" id="cd-icon-${o.side}">◉</div>
        <div class="cdtrack"><div class="cdfill" id="cd-${o.side}"></div></div>
      </div>
      <div class="cdrow railrow" id="railrow-${o.side}">
        <div class="rail-icon" style="color:#ffd0ff">◎</div>
        <div class="cdtrack"><div class="railfill" id="rail2-${o.side}"></div></div>
        <div class="rail-icon" style="color:#ffe9a0">≡</div>
        <div class="cdtrack"><div class="railfill" id="rail3-${o.side}"></div></div>
      </div>`;
    hud.insertBefore(el, hud.querySelector('.hud-mid'));
  });
  const vs = $('#hud-vs');
  vs.textContent = n === 2 ? 'VS' : n + 'P 混战';
}

function startBattle() {
  const F = fieldRect();
  const n = gameMode;
  const orbs = [];
  // 面板键：双球沿用 left/right，多球为 p0..p3
  const keys = n === 2 ? ['left', 'right'] : ['p0', 'p1', 'p2', 'p3'].slice(0, n);
  const cfgs = keys.map(k => players[k] || players.left || Object.values(players)[0] || { name: 'P', color: COLORS[0], decor: 'ring', ability: ABILITIES[0].id });
  cfgs.forEach((cfg, i) => {
    const o = makeOrb(i === 0 ? 'left' : i === 1 ? 'right' : 'p' + i, cfg);
    orbs.push(o);
  });
  const sp = 300;
  for (let i = 0; i < n; i++) {
    const o = orbs[i];
    const ang0 = i / n * TAU - Math.PI / 2; // 环形均布（从顶部开始）
    const cx = F.x + F.s / 2, cy = F.y + F.s / 2;
    const rr = F.s * (n === 2 ? .26 : .3);
    o.x = cx + Math.cos(ang0) * rr;
    o.y = cy + Math.sin(ang0) * rr;
    // 外切方向飞行：朝外侧半球（避免开局对冲），随机 ±50°
    const outA = ang0 + rand(-.9, .9);
    o.vx = Math.cos(outA) * sp; o.vy = Math.sin(outA) * sp;
  }
  battle = { orbs, left: orbs[0], right: orbs[1] || null, proj: [], fx: [], structs: [], time: 0, shake: 0, over: false, winner: null, paused: false, ambient: [], mode: n };
  // 场地漂浮粒子（氛围）
  for (let i = 0; i < 36; i++) {
    battle.ambient.push({ x: rand(F.x, F.x + F.s), y: rand(F.y, F.y + F.s), vx: rand(-14, 14), vy: rand(-14, 14), size: rand(1, 2.6), a: rand(.08, .4), ph: rand(0, TAU) });
  }
  buildHUD();
  // HUD 文案
  const typeColor = { melee: '#ffb020', ranged: '#00e5ff' };
  battle.orbs.forEach((o, i) => {
    const sideKey = o.side;
    $('#hud-name-' + sideKey).textContent = o.name;
    $('#hud-name-' + sideKey).style.color = o.color.main;
    $('#hud-type-' + sideKey).textContent = TYPE_LABEL[abOf(o.ability).type];
    $('#hud-type-' + sideKey).style.color = typeColor[abOf(o.ability).type];
    $('#hud-job-' + sideKey).textContent = '◈ ' + abOf(o.ability).name;
    $('#hud-job-' + sideKey).style.color = o.color.bright;
    $('#cd-icon-' + sideKey).textContent = abOf(o.ability).icon;
    $('#hp-' + sideKey).style.width = '100%';
    $('#cd-' + sideKey).style.width = '0%';
  });
  $('#pause-overlay').classList.remove('on');
  resizeCanvas();
  showScreen('battle');
}

function moveOrb(o, dt, foe) {
  const F = fieldRect();
  // V8 诅咒之钉：被钉住时位置锁定，随钉子一起飞行（速度同步钉子）——优先于定身，避免眩晕期间原地滞留、结束瞬间瞬移
  if (o.pinned) {
    o.x = o.pinned.x; o.y = o.pinned.y;
    o.vx = o.pinned.vx; o.vy = o.pinned.vy;
    o.angle += dt * 2;
    if (o.stunT > 0) o.stunT = Math.max(0, o.stunT - dt); // 被钉拖行期间眩晕计时照常流逝（释放后不残留）
    o.history.push({ x: o.x, y: o.y });
    const maxLenP = o.decor === 'trail' ? 30 : 12;
    if (o.history.length > maxLenP) o.history.splice(0, o.history.length - maxLenP);
    return;
  }
  // 定身（火山喷发）：原地不动，不位移不反弹
  if (o.stunT > 0) {
    o.stunT -= dt;
    o.angle += dt * 1.2;
    return;
  }
  // 纯直线运动：完全随机直线飞行，只有撞击 / 技能命中 / 边界反弹会改变路径（零主动干预）
  // 边界反弹（不可越界）
  const minX = F.x + o.r, maxX = F.x + F.s - o.r;
  const minY = F.y + o.r, maxY = F.y + F.s - o.r;
  const webBounce = (o, axis) => { // 网缚反弹：反弹后速度减半（蛛网）
    if (o.webT > 0) {
      o.webT = 0;
      if (axis === 'x') o.vx *= .5; else o.vy *= .5;
      addText(o.x, o.y - 34, '网缚反弹', '#e8f4ff', 12);
      addSparks(o.x, o.y, 5, '#e8f4ff');
    }
  };
  // V8 撞墙 hook：科技I/II 留激光台 · 拘束留锚 · 棺椁散蝴蝶（在 updateBattle 中消费）
  const onWallHit = (o) => {
    if (o.ability === 'anchor') o.wallHit = { x: o.x, y: o.y };
    if (o.ability === 'tech1' || o.ability === 'tech2') o.techWall = { x: o.x, y: o.y };
    if (o.ability === 'bond') o.bondWall = { x: o.x, y: o.y };
    if (o.ability === 'coffin') o.butterflyWall = { x: o.x, y: o.y };
  };
  const launchBounce = (o) => { // 弹射撞墙：受 2 次近战撞击伤害（发射台强化）
    if (o.launchT > 0) {
      o.launchT = 0;
      hitOrb(o, 16, foe, true, true); // 16 × 1.5 全局 = 24 实伤 ≈ 2 次近战撞击
      addText(o.x, o.y - 40, '弹射撞墙!', '#ffd050', 14);
      addSparks(o.x, o.y, 8, '#ffd050');
      sfx('clash');
    }
  };
  if (o.x < minX) { o.x = minX; o.vx = Math.abs(o.vx); webBounce(o, 'x'); launchBounce(o); onWallHit(o); }
  if (o.x > maxX) { o.x = maxX; o.vx = -Math.abs(o.vx); webBounce(o, 'x'); launchBounce(o); onWallHit(o); }
  if (o.y < minY) { o.y = minY; o.vy = Math.abs(o.vy); webBounce(o, 'y'); launchBounce(o); onWallHit(o); }
  if (o.y > maxY) { o.y = maxY; o.vy = -Math.abs(o.vy); webBounce(o, 'y'); launchBounce(o); onWallHit(o); }
  // 巡航速度回归：速度自然衰减回类型巡航速度（狂暴突进 > 狂暴 > 连击层数 > 拘束锚点 > 远程；被撞后逃脱加速）
  const comboSpd = (o.ability === 'combo' && o.comboN > 0) ? (1 + o.comboN * .045 * (o.comboX > 0 ? 2 : 1)) : 1;
  const bondSpd = (o.ability === 'bond' && o.bondPts.length > 0) ? (1 + o.bondPts.length * .08) : 1; // 拘束：锚点越多越快
  const cruise = 300 * (o.rushT > 0 ? 2.2 : 1) * comboSpd * bondSpd;
  const spd = Math.hypot(o.vx, o.vy);
  const ns = spd + (cruise - spd) * Math.min(1, dt * 1.5);
  if (spd > .001) { o.vx = o.vx / spd * ns; o.vy = o.vy / spd * ns; }
  // 骑枪冲刺：每帧把速度大小强制为 900（方向保持当前，撞墙反弹后继续朝新方向）
  if (o.lanceT > 0) {
    const spd2 = Math.hypot(o.vx, o.vy) || 1;
    const k = 900 / spd2;
    o.vx *= k; o.vy *= k;
  }
  // 位移（减速效果：只降速度不干预方向；腐蚀减速可叠加）
  let slowMult = o.slowT > 0 ? (1 - o.slowPct) : 1;
  if (o.corrodeSlowN > 0) slowMult *= 1 - Math.min(.6, o.corrodeSlowN * .12); // 腐蚀减速：每层 12%，上限 60%
  o.x += o.vx * dt * slowMult;
  o.y += o.vy * dt * slowMult;
  // 位移后 clamp（防高速冲刺/强推单帧越界闪烁）：越界同步翻转速度，保证反弹/网缚/锚点逻辑完整
  if (o.x < minX) { o.x = minX; o.vx = Math.abs(o.vx); webBounce(o, 'x'); launchBounce(o); onWallHit(o); }
  else if (o.x > maxX) { o.x = maxX; o.vx = -Math.abs(o.vx); webBounce(o, 'x'); launchBounce(o); onWallHit(o); }
  if (o.y < minY) { o.y = minY; o.vy = Math.abs(o.vy); webBounce(o, 'y'); launchBounce(o); onWallHit(o); }
  else if (o.y > maxY) { o.y = maxY; o.vy = -Math.abs(o.vy); webBounce(o, 'y'); launchBounce(o); onWallHit(o); }
  o.angle += dt * (1.2 + Math.hypot(o.vx, o.vy) / 260);
  o.history.push({ x: o.x, y: o.y });
  const maxLen = o.decor === 'trail' ? 30 : 12;
  if (o.history.length > maxLen) o.history.splice(0, o.history.length - maxLen);
}

function hitOrb(target, dmg, src, silent, isCollision) {
  if (battle.over) return;
  if (target.invT > 0) { // 无敌（传送门跃迁 2s）
    addText(target.x, target.y - 30, '无敌', '#9ff', 12);
    return;
  }
  if (target.shieldT > 0) { // 护盾挡一次 + 反伤
    target.shieldT = 0;
    addRing(target.x, target.y, 90, '#ffffff', 3);
    addSparks(target.x, target.y, 12, '#ffffff');
    sfx('shieldBrk');
    addText(target.x, target.y - 30, 'BLOCKED', '#9ff');
    if (src && src !== target && src.alive && src.invT <= 0) { // 反伤 10（无敌期不反伤）
      src.hp -= 10;
      addText(src.x, src.y - 30, '反伤', '#ff5060', 13);
      addSparks(src.x, src.y, 6, '#ff5060');
    }
    return;
  }
  dmg *= 1.5; // 全局伤害 +50%
  // 吸血鬼吸身期 90% 庇护：严格 10% 承伤，全部易伤/减伤乘区不叠加（互斥优先）
  if (battle.vamp && battle.vamp.t > 0 && target === battle.vamp.src) {
    dmg *= .1;
  } else {
    if (target.webVulnT > 0) dmg *= 1.75; // 蛛网易伤 +75%（强化）
    if (target.ghostT > 0) dmg *= .5; // 幽灵虚化（隐身）期 50% 庇护
    if (battle.proj.some(p => p.type === 'clone' && p.owner === target.side && p.life > 0)) dmg *= .5; // 替身在场：本体 50% 庇护（V7）
    // 近战球减伤：碰撞 -40%（在 collide 内处理）、远程/技能伤害 -20%
    if (!isCollision && src && abOf(src.ability).type === 'ranged' && abOf(target.ability).type === 'melee') dmg *= .8;
    if (target.frostT > 0 && !isCollision) dmg *= 1.25; // 深度冻结易伤 +25%
    if (target.corrodeN > 0) dmg *= 1 + target.corrodeN * .15; // 腐蚀易伤：每层 +15%（可叠加）
    if (target.vulnT > 0) dmg *= 1.5; // 电线杆落雷易伤 +50%
  }
  if (src && src.atkBonus > 0) dmg += src.atkBonus; // 液袋击破永久增攻（上限 +30）
  // 液袋护盾：伤害先扣液袋血量，击破时永久增攻
  if (target.liquidHp > 0) {
    const absorbed = Math.min(target.liquidHp, dmg);
    target.liquidHp -= absorbed;
    dmg -= absorbed;
    if (target.liquidHp <= 0) {
      target.liquidHp = 0;
      const gain = 5;
      target.atkBonus = Math.min(30, target.atkBonus + gain);
      addRing(target.x, target.y, 60, '#7df3ff', 3);
      addText(target.x, target.y - 44, '液袋击破 · 攻+' + gain, '#7df3ff', 13);
      sfx('shieldBrk');
    }
    if (dmg <= 0) { addSparks(target.x, target.y, 4, '#7df3ff'); return; }
  }
  target.hp -= dmg;
  target.flash = .22;
  const big = dmg >= 22;
  addText(target.x + rand(-8, 8), target.y - 28, '-' + Math.round(dmg), big ? '#ffd050' : target.color.bright, big ? 19 : 16);
  if (!silent) { addSparks(target.x, target.y, 8, target.color.bright); sfx('hit'); }
  battle.shake = Math.min(13, battle.shake + 3.5);
  if (target.hp <= 0 && !battle.over) killOrb(target);
}

function collide(a, b) {
  // 吸血鬼吸身期：跳过碰撞结算（吸身自带 DPS），防止贴墙时每帧反复碰撞判定导致瞬间即死
  if (battle.vamp && battle.vamp.t > 0) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d >= a.r + b.r) return; // 未接触：绝不干预位置（修复"远处瞬移相吸"）
  let nx, ny;
  if (d < 0.001) { // 完全重叠：随机法线 + 无条件分离，解除永久重叠
    const ra = Math.random() * TAU;
    nx = Math.cos(ra); ny = Math.sin(ra);
    const ov = a.r + b.r;
    a.x -= nx * ov / 2; a.y -= ny * ov / 2;
    b.x += nx * ov / 2; b.y += ny * ov / 2;
    return;
  }
  nx = dx / d; ny = dy / d;
  const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
  const dot = dvx * nx + dvy * ny;
  if (dot <= 0) return; // 正在远离
  // 等质量弹性碰撞：交换法线方向速度分量（路径自然改变）
  a.vx -= dot * nx; a.vy -= dot * ny;
  b.vx += dot * nx; b.vy += dot * ny;
  // 位置分离（防重叠）
  const ov = a.r + b.r - d;
  a.x -= nx * ov / 2; a.y -= ny * ov / 2;
  b.x += nx * ov / 2; b.y += ny * ov / 2;
  // 轻微击退（撞击感，不弹飞）：只改速度不瞬移位置，巡航回归会快速收回
  const kick = Math.min(90, Math.abs(dot) * .3);
  b.vx += nx * kick; b.vy += ny * kick;
  a.vx -= nx * kick * .4; a.vy -= ny * kick * .4;
  // 撞击点特效
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  addRing(mx, my, 60, '#ffffff', 2.5);
  addSparks(mx, my, 10, a.color.bright);
  addSparks(mx, my, 10, b.color.bright);
  sfx('clash');
  battle.shake = Math.min(14, battle.shake + 6);
  // 伤害：基础 + 相对速度加成，rush 增伤；近战撞击更疼、远程撞击减伤；连击叠层增伤
  const base = 9, extra = Math.min(10, Math.abs(dot) / 6);
  const comboMult = o => (o.ability === 'combo' && o.comboN > 0) ? (1 + o.comboN * .08 * (o.comboX > 0 ? 2 : 1)) : 1;
  const evolveMult = o => (o.ability === 'evolve' && o.evolveLv > 0) ? (1 + o.evolveLv * .15) : 1;
  const meleeDef = o => abOf(o.ability).type === 'melee' ? .6 : 1; // 近战球碰撞伤害 -40%
  const dmgB = (base + extra + (a.rushT > 0 ? 12 : 0)) * (abOf(a.ability).type === 'melee' ? 1.3 : .5) * comboMult(a) * evolveMult(a) * meleeDef(b); // a 撞 b（rush 增伤 8→12）
  const dmgA = (base + extra + (b.rushT > 0 ? 12 : 0)) * (abOf(b.ability).type === 'melee' ? 1.3 : .5) * comboMult(b) * evolveMult(b) * meleeDef(a); // b 撞 a
  hitOrb(b, dmgB, a, true, true);
  hitOrb(a, dmgA, b, true, true);
  // 新：狂暴突进命中附带减速
  if (a.rushT > 0) { b.slowT = Math.max(b.slowT, .8); b.slowPct = .35; addText(b.x, b.y - 34, '震击减速', '#ff8090', 12); }
  if (b.rushT > 0) { a.slowT = Math.max(a.slowT, .8); a.slowPct = .35; addText(a.x, a.y - 34, '震击减速', '#ff8090', 12); }
  // —— 能力被动效果（撞击触发）——
  if (a.ability === 'burn') b.burnT = Math.max(b.burnT, 5);
  if (b.ability === 'burn') a.burnT = Math.max(a.burnT, 5);
  // 剧毒：主动撞击方给对方叠毒层（上限 5，毒时间 8s）
  if (a.ability === 'venom') { b.venomN = Math.min(5, b.venomN + 1); b.venomT = 8; addText(b.x, b.y - 52, '☣ 毒×' + b.venomN, '#9fe870', 13); }
  if (b.ability === 'venom') { a.venomN = Math.min(5, a.venomN + 1); a.venomT = 8; addText(a.x, a.y - 52, '☣ 毒×' + a.venomN, '#9fe870', 13); }
  // 进化：主动撞击方积累经验（每 3 点升级：体积+20% / 撞击伤害+15%，上限 3 级；进化加速期经验×2）
  if (a.ability === 'evolve') { a.evolveX += (a.evolveBoost > 0 ? 2 : 1); addText(a.x, a.y - 52, '🧬 经验+' + (a.evolveBoost > 0 ? 2 : 1), '#7dffa8', 12); if (a.evolveX >= 3 && a.evolveLv < 3) { a.evolveX = 0; a.evolveLv++; a.r *= 1.2; addRing(a.x, a.y, 70, '#7dffa8', 3); addText(a.x, a.y - 40, '🧬 进化 Lv.' + a.evolveLv, '#7dffa8', 16); sfx('evolve'); } }
  if (b.ability === 'evolve') { b.evolveX += (b.evolveBoost > 0 ? 2 : 1); addText(b.x, b.y - 52, '🧬 经验+' + (b.evolveBoost > 0 ? 2 : 1), '#7dffa8', 12); if (b.evolveX >= 3 && b.evolveLv < 3) { b.evolveX = 0; b.evolveLv++; b.r *= 1.2; addRing(b.x, b.y, 70, '#7dffa8', 3); addText(b.x, b.y - 40, '🧬 进化 Lv.' + b.evolveLv, '#7dffa8', 16); sfx('evolve'); } }
  if (a.ability === 'combo' && b.ability === 'combo') { // 双连击：互清后各自叠层
    a.comboN = Math.min(10, a.comboN + 1);
    b.comboN = Math.min(10, b.comboN + 1);
  } else {
    if (a.ability === 'combo') { a.comboN = Math.min(10, a.comboN + 1); b.comboN = 0; addText(a.x, a.y - 40, '连击×' + a.comboN, '#ffd050', 14); }
    if (b.ability === 'combo') { b.comboN = Math.min(10, b.comboN + 1); a.comboN = 0; addText(b.x, b.y - 40, '连击×' + b.comboN, '#ffd050', 14); }
  }
  if (a.ability === 'vampire' && !battle.vamp && a.vampT <= 0) battle.vamp = { src: a, foe: b, t: 2 };
  if (b.ability === 'vampire' && !battle.vamp && b.vampT <= 0) battle.vamp = { src: b, foe: a, t: 2 };
  if (a.ability === 'split' && a.splitCd <= 0 && b.alive) { // 被撞分裂
    a.splitCd = 3;
    const sa = Math.random() * TAU;
    battle.proj.push({ type: 'shard', owner: a.side, x: a.x + Math.cos(sa) * 85, y: a.y + Math.sin(sa) * 85, vx: Math.cos(sa) * 230, vy: Math.sin(sa) * 230, life: 5, r: 16, color: a.color.bright, hitT: 0, grace: .8 });
    addText(a.x, a.y - 40, '分裂', a.color.bright, 14);
  }
  if (b.ability === 'split' && b.splitCd <= 0 && a.alive) {
    b.splitCd = 3;
    const sa = Math.random() * TAU;
    battle.proj.push({ type: 'shard', owner: b.side, x: b.x + Math.cos(sa) * 85, y: b.y + Math.sin(sa) * 85, vx: Math.cos(sa) * 230, vy: Math.sin(sa) * 230, life: 5, r: 16, color: b.color.bright, hitT: 0, grace: .8 });
    addText(b.x, b.y - 40, '分裂', b.color.bright, 14);
  }
}

// ---------------- 能力 ----------------
// V8 棺椁：随机封锁一个"没有小球存在"的四分之一场景（禁止敌人进入）
function sealCoffinZone(o) {
  const F = fieldRect();
  const h = F.s / 2;
  const quads = [
    { x: F.x, y: F.y, w: h, h },          // 左上
    { x: F.x + h, y: F.y, w: h, h },      // 右上
    { x: F.x, y: F.y + h, w: h, h },      // 左下
    { x: F.x + h, y: F.y + h, w: h, h },  // 右下
  ];
  const inQuad = (o, q) => o.alive && o.x > q.x + 24 && o.x < q.x + q.w - 24 && o.y > q.y + 24 && o.y < q.y + q.h - 24;
  const free = quads.filter(q => !battle.orbs.some(o2 => inQuad(o2, q)));
  const pool = free.length ? free : quads;
  const q = pool[Math.floor(Math.random() * pool.length)];
  battle.structs.push({ type: 'coffinzone', owner: o.side, x: q.x, y: q.y, w: q.w, h: q.h, life: 6, hitT: 0 });
  addRing(q.x + q.w / 2, q.y + q.h / 2, 60, '#9a9ab0', 3);
  addText(q.x + q.w / 2, q.y + q.h / 2, '⚰ 封锁', '#9a9ab0', 15);
}
// V8 棺椁：在随机墙面的随机位置成片散落黑白蝴蝶（wallHitPos 为空则主动随机墙面）
function spawnButterflies(o, wallHitPos) {
  const F = fieldRect();
  const N = 10;
  let base;
  if (wallHitPos) {
    base = { x: wallHitPos.x, y: wallHitPos.y };
  } else {
    const edge = Math.floor(Math.random() * 4);
    base = edge === 0 ? { x: F.x + rand(F.s * .15, F.s * .85), y: F.y + 30 }
         : edge === 1 ? { x: F.x + F.s - 30, y: F.y + rand(F.s * .15, F.s * .85) }
         : edge === 2 ? { x: F.x + rand(F.s * .15, F.s * .85), y: F.y + F.s - 30 }
         : { x: F.x + 30, y: F.y + rand(F.s * .15, F.s * .85) };
  }
  for (let i = 0; i < N; i++) {
    const offA = rand(-1.3, 1.3);
    const offD = rand(10, 160); // 沿墙面散落
    const px = clamp(base.x + Math.cos(offA) * offD, F.x + 8, F.x + F.s - 8);
    const py = clamp(base.y + Math.sin(offA) * offD, F.y + 8, F.y + F.s - 8);
    const a = Math.atan2(o.y - py, o.x - px) + rand(-.5, .5);
    battle.proj.push({ type: 'butterfly', owner: o.side, x: px, y: py, vx: Math.cos(a) * rand(120, 240), vy: Math.sin(a) * rand(120, 240), life: 6, r: 8, black: Math.random() < .5, hitT: 0 });
  }
  addText(base.x, base.y - 30, '🦋 黑白蝴蝶', '#e8e8f0', 13);
  sfx('coffin');
}
// V8 科技I/II：放置激光发射器（撞墙或主动），频率/伤害随能力不同，最多同时 16 台
function placeLaserTurret(o) {
  const F = fieldRect();
  let x = o.x, y = o.y;
  if (o.techWall) { x = o.techWall.x; y = o.techWall.y; o.techWall = null; }
  x = clamp(x, F.x + 22, F.x + F.s - 22);
  y = clamp(y, F.y + 22, F.y + F.s - 22);
  const fast = o.ability === 'tech2';
  const mine = battle.structs.filter(s => s.type === 'laserturret' && s.owner === o.side);
  while (mine.length >= 16) { battle.structs.splice(battle.structs.indexOf(mine[0]), 1); mine.shift(); }
  battle.structs.push({ type: 'laserturret', owner: o.side, x, y, life: 20, fireT: rand(0, .3), fast, dmg: fast ? 4 : 10, cd: fast ? .28 : 1.15 });
  addRing(x, y, 34, '#6fe8ff', 2);
}
function fireAbility(o) {
  o.cd = 0;
  const foe = nearestFoe(o);
  switch (o.ability) {
    case 'pulse': {
      addRing(o.x, o.y, o.r, o.color.bright, 3.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: o.r, vr: 460, maxLife: .55, life: 0, color: o.color.bright, lw: 3.5 });
      addFx({ type: 'ring', x: o.x, y: o.y, r: o.r, vr: 300, maxLife: .5, life: 0, color: '#ffffff', lw: 1.5 });
      // 径向波粒子
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU;
        addFx({ type: 'spark', x: o.x, y: o.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, life: 0, maxLife: .5, size: 2.4, color: o.color.bright });
      }
      sfx('pulse');
      const d = Math.hypot(foe.x - o.x, foe.y - o.y);
      if (d < 420) {
        hitOrb(foe, 14, o); // 新：伤害 12→14
        foe.slowT = Math.max(foe.slowT, 1.2); foe.slowPct = .3; // 新：命中减速
        if (d > 1) { // 重叠时跳过击退（避免除零）；纯速度击退，不瞬移位置
          const nx = (foe.x - o.x) / d, ny = (foe.y - o.y) / d;
          foe.vx += nx * 180; foe.vy += ny * 180; // 新：击退 140→180
        }
      }
      break;
    }
    case 'shield':
      o.shieldT = 3.2;
      addRing(o.x, o.y, 60, o.color.bright, 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: o.r, vr: 300, maxLife: .4, life: 0, color: '#ffffff', lw: 1.8 });
      sfx('shield');
      break;
    case 'phantom':
      addRing(o.x, o.y, 50, o.color.bright, 2);
      for (let i = 0; i < 3; i++) { // 新：2→3 个幻影
        const a = o.angle + (i - 1) * 1.1;
        battle.proj.push({
          type: 'phantom', owner: o.side, x: o.x, y: o.y,
          vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
          life: 5, color: o.color.main, r: 14, // 新：寿命 4.5→5
        });
      }
      sfx('phantom');
      break;
    case 'missile':
      addSparks(o.x, o.y, 6, o.color.bright);
      for (let i = 0; i < 3; i++) { // 新：2→3 发追踪弹
        const B = battle;
        setTimeout(() => {
          if (!B || B.over || battle !== B) return; // 绑定战斗实例，重开后旧导弹不注入新战斗
          const a = Math.atan2(foe.y - o.y, foe.x - o.x) + (i - 1) * .45;
          B.proj.push({
            type: 'missile', owner: o.side, x: o.x, y: o.y,
            vx: Math.cos(a) * 110, vy: Math.sin(a) * 110,
            life: 7, color: o.color.bright, r: 8, turn: 4.2,
          });
        }, i * 150);
      }
      sfx('missile');
      break;
    case 'rush':
      o.rushT = 2.4; // 新：2.2→2.4
      addRing(o.x, o.y, 50, '#ff5060', 2.5);
      // 速度线粒子
      for (let i = 0; i < 10; i++) {
        const a = Math.atan2(o.vy, o.vx) + rand(-.5, .5);
        addFx({ type: 'spark', x: o.x + rand(-10, 10), y: o.y + rand(-10, 10), vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 0, maxLife: .4, size: 2.6, color: '#ff8090' });
      }
      sfx('rush');
      break;
    case 'repair':
      o.regenT = 4.5; // 新：3.5→4.5
      addRing(o.x, o.y, 45, '#3dff9e', 2);
      sfx('repair');
      break;
    case 'gravity': { // 引力阱：中心黑洞扭曲轨迹
      const F = fieldRect();
      battle.structs.push({ type: 'gravwell', owner: o.side, x: F.x + F.s / 2, y: F.y + F.s / 2, life: 4, pulse: 0 });
      // 释放瞬间吸入脉冲：双球被朝中心猛拉一把
      for (const o of battle.orbs) {
        const d = Math.hypot(F.x + F.s / 2 - o.x, F.y + F.s / 2 - o.y);
        if (d > 1) {
          const k = 90;
          o.vx += (F.x + F.s / 2 - o.x) / d * k;
          o.vy += (F.y + F.s / 2 - o.y) / d * k;
        }
      }
      addRing(F.x + F.s / 2, F.y + F.s / 2, 30, '#9fd8ff', 3);
      sfx('pulse');
      break;
    }
    case 'portal': { // 传送门：对角双门（我方进 +10 血 + 跃迁 2s 无敌，敌方进 -20 血）
      const F = fieldRect();
      const m = F.s * .16;
      battle.structs = battle.structs.filter(s => s.type !== 'portal');
      const g1 = { x: F.x + rand(m, F.s * .42), y: F.y + rand(m, F.s * .42) };
      const g2 = { x: F.x + rand(F.s * .58, F.s - m), y: F.y + rand(F.s * .58, F.s - m) };
      const a = { type: 'portal', owner: o.side, x: g1.x, y: g1.y, pair: null };
      const b = { type: 'portal', owner: o.side, x: g2.x, y: g2.y, pair: a };
      a.pair = b;
      battle.structs.push(a, b);
      addRing(g1.x, g1.y, 32, '#8df6ff', 2);
      addRing(g2.x, g2.y, 32, '#8df6ff', 2);
      sfx('phantom');
      break;
    }
    case 'chemist': { // 药剂师：六瓶药水随机搭配，大散射角（效果已 +30%）
      const F = fieldRect();
      const clampF = v => Math.max(F.x + 24, Math.min(F.x + F.s - 24, v));
      for (let i = 0; i < 6; i++) { // 新：4→6 瓶
        const kind = ['dmg', 'heal', 'slow'][Math.floor(Math.random() * 3)]; // 新：随机搭配
        const offX = rand(-140, 140), offY = rand(-100, 100); // 新：散射角更大
        let tx, ty;
        if (kind === 'dmg') { tx = clampF(foe.x + offX); ty = clampF(foe.y + offY); }
        else if (kind === 'heal') { const a = Math.atan2(o.vy, o.vx); tx = clampF(o.x + Math.cos(a) * 160 + offX); ty = clampF(o.y + Math.sin(a) * 160 + offY); }
        else { tx = clampF(foe.x + offX); ty = clampF(foe.y + offY); }
        battle.proj.push({ type: 'potion', kind, owner: o.side, x: o.x, y: o.y, tx, ty, sp: 340, life: 3, color: kind === 'dmg' ? '#ff5566' : kind === 'heal' ? '#3dff9e' : '#b06aff', r: 9, dmg: 15 });
      }
      sfx('missile');
      break;
    }
    case 'burn': // 灼烧：火焰波 + 热浪
      addRing(o.x, o.y, 70, '#ff8833', 3);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 460, maxLife: .5, life: 0, color: '#ff8833', lw: 3 });
      for (let i = 0; i < 14; i++) addFx({ type: 'heat', x: o.x + rand(-40, 40), y: o.y + rand(-40, 40), life: 0, maxLife: rand(.4, .8), w: rand(18, 40) });
      if (foe.alive && Math.hypot(foe.x - o.x, foe.y - o.y) < 300) {
        foe.burnT = Math.max(foe.burnT, 7);
        addSparks(foe.x, foe.y, 8, '#ff8833');
        addText(foe.x, foe.y - 34, '点燃', '#ff8833', 15);
      }
      sfx('boom');
      break;
    case 'vampire': // 吸血鬼：血池
      battle.structs.push({ type: 'zone', kind: 'vamp', owner: o.side, x: o.x, y: o.y, r: 150, life: 3.2 });
      addRing(o.x, o.y, 60, '#ff2244', 2.5);
      for (let i = 0; i < 12; i++) addFx({ type: 'spark', x: o.x + rand(-60, 60), y: o.y + rand(-60, 60), vx: 0, vy: rand(-50, -10), life: 0, maxLife: .7, size: 2.4, color: '#ff5060' });
      sfx('repair');
      break;
    case 'combo': // 连击：8s 双倍层数效果
      o.comboX = 8;
      addRing(o.x, o.y, 60, '#ffd050', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 360, maxLife: .4, life: 0, color: '#ffd050', lw: 2.5 });
      sfx('rush');
      break;
    case 'turret': { // 固定炮台
      const turrets = battle.structs.filter(s => s.type === 'turret' && s.owner === o.side);
      if (turrets.length >= 2) battle.structs.splice(battle.structs.indexOf(turrets[0]), 1);
      battle.structs.push({ type: 'turret', owner: o.side, x: o.x, y: o.y, life: 12, fireT: .8 });
      addRing(o.x, o.y, 50, '#ffd050', 2);
      sfx('shield');
      break;
    }
    case 'split': // 分裂球：主动分裂双子球（出生偏移+免融合期，防止出生即融合）
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU;
        battle.proj.push({ type: 'shard', owner: o.side, x: o.x + Math.cos(a) * 85, y: o.y + Math.sin(a) * 85, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 5, r: 16, color: o.color.bright, hitT: 0, grace: .8 });
      }
      addRing(o.x, o.y, 60, o.color.bright, 2.5);
      sfx('phantom');
      break;
    case 'gunner': // 快枪手：装填 8 发弹夹（瞄准连射在 updateBattle 中执行）
      o.gunMag = 8;
      addRing(o.x, o.y, 55, '#ffe9a0', 2.5);
      addText(o.x, o.y - 40, '装填 8 发', '#ffe9a0', 14);
      sfx('shield');
      break;
    case 'wuliang': { // 无量：丢出苍球（吸）或赫球（斥），交替释放，异色双球相撞 → 爆炸 + 合成"芘"
      o.wulianFlip = !o.wulianFlip;
      const kind = o.wulianFlip ? 'cang' : 'heng';
      const a = Math.atan2(foe.y - o.y, foe.x - o.x) + rand(-.5, .5);
      battle.structs.push({ type: 'wuliangball', owner: o.side, kind, x: o.x, y: o.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 13, r: 26, hitT: 0 });
      sfx('pulse');
      break;
    }
    case 'slash': { // 空间斩：低血改变攻击方式（<50%：cd 大减 + 单条瞄准轨迹；<20%：两条）
      const F = fieldRect();
      const low = o.hp / o.maxHp < .5;
      const crit = o.hp / o.maxHp < .2;
      o.maxCd = low ? 0.8 : 15; // 新：半血以下 cd 极速 0.8s（原 <20%:2.5 / <50%:4）
      const lines = [];
      const n = crit ? 2 : low ? 1 : 4;
      for (let i = 0; i < n; i++) {
        let seg;
        if (low) {
          // 低血模式：轨迹瞄准敌人当前位置（带随机偏移），更凶更准
          const ang = Math.atan2(foe.y - o.y, foe.x - o.x) + rand(-.25, .25);
          seg = lineThroughField(o.x, o.y, ang, F);
        } else {
          seg = lineThroughField(rand(F.x + F.s * .3, F.x + F.s * .7), rand(F.y + F.s * .3, F.y + F.s * .7), Math.random() * TAU, F);
        }
        lines.push([seg[0][0], seg[0][1], seg[1][0], seg[1][1]]);
      }
      battle.structs.push({ type: 'slash', owner: o.side, lines, delay: low ? .24 : 2.2, pulse: 0 }); // 低血蓄力 -70%（0.8→0.24）
      sfx('rush');
      break;
    }
    case 'idol': { // 偶像：领域爆发
      const rr = 140 + (1 - o.hp / o.maxHp) * 120;
      if (foe.alive && Math.hypot(foe.x - o.x, foe.y - o.y) < rr) hitOrb(foe, 15, o, true);
      battle.structs.push({ type: 'zone', kind: 'idolburst', owner: o.side, x: o.x, y: o.y, r: rr * 1.4, life: 3 });
      addRing(o.x, o.y, rr, '#ffd0ff', 3);
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * TAU;
        addFx({ type: 'spark', x: o.x + Math.cos(a) * rr, y: o.y + Math.sin(a) * rr, vx: 0, vy: -30, life: 0, maxLife: .8, size: 2.5, color: '#ffd0ff' });
      }
      sfx('shield');
      break;
    }
    case 'anchor': // 切割球：电缆脉冲（所有电缆瞬间重击）
      {
        const cables = battle.structs.filter(s => s.type === 'cable' && s.owner === o.side);
        for (const c of cables) {
          addFx({ type: 'blade', x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, life: 0, maxLife: .3, color: '#b0c4ff' });
          if (foe.alive && distToSeg(foe.x, foe.y, c.x1, c.y1, c.x2, c.y2) < foe.r + 16) hitOrb(foe, 25, o, true);
        }
        addRing(o.x, o.y, 60, '#b0c4ff', 2.5);
        sfx('clash');
      }
      break;
    case 'drone': // 浮游炮：立即充能
      o.charge = Math.min(12, o.charge + 4);
      addRing(o.x, o.y, 55, '#9ff', 2);
      sfx('repair');
      break;
    // —— V3 新能力 ——
    case 'boomerang': { // 回旋镖：直线飞出，命中折返，收回后重置 cd（镖体已放大）
      const a = Math.atan2(foe.y - o.y, foe.x - o.x);
      battle.proj.push({ type: 'boomerang', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 7, r: 36, hitFoe: false, returning: false });
      sfx('boomerang');
      break;
    }
    case 'railgun': { // 轨道炮：双模式独立 cd（圆击 / 柱雨；光柱已废弃）
      const ready = [];
      if (o.railT2 <= 0) ready.push(2);
      if (o.railT3 <= 0) ready.push(3);
      if (!ready.length) break; // 防御：双模式全冷却
      const mode = ready[Math.floor(Math.random() * ready.length)];
      const F = fieldRect(); // 仅在确实释放时计算
      if (mode === 2) { // 圆形垂直打击：蓄力 1s 瞬发 120 实伤（半径 +30%）
        o.railT2 = 7;
        const x = Math.max(F.x + 110, Math.min(F.x + F.s - 110, foe.x + rand(-60, 60)));
        const y = Math.max(F.y + 110, Math.min(F.y + F.s - 110, foe.y + rand(-60, 60)));
        battle.structs.push({ type: 'railcircle', owner: o.side, x, y, r: 195, delay: 1 }); // 150→195
        addText(o.x, o.y - 40, '圆击充能', '#ffd0ff', 13);
      } else { // 50 道斜向细柱：3s 内随机角度，间隔 0.05s，宽度增加
        o.railT3 = 9;
        battle.structs.push({ type: 'railstorm', owner: o.side, life: 3.5, fireT: 0, count: 0 }); // life 3.5s 保证 50 根放完
        addText(o.x, o.y - 40, '柱雨充能', '#ffe9a0', 13);
      }
      sfx('railgun');
      break;
    }
    case 'frost': { // 冰霜刺剑：深度冻结 + 刺剑随失血扩张（每 -30% 血 +1 把）
      const n = Math.min(4, 1 + Math.floor((1 - o.hp / o.maxHp) / .3));
      const range = 220 + 60 * (n - 1);
      addRing(o.x, o.y, range, '#7fd8ff', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 30, vr: 420, maxLife: .5, life: 0, color: '#7fd8ff', lw: 2.5 });
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        addFx({ type: 'blade', x1: o.x, y1: o.y, x2: o.x + Math.cos(a) * range, y2: o.y + Math.sin(a) * range, life: 0, maxLife: .22, color: '#bfe9ff' });
      }
      if (foe.alive && Math.hypot(foe.x - o.x, foe.y - o.y) < range) {
        for (let i = 0; i < n; i++) hitOrb(foe, 8, o, true); // 每把刺剑穿刺 8 伤（首波不吃易伤）
        foe.slowT = Math.max(foe.slowT, 1.5); foe.slowPct = .65;
        foe.frostT = 2; // 易伤标记（冻结期间远程伤害 +25%，作用于后续伤害）
        addText(foe.x, foe.y - 34, '深度冻结', '#7fd8ff', 14);
        addSparks(foe.x, foe.y, 10, '#bfe9ff');
      }
      sfx('frost');
      break;
    }
    case 'barrier': { // 弧形护盾墙：4s，反弹球 + 拦截敌方投射物
      const a = Math.atan2(foe.y - o.y, foe.x - o.x);
      battle.structs = battle.structs.filter(s => !(s.type === 'arcwall' && s.owner === o.side));
      battle.structs.push({ type: 'arcwall', owner: o.side, x: o.x, y: o.y, R: 170, a0: a - Math.PI / 2, a1: a + Math.PI / 2, life: 4 });
      addRing(o.x, o.y, 170, '#9fd8ff', 2);
      sfx('barrier');
      break;
    }
    case 'nest': { // 无人机巢：40 血可破坏，每 1.5s 放自爆无人机
      battle.structs = battle.structs.filter(s => !(s.type === 'nest' && s.owner === o.side));
      battle.structs.push({ type: 'nest', owner: o.side, x: o.x, y: o.y, hp: 40, fireT: 1.5 });
      addRing(o.x, o.y, 40, '#9f8fff', 2);
      sfx('nest');
      break;
    }
    case 'echo': { // 回声：记录位置血量，3s 后回溯
      battle.structs = battle.structs.filter(s => !(s.type === 'echo' && s.owner === o.side));
      battle.structs.push({ type: 'echo', owner: o.side, x: o.x, y: o.y, hp: o.hp, life: 3 });
      addRing(o.x, o.y, 40, '#8fd8ff', 2);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 260, maxLife: .6, life: 0, color: '#8fd8ff', lw: 2 });
      sfx('echo');
      break;
    }
    case 'sonic': { // 音爆：向四周散射穿透声波粒子（粒子穿墙而过）
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + rand(-.12, .12);
        battle.proj.push({ type: 'sonicpart', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, life: 1.2, r: 5, dmg: 4 });
      }
      sfx('sonic');
      break;
    }
    case 'fang': { // 兽牙：每 cd 自动射箭，命中缩短下次间隔（独立字段 fangCd，下限 0.8）
      o.maxCd = o.fangCd || 3; // 同步当前间隔（防与 slash 等动态 maxCd 串扰）
      const a = Math.atan2(foe.y - o.y, foe.x - o.x);
      battle.proj.push({ type: 'fang', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * 864, vy: Math.sin(a) * 864, life: 1.1, r: 6 }); // 弹速 +60%（540→864）
      sfx('fang');
      break;
    }
    // —— V4 新能力 ——
    case 'launcher': { // 发射台：将对方沿当前方向速度翻倍推向墙（撞墙受 2 次近战撞击伤害）
      const sp = Math.hypot(foe.vx, foe.vy) || 300;
      const a = Math.atan2(foe.vy, foe.vx);
      const ns = Math.min(720, sp * 2.2);
      foe.vx = Math.cos(a) * ns; foe.vy = Math.sin(a) * ns;
      foe.launchT = 3; // 3s 内撞墙触发双倍近战撞击伤害
      addRing(o.x, o.y, 60, '#ffd050', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 420, maxLife: .4, life: 0, color: '#ffd050', lw: 3 });
      for (let i = 0; i < 12; i++) { // 弹射速度线
        const a2 = Math.atan2(foe.vy, foe.vx) + rand(-.4, .4);
        addFx({ type: 'spark', x: foe.x + rand(-8, 8), y: foe.y + rand(-8, 8), vx: Math.cos(a2) * rand(120, 260), vy: Math.sin(a2) * rand(120, 260), life: 0, maxLife: .45, size: 2.6, color: '#ffe9a0' });
      }
      addText(foe.x, foe.y - 40, '弹射!', '#ffd050', 15);
      sfx('launcher');
      break;
    }
    case 'tornado': { // 龙卷风：低速大旋风直线飞行+反弹，附近球被切向偏转；持续刮起石子伤人
      const a = Math.atan2(foe.y - o.y, foe.x - o.x) + rand(-.35, .35);
      battle.proj.push({ type: 'tornado', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 6, r: 52, spin: 0, pebT: 0 });
      addRing(o.x, o.y, 60, '#cfe9ff', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 18, vr: 380, maxLife: .45, life: 0, color: '#cfe9ff', lw: 2.5 });
      sfx('tornado');
      break;
    }
    case 'web': { // 蛛网：一次抛 3 张网（预判对方轨迹落网，半径 +200%），入网减速+网缚+75% 易伤
      const F = fieldRect();
      const px = foe.x + foe.vx * .45, py = foe.y + foe.vy * .45; // 预测点
      for (let i = 0; i < 3; i++) {
        let tx = px + rand(-170, 170), ty = py + rand(-130, 130);
        tx = Math.max(F.x + 40, Math.min(F.x + F.s - 40, tx));
        ty = Math.max(F.y + 40, Math.min(F.y + F.s - 40, ty));
        battle.structs.push({ type: 'web', owner: o.side, x: tx, y: ty, r: 285, life: 7, hitT: 0 }); // 半径 95→285（+200%）
      }
      addRing(px, py, 40, '#e8f4ff', 2);
      addFx({ type: 'ring', x: px, y: py, r: 12, vr: 360, maxLife: .4, life: 0, color: '#e8f4ff', lw: 2.5 });
      sfx('web');
      break;
    }
    case 'volcano': { // 火山：定身 1.2s，扇形展开 5 条曲线熔岩（命中减速 + 持续伤害）
      o.stunT = 1.2;
      const base = Math.atan2(foe.y - o.y, foe.x - o.x);
      const N = 5, segs = [];
      for (let i = 0; i < N; i++) {
        const a = base + (i - (N - 1) / 2) * .5; // 扇形展开 ±1 rad
        segs.push({ pts: [{ x: o.x, y: o.y }], dir: a, phase: rand(0, TAU), len: 0 });
      }
      battle.structs.push({ type: 'lavaburst', owner: o.side, x: o.x, y: o.y, segs, life: 2.6, hitT: 0, maxLen: 420 });
      addRing(o.x, o.y, 70, '#ff8833', 3);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 480, maxLife: .5, life: 0, color: '#ff8833', lw: 3.5 });
      for (let i = 0; i < 16; i++) addFx({ type: 'heat', x: o.x + rand(-50, 50), y: o.y + rand(-50, 50), life: 0, maxLife: rand(.4, .8), w: rand(16, 36) });
      sfx('volcano');
      break;
    }
    case 'venom': { // 剧毒：毒雾喷吐（毒雾命中叠层），近距离直接叠 2 层
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * TAU;
        battle.proj.push({ type: 'venomcloud', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * rand(60, 200), vy: Math.sin(a) * rand(60, 200), life: .7, r: 14 });
      }
      if (foe.alive && foe.invT <= 0 && Math.hypot(foe.x - o.x, foe.y - o.y) < 780) { // 喷毒范围 +200%（260→780）
        foe.venomN = Math.min(5, foe.venomN + 2);
        foe.venomT = 8;
        addText(foe.x, foe.y - 40, '☣ 毒雾·层数' + foe.venomN, '#9fe870', 14);
      }
      addRing(o.x, o.y, 60, '#9fe870', 2.5);
      sfx('venom');
      break;
    }
    case 'ghost': { // 幽灵：隐身 2.5s（追踪弹无法锁定，碰撞照常）
      o.ghostT = 2.5;
      addRing(o.x, o.y, 50, '#cfe0ff', 2);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 300, maxLife: .45, life: 0, color: '#cfe0ff', lw: 2.5 });
      addText(o.x, o.y - 40, '👻 隐身', '#cfe0ff', 14);
      sfx('ghost');
      break;
    }
    case 'star': { // 星灵：星轨爆发（自身周围一圈星点，对方碰到受小伤）
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        battle.proj.push({ type: 'starpoint', owner: o.side, x: o.x + Math.cos(a) * (o.r + 30), y: o.y + Math.sin(a) * (o.r + 30), life: 3, r: 9, hitT: 0 });
      }
      addRing(o.x, o.y, 70, '#ffe9a0', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 380, maxLife: .45, life: 0, color: '#ffe9a0', lw: 2.5 });
      sfx('star');
      break;
    }
    // —— V5 新能力 ——
    case 'tsunami': { // 海啸：横扫全场的波浪条带（强推位移）
      const F = fieldRect();
      const a = Math.atan2(foe.y - o.y, foe.x - o.x);
      // 波浪垂直于行进方向铺开（条带长度横跨场地），从自身出发沿 a 方向推进
      battle.structs.push({ type: 'tsunami', owner: o.side, x: o.x, y: o.y, a, len: 0, life: 2.2, hitT: 0, sp: 460, maxLen: F.s * 1.5 });
      addRing(o.x, o.y, 50, '#6fd8ff', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 16, vr: 420, maxLife: .4, life: 0, color: '#6fd8ff', lw: 3 });
      for (let i = 0; i < 14; i++) {
        const a2 = a + rand(-.6, .6);
        addFx({ type: 'spark', x: o.x, y: o.y, vx: Math.cos(a2) * rand(120, 300), vy: Math.sin(a2) * rand(120, 300), life: 0, maxLife: .5, size: 2.6, color: '#9fe8ff' });
      }
      sfx('tsunami');
      break;
    }
    case 'spore': { // 孢子：撒 5 颗种子，落地 2s 后长成毒蘑菇（毒域封锁）
      const F = fieldRect();
      const clampF = v => Math.max(F.x + 30, Math.min(F.x + F.s - 30, v));
      for (let i = 0; i < 5; i++) {
        const tx = clampF(foe.x + rand(-160, 160)), ty = clampF(foe.y + rand(-120, 120));
        battle.proj.push({ type: 'sporeseed', owner: o.side, x: o.x, y: o.y, tx, ty, sp: 300, life: 4, r: 6 });
      }
      addRing(o.x, o.y, 55, '#b8e870', 2.5);
      sfx('spore');
      break;
    }
    case 'clone': { // 替身：镜像分身（沿本体速度反方向飞出，可骗追踪弹；半径 +100%/速度翻倍/持续 +2s）
      const sp = Math.hypot(o.vx, o.vy) || 300;
      const a = Math.atan2(o.vy, o.vx) + Math.PI + rand(-.3, .3);
      battle.proj.push({ type: 'clone', owner: o.side, x: o.x + Math.cos(a) * 60, y: o.y + Math.sin(a) * 60, vx: Math.cos(a) * sp * 2.4, vy: Math.sin(a) * sp * 2.4, life: 7, r: 60, hitT: 0, durability: 3 }); // r 30→60, 速度 ×1.2→×2.4, life 5→7, 3 点耐久
      addRing(o.x, o.y, 60, o.color.bright, 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 16, vr: 340, maxLife: .45, life: 0, color: o.color.bright, lw: 2.5 });
      addText(o.x, o.y - 44, '⧉ 替身', o.color.bright, 14);
      sfx('clone');
      break;
    }
    case 'evolve': { // 进化：撞击积累经验，升级体积/伤害（成长型近战）
      o.evolveBoost = 6; // 6s 双倍经验期
      addRing(o.x, o.y, 60, '#7dffa8', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 18, vr: 360, maxLife: .45, life: 0, color: '#7dffa8', lw: 2.5 });
      addText(o.x, o.y - 40, '🧬 进化加速', '#7dffa8', 13);
      sfx('evolve');
      break;
    }
    case 'lance': { // 骑枪：指向目标高速冲刺，冲刺中无敌
      const a = Math.atan2(foe.y - o.y, foe.x - o.x);
      o.lanceT = 1.2;
      o.lanceA = a;
      o.vx = Math.cos(a) * 900; o.vy = Math.sin(a) * 900; // 直接朝目标冲刺（moveOrb 每帧保持 900 速率）
      o.invT = Math.max(o.invT, 1.2); // 冲刺中无敌（与 portal 无敌同字段）
      addRing(o.x, o.y, 55, '#ffd0a0', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 16, vr: 460, maxLife: .4, life: 0, color: '#ffd0a0', lw: 3 });
      addText(o.x, o.y - 40, '↯ 骑枪冲锋', '#ffd0a0', 14);
      sfx('lance');
      break;
    }
    // —— V8 新能力 ——
    case 'curse': { // 诅咒之钉：投掷巨大高速钉子，命中钉住敌人随钉飞行；撞墙燃起逐渐变大的诅咒火焰圈
      const a = Math.atan2(foe.y - o.y, foe.x - o.x);
      battle.proj.push({ type: 'cursenail', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * 840, vy: Math.sin(a) * 840, life: 7, r: 16, hitT: 0, hitFoe: false, angle: 0 });
      addRing(o.x, o.y, 55, '#c07aff', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 16, vr: 460, maxLife: .4, life: 0, color: '#c07aff', lw: 3 });
      for (let i = 0; i < 10; i++) {
        const a2 = a + rand(-.3, .3);
        addFx({ type: 'spark', x: o.x, y: o.y, vx: Math.cos(a2) * rand(200, 460), vy: Math.sin(a2) * rand(200, 460), life: 0, maxLife: .4, size: 2.4, color: '#c07aff' });
      }
      sfx('curse');
      break;
    }
    case 'corrode': { // 腐蚀：周期性喷吐大量低伤腐蚀粒子浪潮（命中叠易伤+叠减速）
      const a = Math.atan2(foe.y - o.y, foe.x - o.x);
      for (let i = 0; i < 26; i++) {
        const a2 = a + rand(-1, 1);
        battle.proj.push({ type: 'corrodepart', owner: o.side, x: o.x + Math.cos(a2) * 22, y: o.y + Math.sin(a2) * 22, vx: Math.cos(a2) * rand(260, 640), vy: Math.sin(a2) * rand(260, 640), life: 1.4, r: 5 });
      }
      addRing(o.x, o.y, 60, '#b0ff6a', 2);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 14, vr: 420, maxLife: .4, life: 0, color: '#b0ff6a', lw: 2.5 });
      sfx('corrode');
      break;
    }
    case 'coffin': { // 棺椁（主动）：在随机墙面成片散落黑白蝴蝶（撞墙/失血也会被动触发）
      spawnButterflies(o, null);
      addRing(o.x, o.y, 60, '#e8e8f0', 2.5);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 14, vr: 380, maxLife: .45, life: 0, color: '#e8e8f0', lw: 2.5 });
      sfx('coffin');
      break;
    }
    case 'tech1': // 科技I：主动在当前位置部署一台中速激光台（撞墙也会留）
      placeLaserTurret(o);
      addRing(o.x, o.y, 50, '#6fe8ff', 2.5);
      sfx('tech1');
      break;
    case 'tech2': // 科技II：主动在当前位置部署一台极速低伤激光台（撞墙也会留）
      placeLaserTurret(o);
      addRing(o.x, o.y, 50, '#6fe8ff', 2.5);
      sfx('tech2');
      break;
    case 'techx': { // 科技X：激光环瞬间脉冲（常驻 6 圈在 updateBattle 中维护）
      addRing(o.x, o.y, 70, '#5ef0ff', 3);
      addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 560, maxLife: .5, life: 0, color: '#5ef0ff', lw: 3.5 });
      for (const f of foesOf(o)) {
        if (!f.alive || f.invT > 0) continue;
        const d = Math.hypot(f.x - o.x, f.y - o.y);
        for (let k = 0; k < 6; k++) {
          const rr = 78 + k * 58; // 6 圈半径（与常驻一致）
          if (Math.abs(d - rr) < 40) { hitOrb(f, 16 - k * 2, o, true); addSparks(f.x, f.y, 5, '#5ef0ff'); break; }
        }
      }
      sfx('techx');
      break;
    }
    case 'liquidbag': { // 液袋：没有液袋时裹上一个（护盾血量 60）
      if (o.liquidHp <= 0) {
        o.liquidHp = 60;
        addRing(o.x, o.y, 65, '#7df3ff', 3);
        addFx({ type: 'ring', x: o.x, y: o.y, r: 24, vr: 320, maxLife: .45, life: 0, color: '#7df3ff', lw: 2.5 });
        addText(o.x, o.y - 44, '液袋裹身 +60', '#7df3ff', 14);
        sfx('liquid');
      } else {
        o.liquidHp = Math.min(60, o.liquidHp + 20); // 已有液袋则修补
        addRing(o.x, o.y, 55, '#7df3ff', 2);
        sfx('liquid');
      }
      break;
    }
    case 'pylon': { // 电线杆：无前摇落雷（定身 + 易伤）
      const F = fieldRect();
      const tx = Math.max(F.x + 60, Math.min(F.x + F.s - 60, foe.x + rand(-40, 40)));
      const ty = Math.max(F.y + 60, Math.min(F.y + F.s - 60, foe.y + rand(-40, 40)));
      battle.structs.push({ type: 'lightning', owner: o.side, x: tx, y: ty, delay: 0, r: 120 });
      addText(o.x, o.y - 40, '☇ 落雷', '#ffd050', 14);
      sfx('pylon');
      break;
    }
    case 'bond': { // 拘束：绳索脉冲（所有绳索瞬间重击绳上敌人）
      const pts = o.bondPts || [];
      for (const pt of pts) {
        addFx({ type: 'blade', x1: pt.x, y1: pt.y, x2: o.x, y2: o.y, life: 0, maxLife: .3, color: '#d8c8ff' });
        for (const f of foesOf(o)) {
          if (f.alive && f.invT <= 0 && distToSeg(f.x, f.y, pt.x, pt.y, o.x, o.y) < f.r + 14) hitOrb(f, 18, o, true);
        }
      }
      addRing(o.x, o.y, 60, '#d8c8ff', 2.5);
      sfx('bond');
      break;
    }
  }
}

// ---------------- 战斗更新 ----------------
// 球出局（多球：出局但战斗继续；只剩 1 球或双球单方死亡 → 结算）
// alive 守卫：多球模式出局后 battle.over 未置位，下一帧死亡检查会再次进入 → 防重复 boom/震屏/音效
function killOrb(o) {
  if (battle.over || !o.alive) return;
  o.hp = 0; o.alive = false;
  boom(o);
  const alive = battle.orbs.filter(x => x.alive);
  if (alive.length <= 1) {
    battle.over = true;
    battle.winner = alive[0] || null;
    const B = battle;
    setTimeout(() => { if (battle === B) showResult(); }, 950);
  } else {
    addText(o.x, o.y - 50, o.name + ' 出局', '#ff5566', 18);
    sfx('boom');
  }
}
function updateBattle(dt) {
  const B = battle;
  B.time += dt;
  const L = B.left, R = B.right;
  // 120 秒超时：零干预——直接按剩余血量比例判定胜负
  if (B.time >= 120 && !B.over) {
    B.over = true;
    for (const o of B.orbs) { o.regenT = 0; o.cd = 0; } // 冻结回血/冷却，保证结算显示与判定时刻一致
    const alive = B.orbs.filter(o => o.alive);
    let best = null;
    for (const o of alive) if (!best || o.hp / o.maxHp > best.hp / best.maxHp) best = o;
    const pct = alive.map(o => o.hp / o.maxHp);
    const draw = alive.length > 0 && pct.every(p => Math.abs(p - pct[0]) < 1e-9);
    B.winner = alive.length === 0 || draw ? null : best;
    const B2 = B;
    setTimeout(() => { if (battle === B2) showResult(); }, 950);
    return;
  }
  // 移动 + 两两碰撞（2/3/4 球全排列）
  for (const o of B.orbs) if (o.alive) moveOrb(o, dt, nearestFoe(o));
  for (let i = 0; i < B.orbs.length; i++)
    for (let j = i + 1; j < B.orbs.length; j++)
      if (B.orbs[i].alive && B.orbs[j].alive) collide(B.orbs[i], B.orbs[j]);
  updateStructs(dt);
  // 吸血鬼吸身：两球贴合吸血（90% 庇护在 hitOrb 中处理）
  if (B.vamp && B.vamp.t > 0) {
    B.vamp.t -= dt;
    const v = B.vamp, A = v.src, C = v.foe;
    if (B.vamp.t <= 0 || !A.alive || !C.alive) {
      if (A.alive) {
        A.vampT = 1.2; // 吸身结束冷却：1.2s 后可再次触发（修复浮点负值卡死）
        // 沿法线分离两球（吸身期间速度被平均化，若不分离则同速贴合永远无法再触发碰撞吸血）
        const dx = C.x - A.x, dy = C.y - A.y;
        const dd2 = Math.hypot(dx, dy) || 1;
        const nx2 = dx / dd2, ny2 = dy / dd2;
        const sep = 120;
        A.vx += -nx2 * sep; A.vy += -ny2 * sep;
        C.vx += nx2 * sep; C.vy += ny2 * sep;
      }
      B.vamp = null;
    }
    else {
      const F = fieldRect();
      const minX = F.x + A.r, maxX = F.x + F.s - A.r;
      const minY = F.y + A.r, maxY = F.y + F.s - A.r;
      const midx = (A.x + C.x) / 2, midy = (A.y + C.y) / 2;
      const dx = C.x - A.x, dy = C.y - A.y;
      const dd = Math.hypot(dx, dy) || 1;
      const nx = dx / dd, ny = dy / dd;
      const avx = (A.vx + C.vx) / 2, avy = (A.vy + C.vy) / 2;
      A.vx = avx; A.vy = avy; C.vx = avx; C.vy = avy;
      let ax = midx - nx * (A.r - 2), ay = midy - ny * (A.r - 2);
      let cx = midx + nx * (C.r - 2), cy = midy + ny * (C.r - 2);
      // 贴合对整体平移，保证两球都在场内（墙边吸身不再把球挤出边界引发反复反弹）
      const minAx = Math.min(ax, cx), maxAx = Math.max(ax, cx);
      const minAy = Math.min(ay, cy), maxAy = Math.max(ay, cy);
      let shx = 0, shy = 0;
      if (minAx < minX) shx = minX - minAx; else if (maxAx > maxX) shx = maxX - maxAx;
      if (minAy < minY) shy = minY - minAy; else if (maxAy > maxY) shy = maxY - maxAy;
      ax += shx; cx += shx; ay += shy; cy += shy;
      if (ax < minX - .5 || cx > maxX + .5 || ay < minY - .5 || cy > maxY + .5) {
        A.vampT = 1.2; // 墙边空间不足：吸身中断并进入冷却
        B.vamp = null; // 墙边空间不足：吸身中断，避免卡死
      } else {
        A.x = ax; A.y = ay; C.x = cx; C.y = cy;
        if (C.invT <= 0) C.hp -= 7.5 * dt; // 无敌期吸身不掉血
        A.hp = Math.min(A.maxHp, A.hp + 5 * dt);
        if (Math.random() < .7) addFx({ type: 'spark', x: midx + rand(-20, 20), y: midy + rand(-20, 20), vx: rand(-20, 20), vy: rand(-40, -10), life: 0, maxLife: .5, size: 2.4, color: '#ff2244' });
        if (Math.random() < .3) addText(midx, midy - 42, '吸血', '#ff5060', 13);
      }
    }
  }
  // 场地漂浮粒子更新
  const F2 = fieldRect();
  for (const p of B.ambient) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < F2.x) p.x = F2.x + F2.s;
    if (p.x > F2.x + F2.s) p.x = F2.x;
    if (p.y < F2.y) p.y = F2.y + F2.s;
    if (p.y > F2.y + F2.s) p.y = F2.y;
  }
  // 球尾迹粒子（动态光点）
  for (const o of B.orbs) {
    if (!o.alive) continue;
    const isTrail = o.decor === 'trail';
    if (Math.random() < (isTrail ? 1 : .55)) {
      const ang = Math.atan2(-o.vy, -o.vx) + rand(-.35, .35);
      addFx({ type: 'spark', x: o.x + Math.cos(ang) * o.r * .85, y: o.y + Math.sin(ang) * o.r * .85, vx: Math.cos(ang) * rand(50, 110), vy: Math.sin(ang) * rand(50, 110), life: 0, maxLife: rand(.3, .6), size: rand(1.5, 3), color: isTrail ? '#ffffff' : o.color.bright });
    }
  }
  // 技能冷却与释放
  for (const o of B.orbs) {
    if (!o.alive) continue;
    o.cd += dt;
    if (o.cd >= o.maxCd) fireAbility(o);
    if (o.shieldT > 0) o.shieldT -= dt;
    if (o.invT > 0) o.invT -= dt;
    if (o.rushT > 0) o.rushT -= dt;
    if (o.regenT > 0) {
      o.regenT -= dt;
      o.hp = Math.min(o.maxHp, o.hp + 8 * dt);
      if (Math.random() < .5) addFx({ type: 'spark', x: o.x + rand(-14, 14), y: o.y + rand(-14, 14), vx: rand(-30, 30), vy: rand(-70, -20), life: 0, maxLife: .5, size: 2, color: '#3dff9e' });
    }
    if (o.flash > 0) o.flash -= dt;
    // —— 新能力状态 ——
    if (o.burnT > 0) { // 灼烧 DoT + 热浪 + 火星迸溅传染
      o.burnT -= dt;
      if (o.invT <= 0) o.hp -= 3 * dt;
      if (Math.random() < .5) addFx({ type: 'heat', x: o.x + rand(-28, 28), y: o.y + rand(-28, 28), life: 0, maxLife: .5, w: rand(16, 30) });
      if (Math.random() < .12) {
        const foe2 = nearestFoe(o);
        const a = Math.atan2(foe2.y - o.y, foe2.x - o.x) + rand(-.6, .6);
        B.proj.push({ type: 'ember', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 1.2, r: 5, color: '#ff8833' });
      }
    }
    if (o.slowT > 0) o.slowT -= dt;
    if (o.vampT > 0) o.vampT = Math.max(0, o.vampT - dt); // clamp 防浮点负值卡死触发条件
    if (o.frostT > 0) o.frostT -= dt;
    if (o.sonicT > 0) o.sonicT -= dt;
    // 冰霜常驻剑：剑尖触及敌人即命中（50% 伤害 + 减速易伤），剑长与技能释放一致
    if (o.ability === 'frost' && o.alive) {
      const n = Math.min(4, 1 + Math.floor((1 - o.hp / o.maxHp) / .3));
      const range = 220 + 60 * (n - 1);
      const foe2 = nearestFoe(o);
      if (foe2.alive && Math.hypot(foe2.x - o.x, foe2.y - o.y) < range + foe2.r) {
        o.frostHitT = (o.frostHitT || 0) - dt;
        if (o.frostHitT <= 0) {
          o.frostHitT = .8;
          hitOrb(foe2, 4, o, true); // 常驻剑 50% 伤害（8×50%）
          foe2.slowT = Math.max(foe2.slowT, 1.5); foe2.slowPct = .65; // 减速与技能相同
          foe2.frostT = 2; // 易伤与技能相同
          addSparks(foe2.x, foe2.y, 5, '#bfe9ff');
        }
      }
    }
    if (o.railT1 > 0) o.railT1 -= dt;
    if (o.railT2 > 0) o.railT2 -= dt;
    if (o.railT3 > 0) o.railT3 -= dt;
    // 吸血鬼半血被动：每 2s 召唤追踪蝙蝠，每额外失去 10% 血量伤害 +2
    if (o.ability === 'vampire' && o.alive && o.hp / o.maxHp < .5) {
      o.batT = (o.batT || 0) - dt;
      if (o.batT <= 0) {
        o.batT = 2;
        const foe2 = nearestFoe(o);
        if (foe2.alive) {
          const dmg = 10 + 2 * Math.floor((.5 - o.hp / o.maxHp) / .1);
          B.proj.push({ type: 'bat', owner: o.side, x: o.x, y: o.y, vx: 0, vy: 0, life: 6, r: 9, dmg, turn: 4.5 });
          addText(o.x, o.y - 40, '🦇 蝙蝠', '#c07aff', 13);
        }
      }
    }
    if (o.portalCd > 0) o.portalCd -= dt;
    if (o.splitCd > 0) o.splitCd -= dt;
    if (o.comboX > 0) o.comboX -= dt;
    // —— V4 新能力状态 ——
    if (o.ghostT > 0) o.ghostT -= dt;
    if (o.webT > 0) o.webT -= dt; // 网缚 3s 过期（期间首次撞墙反弹速度减半）
    // —— V5 新能力状态 ——
    if (o.lanceT > 0) o.lanceT -= dt;
    if (o.evolveBoost > 0) o.evolveBoost -= dt;
    // —— V6 强化状态 ——
    if (o.launchT > 0) o.launchT -= dt;
    if (o.webVulnT > 0) o.webVulnT -= dt;
    if (o.venomT > 0) { // 剧毒 DoT：每秒结算，层数越高越痛
      o.venomT -= dt;
      if (o.invT <= 0) {
        o.venomTick = (o.venomTick || 0) - dt;
        if (o.venomTick <= 0) {
          o.venomTick = 1;
          o.hp -= o.venomN * 2;
          addText(o.x + rand(-10, 10), o.y - 50, '毒-' + o.venomN * 2, '#9fe870', 13);
          addSparks(o.x, o.y, 3, '#9fe870');
        }
      }
      if (o.venomT <= 0) o.venomN = 0;
    }
    // 星灵：身后留星轨（路过灼伤）
    if (o.ability === 'star' && o.alive) {
      o.starT = (o.starT || 0) - dt;
      if (o.starT <= 0) {
        o.starT = .12;
        const a = Math.atan2(-o.vy, -o.vx);
        B.proj.push({ type: 'starpoint', owner: o.side, x: o.x + Math.cos(a) * o.r, y: o.y + Math.sin(a) * o.r, life: 3, r: 9, hitT: 0 });
      }
    }
    // 幽灵强化：隐身期间持续释放速度随机的鬼魂（命中击退 + 范围伤害）
    if (o.ability === 'ghost' && o.alive && o.ghostT > 0) {
      o.ghostSpawnT = (o.ghostSpawnT || 0) - dt;
      if (o.ghostSpawnT <= 0) {
        o.ghostSpawnT = .2;
        const a = Math.random() * TAU;
        const sp = rand(180, 520);
        B.proj.push({ type: 'wraith', owner: o.side, x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2.5, r: 10, hitT: 0 });
      }
    }
    if (o.ability === 'gunner' && o.gunMag > 0) { // 快枪手：装填待机，敌人进入四正方向窄带才极速连射
      const foe2 = nearestFoe(o);
      // 四正方向量化 + 窄带判定（±20° 内才开火，防止无条件锁头）
      const raw = Math.atan2(foe2.y - o.y, foe2.x - o.x);
      const ang = Math.round(raw / (Math.PI / 2)) * (Math.PI / 2);
      let diff = Math.abs(raw - ang);
      if (foe2.alive && diff < .35) { // 敌人存活且在正方向窄带内才开火
        o.gunT = (o.gunT || 0) - dt;
        if (o.gunT <= 0) {
          o.gunT = .06;
          o.gunMag--;
          B.proj.push({ type: 'bullet', owner: o.side, x: o.x, y: o.y, vx: Math.cos(ang) * 6000, vy: Math.sin(ang) * 6000, life: .6, color: '#ffe9a0', r: 5 });
          addSparks(o.x, o.y, 2, '#ffe9a0');
          sfx('missile');
          if (o.gunMag === 0) addText(o.x, o.y - 40, '弹夹打空', '#ffe9a0', 13);
        }
      }
    }
    if (o.ability === 'anchor' && o.wallHit) { // 切割球：撞墙留锚，双锚拉电缆
      o.anchorPts = o.anchorPts || [];
      o.anchorPts.push({ x: o.wallHit.x, y: o.wallHit.y });
      o.wallHit = null;
      addRing(o.anchorPts[o.anchorPts.length - 1].x, o.anchorPts[o.anchorPts.length - 1].y, 24, '#b0c4ff', 2);
      if (o.anchorPts.length === 2) {
        const [a, b] = o.anchorPts;
        B.structs.push({ type: 'cable', owner: o.side, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        const cables = B.structs.filter(s => s.type === 'cable' && s.owner === o.side);
        while (cables.length > 8) {
          B.structs.splice(B.structs.indexOf(cables[0]), 1);
          cables.shift();
        }
        o.anchorPts = [];
        addText(o.x, o.y - 40, '电缆拉设', '#b0c4ff', 13);
        sfx('clash');
      }
    }
    if (o.ability === 'idol') { // 偶像领域常驻（只保留最新，大范围）
      const rr = 220 + (1 - o.hp / o.maxHp) * 180;
      B.structs = B.structs.filter(s => !(s.type === 'zone' && s.kind === 'idol' && s.owner === o.side));
      B.structs.push({ type: 'zone', kind: 'idol', owner: o.side, x: o.x, y: o.y, r: rr, life: .3 });
    }
    if (o.ability === 'drone') { // 浮游炮常驻三座 + 充能激光
      const ds = B.structs.filter(s => s.type === 'drone' && s.owner === o.side);
      for (let i = ds.length; i < 3; i++) {
        B.structs.push({ type: 'drone', owner: o.side, x: o.x, y: o.y, angle: i * TAU / 3, phase: i * TAU / 3, fireT: rand(0, .5), life: undefined });
      }
      if (o.charge >= 12) {
        o.charge = 0;
        o.chargeUp = .9;
        addRing(o.x, o.y, 60, '#9ff', 3);
        sfx('pulse');
      }
      if (o.chargeUp > 0) {
        o.chargeUp -= dt;
        if (Math.random() < .8) addFx({ type: 'spark', x: o.x + rand(-16, 16), y: o.y + rand(-16, 16), vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .3, size: 3, color: '#cff' });
        if (o.chargeUp <= 0) {
          B.structs.push({ type: 'beam', owner: o.side, life: 1.2, hitT: 0, x1: o.x, y1: o.y, x2: o.x + 200, y2: o.y }); // 持续激光柱（初始坐标防 NaN）
          addFx({ type: 'ring', x: o.x, y: o.y, r: 20, vr: 420, maxLife: .35, life: 0, color: '#9ff', lw: 3 });
          sfx('boom');
        }
      }
    }
    // —— V8 被动状态 ——
    // 诅咒之钉：被钉住状态由钉子生命周期管理（撞墙/寿命耗尽才释放），无超时
      if (o.corrodeT > 0) { o.corrodeT -= dt; if (o.corrodeT <= 0) o.corrodeN = 0; } // 腐蚀易伤层过期
      if (o.corrodeSlowT > 0) { o.corrodeSlowT -= dt; if (o.corrodeSlowT <= 0) o.corrodeSlowN = 0; } // 腐蚀减速层过期
      if (o.vulnT > 0) o.vulnT -= dt; // 电线杆易伤
      if (o.ability === 'coffin' && o.alive) { // 棺椁：失血阈值 → 封锁无球四分之一区（10% / 20% / 40%）
        const ratio = o.hp / o.maxHp;
        const stage = ratio < .6 ? 3 : ratio < .8 ? 2 : ratio < .9 ? 1 : 0;
        if (stage > o.coffinStage) {
          o.coffinStage = stage;
          sealCoffinZone(o);
          addText(o.x, o.y - 44, '⚰ 棺椁封锁', '#9a9ab0', 14);
          sfx('coffin');
        }
      }
      if (o.ability === 'coffin' && o.butterflyWall) { // 棺椁：撞墙散蝶
        spawnButterflies(o, o.butterflyWall);
        o.butterflyWall = null;
      }
      if ((o.ability === 'tech1' || o.ability === 'tech2') && o.techWall) { // 科技I/II：撞墙留激光台
        placeLaserTurret(o);
      }
      if (o.ability === 'bond' && o.bondWall) { // 拘束：撞墙留锚（上限 8 个）
        o.bondPts = o.bondPts || [];
        o.bondPts.push({ x: o.bondWall.x, y: o.bondWall.y });
        while (o.bondPts.length > 8) o.bondPts.shift();
        o.bondWall = null;
        addRing(o.bondPts[o.bondPts.length - 1].x, o.bondPts[o.bondPts.length - 1].y, 20, '#d8c8ff', 2);
        addText(o.x, o.y - 40, '⛓ 锚点×' + o.bondPts.length, '#d8c8ff', 13);
        sfx('bond');
      }
      if (o.ability === 'bond' && o.bondPts && o.bondPts.length) { // 拘束：绳索持续伤害经过的敌人
        for (const pt of o.bondPts) {
          for (const f of B.orbs) {
            if (f === o || !f.alive || f.invT > 0) continue;
            if (distToSeg(f.x, f.y, pt.x, pt.y, o.x, o.y) < f.r + 10) {
              o.bondHitT = (o.bondHitT || 0) - dt;
              if (o.bondHitT <= 0) {
                o.bondHitT = .4;
                hitOrb(f, 5, o, true);
                addSparks(f.x, f.y, 3, '#d8c8ff');
              }
              break;
            }
          }
        }
      }
      if (o.ability === 'techx' && o.alive) { // 科技X：常驻 6 圈激光环；失去 50% 血量后转 6 条旋转激光柱
        o.techxRot = (o.techxRot || 0) + dt * 2.2;
        const beams = o.hp / o.maxHp < .5;
        const old = B.structs.find(s => (s.type === 'laserring' || s.type === 'laserbeams') && s.owner === o.side);
        B.structs = B.structs.filter(s => !((s.type === 'laserring' || s.type === 'laserbeams') && s.owner === o.side));
        // 重建时沿用旧 hitT：否则每帧重置导致命中节流失效（贴脸秒杀）
        B.structs.push({ type: beams ? 'laserbeams' : 'laserring', owner: o.side, x: o.x, y: o.y, rot: o.techxRot, hitT: old ? old.hitT : [0, 0, 0, 0, 0, 0, 0], life: undefined });
      }
  }
  // 投射物
  const F = fieldRect();
  // 追踪弹目标选择：本体或替身（替身更近则锁定替身，实现骗弹）
  const pickTrackTarget = (p, foe) => {
    const clones = B.proj.filter(c => c.type === 'clone' && c.owner !== p.owner && c.life > 0); // 敌方替身才骗弹
    if (!clones.length) return { t: foe, isClone: false };
    const dF = Math.hypot(foe.x - p.x, foe.y - p.y);
    const dC = Math.hypot(clones[0].x - p.x, clones[0].y - p.y);
    if (dC < dF - 10) return { t: clones[0], isClone: true };
    return { t: foe, isClone: false };
  };
  for (const p of B.proj) {
    p.life -= dt;
    if (p.type === 'phantom') {
      p.x += p.vx * dt; p.y += p.vy * dt;
      // 边界反弹
      if (p.x < F.x + p.r || p.x > F.x + F.s - p.r) p.vx = -p.vx;
      if (p.y < F.y + p.r || p.y > F.y + F.s - p.r) p.vy = -p.vy;
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r) {
        p.life = 0;
        hitOrb(foe, 5, ownerOf(p.owner));
        addSparks(p.x, p.y, 8, p.color);
      }
    }
    if (p.type === 'bat') { // 吸血鬼追踪蝙蝠（新）
      const foe = nearestFoe(ownerOf(p.owner));
      const tt = pickTrackTarget(p, foe);
      if (tt.t.alive !== false && !tt.t.ghostT) { // 目标隐身（幽灵）时无法锁定 → 直飞
        const ang = Math.atan2(tt.t.y - p.y, tt.t.x - p.x);
        let cur = Math.atan2(p.vy, p.vx);
        let diff = ang - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        cur += diff * Math.min(1, p.turn * dt);
        const sp = 240;
        p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4) p.vx = -p.vx;
      if (p.y < F.y + 4 || p.y > F.y + F.s - 4) p.vy = -p.vy;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-12, 12), vy: rand(-12, 12), life: 0, maxLife: .25, size: 2, color: '#c07aff' });
      const foe2 = nearestFoe(ownerOf(p.owner));
      if (foe2.alive && Math.hypot(foe2.x - p.x, foe2.y - p.y) < foe2.r + p.r + 4) {
        p.life = 0;
        hitOrb(foe2, p.dmg, ownerOf(p.owner), true);
        addRing(p.x, p.y, 30, '#c07aff', 2);
        addSparks(p.x, p.y, 8, '#c07aff');
      } else if (tt.isClone && Math.hypot(tt.t.x - p.x, tt.t.y - p.y) < tt.t.r + p.r + 4) { // 替身挡弹（扣 1 耐久）
        damageClone(tt.t, p);
        addRing(tt.t.x, tt.t.y, 40, '#ffffff', 2.5);
        addText(tt.t.x, tt.t.y - 32, '替身挡弹', '#ffffff', 13);
      }
    }
    if (p.type === 'missile') {
      const foe = nearestFoe(ownerOf(p.owner));
      const tt = pickTrackTarget(p, foe);
      if (tt.t.alive !== false && !tt.t.ghostT) { // 目标隐身（幽灵）时无法锁定 → 直飞
        const ang = Math.atan2(tt.t.y - p.y, tt.t.x - p.x);
        let cur = Math.atan2(p.vy, p.vx);
        let diff = ang - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        cur += diff * Math.min(1, p.turn * dt);
        const sp = 310;
        p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4) p.vx = -p.vx;
      if (p.y < F.y + 4 || p.y > F.y + F.s - 4) p.vy = -p.vy;
      // 尾迹
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-12, 12), vy: rand(-12, 12), life: 0, maxLife: .3, size: 2, color: p.color });
      const foe2 = nearestFoe(ownerOf(p.owner));
      if (foe2.alive && Math.hypot(foe2.x - p.x, foe2.y - p.y) < foe2.r + p.r + 4) {
        p.life = 0;
        hitOrb(foe2, 10, ownerOf(p.owner));
        addRing(p.x, p.y, 46, p.color, 2.5);
        addSparks(p.x, p.y, 12, p.color);
      } else if (tt.isClone && Math.hypot(tt.t.x - p.x, tt.t.y - p.y) < tt.t.r + p.r + 4) { // 替身挡弹（扣 1 耐久）
        damageClone(tt.t, p);
        addRing(tt.t.x, tt.t.y, 40, '#ffffff', 2.5);
        addText(tt.t.x, tt.t.y - 32, '替身挡弹', '#ffffff', 13);
      }
    }
    if (p.type === 'boomerang') { // 回旋镖：飞出 → 命中折返 → 收回重置 cd
      const owner = ownerOf(p.owner);
      const foe = nearestFoe(ownerOf(p.owner));
      if (p.returning) { // 折返：朝本体转向
        if (owner.alive) {
          const ang = Math.atan2(owner.y - p.y, owner.x - p.x);
          let cur = Math.atan2(p.vy, p.vx);
          let diff = ang - cur;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          cur += diff * Math.min(1, 5 * dt);
          const sp = 510; // 回程弹速 +50%
          p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (owner.alive && Math.hypot(owner.x - p.x, owner.y - p.y) < owner.r + p.r) { // 收回
          p.life = 0;
          if (p.hitFoe) { // 命中过敌人 → 重置 cd
            owner.cd = owner.maxCd;
            addText(owner.x, owner.y - 40, '镖回收 · CD 重置', '#ffe9a0', 13);
            sfx('boomerang');
          }
        }
      } else { // 飞出：直线 + 反弹
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < F.x + p.r || p.x > F.x + F.s - p.r) p.vx = -p.vx;
        if (p.y < F.y + p.r || p.y > F.y + F.s - p.r) p.vy = -p.vy;
        if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r) {
          hitOrb(foe, 12, owner, true); // 去程命中
          addSparks(p.x, p.y, 8, '#ffe9a0');
          p.hitFoe = true;
          p.returning = true;
          addText(p.x, p.y - 26, '命中折返', '#ffe9a0', 12);
        }
      }
    }
    if (p.type === 'sonicpart') { // 音爆声波粒子：撞到墙面或敌人即发生一次音爆（范围伤害+强击退）
      p.x += p.vx * dt; p.y += p.vy * dt;
      const foe = nearestFoe(ownerOf(p.owner));
      const boomAt = (x, y) => {
        p.life = 0;
        addFx({ type: 'ring', x, y, r: 10, vr: 440, maxLife: .35, life: 0, color: '#bfe9ff', lw: 3 });
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * TAU, sp = rand(60, 280);
          addFx({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: .4, size: 2.4, color: '#bfe9ff' });
        }
        if (foe.alive && foe.sonicT <= 0 && Math.hypot(foe.x - x, foe.y - y) < foe.r + 130) { // 音爆范围（同目标 0.35s 冷却防贴脸 14 连爆）
          foe.sonicT = .35;
          hitOrb(foe, 8, ownerOf(p.owner), true);
          foe.slowT = Math.max(foe.slowT, .8); foe.slowPct = .4;
          const dx = foe.x - x, dy = foe.y - y; // 强击退
          const dd = Math.hypot(dx, dy) || 1;
          foe.vx += dx / dd * 300; foe.vy += dy / dd * 300;
          addText(foe.x, foe.y - 34, '音爆', '#bfe9ff', 13);
        }
        if (Math.random() < .4) sfx('boom'); // 多粒子同时爆时音效节流
      };
      if (p.x < F.x + p.r || p.x > F.x + F.s - p.r) { // 撞墙 → 音爆
        boomAt(Math.max(F.x, Math.min(F.x + F.s, p.x)), p.y);
      } else if (p.y < F.y + p.r || p.y > F.y + F.s - p.r) {
        boomAt(p.x, Math.max(F.y, Math.min(F.y + F.s, p.y)));
      } else if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 2) { // 命中敌人 → 音爆
        boomAt(p.x, p.y);
      } else if (Math.random() < .4) {
        addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-6, 6), vy: rand(-6, 6), life: 0, maxLife: .2, size: 1.8, color: '#bfe9ff' });
      }
    }
    if (p.type === 'fang') { // 兽牙箭矢：直线，命中减 cd
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4 || p.y < F.y + 4 || p.y > F.y + F.s - 4) p.life = 0;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-6, 6), vy: rand(-6, 6), life: 0, maxLife: .2, size: 1.8, color: '#ffe9a0' });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 2) {
        p.life = 0;
        const own = ownerOf(p.owner);
        hitOrb(foe, 10, own, true);
        own.fangCd = Math.max(.8, (own.fangCd || 3) - .3); // 命中永久缩短射击间隔（独立字段，下限 0.8）
        own.maxCd = own.fangCd;
        addText(foe.x, foe.y - 34, '兽牙命中 · 间隔-' + own.fangCd.toFixed(1), '#ffe9a0', 12);
        addSparks(p.x, p.y, 5, '#ffe9a0');
      }
    }
    if (p.type === 'dronefly') { // 巢穴无人机：追踪自爆
      const foe = nearestFoe(ownerOf(p.owner));
      const tt = pickTrackTarget(p, foe);
      if (tt.t.alive !== false && !tt.t.ghostT) { // 目标隐身（幽灵）时无法锁定 → 直飞
        const ang = Math.atan2(tt.t.y - p.y, tt.t.x - p.x);
        let cur = Math.atan2(p.vy, p.vx);
        let diff = ang - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        cur += diff * Math.min(1, p.turn * dt);
        const sp = 220;
        p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4) p.vx = -p.vx;
      if (p.y < F.y + 4 || p.y > F.y + F.s - 4) p.vy = -p.vy;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .2, size: 1.8, color: '#9f8fff' });
      const foe2 = nearestFoe(ownerOf(p.owner));
      if (foe2.alive && Math.hypot(foe2.x - p.x, foe2.y - p.y) < foe2.r + p.r + 3) {
        p.life = 0;
        hitOrb(foe2, 8, ownerOf(p.owner), true);
        addRing(p.x, p.y, 28, '#9f8fff', 2);
        addSparks(p.x, p.y, 8, '#9f8fff');
      } else if (tt.isClone && Math.hypot(tt.t.x - p.x, tt.t.y - p.y) < tt.t.r + p.r + 3) { // 替身挡弹（扣 1 耐久）
        damageClone(tt.t, p);
        addRing(tt.t.x, tt.t.y, 40, '#ffffff', 2.5);
        addText(tt.t.x, tt.t.y - 32, '替身挡弹', '#ffffff', 13);
      }
    }
    if (p.type === 'gravpart') { // 引力阱无序粒子流（新）
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4 || p.y < F.y + 4 || p.y > F.y + F.s - 4) p.life = 0;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .2, size: 1.6, color: p.color });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 2) {
        p.life = 0;
        hitOrb(foe, 3, ownerOf(p.owner), true);
        addSparks(p.x, p.y, 3, p.color);
      }
    }
    if (p.type === 'bullet') { // 快枪手子弹（高速扫掠判定，防止穿模）
      const px = p.x, py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const out = p.x < F.x + 4 || p.x > F.x + F.s - 4 || p.y < F.y + 4 || p.y > F.y + F.s - 4;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .25, size: 2.5, color: '#ffe9a0' });
      const foe = nearestFoe(ownerOf(p.owner));
      if (out) { p.life = 0; addSparks(p.x, p.y, 4, '#ffe9a0'); }
      else if (foe.alive && distToSeg(foe.x, foe.y, px, py, p.x, p.y) < foe.r + p.r) {
        p.life = 0;
        hitOrb(foe, 6, ownerOf(p.owner), true); // silent：高速连射不刷音效
        foe.slowT = Math.max(foe.slowT, 1.5); foe.slowPct = .4;
        addText(foe.x, foe.y - 34, '减速', '#9fd8ff', 13);
        addSparks(p.x, p.y, 6, '#ffe9a0');
      }
    }
    if (p.type === 'potion') { // 药剂师药水：飞向落点
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 14) {
        p.life = 0;
        if (p.kind === 'dmg') {
          B.structs.push({ type: 'zone', kind: 'pois', owner: p.owner, x: p.x, y: p.y, r: 210, life: 3.2, dmg: 0 });
          addFx({ type: 'ring', x: p.x, y: p.y, r: 14, vr: 540, maxLife: .4, life: 0, color: '#ff5566', lw: 4 });
          for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, sp = rand(60, 320); addFx({ type: 'spark', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: .5, size: 2.6, color: '#ff8899' }); }
          sfx('boom');
        } else if (p.kind === 'heal') {
          B.structs.push({ type: 'zone', kind: 'heal', owner: p.owner, x: p.x, y: p.y, r: 190, life: 4 });
          addRing(p.x, p.y, 40, '#3dff9e', 2.5);
          sfx('repair');
        } else {
          B.structs.push({ type: 'zone', kind: 'slow', owner: p.owner, x: p.x, y: p.y, r: 200, life: 2.5 });
          addRing(p.x, p.y, 40, '#b06aff', 2.5);
          sfx('shield');
        }
      } else {
        const sp = p.sp;
        p.x += dx / d * sp * dt; p.y += dy / d * sp * dt;
        p.angle = (p.angle || 0) + dt * 6;
      }
    }
    if (p.type === 'ember') { // 灼烧火星：传染
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.random() < .5) addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0, maxLife: .3, size: 2, color: '#ff8833' });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 4) {
        p.life = 0;
        foe.burnT = Math.max(foe.burnT, 4);
        addSparks(p.x, p.y, 5, '#ff8833');
      }
    }
    if (p.type === 'turretbolt' || p.type === 'dronebolt') { // 炮台/浮游炮弹
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4 || p.y < F.y + 4 || p.y > F.y + F.s - 4) p.life = 0;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0, maxLife: .25, size: 2, color: p.color });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 2) {
        p.life = 0;
        hitOrb(foe, p.type === 'dronebolt' ? 8 : 12, ownerOf(p.owner), true); // 浮游炮 -30%（12→8）
        addSparks(p.x, p.y, 5, p.color);
        if (p.type === 'dronebolt') {
          const own = ownerOf(p.owner);
          own.charge = Math.min(12, own.charge + 1);
        }
      }
    }
    if (p.type === 'shard') { // 分裂子球
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + p.r || p.x > F.x + F.s - p.r) p.vx = -p.vx;
      if (p.y < F.y + p.r || p.y > F.y + F.s - p.r) p.vy = -p.vy;
      p.hitT -= dt;
      p.grace -= dt;
      const foe = nearestFoe(ownerOf(p.owner));
      const own = ownerOf(p.owner);
      if (foe.alive && p.hitT <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r) {
        p.hitT = .5;
        hitOrb(foe, 6, own, true);
        addSparks(p.x, p.y, 6, p.color);
      }
      if (p.grace <= 0 && own.alive && Math.hypot(own.x - p.x, own.y - p.y) < own.r + p.r) { // 与本体融合
        p.life = 0;
        own.hp = Math.min(own.maxHp, own.hp + 8);
        addText(own.x, own.y - 34, '+8 融合', '#3dff9e', 14);
        addRing(p.x, p.y, 36, p.color, 2);
      }
    }
    // —— V4 投射物 ——
    if (p.type === 'tornado') { // 龙卷风：切向偏转附近球轨迹 + 刮石子伤人（半径随时间渐扩至 600%）
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.r = 52 * (1 + 5 * Math.min(1, 1 - p.life / 6)); // 半径逐渐扩大：52 → 312（600%）
      if (p.x < F.x + p.r || p.x > F.x + F.s - p.r) p.vx = -p.vx;
      if (p.y < F.y + p.r || p.y > F.y + F.s - p.r) p.vy = -p.vy;
      p.spin += dt * 8;
      if (Math.random() < .8) { // 旋风粒子
        const a = p.spin + rand(-.5, .5), rr = rand(0, p.r);
        addFx({ type: 'spark', x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr, vx: Math.cos(a + Math.PI / 2) * 120, vy: Math.sin(a + Math.PI / 2) * 120, life: 0, maxLife: .4, size: 2.4, color: '#cfe9ff' });
      }
      const owner2 = ownerOf(p.owner);
      for (const ob of B.orbs) { // 切向偏转（只偏转敌方：施放者不受自己旋风影响）
        if (ob === owner2 || !ob.alive) continue;
        const dx = ob.x - p.x, dy = ob.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 1 && d < p.r + ob.r + 60) {
          const tx = -dy / d, ty = dx / d;
          const k = 520 * dt * (1 - d / (p.r + ob.r + 60));
          ob.vx += tx * k; ob.vy += ty * k;
        }
      }
      p.pebT -= dt;
      if (p.pebT <= 0) { // 刮起石子（向四周飞散，命中 4 伤）
        p.pebT = .35;
        const a = Math.random() * TAU;
        B.proj.push({ type: 'pebble', owner: p.owner, x: p.x + Math.cos(a) * p.r * .6, y: p.y + Math.sin(a) * p.r * .6, vx: Math.cos(a) * rand(180, 420), vy: Math.sin(a) * rand(180, 420), life: 1.1, r: 4, color: '#b8a088' });
      }
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 6) { // 本体命中：小伤节流
        p.hitT = (p.hitT || 0) - dt;
        if (p.hitT <= 0) {
          p.hitT = .6;
          hitOrb(foe, 6, ownerOf(p.owner), true);
          addSparks(foe.x, foe.y, 5, '#cfe9ff');
        }
      }
    }
    if (p.type === 'pebble') { // 龙卷风石子
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4 || p.y < F.y + 4 || p.y > F.y + F.s - 4) p.life = 0;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-6, 6), vy: rand(-6, 6), life: 0, maxLife: .2, size: 1.6, color: p.color });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 2) {
        p.life = 0;
        hitOrb(foe, 4, ownerOf(p.owner), true);
        addSparks(p.x, p.y, 4, p.color);
      }
    }
    if (p.type === 'venomcloud') { // 剧毒雾团：飘散减速，命中叠毒层
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(.15, dt); p.vy *= Math.pow(.15, dt);
      if (Math.random() < .5) addFx({ type: 'spark', x: p.x + rand(-8, 8), y: p.y + rand(-8, 8), vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .3, size: 3, color: '#9fe870' });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && foe.invT <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 2) { // 无敌期不叠毒
        p.life = 0;
        foe.venomN = Math.min(5, foe.venomN + 1);
        foe.venomT = 8;
        addSparks(p.x, p.y, 4, '#9fe870');
      }
    }
    if (p.type === 'starpoint') { // 星轨点：对方碰到受小伤（同点节流）
      p.hitT -= dt;
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && p.hitT <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r) {
        p.hitT = .5;
        hitOrb(foe, 4, ownerOf(p.owner), true);
        p.life = Math.min(p.life, .15); // 命中后闪烁消失
        addSparks(p.x, p.y, 4, '#ffe9a0');
      }
      if (Math.random() < .3) addFx({ type: 'spark', x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: rand(-10, 10), vy: rand(-10, 10), life: 0, maxLife: .3, size: 1.8, color: '#ffe9a0' });
    }
    // —— V5 投射物 ——
    if (p.type === 'clone') { // 替身：直线飞行+反弹，命中对方小伤即碎（可骗追踪弹）
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + p.r || p.x > F.x + F.s - p.r) p.vx = -p.vx;
      if (p.y < F.y + p.r || p.y > F.y + F.s - p.r) p.vy = -p.vy;
      p.hitT -= dt;
      if (Math.random() < .5) addFx({ type: 'spark', x: p.x + rand(-10, 10), y: p.y + rand(-10, 10), vx: rand(-10, 10), vy: rand(-10, 10), life: 0, maxLife: .3, size: 2.2, color: '#ffffff' });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && p.hitT <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r) {
        p.hitT = 1;
        hitOrb(foe, 8, ownerOf(p.owner), true); // 碰撞伤害
        const dx = foe.x - p.x, dy = foe.y - p.y;
        const dd = Math.hypot(dx, dy) || 1;
        foe.vx += dx / dd * 260; foe.vy += dy / dd * 260; // 击退
        addRing(p.x, p.y, 46, '#ffffff', 2.5);
        addSparks(p.x, p.y, 8, '#ffffff');
        addText(p.x, p.y - 30, '替身命中', '#ffffff', 12);
        sfx('clash');
        damageClone(p, null); // 扣 1 耐久（3 次碰撞才消失）
      }
    }
    if (p.type === 'sporeseed') { // 孢子种子：飞向落点，落地长成毒蘑菇
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        p.life = 0;
        B.structs.push({ type: 'mushroom', owner: p.owner, x: p.x, y: p.y, life: 8, growT: 2, r: 39, hitT: 0 });
        addSparks(p.x, p.y, 4, '#b8e870');
      } else {
        p.x += dx / d * p.sp * dt; p.y += dy / d * p.sp * dt;
        if (Math.random() < .4) addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-6, 6), vy: rand(-6, 6), life: 0, maxLife: .3, size: 1.8, color: '#c8f090' });
      }
    }
    // —— V6 强化投射物 ——
    if (p.type === 'wraith') { // 幽灵鬼魂：速度随机直线飞行+反弹，命中击退 + 范围伤害
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + p.r || p.x > F.x + F.s - p.r) p.vx = -p.vx;
      if (p.y < F.y + p.r || p.y > F.y + F.s - p.r) p.vy = -p.vy;
      p.hitT -= dt;
      if (Math.random() < .6) addFx({ type: 'spark', x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .3, size: 2.4, color: '#d8e8ff' });
      const foe = nearestFoe(ownerOf(p.owner));
      if (foe.alive && foe.invT <= 0 && p.hitT <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) < foe.r + p.r + 4) {
        p.life = 0; p.hitT = .5;
        hitOrb(foe, 6, ownerOf(p.owner), true); // 命中本体
        // 范围伤害（90px）+ 击退
        const dx = foe.x - p.x, dy = foe.y - p.y;
        const dd = Math.hypot(dx, dy) || 1;
        foe.vx += dx / dd * 220; foe.vy += dy / dd * 220;
        addRing(p.x, p.y, 90, '#d8e8ff', 2.5);
        addSparks(p.x, p.y, 10, '#d8e8ff');
        addText(foe.x, foe.y - 40, '鬼魂冲撞', '#d8e8ff', 13);
        sfx('ghost');
      }
    }
    // —— V8 投射物 ——
    if (p.type === 'cursenail') { // 诅咒之钉：命中钉住敌人继续飞行（拖着敌人），直到撞墙触发诅咒之火
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.angle = (p.angle || 0) + dt * 4;
      if (Math.random() < .5) addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-6, 6), vy: rand(-6, 6), life: 0, maxLife: .2, size: 2, color: '#c07aff' });
      const owner = ownerOf(p.owner);
      const hitWall = p.x < F.x + p.r || p.x > F.x + F.s - p.r || p.y < F.y + p.r || p.y > F.y + F.s - p.r;
      if (hitWall || p.life <= 0) { // 撞墙（或寿命耗尽兜底）：释放被钉目标 + 生成逐渐变大的诅咒火焰圈
        p.life = 0;
        for (const o of B.orbs) if (o.pinned === p) { o.pinned = null; o.pinT = 0; addText(o.x, o.y - 40, '钉子入墙', '#cfe0ff', 13); }
        const wx = clamp(p.x, F.x + p.r, F.x + F.s - p.r), wy = clamp(p.y, F.y + p.r, F.y + F.s - p.r);
        B.structs.push({ type: 'cursefire', owner: p.owner, x: wx, y: wy, r: 40, life: 3.2, hitT: 0 });
        addFx({ type: 'ring', x: wx, y: wy, r: 20, vr: 420, maxLife: .45, life: 0, color: '#c07aff', lw: 3.5 });
        addText(wx, wy - 36, '诅咒火焰', '#c07aff', 14);
        sfx('boom');
      } else if (!p.hitFoe) { // 未钉人时探测敌人；命中后钉子继续飞行（不销毁），把敌人钉在钉子上拖向墙面
        // 命中零伤害（纯控制）：伤害由撞墙后的诅咒火焰圈结算
        for (const o of B.orbs) {
          if (o === owner || !o.alive || o.pinned) continue; // 已钉住的球不被第二颗钉覆盖
          if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + p.r) {
            if (o.invT <= 0) {
              p.hitFoe = true; // 防同一钉子每帧重复命中
              o.pinned = p; o.pinT = 999; // 钉住直到钉子撞墙（无超时松开）
              addText(o.x, o.y - 44, '➳ 被钉住!', '#c07aff', 15);
              addRing(o.x, o.y, 50, '#c07aff', 2.5);
              sfx('curse');
            } else {
              addSparks(p.x, p.y, 6, '#c07aff');
            }
            break;
          }
        }
      }
    }
    if (p.type === 'laserbolt') { // 激光发射器光束
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4 || p.y < F.y + 4 || p.y > F.y + F.s - 4) p.life = 0;
      addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-4, 4), vy: rand(-4, 4), life: 0, maxLife: .15, size: 2.2, color: '#6fe8ff' });
      const owner = ownerOf(p.owner);
      for (const o of B.orbs) {
        if (o === owner || !o.alive) continue;
        if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + p.r + 2) {
          p.life = 0;
          hitOrb(o, p.dmg, owner, true);
          addSparks(p.x, p.y, 5, '#6fe8ff');
          break;
        }
      }
    }
    if (p.type === 'corrodepart') { // 腐蚀粒子：低伤，命中叠易伤+叠减速
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.random() < .4) addFx({ type: 'spark', x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .25, size: 2, color: '#b0ff6a' });
      if (p.x < F.x + 4 || p.x > F.x + F.s - 4 || p.y < F.y + 4 || p.y > F.y + F.s - 4) { p.life = 0; continue; }
      const owner = ownerOf(p.owner);
      for (const o of B.orbs) {
        if (o === owner || !o.alive || o.invT > 0) continue;
        if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + p.r + 2) {
          p.life = 0;
          hitOrb(o, 2, owner, true);
          o.corrodeN = Math.min(6, o.corrodeN + 1); o.corrodeT = 5; // 易伤层（每层 +15%）
          o.corrodeSlowN = Math.min(5, o.corrodeSlowN + 1); o.corrodeSlowT = 3; // 减速层（每层 12%）
          addText(o.x, o.y - 40, '腐蚀 易伤×' + o.corrodeN + ' 减速×' + o.corrodeSlowN, '#b0ff6a', 12);
          addSparks(o.x, o.y, 4, '#b0ff6a');
          break;
        }
      }
    }
    if (p.type === 'butterfly') { // 黑白蝴蝶：追踪回归 owner，途中命中敌人造成伤害
      const owner = ownerOf(p.owner);
      if (owner && owner.alive) {
        const ang = Math.atan2(owner.y - p.y, owner.x - p.x);
        let cur = Math.atan2(p.vy, p.vx);
        let diff = ang - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        cur += diff * Math.min(1, 4.5 * dt);
        const sp = 330;
        p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.flap = (p.flap || 0) + dt * 16;
      if (Math.random() < .5) addFx({ type: 'spark', x: p.x, y: p.y, vx: rand(-4, 4), vy: rand(-4, 4), life: 0, maxLife: .25, size: 1.6, color: p.black ? '#c8c8d8' : '#ffffff' });
      if (owner && owner.alive && Math.hypot(owner.x - p.x, owner.y - p.y) < owner.r + 8) { p.life = 0; continue; } // 回归本体消失
      for (const o of B.orbs) {
        if (o === owner || !o.alive) continue;
        if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + p.r + 2) {
          p.life = 0;
          if (o.invT <= 0) hitOrb(o, 6, owner, true);
          addSparks(p.x, p.y, 5, p.black ? '#c8c8d8' : '#ffffff');
          break;
        }
      }
    }
  }
  B.proj = B.proj.filter(p => p.life > 0);
  updateFx(dt);
  // 死亡检查：DoT/领域/吸血击杀统一走结算（多球时出局但战斗继续，直到只剩 1 球）
  for (const o of B.orbs) {
    if (o.hp <= 0 && !B.over) killOrb(o);
  }
  if (B.shake > 0) B.shake *= Math.pow(.02, dt); // 快速衰减
  if (B.shake < .3) B.shake = 0;
}
