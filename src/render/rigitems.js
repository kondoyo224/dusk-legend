// 리그 장비: 무기·방패를 재질 영역(spx Sheet)으로 그린다. 칼날 = 금속 관(축 법선) → 빛 받는 날 1px 하이라이트·반대편 그늘. 소유: 워커 A.
import { rgbOf } from './spx.js';

export const WEAPONS = {
  sword_wood:   { len: 15, w: 2.8, blade: '#8a6a40', edge: '#a8865a', guard: '#5a3e24', grip: '#4a321c', type: 'sword', wood: true },
  sword_short:  { len: 14, w: 2.6, blade: '#b8bcc4', edge: '#e8ecf0', guard: '#7a6a4a', grip: '#4a321c', type: 'sword' },
  sword_long:   { len: 20, w: 2.8, blade: '#c0c4cc', edge: '#eef2f6', guard: '#8a7a5a', grip: '#3a2a1c', type: 'sword' },
  sword_broad:  { len: 19, w: 4.2, blade: '#b0b4bc', edge: '#e0e4ea', guard: '#6a5a4a', grip: '#3a2a1c', type: 'sword', fuller: true },
  sword_knight: { len: 22, w: 3.2, blade: '#d0d4dc', edge: '#ffffff', guard: '#c9a14a', grip: '#5a1e24', type: 'sword', fuller: true, gem: '#d03040' },
  sword_great:  { len: 28, w: 4.6, blade: '#a8acb4', edge: '#dde0e6', guard: '#5a4a3a', grip: '#3a2a1c', type: 'sword', fuller: true },
  sword_argen:  { len: 24, w: 3.6, blade: '#cfe6ff', edge: '#ffffff', guard: '#e8c860', grip: '#2a3a6a', type: 'sword', glow: '#9fd0ff', fuller: true, gem: '#60c0ff' },
  axe:          { len: 17, w: 2, blade: '#9a9ea6', edge: '#dfe2e6', guard: '#5a3e24', grip: '#6a4a2c', type: 'axe' },
  mace:         { len: 16, w: 2, blade: '#7a7e86', edge: '#b8bcc4', guard: '#5a3e24', grip: '#5a3e24', type: 'mace' },
  // 몬스터 전용
  dagger:       { len: 9, w: 2.2, blade: '#8a8a80', edge: '#c8c8c0', guard: '#3a2a1a', grip: '#3a2a1a', type: 'sword' },
  staff:        { len: 30, w: 2.2, blade: '#3a2a3a', edge: '#5a4a5a', guard: '#3a2a3a', grip: '#4a3a4a', type: 'staff', orb: '#a060ff' },
  shovel:       { len: 26, w: 2, blade: '#6a6a66', edge: '#8a8a86', guard: '#4a321c', grip: '#5a4028', type: 'shovel' },
  scythe:       { len: 30, w: 2, blade: '#6a6a74', edge: '#c8c8d8', guard: '#2a1a2a', grip: '#3a2a2a', type: 'scythe' },
  bow:          { len: 18, w: 1.5, blade: '#5a3e24', edge: '#7a5a3a', guard: '#5a3e24', grip: '#5a3e24', type: 'bow' },
  dark_great:   { len: 30, w: 5, blade: '#3a3240', edge: '#ff4a5a', guard: '#5a1a24', grip: '#2a1a20', type: 'sword', glow: '#ff3040', fuller: true, gem: '#ff3040', runes: '#ff5060' },
};
export const SHIELDS = {
  shield_wood:  { shape: 'round', r: 7, face: '#7a5432', rim: '#5a5a62', boss: '#9a9aa2' },
  shield_iron:  { shape: 'kite', r: 8, face: '#7a7e88', rim: '#5a5c64', boss: '#c9a14a', emblem: '#7a2a2a' },
  shield_tower: { shape: 'tower', r: 10, face: '#4a5a7a', rim: '#c9a14a', boss: '#c9a14a', emblem: '#d8c070' },
};

const METAL = (hex, o = {}) => ({ hex, style: 'metal', k: 4.6, rampOpt: { spread: 1.15, n: 11 }, ...o });
const WOOD = (hex, o = {}) => ({ hex, style: 'wood', k: 3.6, ...o });

