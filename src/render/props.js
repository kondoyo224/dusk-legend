// 소품 오브젝트 픽셀 직접 묘사 (ART_STYLE ★v2, objpx 방식): 석상·묘비·울타리·횃불·화로·가로등·수정·고목·계단·
// 꽃·버섯·뼈·거미줄·잔해·포탈·제단 장식·표지판. 램프 인덱스로 찍고 빛은 좌상단. tiles.js 의 OBJ 를 덮어쓴다. 소유: 워커 A.
import { PB, boxPx, boulder, column, R, rc, ih, vnoise } from './objpx.js';
import { rampOf, Sheet } from './spx.js';
import { drawRig, poseOf, humanStyle } from './rig.js';
import { makeCanvas } from './util.js';

const HW = 32, HH = 16;
const isoPt = (cx, cy, u, v) => [cx + (u - v) * HW, cy + (u + v) * HH];

// ── 픽셀 도구 ──
// 다각형 스캔라인 채우기: fn(x,y) → [r,g,b] | null
function fillPoly(pb, pts, fn) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { const c = fn(x, y); if (c) pb.set(x, y, c); }
  }
}
// 굵기가 변하는 원통 가지/막대: 단면 명암(왼쪽 위 밝음) + 결
function seg(pb, x0, y0, x1, y1, w0, w1, ramp, base = 4, seed = 1, k = 1.9) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L * 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t, w = Math.max(0.5, w0 + (w1 - w0) * t);
    const R2 = Math.ceil(w);
    for (let oy = -R2; oy <= R2; oy++) for (let ox = -R2; ox <= R2; ox++) {
      const dx = Math.round(cx) + ox + 0.5 - cx, dy = Math.round(cy) + oy + 0.5 - cy;
      if (dx * dx + dy * dy > w * w + 0.2) continue;
      const lam = -(dx * 0.78 + dy * 0.62) / Math.max(0.8, w);
      const tt = base + lam * k + (vnoise((cx + ox) * 2.5, (cy + oy) * 0.6, 3, seed) - 0.5) * 1.6 - (dx * dx + dy * dy > (w - 0.8) * (w - 0.8) && lam < 0 ? 0.8 : 0);
      pb.set(Math.round(cx) + ox, Math.round(cy) + oy, rc(ramp, Math.round(tt)));
    }
  }
}
// 반쯤 투명한 1px 선
function line1(pb, x0, y0, x1, y1, col, a = 255) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) pb.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col, a);
}
// 접지 그림자 (남색 반투명 타원 2단)
function shadowPx(pb, cx, cy, rx, ry, a = 90) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (q > 1 || pb.alpha(x, y)) continue;
    pb.set(x, y, [22, 18, 54], q > 0.62 ? Math.round(a * 0.55) : a);
  }
}
// 이끼 덩어리
function mossDab(pb, cx, cy, r, seed) {
  for (let y = -r; y <= r; y++) for (let x = -r * 1.5; x <= r * 1.5; x++) {
    if ((x / 1.5) ** 2 + y * y > r * r || !pb.alpha(cx + x, cy + y)) continue;
    if (vnoise(cx + x, cy + y, 2.5, seed) < 0.42) continue;
    pb.set(cx + x, cy + y, rc(R.moss, Math.round(2.5 - y * 0.6 - x * 0.2 + (ih(x, y, seed) - 0.5))));
  }
}
const RAMP = {};
const ramp = (hex) => (RAMP[hex] ||= rampOf(hex));

