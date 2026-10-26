// 스프라이트 픽셀 셰이더 (ART_STYLE ★v2 §2.1-6~8): 캐릭터·몬스터를 "재질 영역 → 손도트 명암"으로 굽는다. 소유: 워커 A.
//  1) 리그/짐승 코드는 부위마다 Sheet.m(spec) 이 돌려주는 고유 ID 색으로 평평하게 칠한다(그라데이션·외곽선 없음).
//  2) bake(): ID 색 → 영역 복원(AA 혼합 픽셀은 이웃 영역으로) → 영역별 법선(구/관/런렝스) → 휴 시프트 램프 인덱스
//     + 재질 질감(천 주름·머리카락 결·사슬·비늘·금속 반사·털 결·뼈) + 앞 부위가 드리우는 그림자/안쪽 선
//  3) marks: 얼굴 이목구비·하이라이트 같은 1px 디테일을 픽셀 단위로 찍는다(램프 인덱스 이동/직접 색)
//  4) 선택적 컬러 외곽선(pixel.js outlinePass) → post marks(빛나는 눈·검의 발광 등 외곽선 위에 얹는 것)
import { makeRamp, rgb2hsl, hsl2rgb, vnoise, ih } from './palette.js';
import { hexToRgb } from './util.js';
import { outlinePass } from './pixel.js';

// 빛: 좌상단 앞 (정규화)
const LX = -0.6, LY = -0.58, LZ = 0.55;

// ── 색 → 휴 시프트 램프 (캐시). mid = 원래 색에 해당하는 인덱스 ──
const rampCache = new Map();
export function rampOf(hex, o = {}) {
  const n = o.n ?? 10, sp = o.spread ?? 1, sat = o.sat ?? 1.08;
  const key = `${hex}|${n}|${sp}|${sat}|${o.warm ?? ''}|${o.cold ?? ''}`;
  let r = rampCache.get(key);
  if (r) return r;
  const [a, b, c] = hexToRgb(hex);
  let [h, s, l] = rgb2hsl(a, b, c);
  if (s < 0.05) { h = 228; s = 0.06; }
  s = Math.min(1, s * sat);
  const l0 = Math.max(0.045, l * 0.28, l - 0.4 * sp), l1 = Math.min(0.96, l + 0.36 * sp);
  r = makeRamp(h, s, n, { l0, l1, cold: o.cold ?? 0.26, warm: o.warm ?? 0.22, coldHue: 250, warmHue: 48 });
  // 어두운 끝은 채도를 눌러(탁한 남보라 쪽) 빨갛게 타 보이지 않게, 밝은 끝도 살짝
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), [hh, ss, ll] = rgb2hsl(...r[i]);
    const k = t < 0.5 ? 0.55 + 0.9 * t : 1 - (t - 0.5) * 0.35;
    r[i] = hsl2rgb(hh, Math.min(1, ss * k), ll);
  }
  r.hex = r.map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''));
  r.mid = ((l - l0) / Math.max(0.01, l1 - l0)) * (n - 1);
  rampCache.set(key, r);
  return r;
}

const codeOf = (id) => Math.imul(id, 0x9e3779b1) & 0xffffff || 0x010101;
const hex6 = (n) => '#' + n.toString(16).padStart(6, '0');

