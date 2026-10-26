// 비인간형 몬스터: 네발짐승(쥐/늑대/멧돼지), 거미, 박쥐, 슬라임, 그림자/망령. 소유: 워커 A.
import { shade, rgba, ellipse } from './util.js';

// 반투명 내부선 (실루엣 밖은 알파 컷 → 선택적 컬러 외곽선으로 대체)
const OUT = 'rgba(36,12,48,0.5)';

function frame(dir, pose) {
  const a = dir * Math.PI / 4;
  const F = { x: Math.sin(a), y: -Math.cos(a) }, R = { x: Math.cos(a), y: Math.sin(a) };
  // 공격 = 앞으로 덮침, 피격 = 뒤로 밀림
  const lunge = pose.swing != null ? Math.sin(Math.min(1, pose.swing / 0.6) * Math.PI) * 7 : 0;
  const push = -pose.hurt * 3;
  return { F, R, off: lunge + push };
}

function capsule(ctx, a, b, r, color, outline = OUT) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline; ctx.lineWidth = r * 2 + 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = r * 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
function seg(ctx, pts, w, color, outline = OUT) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, lw] of [[outline, w + 1.4], [color, w]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
}

// ── 네발짐승 ──
const QUADS = {
  rat:  { len: 15, z: 5, r: 4.2, leg: 4, head: 3.6, color: '#6a5e54', belly: '#8a7e70', snout: 4, ear: 'round', tail: { len: 16, w: 1.2, color: '#c09088' }, eye: '#ff3a3a' },
  wolf: { len: 26, z: 14, r: 6.2, leg: 13, head: 5.4, color: '#6e6c6a', belly: '#9a9690', snout: 7, ear: 'point', tail: { len: 13, w: 3.4, color: '#5e5c5a', bushy: true }, eye: '#ffd040', mane: '#5a5856' },
  boar: { len: 25, z: 11, r: 8.4, leg: 9, head: 6.4, color: '#4a3a2e', belly: '#5e4c3e', snout: 6, ear: 'point', tail: { len: 5, w: 1.2, color: '#3a2c22' }, eye: '#ff6030', tusk: true, mane: '#2e241c' },
};

