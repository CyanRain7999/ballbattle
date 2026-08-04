'use strict';

// ---------------- 工具 ----------------
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function shade(hex, f) { // 变暗
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}
function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// ---------------- 状态 ----------------
let state = 'select';
let players = {};   // { left: cfg, right: cfg }（多球模式为 { p0, p1, p2, p3 }）
let gameMode = 2;   // 2 / 3 / 4 球模式
// 玩法规则（与人数正交，选择屏勾选）：shrink 缩圈 / obstacles 障碍布局('none'|'cross'|'corners'|'blocks'|'spinner') / multiSkill 双能力
let gameRules = { shrink: false, obstacles: 'none', multiSkill: false };
let battle = null;  // 战斗实例

// ---------------- 屏幕管理 ----------------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  state = name;
}

// ---------------- 战斗 ----------------
const battleCanvas = $('#battle-canvas');
const bctx = battleCanvas ? battleCanvas.getContext('2d') : null; // 编辑器页无该元素时降级

// ---------------- 多球辅助（V8：支持 2/3/4 球；V9：2v2 团战 / 4v1 BOSS 队伍模式） ----------------
function ownerOf(side) { return battle.orbs.find(o => o.side === side); }
// 队伍映射：battle.teams = { 队名: [side...] }；传统模式为 null（全员互敌）
const TEAM_LABELS = { blue: '蓝队', red: '红队', players: '玩家队', boss: 'BOSS' };
function teamOf(side) {
  const t = battle && battle.teams;
  if (!t) return null;
  for (const name of Object.keys(t)) if (t[name].includes(side)) return name;
  return null;
}
function isFoe(a, b) {
  if (!battle || !battle.teams) return true;
  return teamOf(a.side) !== teamOf(b.side);
}
function foesOf(o) { return battle.orbs.filter(x => x !== o && x.alive && isFoe(o, x)); }
function nearestFoe(o) {
  let best = null, bd = Infinity;
  for (const f of battle.orbs) {
    if (f === o || !f.alive) continue;
    if (!isFoe(o, f)) continue; // 队伍模式：队友不是目标
    const d = Math.hypot(f.x - o.x, f.y - o.y);
    if (d < bd) { bd = d; best = f; }
  }
  // 兜底返回任意其他球（仅发生在敌方全灭的终局瞬间，hitOrb 的 battle.over 守卫会短路伤害）
  return best || battle.orbs.find(x => x !== o && isFoe(o, x)) || battle.orbs.find(x => x !== o);
}

function fieldRect() {
  // 缩圈模式：战斗实例维护动态场地矩形（初始=全屏，逐级内缩），全部反弹/投射物/绘制自动跟随
  if (battle && battle.field) return battle.field;
  const w = innerWidth, h = innerHeight;
  const s = Math.min(w * .94, h * .84, 720);
  return { x: (w - s) / 2, y: (h - s) / 2 + 6, s };
}
function resizeCanvas() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  battleCanvas.width = innerWidth * dpr;
  battleCanvas.height = innerHeight * dpr;
  battleCanvas.style.width = innerWidth + 'px';
  battleCanvas.style.height = innerHeight + 'px';
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
