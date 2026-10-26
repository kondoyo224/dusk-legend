// 리그 머리: 얼굴(눈 흰자·눈동자·눈썹·코 그림자·입·볼 홍조), 머리카락 6종(결·하이라이트 띠·긴 머리는 어깨 뒤로),
// 투구, 몬스터 머리(해골·고블린·두건·기사 투구·골렘). 재질 영역(spx) + 1px 마크. 소유: 워커 A.
import { rgbOf, C, rampOf } from './spx.js';
import { mix, shade } from './util.js';

export const HELMS = {
  cap_leather: { kind: 'cap', c: '#6a4428' },
  helm_iron:   { kind: 'iron', c: '#8a8e96' },
  helm_knight: { kind: 'knight', c: '#b0b5bd', plume: '#b02a2a' },
};
export const SKIN_RAMP = { spread: 0.72, n: 10, sat: 0.92, cold: 0.34 };
const METAL = (hex, o = {}) => ({ hex, style: 'metal', k: 4.6, rampOpt: { spread: 1.15, n: 11 }, ...o });

function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, Math.PI * 2); }
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
const hairSpec = (st, x, y, r) => ({ hex: st.hairColor || '#3b2a1e', style: 'hair', k: 4.2, head: [x, y, r], anchor: [x, y], rampOpt: { spread: 1.05, n: 10 } });

// 얼굴 방향 지표
const facing = (F) => ({ front: F.y > -0.25, fv: Math.max(0, Math.min(1, (F.y + 0.9) / 1.9)) });

// ── 뒤쪽 머리카락(긴 머리·묶은 머리·땋은 머리·단발): 정면일 땐 몸 뒤, 뒷모습일 땐 몸 앞 ──
export function drawHairBack(S, c, r, st, F, R, pose) {
  const hs = st.hair ?? 0;
  if (!st.hairColor || st.helm === 'helm_knight' || st.head !== 'human' && st.head !== 'zombie') return;
  const ctx = S.ctx, [x, y] = c;
  const sway = pose.walk ? Math.sin(pose.phase * 2) * 0.8 : 0;
  if (hs === 1) { // 긴 머리: 어깨를 덮고 등 뒤로 흐른다
    ctx.fillStyle = S.m(hairSpec(st, x, y, r));
    const top = y - r * 0.4, bot = y + r * (F.y > -0.25 ? 2.5 : 2.3), w0 = r * 1.0, w1 = r * (F.y > -0.25 ? 1.12 : 0.98);
    const pts = [[x - w0, top], [x - w1 - F.x * 0.6, bot - 2]];
    for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push([x - w1 + t * w1 * 2 + sway, bot + (i % 2 ? -2.2 : 0.6)]); }
    pts.push([x + w1 - F.x * 0.6, bot - 2], [x + w0, top]);
    poly(ctx, pts); ctx.fill();
    ell(ctx, x, y, r * 1.06, r * 1.04); ctx.fill();
  } else if (hs === 4) { // 단발: 턱선까지 둥근 덩어리
    ctx.fillStyle = S.m(hairSpec(st, x, y, r));
    ell(ctx, x - F.x * 0.5, y + r * 0.3, r * 1.16, r * 1.08); ctx.fill();
  } else if (hs === 2 || hs === 5) { // 묶은 머리 / 땋은 머리: 뒤통수에서 늘어진 꼬리
    if (F.y > 0.75) return; // 정면이면 가려짐
    const bx = x - F.x * r * 0.92, by = y - r * 0.15 - F.y * 1.2;
    const spec = hairSpec(st, bx, by, r * 0.7);
    if (hs === 2) {
      const pts = [[bx - 2, by], [bx - F.x * 3 - 2.4 + sway, by + 6], [bx - F.x * 2 + sway, by + r * 1.9], [bx - F.x * 2 + 2.4 + sway, by + 6], [bx + 2, by]];
      ctx.fillStyle = S.m({ ...spec, head: null }); poly(ctx, pts); ctx.fill();
      ctx.fillStyle = S.m({ hex: '#a83a3a', style: 'cloth', k: 2 }); ell(ctx, bx, by + 0.5, 1.8, 1.4); ctx.fill(); // 끈
    } else {
      const col = S.m({ ...spec, head: null });
      for (let i = 0; i < 5; i++) { ctx.fillStyle = col; ell(ctx, bx - F.x * i * 0.5 + sway * i * 0.3, by + 1.5 + i * 2.6, 2.1 - i * 0.12, 1.7); ctx.fill(); }
      const p = S.pt(bx, by), k = S.k;
      S.mark((X) => { const id = X.id(p[0], p[1] + 2 * k); for (let i = 0; i < 5; i++) { const yy = p[1] + (1.5 + i * 2.6 + 1.2) * k; for (let dx = -1; dx <= 1; dx++) X.shift(p[0] + dx, yy, -1.8, id ? [id] : null); } });
      ctx.fillStyle = S.m({ hex: '#c8a040', style: 'metal', k: 3 }); ell(ctx, bx - F.x * 2.4 + sway * 1.2, by + 14.5, 1.4, 1); ctx.fill();
    }
  }
}

