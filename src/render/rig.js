// 인간형 리그: 8방향 절차 생성 캐릭터(사람 + 인간형 몬스터). 소유: 워커 A.
// 로컬 3D 좌표 (s=캐릭터 오른쪽, f=정면, z=높이)를 화면으로 투영해 부위를 깊이 순으로 그린다. 원점 = 발밑.
// ★A11: 부위마다 재질 영역(spx.js Sheet)으로 평평하게 칠하고, 굽기 단계에서 램프 명암·재질 질감·1px 디테일을 입힌다.
import { shade, mix } from './util.js';
import { rgbOf } from './spx.js';
import { WEAPONS, SHIELDS, drawWeapon, drawShield, bladeDepth } from './rigitems.js';
import { HELMS, drawHead, drawHairBack, SKIN_RAMP } from './righead.js';

export { WEAPONS, SHIELDS, HELMS };
// 장비 외형 팔레트 (ARCHITECTURE §4 look 키)
export const ARMOR = {
  tunic:      { body: '#6a5c40', sleeve: '#62553c', leg: '#3e3a34', trim: '#8a7650' },
  leather:    { body: '#7a5030', sleeve: '#5e4026', leg: '#4a3a2a', trim: '#3a2614', strap: true },
  chain:      { body: '#8a8e96', sleeve: '#80848c', leg: '#4a4a52', trim: '#5a3e24', pattern: 'chain' },
  scale:      { body: '#5e7484', sleeve: '#566a78', leg: '#44484e', trim: '#a08a4a', pattern: 'scale' },
  plate:      { body: '#a8adb5', sleeve: '#9aa0a8', leg: '#8a9098', trim: '#c9a14a', pattern: 'plate', pauldron: '#b4b9c0' },
  dusk_plate: { body: '#3a3046', sleeve: '#342a40', leg: '#2c2438', trim: '#b02838', pattern: 'plate', pauldron: '#4a3c58', glow: '#ff3a4a' },
};
export const BOOTS = { boots_leather: '#5a3a20', boots_iron: '#7a7e86' };

const SKIN_DEFAULT = '#e8c4a0';
export const INLINE = 'rgba(40,14,52,0.5)';
// ★A11 비율: 3.5~4등신, 키 약 58~62px(1×)
export const BODY_K = 1.06, HEAD_K = 1.16;

// 애니메이션 상태 → 정규화 포즈 파라미터
export function poseOf(state, k) {
  const p = { walk: 0, phase: 0, swing: null, hurt: 0, cast: 0, breath: 0 };
  if (state === 'walk') { p.walk = 1; p.phase = k * Math.PI * 2; }
  else if (state === 'attack') p.swing = k;
  else if (state === 'hurt') p.hurt = Math.sin(Math.min(1, k) * Math.PI);
  else if (state === 'cast') p.cast = Math.sin(Math.min(1, k) * Math.PI * 0.5 + 0.3);
  else p.breath = Math.sin(k * Math.PI * 2);
  return p;
}

// look → 리그 스타일 (사람)
export function humanStyle(look) {
  const A = ARMOR[look.armor] || null;
  const skin = look.skin || SKIN_DEFAULT;
  const f = look.gender === 'f';
  return {
    head: 'human', skin, hair: look.hair ?? 0, hairColor: look.hairColor || '#3b2a1e', beard: !!look.beard, female: f,
    body: A?.body ?? (look.robe || '#8a7e64'), sleeve: A?.sleeve ?? (look.robe || '#8a7e64'), leg: A?.leg ?? (look.robe ? shade(look.robe, -0.3) : '#4a4236'),
    trim: A?.trim ?? (look.robe ? shade(look.robe, 0.25) : '#6a5a40'), pattern: A?.pattern, pauldron: A?.pauldron, strap: A?.strap, glow: A?.glow,
    armor: look.armor || null, noArmor: !A && !look.robe,
    robe: look.robe || null, apron: look.apron || null,
    boots: BOOTS[look.boots] || (A?.pattern === 'plate' ? A.leg : '#4a3220'), bootsMetal: look.boots === 'boots_iron' || (!look.boots && A?.pattern === 'plate'),
    weapon: look.weapon || null, shield: look.shield || null, helm: look.helm || null, cape: look.cape || null,
    width: f ? 0.9 : 1, height: f ? 0.96 : 1,
  };
}

