// AI 士兵
import * as THREE from 'three';
import { createSoldierModel, animateSoldier, makeNameTag, applyFlashTex } from './soldier.js';
import { computeStats, WEAPONS } from './data.js';
import { fireHitscan, Projectile } from './combat.js';
import { clamp, damp, rand, angleDiff, raySphere, rayAABB, spreadDir, DEG, pick } from './util.js';

const DIFF = [
  { react: 0.8, spread: 3.4, burst: [2, 4], pause: [0.6, 1.2], dmg: 0.55, view: 50, turn: 4 },
  { react: 0.5, spread: 2.2, burst: [3, 6], pause: [0.35, 0.8], dmg: 0.8, view: 65, turn: 6 },
  { react: 0.3, spread: 1.4, burst: [4, 8], pause: [0.2, 0.5], dmg: 1.0, view: 80, turn: 9 },
];

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
let botId = 0;

export class Bot {
  constructor(game, o) {
    this.game = game;
    this.id = ++botId;
    this.name = o.name || '士兵';
    this.team = o.team;
    this.role = o.role || 'mp';
    this.diff = DIFF[o.difficulty ?? 1];
    this.difficulty = o.difficulty ?? 1;
    this.weaponId = o.weaponId || 'ak';
    this.att = o.att || {};
    this.stats = computeStats(this.weaponId, this.att);
    this.maxHp = o.hp || 100; this.hp = this.maxHp;
    this.pos = o.pos.clone(); this.vel = new THREE.Vector3();
    this.yaw = o.yaw || 0; this.pitch = 0;
    this.alive = true;
    this.model = createSoldierModel(o.style || 'enemy', this.weaponId, this.att, o.camo || 'none');
    applyFlashTex(this.model);
    this.model.root.position.copy(this.pos);
    game.scene.add(this.model.root);
    if (o.tag) { this.tag = makeNameTag(this.name, o.tagColor || '#6cf'); this.model.root.add(this.tag); }
    this.anim = { speed: 0, phase: Math.random() * 6, crouch: 0, pitch: 0, dead: false, deadT: 0, fallDir: 1, fallRoll: 0, recoil: 0 };
    this.mag = this.stats.mag;
    this.target = null; this.targetVisible = false; this.lastSeenPos = null; this.lastSeenT = -99; this.acquireT = 0;
    this.perceiveT = Math.random() * 0.2; this.fireT = 0; this.burstLeft = 0; this.reloadT = 0;
    this.path = null; this.pathT = -99; this.pathGoal = null; this.goal = null; this.goalT = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0; this.wantCrouch = false; this.crouchT = 0;
    this.stunT = 0; this.flashT = 0; this.revealT = 0; this.grenades = o.grenades ?? 1; this.grenadeCD = rand(4, 10);
    this.home = o.home ? o.home.clone() : this.pos.clone();
    this.leash = o.leash || 0;
    this.group = o.group || null;
    this.alerted = o.alerted || false;
    this.isHVT = !!o.isHVT;
    this.stuckT = 0; this.lastProgPos = this.pos.clone();
    this.kills = 0; this.deaths = 0; this.score = 0; this.streak = 0; this.captures = 0;
    this.scanBase = this.yaw; this.scanT = Math.random() * 10;
    this.static = !!o.static;
    this.accuracyMul = o.accuracyMul || 1;
    this.patrol = o.patrol || null; this.patrolI = 0;
    this.assaultTarget = o.assaultTarget || null;
    this.radius = 0.35;
    this.dmgTaken = new Map();
  }
  get crouch() { return this.anim.crouch; }
  eyePos(out) { return out.set(this.pos.x, this.pos.y + 1.6 - this.anim.crouch * 0.5, this.pos.z); }
  chestPos(out) { return out.set(this.pos.x, this.pos.y + 1.2 - this.anim.crouch * 0.4, this.pos.z); }
  forward(out) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  hitTest(o, d, maxT) {
    if (!this.alive) return null;
    const c = this.anim.crouch;
    const hy = this.pos.y + 1.68 - c * 0.5;
    let t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, this.pos.x, hy, this.pos.z, 0.15);
    if (t >= 0 && t < maxT) return { t, part: 'head' };
    const lt = 0.9 - c * 0.35;
    const b = { x0: this.pos.x - 0.27, x1: this.pos.x + 0.27, y0: this.pos.y + lt, y1: hy - 0.13, z0: this.pos.z - 0.27, z1: this.pos.z + 0.27 };
    t = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, b, maxT);
    if (t >= 0) return { t, part: 'body' };
    const l = { x0: this.pos.x - 0.2, x1: this.pos.x + 0.2, y0: this.pos.y, y1: this.pos.y + lt, z0: this.pos.z - 0.2, z1: this.pos.z + 0.2 };
    t = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, l, maxT);
    if (t >= 0) return { t, part: 'legs' };
    return null;
  }
  takeDamage(dmg, info) {
    if (!this.alive) return false;
    this.hp -= dmg;
    const a = info.attacker;
    if (a) this.dmgTaken.set(a, (this.dmgTaken.get(a) || 0) + dmg);
    this.anim.recoil = 0.5;
    // 被攻击时立即察觉
    if (a && a.alive && a.pos) {
      this.lastSeenPos = a.pos.clone(); this.lastSeenT = this.game.time;
      this.alerted = true;
      if (!this.target) { this.target = a; this.acquireT = this.game.time - this.diff.react * 0.5; }
      if (this.group) this.game.alertGroup && this.game.alertGroup(this.group, a.pos);
    }
    if (this.hp <= 0) {
      this.die(info);
      return true;
    }
    return false;
  }
  die(info) {
    this.alive = false; this.hp = 0; this.deaths++;
    this.anim.dead = true; this.anim.deadT = 0;
    const d = info.dir || new THREE.Vector3(0, 0, 1);
    const f = this.forward(_a);
    this.anim.fallDir = f.dot(d) > 0 ? -1 : 1;
    this.anim.fallRoll = rand(-0.3, 0.3);
    this.model.flash.visible = false;
    if (this.tag) this.tag.visible = false;
    this.deadTime = this.game.time;
    this.game.onKill(info.attacker, this, info.weapon, info.head, info);
  }
  respawn(pos, yaw) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.hp = this.maxHp; this.alive = true;
    this.anim.dead = false; this.anim.deadT = 0; this.model.root.rotation.set(0, yaw, 0);
    this.mag = this.stats.mag; this.target = null; this.lastSeenPos = null; this.path = null; this.goal = null;
    this.stunT = 0; this.grenades = 1; this.reloadT = 0; this.streak = 0;
    if (this.tag) this.tag.visible = true;
    this.model.root.visible = true;
    this.dmgTaken.clear();
  }
  stun(t) { this.stunT = Math.max(this.stunT, t); }
  hint(pos) { if (!this.target || !this.targetVisible) { this.lastSeenPos = pos.clone(); this.lastSeenT = this.game.time - 2; this.alerted = true; } }

  isEnemy(e) { return e.team !== this.team && e.alive && e.targetable !== false; }

  perceive() {
    const game = this.game;
    const eye = this.eyePos(_a);
    const fwd = this.forward(_b);
    let best = null, bestD = 1e9;
    const view = game.world.def.night && !game.nightVisionForBots ? this.diff.view * 0.7 : this.diff.view;
    for (const e of game.entities) {
      if (!this.isEnemy(e)) continue;
      const tc = e.chestPos(_c);
      const dx = tc.x - eye.x, dy = tc.y - eye.y, dz = tc.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > view) continue;
      const cos = (dx * fwd.x + dz * fwd.z) / Math.max(0.01, Math.hypot(dx, dz));
      const tracking = e === this.target && game.time - this.lastSeenT < 1.5;
      const fovOK = cos > 0.35 || dist < 4 || tracking;
      if (!fovOK) continue;
      // 蹲伏或远距离降低发现概率
      const stealthCheck = !tracking && !this.alerted && this.role === 'guard';
      if (stealthCheck && dist > view * 0.75) continue;
      if (game.world.lineBlocked(eye, tc) && game.world.lineBlocked(eye, e.eyePos(_d))) continue;
      if (game.effects.smokeBlocks(eye, tc)) continue;
      if (stealthCheck) {
        // 警戒值累积：距离越近、越显眼，发现越快
        let detect = dist < 7 ? 1 : Math.pow(7 / dist, 2);
        if (e.crouchT > 0.5 || e.crouch > 0.5) detect *= 0.5;
        if (e.stealthy) detect *= 0.5;
        if (game.world.def.night) detect *= 0.6;
        if (e.revealT > 0) detect = Math.max(detect, 0.5);
        if (cos < 0.7) detect *= 0.5;
        this.susp = (this.susp || 0) + detect * 0.3;
        this.suspSeen = game.time;
        if (this.susp < 1) continue;
      }
      const score = dist * (e === this.target ? 0.7 : 1);
      if (score < bestD) { bestD = score; best = e; }
    }
    if (this.susp && game.time - (this.suspSeen || 0) > 0.5) this.susp = Math.max(0, this.susp - 0.04);
    if (best) {
      if (best !== this.target || !this.targetVisible) {
        let react = this.diff.react * rand(0.8, 1.3);
        if (best.isPlayer && best.hasPerk('coldblooded')) react *= 1.8;
        if (!this.alerted) react *= 1.5;
        this.acquireT = game.time + react;
        this.aimSettle = 1;
      }
      this.target = best; this.targetVisible = true;
      this.lastSeenPos = best.pos.clone(); this.lastSeenT = game.time;
      if (!this.alerted) { this.alerted = true; if (this.group && game.alertGroup) game.alertGroup(this.group, best.pos); }
    } else {
      this.targetVisible = false;
      if (this.target && (!this.target.alive || game.time - this.lastSeenT > 6)) this.target = null;
    }
    // 听觉
    if (!this.targetVisible) {
      for (const n of game.noises) {
        if (n.team === this.team || game.time - n.t > 0.5) continue;
        const d = n.pos.distanceTo(this.pos);
        if (d < n.r) {
          if (!this.lastSeenPos || game.time - this.lastSeenT > 2) {
            this.lastSeenPos = n.pos.clone(); this.lastSeenT = game.time - 1;
            if (!this.alerted && this.group && game.alertGroup && !n.footstep) game.alertGroup(this.group, n.pos);
            this.alerted = true;
          }
        }
      }
    }
  }

  requestPath(goal) {
    const game = this.game;
    if (game.pathBudget <= 0) return;
    game.pathBudget--;
    this.path = game.world.findPath(this.pos, goal);
    this.pathT = game.time; this.pathGoal = goal.clone();
  }
  // 沿路径移动，返回期望速度方向
  steer(goal, speed, out) {
    const game = this.game;
    if (!goal) return out.set(0, 0, 0);
    const dGoal = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
    if (dGoal < 0.8) { this.path = null; return out.set(0, 0, 0); }
    // 直线可达直接走
    if (!this.path || !this.pathGoal || this.pathGoal.distanceTo(goal) > 2.5 || game.time - this.pathT > 4) this.requestPath(goal);
    let next = goal;
    if (this.path && this.path.length) {
      while (this.path.length > 1 && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 0.8) this.path.shift();
      next = this.path[0];
    }
    const dx = next.x - this.pos.x, dz = next.z - this.pos.z, l = Math.hypot(dx, dz);
    if (l < 0.01) return out.set(0, 0, 0);
    return out.set(dx / l * speed, 0, dz / l * speed);
  }

  update(dt) {
    const game = this.game;
    const A = this.anim;
    if (!this.alive) {
      A.deadT += dt;
      animateSoldier(this.model, A, dt);
      this.model.root.position.copy(this.pos);
      return;
    }
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) { this.perceiveT = 0.15 + Math.random() * 0.08; this.perceive(); }
    this.stunT -= dt; this.flashT -= dt; this.revealT -= dt; this.grenadeCD -= dt; this.reloadT -= dt;
    this.model.flash.visible = this.flashT > 0;
    A.recoil = damp(A.recoil, 0, 10, dt);

    const desired = _d.set(0, 0, 0);
    let lookYaw = null, lookPitch = 0;
    let speed = 4.6 * this.stats.mobility;
    const t = this.target;
    const stunned = this.stunT > 0;
    let wantCrouch = false;

    if (stunned) {
      desired.set(Math.sin(game.time * 2 + this.id) * 1.2, 0, Math.cos(game.time * 1.7 + this.id) * 1.2);
      lookYaw = this.yaw + Math.sin(game.time * 3) * 0.05;
    } else if (t && this.targetVisible && t.alive) {
      // 战斗
      const eye = this.eyePos(_a);
      const tc = t.chestPos(_b);
      const dx = tc.x - eye.x, dy = tc.y - eye.y, dz = tc.z - eye.z;
      const dist = Math.hypot(dx, dz);
      lookYaw = Math.atan2(-dx, -dz);
      lookPitch = Math.atan2(dy, dist);
      // 移动：侧移 + 距离调整
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rand(0.8, 2.2); this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.wantCrouch = Math.random() < (this.stats.type === 'sniper' || this.stats.type === 'lmg' ? 0.6 : 0.3); }
      wantCrouch = this.wantCrouch;
      if (!this.static) {
        const sx = Math.cos(lookYaw), sz = -Math.sin(lookYaw);
        const pref = this.stats.type === 'shotgun' ? 6 : this.stats.type === 'smg' ? 12 : this.stats.type === 'sniper' ? 35 : 20;
        const fx = -Math.sin(lookYaw), fz = -Math.cos(lookYaw);
        let adv = dist > pref * 1.4 ? 1 : dist < pref * 0.4 ? -0.6 : 0;
        const ss = wantCrouch ? 0 : 2.2;
        desired.set(sx * this.strafeDir * ss + fx * adv * 3, 0, sz * this.strafeDir * ss + fz * adv * 3);
        // 撞墙检测：若侧移方向被阻挡则反向
        const probe = _c.copy(this.pos).addScaledVector(desired, 0.4);
        const [ix, iz] = game.world.cellOf(probe.x, probe.z);
        if (!game.world.walkable(ix, iz)) { this.strafeDir *= -1; desired.set(0, 0, 0); }
      }
      // 射击
      const facing = Math.abs(angleDiff(this.yaw, lookYaw)) < 0.25;
      if (game.time > this.acquireT && facing && this.reloadT <= 0) this.tryFire(dt, t, dist);
      // 高度警觉提示
      if (t.isPlayer && t.hasPerk('highalert')) game.hud.highAlert(this.pos);
    } else if (this.lastSeenPos && game.time - this.lastSeenT < 12 && (this.alerted) && !this.static) {
      // 搜索
      const lp = this.lastSeenPos;
      let goal = lp;
      if (this.leash && goal.distanceTo(this.home) > this.leash) goal = this.home;
      this.steer(goal, speed, desired);
      if (desired.lengthSq() < 0.01 && game.time - this.lastSeenT > 3) this.lastSeenPos = null;
      // 投掷手雷
      if (this.grenades > 0 && this.grenadeCD <= 0 && game.time - this.lastSeenT < 3 && this.difficulty > 0) {
        const d = lp.distanceTo(this.pos);
        if (d > 8 && d < 26 && Math.random() < 0.35) this.throwGrenade(lp);
        this.grenadeCD = rand(8, 16);
      }
      if (this.mag < this.stats.mag * 0.5 && this.reloadT <= 0) this.reload();
    } else {
      // 常规行为
      if (this.mag < this.stats.mag && this.reloadT <= 0 && this.mag < this.stats.mag * 0.6) this.reload();
      this.behave(dt, desired);
      if (this.role === 'guard' && !this.alerted) speed = 1.6;
    }
    if (this.static) desired.set(0, 0, 0);
    // 限速
    const dl = Math.hypot(desired.x, desired.z);
    const maxS = (wantCrouch ? 2.0 : speed) * (stunned ? 0.4 : 1);
    if (dl > maxS) desired.multiplyScalar(maxS / dl);
    // 分离
    for (const o of game.bots) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.7 && d2 > 0.0001) { const d = Math.sqrt(d2); desired.x += dx / d * 1.5; desired.z += dz / d * 1.5; }
    }
    const k = 1 - Math.exp(-10 * dt);
    this.vel.x += (desired.x - this.vel.x) * k;
    this.vel.z += (desired.z - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    game.world.collide(this.pos, this.vel, this.radius, 1.7);
    const gh = game.world.groundHeight(this.pos.x, this.pos.z, this.pos.y, this.radius);
    if (this.static) { /* 固定位置（塔楼） */ }
    else this.pos.y = damp(this.pos.y, gh, 15, dt);
    // 卡住检测
    this.stuckT += dt;
    if (this.stuckT > 1.5) {
      if (this.lastProgPos.distanceTo(this.pos) < 0.4 && dl > 0.5) { this.path = null; this.pathT = -99; this.goal = null; this.strafeDir *= -1; }
      this.lastProgPos.copy(this.pos); this.stuckT = 0;
    }
    // 朝向
    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (lookYaw === null) {
      if (spd > 0.5) lookYaw = Math.atan2(-this.vel.x, -this.vel.z);
      else if (this.role === 'guard' && !this.alerted) { this.scanT += dt; lookYaw = this.scanBase + Math.sin(this.scanT * 0.4) * 0.8; }
      else lookYaw = this.yaw;
    }
    const turn = this.diff.turn * (this.targetVisible ? 1 : 0.7);
    const ad = angleDiff(this.yaw, lookYaw);
    this.yaw += clamp(ad, -turn * dt, turn * dt);
    this.pitch = damp(this.pitch, lookPitch, 8, dt);
    this.crouchT = damp(this.crouchT, wantCrouch ? 1 : 0, 8, dt);
    // 动画
    A.speed = spd; A.phase += dt * spd * 2.2; A.crouch = this.crouchT; A.pitch = this.pitch;
    animateSoldier(this.model, A, dt);
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
    // 脚步声
    if (spd > 3 && Math.random() < dt * 3) game.audio.step(this.pos, game.world.def.surface || 'dirt', 0.25);
  }

  behave(dt, desired) {
    const game = this.game;
    const role = this.role;
    if (role === 'guard') {
      if (this.patrol && !this.alerted) {
        const p = this.patrol[this.patrolI];
        this.steer(p, 1.6, desired);
        if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 1) this.patrolI = (this.patrolI + 1) % this.patrol.length;
      } else if (this.pos.distanceTo(this.home) > 1.5) this.steer(this.home, 3, desired);
      return;
    }
    if (role === 'ally') {
      const pl = game.player;
      if (!pl) return;
      const off = this.followOffset || (this.followOffset = new THREE.Vector3(rand(-3, 3), 0, rand(2, 4)));
      const goal = _c.set(pl.pos.x + Math.cos(pl.yaw) * off.x + Math.sin(pl.yaw) * off.z, 0, pl.pos.z - Math.sin(pl.yaw) * off.x + Math.cos(pl.yaw) * off.z);
      if (this.leadTarget) goal.copy(this.leadTarget);
      const d = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
      if (d > 2.5) this.steer(goal.clone(), d > 8 ? 5 : 3.5, desired);
      return;
    }
    if (role === 'assault') {
      if (this.assaultTarget) {
        this.steer(this.assaultTarget, 4.5, desired);
        if (this.pos.distanceTo(this.assaultTarget) < 3) {
          this.assaultTarget = null;
          if (game.player) this.hint(game.player.pos);
        }
      } else if (game.player && game.player.alive) this.hint(game.player.pos);
      return;
    }
    // 多人：由模式决定目标
    this.goalT -= dt;
    if (!this.goal || this.goalT <= 0 || Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 1.5) {
      this.goal = game.mode && game.mode.botGoal ? game.mode.botGoal(this) : game.world.randomWalkable();
      this.goalT = rand(6, 14);
    }
    this.steer(this.goal, 4.6 * this.stats.mobility, desired);
  }

  reload() {
    this.reloadT = this.stats.reload * 1.1;
    this.mag = this.stats.mag;
    this.game.audio.reload('out');
  }

  tryFire(dt, target, dist) {
    const game = this.game, st = this.stats;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    if (this.holdFire && this.holdFire()) return;
    if (this.mag <= 0) { this.reload(); return; }
    if (this.burstLeft <= 0) {
      this.burstLeft = st.fire === 'auto' ? Math.floor(rand(this.diff.burst[0], this.diff.burst[1] + 1)) : 1;
      this.fireT = rand(this.diff.pause[0], this.diff.pause[1]) * (st.fire === 'auto' ? 1 : 0.6);
      if (st.fire === 'bolt') this.fireT = rand(1.2, 2.0);
      return;
    }
    this.burstLeft--;
    this.fireT = Math.max(60 / st.rpm, st.fire === 'auto' ? 0.07 : 0.25);
    this.mag--;
    // 瞄准
    const eye = this.eyePos(new THREE.Vector3());
    const aim = target.chestPos(new THREE.Vector3());
    if (Math.random() < 0.18 + this.difficulty * 0.06) aim.y += 0.42; // 爆头尝试
    const tv = target.vel ? Math.hypot(target.vel.x, target.vel.z) : 0;
    this.aimSettle = Math.max(0, (this.aimSettle || 0) - 0.18);
    let spread = this.diff.spread * (1 + tv / 6 * 0.8) * (1 + Math.hypot(this.vel.x, this.vel.z) / 5 * 0.4) * (1 + this.aimSettle * 1.2) * this.accuracyMul;
    if (dist > 35) spread *= 0.8;
    if (st.type === 'sniper') spread *= 0.5;
    const dir = aim.sub(eye).normalize();
    const pellets = st.pellets;
    const muzzle = this.model.muzzle.getWorldPosition(new THREE.Vector3());
    let r;
    for (let i = 0; i < pellets; i++) {
      const d = spreadDir(dir, (spread + (pellets > 1 ? st.hip * 0.5 : 0)) * DEG * 0.5, new THREE.Vector3());
      r = fireHitscan(game, this, eye, d, st, st.name, { dmgMul: this.diff.dmg * (game.botDmgMul || 1) });
      if (i === 0 && Math.random() < 0.5) game.effects.tracer(muzzle, r.point, [1.5, 1.0, 0.5]);
    }
    this.flashT = 0.05;
    this.model.flash.material.rotation = Math.random() * 6;
    this.anim.recoil = 1;
    if (Math.random() < 0.25) game.effects.flashLight(muzzle, 0xffb060, 2.5, 0.05, 7);
    game.audio.shot(st.sound, this.pos, st.suppressed);
    game.makeNoise(this.pos, st.suppressed ? 10 : 60, this.team);
    if (!st.suppressed) this.revealT = 1.6;
    // 子弹掠过音效
    if (game.player && game.player.alive && !r.ent?.isPlayer) {
      const pe = game.player.eyePos(_c);
      const toP = pe.clone().sub(eye); const proj = toP.dot(dir);
      if (proj > 0 && proj < r.t) { const perp = toP.clone().addScaledVector(dir, -proj).length(); if (perp < 1.2) game.audio.click(5000 + Math.random() * 2000, 0.06, 0.25); }
    }
  }
  throwGrenade(target) {
    const game = this.game;
    this.grenades--;
    const from = this.eyePos(new THREE.Vector3());
    const T = 1.1, g = 16;
    const v = new THREE.Vector3((target.x - from.x) / T, (target.y - from.y) / T + 0.5 * g * T, (target.z - from.z) / T);
    game.projectiles.push(new Projectile(game, 'frag', from, v, this, 2.6));
    this.anim.recoil = 1;
  }
  dispose() { this.game.scene.remove(this.model.root); }
}