// 정면 판석(묘비): 아치형 앞면 + 오른쪽 두께면 + 윗변 하이라이트
function slab(pb, x0, yb, w, h, depth, rp, arch, seed, face) {
  const top = (x) => { if (!arch) return yb - h; const r = w / 2, dx = x + 0.5 - (x0 + r); return yb - h + r - Math.sqrt(Math.max(0, r * r - dx * dx)); };
  // 두께면 (오른쪽 뒤로)
  for (let x = Math.round(x0 + w); x < x0 + w + depth; x++) for (let y = Math.round(top(x0 + w - 1) - (x - x0 - w) * 0.5); y < yb - (x - x0 - w) * 0.5; y++) pb.set(x, y, rc(rp, 2 + (vnoise(x, y, 3, seed) > 0.6 ? 1 : 0)));
  // 윗면 띠
  for (let x = Math.round(x0); x < x0 + w + depth; x++) { const yt = Math.round(top(Math.min(x, x0 + w - 1)) - Math.max(0, x - x0 - w) * 0.5); pb.set(x, yt - 1, rc(rp, 7)); }
  for (let x = Math.round(x0); x < x0 + w; x++) for (let y = Math.round(top(x)); y < yb; y++) {
    const u = (x + 0.5 - x0) / w, v = (yb - y) / h;
    let t = 5.2 - u * 1.4 + (vnoise(x, y, 3, seed) - 0.5) * 1.2 + (u < 0.1 ? 1 : 0);
    if (Math.abs(vnoise(x, y, 6, seed + 3) - 0.5) < 0.025) t -= 2;
    if (face) { const f = face(u, v, x, y); if (f != null) t += f; }
    pb.set(x, y, rc(rp, Math.round(t)));
  }
}