function drawQuad(ctx, ox, oy, dir, pose, Q, time) {
  const { F, R, off } = frame(dir, pose);
  const P = (s, f, z) => [ox + R.x * s + F.x * (f + off), oy + (R.y * s + F.y * (f + off)) * 0.5 - z];
  const D = (s, f) => R.y * s + F.y * f;
  const bob = pose.walk ? Math.abs(Math.sin(pose.phase)) * 1.2 : pose.breath * 0.3;
  const z = Q.z + bob;
  const half = Q.len / 2;
  const parts = [];
  // 다리 4개
  const legS = Q.r * 0.65;
  for (const [s, f, ph] of [[-legS, half * 0.62, 0], [legS, half * 0.62, Math.PI], [-legS, -half * 0.62, Math.PI], [legS, -half * 0.62, 0]]) {
    const sw = pose.walk ? Math.sin(pose.phase + ph) * 5 : 0;
    const lift = pose.walk ? Math.max(0, Math.cos(pose.phase + ph)) * 2.5 : 0;
    const top = P(s, f, z - Q.r * 0.3), knee = P(s, f + sw * 0.5 + (f > 0 ? 1 : -1), Q.leg * 0.45 + lift), foot = P(s, f + sw, lift);
    parts.push({ d: D(s, f) - 0.5, draw() { seg(ctx, [top, knee, foot], Math.max(1.6, Q.r * 0.42), shade(Q.color, -0.15)); } });
  }
  // 꼬리
  const tl = Q.tail;
  parts.push({ d: D(0, -half) - 0.2, draw() {
    const base = P(0, -half, z);
    const wag = Math.sin((pose.phase || 0) * 2 + time * 3) * 3;
    const mid = P(R.x * 0 + wag * 0.3, -half - tl.len * 0.5, z + (tl.bushy ? 2 : -1));
    const tip = P(wag, -half - tl.len, z + (tl.bushy ? 1 : -Q.z * 0.7));
    if (tl.bushy) { seg(ctx, [base, mid, tip], tl.w * 1.6, tl.color); ctx.fillStyle = shade(tl.color, 0.3); ellipse(ctx, tip[0], tip[1], 2, 2); ctx.fill(); }
    else seg(ctx, [base, mid, tip], tl.w, tl.color);
  } });
  // 몸통
  parts.push({ d: 0, draw() {
    const a = P(0, -half * 0.75, z), b = P(0, half * 0.6, z + 0.5);
    capsule(ctx, a, b, Q.r, Q.color);
    // 배 음영 + 등 하이라이트
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(Q.belly, 0.5); ctx.lineWidth = Q.r * 0.9;
    ctx.beginPath(); ctx.moveTo(a[0], a[1] + Q.r * 0.45); ctx.lineTo(b[0], b[1] + Q.r * 0.45); ctx.stroke();
    ctx.strokeStyle = rgba(shade(Q.color, 0.3), 0.6); ctx.lineWidth = Q.r * 0.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1] - Q.r * 0.5); ctx.lineTo(b[0], b[1] - Q.r * 0.5); ctx.stroke();
    if (Q.mane) {
      ctx.fillStyle = Q.mane;
      for (let i = 0; i < 6; i++) { const t = i / 5; const p = P(0, half * 0.6 - t * half * 0.9, z + Q.r * 0.75); ctx.beginPath(); ctx.moveTo(p[0] - 2, p[1] + 1); ctx.lineTo(p[0] - F.x * 2, p[1] - 3.5); ctx.lineTo(p[0] + 2, p[1] + 1); ctx.fill(); }
    }
  } });
  // 머리
  const hz = z + Q.r * 0.35;
  parts.push({ d: D(0, half) + 0.6, draw() {
    const hc = P(0, half + Q.head * 0.5, hz), sn = P(0, half + Q.head * 0.5 + Q.snout, hz - Q.head * 0.35);
    // 귀
    for (const side of [-1, 1]) {
      const e = P(side * Q.head * 0.55, half + Q.head * 0.2, hz + Q.head * 0.8);
      ctx.fillStyle = shade(Q.color, -0.1);
      if (Q.ear === 'round') { ellipse(ctx, e[0], e[1], 2.4, 2.4); ctx.fill(); ctx.fillStyle = '#c09088'; ellipse(ctx, e[0], e[1], 1.3, 1.3); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(e[0] - 2.2, e[1] + 2); ctx.lineTo(e[0] - F.x * 1.5, e[1] - 4.5); ctx.lineTo(e[0] + 2.2, e[1] + 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke(); }
    }
    capsule(ctx, hc, sn, Q.head * 0.62, Q.color);
    ctx.fillStyle = shade(Q.color, 0.05); ellipse(ctx, hc[0], hc[1], Q.head, Q.head * 0.9); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = '#1a1414'; ellipse(ctx, sn[0], sn[1], 1.5, 1.2); ctx.fill();
    if (Q.tusk) { ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1.4; for (const side of [-1, 1]) { const t = P(side * 2.5, half + Q.head * 0.5 + Q.snout * 0.7, hz - Q.head * 0.5); ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0] + R.x * side * 1.5, t[1] - 3.5); ctx.stroke(); } }
    // 눈
    if (F.y > -0.6) for (const side of [-1, 1]) {
      const e = P(side * Q.head * 0.45, half + Q.head * 0.9, hz + Q.head * 0.3);
      if (D(side * Q.head * 0.45, half + Q.head) < D(0, half) - 1) continue;
      ctx.fillStyle = Q.eye; ctx.fillRect(e[0] - 0.8, e[1] - 0.8, 1.6, 1.6);
    }
    if (pose.swing != null && pose.swing > 0.2 && pose.swing < 0.7) { ctx.fillStyle = '#3a0a0a'; ellipse(ctx, sn[0], sn[1] + 2, 2.4, 1.6); ctx.fill(); ctx.fillStyle = '#eee'; ctx.fillRect(sn[0] - 1.5, sn[1] + 1, 1, 1.5); ctx.fillRect(sn[0] + 0.5, sn[1] + 1, 1, 1.5); }
  } });
  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.draw();
}

