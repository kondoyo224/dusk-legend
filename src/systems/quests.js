// 퀘스트 진행: 목표 추적(kill/item/flag/talk), ready/complete, 보상. 데이터는 src/data/quests.js(워커 D).
export function createQuests(g, sys) {
  const def = (id) => g.data.quests[id];
  const Q = () => g.state?.quests ?? {};

  function objProgress(q, st, i) {
    const o = q.objectives[i];
    if (o.type === 'item') return Math.min(sys.inventory.count(o.target), o.count ?? 1);
    if (o.type === 'flag') return g.state.flags[o.target] ? 1 : 0;
    return Math.min(st.progress?.[i] ?? 0, o.count ?? 1);
  }
  const objDone = (q, st, i) => objProgress(q, st, i) >= (q.objectives[i].count ?? 1);

  const quests = {
    stateOf(id) { return Q()[id]?.state ?? 'none'; },

    list() {
      return Object.entries(Q()).filter(([id]) => def(id)).map(([id, st]) => ({ id, ...def(id), state: st.state }));
    },

    start(id) {
      const q = def(id);
      if (!q) { console.warn('퀘스트 없음', id); return false; }
      if (this.stateOf(id) !== 'none') return false;
      Q()[id] = { state: 'active', progress: {} };
      g.bus.emit('quest:started', { id });
      g.bus.emit('ui:notice', { text: `퀘스트 시작: ${q.name}`, sub: q.objectives?.[0]?.text ?? '' });
      g.log(`[퀘스트] ${q.name} 시작 (J 키)`, 'quest');
      this.recheck(id);
      return true;
    },

    // 목표 달성 여부 재평가 → active ↔ ready
    recheck(id) {
      const q = def(id), st = Q()[id];
      if (!q || !st || st.state === 'done') return;
      const all = (q.objectives || []).every((_, i) => objDone(q, st, i));
      if (all && st.state === 'active') {
        st.state = 'ready';
        g.bus.emit('quest:ready', { id });
        g.log(`[퀘스트] ${q.name} — 목표 달성! ${q.giver ? '의뢰인에게 보고하자.' : ''}`, 'quest');
        g.bus.emit('sound', { id: 'quest' });
      } else if (!all && st.state === 'ready') {
        st.state = 'active';
        g.bus.emit('quest:updated', { id });
      }
    },

    recheckAll() { for (const id in Q()) this.recheck(id); },

    complete(id) {
      const q = def(id);
      if (!q) { console.warn('퀘스트 없음', id); return false; }
      if (this.stateOf(id) === 'done') return false;
      const st = Q()[id] ?? (Q()[id] = { state: 'active', progress: {} });
      // 수집 아이템 회수
      for (const o of q.objectives || []) if (o.type === 'item' && !o.keep) sys.inventory.remove(o.target, Math.min(o.count ?? 1, sys.inventory.count(o.target)));
      st.state = 'done';
      const r = q.rewards || {};
      if (r.gold) { g.state.gold += r.gold; g.bus.emit('gold:changed', { gold: g.state.gold, delta: r.gold }); }
      for (const it of r.items || []) if (!sys.inventory.add(it.id, it.qty ?? 1)) sys.inventory.dropItem(g.player.x, g.player.y, it.id, it.qty ?? 1);
      g.bus.emit('quest:completed', { id });
      g.bus.emit('ui:notice', { text: `퀘스트 완료: ${q.name}`, sub: [r.exp ? `경험치 +${r.exp}` : '', r.gold ? `골드 +${r.gold}` : ''].filter(Boolean).join('  ') });
      g.log(`[퀘스트] ${q.name} 완료!`, 'quest');
      g.bus.emit('sound', { id: 'quest' });
      if (r.exp) sys.stats.gainExp(g.player, r.exp);
      if (q.onComplete) g.script.run(q.onComplete);
      return true;
    },

    progressText(id) {
      const q = def(id), st = Q()[id];
      if (!q) return '';
      return (q.objectives || []).map((o, i) => {
        const n = st ? objProgress(q, st, i) : 0, need = o.count ?? 1;
        const label = o.text ?? `${o.type} ${o.target}`;
        return need > 1 || o.type === 'kill' || o.type === 'item' ? `${label} (${n}/${need})` : `${label}${n >= need ? ' ✓' : ''}`;
      }).join('\n');
    },

    objectives(id) {
      const q = def(id), st = Q()[id];
      if (!q) return [];
      return (q.objectives || []).map((o, i) => ({ ...o, have: st ? objProgress(q, st, i) : 0, need: o.count ?? 1, done: st ? objDone(q, st, i) : false }));
    },

    bump(type, target) {
      for (const id in Q()) {
        const q = def(id), st = Q()[id];
        if (!q || st.state !== 'active') continue;
        let hit = false;
        q.objectives?.forEach((o, i) => {
          if (o.type !== type || o.target !== target) return;
          const cur = st.progress[i] ?? 0;
          if (cur >= (o.count ?? 1)) return;
          st.progress[i] = cur + 1;
          hit = true;
          if (type === 'kill') g.log(`[퀘스트] ${o.text ?? q.name} (${st.progress[i]}/${o.count ?? 1})`, 'quest');
        });
        if (hit) { g.bus.emit('quest:updated', { id }); this.recheck(id); }
      }
    },
  };

  g.bus.on('entity:died', ({ entity }) => { if (entity.kind === 'monster' && g.state) quests.bump('kill', entity.monsterId); });
  g.bus.on('npc:interact', ({ npc }) => { if (g.state) quests.bump('talk', npc.npcId); });
  g.bus.on('inventory:changed', () => {
    if (!g.state) return;
    for (const id in Q()) {
      const q = def(id);
      if (Q()[id].state !== 'done' && q?.objectives?.some((o) => o.type === 'item')) { g.bus.emit('quest:updated', { id }); quests.recheck(id); }
    }
  });
  g.bus.on('flags:changed', () => { if (g.state) quests.recheckAll(); });
  return quests;
}
