// 视觉特效：粒子、曳光弹、弹孔、爆炸、天气
import * as THREE from 'three';
import { particleTex } from './textures.js';
import { rand } from './util.js';

class Particles {
  constructor(scene, max, tex, additive) {
    this.max = max; this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.rot = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('acolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('asize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('arot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 600 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: `attribute vec4 acolor; attribute float asize; attribute float arot; varying vec4 vC; varying float vR; varying float vFog; uniform float scale; uniform float fogDensity;
        void main(){ vC = acolor; vR = arot; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = asize * scale / max(0.1, -mv.z); float d = length(mv.xyz); vFog = 1.0 - exp(-fogDensity*fogDensity*d*d); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; varying vec4 vC; varying float vR; varying float vFog;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); uv = vec2(c*uv.x - s*uv.y, s*uv.x + c*uv.y) + 0.5; vec4 t = texture2D(map, uv); vec3 col = vC.rgb * t.rgb; ${additive ? 'col *= (1.0 - vFog);' : 'col = mix(col, fogColor, vFog);'} gl_FragColor = vec4(col, t.a * vC.a); if (gl_FragColor.a < 0.003) discard; }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat = m;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }
  emit(p) {
    if (this.list.length >= this.max) this.list.shift();
    p.age = 0; p.rot = p.rot ?? Math.random() * 6.28; p.vr = p.vr ?? 0;
    this.list.push(p);
  }
  update(dt, scene) {
    if (scene.fog) { this.mat.uniforms.fogColor.value.copy(scene.fog.color); this.mat.uniforms.fogDensity.value = scene.fog.density; }
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= (p.g || 0) * dt;
      const dr = Math.exp(-(p.drag || 0) * dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.vr * dt;
      L[w++] = p;
    }
    L.length = w;
    const n = Math.min(w, this.max);
    for (let i = 0; i < n; i++) {
      const p = L[i], k = p.age / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const a = p.a0 * (p.fadeIn ? Math.min(1, k / p.fadeIn) : 1) * (1 - Math.pow(k, p.fadePow || 1));
      const ck = p.c1 ? k : 0;
      this.col[i * 4] = p.c1 ? p.c0[0] + (p.c1[0] - p.c0[0]) * ck : p.c0[0];
      this.col[i * 4 + 1] = p.c1 ? p.c0[1] + (p.c1[1] - p.c0[1]) * ck : p.c0[1];
      this.col[i * 4 + 2] = p.c1 ? p.c0[2] + (p.c1[2] - p.c0[2]) * ck : p.c0[2];
      this.col[i * 4 + 3] = a;
      this.size[i] = p.s0 + (p.s1 - p.s0) * k;
      this.rot[i] = p.rot;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'acolor', 'asize', 'arot']) this.geo.attributes[k].needsUpdate = true;
  }
  clear() { this.list.length = 0; }
}

