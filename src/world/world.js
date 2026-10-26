import { TILES, GROUND_LEGEND, OBJECT_LEGEND } from '../data/tiles.js';
import { DIRS, dirFromDelta } from '../core/iso.js';
import { makeEntity, setAnim } from './entity.js';

// 월드: 현재 맵의 그리드, 엔티티, 이동/충돌, 포탈/트리거. 소유: 관리자.
export class World {
  constructor(game) {
    this.game = game;
    this.map = null;      // 원본 맵 데이터
    this.w = 0; this.h = 0;
    this.ground = [];     // 타일 id 배열 (w*h)
    this.obj = [];        // 오브젝트 타일 id 또는 null
    this.entities = [];
    this.lights = [];     // [{x,y,radius,color}] 정적 광원(타일 광원 + 맵 광원)
    this.firedTriggers = new Set();
    // 맵 데이터 훅: onKill / onPickup (docs/ARCHITECTURE.md §11)
    game.bus.on('entity:died', ({ entity }) => {
      if (entity.kind !== 'monster' || !this.map) return;
      for (const h of this.map.onKill || []) {
        if (h.monster !== entity.monsterId) continue;
        if (h.cond && !this.game.script.check(h.cond)) continue;
        if (h.all && this.entities.some((e) => e !== entity && e.kind === 'monster' && !e.dead && e.monsterId === h.monster)) continue;
        this.runActionsSafe(h.actions);
      }
    });
    game.bus.on('item:pickup', ({ itemId }) => {
      if (!this.map || !itemId) return;
      for (const h of this.map.onPickup || []) {
        if (h.item !== itemId) continue;
        if (h.cond && !this.game.script.check(h.cond)) continue;
        this.runActionsSafe(h.actions);
      }
    });
  }

