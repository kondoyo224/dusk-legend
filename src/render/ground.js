// 지면 청크 캐시: 8x8 타일 단위로 지면(픽셀 셰이더, groundpx.js)+평평한 오브젝트를 오프스크린 캔버스에 1× 로 굽는다. 소유: 워커 A.
import { tileToWorld } from '../core/iso.js';
import { makeCanvas } from './util.js';
import { ANIMATED_GROUND, objectSprite, ANIMATED_OBJECTS, HW, HH, objectTop, GROUND } from './tiles.js';
import { bakeGround, bakeCliffs } from './groundpx.js';

const CS = 8;
// 지면에 구워도 되는(엔티티보다 항상 아래) 오브젝트
export const FLAT_OBJECTS = new Set(['flowers', 'mushroom', 'bones', 'cobweb', 'rubble', 'stairs_down', 'stairs_up', 'portal_glow']);
const TOP_PAD = 20, BOT_PAD = 44;

export class GroundLayer {
  constructor() { this.world = null; this.chunks = new Map(); this.cw = 0; this.ch = 0; }

  reset(world) {
    this.world = world;
    this.chunks.clear();
    this.cw = Math.ceil(world.w / CS); this.ch = Math.ceil(world.h / CS);
    // 청크별 메타데이터(애니메이션 타일, 세워지는 오브젝트)는 즉시 계산, 그림은 보일 때 지연 생성
    for (let j = 0; j < this.ch; j++) for (let i = 0; i < this.cw; i++) this.chunks.set(j * this.cw + i, this.makeMeta(i, j));
  }

  makeMeta(i, j) {
    const w = this.world;
    const x0 = i * CS, y0 = j * CS, x1 = Math.min(w.w, x0 + CS) - 1, y1 = Math.min(w.h, y0 + CS) - 1;
    const minX = (x0 - y1) * HW - HW - 2, maxX = (x1 - y0) * HW + HW + 2;
    const minY = (x0 + y0) * HH - HH - TOP_PAD, maxY = (x1 + y1) * HH + HH + BOT_PAD;
    const anim = [], objs = [], flatAnim = [];
    let topY = minY;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const g = w.groundAt(x, y);
      if (ANIMATED_GROUND.has(g)) anim.push({ x, y, id: g });
      const o = w.objAt(x, y);
      if (o) {
        if (FLAT_OBJECTS.has(o)) { if (ANIMATED_OBJECTS.has(o)) flatAnim.push({ x, y, id: o }); }
        else { objs.push({ x, y, id: o }); topY = Math.min(topY, (x + y) * HH - objectTop(o)); }
      }
    }
    return { i, j, x0, y0, x1, y1, minX, maxX, minY, maxY, topY, anim, objs, flatAnim, canvas: null };
  }

  build(m) {
    const w = this.world;
    const W = m.maxX - m.minX, H = m.maxY - m.minY;
    const c = m.canvas || makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const img = ctx.createImageData(c.width, c.height);
    const own = (gx, gy) => gx >= m.x0 && gx <= m.x1 && gy >= m.y0 && gy <= m.y1;
    bakeGround(img, m.minX, m.minY, w, own);
    const tiles = [];
    for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) tiles.push([x, y]);
    bakeCliffs(img, m.minX, m.minY, w, tiles);
    ctx.putImageData(img, 0, 0);
    // 평평한 오브젝트(꽃·버섯·뼈 등)를 깊이 순으로
    tiles.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [x, y] of tiles) {
      const o = w.objAt(x, y);
      if (o && FLAT_OBJECTS.has(o)) {
        const p = tileToWorld(x, y), s = objectSprite(o, x, y, w);
        ctx.drawImage(s.canvas, Math.round(p.x - s.ax - m.minX), Math.round(p.y - s.ay - m.minY));
      }
    }
    m.canvas = c;
  }

  // 타일 변경 → 해당 청크와 이웃 청크(경계 번짐) 다시 굽기
  invalidate(x, y) {
    const i = Math.floor(x / CS), j = Math.floor(y / CS);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= this.cw || jj >= this.ch) continue;
      const old = this.chunks.get(jj * this.cw + ii);
      const m = this.makeMeta(ii, jj);
      m.canvas = null;
      if (old?.canvas) { m.canvas = old.canvas; this.build(m); }
      this.chunks.set(jj * this.cw + ii, m);
    }
  }

  // 화면에 걸친 청크 목록 (청크 깊이 순)
  visible(vx0, vy0, vx1, vy1) {
    const out = [];
    for (const m of this.chunks.values()) {
      if (m.maxX < vx0 || m.minX > vx1 || m.maxY < vy0 || Math.min(m.minY, m.topY) > vy1) continue;
      out.push(m);
    }
    out.sort((a, b) => a.i + a.j - b.i - b.j);
    return out;
  }

  // 곧 보일 청크(화면 주변 margin px)를 시간 예산 안에서 미리 굽는다 → 걸어갈 때 끊김 방지
  prefetch(vx0, vy0, vx1, vy1, margin = 260, budget = 6) {
    const t0 = performance.now();
    for (const m of this.visible(vx0 - margin, vy0 - margin, vx1 + margin, vy1 + margin)) {
      if (m.canvas) continue;
      this.build(m);
      if (performance.now() - t0 > budget) return;
    }
  }

  /**
   * 청크 그리기. 화면(sx0..sy1)에 실제로 걸친 미완성 청크만, 화면 중앙에 가까운 것부터 시간 예산(ms) 안에서 굽는다.
   * 예산을 넘긴 청크는 이번 프레임에 타일 바탕색 마름모(임시)로 그리고 다음 프레임들에 나눠 굽는다 (맵 첫 프레임 멈춤 방지).
   */
  draw(ctx, list, scr, budget = 1e9) {
    if (scr) {
      const [sx0, sy0, sx1, sy1] = scr, cx = (sx0 + sx1) / 2, cy = (sy0 + sy1) / 2;
      const need = list.filter((m) => !m.canvas && !(m.maxX < sx0 || m.minX > sx1 || m.maxY < sy0 || m.minY > sy1));
      need.sort((a, b) => Math.hypot((a.minX + a.maxX) / 2 - cx, (a.minY + a.maxY) / 2 - cy) - Math.hypot((b.minX + b.maxX) / 2 - cx, (b.minY + b.maxY) / 2 - cy));
      const t0 = performance.now();
      for (const m of need) { if (performance.now() - t0 > budget) break; this.build(m); }
      this.pending = need.some((m) => !m.canvas);
    }
    for (const m of list) {
      if (m.canvas) ctx.drawImage(m.canvas, m.minX, m.minY);
      else if (scr) this.placeholder(ctx, m);
      else { this.build(m); ctx.drawImage(m.canvas, m.minX, m.minY); }
    }
  }

  // 임시 바탕: 타일마다 지면 기본색 마름모 (몇 프레임만 보인다)
  placeholder(ctx, m) {
    const w = this.world;
    for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) {
      const g = w.groundAt(x, y), c = GROUND[g];
      if (!c || c.none) continue;
      const px = (x - y) * HW, py = (x + y) * HH;
      ctx.fillStyle = c.c;
      ctx.beginPath(); ctx.moveTo(px, py - HH - 0.5); ctx.lineTo(px + HW + 0.5, py); ctx.lineTo(px, py + HH + 0.5); ctx.lineTo(px - HW - 0.5, py); ctx.closePath(); ctx.fill();
    }
  }
}
