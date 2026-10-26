// 렌더러 진입점. 소유: 워커 A. 공개 API: docs/ARCHITECTURE.md §7
//   render(dt), screenToTile(sx,sy), pickEntity(sx,sy), drawPortrait, drawItemIcon, drawSkillIcon, drawGoldIcon, camera{x,y,zoom}
// 도트풍 파이프라인(ART_STYLE §2): 월드를 (창 크기 / 스케일) 저해상도 버퍼에 1:1(월드px=버퍼px)로 그리고
//   메인 캔버스에 최근접 확대. 이름표·말풍선 글자만 메인 캔버스에 원해상도(굴림 12px)로 쓴다.
// 구성: ground.js / tiles.js / sprites.js / lighting.js / fx.js / icons.js / pixel.js(도트 도구)
import { tileToWorld, worldToTileF, TILE_W, TILE_H } from '../core/iso.js';
import { TILES } from '../data/tiles.js';
import { GroundLayer, FLAT_OBJECTS } from './ground.js';
import { objectSprite, objectSpriteReady, drawObjectAnim, drawGroundAnim, ANIMATED_OBJECTS, clearObjectCache, objectTop } from './tiles.js';
import { getSprite, getVariant, animOf, isHumanoid, FLYING, DEAD_T, clearSpriteCache } from './sprites.js';
import { Lighting } from './lighting.js';
import { FX } from './fx.js';
import { drawItemIcon, drawSkillIcon, drawPortrait, goldIcon } from './icons.js';
import { drawEntityExtras, drawProjectiles, drawTelegraphs } from './overlays.js';
import { TitleScene } from './title.js';
import { Showcase } from './showcase.js';
import { makeCanvas, clamp, mix } from './util.js';
import { drawShadow, pxEllipse, FONT_PIX, outlinedText } from './pixel.js';

const GRADE_COLOR = { common: '#e8e4d8', uncommon: '#5fd35f', rare: '#4f9cff', epic: '#b46cff', legendary: '#ff9a2e' };
const DEAD_LINGER = 1.4;   // 워커 B: 사망 후 1.4초 뒤 제거
const ZOOMS = [1, 1.5, 2];  // 1× 기준 확대만 (축소는 도트가 깨짐)