  // ── 맵 로딩 ──
  load(mapId, px, py) {
    const map = this.game.data.maps[mapId];
    if (!map) throw new Error(`맵 없음: ${mapId}`);
    this.map = map;
    const rows = map.ground;
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    const gl = { ...GROUND_LEGEND, ...(map.groundLegend || {}) };
    const ol = { ...OBJECT_LEGEND, ...(map.objectLegend || {}) };
    this.ground = new Array(this.w * this.h).fill('void');
    this.obj = new Array(this.w * this.h).fill(null);
    this.lights = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const gc = rows[y][x] ?? ' ';
        const gid = gl[gc] ?? 'void';
        if (!TILES[gid]) console.warn(`[${mapId}] 알 수 없는 지면 타일 '${gc}'→${gid} @${x},${y}`);
        this.ground[y * this.w + x] = gid;
        const oc = map.objects?.[y]?.[x];
        if (oc && oc !== ' ' && oc !== '.') {
          const oid = ol[oc];
          if (!oid || !TILES[oid]) console.warn(`[${mapId}] 알 수 없는 오브젝트 '${oc}' @${x},${y}`);
          else this.obj[y * this.w + x] = oid;
        }
        for (const id of [this.ground[y * this.w + x], this.obj[y * this.w + x]]) {
          const L = id && TILES[id]?.light;
          if (L) this.lights.push({ x, y, ...L, tile: id });
        }
      }
    }
    for (const L of map.lights || []) this.lights.push({ ...L });

    const player = this.game.player;
    this.entities = player ? [player] : [];
    this.firedTriggers = new Set();
    if (player) {
      player.x = px ?? map.start?.x ?? 1;
      player.y = py ?? map.start?.y ?? 1;
      player.rx = player.x; player.ry = player.y;
      player.move = null;
      player.path = null;
      this.game.state.map = mapId;
    }
    for (const n of map.npcs || []) this.spawnNpc(n.id, n.x, n.y, n);
    this.game.bus.emit('map:loaded', { map, world: this });
    this.runActionsSafe(map.onEnter);
  }

  spawnNpc(npcId, x, y, extra = {}) {
    const def = this.game.data.npcs[npcId];
    if (!def) { console.warn('NPC 정의 없음', npcId); return null; }
    if (def.cond && !this.game.script.check(def.cond)) return null;
    if (extra.cond && !this.game.script.check(extra.cond)) return null;
    const e = makeEntity('npc', {
      npcId, name: def.name, x, y, dir: extra.dir ?? def.dir ?? 4,
      look: { ...(def.look || {}) }, faction: 'neutral',
      dialog: extra.dialog ?? def.dialog, wander: extra.wander ?? def.wander ?? 0,
      home: { x, y }, title: def.title,
    });
    this.addEntity(e);
    return e;
  }

  addEntity(e) { this.entities.push(e); this.game.bus.emit('entity:added', { entity: e }); return e; }
  removeEntity(e) {
    const i = this.entities.indexOf(e);
    if (i >= 0) { this.entities.splice(i, 1); this.game.bus.emit('entity:removed', { entity: e }); }
  }

  // ── 질의 ──
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  groundAt(x, y) { return this.inBounds(x, y) ? this.ground[y * this.w + x] : 'void'; }
  objAt(x, y) { return this.inBounds(x, y) ? this.obj[y * this.w + x] : null; }
  tileWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const g = TILES[this.groundAt(x, y)], o = this.objAt(x, y);
    if (!g?.walk) return false;
    if (o && !TILES[o].walk) return false;
    return true;
  }
  // 동적 장애물 설정 (스토리로 열리는 장벽 등)
  setObj(x, y, id) {
    if (!this.inBounds(x, y)) return;
    this.obj[y * this.w + x] = id;
    this.lights = this.lights.filter((l) => !(l.x === x && l.y === y && l.tile));
    const L = id && TILES[id]?.light;
    if (L) this.lights.push({ x, y, ...L, tile: id });
    this.game.bus.emit('map:tileChanged', { x, y, id });
  }
  entitiesAt(x, y) { return this.entities.filter((e) => e.x === x && e.y === y); }
  blockerAt(x, y, except) {
    return this.entities.find((e) => e !== except && e.blocking && !e.dead && e.x === x && e.y === y) || null;
  }
  isFree(x, y, except) { return this.tileWalkable(x, y) && !this.blockerAt(x, y, except); }

  // 한 칸 이동 가능? (대각선은 양 옆 중 하나라도 벽이면 모서리 끼임으로 불가)
  canStep(fx, fy, tx, ty, mover, ignoreEntities = false) {
    if (!this.tileWalkable(tx, ty)) return false;
    if (!ignoreEntities && this.blockerAt(tx, ty, mover)) return false;
    const dx = tx - fx, dy = ty - fy;
    if (dx !== 0 && dy !== 0) {
      if (!this.tileWalkable(fx + dx, fy) || !this.tileWalkable(fx, fy + dy)) return false;
    }
    return true;
  }

  entitiesInRange(x, y, r, filter) {
    return this.entities.filter((e) => Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= r && (!filter || filter(e)));
  }

  // ── 이동 ──
  // 방향으로 한 칸 이동 시작. 성공 시 true. leftover: 이전 이동에서 남은 시간(끊김 없는 연속 이동).
  tryMove(e, dir, leftover = 0) {
    if (e.move || (e.dead && e.kind !== 'player')) return false;
    const d = DIRS[dir];
    e.dir = dir;
    const tx = e.x + d.dx, ty = e.y + d.dy;
    if (!this.canStep(e.x, e.y, tx, ty, e)) return false;
    const diag = d.dx !== 0 && d.dy !== 0;
    const slow = TILES[this.groundAt(tx, ty)]?.slow ?? 1;
    const dur = (diag ? 1.3 : 1) / (e.speed * slow * (e.speedMul ?? 1));
    e.move = { fx: e.x, fy: e.y, tx, ty, t: Math.min(leftover, dur * 0.9), dur };
    e.x = tx; e.y = ty;
    setAnim(e, 'walk');
    this.game.bus.emit('entity:moveStart', { entity: e, dir });
    return true;
  }

  stepToward(e, tx, ty, leftover = 0) {
    const dir = dirFromDelta(tx - e.x, ty - e.y);
    return dir >= 0 && this.tryMove(e, dir, leftover);
  }

  update(dt) {
    for (const e of this.entities) {
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
      e.anim.t += dt;
      if (e.move) {
        const m = e.move;
        m.t += dt;
        if (m.t >= m.dur) {
          const leftover = m.t - m.dur;
          e.move = null;
          e.rx = e.x; e.ry = e.y;
          this.onArrive(e);
          // 연속 이동: nextStep 훅이 다음 칸 이동을 시작하면 남은 시간을 이어받는다.
          const continued = e.nextStep ? e.nextStep(leftover) : false;
          if (!continued && !e.move && e.anim.state === 'walk') setAnim(e, 'idle');
        } else {
          const k = m.t / m.dur;
          e.rx = m.fx + (m.tx - m.fx) * k;
          e.ry = m.fy + (m.ty - m.fy) * k;
        }
      } else {
        e.rx = e.x; e.ry = e.y;
      }
    }
  }

  onArrive(e) {
    this.game.bus.emit('entity:moved', { entity: e });
    if (e.kind !== 'player') return;
    const map = this.map;
    for (const tr of map.triggers || []) {
      const w = tr.w ?? 1, h = tr.h ?? 1;
      if (e.x < tr.x || e.y < tr.y || e.x >= tr.x + w || e.y >= tr.y + h) continue;
      const key = tr.id || `${tr.x},${tr.y}`;
      if (tr.once && (this.firedTriggers.has(key) || this.game.state.flags[`trig:${map.id}:${key}`])) continue;
      if (tr.cond && !this.game.script.check(tr.cond)) continue;
      this.firedTriggers.add(key);
      if (tr.once) this.game.state.flags[`trig:${map.id}:${key}`] = true;
      this.runActionsSafe(tr.actions);
    }
    for (const p of map.portals || []) {
      if (p.x !== e.x || p.y !== e.y) continue;
      if (p.cond && !this.game.script.check(p.cond)) {
        if (p.failMsg) this.game.log(p.failMsg, 'system');
        if (p.failActions) this.runActionsSafe(p.failActions);
        // 막힌 포탈이면 왔던 쪽으로 밀어냄
        continue;
      }
      this.game.changeMap(p.to, p.tx, p.ty, p.dir);
      return;
    }
  }

  runActionsSafe(actions) {
    if (!actions) return;
    // run 은 비동기 → 동기 예외와 Promise 거부 모두 처리
    try { this.game.script.run(actions)?.catch?.((err) => console.error('스크립트 오류', err)); }
    catch (err) { console.error('스크립트 오류', err); }
  }
}