// ── 머리 본체 ──
export function drawHead(S, c, r, st, F, R, pose) {
  const ctx = S.ctx, [x, y] = c;
  const { front, fv } = facing(F);
  switch (st.head) {
    case 'skull': return skullHead(S, x, y, r, st, F, R, front);
    case 'goblin': return goblinHead(S, x, y, r, st, F, R, front);
    case 'hood': return hoodHead(S, x, y, r, st, F, R, front);
    case 'knight': return knightHead(S, x, y, r, st, F, R, front);
    case 'golem': return golemHead(S, x, y, r, st, F, R, front);
    default: break;
  }
  const skin = st.skin || '#e8c4a0';
  // 귀 (머리 뒤쪽 깊이)
  const ears = [];
  for (const side of [-1, 1]) {
    const s = side * r * 0.96, f = -r * 0.08;
    const dep = R.y * s + F.y * f;
    ears.push({ dep, ex: x + R.x * s + F.x * f, ey: y + r * 0.12 + dep * 0.12 });
  }
  const skinSpec = { hex: skin, style: 'skin', k: 3, sphere: [x - r * 0.15, y - r * 0.12, r * 1.15, r * 1.15], rampOpt: SKIN_RAMP };
  for (const e of ears) if (e.dep < -r * 0.3) { ctx.fillStyle = S.m({ hex: shade(skin, -0.08), style: 'skin', k: 3, sphere: [e.ex, e.ey, 1.6, 2.2], rampOpt: SKIN_RAMP }); ell(ctx, e.ex, e.ey, 1.4, 2.1); ctx.fill(); }
  const skinCol = S.m(skinSpec);
  const skinId = S.specs.length - 1;
  const headPath = () => { ctx.beginPath(); ctx.ellipse(x, y, r * 0.93, r, 0, 0, Math.PI * 2); ctx.moveTo(x + F.x * r * 0.32 + r * 0.6, y + r * 0.42); ctx.ellipse(x + F.x * r * 0.32, y + r * 0.42, r * 0.6, r * 0.56, 0, 0, Math.PI * 2); };
  ctx.fillStyle = skinCol; headPath(); ctx.fill();
  for (const e of ears) if (e.dep >= -r * 0.3 && Math.abs(F.y) < 0.95) { ctx.fillStyle = S.m({ hex: shade(skin, -0.05), style: 'skin', k: 3, sphere: [e.ex, e.ey, 1.6, 2.2], rampOpt: SKIN_RAMP }); ell(ctx, e.ex, e.ey, 1.3, 2); ctx.fill(); }
  // 얼굴 마크
  if (front && S.ctx.getTransform().b === 0) faceMarks(S, x, y, r, F, R, st, skinId);
  // 수염
  if (st.beard && front) {
    const bc = st.beardColor || st.hairColor || '#ccc';
    const fx = x + F.x * r * 0.42;
    ctx.fillStyle = S.m({ hex: bc, style: 'hair', k: 3.4, anchor: [x, y] });
    ctx.beginPath(); ctx.moveTo(fx - r * 0.62 * (0.5 + 0.5 * F.y), y + r * 0.28); ctx.quadraticCurveTo(fx - r * 0.7, y + r * 1.35, fx, y + r * 1.55); ctx.quadraticCurveTo(fx + r * 0.7, y + r * 1.35, fx + r * 0.62 * (0.5 + 0.5 * F.y), y + r * 0.28);
    ctx.lineTo(fx + r * 0.25, y + r * 0.6); ctx.lineTo(fx - r * 0.25, y + r * 0.6); ctx.closePath(); ctx.fill();
  }
  if (st.helm && HELMS[st.helm]) { if (HELMS[st.helm].kind !== 'knight') hairTop(S, x, y, r, st, F, R, front, fv, skinCol, headPath, true); drawHelm(S, x, y, r, HELMS[st.helm], F, R, front); return; }
  if (st.hairColor) hairTop(S, x, y, r, st, F, R, front, fv, skinCol, headPath, false);
}

