// 程序化PBR纹理生成（颜色/法线/粗糙度）
import * as THREE from 'three';
import { TileNoise, mulberry32, clamp } from './util.js';

let SIZE = 512;
export function setTextureSize(s) { SIZE = s; }

function build(gen, opts = {}) {
  const N = opts.size || SIZE;
  const H = new Float32Array(N * N);
  const C = new Uint8ClampedArray(N * N * 4);
  const R = opts.rough ? new Uint8ClampedArray(N * N * 4) : null;
  const out = { h: 0, r: 0, g: 0, b: 0, rough: 0.8 };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      out.h = 0.5; out.rough = 0.8;
      gen(x / N, y / N, out, x, y, N);
      H[i] = out.h;
      C[i * 4] = out.r; C[i * 4 + 1] = out.g; C[i * 4 + 2] = out.b; C[i * 4 + 3] = 255;
      if (R) { const v = clamp(out.rough, 0, 1) * 255; R[i * 4] = v; R[i * 4 + 1] = v; R[i * 4 + 2] = v; R[i * 4 + 3] = 255; }
    }
  }
  const res = {};
  res.map = toTex(C, N, true);
  // 法线
  const strength = opts.normal ?? 3;
  const Nm = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const xl = H[y * N + ((x - 1 + N) % N)], xr = H[y * N + ((x + 1) % N)];
      const yu = H[((y - 1 + N) % N) * N + x], yd = H[((y + 1) % N) * N + x];
      let nx = (xl - xr) * strength * N / 256, ny = (yd - yu) * strength * N / 256, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * N + x) * 4;
      Nm[i] = (nx * 0.5 + 0.5) * 255; Nm[i + 1] = (ny * 0.5 + 0.5) * 255; Nm[i + 2] = (nz * 0.5 + 0.5) * 255; Nm[i + 3] = 255;
    }
  }
  res.normalMap = toTex(Nm, N, false);
  if (R) res.roughnessMap = toTex(R, N, false);
  return res;
}

