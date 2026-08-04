// ---------------- Headless 战斗沙箱 ----------------
// 在 Node 中加载浏览器战斗逻辑（core/data/effects/balance/entities/battle），
// stub 掉 DOM / 音频 / 特效 / 渲染，暴露 __runMatch / __runMatchN 批量模拟接口。
//
// 用法：
//   const h = require('./harness');
//   const s = h.createSandbox({ balance, seed, fieldSize });
//   const r = s.runMatch(cfgA, cfgB, { maxTime, dt });   // { winner:'left'|'right'|null, time, hp:[..] }
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/core.js',
  'js/data.js',
  'js/balance.js',
  'js/effects.js',
  'js/entities.js',
  'js/battle.js',
];

// 可复现随机数（mulberry32），seed 为空则用真随机
function makeRng(seed) {
  if (seed === undefined || seed === null) return Math.random;
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSandbox(opts = {}) {
  const fieldSize = opts.fieldSize || 720;
  const dt = opts.dt || 1 / 60;

  // ---- 假 DOM 元素（core.js 顶层会 querySelector('#battle-canvas').getContext('2d')）----
  const fakeCtx = () => new Proxy({}, { get: (t, k) => {
    if (k === 'canvas') return {};
    if (typeof k === 'symbol') return undefined;
    return t[k] !== undefined ? t[k] : (() => {});
  }, set: () => true });
  const fakeEl = () => ({
    style: {}, classList: { add() {}, remove() {}, toggle() {} },
    getContext: fakeCtx,
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    insertBefore() {}, appendChild() {}, removeChild() {}, addEventListener() {},
    set textContent(v) {}, get textContent() { return ''; },
    set innerHTML(v) {}, set className(v) {}, set id(v) {}, set onclick(v) {},
    set value(v) {}, get value() { return ''; },
    click() {}, focus() {},
  });

  // ---- 假定时器：按模拟时间推进（导弹延迟注入等行为与真实一致）----
  let now = 0;
  const timers = [];
  let timerId = 1;
  const fakeSetTimeout = (fn, ms) => {
    timers.push({ fn, at: now + (ms || 0) / 1000 });
    return timerId++;
  };
  const tick = (d) => {
    now += d;
    let guard = 0;
    while (guard++ < 10000) {
      const due = timers.filter(t => t.at <= now + 1e-9);
      if (!due.length) break;
      for (const t of due) {
        const i = timers.indexOf(t);
        if (i >= 0) timers.splice(i, 1);
        try { t.fn(); } catch (e) { /* 模拟回调异常不中断整场 */ }
      }
    }
  };

  // ---- 沙箱全局 ----
  const sandbox = {
    console, JSON, Date, isFinite,
    performance: { now: () => now * 1000 },
    setTimeout: fakeSetTimeout, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0,
    addEventListener: () => {},
    document: {
      querySelector: () => fakeEl(),
      querySelectorAll: () => [],
      createElement: () => fakeEl(),
      addEventListener: () => {},
    },
    window: {}, navigator: {}, location: { protocol: 'file:', search: '' },
    innerWidth: 1000, innerHeight: 900, devicePixelRatio: 1,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    URLSearchParams: function () { return { get: () => null }; },
    // 游戏侧 stub（effects/audio/ui 中与渲染相关的部分）
    sfx: () => {},
    showScreen: () => {}, showResult: () => {},
    addFx: () => {}, addRing: () => {}, addSparks: () => {}, addText: () => {},
    boom: () => {}, updateFx: () => {},
    // 内部钩子
    __tick: tick,
  };
  if (opts.seed !== undefined) {
    sandbox.Math = Object.create(Math);
    sandbox.Math.random = makeRng(opts.seed);
  }
  vm.createContext(sandbox);

  // draw.js 的装饰绘制函数：仅被 data.js 顶层（DECORS 数组）引用，headless 无需真实实现
  for (const fn of ['drawDecRing', 'drawDecSpike', 'drawDecStripe', 'drawDecHex', 'drawDecCross']) {
    sandbox[fn] = () => {};
  }

  // 注入 select.js 中战斗逻辑依赖的 abOf（能力查找），再加载游戏文件
  vm.runInContext('function abOf(id){ return ABILITIES.find(a => a.id === id) || ABILITIES[0]; }', sandbox, { filename: '(abOf)' });
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(src, sandbox, { filename: f });
  }

  // 固定场地（游戏里 fieldRect 依窗口尺寸，模拟统一 720×720，与桌面窗口上限一致）
  vm.runInContext(`function fieldRect(){ return { x: 0, y: 0, s: ${fieldSize} }; }`, sandbox, { filename: '(fieldRect)' });

  // 注入数值配置（var BALANCE 挂载在沙箱全局，可覆写）
  const balance = opts.balance || null;
  vm.runInContext(
    `function __loadBalance(obj){ BALANCE = deepMerge(BALANCE_DEFAULTS, obj || null); return true; }` +
    `function __abilityIds(){ return ABILITIES.map(a => a.id); }` +
    `function __abilityName(id){ const a = ABILITIES.find(x => x.id === id); return a ? (a.icon + ' ' + a.name) : id; }`,
    sandbox, { filename: '(helpers)' }
  );
  if (balance) sandbox.__loadBalance(balance);

  // ---- 注入比赛驱动函数（在 context 内定义，可访问全部词法绑定）----
  vm.runInContext(`
    // 球位 → 默认能力（与游戏选择屏各球位默认一致）
    function __sideAbility(side) { return { left: 'pulse', right: 'shield', p2: 'missile', p3: 'ghost' }[side] || 'pulse'; }
    // 能力直选配置：useDefault=true 时数值用默认三围（不受编辑器影响）
    function __makeCfg(ability, useDefault) {
      const st = useDefault ? { ...AB_DEFAULT_STATS } : undefined;
      const base = orbStats(ability);
      return { name: base.name || ability, color: COLORS[0], decor: 'ring', ability, stats: st };
    }
    // 球位快捷配置：取该球位默认能力 + BALANCE 中该球种的当前数值（快照，换位模拟不串位）
    function __makeCfgFixed(side) {
      const ab = __sideAbility(side);
      const st = orbStats(ab);
      return { name: st.name || ab, color: COLORS[0], decor: 'ring', ability: ab, stats: st };
    }
    // 1v1：返回 { winner: 'left'|'right'|null, time, over, hp: [左,右] 剩余比例 }
    function __runMatch(cfgA, cfgB, maxT, dt) {
      const F = fieldRect();
      const orbs = [];
      const cfgs = [cfgA, cfgB];
      cfgs.forEach((cfg, i) => { orbs.push(makeOrb(i === 0 ? 'left' : 'right', cfg)); });
      for (let i = 0; i < 2; i++) {
        const o = orbs[i];
        const ang0 = i / 2 * TAU - Math.PI / 2;
        const cx = F.x + F.s / 2, cy = F.y + F.s / 2;
        const rr = F.s * .26;
        const sp = o.stats.cruise * BALANCE.global.speedMult;
        o.x = cx + Math.cos(ang0) * rr; o.y = cy + Math.sin(ang0) * rr;
        const outA = ang0 + rand(-.9, .9);
        o.vx = Math.cos(outA) * sp; o.vy = Math.sin(outA) * sp;
      }
      battle = { orbs, left: orbs[0], right: orbs[1], proj: [], fx: [], structs: [], time: 0, shake: 0, over: false, winner: null, paused: false, ambient: [], mode: 2 };
      const limit = maxT || BALANCE.global.maxTime || 120;
      let guard = 0;
      const maxFrames = Math.ceil(limit / dt) + 180;
      while (!battle.over && battle.time < limit && guard++ < maxFrames) {
        __tick(dt);
        updateBattle(dt);
      }
      return {
        winner: battle.winner ? battle.winner.side : null,
        time: battle.time, over: battle.over,
        hp: orbs.map(o => Math.max(0, o.hp) / o.maxHp),
      };
    }
    // 多球混战（2/3/4）：cfgs 按 [left,right,(p2),(p3)] 顺序
    function __runMatchN(cfgs, maxT, dt) {
      const F = fieldRect();
      const n = cfgs.length;
      const sides = ['left', 'right', 'p2', 'p3'].slice(0, n);
      const orbs = [];
      cfgs.forEach((cfg, i) => { orbs.push(makeOrb(sides[i], cfg)); });
      for (let i = 0; i < n; i++) {
        const o = orbs[i];
        const ang0 = i / n * TAU - Math.PI / 2;
        const cx = F.x + F.s / 2, cy = F.y + F.s / 2;
        const rr = F.s * .3;
        const sp = o.stats.cruise * BALANCE.global.speedMult;
        o.x = cx + Math.cos(ang0) * rr; o.y = cy + Math.sin(ang0) * rr;
        const outA = ang0 + rand(-.9, .9);
        o.vx = Math.cos(outA) * sp; o.vy = Math.sin(outA) * sp;
      }
      battle = { orbs, left: orbs[0], right: orbs[1], proj: [], fx: [], structs: [], time: 0, shake: 0, over: false, winner: null, paused: false, ambient: [], mode: n };
      const limit = maxT || BALANCE.global.maxTime || 120;
      let guard = 0;
      const maxFrames = Math.ceil(limit / dt) + 180;
      while (!battle.over && battle.time < limit && guard++ < maxFrames) {
        __tick(dt);
        updateBattle(dt);
      }
      return {
        winner: battle.winner ? battle.winner.side : null,
        time: battle.time, over: battle.over,
        hp: orbs.map(o => Math.max(0, o.hp) / o.maxHp),
      };
    }
  `, sandbox, { filename: '(sim)' });

  return {
    ctx: sandbox,
    runMatch(cfgA, cfgB, o = {}) { return sandbox.__runMatch(cfgA, cfgB, o.maxTime || 0, o.dt || dt); },
    runMatchN(cfgs, o = {}) { return sandbox.__runMatchN(cfgs, o.maxTime || 0, o.dt || dt); },
    loadBalance(obj) { sandbox.__loadBalance(obj); },
    abilityIds() { return sandbox.__abilityIds(); },
    abilityName(id) { return sandbox.__abilityName(id); },
    defaultStats() { return null; },
    makeCfg(ability, useDefault) { return sandbox.__makeCfg(ability, useDefault); },
    makeCfgFixed(side) { return sandbox.__makeCfgFixed(side); },
    get balance() { return sandbox.BALANCE; },
  };
}

module.exports = { createSandbox, ROOT };
