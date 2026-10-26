// 데이터 주도 스크립트: 조건(check)과 액션(run). 형식 명세는 docs/ARCHITECTURE.md §스크립트.
// run() 은 비동기 순차 실행 — wait/dialog/moveNpc 는 끝날 때까지 기다린다(컷신 연출용).
export class Script {
  constructor(game) { this.game = game; }

  check(c) {
    const g = this.game, s = g.state;
    if (c == null) return true;
    if (typeof c === 'function') return !!c(g);
    if (Array.isArray(c)) return c.every((x) => this.check(x));
    if (c.all) return c.all.every((x) => this.check(x));
    if (c.any) return c.any.some((x) => this.check(x));
    if (c.not) return !this.check(c.not);
    if ('flag' in c) return 'eq' in c ? s.flags[c.flag] === c.eq : !!s.flags[c.flag];
    if ('notFlag' in c) return !s.flags[c.notFlag];
    if ('quest' in c) return g.systems.quests.stateOf(c.quest) === (c.state ?? 'done');
    if ('item' in c) return g.systems.inventory.count(c.item) >= (c.qty ?? 1);
    if ('level' in c) return g.player.level >= c.level;
    if ('class' in c) return (s.cls ?? null) === c.class;
    if ('gold' in c) return s.gold >= c.gold;
    console.warn('알 수 없는 조건', c);
    return false;
  }

  async run(actions) {
    if (!actions) return;
    if (!Array.isArray(actions)) actions = [actions];
    for (const a of actions) await this.exec(a);
  }

  async exec(a) {
    const g = this.game, s = g.state, sys = g.systems;
    if (typeof a === 'function') return a(g);
    const fmt = (t) => g.format(t);
    if ('if' in a) return this.run(this.check(a.if) ? a.then : a.else);
    if ('setFlag' in a) { s.flags[a.setFlag] = a.value ?? true; g.bus.emit('flags:changed', { key: a.setFlag }); return; }
    if ('clearFlag' in a) { delete s.flags[a.clearFlag]; g.bus.emit('flags:changed', { key: a.clearFlag }); return; }
    if ('msg' in a) return g.log(fmt(a.msg), a.channel ?? 'system');
    if ('notice' in a) return g.bus.emit('ui:notice', { text: fmt(a.notice), sub: a.sub ? fmt(a.sub) : '' });
    if ('title' in a) { g.bus.emit('ui:chapter', { title: fmt(a.title), sub: a.sub ? fmt(a.sub) : '' }); return; }
    if ('say' in a) {
      const npc = a.npc ? g.findNpc(a.npc) : g.player;
      if (npc) g.say(npc, fmt(a.say));
      return;
    }
    if ('dialog' in a) return g.dialog.start(a.dialog, a.npc ? g.findNpc(a.npc) : g.dialog.npc);
    if ('giveItem' in a) return sys.inventory.add(a.giveItem, a.qty ?? 1);
    if ('takeItem' in a) return sys.inventory.remove(a.takeItem, a.qty ?? 1);
    if ('gold' in a) { s.gold = Math.max(0, s.gold + a.gold); g.bus.emit('gold:changed', { gold: s.gold, delta: a.gold }); return; }
    if ('exp' in a) return sys.stats.gainExp(g.player, a.exp);
    if ('heal' in a) { const p = g.player; p.hp = p.maxHp; p.mp = p.maxMp; g.bus.emit('stats:changed', { entity: p }); return; }
    if ('startQuest' in a) return sys.quests.start(a.startQuest);
    if ('completeQuest' in a) return sys.quests.complete(a.completeQuest);
    if ('learnSkill' in a) return sys.skills.learn(a.learnSkill);
    if ('setClass' in a) return sys.stats.setClass(g.player, a.setClass);
    if ('teleport' in a) return g.changeMap(a.teleport, a.x, a.y, a.dir);
    if ('spawn' in a) {
      for (let i = 0; i < (a.count ?? 1); i++) sys.spawner.spawnNear(a.spawn, a.x, a.y, a);
      return;
    }
    if ('spawnNpc' in a) { g.world.spawnNpc(a.spawnNpc, a.x, a.y, a); return; }
    if ('removeNpc' in a) { const n = g.findNpc(a.removeNpc); if (n) g.world.removeEntity(n); return; }
    if ('moveNpc' in a) return g.walkNpcTo(a.moveNpc, a.x, a.y);
    if ('faceNpc' in a) { const n = g.findNpc(a.faceNpc); if (n) n.dir = a.dir; return; }
    if ('setTile' in a) { const t = a.setTile; g.world.setObj(t.x, t.y, t.id ?? null); return; }
    if ('sound' in a) return g.bus.emit('sound', { id: a.sound });
    if ('bgm' in a) return g.bus.emit('bgm', { id: a.bgm });
    if ('shake' in a) return g.bus.emit('fx:shake', { amount: a.shake, time: a.time ?? 0.4 });
    if ('fx' in a) return g.bus.emit('fx:play', { id: a.fx, x: a.x ?? g.player.x, y: a.y ?? g.player.y });
    if ('fade' in a) { g.bus.emit('fx:fade', { to: a.fade, time: a.time ?? 0.6 }); return this.wait(a.time ?? 0.6); }
    if ('shop' in a) return g.bus.emit('shop:open', { shopId: a.shop, npc: g.dialog.npc });
    if ('wait' in a) return this.wait(a.wait);
    if ('lock' in a) { g.cutscene = !!a.lock; return; }
    if ('revive' in a) return sys.stats.revive(g.player);
    if ('save' in a) return g.save();
    if ('chapter' in a) { s.chapter = a.chapter; g.bus.emit('chapter:changed', { chapter: a.chapter }); return; }
    if ('ending' in a) return g.bus.emit('game:ending', { id: a.ending });
    if ('call' in a) return a.call(g);
    console.warn('알 수 없는 액션', a);
  }

  wait(sec) {
    return new Promise((res) => this.game.timers.push({ t: sec, fn: res }));
  }
}
