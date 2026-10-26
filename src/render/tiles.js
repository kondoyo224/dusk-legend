// 타일 그리기: tiles.js 의 모든 지면/오브젝트 id 에 대한 절차 생성 그림. 소유: 워커 A.
// 지면 = groundpx.js 픽셀 셰이더로 청크에 굽는다(ground.js). 오브젝트 = id+변형별 스프라이트 캐시(objpx.js 픽셀 셰이더 + 톤 매핑) + 애니메이션만 매 프레임.
import { hash2, shade, mix, rgba, makeCanvas, diamondPath, ellipse, seeded, LRU } from './util.js';
import { pixelize, pxEllipse, pxLine, pxDitherDiamond } from './pixel.js';
import { bakeGround, bakeCliffs } from './groundpx.js';
import { PB, leafBall, canopy, trunk, boxPx, boulder, column, R, rc, ih, vnoise } from './objpx.js';
// 지면에 납작하게 구워지는 장식(외곽선 없이)
const FLAT_PIX = new Set(['flowers', 'mushroom', 'bones', 'cobweb', 'rubble', 'stairs_down', 'stairs_up', 'portal_glow']);
// 픽셀 셰이더로 직접 램프 색을 찍는 오브젝트 (톤 매핑 생략, 외곽선만)
const PX_OBJ = new Set(['wall_stone', 'wall_wood', 'wall_crypt', 'wall_marble', 'tree', 'pine', 'bush', 'rock', 'pillar', 'crate', 'barrel', 'table', 'bookshelf', 'bed', 'anvil', 'well', 'chest', 'altar', 'shrine']);

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

// ── 지면 타일 1장 (쇼케이스용: 청크와 같은 픽셀 셰이더로 굽고 캐시) ──
const tileCache = new LRU(200);
export function drawGroundTile(ctx, id, cx, cy, gx, gy, world) {
  if (id === 'void') return;
  const w = world ? { groundAt: (x, y) => (x === gx && y === gy ? id : world.groundAt(x, y)), objAt: () => null } : { groundAt: () => id, objAt: () => null };
  const key = `${id}|${gx}|${gy}|${world ? [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([a, b]) => w.groundAt(gx + a, gy + b)).join(',') : ''}`;
  let c = tileCache.get(key);
  if (!c) {
    const minX = (gx - gy) * HW - HW - 1, minY = (gx + gy) * HH - HH - 1;
    c = makeCanvas(HW * 2 + 2, HH * 2 + 34);
    const g = c.getContext('2d'), img = g.createImageData(c.width, c.height);
    bakeGround(img, minX, minY, w, (x, y) => x === gx && y === gy);
    if (world) bakeCliffs(img, minX, minY, w, [[gx, gy]]);
    g.putImageData(img, 0, 0);
    tileCache.set(key, c);
  }
  ctx.drawImage(c, Math.round(cx) - HW - 1, Math.round(cy) - HH - 1);
}

