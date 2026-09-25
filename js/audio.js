// WebAudio 程序化音效
export class Audio {
  constructor() {
    this.ctx = null; this.enabled = true; this.volume = 0.8;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.loops = {};
    this.voice = true;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.volume;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    // 混响
    this.reverb = c.createConvolver();
    const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.reverb.buffer = ir;
    this.revGain = c.createGain(); this.revGain.gain.value = 0.35;
    this.reverb.connect(this.revGain); this.revGain.connect(this.master);
    // 噪声
    const nl = c.sampleRate * 2; this.noise = c.createBuffer(1, nl, c.sampleRate);
    const nd = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    // 棕噪声
    this.brown = c.createBuffer(1, nl, c.sampleRate);
    const bd = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < nl; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; bd[i] = last * 3.5; }
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setListener(p, yaw) { this.listener.x = p.x; this.listener.y = p.y; this.listener.z = p.z; this.listener.yaw = yaw; }

  // 计算空间参数
  spatial(pos) {
    if (!pos) return { gain: 1, pan: 0, dist: 0 };
    const L = this.listener;
    const dx = pos.x - L.x, dz = pos.z - L.z, dy = pos.y - L.y;
    const dist = Math.hypot(dx, dy, dz);
    const gain = 1 / (1 + dist * 0.06 + dist * dist * 0.0006);
    // 右向量 = (cos yaw, 0, -sin yaw)
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const pan = dist > 0.1 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) * 0.85 : 0;
    return { gain, pan, dist };
  }
  out(gain, pan, revSend = 0.3) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = gain;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.master); } else g.connect(this.master);
    if (revSend > 0) { const r = c.createGain(); r.gain.value = revSend; g.connect(r); r.connect(this.reverb); }
    return g;
  }
  noiseSrc(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf || this.noise; s.loop = true; s.loopStart = Math.random(); return s; }

  shot(type, pos, suppressed = false) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const sp = this.spatial(pos);
    if (sp.gain < 0.01) return;
    const P = {
      rifle: { f: 1800, q: 0.8, dec: 0.16, thump: 90, tv: 0.9, vol: 0.7 },
      rifle_heavy: { f: 1300, q: 0.7, dec: 0.22, thump: 70, tv: 1.0, vol: 0.8 },
      smg: { f: 2400, q: 0.9, dec: 0.11, thump: 110, tv: 0.6, vol: 0.55 },
      lmg: { f: 1200, q: 0.7, dec: 0.2, thump: 65, tv: 1.0, vol: 0.8 },
      sniper: { f: 900, q: 0.6, dec: 0.5, thump: 50, tv: 1.3, vol: 1.0 },
      shotgun: { f: 800, q: 0.5, dec: 0.35, thump: 55, tv: 1.3, vol: 1.0 },
      pistol: { f: 2200, q: 0.9, dec: 0.12, thump: 120, tv: 0.6, vol: 0.55 },
      pistol_heavy: { f: 1500, q: 0.7, dec: 0.25, thump: 70, tv: 1.0, vol: 0.85 },
      rocket: { f: 500, q: 0.4, dec: 0.8, thump: 40, tv: 0.8, vol: 0.9 },
      turret: { f: 1600, q: 0.8, dec: 0.12, thump: 80, tv: 0.7, vol: 0.6 },
    }[type] || { f: 1800, q: 0.8, dec: 0.16, thump: 90, tv: 0.9, vol: 0.7 };
    let vol = P.vol * sp.gain;
    let fc = P.f;
    const far = Math.min(1, sp.dist / 80);
    if (suppressed) { vol *= 0.28; fc *= 1.6; }
    fc *= 1 - far * 0.7;
    const o = this.out(vol, sp.pan, 0.25 + far * 0.6);
    // 噪声爆裂
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.setValueAtTime(fc * 3, t); bp.frequency.exponentialRampToValueAtTime(fc * 0.4, t + P.dec);
    bp.Q.value = P.q;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(1.0, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.001, t + P.dec * (suppressed ? 0.5 : 1));
    n.connect(bp); bp.connect(ng); ng.connect(o);
    n.start(t); n.stop(t + P.dec + 0.05);
    // 低频冲击
    if (!suppressed || sp.dist < 5) {
      const os = c.createOscillator(); os.type = 'sine';
      os.frequency.setValueAtTime(P.thump * 2.2, t); os.frequency.exponentialRampToValueAtTime(P.thump * 0.5, t + 0.12);
      const og = c.createGain(); og.gain.setValueAtTime(P.tv * (1 - far * 0.5), t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      os.connect(og); og.connect(o); os.start(t); os.stop(t + 0.2);
    }
    // 机械声
    if (!pos) {
      const cl = this.noiseSrc();
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
      const cg = c.createGain(); cg.gain.setValueAtTime(0.25, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      cl.connect(hp); hp.connect(cg); cg.connect(o); cl.start(t); cl.stop(t + 0.05);
    }
  }
  explosion(pos, big = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const sp = this.spatial(pos);
    const o = this.out(Math.min(1.4, 1.6 * big * Math.sqrt(sp.gain)), sp.pan, 0.6);
    const n = this.noiseSrc(this.brown);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.4);
    const g = c.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(1.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    n.connect(lp); lp.connect(g); g.connect(o); n.start(t); n.stop(t + 2);
    const os = c.createOscillator(); os.frequency.setValueAtTime(90, t); os.frequency.exponentialRampToValueAtTime(25, t + 0.5);
    const og = c.createGain(); og.gain.setValueAtTime(1.4, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    os.connect(og); og.connect(o); os.start(t); os.stop(t + 0.8);
    const n2 = this.noiseSrc();
    const g2 = c.createGain(); g2.gain.setValueAtTime(0.6, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n2.connect(g2); g2.connect(o); n2.start(t); n2.stop(t + 0.3);
  }
  tone(freq, dur, vol = 0.2, type = 'sine', pos = null, slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const sp = this.spatial(pos);
    const o = this.out(vol * sp.gain, sp.pan, 0.05);
    const os = c.createOscillator(); os.type = type; os.frequency.setValueAtTime(freq, t);
    if (slide) os.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    os.connect(g); g.connect(o); os.start(t); os.stop(t + dur + 0.02);
  }
  click(freq = 3000, dur = 0.03, vol = 0.3, pos = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const sp = this.spatial(pos);
    const o = this.out(vol * sp.gain, sp.pan, 0.05);
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(bp); bp.connect(g); g.connect(o); n.start(t); n.stop(t + dur + 0.02);
  }
  hit(kill = false, head = false) {
    this.click(head ? 5200 : 3800, 0.05, 0.5);
    if (head) this.tone(1800, 0.08, 0.15, 'triangle');
    if (kill) { this.tone(700, 0.12, 0.25, 'triangle'); setTimeout(() => this.tone(520, 0.14, 0.2, 'triangle'), 60); }
  }
  hurt() { this.click(400, 0.12, 0.5); this.tone(120, 0.2, 0.3, 'sine', null, 0.6); }
  step(pos, surface = 'dirt', vol = 0.18) {
    const f = { dirt: 900, sand: 700, snow: 500, metal: 2400, concrete: 1400, wet: 1800 }[surface] || 1000;
    this.click(f + Math.random() * 300, 0.07, vol, pos);
  }
  reload(stage) {
    if (stage === 'out') { this.click(1800, 0.05, 0.35); this.click(900, 0.08, 0.25); }
    else if (stage === 'in') { this.click(1200, 0.06, 0.45); setTimeout(() => this.click(2600, 0.03, 0.35), 40); }
    else if (stage === 'bolt') { this.click(2200, 0.05, 0.4); setTimeout(() => this.click(1500, 0.06, 0.4), 90); }
    else if (stage === 'shell') { this.click(1600, 0.05, 0.35); }
  }
  empty() { this.click(3200, 0.02, 0.35); }
  ring(dur = 3, vol = 0.12) { this.tone(3600, dur, vol, 'sine'); }
  bounce(pos) { this.click(3500, 0.04, 0.3, pos); }
  ui(kind = 'hover') {
    if (!this.ctx) return;
    if (kind === 'hover') this.tone(1200, 0.04, 0.05, 'sine');
    else if (kind === 'click') { this.tone(700, 0.06, 0.12, 'triangle'); }
    else if (kind === 'equip') { this.click(1500, 0.06, 0.3); this.tone(300, 0.1, 0.1, 'triangle'); }
  }
  beep(n = 2) { for (let i = 0; i < n; i++) setTimeout(() => this.tone(1450, 0.08, 0.1, 'square'), i * 120); }
  whoosh(pos) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, sp = this.spatial(pos);
    const o = this.out(0.5 * Math.sqrt(sp.gain), sp.pan, 0.3);
    const n = this.noiseSrc(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2000, t + 1.2); bp.frequency.exponentialRampToValueAtTime(200, t + 2.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(1, t + 1.2); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    n.connect(bp); bp.connect(g); g.connect(o); n.start(t); n.stop(t + 2.7);
  }
  // 持续环境声
  loop(name, kind, vol) {
    if (!this.ctx) return;
    this.stopLoop(name);
    const c = this.ctx;
    const n = this.noiseSrc(kind === 'wind' ? this.brown : this.noise);
    const f = c.createBiquadFilter();
    const g = c.createGain(); g.gain.value = vol;
    if (kind === 'rain') { f.type = 'highpass'; f.frequency.value = 1200; }
    else if (kind === 'wind') { f.type = 'lowpass'; f.frequency.value = 500; }
    else if (kind === 'rotor') {
      f.type = 'lowpass'; f.frequency.value = 300;
      const lfo = c.createOscillator(); lfo.frequency.value = 13; const lg = c.createGain(); lg.gain.value = vol * 0.9;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(); this.loops[name + '_lfo'] = lfo;
    } else if (kind === 'fire') { f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5; }
    n.connect(f); f.connect(g); g.connect(this.master); n.start();
    this.loops[name] = { n, g };
  }
  setLoopVol(name, v) { const l = this.loops[name]; if (l && l.g) l.g.gain.value = v; }
  stopLoop(name) {
    const l = this.loops[name]; if (l) { try { l.n.stop(); } catch (e) { } delete this.loops[name]; }
    const lf = this.loops[name + '_lfo']; if (lf) { try { lf.stop(); } catch (e) { } delete this.loops[name + '_lfo']; }
  }
  stopAll() { for (const k of Object.keys(this.loops)) this.stopLoop(k); if (window.speechSynthesis) speechSynthesis.cancel(); }
  say(text, rate = 1.1, pitch = 0.9) {
    if (!this.voice || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = rate; u.pitch = pitch; u.volume = Math.min(1, this.volume + 0.1);
      const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('zh'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { }
  }
}
