// 战役关卡：行动代号「午夜清道夫」
import * as THREE from 'three';
import { Player } from './player.js';
import { Bot } from './ai.js';
import { buildHeli } from './mp.js';
import { mat } from './materials.js';
import { fmtTime, rand, pick } from './util.js';

const V = (x, z, y = 0) => new THREE.Vector3(x, y, z);

export class Campaign {
  constructor(game, cfg) {
    this.game = game; this.cfg = cfg;
    this.diff = cfg.diff ?? 1;
    this.nvgAvailable = true;
    this.canChangeClass = false;
    this.step = -1; this.stepT = 0;
    this.groups = {};
    this.alerted = {};
    this.weaponsFree = false;
    this.checkpoint = { pos: V(-88, 0), yaw: -Math.PI / 2 };
    this.anims = [];
    this.kills = 0; this.startTime = 0;
    this.interactPrompt = false;
    this.done = false;
  }
  start() {
    const game = this.game, w = game.world;
    game.playerSleeve = 'fab_ally';
    const pl = game.player = new Player(game, { team: 'A', pos: V(-88, 0), yaw: -Math.PI / 2, name: '你' });
    pl.dmgMul = [0.45, 0.8, 1.3][this.diff];
    pl.equip({
      primary: { id: 'm4', att: { muzzle: 'suppressor', optic: 'holo', laser: 'tac', under: 'vgrip' }, camo: 'none' },
      secondary: { id: 'm1911', att: { muzzle: 'suppressor' }, camo: 'none' },
      lethal: 'frag', tactical: 'flash', perks: ['sleight'], extraLethal: 1,
    });
    game.entities.push(pl);
    game.botDmgMul = [0.7, 1, 1.25][this.diff];
    game.nvg = true;
    // 盟友
    const ally = (name, x, z, wid, att) => {
      const b = game.addBot(new Bot(game, { team: 'A', name, style: 'ally', weaponId: wid, att, difficulty: 2, pos: V(x, z), yaw: -Math.PI / 2, role: 'ally', tag: true, tagColor: '#6cf', hp: 100000, accuracyMul: 1.6 }));
      b.stealthy = true;
      b.holdFire = () => !this.weaponsFree;
      return b;
    };
    this.blake = ally('布雷克上尉', -86, -2.5, 'm4', { muzzle: 'suppressor', optic: 'holo', laser: 'tac' });
    this.raven = ally('渡鸦', -87, 3, 'scar', { muzzle: 'suppressor', optic: 'reddot' });
    this.blake.followOffset = new THREE.Vector3(-2, 0, 3); this.raven.followOffset = new THREE.Vector3(2.5, 0, 4);
    // 敌人
    const E = (group, x, z, wid, o = {}) => {
      const b = game.addBot(new Bot(game, Object.assign({ team: 'B', name: o.name || pick(['叛军', '武装分子', '民兵']), style: o.style || 'insurgent', weaponId: wid, att: o.att || {}, difficulty: this.diff, pos: V(x, z, o.y || 0), yaw: o.yaw ?? rand(-3, 3), role: o.role || 'guard', group, leash: o.leash || 18, grenades: this.diff > 0 ? 1 : 0 }, o)));
      b.scanBase = b.yaw;
      (this.groups[group] = this.groups[group] || []).push(b);
      return b;
    };
    // 前哨站
    E('outpost', -43, -12, 'sks', { y: 4.2, static: true, yaw: Math.PI / 2, name: '哨塔守卫' });
    E('outpost', -52, -12, 'ak', { patrol: [V(-52, -12), V(-56, 12), V(-48, 16)] });
    E('outpost', -46.5, 5, 'ak', { yaw: Math.PI / 2 });
    E('outpost', -44, 5.5, 'pkm', { yaw: 0 });
    E('outpost', -38, -1.5, 'm870', { yaw: Math.PI / 2 });
    E('outpost', -49, 10, 'ak', { yaw: Math.PI });
    // 村庄
    E('village', -5, -6, 'ak', { patrol: [V(-5, -6), V(18, -6), V(18, 6), V(-5, 6)] });
    E('village', 6, -16, 'ak', { leash: 8 });
    E('village', 10, 14, 'm870', { leash: 8 });
    E('village', 22, -12, 'ak', { leash: 10 });
    E('village', 25, 13.5, 'pkm', { leash: 10 });
    // 大院
    E('compound', 50, 6, 'ak', { yaw: Math.PI / 2, leash: 20 });
    E('compound', 52, -7, 'ak', { yaw: Math.PI / 2, leash: 20 });
    E('compound', 48, 15, 'pkm', { yaw: Math.PI / 2, leash: 15 });
    E('compound', 56, -16, 'sks', { yaw: Math.PI / 2, leash: 12 });
    E('compound', 60, 0.5, 'm870', { yaw: Math.PI / 2, leash: 6 });
    E('compound', 66, 1, 'ak', { leash: 6 });
    E('compound', 62, -5, 'ak', { leash: 5 });
    E('compound', 63, 5.5, 'mp5', { leash: 5 });
    E('compound', 75, 5, 'ak', { leash: 5 });
    E('compound', 72, -6, 'ak', { leash: 4, style: 'enemy', name: '贴身护卫' });
    E('compound', 84, 10, 'ak', { leash: 10 });
    this.hvt = E('compound', 77, -4, 'mp5', { leash: 3, style: 'hvt', name: '铁蝎·萨米尔', hp: 160, isHVT: true, att: { optic: 'reddot' } });
    // 东门
    this.gate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.9, 5), mat('darkMetal'));
    this.gate.position.set(88, 1.45, 0); this.gate.castShadow = true; w.root.add(this.gate);
    this.gateBox = w.collider(87.85, 0, -2.5, 88.15, 2.9, 2.5);
    w.buildGrid();
    // 空投弹药箱标记
    // 插入直升机
    const h = buildHeli(0x2e3a2e);
    h.position.set(-90, 1.5, 8); h.rotation.y = -Math.PI / 2;
    w.root.add(h);
    game.audio.loop('insHeli', 'rotor', 0.4);
    this.anims.push({ t: 0, f: (a, dt) => { a.t += dt; h.userData.rotor.rotation.y += dt * 30; h.userData.tail.rotation.x += dt * 40; if (a.t > 2) { const k = a.t - 2; h.position.set(-90 - k * k * 1.5, 1.5 + k * 3, 8 + k * 2); h.rotation.z = Math.min(0.2, k * 0.05); game.audio.setLoopVol('insHeli', Math.max(0, 0.4 - k * 0.04)); } if (a.t > 14) { w.root.remove(h); game.audio.stopLoop('insHeli'); return true; } } });
    game.hud.reset();
    game.hud.fade(1, 0); setTimeout(() => game.hud.fade(0, 2.5), 300);
    game.hud.announce('午夜清道夫', '卡尔达什边境 · 当地时间 02:40', 5);
    this.nextStep();
  }
  alertGroup(g, pos) {
    const list = this.groups[g];
    if (!list) return;
    if (!this.alerted[g]) {
      this.alerted[g] = true;
      if (g === 'outpost' && this.step <= 1) this.say('布雷克上尉', '被发现了！火力全开！');
      if (g === 'compound' && this.step <= 3) this.say('渡鸦', '院子里的人被惊动了，小心！');
    }
    this.weaponsFree = true;
    for (const b of list) if (b.alive) { b.alerted = true; b.hint(pos); }
  }
  say(sp, text, dur) { this.game.hud.subtitle(sp, text, dur); }
  alive(g) { return (this.groups[g] || []).filter(b => b.alive).length; }
  setCheckpoint(pos, yaw) {
    this.checkpoint = { pos: pos.clone(), yaw };
    this.game.hud.popup('检查点', '#9cf');
  }

  nextStep() {
    this.step++; this.stepT = 0;
    const game = this.game, hud = game.hud;
    const s = this.step;
    if (s === 0) {
      hud.objective('当前目标', '跟随布雷克上尉前往敌方前哨站');
      this.say('布雷克上尉', '夜视仪戴好，按 N 切换。跟紧我，保持安静。', 4);
      this.say('布雷克上尉', '情报显示前哨站在东边，大约四十米。武器已装消音器，尽量别惊动他们。', 5);
      this.blake.leadTarget = V(-68, -3); this.raven.leadTarget = V(-69, 3);
    } else if (s === 1) {
      hud.objective('当前目标', '清除敌方前哨站');
      this.say('布雷克上尉', '前哨站就在前面。塔楼上有个哨兵，先解决他。我们在这里掩护，你来决定开火时机。', 5);
    } else if (s === 2) {
      this.setCheckpoint(V(-40, 0), -Math.PI / 2);
      this.blake.leadTarget = null; this.raven.leadTarget = null;
      hud.objective('当前目标', '穿过村庄，前往目标大院');
      this.say('布雷克上尉', '前哨站已清除，干净利落。', 3);
      this.say('渡鸦', '村子里还有武装分子，注意窗户和屋顶。', 4);
    } else if (s === 3) {
      this.setCheckpoint(V(36, 0), -Math.PI / 2);
      hud.objective('当前目标', '突入大院，击毙高价值目标「铁蝎」');
      this.say('布雷克上尉', '这就是目标大院。「铁蝎」萨米尔就在主楼后侧房间里。', 4.5);
      this.say('布雷克上尉', '从正门突入，逐个房间清理。按 Q 投掷闪光弹。', 4);
    } else if (s === 4) {
      hud.objective('当前目标', '搜集情报');
      this.say('布雷克上尉', '目标确认击毙！快，搜查他的电脑，下载所有情报！', 4);
    } else if (s === 5) {
      this.setCheckpoint(V(66, 0), -Math.PI / 2);
      this.say('指挥部·灯塔', '灯塔呼叫布雷克，侦测到大批敌方增援正向你们位置靠近，撤离机预计九十秒后抵达。', 6);
      this.say('布雷克上尉', '收到。所有人，坚守大院！弹药箱在庭院西南角，按 F 补给。', 5);
      this.defendT = 90; this.wave = 0;
      this.blake.leadTarget = V(56, 3); this.raven.leadTarget = V(58, -5);
    } else if (s === 6) {
      hud.objective('当前目标', '前往东侧撤离点');
      this.say('飞行员', '撤离机抵达，正在降落，东门已为你们打开！', 4);
      this.say('布雷克上尉', '直升机到了！所有人上机，快走！', 3.5);
      this.openGate();
      this.spawnExfil();
      this.blake.leadTarget = V(92, -3); this.raven.leadTarget = V(92, 3);
    }
  }
  openGate() {
    const w = this.game.world;
    w.boxes = w.boxes.filter(b => b !== this.gateBox);
    this.anims.push({ t: 0, f: (a, dt) => { a.t += dt; this.gate.position.z = Math.min(5, a.t * 2.5); return a.t > 2; } });
    // 更新导航
    w.buildGrid();
    this.game.audio.click(300, 1, 0.4, this.gate.position);
  }
  spawnExfil() {
    const game = this.game, w = game.world;
    const h = this.exfil = buildHeli(0x2e3a2e);
    w.root.add(h);
    const from = V(170, 0, 50), to = V(94, 0, 1.45);
    game.audio.loop('exHeli', 'rotor', 0.1);
    this.landed = false;
    this.anims.push({ t: 0, f: (a, dt) => {
      a.t += dt;
      const k = Math.min(1, a.t / 12), e = 1 - Math.pow(1 - k, 3);
      h.position.lerpVectors(from, to, e);
      h.position.y = 1.45 + (1 - e) * 40 + (k < 1 ? 0 : 0);
      h.rotation.y = -Math.PI / 2 + (1 - e) * 0.6;
      h.rotation.x = (1 - e) * 0.15;
      h.userData.rotor.rotation.y += dt * 30; h.userData.tail.rotation.x += dt * 40;
      const d = h.position.distanceTo(game.camera.position);
      game.audio.setLoopVol('exHeli', Math.max(0.03, 0.6 - d / 200));
      if (k >= 1 && !this.landed) { this.landed = true; game.effects.smoke.emit({ x: to.x, y: 0.3, z: to.z, vx: 0, vy: 0.2, vz: 0, life: 3, s0: 3, s1: 9, c0: [0.3, 0.3, 0.3], a0: 0.3 }); }
      return false;
    } });
  }
  spawnTruck(from, to, dismount, assault) {
    const game = this.game, w = game.world;
    const yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z));
    const truck = w.truck(from.x, from.z, yaw, 0xa89c80);
    game.audio.loop('truck' + from.x, 'wind', 0.25);
    this.anims.push({ t: 0, f: (a, dt) => {
      a.t += dt;
      const dur = 7; const k = Math.min(1, a.t / dur), e = 1 - Math.pow(1 - k, 2);
      truck.position.lerpVectors(from, to, e);
      if (k >= 1 && !a.done) {
        a.done = true;
        game.audio.stopLoop('truck' + from.x);
        for (let i = 0; i < dismount; i++) {
          const off = V(rand(-2, 2), rand(-2, 2));
          this.spawnAttacker(to.clone().add(off).add(V(Math.cos(yaw) * 2.2, Math.sin(yaw) * 2.2)), assault);
        }
      }
      return a.done;
    } });
  }
  spawnAttacker(pos, target) {
    const game = this.game;
    const b = game.addBot(new Bot(game, { team: 'B', name: pick(['叛军', '增援部队', '武装分子']), style: Math.random() < 0.3 ? 'enemy' : 'insurgent', weaponId: pick(['ak', 'ak', 'ak', 'pkm', 'm870', 'sks', 'mp5']), difficulty: this.diff, pos, yaw: 0, role: 'assault', assaultTarget: target.clone().add(V(rand(-3, 3), rand(-3, 3))), alerted: true, group: 'defense', grenades: this.diff > 0 ? 1 : 0 }));
    (this.groups.defense = this.groups.defense || []).push(b);
    b.hint(game.player.pos);
    return b;
  }

  update(dt, inp) {
    const game = this.game, pl = game.player, hud = game.hud;
    this.stepT += dt;
    this.anims = this.anims.filter(a => !a.f(a, dt));
    if (pl.stats.shots > (this.lastShots || 0)) { this.lastShots = pl.stats.shots; this.lastShotT = game.time; if (!pl.ws.w.stats.suppressed) this.weaponsFree = true; }
    if (game.time - (this.lastShotT || -99) < 4) this.weaponsFree = true;
    this.interactPrompt = false;
    const markers = [];
    const s = this.step;
    if (s === 0) {
      markers.push({ id: 'o', pos: V(-47, 0, 2.5), label: '▼', text: '前哨站' });
      if (pl.pos.x > -71 || this.alerted.outpost || this.alive('outpost') < 6) this.nextStep();
    } else if (s === 1) {
      const n = this.alive('outpost');
      hud.objective('当前目标', '清除敌方前哨站', `剩余敌人：${n}`);
      if (n === 0) this.nextStep();
    } else if (s === 2) {
      markers.push({ id: 'g', pos: V(44, 0, 2.5), label: '▼', text: '目标大院' });
      const n = this.alive('village');
      hud.objective('当前目标', '穿过村庄，前往目标大院', n ? `村庄守军：${n}` : '');
      if (pl.pos.x > 36) this.nextStep();
    } else if (s === 3) {
      if (this.hvt.alive) markers.push({ id: 'h', pos: this.hvt.pos.clone().setY(2.3), label: '✖', text: '铁蝎', cls: 'enemy' });
      hud.objective('当前目标', '突入大院，击毙高价值目标「铁蝎」', `院内敌人：${this.alive('compound')}`);
      if (pl.pos.x > 44.5 && !this.alerted.compound && Math.random() < dt * 0.5) this.alertGroup('compound', pl.pos);
      if (!this.hvt.alive) this.nextStep();
    } else if (s === 4) {
      const lp = game.world.laptopPos;
      markers.push({ id: 'l', pos: lp.clone().setY(1.3), label: '⬇', text: '情报' });
      const d = Math.hypot(pl.pos.x - lp.x, pl.pos.z - lp.z);
      if (d < 2 && pl.alive) {
        this.interactPrompt = true;
        hud.prompt('按住 <b>F</b> 下载情报');
        if (inp.interact) { this.dl = (this.dl || 0) + dt / 3.5; hud.progress(this.dl); if (Math.random() < dt * 8) game.audio.click(3000 + Math.random() * 1000, 0.02, 0.1); }
        else if (this.dl) hud.progress(this.dl);
        if (this.dl >= 1) { hud.progress(null); hud.prompt(null); hud.popup('情报已获取', '', true); game.audio.beep(3); this.nextStep(); }
      } else { hud.progress(null); }
    } else if (s === 5) {
      this.defendT -= dt;
      hud.objective('当前目标', '坚守大院直到撤离机抵达', `撤离机抵达：${fmtTime(this.defendT)}　敌人：${this.alive('defense')}`);
      const el = 90 - this.defendT;
      if (this.wave === 0 && el > 3) { this.wave = 1; this.spawnTruck(V(0, 0), V(36, 0), 5, V(52, 0)); this.say('渡鸦', '西边有车队！一辆皮卡正在靠近！', 3); }
      if (this.wave === 1 && el > 30) { this.wave = 2; for (let i = 0; i < 4; i++) this.spawnAttacker(V(50 + rand(-3, 3), -34 - i * 2), V(52, -10)); for (let i = 0; i < 3; i++) this.spawnAttacker(V(50 + rand(-3, 3), 34 + i * 2), V(52, 10)); this.say('布雷克上尉', '南北两侧的缺口都有敌人！守住庭院！', 3.5); }
      if (this.wave === 2 && el > 58) { this.wave = 3; this.spawnTruck(V(62, -80), V(56, -32), 5, V(58, -4)); for (let i = 0; i < 3; i++) this.spawnAttacker(V(30 + i * 2, rand(-3, 3)), V(56, 0)); this.say('渡鸦', '又一辆车从北边过来了！', 3); }
      if (this.wave === 3 && el > 75) { this.wave = 4; this.say('指挥部·灯塔', '撤离机还有十五秒！坚持住！', 3); }
      // 弹药箱
      const ac = game.world.ammoCrate;
      const d = Math.hypot(pl.pos.x - ac.x, pl.pos.z - ac.z);
      markers.push({ id: 'a', pos: ac.clone().setY(1.2), label: '✚', text: '弹药', hideDist: d > 30 });
      if (this.defendT <= 0) this.nextStep();
    } else if (s === 6) {
      markers.push({ id: 'x', pos: game.world.lzPos.clone().setY(3), label: '⬆', text: '撤离' });
      const lz = game.world.lzPos;
      if (this.landed && Math.hypot(pl.pos.x - lz.x, pl.pos.z - lz.z) < 5 && pl.alive) this.complete();
      else if (!this.landed) hud.objective('当前目标', '前往东侧撤离点', '撤离机正在降落…');
    }
    // 弹药箱交互（任何阶段）
    const ac = game.world.ammoCrate;
    if (pl.alive && Math.hypot(pl.pos.x - ac.x, pl.pos.z - ac.z) < 1.8 && s !== 4) {
      this.interactPrompt = true;
      hud.prompt('<b>F</b> 补充弹药与装备');
      if (inp.interactPressed) { pl.ws.fullAmmo(); pl.ws.slots.forEach(sl => sl.reserve = sl.stats.reserve * 2); if (pl.lethal) pl.lethal.count = pl.lethal.max; if (pl.tactical) pl.tactical.count = pl.tactical.max; game.audio.reload('in'); hud.popup('已补给', '#9cf'); }
    }
    if (!this.interactPrompt && !game.nearPickup) hud.prompt(null);
    if (s === 1 && this.blake.leadTarget && (this.weaponsFree || pl.pos.x > -50)) { this.blake.leadTarget = null; this.raven.leadTarget = null; }
    hud.setMarkers(markers);
    // 盟友传送（掉队太远）
    for (const a of [this.blake, this.raven]) {
      if (a.pos.distanceTo(pl.pos) > 45 && s < 6) { const p = game.world.randomWalkable(pl.pos.x, pl.pos.z, 4); a.pos.copy(p); a.path = null; }
    }
    // 死亡处理
    if (game.dead) {
      this.deadT -= dt;
      document.getElementById('respawnText').textContent = this.deadT > 0 ? '正在读取检查点…' : '按 [空格] 从检查点重新开始';
      if (this.deadT <= 0 && game.input.keys.Space) this.respawn();
    }
  }
  respawn() {
    const game = this.game, pl = game.player;
    pl.respawn(this.checkpoint.pos, this.checkpoint.yaw);
    game.dead = false;
    document.getElementById('deathScreen').classList.add('hidden');
    // 清除检查点附近的敌人威胁
    for (const b of game.bots) if (b.team === 'B' && b.alive && b.pos.distanceTo(pl.pos) < 12 && b.role === 'assault') b.pos.add(V(rand(-1, 1) * 20, rand(-1, 1) * 5));
    game.lock();
  }
  onKill(killer, victim, weapon, head, info) {
    const game = this.game, pl = game.player;
    if (victim.isPlayer) {
      game.dead = true; game.deathKiller = killer;
      this.deaths = (this.deaths || 0) + 1;
      this.deadT = 2;
      document.getElementById('deathScreen').classList.remove('hidden');
      document.getElementById('killerInfo').innerHTML = killer && killer !== victim ? `被 <b>${killer.name}</b> 使用 ${weapon || ''} 击杀` : '你阵亡了';
      document.querySelector('#deathScreen .death-btns').style.display = 'none';
      if (document.pointerLockElement) document.exitPointerLock();
      return;
    }
    if (killer && killer.isPlayer) {
      pl.stats.kills++; this.kills++;
      if (head) { pl.stats.headshots++; game.hud.popup('爆头', '', true); }
      else game.hud.popup('击杀', '#fff');
      if (victim.isHVT) game.hud.popup('高价值目标已击毙', '', true);
    }
    if (victim.team === 'B' && Math.random() < 0.7) game.spawnPickup(victim.weaponId, victim.att, victim.pos, Math.ceil(victim.stats.mag * 0.6), victim.stats.mag);
    game.hud.killfeed(killer, victim, weapon, head);
    if (victim.group && !this.alerted[victim.group]) {
      // 附近同伴察觉尸体
      for (const b of this.groups[victim.group]) if (b.alive && b.pos.distanceTo(victim.pos) < 9 && !game.world.lineBlocked(b.eyePos(V(0, 0)), victim.chestPos(V(0, 0)))) { this.alertGroup(victim.group, victim.pos); break; }
    }
  }
  complete() {
    if (this.done) return;
    this.done = true;
    const game = this.game, pl = game.player;
    game.ending = true;
    game.hud.fade(1, 2);
    game.hud.announce('任务完成', '', 3);
    this.say('布雷克上尉', '所有人都上来了。灯塔，我们撤离了。干得漂亮。', 4);
    const t = game.time;
    const best = game.profile.campaignBest;
    if (!best || t < best) { game.profile.campaignBest = t; }
    game.profile.xp += 1500 + pl.stats.kills * 50; game.saveProfile();
    setTimeout(() => {
      if (document.pointerLockElement) document.exitPointerLock();
      game.menu.showResults({
        win: 'win', title: '任务完成', sub: '行动代号：午夜清道夫',
        stats: [['用时', fmtTime(t)], ['击杀', pl.stats.kills], ['爆头', pl.stats.headshots], ['命中率', Math.round(pl.stats.hits / Math.max(1, pl.stats.shots) * 100) + '%'], ['阵亡', this.deaths || 0], ['难度', ['新兵', '正规军', '老兵'][this.diff]]],
        board: '', again: () => game.startGame('campaign', this.cfg),
      });
    }, 3500);
  }
  scoreboardHTML() {
    const pl = this.game.player;
    const rows = [['行动', '午夜清道夫'], ['难度', ['新兵', '正规军', '老兵'][this.diff]], ['用时', fmtTime(this.game.time)], ['击杀', pl.stats.kills], ['爆头', pl.stats.headshots], ['阵亡', this.deaths || 0]];
    return `<table class="sbt A"><tr><th>任务简报</th><th></th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
  }
  minimapMarkers() {
    const w = this.game.world, s = this.step;
    const p = s <= 1 ? { x: -45, z: 0 } : s === 2 ? { x: 44, z: 0 } : s === 3 && this.hvt.alive ? this.hvt.pos : s === 4 ? w.laptopPos : s === 6 ? w.lzPos : null;
    return p ? [{ x: p.x, z: p.z, color: '#ffb400' }] : [];
  }
  dispose() {
    this.game.hud.progress(null);
    document.querySelector('#deathScreen .death-btns').style.display = '';
    this.game.botDmgMul = 1;
  }
}
