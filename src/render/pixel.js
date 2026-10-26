// 도트(픽셀아트) 공용 도구: 베이어 디더, 스프라이트 도트화 필터(알파 컷·명암 단계화·1px 외곽선),
// 하드엣지 타원/선, 그림자 스탬프, 비트맵 숫자 글꼴. 소유: 워커 A. (docs/ART_STYLE.md §2~4)
import { makeCanvas, hexToRgb, LRU } from './util.js';

// 4×4 베이어 행렬 (0..15)
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DZ = 0.3; // 디더 데드존
export const bayer = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16; // (0,1)

// UI·이름표용 고전 한글 글꼴
export const FONT_PIX = '"굴림", Gulim, "돋움", Dotum, "Malgun Gothic", sans-serif';

/**
 * 캔버스를 도트풍으로 변환한다 (제자리).
 *  - 알파: alphaCut 미만 → 투명, 이상 → 불투명 (keepAlpha 면 2단 반투명 유지)
 *  - 명암: sqrt-휘도를 levels 단계로 양자화 → 부드러운 그라데이션이 2~4단 플랫톤으로 (dither:true 면 단 경계에 베이어 디더)
 *  - 외곽선: 불투명 영역 바깥 1px 을 이웃 색을 어둡게 한 색(짙은 갈색/남색 계열)으로
 */
export function pixelize(canvas, opt = {}) {
  const w = canvas.width, h = canvas.height;
  if (w < 2 || h < 2) return canvas;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const cut = opt.alphaCut ?? 110;
  const levels = opt.levels ?? 11;
  const keepAlpha = !!opt.keepAlpha;
  const dither = !!opt.dither; // 큰 그라데이션(지면·배경)만 디더, 스프라이트는 플랫 단 스냅
  const ox = opt.ox ?? 0, oy = opt.oy ?? 0;
  // 1차: 알파 컷 + sqrt-휘도 단계값 S 계산
  const S = new Float32Array(w * h).fill(-1);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const a = d[i + 3];
    if (a < cut) {
      // 그림자(어둡고 옅은 픽셀)는 하드엣지 반투명 단색으로 유지
      if (opt.shadow && a >= 28 && d[i] + d[i + 1] + d[i + 2] < 90) { d[i] = 8; d[i + 1] = 6; d[i + 2] = 12; d[i + 3] = 92; }
      else d[i + 3] = 0;
      continue;
    }
    d[i + 3] = keepAlpha ? (a > 200 ? 255 : (opt.midAlpha ?? 150)) : 255;
    if (levels <= 0) continue;
    const L = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    if (L > 0.002) S[p] = Math.sqrt(L) * levels;
  }
  if (levels > 0) {
    // 2차: 단색 면은 가장 가까운 단으로 스냅(망점 없음), 그라데이션 구간만 베이어 디더
    const at = (x, y, v) => (x < 0 || y < 0 || x >= w || y >= h ? v : S[y * w + x] < 0 ? v : S[y * w + x]);
    for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
      const s = S[p];
      if (s < 0) continue;
      const grad = Math.abs(at(x - 2, y, s) - at(x + 2, y, s)) + Math.abs(at(x, y - 2, s) - at(x, y + 2, s));
      const fl = Math.floor(s), fr = s - fl;
      let q;
      if (!dither || grad < 0.04 || grad > 0.9) q = Math.round(s); // 단색 면·경계는 스냅
      else q = fr < DZ ? fl : fr > 1 - DZ ? fl + 1 : fl + (bayer(x + ox, y + oy) < (fr - DZ) / (1 - 2 * DZ) ? 1 : 0);
      const i = p * 4, L = (s / levels) * (s / levels);
      const k = (q / levels) * (q / levels) / L;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  if (opt.outline !== false) outlinePass(d, w, h, opt.outlineColor);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// 투명 픽셀 중 불투명 이웃(4방향)이 있으면 외곽선 색으로 칠한다
function outlinePass(d, w, h, fixed) {
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) mask[p] = d[p * 4 + 3] >= 150 ? 1 : 0;
  const F = fixed ? hexToRgb(fixed) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (mask[p]) continue;
    let n = -1;
    if (x > 0 && mask[p - 1]) n = p - 1;
    else if (x < w - 1 && mask[p + 1]) n = p + 1;
    else if (y > 0 && mask[p - w]) n = p - w;
    else if (y < h - 1 && mask[p + w]) n = p + w;
    if (n < 0) continue;
    const i = p * 4, j = n * 4;
    if (F) { d[i] = F[0]; d[i + 1] = F[1]; d[i + 2] = F[2]; }
    else { d[i] = 14 + d[j] * 0.22; d[i + 1] = 10 + d[j + 1] * 0.18; d[i + 2] = 18 + d[j + 2] * 0.24; }
    d[i + 3] = 255;
  }
}