// ── 거미 ──
function drawSpider(ctx, ox, oy, dir, pose, color = '#2a2420') {
  const { F, R, off } = frame(dir, pose);
  const P = (s, f, z) => [ox + R.x * s + F.x * (f + off), oy + (R.y * s + F.y * (f + off)) * 0.5 - z];
  const D = (s, f) => R.y * s + F.y * f;
  const z = 8 + (pose.walk ? Math.abs(Math.sin(pose.phase * 2)) : pose.breath * 0.3);
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const f = 4 - k * 2.6;
    const ph = (k % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0);
    const sw = pose.walk ? Math.sin(pose.phase * 2 + ph) * 3 : 0;
    const root = P(side * 3, f, z), kneeP = P(side * 11, f * 1.5 + sw, z + 7), foot = P(side * 17, f * 2 + sw, 0);
    parts.push({ d: D(side * 11, f) - 1, draw() { seg(ctx, [root, kneeP, foot], 1.6, shade(color, 0.1)); } });
  }
  parts.push({ d: 0, draw() {
    const ab = P(0, -9, z + 3), th = P(0, 2, z + 1), hd = P(0, 8, z);
    ctx.fillStyle = color; ellipse(ctx, ab[0], ab[1], 10, 8.5); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#8a1a1a'; ctx.beginPath(); ctx.moveTo(ab[0], ab[1] - 5); ctx.lineTo(ab[0] + 2.5, ab[1]); ctx.lineTo(ab[0], ab[1] + 4); ctx.lineTo(ab[0] - 2.5, ab[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ellipse(ctx, ab[0] - 3, ab[1] - 4, 4, 2); ctx.fill();
    ctx.fillStyle = shade(color, 0.12); ellipse(ctx, th[0], th[1], 6, 5); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke();
    if (F.y > -0.5) {
      ctx.fillStyle = shade(color, 0.05); ellipse(ctx, hd[0], hd[1], 4, 3.4); ctx.fill();
      ctx.fillStyle = '#ff3030'; for (const [s, zz] of [[-1.5, 1], [1.5, 1], [-0.6, 2], [0.6, 2]]) { const e = P(s, 10, z + zz); ctx.fillRect(e[0] - 0.6, e[1] - 0.6, 1.2, 1.2); }
      ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 1.2; for (const s of [-1, 1]) { const m = P(s * 1.5, 11, z - 1); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0] + R.x * s, m[1] + 3); ctx.stroke(); }
    }
  } });
  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.draw();
}

