// 타일 그리기: tiles.js 의 모든 지면/오브젝트 id 에 대한 절차 생성 그림. 소유: 워커 A.
// 지면 = 청크 캐시에 굽는다(ground.js). 오브젝트 = id+변형별 스프라이트 캐시 + 애니메이션 부분만 매 프레임.
import { hash2, shade, mix, rgba, makeCanvas, diamondPath, ellipse, seeded, LRU } from './util.js';
import { pixelize, pxEllipse, pxLine, pxDitherDiamond } from './pixel.js';
// 지면에 납작하게 구워지는 장식(외곽선 없이)
const FLAT_PIX = new Set(['flowers', 'mushroom', 'bones', 'cobweb', 'rubble', 'stairs_down', 'stairs_up', 'portal_glow']);

export const HW = 32, HH = 16;
export const WALL_H = 76;

// ── 지면 팔레트 ──
export const GROUND = {
  grass:       { c: '#4f7c34', natural: 5 },
  grass_dark:  { c: '#3b6230', natural: 5 },
  dirt:        { c: '#7a5c3a', natural: 3 },
  path:        { c: '#9a8058', natural: 4 },
  sand:        { c: '#c4aa76', natural: 2 },
  swamp:       { c: '#46563a', natural: 6 },
  ash:         { c: '#5a5450', natural: 4 },
  mist_floor:  { c: '#4e4868', natural: 4 },
  stone_floor: { c: '#6a6870' },
  cobble:      { c: '#7c7568' },
  wood_floor:  { c: '#8a5c34' },
  carpet_red:  { c: '#9a2a2e' },
  bridge:      { c: '#886238' },
  marble:      { c: '#c8c2b4' },
  bone_floor:  { c: '#5a5244' },
  water:       { c: '#2a5a8c', liquid: true },
  deep_water:  { c: '#1a3c66', liquid: true },
  lava:        { c: '#b8360e', liquid: true },
  void:        { c: '#000000', none: true },
};
export const ANIMATED_GROUND = new Set(['water', 'deep_water', 'lava', 'swamp', 'mist_floor']);

// 타일 중심 기준 이웃 변(edge)의 두 꼭짓점
const EDGES = [
  { dx: 1, dy: 0, a: [HW, 0], b: [0, HH] },     // 오른쪽 아래 변
  { dx: 0, dy: 1, a: [0, HH], b: [-HW, 0] },    // 왼쪽 아래 변
  { dx: -1, dy: 0, a: [-HW, 0], b: [0, -HH] },  // 왼쪽 위 변
  { dx: 0, dy: -1, a: [0, -HH], b: [HW, 0] },   // 오른쪽 위 변
];

// 그리드 축 방향 단위(화면): x축 (+32,+16), y축 (-32,+16)
function isoPt(cx, cy, u, v) { return [cx + (u - v) * HW, cy + (u + v) * HH]; }

// ── 지면 타일 1장 (청크 캔버스에 그린다). world: 이웃 조회용 ──
export function drawGroundTile(ctx, id, cx, cy, gx, gy, world) {
  const G = GROUND[id] || GROUND.dirt;
  if (G.none) return;
  const r = seeded(Math.floor(hash2(gx, gy, 7) * 1e9));
  const v = hash2(gx, gy, 1);
  const base = shade(G.c, (v - 0.5) * (G.natural ? 0 : 0.08)); // 도트 양자화 시 바둑판 무늬 방지: 자연 지면은 변화 작게
  ctx.save();
  diamondPath(ctx, cx, cy, HW + 0.6, HH + 0.6);
  ctx.fillStyle = base; ctx.fill();
  ctx.clip();
  DETAIL[id]?.(ctx, cx, cy, r, base, gx, gy);
  // 지형 경계: 자연 지면끼리는 높은 우선순위 쪽이 낮은 쪽으로 번진다
  if (world) {
    for (const E of EDGES) {
      const nid = world.groundAt(gx + E.dx, gy + E.dy);
      if (nid === id) continue;
      const N = GROUND[nid];
      if (!N || N.none) continue;
      if (G.natural && N.natural && N.natural > G.natural) fringe(ctx, cx, cy, E, N.c, r);
      else if (N.liquid && !G.liquid) shoreEdge(ctx, cx, cy, E);
      else if (!G.natural && !G.liquid) edgeLine(ctx, cx, cy, E, shade(base, -0.35));
    }
  }
  // 아주 약한 그리드 음영 (위쪽 밝게, 아래쪽 어둡게)
  ctx.restore();
  // 아래쪽 이웃이 심연이면 절벽 면
  if (world && !G.liquid) {
    for (const E of EDGES.slice(0, 2)) {
      const nid = world.groundAt(gx + E.dx, gy + E.dy);
      if (nid === 'void') cliff(ctx, cx, cy, E, G.c);
    }
  } else if (world && G.liquid) {
    for (const E of EDGES.slice(0, 2)) if (world.groundAt(gx + E.dx, gy + E.dy) === 'void') cliff(ctx, cx, cy, E, '#2a2a30');
  }
}

function fringe(ctx, cx, cy, E, color, r) {
  const [ax, ay] = E.a, [bx, by] = E.b;
  ctx.fillStyle = color;
  for (let i = 0; i < 7; i++) {
    const t = (i + r() * 0.8) / 7;
    const px = cx + ax + (bx - ax) * t, py = cy + ay + (by - ay) * t;
    const rad = 3 + r() * 5;
    ellipse(ctx, px - ax * 0.05, py - ay * 0.05, rad * 1.4, rad * 0.75); ctx.fill();
  }
  const mx = cx + (ax + bx) / 2, my = cy + (ay + by) / 2;
  const g = ctx.createRadialGradient(mx, my, 0, mx, my, 22);
  g.addColorStop(0, rgba(color, 0.55)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(mx - 24, my - 24, 48, 48);
}
function shoreEdge(ctx, cx, cy, E) {
  const [ax, ay] = E.a, [bx, by] = E.b;
  ctx.strokeStyle = 'rgba(20,30,40,0.55)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx + ax, cy + ay); ctx.lineTo(cx + bx, cy + by); ctx.stroke();
}
function edgeLine(ctx, cx, cy, E, color) {
  const [ax, ay] = E.a, [bx, by] = E.b;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx + ax, cy + ay); ctx.lineTo(cx + bx, cy + by); ctx.stroke();
}
function cliff(ctx, cx, cy, E, color) {
  const [ax, ay] = E.a, [bx, by] = E.b;
  const D = 30;
  const g = ctx.createLinearGradient(0, cy, 0, cy + HH + D);
  g.addColorStop(0, shade(color, -0.45)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx + ax, cy + ay); ctx.lineTo(cx + bx, cy + by);
  ctx.lineTo(cx + bx, cy + by + D); ctx.lineTo(cx + ax, cy + ay + D); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(color, 0.1); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx + ax, cy + ay); ctx.lineTo(cx + bx, cy + by); ctx.stroke();
}