const rh = (ramp, i) => ramp.hex[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))];
// 매 프레임 애니메이션 오버레이 (물 반짝임, 용암 거품 등) — 1px 도트, 계단 프레임, 램프 색
export function drawGroundAnim(ctx, id, cx, cy, gx, gy, t) {
  const ph = hash2(gx, gy, 3) * 6.28;
  cx = Math.round(cx); cy = Math.round(cy);
  if (id === 'water' || id === 'deep_water') {
    const rp = id === 'water' ? R.water : R.deep_water;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.12 + hash2(gx, gy, 10 + i)) % 1);
      const x = Math.round(cx - 18 + hash2(gx, gy, 20 + i) * 30 + k * 6), y = Math.round(cy - 7 + i * 6 + hash2(gx, gy, 30 + i) * 3);
      const fr = Math.floor(k * 6);
      if (fr >= 5) continue;
      const len = [2, 4, 5, 4, 2][fr];
      ctx.fillStyle = rh(rp, rp.length - 2); ctx.fillRect(x - (len >> 1), y, len, 1);
      if (fr === 2) { ctx.fillStyle = rh(rp, rp.length - 1); ctx.fillRect(x, y, 1, 1); ctx.fillStyle = rh(rp, 2); ctx.fillRect(x - 2, y + 1, 5, 1); }
    }
  } else if (id === 'lava') {
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.5 + hash2(gx, gy, 40 + i)) % 1), fr = Math.floor(k * 5);
      const u = hash2(gx, gy, 20 + i) - 0.5, v = hash2(gx, gy, 30 + i) - 0.5;
      const x = Math.round(cx + (u - v) * 40), y = Math.round(cy + (u + v) * 20);
      const r = [1, 2, 2, 3, 1][fr];
      ctx.fillStyle = rh(R.lava, 9); ctx.fillRect(x - r + 1, y - 1, r * 2 - 1, 1);
      ctx.fillStyle = rh(R.lava, 7); ctx.fillRect(x - r, y, r * 2 + 1, 1);
      if (fr === 4) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(x, y - 3, 1, 1); }
    }
  } else if (id === 'swamp') {
    if (hash2(gx, gy, Math.floor(t * 0.5)) < 0.1) {
      const k = Math.floor(((t * 0.5) % 1) * 4) / 4;
      pxEllipse(ctx, cx + Math.round((ph - 3) * 4), cy, 2 + k * 6, 1 + k * 3, rh(R.swamp, 7));
    }
  } else if (id === 'mist_floor') {
    const k = Math.sin(t * 0.7 + ph);
    if (k > 0.6) pxDitherDiamond(ctx, cx + Math.round(Math.sin(t * 0.3 + ph) * 6), cy, 22, 8, rh(R.mist, 8), (k - 0.6) * 0.5);
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

// ── 벽 (픽셀 셰이더 블록): 벽돌마다 톤·윗변 하이라이트·아랫변 그림자, 줄눈, 균열, 이끼 ──
function bricks(course, blen, mortar = -4) {
  return (face, x, y, s, hh2, H) => {
    if (hh2 > H - 1) return 0;
    const k = Math.floor(hh2 / course), m = hh2 - k * course;
    const along = s * HW + (k & 1) * (blen / 2);
    const bi = Math.floor(along / blen), bm = along - bi * blen;
    if (m < 1 || bm < 1) return mortar;
    let t = (ih(bi, k, face * 7 + 3) - 0.5) * 1.8;
    if (m > course - 1.5) t += 1.4; else if (m < 2) t -= 0.9;
    if (bm < 2) t += face === 1 ? 0.8 : 0.4; else if (bm > blen - 1.5) t -= 0.7;
    if (ih(bi, k, 91) > 0.86 && Math.abs(vnoise(x * 2, y, 4, bi * 5 + k) - 0.5) < 0.05) t -= 2.4; // 균열
    return t;
  };
}
function mossPass(pb, cx, cy, h, density, seed) {
  for (let y = cy - h - HH; y < cy + HH; y++) for (let x = cx - HW; x < cx + HW; x++) {
    if (!pb.alpha(x, y)) continue;
    const ground = cy + HH - Math.abs(x + 0.5 - cx) * 0.5;
    const hh2 = ground - y;
    if (hh2 < 0 || hh2 > h) continue;
    const n = vnoise(x, y, 7, seed) * 0.85 + vnoise(x, y, 2.5, seed + 1) * 0.15;
    const want = density * Math.max(0, 1.1 - hh2 / h * 1.8) + (hh2 > h - 3 ? 0.3 * density : 0);
    if (n < 1 - want) continue;
    pb.set(x, y, rc(R.moss, Math.round(2 + (x < cx ? 1.2 : 0) + (n - 0.7) * 5 + (vnoise(x, y, 2, seed + 2) - 0.5) * 1.5)));
  }
}
// 벽 윗면: 타일 주기와 맞는 2×2 덮개돌 (이웃 벽과 이어져도 이음매 없음)
function capSlabs(seed) {
  return (u, v, x, y) => {
    const su = u * 2, sv = v * 2, fu = su - Math.floor(su), fv = sv - Math.floor(sv);
    if (fu < 0.05 || fv < 0.06) return -2.6;
    let t = (ih(Math.floor(su), Math.floor(sv), seed) - 0.5) * 1.4;
    if (fu < 0.13) t += 1; else if (fu > 0.92) t -= 1;
    if (fv < 0.14) t += 0.6; else if (fv > 0.92) t -= 0.8;
    return t;
  };
}
const WALLS = {
  wall_stone:  { h: WALL_H },
  wall_wood:   { h: WALL_H },
  wall_crypt:  { h: WALL_H },
  wall_marble: { h: WALL_H },
};
// nb(dx,dy): 그 방향에 벽이 이어지는가 → 맞닿은 윗면 변·세로 모서리 하이라이트 생략(이음매 숨김)
function stoneWall(ctx, cx, cy, ramp, seed, opt = {}, nb = null) {
  const pb = new PB(ctx);
  const has = (dx, dy) => !!nb?.('wall', dx, dy);
  const edges = (has(0, 1) ? 0 : 1) | (has(1, 0) ? 0 : 2) | (has(-1, 0) ? 0 : 4) | (has(0, -1) ? 0 : 8);
  boxPx(pb, cx, cy, HW, HH, WALL_H, ramp, { topFace: opt.topFace || capSlabs(seed), top: opt.top ?? 6.6, left: opt.left ?? 5.4, right: opt.right ?? 3.2, seed, noise: 0.9, edges, corner: !has(1, 0) && !has(0, 1), face: opt.face || bricks(opt.course ?? 9, opt.blen ?? 16) });
  if (opt.moss) mossPass(pb, cx, cy, WALL_H, opt.moss, seed);
  pb.flush();
  return pb;
}

const OBJ = {
  wall_stone(ctx, cx, cy, r, gx, gy, nb) { stoneWall(ctx, cx, cy, R.brick, (r() * 999) | 0, { moss: r() < 0.35 ? 0.28 : 0 }, nb); },
  wall_wood(ctx, cx, cy, r, gx, gy, nb) {
    const seed = (r() * 999) | 0;
    stoneWall(ctx, cx, cy, R.logwall, seed, { top: 4.6, left: 5.4, right: 3.2, topFace: (u, v) => { const sv = v * 6, fv = sv - Math.floor(sv); return fv < 0.12 ? -2.4 : fv < 0.3 ? 0.8 : 0; }, face: (face, x, y, s, hh2, H) => {
      const lo = hh2 > 6 && hh2 < 12, hi = hh2 > H * 0.6 && hh2 < H * 0.6 + 6;
      if (lo || hi) { const bt = lo ? hh2 - 6 : hh2 - H * 0.6; return (bt > 4.5 ? 0.8 : bt < 1 ? -2.6 : -0.8) + (face === 1 && Math.floor(s * HW) % 11 === 5 && Math.abs(bt - 3) < 0.6 ? 3 : 0); }
      const pw = HW / 6, a = s * HW, pi = Math.floor(a / pw), pm = a - pi * pw;
      if (pm < 0.9) return -3.2;
      let t = (ih(pi, face, seed) - 0.5) * 1.6 + (vnoise(x * 3, y * 0.3, 3, seed + pi) - 0.5) * 1.6;
      if (pm < 2) t += 1; else if (pm > pw - 1.2) t -= 1;
      if (hh2 > H - 3) t += 1.2;
      return t;
    } }, nb);
  },
  wall_crypt(ctx, cx, cy, r, gx, gy, nb) {
    const seed = (r() * 999) | 0;
    const pb = stoneWall(ctx, cx, cy, R.crypt, seed, { moss: 0.5, course: 11, blen: 16, top: 5.6, left: 4.6, right: 2.6 }, nb);
    if (r() < 0.35) { // 해골 벽감
      const x = cx - 15, y = cy - 30;
      for (let yy = -6; yy <= 5; yy++) for (let xx = -6; xx <= 6; xx++) if (xx * xx / 36 + yy * yy / 30 <= 1) pb.set(x + xx, y + yy + (xx * 0.5 | 0), rc(R.crypt, 0));
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy * 1.2 <= 10) pb.set(x + xx, y + yy + 1, rc(R.bonewhite, Math.round(4 - (xx + yy) * 0.5)));
      pb.set(x - 1, y + 1, rc(R.crypt, 0)); pb.set(x + 2, y + 2, rc(R.crypt, 0)); pb.set(x, y + 3, rc(R.bonewhite, 1));
      pb.flush();
    }
  },
  wall_marble(ctx, cx, cy, r, gx, gy, nb) {
    const br = bricks(15, 32, -3);
    stoneWall(ctx, cx, cy, R.marblewall, (r() * 999) | 0, { top: 7.4, left: 6.4, right: 4, face: (face, x, y, s, hh2, H) => {
      const tr = (lo) => hh2 >= lo && hh2 < lo + 3;
      if (tr(5) || tr(H - 9)) { const k = tr(5) ? hh2 - 5 : hh2 - (H - 9); return rc(R.gold, [2, 4, 6][Math.min(2, Math.floor(k))] - (face === 2 ? 1 : 0)); }
      return br(face, x, y, s, hh2, H) + (Math.abs(vnoise(x, y, 9, 4) - 0.5) < 0.012 ? -1.6 : 0);
    } }, nb);
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
    shadowBlob(ctx, cx + 8, cy + 2, 36, 15, 0.55);
    const seed = (r() * 997) | 0, pb = new PB(ctx);
    trunk(pb, cx, cy + 3, cy - 64, 6, 3.6, R.bark, seed, { roots: true, base: 3.8, sway: 1 });
    for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { const x = cx + s * i * 1.3, y = cy - 44 - i * 1.1; pb.set(x, y, rc(R.bark, s < 0 ? 5 : 3)); pb.set(x, y + 1, rc(R.bark, 2)); }
    canopy(pb, cx + (r() - 0.5) * 6, cy - 84, 84 + r() * 8, 64, R.leaf, seed, 13);
    pb.flush();
  },
  pine(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 6, cy + 2, 26, 12, 0.55);
    const seed = (r() * 997) | 0, pb = new PB(ctx);
    trunk(pb, cx, cy + 2, cy - 30, 3.6, 2.6, R.bark, seed, { base: 3.4 });
    const H = 118 + r() * 24, tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers, yb = cy - 18 - t * (H - 34), w = 31 * (1 - t * 0.78) + 3, hh = (H - 20) / tiers + 18;
      for (let y = Math.floor(yb - hh); y <= Math.ceil(yb + 6); y++) {
        const k = (yb - y) / hh;
        if (k > 1) continue;
        const half = w * Math.pow(Math.max(0, 1 - k), 0.95) + (vnoise(y, i, 2, seed) - 0.5) * 3;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
          const nx = (x + 0.5 - cx) / Math.max(1, half);
          if (Math.abs(nx) > 1) continue;
          const hem = yb + Math.sqrt(Math.max(0, 1 - nx * nx)) * 4 + (((x * 7 + i * 3) % 5 + 5) % 5 < 2 ? 1.5 : 0);
          if (y > hem) continue;
          let tt = 4.4 - nx * 2.4 + (1 - Math.max(0, k)) * 0.4 - (y > hem - 3 ? 1.4 : 0) + t * 0.8;
          tt += ((((x + y * 2 + seed) % 4) + 4) % 4 === 0 ? 1 : 0) - ((((x * 3 - y + seed) % 5) + 5) % 5 === 0 ? 1 : 0) + (vnoise(x, y, 3, seed + 2) - 0.5) * 1.2;
          pb.set(x, y, rc(R.pineleaf, Math.round(tt)));
        }
      }
    }
    pb.flush();
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
    shadowBlob(ctx, cx + 3, cy + 2, 22, 9, 0.5);
    const seed = (r() * 997) | 0, pb = new PB(ctx);
    canopy(pb, cx, cy - 12, 36, 20, R.leaf, seed, 6);
    if (r() < 0.45) for (let i = 0; i < 6; i++) { const x = Math.round(cx + (ih(i, seed, 8) - 0.5) * 26), y = Math.round(cy - 8 - ih(i, seed, 9) * 14); pb.set(x, y, [214, 52, 64]); pb.set(x + 1, y, [150, 28, 60]); pb.set(x, y - 1, [255, 150, 140]); }
    pb.flush();
  },
  rock(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 3, cy + 3, 24, 10, 0.55);
    const seed = (r() * 997) | 0, pb = new PB(ctx);
    boulder(pb, cx, cy - 8, 15 + r() * 4, 9 + r() * 2, R.stone, seed, 0.38);
    if (r() < 0.6) boulder(pb, cx + 13, cy - 2, 6, 4, R.stone, seed + 5, 0.2);
    pb.flush();
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
    shadowBlob(ctx, cx + 6, cy + 2, 22, 10, 0.55);
    const pb = new PB(ctx);
    boxPx(pb, cx, cy, 17, 8.5, 9, R.marblewall, { top: 7, left: 5.6, right: 3.4, seed: 3 });
    column(pb, cx, cy - 9, cy - 88, 10.5, R.marblewall, 4, 6, 5);
    boxPx(pb, cx, cy, 15, 7.5, 4, R.marblewall, { z: 88, top: 7.4, left: 5.6, right: 3.4, seed: 5 });
    boxPx(pb, cx, cy, 18, 9, 5, R.marblewall, { z: 92, top: 7.6, left: 6, right: 3.6, seed: 6 });
    pb.flush();
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
  crate(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 3, cy + 3, 22, 9, 0.5);
    const pb = new PB(ctx), seed = (r() * 997) | 0;
    boxPx(pb, cx, cy, 18, 9, 22, R.wood, { top: 6, left: 5.2, right: 3.2, seed, face: (face, x, y, s, hh) => {
      const a = s * 18;
      if (a < 2.2 || a > 15.8 || hh < 2.2 || hh > 19.8) return a < 1 || a > 17 || hh < 1 || hh > 21 ? -2.4 : 1.2; // 테두리 각재
      const d1 = Math.abs(hh - 2 - (a - 2) * (18 / 14)), d2 = Math.abs(hh - 20 + (a - 2) * (18 / 14));
      if (d1 < 1.3 || d2 < 1.3) return 0.9;                                                    // X 버팀대
      return (Math.floor(hh / 5) % 2 ? -0.6 : 0) + (hh % 5 < 0.9 ? -1.8 : 0);                 // 판자
    }, topFace: (u, v) => ((v * 4) % 1 < 0.14 ? -2 : 0) });
    pb.flush();
  },
  barrel(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 3, cy + 3, 18, 8, 0.5);
    const pb = new PB(ctx);
    column(pb, cx, cy - 1, cy - 28, 12, R.wood, (r() * 99) | 0, 7, 4.6, [[4, 2, R.iron], [21, 2, R.iron]]);
    pb.flush();
  },
  table(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 2, 26, 10, 0.45);
    const pb = new PB(ctx);
    for (const [dx, dy] of [[-17, 0], [17, 0], [0, 8], [0, -8]]) boxPx(pb, cx + dx, cy + dy, 1.6, 0.8, 16, R.wood, { top: 4, left: 3.4, right: 2, seed: 2 });
    boxPx(pb, cx, cy, 24, 12, 4, R.wood, { z: 16, top: 6.2, left: 4.4, right: 2.8, seed: 3, topFace: (u) => ((u * 5) % 1 < 0.08 ? -1.6 : 0) });
    pb.flush();
    ctx.fillStyle = '#e8dcc0'; ellipse(ctx, cx - 6, cy - 22, 4, 2); ctx.fill();
    ctx.fillStyle = '#a8483a'; ctx.fillRect(cx + 5, cy - 27, 4, 6); ctx.fillStyle = '#e0806a'; ctx.fillRect(cx + 5, cy - 27, 1, 5);
  },
  bookshelf(ctx, cx, cy, r) {
    shadowBlob(ctx, cx + 3, cy + 3, 26, 10, 0.5);
    const pb = new PB(ctx), seed = (r() * 997) | 0;
    const BOOK = [[176, 52, 48], [52, 84, 150], [196, 156, 60], [70, 120, 70], [120, 60, 130], [200, 120, 70]];
    boxPx(pb, cx, cy, 26, 13, 66, R.wood, { top: 5.2, left: 4.2, right: 2.6, seed, face: (face, x, y, s, hh) => {
      if (face !== 1) return 0;
      const a = s * 26;
      if (a < 2 || a > 24 || hh < 4 || hh > 63) return 0.8;
      const shelf = (hh - 4) % 15;
      if (shelf < 2) return shelf < 1 ? 1.2 : -1.5;
      const bi = Math.floor(a / 3), bh = 9 + ih(bi, Math.floor(hh / 15), seed) * 3;
      if (shelf - 2 > bh) return -3.2;                                         // 선반 안쪽 그늘
      const c = BOOK[(ih(bi, Math.floor(hh / 15), seed + 1) * BOOK.length) | 0], k = a - bi * 3 < 1 ? 1.18 : a - bi * 3 > 2.2 ? 0.62 : 0.9;
      return [Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0];
    } });
    pb.flush();
  },
  bed(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 3, 28, 12, 0.45);
    const pb = new PB(ctx);
    boxPx(pb, cx, cy, 26, 13, 12, R.wood, { top: 5, left: 4.4, right: 2.8, seed: 4 });
    boxPx(pb, cx, cy, 24, 12, 4, R.carpet, { z: 12, top: 5.4, left: 4, right: 2.6, seed: 5, topFace: (u, v) => (u < 0.32 ? 2.2 : (v * 6) % 1 < 0.1 ? -1 : 0) });
    boxPx(pb, cx - 22, cy - 2, 5, 3, 26, R.wood, { top: 6, left: 4.6, right: 3, seed: 6 });
    pb.flush();
    ctx.fillStyle = '#f2ead8'; ellipse(ctx, cx - 12, cy - 21, 7, 3.5); ctx.fill();
  },
  anvil(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 2, 20, 8, 0.5);
    const pb = new PB(ctx);
    boxPx(pb, cx, cy, 12, 6, 12, R.wood, { top: 5.6, left: 4.4, right: 2.6, seed: 7, face: (f, x, y, s, hh) => (hh % 4 < 0.8 ? -1.4 : 0) });
    boxPx(pb, cx, cy, 6, 3, 6, R.iron, { z: 12, top: 4, left: 3.4, right: 2, seed: 8 });
    boxPx(pb, cx - 2, cy, 17, 5, 5, R.iron, { z: 18, top: 6.6, left: 4.6, right: 2.6, seed: 9 });
    boxPx(pb, cx + 17, cy - 2, 5, 2.5, 3, R.iron, { z: 19, top: 6, left: 4, right: 2.4, seed: 10 });
    pb.flush();
  },
  well(ctx, cx, cy) {
    shadowBlob(ctx, cx + 3, cy + 3, 28, 12, 0.5);
    const pb = new PB(ctx);
    column(pb, cx, cy, cy - 16, 20, R.stone, 11, 9, 4.6, [[0, 1, R.moss], [14, 2, R.stone]]);
    for (let y = -8; y <= 8; y++) for (let x = -16; x <= 16; x++) { // 우물 안 물
      const k = x * x / 256 + y * y / 56; if (k > 1) continue;
      pb.set(cx + x, cy - 16 + y, k > 0.72 ? rc(R.stone, 1) : rc(R.deep_water, Math.round(1 + (y > 2 ? 1 : 0) + (x < -6 && y < 0 ? 2 : 0))));
    }
    boxPx(pb, cx - 18, cy, 1.6, 0.8, 52, R.wood, { top: 5, left: 4.6, right: 2.6, seed: 12 });
    boxPx(pb, cx + 17, cy, 1.6, 0.8, 52, R.wood, { top: 5, left: 4.6, right: 2.6, seed: 13 });
    pb.flush();
    ctx.fillStyle = '#8a3428'; ctx.beginPath(); ctx.moveTo(cx - 26, cy - 48); ctx.lineTo(cx, cy - 66); ctx.lineTo(cx + 26, cy - 48); ctx.lineTo(cx + 22, cy - 46); ctx.lineTo(cx, cy - 60); ctx.lineTo(cx - 22, cy - 46); ctx.fill();
    ctx.fillStyle = '#c4604a'; ctx.beginPath(); ctx.moveTo(cx - 26, cy - 48); ctx.lineTo(cx, cy - 66); ctx.lineTo(cx, cy - 63); ctx.lineTo(cx - 23, cy - 47); ctx.fill();
    ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 50); ctx.lineTo(cx, cy - 24); ctx.stroke();
    ctx.fillStyle = '#7a5a38'; ctx.fillRect(cx - 4, cy - 26, 8, 6); ctx.fillStyle = '#a07a50'; ctx.fillRect(cx - 4, cy - 26, 8, 1);
  },
  sign(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 2, 12, 5, 0.4);
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(cx - 2, cy - 34, 4, 34); ctx.fillStyle = '#8a6038'; ctx.fillRect(cx - 2, cy - 34, 1, 34);
    ctx.save(); ctx.translate(cx, cy - 30); ctx.transform(1, 0.5, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(-14, -8, 14, 6); g.addColorStop(0, '#b88a58'); g.addColorStop(1, '#6a4628');
    ctx.fillStyle = g; ctx.fillRect(-14, -8, 28, 14);
    ctx.strokeStyle = 'rgba(40,14,52,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(-14, -8, 28, 14);
    ctx.fillStyle = '#3a2214'; ctx.fillRect(-9, -4, 18, 1.5); ctx.fillRect(-9, 0, 12, 1.5);
    ctx.restore();
  },
  chest(ctx, cx, cy) {
    shadowBlob(ctx, cx + 2, cy + 3, 20, 8, 0.5);
    const pb = new PB(ctx);
    const strap = (face, x, y, s, hh) => { const a = s * 16; return (a > 3 && a < 5.5) || (a > 10.5 && a < 13) ? rc(R.gold, face === 1 ? 5 : 3) : hh % 5 < 0.9 ? -1.6 : 0; };
    boxPx(pb, cx, cy, 16, 8, 11, R.wood, { top: 6, left: 5, right: 3, seed: 14, face: strap });
    boxPx(pb, cx, cy, 16.5, 8.3, 6, R.wood, { z: 11, top: 6.6, left: 5.6, right: 3.4, seed: 15, face: strap, topFace: (u) => ((u > 0.2 && u < 0.33) || (u > 0.66 && u < 0.79) ? 3 : 0) });
    for (const [x, y, c] of [[-1, 0, 7], [0, 0, 6], [-1, 1, 5], [0, 1, 4], [-1, 2, 3], [0, 2, 2]]) pb.set(cx - 7 + x, cy - 4 + y, rc(R.gold, c));
    pb.flush();
  },
  altar(ctx, cx, cy) {
    shadowBlob(ctx, cx, cy + 3, 30, 12, 0.5);
    const pb = new PB(ctx);
    boxPx(pb, cx, cy, 28, 14, 6, R.mist, { top: 5.4, left: 4.2, right: 2.6, seed: 16 });
    boxPx(pb, cx, cy, 22, 11, 18, R.mist, { z: 6, top: 6.4, left: 5, right: 3, seed: 17, face: (f, x, y, s, hh) => (hh % 6 < 0.9 ? -1.6 : (s * 22) % 11 < 0.9 ? -1.2 : 0), topFace: (u, v) => { const d = Math.abs(u - 0.5) + Math.abs(v - 0.5); return (d > 0.3 && d < 0.36) || d < 0.08 ? 3 : 0; } });
    pb.flush();
    ctx.fillStyle = 'rgba(214,196,255,0.85)';
    for (let i = 0; i < 3; i++) { ctx.fillRect(cx - 18 + i * 6, cy - 13 + i * 3, 2, 4); ctx.fillRect(cx + 6 + i * 6, cy - 7 - i * 3, 2, 4); }
  },
  shrine(ctx, cx, cy) {
    shadowBlob(ctx, cx + 3, cy + 3, 28, 12, 0.5);
    const pb = new PB(ctx);
    boxPx(pb, cx, cy, 24, 12, 10, R.stone, { top: 6.4, left: 5, right: 3, seed: 18, topFace: capSlabs(18) });
    boxPx(pb, cx, cy, 12, 6, 56, R.stone, { z: 10, top: 6.6, left: 5.4, right: 3.2, seed: 19, face: bricks(8, 12, -2.6) });
    // 지붕 (아이소 피라미드)
    for (let y = cy - 92; y < cy - 56; y++) for (let x = cx - 22; x <= cx + 22; x++) {
      const fx = x + 0.5 - cx, k = (y - (cy - 90)) / 26;
      if (k < 0 || Math.abs(fx) > 21 * k + 0.5 || y > cy - 66 + 10 - Math.abs(fx) * 0.5) continue;
      const left = fx < 0, eave = y > cy - 66 - Math.abs(fx) * 0.5 + 6;
      const t = (left ? 5.2 : 3) + ((y + Math.floor(Math.abs(fx) * 0.5)) % 3 === 0 ? -1.2 : 0) + (eave ? -1 : 0) + (Math.abs(fx) < 1 ? 1.4 : 0);
      pb.set(x, y, rc(R.bark, Math.round(t)));
    }
    pb.flush();
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
const isWall = (o) => !!o && (WALLS[o] !== undefined);
function nbMask(world, gx, gy, id) {
  if (!world || (id !== 'fence' && !WALLS[id])) return 0;
  let m = 0;
  [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dy], i) => { const o = world.objAt(gx + dx, gy + dy); if (id === 'fence' ? o === id : isWall(o)) m |= 1 << i; });
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
  const up = objectTop(id), W = id === 'tree' ? 160 : 120, H = up + 40;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const ax = W / 2, ay = up;
  const r = seeded(variant * 977 + id.length * 31 + 1);
  const nb = (oid, dx, dy) => !!(mask & (1 << [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([a, b]) => a === dx && b === dy))) && (oid === id || (oid === 'wall' && !!WALLS[id]));
  (OBJ[id] || OBJ.rock)(ctx, ax, ay, r, gx, gy, nb);
  // 도트화: 벽은 이어 붙으므로 외곽선 없음, 영혼 장벽은 반투명 유지
  const wall = !!WALLS[id] || id === 'wall_spirit';
  pixelize(c, { tone: !PX_OBJ.has(id), outline: !wall && !FLAT_PIX.has(id), keepAlpha: id === 'wall_spirit' || id === 'portal_glow' || id === 'cobweb', shadow: true, alphaCut: id === 'wall_spirit' ? 20 : FLAT_PIX.has(id) ? 60 : 110, midAlpha: id === 'wall_spirit' ? 110 : 150 });
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

