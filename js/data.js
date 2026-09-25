// 游戏数据：武器、配件、Perk、连杀奖励、投掷物、地图列表

export const WEAPONS = {
  m4: {
    name: 'M4A1', cls: '突击步枪', type: 'ar', slot: 'primary',
    dmg: [28, 21], range: [28, 55], rpm: 800, mag: 30, reserve: 150, reload: 2.1, ads: 0.24,
    recoil: [0.9, 0.45], spread: 3.2, mobility: 0.95, fire: 'auto', headMul: 1.45, sprintFire: 0.22,
    sound: 'rifle', model: { recv: 0.28, barrel: 0.28, hand: 0.26, stock: 'm4', mag: 'straight', color: 'black', grip: 'ar' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'mag', 'rear'],
  },
  ak: {
    name: 'AK-47', cls: '突击步枪', type: 'ar', slot: 'primary',
    dmg: [36, 26], range: [30, 60], rpm: 600, mag: 30, reserve: 150, reload: 2.4, ads: 0.27,
    recoil: [1.35, 0.8], spread: 3.6, mobility: 0.93, fire: 'auto', headMul: 1.4, sprintFire: 0.25,
    sound: 'rifle_heavy', model: { recv: 0.3, barrel: 0.3, hand: 0.22, stock: 'ak', mag: 'curved', color: 'wood', grip: 'ak' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'mag', 'rear'],
  },
  scar: {
    name: 'SCAR-H', cls: '突击步枪', type: 'ar', slot: 'primary',
    dmg: [40, 30], range: [35, 70], rpm: 560, mag: 20, reserve: 120, reload: 2.3, ads: 0.29,
    recoil: [1.5, 0.55], spread: 3.6, mobility: 0.92, fire: 'auto', headMul: 1.4, sprintFire: 0.26,
    sound: 'rifle_heavy', model: { recv: 0.32, barrel: 0.26, hand: 0.28, stock: 'scar', mag: 'straight', color: 'tan', grip: 'ar' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'mag', 'rear'],
  },
  mp5: {
    name: 'MP5', cls: '冲锋枪', type: 'smg', slot: 'primary',
    dmg: [26, 16], range: [12, 30], rpm: 850, mag: 30, reserve: 180, reload: 1.9, ads: 0.18,
    recoil: [0.65, 0.5], spread: 2.4, mobility: 1.05, fire: 'auto', headMul: 1.3, sprintFire: 0.14,
    sound: 'smg', model: { recv: 0.22, barrel: 0.12, hand: 0.16, stock: 'mp5', mag: 'curved_small', color: 'black', grip: 'ar' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'mag', 'rear'],
  },
  vector: {
    name: 'VECTOR .45', cls: '冲锋枪', type: 'smg', slot: 'primary',
    dmg: [24, 14], range: [10, 25], rpm: 1100, mag: 25, reserve: 175, reload: 1.8, ads: 0.17,
    recoil: [0.55, 0.6], spread: 2.4, mobility: 1.06, fire: 'auto', headMul: 1.3, sprintFire: 0.13,
    sound: 'smg', model: { recv: 0.24, barrel: 0.1, hand: 0.14, stock: 'm4', mag: 'pistol_long', color: 'tan', grip: 'ar' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'mag', 'rear'],
  },
  pkm: {
    name: 'PKM', cls: '轻机枪', type: 'lmg', slot: 'primary',
    dmg: [36, 29], range: [40, 75], rpm: 650, mag: 100, reserve: 200, reload: 5.8, ads: 0.42,
    recoil: [1.1, 0.7], spread: 5.5, mobility: 0.84, fire: 'auto', headMul: 1.35, sprintFire: 0.38,
    sound: 'lmg', model: { recv: 0.34, barrel: 0.36, hand: 0.18, stock: 'ak', mag: 'box', color: 'wood', grip: 'ak' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'rear'],
  },
  m870: {
    name: 'M870 霰弹枪', cls: '霰弹枪', type: 'shotgun', slot: 'primary',
    dmg: [16, 6], range: [7, 16], rpm: 72, mag: 6, reserve: 30, reload: 0.55, ads: 0.25, pellets: 9,
    recoil: [3.8, 1.2], spread: 5, adsSpread: 4.2, mobility: 1.0, fire: 'pump', headMul: 1.2, sprintFire: 0.2, shellReload: true,
    sound: 'shotgun', model: { recv: 0.26, barrel: 0.32, hand: 0.18, stock: 'fixed', mag: 'tube', color: 'black', grip: 'ak' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'rear'],
  },
  sks: {
    name: 'SKS', cls: '射手步枪', type: 'marksman', slot: 'primary',
    dmg: [62, 50], range: [45, 90], rpm: 360, mag: 10, reserve: 60, reload: 2.6, ads: 0.3,
    recoil: [2.1, 0.6], spread: 5, mobility: 0.93, fire: 'semi', headMul: 1.9, sprintFire: 0.26,
    sound: 'rifle_heavy', model: { recv: 0.3, barrel: 0.36, hand: 0.26, stock: 'fixed', mag: 'box10', color: 'wood', grip: 'ak' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'mag', 'rear'],
  },
  l115: {
    name: 'L115A3', cls: '狙击步枪', type: 'sniper', slot: 'primary',
    dmg: [115, 105], range: [80, 150], rpm: 44, mag: 5, reserve: 30, reload: 3.2, ads: 0.48,
    recoil: [4.5, 0.8], spread: 9, mobility: 0.88, fire: 'bolt', headMul: 2.0, sprintFire: 0.35, defaultOptic: 'sniper',
    sound: 'sniper', model: { recv: 0.34, barrel: 0.5, hand: 0.26, stock: 'sniper', mag: 'box5', color: 'green', grip: 'sniper' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'mag', 'rear'],
  },
  m1911: {
    name: 'M1911', cls: '手枪', type: 'pistol', slot: 'secondary',
    dmg: [38, 22], range: [10, 25], rpm: 450, mag: 8, reserve: 48, reload: 1.5, ads: 0.14,
    recoil: [1.6, 0.4], spread: 2, mobility: 1.1, fire: 'semi', headMul: 1.5, sprintFire: 0.1,
    sound: 'pistol', model: { pistol: true, color: 'black' },
    slots: ['muzzle', 'laser', 'optic', 'mag'],
  },
  revolver: {
    name: '.357 左轮', cls: '手枪', type: 'pistol', slot: 'secondary',
    dmg: [62, 40], range: [14, 30], rpm: 190, mag: 6, reserve: 36, reload: 2.4, ads: 0.16,
    recoil: [3.4, 0.6], spread: 2.4, mobility: 1.08, fire: 'semi', headMul: 1.6, sprintFire: 0.12,
    sound: 'pistol_heavy', model: { pistol: true, revolver: true, color: 'steel' },
    slots: ['laser', 'optic'],
  },
  rpg: {
    name: 'RPG-7', cls: '发射器', type: 'launcher', slot: 'secondary',
    dmg: [150, 150], range: [0, 0], rpm: 30, mag: 1, reserve: 3, reload: 3.0, ads: 0.4,
    recoil: [5, 1], spread: 4, mobility: 0.9, fire: 'semi', headMul: 1, sprintFire: 0.4, projectile: 'rocket',
    sound: 'rocket', model: { rpg: true, color: 'green' },
    slots: [],
  },
};

