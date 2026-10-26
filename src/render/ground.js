// 지면 청크 캐시: 8x8 타일 단위로 지면+평평한 오브젝트를 오프스크린 캔버스에 굽는다. 소유: 워커 A.
import { tileToWorld } from '../core/iso.js';
import { makeCanvas } from './util.js';
import { pixelize } from './pixel.js';
import { drawGroundTile, ANIMATED_GROUND, objectSprite, ANIMATED_OBJECTS, HW, HH, objectTop } from './tiles.js';

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
    const c = m.canvas || makeCanvas(m.maxX - m.minX, m.maxY - m.minY);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(-m.minX, -m.minY);
    // 깊이 순서(x+y)로 그려야 절벽 면이 앞 타일에 덮인다
    const tiles = [];
    for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) tiles.push([x, y]);
    tiles.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [x, y] of tiles) {
      const p = tileToWorld(x, y);
      drawGroundTile(ctx, w.groundAt(x, y), p.x, p.y, x, y, w);
    }
    for (const [x, y] of tiles) {
      const o = w.objAt(x, y);
      if (o && FLAT_OBJECTS.has(o)) {
        const p = tileToWorld(x, y), s = objectSprite(o, x, y, w);
        ctx.drawImage(s.canvas, p.x - s.ax, p.y - s.ay);
      }
    }
    ctx.restore();
    // 도트화: 명암 단계 + 베이어 디더 (디더 격자는 월드 좌표 기준으로 정렬)
    pixelize(c, { outline: false, alphaCut: 40, levels: 12, dither: true, ox: m.minX, oy: m.minY });
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

  draw(ctx, list) {
    for (const m of list) {
      if (!m.canvas) this.build(m);
      ctx.drawImage(m.canvas, m.minX, m.minY);
    }
  }
}