// ── 하드엣지 도형 (low-res 버퍼에 직접) ──
// 타원 테두리를 1px 사각형 점으로
export function pxEllipse(ctx, cx, cy, rx, ry, color, step = 1, a0 = 0, a1 = Math.PI * 2) {
  if (rx < 0.5 || ry < 0.5) return;
  ctx.fillStyle = color;
  const n = Math.max(8, Math.ceil(((rx + ry) * Math.abs(a1 - a0)) / step));
  let lx = 1e9, ly = 1e9;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x === lx && y === ly) continue;
    lx = x; ly = y;
    ctx.fillRect(x, y, 1, 1);
  }
}
// 채운 타원 (스캔라인, 하드엣지)
export function pxFillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  const R = Math.round(ry);
  for (let dy = -R; dy <= R; dy++) {
    const t = 1 - (dy * dy) / ((ry + 0.3) * (ry + 0.3));
    if (t <= 0) continue;
    const hw = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(Math.round(cx) - hw, Math.round(cy) + dy, hw * 2 + 1, 1);
  }
}
// 1px 선 (브레젠험)
export function pxLine(ctx, x0, y0, x1, y1, color, w = 1) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, guard = 0;
  const o = (w - 1) >> 1;
  for (;;) {
    ctx.fillRect(x0 - o, y0 - o, w, w);
    if ((x0 === x1 && y0 === y1) || guard++ > 2000) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// 디더(망점) 채운 마름모 — 반투명 대신 고전식 망점. 스탬프 캐시(크기·색·밀도별)
const diaCache = new Map();
export function pxDitherDiamond(ctx, cx, cy, hw, hh, color, density = 0.5) {
  hw = Math.round(hw); hh = Math.round(hh);
  if (hw < 1 || hh < 1 || density <= 0) return;
  const dq = Math.round(density * 16) / 16;
  const key = `${hw}|${hh}|${color}|${dq}`;
  let c = diaCache.get(key);
  if (!c) {
    c = makeCanvas(hw * 2 + 1, hh * 2 + 1);
    const g = c.getContext('2d');
    g.fillStyle = color;
    for (let dy = -hh; dy <= hh; dy++) {
      const w = Math.round(hw * (1 - Math.abs(dy) / hh));
      for (let dx = -w; dx <= w; dx++) if (bayer(dx + hw, dy + hh) < dq) g.fillRect(dx + hw, dy + hh, 1, 1);
    }
    if (diaCache.size > 400) diaCache.clear();
    diaCache.set(key, c);
  }
  ctx.drawImage(c, Math.round(cx) - hw, Math.round(cy) - hh);
}

// ── 그림자 스탬프 (하드엣지 반투명 타원, 캐시) ──
const shadowCache = new Map();
export function shadowStamp(rx, ry, alpha = 0.38) {
  rx = Math.max(2, Math.round(rx)); ry = Math.max(1, Math.round(ry));
  const key = `${rx}|${ry}|${alpha}`;
  let c = shadowCache.get(key);
  if (c) return c;
  c = makeCanvas(rx * 2 + 1, ry * 2 + 1);
  pxFillEllipse(c.getContext('2d'), rx, ry, rx, ry, `rgba(8,6,12,${alpha})`);
  shadowCache.set(key, c);
  return c;
}
export function drawShadow(ctx, x, y, rx, ry, alpha) {
  const s = shadowStamp(rx, ry, alpha);
  ctx.drawImage(s, Math.round(x - (s.width >> 1)), Math.round(y - (s.height >> 1)));
}

// ── 비트맵 숫자/영문 글꼴 (굵은 5×7) ──
const G = {
  '0': ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  '1': ['.##.', '###.', '.##.', '.##.', '.##.', '.##.', '####'],
  '2': ['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####'],
  '3': ['####.', '...##', '...##', '.###.', '...##', '...##', '####.'],
  '4': ['##.##', '##.##', '##.##', '#####', '...##', '...##', '...##'],
  '5': ['#####', '##...', '####.', '...##', '...##', '##.##', '.###.'],
  '6': ['.###.', '##...', '##...', '####.', '##.##', '##.##', '.###.'],
  '7': ['#####', '...##', '...##', '..##.', '.##..', '.##..', '.##..'],
  '8': ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '.###.'],
  '9': ['.###.', '##.##', '##.##', '.####', '...##', '...##', '.###.'],
  '!': ['##', '##', '##', '##', '##', '..', '##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  'M': ['#...#', '##.##', '#####', '#.#.#', '#...#', '#...#', '#...#'],
  'I': ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  'S': ['.####', '##...', '##...', '.###.', '...##', '...##', '####.'],
  'L': ['##...', '##...', '##...', '##...', '##...', '##...', '#####'],
  'E': ['#####', '##...', '##...', '####.', '##...', '##...', '#####'],
  'V': ['##.##', '##.##', '##.##', '##.##', '##.##', '.###.', '..#..'],
  'U': ['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  'P': ['####.', '##.##', '##.##', '####.', '##...', '##...', '##...'],
  'X': ['##.##', '##.##', '.###.', '..#..', '.###.', '##.##', '##.##'],
  'x': ['.....', '.....', '##.##', '.###.', '..#..', '.###.', '##.##'],
};
export const isBitmapText = (s) => /^[0-9!+\-MISLEVUPXx ]+$/.test(s);

const textCache = new LRU(160);
// 비트맵 글자열 → 캔버스 (외곽선 포함, 위쪽 밝은 2단 명암)
export function bitmapText(str, color, scale = 1, outline = '#1a0a08') {
  const key = `${str}|${color}|${scale}|${outline}`;
  let c = textCache.get(key);
  if (c) return c;
  let w = 0;
  for (const ch of str) w += (ch === ' ' ? 3 : (G[ch]?.[0].length ?? 3)) + 1;
  const W = (w + 2) * scale, H = 9 * scale;
  c = makeCanvas(W + 2, H + 2);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexToRgb(color);
  const top = `rgb(${Math.min(255, r + 50)},${Math.min(255, g + 50)},${Math.min(255, b + 50)})`;
  const bot = `rgb(${(r * 0.78) | 0},${(g * 0.78) | 0},${(b * 0.78) | 0})`;
  let x = 2;
  for (const ch of str) {
    const gl = G[ch];
    if (!gl) { x += 4; continue; }
    gl.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) if (row[xx] === '#') {
        ctx.fillStyle = yy < 2 ? top : yy > 4 ? bot : color;
        ctx.fillRect((x + xx) * scale, (yy + 1) * scale + 1, scale, scale);
      }
    });
    x += gl[0].length + 1;
  }
  // 굵은 외곽선(8방향)
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, cw = c.width, ch = c.height;
  const m = new Uint8Array(cw * ch);
  for (let p = 0; p < cw * ch; p++) m[p] = d[p * 4 + 3] > 0 ? 1 : 0;
  const O = hexToRgb(outline);
  for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) {
    const p = y * cw + xx;
    if (m[p]) continue;
    let hit = false;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = xx + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < cw && Y < ch && m[Y * cw + X]) { hit = true; break; }
    }
    if (hit) { const i = p * 4; d[i] = O[0]; d[i + 1] = O[1]; d[i + 2] = O[2]; d[i + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  return textCache.set(key, c);
}

// 고전식 이름표: 1px 외곽(4방향) + 본문. 배경 박스 없음. (메인 캔버스, 정수 좌표)
export function outlinedText(ctx, text, x, y, color, outline = '#000000') {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = outline;
  ctx.fillText(text, x - 1, y); ctx.fillText(text, x + 1, y); ctx.fillText(text, x, y - 1); ctx.fillText(text, x, y + 1);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