export const PRIMARY_ORDER = ['m4', 'ak', 'scar', 'mp5', 'vector', 'pkm', 'm870', 'sks', 'l115'];
export const SECONDARY_ORDER = ['m1911', 'revolver', 'rpg'];

export const SLOT_NAMES = {
  muzzle: '枪口', barrel: '枪管', laser: '激光', optic: '瞄准镜', stock: '枪托', under: '下挂', mag: '弹匣', rear: '后握把',
};

// 配件效果：乘数 (>1 表示数值变大)
export const ATTACHMENTS = {
  muzzle: [
    { id: 'suppressor', name: '战术消音器', fx: { suppressed: true, range: 1.1, ads: 1.07 }, desc: '射击不会在敌方雷达上暴露' },
    { id: 'comp', name: '补偿器', fx: { recoilV: 0.85, recoilH: 1.05 } },
    { id: 'brake', name: '枪口制退器', fx: { recoilH: 0.8, recoilV: 0.95, ads: 1.03 } },
    { id: 'flash', name: '消焰器', fx: { flashHide: true, recoilV: 0.95 } },
  ],
  barrel: [
    { id: 'long', name: '加长重型枪管', fx: { range: 1.3, recoilV: 0.92, ads: 1.1, mobility: 0.96 } },
    { id: 'short', name: '短突击枪管', fx: { range: 0.8, ads: 0.88, mobility: 1.04, sprintFire: 0.85 } },
    { id: 'fluted', name: '凹槽轻量枪管', fx: { range: 1.1, ads: 0.95, recoilH: 1.08 } },
  ],
  laser: [
    { id: 'tac', name: '5mW 战术激光', fx: { hip: 0.65, ads: 0.97, laser: true } },
    { id: 'mw1', name: '1mW 瞄准激光', fx: { ads: 0.9, sprintFire: 0.88, laser: true } },
  ],
  optic: [
    { id: 'reddot', name: 'MRS 红点镜', fx: { zoom: 1.35, optic: 'reddot' } },
    { id: 'holo', name: '全息瞄准镜', fx: { zoom: 1.4, optic: 'holo', ads: 1.02 } },
    { id: 'acog', name: '4倍 ACOG', fx: { zoom: 3, optic: 'acog', ads: 1.08 } },
    { id: 'thermal', name: '热成像瞄具', fx: { zoom: 2.5, optic: 'thermal', ads: 1.12 } },
    { id: 'sniper', name: '高倍狙击镜', fx: { zoom: 7, optic: 'sniper', ads: 1.15 }, only: ['sniper', 'marksman'] },
  ],
  stock: [
    { id: 'none', name: '无枪托', fx: { mobility: 1.08, ads: 0.85, recoilV: 1.25, recoilH: 1.2 } },
    { id: 'tac', name: '战术枪托', fx: { recoilV: 0.9, recoilH: 0.9, ads: 1.04 } },
    { id: 'heavy', name: '重型固定枪托', fx: { recoilV: 0.82, recoilH: 0.85, mobility: 0.95, ads: 1.06 } },
  ],
  under: [
    { id: 'vgrip', name: '垂直握把', fx: { recoilV: 0.86, ads: 1.04 } },
    { id: 'agrip', name: '斜角握把', fx: { ads: 0.9, recoilH: 0.92 } },
    { id: 'bipod', name: '战术脚架', fx: { recoilV: 0.8, recoilH: 0.8, mobility: 0.97, ads: 1.05 } },
  ],
  mag: [
    { id: 'ext', name: '扩容弹匣', fx: { mag: 1.5, reload: 1.12, ads: 1.03 } },
    { id: 'drum', name: '大容量弹鼓', fx: { mag: 2, reload: 1.35, ads: 1.1, mobility: 0.95 }, not: ['shotgun', 'sniper', 'marksman', 'pistol'] },
    { id: 'fast', name: '快拔双联弹匣', fx: { reload: 0.72 } },
  ],
  rear: [
    { id: 'rubber', name: '橡胶握把胶带', fx: { recoilV: 0.95, recoilH: 0.95 } },
    { id: 'grain', name: '颗粒握把胶带', fx: { ads: 0.95, sprintFire: 0.95 } },
    { id: 'stip', name: '防滑握把', fx: { hip: 0.9 } },
  ],
};

