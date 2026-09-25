// 多人模式：团队死斗 / 占领 / 自由混战 + 连杀奖励
import * as THREE from 'three';
import { Player } from './player.js';
import { Bot } from './ai.js';
import { MAPS } from './maps.js';
import { KILLSTREAKS, BOT_NAMES, WEAPONS, ATTACHMENTS, attachmentAllowed, computeStats } from './data.js';
import { fireHitscan, Projectile } from './combat.js';
import { mat } from './materials.js';
import { rand, pick, fmtTime, spreadDir, DEG, clamp, rayAABB } from './util.js';

const BOT_WEAPONS = ['m4', 'm4', 'ak', 'ak', 'scar', 'mp5', 'mp5', 'vector', 'pkm', 'm870', 'sks', 'l115'];

function randomAtt(wid) {
  const att = {};
  const slots = WEAPONS[wid].slots.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  for (const s of slots) {
    const opts = ATTACHMENTS[s].filter(a => attachmentAllowed(wid, s, a));
    if (opts.length && Math.random() < 0.7) att[s] = pick(opts).id;
  }
  return att;
}

export class MPMatch {
  constructor(game, cfg) {
    this.game = game; this.cfg = cfg;
    this.type = cfg.mode; this.ffa = cfg.mode === 'ffa';
    this.scoreLimit = cfg.scoreLimit || (cfg.mode === 'dom' ? 200 : cfg.mode === 'ffa' ? 25 : 50);
    this.timeLeft = (cfg.timeLimit || 10) * 60;
    this.scores = { A: 0, B: 0 };
    this.respawns = [];
    this.flags = null;
    this.uav = {}; this.active = [];
    this.canChangeClass = true;
    this.nextLoadout = null;
    this.firstBlood = false;
    this.targeting = null;
    this.over = false;
    this.lastKillTimes = [];
  }
  start() {
    const game = this.game, w = game.world, def = MAPS[this.cfg.map];
    const pteam = this.ffa ? 'P' : 'A';
    // 玩家
    const lo = this.buildLoadout(game.profile.classes[game.profile.selClass]);
    game.playerSleeve = def.styles[0] === 'snowA' ? 'fab_snowA' : 'fab_ally';
    const sp = this.spawnPoint(pteam);
    const pl = game.player = new Player(game, { team: pteam, pos: sp.pos, yaw: sp.yaw, name: '你' });
    pl.equip(lo);
    game.entities.push(pl);
    // 连杀
    this.streakDefs = game.profile.streaks.map(id => KILLSTREAKS.find(k => k.id === id)).sort((a, b) => a.kills - b.kills);
    this.streakState = this.streakDefs.map(d => ({ id: d.id, ready: false, used: false, cost: Math.max(2, d.kills - (pl.hasPerk('hardline') ? 1 : 0)) }));
    // 机器人
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    let ni = 0;
    const allyCount = this.ffa ? 0 : this.cfg.allies ?? 5;
    const enemyCount = this.ffa ? (this.cfg.enemies ?? 7) : this.cfg.enemies ?? 6;
    for (let i = 0; i < allyCount; i++) this.addBot('A', names[ni++ % names.length], def.styles[0]);
    for (let i = 0; i < enemyCount; i++) this.addBot(this.ffa ? 'F' + i : 'B', names[ni++ % names.length], this.ffa ? pick([def.styles[1], 'enemy', 'insurgent']) : def.styles[1]);
    const mname = { tdm: '团队死斗', dom: '占领', ffa: '自由混战' }[this.type];
    if (this.type === 'dom') {
      this.flags = w.flagPos.map((p, i) => ({ name: 'ABC'[i], pos: p.clone(), owner: null, prog: 0, capTeam: null, mesh: this.flagMesh(p) }));
    }
    game.hud.reset();
    game.hud.announce(mname, `${def.name} · ${this.ffa ? '率先达到 ' + this.scoreLimit + ' 次击杀' : '目标分数 ' + this.scoreLimit}`, 4);
    game.audio.say(mname + '，行动开始');
    this.updateStreakHUD();
  }
  flagMesh(p) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.3, 4.6, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), mat('steel')); pole.position.y = 1.6; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.2 }));
    cloth.position.set(0.56, 2.8, 0); g.add(cloth);
    g.position.set(p.x, this.game.world.groundHeight(p.x, p.z, 1, 0.3), p.z);
    this.game.world.root.add(g);
    g.userData = { ring, cloth };
    return g;
  }
  addBot(team, name, style) {
    const game = this.game;
    const wid = pick(BOT_WEAPONS);
    const sp = this.spawnPoint(team);
    const bot = new Bot(game, { team, name, style, weaponId: wid, att: randomAtt(wid), difficulty: this.cfg.diff, pos: sp.pos, yaw: sp.yaw, role: 'mp', tag: team === 'A' && !this.ffa, tagColor: '#6cf', camo: pick(['none', 'none', 'desert', 'woodland', 'digital']) });
    game.addBot(bot);
    return bot;
  }
  buildLoadout(cls) {
    const pl = this.game.player;
    return {
      primary: { id: cls.primary, att: cls.patt || {}, camo: cls.pcamo },
      secondary: { id: cls.secondary, att: cls.satt || {}, camo: cls.scamo },
      lethal: cls.lethal, tactical: cls.tactical, perks: cls.perks,
    };
  }
  applyClass(idx) {
    this.nextLoadout = this.buildLoadout(this.game.profile.classes[idx]);
    this.game.profile.selClass = idx; this.game.saveProfile();
  }
  enemiesOf(team) { return this.game.entities.filter(e => e.alive && e.team !== team && e.pos && e.targetable !== false); }
  spawnPoint(team) {
    const w = this.game.world;
    let cands;
    if (this.ffa) cands = [...w.spawns.A, ...w.spawns.B];
    else cands = team === 'A' ? w.spawns.A : w.spawns.B;
    const enemies = this.game.entities.filter(e => e.alive && e.team !== team && e.pos);
    // 加入随机点提升多样性（占领/自由模式）
    if (this.ffa || Math.random() < 0.25) for (let i = 0; i < 6; i++) cands = cands.concat([w.randomWalkable()]);
    let best = cands[0], bs = -1;
    for (const c of cands) {
      let md = 1e9;
      for (const e of enemies) md = Math.min(md, e.pos.distanceTo(c));
      const s = Math.min(md, 60) + Math.random() * 8;
      if (s > bs) { bs = s; best = c; }
    }
    const pos = best.clone();
    const yaw = Math.atan2(pos.x, pos.z); // 面向中心
    return { pos, yaw };
  }
  uavActive(team) { return (this.uav[team] || 0) > 0; }

  // ---------- 机器人目标 ----------
  botGoal(bot) {
    const w = this.game.world;
    if (this.type === 'dom' && Math.random() < 0.75) {
      const cands = this.flags.filter(f => f.owner !== bot.team);
      const list = cands.length ? cands : this.flags;
      list.sort((a, b) => a.pos.distanceTo(bot.pos) - b.pos.distanceTo(bot.pos));
      const f = Math.random() < 0.7 ? list[0] : pick(list);
      return f.pos.clone().add(new THREE.Vector3(rand(-2.5, 2.5), 0, rand(-2.5, 2.5)));
    }
    const enemies = this.enemiesOf(bot.team);
    if (enemies.length && Math.random() < 0.55) {
      const e = pick(enemies);
      return w.randomWalkable(e.pos.x, e.pos.z, 12);
    }
    return w.randomWalkable();
  }

  // ---------- 击杀 ----------
  onKill(killer, victim, weapon, head, info) {
    const game = this.game, pl = game.player;
    game.hud.killfeed(killer, victim, weapon, head);
    const kTeam = killer ? killer.team : null;
    if (killer && killer !== victim) {
      if (killer.isPlayer) this.playerKill(victim, weapon, head, info);
      else if (killer.kills !== undefined) {
        killer.kills++; killer.score += 100; killer.streak = (killer.streak || 0) + 1;
        if (!this.ffa) this.botStreak(killer);
      }
      if (!this.ffa && this.type === 'tdm') this.scores[kTeam === pl.team ? 'A' : 'B'] = (this.scores[kTeam === pl.team ? 'A' : 'B'] || 0) + 1;
    }
    // 助攻
    if (victim.dmgTaken && pl.alive !== undefined) {
      const d = victim.dmgTaken.get(pl);
      if (d && killer !== pl) { pl.stats.assists++; pl.stats.score += 25; game.hud.popup('+25 助攻', '#ddd'); this.chargeStreak(0.5); }
    }
    if (!this.firstBlood && killer && killer !== victim) {
      this.firstBlood = true;
      if (killer.isPlayer) { game.hud.popup('首杀', '', true); pl.stats.score += 50; }
    }
    // 掉落武器
    if (!victim.isPlayer && victim.weaponId && Math.random() < 0.6) game.spawnPickup(victim.weaponId, victim.att, victim.pos, Math.ceil(victim.stats.mag * 0.5), victim.stats.mag);
    // 复活安排
    if (victim.isPlayer) {
      game.dead = true; game.deathKiller = killer;
      this.respawns.push({ e: victim, t: 4.5 });
      const el = document.getElementById('deathScreen');
      el.classList.remove('hidden');
      document.getElementById('killerInfo').innerHTML = killer && killer !== victim ? `被 <b>${killer.name}</b> 使用 ${weapon || ''} ${head ? '爆头' : ''}击杀` : '你自杀了';
      pl.stats.streak = 0;
      this.streakKills = 0;
      this.updateStreakHUD();
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      victim.streak = 0;
      this.respawns.push({ e: victim, t: 4 + Math.random() * 2 });
    }
    // FFA 分数
    if (this.ffa && killer && killer !== victim) {
      const k = killer.isPlayer ? pl.stats.kills : killer.kills;
      if (k >= this.scoreLimit) this.end(killer);
    }
  }
  playerKill(victim, weapon, head, info) {
    const game = this.game, pl = game.player;
    pl.stats.kills++; pl.stats.streak++;
    let pts = 100;
    game.hud.popup('+100 击杀', '#fff');
    if (head) { pl.stats.headshots++; pts += 50; game.hud.popup('爆头 +50', '', true); }
    if (info && info.melee) { pts += 50; game.hud.popup('近战击杀', '', true); }
    const dist = victim.pos.distanceTo(pl.pos);
    if (dist > 40 && !info.explosive) { pts += 50; game.hud.popup('远距离击杀 +50', '', true); }
    const now = game.time;
    this.lastKillTimes = this.lastKillTimes.filter(t => now - t < 4); this.lastKillTimes.push(now);
    const n = this.lastKillTimes.length;
    if (n >= 2) { const names = ['', '', '双杀', '三杀', '四杀', '暴走', '无人可挡']; game.hud.popup(names[Math.min(n, 6)] + ` +${n * 50}`, '', true); pts += n * 50; game.audio.say(names[Math.min(n, 6)]); }
    if (pl.lastAttacker === victim) { game.hud.popup('复仇 +50', '', true); pts += 50; pl.lastAttacker = null; }
    if (pl.stats.streak % 5 === 0) game.hud.popup(`连杀 ×${pl.stats.streak}`, '', true);
    pl.stats.score += pts;
    if (pl.hasPerk('scavenger')) { pl.ws.refill(0.35); if (pl.lethal && pl.lethal.count < pl.lethal.max) pl.lethal.count++; game.hud.popup('拾荒者：弹药补给', '#9cf'); }
    if (pl.hasPerk('quickfix')) { pl.dmgT = 99; pl.hp = Math.min(pl.maxHp, pl.hp + 40); }
    if (this.type === 'ffa') { }
    this.chargeStreak(1);
  }
  chargeStreak(v) {
    this.streakKills = (this.streakKills || 0) + v;
    for (const s of this.streakState) {
      if (!s.ready && !s.used && this.streakKills >= s.cost) {
        s.ready = true;
        const def = KILLSTREAKS.find(k => k.id === s.id);
        this.game.hud.announce(def.name + ' 就绪', `按 [${this.streakState.indexOf(s) + 3}] 呼叫`, 2.5);
        this.game.audio.say(def.name + '已就绪');
        this.game.audio.beep(3);
      }
    }
    this.updateStreakHUD();
  }
  updateStreakHUD() {
    this.game.hud.streaks(this.streakState, Math.floor(this.streakKills || 0));
  }
  botStreak(bot) {
    const game = this.game;
    const team = bot.team;
    if (bot.streak === 3) {
      this.uav[team] = 25;
      if (team !== game.player.team) { game.hud.announce('敌方UAV已上线', '保持移动或使用幽灵Perk', 3); game.audio.say('敌方无人机已上线'); }
      else game.hud.announce('友方UAV已上线', '', 2);
    } else if (bot.streak === 5) {
      const targets = this.enemiesOf(team).filter(e => !(e.isPlayer && e.hasPerk('coldblooded')));
      if (targets.length) {
        const t = pick(targets);
        this.clusterStrike(t.pos.clone(), bot, rand(0, Math.PI * 2));
        if (team !== game.player.team) { game.hud.announce('敌方空袭来袭！', '立即寻找掩护', 3); game.audio.say('敌方空袭来袭，寻找掩护'); }
      }
    } else if (bot.streak === 7) {
      this.spawnHeli(team, bot);
      if (team !== game.player.team) { game.hud.announce('敌方武装直升机', '', 3); game.audio.say('敌方武装直升机进入战区'); }
    }
  }

  // ---------- 连杀奖励 ----------
  useStreak(i) {
    const s = this.streakState[i];
    if (!s || !s.ready) return;
    const game = this.game, pl = game.player;
    if (s.id === 'uav') { this.uav[pl.team] = 30; game.hud.announce('UAV 已上线', '', 2); game.audio.say('无人机已上线'); }
    else if (s.id === 'cluster') { this.targeting = { s, type: 'cluster' }; game.hud.announce('选择空袭目标', '左键确认 · 右键取消', 2.5); return; }
    else if (s.id === 'sentry') {
      const f = pl.forward(new THREE.Vector3()); f.y = 0; f.normalize();
      const p = pl.pos.clone().addScaledVector(f, 2);
      if (game.world.lineBlocked(pl.pos.clone().setY(pl.pos.y + 0.5), p.clone().setY(p.y + 0.5))) { game.hud.popup('无法在此部署', '#f66'); return; }
      this.active.push(new Sentry(game, p, pl));
      game.audio.say('哨戒机枪已部署');
    } else if (s.id === 'heli') { this.spawnHeli(pl.team, pl); game.audio.say('武装直升机已就位'); }
    else if (s.id === 'wp') this.whitePhosphorus(pl);
    s.ready = false; s.used = true;
    this.updateStreakHUD();
  }
  spawnHeli(team, owner) { this.active.push(new Heli(this.game, team, owner)); }
  clusterStrike(pos, owner, ang) {
    const game = this.game;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    game.audio.whoosh(pos);
    setTimeout(() => {
      if (!game.world) return;
      for (let i = 0; i < 9; i++) {
        const p = pos.clone().addScaledVector(dir, (i - 4) * 3.2).add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(-1.5, 1.5)));
        const start = p.clone().addScaledVector(dir, -25); start.y = 45;
        const v = p.clone().sub(start); const T = 1.6;
        const vel = new THREE.Vector3(v.x / T, (v.y + 0.5 * 12 * T * T) / T, v.z / T);
        setTimeout(() => { if (game.world) game.projectiles.push(new Projectile(game, 'bomb', start, vel, owner, 10)); }, i * 110);
      }
    }, 1400);
  }
  whitePhosphorus(owner) {
    const game = this.game;
    game.hud.announce('白磷弹投放', '', 3); game.audio.say('白磷弹来袭');
    this.wpT = 10;
    for (const e of this.enemiesOf(owner.team)) {
      e.takeDamage(55, { attacker: owner, weapon: '白磷弹', explosive: true, dir: new THREE.Vector3(0, -1, 0) });
    }
    for (let i = 0; i < 12; i++) {
      const p = game.world.randomWalkable();
      setTimeout(() => { if (game.world) { game.effects.explosion(p, 0.8); game.audio.explosion(p, 0.5); game.effects.addFireSource(p.clone().setY(0.1), 1.5, 8); } }, i * 250);
    }
  }

  // ---------- 更新 ----------
  update(dt, inp) {
    const game = this.game, pl = game.player;
    if (this.over) { return; }
    this.timeLeft -= dt;
    // 复活
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      r.t -= dt;
      if (r.e.isPlayer) {
        document.getElementById('respawnText').textContent = r.t > 0 ? `${Math.ceil(r.t)} 秒后重新部署…` : '按 [空格] 重新部署';
        if (r.t <= 0 && (game.input.keys.Space || r.t < -4)) {
          const sp = this.spawnPoint(pl.team);
          if (this.nextLoadout) { pl.equip(this.nextLoadout); this.nextLoadout = null; this.streakState.forEach(s => s.cost = Math.max(2, KILLSTREAKS.find(k => k.id === s.id).kills - (pl.hasPerk('hardline') ? 1 : 0))); }
          pl.respawn(sp.pos, sp.yaw);
          game.dead = false;
          document.getElementById('deathScreen').classList.add('hidden');
          game.menu.hideClassSelect();
          this.respawns.splice(i, 1);
          game.lock();
        }
      } else if (r.t <= 0) {
        const sp = this.spawnPoint(r.e.team);
        r.e.respawn(sp.pos, sp.yaw);
        this.respawns.splice(i, 1);
      }
    }
    // 占领
    if (this.flags) {
      for (const f of this.flags) {
        const cnt = {};
        for (const e of game.entities) {
          if (!e.alive || !e.pos || e.targetable === false || e.isTurret) continue;
          if (Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z) < 4.5 && Math.abs(e.pos.y - f.pos.y) < 3) cnt[e.team] = (cnt[e.team] || 0) + 1;
        }
        const teams = Object.keys(cnt);
        if (teams.length === 1 && teams[0] !== f.owner) {
          const t = teams[0];
          if (f.capTeam !== t) { f.capTeam = t; f.prog = 0; }
          f.prog += dt * (0.18 + 0.07 * Math.min(3, cnt[t]));
          if (pl.alive && t === pl.team && Math.hypot(pl.pos.x - f.pos.x, pl.pos.z - f.pos.z) < 4.5) game.hud.progress(f.prog);
          if (f.prog >= 1) {
            f.owner = t; f.prog = 0; f.capTeam = null;
            const mine = t === pl.team;
            game.hud.announce(`${mine ? '已占领' : '失去'} ${f.name} 点`, '', 2);
            game.audio.say(mine ? `已占领${f.name}点` : `${f.name}点已失守`);
            if (mine && pl.alive && Math.hypot(pl.pos.x - f.pos.x, pl.pos.z - f.pos.z) < 4.5) { pl.stats.score += 200; pl.stats.captures++; game.hud.popup('+200 占领', '', true); }
            for (const b of game.bots) if (b.team === t && b.alive && Math.hypot(b.pos.x - f.pos.x, b.pos.z - f.pos.z) < 4.5) { b.score += 200; b.captures++; }
            game.hud.progress(null);
          }
        } else if (teams.length !== 1) {
          if (f.capTeam && teams.length === 0) f.prog = Math.max(0, f.prog - dt * 0.1);
          if (pl.alive && Math.hypot(pl.pos.x - f.pos.x, pl.pos.z - f.pos.z) < 4.5 && teams.length > 1) game.hud.progress(f.prog);
        } else if (f.owner === teams[0] && pl.alive && Math.hypot(pl.pos.x - f.pos.x, pl.pos.z - f.pos.z) < 4.5) game.hud.progress(null);
        if (pl.alive && Math.hypot(pl.pos.x - f.pos.x, pl.pos.z - f.pos.z) >= 4.5 && this.nearFlag === f) game.hud.progress(null);
        if (pl.alive && Math.hypot(pl.pos.x - f.pos.x, pl.pos.z - f.pos.z) < 4.5) this.nearFlag = f; else if (this.nearFlag === f) this.nearFlag = null;
        const col = f.owner === pl.team ? 0x4fb4ff : f.owner ? 0xff4a3d : 0xffffff;
        f.mesh.userData.ring.material.color.setHex(col);
        f.mesh.userData.cloth.material.color.setHex(col); f.mesh.userData.cloth.material.emissive.setHex(col);
        f.mesh.userData.cloth.rotation.y = Math.sin(game.time * 2 + f.pos.x) * 0.3;
        if (f.owner) this.scores[f.owner === pl.team ? 'A' : 'B'] += dt * 0.6;
      }
    }
    // UAV
    for (const t in this.uav) {
      this.uav[t] -= dt;
      if (this.uav[t] > 0 && t !== pl.team) {
        this.uavPing = (this.uavPing || 0) - dt;
        if (this.uavPing <= 0) {
          this.uavPing = 2.5;
          for (const b of game.bots) if (b.team === t && b.alive) {
            const tg = this.enemiesOf(t).filter(e => !(e.isPlayer && e.hasPerk('ghost')));
            if (tg.length) { tg.sort((a, c) => a.pos.distanceTo(b.pos) - c.pos.distanceTo(b.pos)); b.hint(tg[0].pos); }
          }
        }
      }
    }
    if (this.wpT > 0) { this.wpT -= dt; game.grade.uniforms.wp.value = Math.min(1, this.wpT / 3) * 0.6; for (const e of this.enemiesOf(pl.team)) if (Math.random() < dt * 2) e.takeDamage(6, { attacker: pl, weapon: '白磷弹', explosive: true, dir: new THREE.Vector3(0, -1, 0) }); }
    else game.grade.uniforms.wp.value = 0;
    // 连杀奖励
    for (const a of this.active) a.update(dt);
    this.active = this.active.filter(a => a.alive);
    if (pl.alive && inp.streak >= 0) this.useStreak(inp.streak);
    this.updateTargeting(inp);
    // HUD
    this.hudScore();
    const markers = [];
    if (this.flags) for (const f of this.flags) markers.push({ id: 'f' + f.name, pos: f.pos.clone().setY(f.mesh.position.y + 3.6), label: f.name, cls: 'flag ' + (f.owner === pl.team ? 'ally' : f.owner ? 'enemy' : 'neutral') });
    game.hud.setMarkers(markers);
    // 结束
    if (!this.ffa) {
      if (this.scores.A >= this.scoreLimit) this.end('A');
      else if (this.scores.B >= this.scoreLimit) this.end('B');
    }
    if (this.timeLeft <= 0) {
      if (this.ffa) { const all = this.ranking(); this.end(all[0].e); }
      else this.end(this.scores.A > this.scores.B ? 'A' : this.scores.B > this.scores.A ? 'B' : 'draw');
    }
  }
  updateTargeting(inp) {
    const game = this.game, t = this.targeting;
    if (!t) { if (this.tgtMesh) this.tgtMesh.visible = false; return; }
    if (!this.tgtMesh) {
      this.tgtMesh = new THREE.Mesh(new THREE.RingGeometry(3, 3.5, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
      this.tgtMesh.rotation.x = -Math.PI / 2; game.world.root.add(this.tgtMesh);
    }
    const cam = game.camera, d = cam.getWorldDirection(new THREE.Vector3());
    const hit = game.world.raycast(cam.position, d, 200);
    this.tgtMesh.visible = !!hit;
    if (hit) this.tgtMesh.position.copy(hit.point).setY(hit.point.y + 0.1);
    game.hud.prompt('<b>左键</b>确认空袭目标 · <b>右键</b>取消');
    if (inp.firePressed && hit) {
      this.clusterStrike(hit.point.clone(), game.player, game.player.yaw + Math.PI / 2);
      t.s.ready = false; t.s.used = true; this.targeting = null; game.hud.prompt(null);
      game.audio.say('集束空袭已确认'); this.updateStreakHUD();
      game.player.ws.cool = 0.3;
    } else if (inp.adsPressed) { this.targeting = null; game.hud.prompt(null); }
  }
  get interactPrompt() { return !!this.targeting; }
  hudScore() {
    const game = this.game, pl = game.player;
    const t = fmtTime(this.timeLeft);
    let html;
    if (this.ffa) {
      const r = this.ranking();
      const me = r.findIndex(x => x.e.isPlayer);
      const lead = r[0];
      html = `<div class="sb-team a">${pl.stats.kills}</div><div class="sb-time">${t}<br><small style="font-size:11px;color:#aaa">第 ${me + 1} 名</small></div><div class="sb-team b">${lead.e.isPlayer ? (r[1] ? r[1].k : 0) : lead.k}</div>`;
    } else {
      let flags = '';
      if (this.flags) flags = `<div class="sb-flags">${this.flags.map(f => `<div class="sb-flag ${f.owner === pl.team ? 'A' : f.owner ? 'B' : ''}">${f.name}</div>`).join('')}</div>`;
      html = `<div class="sb-team a">${Math.floor(this.scores.A)}</div>${flags}<div class="sb-time">${t}</div><div class="sb-team b">${Math.floor(this.scores.B)}</div>`;
    }
    game.hud.scorebar(html);
  }
  ranking() {
    const game = this.game, pl = game.player;
    const list = [{ e: pl, k: pl.stats.kills, d: pl.stats.deaths, s: pl.stats.score }];
    for (const b of game.bots) list.push({ e: b, k: b.kills, d: b.deaths, s: b.score });
    return list.sort((a, b) => b.k - a.k || b.s - a.s);
  }
  scoreboardHTML() {
    const game = this.game, pl = game.player;
    const row = (x, i) => `<tr class="${x.e.isPlayer ? 'me' : ''} ${x.e.alive ? '' : 'dead'}"><td>${i + 1}. ${x.e.name}</td><td>${x.s}</td><td>${x.k}</td><td>${x.d}</td><td>${x.e.isPlayer ? pl.stats.assists : '-'}</td></tr>`;
    const head = (t, cls) => `<table class="sbt ${cls}"><tr><th>${t}</th><th>得分</th><th>击杀</th><th>死亡</th><th>助攻</th></tr>`;
    const all = this.ranking();
    if (this.ffa) return head('自由混战', 'A') + all.map(row).join('') + '</table>';
    const A = all.filter(x => x.e.team === pl.team), B = all.filter(x => x.e.team !== pl.team);
    return head(`联合特遣队 · ${Math.floor(this.scores.A)}`, 'A') + A.map(row).join('') + '</table>' + head(`敌方部队 · ${Math.floor(this.scores.B)}`, 'B') + B.map(row).join('') + '</table>';
  }
  minimapMarkers() { return []; }
  end(winner) {
    if (this.over) return;
    this.over = true;
    const game = this.game, pl = game.player;
    game.ending = true;
    let win;
    if (this.ffa) win = winner === pl ? 'win' : 'lose';
    else win = winner === 'draw' ? 'draw' : winner === pl.team ? 'win' : 'lose';
    const r = this.ranking();
    const place = r.findIndex(x => x.e.isPlayer) + 1;
    const xp = pl.stats.score + (win === 'win' ? 500 : 150);
    game.profile.xp += xp; game.saveProfile();
    game.audio.say(win === 'win' ? '胜利' : win === 'draw' ? '平局' : '失败');
    game.hud.announce(win === 'win' ? '胜利' : win === 'draw' ? '平局' : '失败', '', 3);
    setTimeout(() => {
      if (document.pointerLockElement) document.exitPointerLock();
      game.menu.showResults({
        win, title: win === 'win' ? '胜利' : win === 'draw' ? '平局' : '失败',
        sub: this.ffa ? `第 ${place} 名` : `${Math.floor(this.scores.A)} : ${Math.floor(this.scores.B)}`,
        stats: [['得分', pl.stats.score], ['击杀', pl.stats.kills], ['死亡', pl.stats.deaths], ['K/D', (pl.stats.kills / Math.max(1, pl.stats.deaths)).toFixed(2)], ['命中率', Math.round(pl.stats.hits / Math.max(1, pl.stats.shots) * 100) + '%'], ['经验值', '+' + xp]],
        board: this.scoreboardHTML(), again: () => game.startGame('mp', this.cfg),
      });
    }, 2500);
  }
  dispose() {
    for (const a of this.active) a.dispose && a.dispose();
    this.game.hud.progress(null);
  }
}

// ---------- 哨戒机枪 ----------
class Sentry {
  constructor(game, pos, owner) {
    this.game = game; this.owner = owner; this.team = owner.team; this.name = '哨戒机枪'; this.isTurret = true;
    this.pos = pos.clone(); this.pos.y = game.world.groundHeight(pos.x, pos.z, pos.y + 0.5, 0.3);
    this.hp = 300; this.alive = true; this.t = 60; this.yaw = owner.yaw; this.fireT = 0; this.target = null; this.scanT = 0;
    this.stats = { dmgNear: 20, dmgFar: 16, rangeNear: 20, rangeFar: 50, headMul: 1.2, name: '哨戒机枪' };
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), mat('darkMetal')); const a = i / 3 * Math.PI * 2; l.position.set(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(l); }
    const head = new THREE.Group(); head.position.y = 0.95; g.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), mat('gunGreen')));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8).rotateX(Math.PI / 2), mat('gunMetal')); b.position.set(0, 0.02, -0.55); head.add(b);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.25), mat('gunGreen')); box.position.set(0.25, -0.05, 0); head.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: owner.isPlayer ? new THREE.Color(0.3, 1.5, 3) : new THREE.Color(3, 0.3, 0.3) })); lamp.position.set(0, 0.17, 0.1); head.add(lamp);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.02, -0.92); head.add(this.muzzle);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.copy(this.pos); game.scene.add(g);
    this.mesh = g; this.head = head;
    game.entities.push(this);
  }
  eyePos(o) { return o.set(this.pos.x, this.pos.y + 1.0, this.pos.z); }
  chestPos(o) { return o.set(this.pos.x, this.pos.y + 0.8, this.pos.z); }
  hitTest(o, d, maxT) {
    if (!this.alive) return null;
    const b = { x0: this.pos.x - 0.3, x1: this.pos.x + 0.3, y0: this.pos.y, y1: this.pos.y + 1.15, z0: this.pos.z - 0.3, z1: this.pos.z + 0.3 };
    const t = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, b, maxT);
    return t >= 0 ? { t, part: 'body' } : null;
  }
  takeDamage(d, info) {
    if (!this.alive) return false;
    this.hp -= info.explosive ? d * 2 : d * 0.5;
    if (this.hp <= 0) { this.destroy(); if (info.attacker && info.attacker.isPlayer) this.game.hud.popup('摧毁哨戒机枪 +100', '', true); return true; }
    return false;
  }
  destroy() {
    this.alive = false;
    this.game.effects.explosion(this.pos.clone().setY(this.pos.y + 0.8), 0.6); this.game.audio.explosion(this.pos, 0.5);
    this.dispose();
  }
  dispose() { this.game.scene.remove(this.mesh); this.game.entities = this.game.entities.filter(e => e !== this); }
  update(dt) {
    const game = this.game;
    this.t -= dt;
    if (this.t <= 0) { this.alive = false; this.dispose(); return; }
    this.fireT -= dt; this.scanT -= dt;
    const eye = this.eyePos(new THREE.Vector3());
    if (this.scanT <= 0) {
      this.scanT = 0.25; this.target = null;
      let bd = 45;
      for (const e of game.entities) {
        if (!e.alive || e.team === this.team || !e.chestPos || e.isTurret) continue;
        const c = e.chestPos(new THREE.Vector3());
        const d = c.distanceTo(eye);
        if (d > bd) continue;
        if (e.isPlayer && e.hasPerk('coldblooded')) continue;
        if (game.world.lineBlocked(eye, c)) continue;
        bd = d; this.target = e;
      }
    }
    if (this.target && this.target.alive) {
      const c = this.target.chestPos(new THREE.Vector3());
      const want = Math.atan2(-(c.x - eye.x), -(c.z - eye.z));
      let da = want - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      this.yaw += clamp(da, -5 * dt, 5 * dt);
      if (Math.abs(da) < 0.15 && this.fireT <= 0) {
        this.fireT = 0.1;
        const dir = spreadDir(c.sub(eye).normalize(), 2.2 * DEG, new THREE.Vector3());
        const r = fireHitscan(game, this.owner.alive !== undefined ? this.owner : this, eye, dir, this.stats, '哨戒机枪');
        const m = this.muzzle.getWorldPosition(new THREE.Vector3());
        game.effects.tracer(m, r.point, [2, 1.4, 0.6]); game.effects.muzzle(m, dir, 0.7, false);
        game.audio.shot('turret', this.pos);
        if (r.ent && this.owner.isPlayer) { game.hud.hitmarker(r.killed); }
      }
    } else this.yaw += dt * 0.6;
    this.head.rotation.y = this.yaw;
  }
}

