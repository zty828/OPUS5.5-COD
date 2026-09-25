// 材质库
import * as THREE from 'three';
import { genTexture, genCamo } from './textures.js';

const TEX = {};
const MATS = {};
const CAMO = {};

const TEX_KINDS = ['concrete', 'plaster', 'brick', 'sand', 'snow', 'asphalt', 'metal', 'wood', 'crate', 'dirt', 'grass', 'rock', 'sandbag', 'tiles'];

export async function initTextures(progress) {
  let i = 0;
  const kinds = [...TEX_KINDS, 'fab_ally', 'fab_enemy', 'fab_snowA', 'fab_snowB', 'fab_urbanB'];
  for (const k of kinds) {
    if (k === 'fab_ally') TEX[k] = genTexture('fabric', { size: 256, normal: 1, cfg: { colors: [[150, 130, 95], [110, 100, 70], [85, 90, 60], [175, 155, 115]] } });
    else if (k === 'fab_enemy') TEX[k] = genTexture('fabric', { size: 256, normal: 1, cfg: { colors: [[48, 50, 52], [32, 33, 35], [70, 68, 62], [58, 60, 64]] } });
    else if (k === 'fab_snowA') TEX[k] = genTexture('fabric', { size: 256, normal: 1, cfg: { colors: [[215, 220, 225], [150, 158, 165], [110, 118, 125], [235, 238, 240]] } });
    else if (k === 'fab_snowB') TEX[k] = genTexture('fabric', { size: 256, normal: 1, cfg: { colors: [[60, 64, 58], [40, 42, 38], [85, 80, 70], [52, 55, 50]] } });
    else if (k === 'fab_urbanB') TEX[k] = genTexture('fabric', { size: 256, normal: 1, cfg: { colors: [[70, 30, 30], [40, 22, 22], [90, 88, 85], [55, 28, 26]] } });
    else TEX[k] = genTexture(k, { rough: k === 'asphalt' || k === 'metal' || k === 'tiles', normal: k === 'metal' ? 4 : 3 });
    i++;
    progress && progress(i / kinds.length);
    await new Promise(r => setTimeout(r, 0));
  }
  for (const c of ['desert', 'woodland', 'digital', 'tiger', 'gold', 'dragon']) CAMO[c] = genCamo(c);
  buildMaterials();
}

function std(texKey, scale, params = {}) {
  const t = TEX[texKey];
  const m = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap || null,
    roughness: params.roughness ?? 1, metalness: params.metalness ?? 0, color: params.color ?? 0xffffff,
  });
  if (params.normalScale) m.normalScale.set(params.normalScale, params.normalScale);
  m.userData.texScale = scale;
  return m;
}