export const CAMOS = [
  { id: 'none', name: '标准' }, { id: 'desert', name: '沙漠' }, { id: 'woodland', name: '林地' },
  { id: 'digital', name: '都市数码' }, { id: 'tiger', name: '虎纹' }, { id: 'dragon', name: '赤鳞' }, { id: 'gold', name: '黄金' },
];

export function findAttachment(slot, id) { return (ATTACHMENTS[slot] || []).find(a => a.id === id); }

export function attachmentAllowed(weaponId, slot, att) {
  const w = WEAPONS[weaponId];
  if (!w.slots.includes(slot)) return false;
  if (att.only && !att.only.includes(w.type)) return false;
  if (att.not && att.not.includes(w.type)) return false;
  if (w.type === 'pistol' && slot === 'optic' && att.id !== 'reddot') return false;
  if (w.type === 'lmg' && slot === 'mag') return false;
  return true;
}

// 计算最终武器属性
export function computeStats(weaponId, attachments = {}) {
  const b = WEAPONS[weaponId];
  const s = {
    id: weaponId, name: b.name, type: b.type, cls: b.cls,
    dmgNear: b.dmg[0], dmgFar: b.dmg[1], rangeNear: b.range[0], rangeFar: b.range[1],
    rpm: b.rpm, mag: b.mag, reserve: b.reserve, reload: b.reload, ads: b.ads,
    recoilV: b.recoil[0], recoilH: b.recoil[1], hip: b.spread, adsSpread: b.adsSpread || 0.15,
    mobility: b.mobility, fire: b.fire, headMul: b.headMul, pellets: b.pellets || 1,
    sprintFire: b.sprintFire, suppressed: false, zoom: 1.2, optic: 'iron', laser: false,
    projectile: b.projectile, sound: b.sound, shellReload: !!b.shellReload, flashHide: false,
  };
  if (b.defaultOptic && !attachments.optic) { s.optic = b.defaultOptic; s.zoom = 7; }
  for (const slot in attachments) {
    const a = findAttachment(slot, attachments[slot]);
    if (!a) continue;
    const fx = a.fx;
    if (fx.range) { s.rangeNear *= fx.range; s.rangeFar *= fx.range; }
    if (fx.ads) s.ads *= fx.ads;
    if (fx.mobility) s.mobility *= fx.mobility;
    if (fx.recoilV) s.recoilV *= fx.recoilV;
    if (fx.recoilH) s.recoilH *= fx.recoilH;
    if (fx.hip) s.hip *= fx.hip;
    if (fx.mag) { s.mag = Math.round(s.mag * fx.mag); s.reserve = Math.round(s.reserve * Math.min(fx.mag, 1.5)); }
    if (fx.reload) s.reload *= fx.reload;
    if (fx.sprintFire) s.sprintFire *= fx.sprintFire;
    if (fx.suppressed) s.suppressed = true;
    if (fx.flashHide) s.flashHide = true;
    if (fx.laser) s.laser = true;
    if (fx.zoom) { s.zoom = fx.zoom; s.optic = fx.optic; }
  }
  return s;
}

