// 지면 픽셀 셰이더 (ART_STYLE ★v2): 월드 좌표 기준 픽셀 단위로 재질 램프를 칠한다 → 타일 격자가 보이지 않고 이어진다.
//  1) 픽셀 → 타일(소유 판정) → 자연 지면끼리는 노이즈로 흔든 위치의 재질(유기적 경계)
//  2) 재질 셰이더: 저주파 패치 + 돌 블록(보로노이/판석)·판자·대리석 등 블록 단위 명암과 모서리 하이라이트
//  3) 클러스터 스탬프: 풀잎 덩어리·자갈·뼈·갈대 (월드 격자 기반이라 청크 경계에서도 이어짐)
//  4) 심연 쪽 절벽 면
// 소유: 워커 A.
import { R, rc, ih, vnoise, fbm } from './palette.js';

const HWp = 32, HHp = 16;
export const NATURAL = new Set(['grass', 'grass_dark', 'dirt', 'path', 'sand', 'swamp', 'ash', 'mist_floor', 'water', 'deep_water']);
const LIQUID = new Set(['water', 'deep_water', 'lava']);
const IDS = ['void', 'grass', 'grass_dark', 'dirt', 'path', 'sand', 'swamp', 'ash', 'mist_floor', 'stone_floor', 'cobble', 'wood_floor', 'carpet_red', 'bridge', 'marble', 'bone_floor', 'water', 'deep_water', 'lava'];
const IDX = Object.fromEntries(IDS.map((k, i) => [k, i]));

const toTile = (wx, wy) => { const a = wx / HWp, b = wy / HHp; return [(a + b) / 2, (b - a) / 2]; };

// 자연 지면 경계 흔들기: 픽셀 위치를 노이즈로 ±0.3타일 이동해 재질을 고른다
// uni: 타일 주변 3×3 이 모두 같은 재질이면 흔들 필요 없음(성능) — (gx,gy) → bool 캐시
function matAt(world, wx, wy, uni) {
  const A = wx / HWp, B = wy / HHp, tx = (A + B) / 2, ty = (B - A) / 2;
  const gx = Math.round(tx), gy = Math.round(ty);
  const id = world.groundAt(gx, gy);
  if (uni) {
    const k = gy * 65536 + gx;
    let u = uni.get(k);
    if (u === undefined) {
      u = true;
      for (let dy = -1; dy <= 1 && u; dy++) for (let dx = -1; dx <= 1; dx++) if (world.groundAt(gx + dx, gy + dy) !== id) { u = false; break; }
      uni.set(k, u);
    }
    if (u) return id;
  }
  if (!NATURAL.has(id)) {
    // 포장 바닥 가장자리를 풀·흙이 조금 파고든다 (격자 경계 숨김)
    if (id === 'void' || LIQUID.has(id)) return id;
    const ox = (vnoise(wx, wy, 9, 5) - 0.5) * 0.36, oy = (vnoise(wx, wy, 9, 6) - 0.5) * 0.36;
    const pid = world.groundAt(Math.round(tx + ox), Math.round(ty + oy));
    return pid === 'grass' || pid === 'grass_dark' || pid === 'dirt' ? pid : id;
  }
  const ox = (vnoise(wx, wy, 11, 1) - 0.5) * 0.55 + (vnoise(wx, wy, 4, 2) - 0.5) * 0.18;
  const oy = (vnoise(wx, wy, 11, 3) - 0.5) * 0.55 + (vnoise(wx, wy, 4, 4) - 0.5) * 0.18;
  const pid = world.groundAt(Math.round(tx + ox), Math.round(ty + oy));
  return pid !== id && NATURAL.has(pid) ? pid : id;
}