function specks(ctx, cx, cy, r, n, colors, size = 1.6) {
  for (let i = 0; i < n; i++) {
    const u = r() - 0.5, v = r() - 0.5;
    const [px, py] = isoPt(cx, cy, u, v);
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    ctx.fillRect(px, py, size * (0.6 + r()), size * 0.7 * (0.6 + r()));
  }
}
function blades(ctx, cx, cy, r, n, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const [px, py] = isoPt(cx, cy, r() - 0.5, r() - 0.5);
    const h = 2 + r() * 4, lean = (r() - 0.5) * 3;
    ctx.moveTo(px, py); ctx.lineTo(px + lean, py - h);
  }
  ctx.stroke();
}
// 아이소 격자로 나눈 판석(돌바닥/자갈)
function slabs(ctx, cx, cy, r, n, base, grout, jitter = 0.12) {
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const u0 = i / n - 0.5, v0 = j / n - 0.5, s = 1 / n;
    const pts = [[u0, v0], [u0 + s, v0], [u0 + s, v0 + s], [u0, v0 + s]].map(([u, v]) => isoPt(cx, cy, u, v));
    ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = shade(base, (r() - 0.5) * jitter * 2); ctx.fill();
    ctx.strokeStyle = grout; ctx.lineWidth = 1.2; ctx.stroke();
  }
}
// 나뭇결 판자 (x축 방향)
function planks(ctx, cx, cy, r, n, base, line, gx) {
  for (let j = 0; j < n; j++) {
    const v0 = j / n - 0.5, v1 = v0 + 1 / n;
    const pts = [[-0.5, v0], [0.5, v0], [0.5, v1], [-0.5, v1]].map(([u, v]) => isoPt(cx, cy, u, v));
    ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = shade(base, (r() - 0.5) * 0.18); ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke();
    // 이음매
    const cut = ((gx * 3 + j * 7) % 5) / 5 - 0.5;
    const [p1x, p1y] = isoPt(cx, cy, cut, v0), [p2x, p2y] = isoPt(cx, cy, cut, v1);
    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
  }
}

const DETAIL = {
  grass(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 10, [shade(b, 0.12), shade(b, -0.18)], 2.4);
    blades(ctx, cx, cy, r, 16, shade(b, 0.22));
    blades(ctx, cx, cy, r, 8, shade(b, -0.25));
    if (r() < 0.12) { ctx.fillStyle = r() < 0.5 ? '#c9c07a' : '#a8a2c8'; const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ctx.fillRect(x, y, 2, 2); }
  },
  grass_dark(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 10, [shade(b, 0.1), shade(b, -0.25)], 2.4);
    blades(ctx, cx, cy, r, 14, shade(b, 0.2));
  },
  dirt(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 14, [shade(b, 0.15), shade(b, -0.22), '#3d3022'], 2);
    if (r() < 0.3) { ctx.fillStyle = '#7a7266'; const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ellipse(ctx, x, y, 2.5, 1.5); ctx.fill(); }
  },
  path(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 18, [shade(b, 0.14), shade(b, -0.16)], 1.8);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = shade(b, 0.2 + r() * 0.1); const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ellipse(ctx, x, y, 2 + r() * 2, 1.2 + r()); ctx.fill(); }
  },
  sand(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 22, [shade(b, 0.15), shade(b, -0.12)], 1.2);
    ctx.strokeStyle = shade(b, -0.1); ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) { const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ctx.beginPath(); ctx.arc(x, y, 8, 0.2, 1.2); ctx.stroke(); }
  },
  swamp(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 10, [shade(b, 0.1), '#24301f'], 2.4);
    for (let i = 0; i < 2; i++) { const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ctx.fillStyle = 'rgba(30,45,40,0.85)'; ellipse(ctx, x, y, 6 + r() * 5, 3 + r() * 2); ctx.fill(); }
    blades(ctx, cx, cy, r, 8, '#5a6a3a');
  },
  ash(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 20, [shade(b, 0.15), shade(b, -0.3), '#2a2423'], 1.8);
    if (r() < 0.25) { ctx.fillStyle = 'rgba(255,90,30,0.55)'; const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ctx.fillRect(x, y, 1.5, 1.5); }
    ctx.strokeStyle = shade(b, -0.35); ctx.lineWidth = 1;
    if (r() < 0.4) { const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 2); ctx.lineTo(x + 9, y - 1); ctx.stroke(); }
  },
  mist_floor(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 12, [shade(b, 0.12), shade(b, -0.2)], 2.2);
    ctx.strokeStyle = rgba('#8e86b8', 0.22); ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) { const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ctx.beginPath(); ctx.ellipse(x, y, 7 + r() * 6, 2 + r() * 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    blades(ctx, cx, cy, r, 6, shade(b, 0.18));
  },
  stone_floor(ctx, cx, cy, r, b) { slabs(ctx, cx, cy, r, 2, b, shade(b, -0.35), 0.1); specks(ctx, cx, cy, r, 6, [shade(b, -0.2)], 1.5); },
  cobble(ctx, cx, cy, r, b) {
    ctx.fillStyle = shade(b, -0.35); ctx.fillRect(cx - HW, cy - HH, HW * 2, HH * 2);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const [x, y] = isoPt(cx, cy, (i + 0.5) / 4 - 0.5 + (r() - 0.5) * 0.06, (j + 0.5) / 4 - 0.5 + (r() - 0.5) * 0.06);
      ctx.fillStyle = shade(b, (r() - 0.4) * 0.3);
      ellipse(ctx, x, y, 6.2, 3.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ellipse(ctx, x - 1, y - 1, 3.5, 1.5); ctx.fill();
    }
  },
  wood_floor(ctx, cx, cy, r, b, gx) { planks(ctx, cx, cy, r, 4, b, shade(b, -0.4), gx); },
  bridge(ctx, cx, cy, r, b, gx) {
    planks(ctx, cx, cy, r, 5, b, shade(b, -0.45), gx);
    ctx.fillStyle = shade(b, -0.5);
    for (const v of [-0.5, 0.5]) { const [x1, y1] = isoPt(cx, cy, -0.5, v), [x2, y2] = isoPt(cx, cy, 0.5, v); ctx.lineWidth = 3; ctx.strokeStyle = shade(b, -0.5); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  },
  carpet_red(ctx, cx, cy, r, b) {
    specks(ctx, cx, cy, r, 10, [shade(b, 0.12), shade(b, -0.2)], 1.5);
    ctx.strokeStyle = rgba('#c9a14a', 0.35); ctx.lineWidth = 1;
    diamondPath(ctx, cx, cy, HW * 0.55, HH * 0.55); ctx.stroke();
    diamondPath(ctx, cx, cy, HW * 0.2, HH * 0.2); ctx.fillStyle = rgba('#c9a14a', 0.3); ctx.fill();
  },
  marble(ctx, cx, cy, r, b, gx, gy) {
    if ((gx + gy) % 2) { ctx.fillStyle = shade(b, -0.12); ctx.fillRect(cx - HW, cy - HH, HW * 2, HH * 2); }
    ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = 0.8;
    ctx.beginPath(); let [x, y] = isoPt(cx, cy, r() - 0.5, -0.5); ctx.moveTo(x, y);
    for (let i = 0; i < 4; i++) { [x, y] = isoPt(cx, cy, r() - 0.5, -0.5 + (i + 1) / 4); ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = shade(b, -0.3); ctx.lineWidth = 1; diamondPath(ctx, cx, cy, HW, HH); ctx.stroke();
  },
  bone_floor(ctx, cx, cy, r, b) {
    slabs(ctx, cx, cy, r, 2, b, shade(b, -0.4), 0.16);
    ctx.strokeStyle = rgba('#d8ccb0', 0.4); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) if (r() < 0.6) { const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); const a = r() * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 2.5); ctx.stroke(); }
    specks(ctx, cx, cy, r, 6, ['#2c2822'], 2);
  },
  water(ctx, cx, cy, r, b) {
    const g = ctx.createLinearGradient(cx - HW, cy - HH, cx + HW, cy + HH);
    g.addColorStop(0, shade(b, 0.1)); g.addColorStop(1, shade(b, -0.15));
    ctx.fillStyle = g; ctx.fillRect(cx - HW, cy - HH, HW * 2, HH * 2);
  },
  deep_water(ctx, cx, cy, r, b) { DETAIL.water(ctx, cx, cy, r, b); },
  lava(ctx, cx, cy, r, b) {
    ctx.fillStyle = '#5a1606';
    for (let i = 0; i < 4; i++) { const [x, y] = isoPt(cx, cy, r() - 0.5, r() - 0.5); ellipse(ctx, x, y, 6 + r() * 6, 3 + r() * 2); ctx.fill(); }
  },
};

