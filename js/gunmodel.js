// 程序化枪械模型（含配件可视化）
import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { mat, camoMaterial } from './materials.js';

const geoCache = new Map();
function bgeo(w, h, d) {
  const k = `b${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
function cgeo(r1, r2, len, seg = 14) {
  const k = `c${r1},${r2},${len},${seg}`;
  if (!geoCache.has(k)) { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2); geoCache.set(k, g); }
  return geoCache.get(k);
}

export function buildGun(weaponId, att = {}, camo = 'none', opts = {}) {
  const def = WEAPONS[weaponId];
  const M = def.model;
  const root = new THREE.Group();
  const info = { group: root, muzzle: new THREE.Object3D(), sight: new THREE.Vector3(), mag: null, leftHand: new THREE.Vector3(0, 0, -0.2), eject: new THREE.Vector3(0.03, 0.05, -0.05), optic: 'iron', reticle: null };
  const low = !!opts.low;

  const furnBase = M.color === 'wood' ? mat('gunWood') : M.color === 'tan' ? mat('gunTan') : M.color === 'green' ? mat('gunGreen') : M.color === 'steel' ? mat('gunSteel') : mat('gunPoly');
  const metal = M.color === 'steel' ? mat('gunSteel') : mat('gunMetal');
  const furn = camoMaterial(camo, furnBase);
  const body = camo !== 'none' ? camoMaterial(camo, metal) : metal;
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = !opts.noShadow; mesh.receiveShadow = false;
    parent.add(mesh); return mesh;
  };

  if (M.rpg) {
    add(cgeo(0.042, 0.042, 0.95), furn, 0, 0.06, -0.15);
    add(cgeo(0.05, 0.05, 0.25), mat('gunWood'), 0, 0.06, -0.05);
    add(cgeo(0.06, 0.03, 0.14), metal, 0, 0.06, 0.37);
    const wh = new THREE.Group(); wh.position.set(0, 0.06, -0.62); root.add(wh);
    add(cgeo(0.04, 0.045, 0.12), mat('gunGreen'), 0, 0, 0, 0, 0, 0, wh);
    add(new THREE.ConeGeometry(0.07, 0.25, 14).rotateX(-Math.PI / 2), mat('gunGreen'), 0, 0, -0.18, 0, 0, 0, wh);
    add(cgeo(0.07, 0.07, 0.12), mat('gunGreen'), 0, 0, -0.03, 0, 0, 0, wh);
    add(bgeo(0.03, 0.1, 0.04), mat('gunPoly'), 0, -0.03, 0.02, 0.2);
    add(bgeo(0.03, 0.1, 0.04), mat('gunPoly'), 0, -0.03, -0.2, 0.1);
    add(bgeo(0.02, 0.05, 0.02), metal, 0, 0.12, -0.1);
    add(bgeo(0.02, 0.04, 0.02), metal, 0, 0.12, 0.08);
    info.mag = wh;
    info.muzzle.position.set(0, 0.06, -0.8);
    info.sight.set(0, 0.14, 0.14);
    info.leftHand.set(0, -0.02, -0.2);
    root.add(info.muzzle);
    return info;
  }

  if (M.pistol) {
    if (M.revolver) {
      add(bgeo(0.028, 0.035, 0.16), body, 0, 0.055, -0.1);
      add(cgeo(0.011, 0.011, 0.2), body, 0, 0.06, -0.14);
      add(cgeo(0.028, 0.028, 0.05, 12), metal, 0, 0.05, -0.02);
      add(bgeo(0.03, 0.1, 0.045), mat('gunWood'), 0, -0.02, 0.04, 0.3);
      add(bgeo(0.004, 0.012, 0.01), metal, 0, 0.078, -0.23);
      info.muzzle.position.set(0, 0.06, -0.25);
      info.sight.set(0, 0.083, 0.02);
      info.mag = add(bgeo(0.001, 0.001, 0.001), metal, 0, 0.05, -0.02);
    } else {
      add(bgeo(0.03, 0.032, 0.2), body, 0, 0.05, -0.07);
      add(bgeo(0.028, 0.025, 0.16), metal, 0, 0.022, -0.06);
      add(bgeo(0.03, 0.1, 0.045), furn, 0, -0.03, 0.03, 0.25);
      add(bgeo(0.005, 0.03, 0.04), metal, 0, 0.0, -0.035);
      add(bgeo(0.004, 0.01, 0.008), metal, 0, 0.071, -0.16);
      add(bgeo(0.02, 0.01, 0.01), metal, 0, 0.071, 0.02);
      info.mag = add(bgeo(0.024, 0.09, 0.035), metal, 0, -0.03, 0.03, 0.25);
      info.muzzle.position.set(0, 0.05, -0.18);
      info.sight.set(0, 0.076, 0.03);
      if (att.mag) info.mag.scale.y = 1.6;
    }
    if (att.muzzle === 'suppressor') { add(cgeo(0.018, 0.018, 0.14), mat('gunPoly'), 0, 0.05, -0.25); info.muzzle.position.z -= 0.14; }
    else if (att.muzzle) { add(cgeo(0.014, 0.014, 0.04), metal, 0, 0.05, -0.2); info.muzzle.position.z -= 0.04; }
    if (att.laser) { add(bgeo(0.025, 0.022, 0.05), mat('gunPoly'), 0, 0.005, -0.12); addLaser(add, 0, 0.005, -0.146); }
    if (att.optic === 'reddot') {
      add(bgeo(0.03, 0.006, 0.04), metal, 0, 0.07, -0.02);
      add(bgeo(0.004, 0.035, 0.012), metal, -0.016, 0.09, -0.035);
      add(bgeo(0.004, 0.035, 0.012), metal, 0.016, 0.09, -0.035);
      add(bgeo(0.036, 0.004, 0.012), metal, 0, 0.108, -0.035);
      add(new THREE.PlaneGeometry(0.028, 0.03), mat('lens'), 0, 0.09, -0.035);
      info.reticle = add(new THREE.CircleGeometry(0.0012, 10), mat('reticle'), 0, 0.09, -0.036);
      info.sight.set(0, 0.09, 0.04);
      info.optic = 'reddot';
    }
    info.leftHand.set(-0.01, -0.03, 0.02);
    root.add(info.muzzle);
    return info;
  }

  // ---------- 长枪 ----------
  const recv = M.recv, hand = M.hand;
  let barrel = M.barrel;
  if (att.barrel === 'long') barrel += 0.1;
  if (att.barrel === 'short') barrel -= 0.08;
  const zRear = 0.07, zFront = zRear - recv;
  const recvH = M.stock === 'scar' ? 0.075 : 0.065;
  // 机匣
  add(bgeo(0.052, recvH, recv), body, 0, 0.03, (zRear + zFront) / 2);
  add(bgeo(0.046, 0.04, recv * 0.8), metal, 0, -0.012, (zRear + zFront) / 2 + 0.02);
  const railY = 0.03 + recvH / 2;
  add(bgeo(0.024, 0.012, recv), metal, 0, railY + 0.006, (zRear + zFront) / 2);
  if (!low) {
    for (let i = 0; i < Math.floor(recv / 0.02); i++) add(bgeo(0.026, 0.004, 0.008), metal, 0, railY + 0.014, zRear - 0.01 - i * 0.02);
    add(bgeo(0.005, 0.025, 0.06), mat('gunSteel'), 0.027, 0.035, -0.03); // 抛壳窗
    add(bgeo(0.02, 0.01, 0.03), metal, 0.03, 0.045, zRear - 0.04); // 拉机柄
  }
  // 护木
  const hz0 = zFront, hz1 = zFront - hand;
  const handH = M.color === 'wood' ? 0.05 : 0.06;
  add(bgeo(0.056, handH, hand), furn, 0, 0.03, (hz0 + hz1) / 2);
  if (!low && M.color !== 'wood') {
    for (let i = 0; i < 4; i++) add(bgeo(0.058, 0.006, 0.03), metal, 0, 0.03 + (i % 2 ? -0.012 : 0.012), hz0 - 0.03 - i * (hand / 4.5));
  }
  if (M.color !== 'wood') add(bgeo(0.022, 0.01, hand), metal, 0, 0.03 + handH / 2 + 0.005, (hz0 + hz1) / 2);
  info.leftHand.set(0, -0.005, hz0 - hand * 0.55);
  // 枪管
  const bz0 = hz1, bz1 = hz1 - barrel;
  add(cgeo(0.0095, 0.0095, barrel + 0.05), mat('gunMetal'), 0, 0.035, (bz0 + bz1) / 2 + 0.025);
  let muzzleZ = bz1;
  if (M.mag === 'tube') add(cgeo(0.015, 0.015, hand + barrel * 0.7), metal, 0, 0.005, hz0 - (hand + barrel * 0.7) / 2);
  if (M.stock === 'ak' && M.color === 'wood') add(cgeo(0.012, 0.012, hand * 0.9), metal, 0, 0.07, (hz0 + hz1) / 2); // 导气管
  // 枪口
  const mz = att.muzzle;
  if (mz === 'suppressor') { add(cgeo(0.022, 0.022, 0.19, 16), mat('gunPoly'), 0, 0.035, muzzleZ - 0.095); muzzleZ -= 0.19; }
  else if (mz === 'comp') { add(bgeo(0.03, 0.03, 0.06), metal, 0, 0.035, muzzleZ - 0.03); muzzleZ -= 0.06; }
  else if (mz === 'brake') { add(cgeo(0.017, 0.017, 0.06), metal, 0, 0.035, muzzleZ - 0.03); add(bgeo(0.04, 0.008, 0.02), metal, 0, 0.035, muzzleZ - 0.03); muzzleZ -= 0.06; }
  else if (mz === 'flash') { add(cgeo(0.014, 0.018, 0.07), metal, 0, 0.035, muzzleZ - 0.035); muzzleZ -= 0.07; }
  else { add(cgeo(0.013, 0.013, 0.04), metal, 0, 0.035, muzzleZ - 0.02); muzzleZ -= 0.04; }
  info.muzzle.position.set(0, 0.035, muzzleZ);
  // 机械瞄具
  const optic = att.optic || (def.defaultOptic && !att.optic ? def.defaultOptic : null);
  const sightY = railY + 0.035;
  if (!optic) {
    add(bgeo(0.004, 0.035, 0.006), metal, 0, railY + 0.02, hz1 + 0.02);
    add(bgeo(0.02, 0.012, 0.012), metal, 0, railY + 0.006, hz1 + 0.02);
    add(bgeo(0.022, 0.022, 0.016), metal, 0, railY + 0.02, zRear - 0.02);
    info.sight.set(0, railY + 0.034, zRear + 0.13);
  }
  // 瞄具
  info.optic = optic || 'iron';
  const oz = zRear - recv * 0.45;
  if (optic === 'reddot') {
    add(bgeo(0.03, 0.012, 0.04), metal, 0, railY + 0.018, oz);
    add(cgeo(0.02, 0.02, 0.04, 16), metal, 0, sightY, oz);
    add(new THREE.CircleGeometry(0.017, 16), mat('lens'), 0, sightY, oz - 0.021);
    info.reticle = add(new THREE.CircleGeometry(0.0009, 10), mat('reticle'), 0, sightY, oz - 0.022);
    info.sight.set(0, sightY, oz + 0.1);
  } else if (optic === 'holo') {
    add(bgeo(0.04, 0.016, 0.07), metal, 0, railY + 0.02, oz);
    add(bgeo(0.005, 0.04, 0.05), metal, -0.021, sightY + 0.005, oz - 0.01);
    add(bgeo(0.005, 0.04, 0.05), metal, 0.021, sightY + 0.005, oz - 0.01);
    add(bgeo(0.047, 0.005, 0.05), metal, 0, sightY + 0.026, oz - 0.01);
    add(new THREE.PlaneGeometry(0.036, 0.034), mat('lens'), 0, sightY + 0.004, oz - 0.03);
    const ret = new THREE.Group(); ret.position.set(0, sightY, oz - 0.031); root.add(ret);
    add(new THREE.RingGeometry(0.0045, 0.0052, 24), mat('reticle'), 0, 0, 0, 0, 0, 0, ret);
    add(new THREE.CircleGeometry(0.0007, 8), mat('reticle'), 0, 0, 0, 0, 0, 0, ret);
    info.reticle = ret;
    info.sight.set(0, sightY, oz + 0.12);
  } else if (optic === 'acog' || optic === 'thermal') {
    add(bgeo(0.03, 0.02, 0.05), metal, 0, railY + 0.02, oz);
    add(cgeo(0.019, 0.019, 0.12, 16), metal, 0, sightY + 0.005, oz);
    add(cgeo(0.024, 0.019, 0.03, 16), metal, 0, sightY + 0.005, oz - 0.07);
    add(cgeo(0.022, 0.019, 0.025, 16), metal, 0, sightY + 0.005, oz + 0.065);
    if (optic === 'thermal') add(bgeo(0.03, 0.03, 0.05), mat('gunPoly'), 0.025, sightY + 0.005, oz + 0.02);
    add(new THREE.CircleGeometry(0.02, 16), mat('lensDark'), 0, sightY + 0.005, oz - 0.086);
    info.sight.set(0, sightY + 0.005, oz + 0.14);
  } else if (optic === 'sniper') {
    const sy = sightY + 0.018;
    add(bgeo(0.02, 0.03, 0.02), metal, 0, railY + 0.02, oz - 0.06);
    add(bgeo(0.02, 0.03, 0.02), metal, 0, railY + 0.02, oz + 0.06);
    add(cgeo(0.016, 0.016, 0.26, 16), metal, 0, sy, oz);
    add(cgeo(0.028, 0.017, 0.08, 16), metal, 0, sy, oz - 0.15);
    add(cgeo(0.022, 0.016, 0.05, 16), metal, 0, sy, oz + 0.14);
    add(cgeo(0.02, 0.02, 0.03, 12), metal, 0, sy + 0.025, oz, Math.PI / 2);
    add(new THREE.CircleGeometry(0.027, 16), mat('lensDark'), 0, sy, oz - 0.191);
    info.sight.set(0, sy, oz + 0.2);
  }
  // 激光
  if (att.laser) {
    add(bgeo(0.022, 0.025, 0.06), mat('gunPoly'), 0.038, 0.03, hz1 + 0.05);
    addLaser(add, 0.038, 0.03, hz1 + 0.019);
  }
  // 下挂
  if (att.under === 'vgrip') add(bgeo(0.03, 0.09, 0.03), mat('gunPoly'), 0, -0.035, hz0 - hand * 0.55);
  else if (att.under === 'agrip') add(bgeo(0.03, 0.035, 0.08), mat('gunPoly'), 0, -0.01, hz0 - hand * 0.5, -0.4);
  else if (att.under === 'bipod') {
    add(bgeo(0.035, 0.02, 0.03), metal, 0, -0.005, hz1 + 0.03);
    add(cgeo(0.006, 0.006, 0.16), metal, -0.012, -0.015, hz1 + 0.1, -0.12);
    add(cgeo(0.006, 0.006, 0.16), metal, 0.012, -0.015, hz1 + 0.1, -0.12);
  }
  if (att.under) info.leftHand.set(0, -0.06, hz0 - hand * 0.55);
  // 握把
  const gripM = att.rear === 'rubber' ? mat('rubber') : furnBase === mat('gunWood') ? mat('gunPoly') : furnBase;
  if (M.grip === 'sniper') add(bgeo(0.03, 0.09, 0.045), gripM, 0, -0.035, 0.07, 0.35);
  else add(bgeo(0.028, 0.095, 0.04), gripM, 0, -0.04, 0.035, 0.3);
  add(bgeo(0.006, 0.006, 0.07), metal, 0, -0.032, -0.005); // 扳机护圈
  // 弹匣
  const magG = new THREE.Group(); magG.position.set(0, -0.01, -0.035); root.add(magG);
  info.mag = magG;
  const ext = att.mag === 'ext' ? 1.45 : 1;
  const mm = mat('gunMetal');
  if (att.mag === 'drum') {
    add(cgeo(0.075, 0.075, 0.07, 20), mm, 0, -0.1, 0, 0, Math.PI / 2, 0, magG);
    add(bgeo(0.028, 0.06, 0.05), mm, 0, -0.03, 0, 0, 0, 0, magG);
  } else if (M.mag === 'straight' || M.mag === 'pistol_long') {
    const L = (M.mag === 'pistol_long' ? 0.15 : 0.17) * ext;
    add(bgeo(0.026, L, 0.065), M.color === 'tan' && M.mag === 'straight' ? mat('gunTan') : mm, 0, -L / 2, 0, 0.12, 0, 0, magG);
    if (att.mag === 'fast') add(bgeo(0.026, L, 0.065), mm, 0.03, -L / 2, 0, 0.12, 0, 0, magG);
  } else if (M.mag === 'curved' || M.mag === 'curved_small') {
    const n = Math.round((M.mag === 'curved_small' ? 4 : 5) * ext);
    const seg = 0.04;
    const magM = weaponId === 'ak' ? mat('containerOrange') : mm;
    for (let i = 0; i < n; i++) {
      const a = i * 0.1 + 0.1;
      add(bgeo(0.026, seg + 0.004, 0.06 - (M.mag === 'curved_small' ? 0.02 : 0)), magM === mm ? mm : mat('gunMetal'), 0, -i * seg * 0.98 - seg / 2, -i * i * 0.004 - i * 0.008, a, 0, 0, magG);
    }
    if (att.mag === 'fast') for (let i = 0; i < n; i++) add(bgeo(0.026, seg + 0.004, 0.06), mm, 0.03, -i * seg * 0.98 - seg / 2, -i * i * 0.004 - i * 0.008, i * 0.1 + 0.1, 0, 0, magG);
  } else if (M.mag === 'box') {
    add(bgeo(0.1, 0.11, 0.12), mat('gunGreen'), -0.03, -0.07, 0, 0, 0, 0, magG);
    add(bgeo(0.03, 0.02, 0.1), mm, 0.02, 0.03, 0, 0, 0, 0, magG);
  } else if (M.mag === 'box5' || M.mag === 'box10') {
    const L = (M.mag === 'box10' ? 0.07 : 0.06) * ext;
    add(bgeo(0.03, L, 0.08), mm, 0, -L / 2, 0, 0, 0, 0, magG);
    if (att.mag === 'fast') add(bgeo(0.03, L, 0.08), mm, 0.035, -L / 2, 0, 0, 0, 0, magG);
  } else if (M.mag === 'tube') {
    magG.position.set(0, -0.02, -0.03);
    add(bgeo(0.02, 0.012, 0.03), mat('brass'), 0, 0, 0, 0, 0, 0, magG);
  }
  // 枪托
  const st = att.stock || null;
  const sz = zRear;
  if (st === 'none') {
    add(bgeo(0.03, 0.04, 0.03), metal, 0, 0.03, sz + 0.015);
  } else {
    const kind = st === 'heavy' ? 'heavy' : st === 'tac' ? 'tac' : M.stock;
    const sm = furn;
    if (kind === 'm4' || kind === 'tac') {
      add(cgeo(0.016, 0.016, 0.2), metal, 0, 0.03, sz + 0.1);
      add(bgeo(0.045, 0.09, 0.14), sm, 0, 0.005, sz + 0.2);
      add(bgeo(0.047, 0.1, 0.02), mat('rubber'), 0, 0.0, sz + 0.28);
      if (kind === 'tac') add(bgeo(0.03, 0.03, 0.1), sm, 0, 0.06, sz + 0.2);
    } else if (kind === 'ak' || kind === 'fixed') {
      const g = new THREE.Group(); g.position.set(0, 0.015, sz); g.rotation.x = kind === 'ak' ? -0.12 : -0.06; root.add(g);
      add(bgeo(0.042, 0.06, 0.2), sm, 0, 0, 0.1, 0, 0, 0, g);
      add(bgeo(0.044, 0.11, 0.12), sm, 0, -0.02, 0.24, 0, 0, 0, g);
      add(bgeo(0.046, 0.12, 0.015), mat('gunPoly'), 0, -0.02, 0.305, 0, 0, 0, g);
    } else if (kind === 'mp5') {
      add(bgeo(0.008, 0.008, 0.22), metal, -0.02, 0.04, sz + 0.11);
      add(bgeo(0.008, 0.008, 0.22), metal, 0.02, 0.04, sz + 0.11);
      add(bgeo(0.05, 0.08, 0.02), metal, 0, 0.02, sz + 0.22);
    } else if (kind === 'scar') {
      add(bgeo(0.045, 0.06, 0.12), sm, 0, 0.035, sz + 0.06);
      add(bgeo(0.045, 0.11, 0.1), sm, 0, 0.01, sz + 0.17);
      add(bgeo(0.048, 0.12, 0.02), mat('rubber'), 0, 0.01, sz + 0.23);
    } else if (kind === 'sniper' || kind === 'heavy') {
      add(bgeo(0.05, 0.07, 0.26), sm, 0, 0.01, sz + 0.13);
      add(bgeo(0.05, 0.13, 0.12), sm, 0, -0.01, sz + 0.24);
      add(bgeo(0.04, 0.025, 0.14), sm, 0, 0.06, sz + 0.16);
      add(bgeo(0.052, 0.14, 0.02), mat('rubber'), 0, -0.01, sz + 0.31);
    }
  }
  root.add(info.muzzle);
  return info;
}

function addLaser(add, x, y, z) {
  add(new THREE.CircleGeometry(0.004, 8), mat('laserDot'), x, y, z, 0, Math.PI, 0);
}

// 第一人称手臂
export function buildArms(gunInfo, sleeveMat) {
  const g = new THREE.Group();
  const glove = mat('glove');
  const limb = (a, b, r, m) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.add(mesh);
    return mesh;
  };
  // 右手（握把）
  const rh = new THREE.Vector3(0.0, -0.035, 0.05);
  const re = new THREE.Vector3(0.1, -0.16, 0.22);
  const rs = new THREE.Vector3(0.16, -0.3, 0.5);
  limb(rh, re, 0.032, glove);
  limb(re.clone().lerp(rh, 0.35), re, 0.042, sleeveMat);
  limb(re, rs, 0.055, sleeveMat);
  const rhand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.09), glove); rhand.position.copy(rh).add(new THREE.Vector3(0.012, 0, 0)); g.add(rhand);
  // 左手（护木）
  const lh = gunInfo.leftHand.clone().add(new THREE.Vector3(-0.012, -0.015, 0));
  const le = new THREE.Vector3(-0.14, -0.14, lh.z + 0.2);
  const ls = new THREE.Vector3(-0.22, -0.3, lh.z + 0.55);
  limb(lh, le, 0.032, glove);
  limb(le.clone().lerp(lh, 0.3), le, 0.042, sleeveMat);
  limb(le, ls, 0.055, sleeveMat);
  const lhand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), glove); lhand.position.copy(lh); lhand.rotation.z = 0.5; g.add(lhand);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}
