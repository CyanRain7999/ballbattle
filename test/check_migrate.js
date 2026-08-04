// 旧版按球位配置（orbs.left 等）自动迁移到新版按球种（abilities）验证
// 覆盖：旧结构迁移 + 全局保留 + 存储改写 + 默认倍率补齐
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
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function assert(cond, label, detail) {
  if (cond) console.log('[PASS]', label);
  else { failures++; console.log('[FAIL]', label, detail || ''); }
}

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbmig-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + userDir, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  try {
    const portFile = path.join(userDir, 'DevToolsActivePort');
    let port = null;
    for (let i = 0; i < 60 && !port; i++) {
      try { port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0], 10); } catch (e) {}
      if (!port) await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
    const page = pages.find(p => p.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const pending = new Map();
    const errors = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
    };
    const send = (method, params = {}) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const evalJS = async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (r.result?.exceptionDetails) errors.push('eval: ' + (r.result.exceptionDetails.exception?.description || '').split('\n')[0]);
      return r.result?.result?.value;
    };
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'file:///' + path.join(ROOT, 'editor.html').replace(/\\/g, '/') });
    await sleep(1500);
    // 预置旧结构配置（left.maxHp=600, left.r=55, right.cruise=450, 全局 dmgMult=1.8）后刷新
    await evalJS(`localStorage.setItem('orb_balance_v1', JSON.stringify({ global: { dmgMult: 1.8 }, orbs: { left: { maxHp: 600, r: 55 }, right: { cruise: 450 } } })); location.reload();`);
    await sleep(2000);
    const r = await evalJS(`JSON.stringify({
      pulseHp: BALANCE.abilities.pulse.maxHp,
      pulseR: BALANCE.abilities.pulse.r,
      shieldCruise: BALANCE.abilities.shield.cruise,
      dmgMult: BALANCE.global.dmgMult,
      storedHasAbilities: JSON.parse(localStorage.getItem('orb_balance_v1')).abilities !== undefined,
      storedNoOrbs: JSON.parse(localStorage.getItem('orb_balance_v1')).orbs === undefined,
      pulseSkill: BALANCE.abilities.pulse.skillMult,
      allAbilities: Object.keys(BALANCE.abilities).length
    })`);
    const m = JSON.parse(r);
    assert(m.pulseHp === 600, '旧 orbs.left.maxHp=600 → abilities.pulse.maxHp=600', r);
    assert(m.pulseR === 55, '旧 orbs.left.r=55 → abilities.pulse.r=55', r);
    assert(m.shieldCruise === 450, '旧 orbs.right.cruise=450 → abilities.shield.cruise=450', r);
    assert(m.dmgMult === 1.8, '全局 dmgMult=1.8 保留', r);
    assert(m.storedHasAbilities && m.storedNoOrbs, '存储已改写为新结构（abilities 存在 / orbs 删除）', r);
    assert(m.pulseSkill === 1, '默认倍率字段自动补齐（skillMult=1）', r);
    assert(m.allAbilities === 49, 'abilities 表覆盖全部 49 个球种', r);
    assert(errors.length === 0, '无 JS 异常', errors.join('; '));
    ws.close();
    chrome.kill();
    process.exit(failures ? 1 : 0);
  } catch (e) {
    console.error('验证失败:', e.message);
    chrome.kill();
    process.exit(1);
  }
})();
