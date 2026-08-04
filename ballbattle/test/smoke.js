// CDP 冒烟测试：真实时间控制截图 + DOM/像素断言 + 异常捕获
// 依赖本机 Chrome（默认路径），无 npm 依赖
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
if (!CHROME) {
  console.error('未找到 Chrome/Edge，请设置 CHROME_PATH 环境变量');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const SHOT_DIR_ENV = process.env.SHOT_DIR;
const OUT = SHOT_DIR_ENV || fs.mkdtempSync(path.join(os.tmpdir(), 'orbarena-'));
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function assert(cond, label, detail) {
  if (cond) console.log('[PASS]', label);
  else { failures++; console.log('[FAIL]', label, detail || ''); }
}

async function main() {
  // 随机端口：--remote-debugging-port=0，端口写入 user-data-dir 的 DevToolsActivePort
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbchrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${userDir}`, '--window-size=1360,860', '--no-first-run', 'about:blank'
  ], { stdio: 'ignore' });

  const cleanup = async () => {
    if (chrome && !chrome.killed) chrome.kill();
    await Promise.race([
      new Promise(r => chrome.once('exit', r)),
      sleep(1500),
    ]);
    await sleep(300); // Windows 下等待文件句柄释放
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
    if (!SHOT_DIR_ENV) { try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) { /* 忽略 */ } }
  };

  try {
    // 从 DevToolsActivePort 读取实际调试端口
    const portFile = path.join(userDir, 'DevToolsActivePort');
    let port = null;
    for (let i = 0; i < 60 && !port; i++) {
      try { port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0], 10); } catch (e) { /* retry */ }
      if (!port) await sleep(250);
    }
    if (!port) throw new Error('DevToolsActivePort 未生成');

    // 校验端口的 /json 归属：要求页面 URL 是 about:blank（我们自己的实例）
    let page = null;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json`);
        const pages = await r.json();
        page = pages.find(p => p.type === 'page');
        if (page) break;
      } catch (e) { /* retry */ }
      await sleep(250);
    }
    if (!page) throw new Error('CDP 端口未就绪');
    if (page.url !== 'about:blank') throw new Error('端口被其他浏览器实例占用: ' + page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await Promise.race([
      new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('WebSocket 连接超时')), 10000)),
    ]);
    ws.onclose = () => { /* 连接中断时由各 send 超时兜底 */ };
    let msgId = 0;
    const pending = new Map();
    const exceptions = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method === 'Runtime.exceptionThrown') {
        exceptions.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
      }
      else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        exceptions.push('[log] ' + m.params.entry.text);
      }
    };
    const send = (method, params = {}, timeout = 10000) => new Promise(res => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); res({ error: { message: 'CDP 调用超时: ' + method } }); } }, timeout);
    });
    const evalJS = async (expr, awaitPromise = false, timeout = 10000) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, timeout);
      if (r.error) { exceptions.push('eval超时: ' + expr.slice(0, 60)); return null; }
      if (r.result?.exceptionDetails) exceptions.push('eval: ' + (r.result.exceptionDetails.exception?.description || '').split('\n')[0]);
      return r.result?.result?.value;
    };
    const shot = async name => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      if (r.error) throw new Error('截图失败: ' + name);
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
      console.log('[截图]', name, '->', OUT);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.navigate', { url: URL });
    await sleep(1800);

    // —— 选择屏断言 ——
    const sel = await evalJS(`({
      swatches: document.querySelectorAll('#panel-left .swatch').length,
      decCards: document.querySelectorAll('#panel-left #dc-left .card').length,
      abCards: document.querySelectorAll('#panel-left #ab-left .card').length,
      preview: !!document.querySelector('#preview-left'),
      active: document.querySelector('.screen.active')?.id
    })`);
    assert(sel.swatches === 16, '选择屏: 16 色板', JSON.stringify(sel));
    assert(sel.decCards === 12, '选择屏: 12 装饰', JSON.stringify(sel));
    assert(sel.abCards === 49, '选择屏: 49 能力', JSON.stringify(sel));
    assert(sel.preview, '选择屏: 预览 canvas 存在', JSON.stringify(sel));
    assert(sel.active === 'screen-select', '选择屏: 初始屏为选择屏', JSON.stringify(sel));
    await shot('shot-select.png');

    // 点击启动战斗 -> 转场
    await evalJS(`document.querySelector('#btn-start').click()`);
    await sleep(1000);
    const trans = await evalJS(`document.querySelector('.screen.active')?.id`);
    assert(trans === 'screen-transition', '转场屏: 点击后进入转场', JSON.stringify(trans));
    await shot('shot-transition.png');
    await sleep(2300); // 转场 1.9s + 0.22s 后开战

    // 游戏开局方向完全随机（零干预设计），测试注入水平对冲（对齐位置与 y 坐标）保证碰撞断言稳定
    await evalJS(`if (battle) {
      const f = fieldRect();
      battle.left.x = f.x + f.s * .3; battle.left.y = f.y + f.s / 2;
      battle.right.x = f.x + f.s * .7; battle.right.y = f.y + f.s / 2;
      battle.left.vx = 300; battle.left.vy = 0;
      battle.right.vx = -300; battle.right.vy = 0;
    }`);

    // —— 战斗屏断言（轮询等待伤害产生：近战靠碰撞、远程靠能力）——
    const bat = await evalJS(`(async () => {
      const t0 = performance.now();
      let s = null;
      while (performance.now() - t0 < 14000) {
        if (battle && (battle.left.hp < battle.left.maxHp || battle.right.hp < battle.right.maxHp)) {
          const c = document.getElementById('battle-canvas');
          const g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let bright = 0;
          for (let i = 0; i < d.length; i += 16) {
            if (d[i] + d[i+1] + d[i+2] > 200) bright++;
          }
          s = {
            active: document.querySelector('.screen.active')?.id,
            time: battle.time, hpL: battle.left.hp, hpR: battle.right.hp,
            inField: battle.left.x > 0 && battle.left.x < innerWidth &&
                     battle.right.x > 0 && battle.right.x < innerWidth,
            brightPx: bright
          };
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return s || { timeout: true };
    })()`, true, 18000);
    assert(bat && !bat.timeout, '战斗屏: 轮询到伤害产生（碰撞或远程能力）', JSON.stringify(bat));
    // 职业名显示（血条下方）
    const job = await evalJS(`(() => {
      const l = document.getElementById('hud-job-left');
      const r = document.getElementById('hud-job-right');
      return { l: l ? l.textContent : null, r: r ? r.textContent : null };
    })()`);
    assert(job && job.l && job.l.indexOf('◈') === 0 && job.r && job.r.indexOf('◈') === 0, '战斗屏: 血条下显示职业名', JSON.stringify(job));
    // 数值断言：全局伤害 +50% 生效（hitOrb(10) → 15），防回归
    const dmgChk = await evalJS(`(() => {
      battle.vamp = null; // 排除吸血鬼庇护干扰
      battle.left.shieldT = 0; battle.left.regenT = 0; // 排除护盾/回血干扰
      if (battle.over || battle.left.hp <= 15) return -1;
      const before = battle.left.hp;
      hitOrb(battle.left, 10, battle.right, true);
      return Math.round(before - battle.left.hp);
    })()`);
    assert(dmgChk === 15, '数值: 全局伤害 +50%（10→15）', JSON.stringify(dmgChk));
    assert(bat?.active === 'screen-battle', '战斗屏: 转场后进入战斗', JSON.stringify(bat));
    assert(bat?.inField === true, '战斗屏: 双球位于场地内', JSON.stringify(bat));
    assert(bat?.brightPx > 500, '战斗屏: canvas 有大量渲染像素（球+特效）', JSON.stringify(bat));
    await shot('shot-battle.png');

    // 加速收尾 + 结算屏断言（远程对远程可能不撞击，轮询等待结算，超时则注入兜底）
    // 清零回血/护盾/逃脱状态，避免 repair/shield 组合下 hp=6 打不死
    await evalJS(`battle.left.hp = 6; battle.right.hp = 6;
      battle.left.regenT = 0; battle.right.regenT = 0;
      battle.left.shieldT = 0; battle.right.shieldT = 0;`);
    const res = await evalJS(`(async () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 12000) {
        if (document.querySelector('.screen.active')?.id === 'screen-result') {
          return {
            active: 'screen-result',
            title: document.querySelector('#result-title')?.textContent,
            sub: document.querySelector('#result-sub')?.textContent
          };
        }
        // 周期重清零：防止 repair/shield 在轮询期间重新激活拖时
        battle.left.regenT = 0; battle.right.regenT = 0;
        battle.left.shieldT = 0; battle.right.shieldT = 0;
        await new Promise(r => setTimeout(r, 300));
      }
      battle.over = true; battle.winner = battle.left; showResult();
      await new Promise(r => setTimeout(r, 300));
      return {
        active: document.querySelector('.screen.active')?.id,
        title: document.querySelector('#result-title')?.textContent,
        sub: document.querySelector('#result-sub')?.textContent,
        fallback: true
      };
    })()`, true, 18000);
    assert(res.active === 'screen-result', '结算屏: 战斗结束进入结算', JSON.stringify(res));
    assert(/胜利/.test(res.title || ''), '结算屏: 显示胜利者', JSON.stringify(res));
    assert(!res.fallback, '结算屏: 战斗自然结束（未走兜底注入）', JSON.stringify(res));
    await shot('shot-result.png');

    assert(exceptions.length === 0, '无 JS 异常', exceptions.join(' | '));

    ws.close();
    console.log(failures === 0 ? '\n=== 全部断言通过 ===' : `\n=== ${failures} 项断言失败 ===`);
    return failures === 0;
  } finally {
    await cleanup();
  }
}
main().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('测试失败:', e.message); process.exit(1); });
