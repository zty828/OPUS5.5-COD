(async () => {
  const log = [];
  await game.startGame('mp', { mode: 'tdm', map: 'yard', diff: 0, allies: 3, enemies: 4, scoreLimit: 50, timeLimit: 10 });
  game.renderer.setAnimationLoop(null);
  const base = () => ({ fwd: false, back: false, left: false, right: false, sprint: false, jumpPressed: false, crouchPressed: false, fire: false, ads: false, reloadPressed: false, swapPressed: false, slot1: false, slot2: false, meleePressed: false, lethalPressed: false, lethal: false, tacticalPressed: false, tactical: false, interact: false, interactPressed: false, nvgPressed: false, streak: -1, firePressed: false, adsPressed: false, mdx: 0, mdy: 0 });
  const step = (n, f) => { for (let i = 0; i < n; i++) { const inp = base(); f && f(inp, i); game.update(1 / 30, inp); } };
  const pl = game.player;
  step(20);
  const m0 = pl.ws.slots[0].mag;
  step(30, (inp, i) => { inp.fire = true; inp.firePressed = i === 0; inp.ads = true; inp.adsPressed = i === 0; });
  log.push(['fired', m0, pl.ws.slots[0].mag, pl.stats.shots]);
  step(90, (inp, i) => { inp.reloadPressed = i === 0; });
  log.push(['reload', pl.ws.slots[0].mag, pl.ws.slots[0].reserve]);
  step(30, (inp, i) => { inp.slot2 = i === 0; });
  log.push(['swap', pl.ws.cur, pl.ws.w && pl.ws.w.id]);
  step(30, (inp, i) => { inp.slot1 = i === 0; });
  step(40, (inp, i) => { inp.lethal = i < 10; inp.lethalPressed = i === 0; });
  log.push(['frag', pl.lethal.count, game.projectiles.length]);
  step(40, (inp, i) => { inp.tactical = i < 3; inp.tacticalPressed = i === 0; });
  log.push(['tac', pl.tactical.count]);
  step(30, (inp, i) => { inp.meleePressed = i === 0; });
  step(60, (inp) => { inp.fwd = true; inp.sprint = true; });
  step(20, (inp, i) => { inp.crouchPressed = i === 0; inp.fwd = true; inp.sprint = true; });
  step(20, (inp, i) => { inp.jumpPressed = i === 0; });
  log.push(['moved', pl.pos.x.toFixed(1), pl.pos.z.toFixed(1), pl.alive]);
  // streaks
  const M = game.mode;
  M.streakState.forEach(s => s.ready = true);
  step(5, (inp, i) => { inp.streak = i === 0 ? 0 : -1; });
  step(5, (inp, i) => { inp.streak = i === 0 ? 1 : -1; });
  step(5, (inp, i) => { inp.firePressed = i === 0; inp.fire = i === 0; });
  step(5, (inp, i) => { inp.streak = i === 0 ? 2 : -1; });
  step(200);
  log.push(['streaks', JSON.stringify(M.streakState), M.active.length, JSON.stringify(M.uav)]);
  // sentry + wp
  M.streakDefs = [{ id: 'sentry' }, { id: 'wp' }]; M.streakState = [{ id: 'sentry', ready: true }, { id: 'wp', ready: true }];
  step(3, (inp, i) => { inp.streak = i === 0 ? 0 : -1; });
  step(3, (inp, i) => { inp.streak = i === 0 ? 1 : -1; });
  step(300);
  log.push(['after', M.active.length, JSON.stringify(M.scores), pl.stats.kills]);
  // end match
  M.end && M.end('A');
  await new Promise(r => setTimeout(r, 3000));
  log.push(['menu screen', game.menu.screen]);
  game.exitToMenu();
  log.push(['state', game.state]);
  return log;
})()