// 매 프레임 애니메이션 오버레이 (물결, 용암 일렁임 등) — 1px 도트, 계단 프레임
export function drawGroundAnim(ctx, id, cx, cy, gx, gy, t) {
  const ph = hash2(gx, gy, 3) * 6.28;
  cx = Math.round(cx); cy = Math.round(cy);
  if (id === 'water' || id === 'deep_water') {
    ctx.fillStyle = id === 'water' ? '#8ec0e8' : '#5a88b8';
    for (let i = 0; i < 2; i++) {
      const k = Math.floor(((t * 0.18 + hash2(gx, gy, 10 + i)) % 1) * 8) / 8;
      const x = Math.round(cx - 16 + k * 26), y = cy - 5 + i * 8;
      const fr = Math.floor(t * 2 + ph + i) & 1;
      ctx.fillRect(x, y, 5, 1); if (fr) ctx.fillRect(x + 6, y - 1, 3, 1);
    }
  } else if (id === 'lava') {
    const p = Math.floor(t * 3 + ph) % 3;
    ctx.fillStyle = ['#ff9a30', '#ffc040', '#ff7a20'][p];
    for (let i = 0; i < 3; i++) {
      const u = hash2(gx, gy, 20 + i) - 0.5, v = hash2(gx, gy, 30 + i) - 0.5;
      const x = Math.round(cx + (u - v) * 40), y = Math.round(cy + (u + v) * 20);
      ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y - 1, 3, 1);
    }
    if (hash2(gx, gy, Math.floor(t * 1.5)) < 0.15) { ctx.fillStyle = '#fff0a0'; ctx.fillRect(cx + Math.round((ph - 3) * 5), cy + Math.round(Math.sin(ph) * 5), 2, 1); }
  } else if (id === 'swamp') {
    if (hash2(gx, gy, Math.floor(t * 0.5)) < 0.08) {
      const k = Math.floor(((t * 0.5) % 1) * 4) / 4;
      pxEllipse(ctx, cx + Math.round((ph - 3) * 4), cy, 2 + k * 6, 1 + k * 3, '#96aa78', 2);
    }
  } else if (id === 'mist_floor') {
    if (Math.sin(t * 0.8 + ph) > 0.85) pxDitherDiamond(ctx, cx, cy, 20, 10, '#aaa0e6', 0.08);
  }
}

// ───────────────── 오브젝트 ─────────────────
// 아이소 박스: 바닥 중심(cx,cy), 발자국 반폭(hw,hh), 높이 h, 바닥 높이 z
export function isoBox(ctx, cx, cy, hw, hh, h, top, left, right, z = 0, stroke = null) {
  const y0 = cy - z;
  ctx.fillStyle = left;
  ctx.beginPath(); ctx.moveTo(cx - hw, y0); ctx.lineTo(cx, y0 + hh); ctx.lineTo(cx, y0 + hh - h); ctx.lineTo(cx - hw, y0 - h); ctx.closePath(); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.fillStyle = right;
  ctx.beginPath(); ctx.moveTo(cx + hw, y0); ctx.lineTo(cx, y0 + hh); ctx.lineTo(cx, y0 + hh - h); ctx.lineTo(cx + hw, y0 - h); ctx.closePath(); ctx.fill();
  if (stroke) ctx.stroke();
  ctx.fillStyle = top;
  diamondPath(ctx, cx, y0 - h, hw, hh); ctx.fill();
  if (stroke) ctx.stroke();
}
function cylinder(ctx, cx, cy, rx, ry, h, color, z = 0) {
  const y0 = cy - z;
  const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, shade(color, -0.35)); g.addColorStop(0.45, shade(color, 0.08)); g.addColorStop(1, shade(color, -0.5));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, y0, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, y0 - h); ctx.ellipse(cx, y0 - h, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(color, 0.12); ellipse(ctx, cx, y0 - h, rx, ry); ctx.fill();
}
function shadowBlob(ctx, cx, cy, rx, ry, a = 0.35) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.29); ctx.fill(); ctx.restore();
}

// 벽 블록: 벽돌 줄눈을 각 면에 그린다
function wallBlock(ctx, cx, cy, h, pal, r, style) {
  const top = pal.top, L = pal.left, R = pal.right;
  isoBox(ctx, cx, cy, HW, HH, h, top, L, R);
  const course = style === 'wood' ? 0 : 12;
  ctx.lineWidth = 1;
  // 왼쪽 면
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx - HW, cy); ctx.lineTo(cx, cy + HH); ctx.lineTo(cx, cy + HH - h); ctx.lineTo(cx - HW, cy - h); ctx.closePath(); ctx.clip();
  faceTexture(ctx, cx - HW, cy, 1, h, pal, r, style, course, L);
  // 아래쪽 어둡게 (지면 접촉 그림자)
  let g = ctx.createLinearGradient(0, cy - h, 0, cy + HH);
  g.addColorStop(0, 'rgba(255,255,255,0.04)'); g.addColorStop(0.8, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(cx - HW, cy - h - HH, HW + 1, h + HH * 2);
  ctx.restore();
  // 오른쪽 면
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx + HW, cy); ctx.lineTo(cx, cy + HH); ctx.lineTo(cx, cy + HH - h); ctx.lineTo(cx + HW, cy - h); ctx.closePath(); ctx.clip();
  faceTexture(ctx, cx, cy + HH, -1, h, pal, r, style, course, R);
  g = ctx.createLinearGradient(0, cy - h, 0, cy + HH);
  g.addColorStop(0, 'rgba(255,255,255,0.03)'); g.addColorStop(0.8, 'rgba(0,0,0,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = g; ctx.fillRect(cx - 1, cy - h - HH, HW + 2, h + HH * 2);
  ctx.restore();
  // 윗면 테두리/디테일
  ctx.strokeStyle = shade(top, 0.15); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - HW, cy - h); ctx.lineTo(cx, cy - h + HH); ctx.lineTo(cx + HW, cy - h); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.moveTo(cx, cy + HH); ctx.lineTo(cx, cy + HH - h); ctx.stroke();
}
// 면 텍스처: (x0,y0) = 면의 왼쪽 아래 꼭짓점, 기울기 0.5 (dir=1: 오른쪽 아래로)
function faceTexture(ctx, x0, y0, dir, h, pal, r, style, course, faceColor) {
  ctx.strokeStyle = pal.mortar;
  if (style === 'wood') {
    // 세로 통나무/판자
    for (let i = 0; i <= 6; i++) {
      const x = x0 + i * (HW / 6);
      const yb = dir === 1 ? y0 + i * (HH / 6) : y0 - i * (HH / 6);
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x, yb - h); ctx.stroke();
    }
    // 가로 들보
    ctx.lineWidth = 4; ctx.strokeStyle = shade(faceColor, -0.35);
    for (const hh of [h * 0.12, h * 0.62]) {
      ctx.beginPath(); ctx.moveTo(x0, y0 - hh); ctx.lineTo(x0 + HW, y0 + (dir === 1 ? HH : -HH) - hh); ctx.stroke();
    }
    ctx.lineWidth = 1;
    return;
  }
  const rows = Math.ceil(h / course) + 1;
  for (let k = 0; k < rows; k++) {
    const hy = k * course;
    const dy = dir === 1 ? HH : -HH;
    // 줄 긋기
    ctx.beginPath(); ctx.moveTo(x0, y0 - hy); ctx.lineTo(x0 + HW, y0 + dy - hy); ctx.stroke();
    // 세로 이음
    const off = (k % 2) * 0.5;
    for (let j = 0; j < 3; j++) {
      const t = (j + off) / 2.5;
      if (t <= 0.02 || t >= 0.98) continue;
      const x = x0 + HW * t, yb = y0 + dy * t - hy;
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x, yb - course); ctx.stroke();
    }
    // 벽돌 음영 변화
    if (r() < 0.35) {
      const t = r() * 0.8, x = x0 + HW * t, yb = y0 + dy * t - hy;
      ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x + HW * 0.38, yb + dy * 0.38); ctx.lineTo(x + HW * 0.38, yb + dy * 0.38 - course); ctx.lineTo(x, yb - course); ctx.closePath(); ctx.fill();
    }
  }
  if (pal.moss) {
    for (let i = 0; i < 5; i++) {
      const t = r(), x = x0 + HW * t, yb = y0 + (dir === 1 ? HH : -HH) * t - r() * h * 0.5;
      ctx.fillStyle = rgba(pal.moss, 0.35 + r() * 0.3); ellipse(ctx, x, yb, 2 + r() * 4, 1.5 + r() * 3); ctx.fill();
    }
  }
}

