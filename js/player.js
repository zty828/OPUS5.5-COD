// 玩家控制器
import * as THREE from 'three';
import { WeaponSystem } from './weapons.js';
import { clamp, damp, lerp, raySphere, rayAABB, DEG } from './util.js';
import { WEAPONS, LETHALS, TACTICALS } from './data.js';

export class Player {
  constructor(game, opts) {
    this.game = game;
    this.isPlayer = true;
    this.name = opts.name || '你';
    this.team = opts.team || 'A';
    this.pos = opts.pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = opts.yaw || 0; this.pitch = 0;
    this.maxHp = 100; this.hp = 100; this.alive = true;
    this.crouchT = 0; this.crouching = false; this.sprinting = false; this.sliding = false; this.slideT = 0;
    this.onGround = true; this.eyeH = 1.62; this.eyeSmooth = this.pos.y + 1.62;
    this.dmgT = 99; this.shakeT = 0; this.shakeAmt = 0; this.punchV = 0; this.landDip = 0;
    this.stepDist = 0; this.revealT = 0;
    this.perks = new Set(opts.perks || []);
    this.stats = { kills: 0, deaths: 0, shots: 0, hits: 0, headshots: 0, score: 0, streak: 0, assists: 0, captures: 0 };
    this.dmgMul = opts.dmgMul || 1;
    this.ws = new WeaponSystem(game, this);
    this.lethal = null; this.tactical = null;
    this.lastAttacker = null;
    this.interactHold = 0;
    this.radius = 0.35;
  }
  hasPerk(id) { return this.perks.has(id); }
  equip(loadout) {
    // loadout: {primary:{id,att,camo}, secondary:{...}, lethal, tactical, perks}
    this.perks = new Set(loadout.perks || []);
    const list = [loadout.primary];
    if (loadout.secondary) list.push(loadout.secondary);
    this.ws.setLoadout(list);
    const L = LETHALS.find(l => l.id === loadout.lethal), T = TACTICALS.find(t => t.id === loadout.tactical);
    this.lethal = L ? { id: L.id, name: L.name, count: L.count + (loadout.extraLethal || 0), max: L.count + (loadout.extraLethal || 0) } : null;
    this.tactical = T ? { id: T.id, name: T.name, count: T.count + (loadout.extraTac || 0), max: T.count + (loadout.extraTac || 0) } : null;
    this.loadout = loadout;
  }
  respawn(pos, yaw) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0;
    this.hp = this.maxHp; this.alive = true; this.dmgT = 99; this.crouchT = 0; this.crouching = false; this.sliding = false;
    this.eyeSmooth = pos.y + 1.62; this.stats.streak = 0;
    this.ws.fullAmmo();
    if (this.lethal) this.lethal.count = this.lethal.max;
    if (this.tactical) this.tactical.count = this.tactical.max;
    this.ws.state = 'switch'; this.ws.stateT = 0; this.ws.stateDur = 0.5; this.ws.adsT = 0;
  }
  eyePos(out) { return out.set(this.pos.x, this.pos.y + this.curEye(), this.pos.z); }
  chestPos(out) { return out.set(this.pos.x, this.pos.y + this.curEye() - 0.4, this.pos.z); }
  curEye() { return lerp(1.62, 1.05, this.crouchT); }
  forward(out) { return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  hitTest(o, d, maxT) {
    const eye = this.curEye();
    const hy = this.pos.y + eye + 0.02;
    let t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, this.pos.x, hy, this.pos.z, 0.16);
    if (t >= 0 && t < maxT) return { t, part: 'head' };
    const b = { x0: this.pos.x - 0.28, x1: this.pos.x + 0.28, y0: this.pos.y, y1: this.pos.y + eye - 0.12, z0: this.pos.z - 0.28, z1: this.pos.z + 0.28 };
    t = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, b, maxT);
    if (t >= 0) { const hy2 = o.y + d.y * t; return { t, part: hy2 < this.pos.y + eye * 0.5 ? 'legs' : 'body' }; }
    return null;
  }
  takeDamage(dmg, info) {
    if (!this.alive || this.game.godMode) return false;
    this.hp -= dmg * this.dmgMul;
    this.dmgT = 0;
    this.lastAttacker = info.attacker;
    if (info.attacker && info.attacker.pos) this.game.hud.damageFrom(info.attacker.pos);
    else if (info.point) this.game.hud.damageFrom(info.point);
    if (!info.burn || Math.random() < 0.1) this.game.audio.hurt();
    this.punch(0.02);
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false; this.stats.deaths++;
      this.game.onKill(info.attacker, this, info.weapon, info.head);
      return true;
    }
    return false;
  }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); this.shakeT = 0.6; }
  punch(a) { this.punchV += a; }
  cancelSprint() { this.sprinting = false; this.sprintLock = 0.25; }

  update(dt, input) {
    const game = this.game, world = game.world;
    if (!this.alive) return;
    // 视角
    const ws = this.ws;
    const zoom = lerp(1, ws.w ? ws.w.stats.zoom : 1, ws.adsT);
    const sens = game.settings.sens * 0.0022 * (ws.adsT > 0.5 ? game.settings.adsSens / Math.pow(zoom, 0.85) : 1);
    this.yaw -= input.mdx * sens;
    this.pitch -= input.mdy * sens * (game.settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
    // 姿态
    if (input.crouchPressed) {
      if (this.sprinting && this.onGround && !this.sliding) {
        this.sliding = true; this.slideT = 0.75; this.crouching = true;
        const f = new THREE.Vector3(this.vel.x, 0, this.vel.z).normalize();
        this.vel.x = f.x * 9.5; this.vel.z = f.z * 9.5;
        game.audio.click(500, 0.3, 0.3);
      } else this.crouching = !this.crouching;
    }
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) { this.sliding = false; }
    }
    // 移动输入
    const fx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const fz = (input.fwd ? 1 : 0) - (input.back ? 1 : 0);
    this.sprintLock = (this.sprintLock || 0) - dt;
    const wantSprint = input.sprint && fz > 0 && this.sprintLock <= 0 && ws.adsT < 0.3 && !this.sliding;
    if (wantSprint && !this.sprinting) { this.sprinting = true; this.crouching = false; if (ws.state === 'reload' && !this.hasPerk('sleight')) ws.state = 'idle'; }
    if (!wantSprint) this.sprinting = false;
    // 头顶空间检查（蹲伏时不能站起）
    if (!this.crouching && this.crouchT > 0.1) {
      const c = world.ceilingHeight(this.pos.x, this.pos.z, this.pos.y, this.radius);
      if (c < this.pos.y + 1.85) this.crouching = true;
    }
    this.crouchT = damp(this.crouchT, this.crouching ? 1 : 0, 12, dt);
    const mob = ws.w ? ws.w.stats.mobility : 1;
    let speed = 4.7 * mob;
    if (this.sprinting) speed = 7.1 * mob * (this.hasPerk('doubletime') ? 1.08 : 1);
    else if (this.crouchT > 0.5) speed = 2.4 * (this.hasPerk('doubletime') ? 1.3 : 1);
    speed *= lerp(1, 0.55, ws.adsT);
    if (this.stunT > 0) { this.stunT -= dt; speed *= 0.5; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = fx * cy - fz * sy, wz = -fx * sy - fz * cy;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    if (this.sliding) {
      const dec = Math.exp(-1.8 * dt);
      this.vel.x *= dec; this.vel.z *= dec;
    } else if (this.onGround) {
      const k = 1 - Math.exp(-14 * dt);
      this.vel.x += (wx * speed - this.vel.x) * k;
      this.vel.z += (wz * speed - this.vel.z) * k;
    } else {
      const k = 1 - Math.exp(-2 * dt);
      this.vel.x += (wx * speed - this.vel.x) * k;
      this.vel.z += (wz * speed - this.vel.z) * k;
    }
    if (input.jumpPressed && this.onGround) {
      if (this.crouching) this.crouching = false;
      else { this.vel.y = 5.6; this.onGround = false; this.sliding = false; }
    }
    this.vel.y -= 18 * dt;
    // 积分与碰撞
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const h = lerp(1.8, 1.25, this.crouchT);
    world.collide(this.pos, this.vel, this.radius, h);
    this.pos.y += this.vel.y * dt;
    const g = world.groundHeight(this.pos.x, this.pos.z, this.pos.y - this.vel.y * dt, this.radius);
    const wasGround = this.onGround;
    if (this.pos.y <= g) {
      if (!wasGround && this.vel.y < -6) { this.landDip = Math.min(0.15, -this.vel.y * 0.012); game.audio.step(null, 'dirt', 0.35); }
      this.pos.y = g; this.vel.y = 0; this.onGround = true;
    } else if (this.pos.y > g + 0.05) {
      if (wasGround && this.vel.y <= 0 && this.pos.y - g < 0.5) { this.pos.y = g; this.vel.y = 0; }
      else this.onGround = false;
    }
    // 天花板
    const ceil = world.ceilingHeight(this.pos.x, this.pos.z, this.pos.y, this.radius);
    if (this.pos.y + h > ceil && this.vel.y > 0) { this.vel.y = 0; this.pos.y = ceil - h; }
    // 脚步
    const moved = Math.hypot(this.pos.x - px, this.pos.z - pz);
    if (this.onGround && !this.sliding) {
      this.stepDist += moved;
      const stride = this.sprinting ? 2.0 : 1.6;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const quiet = this.hasPerk('ninja');
        const vol = quiet ? 0.04 : this.crouchT > 0.5 ? 0.07 : this.sprinting ? 0.22 : 0.14;
        game.audio.step(null, game.world.def.surface || 'dirt', vol);
        const r = quiet ? 2 : this.crouchT > 0.5 ? 3 : this.sprinting ? 16 : 9;
        game.makeNoise(this.pos, r, this.team, true);
      }
    }
    // 生命恢复
    this.dmgT += dt;
    const delay = this.hasPerk('quickfix') ? 2.2 : 4;
    if (this.dmgT > delay && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 40 * dt);
    this.revealT -= dt;
    // 武器输入
    if (input.reloadPressed) ws.startReload();
    if (input.swapPressed) ws.switchTo((ws.cur + 1) % ws.slots.length);
    if (input.slot1) ws.switchTo(0);
    if (input.slot2) ws.switchTo(1);
    if (input.meleePressed) ws.melee();
    if (input.lethalPressed && this.lethal) ws.beginThrow('lethal', this.lethal.id);
    if (input.tacticalPressed && this.tactical) ws.beginThrow('tactical', this.tactical.id);
    if (ws.state === 'cook' && !input.lethal && !input.tactical) ws.endThrow();
    ws.update(dt, input);
    // 相机
    this.updateCamera(dt);
  }
  updateCamera(dt) {
    const cam = this.game.camera, ws = this.ws;
    const eyeT = this.pos.y + this.curEye() - (this.sliding ? 0.25 : 0);
    this.eyeSmooth = damp(this.eyeSmooth, eyeT, 18, dt);
    if (Math.abs(this.eyeSmooth - eyeT) > 1) this.eyeSmooth = eyeT;
    this.landDip = damp(this.landDip, 0, 8, dt);
    this.punchV = damp(this.punchV, 0, 10, dt);
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmt * (this.shakeT / 0.6);
      sx = (Math.random() - 0.5) * a * 0.05; sy = (Math.random() - 0.5) * a * 0.05;
    }
    const spd = Math.hypot(this.vel.x, this.vel.z);
    const bob = this.onGround ? Math.sin(ws.bobPhase * 2) * 0.02 * Math.min(1, spd / 6) * (1 - ws.adsT) : 0;
    cam.position.set(this.pos.x, this.eyeSmooth - this.landDip + bob, this.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + sx;
    cam.rotation.x = this.pitch + ws.rp + this.punchV + sy;
    cam.rotation.z = this.sliding ? -0.06 : (ws.sprintT * Math.sin(ws.bobPhase) * 0.01);
    const zoom = lerp(1, ws.w ? ws.w.stats.zoom : 1, ws.adsT * ws.adsT);
    const base = this.game.settings.fov;
    const f = 2 * Math.atan(Math.tan(base * DEG / 2) / zoom) / DEG;
    cam.fov = f + (this.sprinting ? 4 : 0) * (1 - ws.adsT);
    cam.updateProjectionMatrix();
    this.game.audio.setListener(cam.position, this.yaw);
  }
}
