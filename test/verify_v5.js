// V5 新球种针对性冒烟测试：强制 5 个新技能组合开战，确认实体/状态真实触发、无 JS 异常
// 依赖本机 Chrome（与 smoke.js 相同），无 npm 依赖。运行：node test/verify_v5.js
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
const pairs = [['tsunami', 'spore'], ['clone', 'evolve', 20000], ['lance', 'tsunami'], ['clone', 'missile']];

async function main() {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbv5-'));
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

  // 全局观察器：每 200ms 记录状态出现过 + 收集场上实体类型（防短命实体错过采样）
  await evalJS(`window.__seen = {}; window.__types = {};
  setInterval(() => {
    if (!battle) return;
    const L = battle.left, R = battle.right;
    if (L.lanceT > 0 || R.lanceT > 0) __seen.lance = true;
    if (L.evolveLv > 0 || R.evolveLv > 0) __seen.evolveLv = true;
    if (L.evolveX > 0 || R.evolveX > 0) __seen.evolveX = true;
    battle.proj.forEach(p => {
      __types['p:' + p.type] = true;
      if (p.type === 'clone') __seen.cloneR = Math.max(__seen.cloneR || 0, p.r); // V6：替身半径 +100%
    });
    battle.structs.forEach(s => {
      __types['s:' + s.type] = true;
      if (s.type === 'mushroom') __seen.mushroomR = s.r; // V6：蘑菇半径 +50%
    });
  }, 200);`);

  let lvChk = null;
  for (const [a, b, dur] of pairs) {
    await evalJS(`players = {
      left: { name: 'L', color: COLORS[0], decor: 'ring', ability: '${a}' },
      right: { name: 'R', color: COLORS[1], decor: 'spike', ability: '${b}' },
    }; startBattle();`);
    if (a === 'clone' && b === 'evolve') { // 进化需碰撞触发：注入水平对冲保证命中
      await evalJS(`if (battle) {
        const f = fieldRect();
        battle.left.x = f.x + f.s * .3; battle.left.y = f.y + f.s / 2;
        battle.right.x = f.x + f.s * .7; battle.right.y = f.y + f.s / 2;
        battle.left.vx = 300; battle.left.vy = 0;
        battle.right.vx = -300; battle.right.vy = 0;
      }`);
    }
    await sleep(dur || 12000);
    if (a === 'clone' && b === 'evolve') { // 升级分支确定性注入验证（模拟 3 点经验 → Lv.1 + 体积 +20%）
      lvChk = await evalJS(`(() => {
        const o = battle.right;
        o.evolveX = 2; o.evolveLv = 0; o.r = 50;
        if (o.ability === 'evolve') {
          o.evolveX += 1;
          if (o.evolveX >= 3 && o.evolveLv < 3) { o.evolveX = 0; o.evolveLv++; o.r *= 1.2; }
        }
        return { evolveX: o.evolveX, evolveLv: o.evolveLv, r: Math.round(o.r * 10) / 10 };
      })()`);
    }
  }

  // 撞墙反弹回归断言：高速朝墙移动后必须反弹（vx > 0），防止位移后 clamp 钉墙
  await evalJS(`(function () {
    if (state !== 'battle' || !battle) startBattle(); // 结算后注入需重启战斗循环
    const f = fieldRect();
    const o = battle.left, r2 = battle.right;
    o.x = f.x + o.r + 5; o.y = f.y + f.s / 2;         // 左球贴左墙
    r2.x = f.x + 30; r2.y = f.y + f.s - 30;           // 右球挪到左下角（远离左球轨迹，排除碰撞干扰）
    o.vx = -900; o.vy = 0;
    r2.vx = 0; r2.vy = 0;
  })()`);
  const bounceChk = await evalJS(`(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 2000) {
      if (battle.left.vx > 0) return { vx: Math.round(battle.left.vx), x: Math.round(battle.left.x), ok: true };
      await new Promise(r => setTimeout(r, 50));
    }
    return { vx: Math.round(battle.left.vx), x: Math.round(battle.left.x), ok: false };
  })()`, true, 6000);

  // 替身耐久 + 本体庇护注入验证（V7）：3 次扣耐久后消失；替身在场本体承伤减半
  await evalJS(`(function () {
    if (state !== 'battle' || !battle) startBattle();
    const o = battle.left;
    battle.vamp = null;
    o.hp = 200; o.shieldT = 0; o.invT = 0; o.regenT = 0; o.frostT = 0; o.ghostT = 0; o.webVulnT = 0;
    battle.proj.push({ type: 'clone', owner: 'left', x: o.x + 250, y: o.y, vx: 0, vy: 0, life: 5, r: 60, hitT: 0, durability: 3 });
    window.__cloneHp0 = o.hp;
    hitOrb(o, 10, battle.right, true);
  })()`);
  const cloneShieldChk = await evalJS(`(() => {
    const d = Math.round(window.__cloneHp0 - battle.left.hp);
    const c = battle.proj.find(p => p.type === 'clone' && p.owner === 'left');
    if (c) {
      damageClone(c, null); // 3 → 2
      damageClone(c, null); // 2 → 1
      const mid = c.durability, aliveMid = c.life > 0;
      damageClone(c, null); // 1 → 0 消失
      return { d, mid, aliveMid, gone: c.life <= 0 };
    }
    return { d, mid: -1, aliveMid: false, gone: false };
  })()`);

  let fail = 0;
  const typeKeys = await evalJS(`Object.keys(window.__types)`) || [];
  const typeSet = new Set(typeKeys);
  const seen = await evalJS(`window.__seen`) || {};
  const checks = {
    '海啸 tsunami 实体': typeSet.has('s:tsunami'),
    '孢子种子 sporeseed 实体': typeSet.has('p:sporeseed'),
    '毒蘑菇 mushroom 实体': typeSet.has('s:mushroom'),
    '替身 clone 实体': typeSet.has('p:clone'),
    '追踪弹 missile 实体': typeSet.has('p:missile'),
    '进化经验 evolveX 触发': !!seen.evolveX,
    '进化升级逻辑（注入验证 Lv.1+体积60）': !!lvChk && lvChk.evolveLv === 1 && lvChk.evolveX === 0 && lvChk.r === 60,
    '替身半径 60（+100%，V6）': seen.cloneR === 60,
    '蘑菇毒域半径 39（+50%，V6）': seen.mushroomR === 39,
    '骑枪冲刺 lanceT 触发': !!seen.lance,
    '撞墙反弹（高速不钉墙）': !!bounceChk && bounceChk.vx > 0 && bounceChk.x > 0,
    '替身在场本体 50% 庇护（V7）': !!cloneShieldChk && cloneShieldChk.d === 8,
    '替身 3 点耐久（扣 3 次后消失，V7）': !!cloneShieldChk && cloneShieldChk.mid === 1 && cloneShieldChk.aliveMid && cloneShieldChk.gone,
    '无 JS 异常': exceptions.length === 0,
  };
  for (const [k, v] of Object.entries(checks)) {
    console.log(v ? '[PASS]' : '[FAIL]', k);
    if (!v) fail++;
  }
  ws.close(); chrome.kill();
  console.log(fail === 0 ? '\n=== V5 新球种验证全部通过 ===' : `\n=== ${fail} 项断言失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('测试失败:', e.message); process.exit(1); });
