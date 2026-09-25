// 冒烟测试：加载页面、截图主菜单、启动战役/多人，收集错误
import { chromium } from 'playwright';
const shots = process.argv[2] || 'all';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
page.on('crash', () => console.log('CRASH'));
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.addInitScript(q => { if (q) localStorage.setItem('mf_settings', JSON.stringify({ quality: q })); }, process.env.Q || '');
await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = function () { return Promise.resolve(); }; });
await page.goto('http://localhost:8080/index.html');
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 120000 }).catch(e => errors.push('menu timeout'));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/menu.png' });
const run = async (name, fn) => { try { await fn(); } catch (e) { errors.push(`[${name}] ${e.message}`); } };
if (shots === 'all' || shots === 'ui') {
  await run('lobby', async () => { await page.evaluate(() => game.menu.showLobby()); await page.waitForTimeout(500); await page.screenshot({ path: 'test/lobby.png' }); });
  await run('loadout', async () => { await page.evaluate(() => game.menu.showLoadouts('main')); await page.waitForTimeout(800); await page.screenshot({ path: 'test/loadout.png' }); });
  await run('gunsmith', async () => { await page.evaluate(() => game.menu.showGunsmith(0, 'primary')); await page.waitForTimeout(1200); await page.screenshot({ path: 'test/gunsmith.png' }); });
  await run('camp', async () => { await page.evaluate(() => game.menu.showCampaign()); await page.waitForTimeout(500); await page.screenshot({ path: 'test/brief.png' }); });
}
const play = async (kind, cfg, tag) => {
  await page.evaluate(([k, c]) => game.startGame(k, c), [kind, cfg]);
  await page.waitForFunction(() => game.state === 'play', null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `test/${tag}_a.png` });
  // 模拟一些游戏时间
  await page.evaluate(() => { for (let i = 0; i < 120; i++) game.update(1 / 30, game.snapshotInput()); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test/${tag}_b.png` });
  const info = await page.evaluate(() => ({ bots: game.bots.length, alive: game.bots.filter(b => b.alive).length, pl: game.player && [game.player.pos.x.toFixed(1), game.player.pos.z.toFixed(1), game.player.hp], calls: game.renderer.info.render.calls, tris: game.renderer.info.render.triangles }));
  errors.push(`[info ${tag}] ` + JSON.stringify(info));
};
if (shots === 'all' || shots === 'camp') await run('campaign', () => play('campaign', { diff: 1 }, 'camp'));
if (shots === 'all' || shots.startsWith('mp')) {
  const maps = shots.startsWith('mp:') ? [shots.slice(3)] : ['dune', 'frost', 'neon', 'yard'];
  for (const m of maps) await run('mp ' + m, () => play('mp', { mode: m === 'frost' ? 'dom' : 'tdm', map: m, diff: 1, allies: 5, enemies: 6, scoreLimit: 50, timeLimit: 10 }, 'mp_' + m));
}
console.log(errors.slice(0, 60).join('\n'));
await browser.close();
