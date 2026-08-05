// 玩法模式验证：缩圈 / 障碍物 / 双能力 / 扩充色板与装饰
// 依赖本机 Chrome/Edge（与 verify_v8.js 相同），无 npm 依赖。运行：node test/check_modes.js
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
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbmodes-'));
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

  console.log('== 1. 数据完整性（扩充色板/装饰） ==');
  check('COLORS 16 色', await evalJS('COLORS.length === 16'), 'len=' + await evalJS('COLORS.length'));
  check('DECORS 12 款', await evalJS('DECORS.length === 12'), 'len=' + await evalJS('DECORS.length'));
  check('新装饰均有绘制函数', await evalJS(`['diamond','star','moon','gear','bolt','halo'].every(id => { const d = DECORS.find(x => x.id === id); return d && typeof d.draw === 'function'; })`));
  check('选择屏渲染新色板', await evalJS(`document.querySelectorAll('#panel-left .swatch').length === 16`), await evalJS(`document.querySelectorAll('#panel-left .swatch').length`));

  console.log('== 2. 规则按钮 UI ==');
  check('规则按钮存在', await evalJS(`document.querySelectorAll('#rules-switch .rule-btn').length === 4`));
  await evalJS(`document.querySelector('[data-rule=shrink]').click()`);
  check('缩圈开关', await evalJS(`gameRules.shrink === true`));
  await evalJS(`document.querySelector('[data-rule=obstacles]').click()`);
  await evalJS(`document.querySelector('[data-rule=obstacles]').click()`);
  check('障碍循环切换→四角块', await evalJS(`gameRules.obstacles === 'corners'`), await evalJS(`gameRules.obstacles`));
  await evalJS(`document.querySelector('[data-rule=multiSkill]').click()`);
  check('双能力开关', await evalJS(`gameRules.multiSkill === true`));
  check('双能力区显示', await evalJS(`document.getElementById('sec-skill2-left').style.display !== 'none'`));

  console.log('== 2b. 双能力自动分配 + 火力全开（三能力） ==');
  check('双能力开启后副槽自动分配', await evalJS(`document.getElementById('skill2-left').value !== 'none'`), await evalJS(`document.getElementById('skill2-left').value`));
  check('火力全开与双能力互斥', await evalJS(`(() => {
    document.querySelector('[data-rule=firepower]').click();
    return gameRules.firepower === true && gameRules.multiSkill === false;
  })()`));
  check('火力全开界面切换（3 能力槽 + 装饰/卡片隐藏）', await evalJS(`(() => {
    const p = document.getElementById('panel-left');
    return !!document.getElementById('skill1-left') && !!document.getElementById('skill2-left') && !!document.getElementById('skill3-left')
      && !document.getElementById('dc-left') && !document.getElementById('ab-left');
  })()`));
  check('槽②③自动分配且互不相同', await evalJS(`(() => {
    const s1 = document.getElementById('skill1-left').value;
    const s2 = document.getElementById('skill2-left').value;
    const s3 = document.getElementById('skill3-left').value;
    return s2 !== 'none' && s3 !== 'none' && s1 !== s2 && s1 !== s3 && s2 !== s3;
  })()`));
  // 三能力开战：shield + repair 副槽同时施放，职业名 "xx & yy & zz"
  await evalJS(`(() => {
    document.getElementById('skill1-left').value = 'pulse';
    document.getElementById('skill2-left').value = 'shield';
    document.getElementById('skill3-left').value = 'repair';
    document.getElementById('skill1-right').value = 'missile';
    document.getElementById('skill2-right').value = 'burn';
    document.getElementById('skill3-right').value = 'combo';
    players = {};
    panelKeys(gameMode).forEach(k => players[k] = readConfig(k));
    startBattle();
    const L = battle.left;
    L.cd2 = L.maxCd2 - .05; L.cd3 = L.maxCd3 - .05;
    updateBattle(.1);
    return { s2: L.skill2, s3: L.skill3, shieldT: L.shieldT, regenT: L.regenT,
      job: document.getElementById('hud-job-left').textContent,
      row3: document.getElementById('cdrow3-left').style.display };
  })()`).then(r => {
    check('三能力战斗生效（shield+repair 均施放）', r && r.s2 === 'shield' && r.s3 === 'repair' && r.shieldT > 0 && r.regenT > 0, JSON.stringify(r));
    check('职业名 xx & yy & zz', r && /&/.test(r.job), r && r.job);
    check('HUD 第三行 CD 条显示', r && r.row3 === 'flex');
  });
  // 恢复双能力形态供后续测试使用
  await evalJS(`document.querySelector('[data-rule=multiSkill]').click();`);

  console.log('== 3. 双能力（副能力独立 CD / 施放 / 伤害缩放） ==');
  // 主 pulse + 副 shield：选择屏读取配置 → 直接开战（跳过转场动画）
  await evalJS(`
    document.getElementById('skill2-left').value = 'shield';
    document.getElementById('skill2-right').value = 'repair';
    players = {};
    panelKeys(gameMode).forEach(k => players[k] = readConfig(k));
    startBattle();
  `);
  check('battle.rules 透传', await evalJS(`battle.rules.shrink && battle.rules.multiSkill && battle.rules.obstacles === 'corners'`));
  check('球带副能力字段', await evalJS(`battle.orbs[0].skill2 === 'shield' && battle.orbs[1].skill2 === 'repair'`));
  check('副能力 CD 惩罚 +30%', await evalJS(`Math.abs(battle.orbs[0].maxCd2 - 5.5 * 1.3 * BALANCE.global.cdMult) < .01`), await evalJS(`battle.orbs[0].maxCd2.toFixed(2)`));
  // 手动推进副能力 CD → 触发施放（shield → shieldT>0；repair → regenT>0）
  await evalJS(`
    const L = battle.orbs[0], R = battle.orbs[1];
    L.cd2 = L.maxCd2 - .05; R.cd2 = R.maxCd2 - .05;
    updateBattle(.1);
  `);
  check('副能力施放：护盾', await evalJS(`battle.orbs[0].shieldT > 0`));
  check('副能力施放：修复', await evalJS(`battle.orbs[1].regenT > 0`));
  // 副能力伤害 ×0.5：主能力 pulse 打一次记录伤害，副能力 pulse 再打一次对比（同步块内 rAF 不会插入）
  await evalJS(`(() => {
    battle.orbs[0].skill2 = null; // 先清副能力避免干扰
    battle.orbs[0].skillMul = 1; battle.orbs[0].skillMulUntil = 0; // 清除削弱窗口，保证主能力全伤基线
    battle.orbs[0].x = 400; battle.orbs[0].y = 400;
    battle.orbs[1].x = 520; battle.orbs[1].y = 400; // 拉近保证 pulse 命中
    const t1 = battle.orbs[1].hp;
    castAbility(battle.orbs[0], 'pulse', 1);
    window.__d1 = t1 - battle.orbs[1].hp;
    battle.orbs[1].hp = Math.min(battle.orbs[1].maxHp, battle.orbs[1].hp + 40);
    const t2 = battle.orbs[1].hp;
    castAbility(battle.orbs[0], 'pulse', .5);
    window.__d2 = t2 - battle.orbs[1].hp;
  })()`);
  const dmg = await evalJS(`({ d1: window.__d1, d2: window.__d2 })`);
  check('副能力伤害约为主能力一半', dmg && dmg.d1 > 0 && Math.abs(dmg.d2 / dmg.d1 - .5) < .2, JSON.stringify(dmg));
  check('副能力施放后 maxCd 不串扰', await evalJS(`battle.orbs[0].maxCd === 4 * BALANCE.global.cdMult`));

  console.log('== 4. 障碍物（四角块布局） ==');
  check('障碍绝对坐标生成', await evalJS(`battle.obstAbs && battle.obstAbs.length === 4 && battle.obstAbs[0].w > 50`));
  // 把一个球放进障碍内并向下飞 → bounceObstacles 应反射 vy 且把球推出
  await evalJS(`(() => {
    const o = battle.orbs[0];
    const ob = battle.obstAbs[0];
    o.x = ob.x + ob.w / 2; o.y = ob.y + ob.h / 2 - 2; o.vx = 0; o.vy = 120;
    bounceObstacles(o);
    return { vy: o.vy, inOb: o.x > ob.x && o.x < ob.x + ob.w && o.y > ob.y && o.y < ob.y + ob.h };
  })()`).then(r => {
    check('球撞障碍反弹', r.vy <= 0, 'vy=' + r.vy);
    check('球被推出障碍', !r.inOb);
  });
  check('旋转隔板布局生成', await evalJS(`
    gameRules.obstacles = 'spinner';
    battle = null;
    players = {};
    panelKeys(gameMode).forEach(k => players[k] = readConfig(k));
    startBattle();
    updateObstacles(battle, 0);
    const ok = battle.obstAbs.length === 1 && battle.obstAbs[0].kind === 'seg';
    const a0 = battle.spinnerA;
    updateObstacles(battle, 1);
    ok && battle.spinnerA !== a0;
  `));

  console.log('== 5. 缩圈 ==');
  await evalJS(`(() => {
    gameRules.shrink = true; gameRules.obstacles = 'cross';
    battle = null;
    players = {};
    panelKeys(gameMode).forEach(k => players[k] = readConfig(k));
    startBattle();
    battle.shrink.timer = 19.5;
    updateBattle(1); // 触发 Lv.1
    const s0 = battle.field.s;
    for (let i = 0; i < 60; i++) updateBattle(1 / 30); // 2s 逼近
    return { s0, s1: battle.field.s, fs: battle.fieldFull.s, level: battle.shrink.level };
  })()`).then(r => {
    check('20s 触发缩圈 Lv.1', r.level === 1, 'level=' + r.level);
    check('场地逐级缩小', r.s1 < r.s0 && r.s1 < r.fs, `${r.s0.toFixed(0)}→${r.s1.toFixed(0)}`);
  });
  // 贴圈灼伤：把球移到圈边，观察掉血
  await evalJS(`(() => {
    const o = battle.orbs[0];
    const hp0 = o.hp;
    // 另一球挪到对角静止，避免碰撞把测试球弹出灼伤带
    const f1 = battle.orbs[1];
    f1.x = battle.field.x + battle.field.s - 80; f1.y = battle.field.y + battle.field.s - 80;
    f1.vx = 0; f1.vy = 0;
    o.x = battle.field.x + o.r; o.y = battle.field.y + o.r;
    o.vx = 0; o.vy = 0; // 静止贴圈：每帧都处于灼伤带，掉血可稳定累积
    for (let i = 0; i < 30; i++) updateBattle(1 / 30);
    return { hp0, hp1: o.hp };
  })()`).then(r => {
    check('贴圈持续掉血', r.hp1 < r.hp0 - 1, `${r.hp0.toFixed(0)}→${r.hp1.toFixed(0)}`);
  });
  check('缩圈遮罩绘制无异常', await evalJS(`drawBattle(); 'ok'`) === 'ok');

  console.log('== 6. 全组合稳定性（缩圈+障碍+双能力，4P 混战推进 30s） ==');
  await evalJS(`(() => {
    gameMode = 4; gameRules.shrink = true; gameRules.obstacles = 'spinner'; gameRules.multiSkill = true;
    buildPanels();
    randomizeAll();
    players = {};
    panelKeys(4).forEach(k => players[k] = readConfig(k));
    startBattle();
    const L = battle.left;
    for (let i = 0; i < 1800; i++) updateBattle(1 / 60);
    return { alive: battle.orbs.filter(o2 => o2.alive).length, over: battle.over, winner: battle.winner && battle.winner.name, t: battle.time.toFixed(0),
       shrinkLv: battle.shrink.level, ob: battle.obstAbs.length, skill2: L.skill2, spd: Math.hypot(L.vx, L.vy).toFixed(0) };
  })()`).then(r => {
    // 30s 推进正常：战斗结束（可能 4P 全灭=平局 winner null，或仍有存活）
    check('组合战斗正常推进', r && r.t > 25 && (r.alive >= 1 || (r.over && r.winner === null)), JSON.stringify(r));
    check('缩圈与障碍共存', r.shrinkLv >= 1 && r.ob === 1, 'shrinkLv=' + r.shrinkLv + ' ob=' + r.ob);
  });

  console.log('== 7. JS 异常 ==');
  check('无未捕获异常', exceptions.length === 0, exceptions.slice(0, 3).join(' | '));

  ws.close(); chrome.kill();
  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
