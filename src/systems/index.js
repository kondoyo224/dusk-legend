// 게임플레이 시스템 진입점. 소유: 워커 B. 공개 API: docs/ARCHITECTURE.md §6.
// 모듈: stats(성장) / combat(전투) / skills(스킬·단축키) / ai(+bosses) / spawner / inventory / quests / death
import { setAnim } from '../world/entity.js';
import { createStats } from './stats.js';
import { createCombat } from './combat.js';
import { createSkills } from './skills.js';
import { createAI } from './ai.js';
import { createSpawner } from './spawner.js';
import { createInventory } from './inventory.js';
import { createQuests } from './quests.js';
import { createDeath } from './death.js';

export function createSystems(game) {
  const g = game;
  const timers = [];   // 시스템 내부 타이머 (히트스톱 동안 멈춤)
  const sys = {
    later(t, fn) { timers.push({ t, fn }); },
  };
  sys.stats = createStats(g, sys);
  sys.combat = createCombat(g, sys);
  sys.skills = createSkills(g, sys);
  sys.ai = createAI(g, sys);
  sys.spawner = createSpawner(g, sys);
  sys.inventory = createInventory(g, sys);
  sys.quests = createQuests(g, sys);
  sys.death = createDeath(g, sys);
  sys.projectiles = sys.ai.projectiles;
  sys.telegraphs = sys.ai.telegraphs;

  // 게임 시작/불러오기 시 장비 외형 동기화
  const syncPlayer = () => { if (g.state) { sys.inventory.applyLook(); sys.stats.recalc(g.player); } };
  g.bus.on('game:new', syncPlayer);
  g.bus.on('game:loaded', syncPlayer);
  g.bus.on('map:loaded', () => { timers.length = 0; });

  sys.update = (dt) => {
    if (!g.state) return;
    for (let i = timers.length - 1; i >= 0; i--) {
      const t = timers[i];
      t.t -= dt;
      if (t.t <= 0) { timers.splice(i, 1); try { t.fn(); } catch (err) { console.error('systems timer', err); } }
    }
    // 버프/넉백 연출 타이머, 행동 애니메이션 복귀
    for (const e of g.world.entities) {
      if (e.knock) { e.knock.t -= dt; if (e.knock.t <= 0) e.knock = null; }
      if (e.buffs?.length) {
        for (const b of e.buffs) b.t -= dt;
        const before = e.buffs.length;
        e.buffs = e.buffs.filter((b) => b.t > 0);
        if (e.kind === 'player' && e.buffs.length !== before) g.bus.emit('stats:changed', { entity: e });
      }
      const st = e.anim.state;
      if (!e.dead && !e.move && (st === 'attack' || st === 'hurt' || st === 'cast') && e.anim.t > 0.4 && !e.ai?.windup) setAnim(e, 'idle');
    }
    sys.stats.update(dt);
    sys.combat.tickDots(dt);
    sys.skills.update(dt);
    sys.ai.update(dt);
    sys.spawner.update(dt);
    sys.inventory.update(dt);
  };

  return sys;
}
