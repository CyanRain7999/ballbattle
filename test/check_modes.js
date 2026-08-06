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
  check('规则按钮存在', await evalJS(`document.querySelectorAll('#rules-switch .rule-btn').length === 5`));
  await evalJS(`document.querySelector('[data-rule=shrink]').click()`);
  check('缩圈开关', await evalJS(`gameRules.shrink === true`));
  await evalJS(`document.querySelector('[data-rule=obstacles]').click()`);
  await evalJS(`document.querySelector('[data-rule=obstacles]').click()`);
  check('障碍循环切换→四角块', await evalJS(`gameRules.obstacles === 'corners'`), await evalJS(`gameRules.obstacles`));
  await evalJS(`document.querySelector('[data-rule=multiSkill]').click()`);
  check('双能力开关', await evalJS(`gameRules.multiSkill === true`));
  check('双能力区显示', await evalJS(`document.getElementById('sec-skill2-left').style.display !== 'none'`));

  console.log('== 2c. 场地尺寸档位（100% / 90% / 80% / 70%） ==');
  const sFull = await evalJS(`(() => { gameRules.fieldScale = 1; return fieldRect().s; })()`);
  check('场地按钮存在', await evalJS(`!!document.querySelector('[data-rule=fieldScale]')`));
  check('点击切换 100%→90%', await evalJS(`(() => {
    document.querySelector('[data-rule=fieldScale]').click();
    return gameRules.fieldScale === .9 && document.querySelector('[data-rule=fieldScale]').textContent.includes('90%');
  })()`));
  check('90%→80%→70%→100% 循环', await evalJS(`(() => {
    const b = document.querySelector('[data-rule=fieldScale]');
    b.click(); b.click(); b.click();
    return gameRules.fieldScale === 1 && b.textContent.includes('100%');
  })()`));
  check('场地实际缩小（90% 档）', await evalJS(`(() => {
    gameRules.fieldScale = .9;
    return Math.abs(fieldRect().s / ${sFull} - .9) < .005;
  })()`));
  check('场地实际缩小（70% 档）', await evalJS(`(() => {
    gameRules.fieldScale = .7;
    return Math.abs(fieldRect().s / ${sFull} - .7) < .005;
  })()`));
  check('70% 场地开战正常', await evalJS(`(() => {
    gameRules.fieldScale = .7;
    battle = null; players = {};
    panelKeys(gameMode).forEach(k => players[k] = readConfig(k));
    startBattle();
    return !!battle && Math.abs(battle.field.s / ${sFull} - .7) < .005 && battle.orbs.every(o => o.x > battle.field.x - o.r && o.x < battle.field.x + battle.field.s + o.r && o.y > battle.field.y - o.r && o.y < battle.field.y + battle.field.s + o.r);
  })()`));
  check('70% 场地 + 缩圈共存', await evalJS(`(() => {
    gameRules.shrink = true;
    updateShrink(battle, 21);
    return battle.field.s < battle.fieldFull.s;
  })()`));
  await evalJS(`gameRules.shrink = true; gameRules.fieldScale = 1;`); // 恢复第 2 段的缩圈开启状态

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
    check('球撞障碍反弹（被推出且阻尼生效）', r && !r.inOb && Math.abs(r.vy) < 120, 'vy=' + r.vy);
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

  console.log('== 7. 转场特写 + 随机老虎机 + 选择屏压缩 ==');
  check('转场舞台 canvas 存在', await evalJS(`!!document.getElementById('trans-stage')`));
  // 手动启动（非随机）：关闭老虎机，转场 1.7s 后开战（先切回 2P 重建面板）
  await evalJS(`(() => {
    gameMode = 2;
    buildPanels();
    players = {};
    panelKeys(2).forEach(k => players[k] = readConfig(k));
    startGame();
    return { random: transRandom, slot: !!transSlot };
  })()`).then(r => {
    check('手动启动关闭老虎机', r.random === false && r.slot === false, JSON.stringify(r));
  });
  await sleep(2600);
  check('手动转场后开战', await evalJS(`!!battle && battle.orbs.length === 2`));
  // 随机启动：不预先随机 → 转场（前 ~5s 轮转，逐球错峰定格，最后一个定格后再展示 3s 开战）
  const snap = await evalJS(`JSON.stringify(players)`);
  await evalJS(`(() => {
    startRandomTransition();
    return { random: transRandom, slot: transSlot ? transSlot.length : 0, stops: transSlot ? transSlot.map(s => s.stopAt) : [], finals: transSlot ? transSlot.map(s => s.final) : [] };
  })()`).then(r => {
    check('随机启动开启老虎机', r.random === true && r.slot === 2, JSON.stringify(r));
    check('老虎机逐球错峰停止', r.stops[0] < r.stops[1] && r.stops[0] >= 3000, JSON.stringify(r.stops));
    check('随机结果不预先决定', r.finals.every(f => f === null), JSON.stringify(r.finals));
  });
  await sleep(3700);
  const rolled = await evalJS(`(() => {
    const allStopped = transSlot.every(s => s.stopped);
    const finalized = transSlot.every(s => s.final !== null);
    return { allStopped, finalized, playerChanged: JSON.stringify(players) !== ${JSON.stringify(snap)} };
  })()`);
  check('轮转停止时随机化已发生', rolled.playerChanged === true, JSON.stringify(rolled));
  check('轮转错峰未全部停止（约 3.7s）', rolled.allStopped === false, JSON.stringify(rolled));
  check('定格球为最终配置', rolled.finalized === true, JSON.stringify(rolled));
  check('转场时长 = 定格后 3s（2P ≈ 6.9s）', await evalJS(`(() => {
    const d = window.__lastTransDur;
    return d >= 6000 && d <= 8000 && d === transSlot[transSlot.length - 1].stopAt + 3000;
  })()`), await evalJS(`window.__lastTransDur`));
  await sleep(4000); // 定格展示 3s 后开战（检查点共 7.7s，转场 2P 6.9s，余量充足）
  check('定格展示 3 秒后开战', await evalJS(`!!battle`));
  // 选择屏压缩：能力卡片区限高滚动
  await evalJS(`showScreen('select'); buildPanels();`);
  check('能力卡片区限高滚动', await evalJS(`(() => {
    const cards = document.getElementById('ab-left');
    return !!cards && cards.scrollHeight > cards.clientHeight && cards.clientHeight > 0;
  })()`));

  console.log('== 7b. Bug 修复验证（浮游炮随死销毁 / 棺椁豁免 / 墙缝防振荡） ==');
  // 浮游炮：owner 死亡后炮台销毁且不再开火
  const d1 = await evalJS(`(() => {
    gameMode = 2; gameRules.multiSkill = false; gameRules.obstacles = 'none'; gameRules.shrink = false; gameRules.fieldScale = 1;
    buildPanels();
    players = {};
    players.left = readConfig('left'); players.right = readConfig('right');
    players.left.ability = 'drone'; players.right.ability = 'drone';
    battle = null; startBattle();
    const L = battle.left, R = battle.right;
    L.x = 300; L.y = 300; R.x = 420; R.y = 300;
    updateBattle(1);
    const before = battle.structs.filter(s => s.type === 'drone' && s.owner === 'left').length;
    L.hp = 0; L.alive = false;
    updateBattle(.5);
    const after = battle.structs.filter(s => s.type === 'drone' && s.owner === 'left').length;
    const projL = battle.proj.filter(p => p.type === 'dronebolt' && p.owner === 'left').length;
    return { before, after, projL };
  })()`);
  check('浮游炮 owner 死亡后炮台销毁', d1 && d1.before === 3 && d1.after === 0 && d1.projL === 0, JSON.stringify(d1));
  // 棺椁：本人豁免（可穿过自己的封锁区）+ 敌人被推出封锁区 + 阻尼防墙缝振荡
  const d2 = await evalJS(`(() => {
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
    // 豁免测试：本人瞬移进封锁区中心，敌人移到 zone 外（场地对角区）避免 collide 碰撞干扰
    L.x = zone.x + zone.w / 2; L.y = zone.y + zone.h / 2; L.vx = 0; L.vy = 0;
    R.x = F2.x + F2.s - (zone.x + zone.w / 2); R.y = F2.y + F2.s - (zone.y + zone.h / 2); R.vx = 0; R.vy = 0;
    updateBattle(.05);
    const ownMoved = Math.abs(L.x - (zone.x + zone.w / 2)) > 1 || Math.abs(L.y - (zone.y + zone.h / 2)) > 1;
    // 反弹测试：本人移出 zone 到对称点，敌人深入 zone（球心距边 > r）朝墙角冲。
    // 用纯 updateStructs 验证 zone 反弹本身（绕开蝴蝶/collide 等战斗干扰）
    L.x = F2.x + F2.s - (zone.x + zone.w / 2); L.y = F2.y + F2.s - (zone.y + zone.h / 2); L.vx = 0; L.vy = 0;
    R.x = zone.x + R.r + 20; R.y = zone.y + R.r + 20; R.vx = -80; R.vy = -80;
    const hp0 = R.hp;
    for (let i = 0; i < 8; i++) updateStructs(.05);
    const spd = Math.hypot(R.vx, R.vy);
    const out = !(R.x > zone.x && R.x < zone.x + zone.w && R.y > zone.y && R.y < zone.y + zone.h);
    return { zone: 'ok', ownMoved, foeOut: out, foeSpd: Math.round(spd), foeHpLost: Math.round(hp0 - R.hp) };
  })()`);
  check('棺椁本人可穿过自己的封锁区（豁免）', d2 && d2.zone === 'ok' && d2.ownMoved === false, JSON.stringify(d2));
  check('敌人被推出封锁区且阻尼减速', d2 && d2.zone === 'ok' && d2.foeOut === true && d2.foeSpd < 100, JSON.stringify(d2));
  check('敌人不再被持续磨血（推出区外）', d2 && d2.zone === 'ok' && d2.foeHpLost < 30, JSON.stringify(d2));
  // 障碍物反弹阻尼：夹缝反复反弹后速度衰减
  const d3 = await evalJS(`(() => {
    gameMode = 2; gameRules.multiSkill = false; gameRules.shrink = false; gameRules.fieldScale = 1; gameRules.obstacles = 'cross';
    buildPanels();
    players = {};
    players.left = readConfig('left'); players.right = readConfig('right');
    battle = null; startBattle();
    updateObstacles(battle, 0);
    const o = battle.orbs[0];
    o.vx = 120; o.vy = 0;
    const spd0 = Math.hypot(o.vx, o.vy);
    for (let i = 0; i < 8; i++) bounceObstacles(o); // 反复撞同一障碍
    const spd1 = Math.hypot(o.vx, o.vy);
    gameRules.obstacles = 'none';
    return { spd0: Math.round(spd0), spd1: Math.round(spd1) };
  })()`);
  check('障碍反弹阻尼（连续碰撞速度衰减）', d3 && d3.spd0 > 0 && d3.spd1 < d3.spd0, JSON.stringify(d3));
  // 墙缝脱困：封锁区贴墙边（球心距区边 < r）不再被反复弹磨血；障碍与墙之间不再卡死
  const d4 = await evalJS(`(() => {
    gameMode = 2; gameRules.multiSkill = false; gameRules.shrink = false; gameRules.fieldScale = 1; gameRules.obstacles = 'none';
    buildPanels();
    players = {}; players.left = readConfig('left'); players.right = readConfig('right');
    players.left.ability = 'coffin'; players.right.ability = 'missile';
    battle = null; startBattle();
    const L = battle.left, R = battle.right;
    L.hp = L.maxHp * .85;
    updateBattle(.1);
    const zone = battle.structs.find(s => s.type === 'coffinzone');
    if (!zone) return { zone: 'none' };
    const F2 = battle.field;
    // 敌人贴进 zone 与墙的缝（球心在 zone 内但距边 < r——修复前会被 clamp 拉回反复磨血）
    L.x = F2.x + F2.s - (zone.x + zone.w / 2); L.y = F2.y + F2.s - (zone.y + zone.h / 2); L.vx = 0; L.vy = 0;
    const zx = zone.x + 8, zy = zone.y + 8;
    R.x = Math.max(F2.x + R.r, zx); R.y = Math.max(F2.y + R.r, zy); R.vx = -60; R.vy = -60;
    const hp0 = R.hp;
    for (let i = 0; i < 8; i++) updateStructs(.05); // 纯 structs：贴边球不触发反弹 → 零伤害（蝴蝶/技能不干扰）
    const hpLost = Math.round(hp0 - R.hp);
    return { zone: 'ok', hpLost, Rx: Math.round(R.x), Ry: Math.round(R.y) };
  })()`);
  check('封锁区墙缝不再夹逼（贴边球不被磨血）', d4 && d4.zone === 'ok' && d4.hpLost < 20, JSON.stringify(d4));
  // 障碍物物理脱困：球心被塞进障碍内部（贴墙角块）→ bounceObstacles 必须把球推出到障碍外
  // （球心在障碍内的推出分支：最小穿透轴 + 越界回退四轴尝试；此处验证推出路径本身）
  const d5 = await evalJS(`(() => {
    gameMode = 2; gameRules.multiSkill = false; gameRules.shrink = false; gameRules.fieldScale = 1; gameRules.obstacles = 'corners';
    buildPanels();
    players = {}; players.left = readConfig('left'); players.right = readConfig('right');
    battle = null; startBattle();
    updateObstacles(battle, 0);
    const F3 = battle.field, o = battle.orbs[0];
    const ob = battle.obstAbs.find(x => x.x < F3.x + F3.s / 2 && x.y < F3.y + F3.s / 2); // 左上角块
    o.x = ob.x + 1; o.y = ob.y + ob.h / 2; // 球心深入障碍内
    bounceObstacles(o);
    const pushedOut = !(o.x > ob.x && o.x < ob.x + ob.w && o.y > ob.y && o.y < ob.y + ob.h);
    const inField = o.x > F3.x + o.r && o.x < F3.x + F3.s - o.r && o.y > F3.y + o.r && o.y < F3.y + F3.s - o.r;
    gameRules.obstacles = 'none';
    return { pushedOut, inField, x: Math.round(o.x), y: Math.round(o.y) };
  })()`);
  check('障碍物理脱困（球心在障碍内也能推出到场内）', d5 && d5.pushedOut === true && d5.inField === true, JSON.stringify(d5));
  await evalJS(`gameRules.obstacles = 'none';`);

  console.log('== 8. JS 异常 ==');
  check('无未捕获异常', exceptions.length === 0, exceptions.slice(0, 3).join(' | '));

  ws.close(); chrome.kill();
  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