export class Sheet {
  // opt.mono: { ramp, style, k, base, vary } → 모든 영역을 한 재질로 (석상 등). 1px 마크는 생략
  constructor(ctx, opt = {}) {
    this.ctx = ctx; this.specs = [null]; this.byCode = new Map(); this.marks = []; this.post = []; this.mono = opt.mono || null;
    const T = ctx.getTransform();
    this.origin = [T.e, T.f];
  }
  // 현재 변환 기준 로컬 점 → 캔버스 픽셀
  pt(x, y) { const T = this.ctx.getTransform(); return [T.a * x + T.c * y + T.e, T.b * x + T.d * y + T.f]; }
  get k() { const T = this.ctx.getTransform(); return Math.sqrt(Math.abs(T.a * T.d - T.b * T.c)) || 1; }
  // 재질 영역 등록 → 칠할 ID 색. spec: { ramp|hex, base, k, style, sphere:[cx,cy,rx,ry], axis:[[x0,y0,x1,y1]..], hw, anchor:[x,y], ... }
  m(spec) {
    const id = this.specs.length;
    const s = { ...spec, id };
    if (this.mono) {
      const M = this.mono, [a, b, c] = hexToRgb(spec.hex || '#808080'), lum = (a * 0.3 + b * 0.55 + c * 0.15) / 255;
      s.ramp = M.ramp; s.style = M.style; s.k = M.k ?? 3.8; s.base = (M.base ?? M.ramp.length * 0.55) + (lum - 0.45) * (M.vary ?? 2); s.under = null;
    }
    if (!s.ramp) s.ramp = rampOf(spec.hex || '#808080', spec.rampOpt);
    if (s.base == null) s.base = s.ramp.mid;
    const k = this.k;
    if (spec.sphere) { const [cx, cy, rx, ry] = spec.sphere; const p = this.pt(cx, cy); s.sphere = [p[0], p[1], Math.max(0.6, rx * k), Math.max(0.6, ry * k)]; }
    if (spec.axis) { s.axis = spec.axis.map(([x0, y0, x1, y1]) => [...this.pt(x0, y0), ...this.pt(x1, y1)]); s.hw = Math.max(0.6, (spec.hw ?? 2) * k); }
    s.anchor = spec.anchor ? this.pt(spec.anchor[0], spec.anchor[1]) : this.origin;
    if (spec.head) { const p = this.pt(spec.head[0], spec.head[1]); s.head = [p[0], p[1], spec.head[2] * k]; }
    if (spec.fade) s.fade = [this.pt(0, spec.fade[0])[1], this.pt(0, spec.fade[1])[1]];
    this.specs.push(s);
    const code = codeOf(id);
    this.byCode.set(code, id);
    s.color = hex6(code);
    return s.color;
  }
  // 같은 영역을 다시 칠할 때(얼굴 창 등)
  again(color) { return color; }
  mark(fn) { if (!this.mono) this.marks.push(fn); }
  postMark(fn) { if (!this.mono) this.post.push(fn); }