function tubeR(S, pts, w, spec) {
  const ctx = S.ctx, axis = [];
  for (let i = 1; i < pts.length; i++) axis.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
  ctx.strokeStyle = S.m({ ...spec, axis, hw: w / 2 });
  ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
}
function ball(S, x, y, rx, ry, spec) {
  const ctx = S.ctx;
  ctx.fillStyle = S.m({ ...spec, sphere: [x, y, rx, ry] });
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); ctx.fill();
}
function polyR(S, pts, spec) {
  const ctx = S.ctx;
  ctx.fillStyle = S.m(spec);
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
}

// 칼날 방향(화면)
export function bladeDir(theta, F, R) {
  const th = theta * Math.PI / 180;
  const s = 0.25, f = Math.cos(th), z = Math.sin(th);
  return [R.x * s + F.x * f, (R.y * s + F.y * f) * 0.5 - z];
}
export function bladeDepth(theta, F, R) { const th = theta * Math.PI / 180; return R.y * 0.25 + F.y * Math.cos(th); }

export function drawWeapon(S, hp, theta, W, F, R) {
  const ctx = S.ctx;
  const [dx, dy] = bladeDir(theta ?? 62, F, R);
  const L = W.len, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
  const px = -uy, py = ux;
  const vis = Math.max(0.35, n);
  const tipX = hp[0] + dx * L, tipY = hp[1] + dy * L;
  if (W.type === 'bow') {
    const a = [hp[0] + px * 9, hp[1] + py * 9], b = [hp[0] - px * 9, hp[1] - py * 9], m = [hp[0] + ux * 5, hp[1] + uy * 5];
    tubeR(S, [a, [(a[0] + m[0]) / 2 + ux, (a[1] + m[1]) / 2 + uy], m, [(b[0] + m[0]) / 2 + ux, (b[1] + m[1]) / 2 + uy], b], 2, WOOD(W.blade));
    const p0 = S.pt(a[0], a[1]), p1 = S.pt(b[0], b[1]);
    S.mark((X) => { const N = Math.max(Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1])); for (let i = 0; i <= N; i++) { const t = i / Math.max(1, N); const x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t; if (!X.id(x, y)) X.put(x, y, [214, 206, 180], 200); } });
    return;
  }
  const grip = [[hp[0] - ux * 3, hp[1] - uy * 3], [hp[0] + ux * 2, hp[1] + uy * 2]];
  if (W.type === 'sword') {
    const w = W.w * 0.5;
    tubeR(S, grip, 2, { hex: W.grip, style: 'leather', k: 3 });
    ball(S, hp[0] - ux * 3.6, hp[1] - uy * 3.6, 1.5, 1.5, METAL(W.guard));
    const b0 = [hp[0] + ux * 2, hp[1] + uy * 2];
    const pts = [[b0[0] + px * w, b0[1] + py * w], [tipX - ux * 3 * vis + px * w, tipY - uy * 3 * vis + py * w], [tipX, tipY], [tipX - ux * 3 * vis - px * w, tipY - uy * 3 * vis - py * w], [b0[0] - px * w, b0[1] - py * w]];
    polyR(S, pts, W.wood ? WOOD(W.blade, { axis: [[b0[0], b0[1], tipX, tipY]], hw: w + 0.4 }) : METAL(W.blade, { axis: [[b0[0], b0[1], tipX, tipY]], hw: w + 0.3, k: 5 }));
    // 가드 (가로 막대)
    tubeR(S, [[b0[0] + px * (w + 2.4), b0[1] + py * (w + 2.4)], [b0[0] - px * (w + 2.4), b0[1] - py * (w + 2.4)]], 1.8, METAL(W.guard));
    // 날 디테일: 홈(fuller)·문양·보석 → 픽셀 마크
    const P0 = S.pt(b0[0] + ux * 2, b0[1] + uy * 2), P1 = S.pt(tipX - ux * 4, tipY - uy * 4), PG = S.pt(b0[0], b0[1]);
    const glow = W.glow ? rgbOf(W.glow) : null, gem = W.gem ? rgbOf(W.gem) : null, rune = W.runes ? rgbOf(W.runes) : null;
    S.mark((X) => {
      const id = X.id(P0[0], P0[1]);
      const N = Math.max(Math.abs(P1[0] - P0[0]), Math.abs(P1[1] - P0[1]));
      for (let i = 0; i <= N; i++) {
        const t = i / Math.max(1, N), x = P0[0] + (P1[0] - P0[0]) * t, y = P0[1] + (P1[1] - P0[1]) * t;
        if (W.fuller && id) X.shift(x, y, -1.4, [id]);
        if (rune && i % 3 === 1) X.put(x, y, rune, 255, [id]);
      }
      if (gem) { X.put(PG[0], PG[1], gem); X.put(PG[0] - 1, PG[1] - 1, [255, 255, 255], 160); }
    });
    if (glow) {
      S.postMark((P) => {
        const N = Math.max(Math.abs(P1[0] - P0[0]), Math.abs(P1[1] - P0[1]));
        for (let i = 0; i <= N; i += 1) {
          const t = i / Math.max(1, N), x = Math.round(P0[0] + (P1[0] - P0[0]) * t), y = Math.round(P0[1] + (P1[1] - P0[1]) * t);
          for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [1, -1], [-1, 1]]) if (!P.id(x + ox, y + oy)) P.add(x + ox, y + oy, glow, (i + ox + oy) & 1 ? 70 : 110);
        }
      });
    }
  } else if (W.type === 'axe') {
    tubeR(S, [[hp[0] - ux * 2, hp[1] - uy * 2], [tipX, tipY]], 2, WOOD(W.grip));
    const hx = tipX - ux * 3, hy = tipY - uy * 3;
    polyR(S, [[hx, hy], [hx + px * 7 - ux * 2.5, hy + py * 7 - uy * 2.5], [hx + px * 8.5 + ux * 1, hy + py * 8.5 + uy * 1], [hx + px * 6.5 + ux * 5, hy + py * 6.5 + uy * 5], [hx + ux * 2, hy + uy * 2]], METAL(W.blade, { k: 4 }));
    const e0 = S.pt(hx + px * 7.6 - ux * 2, hy + py * 7.6 - uy * 2), e1 = S.pt(hx + px * 7 + ux * 4.4, hy + py * 7 + uy * 4.4);
    S.mark((X) => { const id = X.id(e0[0], e0[1]); for (let i = 0; i <= 6; i++) X.shift(e0[0] + (e1[0] - e0[0]) * i / 6, e0[1] + (e1[1] - e0[1]) * i / 6, 2.2, id ? [id] : null); });
  } else if (W.type === 'mace') {
    tubeR(S, [[hp[0] - ux * 2, hp[1] - uy * 2], [tipX, tipY]], 2, WOOD(W.grip));
    for (let i = 0; i < 6; i++) { const aa = i * 1.047; ball(S, tipX + Math.cos(aa) * 3.4, tipY + Math.sin(aa) * 3.4, 1.3, 1.3, METAL(W.edge)); }
    ball(S, tipX, tipY, 3.4, 3.4, METAL(W.blade));
  } else if (W.type === 'staff') {
    tubeR(S, [[hp[0] - ux * 10, hp[1] - uy * 10], [tipX - ux * 2, tipY - uy * 2]], 2.2, WOOD(W.blade));
    // 갈고리 머리
    tubeR(S, [[tipX - ux * 2, tipY - uy * 2], [tipX + px * 3, tipY + py * 3 - 1], [tipX + px * 2 + ux * 3, tipY + py * 2 + uy * 3]], 1.6, WOOD(W.edge));
    ball(S, tipX, tipY, 2.6, 2.6, { hex: W.orb, style: 'gloss', k: 5, ao: false });
    const o = S.pt(tipX, tipY), oc = rgbOf(W.orb);
    S.postMark((P) => { for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const q = dx * dx + dy * dy; if (q < 9 || q > 25) continue; if (!P.id(o[0] + dx, o[1] + dy) && ((dx + dy) & 1) === 0) P.add(o[0] + dx, o[1] + dy, oc, q < 16 ? 120 : 60); } });
  } else if (W.type === 'shovel') {
    tubeR(S, [[hp[0] - ux * 8, hp[1] - uy * 8], [tipX, tipY]], 2, WOOD(W.grip));
    polyR(S, [[tipX + px * 3.2, tipY + py * 3.2], [tipX - px * 3.2, tipY - py * 3.2], [tipX - px * 2.6 + ux * 6, tipY - py * 2.6 + uy * 6], [tipX + ux * 8, tipY + uy * 8], [tipX + px * 2.6 + ux * 6, tipY + py * 2.6 + uy * 6]], METAL(W.blade, { k: 3.6 }));
  } else if (W.type === 'scythe') {
    tubeR(S, [[hp[0] - ux * 10, hp[1] - uy * 10], [tipX, tipY]], 2, WOOD(W.grip));
    const c1 = [tipX + px * 10 + ux * 2, tipY + py * 10 + uy * 2], c2 = [tipX + px * 14 - ux * 6, tipY + py * 14 - uy * 6];
    tubeR(S, [[tipX, tipY], [(tipX + c1[0]) / 2 + ux * 1.5, (tipY + c1[1]) / 2 + uy * 1.5], c1, c2], 2.4, METAL(W.blade, { k: 5 }));
  }
}

