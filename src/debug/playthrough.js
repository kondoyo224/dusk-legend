// 자동 완주 테스트: 프롤로그 → 1장 → 2장 → 3장 → 엔딩 → 포스트게임을 실제 game 객체로 진행한다. 소유: 워커 D (D9).
// 실행: node tools/check.mjs "autostart&test=playthrough" out.png 60000
//       장 단위: &playthrough=pro|ch1|ch2|ch3|post|all  (여러 개는 쉼표: ch1,ch2)
//       장 단위로 시작하면 그 장의 시작 상태(플래그·퀘스트·레벨·장비)를 직접 세운 뒤 로엔 마을에서 시작한다.
// 방식: 이동은 A* 경로를 따라 한 칸씩 옮기며 world.onArrive 를 호출(트리거·포탈이 실제로 발동), 대화는 dialog:show 마다
//       next()/choose(i), 몬스터는 곁으로 걸어간 뒤 systems.combat.kill, 드랍은 그 칸으로 걸어가 inventory.pickup.
// 결과: { ok, segments:{seg:{ok, fails}}, steps:[...], log:[...] } — tests.js 가 __state 에 기록.
import { findPath } from '../core/pathfind.js';

const SEGMENTS = ['pro', 'ch1', 'ch2', 'ch3', 'post'];

export async function run(game, arg = 'all') {
  const want = arg === 'all' ? SEGMENTS : arg.split(',').filter((s) => SEGMENTS.includes(s));
  const T = new Tester(game);
  T.install();
  const out = { ok: true, segments: {}, steps: T.steps, log: T.log };
  window.__pt = out;
  try {
    // 묘원 도입 컷신이 이미 돌고 있으면(디버그 autostart 기본 맵) 먼저 흘려보낸다
    await T.settle(12);
    let first = true;
    for (const seg of want) {
      T.seg = seg;
      const before = T.steps.length;
      try {
        if (first && seg !== 'pro') await T.setupFor(seg);
        await T[seg]();
      } catch (e) {
        T.fail('exception', String(e?.stack || e).slice(0, 600));
      }
      first = false;
      const mine = T.steps.slice(before);
      const fails = mine.filter((s) => !s.ok).map((s) => `${s.step}: ${s.detail ?? ''}`);
      out.segments[seg] = { ok: !fails.length, checks: mine.length, fails };
      if (fails.length) out.ok = false;
    }
  } finally {
    T.uninstall();
  }
  out.final = T.snapshot();
  out.time = +game.time.toFixed(1);
  return out;
}

class Tester {
  constructor(game) {
    this.g = game;
    this.steps = [];
    this.log = [];
    this.seg = '';
    this.showSeq = 0; this.handled = 0; this.lastShow = null;
    this.pending = 0;
    this.choices = {};   // dialogId → {nodeId: index | '텍스트 일부'}
    this.god = true;
    this.events = { ending: 0, shopOpen: 0 };
  }

