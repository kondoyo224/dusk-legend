// 이벤트 버스: 모듈 간 결합을 끊는 유일한 통로. 이벤트 목록은 docs/ARCHITECTURE.md §이벤트 참조.
export class EventBus {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  once(evt, fn) {
    const off = this.on(evt, (p) => { off(); fn(p); });
    return off;
  }
  off(evt, fn) { this.map.get(evt)?.delete(fn); }
  emit(evt, payload = {}) {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (e) { console.error(`[bus:${evt}]`, e); }
    }
  }
}
