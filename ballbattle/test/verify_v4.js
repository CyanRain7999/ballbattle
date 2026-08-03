// V4 新球种针对性冒烟测试：强制 7 个新技能组合开战，确认实体/状态真实触发、无 JS 异常
// 依赖本机 Chrome（与 smoke.js 相同），无 npm 依赖。运行：node test/verify_v4.js
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
const pairs = [['tornado', 'venom'], ['volcano', 'star'], ['web', 'ghost'], ['launcher', 'web'], ['wuliang', 'wuliang']];

async function main() {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbv4-'));
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
  const evalJS = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
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
    if (L.ghostT > 0 || R.ghostT > 0) __seen.ghost = true;
    if (L.webT > 0 || R.webT > 0) __seen.webT = true;
    if (L.venomN > 0 || R.venomN > 0) __seen.venom = true;
    if (L.stunT > 0 || R.stunT > 0) __seen.stun = true;
    battle.proj.forEach(p => {
      __types['p:' + p.type] = true;
      if (p.type === 'tornado') __seen.tornadoMaxR = Math.max(__seen.tornadoMaxR || 0, p.r); // V6：龙卷风半径渐扩
    });
    battle.structs.forEach(s => {
      __types['s:' + s.type] = true;
      if (s.type === 'web') __seen.webCount = Math.max(__seen.webCount || 0, battle.structs.filter(x => x.type === 'web').length); // V6：一次 3 网
    });
  }, 200);`);

  for (const [a, b] of pairs) {
    await evalJS(`players = {
      left: { name: 'L', color: COLORS[0], decor: 'ring', ability: '${a}' },
      right: { name: 'R', color: COLORS[1], decor: 'spike', ability: '${b}' },
    }; startBattle();`);
    await sleep(12000);
  }

  // 弹射撞墙单次结算验证（V6）：launchT 标记 + 贴墙高速 → 撞墙结算一次 ≈24 实伤（双触发会 ≥48）
  await evalJS(`(function () {
    if (state !== 'battle' || !battle) startBattle();
    const f = fieldRect();
    const o = battle.left, r2 = battle.right;
    o.x = f.x + f.s / 2; o.y = f.y + f.s / 2; o.vx = 0; o.vy = 0;
    r2.x = f.x + r2.r + 5; r2.y = f.y + f.s / 2;
    r2.vx = -900; r2.vy = 0;
    r2.launchT = 3;
    window.__launchHp0 = r2.hp;
  })()`);
  await sleep(250);
  const launchChk = await evalJS(`(() => ({ hp0: window.__launchHp0, hp: Math.round(battle.right.hp) }))()`);

  // 隔离验证：left 移出碰撞路径后复测（防反弹撞车干扰窗口判断）
  await evalJS(`(function () {
    const f = fieldRect();
    const o = battle.left, r2 = battle.right;
    o.x = f.x + f.s - o.r - 5; o.y = f.y + f.s - o.r - 5; // 右下角（远离左墙反弹路径）
    o.vx = 0; o.vy = 0;
    r2.x = f.x + r2.r + 5; r2.y = f.y + f.s / 2;
    r2.vx = -900; r2.vy = 0;
    r2.launchT = 3;
    window.__launchHp0 = r2.hp;
  })()`);
  await sleep(250);
  const launchChk2 = await evalJS(`(() => ({ hp0: window.__launchHp0, hp: Math.round(battle.right.hp) }))()`);

  // 无量合成确定性注入验证（V7）：摆放两枚苍赫球间距 80 → 直接合成并生成芘（抑制双方技能释放防干扰）
  await evalJS(`(function () {
    if (state !== 'battle' || !battle) startBattle();
    const f = fieldRect();
    const cx = f.x + f.s / 2, cy = f.y + f.s / 2;
    battle.left.cd = -50; battle.right.cd = -50;
    battle.left.maxCd = 999; battle.right.maxCd = 999; // 抑制新球释放
    battle.left.x = cx - 120; battle.left.y = cy; battle.left.vx = 0; battle.left.vy = 0;
    battle.right.x = cx + 120; battle.right.y = cy; battle.right.vx = 0; battle.right.vy = 0;
    battle.structs = battle.structs.filter(s => s.type !== 'wuliangball' && s.type !== 'wulianbi');
    battle.structs.push({ type: 'wuliangball', owner: 'left', kind: 'cang', x: cx - 40, y: cy, vx: 0, vy: 0, life: 13, r: 26, hitT: 0 });
    battle.structs.push({ type: 'wuliangball', owner: 'right', kind: 'heng', x: cx + 40, y: cy, vx: 0, vy: 0, life: 13, r: 26, hitT: 0 });
  })()`);
  await sleep(1500);
  const wuliangChk = await evalJS(`(() => ({
    ballCount: battle.structs.filter(s => s.type === 'wuliangball').length,
    hasBi: battle.structs.some(s => s.type === 'wulianbi')
  }))()`);

  // 幽灵庇护注入验证（V7）：隐身期 hitOrb(10) → 15 × 0.5 = 7.5
  await evalJS(`(function () {
    if (state !== 'battle' || !battle) startBattle();
    const o = battle.left;
    battle.vamp = null;
    o.hp = 200; o.shieldT = 0; o.invT = 0; o.regenT = 0; o.frostT = 0; o.webVulnT = 0;
    o.ghostT = 1;
    window.__gh0 = o.hp;
    hitOrb(o, 10, battle.right, true);
  })()`);
  const ghostChk = await evalJS(`(() => ({ d: Math.round(window.__gh0 - battle.left.hp) }))()`);

  let fail = 0;
  const typeKeys = await evalJS(`Object.keys(window.__types)`) || [];
  const typeSet = new Set(typeKeys);
  const seen = await evalJS(`window.__seen`) || {};
  const checks = {
    '龙卷风 tornado 实体': typeSet.has('p:tornado'),
    '石子 pebble 实体': typeSet.has('p:pebble'),
    '毒雾 venomcloud 实体': typeSet.has('p:venomcloud'),
    '熔岩 lavaburst 实体': typeSet.has('s:lavaburst'),
    '星轨 starpoint 实体': typeSet.has('p:starpoint'),
    '蛛网 web 实体': typeSet.has('s:web'),
    '鬼魂 wraith 实体（幽灵强化）': typeSet.has('p:wraith'),
    '龙卷风半径渐扩（>100，V6）': (seen.tornadoMaxR || 0) > 100,
    '蛛网一次 3 张（≥3，V6）': (seen.webCount || 0) >= 3,
    '隐身状态 ghostT 触发': !!seen.ghost,
    '网缚状态 webT 触发': !!seen.webT,
    '毒层状态 venomN 触发': !!seen.venom,
    '定身状态 stunT 触发': !!seen.stun,
    '弹射撞墙伤害（单次 20-40，V6）': !!launchChk && launchChk.hp < launchChk.hp0 - 20 && launchChk.hp > launchChk.hp0 - 40 && !!launchChk2 && launchChk2.hp < launchChk2.hp0 - 20 && launchChk2.hp > launchChk2.hp0 - 40,
    '苍赫球 wuliangball 实体（V7）': typeSet.has('s:wuliangball'),
    '无量合成（注入 80 间距 → 芘生成，V7）': !!wuliangChk && wuliangChk.ballCount === 0 && wuliangChk.hasBi,
    '幽灵庇护（隐身减伤 50%，V7）': ghostChk.d === 8,
    '无 JS 异常': exceptions.length === 0,
  };
  for (const [k, v] of Object.entries(checks)) {
    console.log(v ? '[PASS]' : '[FAIL]', k);
    if (!v) fail++;
  }
  ws.close(); chrome.kill();
  console.log(fail === 0 ? '\n=== V4 新球种验证全部通过 ===' : `\n=== ${fail} 项断言失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('测试失败:', e.message); process.exit(1); });