// 0-100 的属性条
export function statBars(s) {
  const c = v => Math.max(3, Math.min(100, v));
  const dps = s.dmgNear * s.pellets * s.rpm / 60;
  return {
    '精准度': c(100 - (s.recoilV * 16 + s.recoilH * 14) - s.hip * 1.5 + 10),
    '伤害': c(s.dmgNear * s.pellets / 1.2),
    '射程': c(s.rangeFar / 1.3),
    '射速': c(s.rpm / 11),
    '机动性': c((s.mobility - 0.75) * 300),
    '操控性': c(100 - s.ads * 140 - s.reload * 6),
    '_dps': dps,
  };
}

export const PERKS = [
  [
    { id: 'doubletime', name: '双倍时间', desc: '战术冲刺时间翻倍，蹲伏移动速度提高30%。', icon: '⏩' },
    { id: 'scavenger', name: '拾荒者', desc: '击杀敌人后自动补充弹药与投掷物。', icon: '🎒' },
    { id: 'eod', name: '爆破专家', desc: '受到的爆炸与燃烧伤害降低50%，闪光效果减半。', icon: '🛡' },
    { id: 'coldblooded', name: '冷血', desc: '敌方AI锁定你的反应时间大幅延长，哨戒机枪与直升机优先级降低。', icon: '❄' },
  ],
  [
    { id: 'hardline', name: '强硬路线', desc: '所有连杀奖励所需击杀数减少1。', icon: '⬇' },
    { id: 'overkill', name: '火力过载', desc: '可将第二把主武器作为副武器携带。', icon: '✚' },
    { id: 'ghost', name: '幽灵', desc: '不会被敌方UAV与雷达侦测到。', icon: '👻' },
    { id: 'quickfix', name: '速愈', desc: '击杀敌人立即恢复生命，生命恢复延迟缩短。', icon: '❤' },
  ],
  [
    { id: 'sleight', name: '快手', desc: '换弹速度提高35%。', icon: '✋' },
    { id: 'amped', name: '振奋', desc: '切枪与投掷速度提高，发射器换弹更快。', icon: '⚡' },
    { id: 'ninja', name: '静步', desc: '脚步声近乎无声，敌人无法通过声音察觉你。', icon: '👣' },
    { id: 'highalert', name: '高度警觉', desc: '当视野外的敌人瞄准你时，屏幕边缘会闪烁提示。', icon: '⚠' },
  ],
];

export const LETHALS = [
  { id: 'frag', name: '破片手雷', desc: '可烹饪的延时破片手雷', count: 2 },
  { id: 'semtex', name: '粘性炸弹', desc: '粘附于任何表面，2秒后爆炸', count: 2 },
  { id: 'molotov', name: '燃烧瓶', desc: '撞击后爆燃，形成持续燃烧区域', count: 2 },
];
export const TACTICALS = [
  { id: 'flash', name: '闪光弹', desc: '使范围内的敌人致盲和失聪', count: 2 },
  { id: 'smoke', name: '烟雾弹', desc: '释放遮蔽视线的浓烟', count: 1 },
  { id: 'stim', name: '兴奋剂', desc: '立即恢复全部生命值', count: 1 },
];