const WALLS = {
  wall_stone:  { top: '#8e887c', left: '#726c62', right: '#5a554d', mortar: 'rgba(25,22,20,0.55)', h: WALL_H },
  wall_wood:   { top: '#6e4a2a', left: '#8a5e36', right: '#6e4a2a', mortar: 'rgba(30,18,10,0.6)', h: WALL_H, style: 'wood' },
  wall_crypt:  { top: '#5c625a', left: '#4a5048', right: '#3a403a', mortar: 'rgba(10,14,12,0.6)', h: WALL_H, moss: '#4d6a3a' },
  wall_marble: { top: '#d6d0c4', left: '#b5aea2', right: '#9a9387', mortar: 'rgba(90,80,70,0.35)', h: WALL_H, trim: '#b89a4a' },
};

// 오브젝트 스프라이트 그리기 함수들: (ctx, cx, cy, r, gx, gy, nb) — cx,cy = 타일 중심. 캐시에 굽는다.
const OBJ = {
  wall_stone(ctx, cx, cy, r) { wallBlock(ctx, cx, cy, WALLS.wall_stone.h, WALLS.wall_stone, r); },
  wall_wood(ctx, cx, cy, r) { wallBlock(ctx, cx, cy, WALLS.wall_wood.h, WALLS.wall_wood, r, 'wood'); },
  wall_crypt(ctx, cx, cy, r) {
    wallBlock(ctx, cx, cy, WALLS.wall_crypt.h, WALLS.wall_crypt, r);
    if (r() < 0.3) { ctx.fillStyle = 'rgba(220,210,190,0.55)'; ellipse(ctx, cx - 14, cy - 34, 3.5, 4); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(cx - 16, cy - 35, 1.5, 1.5); ctx.fillRect(cx - 13, cy - 35, 1.5, 1.5); }
  },
  wall_marble(ctx, cx, cy, r) {
    const P = WALLS.wall_marble;
    wallBlock(ctx, cx, cy, P.h, P, r);
    ctx.strokeStyle = P.trim; ctx.lineWidth = 2;
    for (const hy of [6, P.h - 6]) {
      ctx.beginPath(); ctx.moveTo(cx - HW, cy - hy); ctx.lineTo(cx, cy + HH - hy); ctx.lineTo(cx + HW, cy - hy); ctx.stroke();
    }
  },
  wall_spirit(ctx, cx, cy) {
    // 반투명 영혼 장벽 (애니메이션은 drawObjectAnim)
    ctx.globalAlpha = 0.5;
    isoBox(ctx, cx, cy, HW, HH, WALL_H, 'rgba(170,150,255,0.35)', 'rgba(110,90,200,0.45)', 'rgba(80,70,170,0.45)');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(200,190,255,0.6)'; ctx.lineWidth = 1;
    diamondPath(ctx, cx, cy - WALL_H, HW, HH); ctx.stroke();
  },
  tree(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 6, cy + 2, 30, 13, 0.4);
    const tw = 5 + r() * 2;
    ctx.fillStyle = '#3a2618';
    ctx.beginPath(); ctx.moveTo(cx - tw, cy + 2); ctx.quadraticCurveTo(cx - tw * 0.6, cy - 30, cx - 3, cy - 50); ctx.lineTo(cx + 3, cy - 50); ctx.quadraticCurveTo(cx + tw * 0.6, cy - 30, cx + tw, cy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3322'; ctx.fillRect(cx - 1, cy - 44, 2.5, 42);
    const hue = r();
    const baseC = mix('#3a6a2a', '#4e7028', hue);
    const blobs = [];
    for (let i = 0; i < 9; i++) blobs.push([cx + (r() - 0.5) * 44, cy - 62 - (r() - 0.3) * 40, 14 + r() * 10]);
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s] of blobs) { ctx.fillStyle = shade(baseC, -0.4); ellipse(ctx, x + 2, y + 3, s, s * 0.85); ctx.fill(); }
    for (const [x, y, s] of blobs) {
      const g = ctx.createRadialGradient(x - s * 0.35, y - s * 0.4, 1, x, y, s);
      g.addColorStop(0, shade(baseC, 0.3)); g.addColorStop(0.6, baseC); g.addColorStop(1, shade(baseC, -0.3));
      ctx.fillStyle = g; ellipse(ctx, x, y, s, s * 0.82); ctx.fill();
    }
    for (let i = 0; i < 30; i++) { ctx.fillStyle = rgba(shade(baseC, 0.45), 0.5); const b = blobs[(r() * blobs.length) | 0]; ctx.fillRect(b[0] + (r() - 0.6) * b[2], b[1] + (r() - 0.7) * b[2] * 0.8, 2, 1.5); }
  },
  pine(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 5, cy + 2, 24, 11, 0.4);
    ctx.fillStyle = '#3a2618'; ctx.fillRect(cx - 3, cy - 22, 6, 24);
    const H = 115 + r() * 25, layers = 5;
    const c = mix('#2a5232', '#30583a', r());
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const yb = cy - 14 - t * (H - 30), w = 30 * (1 - t * 0.75), hh = (H - 20) / layers + 16;
      ctx.fillStyle = shade(c, -0.25 + t * 0.1);
      ctx.beginPath(); ctx.moveTo(cx - w, yb); ctx.quadraticCurveTo(cx, yb + 8, cx + w, yb); ctx.lineTo(cx, yb - hh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, 0.12 + t * 0.1);
      ctx.beginPath(); ctx.moveTo(cx - w, yb); ctx.quadraticCurveTo(cx - w * 0.3, yb + 4, cx - 2, yb + 2); ctx.lineTo(cx, yb - hh); ctx.closePath(); ctx.fill();
    }
  },
  dead_tree(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 4, cy + 2, 18, 8, 0.35);
    ctx.strokeStyle = '#3d3630'; ctx.lineCap = 'round';
    const branch = (x, y, a, len, w, d) => {
      const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * 8, (y + y2) / 2, x2, y2); ctx.stroke();
      if (d > 0) { branch(x2, y2, a - 0.4 - r() * 0.5, len * 0.68, w * 0.62, d - 1); branch(x2, y2, a + 0.3 + r() * 0.5, len * 0.62, w * 0.6, d - 1); }
    };
    branch(cx, cy + 2, (r() - 0.5) * 0.3, 42, 8, 3);
    ctx.strokeStyle = 'rgba(160,150,140,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 2, cy); ctx.lineTo(cx - 2, cy - 36); ctx.stroke();
  },
  bush(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 3, cy + 2, 20, 8, 0.4);
    const c = mix('#3e6a30', '#4a7032', r());
    for (let i = 0; i < 6; i++) {
      const x = cx + (r() - 0.5) * 26, y = cy - 8 - r() * 12, s = 7 + r() * 6;
      const g = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, s);
      g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, shade(c, -0.35));
      ctx.fillStyle = g; ellipse(ctx, x, y, s, s * 0.8); ctx.fill();
    }
    if (r() < 0.4) for (let i = 0; i < 4; i++) { ctx.fillStyle = '#a03030'; ctx.fillRect(cx + (r() - 0.5) * 22, cy - 6 - r() * 14, 2, 2); }
  },
  rock(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 2, cy + 3, 22, 9, 0.45);
    const c = mix('#5d5a55', '#4c4a48', r());
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pts.push([cx + Math.cos(a) * (14 + r() * 6), cy - 8 + Math.sin(a) * (8 + r() * 4) - (Math.sin(a) < 0 ? 6 : 0)]); }
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const g = ctx.createLinearGradient(cx - 14, cy - 20, cx + 14, cy);
    g.addColorStop(0, shade(c, 0.25)); g.addColorStop(1, shade(c, -0.35));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(cx - 4, cy - 16); ctx.lineTo(cx + 2, cy - 8); ctx.lineTo(cx + 1, cy - 3); ctx.stroke();
  },
  fence(ctx, cx, cy, r, gx, gy, nb) {
    const wood = '#6a4a2c';
    const rail = (dx, dy) => {
      // 이웃 방향으로 반 칸 가로대
      const ex = cx + (dx - dy) * HW * 0.5, ey = cy + (dx + dy) * HH * 0.5;
      for (const hy of [10, 19]) { ctx.strokeStyle = shade(wood, -0.25); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - hy); ctx.lineTo(ex, ey - hy); ctx.stroke(); }
    };
    const back = [], front = [];
    if (nb?.('fence', -1, 0)) back.push([-1, 0]);
    if (nb?.('fence', 0, -1)) back.push([0, -1]);
    if (nb?.('fence', 1, 0)) front.push([1, 0]);
    if (nb?.('fence', 0, 1)) front.push([0, 1]);
    if (!back.length && !front.length) { front.push([1, 0]); back.push([-1, 0]); }
    back.forEach(([a, b]) => rail(a, b));
    isoBox(ctx, cx, cy, 3, 1.5, 24, shade(wood, 0.2), wood, shade(wood, -0.3));
    front.forEach(([a, b]) => rail(a, b));
  },
  torch(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 1, 9, 4, 0.4);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(cx - 2, cy - 40, 4, 40);
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(cx - 4, cy - 46, 8, 7);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx - 5, cy - 47, 10, 2);
  },
  brazier(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 2, 18, 8, 0.45);
    ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 3;
    for (const dx of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(cx + dx * 0.6, cy - 16); ctx.lineTo(cx + dx, cy + (dx ? 0 : 4)); ctx.stroke(); }
    ctx.fillStyle = '#3a332c';
    ctx.beginPath(); ctx.ellipse(cx, cy - 18, 15, 6, 0, 0, Math.PI); ctx.lineTo(cx - 15, cy - 22); ctx.ellipse(cx, cy - 22, 15, 6, 0, Math.PI, 0, true); ctx.fill();
    ctx.fillStyle = '#1c1714'; ellipse(ctx, cx, cy - 22, 13, 5); ctx.fill();
    ctx.fillStyle = '#ff7a2a'; ellipse(ctx, cx, cy - 22, 10, 3.5); ctx.fill();
  },
  lamp_post(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 1, 10, 4, 0.4);
    ctx.fillStyle = '#26282c'; ctx.fillRect(cx - 2, cy - 64, 4, 64);
    ctx.fillRect(cx - 5, cy - 4, 10, 5);
    ctx.fillStyle = '#1e2024'; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 72); ctx.lineTo(cx + 8, cy - 72); ctx.lineTo(cx, cy - 80); ctx.fill();
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(cx - 6, cy - 72, 12, 10);
    ctx.strokeStyle = '#1e2024'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 6, cy - 72, 12, 10); ctx.beginPath(); ctx.moveTo(cx, cy - 72); ctx.lineTo(cx, cy - 62); ctx.stroke();
  },
  crystal(ctx, cx, cy, r) {
    shadowBlob(ctx, cx, cy + 2, 18, 7, 0.4);
    const shards = [[0, 52, 7], [-9, 32, 5], [9, 38, 5], [-4, 22, 4], [6, 20, 4]];
    for (const [dx, h, w] of shards) {
      const x = cx + dx + (r() - 0.5) * 3;
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, '#2a6a8a'); g.addColorStop(0.5, '#9feaff'); g.addColorStop(1, '#1f4f6e');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w, cy - 2); ctx.lineTo(x - w * 0.8, cy - h * 0.8); ctx.lineTo(x, cy - h); ctx.lineTo(x + w * 0.8, cy - h * 0.8); ctx.lineTo(x + w, cy - 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(220,250,255,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, cy - h); ctx.lineTo(x, cy - 4); ctx.stroke();
    }
  },
  pillar(ctx, cx, cy) {
    shadowBlob(ctx, cx + 4, cy + 2, 20, 9, 0.45);
    isoBox(ctx, cx, cy, 18, 9, 8, '#8a857c', '#6e6a62', '#5a5650');
    cylinder(ctx, cx, cy, 11, 5.5, 82, '#8c877e', 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    for (const dx of [-6, -2, 2, 6]) { ctx.beginPath(); ctx.moveTo(cx + dx, cy - 10); ctx.lineTo(cx + dx, cy - 86); ctx.stroke(); }
    isoBox(ctx, cx, cy, 17, 8.5, 8, '#99948a', '#7a756c', '#64605a', 88);
  },
  statue(ctx, cx, cy) {
    shadowBlob(ctx, cx + 4, cy + 2, 22, 10, 0.45);
    isoBox(ctx, cx, cy, 20, 10, 16, '#7a766e', '#626058', '#4e4c46');
    const s = '#8a867e';
    const z = cy - 16;
    // 로브 입은 인물
    const g = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
    g.addColorStop(0, shade(s, -0.3)); g.addColorStop(0.4, shade(s, 0.15)); g.addColorStop(1, shade(s, -0.45));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - 13, z); ctx.lineTo(cx - 9, z - 42); ctx.lineTo(cx + 9, z - 42); ctx.lineTo(cx + 13, z); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 10, z - 40); ctx.lineTo(cx - 14, z - 22); ctx.lineTo(cx - 9, z - 20); ctx.fill();
    ctx.fillStyle = shade(s, 0.05); ellipse(ctx, cx, z - 49, 6.5, 7.5); ctx.fill();
    ctx.fillStyle = shade(s, -0.25); ctx.beginPath(); ctx.arc(cx, z - 50, 7.5, Math.PI, 0); ctx.lineTo(cx + 8, z - 42); ctx.lineTo(cx - 8, z - 42); ctx.fill();
    // 손에 든 검
    ctx.fillStyle = shade(s, 0.2); ctx.fillRect(cx - 1, z - 62, 2.5, 46); ctx.fillRect(cx - 6, z - 34, 12, 2.5);
  },
  gravestone(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 3, cy + 3, 15, 6, 0.4);
    const c = mix('#6a6862', '#57564f', r());
    const kind = (r() * 3) | 0;
    // 흙무덤
    ctx.fillStyle = '#3a3226'; ellipse(ctx, cx + 4, cy + 4, 13, 5); ctx.fill();
    ctx.save(); ctx.translate(cx - 2, cy); ctx.rotate((r() - 0.5) * 0.15);
    if (kind === 0) {
      isoBox(ctx, 0, 0, 10, 4, 5, shade(c, 0.1), shade(c, -0.1), shade(c, -0.3));
      ctx.fillStyle = shade(c, 0.05); ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-8, -20); ctx.arc(0, -20, 8, Math.PI, 0); ctx.lineTo(8, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, -0.25); ctx.fillRect(-1, -24, 2, 12); ctx.fillRect(-4, -20, 8, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(4, -26, 4, 22);
    } else if (kind === 1) {
      ctx.fillStyle = c; ctx.fillRect(-2.5, -30, 5, 28); ctx.fillRect(-10, -23, 20, 5);
      ctx.fillStyle = shade(c, -0.3); ctx.fillRect(1, -30, 1.5, 28);
    } else {
      isoBox(ctx, 0, 0, 9, 4.5, 14, shade(c, 0.12), shade(c, -0.08), shade(c, -0.3));
      ctx.fillStyle = 'rgba(30,25,20,0.5)'; ctx.fillRect(-6, -10, 4, 1); ctx.fillRect(-6, -7, 3, 1);
    }
    ctx.restore();
    if (r() < 0.4) { ctx.fillStyle = '#4d6a3a'; ellipse(ctx, cx - 8, cy - 2, 4, 2); ctx.fill(); }
  },
  crate(ctx, cx, cy) {
    shadowBlob(ctx, cx + 3, cy + 3, 22, 9, 0.4);
    isoBox(ctx, cx, cy, 18, 9, 22, '#8a6a40', '#6e5232', '#5a4228', 0, 'rgba(40,25,10,0.7)');
    ctx.strokeStyle = 'rgba(40,25,10,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 18, cy - 22); ctx.lineTo(cx, cy + 9); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx, cy - 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 18, cy - 22); ctx.lineTo(cx, cy + 9); ctx.moveTo(cx + 18, cy); ctx.lineTo(cx, cy - 13); ctx.stroke();
  },
  barrel(ctx, cx, cy) {
    shadowBlob(ctx, cx + 3, cy + 3, 18, 8, 0.4);
    cylinder(ctx, cx, cy, 12, 6, 28, '#6e4c2c');
    ctx.strokeStyle = '#2e2a26'; ctx.lineWidth = 2;
    for (const hy of [5, 23]) { ctx.beginPath(); ctx.ellipse(cx, cy - hy, 12.3, 6, 0, 0, Math.PI); ctx.stroke(); }
    ctx.fillStyle = '#4a321c'; ellipse(ctx, cx, cy - 28, 10, 4.8); ctx.fill();
  },
  table(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 2, 26, 10, 0.4);
    const w = '#6e4c2c';
    for (const [dx, dy] of [[-16, 0], [16, 0], [0, 7], [0, -7]]) { ctx.fillStyle = shade(w, -0.4); ctx.fillRect(cx + dx - 1.5, cy + dy - 16, 3, 16); }
    isoBox(ctx, cx, cy, 24, 12, 4, shade(w, 0.15), shade(w, -0.2), shade(w, -0.35), 16);
    ctx.fillStyle = '#c9c0a8'; ellipse(ctx, cx - 6, cy - 22, 4, 2); ctx.fill();
    ctx.fillStyle = '#8a3a2a'; ctx.fillRect(cx + 5, cy - 27, 4, 6);
  },
  bookshelf(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 3, cy + 3, 26, 10, 0.4);
    const w = '#4e3420';
    isoBox(ctx, cx, cy, 26, 13, 66, shade(w, 0.1), shade(w, -0.1), shade(w, -0.3));
    // 왼쪽 면의 책칸
    for (let s = 0; s < 4; s++) {
      const hy = 8 + s * 15;
      for (let b = 0; b < 7; b++) {
        const t0 = 0.08 + b * 0.12, t1 = t0 + 0.1;
        const x0 = cx - 26 + 26 * t0, x1 = cx - 26 + 26 * t1;
        const y0 = cy + 13 * t0 - hy, y1 = cy + 13 * t1 - hy;
        const bh = 9 + r() * 3;
        ctx.fillStyle = ['#7a2a22', '#2a4a6a', '#5a5a2a', '#3a2a4a', '#8a6a3a'][(r() * 5) | 0];
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - bh); ctx.lineTo(x0, y0 - bh); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = shade(w, -0.45); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 26, cy - hy + 1); ctx.lineTo(cx, cy + 13 - hy + 1); ctx.stroke();
    }
  },
  bed(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 3, 28, 12, 0.4);
    isoBox(ctx, cx, cy, 26, 13, 12, '#6a4a2c', '#5a3e24', '#4a321c');
    isoBox(ctx, cx, cy, 24, 12, 4, '#8a3a34', '#6a2a26', '#5a221e', 12);
    ctx.fillStyle = '#d8d0c0'; ellipse(ctx, cx - 12, cy - 21, 8, 4); ctx.fill();
    isoBox(ctx, cx - 22, cy - 2, 5, 3, 26, '#5a3e24', '#4a321c', '#3e2a16');
  },
  anvil(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 2, 20, 8, 0.45);
    isoBox(ctx, cx, cy, 12, 6, 12, '#5a4a3a', '#4a3a2c', '#3a2c20');
    isoBox(ctx, cx, cy, 6, 3, 6, '#3a3c40', '#2c2e32', '#222428', 12);
    ctx.fillStyle = '#4a4c52';
    ctx.beginPath(); ctx.moveTo(cx - 20, cy - 22); ctx.lineTo(cx + 14, cy - 22); ctx.lineTo(cx + 18, cy - 26); ctx.lineTo(cx - 10, cy - 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2c2e32'; ctx.fillRect(cx - 16, cy - 22, 30, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(cx - 10, cy - 27, 20, 1.5);
  },
  well(ctx, cx, cy) {
    shadowBlob(ctx, cx + 3, cy + 3, 28, 12, 0.45);
    cylinder(ctx, cx, cy, 20, 10, 16, '#6a665e');
    ctx.fillStyle = '#0c1418'; ellipse(ctx, cx, cy - 16, 15, 7.5); ctx.fill();
    ctx.fillStyle = 'rgba(80,120,150,0.4)'; ellipse(ctx, cx, cy - 14, 10, 4); ctx.fill();
    ctx.fillStyle = '#4a321c'; ctx.fillRect(cx - 19, cy - 52, 3, 38); ctx.fillRect(cx + 16, cy - 52, 3, 38);
    ctx.fillStyle = '#5a2a20'; ctx.beginPath(); ctx.moveTo(cx - 26, cy - 48); ctx.lineTo(cx, cy - 66); ctx.lineTo(cx + 26, cy - 48); ctx.lineTo(cx + 22, cy - 46); ctx.lineTo(cx, cy - 60); ctx.lineTo(cx - 22, cy - 46); ctx.fill();
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 50); ctx.lineTo(cx, cy - 24); ctx.stroke();
    ctx.fillStyle = '#5a4028'; ctx.fillRect(cx - 4, cy - 26, 8, 6);
  },
  sign(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 2, 12, 5, 0.4);
    ctx.fillStyle = '#4a321c'; ctx.fillRect(cx - 2, cy - 34, 4, 34);
    ctx.save(); ctx.translate(cx, cy - 30); ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillStyle = '#7a5a34'; ctx.fillRect(-14, -8, 28, 14);
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 1.5; ctx.strokeRect(-14, -8, 28, 14);
    ctx.fillStyle = '#2a1a0c'; ctx.fillRect(-9, -4, 18, 1.5); ctx.fillRect(-9, 0, 12, 1.5);
    ctx.restore();
  },
  chest(ctx, cx, cy) {
    shadowBlob(ctx, cx + 2, cy + 3, 20, 8, 0.45);
    isoBox(ctx, cx, cy, 16, 8, 14, '#7a5230', '#6a4426', '#55361e', 0, 'rgba(30,18,8,0.7)');
    ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(cx, cy - 14, 16, 8, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#c9a14a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 18); ctx.lineTo(cx - 8, cy + 0); ctx.moveTo(cx + 8, cy - 18); ctx.lineTo(cx + 8, cy); ctx.stroke();
    ctx.fillStyle = '#e8c860'; ctx.fillRect(cx - 2, cy - 8, 4, 5);
  },
  altar(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 3, 30, 12, 0.45);
    isoBox(ctx, cx, cy, 28, 14, 6, '#5a5668', '#4a4658', '#3a3648');
    isoBox(ctx, cx, cy, 22, 11, 18, '#6e6a80', '#57546a', '#45425a', 6);
    ctx.strokeStyle = 'rgba(200,180,255,0.75)'; ctx.lineWidth = 1.2;
    diamondPath(ctx, cx, cy - 24, 14, 7); ctx.stroke();
    diamondPath(ctx, cx, cy - 24, 6, 3); ctx.stroke();
    ctx.fillStyle = 'rgba(200,180,255,0.6)';
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - 18 + i * 6, cy - 12 + i * 3, 2, 4);
  },
  shrine(ctx, cx, cy) {
    shadowBlob(ctx, cx + 3, cy + 3, 28, 12, 0.45);
    isoBox(ctx, cx, cy, 24, 12, 10, '#8a8478', '#6e6a60', '#5a564e');
    isoBox(ctx, cx, cy, 12, 6, 56, '#9a9488', '#7e786e', '#68625a', 10);
    ctx.fillStyle = '#5a5248'; ctx.beginPath(); ctx.moveTo(cx - 20, cy - 66); ctx.lineTo(cx, cy - 88); ctx.lineTo(cx + 20, cy - 66); ctx.lineTo(cx, cy - 58); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a14a'; ellipse(ctx, cx - 6, cy - 44, 4, 5); ctx.fill();
  },
  stairs_down(ctx, cx, cy) {
    ctx.save(); diamondPath(ctx, cx, cy, HW * 0.85, HH * 0.85); ctx.clip();
    ctx.fillStyle = '#0a0808'; ctx.fillRect(cx - HW, cy - HH, HW * 2, HH * 2);
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      ctx.fillStyle = shade('#5a5650', -t * 0.8);
      ctx.beginPath();
      const [ax, ay] = isoPt(cx, cy, -0.42 + t * 0.16, -0.42), [bx, by] = isoPt(cx, cy, -0.42 + t * 0.16, 0.42);
      ctx.moveTo(ax, ay + t * 6); ctx.lineTo(bx, by + t * 6); ctx.lineTo(bx + 5, by + t * 6 + 2.5); ctx.lineTo(ax + 5, ay + t * 6 + 2.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#6e6a62'; ctx.lineWidth = 3; diamondPath(ctx, cx, cy, HW * 0.85, HH * 0.85); ctx.stroke();
  },
  stairs_up(ctx, cx, cy) {
    for (let i = 0; i < 5; i++) {
      const s = 1 - i * 0.16;
      isoBox(ctx, cx + i * 3, cy - i * 1.5, HW * 0.8 * s, HH * 0.8 * s, 5, shade('#7a766e', i * 0.05), '#5a5650', '#48453f', i * 5);
    }
  },
  portal_glow(ctx, cx, cy) {
    ctx.strokeStyle = 'rgba(150,120,255,0.6)'; ctx.lineWidth = 2;
    diamondPath(ctx, cx, cy, HW * 0.8, HH * 0.8); ctx.stroke();
    ctx.fillStyle = 'rgba(150,120,255,0.15)'; ctx.fill();
  },
  flowers(ctx, cx, cy, r) {
    const cols = ['#c9475a', '#e0c050', '#8a7ae0', '#e8e0f0'];
    const c = cols[(r() * cols.length) | 0];
    for (let i = 0; i < 9; i++) {
      const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8);
      ctx.strokeStyle = '#3a5a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 4); ctx.stroke();
      ctx.fillStyle = r() < 0.7 ? c : cols[(r() * 4) | 0]; ellipse(ctx, x, y - 5, 2, 1.5); ctx.fill();
    }
  },
  mushroom(ctx, cx, cy, r) {
    for (let i = 0; i < 4; i++) {
      const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7);
      const s = 2 + r() * 3;
      ctx.fillStyle = '#d8ccb0'; ctx.fillRect(x - 1, y - s * 1.4, 2, s * 1.4);
      ctx.fillStyle = r() < 0.5 ? '#9a3a3a' : '#8a7a5a'; ctx.beginPath(); ctx.arc(x, y - s * 1.4, s, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1, y - s * 1.8, 1, 1);
    }
  },
  bones(ctx, cx, cy, r) {
    ctx.strokeStyle = '#d4c8ac'; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7);
      const a = r() * Math.PI;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 3); ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 3); ctx.stroke();
    }
    if (r() < 0.6) { const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4); ctx.fillStyle = '#ddd2b6'; ellipse(ctx, x, y - 3, 4.5, 4); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x - 2.5, y - 4, 1.5, 1.5); ctx.fillRect(x + 1, y - 4, 1.5, 1.5); }
  },
  cobweb(ctx, cx, cy, r) {
    ctx.strokeStyle = 'rgba(220,220,230,0.35)'; ctx.lineWidth = 0.8;
    const ox = cx + (r() - 0.5) * 10, oy = cy - 4;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * 18, oy + Math.sin(a) * 9); ctx.stroke(); }
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(ox, oy, k * 5.5, k * 2.8, 0, 0, Math.PI * 2); ctx.stroke(); }
  },
  rubble(ctx, cx, cy, r) {
    for (let i = 0; i < 7; i++) {
      const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8);
      isoBox(ctx, x, y, 2 + r() * 4, 1 + r() * 2, 1 + r() * 4, '#6e6a62', '#55524c', '#45423d');
    }
  },
};

