// 자동 플레이 테스트. ?autostart&test=move|attack|path|all  → 결과를 <pre id="__state"> 에 JSON으로 기록.
// 실행: node tools/check.mjs "autostart&ghost=0&cls=warrior&test=all" out.png 8000
// 소유: 관리자.
const sleep = (game, sec) => new Promise((r) => game.timers.push({ t: sec, fn: r }));

function hold(game, code, on) {
  if (on) { game.input.down.add(code); game.input.pressedSet.add(code); }
  else { game.input.down.delete(code); game.input.releasedSet.add(code); }
}

function findOpenLine(game, dir, len) {
  const w = game.world, p = game.player;
  for (let y = 1; y < w.h - 1; y++) for (let x = 1; x < w.w - 1; x++) {
    let ok = true;
    for (let i = 0; i <= len && ok; i++) ok = w.isFree(x + dir.dx * i, y + dir.dy * i, p);
    if (ok) return { x, y };
  }
  return null;
}

const TESTS = {
  // 자동 완주 (워커 D, src/debug/playthrough.js). &playthrough=pro|ch1|ch2|ch3|post|all
  async playthrough(game) {
    const m = await import('./playthrough.js');
    return m.run(game, new URLSearchParams(location.search).get('playthrough') || 'all');
  },
  // 화면 진단: 캔버스 중앙 픽셀 밝기 + 그 지점을 덮는 최상단 DOM 요소
  async probe(game) {
    await sleep(game, 0.5);
    const c = game.canvas, ctx = c.getContext('2d');
    const pts = [[0.5, 0.4], [0.3, 0.3], [0.7, 0.5]].map(([fx, fy]) => {
      const x = Math.floor(c.width * fx), y = Math.floor(c.height * fy);
      const d = ctx.getImageData(x, y, 1, 1).data;
      const r = c.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + x * r.width / c.width, r.top + y * r.height / c.height);
      const cs = el && getComputedStyle(el);
      return { px: [d[0], d[1], d[2], d[3]], top: el ? `${el.tagName}#${el.id}.${el.className}` : null, bg: cs?.backgroundColor, op: cs?.opacity };
    });
    // 레이어를 하나씩 꺼 가며 중앙 밝기 측정 (원인 이분 탐색)
    const R = game.renderer, center = () => { const d = ctx.getImageData(c.width >> 1, (c.height * 0.4) | 0, 1, 1).data; return d[0] + d[1] + d[2]; };
    const steps = {};
    const off = [['screen', R.fx, 'drawScreen'], ['vignette', R.lighting, 'drawVignette'], ['lighting', R.lighting, 'apply'], ['fog', R.lighting, 'drawFog']];
    for (const [name, obj, fn] of off) { obj[fn] = () => {}; await sleep(game, 0.1); steps[name] = center(); }
    const chunk = [...R.ground.chunks.values()].find((m) => m.canvas);
    let chunkPx = null;
    if (chunk) { const cc = chunk.canvas.getContext('2d'); const d = cc.getImageData(chunk.canvas.width >> 1, chunk.canvas.height >> 1, 1, 1).data; chunkPx = [...d]; }
    return { canvas: [c.width, c.height], pts, steps, chunkPx, chunkType: chunk?.canvas?.constructor?.name };
  },
  // 오른쪽(화면 →, 그리드 (1,-1)) 대신 ↘(그리드 +x) 방향을 1.2초 유지 → 끊김(정지 프레임) 측정
  async move(game) {
    const p = game.player;
    const start = findOpenLine(game, { dx: 1, dy: 0 }, 8);
    if (!start) return { skip: '열린 직선 없음' };
    p.x = start.x; p.y = start.y; p.rx = p.x; p.ry = p.y; p.move = null;
    await sleep(game, 0.1);
    let frames = 0, idleFrames = 0;
    const off = game.bus.on('entity:moveStart', () => {});
    const x0 = p.x;
    hold(game, 'KeyD', true); hold(game, 'KeyS', true); // →+↓ = ↘ = 그리드 +x
    const t0 = game.time;
    while (game.time - t0 < 1.2) {
      await sleep(game, 0);
      frames++;
      if (!p.move && game.time - t0 > 0.05) idleFrames++;
    }
    hold(game, 'KeyD', false); hold(game, 'KeyS', false);
    off();
    await sleep(game, 0.3);
    const tiles = p.x - x0;
    return { tilesMoved: tiles, expectedApprox: Math.round(1.2 * p.speed), frames, idleFrames, smooth: idleFrames <= 1 };
  },

  async attack(game) {
    const p = game.player, w = game.world;
    const spot = findOpenLine(game, { dx: 1, dy: 0 }, 2);
    if (!spot) return { skip: '공간 없음' };
    p.x = spot.x; p.y = spot.y; p.rx = p.x; p.ry = p.y; p.move = null;
    const id = Object.keys(game.data.monsters)[0];
    const m = game.systems.spawner.spawnNear(id, spot.x + 1, spot.y, {});
    if (!m) return { skip: 'spawn 실패' };
    m.ai = { ...(m.ai || {}), frozen: true };
    const hp0 = m.hp;
    hold(game, 'Space', true);
    const t0 = game.time;
    while (game.time - t0 < 3 && !m.dead && w.entities.includes(m)) await sleep(game, 0.05);
    hold(game, 'Space', false);
    return { monster: id, hp0, hpNow: m.hp, killed: m.dead || !w.entities.includes(m), facing: p.dir, secs: +(game.time - t0).toFixed(2) };
  },

  // 터치 오버레이(워커 C, src/ui/touch.js): 합성 PointerEvent 로 조이스틱 이동 · 멀티터치 공격 · 기술 버튼. &touch=1 로 오버레이 강제 표시.
  async touch(game) {
    const pad = document.getElementById('tpad');
    if (!pad) return { error: '#tpad 없음' };
    const zone = pad.querySelector('.joy-zone'), joy = pad.querySelector('.joy'), atk = pad.querySelector('.tb.atk');
    const visible = getComputedStyle(pad).display !== 'none' && zone.getBoundingClientRect().width > 0;
    if (!visible) return { visible, error: '오버레이가 숨겨져 있음 (&touch=1 필요)' };
    const fire = (elm, type, pointerId, x, y) => elm.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', isPrimary: pointerId === 11, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, composed: true }));
    const jr = joy.getBoundingClientRect(), cx = jr.left + jr.width / 2, cy = jr.top + jr.height / 2, R = jr.width / 2;
    const p = game.player, w = game.world, inp = game.input, out = { visible };
    // 1) 조이스틱 화면 오른쪽(그리드 (1,-1)) 1.2초
    const start = findOpenLine(game, { dx: 1, dy: -1 }, 8);
    if (!start) return { ...out, skip: '열린 직선 없음' };
    p.x = start.x; p.y = start.y; p.rx = p.x; p.ry = p.y; p.move = null;
    await sleep(game, 0.1);
    const x0 = p.x, y0 = p.y;
    fire(zone, 'pointerdown', 11, cx + R * 0.9, cy);
    const dirSet = inp.virtualDir ? { sx: +inp.virtualDir.sx.toFixed(2), sy: +inp.virtualDir.sy.toFixed(2) } : null;
    await sleep(game, 1.2);
    fire(window, 'pointerup', 11, cx + R * 0.9, cy);
    const afterUp = inp.virtualDir;
    await sleep(game, 0.4);
    out.joystick = { dirSet, dx: p.x - x0, dy: p.y - y0, moved: p.x - x0 >= 3 && p.y - y0 <= -3, releasedNull: afterUp === null, stopped: !p.move };
    // 2) 멀티터치: 조이스틱(가운데=데드존)을 잡은 채 공격 버튼 → 몬스터 처치, 그 사이 조이스틱 끌기도 인식
    const spot = findOpenLine(game, { dx: 1, dy: 0 }, 2);
    p.x = spot.x; p.y = spot.y; p.rx = p.x; p.ry = p.y; p.move = null;
    const id = Object.keys(game.data.monsters)[0];
    const m = game.systems.spawner.spawnNear(id, spot.x + 1, spot.y, {});
    if (!m) return { ...out, skip: 'spawn 실패' };
    m.ai = { ...(m.ai || {}), frozen: true };
    fire(zone, 'pointerdown', 11, cx, cy);
    const ar = atk.getBoundingClientRect();
    fire(atk, 'pointerdown', 12, ar.left + ar.width / 2, ar.top + ar.height / 2);
    const spaceDown = inp.down.has('Space');
    const t0 = game.time;
    while (game.time - t0 < 3 && !m.dead && w.entities.includes(m)) await sleep(game, 0.05);
    const killed = m.dead || !w.entities.includes(m);
    fire(window, 'pointermove', 11, cx, cy - R * 0.9); // 공격 중 다른 손가락의 조이스틱
    const dirWhileAtk = inp.virtualDir ? { sx: +inp.virtualDir.sx.toFixed(2), sy: +inp.virtualDir.sy.toFixed(2) } : null;
    fire(window, 'pointerup', 12, 0, 0);
    const spaceReleased = !inp.down.has('Space');
    fire(window, 'pointerup', 11, 0, 0);
    out.attack = { monster: id, killed, secs: +(game.time - t0).toFixed(2), spaceDown, spaceReleased, multiTouchDir: dirWhileAtk, joyReleased: inp.virtualDir === null };
    // 3) 기술 버튼 1 (등록돼 있으면): 누르면 Digit1 → useSlot(0)
    const h = game.state.hotbar[0];
    if (typeof h === 'string' && game.state.skills.includes(h)) {
      const sb = pad.querySelector('.tb.sk[data-i="0"]'), r = sb.getBoundingClientRect();
      p.mp = p.maxMp;
      const mp0 = p.mp;
      fire(sb, 'pointerdown', 13, r.left + 5, r.top + 5);
      await sleep(game, 0.1);
      fire(window, 'pointerup', 13, 0, 0);
      await sleep(game, 0.1);
      out.skill = { id: h, cdLeft: +(game.systems.skills.cooldownLeft?.(h) ?? 0).toFixed(2), mpUsed: mp0 - p.mp, digitReleased: !inp.down.has('Digit1') };
    } else out.skill = { skip: '단축키 1 에 기술 없음' };
    // 4) 가방 칸 탭 → 동작 상자, [단축키 7] 등록 → 물약 버튼 표시
    const potId = Object.keys(game.data.items).find((k) => game.data.items[k].use?.heal);
    if (potId) {
      game.systems.inventory.add(potId, 3);
      game.ui.windows.inventory.open();
      await sleep(game, 0.1);
      const idx = game.state.inventory.findIndex((it) => it?.id === potId);
      const sl = document.querySelectorAll('.invwin .inv-grid .slot')[idx], r = sl.getBoundingClientRect();
      fire(sl, 'pointerdown', 14, r.left + 5, r.top + 5);
      fire(sl, 'pointerup', 14, r.left + 5, r.top + 5);
      const sheet = document.querySelector('.tsheet');
      const b7 = [...(sheet?.querySelectorAll('.ts-row .btn') ?? [])].find((b) => b.textContent === '7');
      b7?.click();
      await sleep(game, 0.4);
      const potBtn = pad.querySelector('.tb.pot:not(.hidden)');
      out.sheet = { item: potId, sheetOpened: !!sheet, hotbar7: game.state.hotbar[6]?.item ?? null, potButton: !!potBtn, sheetClosed: !document.querySelector('.tsheet') };
      game.ui.windows.inventory.close();
    }
    out.ok = !!(out.joystick.moved && out.joystick.releasedNull && out.attack.killed && out.attack.multiTouchDir && out.attack.spaceReleased);
    return out;
  },

  async path(game) {
    const p = game.player, w = game.world;
    let goal = null;
    // 도달 가능한(경로가 있는) 6~14칸 거리의 타일
    for (let y = 1; y < w.h - 1 && !goal; y++) for (let x = 1; x < w.w - 1; x++) {
      const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
      if (d < 6 || d > 14 || !w.isFree(x, y, p)) continue;
      const path = game.controller.findPath(x, y, false);
      if (path && path.length >= 6) { goal = { x, y }; break; }
    }
    if (!goal) return { skip: '목표 없음' };
    game.controller.moveTo(goal.x, goal.y);
    const hadPath = !!game.controller.path;
    const t0 = game.time;
    while (game.time - t0 < 6 && !(p.x === goal.x && p.y === goal.y)) await sleep(game, 0.1);
    return { goal, hadPath, reached: p.x === goal.x && p.y === goal.y, secs: +(game.time - t0).toFixed(2) };
  },
};

function writeState(obj) {
  let el = document.getElementById('__state');
  if (!el) { el = document.createElement('pre'); el.id = '__state'; el.style.display = 'none'; document.body.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}

export async function runTests(game, which) {
  // 'all' = 짧은 회귀 테스트만 (probe·playthrough 는 이름으로 명시해야 실행)
  const names = which === 'all' ? ['move', 'attack', 'path'] : which.split(',');
  const results = { _progress: 'started' };
  writeState(results);
  const iv = setInterval(() => { results._time = +game.time.toFixed(2); writeState(results); }, 250);
  // 맵 시작 컷신/대화가 조작을 잠그므로 테스트 중엔 계속 해제
  const unlock = setInterval(() => { if (game.dialog.isOpen) game.dialog.close(); game.cutscene = false; }, 30);
  await sleep(game, 0.3);
  for (const n of names) {
    results._progress = n; writeState(results);
    try { results[n] = TESTS[n] ? await TESTS[n](game) : { error: '없는 테스트' }; }
    catch (e) { results[n] = { error: String(e?.stack || e) }; }
  }
  results._progress = 'done';
  clearInterval(iv);
  clearInterval(unlock);
  writeState(results);
  return results;
}