// ---------- 武装直升机 ----------
export class Heli {
  constructor(game, team, owner, opts = {}) {
    this.game = game; this.team = team; this.owner = owner; this.alive = true;
    this.t = opts.duration || 45; this.ang = Math.random() * 6; this.fireT = 0; this.target = null; this.scanT = 0;
    this.radius = Math.min(28, game.world.half * 0.55); this.height = opts.height || 24;
    this.stats = { dmgNear: 26, dmgFar: 22, rangeNear: 30, rangeFar: 80, headMul: 1.2, name: '武装直升机' };
    this.mesh = buildHeli(team === game.player.team ? 0x3a4a3a : 0x2a2a2a);
    this.rotor = this.mesh.userData.rotor; this.tail = this.mesh.userData.tail;
    game.scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.enter = 1;
    game.audio.loop('heli' + this.ang, 'rotor', 0.0);
    this.loopName = 'heli' + this.ang;
  }
  update(dt) {
    const game = this.game;
    this.t -= dt;
    if (this.t <= 0) { this.alive = false; this.dispose(); return; }
    this.ang += dt * 0.18;
    this.enter = Math.max(0, this.enter - dt * 0.3);
    const r = this.radius + this.enter * 120;
    this.pos.set(Math.cos(this.ang) * r, this.height + this.enter * 20, Math.sin(this.ang) * r);
    this.mesh.position.copy(this.pos);
    this.rotor.rotation.y += dt * 30; this.tail.rotation.x += dt * 40;
    const d = game.player ? this.pos.distanceTo(game.camera.position) : 100;
    game.audio.setLoopVol(this.loopName, clamp(0.5 - d / 150, 0.02, 0.5));
    this.scanT -= dt; this.fireT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5; this.target = null; let bd = 90;
      for (const e of game.entities) {
        if (!e.alive || e.team === this.team || !e.chestPos) continue;
        if (e.isPlayer && e.hasPerk('coldblooded')) continue;
        const c = e.chestPos(new THREE.Vector3());
        const dd = c.distanceTo(this.pos);
        if (dd > bd || game.world.lineBlocked(this.pos, c)) continue;
        bd = dd; this.target = e;
      }
    }
    let look = this.ang + Math.PI;
    if (this.target && this.target.alive) {
      const c = this.target.chestPos(new THREE.Vector3());
      look = Math.atan2(-(c.x - this.pos.x), -(c.z - this.pos.z));
      if (this.fireT <= 0 && this.enter <= 0) {
        this.fireT = 0.09;
        const dir = spreadDir(c.clone().sub(this.pos).normalize(), 2.6 * DEG, new THREE.Vector3());
        const shooter = { team: this.team, isPlayer: false, name: '武装直升机', kills: undefined, alive: true };
        const res = fireHitscan(game, this.owner && this.owner.isPlayer ? this.owner : shooter, this.pos.clone().add(new THREE.Vector3(0, -1, 0)), dir, this.stats, '武装直升机');
        game.effects.tracer(this.pos.clone().add(new THREE.Vector3(0, -1.2, 0)), res.point, [2, 1.3, 0.5]);
        game.audio.shot('turret', this.pos);
        if (res.ent && this.owner && this.owner.isPlayer) game.hud.hitmarker(res.killed);
      }
    } else look = this.ang + Math.PI;
    this.mesh.rotation.y = look;
    this.mesh.rotation.z = Math.sin(this.ang * 3) * 0.05;
    this.mesh.rotation.x = -0.1;
  }
  dispose() { this.game.scene.remove(this.mesh); this.game.audio.stopLoop(this.loopName); }
}

