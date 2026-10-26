// 비인간형 몬스터: 네발짐승(쥐/늑대/멧돼지), 거미, 박쥐, 슬라임, 그림자/망령. 소유: 워커 A.
// ★A11: 재질 영역(spx Sheet) — 털 결 클러스터·배 쪽 밝은 털·키틴 광택·막 날개·영체 반투명 단계 + 1px 눈/이빨 마크.
import { shade, mix } from './util.js';
import { rgbOf, rampOf } from './spx.js';

function frame(dir, pose) {
  const a = dir * Math.PI / 4;
  const F = { x: Math.sin(a), y: -Math.cos(a) }, R = { x: Math.cos(a), y: Math.sin(a) };
  const lunge = pose.swing != null ? Math.sin(Math.min(1, pose.swing / 0.6) * Math.PI) * 7 : 0;
  const push = -pose.hurt * 3;
  return { F, R, off: lunge + push };
}
function tube(S, pts, w, spec) {
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
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
const FUR = (hex, o = {}) => ({ hex, style: 'fur', k: 4.2, ...o });

// 빛나는 눈 (외곽선 위)
function glowEyes(S, pts, col, big = false) {
  const c = rgbOf(col), hi = [255, 250, 230];
  S.postMark((P) => { for (const [x, y] of pts) { const X = Math.round(x), Y = Math.round(y); P.add(X, Y, hi, 255); P.add(X + 1, Y, c, 255); if (big) { P.add(X, Y + 1, c, 230); P.add(X + 1, Y + 1, c, 200); } P.add(X - 1, Y, c, 120); } });
}

// ── 네발짐승 ──
const QUADS = {
  rat:  { len: 15, z: 5, r: 4.4, leg: 4, head: 3.8, color: '#6e6258', belly: '#a89484', snout: 4.2, ear: 'round', tail: { len: 16, w: 1.4, color: '#c09088' }, eye: '#ff3a3a', whisker: true },
  wolf: { len: 26, z: 14, r: 6.2, leg: 13, head: 5.4, color: '#74716e', belly: '#b8b0a4', snout: 7, ear: 'point', tail: { len: 13, w: 3.6, color: '#64615e', bushy: true }, eye: '#ffd040', mane: '#55524f' },
  boar: { len: 25, z: 11, r: 8.4, leg: 9, head: 6.4, color: '#5a4434', belly: '#7a6250', snout: 6, ear: 'point', tail: { len: 5, w: 1.4, color: '#3a2c22' }, eye: '#ff6030', tusk: true, mane: '#2e241c' },
};

function drawQuad(S, ox, oy, dir, pose, Q, time) {
  const ctx = S.ctx;
  const { F, R, off } = frame(dir, pose);
  const P = (s, f, z) => [ox + R.x * s + F.x * (f + off), oy + (R.y * s + F.y * (f + off)) * 0.5 - z];
  const D = (s, f) => R.y * s + F.y * f;
  const bob = pose.walk ? Math.abs(Math.sin(pose.phase)) * 1.2 : pose.breath * 0.3;
  const z = Q.z + bob;
  const half = Q.len / 2;
  const parts = [];
  const belly = { ramp: rampOf(Q.belly), th: 0.42 };
  // 다리 4개 (먼 쪽은 어둡게)
  const legS = Q.r * 0.65;
  for (const [s, f, ph] of [[-legS, half * 0.62, 0], [legS, half * 0.62, Math.PI], [-legS, -half * 0.62, Math.PI], [legS, -half * 0.62, 0]]) {
    const sw = pose.walk ? Math.sin(pose.phase + ph) * 5 : 0;
    const lift = pose.walk ? Math.max(0, Math.cos(pose.phase + ph)) * 2.5 : 0;
    const top = P(s, f, z - Q.r * 0.2), knee = P(s, f + sw * 0.5 + (f > 0 ? 1 : -1), Q.leg * 0.45 + lift), foot = P(s, f + sw, lift);
    const far = D(s, f) < D(0, 0);
    parts.push({ d: D(s, f) - 0.5, draw() {
      const lw = Math.max(1.8, Q.r * 0.5);
      tube(S, [top, knee], lw * 1.25, FUR(Q.color, { furY: 0.4, furX: 1.2, base: rampOf(Q.color).mid - (far ? 1.2 : 0) }));
      tube(S, [knee, foot], lw * 0.9, FUR(shade(Q.color, -0.12), { base: rampOf(shade(Q.color, -0.12)).mid - (far ? 1 : 0) }));
      ball(S, foot[0] + F.x * 0.8, foot[1] + 0.3, lw * 0.7, lw * 0.45, { hex: shade(Q.color, -0.3), style: 'leather', k: 3 });
    } });
  }
  // 꼬리
  const tl = Q.tail;
  parts.push({ d: D(0, -half) - 0.2, draw() {
    const base = P(0, -half, z);
    const wag = Math.sin((pose.phase || 0) * 2 + time * 3) * 3;
    const mid = P(wag * 0.3, -half - tl.len * 0.5, z + (tl.bushy ? 2 : -1));
    const tip = P(wag, -half - tl.len, z + (tl.bushy ? 1 : -Q.z * 0.7));
    if (tl.bushy) { tube(S, [base, mid, tip], tl.w * 1.7, FUR(tl.color, { furX: 0.4, furY: 1 })); ball(S, tip[0], tip[1], 2.2, 2, FUR(shade(tl.color, 0.35))); }
    else tube(S, [base, mid, tip], tl.w, { hex: tl.color, style: 'skin', k: 3.4 });
  } });
  // 몸통
  parts.push({ d: 0, draw() {
    const a = P(0, -half * 0.75, z), b = P(0, half * 0.6, z + 0.5);
    tube(S, [a, b], Q.r * 2, FUR(Q.color, { under: belly, k: 4.4, anchor: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }));
    if (Q.mane) {
      ctx.fillStyle = S.m(FUR(Q.mane, { furX: 0.6, furY: 0.6, k: 2.6, base: rampOf(Q.mane).mid + 1 }));
      ctx.beginPath();
      const n = 7;
      for (let i = 0; i <= n; i++) { const t = i / n; const p = P(0, half * 0.68 - t * half * 1.0, z + Q.r * 0.7); const q2 = P(0, half * 0.68 - (t + 0.5 / n) * half * 1.0, z + Q.r * 0.7); if (!i) ctx.moveTo(p[0], p[1] + 1.5); ctx.lineTo(p[0], p[1] + 1.5); if (i < n) ctx.lineTo(q2[0] - F.x * 1.5, q2[1] - 3.6 + (i % 2)); }
      const e = P(0, half * 0.68 - half, z + Q.r * 0.2), s0 = P(0, half * 0.68, z + Q.r * 0.2);
      ctx.lineTo(e[0], e[1]); ctx.lineTo(s0[0], s0[1]); ctx.closePath(); ctx.fill();
    }
  } });
  // 머리
  const hz = z + Q.r * 0.35;
  parts.push({ d: D(0, half) + 0.6, draw() {
    const hc = P(0, half + Q.head * 0.5, hz), sn = P(0, half + Q.head * 0.5 + Q.snout, hz - Q.head * 0.35);
    const earDraw = (side) => {
      const e = P(side * Q.head * 0.55, half + Q.head * 0.2, hz + Q.head * 0.8);
      if (Q.ear === 'round') { ball(S, e[0], e[1], 2.4, 2.4, { hex: shade(Q.color, -0.05), style: 'skin', k: 3 }); const p = S.pt(e[0], e[1]); S.mark((X) => { X.put(p[0], p[1], [210, 140, 140], 255, [X.id(p[0], p[1])]); }); }
      else { ctx.fillStyle = S.m(FUR(shade(Q.color, -0.06), { k: 3.6 })); poly(ctx, [[e[0] - 2.4, e[1] + 2], [e[0] - F.x * 1.6, e[1] - 5], [e[0] + 2.4, e[1] + 2]]); ctx.fill(); }
    };
    const farFirst = R.y * -1 < R.y * 1 ? [-1, 1] : [1, -1];
    earDraw(farFirst[0]);
    ball(S, hc[0], hc[1], Q.head, Q.head * 0.9, FUR(shade(Q.color, 0.04), { under: belly, k: 4, furX: 1, furY: 1 }));
    tube(S, [hc, sn], Q.head * 1.25, FUR(shade(Q.color, 0.06), { under: belly, k: 3.8, furX: 1.2, furY: 0.6 }));
    earDraw(farFirst[1]);
    if (Q.tusk) for (const side of [-1, 1]) { const t = P(side * 2.6, half + Q.head * 0.5 + Q.snout * 0.7, hz - Q.head * 0.5); tube(S, [t, [t[0] + R.x * side * 1.5, t[1] - 1.5], [t[0] + R.x * side * 1.2, t[1] - 4]], 1.5, { hex: '#e8e0c8', style: 'bone', k: 3.4 }); }
    // 코·입·이빨
    const np = S.pt(sn[0] + F.x * Q.head * 0.5, sn[1] - 0.5), open = pose.swing != null && pose.swing > 0.2 && pose.swing < 0.7;
    S.mark((X) => {
      X.put(np[0], np[1], [30, 20, 26]); X.put(np[0] + (F.x >= 0 ? -1 : 1), np[1], [60, 40, 46]); X.put(np[0], np[1] - 1, [130, 110, 120], 180);
      if (open) { for (let i = -1; i <= 1; i++) X.put(np[0] + i - F.x, np[1] + 2, [70, 14, 20]); X.put(np[0] - 1 - F.x, np[1] + 1, [240, 236, 220]); X.put(np[0] + 1 - F.x, np[1] + 1, [240, 236, 220]); }
      if (Q.whisker) for (const s of [-1, 1]) { X.put(np[0] + s * 2, np[1] + 1, [220, 210, 200], 150); X.put(np[0] + s * 3, np[1], [220, 210, 200], 110); }
    });
    // 눈
    const eyes = [];
    if (F.y > -0.6) for (const side of [-1, 1]) {
      if (D(side * Q.head * 0.45, half + Q.head) < D(0, half) - 1) continue;
      const e = P(side * Q.head * 0.45, half + Q.head * 0.85, hz + Q.head * 0.32);
      eyes.push(S.pt(e[0], e[1]));
    }
    glowEyes(S, eyes, Q.eye, Q.head > 5);
  } });
  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.draw();
}

// ── 거미 ──
function drawSpider(S, ox, oy, dir, pose, color = '#3a302a') {
  const ctx = S.ctx;
  const { F, R, off } = frame(dir, pose);
  const P = (s, f, z) => [ox + R.x * s + F.x * (f + off), oy + (R.y * s + F.y * (f + off)) * 0.5 - z];
  const D = (s, f) => R.y * s + F.y * f;
  const z = 8 + (pose.walk ? Math.abs(Math.sin(pose.phase * 2)) : pose.breath * 0.3);
  const parts = [];
  const CH = (hex, o = {}) => ({ hex, style: 'gloss', k: 3.6, rampOpt: { spread: 0.9 }, base: rampOf(hex, { spread: 0.9 }).mid - 0.6, ...o });
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const f = 5 - k * 3.3;
    const ph = (k % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0);
    const sw = pose.walk ? Math.sin(pose.phase * 2 + ph) * 3 : 0;
    const root = P(side * 3.5, f, z), kneeP = P(side * 12, f * 1.8 + sw, z + 6), foot = P(side * 18, f * 2.7 + sw, 0);
    parts.push({ d: D(side * 11, f) - 1, draw() {
      tube(S, [root, kneeP], 1.8, CH(shade(color, 0.12)));
      tube(S, [kneeP, lerp2(kneeP, foot, 0.55), foot], 1.2, CH(shade(color, 0.05)));
    } });
  }
  parts.push({ d: 0, draw() {
    const ab = P(0, -9, z + 3), th = P(0, 2, z + 1), hd = P(0, 8, z);
    ball(S, ab[0], ab[1], 10, 8.5, CH(color, { anchor: ab }));
    const abId = S.specs.length - 1;
    const ap = S.pt(ab[0], ab[1]), k = S.k;
    S.mark((X) => {
      // 등 무늬 (붉은 모래시계) + 잔털 점
      for (let dy = -5; dy <= 4; dy++) { const w = Math.max(0, Math.round(2.6 - Math.abs(dy + 0.5) * 0.55 + (dy > 0 ? 0.6 : 0))); for (let dx = -w; dx <= w; dx++) X.put(ap[0] + dx, ap[1] + dy * k, dx < 0 ? [200, 40, 40] : [140, 20, 30], 255, [abId]); }
      for (let i = 0; i < 14; i++) X.shift(ap[0] + (ih7(i) - 0.5) * 18 * k, ap[1] + (ih7(i + 9) - 0.5) * 14 * k, 1.5, [abId]);
    });
    ball(S, th[0], th[1], 6, 5, CH(shade(color, 0.12)));
    if (F.y > -0.5) {
      ball(S, hd[0], hd[1], 4, 3.4, CH(shade(color, 0.06)));
      const eyes = [];
      for (const [s, zz] of [[-1.5, 1], [1.5, 1], [-0.6, 2], [0.6, 2]]) eyes.push(S.pt(...P(s, 10, z + zz)));
      S.postMark((Pp) => { for (const [x, y] of eyes) { Pp.add(x, y, [255, 60, 50], 255); Pp.add(x - 1, y, [140, 10, 20], 200); } Pp.add(eyes[0][0], eyes[0][1] - 1, [255, 220, 210], 200); });
      for (const s of [-1, 1]) { const m = P(s * 1.5, 11, z - 1); tube(S, [m, [m[0] + R.x * s, m[1] + 3]], 1.4, { hex: '#3a1a14', style: 'bone', k: 3 }); }
    }
  } });
  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.draw();
}
const ih7 = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };

// ── 박쥐 (항상 날갯짓) ──
function drawBat(S, ox, oy, dir, pose, color = '#4a3442') {
  const ctx = S.ctx;
  const { F, R, off } = frame(dir, pose);
  const P = (s, f, z) => [ox + R.x * s + F.x * (f + off), oy + (R.y * s + F.y * (f + off)) * 0.5 - z];
  const flap = Math.sin(pose.phase || 0);
  const z = 28 + flap * 2;
  const c = P(0, 0, z);
  for (const side of [-1, 1]) {
    const tip = P(side * 17, -2, z + flap * 9), mid = P(side * 9, 1, z + flap * 5 + 2), low = P(side * 12, -3, z - 4 + flap * 3);
    const f2 = P(side * 14, -4, z - 1 + flap * 5);
    ctx.fillStyle = S.m({ hex: shade(color, -0.05), style: 'skin', k: 3, flat: 0.6, rampOpt: { sat: 1.3 } });
    ctx.beginPath(); ctx.moveTo(c[0], c[1] - 2); ctx.quadraticCurveTo(mid[0], mid[1] - 3, tip[0], tip[1]);
    ctx.lineTo((tip[0] + f2[0]) / 2, (tip[1] + f2[1]) / 2 + 1.5); ctx.lineTo(f2[0], f2[1]); ctx.lineTo((f2[0] + low[0]) / 2, (f2[1] + low[1]) / 2 + 1.5); ctx.lineTo(low[0], low[1]);
    ctx.quadraticCurveTo((low[0] + c[0]) / 2, (low[1] + c[1]) / 2 + 2, c[0], c[1] + 2); ctx.closePath(); ctx.fill();
    // 날개 뼈
    tube(S, [[c[0], c[1] - 1], [mid[0], mid[1] - 2.5], tip], 1.3, { hex: shade(color, 0.2), style: 'bone', k: 3 });
    tube(S, [[mid[0], mid[1] - 2.5], f2], 1, { hex: shade(color, 0.15), style: 'bone', k: 3 });
  }
  ball(S, c[0], c[1], 4.5, 5, FUR(color, { furX: 1, furY: 0.8 }));
  const h = P(0, 1.5, z + 5);
  for (const side of [-1, 1]) { ctx.fillStyle = S.m(FUR(color, { k: 3 })); poly(ctx, [[h[0] + side * 1.2, h[1] - 1.5], [h[0] + side * 3.2, h[1] - 6.5], [h[0] + side * 3.4, h[1] - 0.5]]); ctx.fill(); }
  ball(S, h[0], h[1], 3.4, 3, FUR(shade(color, 0.08), { furX: 1, furY: 1 }));
  if (F.y > -0.4) {
    glowEyes(S, [S.pt(h[0] - 1.6 + F.x, h[1] - 0.5), S.pt(h[0] + 0.8 + F.x, h[1] - 0.5)], '#ff3040');
    const m = S.pt(h[0] + F.x, h[1] + 1.8);
    S.mark((X) => { X.put(m[0] - 1, m[1], [240, 236, 220]); X.put(m[0] + 1, m[1], [240, 236, 220]); X.put(m[0], m[1], [60, 14, 20]); });
  }
}

