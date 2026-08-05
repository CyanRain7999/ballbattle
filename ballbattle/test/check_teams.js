// 队伍模式与障碍扩充验证：2v2 团战 / 4v1 BOSS / 新增障碍布局（九宫格·八块环·之字柱·随机·对称随机）
// 依赖本机 Chrome/Edge，无 npm 依赖。运行：node test/check_teams.js
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
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbteams-'));
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
  await sleep(1500);

  // 开战辅助（直接 startBattle，跳过转场）
  const openBattle = async (mode, extra = '') => await evalJS(`(() => {
    gameMode = ${mode};
    gameRules = { shrink: false, obstacles: 'none', multiSkill: false };
    buildPanels();
    players = {};
    panelKeys(gameMode).forEach(k => players[k] = readConfig(k));
    startBattle();
    ${extra}
  })()`);

  console.log('== 1. 新增障碍布局 ==');
  for (const [id, n] of [['grid3', 5], ['ring', 8], ['slalom', 3], ['random', 4], ['randomsym', 4]]) {
    const r = await evalJS(`(() => {
      gameRules.obstacles = '${id}';
      battle = null;
      players = {}; panelKeys(2).forEach(k => players[k] = readConfig(k));
      startBattle();
      updateObstacles(battle, 0);
      return { n: battle.obstAbs.length, rel: battle.obstacles.length };
    })()`);
    check(`${id} 生成 ${n} 块`, r && r.n === n && r.rel === n, 'n=' + (r && r.n));
  }
  check('随机布局互不重叠', await evalJS(`(() => {
    const list = battle.obstacles;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (!(a.fx + a.fw < b.fx || b.fx + b.fw < a.fx || a.fy + a.fh < b.fy || b.fy + b.fh < a.fy)) return false;
      }
    return true;
  })()`));
  check('对称随机布局左右镜像', await evalJS(`(() => {
    gameRules.obstacles = 'randomsym';
    battle = null; players = {}; panelKeys(2).forEach(k => players[k] = readConfig(k));
    startBattle();
    const l = battle.obstacles;
    return l.length === 4 && l.every((o, i) => i % 2 === 0 ? Math.abs((1 - o.fx - o.fw) - l[i + 1].fx) < 1e-9 && Math.abs(o.fy - l[i + 1].fy) < 1e-9 && Math.abs(o.fw - l[i + 1].fw) < 1e-9 : true);
  })()`));
  // 通道几何：所有静态布局的块-块 / 块-墙间隙 ≥ 0.14（场地 720px 时 = 100px ≥ 球径），保证球能穿过
  check('静态布局间隙 ≥ 球径（球可通行）', await evalJS(`(() => {
    const GAP = .14;
    for (const name of Object.keys(OBSTACLE_LAYOUTS)) {
      const list = OBSTACLE_LAYOUTS[name];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.kind === 'seg') continue;
        if (a.fx < GAP || a.fy < GAP || 1 - (a.fx + a.fw) < GAP || 1 - (a.fy + a.fh) < GAP) return name + ' 墙距不足';
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (b.kind === 'seg') continue;
          const gx = Math.max(a.fx - (b.fx + b.fw), b.fx - (a.fx + a.fw));
          const gy = Math.max(a.fy - (b.fy + b.fh), b.fy - (a.fy + a.fh));
          // 完全重叠（障碍加厚）允许；其余情况任一轴间隙 < 球径即窄缝
          if (gx < GAP && gy < GAP && (gx >= 0 || gy >= 0)) return name + ' 块间窄缝';
        }
      }
    }
    return 'ok';
  })()`));
  // 随机布局间隙约束：20 次生成全部满足（random / randomsym）
  check('随机布局间隙约束（20 次）', await evalJS(`(() => {
    const GAP = .15;
    const okAll = (list) => {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.fx < GAP || a.fy < GAP || 1 - (a.fx + a.fw) < GAP || 1 - (a.fy + a.fh) < GAP) return false;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          const gx = Math.max(a.fx - (b.fx + b.fw), b.fx - (a.fx + a.fw));
          const gy = Math.max(a.fy - (b.fy + b.fh), b.fy - (a.fy + a.fh));
          if (gx < GAP && gy < GAP && (gx >= 0 || gy >= 0)) return false;
        }
      }
      return true;
    };
    for (let t = 0; t < 20; t++) {
      if (!okAll(genRandomObstacles(false))) return 'random 第' + t + '次';
      if (!okAll(genRandomObstacles(true))) return 'randomsym 第' + t + '次';
    }
    return 'ok';
  })()`));

  console.log('== 2. 2v2 团战 ==');
  await openBattle(5);
  check('teams 划分（蓝 left/p2，红 right/p3）', await evalJS(`battle.teams && battle.teams.blue.length === 2 && battle.teams.red.length === 2 && teamOf('left') === 'blue' && teamOf('p2') === 'blue' && teamOf('right') === 'red' && teamOf('p3') === 'red'`));
  check('初始站位（蓝左红右）', await evalJS(`(() => {
    const F = battle.fieldFull;
    const mid = F.x + F.s / 2;
    return battle.orbs[0].x < mid && battle.orbs[2].x < mid && battle.orbs[1].x > mid && battle.orbs[3].x > mid;
  })()`));
  check('nearestFoe 排除队友', await evalJS(`nearestFoe(battle.orbs[0]).side === 'right' || nearestFoe(battle.orbs[0]).side === 'p3'`));
  check('队友碰撞无伤害', await evalJS(`(() => {
    const a = battle.orbs[0], b = battle.orbs[2];
    a.x = 400; a.y = 400; b.x = 445; b.y = 400;
    a.vx = 300; a.vy = 0; b.vx = -300; b.vy = 0;
    const h0 = a.hp + b.hp;
    collide(a, b);
    return h0 - (a.hp + b.hp) < 0.001;
  })()`));
  check('敌方碰撞有伤害', await evalJS(`(() => {
    const a = battle.orbs[0], b = battle.orbs[1];
    a.x = 400; a.y = 400; b.x = 445; b.y = 400;
    a.vx = 300; a.vy = 0; b.vx = -300; b.vy = 0;
    const h0 = a.hp + b.hp;
    collide(a, b);
    return h0 - (a.hp + b.hp) > 1;
  })()`));
  // 团灭蓝队 → 红队胜
  await evalJS(`(() => {
    killOrb(battle.orbs[0]);
    killOrb(battle.orbs[2]);
  })()`);
  check('蓝队全灭 → 红队胜', await evalJS(`battle.over && battle.winnerTeam === 'red'`));
  check('HUD 显示 2V2 团战', await evalJS(`document.getElementById('hud-vs').textContent === '2V2 团战'`));
  check('队伍面板标识', await evalJS(`document.querySelectorAll('.team-blue').length === 2 && document.querySelectorAll('.team-red').length === 2`));

  console.log('== 3. 2v2 超时按队伍总血量判胜 ==');
  await openBattle(5, `(() => {
    const b = battle.orbs[1], d = battle.orbs[3];
    b.hp = 100; d.hp = 100; // 红队残血
    battle.time = 119.5;
    updateBattle(1);
  })()`);
  check('超时红队残血 → 蓝队胜', await evalJS(`battle.over && battle.winnerTeam === 'blue'`));

  console.log('== 4. 4v1 BOSS 战 ==');
  await openBattle(6);
  check('5 个球（4 玩家 + BOSS）', await evalJS(`battle.orbs.length === 5 && battle.orbs[4].side === 'boss'`));
  check('BOSS 属性（1800 血/62 半径/能力随机合法）', await evalJS(`(() => {
    const b = battle.orbs[4];
    return b.maxHp === 1800 && b.r === 62 && ABILITIES.some(a => a.id === b.ability) && (!b.skill2 || ABILITIES.some(a => a.id === b.skill2));
  })()`), await evalJS(`JSON.stringify({hp: battle.orbs[4].maxHp, r: battle.orbs[4].r, ab: battle.orbs[4].ability, s2: battle.orbs[4].skill2})`));
  check('BOSS 能力随机抽取（30 次 ≥ 3 种）', await evalJS(`(() => {
    const seen = new Set();
    for (let i = 0; i < 30; i++) seen.add(makeBossCfg().ability);
    return seen.size >= 3;
  })()`));
  check('BOSS 能力排除 railgun（机制特殊）', await evalJS(`(() => {
    for (let i = 0; i < 30; i++) { const c = makeBossCfg(); if (c.ability === 'railgun' || c.skill2 === 'railgun') return false; }
    return true;
  })()`));
  check('teams 划分（players 4 球 vs boss）', await evalJS(`battle.teams.players.length === 4 && battle.teams.boss.length === 1 && teamOf('boss') === 'boss' && teamOf('left') === 'players'`));
  check('玩家 nearestFoe 是 BOSS', await evalJS(`nearestFoe(battle.orbs[0]).side === 'boss'`));
  check('玩家互撞无伤害（同队）', await evalJS(`(() => {
    const a = battle.orbs[0], b = battle.orbs[1];
    a.x = 400; a.y = 400; b.x = 445; b.y = 400;
    a.vx = 300; a.vy = 0; b.vx = -300; b.vy = 0;
    const h0 = a.hp + b.hp;
    collide(a, b);
    return h0 - (a.hp + b.hp) < 0.001;
  })()`));
  check('BOSS 中央血条存在', await evalJS(`!!document.getElementById('hud-boss') && !!document.getElementById('hp-boss')`));
  check('玩家面板 4 个（BOSS 不占四角）', await evalJS(`document.querySelectorAll('.hud-side').length === 4 && !document.getElementById('hud-side-boss')`));
  // BOSS 死亡 → 玩家队胜
  await evalJS(`(() => {
    killOrb(battle.orbs[4]);
  })()`);
  check('BOSS 阵亡 → 玩家队胜', await evalJS(`battle.over && battle.winnerTeam === 'players'`));

  console.log('== 5. 4v1 BOSS：玩家全灭 → BOSS 胜 ==');
  await openBattle(6, `(() => {
    for (let i = 0; i < 4; i++) killOrb(battle.orbs[i]);
  })()`);
  check('玩家全灭 → BOSS 胜', await evalJS(`battle.over && battle.winnerTeam === 'boss'`));

  console.log('== 5b. 无量合成：队伍判定 ==');
  // 队伍模式：同队两球合成 → 队友不互炸
  await openBattle(5);
  const fuseSame = await evalJS(`(() => {
    battle.structs.push({ type: 'wuliangball', owner: 'left', kind: 'cang', x: 500, y: 400, vx: 0, vy: 0, life: 13, r: 26, hitT: 0 });
    battle.structs.push({ type: 'wuliangball', owner: 'p2', kind: 'heng', x: 560, y: 400, vx: 0, vy: 0, life: 13, r: 26, hitT: 0 }); // 同队（蓝）
    const a = battle.orbs[0], c = battle.orbs[2];
    a.x = 500; a.y = 250; c.x = 560; c.y = 250; // 远离爆炸点
    const h0 = a.hp + c.hp;
    for (let i = 0; i < 30; i++) updateStructs(1 / 60);
    return { dmg: +(h0 - (a.hp + c.hp)).toFixed(1), hasBi: battle.structs.some(x => x.type === 'wulianbi') };
  })()`);
  check('队伍模式同队合成不互炸', fuseSame.dmg < 1, 'dmg=' + fuseSame.dmg);
  // 传统模式：跨方合成 → 双方都受波及
  await openBattle(2);
  const fuseCross = await evalJS(`(() => {
    battle.structs.push({ type: 'wuliangball', owner: 'left', kind: 'cang', x: 500, y: 400, vx: 0, vy: 0, life: 13, r: 26, hitT: 0 });
    battle.structs.push({ type: 'wuliangball', owner: 'right', kind: 'heng', x: 560, y: 400, vx: 0, vy: 0, life: 13, r: 26, hitT: 0 });
    battle.left.x = 500; battle.left.y = 250; battle.right.x = 560; battle.right.y = 600;
    const h0 = battle.left.hp + battle.right.hp;
    for (let i = 0; i < 30; i++) updateStructs(1 / 60);
    return { dmg: +(h0 - (battle.left.hp + battle.right.hp)).toFixed(1) };
  })()`);
  check('传统模式跨方合成自伤', fuseCross.dmg >= 40, 'dmg=' + fuseCross.dmg);

  console.log('== 6. 全组合稳定性（2v2 + 缩圈 + 对称随机障碍 + 双能力，推进 30s） ==');
  await evalJS(`(() => {
    gameMode = 5;
    gameRules = { shrink: true, obstacles: 'randomsym', multiSkill: true };
    buildPanels();
    randomizeAll();
    players = {};
    panelKeys(5).forEach(k => players[k] = readConfig(k));
    startBattle();
    for (let i = 0; i < 1800; i++) updateBattle(1 / 60);
    return { t: battle.time.toFixed(0), over: battle.over, winnerTeam: battle.winnerTeam || null, alive: battle.orbs.filter(o => o.alive).length,
      ob: battle.obstAbs.length, shrinkLv: battle.shrink.level, teams: !!battle.teams };
  })()`).then(r => {
    check('组合战斗正常推进', r && r.t > 25 && r.teams && r.ob === 4 && r.shrinkLv >= 1, JSON.stringify(r));
    check('终局有明确胜队或平局', r.over ? (r.winnerTeam === 'blue' || r.winnerTeam === 'red' || r.winnerTeam === null) : true);
  });

  console.log('== 7. JS 异常 ==');
  check('无未捕获异常', exceptions.length === 0, exceptions.slice(0, 3).join(' | '));

  ws.close(); chrome.kill();
  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
