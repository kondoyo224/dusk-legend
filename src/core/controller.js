import { dirFromScreen, dirTowards, chebyshev, DIRS } from './iso.js';
import { findPath } from './pathfind.js';

// 플레이어 조작. 목표: "어둠의 전설보다 훨씬 나은 조작감"
//  - 8방향 (WASD/방향키 = 화면 기준 방향, 동시 입력으로 대각)
//  - 키를 누르고 있으면 타일 사이 끊김 없이 연속 이동(남은 시간 이월)
//  - 벽에 비스듬히 부딪히면 옆 방향으로 미끄러짐
//  - 마우스 좌클릭: 이동/공격/대화/줍기, 좌클릭 유지: 커서 방향으로 계속 이동
//  - Space: 공격(유지 시 연타). 앞이 비었으면 인접한 적에게 자동으로 돌아서 공격
//  - 이동 중 입력한 공격/대화는 버퍼링되어 도착 즉시 실행
const KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
};
const HOTBAR = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

export class Controller {
  constructor(game) {
    this.game = game;
    this.path = null;        // [{x,y}]
    this.target = null;      // 공격 대상 엔티티
    this.interact = null;    // 대화/줍기 대상 엔티티
    this.holdTimer = 0;
    this.attackQueued = false;
    this.attackQueuedT = 0;   // 공격 입력 버퍼 유효시간
    this.lastDestTile = null;
  }

  attach(player) {
    player.nextStep = (leftover) => this.step(leftover);
  }

  get p() { return this.game.player; }

  canControl() {
    const g = this.game;
    const p = this.p;
    if (!p || g.scene !== 'play' || g.cutscene || g.dialog.isOpen || g.transition) return false;
    if (g.ui?.isBlocking?.()) return false;
    if (p.dead && !p.ghost) return false;
    return true;
  }

  clearOrders() { this.path = null; this.target = null; this.interact = null; this.attackQueued = false; }

  keyDir() {
    const inp = this.game.input;
    // 가상 조이스틱: 화면에 투영된 실제 8방향 벡터 중 가장 가까운 방향 (아이소메트릭이라 45° 등분이 아님)
    const v = inp.blocked ? null : inp.virtualDir;
    if (v) {
      let best = -1, bd = -Infinity;
      for (let i = 0; i < 8; i++) {
        const d = DIRS[i], px = (d.dx - d.dy) * 2, py = d.dx + d.dy, m = Math.hypot(px, py);
        const dot = (px * v.sx + py * v.sy) / m;
        if (dot > bd) { bd = dot; best = i; }
      }
      return best;
    }
    const sx = (inp.anyDown(...KEYS.right) ? 1 : 0) - (inp.anyDown(...KEYS.left) ? 1 : 0);
    const sy = (inp.anyDown(...KEYS.down) ? 1 : 0) - (inp.anyDown(...KEYS.up) ? 1 : 0);
    return dirFromScreen(sx, sy);
  }

  update(dt) {
    const g = this.game, inp = g.input, p = this.p;
    if (!this.canControl()) { this.path = null; this.attackQueued = false; inp.takeClicks(); return; }

    // ── 마우스 ──
    for (const c of inp.takeClicks()) {
      if (c.button !== 0) continue;
      this.handleClick(c.x, c.y);
    }
    if (inp.mouse.left && !this.target && !this.interact) {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        this.holdTimer = 0.12;
        const t = g.renderer.screenToTile(inp.mouse.x, inp.mouse.y);
        if (t && (!this.lastDestTile || t.x !== this.lastDestTile.x || t.y !== this.lastDestTile.y)) this.moveTo(t.x, t.y);
      }
    } else this.holdTimer = 0;

    // ── 키보드 ──
    const kd = this.keyDir();
    if (kd >= 0) { this.path = null; this.target = null; this.interact = null; }

    if (inp.pressed('Space')) { this.attackQueued = true; this.attackQueuedT = 0.35; }
    else if (this.attackQueued && (this.attackQueuedT -= dt) <= 0) this.attackQueued = false;
    const attackHeld = inp.isDown('Space');

    for (let i = 0; i < HOTBAR.length; i++) {
      if (inp.pressed(HOTBAR[i])) g.systems.skills.useSlot(i);
    }
    if (inp.pressed('KeyF') || inp.pressed('KeyE')) this.interactNearby();
    if (inp.pressed('Tab')) this.cycleTarget();
    if (inp.pressed('Escape')) { this.target = null; }

