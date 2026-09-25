(async () => {
  const log = [];
  await game.startGame('campaign', { diff: 0 });
  game.renderer.setAnimationLoop(null);
  const C = game.mode, pl = game.player;
  const base = () => ({ streak: -1, mdx: 0, mdy: 0 });
  const step = (n, f) => { for (let i = 0; i < n; i++) { const inp = base(); f && f(inp, i); game.update(1 / 30, inp); if (pl.hp < 50) pl.hp = 100; } };
  const killGroup = g => { for (const b of C.groups[g] || []) if (b.alive) b.takeDamage(1000, { attacker: pl, weapon: 'M4A1', dir: new THREE.Vector3(1,0,0) }); };
  step(30); log.push(['s', C.step]);
  pl.pos.set(-70, 0, 0); step(10); log.push(['s', C.step]);
  killGroup('outpost'); step(10); log.push(['s', C.step, C.alive('outpost')]);
  pl.pos.set(38, 0, 0); step(10); log.push(['s', C.step]);
  killGroup('village'); killGroup('compound'); step(10); log.push(['s', C.step, C.hvt.alive]);
  const lp = game.world.laptopPos; pl.pos.set(lp.x - 1, 0, lp.z + 0.8); step(10);
  log.push(['nearLaptop', C.interactPrompt]);
  step(120, inp => { inp.interact = true; }); log.push(['s', C.step]);
  step(30 * 40); log.push(['def', C.step, C.wave, Math.round(C.defendT), C.alive('defense'), pl.alive]);
  killGroup('defense'); step(30 * 55, () => { if (!pl.alive) { C.respawn(); } }); killGroup('defense');
  log.push(['def2', C.step, C.wave, Math.round(C.defendT)]);
  step(30 * 14); log.push(['exfil', C.step, C.landed, game.world.boxes.includes(C.gateBox)]);
  const lz = game.world.lzPos; pl.pos.set(lz.x - 3, 0, lz.z); pl.alive = true; step(10);
  log.push(['done', C.done]);
  await new Promise(r => setTimeout(r, 4200));
  log.push(['screen', game.menu.screen, game.profile.campaignBest]);
  return log;
})()
