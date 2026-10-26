// 하이컬러 도트 팔레트 (ART_STYLE ★v2): 재질별 휴 시프트 램프 + 톤 매핑 도구 + 결정적 노이즈. 소유: 워커 A.
// 램프 = 어두운(차가운 청록/남색/보라) → 밝은(따뜻한 연두/노랑/크림) 6~12단. 순수 회색·검정 없음.

// ── 색 공간 ──
export function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s <= 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
// 색상환에서 h 를 target 쪽으로 amt(0..1) 만큼 회전 (짧은 경로)
export function hueToward(h, target, amt) {
  let d = ((target - h + 540) % 360) - 180;
  return h + d * amt;
}
const hex2 = (v) => v.toString(16).padStart(2, '0');
export const rgbHex = (c) => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;

// ── 램프 생성 ──
// h: 기준 색상, s: 채도, n: 단 수, l0/l1: 명도 범위, cold/warm: 양 끝 휴 시프트 강도
export function makeRamp(h, s, n, o = {}) {
  const l0 = o.l0 ?? 0.1, l1 = o.l1 ?? 0.86, cold = o.cold ?? 0.32, warm = o.warm ?? 0.28;
  const coldHue = o.coldHue ?? 238, warmHue = o.warmHue ?? 52;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const L = l0 + (l1 - l0) * (o.curve ? Math.pow(t, o.curve) : t);
    const hh = t < 0.5 ? hueToward(h, coldHue, cold * (1 - t * 2)) : hueToward(h, warmHue, warm * (t * 2 - 1));
    // 중간톤 채도가 가장 높고, 아주 밝은 끝은 살짝 빠짐 (그림자도 채도 유지)
    const S = Math.min(1, s * (0.92 + 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (t > 0.85 ? 0.85 : 1));
    out.push(hsl2rgb(hh, S, L));
  }
  out.hex = out.map(rgbHex);
  return out;
}

// 재질 램프 (인덱스 0 = 가장 어두움)
export const R = {
  grass:      makeRamp(92, 0.54, 10, { l0: 0.09, l1: 0.66, cold: 0.5, warm: 0.45, coldHue: 185, curve: 0.9 }),
  grass_dark: makeRamp(118, 0.44, 10, { l0: 0.07, l1: 0.5, cold: 0.45, warm: 0.3, coldHue: 200 }),
  dirt:       makeRamp(30, 0.5, 9, { l0: 0.1, l1: 0.6, cold: 0.3, warm: 0.25, coldHue: 285 }),
  path:       makeRamp(36, 0.42, 9, { l0: 0.14, l1: 0.74, cold: 0.32, warm: 0.3, coldHue: 280 }),
  sand:       makeRamp(40, 0.55, 9, { l0: 0.22, l1: 0.84, cold: 0.3, warm: 0.2, coldHue: 300 }),
  swamp:      makeRamp(92, 0.34, 9, { l0: 0.06, l1: 0.48, cold: 0.45, warm: 0.3, coldHue: 200 }),
  ash:        makeRamp(20, 0.12, 9, { l0: 0.08, l1: 0.6, cold: 0.5, warm: 0.4, coldHue: 260 }),
  mist:       makeRamp(250, 0.22, 9, { l0: 0.1, l1: 0.66, cold: 0.2, warm: 0.15, coldHue: 245, warmHue: 300 }),
  stone:      makeRamp(40, 0.1, 10, { l0: 0.09, l1: 0.8, cold: 0.6, warm: 0.5, coldHue: 250 }),
  cobble:     makeRamp(34, 0.14, 10, { l0: 0.08, l1: 0.78, cold: 0.6, warm: 0.5, coldHue: 255 }),
  wood:       makeRamp(26, 0.52, 10, { l0: 0.08, l1: 0.66, cold: 0.3, warm: 0.3, coldHue: 300 }),
  carpet:     makeRamp(354, 0.62, 9, { l0: 0.1, l1: 0.6, cold: 0.25, warm: 0.3, coldHue: 290, warmHue: 25 }),
  gold:       makeRamp(44, 0.72, 8, { l0: 0.16, l1: 0.86, cold: 0.25, warm: 0.2, coldHue: 10 }),
  marble:     makeRamp(40, 0.2, 10, { l0: 0.3, l1: 0.94, cold: 0.6, warm: 0.4, coldHue: 255 }),
  bone:       makeRamp(36, 0.16, 9, { l0: 0.08, l1: 0.62, cold: 0.5, warm: 0.4, coldHue: 250 }),
  bonewhite:  makeRamp(44, 0.3, 7, { l0: 0.3, l1: 0.9, cold: 0.5, warm: 0.3, coldHue: 260 }),
  water:      makeRamp(208, 0.62, 10, { l0: 0.12, l1: 0.78, cold: 0.25, warm: 0.4, coldHue: 236, warmHue: 175 }),
  deep_water: makeRamp(218, 0.6, 9, { l0: 0.07, l1: 0.55, cold: 0.25, warm: 0.4, coldHue: 245, warmHue: 190 }),
  lava:       makeRamp(14, 0.9, 10, { l0: 0.1, l1: 0.8, cold: 0.4, warm: 0.6, coldHue: 330, warmHue: 55 }),
  brick:      makeRamp(36, 0.16, 10, { l0: 0.08, l1: 0.78, cold: 0.6, warm: 0.5, coldHue: 255 }),
  logwall:    makeRamp(24, 0.48, 10, { l0: 0.07, l1: 0.62, cold: 0.32, warm: 0.3, coldHue: 300 }),
  crypt:      makeRamp(150, 0.12, 10, { l0: 0.06, l1: 0.62, cold: 0.5, warm: 0.3, coldHue: 240 }),
  marblewall: makeRamp(38, 0.22, 10, { l0: 0.26, l1: 0.93, cold: 0.6, warm: 0.4, coldHue: 255 }),
  spirit:     makeRamp(255, 0.6, 8, { l0: 0.25, l1: 0.9, cold: 0.1, warm: 0.4, coldHue: 250, warmHue: 190 }),
  leaf:       makeRamp(100, 0.6, 11, { l0: 0.07, l1: 0.68, cold: 0.45, warm: 0.42, coldHue: 195 }),
  pineleaf:   makeRamp(140, 0.42, 10, { l0: 0.06, l1: 0.55, cold: 0.42, warm: 0.4, coldHue: 210 }),
  bark:       makeRamp(26, 0.42, 9, { l0: 0.07, l1: 0.55, cold: 0.35, warm: 0.3, coldHue: 290 }),
  deadbark:   makeRamp(30, 0.14, 9, { l0: 0.07, l1: 0.58, cold: 0.5, warm: 0.35, coldHue: 270 }),
  moss:       makeRamp(85, 0.5, 6, { l0: 0.14, l1: 0.55, cold: 0.4, warm: 0.4, coldHue: 180 }),
  skin:       makeRamp(24, 0.6, 8, { l0: 0.22, l1: 0.88, cold: 0.25, warm: 0.15, coldHue: 330 }),
  iron:       makeRamp(220, 0.12, 9, { l0: 0.1, l1: 0.92, cold: 0.3, warm: 0.5, coldHue: 250, warmHue: 50 }),
  crystal:    makeRamp(195, 0.75, 8, { l0: 0.14, l1: 0.92, cold: 0.3, warm: 0.4, coldHue: 240, warmHue: 170 }),
};