    // ── 행동 결정 (이동 중이 아닐 때) ──
    if (!p.move) {
      if (this.attackQueued || attackHeld) {
        if (!p.dead && this.doAttack()) { this.attackQueued = false; return; }
      }
      if (this.target && !p.dead) {
        if (this.target.dead || !g.world.entities.includes(this.target)) { this.target = null; }
        else if (chebyshev(p.x, p.y, this.target.x, this.target.y) <= 1) { this.doAttack(this.target); return; }
      }
      this.step(0);
    }
  }

  // 이동 1칸 결정. 이동을 시작했으면 true. (world 가 도착 직후에도 호출 → 연속 이동)
  step(leftover) {
    const g = this.game, p = this.p, w = g.world;
    if (!this.canControl()) return false;
    // 도착 직후 버퍼된 공격이 있고 인접 적이 있으면 멈춰서 공격
    if ((this.attackQueued || g.input.isDown('Space')) && !p.dead && this.adjacentHostile()) return false;

    const kd = this.keyDir();
    if (kd >= 0) {
      if (w.tryMove(p, kd, leftover)) return true;
      // 미끄러짐: 인접 두 방향 시도 (화면상 비스듬한 벽을 따라 자연스럽게)
      for (const alt of [(kd + 1) % 8, (kd + 7) % 8]) {
        if (w.tryMove(p, alt, leftover)) return true;
      }
      p.dir = kd; // 막혀도 바라보는 방향은 바뀜
      return false;
    }

    if (this.target) {
      const t = this.target;
      if (t.dead) { this.target = null; return false; }
      if (chebyshev(p.x, p.y, t.x, t.y) <= 1) { p.dir = dirTowards(p.x, p.y, t.x, t.y); return false; }
      return this.stepAlong(t.x, t.y, true, leftover);
    }
    if (this.interact) {
      const t = this.interact;
      const reach = t.kind === 'drop' ? 0 : 1;
      if (chebyshev(p.x, p.y, t.x, t.y) <= reach) {
        this.interact = null;
        this.path = null;
        g.interactWith(t);
        return false;
      }
      return this.stepAlong(t.x, t.y, t.kind !== 'drop', leftover);
    }
    if (this.path && this.path.length) {
      const n = this.path[0];
      if (w.stepToward(p, n.x, n.y, leftover)) { this.path.shift(); return true; }
      // 엔티티에 막힘 → 재탐색
      const goal = this.path[this.path.length - 1];
      this.path = this.findPath(goal.x, goal.y, false);
      if (this.path && this.path.length && w.stepToward(p, this.path[0].x, this.path[0].y, leftover)) { this.path.shift(); return true; }
      this.path = null;
    }
    return false;
  }

  findPath(tx, ty, adjacent) {
    const w = this.game.world, p = this.p;
    return findPath(p.x, p.y, tx, ty, (fx, fy, nx, ny, isGoal) => {
      if (isGoal && adjacent) return false;
      // 멀리 있는 엔티티는 무시(움직이므로), 가까운 것만 장애물로 취급
      const near = chebyshev(p.x, p.y, nx, ny) <= 2;
      return w.canStep(fx, fy, nx, ny, p, !near);
    }, { allowAdjacent: adjacent });
  }

  stepAlong(tx, ty, adjacent, leftover) {
    const path = this.findPath(tx, ty, adjacent);
    if (!path || !path.length) return false;
    return this.game.world.stepToward(this.p, path[0].x, path[0].y, leftover);
  }

  moveTo(tx, ty) {
    this.target = null; this.interact = null;
    this.lastDestTile = { x: tx, y: ty };
    const w = this.game.world;
    let path = this.findPath(tx, ty, false);
    if (!path && !w.tileWalkable(tx, ty)) path = this.findPath(tx, ty, true); // 벽 클릭 → 그 앞까지
    this.path = path;
    if (path) this.game.bus.emit('ui:moveMarker', { x: tx, y: ty });
  }

  handleClick(sx, sy) {
    const g = this.game;
    const ent = g.renderer.pickEntity?.(sx, sy) ?? null;
    const t = g.renderer.screenToTile(sx, sy);
    const e = ent ?? (t ? g.world.entitiesAt(t.x, t.y).find((x) => x !== this.p) : null);
    if (e && e.kind === 'monster' && !e.dead && !this.p.dead) {
      this.target = e; this.path = null; this.interact = null;
      g.bus.emit('target:set', { entity: e });
      return;
    }
    if (e && (e.kind === 'npc' || e.kind === 'drop')) {
      this.interact = e; this.target = null; this.path = null;
      return;
    }
    if (t) this.moveTo(t.x, t.y);
  }

  adjacentHostile() {
    const p = this.p;
    return this.game.world.entities.find((e) => e.kind === 'monster' && !e.dead && chebyshev(p.x, p.y, e.x, e.y) === 1) || null;
  }

  // 공격 시도: 바라보는 칸 → 지정 대상 → 인접 적 자동 조준 순서
  doAttack(target) {
    const g = this.game, p = this.p, w = g.world;
    let t = target;
    if (!t) {
      const d = DIRS[p.dir];
      const front = w.blockerAt(p.x + d.dx, p.y + d.dy, p);
      if (front && front.kind === 'monster') t = front;
      else t = this.adjacentHostile();
    }
    if (t) p.dir = dirTowards(p.x, p.y, t.x, t.y);
    return g.systems.combat.tryAttack(p, t);
  }

  interactNearby() {
    const g = this.game, p = this.p;
    const d = DIRS[p.dir];
    const near = g.world.entities.filter((e) => e !== p && chebyshev(p.x, p.y, e.x, e.y) <= 1 && (e.kind === 'npc' || e.kind === 'drop'));
    near.sort((a, b) => (a.x === p.x + d.dx && a.y === p.y + d.dy ? -1 : 0) - (b.x === p.x + d.dx && b.y === p.y + d.dy ? -1 : 0)
      || (a.kind === 'drop' ? -1 : 1));
    if (near[0]) g.interactWith(near[0]);
  }

  cycleTarget() {
    const g = this.game, p = this.p;
    const mons = g.world.entities.filter((e) => e.kind === 'monster' && !e.dead && chebyshev(p.x, p.y, e.x, e.y) <= 10)
      .sort((a, b) => chebyshev(p.x, p.y, a.x, a.y) - chebyshev(p.x, p.y, b.x, b.y));
    if (!mons.length) return;
    const i = mons.indexOf(this.target);
    this.target = mons[(i + 1) % mons.length];
    g.bus.emit('target:set', { entity: this.target });
  }
}