// 머리 윗부분: 캡 → 얼굴 창(피부로 다시) → 앞머리/옆머리/삐침
function hairTop(S, x, y, r, st, F, R, front, fv, skinCol, headPath, underHelm) {
  const ctx = S.ctx, hs = st.hair ?? 0;
  const col = S.m(hairSpec(st, x, y, r));
  const capR = r * (hs === 3 ? 1.06 : 1.08);
  const cx = x - F.x * r * 0.08, cy = y - r * 0.14;
  ctx.fillStyle = col;
  ell(ctx, cx, cy, capR, capR * (hs === 4 ? 1.02 : 0.98)); ctx.fill();
  if (hs === 1 || hs === 4) { // 옆머리 덩어리 (얼굴 옆을 따라 내려옴)
    const len = hs === 1 ? r * 1.2 : r * 0.75;
    for (const side of [-1, 1]) {
      const s = side * r * 0.9, dep = R.y * s - F.y * r * 0.3;
      if (dep < -r * 0.5) continue;
      const lx = x + R.x * s - F.x * r * 0.3;
      ctx.beginPath(); ctx.moveTo(lx - 2, y - r * 0.3); ctx.lineTo(lx + 2, y - r * 0.3); ctx.lineTo(lx + 1.6 - side * 0.4, y + len); ctx.lineTo(lx - 1.6 - side * 0.4, y + len - 1.5); ctx.closePath(); ctx.fill();
    }
  }
  if (F.y > -0.8) {
    // 얼굴 창: 헤어라인 아래로 피부를 다시 드러낸다 (머리 실루엣 안에서만)
    const narrow = hs === 1 || hs === 4 ? 0.82 : 1;
    const rx = r * (0.3 + 0.52 * fv) * narrow, wx = x + F.x * r * (1 - fv * 0.55) * 0.75;
    const top = hs === 3 ? 0.42 : hs === 4 ? 0.2 : 0.3;
    ctx.save(); headPath(); ctx.clip();
    ctx.fillStyle = skinCol;
    ctx.beginPath(); ctx.ellipse(wx, y + r * 0.42, rx, r * (0.42 + top) * 1.02, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(wx - rx, y + r * 0.42, rx * 2, r * 2);
    ctx.restore();
    if (!underHelm && front) {
      // 앞머리: 헤어라인에서 내려오는 뾰족한 덩어리
      ctx.fillStyle = col;
      const hy = y + r * 0.42 - r * (0.42 + top), n = hs === 3 ? 4 : hs === 4 ? 5 : 3;
      const L = hs === 4 ? r * 0.42 : hs === 3 ? r * 0.38 : hs === 1 ? r * 0.36 : r * 0.3;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1), bx = wx - rx * 0.86 + t * rx * 1.72;
        const lean = hs === 1 || hs === 2 ? -1.6 : hs === 3 ? (t - 0.5) * 2 : 0;
        const w = rx * 1.8 / n;
        ctx.beginPath(); ctx.moveTo(bx - w * 0.75, hy - 1); ctx.lineTo(bx + w * 0.75, hy - 1); ctx.lineTo(bx + lean, hy + L * (hs === 4 ? 1 : 0.7 + 0.3 * Math.abs(Math.sin(i * 2.1 + 1)))); ctx.closePath(); ctx.fill();
      }
      if (hs === 4) ctx.fillRect(wx - rx * 0.95, hy - 1, rx * 1.9, L * 0.7);
    }
  }
  if (hs === 3 && !underHelm) { // 뻗친 머리: 위로 솟은 삐침
    ctx.fillStyle = col;
    for (const [i, h] of [[-2, 0.9], [-1, 1.35], [0, 1.1], [1, 1.45], [2, 0.8], [-0.5, 0.7]]) {
      const bx = x + i * r * 0.42 - F.x * 1.5;
      ctx.beginPath(); ctx.moveTo(bx - 2.6, y - r * 0.5); ctx.lineTo(bx + i * 1.8 - F.x * 3, y - r * (0.75 + h * 0.6)); ctx.lineTo(bx + 2.2, y - r * 0.5); ctx.closePath(); ctx.fill();
    }
  }
  // 정수리 가르마/결 마크: 하이라이트 클러스터 몇 개
  const p = S.pt(x, y), k = S.k;
  S.mark((X) => {
    const id = X.id(p[0], p[1] - r * 0.7 * k);
    if (!id) return;
    for (let i = 0; i < 4; i++) {
      const hx = p[0] + (-0.55 + i * 0.22) * r * k, hy = p[1] - (0.62 - Math.abs(i - 1.2) * 0.07) * r * k;
      X.shift(hx, hy, 1.4, [id]); X.shift(hx + 1, hy, 0.8, [id]); X.shift(hx - 1, hy + 1, -0.6, [id]);
    }
  });
}

