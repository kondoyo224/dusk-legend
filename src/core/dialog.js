// 대화 진행기. UI는 'dialog:show' 를 받아 그리고, choose(i)/next() 로 응답한다.
// 대화 데이터 형식: docs/ARCHITECTURE.md §대화.
export class DialogRunner {
  constructor(game) {
    this.game = game;
    this.active = null;   // {def, nodeId, node, npc, resolve}
    this.npc = null;
  }
  get isOpen() { return !!this.active; }

  // 대화 시작. 대화가 닫힐 때 resolve 되는 Promise 반환.
  start(dialogId, npc = null) {
    const def = this.game.data.dialogues[dialogId];
    if (!def) { console.warn('대화 없음', dialogId); return Promise.resolve(); }
    if (this.active) this.close();
    return new Promise((resolve) => {
      this.npc = npc;
      this.active = { id: dialogId, def, npc, resolve };
      let startNode = 'start';
      for (const en of def.entry || []) {
        if (this.game.script.check(en.cond)) { startNode = en.node; break; }
      }
      this.game.bus.emit('dialog:open', { id: dialogId, npc });
      this.goto(startNode);
    });
  }

  async goto(nodeId) {
    const a = this.active;
    if (!a) return;
    if (!nodeId) return this.close();
    const node = a.def.nodes[nodeId];
    if (!node) { console.warn('대화 노드 없음', a.id, nodeId); return this.close(); }
    a.nodeId = nodeId; a.node = node;
    if (node.actions) await this.game.script.run(node.actions);
    if (this.active !== a) return; // 액션이 대화를 닫았거나 다른 대화를 열었음
    if (node.goto) return this.goto(node.goto); // 표시 없이 분기
    const g = this.game;
    a.options = (node.options || []).filter((o) => g.script.check(o.cond));
    g.bus.emit('dialog:show', {
      id: a.id, nodeId,
      speaker: g.format(node.speaker ?? a.npc?.name ?? ''),
      portrait: node.portrait ?? a.npc?.look ?? null,
      text: g.format(node.text ?? ''),
      options: a.options.map((o) => ({ text: g.format(o.text) })),
      hasNext: !a.options.length,
      npc: a.npc,
    });
  }

  async choose(i) {
    const a = this.active;
    const o = a?.options?.[i];
    if (!o) return;
    if (o.actions) await this.game.script.run(o.actions);
    if (this.active !== a) return;
    if (o.next) this.goto(o.next); else this.close();
  }

  next() {
    const a = this.active;
    if (!a || a.options?.length) return;
    if (a.node.next) this.goto(a.node.next); else this.close();
  }

  close() {
    const a = this.active;
    if (!a) return;
    this.active = null;
    this.npc = null;
    this.game.bus.emit('dialog:close', { id: a.id });
    a.resolve();
  }
}