function buildMaterials() {
  MATS.concrete = std('concrete', 3);
  MATS.concreteDark = std('concrete', 3, { color: 0x8a8a90 });
  MATS.plaster = std('plaster', 4);
  MATS.plasterWhite = std('plaster', 4, { color: 0xf2eee6 });
  MATS.plasterBlue = std('plaster', 4, { color: 0xa8c0d0 });
  MATS.plasterRed = std('plaster', 4, { color: 0xd7a38a });
  MATS.brick = std('brick', 3);
  MATS.brickDark = std('brick', 3, { color: 0x8c7a78 });
  MATS.sand = std('sand', 6);
  MATS.snow = std('snow', 6, { color: 0xd4dae2 });
  MATS.asphalt = std('asphalt', 6, { roughness: 1 });
  MATS.asphaltWet = std('asphalt', 6, { roughness: 1, color: 0x9a9aa2 });
  MATS.sidewalk = std('tiles', 3, { color: 0xa9a8a4 });
  MATS.tiles = std('tiles', 2, { color: 0xd8cfc0 });
  const mk = (c) => std('metal', 2.5, { color: c, metalness: 0.55, roughness: 1 });
  MATS.metal = mk(0xb8bcc0);
  MATS.containerRed = mk(0xa8382c);
  MATS.containerBlue = mk(0x2f5f93);
  MATS.containerGreen = mk(0x3f6b3f);
  MATS.containerOrange = mk(0xc9772b);
  MATS.containerGray = mk(0x7a7f85);
  MATS.containerYellow = mk(0xc9a52b);
  MATS.metalRoof = std('metal', 3, { color: 0x8a8f94, metalness: 0.6 });
  MATS.wood = std('wood', 2);
  MATS.crate = std('crate', 1);
  MATS.dirt = std('dirt', 5);
  MATS.grass = std('grass', 6);
  MATS.rock = std('rock', 5);
  MATS.rockSnow = std('rock', 5, { color: 0xc8ccd4 });
  MATS.sandbag = std('sandbag', 1);
  MATS.tarp = new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 0.95, side: THREE.DoubleSide });
  MATS.clothRed = new THREE.MeshStandardMaterial({ color: 0x9a2b22, roughness: 0.95, side: THREE.DoubleSide });
  MATS.clothBlue = new THREE.MeshStandardMaterial({ color: 0x2a4e7a, roughness: 0.95, side: THREE.DoubleSide });
  MATS.clothYellow = new THREE.MeshStandardMaterial({ color: 0xc49a2e, roughness: 0.95, side: THREE.DoubleSide });
  MATS.clothGreen = new THREE.MeshStandardMaterial({ color: 0x3c6a3a, roughness: 0.95, side: THREE.DoubleSide });
  MATS.darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.5, metalness: 0.7 });
  MATS.steel = new THREE.MeshStandardMaterial({ color: 0x8e9398, roughness: 0.35, metalness: 0.9 });
  MATS.rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  MATS.glass = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.55 });
  MATS.windowLit = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: 1.2 });
  MATS.windowDark = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.1, metalness: 0.8 });
  MATS.lamp = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe0b0, emissiveIntensity: 6 });
  MATS.lampCold = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xcfe6ff, emissiveIntensity: 5 });
  MATS.fire = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7a20, emissiveIntensity: 8 });
  MATS.leaves = new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.9, side: THREE.DoubleSide });
  MATS.palm = new THREE.MeshStandardMaterial({ color: 0x5c7a2e, roughness: 0.85, side: THREE.DoubleSide });
  MATS.pine = new THREE.MeshStandardMaterial({ color: 0x24402e, roughness: 0.9 });
  MATS.pineSnow = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.8 });
  MATS.trunk = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  MATS.invisible = new THREE.MeshBasicMaterial({ visible: false });
  MATS.burnt = new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 0.9, metalness: 0.3 });
  MATS.yellowPaint = new THREE.MeshStandardMaterial({ color: 0xd8b21c, roughness: 0.6 });
  MATS.whitePaint = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.7 });
  MATS.redPaint = new THREE.MeshStandardMaterial({ color: 0xa02020, roughness: 0.6 });
  // 人物
  MATS.skin = new THREE.MeshStandardMaterial({ color: 0xc08a6a, roughness: 0.75 });
  MATS.skinDark = new THREE.MeshStandardMaterial({ color: 0x7a5238, roughness: 0.75 });
  MATS.glove = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.85 });
  MATS.boot = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.85 });
  for (const k of ['fab_ally', 'fab_enemy', 'fab_snowA', 'fab_snowB', 'fab_urbanB']) {
    MATS[k] = new THREE.MeshStandardMaterial({ map: TEX[k].map, normalMap: TEX[k].normalMap, roughness: 0.95 });
  }
  // 枪械
  MATS.gunMetal = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.42, metalness: 0.75 });
  MATS.gunPoly = new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.7, metalness: 0.1 });
  MATS.gunTan = new THREE.MeshStandardMaterial({ color: 0x9c8660, roughness: 0.7, metalness: 0.1 });
  MATS.gunGreen = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.7, metalness: 0.1 });
  MATS.gunWood = new THREE.MeshStandardMaterial({ map: TEX.wood.map, normalMap: TEX.wood.normalMap, color: 0xb06a3a, roughness: 0.55 });
  MATS.gunSteel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.25, metalness: 0.95 });
  MATS.lens = new THREE.MeshStandardMaterial({ color: 0x4a7a8a, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.25, depthWrite: false });
  MATS.lensDark = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.05, metalness: 1 });
  MATS.reticle = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, depthTest: true });
  MATS.reticle.color.multiplyScalar(4);
  MATS.laserDot = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  MATS.laserDot.color.multiplyScalar(6);
  MATS.brass = new THREE.MeshStandardMaterial({ color: 0xc9a040, roughness: 0.3, metalness: 1 });
}

export function mat(name) { const m = MATS[name]; if (!m) { (window.__matMiss = window.__matMiss || new Set()).add(name); return MATS.concrete; } return m; }
export function tex(name) { return TEX[name]; }

const camoCache = {};
export function camoMaterial(camo, base) {
  if (!camo || camo === 'none') return base;
  const key = camo;
  if (camoCache[key]) return camoCache[key];
  let m;
  if (camo === 'gold') m = new THREE.MeshStandardMaterial({ map: CAMO.gold.map, color: 0xffffff, roughness: 0.22, metalness: 1 });
  else m = new THREE.MeshStandardMaterial({ map: CAMO[camo].map, roughness: 0.6, metalness: 0.15 });
  camoCache[key] = m;
  return m;
}

export function camoSwatch(c) {
  if (!CAMO[c]) return null;
  try { return CAMO[c].map.image.toDataURL(); } catch (e) { return null; }
}
