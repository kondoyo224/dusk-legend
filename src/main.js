import { EventBus } from './core/events.js';
import { Input } from './core/input.js';
import { Script } from './core/script.js';
import { DialogRunner } from './core/dialog.js';
import { Controller } from './core/controller.js';
import { newState, readSave, writeSave, hasSave, START_MAP } from './core/state.js';
import { findPath } from './core/pathfind.js';
import { chebyshev, dirTowards } from './core/iso.js';
import { World } from './world/world.js';
import { DATA } from './data/index.js';
import { createSystems } from './systems/index.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { AudioEngine } from './audio/audio.js';

// 게임 조립 & 메인 루프. 소유: 관리자. 공개 API 는 docs/ARCHITECTURE.md §Game.
export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.bus = new EventBus();
    this.input = new Input(this.canvas);
    this.data = DATA;
    this.state = null;
    this.scene = 'title';      // 'title' | 'play'
    this.cutscene = false;     // true면 플레이어 조작 잠금
    this.transition = null;    // 맵 전환 중
    this.timers = [];          // {t, fn}
    this.hitstopT = 0;
    this.time = 0;

    this.script = new Script(this);
    this.dialog = new DialogRunner(this);
    this.world = new World(this);
    this.controller = new Controller(this);
    this.systems = createSystems(this);
    this.renderer = new Renderer(this, this.canvas);
    this.ui = new UI(this, document.getElementById('ui-root'));
    this.audio = new AudioEngine(this);
  }

  get player() { return this.state?.player ?? null; }

  start() {
    this.ui.showTitle({ canContinue: hasSave() });
    this.bus.emit('scene:title');
    // 헤드리스 테스트에선 rAF 가 돌지 않으므로 타이머 루프 사용 (?test=...)
    const headless = /[?&]test=/.test(location.search);
    const schedule = headless ? (f) => setTimeout(() => f(performance.now()), 16) : requestAnimationFrame;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 한 프레임의 예외가 루프 전체를 멈추지 않도록 (오류는 수집기로 보고됨)
      try { this.tick(dt); } catch (e) { console.error('프레임 오류', e); this.input.endFrame(); }
      schedule(frame);
    };
    schedule(frame);
  }

  tick(dt) {
    this.time += dt;
    // 타이머 (스크립트 wait 등) — 히트스톱과 무관하게 진행
    if (this.timers.length) {
      for (const t of this.timers) t.t -= dt;
      const due = this.timers.filter((t) => t.t <= 0);
      this.timers = this.timers.filter((t) => t.t > 0);
      due.forEach((t) => t.fn());
    }
    if (this.scene === 'play' && this.state) {
      this.state.playTime += dt;
      if (this.hitstopT > 0) {
        this.hitstopT -= dt;            // 히트스톱: 월드 정지(타격감)
      } else {
        this.controller.update(dt);
        this.world.update(dt);
        this.systems.update(dt);
      }
    }
    this.ui.update(dt);
    this.renderer.render(dt);
    this.audio.update?.(dt);
    this.input.endFrame();
  }

  // ── 게임 시작/저장 ──
  newGame(opts) {
    this.state = newState(opts);
    this.beginPlay(opts.startMap ?? START_MAP, opts.startX, opts.startY); // startMap: 디버그 전용
    this.bus.emit('game:new', {});
  }
  continueGame() {
    const s = readSave();
    if (!s) return false;
    this.state = s;
    this.beginPlay(s.map, s.player.x, s.player.y);
    this.bus.emit('game:loaded', {});
    return true;
  }
  beginPlay(mapId, x, y) {
    this.controller.clearOrders();
    this.controller.attach(this.player);
    this.systems.stats.recalc(this.player);
    this.scene = 'play';
    this.world.load(mapId, x, y);
    this.ui.showHud();
  }
  save() {
    if (!this.state) return false;
    const ok = writeSave(this.state);
    if (ok) this.bus.emit('game:saved', {});
    return ok;
  }

  // ── 맵 전환 (페이드) ──
  changeMap(mapId, x, y, dir) {
    if (this.transition) return;
    this.transition = { mapId };
    this.controller.clearOrders();
    this.bus.emit('fx:fade', { to: 1, time: 0.25 });
    this.timers.push({ t: 0.25, fn: () => {
      this.world.load(mapId, x, y);
      if (dir != null) this.player.dir = dir;
      this.bus.emit('fx:fade', { to: 0, time: 0.35 });
      this.transition = null;
      this.save();
    } });
  }

  // ── 편의 API ──
  log(text, channel = 'system') { this.bus.emit('chat', { text, channel }); }
  say(entity, text) {
    this.bus.emit('npc:say', { entity, text });
    this.bus.emit('chat', { text: `${entity.name}: ${text}`, channel: entity.kind === 'player' ? 'say' : 'npc' });
  }
  format(text) {
    if (typeof text !== 'string') return text;
    const f = this.player?.look?.gender === 'f';
    return text
      .replace(/\{name\}/g, this.player?.name ?? '')
      .replace(/\{sibling\}/g, f ? '언니' : '오빠')
      .replace(/\{gold\}/g, String(this.state?.gold ?? 0));
  }
  findNpc(npcId) { return this.world.entities.find((e) => e.kind === 'npc' && e.npcId === npcId) || null; }
  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }

  interactWith(e) {
    const p = this.player;
    if (e.kind === 'drop') return this.systems.inventory.pickup(e);
    if (e.kind === 'npc') {
      if (chebyshev(p.x, p.y, e.x, e.y) > 1) return;
      e.dir = dirTowards(e.x, e.y, p.x, p.y);
      p.dir = dirTowards(p.x, p.y, e.x, e.y);
      let d = e.dialog;
      if (typeof d === 'function') d = d(this);
      if (Array.isArray(d)) d = d.find((o) => this.script.check(o.cond))?.dialog;
      this.bus.emit('npc:interact', { npc: e });
      if (d) this.dialog.start(d, e);
    }
  }

  // NPC를 목표 타일까지 걸어가게 함 (컷신). 도착 시 resolve.
  walkNpcTo(npcId, tx, ty) {
    const e = this.findNpc(npcId);
    if (!e) return Promise.resolve();
    return new Promise((resolve) => {
      let guard = 200;
      const tick = () => {
        if (--guard <= 0 || !this.world.entities.includes(e)) return resolve();
        if (e.x === tx && e.y === ty) return resolve();
        if (!e.move) {
          const path = findPath(e.x, e.y, tx, ty, (fx, fy, nx, ny) => this.world.canStep(fx, fy, nx, ny, e));
          if (!path || !path.length) return resolve();
          this.world.stepToward(e, path[0].x, path[0].y);
        }
        this.timers.push({ t: 0.05, fn: tick });
      };
      tick();
    });
  }
}

