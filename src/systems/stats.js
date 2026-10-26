// 스탯/성장/레벨업/자연회복/부활.
import { CLASSES, NO_CLASS } from '../data/classes.js';
import { setAnim } from '../world/entity.js';
import { MAX_LEVEL, buffSum } from './util.js';

const KEYS = ['str', 'dex', 'con', 'int', 'wis'];
export const STAT_NAMES = { str: '힘', dex: '민첩', con: '체력', int: '지능', wis: '지혜' };

export function createStats(g, sys) {
  const classDef = () => CLASSES[g.state?.cls] ?? NO_CLASS;

  // 장비 스탯 합계
  function equipSum() {
    const sum = { atk: null, def: 0, hp: 0, mp: 0, crit: 0, speed: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0 };
    const eq = g.state?.equipment || {};
    for (const slot in eq) {
      const it = eq[slot] && g.data.items[eq[slot].id];
      const s = it?.stats;
      if (!s) continue;
      for (const k in s) {
        if (k === 'atk') sum.atk = s.atk;
        else sum[k] = (sum[k] || 0) + s[k];
      }
    }
    return sum;
  }

  const stats = {
    names: STAT_NAMES,
    keys: KEYS,
    expToNext(level) { return level >= MAX_LEVEL ? Infinity : Math.round(40 * Math.pow(level, 1.85)); },

    // 플레이어 최종 스탯(기본+직업+성장+장비)
    effective(e) {
      const c = classDef(), eqs = equipSum(), out = {};
      for (const k of KEYS) {
        out[k] = (e.base?.[k] ?? 3) + (c.bonus[k] || 0) + Math.floor((e.level - 1) * (c.growth[k] || 0)) + (eqs[k] || 0);
      }
      return out;
    },

    recalc(e) {
      if (!e) return;
      if (e.kind !== 'player') { g.bus.emit('stats:changed', { entity: e }); return; }
      const c = classDef(), eqs = equipSum(), st = this.effective(e);
      e.stats = st;
      e.maxHp = Math.round(30 + st.con * 4 + e.level * c.hpPerLevel + eqs.hp);
      e.maxMp = Math.round(10 + st.int * 3 + e.level * c.mpPerLevel + eqs.mp);
      const w = eqs.atk || [2, 4];   // 맨손(프롤로그 혼의 주먹)
      e.atk = [Math.round(w[0] + st.str * 0.5), Math.round(w[1] + st.str * 0.7)];
      e.def = eqs.def + Math.floor(st.con * 0.5);
      e.hit = st.dex + e.level;
      e.eva = st.dex * 0.5 + e.level * 0.5;
      e.crit = Math.min(0.5, 0.05 + st.dex * 0.004 + eqs.crit);
      e.speedMul = 1 + eqs.speed;
      e.hp = Math.min(e.hp, e.maxHp);
      e.mp = Math.min(e.mp, e.maxMp);
      g.bus.emit('stats:changed', { entity: e });
    },

    // 전투용 유효 공격력 배율/방어력 (버프 반영)
    atkMul(e) { return 1 + buffSum(e, 'atk'); },
    defOf(e) { return (e.def || 0) + buffSum(e, 'def'); },

    gainExp(e, n) {
      if (!e || e.kind !== 'player' || n <= 0) return;
      if (e.level >= MAX_LEVEL) return;
      e.exp = (e.exp || 0) + Math.round(n);
      g.bus.emit('player:exp', { amount: Math.round(n) });
      let up = false;
      while (e.level < MAX_LEVEL && e.exp >= this.expToNext(e.level)) {
        e.exp -= this.expToNext(e.level);
        e.level++;
        g.state.statPoints += 2;
        up = true;
        this.recalc(e);
        e.hp = e.maxHp; e.mp = e.maxMp;
        g.bus.emit('player:levelup', { level: e.level });
        g.bus.emit('fx:play', { id: 'levelup', x: e.x, y: e.y });
        g.log(`레벨 ${e.level}이 되었다! 스탯 포인트 +2 (C 키)`, 'system');
      }
      if (e.level >= MAX_LEVEL) e.exp = 0;
      if (up) g.bus.emit('stats:changed', { entity: e });
    },

    setClass(e, cls) {
      if (!CLASSES[cls]) { console.warn('알 수 없는 직업', cls); return; }
      g.state.cls = cls;
      this.recalc(e);
      e.hp = e.maxHp; e.mp = e.maxMp;
      g.bus.emit('player:class', { cls });
      g.bus.emit('stats:changed', { entity: e });
    },

    allocate(key) {
      const s = g.state, p = g.player;
      if (!s || !KEYS.includes(key) || s.statPoints <= 0) return false;
      p.base[key] = (p.base[key] ?? 3) + 1;
      s.statPoints--;
      const hpRatio = p.hp / p.maxHp;
      this.recalc(p);
      if (key === 'con') p.hp = Math.min(p.maxHp, Math.round(p.maxHp * hpRatio) + 5);
      g.bus.emit('stats:changed', { entity: p });
      return true;
    },

    // 부활: dead 해제. 프롤로그(pro.reborn 이전)엔 혼의 외형 유지. opts.ghost 로 강제 지정 가능.
    revive(e, opts = {}) {
      e = e || g.player;
      e.dead = false;
      e.ghost = opts.ghost ?? !g.state?.flags?.['pro.reborn'];
      e.hp = e.maxHp; e.mp = e.maxMp;
      e.buffs = [];
      setAnim(e, 'idle');
      g.bus.emit('fx:play', { id: 'revive', x: e.x, y: e.y });
      g.bus.emit('player:revived', {});
      g.bus.emit('stats:changed', { entity: e });
    },

    // 자연 회복: 전투 이탈(6초) 후 빠르게
    update(dt) {
      const p = g.player;
      if (!p || p.dead) return;
      const st = p.stats || { con: 3, wis: 3 };
      const calm = g.time - (p.lastCombat ?? -99) > 6;
      const hpRate = calm ? p.maxHp * 0.03 + 1 : st.con * 0.04;
      const mpRate = (0.3 + st.wis * 0.12) * (calm ? 3 : 1);
      p._hpAcc = (p._hpAcc || 0) + hpRate * dt;
      p._mpAcc = (p._mpAcc || 0) + mpRate * dt;
      let changed = false;
      if (p._hpAcc >= 1) {
        const n = Math.floor(p._hpAcc); p._hpAcc -= n;
        if (p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + n); changed = true; }
      }
      if (p._mpAcc >= 1) {
        const n = Math.floor(p._mpAcc); p._mpAcc -= n;
        if (p.mp < p.maxMp) { p.mp = Math.min(p.maxMp, p.mp + n); changed = true; }
      }
      if (changed) g.bus.emit('stats:changed', { entity: p });
    },
  };
  return stats;
}