export const PROPS = {
  fence(ctx, cx, cy, r, gx, gy, nb) {
    const pb = new PB(ctx);
    const back = [], front = [];
    if (nb?.('fence', -1, 0)) back.push([-1, 0]);
    if (nb?.('fence', 0, -1)) back.push([0, -1]);
    if (nb?.('fence', 1, 0)) front.push([1, 0]);
    if (nb?.('fence', 0, 1)) front.push([0, 1]);
    if (!back.length && !front.length) { front.push([1, 0]); back.push([-1, 0]); }
    const rail = (dx, dy) => {
      const ex = cx + (dx - dy) * HW * 0.5, ey = cy + (dx + dy) * HH * 0.5;
      for (const hy of [9, 18]) {
        const n = Math.abs(ex - cx);
        for (let i = 0; i <= n; i++) {
          const x = Math.round(cx + (ex - cx) * i / n), y = Math.round(cy - hy + (ey - cy) * i / n);
          const g = (vnoise(x * 0.4, y, 3, 7) - 0.5) * 1.4;
          pb.set(x, y - 1, rc(R.wood, Math.round(6 + g))); pb.set(x, y, rc(R.wood, Math.round(4.6 + g))); pb.set(x, y + 1, rc(R.wood, Math.round(2.8 + g)));
          if (ih(x, hy, 3) > 0.93) pb.set(x, y, rc(R.wood, 2));
        }
      }
    };
    shadowPx(pb, cx + 2, cy + 1, 6, 3);
    back.forEach(([a, b]) => rail(a, b));
    boxPx(pb, cx, cy, 2.6, 1.3, 23, R.wood, { top: 6.4, left: 5, right: 2.8, seed: 31, noise: 1.2 });
    pb.set(cx - 1, cy - 25, rc(R.wood, 6)); pb.set(cx, cy - 25, rc(R.wood, 4)); // 뾰족 머리
    pb.set(cx, cy - 18, rc(R.iron, 6)); pb.set(cx, cy - 9, rc(R.iron, 5)); // 못
    front.forEach(([a, b]) => rail(a, b));
    pb.flush();
  },
  torch(ctx, cx, cy) {
    const pb = new PB(ctx);
    shadowPx(pb, cx + 2, cy + 1, 7, 3);
    boxPx(pb, cx, cy, 5, 2.5, 4, R.stone, { top: 6.5, left: 5, right: 3, seed: 41 });
    column(pb, cx, cy - 4, cy - 38, 1.7, R.iron, 42, 0, 3.6);
    // 감긴 가죽 손잡이
    for (let y = cy - 30; y < cy - 22; y++) for (let x = cx - 2; x <= cx + 1; x++) pb.set(x, y, rc(R.wood, Math.round(4 - (x - cx) * 1.2 + ((y & 1) ? 0.8 : -0.6))));
    // 쇠 받침 컵
    for (let y = -4; y <= 0; y++) { const w = 3 + Math.round((y + 4) * -0.25 + 1.2); for (let x = -w; x <= w; x++) pb.set(cx + x, cy - 41 + y, rc(R.iron, Math.round(5 - x * 0.6 + (y === -4 ? 2 : 0)))); }
    // 기름 먹인 천
    for (let y = -6; y <= -4; y++) for (let x = -2; x <= 2; x++) pb.set(cx + x, cy - 41 + y, rc(R.wood, Math.round(2.5 - x * 0.4 + (ih(x, y, 4) - 0.5))));
    pb.flush();
  },
  brazier(ctx, cx, cy) {
    const pb = new PB(ctx);
    shadowPx(pb, cx + 2, cy + 2, 16, 6);
    for (const dx of [-9, 9, -2]) seg(pb, cx + dx * 0.55, cy - 16, cx + dx, cy + (dx === -2 ? 3 : 0), 1.2, 1, R.iron, 3.6, 5);
    // 사발
    const ry = 6, rx = 15, by = cy - 20;
    for (let y = by - ry; y <= by + 8; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      if (Math.abs(dx) > 1) continue;
      const rim = by + Math.sqrt(1 - dx * dx) * ry * 0.0, bot = by + Math.sqrt(1 - dx * dx) * 8;
      const inTop = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - by) / ry) ** 2 <= 1;
      if (inTop) {
        const q = ((x + 0.5 - cx) / (rx - 2)) ** 2 + ((y + 0.5 - by) / (ry - 1.5)) ** 2;
        if (q > 1) { pb.set(x, y, rc(R.iron, Math.round(y < by ? 6.5 - dx : 4 - dx))); continue; }
        const e = vnoise(x, y, 2.2, 9); // 숯 + 불씨
        pb.set(x, y, e > 0.62 ? rc(R.lava, Math.round(6 + (e - 0.62) * 9)) : rc(R.ash, Math.round(1 + e * 3)));
        continue;
      }
      if (y < rim || y > bot) continue;
      const lam = -dx * 0.8 + 0.3;
      pb.set(x, y, rc(R.iron, Math.round(3.4 + lam * 2.2 - (y - by) * 0.12 + (Math.abs(y - by - 3) < 0.6 ? 1.2 : 0))));
    }
    pb.flush();
  },
  lamp_post(ctx, cx, cy) {
    const pb = new PB(ctx);
    shadowPx(pb, cx + 2, cy + 1, 8, 3.5);
    boxPx(pb, cx, cy, 5, 2.5, 5, R.iron, { top: 5.4, left: 4, right: 2.2, seed: 51 });
    column(pb, cx, cy - 5, cy - 60, 1.9, R.iron, 52, 0, 3.4, [[8, 2, R.iron], [44, 2, R.gold]]);
    // 팔 받침
    for (let i = 0; i < 6; i++) { pb.set(cx - 3 + i, cy - 60 - Math.round(Math.sin(i / 5 * Math.PI) * 2), rc(R.iron, 5)); }
    // 등롱: 쇠 틀 + 따뜻한 유리
    for (let y = cy - 72; y <= cy - 61; y++) for (let x = cx - 6; x <= cx + 6; x++) {
      const fx = x - cx, fy = y - (cy - 72);
      const frame = Math.abs(fx) >= 5 || fy === 0 || fy === 11 || fx === 0;
      if (frame) pb.set(x, y, rc(R.iron, fx < 0 ? 5 : 2.6 + (fy === 0 ? 2 : 0)));
      else pb.set(x, y, rc(R.gold, Math.round(7 - Math.abs(fx) * 0.5 - fy * 0.15 + (fx < 0 ? 0.3 : -0.6))));
    }
    // 지붕
    for (let k = 0; k < 7; k++) for (let x = -7 + k; x <= 7 - k; x++) pb.set(cx + x, cy - 73 - k, rc(R.iron, Math.round(x < 0 ? 5.6 - k * 0.1 : 2.8)));
    pb.set(cx, cy - 81, rc(R.gold, 6)); pb.set(cx, cy - 80, rc(R.gold, 4));
    pb.flush();
  },
  crystal(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    shadowPx(pb, cx + 2, cy + 1, 17, 6);
    boulder(pb, cx - 2, cy - 2, 13, 5, R.stone, 61, 0.2);
    const shards = [[-9, 30, 4.6, -0.12], [9, 36, 4.8, 0.14], [0, 52, 6.6, -0.03], [-4, 20, 3.8, -0.3], [6, 19, 3.6, 0.32]];
    for (const [dx, h, w, lean] of shards) {
      const x0 = cx + dx + Math.round((r() - 0.5) * 3), yb = cy - 2, tipX = x0 + lean * h, tipY = yb - h;
      for (let y = Math.floor(tipY); y <= yb; y++) {
        const k = (yb - y) / h, mx = x0 + (tipX - x0) * k;
        const ww = k > 0.78 ? w * (1 - k) / 0.22 : w;
        for (let x = Math.round(mx - ww); x <= Math.round(mx + ww); x++) {
          const u = (x + 0.5 - mx) / Math.max(0.6, ww);
          let t = u < -0.25 ? 5.6 : u < 0.2 ? 6.8 : 3.2;
          if (k > 0.78) t += u < 0 ? 1 : -0.4;
          if (Math.abs(u + 0.25) < 0.12 || Math.abs(u - 0.2) < 0.12) t += 0.8;
          if (vnoise(x, y * 0.4, 3, dx + 9) > 0.72 && u > -0.25) t += 1.2; // 내부 굴절
          t -= (1 - k) * 1.2;
          pb.set(x, y, rc(R.crystal, Math.round(t)));
        }
      }
      pb.set(Math.round(tipX), Math.round(tipY), rc(R.crystal, 7));
    }
    pb.flush();
  },
  statue(ctx, cx, cy) {
    const pb = new PB(ctx);
    shadowPx(pb, cx + 4, cy + 2, 22, 9);
    boxPx(pb, cx, cy, 20, 10, 6, R.stone, { top: 6.6, left: 5, right: 3, seed: 71 });
    boxPx(pb, cx, cy, 16, 8, 12, R.stone, { z: 6, top: 7, left: 5.4, right: 3.2, seed: 72, face: (f, x, y, s, hh) => (hh < 1.5 || hh > 10.5 ? 1 : 0) });
    pb.flush();
    // 로브 입은 검사 석상: 인간형 리그를 대리석 한 재질로 굽는다
    const c2 = makeCanvas(ctx.canvas.width, ctx.canvas.height), g = c2.getContext('2d');
    g.translate(cx, cy - 18); g.scale(1.12, 1.12);
    const S = new Sheet(g, { mono: { ramp: R.stone, style: 'bone', k: 3.8, base: 5.6, vary: 2.6 } });
    drawRig(S, 0, 0, 3, poseOf('idle', 0.75), humanStyle({ body: 'human', gender: 'm', hair: 4, hairColor: '#888', robe: '#9a9a9a', beard: true, weapon: 'sword_knight', shield: 'shield_iron' }));
    g.setTransform(1, 0, 0, 1, 0, 0);
    S.bake({ outline: false });
    ctx.drawImage(c2, 0, 0);
    const pb2 = new PB(ctx);
    mossDab(pb2, cx - 12, cy - 8, 3, 73); mossDab(pb2, cx + 6, cy - 2, 2, 74);
    pb2.flush();
  },
  gravestone(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    const kind = (r() * 3) | 0, seed = (r() * 99) | 0;
    shadowPx(pb, cx + 4, cy + 2, 15, 6);
    // 흙무덤 (봉긋한 흙 + 풀 몇 가닥)
    for (let y = -5; y <= 5; y++) for (let x = -14; x <= 14; x++) {
      const q = (x / 14) ** 2 + (y / 5) ** 2; if (q > 1) continue;
      const lam = -(x / 14) * 0.6 - (y / 5) * 0.6 + Math.sqrt(1 - q) * 0.5;
      pb.set(cx + 4 + x, cy + 4 + y, rc(R.dirt, Math.round(3.2 + lam * 2.2 + (vnoise(x, y, 2, seed) - 0.5) * 1.4)));
    }
    for (let i = 0; i < 6; i++) { const x = cx - 8 + Math.round(ih(i, seed, 1) * 24), y = cy + 1 + Math.round(ih(i, seed, 2) * 6); pb.set(x, y, rc(R.grass, 6)); pb.set(x, y + 1, rc(R.grass, 4)); pb.set(x + 1, y + 1, rc(R.grass, 3)); }
    const rp = (r() < 0.5 ? R.stone : R.cobble);
    if (kind === 0) {
      boxPx(pb, cx - 2, cy, 11, 5.5, 4, rp, { top: 6.4, left: 4.8, right: 2.8, seed });
      slab(pb, cx - 10, cy - 3, 15, 22, 3, rp, true, seed, (u, v, x, y) => {
        const ux = Math.round(u * 15), vy = Math.round((1 - v) * 22);
        if ((ux === 7 && vy >= 5 && vy <= 13) || (vy === 8 && ux >= 4 && ux <= 10)) return -2.6; // 십자 홈
        if ((ux === 8 && vy >= 5 && vy <= 13) || (vy === 9 && ux >= 4 && ux <= 10)) return 1.2;  // 홈 아래 빛
        if (vy >= 16 && vy <= 17 && ux >= 3 && ux <= 11 && (ux & 1)) return -1.6;           // 글귀
        return null;
      });
    } else if (kind === 1) {
      boxPx(pb, cx - 2, cy, 8, 4, 4, rp, { top: 6.4, left: 4.8, right: 2.8, seed });
      slab(pb, cx - 5, cy - 3, 5, 28, 2, rp, false, seed);
      slab(pb, cx - 11, cy - 19, 17, 5, 2, rp, false, seed + 1);
    } else {
      boxPx(pb, cx - 2, cy, 10, 5, 14, rp, { top: 6.6, left: 5, right: 3, seed, topFace: (u, v) => (Math.abs(u - 0.5) < 0.06 || Math.abs(v - 0.5) < 0.06 ? -1.6 : 0), face: (f, x, y, s, hh) => (f === 1 && hh > 4 && hh < 10 && s > 0.25 && s < 0.75 && ((x + y) & 1) && hh % 3 < 1 ? -1.8 : 0) });
    }
    mossDab(pb, cx - 8, cy - 3, 2, seed + 5);
    pb.flush();
  },
  dead_tree(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    shadowPx(pb, cx + 5, cy + 2, 18, 7);
    const seed = (r() * 99) | 0;
    const tw = [];
    const branch = (x, y, a, len, w, d) => {
      const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
      const bend = (r() - 0.5) * 7, mx = (x + x2) / 2 + bend, my = (y + y2) / 2;
      seg(pb, x, y, mx, my, w, w * 0.82, R.deadbark, 4.2, seed + d);
      seg(pb, mx, my, x2, y2, w * 0.82, w * 0.62, R.deadbark, 4.2, seed + d + 3);
      if (d > 0) { branch(x2, y2, a - 0.35 - r() * 0.5, len * 0.66, w * 0.6, d - 1); branch(x2, y2, a + 0.3 + r() * 0.5, len * 0.6, w * 0.58, d - 1); }
      else tw.push([x2, y2, a]);
    };
    // 뿌리
    for (const [dx, k] of [[-12, -1], [11, 1], [-5, -0.4], [6, 0.5]]) seg(pb, cx + dx * 0.3, cy - 3, cx + dx, cy + 1 + Math.abs(k), 3, 1, R.deadbark, 3.6, seed + 30);
    branch(cx, cy + 1, (r() - 0.5) * 0.3, 40, 5, 3);
    // 잔가지 (1px)
    for (const [x, y, a] of tw) { const L = 4 + r() * 4; line1(pb, x, y, x + Math.sin(a + 0.5) * L, y - Math.cos(a + 0.5) * L, rc(R.deadbark, 3)); line1(pb, x, y, x + Math.sin(a - 0.6) * L * 0.8, y - Math.cos(a - 0.6) * L * 0.8, rc(R.deadbark, 4)); }
    // 옹이 구멍
    pb.set(cx - 1, cy - 20, rc(R.deadbark, 0)); pb.set(cx, cy - 20, rc(R.deadbark, 0)); pb.set(cx - 1, cy - 19, rc(R.deadbark, 1)); pb.set(cx - 1, cy - 21, rc(R.deadbark, 6));
    pb.flush();
  },
  stairs_down(ctx, cx, cy) {
    const pb = new PB(ctx);
    const k0 = 0.86;
    for (let y = Math.floor(cy - HH); y <= cy + HH; y++) for (let x = cx - HW; x <= cx + HW; x++) {
      const A = (x + 0.5 - cx) / HW, B = (y + 0.5 - cy) / HH, u = (A + B) / 2, v = (B - A) / 2; // -0.5..0.5
      const m = Math.max(Math.abs(u), Math.abs(v));
      if (m > 0.5) continue;
      if (m > 0.5 * k0) { // 테두리 돌
        const lit = u < 0 || v < 0;
        pb.set(x, y, rc(R.stone, Math.round((lit ? 6.5 : 4) + (ih(Math.floor((u + v) * 6), Math.floor((u - v) * 6), 3) - 0.5) * 1.4 + (m > 0.49 ? -1.2 : 0))));
        continue;
      }
      // 안쪽: u 방향으로 내려가는 계단 (멀수록 어두움)
      const su = (u + 0.43) / 0.86, step = Math.floor(su * 5), f = su * 5 - step;
      const depth = step / 5;
      let t = (f < 0.32 ? 5.4 : 3.2) - depth * 4.2 + (f < 0.1 ? 1 : 0);
      if (v > 0.32) t -= 1.6;                 // 오른쪽 벽 그늘
      if (v < -0.32) t -= 0.6;
      pb.set(x, y, depth > 0.75 ? rc(R.deep_water, Math.max(0, Math.round(1 - (depth - 0.75) * 4))) : rc(R.stone, Math.round(t)));
    }
    pb.flush();
  },
  stairs_up(ctx, cx, cy) {
    const pb = new PB(ctx);
    for (let i = 0; i < 5; i++) {
      const s = 1 - i * 0.15;
      boxPx(pb, cx + i * 3, cy - i * 1.5, HW * 0.8 * s, HH * 0.8 * s, 5, R.stone, { z: i * 5, top: 6.8 - i * 0.1, left: 4.6, right: 2.8, seed: 81 + i, topFace: (u, v) => (u < 0.08 || v < 0.08 ? 1.2 : 0) });
    }
    pb.flush();
  },
  portal_glow(ctx, cx, cy) {
    const pb = new PB(ctx);
    // 돌 원판 위 룬 고리
    for (let y = Math.floor(cy - HH); y <= cy + HH; y++) for (let x = cx - HW; x <= cx + HW; x++) {
      const dx = (x + 0.5 - cx) / (HW * 0.8), dy = (y + 0.5 - cy) / (HH * 0.8), q = dx * dx + dy * dy;
      if (q > 1) continue;
      const ang = Math.atan2(dy, dx), ring = q > 0.62 && q < 0.86;
      if (ring) { const rune = Math.floor((ang + Math.PI) / (Math.PI * 2) * 16); pb.set(x, y, (rune & 1) && Math.abs(q - 0.74) < 0.06 ? rc(R.spirit, 7) : rc(R.mist, Math.round(5 - dx * 1.2 - dy))); continue; }
      if (q > 0.86) { pb.set(x, y, rc(R.mist, Math.round(3.6 - dx - dy)), 200); continue; }
      pb.set(x, y, rc(R.spirit, Math.round(2 + (1 - q) * 3)), 120);
    }
    pb.flush();
  },
  flowers(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    const cols = ['#d84860', '#ecc84a', '#9a86ec', '#f2eef8', '#ec8a3a'];
    const main = cols[(r() * cols.length) | 0];
    for (let i = 0; i < 9; i++) {
      const [x0, y0] = isoPt(cx, cy, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8), x = Math.round(x0), y = Math.round(y0);
      const rp = ramp(r() < 0.7 ? main : cols[(r() * cols.length) | 0]), h = 3 + ((r() * 3) | 0);
      for (let k = 0; k < h; k++) pb.set(x, y - k, rc(R.leaf, 4 + (k & 1)));
      pb.set(x - 1, y - 1, rc(R.leaf, 6)); pb.set(x + 1, y - 2, rc(R.leaf, 3));
      const fy = y - h - 1;
      pb.set(x - 1, fy, rc(rp, rp.mid + 1.5)); pb.set(x + 1, fy, rc(rp, rp.mid - 1)); pb.set(x, fy - 1, rc(rp, rp.mid + 2)); pb.set(x, fy + 1, rc(rp, rp.mid - 1.5));
      pb.set(x, fy, rc(R.gold, 6));
    }
    pb.flush();
  },
  mushroom(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = isoPt(cx, cy, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7), x = Math.round(x0), y = Math.round(y0);
      const s = 2 + Math.round(r() * 2.5), red = r() < 0.5, rp = ramp(red ? '#b83a3a' : '#9a7a52');
      const sh = Math.round(s * 1.3);
      for (let k = 0; k < sh; k++) { pb.set(x - 1, y - k, rc(R.bonewhite, 5)); pb.set(x, y - k, rc(R.bonewhite, 3)); }
      for (let yy = -s; yy <= 0; yy++) for (let xx = -s - 1; xx <= s + 1; xx++) {
        if ((xx / (s + 1)) ** 2 + (yy / s) ** 2 > 1) continue;
        const lam = -(xx / (s + 1)) * 0.7 - (yy / s) * 0.6;
        pb.set(x + xx, y - sh + yy, rc(rp, Math.round(rp.mid + lam * 2.4 + (yy === 0 ? -1.4 : 0))));
      }
      if (red) { pb.set(x - 1, y - sh - s + 1, [244, 236, 220]); pb.set(x + 1, y - sh - 1, [230, 222, 206]); }
      else pb.set(x - 1, y - sh - s + 1, rc(rp, 8));
    }
    pb.flush();
  },
  bones(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    for (let i = 0; i < 4; i++) {
      const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7), a = r() * Math.PI, L = 4 + r() * 3;
      const x0 = x - Math.cos(a) * L, y0 = y - Math.sin(a) * L * 0.5, x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L * 0.5;
      shadowPx(pb, x + 1, y + 1.5, L, 1.6, 70);
      const n = Math.ceil(L * 2);
      for (let k = 0; k <= n; k++) { const xx = Math.round(x0 + (x1 - x0) * k / n), yy = Math.round(y0 + (y1 - y0) * k / n); pb.set(xx, yy, rc(R.bonewhite, 5)); pb.set(xx, yy + 1, rc(R.bonewhite, 2)); }
      for (const [ex, ey] of [[x0, y0], [x1, y1]]) { pb.set(Math.round(ex), Math.round(ey) - 1, rc(R.bonewhite, 6)); pb.set(Math.round(ex) + 1, Math.round(ey) - 1, rc(R.bonewhite, 5)); pb.set(Math.round(ex) - 1, Math.round(ey) + 1, rc(R.bonewhite, 3)); }
    }
    if (r() < 0.6) {
      const [x0, y0] = isoPt(cx, cy, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4), x = Math.round(x0), y = Math.round(y0);
      shadowPx(pb, x + 1, y + 1, 5, 2, 80);
      for (let yy = -5; yy <= 1; yy++) for (let xx = -3; xx <= 3; xx++) {
        if ((xx / 3.4) ** 2 + ((yy + 2) / 3.6) ** 2 > 1) continue;
        pb.set(x + xx, y + yy, rc(R.bonewhite, Math.round(4.6 - xx * 0.5 - (yy + 2) * 0.5)));
      }
      for (const ex of [-2, 1]) { pb.set(x + ex, y - 2, [36, 24, 30]); pb.set(x + ex + 1, y - 2, [36, 24, 30]); pb.set(x + ex, y - 1, [60, 44, 50]); }
      pb.set(x, y, [60, 44, 50]); pb.set(x - 1, y + 1, rc(R.bonewhite, 2)); pb.set(x + 1, y + 1, rc(R.bonewhite, 2));
    }
    pb.flush();
  },
  cobweb(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    const ox = cx + Math.round((r() - 0.5) * 10), oy = cy - 4;
    const C = [226, 228, 238];
    const spokes = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + r() * 0.3; spokes.push(a); line1(pb, ox, oy, ox + Math.cos(a) * 18, oy + Math.sin(a) * 9, C, 140); }
    for (let k = 1; k <= 3; k++) for (let i = 0; i < 7; i++) {
      const a0 = spokes[i], a1 = spokes[(i + 1) % 7] + (i === 6 ? Math.PI * 2 : 0), R1 = k * 5.5;
      line1(pb, ox + Math.cos(a0) * R1, oy + Math.sin(a0) * R1 * 0.5, ox + Math.cos(a1) * R1 * 0.92, oy + Math.sin(a1) * R1 * 0.46 + 0.5, C, 118);
    }
    pb.set(ox, oy, [255, 255, 255], 200);
    pb.flush();
  },
  rubble(ctx, cx, cy, r) {
    const pb = new PB(ctx);
    for (let i = 0; i < 7; i++) {
      const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8), s = 2 + r() * 4;
      shadowPx(pb, x + 1.5, y + 1, s + 1, s * 0.5 + 0.8, 70);
      if (r() < 0.5) boulder(pb, x, y - s * 0.4, s, s * 0.6, R.stone, i * 7 + 3, 0.15);
      else boxPx(pb, x, y, s, s * 0.5, 1 + r() * 4, R.stone, { top: 6.4, left: 4.6, right: 2.6, seed: i * 5 });
    }
    for (let i = 0; i < 10; i++) { const [x, y] = isoPt(cx, cy, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9); pb.set(Math.round(x), Math.round(y), rc(R.stone, 5)); pb.set(Math.round(x) + 1, Math.round(y), rc(R.stone, 3)); }
    pb.flush();
  },
  sign(ctx, cx, cy) {
    const pb = new PB(ctx);
    shadowPx(pb, cx + 2, cy + 1, 9, 3.5);
    boxPx(pb, cx, cy, 2, 1, 34, R.wood, { top: 6, left: 4.8, right: 2.6, seed: 91, noise: 1.3 });
    // 판: 아이소 평면(오른쪽 아래로 기운 평행사변형) 판자 3장 + 새긴 글줄 + 못
    const x0 = cx - 14, y0 = cy - 38;
    for (let x = 0; x < 28; x++) for (let y = 0; y < 15; y++) {
      const X = x0 + x, Y = y0 + y + Math.round(x * 0.5);
      let t = 5 + (vnoise(X * 0.5, y, 3, 92) - 0.5) * 1.8;
      if (y % 5 === 0) t -= 1.8; else if (y % 5 === 1) t += 1;
      if (x === 0 || y === 0) t += 1.2; if (x === 27 || y === 14) t -= 1.6;
      if (((y === 3 || y === 8) && x > 4 && x < 23) || (y === 12 && x > 4 && x < 15)) t -= (x & 3) === 3 ? 0 : 2.4;
      pb.set(X, Y, rc(R.wood, Math.round(t)));
    }
    for (const [x, y] of [[2, 2], [25, 2], [2, 12], [25, 12]]) pb.set(x0 + x, y0 + y + Math.round(x * 0.5), rc(R.iron, 7));
    // 판 두께 (아래쪽)
    for (let x = 0; x < 28; x++) pb.set(x0 + x, y0 + 15 + Math.round(x * 0.5), rc(R.wood, 1));
    pb.flush();
  },
};

