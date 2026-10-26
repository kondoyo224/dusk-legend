// 보스 패턴. ai.think 의 chase 상태에서 매 프레임 tick(e, t, dt) 호출 → true 면 이번 프레임은 패턴이 차지.
// 패턴은 예고 장판(fx:telegraph) 후 판정 — 보고 피할 수 있게.
import { chebyshev, dirTowards, DIRS } from '../core/iso.js';
import { setAnim } from '../world/entity.js';
import { findFreeNear } from './util.js';

export function createBosses(g, sys, ai) {
  const W = () => g.world;

  // ── 도우미 ──
  const area = (cx, cy, r, inner = -1) => {
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= inner) continue;
      if (W().tileWalkable(cx + dx, cy + dy)) out.push({ x: cx + dx, y: cy + dy });
    }
    return out;
  };
  // 정면 부채꼴(거리 1..len, 좌우 폭 1)
  const cone = (e, dir, len) => {
    if (!(dir >= 0)) dir = e.dir ?? 0;   // 대상과 같은 칸이면 dirTowards = -1
    const out = [], seen = new Set();
    for (const dd of [dir, (dir + 1) % 8, (dir + 7) % 8]) {
      const v = DIRS[dd];
      for (let i = 1; i <= len; i++) {
        const x = e.x + v.dx * i, y = e.y + v.dy * i, k = x * 4096 + y;
        if (!W().tileWalkable(x, y)) break;
        if (!seen.has(k)) { seen.add(k); out.push({ x, y }); }
      }
    }
    return out;
  };
  const playerIn = (tiles) => {
    const p = g.player;
    return p && !p.dead && tiles.some((t) => t.x === p.x && t.y === p.y) ? p : null;
  };
  // 예고 후 판정. 보스는 시전 동안 멈춰 선다.
  function cast(e, tiles, time, kind, opts) {
    setAnim(e, 'cast');
    e.ai.windup = { t: time, fn: () => {
      setAnim(e, 'attack');
      g.bus.emit('combat:attack', { attacker: e, target: null });
      g.bus.emit('skill:cast', { caster: e, skillId: kind, target: null, x: e.x, y: e.y, dir: e.dir, tiles });
      const p = playerIn(tiles);
      if (p) sys.combat.strike(e, p, { mult: opts.mult, type: opts.type ?? 'physical', sureHit: true, critBonus: -1 });
      if (opts.shake) g.bus.emit('fx:shake', { amount: opts.shake, time: 0.3 });
      opts.after?.();
    } };
    g.bus.emit('fx:telegraph', { tiles, time, kind, source: e });
    return true;
  }
  function summon(e, id, n, opts = {}) {
    const b = e.ai.b;
    b.minions = (b.minions || []).filter((m) => !m.dead && W().entities.includes(m));
    for (let i = 0; i < n; i++) {
      const m = sys.spawner.spawnNear(id, e.x, e.y, { minion: true, noDrops: true, expMul: 0.25, hpMul: 0.7, atkMul: 0.65, ...opts });
      if (!m) continue;
      b.minions.push(m);
      g.bus.emit('fx:play', { id: 'summon', x: m.x, y: m.y });
      ai.engage(m, e.target ?? g.player);
    }
    setAnim(e, 'cast');
  }
  const say = (e, text) => g.say(e, text);
  const hpRatio = (e) => e.hp / e.maxHp;
  // 체력 구간 1회성 이벤트
  const once = (e, key, cond, fn) => { const b = e.ai.b; if (!b[key] && cond) { b[key] = true; fn(); return true; } return false; };
  function blink(e, t) {
    for (let k = 0; k < 12; k++) {
      const ang = Math.random() * Math.PI * 2, r = 4 + Math.random() * 2;
      const x = Math.round(t.x + Math.cos(ang) * r), y = Math.round(t.y + Math.sin(ang) * r);
      if (!W().isFree(x, y) || chebyshev(x, y, e.ai.home.x, e.ai.home.y) > e.ai.leash - 2) continue;
      g.bus.emit('fx:play', { id: 'blink', x: e.x, y: e.y });
      e.x = x; e.y = y; e.rx = x; e.ry = y; e.move = null; e.ai.path = null;
      g.bus.emit('fx:play', { id: 'blink', x, y });
      return true;
    }
    return false;
  }
  function leap(e, t, then) {
    const land = findFreeNear(W(), t.x, t.y, 2) ;
    if (!land) return then();
    const dur = 0.22;
    e.move = { fx: e.x, fy: e.y, tx: land.x, ty: land.y, t: 0, dur };
    e.x = land.x; e.y = land.y;
    e.dir = dirTowards(e.x, e.y, t.x, t.y);
    setAnim(e, 'attack');
    e.ai.windup = { t: dur, fn: then };
  }
  const timer = (b, key, dt) => { b[key] -= dt; return b[key] <= 0; };

  // ── 보스별 패턴 ──
  const P = {
    boss_warden(e, t, dt, b) {
      once(e, 'p50', hpRatio(e) < 0.5, () => { say(e, '…망각으로… 돌아가라…'); summon(e, 'lost_soul', 2); });
      if (timer(b, 'slam', dt) && chebyshev(e.x, e.y, t.x, t.y) <= 2) {
        b.slam = 7;
        return cast(e, area(e.x, e.y, 1, 0), 0.85, 'boss_sweep', { mult: 1.5, shake: 5 });
      }
      return false;
    },
    boss_ratking(e, t, dt, b) {
      once(e, 'enrage', hpRatio(e) < 0.4, () => { say(e, '끼이이익!!'); e.speedMul = 1.3; e.attackSpeed *= 0.75; });
      if (timer(b, 'summon', dt)) {
        b.summon = 11;
        const alive = (b.minions || []).filter((m) => !m.dead).length;
        if (alive < 4) { summon(e, 'cellar_rat', 2); e.ai.windup = { t: 0.5, fn: () => {} }; return true; }
      }
      return false;
    },
    boss_grimfang(e, t, dt, b) {
      once(e, 'h60', hpRatio(e) < 0.6, () => { say(e, '아우우우─!'); summon(e, 'wolf', 1); });
      once(e, 'h30', hpRatio(e) < 0.3, () => { say(e, '크르르… 아우우우─!'); summon(e, 'wolf', 2); e.attackSpeed *= 0.8; e.speedMul = 1.15; });
      const d = chebyshev(e.x, e.y, t.x, t.y);
      if (timer(b, 'leap', dt) && d >= 2 && d <= 7) {
        b.leap = 7;
        const tiles = area(t.x, t.y, 1);
        return cast(e, tiles, 0.75, 'boss_leap', { mult: 0, after: () => {
          leap(e, t, () => {
            g.bus.emit('fx:shake', { amount: 6, time: 0.3 });
            g.bus.emit('skill:cast', { caster: e, skillId: 'boss_leap_land', target: null, x: e.x, y: e.y, dir: e.dir, tiles });
            const p = playerIn(tiles);
            if (p) sys.combat.strike(e, p, { mult: 1.6, sureHit: true, critBonus: -1 });
          });
        } });
      }
      if (b.leap > 4 && timer(b, 'bite', 0) && d <= 1 && hpRatio(e) < 0.6) {
        b.bite = 9;
        return cast(e, cone(e, dirTowards(e.x, e.y, t.x, t.y), 2), 0.6, 'boss_claw', { mult: 1.4, shake: 3 });
      }
      return false;
    },
    boss_graus(e, t, dt, b) {
      once(e, 'h66', hpRatio(e) < 0.66, () => { say(e, '일어나라… 잠든 자들이여…'); summon(e, 'skeleton', 3); });
      once(e, 'h33', hpRatio(e) < 0.33, () => { say(e, '묘지는… 아무도… 떠나지 못한다…'); summon(e, 'skeleton', 2); summon(e, 'zombie', 1); e.attackSpeed *= 0.75; });
      if (timer(b, 'slam', dt) && chebyshev(e.x, e.y, t.x, t.y) <= 3) {
        b.slam = 8;
        return cast(e, area(e.x, e.y, 2, 0), 1.0, 'boss_slam', { mult: 1.7, shake: 8 });
      }
      return false;
    },
    boss_belzar(e, t, dt, b) {
      once(e, 'h50', hpRatio(e) < 0.5, () => { say(e, '교단의 아이들아, 나를 지켜라!'); summon(e, 'cultist', 2); });
      once(e, 'h25', hpRatio(e) < 0.25, () => { say(e, '원령들이여, 이 자의 혼을 뜯어라!'); summon(e, 'wraith', 2); });
      const d = chebyshev(e.x, e.y, t.x, t.y);
      b.adj = d <= 1 ? (b.adj || 0) + dt : 0;
      if (b.adj > 2.2) { b.adj = 0; if (blink(e, t)) { setAnim(e, 'cast'); e.ai.windup = { t: 0.4, fn: () => {} }; return true; } }
      if (timer(b, 'rain', dt) && d <= 8) {
        b.rain = hpRatio(e) < 0.5 ? 4.5 : 6;
        return cast(e, area(t.x, t.y, 1), 1.1, 'boss_dark_rain', { mult: 1.6, type: 'magic', shake: 4 });
      }
      return false;
    },
    boss_dusk_king(e, t, dt, b) {
      const p2 = hpRatio(e) < 0.5;
      once(e, 'phase2', p2, () => {
        say(e, '그림자는… 하나가 아니다.');
        g.bus.emit('ui:notice', { text: '황혼의 왕이 그림자를 찢어 낸다', sub: '2페이즈' });
        g.bus.emit('fx:shake', { amount: 8, time: 0.6 });
        summon(e, 'rift_shade', 2, { name: '왕의 그림자 분신', hpMul: 0.45, atkMul: 0.45, level: 20 });
        e.speedMul = 1.15;
      });
      once(e, 'h25', hpRatio(e) < 0.25, () => { say(e, '황혼은… 끝나지 않는다.'); summon(e, 'rift_shade', 2, { name: '왕의 그림자 분신', hpMul: 0.45, atkMul: 0.45, level: 20 }); });
      const d = chebyshev(e.x, e.y, t.x, t.y);
      if (p2 && timer(b, 'wave', dt)) {
        b.wave = 10;
        return cast(e, area(e.x, e.y, 3, 0), 1.2, 'boss_dusk_wave', { mult: 1.4, type: 'magic', shake: 9 });
      }
      if (timer(b, 'cleave', dt) && d <= 2) {
        b.cleave = p2 ? 5 : 6.5;
        return cast(e, cone(e, dirTowards(e.x, e.y, t.x, t.y), 2), 0.7, 'boss_cleave', { mult: 1.8, shake: 6 });
      }
      return false;
    },
    boss_rift_lord(e, t, dt, b) {
      const shadow = { name: '균열의 메아리', hpMul: 0.5, atkMul: 0.5, level: 26 };
      once(e, 'h66', hpRatio(e) < 0.66, () => { say(e, '경계를 지키는 자여… 너도 망각에 삼켜져라.'); summon(e, 'rift_horror', 1, shadow); summon(e, 'rift_shade', 2, shadow); });
      once(e, 'h33', hpRatio(e) < 0.33, () => { say(e, '균열이… 넓어진다…!'); summon(e, 'rift_horror', 2, shadow); e.attackSpeed *= 0.8; e.speedMul = 1.2; });
      const d = chebyshev(e.x, e.y, t.x, t.y);
      if (timer(b, 'wave', dt)) {
        b.wave = hpRatio(e) < 0.33 ? 6 : 8;
        return cast(e, area(e.x, e.y, 3, 0), 1.1, 'boss_dusk_wave', { mult: 1.5, type: 'magic', shake: 9 });
      }
      if (timer(b, 'rain', dt) && d <= 8 && hpRatio(e) < 0.66) {
        b.rain = 7;
        return cast(e, area(t.x, t.y, 1), 1.0, 'boss_dark_rain', { mult: 1.5, type: 'magic', shake: 4 });
      }
      if (timer(b, 'cleave', dt) && d <= 2) {
        b.cleave = 5;
        return cast(e, cone(e, dirTowards(e.x, e.y, t.x, t.y), 3), 0.7, 'boss_cleave', { mult: 1.9, shake: 6 });
      }
      return false;
    },
  };

  const FINAL = new Set(['dusk_king', 'rift_lord']);
  const fresh = () => ({ slam: 4, summon: 5, leap: 3, bite: 0, rain: 4, cleave: 3, wave: 6, minions: [] });

  return {
    intro(e) {
      e.ai.b = e.ai.b || fresh();
      g.bus.emit('ui:notice', { text: e.name, sub: `Lv ${e.level}` });
      g.bus.emit('bgm', { id: FINAL.has(e.monsterId) ? 'final' : 'boss' });
      g.bus.emit('boss:engaged', { entity: e });
    },
    tick(e, t, dt) {
      const fn = P[e.ai.type];
      if (!fn) return false;
      e.ai.b = e.ai.b || fresh();
      return fn(e, t, dt, e.ai.b);
    },
    reset(e) {
      const def = g.data.monsters[e.monsterId];
      for (const m of e.ai.b?.minions || []) if (!m.dead) { sys.ai.goHome(m); g.world.removeEntity(m); }
      e.ai.b = null;
      e.ai.engaged = false;
      e.hp = e.maxHp;
      if (def) { e.attackSpeed = def.attackSpeed; e.speedMul = 1; }
      if (W().map?.bgm) g.bus.emit('bgm', { id: W().map.bgm });
      g.bus.emit('boss:reset', { entity: e });
    },
    defeated(e) {
      for (const m of e.ai?.b?.minions || []) if (!m.dead) sys.combat.kill(m, g.player);
      if (W().map?.bgm) g.bus.emit('bgm', { id: W().map.bgm });
      g.bus.emit('boss:defeated', { entity: e, id: e.monsterId });
    },
  };
}
