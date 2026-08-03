// ---------------- 特效 ----------------
function addFx(f) { battle.fx.push(f); }
function addRing(x, y, r0, color, lw) {
  addFx({ type: 'ring', x, y, r: r0, vr: 380, maxLife: .4, life: 0, color, lw });
}
function addSparks(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = rand(60, 320);
    addFx({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: rand(.25, .55), size: rand(1.5, 3.2), color });
  }
}
function addText(x, y, text, color, size) {
  addFx({ type: 'text', x, y, text, color, life: 0, maxLife: .8, vy: 46, size: size || 15 });
}
function boom(o) {
  addRing(o.x, o.y, 20, o.color.bright, 5);
  addRing(o.x, o.y, 10, '#ffffff', 4);
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * TAU, sp = rand(90, 480);
    addFx({ type: 'spark', x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: rand(.5, 1.1), size: rand(2, 4.5), color: Math.random() < .5 ? o.color.bright : '#ffffff' });
  }
  battle.shake = 18;
  sfx('boom');
}

function updateFx(dt) {
  for (const f of battle.fx) {
    f.life += dt;
    if (f.type === 'ring') f.r += f.vr * dt;
    if (f.type === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.type === 'text') f.y -= f.vy * dt;
  }
  battle.fx = battle.fx.filter(f => f.life < f.maxLife);
}

// 贯穿战场的直线（与矩形求交）
function lineThroughField(cx, cy, ang, F) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let tMin = -Infinity, tMax = Infinity;
  const clip = (p, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return;
    let t1 = (lo - p) / d, t2 = (hi - p) / d;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2);
  };
  clip(cx, dx, F.x + 16, F.x + F.s - 16);
  clip(cy, dy, F.y + 16, F.y + F.s - 16);
  return [[cx + tMin * dx, cy + tMin * dy], [cx + tMax * dx, cy + tMax * dy]];
}