// 스프라이트 캔버스 크기(타일 중심 기준 위/아래 여백)
const TALL_UP = { tree: 140, pine: 160, dead_tree: 120, pillar: 110, statue: 100, shrine: 100, lamp_post: 90, crystal: 70, well: 72, bookshelf: 90, torch: 60 };
export function objectTop(id) { return TALL_UP[id] ?? (WALLS[id] || id === 'wall_spirit' ? WALL_H + 20 : 50); }

// 이웃 의존 스프라이트(울타리)의 이웃 마스크
function nbMask(world, gx, gy, id) {
  if (!world || id !== 'fence') return 0;
  let m = 0;
  [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dy], i) => { if (world.objAt(gx + dx, gy + dy) === id) m |= 1 << i; });
  return m;
}

const objCache = new LRU(800);
export function clearObjectCache() { objCache.clear(); }
// 캐시된 오브젝트 스프라이트 {canvas, ax, ay}
export function objectSprite(id, gx, gy, world) {
  const variant = WALLS[id] || id === 'wall_spirit' ? (hash2(gx, gy, 5) * 6) | 0 : (hash2(gx, gy, 5) * 4) | 0;
  const mask = nbMask(world, gx, gy, id);
  const key = `${id}|${variant}|${mask}`;
  let s = objCache.get(key);
  if (s) return s;
  const up = objectTop(id), W = 120, H = up + 40;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const ax = W / 2, ay = up;
  const r = seeded(variant * 977 + id.length * 31 + 1);
  const nb = (oid, dx, dy) => !!(mask & (1 << [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([a, b]) => a === dx && b === dy))) && oid === id;
  (OBJ[id] || OBJ.rock)(ctx, ax, ay, r, gx, gy, nb);
  // 도트화: 벽은 이어 붙으므로 외곽선 없음, 영혼 장벽은 반투명 유지
  const wall = !!WALLS[id] || id === 'wall_spirit';
  pixelize(c, { outline: !wall && !FLAT_PIX.has(id), keepAlpha: id === 'wall_spirit' || id === 'portal_glow' || id === 'cobweb', shadow: true, alphaCut: id === 'wall_spirit' ? 20 : FLAT_PIX.has(id) ? 60 : 110, midAlpha: id === 'wall_spirit' ? 110 : 150 });
  s = { canvas: c, ax, ay, w: W, h: H };
  return objCache.set(key, s);
}

