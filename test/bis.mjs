import { chromium } from 'playwright';
import { execSync } from 'child_process';
const rss = () => execSync("ps -eo rss,args | grep chrome-headless | grep -v grep | awk '{s+=$1} END {print int(s/1024)}'").toString().trim();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
page.on('console', m => { if (m.text().startsWith('S ')) console.log(m.text(), rss()); });
await page.addInitScript(() => localStorage.setItem('mf_settings', JSON.stringify({ quality: 'low' })));
await page.goto('http://localhost:8080/index.html');
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 120000 });
console.log('menu', rss());
const steps = process.argv.slice(2);
await page.evaluate(() => game.renderer.setAnimationLoop(null));
for (const s of steps) {
  const t = await page.evaluate(async s => { const t0 = performance.now(); await eval(s); return Math.round(performance.now() - t0); }, s);
  await new Promise(r => setTimeout(r, 300));
  console.log(s.slice(0, 60), t + 'ms', rss());
}
await browser.close();