// ── 재질 spec ──
const METAL = (hex, o = {}) => ({ hex, style: 'metal', k: 4.6, rampOpt: { spread: 1.15, n: 11 }, ...o });
function garment(st, hex, part) {
  if (st.bone) return { hex, style: 'bone', k: 4 };
  switch (st.pattern) {
    case 'chain': return part === 'leg' ? { hex, style: 'cloth', k: 3.6 } : { hex, style: 'chain', k: 4 };
    case 'scale': return part === 'leg' ? { hex, style: 'cloth', k: 3.6 } : { hex, style: 'scale', k: 4 };
    case 'plate': return METAL(hex);
    default: break;
  }
  if (st.stone) return { hex, style: 'stone', k: 4 };
  if (st.strap && part !== 'leg') return { hex, style: 'leather', k: 3.8 };
  if (st.skinBody && part !== 'body') return { hex, style: 'skin', k: 3.2, rampOpt: SKIN_RAMP };
  return { hex, style: 'cloth', k: 3.8, fold: part === 'leg' ? 0.6 : 1 };
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
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// 메인: Sheet S 의 ctx 에 (ox,oy)=발밑 기준으로 그린다
export function drawRig(S, ox, oy, dir, pose, st) {
  const ctx = S.ctx;
  const a = dir * Math.PI / 4;
  const F = { x: Math.sin(a), y: -Math.cos(a) };
  const R = { x: Math.cos(a), y: Math.sin(a) };
  const H = (st.height ?? 1) * BODY_K, Wd = st.width ?? 1;
  const hunch = st.hunch ?? 0;
  const bob = pose.walk ? Math.round(Math.abs(Math.cos(pose.phase)) * 1.2) : (pose.breath > 0.5 ? 0.5 : 0);
  const lean = pose.hurt * 2.5;
  const floatZ = st.float ? 6 + Math.sin(pose.phase || pose.breath) * 1.5 : 0;
  const P = (s, f, z) => [ox + R.x * s + F.x * (f - lean), oy + (R.y * s + F.y * (f - lean)) * 0.5 - z - floatZ];
  const D = (s, f) => R.y * s + F.y * f;
  const limbW = (st.limbW ?? 4.6) * (st.limbW ? 1 : 1.04);
  const parts = [];
  const front = F.y > -0.25;
  const plate = st.pattern === 'plate';

  // ── 다리 ──
  const hipZ = 21 * H, hipS = 3.7 * Wd;
  for (const side of [-1, 1]) {
    if (st.float || st.robeFull) break;
    const sw = pose.walk ? Math.sin(pose.phase) * side : 0;
    const footF = sw * 6, footZ = pose.walk ? Math.max(0, -Math.cos(pose.phase) * side) * 2.5 : 0;
    const knee = P(side * hipS, footF * 0.55 + 1.5, hipZ * 0.5 + footZ * 0.5);
    const hip = P(side * hipS, 0, hipZ + bob), foot = P(side * hipS * 0.92, footF, footZ);
    parts.push({ d: D(side * hipS, footF) - 3, draw() {
      if (st.bone) { boneLimb(S, [hip, knee, foot], st); return; }
      const ankle = lerp2(knee, foot, 0.82);
      tube(S, [hip, knee, ankle], limbW + 1, garment(st, st.leg, 'leg'));
      const bootTop = lerp2(knee, foot, st.bootsMetal || plate ? 0.1 : 0.4);
      const bspec = st.bootsMetal ? METAL(st.boots, { k: 4 }) : { hex: st.boots, style: 'leather', k: 3.6 };
      tube(S, [bootTop, foot], limbW + 1.3, bspec);
      const toe = [foot[0] + F.x * 2, foot[1] + F.y * 1 + 0.4];
      ball(S, toe[0], toe[1], 3.1, 1.8, bspec);
      if (plate || st.bootsMetal) ball(S, knee[0], knee[1], 2.6, 2.2, METAL(st.bootsMetal ? st.boots : st.leg, { k: 4.4 }));
    } });
  }

  // ── 몸통 ──
  const shZ = 37 * H - hunch * 3 + bob, waistZ = 25 * H + bob, hemZ = hipZ - 2.5 + bob;
  const shW = (6.8 * Math.abs(R.x) + 4.5 * Math.abs(F.x)) * Wd * (st.bulk ?? 1);
  const waW = shW * (st.taper ?? 0.76);
  const chest = P(0, hunch * 2, shZ), waist = P(0, 0, waistZ), hem = P(0, 0, hemZ);
  // 뒤쪽 머리카락 (정면: 몸 뒤)
  const headR = (st.headR ?? 6.4) * (st.headScale ?? 1) * HEAD_K;
  const headZ = shZ + headR + 1.4 - hunch * 2;
  const hc = P(0, hunch * 5 + 0.5, headZ);
  parts.push({ d: front ? -2.2 : 0.2, draw() { drawHairBack(S, hc, headR, st, F, R, pose); } });
  parts.push({ d: 0, draw() {
    const capeFront = st.cape && F.y > 0.2;
    if (capeFront) drawCape(S, P, st, shZ, pose, true);
    if (!st.bone && st.head !== 'golem') { // 목 (뒷머리보다 먼저)
      const n0 = P(0, hunch * 3, shZ - 1), n1 = P(0, hunch * 4 + 0.3, shZ + 3);
      tube(S, [n0, n1], 3.6, { hex: st.skin || SKIN_DEFAULT, style: 'skin', k: 2.4, rampOpt: SKIN_RAMP });
    }
    // 골반 (바지)
    if (!st.bone && !st.robeFull && !st.float) {
      const pl = P(-hipS - 1.2, 0, hipZ + bob), pr = P(hipS + 1.2, 0, hipZ + bob);
      ctx.fillStyle = S.m({ ...garment(st, st.leg, 'leg'), sphere: [waist[0], (waist[1] + pl[1]) / 2, waW * 1.2, 5] });
      poly(ctx, [[waist[0] - waW, waist[1]], [waist[0] + waW, waist[1]], [pr[0], pr[1] + 1], [(pl[0] + pr[0]) / 2, (pl[1] + pr[1]) / 2 + 2.5], [pl[0], pl[1] + 1]]); ctx.fill();
    }
    if (st.robe || st.robeFull) drawRobe(S, ox, oy, waist, waW, H, pose, st, floatZ);
    if (st.bone) { boneTorso(S, chest, waist, shW, waW, st); if (st.cape && !capeFront) drawCape(S, P, st, shZ, pose, false); return; }
    // 상체 (어깨 둥글게 → 허리 → 옷자락)
    const hemW = waW * (st.robe || st.robeFull ? 1 : 1.12);
    const tspec = { ...garment(st, st.body, 'body'), sphere: [chest[0] - shW * 0.1, (chest[1] + waist[1]) / 2 - 1, shW * 1.25, (waist[1] - chest[1]) * 0.85 + 2], anchor: [waist[0], waist[1]] };
    ctx.fillStyle = S.m(tspec);
    ctx.beginPath();
    ctx.moveTo(chest[0] - shW, chest[1] + 2.2);
    ctx.quadraticCurveTo(chest[0] - shW, chest[1] - 1.2, chest[0] - shW * 0.55, chest[1] - 1.6);
    ctx.lineTo(chest[0] + shW * 0.55, chest[1] - 1.6);
    ctx.quadraticCurveTo(chest[0] + shW, chest[1] - 1.2, chest[0] + shW, chest[1] + 2.2);
    ctx.lineTo(waist[0] + waW, waist[1]);
    ctx.lineTo(hem[0] + hemW, hem[1]);
    ctx.lineTo(hem[0], hem[1] + 1.2);
    ctx.lineTo(hem[0] - hemW, hem[1]);
    ctx.lineTo(waist[0] - waW, waist[1]);
    ctx.closePath(); ctx.fill();
    const torsoId = S.specs.length - 1;
    torsoDetail(S, chest, waist, hem, shW, waW, hemW, st, F, R, front, torsoId);
    // 허리띠
    if (!st.noBelt) {
      ctx.fillStyle = S.m({ hex: st.belt || (plate ? shade(st.trim, -0.1) : '#4a3020'), style: plate ? 'metal' : 'leather', k: 3, cast: false });
      ctx.fillRect(waist[0] - waW - 0.4, waist[1] - 2.6, waW * 2 + 0.8, 2.6);
      if (front) { ctx.fillStyle = S.m(METAL('#c9a14a', { k: 4, cast: false })); ctx.fillRect(waist[0] + F.x * 2.2 - 1.2, waist[1] - 2.8, 2.4, 3); }
    }
    if (st.apron && front) {
      const ax = waist[0] + F.x * 2.5, w2 = waW * 0.85 * (0.3 + 0.7 * F.y);
      ctx.fillStyle = S.m({ hex: st.apron, style: 'cloth', k: 3.4, fold: 1.4, anchor: [ax, chest[1]] });
      poly(ctx, [[ax - w2 * 0.8, chest[1] + 3.5], [ax + w2 * 0.8, chest[1] + 3.5], [ax + w2 * 0.9, waist[1] - 2], [ax + w2 * 1.15, oy - 6.5], [ax - w2 * 1.15, oy - 6.5], [ax - w2 * 0.9, waist[1] - 2]]); ctx.fill();
    }
    if (st.cape && !capeFront) drawCape(S, P, st, shZ, pose, false);
    if (st.glow && front) {
      const g = S.pt(chest[0] + F.x * 2, chest[1] + 6), gc = rgbOf(st.glow);
      S.postMark((Pm) => { Pm.add(g[0], g[1], [255, 240, 230], 255); for (const [dx, dy, al] of [[-1, 0, 230], [1, 0, 230], [0, -1, 200], [0, 1, 200], [-2, 0, 90], [2, 0, 90], [0, -2, 70], [0, 2, 70]]) Pm.add(g[0] + dx, g[1] + dy, gc, al); });
    }
  } });

  // ── 팔 & 무기/방패 ──
  const shS = 6.5 * Wd * (st.bulk ?? 1);
  const swing = pose.swing;
  for (const side of [1, -1]) {
    const isWeapon = side === 1;
    let hand, theta = null;
    const sh3 = [side * shS, hunch * 2, shZ - 1.5];
    if (isWeapon && swing != null) {
      theta = swingAngle(swing);
      const phi = theta * 0.6 - 40, pr = phi * Math.PI / 180;
      hand = [sh3[0] - 1.5, sh3[1] + Math.cos(pr) * 12, sh3[2] + Math.sin(pr) * 12];
    } else if (pose.cast) {
      hand = [side * 5, 9 * pose.cast + 3, shZ + 4 * pose.cast];
    } else if (st.armsForward) {
      hand = [side * 4.5, 12, shZ - 3 + (pose.walk ? Math.sin(pose.phase * 2 + side) : 0)];
    } else {
      const sw = pose.walk ? -Math.sin(pose.phase) * side * 4.5 : 0;
      const holdF = isWeapon && st.weapon ? 4 : (!isWeapon && st.shield ? 5 : 1);
      hand = [side * (shS + 0.8), sw + holdF, shZ - 14 + (pose.hurt ? 3 : 0)];
      if (isWeapon && st.weapon) theta = 62 + (pose.walk ? Math.sin(pose.phase) * 6 : pose.breath * 2);
    }
    const sp = P(...sh3), hp = P(...hand);
    const elbow = P((sh3[0] + hand[0]) / 2 + side * 1.5, (sh3[1] + hand[1]) / 2 - 1, (sh3[2] + hand[2]) / 2 - 1);
    const d = D(side * shS, hand[1] * 0.6) + 0.5;
    parts.push({ d, draw() {
      const wpn = isWeapon && st.weapon ? WEAPONS[st.weapon] : null;
      const shield = !isWeapon && st.shield ? SHIELDS[st.shield] : null;
      const bladeBehind = wpn && bladeDepth(theta ?? 62, F, R) < -0.2;
      if (wpn && bladeBehind) drawWeapon(S, hp, theta, wpn, F, R);
      if (st.bone) boneLimb(S, [sp, elbow, hp], st, true);
      else {
        tube(S, [sp, elbow, hp], limbW, garment(st, st.sleeve, 'arm'));
        const hspec = st.gauntlet || plate ? (plate ? METAL(st.sleeve, { k: 4 }) : { hex: st.handColor || st.sleeve, style: 'skin', k: 3, rampOpt: SKIN_RAMP }) : { hex: st.handColor || st.skin, style: 'skin', k: 3, rampOpt: SKIN_RAMP };
        ball(S, hp[0], hp[1], 2.4, 2.4, hspec);
        if (plate) ball(S, elbow[0], elbow[1], 2.2, 2, METAL(st.sleeve, { k: 4.4 }));
      }
      if (st.claws) { const p0 = S.pt(hp[0], hp[1]), k = S.k; S.mark((X) => { for (let i = -1; i <= 1; i++) for (let j = 1; j <= 3; j++) X.put(p0[0] + i * (1 + j * 0.3) + F.x * j * 0.6, p0[1] + j + 1, [232, 224, 206], 255); }); }
      if (st.pauldron) ball(S, sp[0], sp[1] + 0.5, 4.4, 3.5, METAL(st.pauldron, { k: 4.8 }));
      if (wpn && !bladeBehind) drawWeapon(S, hp, theta, wpn, F, R);
      if (shield) drawShield(S, hp, shield, F, R);
    } });
  }

  // ── 머리 ──
  parts.push({ d: 0.3 + hunch, draw() {
    drawHead(S, hc, headR, st, F, R, pose);
  } });

  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.draw();
}

function swingAngle(k) {
  if (k < 0.3) return 62 + (125 - 62) * (k / 0.3);
  if (k < 0.62) { const t = (k - 0.3) / 0.32; return 125 - 170 * t * t * (3 - 2 * t); }
  const t = (k - 0.62) / 0.38; return -45 + (62 + 45) * t;
}

function drawRobe(S, ox, oy, waist, waW, H, pose, st, floatZ) {
  const ctx = S.ctx;
  const hem = 1.5 * H, flare = waW * 1.5 + 1.5;
  const swing = pose.walk ? Math.sin(pose.phase) * 1.5 : 0;
  const rc = st.robe || st.body;
  const by = oy - hem - floatZ;
  ctx.fillStyle = S.m({ hex: rc, style: 'cloth', k: 4, fold: 1.7, sphere: [waist[0] - 1, (waist[1] + by) / 2, flare * 1.25, (by - waist[1]) * 0.9], anchor: [waist[0], waist[1]] });
  ctx.beginPath();
  ctx.moveTo(waist[0] - waW, waist[1]);
  ctx.lineTo(waist[0] + waW, waist[1]);
  ctx.lineTo(ox + flare + swing, by);
  if (st.float) { for (let i = 4; i >= 0; i--) { const t = i / 4; ctx.lineTo(ox - flare + t * flare * 2 + swing, by + (i % 2 ? 4 : 0) + Math.sin(i + (pose.phase || 0)) * 1.2); } }
  else ctx.quadraticCurveTo(ox, by + 3, ox - flare + swing, by);
  ctx.closePath(); ctx.fill();
  // 밑단 장식 띠
  if (st.trim && !st.float) {
    const t0 = S.pt(ox - flare + swing, by - 1), t1 = S.pt(ox + flare + swing, by - 1), tc = rgbOf(st.trim);
    S.mark((X) => { const id = X.id((t0[0] + t1[0]) / 2, t0[1] - 1); for (let x = Math.round(t0[0]); x <= t1[0]; x++) { const yy = t0[1] - 1 + Math.round(Math.sin(((x - t0[0]) / (t1[0] - t0[0])) * Math.PI) * 2.4); X.put(x, yy, tc, 200, id ? [id] : null); } });
  }
}

function torsoDetail(S, chest, waist, hem, shW, waW, hemW, st, F, R, front, torsoId) {
  const ctx = S.ctx;
  const cx = chest[0] + F.x * 2;
  if (st.pattern === 'plate') {
    // 아랫배 갑옷판(fauld) 2단 + 가슴 중앙 능선
    for (let i = 0; i < 2; i++) {
      const y0 = waist[1] + 0.5 + i * 2.6;
      ctx.fillStyle = S.m(METAL(shade(st.body, -0.06 * i), { k: 4, sphere: [waist[0] - 1, y0, waW * 1.3, 4] }));
      ctx.fillRect(waist[0] - waW * (1.04 + i * 0.06), y0, waW * (2.08 + i * 0.12), 2.6);
    }
    const p0 = S.pt(cx, chest[1] + 1), p1 = S.pt(waist[0] + F.x * 2, waist[1] - 3), tc = rgbOf(st.trim);
    S.mark((X) => {
      if (front) for (let y = Math.round(p0[1]); y <= p1[1]; y++) { const x = p0[0] + (p1[0] - p0[0]) * ((y - p0[1]) / Math.max(1, p1[1] - p0[1])); X.shift(x, y, 1.6, [torsoId]); X.shift(x + 1, y, -1.4, [torsoId]); }
      // 목둘레 장식선
      for (let x = Math.round(p0[0] - 3); x <= p0[0] + 3; x++) X.put(x, Math.round(p0[1]) - 1 + (Math.abs(x - p0[0]) > 2 ? -1 : 0), tc, 255, [torsoId]);
    });
    if (st.glow) { const gc = rgbOf(st.trim); S.mark((X) => { for (let i = 0; i < 6; i++) X.put(p0[0] - 4 + ih6(i) * 8, p0[1] + 3 + i * 2, gc, 200, [torsoId]); }); }
    return;
  }
  if (st.ribs) {
    const p0 = S.pt(chest[0], chest[1]), k = S.k;
    S.mark((X) => { for (let i = 0; i < 4; i++) { const yy = p0[1] + (4 + i * 3) * k; for (let dx = -shW * 0.75 * k; dx <= shW * 0.75 * k; dx++) X.shift(p0[0] + dx, yy + Math.abs(dx) * 0.25, -2, [torsoId]); } });
    return;
  }
  if (st.pattern === 'chain' || st.pattern === 'scale') {
    // 사슬/비늘 위 천 덧옷 띠(타바드) 가운데
    if (front && st.pattern === 'chain') {
      ctx.fillStyle = S.m({ hex: shade(st.trim, 0.1), style: 'cloth', k: 3.2, fold: 1.3, anchor: [chest[0], chest[1]] });
      const w = 2.6 * (0.4 + 0.6 * Math.abs(F.y));
      poly(ctx, [[cx - w, chest[1] + 1], [cx + w, chest[1] + 1], [waist[0] + F.x * 2 + w * 1.15, hem[1] + 1.5], [waist[0] + F.x * 2 - w * 1.15, hem[1] + 1.5]]); ctx.fill();
    }
    return;
  }
  if (st.strap && front) {
    // 가죽 갑옷: 사선 끈 + 버클, 가장자리 바느질
    ctx.fillStyle = S.m({ hex: st.trim, style: 'leather', k: 3, stitch: true });
    const a0 = [chest[0] - shW * 0.85, chest[1] + 1], a1 = [waist[0] + waW * 0.9, waist[1] - 2];
    poly(ctx, [[a0[0], a0[1] - 1.2], [a0[0] + 2.4, a0[1] - 1.6], [a1[0] + 0.6, a1[1] + 0.4], [a1[0] - 1.8, a1[1] + 1.4]]); ctx.fill();
    const b = S.pt((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2);
    S.mark((X) => { X.put(b[0], b[1], [214, 190, 120]); X.put(b[0] + 1, b[1], [150, 120, 60]); X.put(b[0], b[1] + 1, [150, 120, 60]); });
    return;
  }
  // 천옷 (튜닉·로브): V 깃 + 단추 + 가운데 섶
  if (front && !st.bone) {
    const w = 2.6 * (0.4 + 0.6 * Math.abs(F.y));
    ctx.fillStyle = S.m({ hex: shade(st.body, -0.35), style: 'cloth', k: 2, ao: false, cast: false });
    poly(ctx, [[cx - w, chest[1] - 1.3], [cx + w, chest[1] - 1.3], [cx, chest[1] + 4]]); ctx.fill();
    ctx.fillStyle = S.m({ hex: st.skin || SKIN_DEFAULT, style: 'skin', k: 2, cast: false, rampOpt: SKIN_RAMP });
    poly(ctx, [[cx - w * 0.6, chest[1] - 1.3], [cx + w * 0.6, chest[1] - 1.3], [cx, chest[1] + 2.4]]); ctx.fill();
    if (st.trim && !st.noArmor) {
      const p0 = S.pt(cx, chest[1] + 4), p1 = S.pt(waist[0] + F.x * 2, waist[1] - 3), tc = rgbOf(st.trim);
      S.mark((X) => { for (let y = Math.round(p0[1]); y <= p1[1]; y++) { const x = p0[0] + (p1[0] - p0[0]) * ((y - p0[1]) / Math.max(1, p1[1] - p0[1])); X.shift(x, y, -1.2, [torsoId]); if ((y - Math.round(p0[1])) % 3 === 1) X.put(x + 1, y, tc, 255, [torsoId]); } });
    }
  }
  if (st.rags) {
    const p = S.pt(chest[0], chest[1]), k = S.k;
    S.mark((X) => { for (let i = 0; i < 5; i++) { const x = p[0] + ((i * 7.3) % (shW * 2) - shW) * k, y = p[1] + ((i * 5.1) % 12 + 2) * k; for (let j = 0; j < 3; j++) X.shift(x + (j & 1), y + j, -2, [torsoId]); } });
  }
}
const ih6 = (i) => ((i * 0.618) % 1);

function drawCape(S, P, st, shZ, pose, behind) {
  const ctx = S.ctx;
  const sway = pose.walk ? Math.sin(pose.phase * 2) * 1.5 : pose.breath * 0.5;
  const back = -5 - (pose.walk ? 3 : 0);
  const l = P(-6.8, -1.5, shZ + 1), r = P(6.8, -1.5, shZ + 1);
  const bl = P(-10, back, 3), br = P(10, back, 3);
  const mid = [(bl[0] + br[0]) / 2 + sway, (bl[1] + br[1]) / 2];
  ctx.fillStyle = S.m({ hex: behind ? shade(st.cape, -0.25) : st.cape, style: 'cloth', k: 4, fold: 2, anchor: [(l[0] + r[0]) / 2, l[1]], sphere: [(l[0] + r[0]) / 2 - 2, (l[1] + mid[1]) / 2, 14, 26] });
  ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(r[0], r[1]); ctx.lineTo(br[0] + sway, br[1]);
  for (let i = 1; i < 6; i++) { const t = i / 6; ctx.lineTo(br[0] + (bl[0] - br[0]) * t + sway, br[1] + (bl[1] - br[1]) * t + (i % 2 ? 2.2 : 0)); }
  ctx.lineTo(bl[0] + sway, bl[1]); ctx.closePath(); ctx.fill();
  const id = S.specs.length - 1;
  if (st.trim && !behind) {
    const a0 = S.pt(bl[0] + sway, bl[1]), a1 = S.pt(br[0] + sway, br[1]), tc = rgbOf(st.trim);
    S.mark((X) => { const n = Math.max(1, Math.abs(a1[0] - a0[0])); for (let i = 0; i <= n; i++) { const x = a0[0] + (a1[0] - a0[0]) * i / n, y = a0[1] + (a1[1] - a0[1]) * i / n; for (let dy = 1; dy <= 5; dy++) if (X.id(x, y - dy) === id) { X.put(x, y - dy, tc, 230); X.put(x, y - dy - 1, tc, 140); break; } } });
  }
}

function boneLimb(S, pts, st, arm) {
  const bone = st.boneColor || '#ddd2b4';
  tube(S, [pts[0], pts[1]], 2.2, { hex: bone, style: 'bone', k: 3.6 });
  tube(S, [pts[1], pts[2]], 2, { hex: bone, style: 'bone', k: 3.6 });
  ball(S, pts[1][0], pts[1][1], 1.7, 1.7, { hex: bone, style: 'bone', k: 3.6 });
  ball(S, pts[2][0], pts[2][1] + (arm ? 0 : 0.5), arm ? 1.9 : 2.4, arm ? 1.9 : 1.4, { hex: bone, style: 'bone', k: 3.6 });
}
function boneTorso(S, chest, waist, shW, waW, st) {
  const ctx = S.ctx, bone = st.boneColor || '#ddd2b4';
  tube(S, [[chest[0], chest[1] - 1], [waist[0], waist[1] + 1]], 2, { hex: shade(bone, -0.1), style: 'bone', k: 3.6 });
  for (let i = 0; i < 4; i++) {
    const t = i / 4, y = chest[1] + 1.5 + (waist[1] - chest[1]) * t * 0.72, w = shW * (0.92 - t * 0.25);
    tube(S, [[chest[0] - w, y + 1.6], [chest[0] - w * 0.5, y - 0.2], [chest[0], y - 0.6], [chest[0] + w * 0.5, y - 0.2], [chest[0] + w, y + 1.6]], 1.5, { hex: bone, style: 'bone', k: 3.4 });
  }
  tube(S, [[chest[0] - shW, chest[1]], [chest[0] + shW, chest[1]]], 1.8, { hex: bone, style: 'bone', k: 3.6 });
  ctx.fillStyle = S.m({ hex: shade(bone, -0.05), style: 'bone', k: 3.6, sphere: [waist[0] - 1, waist[1] - 1.5, waW * 1.2, 3] });
  ctx.beginPath(); ctx.ellipse(waist[0], waist[1] - 1, waW * 1.1, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  if (st.belt) { ctx.fillStyle = S.m({ hex: st.belt, style: 'leather', k: 3, cast: false }); ctx.fillRect(waist[0] - waW * 1.1, waist[1] - 1.5, waW * 2.2, 2); }
}

// ── 인간형 몬스터 스타일 ──
export const HUMANOID_BODIES = {
  goblin:       { head: 'goblin', skin: '#6a8a3a', body: '#6a5432', sleeve: '#6a8a3a', leg: '#4a3a24', trim: '#3a2a1a', boots: '#3a2a1a', weapon: 'dagger', height: 0.72, width: 0.95, headR: 6.4, hunch: 0.4, rags: true, skinBody: true, handColor: '#6a8a3a', noBelt: false, belt: '#3a2614' },
  skeleton:     { head: 'skull', skin: '#e0d6bc', body: '#000000', sleeve: '#d8ceb4', leg: '#d8ceb4', trim: '#5a4a3a', boots: '#d8ceb4', weapon: 'sword_short', shield: 'shield_wood', bone: true, ribs: true, limbW: 2, taper: 0.5, bulk: 0.8, belt: '#4a3a2a' },
  skeleton_archer: { head: 'skull', skin: '#e0d6bc', body: '#000000', sleeve: '#d8ceb4', leg: '#d8ceb4', trim: '#5a4a3a', boots: '#d8ceb4', weapon: 'bow', bone: true, ribs: true, limbW: 2, taper: 0.5, bulk: 0.8, belt: '#4a3a2a', eyeGlow: '#ff7040' },
  zombie:       { head: 'zombie', skin: '#7a8a62', body: '#4e4838', sleeve: '#7a8a62', leg: '#3a3a30', trim: '#2a2a20', boots: '#4a4a3a', hunch: 0.6, armsForward: true, rags: true, hairColor: '#2a2a20', hair: 3, skinBody: true, handColor: '#7a8a62' },
  ghoul:        { head: 'ghoul', skin: '#8a8e84', body: '#7a7e74', sleeve: '#8a8e84', leg: '#6a6e64', trim: '#3a3a34', boots: '#5a5e54', hunch: 1.1, claws: true, height: 0.9, bulk: 0.85, taper: 0.6, handColor: '#8a8e84', rags: true, skinBody: true, noBelt: true },
  gravekeeper:  { head: 'hood', hoodColor: '#3e3828', face: 'skull', skin: '#a8a090', body: '#3e3828', sleeve: '#3e3828', leg: '#2a2620', trim: '#6a5a30', boots: '#2a2620', weapon: 'shovel', hunch: 0.8, height: 1.15, bulk: 1.35, robe: '#36301f', eyeGlow: '#7fe0a0', handColor: '#a8a090', rags: true },
  knight_spirit:{ head: 'knight', helmColor: '#8ab4e8', body: '#7aa0d8', sleeve: '#6a90c8', leg: '#5a80b8', trim: '#c0e0ff', boots: '#5a80b8', weapon: 'sword_long', shield: 'shield_iron', pattern: 'plate', pauldron: '#9ac0f0', eyeGlow: '#e0f4ff', gauntlet: true, height: 1.1, cape: '#4a6aa8', plume: '#c0e0ff' },
  knight_dark:  { head: 'knight', helmColor: '#3a3242', body: '#3a3046', sleeve: '#342a40', leg: '#2c2438', trim: '#b02838', boots: '#241e2c', weapon: 'dark_great', pattern: 'plate', pauldron: '#4a3c58', eyeGlow: '#ff3040', horns: true, gauntlet: true, height: 1.1, bulk: 1.1, glow: '#ff3a4a', cape: '#6a1a28' },
  lich:         { head: 'hood', hoodColor: '#34203f', face: 'skull', skin: '#c8c0a8', body: '#34203f', sleeve: '#34203f', leg: '#1a1020', trim: '#a060ff', boots: '#1a1020', weapon: 'staff', robe: '#2e1c38', robeFull: true, float: true, eyeGlow: '#c070ff', handColor: '#c8c0a8', height: 1.1, crown: '#9a7abf', noBelt: true },
  dusk_king:    { head: 'knight', helmColor: '#2a2230', crownHelm: true, crown: '#c09a40', body: '#2e2632', sleeve: '#2a222e', leg: '#221c26', trim: '#ff3a3a', boots: '#1a1520', weapon: 'dark_great', pattern: 'plate', pauldron: '#3a3040', eyeGlow: '#ff2a2a', gauntlet: true, height: 1.2, bulk: 1.25, glow: '#ff2a2a', cape: '#5a0e1c', robe: '#241a26' },
  golem:        { head: 'golem', skin: '#7a766c', body: '#6e6a60', sleeve: '#6e6a60', leg: '#625e56', trim: '#4a4640', boots: '#5a564e', bulk: 1.6, taper: 0.85, limbW: 8, height: 1.15, headR: 6, headScale: 1, handColor: '#7a766c', gauntlet: true, eyeGlow: '#7fd8ff', stone: true, noBelt: true },
  cultist:      { head: 'hood', hoodColor: '#4a1a20', skin: '#d8b090', body: '#4a1a20', sleeve: '#4a1a20', leg: '#1a0a0c', trim: '#a02030', boots: '#1a0a0c', robe: '#3e1418', weapon: 'dagger', eyeGlow: '#ff5040' },
};

export function humanoidStyle(body, look) {
  const base = HUMANOID_BODIES[body];
  if (!base) return null;
  const st = { ...base };
  if (look.weapon) st.weapon = look.weapon;
  if (look.robe && body === 'human') st.robe = look.robe;
  return st;
}

// 색 보정(tint)
export function tintStyle(st, tint) {
  if (!tint) return st;
  const t = (c) => (typeof c === 'string' && c.startsWith('#') ? mix(c, tint, 0.45) : c);
  const out = { ...st };
  for (const k of ['skin', 'body', 'sleeve', 'leg', 'boots', 'robe', 'cape', 'helmColor', 'hoodColor', 'pauldron', 'handColor', 'boneColor']) if (out[k]) out[k] = t(out[k]);
  if (out.bone && !out.boneColor) out.boneColor = t('#ddd2b4');
  return out;
}
