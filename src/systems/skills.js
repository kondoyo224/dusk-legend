// 전사 스킬 6종 + 단축키(hotbar). 수치는 src/data/skills.js.
import { chebyshev, dirTowards, dirFromDelta, DIRS } from '../core/iso.js';
import { setAnim } from '../world/entity.js';
import { addBuff, hostile, isStunned } from './util.js';

export function createSkills(g, sys) {
  const cd = {};   // skillId → 준비되는 게임 시각

  const nearestHostile = (p, r) => g.world.entities
    .filter((e) => hostile(p, e) && chebyshev(p.x, p.y, e.x, e.y) <= r)
    .sort((a, b) => chebyshev(p.x, p.y, a.x, a.y) - chebyshev(p.x, p.y, b.x, b.y))[0] || null;

  // 단일 대상 자동 조준: 지정 대상 → 정면 → 인접 적
  function meleeTarget(p, given) {
    const cand = [given, g.controller?.target];
    for (const t of cand) if (t && hostile(p, t) && chebyshev(p.x, p.y, t.x, t.y) <= 1) return t;
    const d = DIRS[p.dir];
    const front = g.world.blockerAt(p.x + d.dx, p.y + d.dy, p);
    if (front && hostile(p, front)) return front;
    return nearestHostile(p, 1);
  }

  const IMPL = {
    power_strike(p, s, target) {
      const t = meleeTarget(p, target);
      if (!t) return { fail: '근처에 대상이 없습니다.' };
      p.dir = dirTowards(p.x, p.y, t.x, t.y);
      setAnim(p, 'attack');
      g.bus.emit('combat:attack', { attacker: p, target: t });
      sys.combat.strike(p, t, { mult: s.mult, skill: 'power_strike', knockback: true, shake: 5, hitstop: 0.08, critBonus: 0.1 });
      return { target: t, x: t.x, y: t.y };
    },

    whirlwind(p, s) {
      setAnim(p, 'attack');
      const tiles = [];
      for (let dy = -s.radius; dy <= s.radius; dy++) for (let dx = -s.radius; dx <= s.radius; dx++) if (dx || dy) tiles.push({ x: p.x + dx, y: p.y + dy });
      sys.combat.strikeTiles(p, tiles, { mult: s.mult, skill: 'whirlwind', knockback: true, shake: 4, hitstop: 0.06 });
      return { x: p.x, y: p.y, tiles };
    },

    charge(p, s, target) {
      let t = target && hostile(p, target) ? target : null;
      if (!t && g.controller?.target && hostile(p, g.controller.target)) t = g.controller.target;
      if (t && chebyshev(p.x, p.y, t.x, t.y) > s.range + 1) t = null;
      if (!t) t = nearestHostile(p, s.range + 1);
      if (!t) return { fail: '돌진할 대상이 없습니다.' };
      // 대상에게 인접할 때까지 직선(탐욕) 경로
      const w = g.world;
      let x = p.x, y = p.y, steps = 0;
      while (chebyshev(x, y, t.x, t.y) > 1 && steps < s.range) {
        const dir = dirFromDelta(t.x - x, t.y - y);
        let moved = false;
        for (const dd of [dir, (dir + 1) % 8, (dir + 7) % 8]) {
          const d = DIRS[dd];
          if (w.canStep(x, y, x + d.dx, y + d.dy, p) && chebyshev(x + d.dx, y + d.dy, t.x, t.y) < chebyshev(x, y, t.x, t.y)) {
            x += d.dx; y += d.dy; moved = true; break;
          }
        }
        if (!moved) break;
        steps++;
      }
      if (chebyshev(x, y, t.x, t.y) > 1) return { fail: '길이 막혀 돌진할 수 없습니다.' };
      const dur = 0.05 + steps * 0.045;
      if (steps > 0) {
        p.move = { fx: p.x, fy: p.y, tx: x, ty: y, t: 0, dur };
        p.x = x; p.y = y;
        setAnim(p, 'walk');
      }
      p.dir = dirTowards(x, y, t.x, t.y);
      if (g.controller) { g.controller.path = null; g.controller.target = t; }
      sys.later(steps > 0 ? dur : 0, () => {
        if (p.dead || t.dead) return;
        p.dir = dirTowards(p.x, p.y, t.x, t.y);
        setAnim(p, 'attack');
        g.bus.emit('combat:attack', { attacker: p, target: t });
        sys.combat.strike(p, t, { mult: s.mult, skill: 'charge', stun: s.stun, sureHit: true, shake: 6, hitstop: 0.09 });
      });
      return { target: t, x: t.x, y: t.y, from: { x: p.move?.fx ?? x, y: p.move?.fy ?? y } };
    },

    war_cry(p, s) {
      setAnim(p, 'cast');
      addBuff(p, { id: 'war_cry', t: s.duration, atk: s.atkBonus });
      for (const m of g.world.entitiesInRange(p.x, p.y, s.radius, (e) => hostile(p, e))) sys.ai.taunt(m, p);
      g.bus.emit('fx:shake', { amount: 3, time: 0.3 });
      return { x: p.x, y: p.y };
    },

    iron_wall(p, s) {
      setAnim(p, 'cast');
      addBuff(p, { id: 'iron_wall', t: s.duration, reduce: s.reduce, immune: true });
      return { x: p.x, y: p.y };
    },

    earth_splitter(p, s, target) {
      const t0 = meleeTarget(p, target) || nearestHostile(p, 2);
      if (t0) p.dir = dirTowards(p.x, p.y, t0.x, t0.y);
      const d = DIRS[p.dir];
      const tiles = [];
      for (let i = 1; i <= s.length; i++) {
        const x = p.x + d.dx * i, y = p.y + d.dy * i;
        if (!g.world.tileWalkable(x, y)) break;
        tiles.push({ x, y });
      }
      setAnim(p, 'attack');
      sys.combat.strikeTiles(p, tiles, { mult: s.mult, skill: 'earth_splitter', stun: 0.6, knockback: true, sureHit: true, shake: 8, hitstop: 0.1 });
      g.bus.emit('fx:shake', { amount: 7, time: 0.35 });
      return { x: p.x, y: p.y, tiles };
    },
  };

  const skills = {
    cooldowns: cd,

    learn(id) {
      const s = g.state;
      if (!g.data.skills[id]) { console.warn('알 수 없는 스킬', id); return false; }
      if (s.skills.includes(id)) return false;
      s.skills.push(id);
      // 빈 단축키 칸에 자동 등록 (1번부터)
      if (!s.hotbar.includes(id)) {
        const i = s.hotbar.findIndex((h, k) => !h && k < 6);
        if (i >= 0) s.hotbar[i] = id;
      }
      g.bus.emit('skill:learned', { id });
      g.bus.emit('ui:notice', { text: `스킬 습득: ${g.data.skills[id].name}`, sub: g.data.skills[id].desc });
      g.log(`[${g.data.skills[id].name}] 스킬을 배웠다. (K 키)`, 'system');
      return true;
    },

    cooldownLeft(id) { return Math.max(0, (cd[id] ?? 0) - g.time); },
    cooldownTotal(id) { return g.data.skills[id]?.cd ?? 0; },

    setHotbar(i, entry) {
      const hb = g.state.hotbar;
      if (i < 0 || i >= hb.length) return;
      // 같은 항목이 다른 칸에 있으면 비운다
      const key = (h) => (typeof h === 'string' ? h : h?.item ? 'i:' + h.item : null);
      const k = key(entry);
      if (k) for (let j = 0; j < hb.length; j++) if (key(hb[j]) === k) hb[j] = null;
      hb[i] = entry ?? null;
      g.bus.emit('hotbar:changed', {});
    },

    useSlot(i) {
      const h = g.state?.hotbar?.[i];
      if (!h) return false;
      if (typeof h === 'string') return this.use(g.player, h, null);
      if (h.item) return sys.inventory.useItemById(h.item);
      return false;
    },

    use(e, id, target) {
      const s = g.data.skills[id];
      if (!s || !e) return false;
      if (e.dead) return false;
      if (e.kind === 'player') {
        if (!g.state.skills.includes(id)) return false;
        if (g.cutscene || g.dialog?.isOpen) return false;
      }
      if (isStunned(e)) return false;
      if (e.move && id !== 'war_cry' && id !== 'iron_wall') {
        // 이동 중이면 도착 직후 실행되도록 짧게 예약
        if (!e._queuedSkill) { e._queuedSkill = { id, target, t: 0.4 }; }
        return true;
      }
      const left = this.cooldownLeft(id);
      if (left > 0) { g.log(`${s.name}: ${left.toFixed(1)}초 후 사용 가능`, 'warn'); return false; }
      if ((e.mp ?? 0) < s.mp) { g.log('MP가 부족합니다.', 'warn'); return false; }
      const r = IMPL[id]?.(e, s, target);
      if (!r || r.fail) { if (r?.fail) g.log(r.fail, 'warn'); return false; }
      e.mp -= s.mp;
      cd[id] = g.time + s.cd;
      e.atkReady = Math.max(e.atkReady ?? 0, g.time + 0.3);
      e.lastCombat = g.time;
      g.bus.emit('skill:cast', { caster: e, skillId: id, target: r.target ?? null, x: r.x ?? e.x, y: r.y ?? e.y, dir: e.dir, tiles: r.tiles, from: r.from, sound: s.sound });
      g.bus.emit('stats:changed', { entity: e });
      return true;
    },

    // 이동 중 예약된 스킬 처리
    update(dt) {
      const p = g.player;
      const q = p?._queuedSkill;
      if (!q) return;
      q.t -= dt;
      if (q.t <= 0 || p.dead) { p._queuedSkill = null; return; }
      if (!p.move) { p._queuedSkill = null; this.use(p, q.id, q.target); }
    },
  };
  return skills;
}