// 제단 위 장식: 촛대 2개 + 앞면 빛나는 룬 (tiles.js 의 altar 뒤에 호출)
export function altarDeco(ctx, cx, cy) {
  const pb = new PB(ctx);
  for (const [dx, dy] of [[-12, -1], [12, -1]]) {
    const x = cx + dx, y = cy - 24 + dy;
    for (let k = 0; k < 6; k++) { pb.set(x, y - k, rc(R.bonewhite, 5)); pb.set(x + 1, y - k, rc(R.bonewhite, 3)); }
    pb.set(x - 1, y, rc(R.gold, 5)); pb.set(x + 2, y, rc(R.gold, 3)); pb.set(x, y + 1, rc(R.gold, 4)); pb.set(x + 1, y + 1, rc(R.gold, 2));
    pb.set(x, y - 6, rc(R.bonewhite, 6)); pb.set(x, y - 7, [60, 40, 30]);
  }
  // 앞면 룬 (왼면/오른면)
  for (let i = 0; i < 3; i++) {
    const lx = cx - 17 + i * 6, ly = cy - 13 + i * 3;
    for (const [a, b] of [[0, 0], [0, 1], [0, 2], [1, 1], [0, 3]]) pb.set(lx + a, ly + b + (i & 1 ? 0 : 0), rc(R.spirit, 6));
    const rx = cx + 7 + i * 6, ry = cy - 7 - i * 3;
    for (const [a, b] of [[0, 0], [1, 0], [1, 1], [1, 2], [0, 3]]) pb.set(rx + a, ry + b, rc(R.spirit, 5));
  }
  pb.flush();
}
