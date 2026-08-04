// 一次性验证：editor.html 在真实 Chrome 中渲染无 JS 异常、控件齐全
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
const URL = 'file:///' + path.join(ROOT, 'editor.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbedit-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${userDir}`, '--window-size=1400,1000', '--no-first-run', 'about:blank'
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
    const errors = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
    };
    const send = (method, params = {}) => new Promise(res => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
    await send('Runtime.enable');
    await send('Page.navigate', { url: URL });
    await sleep(2500);
    const r = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        abOptions: document.querySelectorAll('#ab-pick option').length,
        panelSliders: document.querySelectorAll('.ab-panel input[type=range]').length,
        globalSliders: document.querySelectorAll('.g-global input[type=range]').length,
        desc: document.getElementById('ab-desc').textContent.slice(0, 30),
        status: document.getElementById('status').textContent,
        saved: localStorage.getItem('orb_balance_v1') !== null,
        title: document.title
      })`,
      returnByValue: true,
    });
    const st = JSON.parse(r.result.result.value);
    console.log('页面状态:', r.result.result.value);
    const ok = st.abOptions === 49 && st.panelSliders === 8 && st.globalSliders === 7 && st.desc.length > 0;
    console.log(ok ? '✓ 结构断言通过（49 球种下拉 × 8 参数 + 全局 7 项）' : '✗ 结构断言失败');
    console.log('JS 错误:', errors.length ? errors : '无');
    let fail = !ok || errors.length > 0;
    // 交互测试：切换球种（药剂师）→ 改 maxHp → 保存
    await send('Runtime.evaluate', { expression: `
      (() => {
        const s = document.querySelector('#g-dmgMult');
        s.value = 2.5; s.dispatchEvent(new Event('input'));
        const sel = document.querySelector('#ab-pick');
        sel.value = 'chemist'; sel.dispatchEvent(new Event('change'));
        const h = document.querySelector('#ab-chemist-maxHp');
        h.value = 600; h.dispatchEvent(new Event('input'));
        document.getElementById('btn-save').click();
        const saved = JSON.parse(localStorage.getItem('orb_balance_v1'));
        return JSON.stringify({ before: document.getElementById('v-g-dmgMult').textContent, savedDmg: saved.global.dmgMult, chemistHp: saved.abilities.chemist.maxHp, pulseHp: saved.abilities.pulse.maxHp });
      })()` });
    const r2 = await send('Runtime.evaluate', { expression: `JSON.stringify({ val: document.getElementById('v-g-dmgMult').textContent, hpVal: document.getElementById('v-ab-chemist-maxHp').textContent, status: document.getElementById('status').textContent })`, returnByValue: true });
    console.log('切换球种+保存测试:', r2.result.result.value);
    const savedChk = JSON.parse(r2.result.result.value);
    if (savedChk.hpVal !== '600') fail = true;
    // 导入导出往返：导出 JSON 含 abilities 结构；导入后恢复且字段完整
    const r3 = await send('Runtime.evaluate', { expression: `(() => {
      const json = exportBalanceJSON();
      const parsed = JSON.parse(json);
      const hasNew = parsed.global.dmgMult === 2.5
        && parsed.abilities.chemist.maxHp === 600
        && parsed.abilities.chemist.skillMult === 1 && parsed.abilities.pulse.maxHp === 400;
      importBalanceJSON(json);
      const restored = BALANCE.abilities.chemist.maxHp === 600 && BALANCE.abilities.pulse.maxHp === 400;
      return JSON.stringify({ hasNew, restored });
    })()`, returnByValue: true });
    console.log('导入导出往返:', r3.result.result.value);
    const round = JSON.parse(r3.result.result.value);
    if (!round.hasNew || !round.restored) fail = true;
    if (r2.result?.exceptionDetails) fail = true;
    ws.close();
    chrome.kill();
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error('验证失败:', e.message);
    chrome.kill();
    process.exit(1);
  }
})();
