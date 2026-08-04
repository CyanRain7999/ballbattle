// 一次性验证：sim.html 图形化模拟器（无 JS 错误 + 1v1/排行/混战能跑出结果）
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
const URL = 'file:///' + path.join(ROOT, 'sim.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function assert(cond, label, detail) {
  if (cond) console.log('[PASS]', label);
  else { failures++; console.log('[FAIL]', label, detail || ''); }
}

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbsim-'));
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
    const send = (method, params = {}) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const evalJS = async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (r.result?.exceptionDetails) errors.push('eval: ' + (r.result.exceptionDetails.exception?.description || '').split('\n')[0]);
      return r.result?.result?.value;
    };
    const waitStatus = async (pat, timeout) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const s = await evalJS(`document.getElementById('status').textContent`);
        if (s && s.includes(pat)) return s;
        await sleep(300);
      }
      return null;
    };
    await send('Runtime.enable');
    await send('Page.navigate', { url: URL });
    await sleep(2500);

    // 页面结构
    const ui = await evalJS(`JSON.stringify({
      abilities: document.querySelectorAll('#A-ability option').length,
      sliders: document.querySelectorAll('#A-sliders input[type=range]').length,
      brawlRows: document.querySelectorAll('.brawl-row').length,
      modes: document.querySelectorAll('#mode-switch .mode-btn').length,
      title: document.title
    })`);
    const u = JSON.parse(ui);
    assert(u.abilities === 49, 'A 能力下拉 49 项', ui);
    assert(u.sliders === 8, 'A 面板 8 个数值滑块（每球全参数）', ui);
    assert(u.brawlRows === 4, '混战 4 球位', ui);
    assert(u.modes === 4, '4 种模式', ui);

    // —— 1v1：pulse vs shield，n=20 ——
    await evalJS(`(() => {
      document.getElementById('p-n').value = 20;
      document.getElementById('A-ability').value = 'pulse';
      document.getElementById('B-ability').value = 'shield';
      document.getElementById('btn-run').click();
    })()`);
    const s1 = await waitStatus('完成', 30000);
    const r1 = await evalJS(`JSON.stringify({ meta: document.getElementById('result-meta').textContent, hasBar: !!document.querySelector('.res-bar'), bodyLen: document.getElementById('result-body').innerHTML.length })`);
    assert(s1 && s1.startsWith('✓'), '1v1 完成（20 场）', s1);
    assert(r1 && JSON.parse(r1).hasBar, '1v1 结果渲染条形图', r1);

    // —— 排行：bench=shield，n=5（49×5=245 场）——
    await evalJS(`(() => {
      document.querySelector('[data-mode="rank"]').click();
      document.getElementById('p-n').value = 5;
      document.getElementById('btn-run').click();
    })()`);
    const s2 = await waitStatus('完成', 120000);
    const r2 = await evalJS(`JSON.stringify({ rows: document.querySelectorAll('.tbl tr').length, first: document.querySelector('.tbl .ab') ? document.querySelector('.tbl .ab').textContent : '' })`);
    assert(s2 && s2.startsWith('✓'), '排行模式完成（245 场）', s2);
    assert(r2 && JSON.parse(r2).rows === 50, '排行表 49 行 + 表头', r2);

    // —— 混战 3P：n=15 ——
    await evalJS(`(() => {
      document.querySelector('[data-mode="brawl"]').click();
      document.getElementById('p-pn').value = 3;
      document.getElementById('p-n').value = 15;
      document.getElementById('btn-run').click();
    })()`);
    const s3 = await waitStatus('完成', 60000);
    const r3 = await evalJS(`JSON.stringify({ lines: document.querySelectorAll('.res-line').length, meta: document.getElementById('result-meta').textContent })`);
    assert(s3 && s3.startsWith('✓'), '混战 3P 完成', s3);
    assert(r3 && JSON.parse(r3).lines === 3, '混战结果 3 行', r3);

    console.log('JS 错误:', errors.length ? errors : '无');
    ws.close();
    chrome.kill();
    process.exit(failures || errors.length ? 1 : 0);
  } catch (e) {
    console.error('验证失败:', e.message);
    chrome.kill();
    process.exit(1);
  }
})();
