// ---------------- HUD ----------------
function statusOf(o) {
  const s = [];
  if (battle.vamp && battle.vamp.t > 0 && (battle.vamp.src === o || battle.vamp.foe === o)) s.push('🩸 吸身');
  if (o.ability === 'vampire' && o.hp / o.maxHp < .5) s.push('🦇 蝙蝠 ' + (o.batT > 0 ? o.batT.toFixed(1) : '待命'));
  if (o.burnT > 0) s.push('🔥 ' + o.burnT.toFixed(1) + 's');
  if (o.slowT > 0) s.push('❄ ' + o.slowT.toFixed(1) + 's');
  if (o.venomN > 0) s.push('☣ 毒×' + o.venomN + ' ' + Math.ceil(o.venomT) + 's');
  if (o.ghostT > 0) s.push('👻 隐身 ' + o.ghostT.toFixed(1) + 's');
  if (o.webT > 0) s.push('⌘ 网缚');
  if (o.webVulnT > 0) s.push('💢 易伤 ' + o.webVulnT.toFixed(1) + 's');
  if (o.stunT > 0) s.push('♨ 喷发中');
  if (o.ability === 'evolve') s.push('🧬 Lv.' + (o.evolveLv || 0) + ' 经验' + (o.evolveX || 0) + '/3' + (o.evolveBoost > 0 ? '⚡' : ''));
  if (o.lanceT > 0) s.push('↯ 冲锋中');
  if (o.comboN > 0) s.push('连击×' + o.comboN + (o.comboX > 0 ? '⚡' : ''));
  if (o.shieldT > 0) s.push('护盾');
  if (o.invT > 0) s.push('🛡 无敌 ' + o.invT.toFixed(1) + 's');
  if (o.rushT > 0) s.push('狂暴');
  if (o.regenT > 0) s.push('修复');
  if (o.ability === 'drone') s.push('充能 ' + o.charge + '/12' + (o.chargeUp > 0 ? ' 蓄力!' : ''));
  if (o.ability === 'idol') s.push('领域');
  if (o.portalCd > 0) s.push('传送冷却');
  // V8 状态
  if (o.pinned) s.push('➳ 被钉住');
  if (o.corrodeN > 0) s.push('☢ 易伤×' + o.corrodeN + ' ' + Math.ceil(o.corrodeT) + 's');
  if (o.corrodeSlowN > 0) s.push('❄ 减速×' + o.corrodeSlowN);
  if (o.vulnT > 0) s.push('⚡ 易伤 ' + o.vulnT.toFixed(1) + 's');
  if (o.liquidHp > 0) s.push('◍ 液袋 ' + Math.ceil(o.liquidHp));
  if (o.atkBonus > 0) s.push('攻+' + o.atkBonus);
  if (o.ability === 'bond' && o.bondPts && o.bondPts.length > 0) s.push('⛓ 锚×' + o.bondPts.length);
  if (o.ability === 'coffin') s.push('⚰ 档' + (o.coffinStage || 0) + '/3');
  if (o.ability === 'techx') s.push(o.hp / o.maxHp < .5 ? '✳ 光柱' : '✳ 护环');
  return s.join(' ');
}
function updateHUD() {
  const B = battle;
  for (const o of B.orbs) {
    const s = o.side;
    const hpEl = $('#hp-' + s);
    if (!hpEl) continue; // 防御：元素缺失（重建中）
    const hpPct = Math.max(0, o.hp / o.maxHp * 100);
    hpEl.style.width = hpPct + '%';
    $('#hpnum-' + s).textContent = Math.round(hpPct) + '%';
    $('#cd-' + s).style.width = Math.min(100, o.cd / o.maxCd * 100) + '%';
    // 轨道炮双模式独立进度条
    const row = $('#railrow-' + s);
    if (row) {
      if (o.ability === 'railgun') {
        row.style.display = 'flex';
        const f2 = $('#rail2-' + s), f3 = $('#rail3-' + s);
        f2.style.width = Math.min(100, (1 - o.railT2 / 7) * 100) + '%';
        f2.style.background = o.railT2 <= 0 ? '#ffd0ff' : '#3a2a4a';
        f3.style.width = Math.min(100, (1 - o.railT3 / 9) * 100) + '%';
        f3.style.background = o.railT3 <= 0 ? '#ffe9a0' : '#4a3a2a';
      } else row.style.display = 'none';
    }
    $('#hud-status-' + s).textContent = statusOf(o);
  }
  $('#hud-time').textContent = fmtTime(B.time);
}
