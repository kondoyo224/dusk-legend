// 몬스터 AI(배회→감지→추적→공격, 리쉬 복귀) + NPC 배회 + 투사체/예고 장판.
// 상태: idle(배회) / chase(추적·공격) / return(집으로 복귀, 회복)
import { findPath } from '../core/pathfind.js';
import { chebyshev, dirTowards, dirFromDelta, DIRS } from '../core/iso.js';
import { setAnim } from '../world/entity.js';
import { hostile, isStunned, lineOfSight } from './util.js';
import { createBosses } from './bosses.js';

const MELEE_WINDUP = 0.28;
const HEAVY_WINDUP = 0.45;
const SHOT_WINDUP = 0.4;
const CAST_WINDUP = 0.6;

export function createAI(g, sys) {
  const W = () => g.world;
  const projectiles = [];   // 렌더러가 직접 읽어도 된다: {kind, x, y, fx, fy, tx, ty, t, dur}
  const telegraphs = [];    // {tiles:[{x,y}], t, total, kind}

  const mdef = (e) => g.data.monsters[e.monsterId] || {};
  const valid = (e, t) => t && !t.dead && W().entities.includes(t) && hostile(e, t);

  // ── 이동 ──
  function tryStepWith(e, dir, lo, mul) {
    const sm = e.speedMul;
    e.speedMul = (sm ?? 1) * mul;
    const ok = W().tryMove(e, dir, lo);
    e.speedMul = sm;
    return ok;
  }

  function computePath(e, tx, ty, adjacent) {
    return findPath(e.x, e.y, tx, ty, (fx, fy, nx, ny, isGoal) => {
      if (isGoal && adjacent) return false;
      const near = chebyshev(e.x, e.y, nx, ny) <= 2;
      return W().canStep(fx, fy, nx, ny, e, !near);
    }, { allowAdjacent: adjacent, maxNodes: 600 });
  }

  // 대상(또는 지점)으로 한 칸. 이동을 시작하면 true
  function moveToward(e, tx, ty, lo = 0, adjacent = true) {
    const a = e.ai, w = W();
    const goalMoved = !a.goal || chebyshev(a.goal.x, a.goal.y, tx, ty) > 1;
    if (!a.path || !a.path.length || a.pathT <= 0 || goalMoved) {
      a.path = computePath(e, tx, ty, adjacent);
      a.pathT = 0.5 + Math.random() * 0.3;
      a.goal = { x: tx, y: ty };
    }
    const mul = a.state === 'return' ? 1.25 : 1;
    if (a.path && a.path.length) {
      const n = a.path[0];
      const dir = dirFromDelta(n.x - e.x, n.y - e.y);
      if (chebyshev(n.x, n.y, e.x, e.y) === 1 && dir >= 0 && tryStepWith(e, dir, lo, mul)) { a.path.shift(); a.stuck = 0; return true; }
      a.path = null; a.pathT = 0;
    }
    // 경로 실패 → 대상 방향 ±1 탐욕 이동
    const d0 = dirTowards(e.x, e.y, tx, ty);
    if (d0 < 0) return false;   // 이미 같은 칸
    const before = chebyshev(e.x, e.y, tx, ty);
    for (const d of [d0, (d0 + 1) % 8, (d0 + 7) % 8]) {
      const v = DIRS[d];
      if (chebyshev(e.x + v.dx, e.y + v.dy, tx, ty) >= before) continue;
      if (w.canStep(e.x, e.y, e.x + v.dx, e.y + v.dy, e) && tryStepWith(e, d, lo, mul)) { a.stuck = 0; return true; }
    }
    return false;
  }

  function inRange(e, t, d = chebyshev(e.x, e.y, t.x, t.y)) {
    const r = e.range ?? 1;
    if (d > r) return false;
    return r <= 1 || lineOfSight(W(), e.x, e.y, t.x, t.y);
  }

  // ── 공격 개시(예비 동작 → 판정) ──
  function startAttack(e, t) {
    const def = mdef(e), a = e.ai;
    e.atkReady = g.time + (e.attackSpeed ?? 1.4) * (0.9 + Math.random() * 0.2);
    e.dir = dirTowards(e.x, e.y, t.x, t.y);
    if ((e.range ?? 1) <= 1) {
      setAnim(e, 'attack');
      a.windup = {
        t: def.heavy ? HEAVY_WINDUP : MELEE_WINDUP,
        fn: () => {
          if (!valid(e, t)) return;
          g.bus.emit('combat:attack', { attacker: e, target: t });
          if (chebyshev(e.x, e.y, t.x, t.y) <= 1) sys.combat.strike(e, t);
          else g.bus.emit('combat:miss', { source: e, target: t });
        },
      };
    } else {
      const caster = def.ai === 'caster' || def.magic;
      setAnim(e, caster ? 'cast' : 'attack');
      a.windup = {
        t: caster ? CAST_WINDUP : SHOT_WINDUP,
        fn: () => {
          if (!valid(e, t)) return;
          g.bus.emit('combat:attack', { attacker: e, target: t });
          ai.shoot(e, t, { kind: def.projectile ?? (caster ? 'dark_bolt' : 'arrow'), type: def.magic ? 'magic' : 'physical' });
        },
      };
    }
  }

  const ai = {
    projectiles,
    telegraphs,

    init(e) {
      const def = mdef(e);
      e.ai = { type: def.ai ?? 'melee', state: 'idle', home: { x: e.x, y: e.y }, wanderT: 1 + Math.random() * 3, pathT: 0, path: null, stuck: 0,
        leash: Math.max(10, (e.aggro ?? 6) + 8) + (e.boss ? 4 : 0) };
      e.nextStep = (lo) => this.continueMove(e, lo);
    },

    engage(e, t) {
      if (!e.ai || e.dead || !t || t.dead) return;
      const first = !e.ai.engaged;
      if (e.ai.state !== 'chase') { e.ai.path = null; e.ai.pathT = 0; }
      e.ai.state = 'chase';
      e.target = t;
      e.ai.engaged = true;
      e.ai.lastSeen = g.time;
      if (e.boss && !e.minion && first) bosses.intro(e);
    },

    onDamaged(e, src) {
      if (!e.ai || e.dead || !src || !hostile(e, src)) return;
      if (e.ai.state === 'return' && !e.boss && chebyshev(e.x, e.y, e.ai.home.x, e.ai.home.y) > e.ai.leash) return;
      this.engage(e, src);
      // 주변 동족 합류
      for (const o of W().entities) {
        if (o === e || o.kind !== 'monster' || o.dead || o.ai?.state !== 'idle') continue;
        if (chebyshev(o.x, o.y, e.x, e.y) <= 4) this.engage(o, src);
      }
    },

    taunt(e, t) { this.engage(e, t); if (e.ai) e.ai.tauntT = 4; },

    goHome(e) {
      const a = e.ai;
      a.state = 'return'; a.path = null; a.pathT = 0; a.windup = null; a.stuck = 0;
      e.target = null;
      if (e.boss) bosses.reset(e);
    },

    // 플레이어 사망 시 모두 해산
    dropAggro(t) { for (const e of W().entities) if (e.kind === 'monster' && e.target === t && !e.dead) this.goHome(e); },

    continueMove(e, lo) {
      const a = e.ai;
      if (!a || e.dead || a.windup || isStunned(e) || this.paused()) return false;
      if (a.state === 'chase' && valid(e, e.target)) {
        if (inRange(e, e.target)) return false;
        return moveToward(e, e.target.x, e.target.y, lo);
      }
      if (a.state === 'return') {
        if (e.x === a.home.x && e.y === a.home.y) return false;
        return moveToward(e, a.home.x, a.home.y, lo, false);
      }
      return false;
    },

    paused() { return g.cutscene || g.dialog?.isOpen || !!g.transition; },

    think(e, dt) {
      const a = e.ai;
      if (!a) return;
      a.pathT -= dt;
      if (a.tauntT > 0) a.tauntT -= dt;
      if (isStunned(e)) { a.windup = null; return; }
      if (a.windup) {
        a.windup.t -= dt;
        if (a.windup.t <= 0) { const w = a.windup; a.windup = null; w.fn(); }
        return;
      }
      const p = g.player;
      if (a.state === 'idle') {
        const def = mdef(e);
        if (p && !p.dead && def.ai !== 'passive' && !W().map?.safe && chebyshev(e.x, e.y, p.x, p.y) <= (e.aggro ?? 6)
          && lineOfSight(W(), e.x, e.y, p.x, p.y)) { this.engage(e, p); return; }
        this.wander(e, dt, 3, 0.55);
        return;
      }
      if (a.state === 'return') {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2 * dt);
        if (e.x === a.home.x && e.y === a.home.y) { a.state = 'idle'; e.hp = e.maxHp; a.engaged = false; return; }
        if (!e.move && !moveToward(e, a.home.x, a.home.y, 0, false)) {
          a.stuck += dt;
          if (a.stuck > 2) { a.home = { x: e.x, y: e.y }; }
        }
        return;
      }
      // chase
      const t = e.target;
      if (!valid(e, t)) { this.goHome(e); return; }
      const homeD = chebyshev(e.x, e.y, a.home.x, a.home.y);
      if (homeD > a.leash && !(a.tauntT > 0)) { this.goHome(e); return; }
      if (e.boss && bosses.tick(e, t, dt)) return;
      const d = chebyshev(e.x, e.y, t.x, t.y);
      if (inRange(e, t, d)) {
        if (e.move) return;
        a.stuck = 0;
        // 원거리: 붙으면 가끔 한 칸 물러선다
        if ((e.range ?? 1) > 1 && d <= 1 && (a.kiteT ?? 0) <= g.time && Math.random() < 0.5) {
          a.kiteT = g.time + 2;
          const away = dirTowards(t.x, t.y, e.x, e.y);
          if (away >= 0) for (const dd of [away, (away + 1) % 8, (away + 7) % 8]) {   // 같은 칸(d=0)이면 -1 → DIRS[-1] 크래시 방지
            const v = DIRS[dd];
            if (W().canStep(e.x, e.y, e.x + v.dx, e.y + v.dy, e) && tryStepWith(e, dd, 0, 1)) return;
          }
        }
        e.dir = dirTowards(e.x, e.y, t.x, t.y);
        if (g.time >= (e.atkReady ?? 0)) startAttack(e, t);
        return;
      }
      if (!e.move && !moveToward(e, t.x, t.y)) {
        a.stuck += dt;
        if (a.stuck > 4 && d > 2) this.goHome(e);
      }
    },

    // 배회 (몬스터·NPC 공용). radius: home 기준 반경
    wander(e, dt, radius, mul) {
      if (e.move || radius <= 0) return;
      e._wT = (e._wT ?? Math.random() * 3) - dt;
      if (e._wT > 0) return;
      e._wT = 2 + Math.random() * 4;
      const home = e.ai?.home ?? e.home ?? { x: e.x, y: e.y };
      for (let k = 0; k < 4; k++) {
        const dir = Math.floor(Math.random() * 8), v = DIRS[dir];
        const nx = e.x + v.dx, ny = e.y + v.dy;
        if (chebyshev(nx, ny, home.x, home.y) > radius) continue;
        if (!W().canStep(e.x, e.y, nx, ny, e)) continue;
        if (W().map?.portals?.some((pt) => pt.x === nx && pt.y === ny)) continue;
        if (tryStepWith(e, dir, 0, mul)) return;
      }
    },

    // ── 투사체: 착탄 시점에 대상이 그 칸을 벗어났으면 회피 ──
    shoot(e, t, o = {}) {
      const dist = Math.hypot(t.x - e.x, t.y - e.y);
      const pr = { kind: o.kind ?? 'arrow', src: e, target: t, fx: e.x, fy: e.y, tx: t.x, ty: t.y, x: e.x, y: e.y, t: 0, dur: 0.12 + dist * 0.07, mult: o.mult ?? 1, type: o.type ?? 'physical' };
      projectiles.push(pr);
      g.bus.emit('fx:projectile', { kind: pr.kind, from: { x: pr.fx, y: pr.fy }, to: { x: pr.tx, y: pr.ty }, time: pr.dur, source: e });
    },

    // ── 예고 장판: 시간이 지나면 fn 실행 ──
    telegraph(tiles, time, kind, fn) {
      const tg = { tiles, t: time, total: time, kind, fn };
      telegraphs.push(tg);
      g.bus.emit('fx:telegraph', { tiles, time, kind });
      return tg;
    },

    update(dt) {
      if (!g.state) return;
      if (this.paused()) return;
      for (const e of [...W().entities]) {
        if (e.dead) continue;
        if (e.kind === 'monster') this.think(e, dt);
        else if (e.kind === 'npc' && e.wander > 0 && !g.cutscene && g.dialog?.npc !== e) {
          const p = g.player;
          if (p && chebyshev(p.x, p.y, e.x, e.y) <= 1) continue;   // 말 걸려는 플레이어 곁에선 멈춘다
          this.wander(e, dt, e.wander, 0.45);
        }
      }
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];
        pr.t += dt;
        const k = Math.min(1, pr.t / pr.dur);
        pr.x = pr.fx + (pr.tx - pr.fx) * k; pr.y = pr.fy + (pr.ty - pr.fy) * k;
        if (k < 1) continue;
        projectiles.splice(i, 1);
        const t = pr.target;
        if (t && !t.dead && t.x === pr.tx && t.y === pr.ty) sys.combat.strike(pr.src, t, { mult: pr.mult, type: pr.type });
        else g.bus.emit('combat:miss', { source: pr.src, target: t });
      }
      for (let i = telegraphs.length - 1; i >= 0; i--) {
        const tg = telegraphs[i];
        tg.t -= dt;
        if (tg.t > 0) continue;
        telegraphs.splice(i, 1);
        try { tg.fn?.(); } catch (err) { console.error('telegraph', err); }
      }
    },

    clear() { projectiles.length = 0; telegraphs.length = 0; },
  };

  const bosses = createBosses(g, sys, ai);
  ai.onBossDefeated = (e) => bosses.defeated(e);
  return ai;
}
