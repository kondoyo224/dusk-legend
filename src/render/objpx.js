// 오브젝트 픽셀 셰이더 (ART_STYLE ★v2): 나무 수관(구름형 잎 덩어리), 줄기, 벽 블록, 바위, 기둥 등을
// 램프 인덱스로 직접 찍는다. 빛 = 좌상단. 소유: 워커 A.
import { R, rc, ih, vnoise, fbm } from './palette.js';

// ImageData 래퍼
export class PB {
  constructor(ctx) {
    this.ctx = ctx; this.w = ctx.canvas.width; this.h = ctx.canvas.height;
    this.img = ctx.getImageData(0, 0, this.w, this.h); this.d = this.img.data;
  }
  set(x, y, c, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a < 255 && this.d[i + 3] > 0) { // 반투명 → 아래 색과 섞기
      const k = a / 255;
      this.d[i] += (c[0] - this.d[i]) * k; this.d[i + 1] += (c[1] - this.d[i + 1]) * k; this.d[i + 2] += (c[2] - this.d[i + 2]) * k;
      this.d[i + 3] = Math.max(this.d[i + 3], a);
      return;
    }
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  alpha(x, y) { x |= 0; y |= 0; return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  flush() { this.ctx.putImageData(this.img, 0, 0); }
}

// 빛 방향 (좌상단 앞)
const LX = -0.55, LY = -0.62, LZ = 0.56;

/**
 * 잎 덩어리 공: 가장자리는 잎 모양으로 들쭉날쭉, 구형 명암 + 작은 잎 클러스터.
 * base: 램프 기준 인덱스, k: 명암 폭
 */
export function leafBall(pb, cx, cy, rx, ry, ramp, base, seed, k = 3.4, G = null) {
  const x0 = Math.floor(cx - rx - 2), x1 = Math.ceil(cx + rx + 2), y0 = Math.floor(cy - ry - 2), y1 = Math.ceil(cy + ry + 2);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const ang = Math.atan2(dy, dx);
    // 잎 가장자리: 각도 방향 톱니 + 노이즈
    const edge = 1 - 0.09 * (0.5 + 0.5 * Math.sin(ang * 9 + seed)) - 0.08 * vnoise(x, y, 3, seed);
    const rr = dx * dx + dy * dy;
    if (rr > edge * edge) continue;
    const nz = Math.sqrt(Math.max(0, 1 - rr));
    const lam = dx * LX + dy * LY + nz * LZ;
    let t = base + lam * k + (vnoise(x, y, 2.6, seed + 1) - 0.5) * 1.8;
    if (G) { // 수관 전체 구형 명암 (덩어리 전체가 좌상단 밝음/우하단 그늘)
      const gx = (x + 0.5 - G.cx) / G.rx, gy = (y + 0.5 - G.cy) / G.ry;
      t += (gx * LX + gy * LY) * G.k - Math.max(0, gx * gx + gy * gy - 0.6) * 1.2;
    }
    if (rr > (edge - 0.14) * (edge - 0.14)) t += lam > 0.15 ? 0.6 : -2; // 테두리: 밝은 쪽은 잎끝 반짝, 어두운 쪽은 가라앉음
    pb.set(x, y, rc(ramp, Math.round(t)));
  }
  // 잎 클러스터 하이라이트 (밝은 면에만): 작은 3~4px 잎
  const n = Math.round(rx * ry / 9);
  for (let i = 0; i < n; i++) {
    const a = ih(i, seed, 3) * Math.PI * 2, rad = Math.sqrt(ih(i, seed, 4)) * 0.85;
    const dx = Math.cos(a) * rad, dy = Math.sin(a) * rad;
    const lam = dx * LX + dy * LY + Math.sqrt(Math.max(0, 1 - rad * rad)) * LZ;
    if (lam < 0.25) continue;
    const x = Math.round(cx + dx * rx), y = Math.round(cy + dy * ry);
    const t = Math.round(base + lam * k + 1.2);
    pb.set(x, y, rc(ramp, t + 1)); pb.set(x + 1, y, rc(ramp, t)); pb.set(x - 1, y + 1, rc(ramp, t - 1)); pb.set(x, y + 1, rc(ramp, t - 2)); pb.set(x + 1, y + 1, rc(ramp, t - 3));
  }
}

