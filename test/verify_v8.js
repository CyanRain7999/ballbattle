// V8 新球种 + 三/四球模式验证：强制 9 个新技能组合开战，确认实体/状态真实触发、多球模式正常、无 JS 异常
// 依赖本机 Chrome（与 smoke.js 相同），无 npm 依赖。运行：node test/verify_v8.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge，请设置 CHROME_PATH 环境变量'); process.exit(1); }
const URL = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pairs = [
  ['curse', 'pylon'], ['corrode', 'techx'], ['coffin', 'bond'],
  ['tech1', 'liquidbag'], ['tech2', 'curse'],
];

async function main() {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbv8-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${userDir}`, '--window-size=1360,860', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 60 && !port; i++) {
    try { port = parseInt(fs.readFileSync(path.join(userDir, 'DevToolsActivePort'), 'utf8').split('\n')[0], 10); } catch (e) { /* retry */ }
    if (!port) await sleep(250);
  }
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') exceptions.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
  };
  const send = (method, params = {}) => new Promise(res => {
    const id = ++msgId; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); res({}); } }, 8000);
  });
  const evalJS = async (expr, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
    if (r.result?.exceptionDetails) exceptions.push((r.result.exceptionDetails.exception?.description || '').split('\n')[0]);
    return r.result?.result?.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1500);

  // 全局观察器：每 200ms 收集实体类型与 V8 状态
  await evalJS(`window.__seen = {}; window.__types = {};
  setInterval(() => {
    if (!battle) return;
    const L = battle.left, R = battle.right;
    if (L.pinned || R.pinned) __seen.pinned = true;
    if ((L.corrodeN > 0) || (R.corrodeN > 0)) __seen.corrode = true;
    if ((L.corrodeSlowN > 0) || (R.corrodeSlowN > 0)) __seen.corrodeSlow = true;
    if ((L.vulnT > 0) || (R.vulnT > 0)) __seen.vuln = true;
    if ((L.stunT > 0) || (R.stunT > 0)) __seen.stun = true;
    if (L.liquidHp > 0 || R.liquidHp > 0) __seen.liquid = true;
    if (L.atkBonus > 0 || R.atkBonus > 0) __seen.atkBonus = true;
    if (L.coffinStage > 0 || R.coffinStage > 0) __seen.coffinStage = true;
    if ((L.bondPts && L.bondPts.length) || (R.bondPts && R.bondPts.length)) __seen.bondPts = true;
    if ((L.techxRot || R.techxRot)) __seen.techx = true;
    battle.proj.forEach(p => {
      __types['p:' + p.type] = true;
      if (p.type === 'cursenail') __seen.nailR = Math.max(__seen.nailR || 0, p.r);
    });
    battle.structs.forEach(s => {
      __types['s:' + s.type] = true;
      if (s.type === 'laserturret') __seen.turretCount = Math.max(__seen.turretCount || 0, battle.structs.filter(x => x.type === 'laserturret' && x.owner === s.owner).length);
    });
  }, 200);`);

  for (const [a, b] of pairs) {
    await evalJS(`gameMode = 2; players = {
      left: { name: 'L', color: COLORS[0], decor: 'ring', ability: '${a}' },
      right: { name: 'R', color: COLORS[1], decor: 'spike', ability: '${b}' },
    }; startBattle();`);
    await sleep(8000);
  }

  // —— 液袋注入验证：护盾吸收 + 击破永久增攻 ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'liquidbag' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    const o = battle.left;
    battle.vamp = null;
    o.hp = 300; o.shieldT = 0; o.invT = 0; o.regenT = 0; o.webVulnT = 0; o.ghostT = 0; o.frostT = 0; o.corrodeN = 0; o.vulnT = 0;
    o.liquidHp = 60; o.atkBonus = 0;
    window.__l0 = o.hp;
    hitOrb(o, 10, battle.right, true); // 液袋吸收
    window.__l1 = o.hp;
    window.__bagAfter = o.liquidHp;
  })()`);
  const liquidChk = await evalJS(`(() => ({
    absorb: Math.round(window.__l0 - window.__l1) === 0,
    bagAfter: Math.round(window.__bagAfter),
    liquidHp0: 60,
  }))()`);

  // 击破：连续打 60 伤害 → 液袋破 → 增攻 +5
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'liquidbag' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    const o = battle.left;
    battle.vamp = null;
    o.liquidHp = 60; o.atkBonus = 0;
    for (let i = 0; i < 8; i++) hitOrb(o, 10, battle.right, true);
    window.__after = { bag: o.liquidHp, atk: o.atkBonus };
  })()`);
  const liquidBrk = await evalJS(`window.__after`);

  // —— 腐蚀易伤注入验证：2 层易伤 → hitOrb(10) = 10×1.5×1.3 = 19.5 ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'corrode' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    const o = battle.left;
    battle.vamp = null;
    o.hp = 300; o.shieldT = 0; o.invT = 0; o.regenT = 0; o.webVulnT = 0; o.ghostT = 0; o.frostT = 0; o.vulnT = 0;
    o.corrodeN = 2; o.corrodeT = 5;
    window.__c0 = o.hp;
    hitOrb(o, 10, battle.right, true);
    window.__cDmg = Math.round(window.__c0 - o.hp);
  })()`);
  const corrodeChk = await evalJS(`window.__cDmg`);

  // —— 电线杆落雷注入验证：lightning 无前摇 → 定身 + 易伤 + 伤害 ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'pylon' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    const f = fieldRect();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.right.hp = 400; battle.right.invT = 0; battle.right.shieldT = 0; battle.right.stunT = 0; battle.right.vulnT = 0;
    battle.right.x = f.x + f.s * .7; battle.right.y = f.y + f.s / 2; battle.right.vx = 0; battle.right.vy = 0;
    battle.left.x = f.x + f.s * .2; battle.left.y = f.y + f.s / 2; battle.left.vx = 0; battle.left.vy = 0;
    battle.structs.push({ type: 'lightning', owner: 'left', x: battle.right.x, y: battle.right.y, delay: 0, r: 120 });
    window.__l0 = battle.right.hp;
  })()`);
  await sleep(350);
  const lightningChk = await evalJS(`(() => ({
    stun: battle.right.stunT > 0,
    vuln: battle.right.vulnT > 0,
    dmg: Math.round(window.__l0 - battle.right.hp)
  }))()`);

  // —— 诅咒火焰圈注入验证：钉子撞墙 → 生成逐渐变大的 cursefire ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'curse' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    const f = fieldRect();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.left.x = f.x + f.s * .2; battle.left.y = f.y + f.s / 2; battle.left.vx = 0; battle.left.vy = 0;
    battle.right.x = f.x + f.s * .7; battle.right.y = f.y + f.s * .85; battle.right.vx = 0; battle.right.vy = 0;
    battle.proj = [];
    battle.proj.push({ type: 'cursenail', owner: 'left', x: f.x + f.s * .5, y: f.y + f.s / 2, vx: 900, vy: 0, life: 7, r: 16, hitT: 0, angle: 0 });
  })()`);
  await sleep(600); // 钉子 ~0.38s 撞墙生成火焰圈，此刻已生长 ~220ms
  const cf1 = await evalJS(`(() => {
    const s = battle.structs.find(x => x.type === 'cursefire');
    return s ? Math.round(s.r) : -1;
  })()`);
  await sleep(400); // 再生长 400ms
  const cf2 = await evalJS(`(() => {
    const s = battle.structs.find(x => x.type === 'cursefire');
    return s ? Math.round(s.r) : -1;
  })()`);
  const curseFireChk = { has: cf1 > 0 && cf2 > 0, r: cf2, grown: cf2 > cf1 };

  // —— 诅咒之钉注入验证：命中钉住敌人继续拖飞，直到撞墙触发诅咒之火并释放 ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'curse' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    const f = fieldRect();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.right.hp = 400; battle.right.invT = 0; battle.right.shieldT = 0;
    battle.structs = battle.structs.filter(s => s.type !== 'laserring' && s.type !== 'laserbeams');
    battle.right.x = f.x + f.s * .6; battle.right.y = f.y + f.s / 2; battle.right.vx = 0; battle.right.vy = 0;
    battle.left.x = f.x + f.s * .2; battle.left.y = f.y + f.s / 2; battle.left.vx = 0; battle.left.vy = 0;
    battle.proj = [];
    battle.proj.push({ type: 'cursenail', owner: 'left', x: f.x + f.s * .5, y: f.y + f.s / 2, vx: 900, vy: 0, life: 7, r: 16, hitT: 0, angle: 0 });
    window.__nailHp0 = battle.right.hp;
  })()`);
  await sleep(130); // 0.08s 命中，此刻正在拖飞（距右墙 ~288px，0.32s 内未撞墙）
  const nailChk = await evalJS(`(() => ({
    pinned: !!battle.right.pinned,
    pinT: Math.round(battle.right.pinT * 10) / 10,
    speedSync: Math.round(battle.right.vx) >= 800, // 随钉子高速飞行
    noHitDmg: battle.right.hp === window.__nailHp0 // 命中零伤害（纯控制，伤害由撞墙火焰结算）
  }))()`);
  await sleep(400); // 拖到右墙 → 钉子钉入墙体（敌人继续被钉住）+ 诅咒火焰圈
  const nailEndChk = await evalJS(`(() => ({
    pinned: !!battle.right.pinned,
    stuck: (battle.proj.find(p => p.type === 'cursenail') || {}).stuck === true,
    nailX: (battle.proj.find(p => p.type === 'cursenail') || {}).x ?? -1,
    cursefire: battle.structs.some(s => s.type === 'cursefire')
  }))()`);
  await sleep(3600); // 墙钉存续 3.2s 到期 → 拔出钉子释放敌人
  const nailReleaseChk = await evalJS(`(() => ({
    pinned: !!battle.right.pinned,
    nailGone: !battle.proj.some(p => p.type === 'cursenail' && p.stuck)
  }))()`);

  // —— 科技X 半血注入验证：hp<50% 时 laserring → laserbeams ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'techx' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.left.hp = battle.left.maxHp * .4;
    battle.structs = battle.structs.filter(s => s.type !== 'laserring' && s.type !== 'laserbeams');
  })()`);
  await sleep(400);
  const techxHalfChk = await evalJS(`(() => {
    const s = battle.structs.find(x => x.type === 'laserring' || x.type === 'laserbeams');
    return s ? s.type : null;
  })()`);

  // —— 棺椁失血封锁注入验证：失去 25% → 触发 10%/20% 两档并封锁无球四分之一区 ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'coffin' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.left.hp = battle.left.maxHp * .75; // 失去 25%
    battle.left.coffinStage = 0;
  })()`);
  await sleep(400);
  const coffinChk = await evalJS(`(() => ({
    stage: battle.left.coffinStage,
    zones: battle.structs.filter(s => s.type === 'coffinzone').length
  }))()`);

  // —— 棺椁三档封锁注入验证：随失血渐进触发三档 → 3 块互异象限永久封锁（敌人活动范围只剩 1/4）——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'coffin' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.left.coffinStage = 0;
    battle.left.invT = 999; // 注入期间无敌：防止 right 伤害干扰失血阈值
    battle.left.hp = battle.left.maxHp * .85; // 失血 15% → 触发第 1 档
  })()`);
  await sleep(200);
  const cfZ1 = await evalJS(`battle.structs.filter(s => s.type === 'coffinzone').length`);
  await evalJS(`battle.left.hp = battle.left.maxHp * .70;`); // 失血 30% → 第 2 档
  await sleep(200);
  const cfZ2 = await evalJS(`battle.structs.filter(s => s.type === 'coffinzone').length`);
  await evalJS(`battle.left.hp = battle.left.maxHp * .55;`); // 失血 45% → 第 3 档
  await sleep(400);
  const coffinFullChk = await evalJS(`(() => {
    const zs = battle.structs.filter(s => s.type === 'coffinzone');
    const keys = zs.map(z => z.x + ',' + z.y);
    const unique = new Set(keys).size === zs.length;
    return { n: zs.length, unique, permanent: zs.every(z => z.life === undefined) };
  })()`);

  // —— 腐蚀粒子注入验证：corrodepart 命中 → 叠易伤层 + 叠减速层 ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'corrode' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } }; startBattle();
    const f = fieldRect();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.right.hp = 400; battle.right.invT = 0; battle.right.shieldT = 0;
    battle.right.x = f.x + f.s * .6; battle.right.y = f.y + f.s / 2; battle.right.vx = 0; battle.right.vy = 0;
    battle.left.x = f.x + f.s * .2; battle.left.y = f.y + f.s / 2; battle.left.vx = 0; battle.left.vy = 0;
    battle.right.corrodeN = 0; battle.right.corrodeSlowN = 0;
    battle.proj = [];
    for (let i = 0; i < 5; i++) battle.proj.push({ type: 'corrodepart', owner: 'left', x: f.x + f.s * .5 + rand(-30, 30), y: f.y + f.s / 2 + rand(-30, 30), vx: 800, vy: 0, life: 2, r: 5 });
  })()`);
  await sleep(400);
  const corrodePartChk = await evalJS(`(() => ({
    n: battle.right.corrodeN,
    slow: battle.right.corrodeSlowN
  }))()`);

  // —— 电线杆易伤注入验证：vulnT → hitOrb(10) = 10×1.5×1.5 = 22.5 ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'missile' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'missile' } }; startBattle();
    const o = battle.left;
    battle.vamp = null;
    o.hp = 300; o.shieldT = 0; o.invT = 0; o.regenT = 0; o.webVulnT = 0; o.ghostT = 0; o.frostT = 0; o.corrodeN = 0;
    o.vulnT = 2;
    window.__v0 = o.hp;
    hitOrb(o, 10, battle.right, true);
    window.__vDmg = Math.round(window.__v0 - o.hp);
  })()`);
  const vulnChk = await evalJS(`window.__vDmg`);

  // —— 三球模式 ——
  await evalJS(`gameMode = 3; players = {
    p0: { name: 'A', color: COLORS[0], decor: 'ring', ability: 'curse' },
    p1: { name: 'B', color: COLORS[1], decor: 'spike', ability: 'coffin' },
    p2: { name: 'C', color: COLORS[2], decor: 'hex', ability: 'bond' },
  }; startBattle();`);
  await sleep(2500);
  const mode3 = await evalJS(`(() => ({
    orbs: battle.orbs.length,
    hudSides: document.querySelectorAll('#hud .hud-side').length,
    hasBL: !!document.querySelector('#hud .hud-side.bl'),
    hasBR: !!document.querySelector('#hud .hud-side.br'),
    alive: battle.orbs.filter(o => o.alive).length
  }))()`);

  // —— 四球模式 ——
  await evalJS(`gameMode = 4; players = {
    p0: { name: 'A', color: COLORS[0], decor: 'ring', ability: 'tech1' },
    p1: { name: 'B', color: COLORS[1], decor: 'spike', ability: 'tech2' },
    p2: { name: 'C', color: COLORS[2], decor: 'hex', ability: 'techx' },
    p3: { name: 'D', color: COLORS[3], decor: 'cross', ability: 'liquidbag' },
  }; startBattle();`);
  await sleep(2500);
  const mode4 = await evalJS(`(() => ({
    orbs: battle.orbs.length,
    hudSides: document.querySelectorAll('#hud .hud-side').length,
    hasTL: !!document.querySelector('#hud .hud-side.tl'),
    hasTR: !!document.querySelector('#hud .hud-side.tr'),
    hasBL: !!document.querySelector('#hud .hud-side.bl'),
    hasBR: !!document.querySelector('#hud .hud-side.br'),
    vsText: document.querySelector('#hud-vs')?.textContent
  }))()`);

  // —— 出局不重放验证：killOrb 后 0.6s 震屏应衰减、fx 不应持续爆炸增长 ——
  await evalJS(`(function () {
    players = { p0: { name: 'A', color: COLORS[0], decor: 'ring', ability: 'pulse' }, p1: { name: 'B', color: COLORS[1], decor: 'spike', ability: 'pulse' }, p2: { name: 'C', color: COLORS[2], decor: 'hex', ability: 'pulse' } };
    gameMode = 3; startBattle();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.orbs[2].cd = -50; battle.orbs[2].maxCd = 999;
    killOrb(battle.orbs[2]); // 出局（还剩 2 球，battle.over 仍为 false）
    window.__fxLen0 = battle.fx.length;
    window.__shake0 = battle.shake;
  })()`);
  await sleep(600);
  const outChk = await evalJS(`(() => ({
    alive: battle.orbs[2].alive,
    over: battle.over,
    shake: Math.round(battle.shake),
    fxGrowth: battle.fx.length - window.__fxLen0 < 60, // 无每帧 boom 粒子爆炸（修复前会持续 +40/帧）
    survivors: battle.orbs.filter(o => o.alive).length
  }))()`);

  // —— 科技X 激光命中节流验证：半血光柱命中 1.2s 总伤害应有限（修复前每帧结算秒杀） ——
  await evalJS(`(function () {
    players = { left: { name: 'L', color: COLORS[0], decor: 'ring', ability: 'techx' }, right: { name: 'R', color: COLORS[1], decor: 'spike', ability: 'pulse' } };
    gameMode = 2; startBattle();
    battle.left.cd = -50; battle.left.maxCd = 999; battle.right.cd = -50; battle.right.maxCd = 999;
    battle.left.hp = battle.left.maxHp * .4; // 半血 → laserbeams
    battle.left.x = fieldRect().x + fieldRect().s / 2; battle.left.y = fieldRect().y + fieldRect().s / 2;
    battle.left.vx = 0; battle.left.vy = 0;
    battle.right.x = battle.left.x + 280; battle.right.y = battle.left.y; // 放在光束路径旁
    battle.right.vx = 0; battle.right.vy = 0;
    battle.right.hp = 400; battle.right.invT = 0; battle.right.shieldT = 0;
    window.__lb0 = battle.right.hp;
  })()`);
  await sleep(1200);
  const laserThrottleChk = await evalJS(`(() => ({
    dmg: Math.round(window.__lb0 - battle.right.hp),
    alive: battle.right.alive
  }))()`);

  // —— 模式切换按钮 ——
  await evalJS(`showScreen('select');
    document.querySelector('.mode-btn[data-mode="3"]').click();`);
  const switch3 = await evalJS(`(() => ({
    panels: document.querySelectorAll('#select-body .panel').length,
    multi: document.querySelector('#select-body').classList.contains('multi')
  }))()`);
  await evalJS(`document.querySelector('.mode-btn[data-mode="4"]').click();`);
  const switch4 = await evalJS(`document.querySelectorAll('#select-body .panel').length`);
  await evalJS(`document.querySelector('.mode-btn[data-mode="2"]').click();`);
  const switch2 = await evalJS(`(() => ({
    panels: document.querySelectorAll('#select-body .panel').length,
    multi: document.querySelector('#select-body').classList.contains('multi'),
    sel2: !!document.querySelector('.mode-btn[data-mode="2"].sel'),
    modes: document.querySelectorAll('#mode-switch .mode-btn').length
  }))()`);

  let fail = 0;
  const typeKeys = await evalJS(`Object.keys(window.__types)`) || [];
  const typeSet = new Set(typeKeys);
  const seen = await evalJS(`window.__seen`) || {};
  const checks = {
    '诅咒之钉 cursenail 实体': typeSet.has('p:cursenail'),
    '诅咒火焰圈（注入：钉撞墙生成+逐渐变大）': !!curseFireChk && curseFireChk.has && curseFireChk.grown,
    '腐蚀粒子命中叠层（注入）': !!corrodePartChk && corrodePartChk.n >= 1 && corrodePartChk.slow >= 1,
    '黑白蝴蝶 butterfly 实体': typeSet.has('p:butterfly'),
    '激光发射器 laserturret 实体': typeSet.has('s:laserturret'),
    '激光弹 laserbolt 实体': typeSet.has('p:laserbolt'),
    '科技X 激光环 laserring 实体': typeSet.has('s:laserring'),
    '科技X 半血转旋转光柱（注入 hp40%）': techxHalfChk === 'laserbeams',
    '电线杆落雷无前摇（定身+易伤+伤害）': !!lightningChk && lightningChk.stun && lightningChk.vuln && lightningChk.dmg >= 14,
    '棺椁封锁区 coffinzone 实体': !!coffinChk && coffinChk.zones >= 1,
    '棺椁三档渐进触发（档1→1块 档2→2块 档3→3块）': cfZ1 === 1 && cfZ2 === 2 && !!coffinFullChk && coffinFullChk.n === 3,
    '棺椁三档封锁互异象限（活动范围剩 1/4）': !!coffinFullChk && coffinFullChk.unique,
    '棺椁封锁区永久存在（无 life 计时）': !!coffinFullChk && coffinFullChk.permanent,
    '诅咒之钉命中钉住拖飞（注入）': !!nailChk && nailChk.pinned && nailChk.pinT > 0 && nailChk.speedSync && nailChk.noHitDmg,
    '诅咒之钉撞墙钉入墙体继续钉住并燃火（注入）': !!nailEndChk && nailEndChk.pinned && nailEndChk.stuck && nailEndChk.cursefire,
    '诅咒之钉墙钉存续到期后拔出释放（注入）': !!nailReleaseChk && !nailReleaseChk.pinned && nailReleaseChk.nailGone,
    '腐蚀易伤层 corrode 触发': !!seen.corrode,
    '腐蚀减速层 corrodeSlow 触发': !!seen.corrodeSlow,
    '电线杆易伤 vuln 触发': !!seen.vuln,
    '定身 stun 触发（落雷）': !!seen.stun,
    '液袋 liquid 触发': !!seen.liquid,
    '液袋击破增攻 atkBonus 触发': !!seen.atkBonus,
    '棺椁失血封锁 coffinStage 触发（注入 hp75%）': !!coffinChk && coffinChk.stage >= 2,
    '拘束锚点 bondPts 触发': !!seen.bondPts,
    '科技X 常驻 techx 触发': !!seen.techx,
    '激光台同时存在上限 16（实测 ≤16）': (seen.turretCount || 0) <= 16,
    '液袋吸收伤害（60 盾挡 10 伤）': !!liquidChk && liquidChk.absorb,
    '液袋击破永久增攻 +5（上限 30）': !!liquidBrk && liquidBrk.atk === 5 && liquidBrk.bag === 0,
    '腐蚀 2 层易伤 +30%（15→19.5≈20）': corrodeChk === 20,
    '电线杆易伤 +50%（15→22.5≈23）': vulnChk === 23,
    '三球模式 orbs=3': !!mode3 && mode3.orbs === 3 && mode3.hudSides === 3,
    '三球 HUD 含左下/右下': !!mode3 && mode3.hasBL && mode3.hasBR,
    '四球模式 orbs=4 + HUD 四角': !!mode4 && mode4.orbs === 4 && mode4.hudSides === 4 && mode4.hasTL && mode4.hasTR && mode4.hasBL && mode4.hasBR,
    '四球 HUD 显示 4P 混战': !!mode4 && /4P/.test(mode4.vsText || ''),
    '出局球不重放死亡（alive 守卫）': !!outChk && !outChk.alive && !outChk.over && outChk.survivors === 2 && outChk.shake < 8 && outChk.fxGrowth,
    '科技X 激光命中节流（1.2s 伤害有限）': !!laserThrottleChk && laserThrottleChk.dmg > 5 && laserThrottleChk.dmg < 150 && laserThrottleChk.alive,
    '模式切换按钮（5 个：2P/3P/4P/2V2/BOSS）': !!switch2 && switch2.modes === 5,
    '模式切换：3P 面板 3 个 + 网格': !!switch3 && switch3.panels === 3 && switch3.multi,
    '模式切换：4P 面板 4 个': switch4 === 4,
    '模式切换：回到 2P 面板 2 个': !!switch2 && switch2.panels === 2 && !switch2.multi && switch2.sel2,
    '无 JS 异常': exceptions.length === 0,
  };
  for (const [k, v] of Object.entries(checks)) {
    console.log(v ? '[PASS]' : '[FAIL]', k);
    if (!v) fail++;
  }
  ws.close(); chrome.kill();
  console.log(fail === 0 ? '\n=== V8 新球种 + 多球模式验证全部通过 ===' : `\n=== ${fail} 项断言失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('测试失败:', e.message); process.exit(1); });
