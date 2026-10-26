// 플레이어 사망/부활. 사망 → dead=true, ghost=true(혼) → 부활 지점으로 이동.
// 프롤로그(pro.reborn 이전): 페널티 없음, 세린 곁에서 자동 부활(혼 외형 유지).
// 이후: 소지 골드 10% 손실, 부활 지점(map.respawn, 없으면 로엔)에서 혼으로 걷다가 오드릭/제단 대화({revive:true})로 부활.
//       부활 지점에 오드릭이 없으면 잠시 후 자동 부활(막힘 방지).
import { setAnim } from '../world/entity.js';

const GOLD_PENALTY = 0.1;

export function createDeath(g, sys) {
  const death = {
    onPlayerDeath(killer) {
      const p = g.player, s = g.state;
      p.dead = true;
      p.ghost = true;
      p.move = null;
      p.buffs = [];
      setAnim(p, 'dead');
      g.controller?.clearOrders?.();
      sys.ai.dropAggro(p);
      const prologue = !s.flags['pro.reborn'];
      let lost = 0;
      if (!prologue && s.gold > 0) {
        lost = Math.floor(s.gold * GOLD_PENALTY);
        s.gold -= lost;
        g.bus.emit('gold:changed', { gold: s.gold, delta: -lost });
      }
      g.bus.emit('player:dead', { killer, goldLost: lost, prologue });
      g.bus.emit('fx:shake', { amount: 6, time: 0.5 });
      g.log(killer ? `${killer.name}에게 쓰러졌다…` : '쓰러졌다…', 'warn');
      if (lost) g.log(`혼이 흩어지며 ${lost} 골드를 잃었다.`, 'warn');
      sys.later(2.4, () => this.respawn(prologue));
    },

    respawnPoint() {
      const map = g.world.map, maps = g.data.maps;
      if (map?.respawn?.map && maps[map.respawn.map]) return map.respawn;
      const v = maps.village_roen;
      if (v) return { map: 'village_roen', ...(v.respawn?.map === 'village_roen' ? v.respawn : v.start) };
      return { map: map.id, ...(map.start || {}) };
    },

    respawn(prologue) {
      const p = g.player;
      if (!p?.dead) return;
      const r = this.respawnPoint();
      p.hp = prologue ? p.maxHp : 1;
      g.changeMap(r.map, r.x, r.y);
      g.timers.push({ t: 0.8, fn: () => {
        if (!p.dead) return;
        setAnim(p, 'idle');
        if (prologue) {
          sys.stats.revive(p, { ghost: true });
          g.log('기록자 세린의 곁에서 다시 눈을 떴다.', 'system');
        } else if (!g.findNpc('odric')) {
          g.log('혼이 되어 깨어났다. 잠시 후 몸을 되찾는다…', 'system');
          sys.later(3, () => { if (p.dead) sys.stats.revive(p); });
        } else {
          g.log('혼이 되어 깨어났다. 사제 오드릭에게 말을 걸어 부활하자.', 'system');
        }
      } });
    },
  };
  return death;
}