// ── 재질 셰이더: (wx,wy) 월드 px, (tx,ty) 타일 실수, (gx,gy) 소유 타일 → [r,g,b] ──
function cobbleStone(wx, wy, ramp, seed, cw = 12, chh = 7) {
  const row = Math.floor(wy / chh);
  let f1 = 9, f2 = 9, cx1 = 0, cy1 = 0, id1 = 0;
  for (let r = row - 1; r <= row + 1; r++) {
    const off = (r & 1) * cw * 0.5;
    const col = Math.floor((wx - off) / cw);
    for (let c = col - 1; c <= col + 1; c++) {
      const h1 = ih(c, r, seed), h2 = ih(c, r, seed + 1);
      const px = (c + 0.5) * cw + off + (h1 - 0.5) * cw * 0.45, py = (r + 0.5) * chh + (h2 - 0.5) * chh * 0.4;
      const dx = (wx - px) / cw, dy = (wy - py) / chh;
      const dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < f1) { f2 = f1; f1 = dd; cx1 = dx; cy1 = dy; id1 = ih(c, r, seed + 2); }
      else if (dd < f2) f2 = dd;
    }
  }
  const edge = f2 - f1;
  if (edge < 0.1) return rc(ramp, edge < 0.05 ? 0 : 1);
  let t = 5 + (id1 - 0.5) * 2.2 - (cx1 + cy1 * 1.3) * 2.6 + (vnoise(wx, wy, 3, seed) - 0.5) * 1.1;
  if (edge < 0.2) t += (cx1 + cy1 < 0 ? 1.6 : -1.8);
  return rc(ramp, Math.round(t));
}
// 아이소 격자 판석 (n 장/타일). 위·왼쪽 모서리 하이라이트, 아래·오른쪽 그림자
function slab(wx, wy, tx, ty, ramp, n, seed, base = 5, crack = true) {
  let sv = (ty + 0.5) * n;
  const rv = Math.floor(sv);
  let su = (tx + 0.5) * n + (rv & 1) * 0.5;
  const ru = Math.floor(su);
  const fu = su - ru, fv = sv - rv;
  if (fu < 0.04 || fv < 0.05) return rc(ramp, 1);
  const h = ih(ru, rv, seed);
  let t = base + (h - 0.5) * 2 + (vnoise(wx, wy, 4, seed + 3) - 0.5) * 1.2 + (vnoise(wx, wy, 16, seed + 4) - 0.5) * 1.2;
  if (fu < 0.1) t += 2; else if (fu > 0.93) t -= 1.6;
  if (fv < 0.11) t += 1; else if (fv > 0.92) t -= 1.2;
  if (crack && h > 0.72 && Math.abs(vnoise(wx, wy, 7, ru * 31 + rv) - 0.5) < 0.025) t -= 2.5;
  return rc(ramp, Math.round(t));
}