export function buildHeli(color = 0x3a4a3a) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 3.2, 6, 12).rotateX(Math.PI / 2), paint); g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), mat('windowDark')); nose.position.set(0, 0.2, -2.2); nose.scale.set(0.9, 0.8, 0.8); g.add(nose);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5.5, 8).rotateX(Math.PI / 2), paint); boom.position.set(0, 0.4, 4.6); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1), paint); fin.position.set(0, 1.1, 7.1); g.add(fin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), mat('darkMetal')); mast.position.y = 1.5; g.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 1.8; g.add(rotor);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 7.5), mat('darkMetal')); b.rotation.y = i * Math.PI / 4 * 2 / 2 + i * Math.PI / 4; b.position.z = 0; rotor.add(b); }
  const tail = new THREE.Group(); tail.position.set(0.2, 1.2, 7.1); g.add(tail);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.15), mat('darkMetal')); b.rotation.x = i * Math.PI / 2; tail.add(b); }
  for (const x of [-0.9, 0.9]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3), mat('darkMetal')); s.position.set(x, -1.35, 0); g.add(s); const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), mat('darkMetal')); st.position.set(x, -1.15, 0); g.add(st); }
  for (const x of [-1.3, 1.3]) { const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8).rotateX(Math.PI / 2), mat('darkMetal')); pod.position.set(x, -0.3, -0.3); g.add(pod); }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.3) })); light.position.set(0, -1.2, 0); g.add(light);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { rotor, tail };
  return g;
}