// 도트 불꽃: 4색 계단 기둥(진홍→주황→노랑→흰 코어), 4프레임 순환 (발광 그라데이션 없음)
const FLAME_COL = ['#b8281a', '#ff7a1c', '#ffc844', '#fff6d0'];
export function flame(ctx, x, y, s, t) {
  x = Math.round(x); y = Math.round(y);
  const fr = Math.floor(t * 8) & 3;
  const sway = [0, 1, 0, -1][fr];
  for (let i = 0; i < 4; i++) {
    const w = Math.max(1, Math.round((4.2 - i * 1.05) * s));
    const h = Math.max(2, Math.round((10 + [0, 2, 1, 3][(fr + i) & 3] - i * 2.4) * s));
    ctx.fillStyle = FLAME_COL[i];
    for (let yy = 0; yy < h; yy++) {
      const k = yy / h, ww = Math.max(1, Math.round(w * (1 - k * k)));
      ctx.fillRect(x - ww + Math.round(sway * k * (i + 1) * 0.6), y - yy - (i === 3 ? 1 : 0), ww * 2 - (i >= 2 ? 1 : 0), 1);
    }
  }
  if ((fr & 1) && s >= 0.8) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x + sway * 2, y - Math.round(14 * s), 1, 1); ctx.fillStyle = '#ff9a40'; ctx.fillRect(x - sway * 2 - 1, y - Math.round(17 * s), 1, 1); }
}