const SH = {
  grass(wx, wy) { return rc(R.grass, Math.round(3.4 + (fbm(wx, wy, 46, 5) - 0.5) * 3.6 + (vnoise(wx, wy, 7, 6) - 0.5) * 1.4)); },
  grass_dark(wx, wy) { return rc(R.grass_dark, Math.round(3.6 + (fbm(wx, wy, 46, 5) - 0.5) * 3.4 + (vnoise(wx, wy, 7, 6) - 0.5) * 1.4)); },
  dirt(wx, wy) {
    let t = 4 + (fbm(wx, wy, 34, 8) - 0.5) * 3.4 + (vnoise(wx, wy, 4, 9) - 0.5) * 1.3;
    if (Math.abs(vnoise(wx, wy, 13, 10) - 0.5) < 0.018) t -= 2;
    return rc(R.dirt, Math.round(t));
  },
  path(wx, wy) { return rc(R.path, Math.round(5 + (fbm(wx, wy, 30, 11) - 0.5) * 3 + (vnoise(wx, wy, 3.5, 12) - 0.5) * 1.4)); },
  sand(wx, wy) {
    let t = 5 + (fbm(wx, wy, 40, 13) - 0.5) * 2.4 + (vnoise(wx, wy, 3, 14) - 0.5) * 0.8;
    const rp = Math.sin(wx * 0.18 + wy * 0.55 + fbm(wx, wy, 30, 15) * 9);
    if (rp > 0.86) t += 1.3; else if (rp < -0.92) t -= 1.2;
    return rc(R.sand, Math.round(t));
  },
  swamp(wx, wy) {
    const f = fbm(wx, wy, 24, 16);
    if (f < 0.44) {
      if (f > 0.42) return rc(R.swamp, 6);
      return rc(R.deep_water, Math.round(1.5 + (vnoise(wx, wy * 2, 10, 17) - 0.5) * 1.6));
    }
    return rc(R.swamp, Math.round(4 + (f - 0.5) * 4 + (vnoise(wx, wy, 5, 18) - 0.5) * 1.4));
  },
  ash(wx, wy) {
    const c = Math.abs(vnoise(wx, wy, 17, 19) - 0.5);
    if (c < 0.012) return rc(R.lava, 6 + (c < 0.006 ? 2 : 0));
    if (c < 0.022) return rc(R.ash, 1);
    return rc(R.ash, Math.round(4 + (fbm(wx, wy, 30, 20) - 0.5) * 3.2 + (vnoise(wx, wy, 3, 21) - 0.5) * 1.2));
  },
  mist_floor(wx, wy, tx, ty) {
    const m = fbm(wx * 0.6 + wy, wy * 1.4, 30, 22);
    return m > 0.6 ? rc(R.mist, Math.round(6 + (m - 0.6) * 8)) : slab(wx, wy, tx, ty, R.mist, 2, 23, 4.2);
  },
  stone_floor(wx, wy, tx, ty) { return slab(wx, wy, tx, ty, R.stone, 2, 24, 5); },
  cobble(wx, wy) { return cobbleStone(wx, wy, R.cobble, 25); },
  bone_floor(wx, wy, tx, ty) { return slab(wx, wy, tx, ty, R.bone, 2, 26, 4); },
  wood_floor(wx, wy, tx, ty) { return planks(wx, wy, tx, ty, 4, 27); },
  bridge(wx, wy, tx, ty, gx, gy) {
    const lv = ty - gy + 0.5;
    if (lv < 0.09 || lv > 0.91) return rc(R.wood, lv < 0.05 || lv > 0.95 ? 1 : 3);
    return planks(wx, wy, ty, tx, 5, 28, true);
  },
  marble(wx, wy, tx, ty, gx, gy) {
    const lu = tx - gx + 0.5, lv = ty - gy + 0.5;
    let t = ((gx + gy) & 1 ? 6.4 : 5) + (vnoise(wx, wy, 26, 29) - 0.5) * 1.4;
    const v = fbm(wx, wy, 15, 30 + ((gx * 7 + gy) & 3));
    if (Math.abs(v - 0.5) < 0.016) t -= 2.2;
    if (lu < 0.035 || lv < 0.04) return rc(R.marble, 2);
    if (lu < 0.08) t += 2.2; else if (lu > 0.95) t -= 2.4;
    if (lv < 0.08) t += 1.4; else if (lv > 0.94) t -= 1.8;
    return rc(R.marble, Math.round(t));
  },
  carpet_red(wx, wy, tx, ty, gx, gy, world) {
    const lu = tx - gx + 0.5, lv = ty - gy + 0.5;
    const nb = (dx, dy) => world.groundAt(gx + dx, gy + dy) === 'carpet_red';
    const bd = (!nb(-1, 0) && lu < 0.16) || (!nb(1, 0) && lu > 0.84) || (!nb(0, -1) && lv < 0.16) || (!nb(0, 1) && lv > 0.84);
    if (bd) {
      const e = Math.min(!nb(-1, 0) ? lu : 1, !nb(1, 0) ? 1 - lu : 1, !nb(0, -1) ? lv : 1, !nb(0, 1) ? 1 - lv : 1);
      if (e < 0.04) return rc(R.carpet, 1);
      return rc(R.gold, e < 0.09 ? 5 : e < 0.12 ? 3 : 2);
    }
    let t = 4 + ((Math.floor(wx) + Math.floor(wy)) & 1 ? 0.3 : -0.3) + (vnoise(wx, wy, 20, 31) - 0.5) * 1.6;
    const dm = Math.abs(lu - 0.5) + Math.abs(lv - 0.5);
    if (dm > 0.26 && dm < 0.31) return rc(R.gold, 2);
    if (dm < 0.08) return rc(R.gold, 4 + (dm < 0.04 ? 1 : 0));
    return rc(R.carpet, Math.round(t));
  },
  water(wx, wy) {
    let t = 4.2 + (vnoise(wx, wy * 2.2, 30, 32) - 0.5) * 2.6 + (vnoise(wx, wy, 9, 33) - 0.5) * 1;
    if (vnoise(wx * 0.5, wy * 3, 6, 34) > 0.8) t += 2;
    return rc(R.water, Math.round(t));
  },
  deep_water(wx, wy) {
    let t = 3.6 + (vnoise(wx, wy * 2.2, 30, 32) - 0.5) * 2.4;
    if (vnoise(wx * 0.5, wy * 3, 6, 34) > 0.82) t += 1.6;
    return rc(R.deep_water, Math.round(t));
  },
  lava(wx, wy) {
    const f = fbm(wx, wy, 22, 35), c = Math.abs(f - 0.5);
    if (c < 0.08) return rc(R.lava, Math.round(9 - c * 45));
    return rc(R.lava, Math.round(2 + (vnoise(wx, wy, 5, 36) - 0.5) * 2 - c * 4));
  },
};
function planks(wx, wy, tx, ty, n, seed, bridge) {
  const sv = (ty + 0.5) * n, rv = Math.floor(sv), fv = sv - rv;
  if (fv < 0.08) return rc(R.wood, bridge ? 0 : 1);
  const su = (tx + 0.5) * 1.3 + ih(rv, 0, seed) * 3, fu = su - Math.floor(su);
  if (fu < 0.025 && !bridge) return rc(R.wood, 2);
  let t = 5 + (ih(rv, Math.floor(su), seed + 1) - 0.5) * 2 + (vnoise(tx * 26, ty * 90, 3, seed + 2) - 0.5) * 2.6;
  if (fv < 0.2) t += 1.5; else if (fv > 0.86) t -= 1.4;
  if (bridge) t -= 0.6;
  return rc(R.wood, Math.round(t));
}

