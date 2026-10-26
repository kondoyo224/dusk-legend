// 스포너: map.spawns 처리, 리스폰, spawnNear. 보스 1회성은 맵 데이터의 spawn.cond(예: {notFlag:'boss.grimfang'})로 처리.
// spawn = {monster, x, y, w, h, count, respawn(초, 0=안 함), cond?}
import { chebyshev } from '../core/iso.js';
import { makeEntity } from '../world/entity.js';
import { findFreeNear } from './util.js';

export function createSpawner(g, sys) {
  let groups = [];
  let queue = [];     // {t, grp}
  let pollT = 0;

  function makeMonster(id, x, y, opts = {}) {
    const def = g.data.monsters[id];
    if (!def) { console.warn('몬스터 정의 없음', id); return null; }
    const lv = opts.level ?? def.level;
    const hpMul = opts.hpMul ?? 1, atkMul = opts.atkMul ?? 1;
    const hp = Math.round(def.hp * hpMul);
    const e = makeEntity('monster', {
      monsterId: id, name: opts.name ?? def.name, x, y, dir: Math.floor(Math.random() * 8),
      level: lv, faction: 'monster', boss: !!(opts.boss ?? def.boss), minion: !!opts.minion,
      hp, maxHp: hp, mp: 0, maxMp: 0,
      atk: (def.atk || [1, 2]).map((v) => Math.round(v * atkMul)), def: def.def ?? 0,
      hit: lv + 2, eva: lv * 1.2 + (def.speed >= 4 ? 4 : 0), crit: def.boss ? 0.08 : 0.05,
      speed: def.speed ?? 2.6, attackSpeed: def.attackSpeed ?? 1.4, range: def.range ?? 1, aggro: def.aggro ?? 6,
      magic: !!def.magic, look: { ...(def.look || {}), ...(opts.look || {}) },
      expMul: opts.expMul ?? 1, noDrops: !!opts.noDrops, buffs: [],
    });
    sys.ai.init(e);
    return e;
  }

  function spawnInGroup(grp) {
    const s = grp.s, w = g.world, p = g.player;
    const W = s.w ?? 1, H = s.h ?? 1;
    let pos = null;
    for (let k = 0; k < 24 && !pos; k++) {
      const x = s.x + Math.floor(Math.random() * W), y = s.y + Math.floor(Math.random() * H);
      if (!w.isFree(x, y)) continue;
      if (grp.spawned && p && chebyshev(x, y, p.x, p.y) < 4) continue;   // 리스폰은 눈앞에서 튀어나오지 않게
      pos = { x, y };
    }
    pos = pos || findFreeNear(w, s.x + Math.floor(W / 2), s.y + Math.floor(H / 2), 4);
    if (!pos) return null;
    const e = makeMonster(s.monster, pos.x, pos.y, { boss: s.boss, name: s.name, level: s.level });
    if (!e) return null;
    e.spawnGroup = grp;
    grp.alive++;
    g.world.addEntity(e);
    return e;
  }

  function fillGroup(grp) {
    if (grp.s.cond && !g.script.check(grp.s.cond)) return;
    const n = (grp.s.count ?? 1) - grp.alive - queue.filter((q) => q.grp === grp).length;
    for (let i = 0; i < n; i++) spawnInGroup(grp);
    grp.spawned = true;
  }

  const spawner = {
    spawnNear(id, x, y, opts = {}) {
      const pos = findFreeNear(g.world, x, y, 5);
      if (!pos) return null;
      const e = makeMonster(id, pos.x, pos.y, opts);
      if (!e) return null;
      g.world.addEntity(e);
      if (opts.boss || e.boss) g.bus.emit('fx:play', { id: 'boss_appear', x: e.x, y: e.y });
      return e;
    },

    onMapLoaded(map) {
      groups = []; queue = [];
      sys.ai.clear();
      for (const s of map.spawns || []) {
        if (!s.monster) continue;
        const grp = { s, alive: 0, spawned: false };
        groups.push(grp);
        fillGroup(grp);
      }
    },

    onDeath(e) {
      const grp = e.spawnGroup;
      if (!grp || !groups.includes(grp)) return;
      grp.alive = Math.max(0, grp.alive - 1);
      const r = grp.s.respawn ?? 0;
      if (r > 0) queue.push({ t: r * (0.8 + Math.random() * 0.4), grp });
    },

    update(dt) {
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        q.t -= dt;
        if (q.t > 0) continue;
        queue.splice(i, 1);
        if (q.grp.s.cond && !g.script.check(q.grp.s.cond)) continue;
        if (q.grp.alive < (q.grp.s.count ?? 1)) spawnInGroup(q.grp);
      }
      // 조건부 그룹: 플래그가 켜지면 그때 등장
      pollT -= dt;
      if (pollT <= 0) {
        pollT = 1;
        for (const grp of groups) if (!grp.spawned) fillGroup(grp);
      }
    },
  };

  g.bus.on('map:loaded', ({ map }) => spawner.onMapLoaded(map));
  return spawner;
}