// ── 슬라임 ──
function drawSlime(S, ox, oy, dir, pose, color = '#4aa860') {
  const ctx = S.ctx;
  const { F, off } = frame(dir, pose);
  const ph = pose.walk ? pose.phase * 2 : pose.breath * 1.2;
  const sq = Math.sin(ph) * 0.12;
  const x = ox + F.x * off, y = oy + F.y * off * 0.5;
  const w = 12 * (1 + sq), h = 11 * (1 - sq);
  ctx.fillStyle = S.m({ hex: color, style: 'gloss', k: 4.6, sphere: [x - 1, y - h * 0.8, w * 1.05, h * 1.0], alpha: 228, rampOpt: { sat: 1.2 } });
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w, y - h * 1.6, x, y - h * 1.7); ctx.quadraticCurveTo(x + w, y - h * 1.6, x + w, y); ctx.quadraticCurveTo(x, y + 3, x - w, y); ctx.fill();
  const id = S.specs.length - 1;
  const p = S.pt(x, y - h * 0.8), k = S.k;
  const face = F.y > -0.3;
  S.mark((X) => {
    for (let i = 0; i < 5; i++) { const bx = p[0] + (ih7(i) - 0.5) * w * 1.3 * k, by = p[1] + (ih7(i + 5) - 0.2) * h * 0.7 * k; X.shift(bx, by, 1.6, [id]); X.shift(bx + 1, by + 1, -1, [id]); }
    if (face) { const ex = p[0] + F.x * 4 * k; for (const s of [-3, 2]) { X.put(ex + s, p[1] - 1, [16, 34, 20], 255, [id]); X.put(ex + s, p[1], [16, 34, 20], 255, [id]); X.put(ex + s + 1, p[1] - 1, [16, 34, 20], 255, [id]); X.put(ex + s, p[1] - 1, [200, 255, 210], 255, [id]); } }
  });
}

