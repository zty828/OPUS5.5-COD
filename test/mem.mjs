import { chromium } from 'playwright';
import { execSync } from 'child_process';
const rss = () => execSync("ps -eo rss,args | grep chrome-headless | grep -v grep | awk '{s+=$1} END {print int(s/1024)}'").toString().trim();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.addInitScript(ml => localStorage.setItem('mf_settings', JSON.stringify({ quality: 'low', maxLights: ml })), +(process.env.ML ?? 4));
await page.goto('http://localhost:8080/index.html');
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 120000 });
console.log('menu', rss());
const map = process.argv[2];
await page.evaluate(m => game.startGame('mp', { mode: 'tdm', map: m, diff: 1, allies: 5, enemies: 6, scoreLimit: 50, timeLimit: 10 }), map);
page.on('console', m => { if (m.text().startsWith('M ')) console.log(m.text(), rss()); });
await page.evaluate(() => { setInterval(() => { const i = game.renderer.info; console.log('M ' + JSON.stringify([+game.time.toFixed(1), i.programs.length, i.memory.textures, i.memory.geometries, i.render.calls, game.pickups.length, game.bots.filter(b=>!b.alive).length, game.projectiles.length])); }, 250); });
for (let k = 0; k < 12; k++) {
  await page.waitForTimeout(1000);
  console.log(k, rss(), JSON.stringify(await page.evaluate(() => [game.renderer.info.programs.length, game.renderer.info.memory.textures, game.renderer.info.memory.geometries, Math.round(game.time), game.effects.lights ? game.effects.lights.length : -1])));
}
await browser.close();
