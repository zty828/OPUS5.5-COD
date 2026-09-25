import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => localStorage.setItem('mf_settings', JSON.stringify({ quality: 'low' })));
await p.goto('http://localhost:8080/index.html');
await p.waitForFunction(() => window.game && game.state === 'menu', null, { timeout: 120000 });
await p.evaluate(() => game.menu.showLoadouts('main')); await p.waitForTimeout(1000);
await p.screenshot({ path: '/home/user/mw/test/lo.png' }); await b.close();