  // ── 설치/해제 ──
  install() {
    const g = this.g, T = this;
    this.offs = [
      g.bus.on('dialog:show', (e) => { T.showSeq++; T.lastShow = { seq: T.showSeq, id: e.id, nodeId: e.nodeId }; T.note(`💬 ${e.id}.${e.nodeId}`); }),
      g.bus.on('game:ending', (e) => { T.events.ending++; T.note(`🎬 game:ending ${e.id}`); }),
      g.bus.on('shop:open', (e) => { T.events.shopOpen++; g.timers.push({ t: 0.05, fn: () => g.ui?.windows?.shop?.close?.() }); T.note(`🛒 shop ${e.shopId}`); }),
      g.bus.on('player:dead', () => T.note('☠ player:dead')),
      g.bus.on('entity:died', ({ entity: e, killer }) => { if (e.boss) T.note(`⚔ ${e.monsterId} 처치 by ${killer?.kind ?? killer} ${killer === g.player ? '(player)' : killer?.monsterId ?? ''} ${T.killing === e ? '[test]' : '[!자동]'}`); }),
      g.bus.on('quest:started', (e) => T.note(`📜 start ${e.id}`)),
      g.bus.on('quest:ready', (e) => T.note(`📜 ready ${e.id}`)),
      g.bus.on('quest:completed', (e) => T.note(`📜 done ${e.id}`)),
      g.bus.on('map:loaded', (e) => T.note(`🗺 ${e.map.id}`)),
    ];
    // 스크립트 실행 추적 (진행 중인 컷신이 끝날 때까지 기다리기 위해)
    const S = g.script, origRun = S.run.bind(S);
    S.run = async (a) => { T.pending++; try { return await origRun(a); } finally { T.pending--; } };
    this.restoreRun = () => { S.run = origRun; };
    // tests.js 의 자동 해제 루프가 대화를 닫지 못하게 (호출 위치가 tests.js 인 close 만 무시)
    const D = g.dialog, origClose = D.close.bind(D);
    D.close = function () {
      const caller = (new Error().stack || '').split('\n')[2] || '';
      if (caller.includes('/debug/tests.js')) return;
      return origClose();
    };
    this.restoreClose = () => { delete D.close; };
    // 렌더 생략 + 시간 가속 (헤드리스 실시간 제한 안에 완주하도록)
    const proto = Object.getPrototypeOf(g);
    this.origRender = g.renderer.render;
    g.renderer.render = () => {};
    // 프레임당 한 번만(스크립트의 await 마이크로태스크가 틱 사이에 돌도록), dt 를 0.05 로 고정 ≈ 3배속
    g.tick = () => proto.tick.call(g, 0.05);
    // 무적: 진행 검증이 목적이므로 체력 유지 (사망 테스트 중엔 끔)
    const C = g.systems.combat, origDamage = C.damage, origKill = C.kill;
    C.damage = function (src, t, ...r) { if (T.god && t?.kind === 'player') return 0; return origDamage.call(this, src, t, ...r); };
    C.kill = function (t, ...r) { if (T.god && t?.kind === 'player') { t.hp = t.maxHp; return; } return origKill.call(this, t, ...r); };
    this.restoreCombat = () => { C.damage = origDamage; C.kill = origKill; };
    this.godIv = setInterval(() => { const p = g.player; if (T.god && p && !p.dead) { p.hp = Math.max(p.hp, Math.ceil(p.maxHp * 0.8)); p.mp = p.maxMp; } }, 20);
    // 진행 중 결과도 __state 에 보이도록 (시간 초과 대비)
    const el = document.getElementById('__state');
    if (el) {
      const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) {
          try { const o = JSON.parse(v); if (!o.playthrough && window.__pt) o.playthrough_live = { seg: T.seg, steps: T.steps.slice(-12), fails: T.steps.filter((s) => !s.ok), log: T.log.slice(-25) }; v = JSON.stringify(o); } catch {}
          desc.set.call(this, v);
        },
      });
      this.restoreEl = () => { delete el.textContent; };
    }
  }
  uninstall() {
    this.offs.forEach((f) => f());
    this.restoreRun(); this.restoreClose(); this.restoreEl?.(); this.restoreCombat();
    clearInterval(this.godIv);
    delete this.g.tick;
    this.g.renderer.render = this.origRender;
  }

  // ── 기록 ──
  note(s) { this.log.push(`${this.g.time.toFixed(1)} ${s}`); if (this.log.length > 400) this.log.splice(0, 100); }
  check(step, ok, detail) { this.steps.push({ seg: this.seg, step, ok: !!ok, ...(ok ? {} : { detail: detail ?? '' }) }); if (!ok) this.note(`✗ ${step} ${detail ?? ''}`); return !!ok; }
  fail(step, detail) { return this.check(step, false, detail); }
  flag(f) { return this.g.state.flags[f]; }
  qs(id) { return this.g.systems.quests.stateOf(id); }
  has(id) { return this.g.systems.inventory.count(id); }
  snapshot() {
    const s = this.g.state, p = this.g.player;
    return { map: s.map, x: p.x, y: p.y, level: p.level, chapter: s.chapter, ended: s.ended, gold: s.gold, ghost: p.ghost, dead: !!p.dead,
      quests: Object.fromEntries(Object.entries(s.quests).map(([k, v]) => [k, v.state])), equipment: Object.fromEntries(Object.entries(s.equipment).map(([k, v]) => [k, v?.id ?? null])),
      skills: s.skills, keyFlags: Object.keys(s.flags).filter((f) => /^(pro\.(named|warrior|reborn)|ch1\.(page1|done)|ch2\.(page2|raid_done)|ch3\.(open|belzar|king|page3)|end\.)/.test(f)) };
  }

  // ── 시간 ──
  sleep(sec) { return new Promise((r) => this.g.timers.push({ t: sec, fn: r })); }
  async until(pred, timeout = 10, step = 0.05) {
    const t0 = this.g.time;
    while (this.g.time - t0 < timeout) { if (pred()) return true; await this.sleep(step); this.driveDialog(); }
    return !!pred();
  }

  // ── 대화 ──
  pickOption(id, nodeId, opts) {
    const want = this.choices[id]?.[nodeId];
    if (typeof want === 'number') return Math.min(want, opts.length - 1);
    if (typeof want === 'string') { const i = opts.findIndex((o) => this.g.format(o.text).includes(want)); if (i >= 0) return i; this.fail(`choice ${id}.${nodeId}`, `선택지 '${want}' 없음`); }
    // 기본: 상점을 여는 선택지는 피하고 첫 번째
    const nodes = this.g.data.dialogues[id]?.nodes || {};
    const i = opts.findIndex((o) => !(nodes[o.next]?.actions || []).some((a) => a && 'shop' in a));
    return i >= 0 ? i : 0;
  }
  driveDialog() {
    const D = this.g.dialog, a = D.active, L = this.lastShow;
    if (!a || !L || L.seq === this.handled || L.id !== a.id || L.nodeId !== a.nodeId) return;
    this.handled = L.seq;
    if (a.options?.length) {
      const i = this.pickOption(a.id, a.nodeId, a.options);
      this.note(`   → ${i}: ${this.g.format(a.options[i].text).slice(0, 24)}`);
      D.choose(i);
    } else D.next();
  }
  // 대화·컷신 스크립트·맵 전환이 모두 끝날 때까지 진행
  async settle(timeout = 30) {
    const g = this.g, t0 = g.time;
    let quiet = 0;
    while (g.time - t0 < timeout) {
      this.driveDialog();
      const busy = g.dialog.active || this.pending > 0 || g.transition;
      quiet = busy ? 0 : quiet + 1;
      if (quiet >= 6) return true;
      await this.sleep(0.05);
    }
    this.fail('settle', `시간 초과 (pending=${this.pending}, dialog=${g.dialog.active?.id}.${g.dialog.active?.nodeId}, transition=${!!g.transition})`);
    if (g.dialog.active) g.dialog.close();
    return false;
  }

  // ── 이동 ──
  path(tx, ty, adjacent = false, avoid = false) {
    const g = this.g, p = g.player, w = g.world;
    return findPath(p.x, p.y, tx, ty, (fx, fy, nx, ny) => w.canStep(fx, fy, nx, ny, p, !avoid) && w.blockerAt(nx, ny, p)?.kind !== 'npc', { maxNodes: 20000, allowAdjacent: adjacent });
  }
  // 경로를 따라 한 칸씩: 트리거·포탈 발동, 대화/컷신이 열리면 끝날 때까지 진행. 맵이 바뀌면 멈춤.
  async walk(tx, ty, { adjacent = false, label, avoid = false } = {}) {
    const g = this.g, p = g.player, map0 = g.state.map;
    const path = this.path(tx, ty, adjacent, avoid) || (avoid ? this.path(tx, ty, adjacent) : null);
    if (path) this._rewalk = 0;
    if (!path) return this.fail(label ?? `walk ${map0}(${tx},${ty})`, `경로 없음 from (${p.x},${p.y})`);
    for (const s of path) {
      // NPC 가 길을 막고 있으면 비켜 갈 수 있도록 재탐색
      if (g.world.blockerAt(s.x, s.y, p)?.kind === 'npc') { if ((this._rewalk = (this._rewalk || 0) + 1) > 20) return this.fail(label ?? 'walk', 'NPC 가 길을 막음'); return this.walk(tx, ty, { adjacent, label }); }
      // 길을 막은 몬스터는 베고 지나간다 (같은 칸에 겹치지 않도록)
      const blk = g.world.blockerAt(s.x, s.y, p);
      if (blk?.kind === 'monster' && blk.boss) {
        if ((this._rewalk = (this._rewalk || 0) + 1) > 20) return this.fail(label ?? 'walk', `보스 ${blk.monsterId} 가 길을 막음`);
        return this.walk(tx, ty, { adjacent, label, avoid: true });   // 보스는 베지 않고 돌아간다
      }
      if (blk?.kind === 'monster') { this.killing = blk; g.systems.combat.kill(blk, p); this.killing = null; }
      else if (blk) return this.fail(label ?? 'walk', `(${s.x},${s.y}) ${blk.kind} 가 길을 막음`);
      p.x = s.x; p.y = s.y; p.rx = s.x; p.ry = s.y; p.move = null; p.path = null;
      g.world.onArrive(p);
      if (g.transition) { await this.until(() => !g.transition, 5); await this.settle(); return true; }
      if (g.dialog.active || this.pending > 0) await this.settle();
      if (g.state.map !== map0) return true;
    }
    return true;
  }
  async gotoMap(mapId, tx, ty, label) {
    const g = this.g;
    await this.walk(tx, ty, { label: label ?? `→ ${mapId}` });
    await this.until(() => !g.transition && g.state.map === mapId, 5);
    await this.settle();
    return this.check(label ?? `포탈 → ${mapId}`, g.state.map === mapId, `현재 맵 ${g.state.map} (${g.player.x},${g.player.y})`);
  }
  portalTo(mapId) { return (this.g.world.map.portals || []).filter((q) => q.to === mapId); }
  async usePortal(mapId) {
    const ps = this.portalTo(mapId);
    if (!ps.length) return this.fail(`포탈 → ${mapId}`, `${this.g.state.map} 에 ${mapId} 행 포탈 없음`);
    const p = this.g.player;
    ps.sort((a, b) => Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) - Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)));
    return this.gotoMap(mapId, ps[0].x, ps[0].y);
  }

  // ── NPC ──
  async talk(npcId, choices, label) {
    const g = this.g;
    const n = g.findNpc(npcId);
    if (!n) return this.fail(label ?? `talk ${npcId}`, `${g.state.map} 에 NPC 없음`);
    if (choices) this.choices = { ...this.choices, ...choices };
    if (Math.max(Math.abs(n.x - g.player.x), Math.abs(n.y - g.player.y)) > 1) await this.walk(n.x, n.y, { adjacent: true, label: `→ ${npcId}` });
    const n2 = g.findNpc(npcId) || n;
    if (Math.max(Math.abs(n2.x - g.player.x), Math.abs(n2.y - g.player.y)) > 1) await this.walk(n2.x, n2.y, { adjacent: true, label: `→ ${npcId}` });
    const seq = this.showSeq;
    g.interactWith(n2);
    await this.until(() => this.showSeq > seq, 3);
    const opened = this.showSeq > seq;
    await this.settle();
    return this.check(label ?? `talk ${npcId}`, opened, '대화가 열리지 않음');
  }
  // 대화를 열어 첫 노드만 확인하고 닫는다 (엔딩 후 대사 점검용)
  async peek(npcId) {
    const g = this.g, n = g.findNpc(npcId);
    if (!n) return null;
    await this.walk(n.x, n.y, { adjacent: true, label: `→ ${npcId}` });
    const seq = this.showSeq;
    g.interactWith(g.findNpc(npcId) || n);
    await this.until(() => this.showSeq > seq, 2);
    const node = this.showSeq > seq ? `${this.lastShow.id}.${this.lastShow.nodeId}` : null;
    this.handled = this.showSeq;
    g.dialog.close();
    await this.settle();
    return node;
  }

  // ── 전투/줍기 ──
  monsters(id) { return this.g.world.entities.filter((e) => e.kind === 'monster' && !e.dead && (!id || e.monsterId === id)); }
  async killOne(m, label) {
    const g = this.g;
    if (Math.max(Math.abs(m.x - g.player.x), Math.abs(m.y - g.player.y)) > 1) {
      const ok = this.path(m.x, m.y, true);
      if (!ok) this.fail(label ?? `reach ${m.monsterId}`, `(${m.x},${m.y}) 경로 없음`);
      else await this.walk(m.x, m.y, { adjacent: true, label: label ?? `reach ${m.monsterId}` });
    }
    if (!m.dead && g.world.entities.includes(m)) { this.killing = m; g.systems.combat.kill(m, g.player); this.killing = null; }
    await this.settle();
    await this.loot();
  }
  async killAll(id, max = Infinity) {
    let n = 0;
    for (const m of this.monsters(id)) { if (n >= max) break; if (m.dead) continue; await this.killOne(m); n++; }
    return n;
  }
  // 퀘스트 kill 목표를 채울 때까지 처치 (리스폰 대기 포함)
  async killFor(questId, monsterId, need, timeout = 120) {
    const g = this.g, t0 = g.time;
    const prog = () => { const o = g.systems.quests.objectives(questId).find((x) => x.type === 'kill' && x.target === monsterId); return o ? o.have : 0; };
    while (prog() < need && g.time - t0 < timeout) {
      const ms = this.monsters(monsterId);
      if (ms.length) await this.killOne(ms[0]); else await this.sleep(1);
    }
    return this.check(`${questId}: ${monsterId} ${need}마리`, prog() >= need, `${prog()}/${need}`);
  }
  // 아이템 수집 목표 (드랍 대기 포함)
  async collect(itemId, need, monsterIds, timeout = 150) {
    const g = this.g, t0 = g.time;
    while (this.has(itemId) < need && g.time - t0 < timeout) {
      const ms = this.monsters().filter((m) => monsterIds.includes(m.monsterId) && !m.boss);
      if (ms.length) await this.killOne(ms[0]); else await this.sleep(1);
    }
    return this.check(`수집 ${itemId} ×${need}`, this.has(itemId) >= need, `${this.has(itemId)}/${need}`);
  }
  async loot(ids) {
    const g = this.g;
    for (let k = 0; k < 20; k++) {
      const d = g.world.entities.find((e) => e.kind === 'drop' && e.itemId && (!ids || ids.includes(e.itemId)) && !e._ptSkip);
      if (!d) return;
      if (!this.path(d.x, d.y) && !(d.x === g.player.x && d.y === g.player.y)) { d._ptSkip = true; continue; }
      await this.walk(d.x, d.y, { label: `줍기 ${d.itemId}` });
      if (g.world.entities.includes(d)) { if (!g.systems.inventory.pickup(d)) d._ptSkip = true; }
      await this.settle();
    }
  }
  async pickup(itemId, label) {
    const g = this.g;
    await this.until(() => g.world.entities.some((e) => e.kind === 'drop' && e.itemId === itemId) || this.has(itemId), 4);
    const before = this.has(itemId);
    await this.loot([itemId]);
    return this.check(label ?? `줍기 ${itemId}`, this.has(itemId) > before || (before && !g.world.entities.some((e) => e.kind === 'drop' && e.itemId === itemId)), '드랍을 찾거나 주울 수 없음');
  }
  async bossFight(id, label) {
    const g = this.g;
    await this.until(() => this.monsters(id).length, 5);
    const b = this.monsters(id)[0];
    if (!this.check(label ?? `보스 ${id} 등장`, b, `${g.state.map} 에 ${id} 없음`)) return false;
    await this.killOne(b, `보스 ${id} 접근`);
    await this.settle();
    return this.check(`보스 ${id} 처치`, b.dead, `hp ${b.hp}`);
  }

  // ── 상태 세우기 (장 단위 시작) ──
  async setupFor(seg) {
    const g = this.g, s = g.state, sys = g.systems;
    const F = (...fs) => fs.forEach((f) => { s.flags[f] = true; });
    const done = (...qs) => qs.forEach((q) => { s.quests[q] = { state: 'done', progress: {} }; });
    const give = (id, eq) => { sys.inventory.add(id, 1); if (eq) { const i = s.inventory.findIndex((x) => x?.id === id); if (i >= 0) sys.inventory.equip(i); } };
    const idx = SEGMENTS.indexOf(seg);
    F('pro.awake', 'pro.east_fight', 'pro.body_drop', 'pro.body', 'pro.mind_drop', 'pro.mind', 'pro.warden_met', 'pro.warden', 'pro.soul', 'pro.named', 'pro.altar_seen', 'pro.warrior', 'pro.gate', 'pro.reborn');
    sys.stats.setClass(g.player, 'warrior');
    sys.skills.learn('power_strike');
    s.chapter = 1; g.player.ghost = false; g.player.dead = false;
    g.player.level = [3, 3, 10, 18, 25][idx];
    let level = g.player.level;
    give('cloth_tunic', true); give('wooden_sword', true);
    if (idx >= 2) {
      F('ch1.met_hardin', 'ch1.forest_q', 'ch1.cellar_ok', 'ch1.ratking', 'ch1.bron_met', 'ch1.lina_met', 'ch1.grimfang_met', 'ch1.grimfang', 'ch1.page1', 'ch1.done');
      done('ch1_return', 'ch1_cellar', 'ch1_forest', 'ch1_pelts'); s.chapter = 2; level = 10; give('short_sword', true); give('leather_armor', true); give('torn_page_1');
      sys.skills.learn('whirlwind'); sys.skills.learn('charge');
    }
    if (idx >= 3) {
      F('ch2.crypt_found', 'ch2.key', 'ch2.graus_met', 'ch2.graus', 'ch2.page2', 'ch2.raid_on', 'ch2.raid_done', 'ch3.open');
      done('ch2_graveyard', 'ch2_crypt', 'ch2_dust'); s.chapter = 3; level = 18; give('torn_page_2'); give('crypt_key');
      sys.skills.learn('war_cry'); sys.skills.learn('iron_wall'); sys.skills.learn('earth_splitter');
    }
    if (idx >= 4) {
      F('ch3.tower_seen', 'ch3.belzar_met', 'ch3.belzar', 'ch3.king_met', 'ch3.king', 'ch3.page3', 'end.stay', 'end.cleared');
      done('ch3_tower'); s.ended = true; s.chapter = 4; level = 25; give('serin_pendant', true);
    }
    if (idx === 1) sys.quests.start('ch1_return');
    if (idx === 2) sys.quests.start('ch2_graveyard');
    if (idx === 3) sys.quests.start('ch3_tower');
    g.player.level = Math.max(g.player.level, level);
    sys.stats.recalc(g.player);
    g.world.load('village_roen', 14, 12);
    await this.settle();
    this.check(`setup ${seg}`, g.state.map === 'village_roen', g.state.map);
  }

  // ══════════ 프롤로그 ══════════
  async pro() {
    const g = this.g, w = () => g.world;
    if (g.state.map !== 'limbo_awakening') { g.world.load('limbo_awakening'); }
    await this.until(() => this.flag('pro.awake'), 15);
    await this.settle();
    this.check('pro.awake (눈뜸 컷신)', this.flag('pro.awake'));
    // 육신의 기억
    await this.walk(42, 11, { label: '동쪽 구역으로' });
    await this.settle();
    this.check('동쪽 전투 시작 pro.east_fight', this.flag('pro.east_fight'));
    this.check('그림자 3 등장', this.monsters('shade').length >= 3, `${this.monsters('shade').length}`);
    await this.killAll('shade');
    await this.settle();
    this.check('그림자 전멸 → pro.body_drop', this.flag('pro.body_drop'));
    await this.pickup('shard_body');
    await this.settle();
    this.check('pro.body (육신의 기억)', this.flag('pro.body'));
    this.check('서쪽 장벽 해제', w().tileWalkable(23, 37));
    // 마음의 기억
    await this.walk(17, 42, { label: '서쪽 구역으로' });
    await this.settle();
    this.check('혼의 물병 지급', this.has('soul_vial') >= 3, `${this.has('soul_vial')}`);
    this.god = false; g.player.hp = Math.floor(g.player.maxHp * 0.4);
    const hp0 = g.player.hp;
    g.systems.inventory.useItemById('soul_vial');
    this.check('혼의 물병 사용(회복)', g.player.hp > hp0, `${hp0}→${g.player.hp}`);
    this.god = true;
    this.choices.pro_echo = { ask: 0 };
    await this.walk(11, 45, { adjacent: true, label: '리나의 환영에게' });
    await this.settle();
    this.check('리나의 환영 대화 → pro.mind_drop', this.flag('pro.mind_drop'));
    await this.pickup('shard_mind');
    await this.settle();
    this.check('pro.mind (마음의 기억)', this.flag('pro.mind'));
    this.check('북쪽 장벽 해제', w().tileWalkable(18, 23));
    // 혼의 기억
    await this.walk(14, 15, { label: '북쪽 투기장으로' });
    await this.settle();
    this.check('파수꾼 등장 pro.warden_met', this.flag('pro.warden_met'));
    // 파수꾼 전투 중 사망 → 세린 곁에서 혼으로 부활 → 파수꾼 복구
    this.god = false;
    g.systems.combat.kill(g.player, null);
    await this.until(() => !g.transition && !g.player.dead, 8);
    await this.settle();
    this.check('프롤로그 사망 → 자동 부활', !g.player.dead && g.state.map === 'limbo_awakening', `dead=${g.player.dead} map=${g.state.map}`);
    this.check('재입장 시 파수꾼 복구', this.monsters('oblivion_warden').length === 1, `${this.monsters('oblivion_warden').length}`);
    this.god = true;
    await this.bossFight('oblivion_warden');
    await this.settle();
    this.check('pro.warden', this.flag('pro.warden'));
    await this.pickup('shard_soul');
    await this.settle(40);
    this.check('pro.soul (죽음의 회상)', this.flag('pro.soul'));
    // 이름
    this.choices.recorder_limbo = { n2: 0 };
    await this.talk('recorder', null, '세린에게 조각 반납');
    this.check('pro.named', this.flag('pro.named'));
    this.check('조각 회수', !this.has('shard_body') && !this.has('shard_mind') && !this.has('shard_soul'));
    // 제단
    await this.gotoMap('limbo_altar', 45, 45, '빛의 길 → 신들의 제단');
    this.check('pro.altar_seen', this.flag('pro.altar_seen'));
    this.choices.altar_argen = { s3: 0, o5: 0 };
    this.choices.pro_book = { e: 0 };
    await this.talk('altar_argen', null, '아르겐의 맹세');
    this.check('pro.warrior', this.flag('pro.warrior'));
    this.check('직업 전사', g.state.cls === 'warrior', g.state.cls);
    this.check('강타 습득', g.state.skills.includes('power_strike'));
    this.check('목검 장착', g.state.equipment.weapon?.id === 'wooden_sword', JSON.stringify(g.state.equipment.weapon));
    this.check('스탯 포인트 지급', g.state.statPoints >= 2, `${g.state.statPoints}`);
    this.check('pro.gate (귀혼의 서)', this.flag('pro.gate'));
    await this.gotoMap('village_roen', 24, 24, '귀혼의 문 → 로엔 신전');
    await this.until(() => this.flag('pro.reborn'), 15);
    await this.settle();
    this.check('pro.reborn (부활)', this.flag('pro.reborn'));
    this.check('산 자 (ghost=false)', !g.player.ghost);
    this.check('chapter 1', g.state.chapter === 1, `${g.state.chapter}`);
    this.check('ch1_return active', this.qs('ch1_return') === 'active', this.qs('ch1_return'));
    this.check('경비대 옷 장착', g.state.equipment.armor?.id === 'cloth_tunic', JSON.stringify(g.state.equipment.armor));
    this.check('리나 마을에 있음', !!g.findNpc('lina'));
  }

  // ══════════ 1장 ══════════
  async ch1() {
    const g = this.g;
    this.choices.hardin = { c: 0 };
    await this.talk('hardin', null, '촌장 하르딘 첫 만남');
    this.check('ch1_return done', this.qs('ch1_return') === 'done', this.qs('ch1_return'));
    this.check('ch1.met_hardin', this.flag('ch1.met_hardin'));
    this.check('ch1_forest active', this.qs('ch1_forest') === 'active', this.qs('ch1_forest'));
    this.choices.bron = { start: '도울 일', pelt: 0 };
    await this.talk('bron', null, '브론 (옛 검 + 겨울 준비)');
    this.check('옛 검(short_sword) 장착', g.state.equipment.weapon?.id === 'short_sword', JSON.stringify(g.state.equipment.weapon));
    this.check('ch1_pelts active', this.qs('ch1_pelts') === 'active', this.qs('ch1_pelts'));
    this.choices.lina = { r4: 0, r7: 0 };
    await this.talk('lina', null, '리나 재회');
    this.check('ch1.lina_met', this.flag('ch1.lina_met'));
    this.choices.toma = { start: 0, c: 0 };
    await this.talk('toma', null, '토마 의뢰');
    this.check('ch1_cellar active / 지하실 개방', this.qs('ch1_cellar') === 'active' && this.flag('ch1.cellar_ok'), this.qs('ch1_cellar'));
    // 지하실
    await this.usePortal('roen_cellar');
    await this.killFor('ch1_cellar', 'cellar_rat', 8, 90);
    await this.walk(18, 14, { label: '쥐왕의 둥지' });
    await this.bossFight('rat_king');
    this.check('ch1.ratking', this.flag('ch1.ratking'));
    this.check('ch1_cellar ready', this.qs('ch1_cellar') === 'ready', this.qs('ch1_cellar'));
    await this.usePortal('village_roen');
    await this.talk('toma', null, '토마 보고');
    this.check('ch1_cellar done + 가죽 갑옷 보상', this.qs('ch1_cellar') === 'done' && (this.has('leather_armor') || g.state.equipment.armor?.id === 'leather_armor'), this.qs('ch1_cellar'));
    // 사망 → 혼 → 오드릭 부활 (막힘 확인)
    this.god = false;
    g.systems.combat.kill(g.player, null);
    await this.until(() => g.state.map === 'village_roen' && !g.transition && g.player.dead, 6);
    await this.sleep(1);
    this.check('사망 → 신전에서 혼으로', g.player.dead && g.player.ghost, `dead=${g.player.dead} ghost=${g.player.ghost} map=${g.state.map}`);
    await this.talk('odric', null, '오드릭 부활');
    this.check('부활 (오드릭)', !g.player.dead && !g.player.ghost, `dead=${g.player.dead} ghost=${g.player.ghost}`);
    this.god = true;
    // 숲
    if (g.player.level < 5) { g.player.level = 5; g.systems.stats.recalc(g.player); }
    await this.usePortal('whisper_forest');
    this.check('숲 입장', g.state.map === 'whisper_forest');
    await this.killFor('ch1_forest', 'wolf', 8, 120);
    await this.loot(['wolf_pelt']);
    await this.walk(43, 49, { label: '그림팽의 굴' });
    await this.settle();
    this.check('ch1.grimfang_met', this.flag('ch1.grimfang_met'));
    await this.bossFight('grimfang');
    this.check('ch1.grimfang', this.flag('ch1.grimfang'));
    await this.pickup('torn_page_1', '찢긴 장 I 줍기');
    await this.settle();
    this.check('ch1.page1', this.flag('ch1.page1'));
    await this.loot(['wolf_pelt']);
    await this.collect('wolf_pelt', 6, ['wolf'], 150);
    this.check('ch1_forest ready', this.qs('ch1_forest') === 'ready', this.qs('ch1_forest'));
    this.check('ch1_pelts ready', this.qs('ch1_pelts') === 'ready', this.qs('ch1_pelts'));
    await this.usePortal('village_roen');
    await this.talk('hardin', null, '하르딘 보고');
    this.check('ch1_forest done', this.qs('ch1_forest') === 'done', this.qs('ch1_forest'));
    this.choices.bron = { start: '늑대 가죽' };
    await this.talk('bron', null, '브론 가죽 보고');
    this.check('ch1_pelts done + 가죽 신발', this.qs('ch1_pelts') === 'done' && this.has('leather_boots') > 0, this.qs('ch1_pelts'));
    await this.talk('odric', null, '오드릭이 장을 읽음');
    this.check('ch1.done', this.flag('ch1.done'));
    this.check('chapter 2', g.state.chapter === 2, `${g.state.chapter}`);
    this.check('ch2_graveyard active', this.qs('ch2_graveyard') === 'active', this.qs('ch2_graveyard'));
    this.check('상점 1단계 해금(long_sword)', this.shopHas('smithy', 'long_sword'));
  }
  shopHas(shop, id) { const e = this.g.data.shops[shop].items.find((x) => x.id === id); return !!e && this.g.script.check(e.cond); }

  // ══════════ 2장 ══════════
  async ch2() {
    const g = this.g;
    this.choices.mira = { start: '도울 일', dust: 0 };
    await this.talk('mira', null, '미라 (묘지의 흙)');
    this.check('ch2_dust active', this.qs('ch2_dust') === 'active', this.qs('ch2_dust'));
    if (g.player.level < 9) { g.player.level = 9; g.systems.stats.recalc(g.player); }
    await this.usePortal('old_graveyard');
    await this.killFor('ch2_graveyard', 'skeleton', 10, 150);
    await this.killFor('ch2_graveyard', 'zombie', 6, 150);
    const crypt = this.portalTo('crypt_b1')[0];
    await this.walk(crypt.x - 1, crypt.y + 2, { label: '납골당 철문' });
    await this.settle();
    this.check('ch2.crypt_found', this.flag('ch2.crypt_found'));
    this.check('ch2_graveyard ready', this.qs('ch2_graveyard') === 'ready', this.qs('ch2_graveyard'));
    // 봉인 → 오드릭
    await this.walk(crypt.x, crypt.y, { label: '열쇠 없이 철문' });
    await this.sleep(0.5);
    this.check('열쇠 없이는 지하묘지 불가', g.state.map === 'old_graveyard', g.state.map);
    await this.usePortal('village_roen');
    await this.talk('odric', null, '오드릭 묘지 보고');
    this.check('ch2_graveyard done', this.qs('ch2_graveyard') === 'done', this.qs('ch2_graveyard'));
    this.check('ch2.key + crypt_key', this.flag('ch2.key') && this.has('crypt_key'));
    this.check('ch2_crypt active', this.qs('ch2_crypt') === 'active', this.qs('ch2_crypt'));
    await this.usePortal('old_graveyard');
    await this.usePortal('crypt_b1');
    await this.usePortal('crypt_b2');
    await this.walk(28, 24, { label: '대전당' });
    await this.settle();
    this.check('ch2.graus_met', this.flag('ch2.graus_met'));
    await this.bossFight('graus');
    await this.settle(30);
    this.check('ch2.graus', this.flag('ch2.graus'));
    await this.pickup('torn_page_2', '찢긴 장 II 줍기');
    await this.settle();
    this.check('ch2.page2', this.flag('ch2.page2'));
    this.check('ch2_crypt ready', this.qs('ch2_crypt') === 'ready', this.qs('ch2_crypt'));
    if (this.qs('ch2_dust') === 'active') await this.collect('grave_dust', 8, ['ghoul', 'skeleton', 'zombie'], 150);
    // 지름길 → 묘지 → 마을 습격
    await this.usePortal('old_graveyard');
    this.check('지상 지름길', g.state.map === 'old_graveyard');
    if (this.qs('ch2_dust') === 'active') await this.collect('grave_dust', 8, ['skeleton', 'zombie'], 150);
    await this.usePortal('village_roen');
    this.check('ch2.raid_on (습격)', this.flag('ch2.raid_on'));
    this.check('습격 중 마을은 밤', g.world.map.ambient.darkness >= 0.4, `${g.world.map.ambient.darkness}`);
    this.check('신도 4 등장', this.monsters('cultist').length >= 4, `${this.monsters('cultist').length}`);
    if (g.player.level < 12) { g.player.level = 12; g.systems.stats.recalc(g.player); }
    await this.walk(14, 22, { label: '리나의 집 앞' });
    await this.settle();
    await this.killAll('cultist');
    await this.settle(30);
    this.check('ch2.raid_done', this.flag('ch2.raid_done'));
    this.check('격퇴 후 마을은 낮', g.world.map.ambient.darkness <= 0.15, `${g.world.map.ambient.darkness}`);
    this.check('리나 무사(재등장)', !!g.findNpc('lina'));
    if (this.qs('ch2_dust') === 'ready') {
      this.choices.mira = { start: '묘지 흙' };
      await this.talk('mira', null, '미라 흙 보고');
      this.check('ch2_dust done + 보상', this.qs('ch2_dust') === 'done' && this.has('blue_potion') > 0, this.qs('ch2_dust'));
    } else this.fail('ch2_dust ready', this.qs('ch2_dust'));
    this.choices.odric = { c3: 0 };
    await this.talk('odric', null, '오드릭 기도 → 아르겐 계시');
    this.check('ch2_crypt done', this.qs('ch2_crypt') === 'done', this.qs('ch2_crypt'));
    this.check('대지 가르기 습득', g.state.skills.includes('earth_splitter'));
    this.check('ch3.open', this.flag('ch3.open'));
    this.check('chapter 3', g.state.chapter === 3, `${g.state.chapter}`);
    this.check('ch3_tower active', this.qs('ch3_tower') === 'active', this.qs('ch3_tower'));
    this.check('상점 2단계 해금(knight_sword)', this.shopHas('smithy', 'knight_sword'));
    // 가렌 스킬 (Lv12 → 회전베기·돌진·함성)
    for (const sk of ['whirlwind', 'charge', 'war_cry']) {
      if (g.state.skills.includes(sk)) continue;
      const label = { whirlwind: '회전베기', charge: '돌진', war_cry: '함성' }[sk];
      this.choices.garen = { menu: label };
      await this.talk('garen', null, `가렌 ${label}`);
      this.check(`${sk} 습득`, g.state.skills.includes(sk));
    }
  }

  // ══════════ 3장 · 엔딩 ══════════
  async ch3() {
    const g = this.g;
    if (g.player.level < 18) { g.player.level = 18; g.systems.stats.recalc(g.player); }
    await this.usePortal('dusk_tower_1');
    this.check('북문 → 잿빛 황야', g.state.map === 'dusk_tower_1');
    await this.walk(23, 10, { label: '탑 회랑' });
    await this.settle();
    await this.usePortal('dusk_tower_2');
    this.check('탑 정상 도착', g.state.map === 'dusk_tower_2');
    this.check('벨자르(컷신 NPC) 대기', !!g.findNpc('belzar_npc'));
    this.choices.ch3_belzar = { b: 0 };
    await this.walk(20, 17, { label: '의식의 원판' });
    await this.settle();
    this.check('ch3.belzar_met', this.flag('ch3.belzar_met'));
    await this.bossFight('belzar');
    this.choices.ch3_king = { c: 0 };
    await this.settle(40);
    this.check('ch3.belzar', this.flag('ch3.belzar'));
    this.check('ch3.king_met (황혼의 왕 강림)', this.flag('ch3.king_met'));
    // 2페이즈 확인: 체력을 절반 아래로 → 분신 소환
    // 황혼의 왕 전투 중 사망 → 마을 신전 혼 → 오드릭 부활 → 다시 정상 → 왕 복구
    if (this.monsters('dusk_king').length) {
      this.god = false;
      g.systems.combat.kill(g.player, null);
      await this.until(() => g.state.map === 'village_roen' && !g.transition, 8);
      await this.sleep(1);
      this.check('3장 사망 → 신전', g.state.map === 'village_roen' && g.player.dead, `map=${g.state.map} dead=${g.player.dead}`);
      this.god = true;
      await this.talk('odric', null, '오드릭 부활 (3장)');
      this.check('부활', !g.player.dead && !g.player.ghost);
      await this.usePortal('dusk_tower_1');
      await this.walk(23, 10, { label: '탑 회랑 (재방문)' });
      await this.usePortal('dusk_tower_2');
      this.check('재입장 시 황혼의 왕 복구', this.monsters('dusk_king').length === 1, `${this.monsters('dusk_king').length}`);
      this.check('벨자르는 다시 나오지 않음', !this.monsters('belzar').length && !g.findNpc('belzar_npc'));
    }
    const king = this.monsters('dusk_king')[0];
    if (this.check('황혼의 왕 등장', king)) {
      const ai = g.systems.ai;
      await this.walk(king.x, king.y, { adjacent: true, label: '왕에게 접근' });
      ai.engage?.(king, g.player);
      king.hp = Math.floor(king.maxHp * 0.45);
      await this.until(() => king.ai?.b?.phase2, 6);
      this.check('2페이즈 전환(분신 소환)', king.ai?.b?.phase2, `ai=${JSON.stringify({ state: king.ai?.state, b: !!king.ai?.b })}`);
      const endings = this.events.ending;
      this.choices.ch3_ending = { f: 0 };
      this.killing = king; g.systems.combat.kill(king, g.player); this.killing = null;
      await this.until(() => this.events.ending > endings, 40);
      await this.settle();
      this.check('ch3.king', this.flag('ch3.king'));
      this.check('ch3.page3 (찢긴 장 III)', this.flag('ch3.page3'));
      this.check('찢긴 장 정리 (인벤·바닥)', !this.has('torn_page_1') && !this.has('torn_page_2') && !this.has('torn_page_3') && !g.world.entities.some((e) => e.kind === 'drop' && /^torn_page/.test(e.itemId || '')));
      this.check('ch3_tower done', this.qs('ch3_tower') === 'done', this.qs('ch3_tower'));
      this.check('세린의 펜던트 보상', this.has('serin_pendant') > 0);
      this.check('엔딩 선택 기록(end.stay/guard)', this.flag('end.stay') || this.flag('end.guard'));
      this.check('end.cleared', this.flag('end.cleared'));
      this.check('chapter 4', g.state.chapter === 4, `${g.state.chapter}`);
      this.check('game:ending 발생', this.events.ending > endings);
      this.check('엔딩 화면 표시', g.ui?.ending?.active, 'ui.ending.active=false');
      g.ui?.ending?.continueAfter?.();
      await this.until(() => g.state.map === 'village_roen' && !g.transition, 6);
      await this.settle();
      this.check('엔딩 후 로엔에서 이어하기', g.state.map === 'village_roen' && g.state.ended, `map=${g.state.map} ended=${g.state.ended}`);
    }
  }

  // ══════════ 포스트게임 ══════════
  async post() {
    const g = this.g;
    this.check('state.ended', g.state.ended);
    this.check('신전에 세린', !!g.findNpc('recorder'));
    // 엔딩 후 대사
    const POST = { odric: 'post', hardin: 'post', bron: 'post', mira: 'post', toma: 'post', lina: 'post', garen: 'post', guard_north: 'post', guard_east: 'post', villager_baker: 'post', villager_farmer: 'post', villager_widow: 'post', villager_kid: 'post', villager_bard: 'post' };
    for (const [npc, node] of Object.entries(POST)) {
      const shown = await this.peek(npc);
      this.check(`엔딩 후 대사 ${npc}`, shown === `${npc}.${node}`, `${shown}`);
    }
    // 상점 3단계
    for (const id of ['argen_blade', 'claymore', 'dusk_plate', 'aegis_argen', 'wind_boots']) this.check(`상점 END 해금 ${id}`, this.shopHas('smithy', id));
    this.check('상점 END 해금 abyss_ring', this.shopHas('general', 'abyss_ring'));
    g.state.gold += 200000;
    this.check('구매 argen_blade', g.systems.inventory.buy('smithy', 'argen_blade', 1) && this.has('argen_blade'));
    // 망각의 균열
    await this.talk('recorder', null, '세린 (망각의 균열)');
    this.check('post_rift active', this.qs('post_rift') === 'active', this.qs('post_rift'));
    if (g.player.level < 22) { g.player.level = 22; g.systems.stats.recalc(g.player); }
    await this.usePortal('rift_abyss');
    this.check('균열 진입', g.state.map === 'rift_abyss');
    await this.killAll('rift_shade', 2);
    await this.walk(24, 13, { label: '군주의 옥좌' });
    await this.bossFight('rift_lord');
    this.check('post_rift ready', this.qs('post_rift') === 'ready', this.qs('post_rift'));
    await this.usePortal('village_roen');
    await this.talk('recorder', null, '세린 보고');
    const ringDropped = g.world.entities.some((e) => e.kind === 'drop' && e.itemId === 'ruby_ring');
    this.check('post_rift done + 루비 반지', this.qs('post_rift') === 'done' && (this.has('ruby_ring') > 0 || ringDropped), `${this.qs('post_rift')} 빈칸=${g.systems.inventory.freeSlots()}`);
    if (ringDropped) { this.note('가방이 가득 차 보상 반지가 발밑에 떨어짐'); await this.loot(['ruby_ring']); }
    // 재방문
    await this.usePortal('rift_abyss');
    this.check('균열 재입장', g.state.map === 'rift_abyss');
    await this.usePortal('village_roen');
  }
}