// 수관: 잎 덩어리 여러 개를 뒤→앞으로 (위쪽·뒤쪽 공은 어둡게 시작해 깊이감)
export function canopy(pb, cx, cy, w, h, ramp, seed, n = 9) {
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = ih(i, seed, 1) * Math.PI * 2, rr = Math.sqrt(ih(i, seed, 2));
    const s = (0.2 + ih(i, seed, 3) * 0.13) * w;
    blobs.push([cx + Math.cos(a) * rr * w * 0.38, cy + Math.sin(a) * rr * h * 0.4, s]);
  }
  blobs.push([cx - w * 0.06, cy - h * 0.1, w * 0.3]); // 중심 덩어리
  blobs.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const G = { cx: cx - w * 0.05, cy: cy - h * 0.1, rx: w * 0.62, ry: h * 0.62, k: 2.6 };
  blobs.forEach(([x, y, s], i) => {
    // 앞 덩어리가 뒤 덩어리에 드리우는 그림자 (덩어리 분리감)
    const sx = x + 2, sy = y + 3, rx = s * 1.04, ry = s * 0.86;
    for (let yy = Math.floor(sy - ry); yy <= sy + ry; yy++) for (let xx = Math.floor(sx - rx); xx <= sx + rx; xx++) {
      const dx = (xx + 0.5 - sx) / rx, dy = (yy + 0.5 - sy) / ry;
      if (dx * dx + dy * dy > 1 || !pb.alpha(xx, yy)) continue;
      pb.set(xx, yy, rc(ramp, 1 + (vnoise(xx, yy, 2.5, seed) > 0.55 ? 1 : 0)));
    }
    leafBall(pb, x, y, s, s * 0.82, ramp, 3.3 + (ih(i, seed, 5) - 0.5), seed * 13 + i, 4.4, G);
  });
}

// 원통 줄기/기둥: 왼쪽 밝음, 세로 결
export function trunk(pb, cx, yBot, yTop, wBot, wTop, ramp, seed, opt = {}) {
  for (let y = Math.floor(yTop); y <= Math.ceil(yBot); y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    let hw = wTop + (wBot - wTop) * t * t;
    if (opt.roots && t > 0.82) hw += (t - 0.82) * 28 * (0.6 + 0.4 * vnoise(cx, y, 3, seed));
    const sway = opt.sway ? Math.sin(t * 3 + seed) * opt.sway : 0;
    for (let x = Math.floor(cx - hw + sway); x <= Math.ceil(cx + hw + sway); x++) {
      const nx = (x + 0.5 - cx - sway) / Math.max(1, hw);
      if (Math.abs(nx) > 1) continue;
      const lam = -nx * 0.75 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.45;
      let tt = (opt.base ?? 4) + lam * 3 + (vnoise(x * 3, y * 0.35, 4, seed) - 0.5) * 2.2;
      if (Math.abs(vnoise(x * 2.2, y * 0.25, 5, seed + 1) - 0.5) < 0.05) tt -= 2; // 껍질 홈
      if (Math.abs(nx) > 0.82) tt -= 1;
      pb.set(x, y, rc(ramp, Math.round(tt)));
    }
  }
}

// 아이소 상자 (픽셀): 윗면/왼면/오른면 톤 + 위·왼 모서리 하이라이트, 아래 그림자. 바닥 중심 (cx,cy), 바닥 높이 z
export function boxPx(pb, cx, cy, hw, hh, h, ramp, o = {}) {
  const z = o.z ?? 0, tTop = o.top ?? 6.5, tL = o.left ?? 5, tR = o.right ?? 3, seed = o.seed ?? 1, nz = o.noise ?? 1;
  const y0 = cy - z;
  const sl = hh / hw;
  for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
    const fx = x + 0.5 - cx;
    const yBot = y0 + hh - Math.abs(fx) * sl;           // 앞쪽 아래 모서리
    const yTopFront = yBot - h;                           // 앞 위 모서리
    const yTopBack = y0 - h - hh + Math.abs(fx) * sl;    // 윗면 뒤 모서리
    for (let y = Math.floor(yTopBack); y < Math.ceil(yBot); y++) {
      const fy = y + 0.5;
      if (fy < yTopBack) continue;
      let t, face;
      if (fy < yTopFront) {
        face = 0; t = tTop;
        const E = o.edges || 15; // 비트: 1 앞왼 2 앞오 4 뒤왼 8 뒤오 (이웃 벽과 맞닿은 변은 끔)
        if (fy - yTopBack < 1.2 && (E & (fx < 0 ? 4 : 8))) t += 1.2;                 // 뒤 모서리 하이라이트
        if (yTopFront - fy < 1.2 && (E & (fx < 0 ? 1 : 2))) t += fx < 0 ? 1.6 : 0.6; // 앞 모서리(빛)
        if (o.topFace) { const dyp = fy - (y0 - h); t += o.topFace((fx / hw + dyp / hh) / 2 + 0.5, (dyp / hh - fx / hw) / 2 + 0.5, x, y) ?? 0; }
      } else {
        face = fx < 0 ? 1 : 2; t = face === 1 ? tL : tR;
        const hh2 = yBot - fy;                              // 바닥에서 높이
        if (hh2 < 2) t -= 1.2;                              // 접지 AO
        if (Math.abs(fx) < 1 && o.corner !== false) t += face === 1 ? 1.2 : 0.4;   // 앞 세로 모서리
        if (o.face) {
          const f = o.face(face, x, y, fx < 0 ? (fx + hw) / hw : fx / hw, hh2, h);
          if (Array.isArray(f)) { pb.set(x, y, f); continue; }
          t += f ?? 0;
        }
      }
      t += (vnoise(x, y, 3, seed) - 0.5) * nz;
      pb.set(x, y, rc(ramp, Math.round(t)));
    }
  }
}