export const KILLSTREAKS = [
  { id: 'uav', name: '侦察无人机', kills: 3, desc: '在小地图上显示敌人位置 30秒', icon: '📡' },
  { id: 'cluster', name: '集束空袭', kills: 5, desc: '标记目标区域，呼叫战机投下集束炸弹', icon: '✈' },
  { id: 'sentry', name: '哨戒机枪', kills: 6, desc: '部署一挺自动攻击敌人的机枪塔', icon: '🔫' },
  { id: 'heli', name: '武装直升机', kills: 7, desc: '直升机盘旋战场并攻击敌人 45秒', icon: '🚁' },
  { id: 'wp', name: '白磷弹', kills: 10, desc: '白磷覆盖整个战场，灼烧所有敌人', icon: '🔥' },
];

export const DEFAULT_CLASSES = [
  { name: '突击兵', primary: 'm4', patt: { optic: 'holo', under: 'vgrip', muzzle: 'comp' }, pcamo: 'none', secondary: 'm1911', satt: {}, scamo: 'none', lethal: 'frag', tactical: 'flash', perks: ['doubletime', 'ghost', 'sleight'] },
  { name: '近战突破', primary: 'mp5', patt: { optic: 'reddot', laser: 'tac', stock: 'none' }, pcamo: 'digital', secondary: 'm1911', satt: {}, scamo: 'none', lethal: 'semtex', tactical: 'flash', perks: ['doubletime', 'quickfix', 'ninja'] },
  { name: '狙击手', primary: 'l115', patt: { muzzle: 'suppressor', barrel: 'long' }, pcamo: 'woodland', secondary: 'm1911', satt: {}, scamo: 'none', lethal: 'frag', tactical: 'smoke', perks: ['coldblooded', 'ghost', 'highalert'] },
  { name: '火力支援', primary: 'pkm', patt: { optic: 'reddot', under: 'bipod' }, pcamo: 'desert', secondary: 'rpg', satt: {}, scamo: 'none', lethal: 'molotov', tactical: 'stim', perks: ['eod', 'hardline', 'amped'] },
  { name: '霰弹枪手', primary: 'm870', patt: { barrel: 'long', laser: 'tac' }, pcamo: 'tiger', secondary: 'revolver', satt: {}, scamo: 'none', lethal: 'semtex', tactical: 'stim', perks: ['scavenger', 'quickfix', 'ninja'] },
];

export const DEFAULT_STREAKS = ['uav', 'cluster', 'heli'];

export const MP_MAPS = [
  { id: 'dune', name: '沙丘镇', desc: '烈日下的中东小镇，集市街道与土坯民居交错，中远距离交火。', style: '沙漠 · 白昼', grad: 'linear-gradient(135deg,#d9a55b,#7a4f25)' },
  { id: 'frost', name: '寒霜炼厂', desc: '暴风雪中的废弃炼油厂，仓库、储油罐与集装箱构成多层次战场。', style: '雪地 · 阴天', grad: 'linear-gradient(135deg,#c9d6e3,#4f6275)' },
  { id: 'neon', name: '霓虹街区', desc: '雨夜中的都市街区，霓虹灯下的湿滑街道与狭窄小巷，近距离激战。', style: '都市 · 雨夜', grad: 'linear-gradient(135deg,#ff3fa4,#1b1f5e)' },
  { id: 'yard', name: '货柜场', desc: '夕阳下的小型集装箱堆场，节奏极快的混战地图。', style: '港口 · 黄昏', grad: 'linear-gradient(135deg,#ff9a3c,#5a2a3a)' },
];

export const MP_MODES = [
  { id: 'tdm', name: '团队死斗', desc: '两支队伍对抗，率先达到击杀目标的队伍获胜。' },
  { id: 'dom', name: '占领', desc: '夺取并守住 A、B、C 三个据点以获取分数。' },
  { id: 'ffa', name: '自由混战', desc: '人人为敌，率先达到击杀目标者获胜。' },
];

export const BOT_NAMES = ['猎鹰', '蝮蛇', '雷霆', '北极狐', '老炮', '独狼', '夜莺', '铁拳', '野马', '黑曼巴', '响尾蛇', '秃鹫', '猎户', '灰熊', '刺刀', '暴风', '渡鸦', '钢锯', '寒鸦', '猛犸', '火蜥', '毒刺', '沙暴', '白鲨'];
