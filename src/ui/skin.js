// 고전 RPG 스킨 v2 — "하이컬러 손도트" (docs/ART_STYLE.md ★v2).
// 재질마다 휴 시프트된 램프(그림자 = 차가운 남보라, 하이라이트 = 따뜻한 크림)를 두고, 모든 칠은 램프 인덱스로 한다.
// 1× 해상도(화면 픽셀 = 도트 1개), 디더 격자 없이 저주파 노이즈 + 클러스터로 질감, 선택적 외곽선, 손 AA.
// 산출물(data URL)은 #ui-root 의 CSS 변수로 들어간다:
//   --tx-*  반복 텍스처(돌·짙은 나무·가죽·어두운 홈·슬롯 바닥)
//   --fr-*  9-slice 프레임(border-image): 청동 몰딩·버튼 볼록/눌림·오목 홈·슬롯·금박·붉은 칠
//   --orn   모서리 장식(청동 판 + 금 징), --img-* 터치 패드 원형 부품
// 외부 에셋 없음.

// ── 색 유틸 ──
const HX = new Map();
export function hx(s) {
  let v = HX.get(s);
  if (!v) { const n = parseInt(s.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; HX.set(s, v); }
  return v;
}
const toHex = (c) => '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
const mixc = (a, b, t) => toHex(hx(a).map((v, i) => Math.round(v + (hx(b)[i] - v) * t)));

// ── 재질 램프 (어두움 → 밝음). 그림자 쪽은 남보라로, 밝은 쪽은 노랑·크림으로 휜다 ──
export const RAMP = {
  bronze: ['#120a16', '#24121c', '#3a1c20', '#552a22', '#723c26', '#90522c', '#ac6c34', '#c88a40', '#dfaa52', '#f0c86c', '#fae29a', '#fff6d2'],
  gold: ['#1a0e10', '#3a1e14', '#5e3216', '#864c18', '#ac6a1c', '#cc8c24', '#e4ac32', '#f4ca4a', '#fce274', '#fff2b0', '#fffbe6'],
  steel: ['#0c0c1a', '#181a2c', '#262a40', '#363c54', '#4a526a', '#606a80', '#7a8496', '#98a2ae', '#b8c0c4', '#dadcd4', '#f4f0e0'],
  stone: ['#120e1a', '#1c1724', '#26202e', '#322a38', '#3e3542', '#4b414b', '#5a4e54', '#6b5e5e', '#7e6f66', '#93836f', '#aa9a7e', '#c4b492'],
  wood: ['#0e0810', '#180c14', '#241218', '#30181a', '#3e201c', '#4c281e', '#5c3222', '#6e3e26', '#824c2c', '#985c34', '#ae6e3e', '#c4844c'],
  leather: ['#0c0810', '#130d16', '#1a121a', '#22171e', '#2b1d22', '#352426', '#412c2a'],
  dark: ['#06050a', '#0a080e', '#0e0b12', '#131016', '#19141c', '#201a22'],
  navy: ['#080a1c', '#0e1430', '#161e46', '#1e2a5c', '#283872', '#344a8a', '#4660a4', '#5e7cbc', '#80a0d4', '#aac4e8'],
  moss: ['#0c2228', '#123630', '#1c4c36', '#2a6238', '#3e7a38', '#5a9238', '#7eaa3c', '#a8c44a'],
  red: ['#180818', '#2c0c1c', '#46101e', '#641620', '#861e20', '#a82c22', '#c84428', '#e06834', '#f09450', '#fcc47c'],
};
const ri = (r, i) => r[Math.max(0, Math.min(r.length - 1, Math.round(i)))];

// ── 결정적 해시 / 이음매 없는(주기) 값 노이즈 ──
function H(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// cell 크기의 격자 노이즈, 주기 per(px) 로 감김(텍스처 반복 이음매 없음). 0..1
function vn(x, y, cell, per, s) {
  const n = Math.max(1, Math.round(per / cell));
  const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const g = (a, b) => H(((a % n) + n) % n, ((b % n) + n) % n, s);
  const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
  const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

// ── 픽셀 버퍼 ──
class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4, v = hx(c);
    if (a >= 255) { this.d[i] = v[0]; this.d[i + 1] = v[1]; this.d[i + 2] = v[2]; this.d[i + 3] = 255; return; }
    const ba = this.d[i + 3] / 255, fa = a / 255, oa = fa + ba * (1 - fa);
    for (let k = 0; k < 3; k++) this.d[i + k] = (v[k] * fa + this.d[i + k] * ba * (1 - fa)) / (oa || 1);
    this.d[i + 3] = oa * 255;
  }
  alpha(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
  url() { return this.canvas().toDataURL(); }
}

// 높이장으로 형태를 칠한다: 좌상단 광원, 면 기울기 → 램프 인덱스. 바깥 1px 은 선택적 외곽선(빛 받는 좌상단은 밝은 외곽),
// 대각으로만 닿는 바깥 픽셀은 반투명 중간색(손 AA). h(x,y) < 0 이면 형태 밖.
function shade(p, ox, oy, w, h, hf, ramp, o = {}) {
  const base = o.base ?? ramp.length * 0.5, gain = o.gain ?? 1.2, hg = o.hg ?? 0, lo = o.lo ?? 1;
  const hv = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : hf(x, y);
  const hc = (x, y, d) => { const v = hv(x, y); return v < 0 ? d : v; };
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const v = hv(x, y);
    if (v >= 0) {
      const sx = hc(x + 1, y, v - 0.6) - hc(x - 1, y, v - 0.6), sy = hc(x, y + 1, v - 0.6) - hc(x, y - 1, v - 0.6);
      let i = base + gain * (sx + sy) * 0.5 + hg * v;
      if (o.spec && sx + sy > o.spec) i += 1.5;
      p.set(ox + x, oy + y, ri(ramp, Math.max(lo + 1, i)));
      continue;
    }
    const inR = hv(x + 1, y) >= 0, inL = hv(x - 1, y) >= 0, inD = hv(x, y + 1) >= 0, inU = hv(x, y - 1) >= 0;
    if (inR || inL || inD || inU) {
      const lit = (inR || inD) && !(inL || inU); // 형태의 좌상단 바깥 → 밝은 외곽
      p.set(ox + x, oy + y, lit ? ramp[lo + 1] : ramp[0]);
    } else if (o.aa !== false && (hv(x + 1, y + 1) >= 0 || hv(x - 1, y - 1) >= 0 || hv(x + 1, y - 1) >= 0 || hv(x - 1, y + 1) >= 0)) {
      p.set(ox + x, oy + y, ramp[lo], 110);
    }
  }
}

// ── 반복 텍스처 ──
// 돌: 어긋쌓기 블록. 블록마다 톤이 다르고, 윗변/왼변 밝음·아랫변/오른변 어두움, 저주파 얼룩, 균열, 이끼 덩어리.
function stoneTex(o = {}) {
  const R = RAMP.stone, S = 64, p = new Pix(S, S), seed = o.seed ?? 11, lift = o.lift ?? 0;
  const starts = [[0, 21, 42], [10, 31, 52], [5, 26, 47], [15, 36, 57]];
  const blockOf = (x, y) => {
    const row = y >> 4, st = starts[row];
    let k = st.length - 1;
    for (let i = 0; i < st.length; i++) if (((x - st[i] + S) % S) < ((st[(i + 1) % st.length] - st[i] + S) % S || S)) { k = i; break; }
    const s0 = st[k], s1 = st[(k + 1) % st.length];
    return { row, k, lx: (x - s0 + S) % S, bw: (s1 - s0 + S) % S || S, ly: y & 15, id: row * 4 + k };
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const b = blockOf(x, y);
    if (b.ly === 15 || b.lx === b.bw - 1) { p.set(x, y, R[1 + lift]); continue; } // 줄눈(차가운 짙은 색)
    let v = 3.6 + lift + H(b.id, 1, seed) * 1.8;
    v += (vn(x, y, 8, S, seed) - 0.5) * 2.2 + (vn(x, y, 3, S, seed + 7) > 0.74 ? 0.9 : 0);
    if (b.ly === 0) v += 2.2; else if (b.ly === 1) v += 0.9;
    if (b.lx === 0) v += 1.1;
    if (b.ly === 14) v -= 1.6;
    if (b.lx === b.bw - 2) v -= 1;
    p.set(x, y, ri(R, v));
  }
  // 균열: 블록 몇 개에 짧은 지그재그 + 아래쪽 하이라이트 1px
  for (let id = 0; id < 12; id++) {
    if (H(id, 3, seed) < 0.62) continue;
    const row = id >> 2, st = starts[row], k = id & 3;
    if (k >= st.length) continue;
    let x = (st[k] + 4 + ((H(id, 4, seed) * 8) | 0)) % S, y = row * 16 + 3 + ((H(id, 5, seed) * 4) | 0);
    for (let n = 0; n < 7; n++) {
      p.set(x, y, R[1 + lift]); p.set(x, y + 1, ri(R, 6 + lift));
      x = (x + 1) % S; if (H(id, n, seed + 9) < 0.5) y++;
      if ((y & 15) > 12) break;
    }
  }
  // 이끼 클러스터: 줄눈 아래 가장자리에 작은 덩어리(윗면 밝게, 아랫면 청록 그림자)
  if (o.moss !== false) for (let n = 0; n < 7; n++) {
    const cx = (H(n, 7, seed) * S) | 0, cy = ((H(n, 8, seed) * 4) | 0) * 16 + 13;
    const rr = 1 + ((H(n, 9, seed) * 2) | 0);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) {
      if (dx * dx * 0.6 + dy * dy > rr * rr + 0.5) continue;
      const m = 2 + (dy < 0 ? 2 : dy === 0 ? 1 : 0) + (dx < 0 ? 1 : 0) + (H(cx + dx, cy + dy, seed) < 0.3 ? 1 : 0);
      p.set((cx + dx + S) % S, (cy + dy + S) % S, ri(RAMP.moss, m - (o.mossDim ?? 1)));
    }
  }
  return p.url();
}

