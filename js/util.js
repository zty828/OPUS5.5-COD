// 通用工具：数学、随机、噪声
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const DEG = Math.PI / 180;

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// 可复现随机数
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 可平铺值噪声
export class TileNoise {
  constructor(seed = 1, period = 64) {
    const r = mulberry32(seed);
    this.p = period;
    this.v = new Float32Array(period * period);
    for (let i = 0; i < this.v.length; i++) this.v[i] = r();
  }
  get(x, y, freq) {
    // x,y in [0,1)
    const p = Math.min(this.p, freq);
    const fx = x * p, fy = y * p;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const P = this.p;
    const x0 = ((ix % p) + p) % p, x1 = (x0 + 1) % p;
    const y0 = ((iy % p) + p) % p, y1 = (y0 + 1) % p;
    const v = this.v;
    const a = v[y0 * P + x0], b = v[y0 * P + x1], c = v[y1 * P + x0], d = v[y1 * P + x1];
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }
  fbm(x, y, base = 4, oct = 5, gain = 0.5) {
    let amp = 1, sum = 0, norm = 0, f = base;
    for (let i = 0; i < oct; i++) {
      sum += this.get(x, y, f) * amp; norm += amp; amp *= gain; f *= 2;
    }
    return sum / norm;
  }
}

// 射线-AABB (slab)，返回 t 或 -1
export function rayAABB(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
  let t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx;
  if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
  tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  if (tmin > tmax) return -1;
  t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy;
  if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
  tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  if (tmin > tmax) return -1;
  t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz;
  if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
  tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  if (tmin > tmax) return -1;
  return tmin;
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  const thc = Math.sqrt(r * r - d2);
  const t = tca - thc;
  return t >= 0 ? t : (tca + thc >= 0 ? 0 : -1);
}

// 在给定方向附近加扩散
const _tmpA = new THREE.Vector3(), _tmpB = new THREE.Vector3();
export function spreadDir(dir, spreadRad, out = new THREE.Vector3()) {
  if (spreadRad <= 0) return out.copy(dir);
  const up = Math.abs(dir.y) > 0.99 ? _tmpA.set(1, 0, 0) : _tmpA.set(0, 1, 0);
  const right = _tmpB.crossVectors(dir, up).normalize();
  const up2 = up.crossVectors(right, dir).normalize();
  const r = Math.sqrt(Math.random()) * Math.tan(spreadRad);
  const a = Math.random() * Math.PI * 2;
  out.copy(dir).addScaledVector(right, Math.cos(a) * r).addScaledVector(up2, Math.sin(a) * r).normalize();
  return out;
}

export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export class BinaryHeap {
  constructor(score) { this.c = []; this.s = score; }
  push(e) { this.c.push(e); this._up(this.c.length - 1); }
  pop() {
    const r = this.c[0], e = this.c.pop();
    if (this.c.length) { this.c[0] = e; this._down(0); }
    return r;
  }
  get size() { return this.c.length; }
  _up(n) {
    const c = this.c, el = c[n], s = this.s(el);
    while (n > 0) {
      const p = ((n + 1) >> 1) - 1, pe = c[p];
      if (s >= this.s(pe)) break;
      c[p] = el; c[n] = pe; n = p;
    }
  }
  _down(n) {
    const c = this.c, len = c.length, el = c[n], es = this.s(el);
    while (true) {
      const r = (n + 1) << 1, l = r - 1;
      let sw = null, ls;
      if (l < len) { ls = this.s(c[l]); if (ls < es) sw = l; }
      if (r < len) { const rs = this.s(c[r]); if (rs < (sw === null ? es : ls)) sw = r; }
      if (sw === null) break;
      c[n] = c[sw]; c[sw] = el; n = sw;
    }
  }
}
