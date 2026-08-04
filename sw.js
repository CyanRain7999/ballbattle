// 球斗竞技场 PWA Service Worker —— 离线缓存
// 注意：仅在 http(s) 环境下注册生效；file:// 双击打开时浏览器不启用 SW，游戏照常运行
// v4：新增数值编辑器与模拟器页面预缓存
const CACHE = 'orb-arena-v4';
const ASSETS = [
  './',
  './index.html',
  './editor.html',
  './sim.html',
  './css/style.css',
  './css/editor.css',
  './css/sim.css',
  './js/core.js',
  './js/draw.js',
  './js/data.js',
  './js/balance.js',
  './js/editor.js',
  './js/sim.js',
  './js/audio.js',
  './js/effects.js',
  './js/select.js',
  './js/battle.js',
  './js/entities.js',
  './js/hud.js',
  './js/ui.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 网络优先，成功才写缓存；仅导航请求离线回退 index.html（避免 HTML 被当资源解析）
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => {
      if (e.request.mode === 'navigate') return caches.match(e.request).then(m => m || caches.match('./index.html'));
      return caches.match(e.request);
    })
  );
});
