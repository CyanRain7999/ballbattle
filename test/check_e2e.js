// 端到端验证：editor.html 保存数值 → index.html 游戏读取生效
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbe2e-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${userDir}`, '--window-size=1360,860', '--no-first-run', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    const portFile = path.join(userDir, 'DevToolsActivePort');
    let port = null;
    for (let i = 0; i < 60 && !port; i++) {
      try { port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0], 10); } catch (e) {}
      if (!port) await sleep(250);
    }
    const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = pages.find(p => p.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const pending = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const evalJS = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
    await send('Runtime.enable');

    // 1) 编辑器：改药剂师 chemist.maxHp=600，保存
    await send('Page.navigate', { url: 'file:///' + path.join(ROOT, 'editor.html').replace(/\\/g, '/') });
    await sleep(2000);
    await evalJS(`(() => {
      const g = document.querySelector('#g-dmgMult'); g.value = 2.0; g.dispatchEvent(new Event('input'));
      const sel = document.querySelector('#ab-pick'); sel.value = 'chemist'; sel.dispatchEvent(new Event('change'));
      const h = document.querySelector('#ab-chemist-maxHp'); h.value = 600; h.dispatchEvent(new Event('input'));
      document.getElementById('btn-save').click();
    })()`);
    console.log('编辑器已保存 chemist.maxHp=600, dmgMult=2.0');

    // 2) 游戏：检查 BALANCE 读取（abilities 结构）+ 战斗中按球种生效
    await send('Page.navigate', { url: 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') });
    await sleep(2200);
    const bal = await evalJS(`JSON.stringify({ dmgMult: BALANCE.global.dmgMult, chemistHp: BALANCE.abilities.chemist.maxHp, pulseHp: BALANCE.abilities.pulse.maxHp, shieldHp: BALANCE.abilities.shield.maxHp })`);
    console.log('游戏读取 BALANCE:', bal);
    // 直接开战：left 选药剂师（chemist），right 选脉冲（pulse）→ 药剂师 600 血、脉冲 400 血
    await evalJS(`(() => {
      const cards = document.querySelectorAll('#panel-left #ab-left .card');
      cards[ABILITIES.findIndex(a => a.id === 'chemist')].click();
      const cards2 = document.querySelectorAll('#panel-right #ab-right .card');
      cards2[ABILITIES.findIndex(a => a.id === 'pulse')].click();
      document.querySelector('#btn-start').click();
    })()`);
    await sleep(3500);
    const orb = await evalJS(`JSON.stringify(battle ? { leftHp: battle.orbs[0].hp, leftMax: battle.orbs[0].maxHp, rightMax: battle.orbs[1].maxHp, leftAb: battle.orbs[0].ability } : null)`);
    console.log('战斗中球属性:', orb);
    const ob = JSON.parse(orb);
    if (!ob || ob.leftAb !== 'chemist' || ob.leftMax !== 600 || ob.rightMax !== 400) {
      console.error('✗ 按球种数值未生效：期望 left=chemist/600HP, right=400HP');
      process.exit(1);
    }
    console.log('✓ 按球种精准生效：药剂师 600 血、脉冲 400 血');
    ws.close();
    chrome.kill();
  } catch (e) {
    console.error('验证失败:', e.message);
    chrome.kill();
    process.exit(1);
  }
})();
