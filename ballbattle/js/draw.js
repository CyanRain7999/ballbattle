// ---------------- 装饰绘制 ----------------
function drawDecRing(ctx, o) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
  ctx.strokeStyle = o.color.bright; ctx.lineWidth = Math.max(1.6, o.r * .05); ctx.globalAlpha = .85;
  ctx.setLineDash([o.r * .24, o.r * .16]); ctx.lineDashOffset = -o.angle * 22;
  ctx.beginPath(); ctx.arc(0, 0, o.r * 1.14, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = .4; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, o.r * 1.28, 0, TAU); ctx.stroke();
  // 沿环飞行的能量亮点
  for (let i = 0; i < 3; i++) {
    const a = o.angle * 2 + i * TAU / 3;
    ctx.globalAlpha = .95;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * o.r * 1.14, Math.sin(a) * o.r * 1.14, Math.max(1.5, o.r * .05), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
function drawDecSpike(ctx, o) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
  const w = Math.max(4, o.r * .24), h = Math.max(9, o.r * .34);
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate(i / 6 * TAU);
    ctx.fillStyle = o.color.bright;
    ctx.globalAlpha = .95;
    ctx.beginPath(); ctx.moveTo(o.r * 1.02, 0); ctx.lineTo(o.r * 1.02 + h, -w); ctx.lineTo(o.r * 1.02 + h, w); ctx.closePath(); ctx.fill();
    // 尖端白点（平面点缀）
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.arc(o.r * 1.02 + h * .55, 0, Math.max(1, o.r * .04), 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function drawDecStripe(ctx, o) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
  ctx.beginPath(); ctx.arc(0, 0, o.r * .92, 0, TAU); ctx.clip();
  const off = (o.angle * o.r * .8) % (o.r * .8); // 随旋转流动的条纹
  ctx.strokeStyle = o.color.bright; ctx.globalAlpha = .5; ctx.lineWidth = o.r * .3;
  for (let i = -2; i <= 2; i++) {
    const x0 = i * o.r * .85 + off - o.r;
    ctx.beginPath();
    ctx.moveTo(x0, -o.r); ctx.lineTo(x0 + o.r * 1.7, o.r);
    ctx.stroke();
  }
  ctx.globalAlpha = .35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = o.r * .06;
  for (let i = -2; i <= 2; i++) {
    const x0 = i * o.r * .85 + off - o.r + o.r * .15;
    ctx.beginPath();
    ctx.moveTo(x0, -o.r); ctx.lineTo(x0 + o.r * 1.7, o.r);
    ctx.stroke();
  }
  ctx.restore();
}
function drawDecHex(ctx, o) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
  const hex = (Rr, rot) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + rot;
      const px = Math.cos(a) * Rr, py = Math.sin(a) * Rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  ctx.globalAlpha = .95; ctx.strokeStyle = o.color.bright; ctx.lineWidth = 2;
  hex(o.r * .55, 0); ctx.stroke();
  ctx.globalAlpha = .6; ctx.lineWidth = 1.4;
  hex(o.r * .42, o.angle * .6); ctx.stroke(); // 内层反向旋转
  // 内外连接线
  ctx.globalAlpha = .5; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * o.r * .42, Math.sin(a) * o.r * .42);
    ctx.lineTo(Math.cos(a) * o.r * .55, Math.sin(a) * o.r * .55);
    ctx.stroke();
  }
  // 中心脉动
  ctx.globalAlpha = .8 + .2 * Math.sin(o.angle * 3);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawDecCross(ctx, o) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle * .5);
  ctx.strokeStyle = o.color.bright; ctx.lineWidth = 1.8; ctx.globalAlpha = .95;
  ctx.beginPath(); ctx.moveTo(-o.r * .72, 0); ctx.lineTo(o.r * .72, 0);
  ctx.moveTo(0, -o.r * .72); ctx.lineTo(0, o.r * .72); ctx.stroke();
  // 对角刻度
  ctx.globalAlpha = .6; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * o.r * .55, Math.sin(a) * o.r * .55);
    ctx.lineTo(Math.cos(a) * o.r * .72, Math.sin(a) * o.r * .72);
    ctx.stroke();
  }
  // 旋转虚线内圈
  ctx.globalAlpha = .7;
  ctx.setLineDash([4, 3]); ctx.lineDashOffset = -o.angle * 12;
  ctx.beginPath(); ctx.arc(0, 0, o.r * .38, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------- 球绘制（精美 2D 平面风格） ----------------
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function drawOrb(ctx, o, t) {
  const { x, y, r } = o;
  ctx.save();
  if (o.ghostT > 0) ctx.globalAlpha = .22 + .12 * Math.sin(t * 14); // 幽灵隐身：半透明闪烁
  const R = r * (1 + Math.sin(t * 4 + o.angle) * .02);
  // 尾迹（平面渐隐色带）
  if (o.history && o.history.length > 1) {
    const isTrail = o.decor === 'trail';
    const maxLen = isTrail ? 30 : 12;
    if (o.history.length > maxLen) o.history.splice(0, o.history.length - maxLen);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < o.history.length; i++) {
      const k = i / o.history.length;
      ctx.globalAlpha = k * (isTrail ? .45 : .2);
      ctx.strokeStyle = o.color.bright;
      ctx.lineWidth = k * (isTrail ? 8 : 3);
      ctx.beginPath();
      ctx.moveTo(o.history[i - 1].x, o.history[i - 1].y);
      ctx.lineTo(o.history[i].x, o.history[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }
  // 平面光晕（柔和衬底）
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, R * .3, x, y, R * 1.5);
  glow.addColorStop(0, hexA(o.color.main, .4));
  glow.addColorStop(1, hexA(o.color.main, 0));
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, R * 1.5, 0, TAU); ctx.fill();
  ctx.restore();
  // 主体：纯色平面圆
  ctx.fillStyle = o.color.main;
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  // 平面几何细节：同心环 + 旋转直径线 + 白芯
  ctx.strokeStyle = hexA(o.color.bright, .8);
  ctx.lineWidth = Math.max(1.2, R * .05);
  ctx.beginPath(); ctx.arc(x, y, R * .62, 0, TAU); ctx.stroke();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.angle);
  ctx.strokeStyle = hexA(o.color.bright, .5);
  ctx.lineWidth = Math.max(1, R * .035);
  ctx.beginPath(); ctx.moveTo(-R * .85, 0); ctx.lineTo(R * .85, 0); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x, y, R * .17, 0, TAU); ctx.fill();
  // 外圈描边
  ctx.strokeStyle = o.color.bright;
  ctx.lineWidth = Math.max(1.6, R * .07);
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
  // 外圈旋转虚线环（平面）
  ctx.save();
  ctx.globalAlpha = .65;
  ctx.setLineDash([R * .22, R * .15]); ctx.lineDashOffset = -o.angle * 30;
  ctx.beginPath(); ctx.arc(x, y, R * 1.09, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // 狂暴突进提示（红色旋转虚线环）
  if (o.rushT > 0) {
    ctx.save();
    ctx.globalAlpha = .7;
    ctx.strokeStyle = '#ff5060';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 80;
    ctx.beginPath(); ctx.arc(x, y, R * 1.18, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // 能力底纹（球体底层图案）
  drawAbilityMark(ctx, o, t);
  // 装饰
  const dec = decOf(o.decor);
  if (dec && dec.draw) dec.draw(ctx, o);
  // 护盾（平面圆环）
  if (o.shieldT > 0) {
    ctx.save();
    ctx.fillStyle = hexA(o.color.main, .3);
    ctx.beginPath(); ctx.arc(x, y, R * 1.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.4, R * .045);
    ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 70;
    ctx.beginPath(); ctx.arc(x, y, R * 1.2, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // 受击白闪
  if (o.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, o.flash / .22);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // V8 液袋：裹身护盾（半透明水袋圈 + 血量刻度）
  if (o.liquidHp > 0) {
    ctx.save();
    ctx.globalAlpha = .5 + .15 * Math.sin(t * 5);
    ctx.strokeStyle = '#7df3ff'; ctx.lineWidth = 3;
    ctx.shadowColor = '#7df3ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, R * 1.24, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .3;
    ctx.fillStyle = '#7df3ff';
    ctx.beginPath(); ctx.arc(x, y, R * 1.24, 0, TAU); ctx.fill();
    ctx.globalAlpha = .9;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, R * 1.24, -Math.PI / 2, -Math.PI / 2 + TAU * (o.liquidHp / 60)); ctx.stroke();
    ctx.restore();
  }
  // V8 诅咒之钉：被钉住时头顶画钉尖
  if (o.pinned) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#d9c0ff';
    ctx.beginPath(); ctx.moveTo(R * .9, 0); ctx.lineTo(-R * .4, -R * .3); ctx.lineTo(-R * .2, 0); ctx.lineTo(-R * .4, R * .3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-R * .2, 0, R * .14, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------- 能力底纹（球体底层按能力区分） ----------------
function drawAbilityMark(ctx, o, t) {
  const { x, y, r } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = o.color.bright;
  ctx.fillStyle = o.color.bright;
  ctx.lineWidth = Math.max(1.2, r * .04);
  const rr = r * .55;
  switch (o.ability) {
    case 'gravity': // 漩涡
      ctx.globalAlpha = .7;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, rr * (1 - i * .24), i * 2.2 + t * 3, i * 2.2 + t * 3 + 4.4);
        ctx.stroke();
      }
      break;
    case 'portal': { // 门形
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.moveTo(-rr * .5, rr); ctx.lineTo(-rr * .5, -rr * .3); ctx.arc(0, -rr * .3, rr * .5, Math.PI, 0); ctx.lineTo(rr * .5, rr); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-rr * .32, rr); ctx.lineTo(-rr * .32, -rr * .1); ctx.moveTo(rr * .32, rr); ctx.lineTo(rr * .32, -rr * .1); ctx.stroke();
      break;
    }
    case 'chemist': { // 药瓶
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.moveTo(-rr * .4, -rr * .4); ctx.lineTo(rr * .4, -rr * .4); ctx.lineTo(rr * .32, -rr * .75); ctx.lineTo(-rr * .32, -rr * .75); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-rr * .5, -rr * .3); ctx.lineTo(rr * .5, -rr * .3); ctx.lineTo(rr * .4, rr); ctx.lineTo(-rr * .4, rr); ctx.closePath(); ctx.stroke();
      break;
    }
    case 'burn': // 火焰锯齿
      ctx.globalAlpha = .85;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        const r1 = rr * (i % 2 ? .6 : .92);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r1, Math.sin(a) * r1);
      }
      ctx.closePath(); ctx.stroke();
      break;
    case 'vampire': // 月牙 + 血滴
      ctx.globalAlpha = .92;
      ctx.beginPath(); ctx.arc(0, 0, rr * .75, -1.2, 1.2); ctx.arc(0, -rr * .18, rr * .75, 1.2, -1.2, true); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5060';
      ctx.beginPath(); ctx.arc(rr * .42, rr * .42, rr * .15, 0, TAU); ctx.fill();
      break;
    case 'combo': // 速度线
      ctx.globalAlpha = .85;
      ctx.lineWidth = Math.max(2, r * .07);
      for (let i = 0; i < 3; i++) {
        const y0 = (i - 1) * rr * .4;
        const len = rr * (1.25 - Math.abs(i - 1) * .35);
        ctx.beginPath(); ctx.moveTo(-len, y0); ctx.lineTo(len, y0); ctx.stroke();
      }
      break;
    case 'turret': // 齿轮
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.arc(0, 0, rr * .48, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        ctx.moveTo(Math.cos(a) * rr * .48, Math.sin(a) * rr * .48);
        ctx.lineTo(Math.cos(a) * rr * .75, Math.sin(a) * rr * .75);
      }
      ctx.stroke();
      break;
    case 'split': // 双圆
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.arc(-rr * .26, 0, rr * .44, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(rr * .3, 0, rr * .26, 0, TAU); ctx.stroke();
      break;
    case 'gunner': // 十字
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.moveTo(-rr, 0); ctx.lineTo(rr, 0); ctx.moveTo(0, -rr); ctx.lineTo(0, rr); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, rr * .28, 0, TAU); ctx.stroke();
      break;
    case 'wuliang': // 太极
      ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(-rr * .5, 0, rr * .5, Math.PI / 2, -Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rr * .5, 0, rr * .5, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.fillStyle = o.color.bright;
      ctx.beginPath(); ctx.arc(-rr * .5, 0, rr * .1, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.beginPath(); ctx.arc(rr * .5, 0, rr * .1, 0, TAU); ctx.stroke();
      break;
    case 'slash': // 刀痕
      ctx.globalAlpha = .9;
      ctx.lineWidth = Math.max(2.5, r * .09);
      ctx.beginPath(); ctx.moveTo(-rr * .8, rr * .6); ctx.lineTo(rr * .8, -rr * .6); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-rr * .4, rr * .8); ctx.lineTo(rr * .6, -rr * .8); ctx.stroke();
      break;
    case 'idol': // 五角星
      ctx.globalAlpha = .9;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU - Math.PI / 2;
        const r1 = i % 2 ? rr * .38 : rr;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r1, Math.sin(a) * r1);
      }
      ctx.closePath(); ctx.stroke();
      break;
    case 'anchor': // 锚
      ctx.globalAlpha = .9;
      ctx.lineWidth = Math.max(1.6, r * .05);
      ctx.beginPath(); ctx.moveTo(0, -rr); ctx.lineTo(0, rr); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -rr * .55, rr * .28, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, rr * .15, rr * .42, .25, Math.PI - .25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-rr * .4, rr * .75); ctx.lineTo(rr * .4, rr * .75); ctx.stroke();
      break;
    case 'drone': // 三点环绕
      ctx.globalAlpha = .85;
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU + t * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr * .7, Math.sin(a) * rr * .7, rr * .13, 0, TAU); ctx.fill();
      }
      break;
    case 'frost': { // 冰霜刺剑：常驻指向敌方（随失血增剑，剑长与技能一致）
      const foe = nearestFoe(o);
      const n = Math.min(4, 1 + Math.floor((1 - o.hp / o.maxHp) / .3));
      if (!foe || !foe.alive) break;
      const ang = Math.atan2(foe.y - o.y, foe.x - o.x);
      const range = 220 + 60 * (n - 1); // 与技能释放范围一致
      ctx.globalAlpha = .9;
      ctx.lineWidth = Math.max(2, rr * .09);
      ctx.strokeStyle = 'rgba(191,233,255,.95)';
      ctx.shadowColor = '#7fd8ff'; ctx.shadowBlur = 8;
      for (let i = 0; i < n; i++) {
        const spread = (i - (n - 1) / 2) * .3;
        const a = ang + spread;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rr * .5, Math.sin(a) * rr * .5);
        ctx.lineTo(Math.cos(a) * range, Math.sin(a) * range);
        ctx.stroke();
        // 剑尖
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * range, Math.sin(a) * range, rr * .08, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }
    // —— V4 能力底纹 ——
    case 'launcher': // 弹射箭头
      ctx.globalAlpha = .9;
      ctx.lineWidth = Math.max(2, r * .07);
      ctx.beginPath(); ctx.moveTo(-rr * .7, -rr * .45); ctx.lineTo(rr * .45, 0); ctx.lineTo(-rr * .7, rr * .45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-rr * .7, 0); ctx.lineTo(rr * .8, 0); ctx.stroke();
      break;
    case 'tornado': // 旋风三弧
      ctx.globalAlpha = .8;
      ctx.lineWidth = Math.max(1.6, r * .05);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, rr * (.3 + i * .24), i * 2.4 + t * 4, i * 2.4 + t * 4 + 4.2);
        ctx.stroke();
      }
      break;
    case 'web': // 蛛网放射线 + 环
      ctx.globalAlpha = .85;
      ctx.lineWidth = Math.max(1.2, r * .04);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, rr * .5, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, rr * .8, 0, TAU); ctx.stroke();
      break;
    case 'volcano': // 火山锥 + 熔岩滴
      ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.moveTo(-rr, rr * .6); ctx.lineTo(-rr * .3, -rr * .7); ctx.lineTo(rr * .3, -rr * .7); ctx.lineTo(rr, rr * .6); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#ff8833';
      ctx.beginPath(); ctx.arc(-rr * .1, -rr * .35, rr * .12, 0, TAU); ctx.fill();
      break;
    case 'venom': // 毒滴 + 气泡
      ctx.globalAlpha = .92;
      ctx.fillStyle = '#9fe870';
      ctx.beginPath(); ctx.arc(0, rr * .15, rr * .5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -rr * .2, rr * .3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8ffd0';
      ctx.beginPath(); ctx.arc(rr * .18, -rr * .3, rr * .1, 0, TAU); ctx.fill();
      break;
    case 'ghost': // 幽灵虚线圈
      ctx.globalAlpha = .7;
      ctx.setLineDash([rr * .3, rr * .2]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(0, 0, rr * .8, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath(); ctx.arc(0, -rr * .2, rr * .34, 0, TAU); ctx.fill();
      break;
    case 'star': // 四角星
      ctx.globalAlpha = .9;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU - Math.PI / 2;
        const r1 = i % 2 ? rr * .38 : rr;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r1, Math.sin(a) * r1);
      }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath(); ctx.arc(0, 0, rr * .12, 0, TAU); ctx.fill();
      break;
    // —— V5 能力底纹 ——
    case 'tsunami': // 波浪三线
      ctx.globalAlpha = .85;
      ctx.lineWidth = Math.max(1.6, r * .05);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = -rr; x <= rr; x += rr / 5) {
          const y = Math.sin(x / rr * 3.2 + i * 1.2 + t * 5) * rr * .22 + (i - 1) * rr * .3;
          x === -rr ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    case 'spore': // 蘑菇伞
      ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.arc(0, -rr * .15, rr * .62, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = o.color.bright;
      ctx.beginPath(); ctx.moveTo(0, rr * .05); ctx.lineTo(0, rr * .8); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI + (i + 1) * Math.PI / 5;
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr * .45, -rr * .12 + Math.sin(a) * rr * .45 * .45, rr * .07, 0, TAU); ctx.fill();
      }
      break;
    case 'clone': // 双框
      ctx.globalAlpha = .85;
      ctx.strokeRect(-rr * .75, -rr * .55, rr * .6, rr * 1.1);
      ctx.strokeRect(rr * .15, -rr * .55, rr * .6, rr * 1.1);
      break;
    case 'evolve': // 上升箭头 + 等级点
      ctx.globalAlpha = .9;
      ctx.lineWidth = Math.max(2, r * .07);
      ctx.beginPath(); ctx.moveTo(0, rr * .75); ctx.lineTo(0, -rr * .55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-rr * .4, -rr * .15); ctx.lineTo(0, -rr * .6); ctx.lineTo(rr * .4, -rr * .15); ctx.stroke();
      ctx.fillStyle = '#7dffa8';
      for (let i = 0; i < (o.evolveLv || 0); i++) {
        ctx.beginPath(); ctx.arc(-rr * .45 + i * rr * .42, rr * .62, rr * .1, 0, TAU); ctx.fill();
      }
      break;
    case 'lance': // 长枪
      ctx.globalAlpha = .92;
      ctx.lineWidth = Math.max(2.2, r * .08);
      ctx.beginPath(); ctx.moveTo(-rr * .85, rr * .45); ctx.lineTo(rr * .85, -rr * .45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rr * .5, -rr * .7); ctx.lineTo(rr * .95, -rr * .35); ctx.lineTo(rr * .3, -rr * .1); ctx.closePath(); ctx.stroke();
      break;
    default: // 原有能力：双环
      ctx.globalAlpha = .7;
      ctx.beginPath(); ctx.arc(0, 0, rr * .8, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, rr * .5, 0, TAU); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ---------------- 场景实体绘制 ----------------