// 바위 덩어리: 각진 구 + 균열 + 윗면 이끼
export function boulder(pb, cx, cy, rx, ry, ramp, seed, moss = 0.3) {
  for (let y = Math.floor(cy - ry * 1.3); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / (dyScale(y, cy) * ry);
    const edge = 1 - 0.14 * vnoise(x, y, 5, seed);
    const rr = dx * dx + dy * dy;
    if (rr > edge * edge) continue;
    // 면 나누기: 법선을 계단식으로
    let nx = Math.round(dx * 2.2) / 2.2, ny = Math.round(dy * 2.2) / 2.2;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lam = nx * LX + ny * LY + nz * LZ;
    let t = 4 + lam * 3.6 + (vnoise(x, y, 2.5, seed + 1) - 0.5) * 1.2;
    if (Math.abs(vnoise(x, y, 6, seed + 2) - 0.5) < 0.03 && rr < 0.7) t -= 2.2;
    if (rr > (edge - 0.1) * (edge - 0.1) && lam < 0.2) t -= 1;
    let c = rc(ramp, Math.round(t));
    if (moss > 0 && ny < -0.25 && vnoise(x, y, 4, seed + 3) > 1 - moss) c = rc(R.moss, Math.round(2 + lam * 3));
    pb.set(x, y, c);
  }
}
const dyScale = (y, cy) => (y < cy ? 1.3 : 1);

// 원기둥(기둥·통): 가로 명암 + 세로 홈(flutes)
export function column(pb, cx, yBot, yTop, rx, ramp, seed, flutes = 0, base = 4.5, bands = null) {
  const ry = rx * 0.5;
  for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx;
    if (Math.abs(nx) > 1) continue;
    const curve = Math.sqrt(1 - nx * nx) * ry;
    const lam = -nx * 0.7 + Math.sqrt(1 - nx * nx) * 0.5;
    for (let y = Math.floor(yTop - curve); y < Math.ceil(yBot + curve); y++) {
      let t;
      if (y < yTop + curve) { // 윗면 타원
        const dy = (y + 0.5 - yTop) / ry;
        if (nx * nx + dy * dy > 1) continue;
        t = base + 2.2 - (dy > 0.6 ? 0.8 : 0);
      } else {
        if (y + 0.5 > yBot + curve) continue;
        t = base + lam * 3;
        if (flutes && Math.abs(Math.sin(Math.asin(nx) * flutes)) > 0.9) t -= 1.2;
        if (yBot + curve - y < 2) t -= 1;
        if (bands) { // 테 두르기 (통의 쇠테 등): [아래에서 높이, 두께, 램프]
          const hgt = yBot + curve - y;
          const b = bands.find(([z, w]) => hgt >= z && hgt < z + w);
          if (b) { pb.set(x, y, rc(b[2], Math.round(base - 0.5 + lam * 3.4 + (hgt - b[0] < 1 ? 1 : 0)))); continue; }
        }
      }
      t += (vnoise(x, y, 3, seed) - 0.5) * 0.9;
      pb.set(x, y, rc(ramp, Math.round(t)));
    }
  }
}

export { R, rc, ih, vnoise, fbm };
