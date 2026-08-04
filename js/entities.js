// ---------------- 场景实体（新能力系统） ----------------
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function updateStructs(dt) {
  const B = battle, F = fieldRect();
  const L = B.left, R = B.right;
  B.wuliangFuse = false; // 每帧重置：苍赫合成帧级闸（V7 防同帧链式多爆）
  for (const s of B.structs) {
    if (s.dead) continue; // 已标记销毁的实体不再处理（修复苍赫爆炸同帧重复触发）
    if (s.type === 'gravwell') { // 引力阱：中心黑洞，全场强吸扯 + 螺旋吸入粒子 + 无序粒子流伤害
      s.life -= dt;
      s.pulse += dt * 6;
      for (const o of B.orbs) {
        const d = Math.hypot(s.x - o.x, s.y - o.y);
        if (d > 1 && d < F.s * .95) {
          const k = 380 * (1 - d / (F.s * .95)) * dt;
          o.vx += (s.x - o.x) / d * k;
          o.vy += (s.y - o.y) / d * k;
        }
      }
      // 螺旋吸入粒子流：从四周旋入中心
      if (Math.random() < .9) {
        const a = Math.random() * TAU, rr = rand(F.s * .12, F.s * .45);
        const inSp = 320 * (rr / (F.s * .45));
        addFx({ type: 'spark', x: s.x + Math.cos(a) * rr, y: s.y + Math.sin(a) * rr,
          vx: -Math.cos(a) * inSp + Math.cos(a + Math.PI / 2) * inSp * .55,
          vy: -Math.sin(a) * inSp + Math.sin(a + Math.PI / 2) * inSp * .55,
          life: 0, maxLife: .5, size: 2.2, color: '#9fd8ff' });
      }
      // 新：无序粒子流（高能碎片向四周散射，命中造成伤害）
      if (Math.random() < .55) {
        const a = Math.random() * TAU, sp = rand(430, 780);
        B.proj.push({ type: 'gravpart', owner: s.owner, x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .55, r: 3, color: '#9fd8ff' });
      }
    }
    if (s.type === 'portal') { // 传送门（我方进 +10 血 + 跃迁 2s 无敌；敌方进 -20 血）
      for (const o of B.orbs) {
        if (o.portalCd > 0) continue;
        const d = Math.hypot(s.x - o.x, s.y - o.y);
        if (d < o.r + 24) {
          o.x = s.pair.x; o.y = s.pair.y;
          o.portalCd = 0.6;
          if (o.side === s.owner) { // 我方进入：+10 血，跃迁后 2s 无敌
            o.hp = Math.min(o.maxHp, o.hp + 10 * BALANCE.global.healMult * o.stats.healMult);
            o.invT = 2;
            addText(o.x, o.y - 40, '+10 跃迁无敌', '#3dff9e', 13);
          } else if (o.invT <= 0) { // 敌方进入：-20 血（无敌期不受传送门伤害）；按传送门所有者技能倍率
            o.hp -= 20 * srcDmgMult(ownerOf(s.owner)); // 敌方进入 -20（无敌期不受传送门伤害）
            addText(o.x, o.y - 40, '-20', '#ff5566', 16);
          }
          addRing(s.x, s.y, 40, '#8df6ff', 2);
          addRing(s.pair.x, s.pair.y, 40, '#8df6ff', 2);
          addSparks(s.x, s.y, 8, '#8df6ff');
          addSparks(s.pair.x, s.pair.y, 8, '#8df6ff');
          sfx('phantom');
        }
      }
    }
    if (s.type === 'zone') { // 领域 / 药水圈
      s.life -= dt;
      const owner = ownerOf(s.owner);
      const foe = nearestFoe(ownerOf(s.owner));
      const inR = (o) => o.alive && Math.hypot(o.x - s.x, o.y - s.y) < s.r;
      if (s.kind === 'heal' && inR(owner)) owner.hp = Math.min(owner.maxHp, owner.hp + 2.6 * dt * BALANCE.global.healMult * owner.stats.healMult); // 新：2→2.6（+30%）
      if (s.kind === 'slow' && inR(foe)) { foe.slowT = Math.max(foe.slowT, .3); foe.slowPct = .52; } // 新：40%→52%（+30%）
      if (s.kind === 'vamp') {
        if (inR(owner)) owner.hp = Math.min(owner.maxHp, owner.hp + 3 * dt * BALANCE.global.healMult * owner.stats.healMult);
        if (inR(foe)) { foe.slowT = Math.max(foe.slowT, .3); foe.slowPct = .3; }
      }
      if (s.kind === 'idol') { // 偶像领域：此消彼长（恢复已减半）
        if (inR(owner)) owner.hp = Math.min(owner.maxHp, owner.hp + 4 * dt * BALANCE.global.healMult * owner.stats.healMult); // 新：8→4 减半
        if (inR(foe) && foe.invT <= 0) {
          const dmg = (6 + (1 - foe.hp / foe.maxHp) * 6) * dt * srcDmgMult(owner); // 按领域所有者倍率
          foe.hp -= dmg;
          if (Math.random() < .4) addFx({ type: 'spark', x: foe.x + rand(-20, 20), y: foe.y + rand(-20, 20), vx: rand(-30, 30), vy: rand(-70, -20), life: 0, maxLife: .5, size: 2, color: '#ffd0ff' });
        }
      }
      if (s.kind === 'idolburst' && inR(foe) && foe.invT <= 0) { // 领域爆发（持续伤害，按所有者倍率）
        const dmg = 6 * dt * srcDmgMult(owner);
        foe.hp -= dmg;
        if (Math.random() < .5) addFx({ type: 'spark', x: foe.x + rand(-20, 20), y: foe.y + rand(-20, 20), vx: rand(-30, 30), vy: rand(-70, -20), life: 0, maxLife: .5, size: 2, color: '#ffd0ff' });
      }
      if (s.kind === 'boom' && s.dmg > 0 && inR(foe)) { // 伤害药水爆炸（一次结算）
        hitOrb(foe, s.dmg, owner, true);
        s.dmg = 0;
      }
      if (s.kind === 'pois' && inR(foe) && foe.invT <= 0) { // 持续毒区（+30%，按所有者倍率）
        foe.hp -= 13 * dt * srcDmgMult(owner); // 新：10→13（+30%）
        if (Math.random() < .4) addFx({ type: 'spark', x: foe.x + rand(-16, 16), y: foe.y + rand(-16, 16), vx: rand(-20, 20), vy: rand(-40, -10), life: 0, maxLife: .4, size: 2, color: '#ff8899' });
      }
      if (s.kind === 'trap' && inR(foe) && foe.invT <= 0) { // 回声陷阱：伤害 + 减速（按所有者倍率）
        foe.hp -= 14 * dt * srcDmgMult(owner);
        foe.slowT = Math.max(foe.slowT, .3); foe.slowPct = .45;
        if (Math.random() < .5) addFx({ type: 'spark', x: foe.x + rand(-24, 24), y: foe.y + rand(-24, 24), vx: rand(-30, 30), vy: rand(-50, -10), life: 0, maxLife: .5, size: 2.4, color: '#b06aff' });
      }
    }
    if (s.type === 'railstorm') { // 轨道炮-柱雨：3s 内 50 道斜向细柱，间隔 0.05s，随机角度
      s.life -= dt;
      s.fireT -= dt;
      if (s.fireT <= 0 && s.count < 50) {
        s.fireT = .05;
        s.count++;
        const ang = rand(-1.1, 1.1); // 随机角度（偏离垂直）
        const len = F.s * 1.5;
        const cx = F.x + 30 + Math.random() * (F.s - 60);
        const x1 = cx - Math.sin(ang) * len / 2, y1 = F.y + F.s / 2 - Math.cos(ang) * len / 2;
        const x2 = cx + Math.sin(ang) * len / 2, y2 = F.y + F.s / 2 + Math.cos(ang) * len / 2;
        const owner2 = ownerOf(s.owner);
        const foe2 = nearestFoe(ownerOf(s.owner));
        addFx({ type: 'blade', x1, y1, x2, y2, life: 0, maxLife: .15, color: '#ffe9a0' });
        if (foe2.alive && distToSeg(foe2.x, foe2.y, x1, y1, x2, y2) < foe2.r + 16) { // 宽度增加
          hitOrb(foe2, 3, owner2, true); // 伤害 -50%（6→3）
          addSparks(foe2.x, foe2.y, 5, '#ffe9a0');
        }
      }
    }
    if (s.type === 'railcircle') { // 轨道炮-圆击：蓄力 1s 瞬发 120 实伤
      s.delay -= dt;
      if (s.delay <= 0) {
        const owner2 = ownerOf(s.owner);
        const foe2 = nearestFoe(ownerOf(s.owner));
        if (foe2.alive && Math.hypot(foe2.x - s.x, foe2.y - s.y) < s.r) {
          hitOrb(foe2, 40, owner2, true); // 伤害 -50%（80→40，实伤 60）
          addText(foe2.x, foe2.y - 44, '60', '#ffd0ff', 20);
        }
        addFx({ type: 'ring', x: s.x, y: s.y, r: 20, vr: 520, maxLife: .5, life: 0, color: '#ffd0ff', lw: 4 });
        for (let i = 0; i < 24; i++) {
          const a = Math.random() * TAU, sp = rand(80, 320);
          addFx({ type: 'spark', x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: .6, size: 3, color: '#ffd0ff' });
        }
        battle.shake = Math.min(16, battle.shake + 8);
        s.dead = true;
        sfx('boom');
      }
    }
    if (s.type === 'nest') { // 无人机巢：40 血，每 1.5s 放自爆无人机；可被敌方接触拆毁
      const foe2 = nearestFoe(ownerOf(s.owner));
      s.fireT -= dt;
      if (s.fireT <= 0) {
        s.fireT = 1.5;
        if (foe2.alive) {
          B.proj.push({ type: 'dronefly', owner: s.owner, x: s.x, y: s.y, vx: 0, vy: 0, life: 6, r: 8, turn: 4 });
          addRing(s.x, s.y, 30, '#9f8fff', 1.5);
        }
      }
      if (foe2.alive && Math.hypot(foe2.x - s.x, foe2.y - s.y) < foe2.r + 24) { // 接触拆毁
        s.hpT = (s.hpT || 0) - dt;
        if (s.hpT <= 0) {
          s.hpT = .25;
          s.hp -= 5;
          addSparks(s.x, s.y, 3, '#9f8fff');
        }
      }
      if (s.hp <= 0) {
        s.dead = true;
        addFx({ type: 'ring', x: s.x, y: s.y, r: 20, vr: 400, maxLife: .5, life: 0, color: '#9f8fff', lw: 3 });
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * TAU, sp = rand(60, 260);
          addFx({ type: 'spark', x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: .5, size: 2.6, color: '#9f8fff' });
        }
        sfx('boom');
      }
    }
    if (s.type === 'echo') { // 回声：3s 后回溯位置与血量，并在原地留下大范围陷阱
      s.life -= dt;
      if (s.life <= 0) {
        const owner2 = ownerOf(s.owner);
        if (owner2.alive) {
          owner2.x = Math.max(F.x + owner2.r, Math.min(F.x + F.s - owner2.r, s.x));
          owner2.y = Math.max(F.y + owner2.r, Math.min(F.y + F.s - owner2.r, s.y));
          owner2.hp = Math.max(owner2.hp, Math.min(owner2.maxHp, s.hp)); // 恢复到记录时血量
          addRing(owner2.x, owner2.y, 60, '#8fd8ff', 2.5);
          addSparks(owner2.x, owner2.y, 10, '#8fd8ff');
          addText(owner2.x, owner2.y - 40, '回溯', '#8fd8ff', 15);
          sfx('phantom');
        }
        // 原地留下大范围陷阱（伤害 + 减速）
        B.structs.push({ type: 'zone', kind: 'trap', owner: s.owner, x: s.x, y: s.y, r: 280, life: 4 });
        addRing(s.x, s.y, 280, '#b06aff', 2.5);
        addFx({ type: 'ring', x: s.x, y: s.y, r: 20, vr: 480, maxLife: .5, life: 0, color: '#b06aff', lw: 3 });
        s.dead = true;
      }
    }
    if (s.type === 'arcwall') { // 弧形护盾墙：反弹球 + 拦截敌方投射物
      s.life -= dt;
      const span = s.a1 - s.a0;
      const inArc = ang => {
        let da = ang - s.a0;
        while (da < 0) da += TAU;
        return da < span;
      };
      for (const o of B.orbs) {
        const dx = o.x - s.x, dy = o.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 1) continue;
        const ang = Math.atan2(dy, dx);
        if (Math.abs(d - s.R) < o.r + 14 && inArc(ang)) {
          const nx = dx / d, ny = dy / d;
          const dot = o.vx * nx + o.vy * ny;
          if (dot < 0) { // 朝墙运动 → 反弹；敌方撞墙额外受 120% 近战伤害（墙主不受）
            o.vx -= 2 * dot * nx; o.vy -= 2 * dot * ny;
            o.x = s.x + nx * (s.R + o.r + 2); o.y = s.y + ny * (s.R + o.r + 2);
            addSparks(o.x, o.y, 6, '#9fd8ff');
            const owner2 = ownerOf(s.owner);
            if (o !== owner2) { // 只有敌人撞墙才反伤
              s.hitT = (s.hitT || 0) - dt;
              if (s.hitT <= 0) {
                s.hitT = .5;
                hitOrb(o, 14, owner2, true, true); // 120% 近战（近战基础 12 ×1.2 → ×1.5 全局 = 21.6 实伤）
                addText(o.x, o.y - 34, '撞墙反伤', '#ff8090', 13);
              }
            }
          }
        }
      }
      for (const p of B.proj) { // 拦截敌方投射物（音波环不拦）
        if (p.owner === s.owner || p.type === 'sonicpart') continue; // 音爆粒子穿透
        const dx = p.x - s.x, dy = p.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d > 1 && Math.abs(d - s.R) < p.r + 16) {
          const ang = Math.atan2(dy, dx);
          if (inArc(ang)) { p.life = 0; addSparks(p.x, p.y, 4, '#9fd8ff'); }
        }
      }
    }
    if (s.type === 'turret') { // 炮台
      s.life -= dt;
      s.fireT -= dt;
      const foe = nearestFoe(ownerOf(s.owner));
      if (s.fireT <= 0 && foe.alive) {
        s.fireT = 1.2;
        const a = Math.atan2(foe.y - s.y, foe.x - s.x);
        B.proj.push({ type: 'turretbolt', owner: s.owner, x: s.x, y: s.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, life: 4, color: '#ffd050', r: 5 });
        addSparks(s.x, s.y, 3, '#ffd050');
        sfx('missile');
      }
    }
    if (s.type === 'beam') { // 浮游炮激光柱：持续粗光束（跟随敌人）
      s.life -= dt;
      const owner = ownerOf(s.owner);
      const foe = nearestFoe(ownerOf(s.owner));
      const a = Math.atan2(foe.y - owner.y, foe.x - owner.x);
      s.x1 = owner.x + Math.cos(a) * 70; s.y1 = owner.y + Math.sin(a) * 70;
      s.x2 = owner.x + Math.cos(a) * 580; s.y2 = owner.y + Math.sin(a) * 580;
      s.hitT -= dt;
      if (foe.alive && distToSeg(foe.x, foe.y, s.x1, s.y1, s.x2, s.y2) < foe.r + 16 && s.hitT <= 0) {
        s.hitT = .15;
        hitOrb(foe, 5, owner, true); // 约 33/s 持续伤害
        addSparks(foe.x, foe.y, 5, '#9ff');
      }
      if (Math.random() < .8) {
        const k = rand(.1, .9);
        addFx({ type: 'spark', x: s.x1 + (s.x2 - s.x1) * k + rand(-6, 6), y: s.y1 + (s.y2 - s.y1) * k + rand(-6, 6), vx: rand(-15, 15), vy: rand(-15, 15), life: 0, maxLife: .3, size: 3, color: '#9ff' });
      }
    }
    if (s.type === 'cable') { // 切割电缆：接触持续伤害（按所有者技能倍率）
      const foe = nearestFoe(ownerOf(s.owner));
      if (foe.alive && foe.invT <= 0 && distToSeg(foe.x, foe.y, s.x1, s.y1, s.x2, s.y2) < foe.r + 10) {
        foe.hp -= 15 * dt * srcDmgMult(ownerOf(s.owner)); // 切割电缆：接触持续伤害
        if (Math.random() < .6) addFx({ type: 'spark', x: foe.x + rand(-16, 16), y: foe.y + rand(-16, 16), vx: rand(-20, 20), vy: rand(-40, -10), life: 0, maxLife: .4, size: 2, color: '#b0c4ff' });
      }
    }
    if (s.type === 'slash') { // 空间斩：预告 → 瞬发（只伤敌人，不伤自己）
      s.delay -= dt;
      s.pulse += dt * 10;
      if (s.delay <= 0) {
        const foe = nearestFoe(ownerOf(s.owner));
        if (foe.alive) {
          for (const ln of s.lines) {
            if (distToSeg(foe.x, foe.y, ln[0], ln[1], ln[2], ln[3]) < foe.r + 30) {
              hitOrb(foe, 18, ownerOf(s.owner), true);
              break;
            }
          }
        }
        if (!battle.over) { // 结算已发生则不再播特效
          for (const ln of s.lines) {
            addFx({ type: 'blade', x1: ln[0], y1: ln[1], x2: ln[2], y2: ln[3], life: 0, maxLife: .35, color: '#ffffff' });
            addSparks((ln[0] + ln[2]) / 2, (ln[1] + ln[3]) / 2, 12, '#b8e8ff');
          }
          battle.shake = Math.min(18, battle.shake + 8);
          sfx('boom');
        }
        s.dead = true;
      }
    }
    if (s.type === 'drone') { // 浮游炮
      const owner = ownerOf(s.owner);
      const foe = nearestFoe(ownerOf(s.owner));
      s.angle += 1.6 * dt;
      s.fireT -= dt;
      s.x = owner.x + Math.cos(s.angle + s.phase) * 72;
      s.y = owner.y + Math.sin(s.angle + s.phase) * 72;
      if (s.fireT <= 0 && foe.alive) {
        s.fireT = .6;
        const a = Math.atan2(foe.y - s.y, foe.x - s.x);
        B.proj.push({ type: 'dronebolt', owner: s.owner, x: s.x, y: s.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, life: 3, color: '#9ff', r: 4 });
      }
    }
    if (s.type === 'wuliangball') { // 苍/赫球：直线飞行+反弹+持续力场+双球相撞爆炸
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < F.x + s.r || s.x > F.x + F.s - s.r) s.vx = -s.vx;
      if (s.y < F.y + s.r || s.y > F.y + F.s - s.r) s.vy = -s.vy;
      const owner = ownerOf(s.owner);
      const foe = nearestFoe(ownerOf(s.owner));
      if (foe.alive) {
        const d = Math.hypot(foe.x - s.x, foe.y - s.y);
        if (d > 1 && d < 250) { // 持续力场：苍吸 赫斥（力度已增强）
          const dir = s.kind === 'cang' ? 1 : -1;
          const k = 260 * dt * (1 - d / 250); // 新：170→260
          foe.vx += (s.x - foe.x) / d * k * dir;
          foe.vy += (s.y - foe.y) / d * k * dir;
          // 新：力场范围内持续伤害
          s.dotT = (s.dotT || 0) - dt;
          if (s.dotT <= 0) {
            s.dotT = .5;
            hitOrb(foe, 2, owner, true);
            addSparks(foe.x, foe.y, 3, s.kind === 'cang' ? '#9fd8ff' : '#ffb06a');
          }
        }
        s.hitT -= dt;
        if (d < foe.r + s.r && s.hitT <= 0) { // 碰撞伤害（已增强）
          s.hitT = 1;
          hitOrb(foe, 14, owner, true); // 新：10→14
          addSparks(s.x, s.y, 6, s.kind === 'cang' ? '#9fd8ff' : '#ffb06a');
        }
      }
      // 苍赫合体（V7）：距离 150 内互相吸引，100 内直接合成（无需碰撞）
      const mate = B.structs.find(o2 => o2.type === 'wuliangball' && o2 !== s && !o2.dead && o2.kind !== s.kind);
      if (mate) {
        const dM = Math.hypot(mate.x - s.x, mate.y - s.y);
        if (dM > 1 && dM < 150) { // 互相吸引（每球各被拉一次：本球遍历时只对本球施力，mate 遍历时对 mate 施力，合力对称无双计）
          const kM = 260 * dt * (1 - dM / 150);
          s.vx += (mate.x - s.x) / dM * kM; s.vy += (mate.y - s.y) / dM * kM;
        }
        if (dM < 100 && !B.wuliangFuse) { // 直接合成（帧级闸：同帧只允许一次合成，防链式多爆）
        B.wuliangFuse = true;
        const bx = (mate.x + s.x) / 2, by = (mate.y + s.y) / 2;
        addFx({ type: 'ring', x: bx, y: by, r: 20, vr: 720, maxLife: .6, life: 0, color: '#ffffff', lw: 5 });
        addFx({ type: 'ring', x: bx, y: by, r: 10, vr: 520, maxLife: .7, life: 0, color: '#ffd050', lw: 3 });
        for (let i = 0; i < 50; i++) {
          const a = Math.random() * TAU, sp = rand(100, 520);
          addFx({ type: 'spark', x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: rand(.4, 1), size: rand(2, 4.5), color: Math.random() < .5 ? '#ffffff' : '#ffd050' });
        }
        // 爆炸伤害：对方在范围内必受伤；跨方合成时自己也会被波及（伤害已增强）
        if (foe.alive && Math.hypot(foe.x - bx, foe.y - by) < 430) hitOrb(foe, 42, owner, true); // 新：35→42
        if (mate.owner !== s.owner && owner.alive && Math.hypot(owner.x - bx, owner.y - by) < 430) hitOrb(owner, 42, foe, true);
        s.dead = true; mate.dead = true;
        if (!battle.over) { // 爆炸已致胜（对手死亡）则不再生成芘球
          // 合成"芘"：双色融合太极球，5s 内强力吸扯对方；跨方合成时归属距爆炸点更近的一方（3/4 球比较全部存活球），同方合成归释放方
          const ownSide = mate.owner !== s.owner
            ? (B.orbs.reduce((best, o2) => (!o2.alive) ? best : (!best || Math.hypot(o2.x - bx, o2.y - by) < Math.hypot(best.x - bx, best.y - by)) ? o2 : best, null)).side
            : s.owner;
          B.structs.push({ type: 'wulianbi', owner: ownSide, x: bx, y: by, vx: rand(-90, 90), vy: rand(-90, 90), life: 5, r: 30, hitT: 0 });
        }
        battle.shake = 20;
        sfx('boom');
        }
      }
    }
    if (s.type === 'wulianbi') { // 芘：融合太极球，强力吸扯 + 碰撞伤害
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < F.x + s.r || s.x > F.x + F.s - s.r) s.vx = -s.vx;
      if (s.y < F.y + s.r || s.y > F.y + F.s - s.r) s.vy = -s.vy;
      const owner = ownerOf(s.owner);
      const foe = nearestFoe(ownerOf(s.owner));
      if (foe.alive) {
        const d = Math.hypot(foe.x - s.x, foe.y - s.y);
        if (d > 1 && d < 320) { // 强力吸扯（已增强）
          const k = 360 * dt * (1 - d / 320); // 新：300→360
          foe.vx += (s.x - foe.x) / d * k;
          foe.vy += (s.y - foe.y) / d * k;
        }
        s.hitT -= dt;
        if (d < foe.r + s.r && s.hitT <= 0) {
          s.hitT = .8;
          hitOrb(foe, 15, owner, true); // 新：12→15
          addSparks(s.x, s.y, 8, '#ffffff');
        }
      }
    }
    // —— V4 结构体 ——
    if (s.type === 'web') { // 蛛网：敌方入网减速 + 网缚（反弹减半）+ 75% 易伤
      s.life -= dt;
      const foe = nearestFoe(ownerOf(s.owner));
      if (foe.alive && foe.invT <= 0 && Math.hypot(foe.x - s.x, foe.y - s.y) < foe.r + s.r) {
        s.hitT -= dt;
        if (s.hitT <= 0) {
          s.hitT = .8;
          foe.slowT = Math.max(foe.slowT, 1.2); foe.slowPct = .45;
          foe.webT = 3;
          foe.webVulnT = 2; // 网中易伤 +75%（强化）
          addText(foe.x, foe.y - 40, '缠网·易伤', '#e8f4ff', 13);
          addSparks(foe.x, foe.y, 6, '#e8f4ff');
        }
      }
    }
    if (s.type === 'lavaburst') { // 火山熔岩：扇形曲线延伸，命中减速 + 持续伤害
      s.life -= dt;
      const owner = ownerOf(s.owner);
      const foe = nearestFoe(ownerOf(s.owner));
      for (const seg of s.segs) {
        if (seg.len < s.maxLen) { // 曲线延伸（正弦摆动）
          const sp = 240;
          seg.dir += Math.sin(s.life * 6 + seg.phase) * .9 * dt;
          const last = seg.pts[seg.pts.length - 1];
          const nx = last.x + Math.cos(seg.dir) * sp * dt;
          const ny = last.y + Math.sin(seg.dir) * sp * dt;
          seg.pts.push({ x: nx, y: ny });
          seg.len += sp * dt;
          if (Math.random() < .6) addFx({ type: 'spark', x: nx, y: ny, vx: rand(-20, 20), vy: rand(-30, -10), life: 0, maxLife: .5, size: 2.2, color: '#ff8833' });
        }
        if (foe.alive && foe.invT <= 0 && seg.pts.length >= 2) { // 全段判定（性能无虞，<600 次/帧）
          for (let i = seg.pts.length - 1; i >= 1; i--) {
            const a = seg.pts[i - 1], b = seg.pts[i];
            if (distToSeg(foe.x, foe.y, a.x, a.y, b.x, b.y) < foe.r + 16) {
              s.hitT -= dt;
              if (s.hitT <= 0) {
                s.hitT = .35;
                hitOrb(foe, 4, owner, true);
                foe.slowT = Math.max(foe.slowT, .6); foe.slowPct = .4;
                addSparks(foe.x, foe.y, 4, '#ff8833');
                addText(foe.x, foe.y - 40, '熔岩灼烧', '#ff8833', 12);
              }
              break;
            }
          }
        }
      }
    }
    // —— V5 结构体 ——
    if (s.type === 'tsunami') { // 海啸：波浪条带推进，命中强推位移
      s.life -= dt;
      s.len += s.sp * dt;
      const cx = s.x + Math.cos(s.a) * s.len, cy = s.y + Math.sin(s.a) * s.len;
      if (Math.random() < .8) { // 波浪粒子
        const px = cx + Math.cos(s.a + Math.PI / 2) * rand(-60, 60);
        const py = cy + Math.sin(s.a + Math.PI / 2) * rand(-60, 60);
        addFx({ type: 'spark', x: px, y: py, vx: Math.cos(s.a) * 40 + rand(-20, 20), vy: Math.sin(s.a) * 40 + rand(-20, 20), life: 0, maxLife: .45, size: 3, color: '#9fe8ff' });
      }
      const foe = nearestFoe(ownerOf(s.owner));
      if (foe.alive && foe.invT <= 0 && distToSeg(foe.x, foe.y, s.x, s.y, cx, cy) < foe.r + 190) { // 判定与加宽条带（±185）匹配
        s.hitT -= dt;
        if (s.hitT <= 0) {
          s.hitT = .4; // 命中频率翻倍
          hitOrb(foe, 4, ownerOf(s.owner), true); // 伤害 8→4
          foe.vx += Math.cos(s.a) * 420; foe.vy += Math.sin(s.a) * 420; // 沿波浪方向强推
          addText(foe.x, foe.y - 40, '海啸', '#9fe8ff', 15);
          addSparks(foe.x, foe.y, 8, '#9fe8ff');
          sfx('tsunami');
        }
      }
      if (s.len >= s.maxLen) s.dead = true;
    }
    if (s.type === 'mushroom') { // 毒蘑菇：2s 生长后持续毒域（减速+毒伤）
      s.life -= dt;
      s.growT -= dt;
      const foe = nearestFoe(ownerOf(s.owner));
      if (Math.random() < .35) addFx({ type: 'spark', x: s.x + rand(-20, 20), y: s.y + rand(-20, 20), vx: rand(-12, 12), vy: rand(-24, -6), life: 0, maxLife: .5, size: 2, color: s.growT > 0 ? '#8a9a6a' : '#b8e870' });
      if (s.growT <= 0 && foe.alive && foe.invT <= 0 && Math.hypot(foe.x - s.x, foe.y - s.y) < foe.r + 87) { // 毒域 +50%（58→87）
        s.hitT -= dt;
        if (s.hitT <= 0) {
          s.hitT = .5;
          foe.hp -= 2.5 * srcDmgMult(ownerOf(s.owner)); // 毒蘑菇直接毒伤
          foe.slowT = Math.max(foe.slowT, .3); foe.slowPct = .3;
          addText(foe.x, foe.y - 40, '毒菇', '#b8e870', 12);
          addSparks(foe.x, foe.y, 3, '#b8e870');
        }
      }
    }
    // —— V8 结构体 ——
    if (s.type === 'cursefire') { // 诅咒火焰圈：逐渐变大，范围内持续伤害
      s.life -= dt;
      s.r += 46 * dt;
      const owner = ownerOf(s.owner);
      for (const o of B.orbs) {
        if (o === owner || !o.alive || o.invT > 0) continue;
        if (Math.hypot(o.x - s.x, o.y - s.y) < o.r + s.r) {
          s.hitT -= dt;
          if (s.hitT <= 0) {
            s.hitT = .3;
            hitOrb(o, 6, owner, true);
            addSparks(o.x, o.y, 4, '#c07aff');
          }
        }
      }
    }
    if (s.type === 'laserturret') { // 激光发射器：独立发射 cd
      s.life -= dt;
      s.fireT -= dt;
      if (s.fireT <= 0) {
        s.fireT = s.cd;
        const foe = nearestFoe(ownerOf(s.owner));
        if (foe && foe.alive) {
          const a = Math.atan2(foe.y - s.y, foe.x - s.x);
          B.proj.push({ type: 'laserbolt', owner: s.owner, x: s.x, y: s.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: .9, r: 4, dmg: s.dmg });
          addSparks(s.x, s.y, 2, '#6fe8ff');
          if (Math.random() < .3) sfx('tech1');
        }
      }
    }
    if (s.type === 'lightning') { // 电线杆落雷：无前摇瞬发（伤害 + 定身 + 易伤）
      s.delay -= dt;
      if (s.delay <= 0) {
        const owner = ownerOf(s.owner);
        addFx({ type: 'ring', x: s.x, y: s.y, r: 14, vr: 560, maxLife: .45, life: 0, color: '#ffd050', lw: 4 });
        addFx({ type: 'blade', x1: s.x, y1: s.y - 220, x2: s.x, y2: s.y + 220, life: 0, maxLife: .18, color: '#fff6c0' });
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * TAU, sp = rand(80, 380);
          addFx({ type: 'spark', x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: .5, size: 3, color: '#ffd050' });
        }
        battle.shake = Math.min(14, battle.shake + 6);
        sfx('pylon');
        for (const o of B.orbs) {
          if (o === owner || !o.alive || o.invT > 0) continue;
          if (Math.hypot(o.x - s.x, o.y - s.y) < o.r + s.r) {
            hitOrb(o, 14, owner, true);
            o.stunT = Math.max(o.stunT, 1.1); // 定身
            o.vulnT = Math.max(o.vulnT, 3); // 易伤 +50%
            addText(o.x, o.y - 40, '⚡ 定身·易伤', '#ffd050', 14);
            addSparks(o.x, o.y, 8, '#ffd050');
          }
        }
        s.dead = true;
      }
    }
    if (s.type === 'coffinzone') { // 棺椁封锁区（永久存在，棺椁死亡后清除）：禁止敌人进入（接触反弹 + 小伤）
      const owner = ownerOf(s.owner);
      if (!owner || !owner.alive) { s.dead = true; continue; } // 人死灯灭：出局后封锁区消散
      for (const o of B.orbs) {
        if (o.side === s.owner || !o.alive || o.invT > 0) continue;
        if (o.x > s.x && o.x < s.x + s.w && o.y > s.y && o.y < s.y + s.h) {
          const dx = o.x - (s.x + s.w / 2), dy = o.y - (s.y + s.h / 2);
          const d = Math.hypot(dx, dy) || 1;
          const nx = dx / d, ny = dy / d;
          o.x += nx * 16; o.y += ny * 16;
          const dot = o.vx * nx + o.vy * ny;
          if (dot < 0) { o.vx -= 2 * dot * nx; o.vy -= 2 * dot * ny; }
          addSparks(o.x, o.y, 3, '#9a9ab0');
          s.hitT -= dt;
          if (s.hitT <= 0) { s.hitT = .5; hitOrb(o, 4, owner, true); }
        }
      }
    }
    if (s.type === 'laserring') { // 科技X：6 圈激光保护，越靠内伤害越高
      const owner = ownerOf(s.owner);
      if (!owner || !owner.alive) { s.dead = true; continue; }
      s.x = owner.x; s.y = owner.y;
      for (const o of B.orbs) {
        if (o === owner || !o.alive || o.invT > 0) continue;
        const d = Math.hypot(o.x - s.x, o.y - s.y);
        if (d < o.r + 78) { // 贴身内圈
          s.hitT[6] -= dt;
          if (s.hitT[6] <= 0) { s.hitT[6] = .6; hitOrb(o, 18, owner, true); addSparks(o.x, o.y, 6, '#5ef0ff'); }
          continue;
        }
        for (let k = 0; k < 6; k++) {
          const rr = 78 + k * 58;
          if (Math.abs(d - rr) < 26) {
            s.hitT[k] -= dt;
            if (s.hitT[k] <= 0) {
              s.hitT[k] = .5;
              hitOrb(o, 15 - k * 2, owner, true); // 内圈 15 伤 → 外圈 5 伤
              addSparks(o.x, o.y, 5, '#5ef0ff');
            }
            break;
          }
        }
      }
    }
    if (s.type === 'laserbeams') { // 科技X（半血后）：以自身为中心 6 条旋转激光柱
      const owner = ownerOf(s.owner);
      if (!owner || !owner.alive) { s.dead = true; continue; }
      s.x = owner.x; s.y = owner.y;
      for (let i = 0; i < 6; i++) {
        const a = s.rot + i * TAU / 6;
        const ex = s.x + Math.cos(a) * 620, ey = s.y + Math.sin(a) * 620;
        for (const o of B.orbs) {
          if (o === owner || !o.alive || o.invT > 0) continue;
          if (distToSeg(o.x, o.y, s.x, s.y, ex, ey) < o.r + 16) {
            s.hitT[i] -= dt;
            if (s.hitT[i] <= 0) {
              s.hitT[i] = .4;
              hitOrb(o, 8, owner, true);
              addSparks(o.x, o.y, 5, '#5ef0ff');
            }
            break;
          }
        }
      }
      if (Math.random() < .6) { // 光柱流动粒子
        const i = Math.floor(Math.random() * 6);
        const a = s.rot + i * TAU / 6;
        const k = rand(.1, .95);
        addFx({ type: 'spark', x: s.x + Math.cos(a) * 620 * k, y: s.y + Math.sin(a) * 620 * k, vx: rand(-8, 8), vy: rand(-8, 8), life: 0, maxLife: .25, size: 2.4, color: '#5ef0ff' });
      }
    }
  }
  B.structs = B.structs.filter(s => !s.dead && (s.life === undefined || s.life > 0));
}

// 替身受损：3 点耐久，每次碰撞/挡弹扣 1，耐久归零才消失（V7，顶层函数供测试注入调用）
function damageClone(c, p) {
  if (c.durability > 1) {
    c.durability--;
    addText(c.x, c.y - 30, '替身耐久 ' + c.durability + '/3', '#ffffff', 12);
    addSparks(c.x, c.y, 4, '#ffffff');
    sfx('shieldBrk');
  } else {
    c.life = 0;
    addRing(c.x, c.y, 50, '#ffffff', 2.5);
    addSparks(c.x, c.y, 12, '#ffffff');
    addText(c.x, c.y - 30, '替身击破', '#ffffff', 13);
    sfx('shieldBrk');
  }
  if (p) p.life = 0; // 撞击来源（追踪弹）消失
}