// 짙은 나무: 가로 판자. 물결치는 결, 옹이(결이 휘어 돈다), 판자 이음 홈, 윗변 하이라이트.
function woodTex(o = {}) {
  const R = RAMP.wood, S = 64, p = new Pix(S, S), seed = o.seed ?? 37, lift = o.lift ?? 0;
  const TAU = Math.PI * 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const pl = y >> 4, ly = y & 15;
    const seam = (pl * 23 + 9) % S;
    if (ly === 15) { p.set(x, y, R[1 + lift]); continue; }
    if (x === seam) { p.set(x, y, R[2 + lift]); continue; }
    const kx = (pl * 37 + 20) % S, ky = 7, hasK = H(pl, 2, seed) > 0.35;
    let ddx = Math.abs(x - kx); ddx = Math.min(ddx, S - ddx);
    const kd = Math.sqrt((ddx / 3.2) ** 2 + ((ly - ky) / 2) ** 2);
    const warp = 2.2 * Math.sin(TAU * x / S * (1 + (pl & 1)) + pl * 1.7) + 2 * vn(x, y, 16, S, seed) + (hasK ? 5 / (1 + kd * kd) : 0);
    const g = Math.sin((ly + warp) * 1.45);
    let v = 4.4 + lift + H(pl, 1, seed) * 1.2 + (g > 0.62 ? 1.2 : g < -0.5 ? -1 : 0) + (vn(x, y, 4, S, seed + 3) - 0.5) * 0.9;
    if (hasK && kd < 0.8) v = 3.4 + lift; else if (hasK && kd < 1.5) v = 5.8 + lift;
    if (ly === 0) v += 1.5; else if (ly === 1) v += 0.6; else if (ly === 14) v -= 1.2;
    if (x === (seam + 1) % S) v += 1.3; // 홈 오른쪽 벽은 빛을 받는다
    if (x === (seam + S - 1) % S) v -= 1;
    p.set(x, y, ri(R, v));
  }
  // 이음 홈 옆 나무못(청동)
  if (o.pegs !== false) for (let pl = 0; pl < 4; pl++) {
    const sx = ((pl * 23 + 9) % S + 3) % S, sy = pl * 16 + 6;
    p.set(sx, sy, RAMP.bronze[9]); p.set(sx + 1, sy, RAMP.bronze[7]); p.set(sx, sy + 1, RAMP.bronze[6]); p.set(sx + 1, sy + 1, RAMP.bronze[3]);
  }
  return p.url();
}

