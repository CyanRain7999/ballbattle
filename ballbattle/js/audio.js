// ---------------- 音效 ----------------
let audioOn = true, AC = null;
function ac() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
function tone(f0, f1, dur, type, vol) {
  if (!audioOn) return;
  try {
    const c = ac(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* 忽略音频错误 */ }
}
function noiseBurst(dur, vol, freq) {
  if (!audioOn) return;
  try {
    const c = ac(), t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  } catch (e) { /* 忽略 */ }
}
function sfx(kind) {
  switch (kind) {
    case 'ui':        tone(880, 880, .06, 'sine', .06); break;
    case 'clash':     noiseBurst(.16, .30, 1400); tone(160, 40, .14, 'square', .10); break;
    case 'hit':       noiseBurst(.10, .18, 2200); tone(300, 90, .10, 'sawtooth', .07); break;
    case 'pulse':     tone(220, 60, .4, 'sine', .22); break;
    case 'shield':    tone(320, 640, .22, 'sine', .14); break;
    case 'shieldBrk': noiseBurst(.22, .25, 900); tone(900, 140, .18, 'square', .09); break;
    case 'phantom':   tone(500, 900, .2, 'triangle', .09); break;
    case 'missile':   tone(1400, 320, .3, 'sawtooth', .06); break;
    case 'rush':      tone(120, 520, .3, 'sawtooth', .11); break;
    case 'repair':    tone(700, 1100, .25, 'sine', .07); break;
    case 'boomerang': tone(400, 900, .25, 'triangle', .09); break;
    case 'railgun':   tone(1800, 90, .5, 'sawtooth', .16); break;
    case 'frost':     tone(900, 1400, .3, 'sine', .1); break;
    case 'barrier':   tone(300, 500, .3, 'square', .08); break;
    case 'nest':      tone(500, 700, .2, 'triangle', .09); break;
    case 'echo':      tone(600, 1200, .3, 'sine', .08); break;
    case 'sonic':     tone(120, 60, .4, 'sawtooth', .14); break;
    case 'fang':      tone(1000, 500, .15, 'triangle', .07); break;
    case 'launcher':  tone(300, 900, .25, 'sawtooth', .12); break;
    case 'tornado':   noiseBurst(.3, .2, 500); tone(200, 80, .4, 'sine', .1); break;
    case 'web':       tone(700, 300, .2, 'triangle', .08); break;
    case 'volcano':   noiseBurst(.4, .3, 300); tone(90, 40, .5, 'sawtooth', .14); break;
    case 'venom':     tone(400, 150, .3, 'sawtooth', .09); break;
    case 'ghost':     tone(500, 1200, .3, 'sine', .06); break;
    case 'star':      tone(1200, 1800, .2, 'sine', .07); break;
    case 'tsunami':   noiseBurst(.45, .25, 400); tone(300, 90, .45, 'sine', .12); break;
    case 'spore':     tone(300, 200, .25, 'triangle', .08); break;
    case 'clone':     tone(600, 900, .25, 'sine', .08); break;
    case 'evolve':    tone(400, 800, .3, 'triangle', .1); break;
    case 'lance':     tone(200, 900, .35, 'sawtooth', .13); break;
    case 'curse':     tone(320, 980, .3, 'sawtooth', .12); noiseBurst(.12, .2, 2000); break;
    case 'corrode':   noiseBurst(.3, .2, 700); tone(500, 200, .35, 'sawtooth', .08); break;
    case 'coffin':    tone(150, 420, .4, 'triangle', .1); noiseBurst(.2, .15, 500); break;
    case 'tech1':     tone(1800, 700, .15, 'square', .08); break;
    case 'tech2':     tone(2400, 900, .12, 'square', .07); break;
    case 'techx':     tone(2000, 500, .3, 'sine', .1); break;
    case 'liquid':    tone(600, 950, .25, 'sine', .08); break;
    case 'pylon':     noiseBurst(.16, .32, 1100); tone(950, 60, .3, 'square', .14); break;
    case 'bond':      tone(520, 210, .3, 'square', .08); break;
    case 'boom':      noiseBurst(.5, .4, 700); tone(220, 30, .6, 'square', .16); break;
    case 'win':       [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f, .22, 'triangle', .12), i * 130)); break;
  }
}
