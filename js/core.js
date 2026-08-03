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
let battle = null;  // 战斗实例

// ---------------- 屏幕管理 ----------------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  state = name;
}

// ---------------- 战斗 ----------------
const battleCanvas = $('#battle-canvas');
const bctx = battleCanvas.getContext('2d');

// ---------------- 多球辅助（V8：支持 2/3/4 球） ----------------
function ownerOf(side) { return battle.orbs.find(o => o.side === side); }
function foesOf(o) { return battle.orbs.filter(x => x !== o && x.alive); }
function nearestFoe(o) {
  let best = null, bd = Infinity;
  for (const f of battle.orbs) {
    if (f === o || !f.alive) continue;
    const d = Math.hypot(f.x - o.x, f.y - o.y);
    if (d < bd) { bd = d; best = f; }
  }
  return best || battle.orbs.find(x => x !== o);
}

function fieldRect() {
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