// ── 박쥐 (항상 날갯짓) ──
function drawBat(ctx, ox, oy, dir, pose, color = '#3a2a34') {
  const { F, R, off } = frame(dir, pose);
  const P = (s, f, z) => [ox + R.x * s + F.x * (f + off), oy + (R.y * s + F.y * (f + off)) * 0.5 - z];
  const flap = Math.sin(pose.phase || 0);
  const z = 28 + flap * 2;
  const c = P(0, 0, z);
  for (const side of [-1, 1]) {
    const tip = P(side * 17, -2, z + flap * 9), mid = P(side * 9, 1, z + flap * 5 + 2), low = P(side * 12, -3, z - 4 + flap * 3);
    ctx.fillStyle = shade(color, -0.1);
    ctx.beginPath(); ctx.moveTo(c[0], c[1] - 2); ctx.quadraticCurveTo(mid[0], mid[1] - 3, tip[0], tip[1]); ctx.lineTo(low[0], low[1]); ctx.quadraticCurveTo((low[0] + c[0]) / 2, (low[1] + c[1]) / 2 + 2, c[0], c[1] + 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = shade(color, 0.2); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
  }
  ctx.fillStyle = color; ellipse(ctx, c[0], c[1], 4.5, 5); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke();
  const h = P(0, 1.5, z + 5);
  ctx.fillStyle = shade(color, 0.08); ellipse(ctx, h[0], h[1], 3.4, 3); ctx.fill();
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(h[0] + side * 1.5, h[1] - 2); ctx.lineTo(h[0] + side * 3, h[1] - 6); ctx.lineTo(h[0] + side * 3.2, h[1] - 1); ctx.fill(); }
  if (F.y > -0.4) { ctx.fillStyle = '#ff3040'; ctx.fillRect(h[0] - 1.8 + F.x, h[1] - 0.5, 1.2, 1.2); ctx.fillRect(h[0] + 0.6 + F.x, h[1] - 0.5, 1.2, 1.2); }
  // 그림자는 공용 그림자 대신 멀리
}

// ── 슬라임 ──
function drawSlime(ctx, ox, oy, dir, pose, color = '#4aa860') {
  const { F, off } = frame(dir, pose);
  const ph = pose.walk ? pose.phase * 2 : pose.breath * 1.2;
  const sq = Math.sin(ph) * 0.12;
  const x = ox + F.x * off, y = oy + F.y * off * 0.5;
  const w = 12 * (1 + sq), h = 11 * (1 - sq);
  const g = ctx.createRadialGradient(x - 4, y - h - 2, 1, x, y - h * 0.6, w * 1.3);
  g.addColorStop(0, rgba(shade(color, 0.5), 0.95)); g.addColorStop(0.6, rgba(color, 0.85)); g.addColorStop(1, rgba(shade(color, -0.4), 0.9));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w, y - h * 1.6, x, y - h * 1.7); ctx.quadraticCurveTo(x + w, y - h * 1.6, x + w, y); ctx.quadraticCurveTo(x, y + 3, x - w, y); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(ctx, x - 4, y - h * 1.25, 3, 1.8); ctx.fill();
  if (F.y > -0.3) { ctx.fillStyle = '#102010'; ctx.fillRect(x + F.x * 4 - 3.5, y - h * 0.9, 2, 2.6); ctx.fillRect(x + F.x * 4 + 1.5, y - h * 0.9, 2, 2.6); }
}

