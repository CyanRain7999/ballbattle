// 棺椁封锁区穿模回归验证：球心进入区内（哪怕深度 < r）必须被推出，不得嵌入封锁区
// 原 bug：判定要求"球体完全进入"（球心距四边均 > r），球嵌入 < r 深度时完全无碰撞 → 穿模
// 依赖本机 Chrome/Edge（与 check_modes.js 相同），无 npm 依赖。运行：node test/coffin_clip.js
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
let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
  if (!ok) failures++;
};

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coffclip-'));
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
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) {
      const d = (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text || '').split('\n')[0];
      exceptions.push(d);
      console.log('  [EXC] ' + d);
    }
    return r.result?.result?.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1200);

  // A. 临界嵌入：球心在区内但嵌入深度 < r（原代码完全漏判的死角）→ 必须被推出区外
  const dA = await evalJS(`(() => {
    gameMode = 2; gameRules.multiSkill = false; gameRules.obstacles = 'none'; gameRules.shrink = false; gameRules.fieldScale = 1;
    buildPanels();
    players = {};
    players.left = readConfig('left'); players.right = readConfig('right');
    players.left.ability = 'coffin'; players.right.ability = 'pulse';
    battle = null; startBattle();
    const L = battle.left, R = battle.right;
    L.hp = L.maxHp * .85;
    updateBattle(.1);
    const zone = battle.structs.find(s => s.type === 'coffinzone');
    if (!zone) return { zone: 'none' };
    // 敌人从区外左侧撞入：球心停在区内、距左边仅 5px（< r，原判定"未完全进入"不反弹 = 穿模）
    L.x = zone.x + zone.w + 120; L.y = zone.y + zone.h + 120; L.vx = 0; L.vy = 0; // 主人远离避免干扰
    R.x = zone.x + 5; R.y = zone.y + zone.h / 2; R.vx = 0; R.vy = 0;
    updateStructs(.05);
    const inZone = R.x > zone.x && R.x < zone.x + zone.w && R.y > zone.y && R.y < zone.y + zone.h;
    const deep = zone.x + zone.w - R.x;
    return { zone: 'ok', out: !inZone, x: Math.round(R.x), deep: Math.round(deep), r: Math.round(R.r) };
  })()`);
  check('嵌入 < r 深度的球被推出封锁区（不穿模）', dA && dA.zone === 'ok' && dA.out === true, JSON.stringify(dA));

  // B. 高速飞行：球以 420px/s 撞向封锁区，球心深入区内的最大深度 ≤ 一帧位移（≈7px）
  const dB = await evalJS(`(() => {
    gameMode = 2; gameRules.multiSkill = false; gameRules.obstacles = 'none'; gameRules.shrink = false; gameRules.fieldScale = 1;
    buildPanels();
    players = {};
    players.left = readConfig('left'); players.right = readConfig('right');
    players.left.ability = 'coffin'; players.right.ability = 'pulse';
    battle = null; startBattle();
    const L = battle.left, R = battle.right;
    L.hp = L.maxHp * .85;
    updateBattle(.1);
    const zone = battle.structs.find(s => s.type === 'coffinzone');
    if (!zone) return { zone: 'none' };
    const F2 = battle.field;
    // 选一个朝向场地中心的边撞入（封锁区贴场地边时另一侧会被 clamp，测不出穿模）
    const fromRight = zone.x + zone.w < F2.x + F2.s * .75;
    const right = fromRight;
    R.x = right ? zone.x + zone.w + R.r - 2 : zone.x - R.r + 2;
    R.y = zone.y + zone.h / 2;
    R.vx = right ? -420 : 420; R.vy = 0;
    L.x = zone.x - 100; L.y = zone.y - 100; L.vx = 0; L.vy = 0;
    let maxDeep = 0, inFrames = 0;
    for (let i = 0; i < 90; i++) {
      updateBattle(1 / 60);
      const deep = right ? zone.x + zone.w - R.x : R.x - zone.x; // 从撞击边深入区内的深度
      if (R.x > zone.x && R.x < zone.x + zone.w && R.y > zone.y && R.y < zone.y + zone.h) {
        if (deep > maxDeep) maxDeep = deep;
        inFrames++;
      }
    }
    return { zone: 'ok', right, maxDeep: Math.round(maxDeep), inFrames, r: Math.round(R.r), finalX: Math.round(R.x), vx: Math.round(R.vx) };
  })()`);
  check('高速撞封锁区最大嵌入 ≤ 10px（原 bug 为整球 ≈ r）', dB && dB.zone === 'ok' && dB.maxDeep <= 10, JSON.stringify(dB));
  check('球不会持续滞留在区内（穿模滞留帧 < 10）', dB && dB.zone === 'ok' && dB.inFrames < 10, JSON.stringify(dB));
  check('无未捕获异常', exceptions.length === 0, exceptions.join('; '));

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
  await send('Browser.close');
  process.exit(failures === 0 ? 0 : 1);
})();