  bake(opt = {}) {
    const ctx = this.ctx, c = ctx.canvas, W = c.width, H = c.height, N = W * H;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const specs = this.specs, byCode = this.byCode;
    const rid = new Int16Array(N);
    const cut = opt.alphaCut ?? 120;
    let unknown = 0;
    for (let p = 0, i = 0; p < N; p++, i += 4) {
      if (d[i + 3] < cut) continue;
      const id = byCode.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (id) rid[p] = id; else { rid[p] = -1; unknown++; }
    }
    // AA 혼합 픽셀: 이웃 영역 두 개(A,B)의 혼합으로 보고 덮은 비율이 큰 쪽으로 (가는 선이 사라지지 않게)
    const cand = new Int32Array(24);
    for (let it = 0; it < 3 && unknown; it++) {
      const R2 = it === 0 ? 1 : 2;
      const fix = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (rid[p] !== -1) continue;
        let n = 0;
        for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) {
          const X = x + dx, Y = y + dy;
          if ((!dx && !dy) || X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const q = rid[Y * W + X];
          if (q <= 0) continue;
          let dup = false; for (let j = 0; j < n; j++) if (cand[j] === q) { dup = true; break; }
          if (!dup && n < 24) cand[n++] = q;
        }
        if (!n) continue;
        const i = p * 4, cr = d[i], cg = d[i + 1], cb = d[i + 2];
        let best = cand[0], be = 1e9;
        for (let a1 = 0; a1 < n; a1++) {
          const A = codeOf(cand[a1]), ar = A >> 16, ag = (A >> 8) & 255, ab = A & 255;
          const e0 = Math.abs(cr - ar) + Math.abs(cg - ag) + Math.abs(cb - ab);
          if (e0 < be) { be = e0; best = cand[a1]; }
          for (let b1 = a1 + 1; b1 < n; b1++) {
            const B = codeOf(cand[b1]), br = B >> 16, bg = (B >> 8) & 255, bb = B & 255;
            const vr = ar - br, vg = ag - bg, vb = ab - bb, L = vr * vr + vg * vg + vb * vb;
            if (!L) continue;
            let t = ((cr - br) * vr + (cg - bg) * vg + (cb - bb) * vb) / L;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const e = Math.abs(cr - br - vr * t) + Math.abs(cg - bg - vg * t) + Math.abs(cb - bb - vb * t);
            if (e < be) { be = e; best = t >= 0.5 ? cand[a1] : cand[b1]; }
          }
        }
        fix.push(p, best);
      }
      for (let j = 0; j < fix.length; j += 2) { rid[fix[j]] = fix[j + 1]; unknown--; }
    }
    for (let p = 0; p < N; p++) if (rid[p] < 0) rid[p] = 0;
    // 런렝스 (영역 안 거리)
    const dl = new Uint8Array(N), dr = new Uint8Array(N), du = new Uint8Array(N), dd = new Uint8Array(N);
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 1; x < W; x++) { const p = o + x; if (rid[p] && rid[p] === rid[p - 1]) dl[p] = Math.min(60, dl[p - 1] + 1); }
      for (let x = W - 2; x >= 0; x--) { const p = o + x; if (rid[p] && rid[p] === rid[p + 1]) dr[p] = Math.min(60, dr[p + 1] + 1); }
    }
    for (let x = 0; x < W; x++) {
      for (let y = 1; y < H; y++) { const p = y * W + x; if (rid[p] && rid[p] === rid[p - W]) du[p] = Math.min(60, du[p - W] + 1); }
      for (let y = H - 2; y >= 0; y--) { const p = y * W + x; if (rid[p] && rid[p] === rid[p + W]) dd[p] = Math.min(60, dd[p + W] + 1); }
    }
    const idx = new Float32Array(N), nyA = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, id = rid[p];
      if (!id) continue;
      const s = specs[id];
      let nx, ny;
      const px = x + 0.5, py = y + 0.5;
      if (s.sphere) {
        const [cx, cy, rx, ry] = s.sphere;
        nx = (px - cx) / rx; ny = (py - cy) / ry;
      } else if (s.axis) {
        let bx = 0, by = 0, bd = 1e9;
        for (const [x0, y0, x1, y1] of s.axis) {
          const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy;
          let t = L > 0 ? ((px - x0) * vx + (py - y0) * vy) / L : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = px - (x0 + vx * t), qy = py - (y0 + vy * t), q = qx * qx + qy * qy;
          if (q < bd) { bd = q; bx = qx; by = qy; }
        }
        nx = bx / s.hw; ny = by / s.hw;
      } else {
        const w = dl[p] + dr[p] + 1, h = du[p] + dd[p] + 1;
        const sx = ((dl[p] + 0.5) / w) * 2 - 1, sy = ((du[p] + 0.5) / h) * 2 - 1;
        nx = sx * Math.min(1, Math.max(0.3, h / w)) * (s.flat ?? 1);
        ny = sy * Math.min(1, Math.max(0.3, w / h)) * (s.flat ?? 1);
      }
      const q = nx * nx + ny * ny;
      if (q > 1) { const k = 1 / Math.sqrt(q); nx *= k; ny *= k; }
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = nx * LX + ny * LY + nz * LZ;
      const K = s.k ?? 4;
      let t = s.base + (lam - 0.42) * K;
      const u = px - s.anchor[0], v = py - s.anchor[1], seed = s.seed ?? id * 7;
      switch (s.style) {
        case 'metal':
          t = s.base + (lam - 0.42) * K * 1.2;
          if (lam > 0.86) t += 2.4; else if (lam > 0.7) t += 0.9;
          else if (lam > 0.02 && lam < 0.2) t -= 1.1;
          if (ny > 0.6) t += 0.9; // 바닥 반사광
          break;
        case 'cloth':
          t += (vnoise(u * 0.9 + 40, v * 0.2, 2.3, seed) - 0.5) * 2.6 * (s.fold ?? 1);
          if (dd[p] <= 0 && s.hem !== false) t -= 0.9;
          break;
        case 'leather':
          t += (vnoise(u * 0.8, v * 0.3, 2.2, seed) - 0.5) * 1.6;
          if (ih(x, y, seed) > 0.95) t += 1;
          if (s.stitch && (dl[p] === 1 || dr[p] === 1) && (y & 1)) t -= 1.4;
          break;
        case 'skin':
          t = s.base + (lam - 0.45) * K * 0.85;
          break;
        case 'hair': {
          const st = (vnoise(u * 1.4 + 9, v * 0.22, 2, seed) - 0.5) * 2.2 + (vnoise(u * 2.8, v * 0.4, 1.5, seed + 3) - 0.5) * 0.7;
          t += st;
          if (s.head) { const hy = (py - s.head[1]) / s.head[2], hx = (px - s.head[0]) / s.head[2]; if (hy > -0.78 && hy < -0.42 && hx < 0.45 && lam > 0.25) t += 1.7; }
          else if (lam > 0.62 && st > 0.2) t += 1;
          break;
        }
        case 'chain': {
          const r = Math.floor(v / 2), uu = Math.floor(u) + (r & 1), lx = ((uu % 2) + 2) % 2, ly = ((Math.floor(v) % 2) + 2) % 2;
          t += lx === 0 && ly === 0 ? 1.1 : lx === 1 && ly === 1 ? -1.6 : -0.3;
          break;
        }
        case 'scale': {
          const r = Math.floor(v / 3), uu = Math.floor(u) + (r & 1) * 2, lx = ((uu % 4) + 4) % 4, ly = ((Math.floor(v) % 3) + 3) % 3;
          t = s.base + (lam - 0.42) * K * 1.1;
          if (ly === 2) t -= lx === 0 || lx === 3 ? 2 : 1.2; else if (ly === 0 && (lx === 1 || lx === 2)) t += 1.4;
          if (lam > 0.8) t += 1.2;
          break;
        }
        case 'fur': {
          t += (vnoise(u * (s.furX ?? 0.5), v * (s.furY ?? 1.3), 1.6, seed) - 0.5) * 2.8;
          if (ih(x >> 1, y, seed) > 0.9 && lam > 0.3) t += 1;
          break;
        }
        case 'bone':
          t = s.base + (lam - 0.42) * K;
          if (ih(x, y, seed) > 0.96) t -= 1.6;
          break;
        case 'stone': {
          const qx = Math.round(nx * 2.2) / 2.2, qy = Math.round(ny * 2.2) / 2.2, qz = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy));
          t = s.base + (qx * LX + qy * LY + qz * LZ - 0.42) * K + (vnoise(u, v, 2.5, seed) - 0.5) * 1.2;
          if (Math.abs(vnoise(u, v, 6, seed + 2) - 0.5) < 0.035) t -= 2.2;
          break;
        }
        case 'gloss':
          t = s.base + (lam - 0.42) * K;
          if (lam > 0.88) t += 3; else if (lam > 0.78) t += 1.2;
          break;
        case 'glow':
          t = s.base + (lam - 0.42) * 1.2;
          break;
        case 'wood':
          t += (vnoise(u * 0.6, v * 2.4, 2, seed) - 0.5) * 1.8;
          if (s.planks && ((Math.floor(u) % s.planks) + s.planks) % s.planks === 0) t -= 1.6;
          break;
        default: break;
      }
      // 아래쪽 면 다른 재질 (배·턱 아래)
      if (s.under && ny > s.under.th) { t = s.under.ramp.mid + (lam - 0.42) * K + (t - s.base) * 0.4; nyA[p] = 9; }
      if (s.ao !== false) {
        const up = y > 0 ? rid[p - W] : 0, lf = x > 0 ? rid[p - 1] : 0;
        const up2 = y > 1 ? rid[p - 2 * W] : 0, ul = x > 0 && y > 0 ? rid[p - W - 1] : 0;
        if ((up > id && specs[up].cast !== false) || (lf > id && specs[lf].cast !== false)) t -= 1.5;
        else if ((up2 > id && specs[up2].cast !== false) || (ul > id && specs[ul].cast !== false)) t -= 0.6;
        const dn = y < H - 1 ? rid[p + W] : 0, rt = x < W - 1 ? rid[p + 1] : 0;
        if ((dn && dn < id) || (rt && rt < id)) t -= s.inner ?? 1.1;
        else if ((up && up < id) || (lf && lf < id)) t += 0.5;
      }
      idx[p] = t;
    }
    // 1px 디테일 (얼굴·문양 등) — 램프 인덱스 단계에서
    const out = new Uint8ClampedArray(N * 4);
    const X = {
      W, H, rid, idx, specs, d: out,
      id: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : rid[(y | 0) * W + (x | 0)]),
      shift(x, y, dv, only) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (!rid[p] || (only && !only.includes(rid[p]))) return; idx[p] += dv; },
      setIdx(x, y, v, only) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (!rid[p] || (only && !only.includes(rid[p]))) return; idx[p] = v; },
      // 직접 색 (영역 무관): rgb 배열, a 0..255. region 지정 시 그 영역 위에만
      put(x, y, col, a = 255, only) {
        x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
        const p = y * W + x; if (only && !only.includes(rid[p])) return;
        X.over[p] = 1; const i = p * 4; X.oc[i] = col[0]; X.oc[i + 1] = col[1]; X.oc[i + 2] = col[2]; X.mixK[p] = a / 255;
      },
      over: new Uint8Array(N), oc: new Uint8ClampedArray(N * 4), mixK: new Float32Array(N),
      // 영역 램프에서 색 (영역 id, 인덱스)
      col(id, i) { const r = specs[id].ramp; return r[Math.max(0, Math.min(r.length - 1, Math.round(i)))]; },
    };
    for (const f of this.marks) f(X);
    // 색 확정
    for (let p = 0, i = 0; p < N; p++, i += 4) {
      const id = rid[p];
      if (!id) { if (X.over[p]) { out[i] = X.oc[i]; out[i + 1] = X.oc[i + 1]; out[i + 2] = X.oc[i + 2]; out[i + 3] = Math.round(X.mixK[p] * 255); } continue; }
      const s = specs[id], r = s.ramp;
      let t = Math.round(idx[p]); t = t < 0 ? 0 : t >= r.length ? r.length - 1 : t;
      let col = r[t];
      if (nyA[p] === 9 && s.under) { const r2 = s.under.ramp; col = r2[Math.max(0, Math.min(r2.length - 1, t))]; }
      out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2];
      let a = s.alpha ?? 255;
      if (s.fade) { const k = (p / W - s.fade[0]) / Math.max(1, s.fade[1] - s.fade[0]); if (k > 0.45) a = Math.round(a * (k > 0.85 ? 0.45 : k > 0.65 ? 0.68 : 0.85)); }
      out[i + 3] = a;
      if (X.over[p]) {
        const k = X.mixK[p];
        out[i] += (X.oc[i] - out[i]) * k; out[i + 1] += (X.oc[i + 1] - out[i + 1]) * k; out[i + 2] += (X.oc[i + 2] - out[i + 2]) * k;
      }
    }
    if (opt.outline !== false) outlinePass(out, W, H, opt.outlineColor, opt.outlineTh ?? 140, true);
    if (opt.outlineAlpha != null) for (let p = 0, i = 0; p < N; p++, i += 4) if (!rid[p] && out[i + 3] === 255 && !X.over[p]) out[i + 3] = opt.outlineAlpha;
    // 외곽선 위에 얹는 것 (발광 등): 직접 색 블렌드
    if (this.post.length) {
      const P = {
        W, H, rid, d: out,
        id: X.id,
        add(x, y, col, a = 255) {
          x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
          const i = (y * W + x) * 4, k = a / 255;
          if (!out[i + 3]) { out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; out[i + 3] = a; return; }
          out[i] += (col[0] - out[i]) * k; out[i + 1] += (col[1] - out[i + 1]) * k; out[i + 2] += (col[2] - out[i + 2]) * k; out[i + 3] = Math.max(out[i + 3], a);
        },
      };
      for (const f of this.post) f(P);
    }
    img.data.set(out);
    ctx.putImageData(img, 0, 0);
    ctx.restore();
    return this;
  }
}

// 자주 쓰는 색 (rgb)
export const C = {
  white: [250, 246, 236], eyeW: [242, 238, 230], lash: [44, 26, 30], iris: [58, 36, 40],
  blush: [236, 120, 118], lip: [176, 86, 82], teeth: [236, 228, 206], black: [18, 12, 22],
};
export const rgbOf = (hex) => hexToRgb(hex);
