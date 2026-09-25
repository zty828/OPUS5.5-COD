// 菜单系统：主菜单、战役简报、多人大厅、配装、枪匠、设置、暂停、结算
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WEAPONS, PRIMARY_ORDER, SECONDARY_ORDER, SLOT_NAMES, ATTACHMENTS, CAMOS, computeStats, statBars, PERKS, LETHALS, TACTICALS, KILLSTREAKS, MP_MAPS, MP_MODES, attachmentAllowed, findAttachment } from './data.js';
import { buildGun } from './gunmodel.js';
import { createSoldierModel, animateSoldier } from './soldier.js';
import { mat, camoSwatch } from './materials.js';
import { damp, fmtTime } from './util.js';

const DIFF_NAMES = ['新兵', '正规军', '老兵'];
const MAX_ATT = 5;

// 地图缩略插画（内联SVG）
const MAP_ART = {
  dune: `<svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c98a"/><stop offset="1" stop-color="#b3773d"/></linearGradient></defs><rect width="300" height="150" fill="url(#gd)"/><circle cx="230" cy="40" r="18" fill="#fff4d6" opacity=".9"/><path d="M0 110 L20 110 20 80 60 80 60 95 75 95 75 70 95 70 95 60 105 60 105 70 120 70 120 100 150 100 150 75 190 75 190 90 210 90 210 65 235 65 235 90 260 90 260 78 300 78 300 150 0 150Z" fill="#6b4520"/><path d="M85 60 Q100 40 115 60Z" fill="#6b4520"/><rect x="98" y="30" width="4" height="30" fill="#6b4520"/></svg>`,
  frost: `<svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe7ee"/><stop offset="1" stop-color="#8395a6"/></linearGradient></defs><rect width="300" height="150" fill="url(#gf)"/><path d="M0 70 L50 40 90 65 140 30 200 70 250 45 300 65 300 150 0 150Z" fill="#b8c5d2"/><rect x="30" y="80" width="40" height="45" fill="#46566a"/><ellipse cx="50" cy="80" rx="20" ry="5" fill="#56677b"/><rect x="90" y="70" width="50" height="55" fill="#3b4a5c"/><ellipse cx="115" cy="70" rx="25" ry="6" fill="#4d5d70"/><rect x="170" y="45" width="6" height="80" fill="#3b4a5c"/><rect x="190" y="90" width="100" height="35" fill="#34414f"/><rect x="0" y="125" width="300" height="25" fill="#eef3f7"/></svg>`,
  neon: `<svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice"><rect width="300" height="150" fill="#0d0f2a"/><rect x="10" y="30" width="50" height="120" fill="#16183a"/><rect x="70" y="10" width="45" height="140" fill="#1b1d45"/><rect x="125" y="50" width="60" height="100" fill="#15173a"/><rect x="195" y="20" width="40" height="130" fill="#1d2050"/><rect x="245" y="45" width="55" height="105" fill="#14163a"/><rect x="20" y="60" width="30" height="6" fill="#ff3fa4"/><rect x="80" y="40" width="25" height="5" fill="#3ff4ff"/><rect x="135" y="70" width="40" height="6" fill="#ffdd3f"/><rect x="205" y="55" width="20" height="30" fill="none" stroke="#ff3fa4" stroke-width="2"/><rect x="255" y="80" width="35" height="5" fill="#3ff4ff"/><rect x="0" y="130" width="300" height="20" fill="#20234f" opacity=".8"/><g stroke="#8fa0ff" stroke-width=".6" opacity=".35"><line x1="30" y1="0" x2="25" y2="20"/><line x1="120" y1="10" x2="115" y2="30"/><line x1="220" y1="0" x2="215" y2="20"/><line x1="270" y1="30" x2="265" y2="50"/><line x1="160" y1="20" x2="155" y2="40"/></g></svg>`,
  yard: `<svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="gy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb05a"/><stop offset=".6" stop-color="#c8554a"/><stop offset="1" stop-color="#4a2437"/></linearGradient></defs><rect width="300" height="150" fill="url(#gy)"/><circle cx="80" cy="85" r="26" fill="#ffe0a0" opacity=".8"/><path d="M180 20 L185 20 185 125 180 125Z M150 22 L280 22 280 27 150 27Z M240 27 L242 60 238 60Z" fill="#2c1824"/><rect x="0" y="95" width="70" height="30" fill="#6a2a24"/><rect x="75" y="100" width="70" height="25" fill="#24425e"/><rect x="20" y="70" width="70" height="25" fill="#2d4a2d"/><rect x="150" y="90" width="80" height="35" fill="#8a4a1e"/><rect x="235" y="98" width="65" height="27" fill="#3a3e44"/><rect x="0" y="125" width="300" height="25" fill="#2a1a22"/></svg>`,
};