function toTex(data, N, srgb) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  ctx.putImageData(new ImageData(data, N, N), 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const n1 = new TileNoise(11, 128), n2 = new TileNoise(23, 128), n3 = new TileNoise(37, 128);

function setC(o, r, g, b) { o.r = r; o.g = g; o.b = b; }

const GEN = {
  concrete(x, y, o) {
    const f = n1.fbm(x, y, 8, 6);
    const s = n2.fbm(x, y, 2, 3);
    const pit = n3.get(x, y, 128) > 0.93 ? -0.25 : 0;
    const v = 118 + (f - 0.5) * 60 - (s > 0.6 ? (s - 0.6) * 120 : 0) + pit * 80;
    setC(o, v, v * 0.99, v * 0.96);
    o.h = f * 0.6 + pit; o.rough = 0.85;
    // 接缝
    if (y % 0.5 < 0.004) { o.h -= 0.4; o.r *= 0.7; o.g *= 0.7; o.b *= 0.7; }
  },
  plaster(x, y, o) {
    const f = n1.fbm(x, y, 8, 6);
    const big = n2.fbm(x, y, 2, 4);
    const chip = n3.fbm(x, y, 4, 5);
    let r = 196, g = 172, b = 136;
    const t = (big - 0.5) * 50;
    r += t; g += t * 0.9; b += t * 0.8;
    o.h = 0.6 + f * 0.25;
    if (chip > 0.62) { // 剥落露出砖
      const bx = (x * 16 + (Math.floor(y * 32) % 2) * 0.5) % 1, by = (y * 32) % 1;
      const mortar = bx < 0.06 || by < 0.12;
      r = mortar ? 150 : 150 + f * 50; g = mortar ? 140 : 95 + f * 30; b = mortar ? 125 : 70;
      o.h = mortar ? 0.1 : 0.35;
    }
    const dirt = Math.max(0, y - 0.7) * 120 * big;
    setC(o, r + (f - 0.5) * 30 - dirt, g + (f - 0.5) * 30 - dirt, b + (f - 0.5) * 25 - dirt);
    o.rough = 0.92;
  },
  brick(x, y, o) {
    const rows = 16, cols = 6;
    const ry = y * rows, row = Math.floor(ry);
    const rx = x * cols + (row % 2) * 0.5, col = Math.floor(rx);
    const fx = rx - col, fy = ry - row;
    const mortar = fx < 0.05 || fy < 0.1;
    const f = n1.fbm(x, y, 16, 4);
    const rr = mulberry32(row * 131 + (col % cols) * 7)();
    if (mortar) { setC(o, 150 + f * 30, 145 + f * 30, 135 + f * 25); o.h = 0.1 + f * 0.1; }
    else {
      const k = 0.75 + rr * 0.4;
      setC(o, (140 + f * 50) * k, (70 + f * 30) * k, (50 + f * 20) * k);
      o.h = 0.6 + f * 0.3;
    }
    o.rough = 0.9;
  },
  sand(x, y, o) {
    const f = n1.fbm(x, y, 8, 6);
    const w = n2.fbm(x, y, 2, 3);
    const rip = Math.sin((y * 30 + w * 6) * Math.PI * 2) * 0.5 + 0.5;
    const grain = n3.get(x, y, 128);
    const v = (f - 0.5) * 40 + (grain - 0.5) * 18;
    setC(o, 196 + v, 164 + v * 0.9, 118 + v * 0.8);
    o.h = rip * 0.35 + f * 0.4 + grain * 0.1;
    o.rough = 0.95;
  },
  snow(x, y, o) {
    const f = n1.fbm(x, y, 4, 6);
    const d = n2.fbm(x, y, 8, 4);
    const v = 225 + (f - 0.5) * 40;
    setC(o, v - 8, v - 2, v + 6);
    if (d > 0.68) { const k = (d - 0.68) * 200; o.r -= k; o.g -= k; o.b -= k * 0.8; }
    o.h = f * 0.8; o.rough = 0.7;
  },
  asphalt(x, y, o) {
    const g = n3.get(x, y, 128), f = n1.fbm(x, y, 8, 5);
    const pud = n2.fbm(x, y, 2, 4);
    let v = 58 + (g - 0.5) * 30 + (f - 0.5) * 25;
    o.h = g * 0.3 + f * 0.3; o.rough = 0.85;
    if (pud > 0.58) { v *= 0.55; o.h = 0.3; o.rough = 0.06; }
    else if (pud > 0.53) { v *= 0.75; o.rough = 0.35; }
    setC(o, v, v, v * 1.03);
  },
  metal(x, y, o) {
    const ridge = Math.abs(Math.sin(x * Math.PI * 12));
    const f = n1.fbm(x, y, 8, 5);
    const rust = n2.fbm(x, y, 4, 5);
    const streak = n3.fbm(x * 0.1, y, 16, 3);
    let v = 200 + (f - 0.5) * 30 - streak * 25;
    let r = v, g = v, b = v;
    o.rough = 0.55;
    if (rust > 0.62) { const k = Math.min(1, (rust - 0.62) * 6); r = r * (1 - k) + 140 * k; g = g * (1 - k) + 80 * k; b = b * (1 - k) + 45 * k; o.rough = 0.9; }
    if (y > 0.9) { const k = (y - 0.9) * 6; r *= 1 - k * 0.5; g *= 1 - k * 0.5; b *= 1 - k * 0.5; }
    setC(o, r, g, b);
    o.h = ridge * 0.8 + f * 0.1;
  },
  wood(x, y, o) {
    const planks = 6;
    const py = y * planks, p = Math.floor(py), fy = py - p;
    const off = mulberry32(p * 17)();
    const grain = n1.fbm((x + off) % 1, y, 4, 5);
    const ring = Math.sin((grain * 20 + y * 40) * 2) * 0.5 + 0.5;
    const k = 0.8 + off * 0.35;
    let r = (120 + ring * 30) * k, g = (85 + ring * 20) * k, b = (55 + ring * 10) * k;
    o.h = 0.5 + ring * 0.2;
    if (fy < 0.05 || fy > 0.97) { r *= 0.4; g *= 0.4; b *= 0.4; o.h = 0; }
    setC(o, r, g, b); o.rough = 0.8;
  },
  crate(x, y, o) {
    GEN.wood(x, y, o);
    const e = Math.min(x, y, 1 - x, 1 - y);
    const diag = Math.abs(x - y) < 0.05;
    if (e < 0.08 || diag) { o.r *= 0.8; o.g *= 0.75; o.b *= 0.7; o.h = 0.9; }
    if (e > 0.075 && e < 0.09) { o.h = 0.1; o.r *= 0.5; o.g *= 0.5; o.b *= 0.5; }
  },
  dirt(x, y, o) {
    const f = n1.fbm(x, y, 8, 6), s = n2.fbm(x, y, 3, 4), p = n3.get(x, y, 128);
    let r = 98 + (f - 0.5) * 50, g = 80 + (f - 0.5) * 40, b = 60 + (f - 0.5) * 30;
    if (s > 0.6) { r -= 20; g -= 16; b -= 12; }
    o.h = f * 0.6;
    if (p > 0.9) { r += 40; g += 38; b += 36; o.h += 0.3; }
    setC(o, r, g, b); o.rough = 0.95;
  },
  grass(x, y, o) {
    const f = n1.fbm(x, y, 8, 6), s = n2.fbm(x, y, 2, 4), bl = n3.get(x, y * 0.3, 128);
    const dry = s;
    let r = 70 + dry * 70 + bl * 30, g = 80 + dry * 40 + bl * 30, b = 40 + bl * 10;
    r += (f - 0.5) * 30; g += (f - 0.5) * 30;
    setC(o, r, g, b); o.h = bl * 0.6 + f * 0.3; o.rough = 0.95;
  },
  rock(x, y, o) {
    const f = n1.fbm(x, y, 4, 7), c = n2.fbm(x, y, 8, 3);
    const crack = Math.abs(c - 0.5) < 0.02 ? -0.4 : 0;
    const v = 110 + (f - 0.5) * 80 + crack * 100;
    setC(o, v, v * 0.95, v * 0.88); o.h = f + crack; o.rough = 0.9;
  },
  sandbag(x, y, o) {
    const wx = Math.sin(x * Math.PI * 256), wy = Math.sin(y * Math.PI * 256);
    const f = n1.fbm(x, y, 8, 4);
    const v = (wx * wy) * 0.5 + 0.5;
    setC(o, 150 + f * 40 + v * 15, 130 + f * 35 + v * 12, 90 + f * 25 + v * 8);
    o.h = v * 0.4 + f * 0.3; o.rough = 1;
  },
  fabric(x, y, o, px, py, N, cfg) {
    const c = cfg.colors;
    const f = n1.fbm(x, y, 4, 4);
    const f2 = n2.fbm(x, y, 8, 3);
    let col = c[0];
    if (f > 0.55) col = c[1];
    if (f2 > 0.6) col = c[2];
    if (f < 0.38) col = c[3] || c[0];
    const weave = (Math.sin(x * Math.PI * 200) * Math.sin(y * Math.PI * 200)) * 6;
    setC(o, col[0] + weave, col[1] + weave, col[2] + weave);
    o.h = 0.5 + weave * 0.03; o.rough = 0.95;
  },
  tiles(x, y, o) {
    const fx = (x * 8) % 1, fy = (y * 8) % 1;
    const f = n1.fbm(x, y, 16, 3);
    const g = fx < 0.04 || fy < 0.04;
    const v = g ? 90 : 170 + (f - 0.5) * 30;
    setC(o, v, v * 0.97, v * 0.92); o.h = g ? 0 : 0.5; o.rough = g ? 0.9 : 0.4;
  },
};

export function genTexture(kind, opts = {}) {
  let g = GEN[kind];
  if (opts.cfg) { const base = g; g = (x, y, o, px, py, N) => base(x, y, o, px, py, N, opts.cfg); }
  return build(g, opts);
}

// 枪械涂装
export function genCamo(kind) {
  const N = 256;
  const r = mulberry32(kind.length * 99);
  const gen = {
    desert: (x, y, o) => { const f = n1.fbm(x, y, 4, 4); const c = f > 0.6 ? [120, 95, 60] : f > 0.45 ? [175, 150, 105] : [205, 185, 140]; setC(o, ...c); },
    woodland: (x, y, o) => { const f = n1.fbm(x, y, 4, 4), g = n2.fbm(x, y, 6, 3); let c = [70, 85, 45]; if (f > 0.55) c = [45, 40, 30]; if (g > 0.6) c = [110, 100, 60]; if (f < 0.38) c = [30, 35, 25]; setC(o, ...c); },
    digital: (x, y, o) => { const qx = Math.floor(x * 32) / 32, qy = Math.floor(y * 32) / 32; const f = n1.fbm(qx, qy, 4, 3); const c = f > 0.6 ? [40, 44, 50] : f > 0.47 ? [110, 115, 120] : [175, 180, 185]; setC(o, ...c); },
    tiger: (x, y, o) => { const f = n1.fbm(x, y, 2, 3); const s = Math.sin((x * 10 + f * 4) * Math.PI) > 0.55; setC(o, ...(s ? [25, 20, 15] : [200, 120, 30])); },
    gold: (x, y, o) => { const f = n1.fbm(x, y, 8, 4); setC(o, 230 + f * 20, 180 + f * 30, 70 + f * 20); },
    dragon: (x, y, o) => { const sx = (x * 16) % 1, sy = (y * 16 + (Math.floor(x * 16) % 2) * 0.5) % 1; const d = Math.hypot(sx - 0.5, sy - 0.2); const f = n1.fbm(x, y, 4, 3); const e = d < 0.55 ? 1 - d : 0.3; setC(o, 150 * e + 60 * f, 20 * e, 20 * e); },
  }[kind];
  return build(gen, { size: N, normal: 1 });
}

// 软粒子贴图
export function particleTex(type = 'soft') {
  const N = 64, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  if (type === 'soft') {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  } else if (type === 'smoke') {
    const r = mulberry32(5);
    for (let i = 0; i < 18; i++) {
      const x = 16 + r() * 32, y = 16 + r() * 32, rad = 8 + r() * 16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
    }
  } else if (type === 'flash') {
    ctx.translate(32, 32);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(Math.PI * 2 / 5 + 0.3);
      const g = ctx.createLinearGradient(0, 0, 30, 0);
      g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,160,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(30, 0); ctx.lineTo(0, 4); ctx.fill();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
  } else if (type === 'decal') {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(10,10,10,1)'); g.addColorStop(0.25, 'rgba(20,18,15,0.9)'); g.addColorStop(0.5, 'rgba(40,35,30,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  } else if (type === 'scorch') {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.6, 'rgba(10,8,5,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function textTexture(text, opts = {}) {
  const cv = document.createElement('canvas');
  const w = opts.w || 512, h = opts.h || 128;
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = `bold ${opts.size || 72}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.color || '#fff';
  ctx.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