const game = new Game();
window.game = game; // 디버그용
game.start();

// ── 디버그 파라미터: ?autostart&map=ID&x=&y=&cls=warrior&level=5&flags=a,b&ended ──
const q = new URLSearchParams(location.search);
if (q.has('autostart')) {
  // 플래그·직업·레벨을 먼저 세운 뒤 목표 맵에서 바로 시작 (맵 onEnter 조건이 올바르게 평가되도록)
  game.ui.hideTitle?.();
  game.state = newState({ name: q.get('name') || '시험자' });
  for (const f of (q.get('flags') || '').split(',').filter(Boolean)) game.state.flags[f] = true;
  if (q.get('ghost') === '0') { game.state.flags['pro.reborn'] = true; game.player.ghost = false; }
  if (q.get('cls')) game.state.cls = q.get('cls');
  if (q.get('level')) game.player.level = +q.get('level');
  if (q.has('ended')) { game.state.ended = true; game.state.flags['end.cleared'] = true; }
  game.beginPlay(q.get('map') || START_MAP, q.get('x') ? +q.get('x') : undefined, q.get('y') ? +q.get('y') : undefined);
  game.bus.emit('game:new', {});
  if (q.get('cls')) game.systems.stats.setClass(game.player, q.get('cls'));
  game.player.hp = game.player.maxHp; game.player.mp = game.player.maxMp;
  game.ui.showHud();
  if (q.get('test')) import('./debug/tests.js').then((m) => m.runTests(game, q.get('test')));
}
const marker = document.createElement('div');
marker.id = '__ready';
document.body.appendChild(marker);