// ── 그림자 / 망령: 떠다니는 영체 (반투명 단계 + 흐르는 자락) ──
function drawSpirit(S, ox, oy, dir, pose, kind, time, tint) {
  const ctx = S.ctx;
  const { F, R, off } = frame(dir, pose);
  const ph = (pose.phase || 0) + time * 2.2;
  const fz = 8 + Math.sin(ph) * 2;
  const x = ox + F.x * off, y = oy + F.y * off * 0.5 - fz;
  const wraith = kind === 'wraith';
  let body = wraith ? '#9ab8cc' : '#2a2238';
  if (tint) body = mix(body, tint, 0.5);
  const H = wraith ? 40 : 34, W = wraith ? 11 : 10;
  const alpha = wraith ? 225 : 240;
  // 흐르는 꼬리 자락 (아래로 갈수록 3단계 투명)
  ctx.fillStyle = S.m({ hex: shade(body, wraith ? -0.08 : 0.05), style: 'cloth', k: 3.6, fold: 1.8, alpha, fade: [y - H * 0.55, y + 8], anchor: [x, y] });
  ctx.beginPath(); ctx.moveTo(x - W, y - H * 0.55);
  for (let i = 0; i <= 6; i++) { const t = i / 6, px = x - W * 1.15 + t * W * 2.3, py = y + 2 + Math.sin(ph * 1.5 + i * 1.3) * 3 + (i % 2) * 4; ctx.lineTo(px - F.x * 3, py); }
  ctx.lineTo(x + W, y - H * 0.55); ctx.closePath(); ctx.fill();
  // 몸통 (후드)
  ctx.fillStyle = S.m({ hex: body, style: 'cloth', k: 4.2, fold: 1.2, alpha, sphere: [x - 2, y - H * 0.72, W * 1.3, H * 0.4], anchor: [x, y] });
  ctx.beginPath(); ctx.moveTo(x - W, y - H * 0.45); ctx.quadraticCurveTo(x - W * 1.15, y - H, x, y - H - 4); ctx.quadraticCurveTo(x + W * 1.15, y - H, x + W, y - H * 0.45); ctx.quadraticCurveTo(x, y - H * 0.38, x - W, y - H * 0.45); ctx.closePath(); ctx.fill();
  // 팔 (공격 시 앞으로 뻗음)
  const reach = pose.swing != null ? Math.sin(Math.min(1, pose.swing / 0.6) * Math.PI) : 0;
  const claws = [];
  for (const side of [-1, 1]) {
    const sx = x + R.x * side * W * 0.9, sy = y - H * 0.62 + R.y * side * 2;
    const hx = sx + F.x * (6 + reach * 10) + R.x * side * 3, hy = sy + 8 - reach * 6 + F.y * (3 + reach * 5);
    tube(S, [[sx, sy], [sx + F.x * 4, sy + 5], [hx, hy]], 3.4, { hex: shade(body, wraith ? 0.1 : 0.08), style: 'cloth', k: 3.6, alpha });
    if (wraith) claws.push(S.pt(hx, hy));
  }
  // 얼굴 구멍 + 눈
  const hy = y - H * 0.82, eyes = [];
  if (F.y > -0.35) {
    ctx.fillStyle = S.m({ hex: '#07040c', style: 'flat', k: 1, ao: false, cast: false });
    ctx.beginPath(); ctx.ellipse(x + F.x * 3, hy, 5.5 * (0.6 + 0.4 * Math.max(0, F.y)), 5, 0, 0, Math.PI * 2); ctx.fill();
    for (const side of [-1, 1]) eyes.push(S.pt(x + F.x * 4 + R.x * side * 2.2, hy + 0.5));
  }
  const eye = rgbOf(wraith ? '#c8fff0' : '#b070ff');
  S.postMark((P) => {
    for (const [ex, ey] of eyes) { const X0 = Math.round(ex), Y0 = Math.round(ey); P.add(X0, Y0, [255, 255, 255], 255); for (const [dx, dy, a] of [[-1, 0, 220], [1, 0, 220], [0, -1, 160], [0, 1, 160], [-2, 0, 80], [2, 0, 80]]) P.add(X0 + dx, Y0 + dy, eye, a); }
    for (const [cx, cy] of claws) for (let i = -1; i <= 1; i++) for (let j = 1; j <= 3; j++) P.add(cx + i * (1 + j * 0.3) + F.x * j * 0.5, cy + j, [230, 245, 255], 220 - j * 40);
  });
}