export class Renderer {
  constructor(game, canvas) {
    this.game = game; this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.cam = this.camera; // 구버전 호환
    this.buf = makeCanvas(2, 2); this.bctx = this.buf.getContext('2d');
    this.PIXEL_SCALE = 1; this.S = 1; this.bw = 2; this.bh = 2; this.ox = 0; this.oy = 0;
    this.ground = new GroundLayer();
    this.lighting = new Lighting();
    this.fx = new FX(this);
    this.title = new TitleScene(this);
    this.showcase = new URLSearchParams(location.search).has('showcase') ? new Showcase(this) : null;
    this.hover = null;
    this.occl = new Map();       // 가림 반투명 보간값
    this.snapCam = true;
    this.mapId = null;
    this.frameDraw = [];         // 이번 프레임 엔티티 월드 박스 (pick 용)
    this.isHumanoid = isHumanoid;
    this.dbg = /[?&]rdbg/.test(location.search); // 디버그: check.mjs STATE 출력
    if (this.dbg) { const z = +new URLSearchParams(location.search).get('zoom'); if (ZOOMS.includes(z)) this.camera.zoom = z; }

    const b = game.bus;
    b.on('map:loaded', ({ world }) => this.onMap(world));
    b.on('map:tileChanged', ({ x, y }) => this.ground.invalidate(x, y));
    // 맵 ambient 가 진행도(플래그)에 따라 바뀌는 경우(마을 습격 밤↔낮) 즉시 반영
    b.on('flags:changed', () => {
      const map = game.world?.map, a = map?.ambient, cur = this.lighting.ambient;
      if (a && (a.darkness !== cur.darkness || (a.tint || null) !== cur.tint)) this.lighting.setMap(map);
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  onMap(world) {
    this._mapFrame = 0; this._peak = 0; this._gFrame = 0;
    this.ground.reset(world);
    this.lighting.setMap(world.map);
    this.occl.clear();
    this.snapCam = true;
    if (this.mapId !== world.map.id) clearObjectCache();
    this.mapId = world.map.id;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h;
    // ART_STYLE ★v2: 1× 원본 해상도(화면 px = 도트 1개). 아주 큰 화면(QHD 이상)에서만 2배. 휴대폰도 1배.
    this.PIXEL_SCALE = Math.min(w, h) >= 1300 && w * h > 2400 * 1300 ? 2 : 1;
    this.title.resize(w, h);
    this.fitBuffer();
  }

  // 유효 배율 S = PIXEL_SCALE × zoom → 버퍼 크기
  fitBuffer() {
    const S = this.PIXEL_SCALE * this.camera.zoom;
    const bw = Math.ceil(this.W / S), bh = Math.ceil(this.H / S);
    if (S === this.S && bw === this.bw && bh === this.bh) return;
    this.S = S; this.bw = bw; this.bh = bh;
    this.buf.width = bw; this.buf.height = bh;
    this.bctx.imageSmoothingEnabled = false;
    this.lighting.resize(bw, bh);
  }

  // ── 좌표 변환 (sx,sy = 메인 캔버스 픽셀 = input.mouse 좌표) ──
  syncOrigin() {
    if (this.viewX == null) { this.viewX = Math.round(this.camera.x); this.viewY = Math.round(this.camera.y); }
    this.ox = Math.round(this.bw / 2 - this.viewX);
    this.oy = Math.round(this.bh / 2 - this.viewY);
  }
  worldToBuf(wx, wy) { return { x: wx + this.ox, y: wy + this.oy }; }
  worldToScreen(wx, wy) { return { x: (wx + this.ox) * this.S, y: (wy + this.oy) * this.S }; }
  screenToWorld(sx, sy) { return { x: sx / this.S - this.ox, y: sy / this.S - this.oy }; }
  screenToTile(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    const t = worldToTileF(w.x, w.y);
    const p = { x: Math.round(t.x), y: Math.round(t.y) };
    return this.game.world?.inBounds(p.x, p.y) ? p : null;
  }

  // 스프라이트 영역 기반 클릭 판정 (앞에 그려진 것 우선, 몬스터/NPC/드랍 우선)
  pickEntity(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    let best = null, bestScore = -Infinity;
    for (const d of this.frameDraw) {
      const e = d.e;
      if (e.kind === 'player') continue;
      if (e.dead && e.kind === 'monster') continue;
      if (w.x < d.x0 || w.x > d.x1 || w.y < d.y0 || w.y > d.y1) continue;
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const score = d.depth * 10 - Math.hypot(w.x - cx, (w.y - cy) * 0.5) * 0.2 + (e.kind === 'drop' ? 5 : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  spriteTop(e) { return e?._lastSprite?.top ?? (e?.kind === 'drop' ? 14 : 46); }

  // UI 지원 API
  drawPortrait(ctx, look, x, y, size) { drawPortrait(ctx, look, x, y, size); }
  drawItemIcon(ctx, itemId, x, y, size) { drawItemIcon(this.game, ctx, itemId, x, y, size); }
  drawSkillIcon(ctx, skillId, x, y, size) { drawSkillIcon(this.game, ctx, skillId, x, y, size); }
  drawGoldIcon(ctx, x, y, size) { goldIcon(ctx, x, y, size); }

  // ── 카메라 ──
  updateCamera(dt) {
    const g = this.game, p = g.player;
    const inp = g.input;
    if (inp?.wheel && !g.ui?.isBlocking?.()) {
      let i = ZOOMS.indexOf(this.camera.zoom); if (i < 0) i = 0;
      this.camera.zoom = ZOOMS[clamp(i - Math.sign(inp.wheel), 0, ZOOMS.length - 1)];
    }
    if (!ZOOMS.includes(this.camera.zoom)) this.camera.zoom = ZOOMS.reduce((a, z) => (Math.abs(z - this.camera.zoom) < Math.abs(a - this.camera.zoom) ? z : a), 1);
    this.fitBuffer();
    if (!p) return;
    const t = tileToWorld(p.rx, p.ry);
    const tx = t.x, ty = t.y - 20;
    if (this.snapCam) { this.camera.x = tx; this.camera.y = ty; this.snapCam = false; }
    else {
      const k = 1 - Math.exp(-dt * 9);
      this.camera.x += (tx - this.camera.x) * k;
      this.camera.y += (ty - this.camera.y) * k;
    }
    const sh = this.fx.shakeOffset(g.time);
    // 정수 픽셀 스냅
    this.viewX = Math.round(this.camera.x + sh.x);
    this.viewY = Math.round(this.camera.y + sh.y);
  }

  // ── 메인 ──
  render(dt) {
    if (!this.dbg) return this._render(dt);
    const t0 = performance.now();
    const fresh = this._mapFrame === 0;
    this._render(dt);
    const ms = Math.round(performance.now() - t0);
    (this._ms = this._ms || []).push(ms);
    if (this._ms.length > 12) this._ms.shift();
    // 맵 로드 직후 첫 프레임들 시간 (첫 프레임 멈춤 측정: first = 첫 render, peak = 첫 30프레임 최대)
    if (this._mapFrame != null && this._mapFrame < 30 && this.game.scene === 'play') {
      if (fresh) this._first = ms;
      this._peak = Math.max(this._peak || 0, ms);
      this._mapFrame++;
    }
  }

  _render(dt) {
    const { ctx, game } = this;
    const time = game.time;
    ctx.imageSmoothingEnabled = false;
    if (this.showcase) { this.showcase.render(ctx, dt, time); return; }
    this.fx.update(dt);
    if (game.scene !== 'play' || !game.world?.map) {
      this.title.render(ctx, dt, time);
      this.fx.drawScreen(ctx, this.W, this.H);
      return;
    }
    if (this.ground.world !== game.world || this.mapId !== game.world.map.id) this.onMap(game.world);
    this.updateCamera(dt);
    this.syncOrigin();
    if (this.dbg && /fxdemo/.test(location.search) && !this._demo) this.fxDemo();
    const b = this.bctx, bw = this.bw, bh = this.bh, ox = this.ox, oy = this.oy;
    const amb = this.lighting.ambient;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    b.fillStyle = mix('#05040a', amb.tint || '#05040a', 0.15);
    b.fillRect(0, 0, bw, bh);

    // 월드 변환 (정수 평행이동만)
    b.setTransform(1, 0, 0, 1, ox, oy);
    const vx0 = -ox - 64, vx1 = -ox + bw + 64;
    const vy0 = -oy - 32, vy1 = -oy + bh + 160;
    const chunks = this.ground.visible(vx0, vy0, vx1, vy1);
    // 맵 첫 프레임 멈춤 방지: 화면 중앙 청크부터 시간 예산 안에서 굽고 나머지는 다음 프레임들로 분산
    const firstF = (this._gFrame = (this._gFrame ?? 0) + 1) === 1;
    const tg0 = performance.now();
    this.ground.draw(b, chunks, [-ox, -oy, -ox + bw, -oy + bh], firstF ? 42 : 9);
    if (!this.ground.pending) this.ground.prefetch(vx0, vy0, vx1, vy1);
    const tg1 = performance.now();
    for (const m of chunks) {
      for (const a of m.anim) { const p = tileToWorld(a.x, a.y); if (p.x > vx0 && p.x < vx1 && p.y > vy0 && p.y < vy1) drawGroundAnim(b, a.id, p.x, p.y, a.x, a.y, time); }
      for (const a of m.flatAnim) { const p = tileToWorld(a.x, a.y); drawObjectAnim(b, a.id, p.x, p.y, a.x, a.y, time); }
    }
    drawTelegraphs(b, this, time);
    this.fx.drawUnder(b, time);
    this.drawGroundMarks(b, time);

    // 깊이 정렬: 오브젝트 + 엔티티
    const list = [];
    const p = game.player;
    const pDepth = p ? this.depthOf(p) : 0;
    const pw = p ? tileToWorld(p.rx, p.ry) : null;
    for (const m of chunks) for (const o of m.objs) {
      const op = tileToWorld(o.x, o.y);
      if (op.x < vx0 - 40 || op.x > vx1 + 40 || op.y < vy0 - 20 || op.y - objectTop(o.id) > vy1) continue;
      list.push({ d: o.x + o.y, o, wx: op.x, wy: op.y });
    }
    for (const e of game.world.entities) {
      const ep = tileToWorld(e.rx, e.ry);
      if (ep.x < vx0 - 60 || ep.x > vx1 + 60 || ep.y < vy0 - 40 || ep.y - 140 > vy1) continue;
      list.push({ d: this.depthOf(e), e, wx: ep.x, wy: ep.y });
    }
    list.sort((a, c) => a.d - c.d);
    // 오브젝트 스프라이트도 같은 방식: 아직 안 구운 것은 화면 중앙에 가까운 것부터 예산 안에서
    {
      const cx = -ox + bw / 2, cy = -oy + bh / 2, todo = [];
      for (const it of list) if (it.o && !objectSpriteReady(it.o.id, it.o.x, it.o.y, game.world)) todo.push(it);
      if (todo.length) {
        todo.sort((a, c) => Math.hypot(a.wx - cx, a.wy - cy) - Math.hypot(c.wx - cx, c.wy - cy));
        const t0 = performance.now(), bud = firstF ? 26 : 7;
        for (const it of todo) { if (performance.now() - t0 > bud) { it.skip = true; continue; } objectSprite(it.o.id, it.o.x, it.o.y, game.world); }
      }
    }
    this.frameDraw = [];
    const target = game.controller?.target;
    const te0 = this.dbg ? performance.now() : 0;
    for (const it of list) {
      if (it.o) { if (!it.skip) this.drawObject(b, it, pDepth, pw, time, dt); }
      else this.drawEntity(b, it, time, target);
    }
    if (this.dbg && this._mapFrame === 0) this._brk = { ground: Math.round(tg1 - tg0), objEnt: Math.round(performance.now() - te0) };
    const m = game.input?.mouse;
    this.hover = m?.inCanvas ? this.pickEntity(m.x, m.y) : null;
    drawProjectiles(b, this, time);
    this.fx.drawOver(b, time);
    this.lighting.updateParticles(dt, this, time);
    this.lighting.drawParticles(b, time);

    // 조명 (버퍼 공간)
    b.setTransform(1, 0, 0, 1, 0, 0);
    this.lighting.drawFog(b, this, time);
    this.lighting.apply(b, this, time, dt);

    // 조명 위 도트 오버레이 (HP바·비트맵 숫자)
    b.setTransform(1, 0, 0, 1, ox, oy);
    this.drawBars(b, target);
    this.fx.drawTexts(b);

    // 최근접 확대 출력
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.buf, 0, 0, bw * this.S, bh * this.S);

    // 원해상도 글자 (이름표·말풍선·한글 알림)
    this.drawLabels(ctx, target);
    this.fx.drawHiTexts(ctx);
    this.fx.drawBubbles(ctx);
    this.fx.drawScreen(ctx, this.W, this.H);
    if (this.dbg && /clicktest/.test(location.search) && (this._fr || 0) >= 1) return this.clickTest();
    if (this.dbg) { let el = document.getElementById('__state'); if (!el) { el = document.createElement('pre'); el.id = '__state'; el.style.display = 'none'; document.body.appendChild(el); } el.textContent = JSON.stringify({ fade: this.fx.fade, chunks: chunks.length, list: list.length, view: [this.viewX, this.viewY], z: this.camera.zoom, S: this.S, buf: [bw, bh], W: this.W, H: this.H, amb, dark: +this.lighting.dark.toFixed(2), gt: game.time, ms: this._ms, first: this._first, peak: this._peak, brk: this._brk, fr: (this._fr = (this._fr || 0) + 1), map: game.world.map.id, wh: [game.world.w, game.world.h], p: [p?.x, p?.y] }); }
  }

  // 디버그: ?fxdemo — 이펙트 일괄 발생 (스크린샷 확인용)
  fxDemo() {
    this._demo = true;
    const g = this.game, p = g.player, b = g.bus;
    const m = g.world.entities.find((e) => e.kind === 'monster') || g.world.entities.find((e) => e !== p);
    if (m) {
      g.controller.target = m;
      b.emit('combat:damage', { source: p, target: m, amount: 12, crit: false, type: 'physical' });
      b.emit('combat:damage', { source: p, target: m, amount: 31, crit: true, type: 'physical' });
    }
    b.emit('combat:damage', { source: m, target: p, amount: 5, crit: false, type: 'physical' });
    b.emit('combat:attack', { attacker: p, target: m });
    const n = g.world.entities.find((e) => e.kind === 'npc');
    if (n) b.emit('npc:say', { entity: n, text: '너의 이름은 반쯤 지워져 있다. 기억의 조각을 찾아라.' });
    b.emit('skill:cast', { caster: p, skillId: 'war_cry', dir: p.dir });
    b.emit('player:levelup', { level: 2 });
    b.emit('ui:moveMarker', { x: p.x + 2, y: p.y + 1 });
    g.systems?.telegraphs?.push({ tiles: [{ x: p.x - 2, y: p.y }, { x: p.x - 2, y: p.y + 1 }, { x: p.x - 3, y: p.y }], t: 0.5, total: 1, kind: 'demo' });
    p.buffs = [{ id: 'iron_wall', t: 5 }];
    if (m) m.buffs = [{ id: 'stun', t: 3 }];
  }

  // 디버그: ?rdbg&clicktest — 실제 마우스 이벤트(클라이언트 좌표)를 캔버스에 보내 타일/엔티티 판정 정확도를 검사
  clickTest() {
    if (this._ct) return;
    this._ct = true;
    const g = this.game, r = this.canvas.getBoundingClientRect();
    const res = { S: this.S, buf: [this.bw, this.bh], tiles: 0, tileOk: 0, ents: 0, entOk: 0, bad: [] };
    const send = (wx, wy) => {
      const s = this.worldToScreen(wx, wy);
      const cx = r.left + s.x * r.width / this.canvas.width, cy = r.top + s.y * r.height / this.canvas.height;
      // 입력은 pointer 이벤트 기반 (core/input.js)
      const Ev = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
      this.canvas.dispatchEvent(new Ev('pointermove', { clientX: cx, clientY: cy, bubbles: true, pointerType: 'mouse', pointerId: 1 }));
      return g.input.mouse;
    };
    const p = g.player;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const tx = p.x + dx, ty = p.y + dy;
      if (!g.world.inBounds(tx, ty)) continue;
      const w = tileToWorld(tx, ty);
      // 타일 중심과 꼭짓점 근처(안쪽 70%)
      for (const [ox, oy] of [[0, 0], [20, 0], [-20, 0], [0, 10], [0, -10]]) {
        const m = send(w.x + ox, w.y + oy);
        const t = this.screenToTile(m.x, m.y);
        res.tiles++;
        if (t && t.x === tx && t.y === ty) res.tileOk++; else if (res.bad.length < 5) res.bad.push({ want: [tx, ty], got: t && [t.x, t.y] });
      }
    }
    for (const d of this.frameDraw) {
      if (d.e.kind === 'player' || d.e.dead) continue;
      const m = send(d.wx, d.wy - (d.e._lastSprite?.top ?? 30) * 0.5);
      res.ents++;
      if (this.pickEntity(m.x, m.y) === d.e) res.entOk++;
    }
    let el = document.getElementById('__state'); if (!el) { el = document.createElement('pre'); el.id = '__state'; el.style.display = 'none'; document.body.appendChild(el); }
    el.textContent = JSON.stringify({ clicktest: res });
  }

  depthOf(e) {
    if (e.kind === 'drop') return e.x + e.y - 0.4;
    if (e.dead && e.kind !== 'player') return e.x + e.y - 0.3;
    const m = e.move;
    const d = m ? Math.max(m.fx + m.fy, m.tx + m.ty) : e.x + e.y;
    return d + 0.2 + (FLYING.has(e.look?.body) ? 0.05 : 0);
  }

  drawObject(ctx, it, pDepth, pw, time, dt) {
    const { o, wx, wy } = it;
    const def = TILES[o.id];
    const s = objectSprite(o.id, o.x, o.y, this.game.world);
    // 플레이어를 가리는 높은 오브젝트는 반투명
    let alpha = 1;
    if (def?.tall && pw && it.d > pDepth - 0.1) {
      const key = o.y * 4096 + o.x;
      const top = objectTop(o.id);
      const over = Math.abs(wx - pw.x) < 40 && pw.y - 60 < wy + 12 && pw.y > wy - top && pw.y < wy + 40;
      const cur = this.occl.get(key) ?? 1;
      const want = over ? 0.4 : 1;
      const nv = cur + (want - cur) * Math.min(1, dt * 10);
      if (Math.abs(nv - 1) < 0.01) this.occl.delete(key); else this.occl.set(key, nv);
      alpha = nv;
    }
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(s.canvas, Math.round(wx - s.ax), Math.round(wy - s.ay));
    if (ANIMATED_OBJECTS.has(o.id)) drawObjectAnim(ctx, o.id, wx, wy, o.x, o.y, time);
    ctx.globalAlpha = 1;
  }

  drawEntity(ctx, it, time, target) {
    const { e } = it;
    let { wx, wy } = it;
    // 넉백 시각 오프셋
    if (e.knock && e.knock.t > 0) {
      const k = e.knock.t / (e.knock.dur || 0.14), pw = (e.knock.power ?? 0.2) * Math.sin(k * Math.PI * 0.5);
      wx += (e.knock.dx - e.knock.dy) * (TILE_W / 2) * pw; wy += (e.knock.dx + e.knock.dy) * (TILE_H / 2) * pw;
    }
    wx = Math.round(wx); wy = Math.round(wy);
    if (e.kind === 'drop') return this.drawDrop(ctx, e, wx, wy, time);
    const look = e.look || {};
    const an = animOf(e, time);
    const spr = getSprite(look, e.dir ?? 4, an.state, an.k, time);
    e._lastSprite = spr;
    let alpha = look.alpha ?? 1;
    // 사망: 쓰러진 뒤 서서히 사라짐 (3단 계단)
    if (an.state === 'dead') {
      const t = e.anim?.state === 'dead' ? e.anim.t : DEAD_LINGER;
      const f = clamp((DEAD_LINGER - t) / 0.55, 0, 1);
      alpha *= f >= 1 ? 1 : f > 0.66 ? 0.7 : f > 0.33 ? 0.45 : f > 0.02 ? 0.2 : 0;
      if (alpha <= 0.01) return;
    }
    // 그림자 (하드엣지)
    const sc = look.scale ?? 1;
    const flying = FLYING.has(look.body);
    drawShadow(ctx, wx, wy + 1, (flying ? 8 : 12) * sc, (flying ? 3 : 5) * sc, flying ? 0.32 : 0.58);
    const x = wx - spr.ax, y = wy - spr.ay;
    const hovered = this.hover === e, targeted = target === e;
    if (e.ghost) {
      // 혼 상태: 반투명 푸른빛. 사망 후 혼은 더 흐리고 1px 단위로 일렁임
      const deadGhost = !!e.dead;
      const wob = deadGhost ? Math.round(Math.sin(time * 3.1) * 1.5) : 0;
      ctx.globalAlpha = (deadGhost ? (Math.sin(time * 4.3) > 0 ? 0.46 : 0.36) : 0.72) * alpha;
      ctx.drawImage(getVariant(spr, deadGhost ? 'ghostDead' : 'ghost'), x + wob, y);
      ctx.globalAlpha = 1;
    } else {
      if ((hovered || targeted) && e.kind !== 'player' && !e.dead) {
        const col = e.kind === 'monster' ? (targeted ? '#ff4a3a' : '#ff9a5a') : '#fff0b0';
        if (!targeted || Math.sin(time * 8) > -0.3) ctx.drawImage(getVariant(spr, 'outline:' + col), x, y);
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(spr.canvas, x, y);
      ctx.globalAlpha = 1;
    }
    if (e.flash > 0) {
      ctx.globalAlpha = (e.flash > 0.06 ? 0.95 : 0.55) * alpha;
      ctx.drawImage(getVariant(spr, e.kind === 'player' ? 'red' : 'flash'), x, y);
      ctx.globalAlpha = 1;
    }
    if (e.boss && !e.dead) bossAura(ctx, wx, wy, sc, time, look.tint);
    drawEntityExtras(ctx, this, e, wx, wy, spr, time);
    this.frameDraw.push({ e, x0: wx - 14 * sc, x1: wx + 14 * sc, y0: wy - spr.top - 4, y1: wy + 7, depth: it.d, wx, wy });
  }

  drawDrop(ctx, e, wx, wy, time) {
    const look = e.look || {};
    const bob = Math.sin(time * 3 + e.id) > 0 ? 1 : 0;
    const grade = e.grade ?? this.game.data.items?.[e.itemId ?? look.item]?.grade ?? 'common';
    const col = look.gold || e.gold ? '#ffd040' : GRADE_COLOR[grade] || GRADE_COLOR.common;
    const born = e.born != null ? this.game.time - e.born : 9;
    const drop = born < 0.35 ? (1 - born / 0.35) : 0;   // 떨어지며 튀어오름
    const S = 16;
    const yy = Math.round(wy - 5 - bob - Math.sin(drop * Math.PI) * 14);
    drawShadow(ctx, wx, wy + 1, 7, 3, 0.35);
    // 등급 표시: 고급 이상은 발밑 점선 마름모 (빛기둥 대신)
    if (grade !== 'common' && !look.gold && !e.gold) {
      const on = Math.floor(time * 4) % 2;
      ctx.fillStyle = col;
      for (let i = -9; i <= 9; i += 3) { const yv = Math.round((9 - Math.abs(i)) * 0.5); ctx.fillRect(wx + i, wy + 1 - yv + (on ? 0 : 0), 1, 1); ctx.fillRect(wx + i, wy + 1 + yv, 1, 1); }
    }
    if (look.gold || e.gold) goldIcon(ctx, wx - S / 2, yy - S / 2, S);
    else drawItemIcon(this.game, ctx, e.itemId ?? look.item, wx - S / 2, yy - S / 2, S);
    // 반짝임 (십자 1px)
    const tw = (time * 0.6 + e.id * 0.37) % 1;
    if (tw < 0.12) {
      ctx.fillStyle = '#ffffff';
      const sx = wx + 4, sy = yy - 6, L = tw < 0.06 ? 2 : 1;
      ctx.fillRect(sx, sy - L, 1, L * 2 + 1); ctx.fillRect(sx - L, sy, L * 2 + 1, 1);
    }
    if (this.hover === e) pxEllipse(ctx, wx, wy + 1, 11, 5, '#fff0b0');
    e._lastSprite = { top: 14 };
    this.frameDraw.push({ e, x0: wx - 12, x1: wx + 12, y0: yy - 11, y1: wy + 7, depth: this.depthOf(e) + 0.5, wx, wy });
  }

  // 대상/호버 발밑 고리 (도트 타원)
  drawGroundMarks(ctx, time) {
    const t = this.game.controller?.target;
    const ring = (e, color, pulse) => {
      const p = tileToWorld(e.rx, e.ry), sc = e.look?.scale ?? 1;
      const x = Math.round(p.x), y = Math.round(p.y + 1);
      const s = sc * (pulse && Math.floor(time * 6) % 2 ? 1.08 : 1);
      pxEllipse(ctx, x, y, Math.round(17 * s), Math.round(8 * s), color);
      if (pulse) {
        pxEllipse(ctx, x, y, Math.round(17 * s) - 1, Math.round(8 * s), color, 2);
        ctx.fillStyle = color;
        for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2 + Math.floor(time * 4) * 0.39; ctx.fillRect(Math.round(x + Math.cos(ang) * 21 * s) - 1, Math.round(y + Math.sin(ang) * 10 * s) - 1, 2, 2); }
      }
    };
    if (t && !t.dead && this.game.world.entities.includes(t)) ring(t, '#ff4030', true);
    const h = this.hover;
    if (h && h !== t && h.kind !== 'drop' && !h.dead) ring(h, h.kind === 'monster' ? '#ff9a5a' : '#ffe8a0', false);
  }

  // HP바 (도트, 버퍼에)
  drawBars(ctx, target) {
    for (const d of this.frameDraw) {
      const e = d.e;
      if (e.kind !== 'monster' || e.dead) continue;
      const show = this.hover === e || target === e || e.boss;
      if (!(show || e.hp < e.maxHp)) continue;
      const top = d.wy - (e._lastSprite?.top ?? 46) - 5;
      hpBar(ctx, d.wx, top, e.boss ? 40 : 24, e.hp / Math.max(1, e.maxHp), e.boss);
    }
  }

  // 이름표 (메인 캔버스 원해상도, 굴림 12px + 1px 외곽, 박스 없음)
  drawLabels(ctx, target) {
    const g = this.game, p = g.player;
    const altAll = g.input?.isDown?.('AltLeft') || g.input?.isDown?.('AltRight');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const d of this.frameDraw) {
      const e = d.e;
      if (e.kind === 'player') continue;
      const hovered = this.hover === e, targeted = target === e;
      const topW = d.wy - (e._lastSprite?.top ?? 46) - 4;
      const s = this.worldToScreen(d.wx, topW);
      if (s.x < -100 || s.x > this.W + 100 || s.y < -40 || s.y > this.H + 40) continue;
      if (e.kind === 'npc') {
        label(ctx, e.name, s.x, s.y - 2, hovered ? '#ffffff' : '#ffe878', 12, true);
        if (e.title) label(ctx, `[${e.title}]`, s.x, s.y - 16, '#d8b888', 12, false);
        if (e.questMark) {
          ctx.font = `bold 18px ${FONT_PIX}`;
          outlinedText(ctx, e.questMark, s.x, s.y - (e.title ? 30 : 17), e.questMark === '?' ? '#7ad8ff' : '#ffd23a');
        }
      } else if (e.kind === 'monster' && !e.dead) {
        const show = hovered || targeted || e.boss;
        if (show) {
          const diff = (e.level ?? 1) - (p?.level ?? 1);
          const col = e.boss ? '#ff8a6a' : diff >= 5 ? '#ff4a3a' : diff >= 2 ? '#ffa040' : diff >= -2 ? '#ffffff' : '#a8a8a8';
          label(ctx, e.level ? `${e.name} Lv${e.level}` : e.name, s.x, s.y - 14, col, 12, e.boss);
        }
      } else if (e.kind === 'drop' && (hovered || altAll)) {
        const grade = e.grade ?? g.data.items?.[e.itemId]?.grade ?? 'common';
        label(ctx, e.name || g.data.items?.[e.itemId]?.name || '', s.x, s.y + 4, e.gold ? '#ffd040' : GRADE_COLOR[grade], 12, false);
      }
    }
  }
}

function label(ctx, text, x, y, color, size, bold) {
  if (!text) return;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT_PIX}`;
  outlinedText(ctx, text, x, y, color);
}
function hpBar(ctx, x, y, w, k, boss) {
  k = clamp(k, 0, 1);
  const h = boss ? 3 : 2;
  x = Math.round(x - w / 2); y = Math.round(y);
  ctx.fillStyle = '#100808'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#4a1010'; ctx.fillRect(x, y, w, h);
  const fw = Math.max(k > 0 ? 1 : 0, Math.round(w * k));
  ctx.fillStyle = k > 0.5 ? '#e83828' : k > 0.25 ? '#e89028' : '#e8d028'; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = k > 0.5 ? '#ff8a70' : '#ffd080'; ctx.fillRect(x, y, fw, 1);
}
function bossAura(ctx, x, y, sc, time, tint) {
  const c = tint ? mix(tint, '#ff3040', 0.5) : '#ff3040';
  for (let i = 0; i < 2; i++) {
    const k = Math.floor(((time * 0.6 + i / 2) % 1) * 5) / 5;
    if (k > 0.8) continue;
    ctx.globalAlpha = 0.85 - k;
    pxEllipse(ctx, x, y + 1, Math.round((18 + k * 16) * sc), Math.round((8 + k * 8) * sc), c, 2);
  }
  ctx.globalAlpha = 1;
}
export { FLAT_OBJECTS, clearSpriteCache };
