import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type()==='log') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('crash', () => console.log('CRASH'));
await page.addInitScript(() => localStorage.setItem('mf_settings', JSON.stringify({ quality: 'low' })));
await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = function () { return Promise.resolve(); }; });
await page.goto('http://localhost:8080/index.html');
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 120000 });
const code = process.argv[2];
const r = await page.evaluate(code);
console.log(JSON.stringify(r, null, 1));
if (process.argv[3]) { await page.waitForTimeout(800); await page.screenshot({ path: process.argv[3] }); }
console.log(errors.slice(0, 30).join('\n'));
await browser.close();