export class Effects {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.texSoft = particleTex('soft');
    this.texSmoke = particleTex('smoke');
    this.texFlash = particleTex('flash');
    this.texDecal = particleTex('decal');
    this.texScorch = particleTex('scorch');
    this.add = new Particles(this.scene, 2500, this.texSoft, true);
    this.smoke = new Particles(this.scene, 1800, this.texSmoke, false);
    this.fires = [];
    this.smokeClouds = [];
    // 曳光弹
    const MAXT = 128;
    this.tracers = [];
    const tg = new THREE.BufferGeometry();
    this.tpos = new Float32Array(MAXT * 6); this.tcol = new Float32Array(MAXT * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tpos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tcol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tgeo = tg; this.MAXT = MAXT;
    const tl = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    tl.frustumCulled = false; this.scene.add(tl); this.tline = tl;
    // 弹孔
    this.decals = [];
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.decalMat = new THREE.MeshBasicMaterial({ map: this.texDecal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.scorchMat = new THREE.MeshBasicMaterial({ map: this.texScorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.bloodMat = new THREE.MeshBasicMaterial({ map: this.texDecal, color: 0x7a0000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    // 动态光源池
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffa050, 0, 12, 2);
      this.scene.add(l); this.lights.push({ l, t: 0, max: 0, dur: 0.1 });
    }
    // 弹壳
    this.shells = [];
    this.shellGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.025, 6);
    this.weather = null;
  }

  flashLight(pos, color, intensity, dur, dist = 12) {
    const s = this.lights.reduce((a, b) => (a.t / a.dur > b.t / b.dur || a.max === 0 ? a : b));
    let slot = this.lights.find(x => x.t <= 0) || s;
    slot.l.position.copy(pos); slot.l.color.set(color); slot.l.distance = dist;
    slot.max = intensity; slot.t = dur; slot.dur = dur;
  }

  muzzle(pos, dir, big = 1, light = true) {
    for (let i = 0; i < 3; i++) {
      const s = rand(2, 5) * 0.4;
      this.add.emit({ x: pos.x + dir.x * i * 0.05, y: pos.y + dir.y * i * 0.05, z: pos.z + dir.z * i * 0.05, vx: dir.x * s, vy: dir.y * s, vz: dir.z * s, life: 0.05, s0: 0.25 * big, s1: 0.4 * big, c0: [4, 2.6, 1.2], a0: 1 });
    }
    this.smoke.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * 1.5 + rand(-0.2, 0.2), vy: 0.4, vz: dir.z * 1.5, life: 0.8, s0: 0.1, s1: 0.6, c0: [0.7, 0.7, 0.7], a0: 0.12 * big, drag: 2 });
    if (light) this.flashLight(pos, 0xffb060, 3 * big, 0.05, 8);
  }

  tracer(from, to, color = [1.6, 1.2, 0.6]) {
    const len = from.distanceTo(to);
    if (len < 2) return;
    if (this.tracers.length >= this.MAXT) this.tracers.shift();
    this.tracers.push({ a: from.clone(), d: to.clone().sub(from).normalize(), len, t: 0, speed: 350, c: color });
  }

  impact(point, normal, matName = 'concrete') {
    const soft = /sand|dirt|grass|snow|plaster|sandbag/.test(matName);
    const metal = /metal|container|Metal|steel/.test(matName);
    const wood = /wood|crate/.test(matName);
    const n = normal;
    if (metal) {
      for (let i = 0; i < 8; i++) this.add.emit({ x: point.x, y: point.y, z: point.z, vx: n.x * rand(1, 4) + rand(-2, 2), vy: n.y * rand(1, 4) + rand(0, 3), vz: n.z * rand(1, 4) + rand(-2, 2), g: 9.8, life: rand(0.15, 0.4), s0: 0.03, s1: 0.01, c0: [4, 2.8, 1.2], a0: 1 });
    }
    const col = matName.includes('snow') ? [0.95, 0.97, 1] : matName.includes('sand') || matName.includes('plaster') ? [0.75, 0.62, 0.45] : wood ? [0.5, 0.36, 0.22] : [0.55, 0.53, 0.5];
    const cnt = soft ? 6 : 4;
    for (let i = 0; i < cnt; i++) this.smoke.emit({ x: point.x + n.x * 0.05, y: point.y + n.y * 0.05, z: point.z + n.z * 0.05, vx: n.x * rand(0.5, 2.5) + rand(-0.4, 0.4), vy: n.y * rand(0.5, 2) + rand(0, 0.8), vz: n.z * rand(0.5, 2.5) + rand(-0.4, 0.4), g: 1.5, drag: 3, life: rand(0.5, 1.1), s0: 0.08, s1: soft ? 0.7 : 0.45, c0: col, a0: soft ? 0.55 : 0.4 });
    for (let i = 0; i < 4; i++) this.smoke.emit({ x: point.x, y: point.y, z: point.z, vx: n.x * rand(2, 5) + rand(-2, 2), vy: rand(1, 4), vz: n.z * rand(2, 5) + rand(-2, 2), g: 12, life: 0.5, s0: 0.035, s1: 0.03, c0: col.map(c => c * 0.6), a0: 1, floor: 0 });
    this.decal(point, n, 0.09 + Math.random() * 0.04, this.decalMat);
  }
  blood(point, dir, head = false) {
    for (let i = 0; i < (head ? 14 : 8); i++) this.smoke.emit({ x: point.x, y: point.y, z: point.z, vx: dir.x * rand(0.5, 3) + rand(-1, 1), vy: rand(-0.5, 1.5), vz: dir.z * rand(0.5, 3) + rand(-1, 1), g: 6, drag: 2, life: rand(0.25, 0.6), s0: 0.06, s1: head ? 0.35 : 0.25, c0: [0.45, 0.02, 0.02], a0: 0.85 });
  }
  decal(point, normal, size, material) {
    let d;
    if (this.decals.length >= 160) { d = this.decals.shift(); }
    else { d = new THREE.Mesh(this.decalGeo, material); this.scene.add(d); }
    d.material = material;
    d.scale.setScalar(size);
    d.position.copy(point).addScaledVector(normal, 0.012);
    d.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    d.rotateZ(Math.random() * 6);
    this.decals.push(d);
  }
  explosion(pos, scale = 1) {
    const s = scale;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.4, v = rand(2, 9) * s;
      this.add.emit({ x: pos.x, y: pos.y + 0.3, z: pos.z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + 1, vz: Math.sin(a) * Math.cos(e) * v, drag: 4, life: rand(0.25, 0.6), s0: rand(0.8, 1.5) * s, s1: rand(2, 3.5) * s, c0: [6, 3, 1], c1: [2, 0.4, 0.1], a0: 1, fadePow: 2 });
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * 6.28, v = rand(3, 16) * s;
      this.add.emit({ x: pos.x, y: pos.y + 0.2, z: pos.z, vx: Math.cos(a) * v, vy: rand(3, 12), vz: Math.sin(a) * v, g: 14, life: rand(0.5, 1.2), s0: 0.06, s1: 0.03, c0: [5, 3, 1], a0: 1, floor: 0 });
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.28, v = rand(0.5, 3.5) * s;
      this.smoke.emit({ x: pos.x + rand(-0.5, 0.5), y: pos.y + rand(0, 1), z: pos.z + rand(-0.5, 0.5), vx: Math.cos(a) * v, vy: rand(1, 3.5), vz: Math.sin(a) * v, drag: 0.8, life: rand(2.5, 5), s0: 1.2 * s, s1: rand(4, 7) * s, c0: [0.18, 0.16, 0.15], c1: [0.4, 0.39, 0.38], a0: 0.7, fadeIn: 0.05 });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.28, v = rand(2, 8);
      this.smoke.emit({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * v, vy: rand(4, 9), vz: Math.sin(a) * v, g: 14, life: rand(0.8, 1.5), s0: 0.12, s1: 0.1, c0: [0.1, 0.09, 0.08], a0: 1, floor: 0 });
    }
    this.flashLight(pos.clone().setY(pos.y + 1), 0xff9040, 60 * s, 0.35, 22 * s);
    this.decal(new THREE.Vector3(pos.x, 0.01, pos.z), new THREE.Vector3(0, 1, 0), 3.5 * s, this.scorchMat);
  }
  flashbang(pos) {
    this.add.emit({ x: pos.x, y: pos.y + 0.2, z: pos.z, vx: 0, vy: 0, vz: 0, life: 0.25, s0: 3, s1: 6, c0: [10, 10, 10], a0: 1 });
    this.flashLight(pos, 0xffffff, 80, 0.25, 20);
    for (let i = 0; i < 6; i++) this.smoke.emit({ x: pos.x, y: pos.y + 0.2, z: pos.z, vx: rand(-1, 1), vy: rand(0.2, 1), vz: rand(-1, 1), drag: 1, life: 2, s0: 0.3, s1: 1.8, c0: [0.8, 0.8, 0.8], a0: 0.35 });
  }
  smokeGrenade(pos, dur = 14) {
    this.smokeClouds.push({ pos: pos.clone(), r: 0, maxR: 5.5, t: 0, dur, emitAcc: 0 });
  }
  addFireSource(pos, r = 0.5, dur = Infinity, dmg = null) {
    const f = { pos: pos.clone(), r, t: 0, dur, dmg, acc: 0 };
    this.fires.push(f); return f;
  }
  shell(pos, dir) {
    let s;
    if (this.shells.length > 24) s = this.shells.shift();
    else { s = new THREE.Mesh(this.shellGeo, this.game.mat('brass')); this.scene.add(s); }
    s.position.copy(pos);
    s.userData.v = dir.clone().multiplyScalar(rand(1.5, 2.5)).add(new THREE.Vector3(0, rand(1.5, 2.5), 0));
    s.userData.t = 0; s.userData.bounced = false;
    this.shells.push(s);
  }
  setWeather(kind) {
    if (this.weather) { this.scene.remove(this.weather.obj); this.weather.obj.geometry.dispose(); this.weather = null; }
    if (!kind) return;
    const N = kind === 'rain' ? 5000 : kind === 'snow' ? 4000 : 800;
    const R = 30;
    if (kind === 'rain') {
      const pos = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) { const x = rand(-R, R), y = rand(0, 25), z = rand(-R, R); pos.set([x, y, z, x + 0.03, y - 0.6, z], i * 6); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.LineBasicMaterial({ color: 0x8a9ab8, transparent: true, opacity: 0.35, depthWrite: false });
      const obj = new THREE.LineSegments(g, m); obj.frustumCulled = false;
      this.scene.add(obj); this.weather = { kind, obj, pos, N, R, speed: 22 };
    } else {
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) pos.set([rand(-R, R), rand(0, 20), rand(-R, R)], i * 3);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ map: this.texSoft, size: kind === 'snow' ? 0.09 : 0.05, color: kind === 'snow' ? 0xffffff : 0xd8c09a, transparent: true, opacity: kind === 'snow' ? 0.9 : 0.4, depthWrite: false, sizeAttenuation: true });
      const obj = new THREE.Points(g, m); obj.frustumCulled = false;
      this.scene.add(obj); this.weather = { kind, obj, pos, N, R, speed: kind === 'snow' ? 1.6 : 0.3 };
    }
  }
  update(dt, camPos) {
    // 光源
    for (const s of this.lights) {
      if (s.t > 0) { s.t -= dt; s.l.intensity = s.max * Math.max(0, s.t / s.dur); } else s.l.intensity = 0;
    }
    // 曳光
    let w = 0;
    const tp = this.tpos, tc = this.tcol;
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      t.t += dt * t.speed;
      if (t.t - 3 > t.len) continue;
      this.tracers[w++] = t;
    }
    this.tracers.length = w;
    for (let i = 0; i < this.MAXT; i++) {
      if (i < w) {
        const t = this.tracers[i];
        const a = Math.max(0, Math.min(t.len, t.t - 3)), b = Math.min(t.len, t.t);
        tp[i * 6] = t.a.x + t.d.x * a; tp[i * 6 + 1] = t.a.y + t.d.y * a; tp[i * 6 + 2] = t.a.z + t.d.z * a;
        tp[i * 6 + 3] = t.a.x + t.d.x * b; tp[i * 6 + 4] = t.a.y + t.d.y * b; tp[i * 6 + 5] = t.a.z + t.d.z * b;
        tc[i * 6] = t.c[0] * 0.3; tc[i * 6 + 1] = t.c[1] * 0.3; tc[i * 6 + 2] = t.c[2] * 0.3;
        tc[i * 6 + 3] = t.c[0]; tc[i * 6 + 4] = t.c[1]; tc[i * 6 + 5] = t.c[2];
      } else { for (let k = 0; k < 6; k++) tp[i * 6 + k] = 0; }
    }
    this.tgeo.attributes.position.needsUpdate = true; this.tgeo.attributes.color.needsUpdate = true;
    // 火
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t += dt; f.acc += dt;
      if (f.t > f.dur) { this.fires.splice(i, 1); continue; }
      const rate = f.r > 1 ? 0.015 : 0.05;
      while (f.acc > rate) {
        f.acc -= rate;
        const a = Math.random() * 6.28, r = Math.random() * f.r;
        this.add.emit({ x: f.pos.x + Math.cos(a) * r, y: f.pos.y, z: f.pos.z + Math.sin(a) * r, vx: rand(-0.2, 0.2), vy: rand(1, 2.2), vz: rand(-0.2, 0.2), life: rand(0.4, 0.8), s0: 0.5, s1: 0.1, c0: [5, 2, 0.5], c1: [2, 0.3, 0.05], a0: 0.9 });
        if (Math.random() < 0.3) this.smoke.emit({ x: f.pos.x + Math.cos(a) * r, y: f.pos.y + 0.8, z: f.pos.z + Math.sin(a) * r, vx: rand(-0.2, 0.2), vy: rand(1, 1.8), vz: rand(-0.2, 0.2), life: rand(1.5, 3), s0: 0.4, s1: 1.8, c0: [0.1, 0.1, 0.1], a0: 0.35, fadeIn: 0.1 });
      }
      if (f.dmg) f.dmg(dt, f);
    }
    // 烟雾弹
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const c = this.smokeClouds[i];
      c.t += dt;
      c.r = Math.min(c.maxR, c.t * 3) * (c.t > c.dur - 2 ? Math.max(0, (c.dur - c.t) / 2) : 1);
      if (c.t > c.dur) { this.smokeClouds.splice(i, 1); continue; }
      c.emitAcc += dt;
      while (c.emitAcc > 0.04 && c.t < c.dur - 2) {
        c.emitAcc -= 0.04;
        const a = Math.random() * 6.28, r = Math.random() * c.r * 0.8;
        this.smoke.emit({ x: c.pos.x + Math.cos(a) * r, y: c.pos.y + rand(0.2, 2.5), z: c.pos.z + Math.sin(a) * r, vx: rand(-0.3, 0.3), vy: rand(0, 0.3), vz: rand(-0.3, 0.3), drag: 0.5, life: 3.5, s0: 2, s1: 5, c0: [0.75, 0.76, 0.78], a0: 0.55, fadeIn: 0.2 });
      }
    }
    // 弹壳
    for (const s of this.shells) {
      const u = s.userData; u.t += dt;
      if (u.t > 3) continue;
      u.v.y -= 9.8 * dt;
      s.position.addScaledVector(u.v, dt);
      s.rotation.x += dt * 20; s.rotation.z += dt * 15;
      const floor = this.game.world ? this.game.world.groundHeight(s.position.x, s.position.z, s.position.y, 0.01) : 0;
      if (s.position.y < floor + 0.005) { s.position.y = floor + 0.005; u.v.multiplyScalar(0.3); u.v.y = Math.abs(u.v.y); if (!u.bounced) { u.bounced = true; } }
    }
    this.add.update(dt, this.scene);
    this.smoke.update(dt, this.scene);
    // 天气
    const W = this.weather;
    if (W && camPos) {
      W.obj.position.set(camPos.x, 0, camPos.z);
      const p = W.pos, R = W.R;
      if (W.kind === 'rain') {
        for (let i = 0; i < W.N; i++) {
          const o = i * 6; p[o + 1] -= W.speed * dt; p[o + 4] -= W.speed * dt;
          if (p[o + 4] < 0) { const y = 20 + Math.random() * 5; p[o + 1] = y; p[o + 4] = y - 0.6; }
        }
      } else {
        const tt = performance.now() * 0.001;
        for (let i = 0; i < W.N; i++) {
          const o = i * 3; p[o + 1] -= W.speed * dt * (0.6 + (i % 5) * 0.15);
          p[o] += Math.sin(tt + i) * dt * 0.5 + (W.kind === 'snow' ? dt * 1.2 : dt * 0.8);
          if (p[o] > R) p[o] -= 2 * R;
          if (p[o + 1] < 0) p[o + 1] = 20;
        }
      }
      W.obj.geometry.attributes.position.needsUpdate = true;
    }
  }
  // 烟雾遮挡
  smokeBlocks(a, b) {
    for (const c of this.smokeClouds) {
      if (c.r < 1) continue;
      // 线段到点距离
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const apx = c.pos.x - a.x, apy = c.pos.y + 1 - a.y, apz = c.pos.z - a.z;
      const L2 = abx * abx + aby * aby + abz * abz;
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / L2));
      const dx = a.x + abx * t - c.pos.x, dy = a.y + aby * t - c.pos.y - 1, dz = a.z + abz * t - c.pos.z;
      if (dx * dx + dy * dy * 0.5 + dz * dz < c.r * c.r) return true;
    }
    return false;
  }
  clear() {
    this.add.clear(); this.smoke.clear(); this.tracers.length = 0;
    for (const d of this.decals) this.scene.remove(d);
    this.decals.length = 0;
    for (const s of this.shells) this.scene.remove(s);
    this.shells.length = 0;
    this.fires.length = 0; this.smokeClouds.length = 0;
    this.setWeather(null);
  }
}
