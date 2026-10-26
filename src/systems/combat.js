// 전투: 명중/회피/치명/방어, 공격 쿨다운, 타격감(히트스톱·흔들림·섬광·넉백), 사망·보상.
import { chebyshev, dirTowards, dirFromDelta, DIRS } from '../core/iso.js';
import { setAnim } from '../world/entity.js';
import { ATTACK_CD, rollRange, randInt, addBuff, isImmune, buffSum } from './util.js';

const CRIT_MUL = 1.7;
const CORPSE_TIME = 1.4;   // 사망 연출 후 엔티티 제거까지

export function createCombat(g, sys) {
  const combat = {
    // 공격 시도. target null 이면 허공 휘두르기(연출만). 성공 시 true.
    tryAttack(a, t) {
      if (!a || a.dead) return false;
      if (g.time < (a.atkReady ?? 0)) return false;
      if (t && (t.dead || chebyshev(a.x, a.y, t.x, t.y) > (a.range ?? 1))) return false;
      a.atkReady = g.time + (a.kind === 'player' ? ATTACK_CD : (a.attackSpeed ?? 1.4));
      if (t) a.dir = dirTowards(a.x, a.y, t.x, t.y);
      setAnim(a, 'attack');
      g.bus.emit('combat:attack', { attacker: a, target: t });
      if (!t) { a.atkReady = g.time + ATTACK_CD * 0.6; return true; }
      this.strike(a, t);
      return true;
    },

    // 명중 판정 → 피해. opts: {mult, skill, knockback, stun, sureHit, type, shake, hitstop}
    // 반환: 준 피해량, 빗나가면 -1
    strike(a, t, opts = {}) {
      if (!t || t.dead) return -1;
      const hitChance = Math.max(0.55, Math.min(0.98, 0.9 + ((a.hit ?? 0) - (t.eva ?? 0)) * 0.01 + (opts.skill ? 0.15 : 0)));
      if (!opts.sureHit && Math.random() > hitChance) {
        g.bus.emit('combat:miss', { source: a, target: t });
        a.lastCombat = t.lastCombat = g.time;
        if (t.kind === 'monster') sys.ai.onDamaged(t, a);
        return -1;
      }
      const crit = Math.random() < (a.crit ?? 0.05) + (opts.critBonus ?? 0);
      let raw = rollRange(a.atk || [1, 2]) * (opts.mult ?? 1) * sys.stats.atkMul(a);
      if (crit) raw *= CRIT_MUL;
      return this.damage(a, t, raw, {
        type: opts.type ?? (a.magic ? 'magic' : 'physical'), crit, skill: opts.skill,
        knockback: opts.knockback ?? crit, stun: opts.stun, shake: opts.shake, hitstop: opts.hitstop,
      });
    },

    // 피해 적용(방어 반영). type 'true' 는 방어 무시.
    damage(src, t, amount, o = {}) {
      if (!t || t.dead || amount <= 0) return 0;
      const type = o.type ?? 'physical';
      let dmg = amount;
      const def = sys.stats.defOf(t);
      if (type === 'physical') dmg *= 50 / (50 + def);
      else if (type === 'magic') dmg *= 50 / (50 + def * 0.5);
      dmg *= Math.max(0.1, 1 - buffSum(t, 'reduce'));
      dmg = Math.max(1, Math.round(dmg));
      t.hp -= dmg;
      t.flash = o.crit ? 0.22 : 0.15;
      t.lastCombat = g.time;
      if (src) src.lastCombat = g.time;
      // 넉백 연출(시각 오프셋): 렌더러가 e.knock {dx,dy,t,dur} 를 읽어 살짝 밀려나는 모습을 그린다
      if (src && src !== t) {
        const d = DIRS[dirTowards(src.x, src.y, t.x, t.y)] || { dx: 0, dy: 0 };
        t.knock = { dx: d.dx, dy: d.dy, t: 0.14, dur: 0.14, power: o.crit || o.skill ? 0.35 : 0.18 };
      }
      if (!t.move && t.anim.state !== 'attack' && t.anim.state !== 'cast') setAnim(t, 'hurt');
      g.bus.emit('combat:damage', { source: src, target: t, amount: dmg, crit: !!o.crit, type, skill: o.skill ?? null });

      // 타격감
      if (src?.kind === 'player') {
        g.hitstop(o.hitstop ?? (o.crit ? 0.08 : o.skill ? 0.065 : 0.045));
        if (o.crit || o.shake) g.bus.emit('fx:shake', { amount: o.shake ?? 4, time: 0.18 });
      } else if (t.kind === 'player') {
        g.hitstop(0.03);
        if (dmg >= t.maxHp * 0.12) g.bus.emit('fx:shake', { amount: 3, time: 0.15 });
      }

      // 몬스터 고유 효과
      if (src?.kind === 'monster' && t.kind === 'player') {
        const def0 = g.data.monsters[src.monsterId];
        if (def0?.lifesteal) src.hp = Math.min(src.maxHp, src.hp + Math.round(dmg * def0.lifesteal));
        if (def0?.poison && Math.random() < 0.35) {
          addBuff(t, { id: 'poison', t: def0.poison.time, dot: def0.poison.dps, src });
          g.log('독에 중독되었다!', 'combat');
        }
      }
      if (t.kind === 'monster') sys.ai.onDamaged(t, src);
      if (t.kind === 'player') g.bus.emit('stats:changed', { entity: t });

      if (t.hp <= 0) { this.kill(t, src); return dmg; }
      if (o.stun && !(t.kind === 'player')) {
        const time = t.boss ? o.stun * 0.3 : o.stun;
        addBuff(t, { id: 'stun', t: time, stun: true });
        g.bus.emit('fx:play', { id: 'stun', x: t.x, y: t.y });
      }
      if (o.knockback && t.kind === 'monster' && !isImmune(t) && src) this.pushBack(t, src);
      return dmg;
    },

    // 실제 1칸 밀어내기 (빠른 이동)
    pushBack(t, src) {
      if (t.move) return false;
      const dir = dirFromDelta(t.x - src.x, t.y - src.y);
      if (dir < 0) return false;
      const sm = t.speedMul;
      t.speedMul = 4;
      const ok = g.world.tryMove(t, dir);
      t.speedMul = sm;
      if (ok) { t.dir = (dir + 4) % 8; setAnim(t, 'hurt'); g.bus.emit('combat:knockback', { entity: t, dir }); }
      return ok;
    },

    // 지속 피해 틱 (독 등)
    tickDots(dt) {
      for (const e of g.world.entities) {
        if (e.dead || !e.buffs?.length) continue;
        const dps = buffSum(e, 'dot');
        if (!dps) continue;
        e._dotAcc = (e._dotAcc || 0) + dps * dt;
        if (e._dotAcc >= 1) {
          const n = Math.floor(e._dotAcc); e._dotAcc -= n;
          e.hp -= n;
          e.lastCombat = g.time;
          g.bus.emit('combat:damage', { source: null, target: e, amount: n, crit: false, type: 'true', skill: 'poison' });
          if (e.kind === 'player') g.bus.emit('stats:changed', { entity: e });
          if (e.hp <= 0) this.kill(e, e.buffs.find((b) => b.dot)?.src ?? null);
        }
      }
    },

    kill(t, killer) {
      if (!t || t.dead) return;
      t.hp = 0;
      t.dead = true;
      t.buffs = [];
      setAnim(t, 'dead');
      g.bus.emit('entity:died', { entity: t, killer });
      if (t.kind === 'player') { sys.death.onPlayerDeath(killer); return; }
      if (t.kind !== 'monster') return;
      t.blocking = false;
      if (g.controller?.target === t) g.controller.target = null;
      this.rewards(t, killer);
      sys.spawner.onDeath(t);
      sys.later(CORPSE_TIME, () => g.world.removeEntity(t));
    },

    rewards(t, killer) {
      const def = g.data.monsters[t.monsterId] || {};
      const p = g.player;
      if (!p) return;
      // 경험치: 레벨 차가 크면 감소
      const diff = p.level - t.level;
      const mul = diff > 5 ? Math.max(0.1, 1 - (diff - 5) * 0.15) : 1;
      const exp = Math.round((def.exp ?? t.level * 10) * mul * (t.expMul ?? 1));
      if (exp > 0) {
        sys.stats.gainExp(p, exp);
        g.log(`${t.name} 처치 — 경험치 +${exp}`, 'combat');
      }
      // 골드 & 드랍
      const gold = rollRange(def.gold);
      if (gold > 0) sys.inventory.dropGold(t.x, t.y, gold);
      if (t.noDrops) return;
      for (const d of def.drops || []) {
        if (Math.random() < d.chance) sys.inventory.dropItem(t.x, t.y, d.id, d.qty ?? 1);
      }
      // 공통 물약 드랍 (프롤로그 몬스터 제외)
      if (!(def.drops || []).some((d) => d.id === 'soul_vial')) {
        const potion = t.level < 8 ? 'red_potion' : t.level < 16 ? 'red_potion_m' : 'red_potion_l';
        if (Math.random() < 0.07) sys.inventory.dropItem(t.x, t.y, potion, 1);
        if (t.level >= 5 && Math.random() < 0.035) sys.inventory.dropItem(t.x, t.y, 'blue_potion', 1);
        if (t.level >= 8 && Math.random() < 0.015) sys.inventory.dropItem(t.x, t.y, 'return_scroll', 1);
      }
      if (t.boss) {
        g.hitstop(0.18);
        g.bus.emit('fx:shake', { amount: 9, time: 0.6 });
        g.bus.emit('ui:notice', { text: `${t.name} 격파!`, sub: '' });
        if (!t.minion) {
          g.state.flags[`boss.${t.monsterId}`] = true;
          g.bus.emit('flags:changed', { key: `boss.${t.monsterId}` });
        }
        sys.ai.onBossDefeated?.(t);
      }
    },

    // 범위 피해 도우미: tiles 위의 적대 엔티티에게 strike
    strikeTiles(a, tiles, opts) {
      const set = new Set(tiles.map((t) => t.x * 4096 + t.y));
      const hits = g.world.entities.filter((e) => !e.dead && e.faction !== a.faction && (e.kind === 'monster' || e.kind === 'player') && set.has(e.x * 4096 + e.y));
      for (const e of hits) this.strike(a, e, opts);
      return hits;
    },

    randInt,
  };
  return combat;
}