// 램프 색 (인덱스 실수 → 반올림, 범위 클램프)
export function rc(ramp, i) { return ramp[i < 0 ? 0 : i >= ramp.length ? ramp.length - 1 : i | 0]; }
export function rh(ramp, i) { i = Math.round(i); return ramp.hex[i < 0 ? 0 : i >= ramp.length ? ramp.length - 1 : i]; }

// ── 결정적 노이즈 ──
export function ih(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t);
// 값 노이즈 (0..1), 격자 크기 sc px
export function vnoise(x, y, sc, s = 0) {
  const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = sm(fx - x0), ty = sm(fy - y0);
  const a = ih(x0, y0, s), b = ih(x0 + 1, y0, s), c = ih(x0, y0 + 1, s), d = ih(x0 + 1, y0 + 1, s);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
export function fbm(x, y, sc, s = 0) {
  return vnoise(x, y, sc, s) * 0.6 + vnoise(x, y, sc * 0.45, s + 7) * 0.3 + vnoise(x, y, sc * 0.2, s + 13) * 0.1;
}

// ── 하이컬러 톤 매핑: 명도 단계 + 휴 시프트(그림자 차갑게/하이라이트 따뜻하게) + 채도 보정 ──
// levels 단계로 명도를 양자화(디더 없음). 입력/출력 rgb 0..255
export function toneMap(r, g, b, levels = 18, out = [0, 0, 0]) {
  let [h, s, l] = rgb2hsl(r, g, b);
  if (levels > 0) l = Math.round(l * levels) / levels;
  if (s < 0.1) { // 무채색 → 은은한 색 (어두우면 남보라, 밝으면 크림)
    h = l < 0.5 ? 245 : 40; s = 0.06 + (0.1 - s) * 0.5 + Math.abs(l - 0.5) * 0.12;
  }
  if (l < 0.5) { h = hueToward(h, 245, (0.5 - l) * 0.34); s = Math.min(1, s * (1 + (0.5 - l) * 0.36)); }
  else if (l > 0.62) { h = hueToward(h, 50, (l - 0.62) * 0.45); }
  l = 0.035 + l * 0.965;
  const c = hsl2rgb(h, s, l);
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return out;
}
// 외곽선 색: 이웃 색보다 어둡고 같은 계열(차가운 쪽으로). soft 면 빛 받는 쪽(덜 어둡게)
export function outlineOf(r, g, b, soft, out = [0, 0, 0]) {
  let [h, s, l] = rgb2hsl(r, g, b);
  if (s < 0.08) { h = 250; s = 0.2; }
  h = hueToward(h, 250, soft ? 0.15 : 0.3);
  s = Math.min(1, s * 1.15 + 0.08);
  l = soft ? Math.max(0.1, l * 0.62) : Math.max(0.05, Math.min(0.22, l * 0.38));
  const c = hsl2rgb(h, s, l);
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return out;
}