// 애니메이션 부분 (불꽃, 빛, 포탈 소용돌이) — 매 프레임, 넓은 발광 대신 작은 계단식 빛
export function drawObjectAnim(ctx, id, cx, cy, gx, gy, t) {
  const ph = hash2(gx, gy, 9) * 6.28;
  cx = Math.round(cx); cy = Math.round(cy);
  const blink = (n) => Math.floor(t * n + ph) & 1;
  if (id === 'torch') flame(ctx, cx, cy - 47, 1, t + ph);
  else if (id === 'brazier') flame(ctx, cx, cy - 23, 1.7, t + ph);
  else if (id === 'lamp_post') {
    ctx.fillStyle = blink(3) ? '#fff0b0' : '#ffe090'; ctx.fillRect(cx - 4, cy - 70, 8, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy - 69, 2, 3);
  } else if (id === 'crystal') {
    ctx.fillStyle = '#e0faff';
    const k = Math.floor(t * 2 + ph) % 4;
    const pts = [[0, -44], [-8, -28], [8, -32], [2, -20]];
    const [dx, dy] = pts[k]; ctx.fillRect(cx + dx, cy + dy - 1, 1, 3); ctx.fillRect(cx + dx - 1, cy + dy, 3, 1);
  } else if (id === 'altar') {
    if (blink(1.6)) pxDitherDiamond(ctx, cx, cy - 24, 13, 6, '#c8b4ff', 0.35);
    for (let i = 0; i < 3; i++) {
      const k = Math.floor(((t * 0.4 + i / 3 + ph) % 1) * 6) / 6;
      if (k > 0.8) continue;
      ctx.fillStyle = k < 0.4 ? '#e8dcff' : '#a890e0'; ctx.fillRect(cx - 10 + i * 10, cy - 26 - Math.round(k * 30), 2, 2);
    }
  } else if (id === 'shrine') {
    ctx.fillStyle = blink(2) ? '#fff4c0' : '#ffe08a'; ctx.fillRect(cx - 9, cy - 48, 6, 8);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 7, cy - 46, 2, 3);
  } else if (id === 'portal_glow') {
    for (let i = 0; i < 3; i++) {
      const k = Math.floor(((t * 0.6 + i / 3) % 1) * 5) / 5;
      pxEllipse(ctx, cx, cy, HW * 0.75 * (1 - k * 0.7), HH * 0.75 * (1 - k * 0.7), k < 0.4 ? '#d0c0ff' : '#9a7ae8', k < 0.4 ? 1 : 2);
    }
    for (let i = 0; i < 6; i++) {
      const k = Math.floor(((t * 0.5 + i / 6) % 1) * 10) / 10;
      ctx.fillStyle = k < 0.5 ? '#ffffff' : '#c0a8ff'; ctx.fillRect(cx + Math.round(Math.sin(i * 2.1 + t) * 12), cy - Math.round(k * 50), 1, 2);
    }
  } else if (id === 'wall_spirit') {
    for (let i = 0; i < 3; i++) {
      const k = Math.floor(((t * 0.35 + i / 3 + ph) % 1) * 8) / 8;
      ctx.fillStyle = k < 0.5 ? '#e8e0ff' : '#a898ff';
      ctx.fillRect(cx - 20 + i * 18 + Math.round(Math.sin(t * 2 + i) * 3), cy - Math.round(k * WALL_H), 1, 3);
    }
  }
}
export const ANIMATED_OBJECTS = new Set(['torch', 'brazier', 'lamp_post', 'crystal', 'altar', 'shrine', 'portal_glow', 'wall_spirit']);

// 도트 불꽃: 3색 계단 기둥, 4프레임 순환 (발광 그라데이션 없음)
const FLAME_COL = ['#c83010', '#ff8a20', '#ffe070'];
export function flame(ctx, x, y, s, t) {
  x = Math.round(x); y = Math.round(y);
  const fr = Math.floor(t * 8) & 3;
  const sway = [0, 1, 0, -1][fr];
  for (let i = 0; i < 3; i++) {
    const w = Math.max(1, Math.round((4 - i * 1.2) * s));
    const h = Math.max(2, Math.round((9 + [0, 2, 1, 3][(fr + i) & 3] - i * 2.5) * s));
    ctx.fillStyle = FLAME_COL[i];
    for (let yy = 0; yy < h; yy++) {
      const k = yy / h, ww = Math.max(1, Math.round(w * (1 - k * k)));
      ctx.fillRect(x - ww + Math.round(sway * k * (i + 1) * 0.6), y - yy, ww * 2 - (i === 2 ? 1 : 0), 1);
    }
  }
  if ((fr & 1) && s >= 0.8) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x + sway * 2, y - Math.round(13 * s), 1, 1); }
}
