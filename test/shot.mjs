import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 640), height: +(process.env.H || 360) } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('[pageerror] ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join('|')));
await page.addInitScript(q => localStorage.setItem('mf_settings', JSON.stringify({ quality: q })), process.env.Q || 'low');
await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = function () { return Promise.resolve(); }; });
await page.goto('http://localhost:8080/index.html');
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 120000 });
setTimeout(() => { console.log('KILL', errs.join('\n')); process.exit(2); }, 150000);
// argv: kind cfgJSON then list of "x,z,yaw,pitch,name[,setup js]"
console.log('IW menu', await page.evaluate(() => innerWidth));
const kind = process.argv[2], cfg = JSON.parse(process.argv[3]);
await page.evaluate(([k, c]) => game.startGame(k, c), [kind, cfg]);
await page.waitForFunction(() => game.state === 'play');
console.log('IW play', await page.evaluate(() => innerWidth));
for (const spec of process.argv.slice(4)) {
  const [x, z, yaw, pitch, name, js] = spec.split(';');
  await page.evaluate(([x, z, yaw, pitch, js]) => { const p = game.player; p.pos.set(+x, 0, +z); p.pos.y = game.world.groundHeight(+x, +z, 30, 0.3); p.yaw = +yaw; p.pitch = +pitch; if (js) eval(js); for (let i = 0; i < 20; i++) game.update(1 / 30, game.snapshotInput()); }, [x, z, yaw, pitch, js || '']);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `test/${name}.png`, clip: { x: 0, y: 0, width: +(process.env.W || 640), height: +(process.env.H || 360) } });
}
console.log('OK', errs.slice(0, 20).join('\n'));
await browser.close(); process.exit(0);