// ── 스탬프 패턴: 문자 = 기준 톤 대비 오프셋 (a+3 b+2 c+1 d0 e-1 f-2), '.' 비움. 원점 = 아래 가운데 ──
const OFF = { a: 3, b: 2, c: 1, d: 0, e: -1, f: -2 };
const pat = (rows) => { const out = [], h = rows.length; rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') out.push([x - (r.length >> 1), y - h + 1, OFF[r[x]]]); }); return out; };
const TUFTS = [
  pat(['.ab.', 'abbc', 'bccd', '.ee.']),
  pat(['a..a.', 'b.ab.', 'cbcbc', '.e.e.']),
  pat(['..a..', '.abc.', 'abccd', 'cddde', '.eff.']),
  pat(['.a.', 'abc', 'cde', '.f.']),
  pat(['b...a', 'cb.bc', '.cbc.', '.eee.']),
];
const PEBBLE = [pat(['.ab.', 'bcde', '.ef.']), pat(['ab', 'ce']), pat(['.abb.', 'bccde', '.eef.'])];
const BONE = [pat(['a...a', 'bcccb', 'd...d']), pat(['ab.', '.cd', '..e'])];
const REED = [pat(['a.', 'b.', 'ca', 'cb', 'dc', 'ed']), pat(['.a', 'ab', 'bc', 'cd', 'de'])];

// 스탬프 정의: 셀 크기, 확률, 램프, 기준 톤
const STAMP = {
  grass:      { cw: 5, ch: 4, p: 0.92, ramp: R.grass, base: 4, pats: TUFTS, spill: true },
  grass_dark: { cw: 5, ch: 4, p: 0.9, ramp: R.grass_dark, base: 4, pats: TUFTS, spill: true },
  swamp:      { cw: 9, ch: 6, p: 0.35, ramp: R.swamp, base: 5, pats: REED, spill: true, onlyLand: true },
  dirt:       { cw: 9, ch: 6, p: 0.2, ramp: R.dirt, base: 4, pats: PEBBLE },
  path:       { cw: 8, ch: 5, p: 0.28, ramp: R.path, base: 5, pats: PEBBLE },
  sand:       { cw: 14, ch: 9, p: 0.12, ramp: R.sand, base: 4, pats: PEBBLE },
  ash:        { cw: 10, ch: 7, p: 0.18, ramp: R.ash, base: 4, pats: PEBBLE },
  bone_floor: { cw: 14, ch: 9, p: 0.25, ramp: R.bonewhite, base: 3, pats: BONE },
  mist_floor: { cw: 10, ch: 6, p: 0.18, ramp: R.mist, base: 5, pats: TUFTS.slice(3) },
};

/**
 * 지면을 ImageData 에 굽는다.
 * @param img ImageData (W×H), minX/minY = 캔버스 왼쪽 위의 월드 좌표
 * @param own (gx,gy) → 이 캔버스가 그 타일을 소유하는가
 */
export function bakeGround(img, minX, minY, world, own) {
  const W = img.width, H = img.height, d = img.data;
  const mat = new Uint8Array(W * H);
  const tone = new Float32Array(W * H); // 클러스터 기준 톤(패치 밝기)
  // 해안/물가 판정용 타일 플래그 캐시
  const tileFlag = new Map(), uni = new Map();
  const flag = (gx, gy) => {
    const k = gy * 65536 + gx;
    let f = tileFlag.get(k);
    if (f !== undefined) return f;
    f = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const n = world.groundAt(gx + dx, gy + dy);
      if (LIQUID.has(n)) f |= 1; else if (n !== 'void') f |= 2;
    }
    tileFlag.set(k, f);
    return f;
  };
  let lgx = 1e9, lgy = 1e9, lown = false, lvoid = true, lfl = 0;
  for (let py = 0; py < H; py++) {
    const wy = minY + py + 0.5;
    for (let px = 0; px < W; px++) {
      const wx = minX + px + 0.5;
      const A = wx / HWp, B = wy / HHp, tx = (A + B) / 2, ty = (B - A) / 2;
      const gx = Math.round(tx), gy = Math.round(ty);
      if (gx !== lgx || gy !== lgy) { lgx = gx; lgy = gy; lown = own(gx, gy); lvoid = world.groundAt(gx, gy) === 'void'; lfl = lown && !lvoid ? flag(gx, gy) : 0; }
      if (!lown || lvoid) continue;
      const id = matAt(world, wx, wy, uni);
      if (id === 'void') continue;
      const p = py * W + px;
      let c = (SH[id] || SH.dirt)(wx, wy, tx, ty, gx, gy, world);
      const liquid = LIQUID.has(id);
      // 물가: 물 쪽은 거품 띠, 땅 쪽은 젖은 어두운 띠
      if (lfl === 3) {
        let near = 9;
        for (const [ox, oy] of [[3, 0], [-3, 0], [0, 2], [0, -2], [6, 0], [-6, 0], [0, 4], [0, -4]]) {
          const m = matAt(world, wx + ox, wy + oy, uni);
          if (m !== 'void' && LIQUID.has(m) !== liquid) { near = Math.min(near, Math.abs(ox) + Math.abs(oy) * 1.5); }
        }
        if (near < 9) {
          if (liquid && id !== 'lava') c = rc(id === 'deep_water' ? R.deep_water : R.water, near <= 3 ? 9 : 7);
          else if (liquid) c = rc(R.lava, near <= 3 ? 9 : 8);
          else c = [c[0] * 0.72 | 0, c[1] * 0.74 | 0, Math.min(255, c[2] * 0.82 + 10) | 0];
        }
      }
      const i = p * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      mat[p] = IDX[id] ?? 3;
    }
  }
  // 클러스터 스탬프 (월드 격자) — 셀 루트의 재질 기준, 소유 픽셀에만 쓴다
  const x0 = minX - 8, y0 = minY - 8, x1 = minX + W + 8, y1 = minY + H + 8;
  for (const key in STAMP) {
    const S = STAMP[key];
    const seed = IDX[key] * 97;
    for (let cy = Math.floor(y0 / S.ch); cy <= Math.floor(y1 / S.ch); cy++) {
      const off = (cy & 1) * (S.cw >> 1);
      for (let cx = Math.floor((x0 - off) / S.cw); cx <= Math.floor((x1 - off) / S.cw); cx++) {
        if (ih(cx, cy, seed) > S.p) continue;
        const rx = Math.floor(cx * S.cw + off + ih(cx, cy, seed + 1) * S.cw), ry = Math.floor(cy * S.ch + ih(cx, cy, seed + 2) * S.ch);
        const lpx = rx - minX, lpy = ry - minY;
        let rootMat;
        if (lpx >= 0 && lpy >= 0 && lpx < W && lpy < H) rootMat = IDS[mat[lpy * W + lpx]];
        else { const [tx, ty] = toTile(rx + 0.5, ry + 0.5); if (world.groundAt(Math.round(tx), Math.round(ty)) === 'void') continue; rootMat = matAt(world, rx + 0.5, ry + 0.5, uni); }
        if (rootMat !== key) continue;
        const pt = S.pats[(ih(cx, cy, seed + 3) * S.pats.length) | 0];
        // 패치 밝기 따라가기 (밝은 패치의 풀은 밝게)
        const patch = key.startsWith('grass') ? (fbm(rx, ry, 46, 5) - 0.5) * 3.2 : 0;
        const b = S.base + patch + (ih(cx, cy, seed + 4) - 0.5) * 1.4;
        for (const [ox, oy, t] of pt) {
          const X = lpx + ox, Y = lpy + oy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const q = Y * W + X, m = mat[q];
          if (!m) continue;
          const mid = IDS[m];
          if (LIQUID.has(mid) || (!S.spill && mid !== key)) continue;
          if (S.onlyLand && mid === 'swamp' && fbm(X + minX, Y + minY, 24, 16) < 0.44) continue;
          const c = rc(S.ramp, Math.round(b + t));
          const i = q * 4;
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
      }
    }
  }
  return mat;
}

// 심연과 맞닿은 아래쪽 변 → 절벽 면 (흙/바위 단층, 아래로 갈수록 남색으로 페이드)
export function bakeCliffs(img, minX, minY, world, tiles) {
  const W = img.width, H = img.height, d = img.data;
  const D = 30;
  for (const [gx, gy] of tiles) {
    const id = world.groundAt(gx, gy);
    if (id === 'void') continue;
    const cx = (gx - gy) * HWp, cy = (gx + gy) * HHp;
    const top = id === 'grass' || id === 'grass_dark' || id === 'dirt' || id === 'path' ? R.dirt : id === 'ash' ? R.ash : id === 'mist_floor' ? R.mist : id === 'bone_floor' ? R.bone : id === 'sand' ? R.sand : R.stone;
    for (const [dx, dy, side] of [[1, 0, 1], [0, 1, -1]]) {
      if (world.groundAt(gx + dx, gy + dy) !== 'void') continue;
      // side 1: 오른쪽 아래 변 (cx..cx+HW), side -1: 왼쪽 아래 변 (cx-HW..cx)
      const xa = side > 0 ? cx : cx - HWp, xb = side > 0 ? cx + HWp : cx;
      for (let wx = xa; wx < xb; wx++) {
        const ey = side > 0 ? cy + HHp - (wx - cx) * 0.5 : cy + HHp - (cx - wx) * 0.5;
        const e0 = Math.ceil(ey);
        for (let k = 0; k < D; k++) {
          const wy = e0 + k;
          const X = wx - minX, Y = wy - minY;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const i = (Y * W + X) * 4;
          if (d[i + 3] === 255 && k > 0) continue; // 다른 지면 위는 덮지 않음
          let t;
          if (k < 2) t = 6;
          else t = 4.6 - k * 0.12 + (vnoise(wx, wy * 3, 6, gx) - 0.5) * 2 + (side < 0 ? 0.8 : -0.4);
          if (k >= 2 && Math.abs(vnoise(wx * 3, wy * 0.6, 8, 77) - 0.5) < 0.03) t -= 1.6;
          const c = rc(top, Math.round(t));
          const fade = k > D - 10 ? (D - k) / 10 : 1;
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = Math.round(255 * fade);
        }
      }
    }
  }
}