export const BEAST_BODIES = new Set(['rat', 'wolf', 'boar', 'spider', 'bat', 'slime', 'shade', 'wraith']);
// 공중에 뜬 몸(그림자를 작게)
export const FLYING = new Set(['bat', 'shade', 'wraith', 'lich']);

export function drawBeast(S, ox, oy, body, dir, pose, look, time) {
  const tint = look.tint;
  switch (body) {
    case 'rat': case 'wolf': case 'boar': {
      const B = QUADS[body];
      const Q = tint ? { ...B, color: mix(B.color, tint, 0.5), belly: mix(B.belly, tint, 0.4), mane: B.mane && mix(B.mane, tint, 0.5), tail: { ...B.tail, color: mix(B.tail.color, tint, 0.5) } } : B;
      return drawQuad(S, ox, oy, dir, pose, Q, time);
    }
    case 'spider': return drawSpider(S, ox, oy, dir, pose, tint ? mix('#3a302a', tint, 0.5) : undefined);
    case 'bat': return drawBat(S, ox, oy, dir, pose, tint ? mix('#4a3442', tint, 0.5) : undefined);
    case 'slime': return drawSlime(S, ox, oy, dir, pose, tint || undefined);
    case 'shade': case 'wraith': return drawSpirit(S, ox, oy, dir, pose, body, time, tint);
    default: return drawQuad(S, ox, oy, dir, pose, QUADS.rat, time);
  }
}