function drawStructs() {
  const B = battle, t = B.time;
  // 切割球：单锚点时的牵引线
  for (const o of B.orbs) {
    if (o.ability === 'anchor' && o.anchorPts && o.anchorPts.length === 1) {
      bctx.save();
      bctx.strokeStyle = 'rgba(176,196,255,.4)'; bctx.lineWidth = 1.5;
      bctx.setLineDash([6, 4]);
      bctx.beginPath(); bctx.moveTo(o.anchorPts[0].x, o.anchorPts[0].y); bctx.lineTo(o.x, o.y); bctx.stroke();
      bctx.setLineDash([]);
      bctx.restore();
    }
    // V8 拘束：所有锚点经绳索链接自身
    if (o.ability === 'bond' && o.bondPts && o.bondPts.length) {
      for (const pt of o.bondPts) {
        bctx.save();
        bctx.strokeStyle = 'rgba(216,200,255,.8)'; bctx.lineWidth = 2.5;
        bctx.shadowColor = '#d8c8ff'; bctx.shadowBlur = 6;
        bctx.setLineDash([7, 4]); bctx.lineDashOffset = -t * 36;
        bctx.beginPath(); bctx.moveTo(pt.x, pt.y); bctx.lineTo(o.x, o.y); bctx.stroke();
        bctx.setLineDash([]); bctx.shadowBlur = 0;
        bctx.fillStyle = '#d8c8ff';
        bctx.beginPath(); bctx.arc(pt.x, pt.y, 4.5, 0, TAU); bctx.fill();
        bctx.restore();
      }
    }
  }
  for (const s of B.structs) {
    if (s.type === 'gravwell') { // 引力阱：黑洞漩涡 + 吸积盘 + 事件视界
      bctx.save();
      bctx.translate(s.x, s.y);
      const pr = 30 + Math.sin(s.pulse) * 6;
      // 外圈渐晕
      const halo = bctx.createRadialGradient(0, 0, pr * .3, 0, 0, pr * 2.4);
      halo.addColorStop(0, 'rgba(159,216,255,.28)');
      halo.addColorStop(1, 'rgba(159,216,255,0)');
      bctx.fillStyle = halo;
      bctx.beginPath(); bctx.arc(0, 0, pr * 2.4, 0, TAU); bctx.fill();
      // 螺旋旋臂（吸积盘）
      bctx.strokeStyle = 'rgba(159,216,255,.75)'; bctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        bctx.beginPath();
        bctx.arc(0, 0, pr * (1 + i * .5), s.pulse * 2 + i * 2.1, s.pulse * 2 + i * 2.1 + 3.6);
        bctx.stroke();
      }
      // 事件视界虚线环
      bctx.strokeStyle = 'rgba(190,230,255,.6)'; bctx.lineWidth = 1.5;
      bctx.setLineDash([8, 6]); bctx.lineDashOffset = -s.pulse * 14;
      bctx.beginPath(); bctx.arc(0, 0, pr * 1.5, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      // 黑洞核心（深色渐变）
      const core = bctx.createRadialGradient(0, 0, 1, 0, 0, pr * .6);
      core.addColorStop(0, '#000');
      core.addColorStop(.7, '#0a1428');
      core.addColorStop(1, '#1e4a6b');
      bctx.fillStyle = core;
      bctx.beginPath(); bctx.arc(0, 0, pr * .6, 0, TAU); bctx.fill();
      bctx.strokeStyle = '#9fd8ff'; bctx.lineWidth = 1.5;
      bctx.beginPath(); bctx.arc(0, 0, pr * .6, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    if (s.type === 'portal') { // 传送门
      bctx.save();
      bctx.translate(s.x, s.y);
      bctx.strokeStyle = '#8df6ff'; bctx.lineWidth = 3;
      bctx.beginPath(); bctx.moveTo(-16, 24); bctx.lineTo(-16, -10); bctx.arc(0, -10, 16, Math.PI, 0); bctx.lineTo(16, 24); bctx.stroke();
      bctx.strokeStyle = 'rgba(141,246,255,.55)'; bctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        bctx.beginPath();
        bctx.arc(0, 0, 8 + i * 5, t * 4 + i * 2, t * 4 + i * 2 + 4.2);
        bctx.stroke();
      }
      bctx.restore();
    }
    if (s.type === 'zone') { // 领域/药水圈
      const col = s.kind === 'heal' ? '#3dff9e' : s.kind === 'slow' ? '#b06aff' : s.kind === 'vamp' ? '#ff2244' : (s.kind === 'idol' || s.kind === 'idolburst') ? '#ffd0ff' : (s.kind === 'trap' ? '#b06aff' : '#ff5566');
      bctx.save();
      bctx.fillStyle = hexA(col, s.kind === 'idol' ? .1 : .14);
      bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, TAU); bctx.fill();
      bctx.strokeStyle = col; bctx.globalAlpha = .5 + .3 * Math.sin(t * 5); bctx.lineWidth = 1.5;
      bctx.setLineDash([8, 6]); bctx.lineDashOffset = -t * 30;
      bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.globalAlpha = 1;
      if (s.kind === 'idol' || s.kind === 'idolburst') { // 星点
        bctx.fillStyle = '#ffd0ff';
        for (let i = 0; i < 6; i++) {
          const a = t * 1.5 + i * TAU / 6;
          bctx.globalAlpha = .55;
          bctx.beginPath(); bctx.arc(s.x + Math.cos(a) * s.r * .6, s.y + Math.sin(a) * s.r * .6, 2, 0, TAU); bctx.fill();
        }
      }
      if (s.kind === 'slow') { // 雪花点
        bctx.fillStyle = '#c9a0ff';
        for (let i = 0; i < 8; i++) {
          const a = t * 2 + i * TAU / 8;
          bctx.globalAlpha = .7;
          bctx.beginPath(); bctx.arc(s.x + Math.cos(a) * s.r * .55, s.y + Math.sin(a) * s.r * .55, 1.8, 0, TAU); bctx.fill();
        }
      }
      if (s.kind === 'vamp') { // 血滴上升
        bctx.fillStyle = '#ff5060';
        for (let i = 0; i < 5; i++) {
          const a = t * 2 + i * 1.3;
          bctx.globalAlpha = .6;
          bctx.beginPath(); bctx.arc(s.x + Math.cos(a) * s.r * .4, s.y + Math.sin(a) * s.r * .4 - t * 20 % 40, 2, 0, TAU); bctx.fill();
        }
      }
      bctx.restore();
    }
    if (s.type === 'turret') { // 炮台
      bctx.save();
      bctx.translate(s.x, s.y);
      bctx.fillStyle = '#ffd050'; bctx.globalAlpha = .85;
      bctx.beginPath(); bctx.moveTo(-14, 18); bctx.lineTo(14, 18); bctx.lineTo(0, -10); bctx.closePath(); bctx.fill();
      bctx.fillStyle = '#fff3c0';
      bctx.beginPath(); bctx.arc(0, -14, 8, 0, TAU); bctx.fill();
      const foe = nearestFoe(ownerOf(s.owner));
      const a = Math.atan2(foe.y - s.y, foe.x - s.x);
      bctx.strokeStyle = '#fff3c0'; bctx.lineWidth = 3;
      bctx.beginPath(); bctx.moveTo(0, -14); bctx.lineTo(Math.cos(a) * 13, -14 + Math.sin(a) * 13); bctx.stroke();
      bctx.restore();
    }
    if (s.type === 'anchor') { // 船锚 + 链
      const owner = ownerOf(s.owner);
      bctx.save();
      bctx.strokeStyle = 'rgba(176,196,255,.55)'; bctx.lineWidth = 1.5;
      bctx.setLineDash([4, 3]);
      bctx.beginPath(); bctx.moveTo(owner.x, owner.y); bctx.lineTo(s.x, s.y); bctx.stroke();
      bctx.setLineDash([]);
      bctx.translate(s.x, s.y);
      bctx.rotate(s.angle * .5);
      bctx.strokeStyle = '#b0c4ff'; bctx.lineWidth = 3;
      bctx.beginPath(); bctx.moveTo(0, -10); bctx.lineTo(0, 10); bctx.stroke();
      bctx.beginPath(); bctx.arc(0, -6, 5, 0, TAU); bctx.stroke();
      bctx.beginPath(); bctx.arc(0, 6, 7, .2, Math.PI - .2); bctx.stroke();
      bctx.beginPath(); bctx.moveTo(-6, 11); bctx.lineTo(6, 11); bctx.stroke();
      bctx.restore();
    }
    if (s.type === 'slash') { // 空间斩预告线
      bctx.save();
      const blink = .3 + .3 * Math.sin(s.pulse * 2);
      for (const ln of s.lines) {
        bctx.strokeStyle = 'rgba(255,80,120,' + blink.toFixed(2) + ')'; bctx.lineWidth = 6;
        bctx.beginPath(); bctx.moveTo(ln[0], ln[1]); bctx.lineTo(ln[2], ln[3]); bctx.stroke();
        bctx.strokeStyle = 'rgba(255,255,255,.8)'; bctx.lineWidth = 1.5;
        bctx.setLineDash([14, 10]); bctx.lineDashOffset = -t * 60;
        bctx.beginPath(); bctx.moveTo(ln[0], ln[1]); bctx.lineTo(ln[2], ln[3]); bctx.stroke();
        bctx.setLineDash([]);
      }
      bctx.restore();
    }
    if (s.type === 'drone') { // 浮游炮
      bctx.save();
      bctx.translate(s.x, s.y);
      bctx.rotate(s.angle + s.phase);
      bctx.fillStyle = '#9ff';
      bctx.beginPath(); bctx.moveTo(0, -8); bctx.lineTo(6, 6); bctx.lineTo(-6, 6); bctx.closePath(); bctx.fill();
      bctx.strokeStyle = 'rgba(159,255,255,.5)'; bctx.lineWidth = 1;
      bctx.beginPath(); bctx.arc(0, 0, 10, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    if (s.type === 'wuliangball') { // 苍/赫球：太极双色球 + 力场圈
      bctx.save();
      bctx.translate(s.x, s.y);
      const col = s.kind === 'cang' ? '#9fd8ff' : '#ffb06a';
      bctx.globalAlpha = Math.min(1, s.life / 2);
      // 力场圈
      bctx.strokeStyle = col; bctx.globalAlpha *= .4;
      bctx.beginPath(); bctx.arc(0, 0, 250, 0, TAU); bctx.stroke();
      bctx.globalAlpha = Math.min(1, s.life / 2);
      // 球体
      bctx.fillStyle = col;
      bctx.beginPath(); bctx.arc(0, 0, s.r, 0, TAU); bctx.fill();
      bctx.strokeStyle = '#fff'; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(0, 0, s.r, 0, TAU); bctx.stroke();
      // 太极纹
      bctx.beginPath(); bctx.arc(0, 0, s.r * .7, 0, TAU); bctx.stroke();
      bctx.beginPath(); bctx.arc(-s.r * .35, 0, s.r * .35, Math.PI / 2, -Math.PI / 2); bctx.stroke();
      bctx.beginPath(); bctx.arc(s.r * .35, 0, s.r * .35, -Math.PI / 2, Math.PI / 2); bctx.stroke();
      bctx.restore();
    }
    if (s.type === 'wulianbi') { // 芘：双色太极融合球 + 旋转虚线圈
      bctx.save();
      bctx.translate(s.x, s.y);
      bctx.rotate(t * 2.2);
      const pr = s.r + Math.sin(t * 3) * 3;
      bctx.globalAlpha = Math.min(1, s.life);
      // 太极双色
      bctx.fillStyle = '#9fd8ff';
      bctx.beginPath(); bctx.arc(0, 0, pr, -Math.PI / 2, Math.PI / 2); bctx.fill();
      bctx.fillStyle = '#ffb06a';
      bctx.beginPath(); bctx.arc(0, 0, pr, Math.PI / 2, -Math.PI / 2); bctx.fill();
      bctx.fillStyle = '#ffb06a';
      bctx.beginPath(); bctx.arc(0, -pr / 2, pr / 2, 0, TAU); bctx.fill();
      bctx.fillStyle = '#9fd8ff';
      bctx.beginPath(); bctx.arc(0, pr / 2, pr / 2, 0, TAU); bctx.fill();
      // 太极 S 线
      bctx.strokeStyle = 'rgba(255,255,255,.85)'; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(0, 0, pr, 0, TAU); bctx.stroke();
      bctx.beginPath(); bctx.arc(0, -pr / 2, pr / 2, Math.PI / 2, -Math.PI / 2); bctx.stroke();
      bctx.beginPath(); bctx.arc(0, pr / 2, pr / 2, -Math.PI / 2, Math.PI / 2); bctx.stroke();
      // 外圈虚线旋转环
      bctx.strokeStyle = 'rgba(255,255,255,.5)'; bctx.lineWidth = 1.5;
      bctx.setLineDash([9, 6]); bctx.lineDashOffset = -t * 60;
      bctx.beginPath(); bctx.arc(0, 0, pr * 1.3, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.globalAlpha = 1;
      bctx.restore();
    }
    if (s.type === 'cable') { // 切割电缆：虚线发光 + 锚点
      bctx.save();
      bctx.strokeStyle = 'rgba(176,196,255,.75)'; bctx.lineWidth = 3;
      bctx.setLineDash([10, 5]); bctx.lineDashOffset = -t * 40;
      bctx.shadowColor = '#b0c4ff'; bctx.shadowBlur = 6;
      bctx.beginPath(); bctx.moveTo(s.x1, s.y1); bctx.lineTo(s.x2, s.y2); bctx.stroke();
      bctx.setLineDash([]); bctx.shadowBlur = 0;
      bctx.fillStyle = '#b0c4ff';
      bctx.beginPath(); bctx.arc(s.x1, s.y1, 4, 0, TAU); bctx.fill();
      bctx.beginPath(); bctx.arc(s.x2, s.y2, 4, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (s.type === 'beam') { // 浮游炮激光柱
      bctx.save();
      const g = bctx.createLinearGradient(s.x1, s.y1, s.x2, s.y2);
      g.addColorStop(0, 'rgba(159,255,255,.95)');
      g.addColorStop(1, 'rgba(159,255,255,.12)');
      bctx.strokeStyle = g; bctx.lineWidth = 18;
      bctx.shadowColor = '#9ff'; bctx.shadowBlur = 22;
      bctx.beginPath(); bctx.moveTo(s.x1, s.y1); bctx.lineTo(s.x2, s.y2); bctx.stroke();
      bctx.strokeStyle = 'rgba(255,255,255,.95)'; bctx.lineWidth = 5;
      bctx.shadowBlur = 0;
      bctx.beginPath(); bctx.moveTo(s.x1, s.y1); bctx.lineTo(s.x2, s.y2); bctx.stroke();
      bctx.restore();
    }
    if (s.type === 'railcircle') { // 轨道炮-圆击：蓄力 1s 瞬发 120 实伤
      bctx.save();
      bctx.strokeStyle = 'rgba(255,208,255,' + (.3 + .3 * Math.sin(t * 18)) + ')';
      bctx.lineWidth = 2.5;
      bctx.setLineDash([12, 9]); bctx.lineDashOffset = -t * 40;
      bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.fillStyle = 'rgba(255,208,255,.06)';
      bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (s.type === 'nest') { // 无人机巢：六边形 + 血条
      bctx.save();
      bctx.translate(s.x, s.y);
      bctx.rotate(t * .6);
      bctx.strokeStyle = '#9f8fff'; bctx.lineWidth = 2.5;
      bctx.shadowColor = '#9f8fff'; bctx.shadowBlur = 10;
      bctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        const px = Math.cos(a) * 26, py = Math.sin(a) * 26;
        if (i === 0) bctx.moveTo(px, py); else bctx.lineTo(px, py);
      }
      bctx.closePath(); bctx.stroke();
      bctx.rotate(-t * .6);
      bctx.fillStyle = 'rgba(159,143,255,.15)';
      bctx.beginPath(); bctx.arc(0, 0, 16, 0, TAU); bctx.fill();
      // 血条
      bctx.fillStyle = 'rgba(255,255,255,.25)';
      bctx.fillRect(-22, -34, 44, 4);
      bctx.fillStyle = '#ff5060';
      bctx.fillRect(-22, -34, 44 * Math.max(0, s.hp / 40), 4);
      bctx.restore();
    }
    if (s.type === 'echo') { // 回声记录点
      bctx.save();
      bctx.strokeStyle = 'rgba(143,216,255,' + (.4 + .3 * Math.sin(t * 6)) + ')';
      bctx.lineWidth = 2;
      bctx.setLineDash([8, 8]);
      bctx.beginPath(); bctx.arc(s.x, s.y, 34 + Math.sin(t * 4) * 4, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.restore();
    }
    if (s.type === 'arcwall') { // 弧形护盾墙
      bctx.save();
      bctx.strokeStyle = 'rgba(159,216,255,.85)';
      bctx.lineWidth = 8;
      bctx.shadowColor = '#9fd8ff'; bctx.shadowBlur = 16;
      bctx.beginPath();
      bctx.arc(s.x, s.y, s.R, s.a0, s.a1);
      bctx.stroke();
      bctx.strokeStyle = 'rgba(255,255,255,.8)';
      bctx.lineWidth = 2.5;
      bctx.shadowBlur = 0;
      bctx.beginPath();
      bctx.arc(s.x, s.y, s.R, s.a0, s.a1);
      bctx.stroke();
      bctx.restore();
    }
    // —— V4 场景实体 ——
    if (s.type === 'web') { // 蛛网：放射线 + 同心环 + 粘丝
      bctx.save();
      bctx.translate(s.x, s.y);
      bctx.globalAlpha = .8;
      bctx.strokeStyle = '#e8f4ff'; bctx.lineWidth = 1.2;
      bctx.shadowColor = '#e8f4ff'; bctx.shadowBlur = 6;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + t * .3;
        bctx.beginPath(); bctx.moveTo(0, 0); bctx.lineTo(Math.cos(a) * s.r, Math.sin(a) * s.r); bctx.stroke();
      }
      for (let i = 1; i <= 3; i++) {
        bctx.beginPath(); bctx.arc(0, 0, s.r * i / 3, 0, TAU); bctx.stroke();
      }
      // 粘丝垂挂
      bctx.globalAlpha = .5;
      for (let i = 0; i < 5; i++) {
        const a = t * .8 + i * 1.3;
        bctx.beginPath();
        bctx.moveTo(Math.cos(a) * s.r, Math.sin(a) * s.r);
        bctx.quadraticCurveTo(Math.cos(a) * s.r * 1.1 + Math.sin(t * 2) * 6, Math.sin(a) * s.r * 1.1, Math.cos(a) * s.r * 1.22, Math.sin(a) * s.r * 1.22);
        bctx.stroke();
      }
      bctx.restore();
    }
    if (s.type === 'lavaburst') { // 火山熔岩：发光曲线
      bctx.save();
      bctx.lineCap = 'round';
      for (const seg of s.segs) {
        if (seg.pts.length < 2) continue;
        const grd = bctx.createLinearGradient(seg.pts[0].x, seg.pts[0].y, seg.pts[seg.pts.length - 1].x, seg.pts[seg.pts.length - 1].y);
        grd.addColorStop(0, 'rgba(255,136,51,.25)');
        grd.addColorStop(1, 'rgba(255,200,80,.95)');
        bctx.strokeStyle = grd;
        bctx.lineWidth = 9;
        bctx.shadowColor = '#ff8833'; bctx.shadowBlur = 14;
        bctx.beginPath();
        bctx.moveTo(seg.pts[0].x, seg.pts[0].y);
        for (let i = 1; i < seg.pts.length; i++) bctx.lineTo(seg.pts[i].x, seg.pts[i].y);
        bctx.stroke();
        bctx.strokeStyle = 'rgba(255,255,255,.85)';
        bctx.lineWidth = 2.5;
        bctx.beginPath();
        bctx.moveTo(seg.pts[0].x, seg.pts[0].y);
        for (let i = 1; i < seg.pts.length; i++) bctx.lineTo(seg.pts[i].x, seg.pts[i].y);
        bctx.stroke();
      }
      bctx.restore();
    }
    // —— V5 场景实体 ——
    if (s.type === 'tsunami') { // 海啸：多层波浪条带
      bctx.save();
      const cx = s.x + Math.cos(s.a) * s.len, cy = s.y + Math.sin(s.a) * s.len;
      const nx = -Math.sin(s.a), ny = Math.cos(s.a); // 垂直方向
      bctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const off = i * 170; // 浪宽 +400%（±37 → ±185）
        bctx.strokeStyle = i === 0 ? 'rgba(159,232,255,.9)' : 'rgba(111,216,255,.45)';
        bctx.lineWidth = i === 0 ? 12 : 6;
        bctx.shadowColor = '#9fe8ff'; bctx.shadowBlur = i === 0 ? 16 : 6;
        bctx.beginPath();
        const steps = 14;
        for (let k = 0; k <= steps; k++) {
          const kk = k / steps;
          const px = s.x + (cx - s.x) * kk + nx * off + Math.sin(kk * 9 - t * 7) * 7;
          const py = s.y + (cy - s.y) * kk + ny * off + Math.cos(kk * 9 - t * 7) * 7;
          k === 0 ? bctx.moveTo(px, py) : bctx.lineTo(px, py);
        }
        bctx.stroke();
      }
      bctx.restore();
    }
    if (s.type === 'mushroom') { // 毒蘑菇：伞+茎+毒圈（生长动画，半径 +50%）
      bctx.save();
      bctx.translate(s.x, s.y);
      const grow = Math.min(1, 1 - s.growT / 2);
      bctx.globalAlpha = .4 + .5 * grow;
      bctx.fillStyle = 'rgba(184,232,112,.12)';
      bctx.beginPath(); bctx.arc(0, 0, 87 * grow, 0, TAU); bctx.fill();
      bctx.strokeStyle = 'rgba(184,232,112,.35)';
      bctx.setLineDash([6, 5]); bctx.lineDashOffset = -t * 24;
      bctx.beginPath(); bctx.arc(0, 0, 87 * grow, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.globalAlpha = .95;
      bctx.strokeStyle = '#8a9a6a'; bctx.lineWidth = 5;
      bctx.beginPath(); bctx.moveTo(0, 0); bctx.lineTo(0, -24 * grow); bctx.stroke();
      bctx.fillStyle = '#b8e870';
      bctx.shadowColor = '#b8e870'; bctx.shadowBlur = 10;
      bctx.beginPath(); bctx.arc(0, -26 * grow, 21 * grow, Math.PI, 0); bctx.closePath(); bctx.fill();
      bctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + (i + 1) * Math.PI / 5;
        bctx.beginPath(); bctx.arc(Math.cos(a) * 15 * grow, -26 * grow + Math.sin(a) * 5 * grow, 3 * grow, 0, TAU); bctx.fill();
      }
      bctx.restore();
    }
    // —— V8 结构体绘制 ——
    if (s.type === 'cursefire') { // 诅咒火焰圈：逐渐变大的紫火环
      bctx.save();
      bctx.globalAlpha = .35;
      const fg = bctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, s.r);
      fg.addColorStop(0, 'rgba(192,122,255,.5)');
      fg.addColorStop(1, 'rgba(192,122,255,0)');
      bctx.fillStyle = fg;
      bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, TAU); bctx.fill();
      bctx.globalAlpha = .9;
      bctx.strokeStyle = '#c07aff'; bctx.lineWidth = 3;
      bctx.shadowColor = '#c07aff'; bctx.shadowBlur = 14;
      bctx.setLineDash([12, 8]); bctx.lineDashOffset = -t * 60;
      bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.restore();
    }
    if (s.type === 'laserturret') { // 激光发射器：菱形塔 + 旋转瞄准环
      bctx.save();
      bctx.translate(s.x, s.y);
      const foe = nearestFoe(ownerOf(s.owner));
      const a = foe && foe.alive ? Math.atan2(foe.y - s.y, foe.x - s.x) : t * 2;
      bctx.rotate(a);
      bctx.fillStyle = '#6fe8ff'; bctx.globalAlpha = .9;
      bctx.shadowColor = '#6fe8ff'; bctx.shadowBlur = 10;
      bctx.beginPath(); bctx.moveTo(0, -14); bctx.lineTo(10, 0); bctx.lineTo(0, 14); bctx.lineTo(-10, 0); bctx.closePath(); bctx.fill();
      bctx.rotate(-a);
      bctx.globalAlpha = .5;
      bctx.strokeStyle = '#6fe8ff'; bctx.lineWidth = 1.5;
      bctx.setLineDash([5, 4]); bctx.lineDashOffset = -t * 30;
      bctx.beginPath(); bctx.arc(0, 0, 18, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.restore();
    }
    if (s.type === 'coffinzone') { // 棺椁封锁区：灰紫禁区边框 + 禁入标记
      bctx.save();
      bctx.strokeStyle = 'rgba(154,154,176,.5)'; bctx.lineWidth = 2.5;
      bctx.setLineDash([10, 6]); bctx.lineDashOffset = -t * 30;
      bctx.strokeRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8);
      bctx.setLineDash([]);
      bctx.fillStyle = 'rgba(154,154,176,.05)';
      bctx.fillRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8);
      bctx.fillStyle = 'rgba(154,154,176,.8)';
      bctx.font = 'bold 13px Consolas, monospace';
      bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
      bctx.globalAlpha = .5 + .3 * Math.sin(t * 3);
      bctx.fillText('⚰', s.x + s.w / 2, s.y + s.h / 2);
      bctx.restore();
    }
    if (s.type === 'laserring') { // 科技X：6 圈激光保护环（越靠内越亮）
      bctx.save();
      bctx.translate(s.x, s.y);
      for (let k = 0; k < 6; k++) {
        const rr = 78 + k * 58;
        bctx.strokeStyle = 'rgba(94,240,255,' + (.85 - k * .1) + ')';
        bctx.lineWidth = 3 - k * .25;
        bctx.shadowColor = '#5ef0ff'; bctx.shadowBlur = 14 - k * 2;
        bctx.beginPath(); bctx.arc(0, 0, rr, t * 2 + k * .5, t * 2 + k * .5 + TAU * .8); bctx.stroke();
        bctx.beginPath(); bctx.arc(0, 0, rr, 0, TAU); bctx.globalAlpha *= .35; bctx.stroke();
        bctx.globalAlpha = 1;
      }
      bctx.restore();
    }
    if (s.type === 'laserbeams') { // 科技X：6 条旋转激光柱
      bctx.save();
      for (let i = 0; i < 6; i++) {
        const a = s.rot + i * TAU / 6;
        const ex = s.x + Math.cos(a) * 620, ey = s.y + Math.sin(a) * 620;
        const lg = bctx.createLinearGradient(s.x, s.y, ex, ey);
        lg.addColorStop(0, 'rgba(94,240,255,.9)');
        lg.addColorStop(1, 'rgba(94,240,255,0)');
        bctx.strokeStyle = lg; bctx.lineWidth = 12;
        bctx.shadowColor = '#5ef0ff'; bctx.shadowBlur = 14;
        bctx.beginPath(); bctx.moveTo(s.x, s.y); bctx.lineTo(ex, ey); bctx.stroke();
        bctx.strokeStyle = 'rgba(255,255,255,.85)'; bctx.lineWidth = 3;
        bctx.shadowBlur = 0;
        bctx.beginPath(); bctx.moveTo(s.x, s.y); bctx.lineTo(ex, ey); bctx.stroke();
      }
      bctx.restore();
    }
  }
}

// ---------------- 战斗绘制 ----------------
function drawBattle() {
  const B = battle;
  const F = fieldRect();
  bctx.clearRect(0, 0, innerWidth, innerHeight);
  bctx.save();
  if (B.shake > 0) bctx.translate(rand(-B.shake, B.shake), rand(-B.shake, B.shake));
  const t = B.time;
  // 场地（径向渐变底）
  const gg = bctx.createRadialGradient(F.x + F.s / 2, F.y + F.s / 2, F.s * .1, F.x + F.s / 2, F.y + F.s / 2, F.s * .62);
  gg.addColorStop(0, 'rgba(8,18,36,.95)');
  gg.addColorStop(1, 'rgba(4,9,20,.95)');
  bctx.fillStyle = gg;
  bctx.fillRect(F.x, F.y, F.s, F.s);
  // 内网格（数据流式平移）
  bctx.strokeStyle = 'rgba(0,229,255,.07)'; bctx.lineWidth = 1;
  const gridOff = (t * 8) % 40;
  bctx.beginPath();
  for (let i = -1; i < F.s / 40 + 1; i++) {
    const px = F.x + i * 40 + gridOff;
    bctx.moveTo(px, F.y); bctx.lineTo(px, F.y + F.s);
    const py = F.y + i * 40 + gridOff;
    bctx.moveTo(F.x, py); bctx.lineTo(F.x + F.s, py);
  }
  bctx.stroke();
  // 中心标记（旋转虚线环 + 脉动环 + 十字）
  const cx = F.x + F.s / 2, cy = F.y + F.s / 2;
  bctx.save();
  bctx.strokeStyle = 'rgba(0,229,255,.28)'; bctx.lineWidth = 1.2;
  bctx.setLineDash([8, 6]); bctx.lineDashOffset = -t * 40;
  bctx.beginPath(); bctx.arc(cx, cy, 30, 0, TAU); bctx.stroke();
  bctx.setLineDash([]);
  bctx.globalAlpha = .2 + .12 * Math.sin(t * 2);
  bctx.beginPath(); bctx.arc(cx, cy, 24 + Math.sin(t * 2) * 4, 0, TAU); bctx.stroke();
  bctx.globalAlpha = .18;
  bctx.beginPath();
  bctx.moveTo(cx - 46, cy); bctx.lineTo(cx + 46, cy);
  bctx.moveTo(cx, cy - 46); bctx.lineTo(cx, cy + 46);
  bctx.stroke();
  bctx.restore();
  // 场地漂浮粒子（氛围）
  if (B.ambient) {
    bctx.save();
    for (const p of B.ambient) {
      bctx.globalAlpha = p.a * (.55 + .45 * Math.sin(t * 2 + p.ph));
      bctx.fillStyle = 'rgba(150,225,255,1)';
      bctx.fillRect(p.x, p.y, p.size, p.size);
    }
    bctx.restore();
  }
  // 边界能量框（双层 + 流动能量线）
  bctx.save();
  bctx.strokeStyle = 'rgba(0,229,255,.85)'; bctx.lineWidth = 2;
  bctx.shadowColor = '#00e5ff'; bctx.shadowBlur = 16;
  bctx.strokeRect(F.x, F.y, F.s, F.s);
  bctx.strokeStyle = 'rgba(140,240,255,.65)'; bctx.lineWidth = 2.5;
  bctx.setLineDash([26, 18]); bctx.lineDashOffset = -t * 90;
  bctx.shadowBlur = 10;
  bctx.strokeRect(F.x, F.y, F.s, F.s);
  bctx.setLineDash([]);
  bctx.restore();
  // 四角能量角标
  const k = 20;
  [[F.x, F.y, 1, 1], [F.x + F.s, F.y, -1, 1], [F.x, F.y + F.s, 1, -1], [F.x + F.s, F.y + F.s, -1, -1]].forEach(([px, py, sx, sy]) => {
    bctx.save();
    bctx.strokeStyle = 'rgba(255,45,120,.9)'; bctx.lineWidth = 3;
    bctx.shadowColor = '#ff2d78'; bctx.shadowBlur = 10;
    bctx.beginPath();
    bctx.moveTo(px + sx * k, py); bctx.lineTo(px, py); bctx.lineTo(px, py + sy * k);
    bctx.stroke();
    bctx.globalAlpha = .5 + .4 * Math.sin(t * 3);
    bctx.fillStyle = '#ff2d78';
    bctx.beginPath(); bctx.arc(px, py, 2.5, 0, TAU); bctx.fill();
    bctx.restore();
  });
  // 场景实体（炮台/传送门/领域/引力阱/锚/斩线/浮游炮）
  drawStructs();
  // 球
  for (const o of B.orbs) if (o.alive) drawOrb(bctx, o, t);
  // 投射物
  for (const p of B.proj) {
    if (p.type === 'phantom') {
      bctx.save();
      bctx.globalAlpha = .55;
      bctx.fillStyle = p.color;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.globalAlpha = .9; bctx.strokeStyle = '#fff'; bctx.lineWidth = 1.2;
      bctx.setLineDash([5, 4]);
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r + 3, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    if (p.type === 'missile') {
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(Math.atan2(p.vy, p.vx));
      bctx.shadowColor = p.color; bctx.shadowBlur = 8;
      bctx.fillStyle = p.color;
      bctx.beginPath(); bctx.moveTo(9, 0); bctx.lineTo(-6, -4.5); bctx.lineTo(-3.5, 0); bctx.lineTo(-6, 4.5); bctx.closePath(); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'bat') { // 追踪蝙蝠
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(Math.atan2(p.vy, p.vx));
      bctx.shadowColor = '#c07aff'; bctx.shadowBlur = 10;
      bctx.fillStyle = '#c07aff';
      bctx.beginPath();
      bctx.moveTo(9, 0);
      bctx.quadraticCurveTo(1, -8, -7, -4);
      bctx.lineTo(-2, 0);
      bctx.lineTo(-7, 4);
      bctx.quadraticCurveTo(1, 8, 9, 0);
      bctx.fill();
      bctx.fillStyle = '#fff';
      bctx.beginPath(); bctx.arc(4, 0, 1.8, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'gravpart') { // 引力井无序粒子（新）
      bctx.save();
      bctx.fillStyle = '#9fd8ff';
      bctx.shadowColor = '#9fd8ff'; bctx.shadowBlur = 8;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'boomerang') { // 回旋镖：旋转镖体（放大 300%）
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(t * 9);
      bctx.scale(p.r / 12, p.r / 12); // 按镖体尺寸缩放
      bctx.fillStyle = '#ffe9a0';
      bctx.shadowColor = '#ffe9a0'; bctx.shadowBlur = 8;
      bctx.beginPath(); bctx.moveTo(10, 0); bctx.lineTo(0, 5); bctx.lineTo(-7, 2); bctx.lineTo(-7, -2); bctx.lineTo(0, -5); bctx.closePath(); bctx.fill();
      bctx.strokeStyle = 'rgba(255,255,255,.7)'; bctx.lineWidth = 1;
      bctx.beginPath(); bctx.arc(0, 0, 7, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    if (p.type === 'sonicpart') { // 音爆声波粒子
      bctx.save();
      bctx.fillStyle = '#bfe9ff';
      bctx.shadowColor = '#bfe9ff'; bctx.shadowBlur = 8;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'fang') { // 兽牙箭矢
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(Math.atan2(p.vy, p.vx));
      bctx.fillStyle = '#ffe9a0';
      bctx.shadowColor = '#ffe9a0'; bctx.shadowBlur = 6;
      bctx.beginPath(); bctx.moveTo(9, 0); bctx.lineTo(-6, -3); bctx.lineTo(-3, 0); bctx.lineTo(-6, 3); bctx.closePath(); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'dronefly') { // 巢穴无人机
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(Math.atan2(p.vy, p.vx));
      bctx.fillStyle = '#9f8fff';
      bctx.shadowColor = '#9f8fff'; bctx.shadowBlur = 8;
      bctx.beginPath(); bctx.moveTo(8, 0); bctx.lineTo(-5, -4); bctx.lineTo(-2, 0); bctx.lineTo(-5, 4); bctx.closePath(); bctx.fill();
      bctx.fillStyle = '#fff';
      bctx.beginPath(); bctx.arc(3, 0, 1.6, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'bullet') { // 快枪手子弹
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(Math.atan2(p.vy, p.vx));
      bctx.fillStyle = '#ffe9a0';
      bctx.shadowColor = '#ffe9a0'; bctx.shadowBlur = 8;
      bctx.beginPath(); bctx.moveTo(10, 0); bctx.lineTo(-6, -3); bctx.lineTo(-3, 0); bctx.lineTo(-6, 3); bctx.closePath(); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'potion') { // 药水瓶
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(p.angle || 0);
      bctx.fillStyle = p.color;
      bctx.beginPath(); bctx.moveTo(-3, -6); bctx.lineTo(3, -6); bctx.lineTo(2, -10); bctx.lineTo(-2, -10); bctx.closePath(); bctx.fill();
      bctx.beginPath(); bctx.arc(0, 2, 7, 0, TAU); bctx.fill();
      bctx.strokeStyle = 'rgba(255,255,255,.6)'; bctx.lineWidth = 1;
      bctx.beginPath(); bctx.arc(0, 2, 7, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    if (p.type === 'ember') { // 灼烧火星
      bctx.save();
      bctx.fillStyle = '#ff8833';
      bctx.shadowColor = '#ff8833'; bctx.shadowBlur = 6;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'turretbolt' || p.type === 'dronebolt') { // 炮台/浮游炮弹
      bctx.save();
      bctx.fillStyle = p.color;
      bctx.shadowColor = p.color; bctx.shadowBlur = 5;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'shard') { // 分裂子球
      bctx.save();
      bctx.globalAlpha = .8;
      bctx.fillStyle = p.color;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.strokeStyle = '#fff'; bctx.lineWidth = 1.2;
      bctx.setLineDash([4, 3]);
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r + 3, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    // —— V4 投射物绘制 ——
    if (p.type === 'tornado') { // 龙卷风：旋转螺旋 + 半透明旋臂
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(p.spin);
      bctx.strokeStyle = 'rgba(207,233,255,.75)'; bctx.lineWidth = 5;
      bctx.shadowColor = '#cfe9ff'; bctx.shadowBlur = 12;
      for (let i = 0; i < 3; i++) {
        bctx.beginPath();
        bctx.arc(0, 0, p.r * (.25 + i * .26), i * 2.1, i * 2.1 + 4.6);
        bctx.stroke();
      }
      bctx.strokeStyle = 'rgba(255,255,255,.5)'; bctx.lineWidth = 1.5;
      bctx.beginPath(); bctx.arc(0, 0, p.r * 1.06, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    if (p.type === 'pebble') { // 龙卷风石子
      bctx.save();
      bctx.fillStyle = p.color;
      bctx.shadowColor = p.color; bctx.shadowBlur = 4;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'venomcloud') { // 剧毒雾团：半透明绿雾
      bctx.save();
      const k = Math.min(1, p.life / .3);
      bctx.fillStyle = 'rgba(159,232,112,.4)';
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r * (1.4 - k * .4), 0, TAU); bctx.fill();
      bctx.fillStyle = 'rgba(232,255,208,.35)';
      bctx.beginPath(); bctx.arc(p.x - p.r * .3, p.y - p.r * .2, p.r * .6, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'starpoint') { // 星轨点：四角星闪烁
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(t * 3);
      bctx.fillStyle = '#ffe9a0';
      bctx.shadowColor = '#ffe9a0'; bctx.shadowBlur = 8;
      bctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        const r1 = i % 2 ? p.r * .4 : p.r;
        bctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r1, Math.sin(a) * r1);
      }
      bctx.closePath(); bctx.fill();
      bctx.restore();
    }
    // —— V5 投射物绘制 ——
    if (p.type === 'clone') { // 替身：半透明分身（虚线环）
      bctx.save();
      bctx.globalAlpha = .45;
      const cg = bctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
      cg.addColorStop(0, p.color || '#ffffff');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      bctx.fillStyle = cg;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.globalAlpha = .9;
      bctx.strokeStyle = '#fff'; bctx.lineWidth = 1.6;
      bctx.setLineDash([7, 5]); bctx.lineDashOffset = -t * 40;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r + 3, 0, TAU); bctx.stroke();
      bctx.setLineDash([]);
      bctx.restore();
    }
    if (p.type === 'sporeseed') { // 孢子种子
      bctx.save();
      bctx.fillStyle = '#c8f090';
      bctx.shadowColor = '#b8e870'; bctx.shadowBlur = 6;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.fillStyle = '#fff';
      bctx.beginPath(); bctx.arc(p.x - 1.5, p.y - 1.5, 1.6, 0, TAU); bctx.fill();
      bctx.restore();
    }
    // —— V6 投射物绘制 ——
    if (p.type === 'wraith') { // 幽灵鬼魂：半透明鬼火
      bctx.save();
      const wk = Math.min(1, p.life / .4);
      const wg = bctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 1.6);
      wg.addColorStop(0, 'rgba(216,232,255,.85)');
      wg.addColorStop(1, 'rgba(216,232,255,0)');
      bctx.fillStyle = wg;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r * 1.6 * wk, 0, TAU); bctx.fill();
      bctx.fillStyle = '#eef6ff';
      bctx.shadowColor = '#d8e8ff'; bctx.shadowBlur = 8;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r * wk, 0, TAU); bctx.fill();
      bctx.fillStyle = '#fff';
      bctx.beginPath(); bctx.arc(p.x - 2, p.y - 2, 2.4 * wk, 0, TAU); bctx.fill();
      bctx.restore();
    }
    // —— V8 投射物绘制 ——
    if (p.type === 'cursenail') { // 诅咒之钉：巨大紫钉（旋转）
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(p.angle || Math.atan2(p.vy, p.vx));
      bctx.shadowColor = '#c07aff'; bctx.shadowBlur = 14;
      bctx.fillStyle = '#d9c0ff';
      bctx.beginPath(); bctx.moveTo(26, 0); bctx.lineTo(-14, -6); bctx.lineTo(-8, 0); bctx.lineTo(-14, 6); bctx.closePath(); bctx.fill();
      bctx.fillStyle = '#f4ecff';
      bctx.beginPath(); bctx.arc(-8, 0, 7, 0, TAU); bctx.fill();
      bctx.strokeStyle = '#c07aff'; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(-8, 0, 7, 0, TAU); bctx.stroke();
      bctx.restore();
    }
    if (p.type === 'laserbolt') { // 激光束
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(Math.atan2(p.vy, p.vx));
      bctx.shadowColor = '#6fe8ff'; bctx.shadowBlur = 10;
      bctx.fillStyle = '#9ff2ff';
      bctx.fillRect(-10, -2, 20, 4);
      bctx.fillStyle = '#ffffff';
      bctx.fillRect(-4, -1, 8, 2);
      bctx.restore();
    }
    if (p.type === 'corrodepart') { // 腐蚀粒子：绿色雾点
      bctx.save();
      bctx.fillStyle = '#b0ff6a';
      bctx.shadowColor = '#b0ff6a'; bctx.shadowBlur = 6;
      bctx.globalAlpha = .8;
      bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, TAU); bctx.fill();
      bctx.fillStyle = 'rgba(220,255,190,.6)';
      bctx.beginPath(); bctx.arc(p.x - p.r * .3, p.y - p.r * .3, p.r * .5, 0, TAU); bctx.fill();
      bctx.restore();
    }
    if (p.type === 'butterfly') { // 黑白蝴蝶：双翼扇动
      bctx.save();
      bctx.translate(p.x, p.y);
      const flap = Math.sin(p.flap || 0);
      bctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
      bctx.fillStyle = p.black ? '#c8c8d8' : '#ffffff';
      bctx.shadowColor = p.black ? '#888' : '#fff'; bctx.shadowBlur = 6;
      for (const s of [-1, 1]) {
        bctx.save();
        bctx.rotate(s * (0.5 + flap * .45));
        bctx.beginPath(); bctx.ellipse(0, -6, 4.5, 7, 0, 0, TAU); bctx.fill();
        bctx.restore();
      }
      bctx.fillStyle = '#404050';
      bctx.beginPath(); bctx.arc(0, 0, 1.8, 0, TAU); bctx.fill();
      bctx.restore();
    }
  }
  // 特效
  for (const f of B.fx) {
    const k2 = 1 - f.life / f.maxLife;
    if (f.type === 'ring') {
      bctx.save();
      bctx.globalAlpha = k2 * .9;
      bctx.strokeStyle = f.color; bctx.lineWidth = f.lw * k2 + .5;
      bctx.beginPath(); bctx.arc(f.x, f.y, f.r, 0, TAU); bctx.stroke();
      bctx.restore();
    } else if (f.type === 'spark') {
      bctx.save();
      bctx.globalAlpha = k2;
      bctx.fillStyle = f.color;
      bctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
      bctx.restore();
    } else if (f.type === 'heat') { // 热浪（上升波纹）
      bctx.save();
      bctx.globalAlpha = k2 * .5;
      bctx.strokeStyle = f.color || '#ff8833';
      bctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        bctx.beginPath();
        for (let x = 0; x <= f.w; x += 4) {
          const y = f.y - (1 - k2) * 46 + Math.sin((x + f.x) / 8 + f.life * 10 + i) * 3;
          x ? bctx.lineTo(f.x + x - f.w / 2, y) : bctx.moveTo(f.x + x - f.w / 2, y);
        }
        bctx.stroke();
      }
      bctx.restore();
    } else if (f.type === 'blade') { // 空间斩光刃
      bctx.save();
      bctx.globalAlpha = k2;
      bctx.strokeStyle = f.color; bctx.lineWidth = 14 * k2 + 3;
      bctx.shadowColor = f.color; bctx.shadowBlur = 18;
      bctx.beginPath(); bctx.moveTo(f.x1, f.y1); bctx.lineTo(f.x2, f.y2); bctx.stroke();
      bctx.restore();
    } else if (f.type === 'text') {
      bctx.save();
      bctx.globalAlpha = k2;
      bctx.font = 'bold ' + (f.size || 15) + 'px Consolas, monospace';
      bctx.textAlign = 'center';
      bctx.strokeStyle = 'rgba(0,0,0,.75)'; bctx.lineWidth = 3.5;
      bctx.strokeText(f.text, f.x, f.y);
      bctx.fillStyle = f.color;
      bctx.fillText(f.text, f.x, f.y);
      bctx.restore();
    }
  }
  bctx.restore();
}