// ── 그림자 / 망령: 떠다니는 영체 ──
function drawSpirit(ctx, ox, oy, dir, pose, kind, time) {
  const { F, R, off } = frame(dir, pose);
  const ph = (pose.phase || 0) + time * 2.2;
  const fz = 8 + Math.sin(ph) * 2;
  const x = ox + F.x * off, y = oy + F.y * off * 0.5 - fz;
  const wraith = kind === 'wraith';
  const body = wraith ? '#9ab8c8' : '#16121e';
  const H = wraith ? 40 : 34, W = wraith ? 11 : 10;
  ctx.save();
  // 흐르는 꼬리 자락
  ctx.fillStyle = wraith ? 'rgba(150,190,210,0.55)' : 'rgba(20,14,30,0.85)';
  ctx.beginPath();
  ctx.moveTo(x - W, y - H * 0.55);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, px = x - W * 1.15 + t * W * 2.3, py = y + 2 + Math.sin(ph * 1.5 + i * 1.3) * 3 + (i % 2) * 4;
    ctx.lineTo(px - F.x * 3, py);
  }
  ctx.lineTo(x + W, y - H * 0.55); ctx.closePath(); ctx.fill();
  // 몸통 (후드)
  const g = ctx.createLinearGradient(x - W, 0, x + W, 0);
  g.addColorStop(0, wraith ? 'rgba(200,225,235,0.8)' : 'rgba(46,36,62,0.95)'); g.addColorStop(1, wraith ? 'rgba(90,130,150,0.7)' : 'rgba(10,6,16,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - W, y - H * 0.5); ctx.quadraticCurveTo(x - W * 1.1, y - H, x, y - H - 4); ctx.quadraticCurveTo(x + W * 1.1, y - H, x + W, y - H * 0.5); ctx.closePath(); ctx.fill();
  // 팔 (공격 시 앞으로 뻗음)
  const reach = pose.swing != null ? Math.sin(Math.min(1, pose.swing / 0.6) * Math.PI) : 0;
  for (const side of [-1, 1]) {
    const sx = x + R.x * side * W * 0.9, sy = y - H * 0.62 + R.y * side * 2;
    const hx = sx + F.x * (6 + reach * 10) + R.x * side * 3, hy = sy + 8 - reach * 6 + F.y * (3 + reach * 5);
    ctx.strokeStyle = wraith ? 'rgba(170,205,220,0.75)' : 'rgba(30,22,44,0.9)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + F.x * 4, sy + 6, hx, hy); ctx.stroke();
    if (wraith) { ctx.strokeStyle = 'rgba(230,245,255,0.8)'; ctx.lineWidth = 0.8; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + i * 1.5 + F.x * 3, hy + 3); ctx.stroke(); } }
  }
  // 얼굴 구멍 + 눈
  const hy = y - H * 0.82;
  if (F.y > -0.35) {
    ctx.fillStyle = '#05030a'; ellipse(ctx, x + F.x * 3, hy, 5.5 * (0.6 + 0.4 * Math.max(0, F.y)), 5); ctx.fill();
    const eye = wraith ? '#c8fff0' : '#b070ff';
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const ex = x + F.x * 4 + R.x * side * 2.2, ey = hy + 0.5;
      const gg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 4); gg.addColorStop(0, rgba(eye, 0.95)); gg.addColorStop(1, rgba(eye, 0));
      ctx.fillStyle = gg; ctx.fillRect(ex - 4, ey - 4, 8, 8);
    }
  }
  ctx.restore();
}

export const BEAST_BODIES = new Set(['rat', 'wolf', 'boar', 'spider', 'bat', 'slime', 'shade', 'wraith']);
// 공중에 뜬 몸(그림자를 작게)
export const FLYING = new Set(['bat', 'shade', 'wraith', 'lich']);

export function drawBeast(ctx, ox, oy, body, dir, pose, look, time) {
  const tint = look.tint;
  switch (body) {
    case 'rat': case 'wolf': case 'boar': {
      const Q = tint ? { ...QUADS[body], color: tintC(QUADS[body].color, tint), belly: tintC(QUADS[body].belly, tint), mane: QUADS[body].mane && tintC(QUADS[body].mane, tint) } : QUADS[body];
      return drawQuad(ctx, ox, oy, dir, pose, Q, time);
    }
    case 'spider': return drawSpider(ctx, ox, oy, dir, pose, tint ? tintC('#2a2420', tint) : undefined);
    case 'bat': return drawBat(ctx, ox, oy, dir, pose, tint ? tintC('#3a2a34', tint) : undefined);
    case 'slime': return drawSlime(ctx, ox, oy, dir, pose, tint || undefined);
    case 'shade': case 'wraith': return drawSpirit(ctx, ox, oy, dir, pose, body, time);
    default: return drawQuad(ctx, ox, oy, dir, pose, QUADS.rat, time);
  }
}
function tintC(c, t) {
  const [a, b] = [c, t].map((h) => h.replace('#', ''));
  const n1 = parseInt(a, 16), n2 = parseInt(b, 16);
  const m = (s) => Math.round(((n1 >> s) & 255) * 0.5 + ((n2 >> s) & 255) * 0.5);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
}