// ── 얼굴 1px 마크 ──
function faceMarks(S, x, y, r, F, R, st, skinId) {
  const p = S.pt(x, y), k = S.k, q = (r * k) / 7.3;
  const big = q > 1.35;
  const eyes = [];
  for (const side of [-1, 1]) {
    const s3 = side * 2.5, f3 = 3.8;
    const dep = R.y * s3 + F.y * f3;
    if (dep < -0.6) continue;
    eyes.push({ side, x: p[0] + (R.x * s3 + F.x * f3) * q, y: p[1] + 1.4 * q + dep * 0.22 * q, w: dep > 2.2 ? 2 : 1, dep });
  }
  const zombie = st.head === 'zombie', ghoul = st.head === 'ghoul';
  const fem = st.female;
  const hairRamp = rampOf(st.hairColor || '#3b2a1e');
  const brow = hairRamp[Math.max(0, Math.round(hairRamp.mid - (fem ? 1.5 : 2.5)))];
  const ctr = p[0] + F.x * 3.8 * q; // 얼굴 중심선
  const glowEye = ghoul ? rgbOf('#ffe060') : null;
  S.mark((X) => {
    const only = [skinId];
    for (const e of eyes) {
      const ex = Math.round(e.x - (e.w === 2 ? 0.5 : 0)), ey = Math.round(e.y - 0.5);
      const outer = e.x < ctr ? -1 : 1;           // 바깥쪽 방향
      const wx = e.w === 2 ? (outer < 0 ? ex : ex + 1) : ex, ix = e.w === 2 ? (outer < 0 ? ex + 1 : ex) : ex;
      if (zombie) { X.put(ex, ey, [200, 210, 120], 255, only); if (e.w === 2) X.put(ex + 1, ey, [90, 80, 40], 255, only); X.shift(ex, ey - 1, -1.6, only); continue; }
      if (ghoul) { X.put(ex, ey, glowEye, 255, only); if (e.w === 2) X.put(ex + 1, ey, glowEye, 255, only); X.shift(ex, ey - 1, -2, only); continue; }
      // 눈썹
      const by = ey - (big ? 3 : 2);
      X.put(ix, by, brow, 255, only); if (e.w === 2) X.put(wx, by + (fem ? 0 : 0), brow, fem ? 170 : 255, only);
      // 속눈썹 줄 + 흰자/눈동자
      if (big) {
        for (let dx = 0; dx < e.w + 1; dx++) X.put(ex + dx - (outer < 0 ? 1 : 0), ey - 1, C.lash, 255, only);
        X.put(ix, ey, C.iris, 255, only); X.put(ix, ey + 1, C.iris, 255, only); X.put(wx, ey, C.eyeW, 255, only); X.put(wx, ey + 1, C.eyeW, 255, only);
        if (e.w === 2) X.put(ix + (outer < 0 ? 1 : -1), ey, C.iris, 255, only);
      } else {
        X.put(ix, ey, C.lash, 255, only); if (e.w === 2) X.put(wx, ey, C.lash, 255, only);
        X.put(ix, ey + 1, C.iris, 255, only); if (e.w === 2) X.put(wx, ey + 1, C.eyeW, 255, only);
        if (fem && e.w === 2) X.put(wx + outer, ey, C.lash, 150, only);
      }
      // 볼 홍조 (AA 1~2px)
      if (fem || st.blush) { X.put(wx + outer * 0.2, ey + 2 + (big ? 1 : 0), C.blush, 110, only); if (big) X.put(wx + outer, ey + 3, C.blush, 70, only); }
      else X.shift(wx, ey + 2, -0.5, only); // 남자: 광대 그늘
    }
    // 코: 정면은 그림자 1px(오른쪽 = 그늘), 옆모습은 1px 돌출
    const ny = Math.round(p[1] + (1.4 + 2.2) * q + F.y * 0.6 * q);
    if (Math.abs(F.x) > 0.9 && Math.abs(F.y) < 0.2) {
      const nx = Math.round(p[0] + F.x * (r * k * 0.93 + 0.2));
      X.shift(nx - F.x, ny, -1.2, only);
    } else {
      const nx = Math.round(ctr + (F.x >= 0 ? 0.5 : -0.5));
      X.shift(nx + 1, ny, -1.6, only); X.shift(nx, ny - 1, 0.6, only);
      if (big) X.shift(nx + 1, ny - 1, -0.8, only);
    }
    // 입
    const my = ny + (big ? 3 : 2), mx = Math.round(ctr - (Math.abs(F.x) > 0.5 ? F.x * 0.5 : 0.5));
    if (ghoul || zombie) { X.put(mx, my, [60, 14, 18], 255, only); X.put(mx + 1, my, [60, 14, 18], 255, only); if (ghoul) { X.put(mx, my + 1, C.teeth, 255, only); X.put(mx + 1, my, [90, 20, 24], 255, only); } }
    else {
      const lip = fem ? C.lip : X.col(skinId, X.specs[skinId].base - 2.6);
      X.put(mx, my, lip, 255, only); if (Math.abs(F.x) < 0.8) X.put(mx + 1, my, lip, fem ? 255 : 200, only);
      X.shift(mx, my + 1, 0.7, only); // 아랫입술 빛
    }
    if (zombie) { // 꿰맨 자국
      const sx = Math.round(p[0] - 2 * q), sy = Math.round(p[1] - 1 * q);
      for (let i = 0; i < 4; i++) X.put(sx + i, sy + (i & 1), [70, 40, 50], 255, only);
    }
  });
}