export function drawShield(S, hp, Sd, F, R) {
  const ctx = S.ctx;
  const nx = F.x * 0.75 - R.x * 0.65, ny = F.y * 0.75 - R.y * 0.65;
  const wf = Math.max(0.24, Math.abs(ny) * 0.9 + 0.1);
  const showFront = ny > -0.05;
  ctx.save();
  ctx.translate(hp[0] + nx * 1.5, hp[1] - 1);
  ctx.scale(wf, 1);
  const r = Sd.r;
  const shape = () => {
    ctx.beginPath();
    if (Sd.shape === 'round') ctx.arc(0, 0, r, 0, Math.PI * 2);
    else if (Sd.shape === 'kite') { ctx.moveTo(-r * 0.85, -r * 0.8); ctx.lineTo(r * 0.85, -r * 0.8); ctx.quadraticCurveTo(r * 0.9, r * 0.4, 0, r * 1.25); ctx.quadraticCurveTo(-r * 0.9, r * 0.4, -r * 0.85, -r * 0.8); }
    else ctx.rect(-r * 0.7, -r * 1.1, r * 1.4, r * 2.2);
  };
  // 테두리(금속) → 면 → 문장 → 징
  shape(); ctx.fillStyle = S.m(METAL(Sd.rim, { sphere: [0, 0, r * 1.1, r * 1.3], k: 4 })); ctx.fill();
  ctx.save(); ctx.translate(0, 0); ctx.scale(0.8, 0.84); shape(); ctx.restore();
  const faceSpec = Sd.shape === 'round' ? WOOD(showFront ? Sd.face : '#4a3424', { sphere: [0, 0, r, r], planks: 3, k: 3 }) : METAL(showFront ? Sd.face : '#3a3c44', { sphere: [-r * 0.1, -r * 0.1, r * 1.1, r * 1.4], k: 3.6 });
  ctx.fillStyle = S.m(faceSpec); ctx.fill();
  if (showFront) {
    if (Sd.emblem) {
      ctx.fillStyle = S.m({ hex: Sd.emblem, style: Sd.shape === 'tower' ? 'metal' : 'cloth', k: 3, cast: false });
      if (Sd.shape === 'tower') { ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.38, -r * 0.1); ctx.lineTo(0, r * 0.75); ctx.lineTo(-r * 0.38, -r * 0.1); ctx.closePath(); ctx.fill(); }
      else { ctx.fillRect(-1.3, -r * 0.62, 2.6, r * 1.45); ctx.fillRect(-r * 0.52, -r * 0.25, r * 1.04, 2.6); }
    }
    ball(S, 0, 0, 2, 2, METAL(Sd.boss, { k: 5 }));
  }
  ctx.restore();
}