// 가죽(창·대화 본문 바탕): 낮은 대비 얼룩 + 모공 클러스터 → 글자 가독성 우선
function leatherTex() {
  const R = RAMP.leather, S = 48, p = new Pix(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 3 + (vn(x, y, 12, S, 79) - 0.5) * 1.6 + (vn(x, y, 4, S, 80) - 0.5) * 0.9;
    if (vn(x, y, 2, S, 81) > 0.82) v -= 0.8;
    p.set(x, y, ri(R, v));
  }
  return p.url();
}
// 어두운 홈(채팅·능력치 소구획·툴팁)
function darkTex() {
  const R = RAMP.dark, S = 48, p = new Pix(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.set(x, y, ri(R, 2.2 + (vn(x, y, 10, S, 51) - 0.5) * 2.4 + (vn(x, y, 3, S, 52) > 0.78 ? 0.8 : 0)));
  return p.url();
}
// 슬롯 바닥(32×32, 늘려 씀): 오목하게 파인 칸 — 위·왼쪽 안벽에 그림자, 바닥은 아래로 갈수록 조금 밝게
function slotTex() {
  const R = RAMP.dark, S = 32, p = new Pix(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 2 + (y / S) * 1.6 + (x / S) * 0.6 + (vn(x, y, 8, S, 5) - 0.5) * 0.8;
    if (y < 2 || x < 2) v = 0.4; else if (y < 3 || x < 3) v = 1;
    p.set(x, y, ri(R, v));
  }
  return p.url();
}

// ── 9-slice 프레임 ──
// 두께 w 의 띠를 단면 높이 prof[0..w-1] 로 정의 → 변마다 기울기(바깥→안)와 광원(좌상단)으로 명암.
// 위·왼쪽 변은 바깥이 높아지면 밝고, 아래·오른쪽은 반대. 모서리는 대각 이음(대각선 픽셀은 두 변의 중간 톤 = 손 AA).
// 가운데 len 구간에는 결 노이즈와 리벳(rivet)을 넣고 border-image-repeat: repeat 로 원본 크기 그대로 타일링한다.
function frame(o) {
  const { w, prof, ramp } = o, len = o.len ?? 32, S = 2 * w + len, p = new Pix(S, S);
  const base = o.base ?? ramp.length / 2, gain = o.gain ?? 1, seed = o.seed ?? 1;
  const at = (d) => prof[Math.max(0, Math.min(w - 1, d))];
  const tone = (d, light, along) => {
    if (d === 0 && o.outline !== false) return light ? ramp[o.olLit ?? 1] : ramp[0];
    if (d === w - 1 && o.inner) return light ? o.inner[0] : o.inner[1];
    const slope = at(d + 1) - at(d - 1);
    let v = base + gain * slope * (light ? 1 : -1) + (o.hg ?? 0) * at(d);
    if (o.grain) v += (vn(along, d * 3, 5, len, seed) - 0.5) * o.grain;
    if (o.spec && light && slope >= o.spec && (along + d) % 9 < 5) v += 1;
    return ri(ramp, v);
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dt = y, db = S - 1 - y, dl = x, dr = S - 1 - x;
    const dv = Math.min(dt, db), dh = Math.min(dl, dr), d = Math.min(dv, dh);
    if (d >= w) { if (o.fill) p.set(x, y, o.fill); continue; }
    const vLight = dt <= db, hLight = dl <= dr;
    let c;
    if (dv < dh) c = tone(dv, vLight, x);
    else if (dh < dv) c = tone(dh, hLight, y);
    else if (vLight === hLight) c = tone(d, vLight, x + y);
    else c = d === 0 ? ramp[0] : mixc(tone(d, true, x), tone(d, false, y), 0.5); // 우상단·좌하단 대각 이음
    p.set(x, y, c);
  }
  // 리벳: 각 변 가운데 구간 중앙
  if (o.rivet) {
    const rv = (cx, cy) => shade(p, cx - 1, cy - 1, 3, 3, (x, y) => ((x === 1 || y === 1) ? 1.4 : 0.7), o.rivetRamp ?? RAMP.gold, { base: 6, gain: 2.2, aa: false, lo: 1 });
    const m = w + (len >> 1), c = w >> 1;
    rv(m, c); rv(m, S - 1 - c); rv(c, m); rv(S - 1 - c, m);
  }
  return { url: p.url(), w };
}

// 모서리 장식: 팔각 청동 판 + 가운데 금 징 + 대각 홈. 좌상단 광원 고정이라 네 모서리에 같은 그림을 쓴다.
function ornament(size = 15) {
  const p = new Pix(size + 2, size + 2), c = (size - 1) / 2;
  shade(p, 1, 1, size, size, (x, y) => {
    const ax = Math.abs(x - c), ay = Math.abs(y - c);
    if (ax + ay > c * 1.45 || Math.max(ax, ay) > c) return -1;
    const edge = Math.min(c - ax, c - ay, c * 1.45 - ax - ay);
    let h = Math.min(2.2, edge * 0.9);
    if (Math.abs(ax - ay) < 0.6 && ax > 2.5) h -= 0.8; // 대각 홈
    return h;
  }, RAMP.bronze, { base: 6.4, gain: 1.6, hg: 0.4, spec: 1.2 });
  const r = 2.6;
  shade(p, 1 + Math.round(c - r), 1 + Math.round(c - r), Math.round(r * 2) + 1, Math.round(r * 2) + 1, (x, y) => {
    const dx = x - r, dy = y - r, q = r * r + 0.6 - dx * dx - dy * dy;
    return q < 0 ? -1 : Math.sqrt(q) * 1.4;
  }, RAMP.gold, { base: 5.8, gain: 1.7, hg: 0.3, spec: 1.6, lo: 1 });
  return p.url();
}

// 터치 패드 원형 부품: 조이스틱 받침(청동 고리 + 돌 우물), 손잡이(청동 구슬), 공격 메달(붉은 칠 + 금 테)
function joyBase(D = 116) {
  const p = new Pix(D, D), c = (D - 1) / 2, ro = c - 7, ri2 = ro - 6;
  // 우물 바닥(돌, 위쪽 안벽 그림자)
  shade(p, 0, 0, D, D, (x, y) => {
    const r = Math.hypot(x - c, y - c);
    return r > ri2 ? -1 : Math.min(3, (ri2 - r) * 0.5);
  }, RAMP.stone, { base: 1.8, gain: -1.4, aa: false, lo: 0 });
  // 청동 고리(토러스 단면)
  shade(p, 0, 0, D, D, (x, y) => {
    const r = Math.hypot(x - c, y - c);
    if (r < ri2 - 0.5 || r > ro + 0.5) return -1;
    const t = (r - ri2) / (ro - ri2) * 2 - 1;
    return Math.sqrt(Math.max(0, 1 - t * t)) * 3.2;
  }, RAMP.bronze, { base: 6, gain: 2.1, hg: 0.35, spec: 1.6 });
  return p.url();
}
function sphere(D, ramp, o = {}) {
  const p = new Pix(D + 2, D + 2), c = (D - 1) / 2;
  shade(p, 1, 1, D, D, (x, y) => {
    const r2 = (x - c) ** 2 + (y - c) ** 2, R2 = (c + 0.5) ** 2;
    if (r2 > R2) return -1;
    let h = Math.sqrt(R2 - r2) * (o.flat ?? 0.6);
    if (o.rim && Math.sqrt(r2) > c - o.rim) h += 2.2; // 바깥 테 볼록
    return h;
  }, ramp, { base: o.base ?? 5.5, gain: o.gain ?? 1.5, hg: o.hg ?? 0.12, spec: o.spec ?? 1.4 });
  return p.url();
}
function medal(D = 72) {
  const p = new Pix(D, D), c = (D - 1) / 2, rr = c - 1;
  shade(p, 0, 0, D, D, (x, y) => {
    const r = Math.hypot(x - c, y - c);
    if (r > rr) return -1;
    if (r > rr - 6) { const t = (r - (rr - 6)) / 6 * 2 - 1; return 4 + Math.sqrt(Math.max(0, 1 - t * t)) * 3; }
    return -1;
  }, RAMP.gold, { base: 5.4, gain: 1.8, hg: 0.1, spec: 1.6 });
  shade(p, 0, 0, D, D, (x, y) => {
    const r = Math.hypot(x - c, y - c);
    return r > rr - 6.5 ? -1 : Math.sqrt(Math.max(0, (rr - 6) ** 2 - r * r)) * 0.18;
  }, RAMP.red, { base: 4.6, gain: 2.2, hg: 0.12, aa: false, spec: 1.2 });
  return p.url();
}

export function buildTextures() {
  return {
    stone: stoneTex(), stone2: stoneTex({ seed: 5, lift: -1, mossDim: 2 }), wood: woodTex(), wood2: woodTex({ seed: 41, lift: 1, pegs: false }),
    leather: leatherTex(), dark: darkTex(), slot: slotTex(),
  };
}

export function buildFrames() {
  const B = RAMP.bronze, G = RAMP.gold;
  return {
    // 창·대화창·하단 바: 6px 청동 몰딩(둥근 단면) + 리벳 + 안쪽 짙은 선
    metal: frame({ w: 6, prof: [0, 3, 4.4, 4.4, 3, 1], ramp: B, base: 6.2, gain: 1.05, grain: 1.4, spec: 2, rivet: true, inner: [B[1], B[2]], seed: 3 }),
    // 작은 상자(툴팁·타겟·토스트·미니맵): 4px 청동
    thin: frame({ w: 4, prof: [0, 2.6, 2.6, 1], ramp: B, base: 6, gain: 1.4, grain: 1.2, inner: [B[1], B[2]], seed: 4 }),
    thinGold: frame({ w: 4, prof: [0, 2.6, 2.6, 1], ramp: G, base: 6.4, gain: 1.4, grain: 1.2, inner: [G[1], G[2]], seed: 4 }),
    thinRed: frame({ w: 4, prof: [0, 2.6, 2.6, 1], ramp: RAMP.red, base: 5.6, gain: 1.4, grain: 1.2, inner: [RAMP.red[1], RAMP.red[2]], seed: 4 }),
    // 버튼: 볼록 / 눌림 / 금박 / 붉은 칠 / 남색
    btn: frame({ w: 3, prof: [0, 2, 1], ramp: B, base: 6, gain: 1.8, len: 16, olLit: 0, seed: 5 }),
    btnDn: frame({ w: 3, prof: [2, 0, 1], ramp: B, base: 5, gain: 1.6, len: 16, olLit: 0, seed: 5 }),
    btnGold: frame({ w: 3, prof: [0, 2, 1], ramp: G, base: 6.6, gain: 1.8, len: 16, olLit: 0, seed: 6 }),
    btnGoldDn: frame({ w: 3, prof: [2, 0, 1], ramp: G, base: 5.4, gain: 1.6, len: 16, olLit: 0, seed: 6 }),
    btnRed: frame({ w: 3, prof: [0, 2, 1], ramp: RAMP.red, base: 5.6, gain: 1.8, len: 16, olLit: 0, seed: 7 }),
    btnNavy: frame({ w: 3, prof: [0, 2, 1], ramp: RAMP.navy, base: 5, gain: 1.8, len: 16, olLit: 0, seed: 8 }),
    // 오목 홈(본문·소구획·입력창): 위·왼쪽 안벽 어둡게, 아래·오른쪽 턱 밝게
    well: frame({ w: 3, prof: [3, 1.6, 0], ramp: RAMP.wood, base: 4.6, gain: 1.5, grain: 1, outline: false, len: 16, seed: 9 }),
    // 슬롯: 2px 깊은 홈 / 강조(금) / 드롭 가능(초록)
    slot: frame({ w: 2, prof: [2, 0], ramp: RAMP.wood, base: 4.4, gain: 1.9, outline: false, len: 16 }),
    slotHi: frame({ w: 2, prof: [2, 0], ramp: G, base: 7.4, gain: 1.6, outline: false, len: 16 }),
    slotOk: frame({ w: 2, prof: [2, 0], ramp: RAMP.moss, base: 5, gain: 1.4, outline: false, len: 16 }),
    // 액체 막대 테두리(2px 금속 홈)
    gauge: frame({ w: 2, prof: [1.4, 0], ramp: B, base: 4.2, gain: 2.2, outline: false, len: 16 }),
  };
}

export function applySkin(root) {
  try {
    for (const [k, v] of Object.entries(buildTextures())) root.style.setProperty(`--tx-${k}`, `url(${v})`);
    for (const [k, f] of Object.entries(buildFrames())) root.style.setProperty(`--fr-${k}`, `url(${f.url})`);
    root.style.setProperty('--orn', `url(${ornament()})`);
    // 터치 패드 부품은 쓰는 크기 그대로 굽는다(축소 시 도트가 깨지지 않게): 조이스틱 116/104, 공격 메달 72/64
    root.style.setProperty('--img-joy', `url(${joyBase(116)})`);
    root.style.setProperty('--img-joy-s', `url(${joyBase(104)})`);
    root.style.setProperty('--img-knob', `url(${sphere(42, RAMP.bronze, { rim: 4, flat: 0.35, base: 5.6 })})`);
    root.style.setProperty('--img-medal', `url(${medal(72)})`);
    root.style.setProperty('--img-medal-s', `url(${medal(64)})`);
  } catch (e) { console.warn('스킨 텍스처 생성 실패', e); }
}

// ── 도트 글자 ──
// 작은 해상도로 글자를 그린 뒤 알파를 이진화 → 7~9단 하이컬러 램프(위 크림 → 금 → 주황 → 아래 적갈, 휴 시프트)로 칠하고
// 윗변 하이라이트·아랫변 그림자 1도트, 선택적 외곽(위·왼쪽은 따뜻한 적갈, 아래·오른쪽은 짙은 남보라), 대각 손 AA, 차가운 그림자.
// opts: {px:글자 높이(도트), scale, hi, mid, lo, edge, shadow, font, gap}
export function pixelText(text, opts = {}) {
  const px = opts.px ?? 16, scale = opts.scale ?? 3;
  const font = opts.font ?? `bold ${px}px "굴림", Gulim, "돋움", Dotum, "Malgun Gothic", sans-serif`;
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const gap = opts.gap ?? Math.max(1, Math.round(px / 10));
  const chars = [...text], ws = chars.map((ch) => Math.ceil(m.measureText(ch).width));
  const tw = ws.reduce((s, w) => s + w + gap, 0) + 6, th = Math.ceil(px * 1.35) + 6;
  const a = document.createElement('canvas');
  a.width = tw; a.height = th;
  const ac = a.getContext('2d');
  ac.font = font; ac.textBaseline = 'top'; ac.fillStyle = '#fff';
  let cx = 3;
  chars.forEach((ch, i) => { ac.fillText(ch, cx, 3); cx += ws[i] + gap; });
  const src = ac.getImageData(0, 0, tw, th).data;
  const on = new Uint8Array(tw * th);
  let top = th, bot = 0;
  for (let i = 0; i < tw * th; i++) if (src[i * 4 + 3] > 110) { on[i] = 1; const y = (i / tw) | 0; if (y < top) top = y; if (y > bot) bot = y; }
  const hi = opts.hi ?? '#fff2b0', mid = opts.mid ?? '#e0a83a', lo = opts.lo ?? '#9a5a14', edge = opts.edge ?? '#1a0c04';
  // 램프: 어두운 쪽은 남보라로, 밝은 쪽은 크림으로 휘게
  const cool = mixc(edge, '#241040', 0.5);
  const ramp = [mixc(lo, cool, 0.45), lo, mixc(lo, mid, 0.5), mid, mixc(mid, hi, 0.4), mixc(mid, hi, 0.75), hi, mixc(hi, '#fffbea', 0.6)];
  const olLit = mixc(lo, edge, 0.55), olDark = mixc(edge, '#100828', 0.4);
  const shadow = opts.shadow === null ? null : (opts.shadow ?? '#0c0618');
  const at = (x, y) => (x >= 0 && y >= 0 && x < tw && y < th ? on[y * tw + x] : 0);
  const p = new Pix(tw, th);
  // 그림자(오른쪽 아래)
  if (shadow) for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (!at(x, y) && (at(x - 1, y - 1) || at(x - 2, y - 2)) && !(at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) p.set(x, y, shadow, at(x - 2, y - 2) && !at(x - 1, y - 1) ? 150 : 230);
  // 외곽(선택적) + 대각 AA
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (at(x, y)) continue;
    const r = at(x + 1, y), l = at(x - 1, y), d = at(x, y + 1), u = at(x, y - 1);
    if (r || l || d || u) p.set(x, y, (r || d) && !(l || u) ? olLit : olDark);
    else if (at(x + 1, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1)) p.set(x, y, olDark, 120);
  }
  // 본체: 세로 위치 → 램프, 위가 비면 +1.5(윗면 하이라이트), 아래가 비면 -1, 왼쪽이 비면 +0.5
  const span = Math.max(1, bot - top);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (!at(x, y)) continue;
    const k = (y - top) / span;
    let v = 6.2 - k * 5.6;
    if (!at(x, y - 1)) v += 1.6; else if (!at(x, y - 2)) v += 0.6;
    if (!at(x, y + 1)) v -= 1;
    if (!at(x - 1, y)) v += 0.5;
    if (!at(x + 1, y)) v -= 0.4;
    p.set(x, y, ri(ramp, v));
  }
  const small = p.canvas();
  const out = document.createElement('canvas');
  out.width = tw * scale; out.height = th * scale;
  const oc = out.getContext('2d');
  oc.imageSmoothingEnabled = false;
  oc.drawImage(small, 0, 0, out.width, out.height);
  out.className = 'ptext';
  out.style.width = out.width + 'px'; out.style.height = out.height + 'px';
  return out;
}