// ── 투구 ──
function drawHelm(S, x, y, r, Hm, F, R, front) {
  const ctx = S.ctx;
  if (Hm.kind === 'cap') {
    ctx.fillStyle = S.m({ hex: Hm.c, style: 'leather', k: 3.8, sphere: [x - 1, y - r * 0.5, r * 1.1, r * 0.9] });
    ctx.beginPath(); ctx.arc(x, y - 0.4, r * 1.06, Math.PI * 1.0, Math.PI * 2.0); ctx.lineTo(x + r * 1.08, y + 0.4); ctx.lineTo(x - r * 1.08, y + 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = S.m({ hex: shade(Hm.c, -0.15), style: 'leather', k: 3, stitch: true }); ctx.fillRect(x - r * 1.1, y - 1.2, r * 2.2, 2.2);
  } else if (Hm.kind === 'iron') {
    ctx.fillStyle = S.m(METAL(Hm.c, { sphere: [x, y - r * 0.2, r * 1.1, r * 1.05] }));
    ctx.beginPath(); ctx.arc(x, y, r * 1.1, Math.PI, 0); ctx.lineTo(x + r * 1.1, y + 1); ctx.lineTo(x - r * 1.1, y + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = S.m(METAL(shade(Hm.c, -0.15), { k: 3.6 })); ctx.fillRect(x - r * 1.12, y - 0.6, r * 2.24, 2);
    if (front) { ctx.fillStyle = S.m(METAL(Hm.c, { k: 3 })); ctx.fillRect(x + F.x * 4.4 - 0.9, y - 1, 1.8, 5); }
    // 리벳
    const p = S.pt(x, y), k = S.k;
    S.mark((X) => { const id = X.id(p[0], p[1] - 0.2 * k); for (const dx of [-5, -2, 2, 5]) { X.shift(p[0] + dx * k, p[1] + 0.1, 2, id ? [id] : null); } });
  } else {
    ctx.fillStyle = S.m(METAL(Hm.c, { sphere: [x, y, r * 1.12, r * 1.18] }));
    ell(ctx, x, y + 0.3, r * 1.12, r * 1.18); ctx.fill();
    if (front) {
      const w = r * 1.4 * (0.35 + 0.65 * Math.max(0, F.y));
      ctx.fillStyle = S.m({ hex: '#14121c', style: 'flat', k: 1, ao: false, cast: false });
      ctx.fillRect(x + F.x * 3.6 - w / 2, y - 0.2, w, 1.6); ctx.fillRect(x + F.x * 3.9 - 0.6, y, 1.2, 4.4);
    }
    // 볏 장식
    ctx.fillStyle = S.m({ hex: Hm.plume, style: 'hair', k: 4, anchor: [x, y] });
    ctx.beginPath(); ctx.moveTo(x - 1, y - r * 1.12); ctx.quadraticCurveTo(x - F.x * 8, y - r * 1.95, x - F.x * 13 - 1, y + 2); ctx.quadraticCurveTo(x - F.x * 6, y - r * 1.05, x + 1.5, y - r * 0.85); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - 1.4, y - r * 1.55, 2.8, r * 0.6);
  }
}

// ── 몬스터 머리 ──
function skullHead(S, x, y, r, st, F, R, front) {
  const ctx = S.ctx;
  const bone = st.skin || '#e0d6bc';
  ctx.fillStyle = S.m({ hex: bone, style: 'bone', k: 4, sphere: [x - 0.5, y - 0.8, r * 1.0, r * 1.05] });
  ell(ctx, x, y - 0.4, r * 0.95, r * 0.95); ctx.fill();
  ctx.fillRect(x + F.x * 2 - r * 0.55, y + r * 0.2, r * 1.1, r * 0.55);
  ctx.fillStyle = S.m({ hex: shade(bone, -0.08), style: 'bone', k: 3.4 }); // 턱뼈
  ell(ctx, x + F.x * 2.2, y + r * 0.78, r * 0.55, r * 0.3); ctx.fill();
  const p = S.pt(x, y), k = S.k, q = k * r / 7.3;
  const glow = st.eyeGlow ? rgbOf(st.eyeGlow) : null;
  const eyes = [];
  for (const side of [-1, 1]) { const dep = R.y * side * 2.4 + F.y * 3.8; if (front && dep > -0.6) eyes.push([p[0] + (R.x * side * 2.4 + F.x * 3.8) * q, p[1] + 0.8 * q + dep * 0.2 * q, dep > 2 ? 2 : 1]); }
  S.mark((X) => {
    const id = X.id(p[0], p[1]);
    for (const [ex, ey, w] of eyes) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < w; dx++) X.put(Math.round(ex - 0.5) + dx, Math.round(ey - 0.5) + dy, [26, 16, 28], 255, id ? null : null);
    if (front) {
      const nx = Math.round(p[0] + F.x * 4 * q), ny = Math.round(p[1] + 3 * q);
      X.put(nx, ny, [40, 26, 34]);
      for (let i = -2; i <= 2; i++) { const tx = Math.round(p[0] + F.x * 3.6 * q + i), ty = Math.round(p[1] + 5.2 * q); if (X.id(tx, ty)) X.shift(tx, ty, (i & 1) ? -2.4 : 1, null); }
      // 금
      X.shift(p[0] - 3 * q, p[1] - 4 * q, -2); X.shift(p[0] - 2 * q, p[1] - 3 * q, -2); X.shift(p[0] - 2 * q, p[1] - 2 * q, -1.6);
    }
  });
  if (glow && eyes.length) S.postMark((P) => { for (const [ex, ey] of eyes) { const x0 = Math.round(ex - 0.5), y0 = Math.round(ey - 0.5); P.add(x0, y0, glow, 255); P.add(x0, y0 + 1, glow, 140); } });
  if (st.crownHelm) crownHelm(S, x, y, r, st, F);
}
function goblinHead(S, x, y, r, st, F, R, front) {
  const ctx = S.ctx;
  const skin = st.skin;
  const ear = (side, behind) => {
    const ex = x + R.x * side * r * 0.86, ey = y - 0.5 + R.y * side * r * 0.35;
    const dep = R.y * side;
    if (behind !== dep < -0.2) return;
    ctx.fillStyle = S.m({ hex: shade(skin, -0.06), style: 'skin', k: 3.2 });
    poly(ctx, [[ex, ey - 2.4], [ex + R.x * side * 8 - F.x * 2.5, ey - 5], [ex + R.x * side * 2, ey + 1.5], [ex, ey + 2.4]]); ctx.fill();
  };
  ear(-1, true); ear(1, true);
  ctx.fillStyle = S.m({ hex: skin, style: 'skin', k: 4, sphere: [x - 0.6, y - 0.6, r, r * 0.95] });
  ell(ctx, x, y, r, r * 0.9); ctx.fill();
  ell(ctx, x + F.x * r * 0.35, y + r * 0.45, r * 0.62, r * 0.5); ctx.fill();
  const skinId = S.specs.length - 1;
  ear(-1, false); ear(1, false);
  if (!front) return;
  const p = S.pt(x, y), k = S.k, q = k * r / 7.3;
  const eyes = [];
  for (const side of [-1, 1]) { const dep = R.y * side * 2.6 + F.y * 3.6; if (dep > -0.6) eyes.push([p[0] + (R.x * side * 2.6 + F.x * 3.6) * q, p[1] + 0.6 * q + dep * 0.2 * q, dep > 2 ? 2 : 1]); }
  S.mark((X) => {
    const only = [skinId];
    for (const [ex, ey, w] of eyes) {
      const x0 = Math.round(ex - 0.5), y0 = Math.round(ey - 0.5);
      X.shift(x0, y0 - 1, -2.2, only); if (w === 2) X.shift(x0 + 1, y0 - 1, -2.2, only);
      X.put(x0, y0, [255, 214, 60], 255, only); if (w === 2) { X.put(x0 + 1, y0, [255, 214, 60], 255, only); X.put(x0 + (ex < p[0] + F.x * 3.6 * q ? 1 : 0), y0, [40, 20, 10], 255, only); }
    }
    const nx = Math.round(p[0] + F.x * 5 * q), ny = Math.round(p[1] + 2.4 * q);
    X.shift(nx, ny, 1.2, only); X.shift(nx + 1, ny + 1, -1.8, only);
    if (Math.abs(F.x) > 0.9) { const ox = Math.round(p[0] + F.x * (r * k + 1)); if (!X.id(ox, ny)) X.put(ox, ny, X.col(skinId, X.specs[skinId].base)); }
    const my = Math.round(p[1] + 4.6 * q), mx = Math.round(p[0] + F.x * 3.4 * q);
    for (let i = -2; i <= 1; i++) X.put(mx + i, my, [50, 18, 14], 255, only);
    X.put(mx - 1, my + 1, C.teeth, 255, only); X.put(mx + 1, my - 1, C.teeth, 255, only);
  });
}
function hoodHead(S, x, y, r, st, F, R, front) {
  const ctx = S.ctx;
  const hc = st.hoodColor || st.body;
  ctx.fillStyle = S.m({ hex: hc, style: 'cloth', k: 4.2, sphere: [x - 1, y - r * 0.4, r * 1.3, r * 1.4], fold: 0.8, anchor: [x, y] });
  poly(ctx, [[x - r * 1.18, y + r * 1.0], [x - r * 1.32, y - r * 0.3], [x - r * 0.9, y - r * 1.15], [x - F.x * 2.5, y - r * 1.55], [x + r * 0.9, y - r * 1.15], [x + r * 1.32, y - r * 0.3], [x + r * 1.18, y + r * 1.0]]); ctx.fill();
  let eyes = [];
  if (front) {
    const hx = x + F.x * 2.6, rx = r * 0.74 * (0.45 + 0.55 * Math.max(0, F.y) + 0.15);
    ctx.fillStyle = S.m({ hex: '#0c0814', style: 'flat', k: 1.2, ao: false, cast: false });
    ell(ctx, hx, y + 1, rx, r * 0.8); ctx.fill();
    if (st.face === 'skull') { ctx.fillStyle = S.m({ hex: shade(st.skin || '#c8c0a8', -0.35), style: 'bone', k: 3, sphere: [hx - 0.5, y + 1.2, r * 0.5, r * 0.6] }); ell(ctx, hx, y + 1.8, r * 0.46, r * 0.56); ctx.fill(); }
    for (const side of [-1, 1]) { const dep = R.y * side * 2.2 + F.y * 3.6; if (dep > -0.8) eyes.push(S.pt(hx + R.x * side * 2.1 + F.x * 0.8, y + 1.2)); }
  }
  const glow = rgbOf(st.eyeGlow || '#ff4a3a');
  S.postMark((P) => { for (const [ex, ey] of eyes) { const x0 = Math.round(ex), y0 = Math.round(ey); P.add(x0, y0, [255, 255, 240], 255); P.add(x0 + 1, y0, glow, 255); P.add(x0, y0 + 1, glow, 200); P.add(x0 - 1, y0, glow, 110); P.add(x0, y0 - 1, glow, 90); } });
  if (st.crown) {
    ctx.fillStyle = S.m(METAL(st.crown, { k: 4 }));
    poly(ctx, [[x - r * 0.95, y - r * 0.85], [x - r * 0.7, y - r * 1.5], [x - r * 0.3, y - r * 1.05], [x, y - r * 1.7], [x + r * 0.3, y - r * 1.05], [x + r * 0.7, y - r * 1.5], [x + r * 0.95, y - r * 0.85]]); ctx.fill();
  }
}
function knightHead(S, x, y, r, st, F, R, front) {
  const ctx = S.ctx;
  const hc = st.helmColor || '#8a9098';
  if (st.plume && F.y > 0.2) plume(S, x, y, r, st, F);
  ctx.fillStyle = S.m(METAL(hc, { sphere: [x - 0.4, y - 0.4, r * 1.08, r * 1.12] }));
  ell(ctx, x, y, r * 1.06, r * 1.1); ctx.fill();
  ctx.fillStyle = S.m(METAL(shade(hc, -0.12), { k: 3.6 })); ctx.fillRect(x - r * 1.06, y + r * 0.5, r * 2.12, 2.2);
  let eyes = [];
  if (front) {
    const w = r * 1.4 * (0.35 + 0.65 * Math.max(0, F.y));
    ctx.fillStyle = S.m({ hex: '#0a0a10', style: 'flat', k: 1, ao: false, cast: false });
    ctx.fillRect(x + F.x * 3.4 - w / 2, y - 0.6, w, 1.8);
    if (st.eyeGlow) for (const side of [-1, 1]) { const dep = R.y * side * 2 + F.y * 3.6; if (dep > -0.8) eyes.push(S.pt(x + F.x * 3.4 + R.x * side * 2, y)); }
    const p = S.pt(x + F.x * 3.6, y + 2.5), k = S.k;
    S.mark((X) => { const id = X.id(p[0], p[1]); for (let i = 0; i < 3; i++) X.shift(p[0] - 2 * k + i * 2 * k, p[1], -2, id ? [id] : null); });
  }
  if (st.horns) for (const side of [-1, 1]) {
    const hx = x + R.x * side * r * 0.85, hy = y - r * 0.45;
    const pts = [[hx, hy], [hx + R.x * side * 5, hy - 1.5], [hx + R.x * side * 6.5, hy - 6], [hx + R.x * side * 4.5, hy - 11]];
    const axis = []; for (let i = 1; i < pts.length; i++) axis.push([...pts[i - 1], ...pts[i]]);
    ctx.strokeStyle = S.m({ hex: '#3a3028', style: 'bone', k: 4, axis, hw: 1.3 }); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
  if (st.plume && F.y <= 0.2) plume(S, x, y, r, st, F);
  if (st.crownHelm) crownHelm(S, x, y, r, st, F);
  if (eyes.length) { const glow = rgbOf(st.eyeGlow); S.postMark((P) => { for (const [ex, ey] of eyes) { const x0 = Math.round(ex), y0 = Math.round(ey); P.add(x0, y0, [255, 250, 240], 255); P.add(x0 - 1, y0, glow, 230); P.add(x0 + 1, y0, glow, 230); P.add(x0, y0 - 1, glow, 90); P.add(x0, y0 + 1, glow, 90); } }); }
}
function plume(S, x, y, r, st, F) {
  const ctx = S.ctx;
  ctx.fillStyle = S.m({ hex: st.plume, style: 'hair', k: 4, anchor: [x, y] });
  ctx.beginPath(); ctx.moveTo(x - 1, y - r); ctx.quadraticCurveTo(x - F.x * 9, y - r - 6, x - F.x * 12, y + 3); ctx.quadraticCurveTo(x - F.x * 5, y - r, x + 1, y - r + 2); ctx.closePath(); ctx.fill();
}
function golemHead(S, x, y, r, st, F, R, front) {
  const ctx = S.ctx;
  ctx.fillStyle = S.m({ hex: st.skin, style: 'stone', k: 4.2, sphere: [x - 1, y - 1, r * 1.1, r * 1.1] });
  poly(ctx, [[x - r, y - r * 0.6], [x - r * 0.4, y - r * 1.05], [x + r * 0.6, y - r], [x + r, y - r * 0.2], [x + r * 0.8, y + r * 0.9], [x - r * 0.8, y + r * 0.9]]); ctx.fill();
  const eyes = [];
  if (front) for (const side of [-1, 1]) { const dep = R.y * side * 2.6 + F.y * 3.6; if (dep > -0.6) eyes.push(S.pt(x + R.x * side * 2.6 + F.x * 3.6, y + 0.5 + dep * 0.2)); }
  const glow = rgbOf(st.eyeGlow || '#7fd8ff');
  S.postMark((P) => { for (const [ex, ey] of eyes) { const x0 = Math.round(ex - 0.5), y0 = Math.round(ey - 0.5); P.add(x0, y0, [240, 255, 255], 255); P.add(x0 + 1, y0, glow, 255); P.add(x0, y0 + 1, glow, 160); P.add(x0 - 1, y0, glow, 90); P.add(x0 + 2, y0, glow, 90); } });
}
function crownHelm(S, x, y, r, st, F) {
  const ctx = S.ctx;
  ctx.fillStyle = S.m(METAL(st.crown || '#c9a14a', { k: 4.4, sphere: [x - 1, y - r * 1.2, r * 1.1, r * 0.8] }));
  ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.55);
  for (let i = 0; i <= 6; i++) { const t = i / 6; ctx.lineTo(x - r + 2 * r * t, y - r * (i % 2 ? 1.25 : 2.0)); }
  ctx.lineTo(x + r, y - r * 0.55); ctx.closePath(); ctx.fill();
  const g = S.pt(x + F.x * 2, y - r * 0.95), k = S.k;
  S.postMark((P) => { P.add(g[0], g[1], [255, 60, 70], 255); P.add(g[0] + 1, g[1], [190, 20, 40], 255); P.add(g[0], g[1] - 1, [255, 190, 190], 255); for (const dx of [-4, 4]) P.add(g[0] + dx * k, g[1] + 1, [120, 200, 255], 230); });
}
export { mix };