const FX_LABEL = {
  recoilV: ['垂直后坐力', -1], recoilH: ['水平后坐力', -1], ads: ['开镜时间', -1], range: ['有效射程', 1], mobility: ['移动速度', 1],
  mag: ['弹匣容量', 1], reload: ['换弹时间', -1], hip: ['腰射扩散', -1], sprintFire: ['冲刺后射击延迟', -1],
};
function fxList(fx) {
  const out = [];
  for (const k in fx) {
    const v = fx[k];
    if (FX_LABEL[k]) {
      const [n, dir] = FX_LABEL[k];
      const pct = Math.round((v - 1) * 100);
      const good = pct * dir > 0;
      out.push(`<span style="color:${good ? '#8fe06a' : '#ff6a5a'}">${good ? '▲' : '▼'} ${n} ${pct > 0 ? '+' : ''}${pct}%</span>`);
    } else if (k === 'suppressed') out.push('<span style="color:#8fe06a">▲ 雷达隐身</span>');
    else if (k === 'flashHide') out.push('<span style="color:#8fe06a">▲ 隐藏枪口火光</span>');
    else if (k === 'zoom') out.push(`<span style="color:#ccc">● 放大倍率 ${v}x</span>`);
    else if (k === 'laser') out.push('<span style="color:#ccc">● 可见激光</span>');
  }
  return out.join('');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Menu {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('menu');
    this.overlayOpen = false;
    this.camTarget = { pos: new THREE.Vector3(-0.3, 1.45, 4.2), look: new THREE.Vector3(0.6, 1.15, 0) };
    this.camLook = this.camTarget.look.clone();
    this.gunRotY = -Math.PI / 2; this.gunRotX = 0; this.gunSpin = true;
    this.lobby = { mode: 'tdm', map: 'dune', diff: 1, allies: 5, enemies: 6, time: 10 };
    this.campDiff = 1;
    this.selClass = game.profile.selClass || 0;
    this.buildScene();
    this.el.addEventListener('pointerdown', () => game.audio.init());
    this.el.addEventListener('mouseover', e => { const t = e.target.closest('.mbtn,.btn,.pick,.cls,.slotc,.gs-att,.gs-slot,.mode,.mapc,.diff'); if (t && t !== this._hov) { this._hov = t; game.audio.ui('hover'); } });
    this.el.addEventListener('click', e => { if (e.target.closest('.mbtn,.btn,.pick,.cls,.slotc,.gs-att,.gs-slot,.mode,.mapc,.diff,.seg div,.camo')) game.audio.ui('click'); });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && game.paused && this.screen === 'pause' && performance.now() - this.pauseAt > 300) this.resume();
      else if (e.code === 'Escape' && this.screen === 'classSelect') this.hideClassSelect();
    });
    // 枪匠拖拽旋转
    let drag = null;
    this.el.addEventListener('pointerdown', e => { if (this.screen === 'gunsmith' && !e.target.closest('.gs-left,.gs-right,.gs-stats,.gs-foot')) { drag = { x: e.clientX, y: e.clientY }; this.gunSpin = false; } });
    window.addEventListener('pointermove', e => { if (drag) { this.gunRotY += (e.clientX - drag.x) * 0.01; this.gunRotX = Math.max(-0.6, Math.min(0.6, this.gunRotX + (e.clientY - drag.y) * 0.006)); drag.x = e.clientX; drag.y = e.clientY; } });
    window.addEventListener('pointerup', () => { drag = null; });
    this.el.addEventListener('wheel', e => { if (this.screen === 'gunsmith') { this.gsZoom = Math.max(0.8, Math.min(2.2, (this.gsZoom || 1.45) + Math.sign(e.deltaY) * 0.1)); this.camTarget.pos.z = this.gsZoom; } }, { passive: true });
  }

  // ---------------- 3D 场景 ----------------
  buildScene() {
    const game = this.game;
    const s = this.scene3d = new THREE.Scene();
    s.background = new THREE.Color(0x06080a);
    s.fog = new THREE.FogExp2(0x06080a, 0.07);
    const pm = new THREE.PMREMGenerator(game.renderer);
    s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.3;
    pm.dispose();
    const cam = this.camera3d = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 100);
    cam.position.copy(this.camTarget.pos);
    const plane = (w, h, m, sc) => {
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / sc, uv.getY(i) * h / sc);
      const me = new THREE.Mesh(g, m); me.receiveShadow = true; return me;
    };
    const floor = plane(40, 40, mat('concreteDark'), 3); floor.rotation.x = -Math.PI / 2; s.add(floor);
    const wall = plane(40, 12, mat('concreteDark'), 3); wall.position.set(0, 6, -5); s.add(wall);
    // 道具：箱子、沙袋、油桶
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat('crate')); crate.position.set(-1.4, 0.5, -1.6); crate.rotation.y = 0.3; crate.castShadow = crate.receiveShadow = true; s.add(crate);
    const crate2 = crate.clone(); crate2.scale.setScalar(0.7); crate2.position.set(-1.35, 1.35, -1.6); crate2.rotation.y = 0.7; s.add(crate2);
    const case1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.5), mat('darkMetal')); case1.position.set(2.4, 0.175, -1.2); case1.rotation.y = -0.4; case1.castShadow = true; s.add(case1);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20), mat('containerGreen')); barrel.position.set(2.9, 0.45, -2.4); barrel.castShadow = true; s.add(barrel);
    const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8).rotateZ(Math.PI / 2), mat('sandbag'));
    for (let i = 0; i < 5; i++) { const b = sb.clone(); b.position.set(-3 + (i % 3) * 0.75 + (i > 2 ? 0.37 : 0), 0.18 + (i > 2 ? 0.32 : 0), -2.6); b.castShadow = true; s.add(b); }
    // 灯光
    const key = new THREE.SpotLight(0xffe2c0, 60, 20, 0.55, 0.6, 1.4);
    key.position.set(3, 5, 4); key.target.position.set(0.6, 1, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
    s.add(key, key.target);
    const rim = new THREE.SpotLight(0x6aa8ff, 70, 20, 0.6, 0.7, 1.3);
    rim.position.set(-3, 4, -3); rim.target.position.set(0.6, 1.2, 0); s.add(rim, rim.target);
    const rim2 = new THREE.PointLight(0xffa040, 6, 8, 1.5); rim2.position.set(3.5, 1.2, -1.5); s.add(rim2);
    this.fireLight = rim2;
    s.add(new THREE.HemisphereLight(0x8090a0, 0x201810, 0.25));
    // 浮尘
    const N = 400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 10; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * 8; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dc = dot.getContext('2d'); const gr = dc.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); dc.fillStyle = gr; dc.fillRect(0, 0, 32, 32);
    this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.025, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe0c0 }));
    s.add(this.dust);
    // 枪械展示
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(0, 1.25, 0); s.add(this.gunHolder);
    const gl = new THREE.SpotLight(0xffffff, 45, 6, 0.6, 0.5, 1.2); gl.position.set(0.6, 2.8, 1.6); gl.target = this.gunHolder; s.add(gl);
    const gl2 = new THREE.PointLight(0x9fc4ff, 4, 5, 1.5); gl2.position.set(-1, 1.6, 1.2); s.add(gl2);
    this.gunLight = gl; gl.visible = false; this.gunLight2 = gl2; gl2.visible = false;
    this.soldierAnim = { speed: 0, phase: 0, crouch: 0, pitch: -0.12, dead: false, recoil: 0 };
    this.setSoldier(this.game.profile.classes[this.selClass]);
  }
  setSoldier(cls) {
    const key = cls.primary + JSON.stringify(cls.patt) + cls.pcamo;
    if (this.soldierKey === key) return;
    this.soldierKey = key;
    if (this.soldier) this.scene3d.remove(this.soldier.root);
    const p = this.soldier = createSoldierModel('ally', cls.primary, cls.patt, cls.pcamo);
    p.root.position.set(0.95, 0, 0.2);
    p.root.rotation.y = Math.PI - 0.95;
    this.scene3d.add(p.root);
  }
  showGun(id, att, camo) {
    const key = id + JSON.stringify(att) + camo;
    if (this.gunKey === key) return;
    this.gunKey = key;
    if (this.gun) { this.gunHolder.remove(this.gun); this.gun.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const info = buildGun(id, att, camo);
    const g = new THREE.Group(); g.add(info.group);
    const box = new THREE.Box3().setFromObject(info.group);
    const c = box.getCenter(new THREE.Vector3());
    info.group.position.sub(c);
    const size = box.getSize(new THREE.Vector3());
    const sc = 1.25 / Math.max(size.x, size.y, size.z);
    g.scale.setScalar(Math.min(2.2, sc));
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.gun = g; this.gunHolder.add(g);
  }
  setCam(kind) {
    this.camKind = kind;
    const T = this.camTarget;
    if (kind === 'gunsmith') { T.pos.set(0, 1.3, this.gsZoom || 1.45); T.look.set(0, 1.22, 0); }
    else if (kind === 'loadout') { T.pos.set(-1.1, 1.35, 3.5); T.look.set(-0.55, 1.1, 0); }
    else if (kind === 'lobby') { T.pos.set(-1.2, 1.2, 3.8); T.look.set(-0.3, 1.2, 0); }
    else { T.pos.set(-0.3, 1.45, 4.2); T.look.set(0.6, 1.15, 0); }
    const gs = kind === 'gunsmith';
    this.gunHolder.visible = gs; this.gunLight.visible = gs; this.gunLight2.visible = gs;
    if (this.soldier) this.soldier.root.visible = !gs;
    if (gs) { this.gunSpin = true; this.gunRotX = 0.05; }
  }
  update(dt) {
    const t = performance.now() * 0.001;
    const cam = this.camera3d, T = this.camTarget;
    cam.position.x = damp(cam.position.x, T.pos.x + Math.sin(t * 0.3) * 0.04, 4, dt);
    cam.position.y = damp(cam.position.y, T.pos.y + Math.sin(t * 0.4) * 0.02, 4, dt);
    cam.position.z = damp(cam.position.z, T.pos.z, 4, dt);
    this.camLook.x = damp(this.camLook.x, T.look.x, 4, dt); this.camLook.y = damp(this.camLook.y, T.look.y, 4, dt); this.camLook.z = damp(this.camLook.z, T.look.z, 4, dt);
    cam.lookAt(this.camLook);
    if (this.soldier && this.soldier.root.visible) {
      const a = this.soldierAnim;
      a.pitch = -0.1 + Math.sin(t * 1.3) * 0.015;
      animateSoldier(this.soldier, a, dt);
      this.soldier.torso.rotation.z = Math.sin(t * 0.9) * 0.015;
      this.soldier.hips.position.y = 0.95 + Math.sin(t * 2.6) * 0.004;
    }
    if (this.gunHolder.visible) {
      if (this.gunSpin) this.gunRotY += dt * 0.35;
      this.gunHolder.rotation.y = damp(this.gunHolder.rotation.y, this.gunRotY, 8, dt);
      this.gunHolder.rotation.x = damp(this.gunHolder.rotation.x, this.gunRotX, 8, dt);
      this.gunHolder.position.y = 1.25 + Math.sin(t * 1.2) * 0.01;
    }
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.03; if (y > 4) y = 0;
      p.setXYZ(i, p.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.02, y, p.getZ(i));
    }
    p.needsUpdate = true;
    this.fireLight.intensity = 5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7.3) * 0.8;
  }
  onResize() {
    this.camera3d.aspect = window.innerWidth / window.innerHeight;
    this.camera3d.updateProjectionMatrix();
  }

  // ---------------- 工具 ----------------
  render(html, cls = 'dim', screen = '') {
    this.screen = screen;
    this.el.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    return this.el.firstChild;
  }
  on(root, sel, fn) { root.querySelectorAll(sel).forEach((el, i) => el.addEventListener('click', e => fn(el, e, i))); }
  hide() { this.el.innerHTML = ''; this.screen = ''; this.overlayOpen = false; }
  level() {
    const xp = this.game.profile.xp || 0;
    const lv = Math.min(55, Math.floor(Math.sqrt(xp / 300)) + 1);
    const a = Math.pow(lv - 1, 2) * 300, b = Math.pow(lv, 2) * 300;
    return { lv, frac: lv >= 55 ? 1 : (xp - a) / (b - a), xp };
  }
  playerCard() {
    const L = this.level();
    return `<div class="player-card"><div class="lvl">${L.lv}</div><div><div style="font-weight:700;letter-spacing:2px">指挥官</div><div style="font-size:11px;color:#999">等级 ${L.lv} · ${L.xp} XP</div><div class="xpbar"><div style="width:${Math.round(L.frac * 100)}%"></div></div></div></div>`;
  }
  showLoadingOverlay(text) {
    this.render(`<div style="margin:auto;text-align:center"><div class="logo"><div class="l1">现代战线</div><div class="l2">MODERN FRONTLINE</div></div><div class="load-bar" style="width:420px;margin:0 auto"><div style="height:100%;width:100%;background:var(--acc);animation:ldpulse 1s infinite"></div></div><div style="margin-top:14px;color:#999;letter-spacing:3px;font-size:13px">${esc(text)}</div></div><style>@keyframes ldpulse{0%{opacity:.2}50%{opacity:1}100%{opacity:.2}}</style>`, 'solid', 'loading');
  }

  // ---------------- 主菜单 ----------------
  showMain() {
    this.setCam('main');
    this.setSoldier(this.game.profile.classes[this.game.profile.selClass || 0]);
    const best = this.game.profile.campaignBest;
    const r = this.render(`
      <div class="menu-left">
        <div class="menu-title">现代战线</div>
        <div class="menu-sub">MODERN FRONTLINE</div>
        <div class="mbtn" data-a="campaign"><div class="ico">◈</div><div><div class="mt">战役</div><div class="md">行动代号：午夜清道夫 ${best ? '· 最佳 ' + fmtTime(best) : ''}</div></div></div>
        <div class="mbtn" data-a="mp"><div class="ico">⚔</div><div><div class="mt">多人对战</div><div class="md">团队死斗 · 占领 · 自由混战（对战AI）</div></div></div>
        <div class="mbtn" data-a="loadout"><div class="ico">⚙</div><div><div class="mt">武器装备</div><div class="md">自定义配装 · 枪匠 · 技能 · 连杀奖励</div></div></div>
        <div class="mbtn" data-a="settings"><div class="ico">☰</div><div><div class="mt">设置</div><div class="md">画面 · 操作 · 音频</div></div></div>
      </div>
      ${this.playerCard()}
      <div style="position:absolute;right:40px;bottom:30px;text-align:right;font-size:12px;color:#777;line-height:1.9">
        <div><span class="kbd">WASD</span>移动 <span class="kbd">Shift</span>冲刺 <span class="kbd">C</span>蹲/滑铲 <span class="kbd">空格</span>跳跃 <span class="kbd">R</span>换弹 <span class="kbd">V</span>近战</div>
        <div><span class="kbd">G</span>致命装备 <span class="kbd">Q</span>战术装备 <span class="kbd">F</span>互动 <span class="kbd">N</span>夜视仪 <span class="kbd">3/4/5</span>连杀奖励 <span class="kbd">Tab</span>记分板</div>
        <div style="color:#555;margin-top:6px">现代战线 v1.0 · 程序化实时渲染 · 本作为原创致敬作品</div>
      </div>`, 'dim', 'main');
    this.on(r, '[data-a]', el => {
      const a = el.dataset.a;
      if (a === 'campaign') this.showCampaign();
      else if (a === 'mp') this.showLobby();
      else if (a === 'loadout') this.showLoadouts('main');
      else if (a === 'settings') this.showSettings('main');
    });
  }

  // ---------------- 战役简报 ----------------
  showCampaign() {
    this.setCam('lobby');
    const best = this.game.profile.campaignBest;
    const diffDesc = ['敌人反应迟缓，你能承受更多伤害。适合初次体验。', '标准的战斗体验，需要合理利用掩体。', '敌人致命而精准，每一次暴露都可能是最后一次。'];
    const r = this.render(`
      <div class="brief">
        <div class="op">行动代号</div>
        <h1>午夜清道夫</h1>
        <p>卡尔达什边境，当地时间凌晨 02:40。情报确认，军火走私网络头目 <b style="color:#fff">「铁蝎」萨米尔</b> 今夜藏身于边境村落深处的一座武装大院中。他掌握着一批失踪的便携式防空导弹的下落。</p>
        <p>你将与 <b style="color:#fff">布雷克上尉</b> 和狙击手 <b style="color:#fff">渡鸦</b> 一同夜间渗透：拔除外围前哨，穿越村庄，突入大院，击毙目标并夺取情报，随后在敌人的反扑中坚守直至撤离。</p>
        <div class="meta"><div>地点<b>卡尔达什边境</b></div><div>时间<b>02:40 夜间</b></div><div>小队<b>3 人</b></div><div>最佳用时<b>${best ? fmtTime(best) : '—'}</b></div></div>
        <div class="diffs">${DIFF_NAMES.map((n, i) => `<div class="diff ${i === this.campDiff ? 'sel' : ''}" data-d="${i}"><b>${n}</b><span>${diffDesc[i]}</span></div>`).join('')}</div>
        <div style="display:flex;gap:12px"><button class="btn" data-a="go">开始任务</button><button class="btn ghost" data-a="back">返回</button></div>
      </div>`, 'dim', 'campaign');
    this.on(r, '.diff', el => { this.campDiff = +el.dataset.d; r.querySelectorAll('.diff').forEach(d => d.classList.toggle('sel', d === el)); });
    this.on(r, '[data-a=go]', () => this.game.startGame('campaign', { diff: this.campDiff }));
    this.on(r, '[data-a=back]', () => this.showMain());
  }

  // ---------------- 多人大厅 ----------------
  showLobby() {
    this.setCam('lobby');
    const L = this.lobby, P = this.game.profile;
    const cls = P.classes[P.selClass || 0];
    const seg = (key, vals, labels) => `<div class="seg" data-k="${key}">${vals.map((v, i) => `<div data-v="${v}" class="${L[key] == v ? 'sel' : ''}">${labels ? labels[i] : v}</div>`).join('')}</div>`;
    const r = this.render(`
      <div class="lobby">
        <div class="hdr">多人对战<small>对战 AI · 本地对局</small></div>
        <div class="lobby-body">
          <div class="lobby-col">
            <div style="font-size:12px;color:#888;letter-spacing:3px">游戏模式</div>
            <div class="modes">${MP_MODES.map(m => `<div class="mode ${m.id === L.mode ? 'sel' : ''}" data-m="${m.id}"><b>${m.name}</b><span>${m.desc}</span></div>`).join('')}</div>
            <div style="font-size:12px;color:#888;letter-spacing:3px;margin-top:10px">地图</div>
            <div class="maps">${MP_MAPS.map(m => `<div class="mapc ${m.id === L.map ? 'sel' : ''}" data-map="${m.id}"><div class="mapart">${MAP_ART[m.id] || ''}</div><div class="mapinfo"><b>${m.name}</b><span>${m.style} — ${m.desc}</span></div></div>`).join('')}</div>
          </div>
          <div class="lobby-col" style="flex:1;max-width:460px">
            <div class="panel"><div class="opts">
              <div>AI 难度</div>${seg('diff', [0, 1, 2], DIFF_NAMES)}
              <div class="tm-only">队友数量</div><div class="tm-only">${seg('allies', [3, 5], ['3', '5'])}</div>
              <div>敌人数量</div>${seg('enemies', [4, 6, 8], ['4', '6', '8'])}
              <div>时间限制</div>${seg('time', [5, 10, 15], ['5 分钟', '10 分钟', '15 分钟'])}
              <div>胜利条件</div><div id="limitTxt" style="color:var(--acc)"></div>
            </div></div>
            <div class="panel">
              <div style="font-size:12px;color:#888;letter-spacing:3px;margin-bottom:8px">当前配装</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div><div style="font-size:20px;font-weight:800">${esc(cls.name)}</div><div style="font-size:12px;color:#aaa;margin-top:4px">${WEAPONS[cls.primary].name} · ${WEAPONS[cls.secondary].name} · ${cls.perks.map(id => this.perk(id).name).join(' / ')}</div></div>
                <button class="btn small ghost" data-a="loadout">编辑</button>
              </div>
              <div style="font-size:12px;color:#888;margin-top:10px">连杀奖励：${P.streaks.map(id => KILLSTREAKS.find(k => k.id === id)).sort((a, b) => a.kills - b.kills).map(k => `${k.icon} ${k.name}(${k.kills})`).join('　')}</div>
            </div>
            <div class="lobby-foot" style="margin-top:auto"><button class="btn ghost" data-a="back">返回</button><button class="btn" data-a="go">开始对局</button></div>
          </div>
        </div>
      </div>`, 'solid', 'lobby');
    const upd = () => {
      const lim = L.mode === 'dom' ? '先达到 200 分' : L.mode === 'ffa' ? '先达到 25 击杀' : '先达到 50 击杀';
      r.querySelector('#limitTxt').textContent = `${lim}，或时间结束时领先`;
      r.querySelectorAll('.tm-only').forEach(e => e.style.opacity = L.mode === 'ffa' ? 0.3 : 1);
    };
    upd();
    this.on(r, '.mode', el => { L.mode = el.dataset.m; r.querySelectorAll('.mode').forEach(d => d.classList.toggle('sel', d === el)); upd(); });
    this.on(r, '.mapc', el => { L.map = el.dataset.map; r.querySelectorAll('.mapc').forEach(d => d.classList.toggle('sel', d === el)); });
    r.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('div').forEach(d => d.addEventListener('click', () => { L[sg.dataset.k] = +d.dataset.v; sg.querySelectorAll('div').forEach(x => x.classList.toggle('sel', x === d)); })));
    this.on(r, '[data-a=back]', () => this.showMain());
    this.on(r, '[data-a=loadout]', () => this.showLoadouts('lobby'));
    this.on(r, '[data-a=go]', () => {
      const scoreLimit = L.mode === 'dom' ? 200 : L.mode === 'ffa' ? 25 : 50;
      this.showLoadingOverlay('正在匹配对局…');
      setTimeout(() => this.game.startGame('mp', { mode: L.mode, map: L.map, diff: L.diff, allies: L.mode === 'ffa' ? 0 : L.allies, enemies: L.enemies, scoreLimit, timeLimit: L.time }), 600);
    });
  }
  perk(id) { for (const col of PERKS) for (const p of col) if (p.id === id) return p; return { name: id, desc: '', icon: '' }; }

  // ---------------- 配装 ----------------
  showLoadouts(from) {
    this.loadoutFrom = from || this.loadoutFrom || 'main';
    this.setCam('loadout');
    const P = this.game.profile;
    const ci = this.selClass;
    const c = P.classes[ci];
    this.setSoldier(c);
    const attNames = (id, att) => Object.entries(att || {}).map(([s, a]) => (findAttachment(s, a) || {}).name).filter(Boolean).join(' · ') || '无配件';
    const L = LETHALS.find(x => x.id === c.lethal), T = TACTICALS.find(x => x.id === c.tactical);
    const streaks = P.streaks.map(id => KILLSTREAKS.find(k => k.id === id)).sort((a, b) => a.kills - b.kills);
    const r = this.render(`
      <div class="loadout">
        <div class="hdr">武器装备<small>自定义配装 · ${P.selClass === ci ? '当前使用中' : '未装备'}</small></div>
        <div style="display:flex;gap:24px;margin-top:26px;flex:1;min-height:0">
          <div class="classes">${P.classes.map((k, i) => `<div class="cls ${i === ci ? 'sel' : ''}" data-i="${i}">${esc(k.name)}${i === P.selClass ? ' <span style="color:var(--acc)">●</span>' : ''}<small>${WEAPONS[k.primary].name} · ${WEAPONS[k.secondary].name}</small></div>`).join('')}
            <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">
              <button class="btn small" data-a="equip" ${P.selClass === ci ? 'disabled style="opacity:.5"' : ''}>设为当前配装</button>
              <button class="btn small ghost" data-a="rename">重命名</button>
            </div>
          </div>
          <div class="cls-detail" style="max-width:640px">
            <div class="slotc" data-s="primary"><div class="sl">主武器 · ${WEAPONS[c.primary].cls}</div><div class="sv">${WEAPONS[c.primary].name}</div><div class="ss">${attNames(c.primary, c.patt)}</div><div style="margin-top:10px;display:flex;gap:8px"><button class="btn small" data-g="primary">枪匠</button><button class="btn small ghost" data-w="primary">更换武器</button></div></div>
            <div class="slotc" data-s="secondary"><div class="sl">副武器 · ${WEAPONS[c.secondary].cls}</div><div class="sv">${WEAPONS[c.secondary].name}</div><div class="ss">${attNames(c.secondary, c.satt)}</div><div style="margin-top:10px;display:flex;gap:8px"><button class="btn small" data-g="secondary">枪匠</button><button class="btn small ghost" data-w="secondary">更换武器</button></div></div>
            <div class="slotc" data-p="lethal"><div class="sl">致命装备</div><div class="sv">${L ? L.name : '无'}</div><div class="ss">${L ? L.desc : ''}</div></div>
            <div class="slotc" data-p="tactical"><div class="sl">战术装备</div><div class="sv">${T ? T.name : '无'}</div><div class="ss">${T ? T.desc : ''}</div></div>
            <div class="slotc wide" data-p="perks"><div class="sl">技能 PERK</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${c.perks.map(id => { const p = this.perk(id); return `<div class="perkpill">${p.icon} ${p.name}</div>`; }).join('')}</div></div>
            <div class="slotc wide" data-p="streaks"><div class="sl">连杀奖励（全配装通用）</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${streaks.map(k => `<div class="perkpill" style="background:rgba(255,180,0,.12);border-color:rgba(255,180,0,.4)">${k.icon} ${k.name} · ${k.kills}杀</div>`).join('')}</div></div>
          </div>
        </div>
        <button class="btn ghost back" data-a="back">返回</button>
      </div>`, 'dim', 'loadout');
    this.on(r, '.cls', el => { this.selClass = +el.dataset.i; this.showLoadouts(); });
    this.on(r, '[data-a=equip]', () => { P.selClass = ci; this.game.saveProfile(); this.showLoadouts(); });
    this.on(r, '[data-a=rename]', () => { const n = prompt('配装名称', c.name); if (n && n.trim()) { c.name = n.trim().slice(0, 12); this.game.saveProfile(); this.showLoadouts(); } });
    this.on(r, '[data-g]', (el, e) => { e.stopPropagation(); this.showGunsmith(ci, el.dataset.g); });
    this.on(r, '[data-w]', (el, e) => { e.stopPropagation(); this.pickWeapon(ci, el.dataset.w); });
    this.on(r, '.slotc[data-s]', el => this.pickWeapon(ci, el.dataset.s));
    this.on(r, '[data-p=lethal]', () => this.pickSimple(ci, 'lethal'));
    this.on(r, '[data-p=tactical]', () => this.pickSimple(ci, 'tactical'));
    this.on(r, '[data-p=perks]', () => this.pickPerks(ci));
    this.on(r, '[data-p=streaks]', () => this.pickStreaks());
    this.on(r, '[data-a=back]', () => { if (this.loadoutFrom === 'lobby') this.showLobby(); else if (this.loadoutFrom === 'pause') this.showPause(); else this.showMain(); });
  }
  picker(title, sub, inner, onBack) {
    const scr = this.el.firstChild;
    const d = document.createElement('div');
    d.className = 'picker';
    d.innerHTML = `<div class="hdr">${title}<small>${sub}</small></div>${inner}<button class="btn ghost back" data-a="pback">返回</button>`;
    scr.appendChild(d);
    d.querySelector('[data-a=pback]').addEventListener('click', () => { d.remove(); onBack && onBack(); });
    return d;
  }
  miniBars(id) {
    const b = statBars(computeStats(id, {}));
    return ['伤害', '射速', '射程', '精准度', '机动性'].map(k => `<div class="stat" style="margin-top:6px">${k}<div class="bar"><div class="b0" style="width:${b[k]}%"></div></div></div>`).join('');
  }
  pickWeapon(ci, slot) {
    const c = this.game.profile.classes[ci];
    const overkill = c.perks.includes('overkill');
    const list = slot === 'primary' ? PRIMARY_ORDER : overkill ? [...SECONDARY_ORDER, ...PRIMARY_ORDER.filter(x => x !== c.primary)] : SECONDARY_ORDER;
    const cur = slot === 'primary' ? c.primary : c.secondary;
    const d = this.picker(slot === 'primary' ? '选择主武器' : '选择副武器', overkill && slot === 'secondary' ? '火力过载：可携带第二把主武器' : '选择后可进入枪匠改装', `<div class="pick-grid">${list.map(id => { const w = WEAPONS[id]; return `<div class="pick ${id === cur ? 'sel' : ''}" data-id="${id}"><div class="cat">${w.cls}</div><b>${w.name}</b><span>伤害 ${w.dmg[0]} · 射速 ${w.rpm} · 弹匣 ${w.mag}</span>${this.miniBars(id)}</div>`; }).join('')}</div>`);
    this.on(d, '.pick', el => {
      const id = el.dataset.id;
      const k = slot === 'primary' ? 'patt' : 'satt';
      if (slot === 'primary') c.primary = id; else c.secondary = id;
      // 保留兼容配件
      const old = c[k] || {}; const nw = {};
      for (const s in old) { const a = findAttachment(s, old[s]); if (a && attachmentAllowed(id, s, a)) nw[s] = old[s]; }
      c[k] = nw;
      this.game.saveProfile();
      this.showLoadouts();
    });
  }
  pickSimple(ci, kind) {
    const c = this.game.profile.classes[ci];
    const list = kind === 'lethal' ? LETHALS : TACTICALS;
    const d = this.picker(kind === 'lethal' ? '致命装备' : '战术装备', '按 ' + (kind === 'lethal' ? 'G' : 'Q') + ' 使用', `<div class="pick-grid">${list.map(x => `<div class="pick ${c[kind] === x.id ? 'sel' : ''}" data-id="${x.id}"><b>${x.name}</b><span>${x.desc}</span><span style="color:var(--acc)">携带数量 ×${x.count}</span></div>`).join('')}</div>`);
    this.on(d, '.pick', el => { c[kind] = el.dataset.id; this.game.saveProfile(); this.showLoadouts(); });
  }
  pickPerks(ci) {
    const c = this.game.profile.classes[ci];
    const sel = [...c.perks];
    const d = this.picker('技能选择', '每个栏位选择一项技能', `<div class="perk-cols">${PERKS.map((col, i) => `<div class="perk-col"><div style="font-size:12px;color:var(--acc);letter-spacing:4px">技能 ${i + 1}</div>${col.map(p => `<div class="pick ${sel[i] === p.id ? 'sel' : ''}" data-c="${i}" data-id="${p.id}"><b>${p.icon} ${p.name}</b><span>${p.desc}</span></div>`).join('')}</div>`).join('')}</div><div style="margin-top:20px"><button class="btn" data-a="ok">确认</button></div>`);
    this.on(d, '.pick', el => { const i = +el.dataset.c; sel[i] = el.dataset.id; d.querySelectorAll(`.pick[data-c="${i}"]`).forEach(x => x.classList.toggle('sel', x === el)); });
    this.on(d, '[data-a=ok]', () => {
      c.perks = sel;
      if (!sel.includes('overkill') && !SECONDARY_ORDER.includes(c.secondary)) { c.secondary = 'm1911'; c.satt = {}; }
      this.game.saveProfile(); this.showLoadouts();
    });
  }
  pickStreaks() {
    const P = this.game.profile;
    const sel = new Set(P.streaks);
    const d = this.picker('连杀奖励', '选择 3 项 · 连续击杀敌人而不阵亡即可获得', `<div class="pick-grid">${KILLSTREAKS.map(k => `<div class="pick ${sel.has(k.id) ? 'sel' : ''}" data-id="${k.id}"><div class="cat">${k.kills} 连杀</div><b>${k.icon} ${k.name}</b><span>${k.desc}</span></div>`).join('')}</div><div style="margin-top:20px;display:flex;gap:14px;align-items:center"><button class="btn" data-a="ok">确认</button><span id="skc" style="color:#aaa;font-size:13px"></span></div>`);
    const upd = () => { d.querySelector('#skc').textContent = `已选择 ${sel.size}/3`; };
    upd();
    this.on(d, '.pick', el => {
      const id = el.dataset.id;
      if (sel.has(id)) sel.delete(id); else if (sel.size < 3) sel.add(id);
      el.classList.toggle('sel', sel.has(id)); upd();
    });
    this.on(d, '[data-a=ok]', () => { if (sel.size !== 3) { d.querySelector('#skc').innerHTML = '<span style="color:#ff6a5a">必须选择 3 项连杀奖励</span>'; return; } P.streaks = [...sel]; this.game.saveProfile(); this.showLoadouts(); });
  }

  // ---------------- 枪匠 ----------------
  showGunsmith(ci, which) {
    this.gsCtx = { ci, which };
    this.gsSlot = this.gsSlot && this.gsCtx.which === which ? this.gsSlot : null;
    this.setCam('gunsmith');
    const c = this.game.profile.classes[ci];
    const id = which === 'primary' ? c.primary : c.secondary;
    const w = WEAPONS[id];
    const attKey = which === 'primary' ? 'patt' : 'satt', camoKey = which === 'primary' ? 'pcamo' : 'scamo';
    const att = c[attKey] = c[attKey] || {};
    c[camoKey] = c[camoKey] || 'none';
    if (!this.gsSlot) this.gsSlot = w.slots[0] || 'camo';
    this.showGun(id, att, c[camoKey]);
    const count = Object.keys(att).length;
    const slotHtml = [...w.slots, 'camo'].map(s => {
      const cur = s === 'camo' ? (CAMOS.find(x => x.id === c[camoKey]) || CAMOS[0]).name : att[s] ? (findAttachment(s, att[s]) || {}).name : null;
      const anyAllowed = s === 'camo' || (ATTACHMENTS[s] || []).some(a => attachmentAllowed(id, s, a));
      return `<div class="gs-slot ${s === this.gsSlot ? 'sel' : ''} ${anyAllowed ? '' : 'dis'}" data-s="${s}"><div class="k">${s === 'camo' ? '迷彩' : SLOT_NAMES[s]}</div><div class="v ${cur ? '' : 'none'}">${cur || '无'}</div></div>`;
    }).join('');
    let right = '';
    if (this.gsSlot === 'camo') {
      right = `<div class="gs-att" style="cursor:default"><b>迷彩涂装</b><div class="gs-camos">${CAMOS.map(cm => { const sw = cm.id === 'none' ? null : camoSwatch(cm.id); return `<div class="camo ${c[camoKey] === cm.id ? 'sel' : ''}" data-c="${cm.id}" title="${cm.name}" style="background:${sw ? `url(${sw}) center/cover` : '#26282a'}"></div>`; }).join('')}</div><div style="font-size:12px;color:#999;margin-top:8px">${(CAMOS.find(x => x.id === c[camoKey]) || CAMOS[0]).name}</div></div>`;
    } else {
      const list = (ATTACHMENTS[this.gsSlot] || []).filter(a => attachmentAllowed(id, this.gsSlot, a));
      right = `<div class="gs-att ${!att[this.gsSlot] ? 'sel' : ''}" data-id=""><b>无</b><div class="fx"><span style="color:#999">移除该栏位配件</span></div></div>` +
        list.map(a => `<div class="gs-att ${att[this.gsSlot] === a.id ? 'sel' : ''}" data-id="${a.id}"><b>${a.name}</b><div class="fx">${fxList(a.fx)}</div>${a.desc ? `<div style="font-size:11px;color:#888;margin-top:4px">${a.desc}</div>` : ''}</div>`).join('');
    }
    const r = this.render(`
      <div class="gunsmith">
        <div class="gs-left">${slotHtml}</div>
        <div class="gs-title"><div class="c">枪匠 · ${w.cls}</div><div class="n">${w.name}</div><div class="cnt">配件 ${count}/${MAX_ATT}　·　拖拽旋转 / 滚轮缩放</div></div>
        <div class="gs-right">${right}<div id="gsMsg" style="color:#ff6a5a;font-size:13px;min-height:18px"></div></div>
        <div class="gs-stats" id="gsStats"></div>
        <div class="gs-foot"><button class="btn ghost small" data-a="reset">清空配件</button><button class="btn" data-a="done">完成</button></div>
      </div>`, '', 'gunsmith');
    r.style.background = 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,.55) 100%)';
    const statsFor = a => statBars(computeStats(id, a));
    const drawStats = (preview) => {
      const base = statsFor(att), pv = preview ? statsFor(preview) : base;
      const st = computeStats(id, preview || att);
      r.querySelector('#gsStats').innerHTML = ['精准度', '伤害', '射程', '射速', '机动性', '操控性'].map(k => {
        const b = base[k], p = pv[k], lo = Math.min(b, p), dlt = p - b;
        return `<div class="stat">${k}<span style="float:right;color:${dlt > 0.5 ? '#8fe06a' : dlt < -0.5 ? '#ff6a5a' : '#888'}">${Math.round(p)}${Math.abs(dlt) > 0.5 ? ` (${dlt > 0 ? '+' : ''}${Math.round(dlt)})` : ''}</span><div class="bar"><div class="b0" style="width:${lo}%"></div>${Math.abs(dlt) > 0.5 ? `<div class="bd" style="left:${lo}%;width:${Math.abs(dlt)}%;background:${dlt > 0 ? '#8fe06a' : '#ff6a5a'}"></div>` : ''}</div></div>`;
      }).join('') + `<div class="stat" style="grid-column:span 2;color:#999;display:flex;justify-content:space-between"><span>弹匣 <b style="color:#fff">${st.mag}</b></span><span>射速 <b style="color:#fff">${st.rpm}</b> RPM</span><span>换弹 <b style="color:#fff">${st.reload.toFixed(2)}</b>s</span><span>开镜 <b style="color:#fff">${Math.round(st.ads * 1000)}</b>ms</span><span>射程 <b style="color:#fff">${Math.round(st.rangeFar)}</b>m</span></div>`;
    };
    drawStats(null);
    this.on(r, '.gs-slot', el => { this.gsSlot = el.dataset.s; this.showGunsmith(ci, which); });
    r.querySelectorAll('.gs-att[data-id]').forEach(el => {
      el.addEventListener('mouseenter', () => { const p = Object.assign({}, att); if (el.dataset.id) p[this.gsSlot] = el.dataset.id; else delete p[this.gsSlot]; drawStats(p); });
      el.addEventListener('mouseleave', () => drawStats(null));
      el.addEventListener('click', () => {
        const aid = el.dataset.id;
        if (!aid) delete att[this.gsSlot];
        else {
          if (!att[this.gsSlot] && Object.keys(att).length >= MAX_ATT) { r.querySelector('#gsMsg').textContent = `最多装备 ${MAX_ATT} 个配件，请先移除其他配件`; return; }
          att[this.gsSlot] = aid;
        }
        this.game.saveProfile();
        this.showGunsmith(ci, which);
      });
    });
    this.on(r, '.camo', el => { c[camoKey] = el.dataset.c; this.game.saveProfile(); this.showGunsmith(ci, which); });
    this.on(r, '[data-a=reset]', () => { c[attKey] = {}; this.game.saveProfile(); this.showGunsmith(ci, which); });
    this.on(r, '[data-a=done]', () => { this.gsSlot = null; this.showLoadouts(); });
  }

  // ---------------- 设置 ----------------
  showSettings(from) {
    this.settingsFrom = from;
    const S = this.game.settings;
    const inGame = from === 'pause';
    if (!inGame) this.setCam('lobby');
    const rng = (k, label, min, max, step, fmt = v => v) => `<div class="set-row"><span>${label}</span><div style="display:flex;align-items:center;gap:12px"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}"><span class="val" data-v="${k}">${fmt(S[k])}</span></div></div>`;
    const tog = (k, label) => `<div class="set-row"><span>${label}</span><div class="seg" data-t="${k}"><div data-v="1" class="${S[k] ? 'sel' : ''}">开</div><div data-v="0" class="${!S[k] ? 'sel' : ''}">关</div></div></div>`;
    const fmts = { sens: v => (+v).toFixed(2), adsSens: v => (+v).toFixed(2), fov: v => v, volume: v => Math.round(v * 100) };
    const r = this.render(`
      <div class="settings">
        <div class="hdr" style="margin-bottom:20px">设置<small>画面 · 操作 · 音频</small></div>
        <div class="set-row"><span>画面质量</span><div class="seg" data-q="1">${['low', 'medium', 'high'].map((q, i) => `<div data-v="${q}" class="${S.quality === q ? 'sel' : ''}">${['低', '中', '高'][i]}</div>`).join('')}</div></div>
        ${rng('fov', '视野 (FOV)', 65, 100, 1, fmts.fov)}
        ${rng('sens', '鼠标灵敏度', 0.2, 3, 0.05, fmts.sens)}
        ${rng('adsSens', '开镜灵敏度倍率', 0.3, 1.5, 0.05, fmts.adsSens)}
        ${rng('volume', '主音量', 0, 1, 0.01, fmts.volume)}
        ${tog('invertY', '反转 Y 轴')}
        ${tog('voice', '语音播报')}
        ${tog('showFps', '显示帧数')}
        <div style="font-size:11px;color:#777;margin-top:8px">画面质量中的阴影与纹理分辨率将在下次加载地图 / 刷新页面后完全生效。</div>
        <div class="keys">
          <div><b>WASD</b>移动</div><div><b>鼠标左/右键</b>射击 / 瞄准</div>
          <div><b>Shift</b>战术冲刺</div><div><b>C / Ctrl</b>蹲伏 · 冲刺中滑铲</div>
          <div><b>空格</b>跳跃</div><div><b>R</b>换弹</div>
          <div><b>1 / 2 / 滚轮</b>切换武器</div><div><b>V / 鼠标侧键</b>近战</div>
          <div><b>G</b>致命装备（按住烹饪）</div><div><b>Q</b>战术装备</div>
          <div><b>F</b>互动 / 拾取武器</div><div><b>N</b>夜视仪（战役）</div>
          <div><b>3 / 4 / 5</b>连杀奖励</div><div><b>Tab</b>记分板</div>
        </div>
        <div style="margin-top:24px;display:flex;gap:12px"><button class="btn" data-a="back">返回</button><button class="btn ghost small" data-a="resetp">重置存档</button></div>
      </div>`, inGame ? 'solid' : 'dim', 'settings');
    r.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.k; S[k] = +inp.value;
      r.querySelector(`[data-v="${k}"]`).textContent = fmts[k](S[k]);
      if (k === 'volume') this.game.audio.setVolume(S[k]);
      this.game.saveSettings();
    }));
    r.querySelectorAll('.seg[data-t]').forEach(sg => sg.querySelectorAll('div').forEach(d => d.addEventListener('click', () => {
      const k = sg.dataset.t; S[k] = d.dataset.v === '1';
      sg.querySelectorAll('div').forEach(x => x.classList.toggle('sel', x === d));
      if (k === 'voice') this.game.audio.voice = S[k];
      if (k === 'showFps') { const f = document.getElementById('fps'); if (f) f.classList.toggle('hidden', !S[k]); }
      this.game.saveSettings();
    })));
    r.querySelectorAll('.seg[data-q] div').forEach(d => d.addEventListener('click', () => {
      S.quality = d.dataset.v; r.querySelectorAll('.seg[data-q] div').forEach(x => x.classList.toggle('sel', x === d));
      this.game.saveSettings(); this.game.applyQuality();
    }));
    this.on(r, '[data-a=back]', () => { if (inGame) this.showPause(); else this.showMain(); });
    this.on(r, '[data-a=resetp]', () => { if (confirm('确定要重置所有配装与经验值吗？')) { localStorage.removeItem('mf_profile'); location.reload(); } });
  }

  // ---------------- 暂停 ----------------
  showPause() {
    this.pauseAt = performance.now();
    const g = this.game;
    const camp = g.mode && g.mode.constructor.name === 'Campaign';
    const r = this.render(`
      <div class="pause">
        <div class="hdr" style="margin-bottom:30px">已暂停<small>${camp ? '战役 · 午夜清道夫' : '多人对战'}</small></div>
        <div class="mbtn" data-a="resume"><div class="ico">▶</div><div class="mt">继续游戏</div></div>
        ${camp ? '<div class="mbtn" data-a="cp"><div class="ico">↺</div><div class="mt">读取检查点</div></div>' : '<div class="mbtn" data-a="class"><div class="ico">⚙</div><div class="mt">更换配装</div></div>'}
        <div class="mbtn" data-a="restart"><div class="ico">⟲</div><div class="mt">${camp ? '重新开始任务' : '重新开始对局'}</div></div>
        <div class="mbtn" data-a="settings"><div class="ico">☰</div><div class="mt">设置</div></div>
        <div class="mbtn" data-a="quit"><div class="ico">✕</div><div class="mt">退出到主菜单</div></div>
        <div style="margin-top:20px;font-size:12px;color:#777">按 Esc 继续</div>
      </div>`, 'solid', 'pause');
    this.on(r, '[data-a=resume]', () => this.resume());
    this.on(r, '[data-a=cp]', () => { g.paused = false; this.hide(); if (g.player.alive) { g.player.alive = false; g.dead = true; } g.mode.respawn(); });
    this.on(r, '[data-a=class]', () => this.showClassSelect(true));
    this.on(r, '[data-a=restart]', () => { const cfg = g.mode.cfg; const kind = camp ? 'campaign' : 'mp'; g.paused = false; g.startGame(kind, cfg); });
    this.on(r, '[data-a=settings]', () => this.showSettings('pause'));
    this.on(r, '[data-a=quit]', () => g.exitToMenu());
  }
  resume() {
    const g = this.game;
    g.pause(false);
    setTimeout(() => { if (g.state === 'play' && !g.paused && document.pointerLockElement !== g.canvas) document.getElementById('clickToPlay').classList.remove('hidden'); }, 400);
  }

  // ---------------- 局内更换配装 ----------------
  showClassSelect(fromPause) {
    const g = this.game, P = g.profile;
    this.overlayOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    const r = this.render(`
      <div style="margin:auto;width:760px">
        <div class="hdr" style="margin-bottom:18px">选择配装<small>将在下次部署时生效</small></div>
        <div class="pick-grid" style="grid-template-columns:1fr">${P.classes.map((c, i) => `<div class="pick ${i === P.selClass ? 'sel' : ''}" data-i="${i}" style="display:flex;justify-content:space-between;align-items:center"><div><b>${esc(c.name)}</b><span>${WEAPONS[c.primary].name}${Object.keys(c.patt || {}).length ? ' (' + Object.keys(c.patt).length + '配件)' : ''} · ${WEAPONS[c.secondary].name} · ${(LETHALS.find(x => x.id === c.lethal) || {}).name || ''} · ${(TACTICALS.find(x => x.id === c.tactical) || {}).name || ''}</span></div><div style="font-size:12px;color:#aaa;text-align:right">${c.perks.map(id => this.perk(id).icon + ' ' + this.perk(id).name).join('<br>')}</div></div>`).join('')}</div>
        <div style="margin-top:16px"><button class="btn ghost" data-a="close">取消</button></div>
      </div>`, 'solid', 'classSelect');
    this.classFromPause = !!fromPause;
    this.on(r, '.pick', el => {
      const i = +el.dataset.i;
      if (g.mode && g.mode.applyClass) g.mode.applyClass(i);
      this.selClass = i;
      g.hud.popup(`配装「${P.classes[i].name}」将在下次部署时生效`, '#d4f24a');
      this.hideClassSelect();
    });
    this.on(r, '[data-a=close]', () => this.hideClassSelect());
  }
  hideClassSelect() {
    if (this.screen !== 'classSelect') return;
    this.overlayOpen = false;
    if (this.classFromPause && this.game.paused) { this.showPause(); return; }
    this.hide();
  }

  // ---------------- 结算 ----------------
  showResults(res) {
    this.overlayOpen = true;
    const g = this.game;
    g.hud.showScoreboard(false);
    const L = this.level();
    const r = this.render(`
      <div class="results">
        <div class="big ${res.win === 'win' ? 'win' : res.win === 'lose' ? 'lose' : ''}">${esc(res.title)}</div>
        <div style="font-size:18px;color:#ccc;letter-spacing:4px">${esc(res.sub || '')}</div>
        <div class="res-stats">${res.stats.map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('')}</div>
        ${res.board ? `<div id="sbCopy" style="max-height:38vh;overflow-y:auto;text-align:left;margin-bottom:20px">${res.board}</div>` : ''}
        <div style="font-size:13px;color:#999;margin-bottom:20px">等级 ${L.lv} · <div style="display:inline-block;width:200px;height:4px;background:#333;vertical-align:middle"><div style="height:100%;width:${Math.round(L.frac * 100)}%;background:var(--acc)"></div></div></div>
        <div style="display:flex;gap:12px;justify-content:center"><button class="btn" data-a="again">再来一局</button><button class="btn ghost" data-a="menu">返回主菜单</button></div>
      </div>`, 'solid', 'results');
    this.on(r, '[data-a=again]', () => { this.overlayOpen = false; res.again(); });
    this.on(r, '[data-a=menu]', () => { this.overlayOpen = false; g.exitToMenu(); });
  }
}
