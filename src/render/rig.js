// 인간형 리그: 8방향 절차 생성 캐릭터(사람 + 인간형 몬스터). 소유: 워커 A.
// 로컬 3D 좌표 (s=캐릭터 오른쪽, f=정면, z=높이)를 화면으로 투영해 부위를 깊이 순으로 그린다. 원점 = 발밑.
import { shade, rgba, ellipse, mix } from './util.js';

// 장비 외형 팔레트 (ARCHITECTURE §4 look 키)
export const ARMOR = {
  tunic:      { body: '#5f5440', sleeve: '#5f5440', leg: '#3e3a32', trim: '#7a6a4a' },
  leather:    { body: '#6a4a2c', sleeve: '#5a3e24', leg: '#4a3a2a', trim: '#3a2614', strap: true },
  chain:      { body: '#7e828a', sleeve: '#727680', leg: '#4a4a50', trim: '#5a3e24', pattern: 'chain' },
  scale:      { body: '#5c6e7a', sleeve: '#56646e', leg: '#44484e', trim: '#8a7a4a', pattern: 'scale' },
  plate:      { body: '#a8adb5', sleeve: '#9aa0a8', leg: '#8a9098', trim: '#c9a14a', pattern: 'plate', pauldron: '#b4b9c0' },
  dusk_plate: { body: '#2c2434', sleeve: '#2a2232', leg: '#241e2c', trim: '#a02838', pattern: 'plate', pauldron: '#3a2e44', glow: '#ff3a4a' },
};
export const WEAPONS = {
  sword_wood:   { len: 15, w: 2.6, blade: '#8a6a40', edge: '#a8865a', guard: '#5a3e24', type: 'sword' },
  sword_short:  { len: 14, w: 2.4, blade: '#b8bcc4', edge: '#e8ecf0', guard: '#6a5a3a', type: 'sword' },
  sword_long:   { len: 20, w: 2.6, blade: '#c0c4cc', edge: '#eef2f6', guard: '#7a6a4a', type: 'sword' },
  sword_broad:  { len: 19, w: 4.2, blade: '#b0b4bc', edge: '#e0e4ea', guard: '#5a4a3a', type: 'sword' },
  sword_knight: { len: 22, w: 3, blade: '#d0d4dc', edge: '#ffffff', guard: '#c9a14a', type: 'sword' },
  sword_great:  { len: 28, w: 4.6, blade: '#a8acb4', edge: '#dde0e6', guard: '#4a3a2a', type: 'sword' },
  sword_argen:  { len: 24, w: 3.4, blade: '#cfe6ff', edge: '#ffffff', guard: '#e8c860', type: 'sword', glow: '#9fd0ff' },
  axe:          { len: 17, w: 2, blade: '#9a9ea6', edge: '#dfe2e6', guard: '#5a3e24', type: 'axe' },
  mace:         { len: 16, w: 2, blade: '#7a7e86', edge: '#b8bcc4', guard: '#5a3e24', type: 'mace' },
  // 몬스터 전용
  dagger:       { len: 9, w: 2, blade: '#8a8a80', edge: '#c8c8c0', guard: '#3a2a1a', type: 'sword' },
  staff:        { len: 30, w: 2.2, blade: '#3a2a3a', edge: '#5a4a5a', guard: '#3a2a3a', type: 'staff', orb: '#a060ff' },
  shovel:       { len: 26, w: 2, blade: '#6a6a66', edge: '#8a8a86', guard: '#4a321c', type: 'shovel' },
  scythe:       { len: 30, w: 2, blade: '#6a6a74', edge: '#c8c8d8', guard: '#2a1a2a', type: 'scythe' },
  bow:          { len: 18, w: 1.5, blade: '#5a3e24', edge: '#7a5a3a', guard: '#5a3e24', type: 'bow' },
  dark_great:   { len: 30, w: 5, blade: '#2a2430', edge: '#ff4a5a', guard: '#5a1a24', type: 'sword', glow: '#ff3040' },
};
export const SHIELDS = {
  shield_wood:  { shape: 'round', r: 7, face: '#6a4a2c', rim: '#4a4a4e', boss: '#8a8a90' },
  shield_iron:  { shape: 'kite', r: 8, face: '#7a7e88', rim: '#4a4c52', boss: '#c9a14a', emblem: '#5a2a2a' },
  shield_tower: { shape: 'tower', r: 10, face: '#5a5e68', rim: '#c9a14a', boss: '#c9a14a', emblem: '#2a3a6a' },
};
export const HELMS = {
  cap_leather: { kind: 'cap', c: '#5a3e24' },
  helm_iron:   { kind: 'iron', c: '#8a8e96' },
  helm_knight: { kind: 'knight', c: '#b0b5bd', plume: '#a02a2a' },
};
export const BOOTS = { boots_leather: '#4a321c', boots_iron: '#7a7e86' };

const SKIN_DEFAULT = '#e8c4a0';
// 내부 구분선: 반투명 남보라 → 아래 색과 섞여 '같은 계열의 한두 단계 어두운 선'이 된다 (실루엣 밖 부분은 알파 컷으로 제거)
export const INLINE = 'rgba(40,14,52,0.5)';
// ★v2 비율: 3.5~4등신, 키 약 54px(1×)
export const BODY_K = 1.0, HEAD_K = 1.12;

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
    noArmor: !A && !look.robe,
    robe: look.robe || null, apron: look.apron || null,
    boots: BOOTS[look.boots] || (A?.pattern === 'plate' ? A.leg : '#3a2a1c'),
    weapon: look.weapon || null, shield: look.shield || null, helm: look.helm || null,
    width: f ? 0.9 : 1, height: f ? 0.96 : 1,
  };
}

// 메인: 캐시 캔버스 ctx 에 (ox,oy)=발밑 기준으로 그린다
export function drawRig(ctx, ox, oy, dir, pose, st) {
  const a = dir * Math.PI / 4;
  const F = { x: Math.sin(a), y: -Math.cos(a) };
  const R = { x: Math.cos(a), y: Math.sin(a) };
  // ★v2 비율: 몸 ×1.0, 머리 ×1.12 → 약 3.7등신
  const H = (st.height ?? 1) * BODY_K, Wd = st.width ?? 1;
  const hunch = st.hunch ?? 0;
  const bob = pose.walk ? Math.abs(Math.sin(pose.phase)) * 1.4 : pose.breath * 0.35;
  const lean = pose.hurt * 2.5;
  const floatZ = st.float ? 6 + Math.sin(pose.phase || pose.breath) * 1.5 : 0;
  const P = (s, f, z) => [ox + R.x * s + F.x * (f - lean), oy + (R.y * s + F.y * (f - lean)) * 0.5 - z - floatZ];
  const D = (s, f) => R.y * s + F.y * f;
  const outline = st.outline ?? INLINE;
  const limbW = st.limbW ?? 4.6;
  const parts = [];
  const front = F.y > -0.25; // 얼굴 보임

  // ── 다리 ──
  const hipZ = 20 * H, hipS = 3.6 * Wd;
  for (const side of [-1, 1]) {
    if (st.float || st.robeFull) break;
    const sw = pose.walk ? Math.sin(pose.phase) * side : 0;
    const footF = sw * 6, footZ = pose.walk ? Math.max(0, -Math.cos(pose.phase) * side) * 2.5 : 0;
    const knee = P(side * hipS, footF * 0.55 + 1.5, hipZ * 0.5 + footZ * 0.5);
    const hip = P(side * hipS, 0, hipZ), foot = P(side * hipS * 0.9, footF, footZ);
    parts.push({ d: D(side * hipS, footF) - 3, draw() {
      bone2(ctx, hip, knee, foot, limbW + 0.6, st.leg, outline, st.bone);
      // 신발/정강이
      if (!st.bone) {
        line(ctx, knee[0] + (foot[0] - knee[0]) * 0.45, knee[1] + (foot[1] - knee[1]) * 0.45, foot[0], foot[1], limbW + 1.2, st.boots, outline);
        ctx.fillStyle = shade(st.boots, -0.2); ellipse(ctx, foot[0] + F.x * 1.5, foot[1] + 0.5, 3, 1.6); ctx.fill();
      }
    } });
  }

  // ── 몸통 ──
  const shZ = 36 * H - hunch * 3, waistZ = 21 * H;
  const shW = (6.8 * Math.abs(R.x) + 4.4 * Math.abs(F.x)) * Wd * (st.bulk ?? 1);
  const waW = shW * (st.taper ?? 0.78);
  const chest = P(0, hunch * 2, shZ), waist = P(0, 0, waistZ);
  parts.push({ d: 0, draw() {
    const capeFront = st.cape && F.y > 0.2;
    if (capeFront) drawCape(ctx, P, st, shZ, pose, true);
    if (st.robe || st.robeFull) {
      const hem = 1.5 * H, flare = waW * 1.45 + 1.5;
      const swing = pose.walk ? Math.sin(pose.phase) * 1.5 : 0;
      ctx.beginPath();
      ctx.moveTo(waist[0] - waW, waist[1]);
      ctx.lineTo(waist[0] + waW, waist[1]);
      ctx.lineTo(ox + flare + swing, oy - hem - floatZ);
      ctx.quadraticCurveTo(ox, oy - hem + 3 - floatZ, ox - flare + swing, oy - hem - floatZ);
      ctx.closePath();
      const rc = st.robe || st.body;
      ctx.fillStyle = rc; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.fillStyle = vgrad(ctx, ox - flare, waist[1], ox + flare, oy, rc); ctx.fillRect(ox - flare - 2, waist[1] - 2, flare * 2 + 4, oy - waist[1] + 4);
      // 의상 주름: 밑단으로 퍼지는 어두운 골 + 밝은 능선
      for (let i = -2; i <= 2; i++) {
        const fx0 = waist[0] + i * waW * 0.4, fx1 = ox + i * flare * 0.42 + swing;
        ctx.strokeStyle = rgba(shade(rc, -0.45), 0.7); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(fx0, waist[1] + 3); ctx.lineTo(fx1, oy - hem - floatZ); ctx.stroke();
        ctx.strokeStyle = rgba(shade(rc, 0.3), 0.45);
        ctx.beginPath(); ctx.moveTo(fx0 - 1, waist[1] + 5); ctx.lineTo(fx1 - 1.2, oy - hem - floatZ - 1); ctx.stroke();
      }
      ctx.restore();
      if (st.float) { // 흩어지는 밑단
        ctx.fillStyle = rgba(rc, 0.5);
        for (let i = -2; i <= 2; i++) { ellipse(ctx, ox + i * flare * 0.4, oy - hem - floatZ + 3 + Math.sin(i + (pose.phase || 0)) * 1.5, 2.5, 3); ctx.fill(); }
      }
    }
    if (st.bone) { boneTorso(ctx, chest, waist, shW, waW); if (st.cape && !capeFront) drawCape(ctx, P, st, shZ, pose, false); return; }
    // 상체
    ctx.beginPath();
    ctx.moveTo(chest[0] - shW, chest[1] + 1);
    ctx.quadraticCurveTo(chest[0], chest[1] - 2.5, chest[0] + shW, chest[1] + 1);
    ctx.lineTo(waist[0] + waW, waist[1]);
    ctx.lineTo(waist[0] - waW, waist[1]);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, chest[0] - shW, chest[1], chest[0] + shW, waist[1], st.body);
    ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.clip();
    // 아래로 갈수록 살짝 어둡게(허리 그늘) + 가장자리 반사광
    ctx.fillStyle = 'rgba(30,10,50,0.16)'; ctx.fillRect(chest[0] - shW - 2, waist[1] - 3, shW * 2 + 4, 4);
    ctx.fillStyle = rgba(shade(st.body, 0.35), 0.5); ctx.fillRect(chest[0] - shW - 1, chest[1], 1.2, waist[1] - chest[1]);
    torsoDetail(ctx, chest, waist, shW, waW, st, F, R, front);
    ctx.restore();
    // 허리띠
    ctx.fillStyle = st.belt || shade(st.trim, -0.2);
    ctx.fillRect(waist[0] - waW - 0.5, waist[1] - 2.5, waW * 2 + 1, 2.5);
    if (front && !st.bone) { ctx.fillStyle = '#c9a14a'; ctx.fillRect(waist[0] + F.x * 2 - 1, waist[1] - 2.5, 2, 2.5); }
    if (st.apron && front) {
      ctx.fillStyle = st.apron;
      const ax = waist[0] + F.x * 2.5, w2 = waW * 0.8 * (0.3 + 0.7 * F.y);
      ctx.beginPath(); ctx.moveTo(ax - w2, chest[1] + 4); ctx.lineTo(ax + w2, chest[1] + 4); ctx.lineTo(ax + w2 * 1.1, oy - 7); ctx.lineTo(ax - w2 * 1.1, oy - 7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = outline; ctx.stroke();
    }
    if (st.glow && front) { ctx.fillStyle = rgba(st.glow, 0.75); ellipse(ctx, chest[0] + F.x * 2, chest[1] + 6, 1.8, 1.8); ctx.fill(); }
    if (st.cape && !capeFront) drawCape(ctx, P, st, shZ, pose, false);
  } });

  // ── 팔 & 무기/방패 ──
  const shS = 6.6 * Wd * (st.bulk ?? 1);
  const swing = pose.swing;
  for (const side of [1, -1]) {
    const isWeapon = side === 1;
    let hand, theta = null;
    const sh3 = [side * shS, hunch * 2, shZ - 1];
    if (isWeapon && swing != null) {
      theta = swingAngle(swing);
      const phi = theta * 0.6 - 40;
      const pr = phi * Math.PI / 180;
      hand = [sh3[0] - 1.5, sh3[1] + Math.cos(pr) * 11, sh3[2] + Math.sin(pr) * 11];
    } else if (pose.cast) {
      hand = [side * 5, 9 * pose.cast + 3, shZ + 4 * pose.cast];
    } else if (st.armsForward) {
      hand = [side * 4.5, 12, shZ - 3 + (pose.walk ? Math.sin(pose.phase * 2 + side) : 0)];
    } else {
      const sw = pose.walk ? -Math.sin(pose.phase) * side * 4.5 : 0;
      const holdF = isWeapon && st.weapon ? 4 : (!isWeapon && st.shield ? 5 : 1);
      hand = [side * (shS + 0.8), sw + holdF, shZ - 13 + (pose.hurt ? 3 : 0)];
      if (isWeapon && st.weapon) theta = 62 + (pose.walk ? Math.sin(pose.phase) * 6 : pose.breath * 2);
    }
    const sp = P(...sh3), hp = P(...hand);
    const elbow = P((sh3[0] + hand[0]) / 2 + side * 1.5, (sh3[1] + hand[1]) / 2 - 1, (sh3[2] + hand[2]) / 2 - 1);
    const d = D(side * shS, hand[1] * 0.6) + 0.5;
    parts.push({ d, draw() {
      const wpn = isWeapon && st.weapon ? WEAPONS[st.weapon] : null;
      const shield = !isWeapon && st.shield ? SHIELDS[st.shield] : null;
      // 무기가 팔보다 뒤에 있어야 하는 경우(뒤로 젖힌 칼날)
      const bladeBehind = wpn && bladeDepth(theta, F, R) < -0.2;
      if (wpn && bladeBehind) drawWeapon(ctx, hp, theta, wpn, F, R, outline);
      bone2(ctx, sp, elbow, hp, limbW - 0.4, st.sleeve, outline, st.bone);
      if (!st.bone) { ctx.fillStyle = st.handColor || (st.gauntlet ? st.sleeve : st.skin); ellipse(ctx, hp[0], hp[1], 2.2, 2.2); ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke(); }
      if (st.claws) { ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hp[0] + i, hp[1]); ctx.lineTo(hp[0] + i * 2 + F.x * 3, hp[1] + 3.5); ctx.stroke(); } }
      if (st.pauldron) { ctx.fillStyle = st.pauldron; ellipse(ctx, sp[0], sp[1] + 0.5, 4.2, 3.4); ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ellipse(ctx, sp[0] - 1, sp[1] - 0.5, 2, 1.2); ctx.fill(); }
      if (wpn && !bladeBehind) drawWeapon(ctx, hp, theta, wpn, F, R, outline);
      if (shield) drawShield(ctx, hp, shield, F, R, outline);
    } });
  }

  // ── 머리 ──
  const headR = (st.headR ?? 6.3) * (st.headScale ?? 1) * HEAD_K;
  const headZ = shZ + headR + 2.2 - hunch * 2;
  const hc = P(0, hunch * 5 + 0.5, headZ);
  parts.push({ d: 0.3 + hunch, draw() {
    drawHead(ctx, hc, headR, st, F, R, front, outline, pose);
  } });

  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.draw();
}

// 좌상단 빛 그라데이션 (밝음→기본→그늘). 톤 매핑에서 여러 단으로 양자화된다
function vgrad(ctx, x0, y0, x1, y1, c) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1 + (y1 - y0) * 0.3);
  g.addColorStop(0, shade(c, 0.34)); g.addColorStop(0.3, shade(c, 0.1)); g.addColorStop(0.62, shade(c, -0.18)); g.addColorStop(1, shade(c, -0.46));
  return g;
}
function swingAngle(k) {
  // 0..0.3 들어올림(120°), 0.3..0.62 내려베기(-45°), 이후 복귀(60°)
  if (k < 0.3) return 62 + (125 - 62) * (k / 0.3);
  if (k < 0.62) { const t = (k - 0.3) / 0.32; return 125 - 170 * t * t * (3 - 2 * t); }
  const t = (k - 0.62) / 0.38; return -45 + (62 + 45) * t;
}
function bladeDir(theta, F, R) {
  const th = theta * Math.PI / 180;
  const s = 0.25, f = Math.cos(th), z = Math.sin(th);
  return [R.x * s + F.x * f, (R.y * s + F.y * f) * 0.5 - z];
}
function bladeDepth(theta, F, R) { const th = theta * Math.PI / 180; return R.y * 0.25 + F.y * Math.cos(th); }

function line(ctx, x1, y1, x2, y2, w, color, outline) {
  ctx.lineCap = 'round';
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = w + 1.6; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function bone2(ctx, a, b, c, w, color, outline, isBone) {
  if (isBone) {
    line(ctx, a[0], a[1], b[0], b[1], 1.8, '#d8ceb4', outline);
    line(ctx, b[0], b[1], c[0], c[1], 1.6, '#d8ceb4', outline);
    ctx.fillStyle = '#e8dec4'; ellipse(ctx, b[0], b[1], 1.6, 1.6); ctx.fill();
    ctx.fillStyle = '#e8dec4'; ellipse(ctx, c[0], c[1], 1.8, 1.8); ctx.fill();
    return;
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = outline; ctx.lineWidth = w + 1.6;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.strokeStyle = shade(color, -0.34); ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w * 0.7;
  ctx.beginPath(); ctx.moveTo(a[0] - w * 0.15, a[1]); ctx.lineTo(b[0] - w * 0.15, b[1]); ctx.lineTo(c[0] - w * 0.15, c[1]); ctx.stroke();
  ctx.strokeStyle = shade(color, 0.3); ctx.lineWidth = Math.max(1, w * 0.28);
  ctx.beginPath(); ctx.moveTo(a[0] - w * 0.3, a[1]); ctx.lineTo(b[0] - w * 0.3, b[1]); ctx.lineTo(c[0] - w * 0.3, c[1] - 0.5); ctx.stroke();
  // 관절 주름
  ctx.fillStyle = rgba(shade(color, -0.4), 0.6); ctx.fillRect(b[0] - w * 0.3, b[1] - 0.5, w * 0.6, 1);
}

function torsoDetail(ctx, chest, waist, shW, waW, st, F, R, front) {
  const x0 = Math.min(chest[0] - shW, waist[0] - waW), x1 = Math.max(chest[0] + shW, waist[0] + waW);
  const y0 = chest[1] - 3, y1 = waist[1];
  if (st.pattern === 'chain') {
    ctx.fillStyle = 'rgba(30,30,36,0.35)';
    for (let y = y0; y < y1; y += 2) for (let x = x0 + ((y - y0) % 4 ? 1 : 0); x < x1; x += 2) ctx.fillRect(x, y, 1, 1);
  } else if (st.pattern === 'scale') {
    ctx.strokeStyle = 'rgba(20,24,30,0.45)'; ctx.lineWidth = 0.8;
    for (let y = y0 + 2, k = 0; y < y1; y += 2.6, k++) for (let x = x0 + (k % 2) * 1.6; x < x1; x += 3.2) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI); ctx.stroke(); }
  } else if (st.pattern === 'plate') {
    ctx.fillStyle = 'rgba(255,250,230,0.3)'; ctx.fillRect(chest[0] - shW * 0.6 + F.x * 1.5, y0 + 3, shW * 0.45, (y1 - y0) * 0.6);
    ctx.fillStyle = 'rgba(255,255,245,0.85)'; ctx.fillRect(chest[0] - shW * 0.5 + F.x * 1.5, y0 + 4, 1.2, 2.2); // 반짝 점
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x0, y0 + (y1 - y0) * 0.62); ctx.lineTo(x1, y0 + (y1 - y0) * 0.62); ctx.stroke();
    if (front) { ctx.beginPath(); ctx.moveTo(chest[0] + F.x * 2, y0 + 2); ctx.lineTo(waist[0] + F.x * 2, y1); ctx.stroke(); }
  } else if (st.strap && front) {
    ctx.strokeStyle = st.trim; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(chest[0] - shW * 0.8, y0 + 2); ctx.lineTo(waist[0] + waW * 0.8, y1 - 2); ctx.stroke();
    ctx.fillStyle = '#9a8a6a'; ctx.fillRect(chest[0] - 1, (y0 + y1) / 2 - 1, 2, 2);
  } else if (st.ribs) {
    ctx.strokeStyle = '#d8ceb4'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { const y = y0 + 4 + i * 3; ctx.beginPath(); ctx.moveTo(chest[0] - shW * 0.8, y); ctx.quadraticCurveTo(chest[0], y + 1.5, chest[0] + shW * 0.8, y); ctx.stroke(); }
    line(ctx, chest[0], y0 + 2, waist[0], y1, 1.6, '#d8ceb4');
  } else if (!st.pattern && !st.bone) {
    if (front) { // 깃 (V 넥) + 단추
      ctx.fillStyle = rgba(shade(st.body, -0.5), 0.8);
      ctx.beginPath(); ctx.moveTo(chest[0] + F.x * 2 - 2.5, y0 + 1); ctx.lineTo(chest[0] + F.x * 2, y0 + 5); ctx.lineTo(chest[0] + F.x * 2 + 2.5, y0 + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(shade(st.body, 0.4), 0.9); ctx.fillRect(chest[0] + F.x * 2 - 0.5, y0 + 7, 1, 1); ctx.fillRect(chest[0] + F.x * 2 - 0.5, y0 + 10, 1, 1);
    }
    ctx.strokeStyle = rgba(shade(st.body, -0.45), 0.6); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(chest[0] - shW * 0.2, y0 + 5); ctx.lineTo(waist[0] - waW * 0.45, y1 - 1);
    ctx.moveTo(chest[0] + shW * 0.45, y0 + 4); ctx.lineTo(waist[0] + waW * 0.2, y1 - 1); ctx.stroke();
    if (st.rags) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) ctx.fillRect(x0 + (i * 7.3) % (x1 - x0), y0 + ((i * 5.1) % (y1 - y0)), 2.5, 3.5); }
  } else if (st.rags) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 4; i++) ctx.fillRect(x0 + (i * 7.3) % (x1 - x0), y0 + ((i * 5.1) % (y1 - y0)), 2.5, 3.5);
  }
  if (front && st.noArmor === false && st.trim && !st.pattern) {
    ctx.strokeStyle = st.trim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(chest[0] - shW * 0.4 + F.x * 2, y0 + 1); ctx.lineTo(chest[0] + F.x * 2, y0 + 6); ctx.lineTo(chest[0] + shW * 0.4 + F.x * 2, y0 + 1); ctx.stroke();
  }
}

function drawCape(ctx, P, st, shZ, pose, behind) {
  const sway = pose.walk ? Math.sin(pose.phase * 2) * 1.5 : pose.breath * 0.5;
  const back = -5 - (pose.walk ? 3 : 0);
  const l = P(-6.8, -1.5, shZ + 1), r = P(6.8, -1.5, shZ + 1);
  const bl = P(-9.5, back, 3), br = P(9.5, back, 3);
  ctx.fillStyle = behind ? shade(st.cape, -0.3) : st.cape;
  ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(r[0], r[1]); ctx.lineTo(br[0] + sway, br[1]); ctx.quadraticCurveTo((bl[0] + br[0]) / 2 + sway, (bl[1] + br[1]) / 2 + 2, bl[0] + sway, bl[1]); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  if (!behind) { ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo((l[0] + r[0]) / 2, l[1]); ctx.lineTo((bl[0] + br[0]) / 2 + sway, bl[1]); ctx.stroke(); }
}

function boneTorso(ctx, chest, waist, shW, waW) {
  line(ctx, chest[0], chest[1] - 1, waist[0], waist[1], 1.8, '#d8ceb4', 'rgba(10,8,12,0.5)');
  ctx.strokeStyle = '#d8ceb4'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 4; i++) {
    const t = i / 4, y = chest[1] + 1 + (waist[1] - chest[1]) * t * 0.7, w = shW * (0.9 - t * 0.25);
    ctx.beginPath(); ctx.moveTo(chest[0] - w, y + 1.5); ctx.quadraticCurveTo(chest[0], y - 1, chest[0] + w, y + 1.5); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(chest[0] - shW, chest[1]); ctx.lineTo(chest[0] + shW, chest[1]); ctx.stroke();
  ctx.fillStyle = '#cfc4a8'; ctx.beginPath(); ctx.ellipse(waist[0], waist[1] - 1, waW * 1.1, 2.4, 0, 0, Math.PI * 2); ctx.fill();
}

function drawWeapon(ctx, hp, theta, W, F, R, outline) {
  const [dx, dy] = bladeDir(theta ?? 62, F, R);
  const L = W.len, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
  const px = -uy, py = ux; // 화면 수직
  const vis = Math.max(0.35, n); // 원근 단축
  const tipX = hp[0] + dx * L, tipY = hp[1] + dy * L;
  if (W.type === 'bow') {
    ctx.strokeStyle = W.blade; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hp[0] + px * 9, hp[1] + py * 9); ctx.quadraticCurveTo(hp[0] + ux * 5, hp[1] + uy * 5, hp[0] - px * 9, hp[1] - py * 9); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,220,200,0.7)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(hp[0] + px * 9, hp[1] + py * 9); ctx.lineTo(hp[0] - px * 9, hp[1] - py * 9); ctx.stroke();
    return;
  }
  // 손잡이 (손 뒤로)
  line(ctx, hp[0] - ux * 3, hp[1] - uy * 3, hp[0] + ux * 2, hp[1] + uy * 2, 1.8, W.guard, outline);
  if (W.type === 'sword') {
    const w = W.w * 0.5;
    if (W.glow) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      line(ctx, hp[0] + ux * 3, hp[1] + uy * 3, tipX, tipY, W.w + 5, rgba(W.glow, 0.25));
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(hp[0] + ux * 2 + px * w, hp[1] + uy * 2 + py * w);
    ctx.lineTo(tipX - ux * 3 * vis + px * w, tipY - uy * 3 * vis + py * w);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - ux * 3 * vis - px * w, tipY - uy * 3 * vis - py * w);
    ctx.lineTo(hp[0] + ux * 2 - px * w, hp[1] + uy * 2 - py * w);
    ctx.closePath();
    ctx.fillStyle = W.blade; ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = W.edge; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hp[0] + ux * 3 + px * w * 0.3, hp[1] + uy * 3 + py * w * 0.3); ctx.lineTo(tipX - ux * 2, tipY - uy * 2); ctx.stroke();
    // 가드
    line(ctx, hp[0] + ux * 2 + px * (w + 2.6), hp[1] + uy * 2 + py * (w + 2.6), hp[0] + ux * 2 - px * (w + 2.6), hp[1] + uy * 2 - py * (w + 2.6), 1.6, W.guard, outline);
    ctx.fillStyle = W.guard; ellipse(ctx, hp[0] - ux * 3.5, hp[1] - uy * 3.5, 1.4, 1.4); ctx.fill();
  } else if (W.type === 'axe') {
    line(ctx, hp[0], hp[1], tipX, tipY, 1.8, '#5a3e24', outline);
    const hx = tipX - ux * 3, hy = tipY - uy * 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + px * 7 - ux * 2, hy + py * 7 - uy * 2); ctx.quadraticCurveTo(hx + px * 8 + ux * 3, hy + py * 8 + uy * 3, hx + px * 6 + ux * 5, hy + py * 6 + uy * 5); ctx.lineTo(hx + ux * 2, hy + uy * 2); ctx.closePath();
    ctx.fillStyle = W.blade; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke();
  } else if (W.type === 'mace') {
    line(ctx, hp[0], hp[1], tipX, tipY, 1.8, '#4a3a2a', outline);
    ctx.fillStyle = W.blade; ellipse(ctx, tipX, tipY, 3.6, 3.6); ctx.fill(); ctx.strokeStyle = outline; ctx.stroke();
    ctx.fillStyle = W.edge; for (let i = 0; i < 6; i++) { const aa = i * 1.047; ctx.fillRect(tipX + Math.cos(aa) * 3.6 - 0.8, tipY + Math.sin(aa) * 3.6 - 0.8, 1.6, 1.6); }
  } else if (W.type === 'staff') {
    line(ctx, hp[0] - ux * 10, hp[1] - uy * 10, tipX, tipY, 2, W.blade, outline);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 8);
    g.addColorStop(0, rgba(W.orb, 0.9)); g.addColorStop(1, rgba(W.orb, 0));
    ctx.fillStyle = g; ctx.fillRect(tipX - 8, tipY - 8, 16, 16);
    ctx.restore();
    ctx.fillStyle = shade(W.orb, 0.4); ellipse(ctx, tipX, tipY, 2.4, 2.4); ctx.fill();
  } else if (W.type === 'shovel') {
    line(ctx, hp[0] - ux * 8, hp[1] - uy * 8, tipX, tipY, 1.8, W.guard, outline);
    ctx.fillStyle = W.blade; ctx.beginPath(); ctx.moveTo(tipX + px * 3, tipY + py * 3); ctx.lineTo(tipX - px * 3, tipY - py * 3); ctx.lineTo(tipX + ux * 7, tipY + uy * 7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = outline; ctx.stroke();
  } else if (W.type === 'scythe') {
    line(ctx, hp[0] - ux * 10, hp[1] - uy * 10, tipX, tipY, 1.8, W.guard, outline);
    ctx.strokeStyle = W.edge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo(tipX + px * 10 + ux * 2, tipY + py * 10 + uy * 2, tipX + px * 14 - ux * 6, tipY + py * 14 - uy * 6); ctx.stroke();
  }
}

function drawShield(ctx, hp, S, F, R, outline) {
  // 방패 법선: 정면+왼쪽
  const nx = F.x * 0.75 - R.x * 0.65, ny = F.y * 0.75 - R.y * 0.65;
  const wf = Math.max(0.22, Math.abs(ny) * 0.9 + 0.1);
  const showFront = ny > -0.05;
  ctx.save();
  ctx.translate(hp[0] + nx * 1.5, hp[1] - 1);
  ctx.scale(wf, 1);
  ctx.beginPath();
  const r = S.r;
  if (S.shape === 'round') ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (S.shape === 'kite') { ctx.moveTo(-r * 0.85, -r * 0.8); ctx.lineTo(r * 0.85, -r * 0.8); ctx.quadraticCurveTo(r * 0.9, r * 0.4, 0, r * 1.25); ctx.quadraticCurveTo(-r * 0.9, r * 0.4, -r * 0.85, -r * 0.8); }
  else { ctx.rect(-r * 0.7, -r * 1.1, r * 1.4, r * 2.2); }
  ctx.fillStyle = showFront ? S.face : shade(S.face, -0.45); ctx.fill();
  ctx.strokeStyle = S.rim; ctx.lineWidth = 1.8 / wf * 0.6 + 1; ctx.stroke();
  ctx.strokeStyle = outline; ctx.lineWidth = 0.6; ctx.stroke();
  if (showFront) {
    if (S.emblem) { ctx.fillStyle = S.emblem; ctx.fillRect(-1.2, -r * 0.6, 2.4, r * 1.2); ctx.fillRect(-r * 0.45, -r * 0.2, r * 0.9, 2.4); }
    ctx.fillStyle = S.boss; ellipse(ctx, 0, 0, 1.8, 1.8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ellipse(ctx, -r * 0.35, -r * 0.4, r * 0.3, r * 0.2); ctx.fill();
  }
  ctx.restore();
}

// ── 머리 종류별 ──
function drawHead(ctx, c, r, st, F, R, front, outline, pose) {
  const [x, y] = c;
  const q = r / 6.3;
  const eyeOff = (side) => [x + (R.x * side * 2.3 + F.x * 3.8) * q, y + 1.2 * q + (R.y * side * 2.3 + F.y * 3.8) * 0.25 * q];
  const eyeVisible = (side) => F.y * 3.8 + R.y * side * 2.3 > -1.2;
  const eyes = (color, size = 1.2, glow = false) => {
    if (!front && !glow) return;
    for (const side of [-1, 1]) {
      if (!eyeVisible(side)) continue;
      const [ex, ey] = eyeOff(side);
      if (glow) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 4); g.addColorStop(0, rgba(color, 0.9)); g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g; ctx.fillRect(ex - 4, ey - 4, 8, 8); ctx.restore();
      }
      ctx.fillStyle = color; ctx.fillRect(Math.round(ex - 0.5), Math.round(ey - 1), Math.max(1, Math.round(size)), Math.max(2, Math.round(size * 1.6)));
    }
  };
  // 플랫 2~3단 명암 구 (그림자 초승달 + 하이라이트 점)
  const ball = (color, rx = r, ry = r) => {
    const g = ctx.createRadialGradient(x - rx * 0.38, y - ry * 0.42, 0.5, x, y, Math.max(rx, ry) * 1.15);
    g.addColorStop(0, shade(color, 0.28)); g.addColorStop(0.45, color); g.addColorStop(0.85, shade(color, -0.22)); g.addColorStop(1, shade(color, -0.38));
    ctx.fillStyle = g; ellipse(ctx, x, y, rx, ry); ctx.fill();
    ellipse(ctx, x, y, rx, ry); ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
  };
  switch (st.head) {
    case 'skull': {
      ball('#e0d6bc', r * 0.95, r);
      ctx.fillStyle = '#d0c6ac'; ellipse(ctx, x + F.x * 2, y + r * 0.7, r * 0.6, r * 0.35); ctx.fill();
      if (front) {
        for (const side of [-1, 1]) if (eyeVisible(side)) { const [ex, ey] = eyeOff(side); ctx.fillStyle = '#1a1414'; ellipse(ctx, ex, ey, 1.7, 1.9); ctx.fill(); }
        ctx.fillStyle = '#2a2420'; ctx.fillRect(x + F.x * 4 - 0.6, y + 2.6, 1.2, 1.4);
        ctx.fillStyle = '#5a5248'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + F.x * 3.5 + i * 1.1, y + r * 0.72, 0.6, 1.4);
      }
      if (st.eyeGlow) eyes(st.eyeGlow, 1.2, true);
      if (st.crownHelm) crownHelm(ctx, x, y, r, st, F, outline);
      return;
    }
    case 'goblin': {
      for (const side of [-1, 1]) {
        const ex = x + R.x * side * r * 0.9, ey = y - 1 + R.y * side * r * 0.4;
        ctx.fillStyle = shade(st.skin, -0.1);
        ctx.beginPath(); ctx.moveTo(ex, ey - 2); ctx.lineTo(ex + R.x * side * 7 - F.x * 2, ey - 4); ctx.lineTo(ex, ey + 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke();
      }
      ball(st.skin, r, r * 0.92);
      eyes('#ffd23a', 1.6, false);
      if (front) { ctx.fillStyle = shade(st.skin, -0.3); ellipse(ctx, x + F.x * 5.2, y + 2, 1.6, 1.2); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.fillRect(x + F.x * 3.5 - 2, y + 4, 4, 0.9); }
      return;
    }
    case 'hood': {
      const hc = st.hoodColor || st.body;
      ctx.fillStyle = shade(hc, -0.1);
      ctx.beginPath(); ctx.moveTo(x - r * 1.15, y + r * 0.9); ctx.quadraticCurveTo(x - r * 1.3, y - r * 1.1, x - F.x * 2, y - r * 1.45); ctx.quadraticCurveTo(x + r * 1.3, y - r * 1.1, x + r * 1.15, y + r * 0.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
      if (front) {
        ctx.fillStyle = '#060408'; ellipse(ctx, x + F.x * 2.5, y + 0.8, r * 0.72 * (0.5 + 0.5 * Math.abs(F.y) + 0.2), r * 0.72); ctx.fill();
        if (st.face === 'skull') { ctx.fillStyle = 'rgba(210,200,180,0.55)'; ellipse(ctx, x + F.x * 2.5, y + 1.5, r * 0.45, r * 0.55); ctx.fill(); }
      }
      eyes(st.eyeGlow || '#ff4a3a', 1.3, true);
      return;
    }
    case 'knight': {
      const hc = st.helmColor || '#8a9098';
      ball(hc, r * 1.05, r * 1.08);
      ctx.fillStyle = shade(hc, -0.25); ctx.fillRect(x - r * 1.05, y + r * 0.55, r * 2.1, 2);
      if (front) {
        ctx.fillStyle = '#0a0a0e';
        const w = r * 1.4 * (0.35 + 0.65 * Math.max(0, F.y));
        ctx.fillRect(x + F.x * 3.5 - w / 2, y - 0.5, w, 1.6);
        if (st.eyeGlow) eyes(st.eyeGlow, 1.1, true);
      }
      if (st.horns) for (const side of [-1, 1]) {
        const hx = x + R.x * side * r * 0.9, hy = y - r * 0.5;
        ctx.fillStyle = '#1a1418'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + R.x * side * 7, hy - 3, hx + R.x * side * 5, hy - 10); ctx.lineTo(hx + R.x * side * 1, hy - 2); ctx.closePath(); ctx.fill();
      }
      if (st.plume) { ctx.fillStyle = st.plume; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x - F.x * 9, y - r - 5, x - F.x * 12, y + 2); ctx.quadraticCurveTo(x - F.x * 5, y - r, x, y - r + 2); ctx.fill(); }
      if (st.crownHelm) crownHelm(ctx, x, y, r, st, F, outline);
      return;
    }
    case 'golem': {
      ctx.fillStyle = st.skin; ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.6); ctx.lineTo(x - r * 0.4, y - r * 1.05); ctx.lineTo(x + r * 0.6, y - r * 1); ctx.lineTo(x + r, y - r * 0.2); ctx.lineTo(x + r * 0.8, y + r * 0.9); ctx.lineTo(x - r * 0.8, y + r * 0.9); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + r * 0.2, y - r * 0.8, r * 0.7, r * 1.6);
      eyes(st.eyeGlow || '#7fd8ff', 1.6, true);
      return;
    }
    default: break;
  }
  // 사람/좀비/구울: 피부 머리 + 머리카락
  const H = HAIRS[st.hair ?? 0] || HAIRS[0];
  if (st.hairColor && H.back) H.back(ctx, x, y, r, st.hairColor, F, R, outline, pose);
  ball(st.skin, r * 0.92, r);
  // 귀
  if (st.head === 'human' && Math.abs(F.x) > 0.5) { const ex = x - F.x * 1.2, ey = y + 0.6; ctx.fillStyle = shade(st.skin, -0.1); ellipse(ctx, ex, ey, 1.4, 2); ctx.fill(); }
  if (front) {
    const eyeC = st.head === 'zombie' ? '#d8e070' : st.head === 'ghoul' ? '#ffe060' : '#1c1410';
    eyes(eyeC, st.head === 'ghoul' ? 1.5 : 1.2, st.head === 'ghoul');
    if (st.head === 'human' && F.y > 0.2) { ctx.fillStyle = shade(st.skin, -0.25); ctx.fillRect(x + F.x * 4 * q - 1, y + 3.8 * q, 2, 1); }
    if (st.head === 'ghoul' || st.head === 'zombie') { ctx.fillStyle = '#2a0a0a'; ellipse(ctx, x + F.x * 4, y + 3.8, 2, 1.2); ctx.fill(); }
    if (st.blush && F.y > 0.3) { ctx.fillStyle = 'rgba(220,120,120,0.35)'; for (const s of [-1, 1]) { const [ex, ey] = eyeOff(s); ctx.fillRect(ex - 1, ey + 2, 2, 1); } }
  }
  if (st.beard && front) {
    ctx.fillStyle = st.beardColor || st.hairColor || '#ccc';
    ctx.beginPath(); ctx.ellipse(x + F.x * 3, y + r * 0.6, r * 0.7, r * 0.6, 0, 0, Math.PI); ctx.lineTo(x + F.x * 3 - r * 0.7, y + 1); ctx.fill();
  }
  if (st.helm && HELMS[st.helm]) { drawHelm(ctx, x, y, r, HELMS[st.helm], F, R, outline, front); return; }
  if (st.hairColor && H.top) H.top(ctx, x, y, r, st.hairColor, F, R, outline, front);
}

function crownHelm(ctx, x, y, r, st, F, outline) {
  ctx.fillStyle = st.crown || '#c9a14a';
  ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.55);
  for (let i = 0; i <= 4; i++) { const t = i / 4; ctx.lineTo(x - r + 2 * r * t, y - r * (i % 2 ? 1.2 : 1.9)); }
  ctx.lineTo(x + r, y - r * 0.55); ctx.closePath(); ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#ff3040'; ellipse(ctx, x + F.x * 2, y - r * 0.95, 1.3, 1.3); ctx.fill();
}

function drawHelm(ctx, x, y, r, Hm, F, R, outline, front) {
  ctx.strokeStyle = outline; ctx.lineWidth = 1;
  if (Hm.kind === 'cap') {
    ctx.fillStyle = Hm.c;
    ctx.beginPath(); ctx.arc(x, y - 0.5, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(x + r * 1.05, y + 0.5); ctx.lineTo(x - r * 1.05, y + 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(Hm.c, -0.25); ctx.fillRect(x - r * 1.05, y - 0.5, r * 2.1, 1.6);
  } else if (Hm.kind === 'iron') {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.6, 0.5, x, y - r * 0.3, r * 1.2);
    g.addColorStop(0, shade(Hm.c, 0.4)); g.addColorStop(1, shade(Hm.c, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.08, Math.PI, 0); ctx.lineTo(x + r * 1.08, y + 1); ctx.lineTo(x - r * 1.08, y + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (front) { ctx.fillStyle = shade(Hm.c, -0.2); ctx.fillRect(x + F.x * 4.2 - 0.8, y - 1, 1.6, 4.5); }
    ctx.fillStyle = shade(Hm.c, -0.35); ctx.fillRect(x - r * 1.08, y, r * 2.16, 1.4);
  } else {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 0.5, x, y, r * 1.3);
    g.addColorStop(0, shade(Hm.c, 0.45)); g.addColorStop(1, shade(Hm.c, -0.3));
    ctx.fillStyle = g; ellipse(ctx, x, y + 0.3, r * 1.1, r * 1.15); ctx.fill(); ctx.stroke();
    if (front) { ctx.fillStyle = '#0a0a10'; const w = r * 1.4 * (0.35 + 0.65 * Math.max(0, F.y)); ctx.fillRect(x + F.x * 3.5 - w / 2, y, w, 1.5); ctx.fillRect(x + F.x * 3.8 - 0.5, y, 1, 4); }
    ctx.fillStyle = Hm.plume; ctx.beginPath(); ctx.moveTo(x, y - r * 1.1); ctx.quadraticCurveTo(x - F.x * 8, y - r * 1.8, x - F.x * 12 - 1, y + 1); ctx.quadraticCurveTo(x - F.x * 5, y - r * 1.1, x + 1, y - r * 0.9); ctx.fill();
  }
}

// 머리 모양 0..5: 짧은 머리, 긴 머리, 묶은 머리, 뻗친 머리, 단발, 땋은 머리
const capHair = (ctx, x, y, r, c, F, outline, depth = 0.25) => {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.8, 0.5, x, y - r * 0.2, r * 1.3);
  g.addColorStop(0, shade(c, 0.3)); g.addColorStop(0.5, c); g.addColorStop(1, shade(c, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x - F.x * 0.6, y - 0.4, r * 1.04, Math.PI * (1 - depth * 0.3), Math.PI * (2 + depth * 0.3)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke();
  hairStrands(ctx, x - F.x * 0.6, y - 0.4, r * 1.04, c);
};
// 머리카락 결: 정수리에서 내려오는 어두운 결 + 빛 받는 고리(엔젤링)
function hairStrands(ctx, x, y, r, c) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, Math.PI, Math.PI * 2); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = rgba(shade(c, -0.45), 0.75); ctx.lineWidth = 0.8;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * r * 0.18, y - r * 0.95); ctx.quadraticCurveTo(x + i * r * 0.45, y - r * 0.5, x + i * r * 0.62, y); ctx.stroke(); }
  ctx.strokeStyle = rgba(shade(c, 0.45), 0.85); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x - r * 0.1, y - r * 0.1, r * 0.62, Math.PI * 1.12, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}
const backFull = (ctx, x, y, r, c, F, outline) => {
  if (F.y > -0.25) return;
  ctx.fillStyle = c; ellipse(ctx, x, y + 0.5, r * 1.02, r * 1.05); ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke();
};
export const HAIRS = [
  { back: backFull, top(ctx, x, y, r, c, F, R, o, front) { capHair(ctx, x, y, r, c, F, o, 0.15); if (!front) backFull(ctx, x, y, r, c, F, o); } },
  { back(ctx, x, y, r, c, F, R, o) { ctx.fillStyle = shade(c, -0.1); ctx.beginPath(); ctx.moveTo(x - r * 1.05, y); ctx.lineTo(x - r * 1.1 - F.x, y + r * 2.1); ctx.lineTo(x + r * 1.1 - F.x, y + r * 2.1); ctx.lineTo(x + r * 1.05, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = o; ctx.lineWidth = 0.8; ctx.stroke(); },
    top(ctx, x, y, r, c, F, R, o, front) { capHair(ctx, x, y, r, c, F, o, 0.35); if (!front) { ctx.fillStyle = c; ctx.fillRect(x - r * 1.05, y - r * 0.2, r * 2.1, r * 2.2); } else for (const s of [-1, 1]) { ctx.fillStyle = c; ctx.fillRect(x + s * r * 0.95 - 1.2 + F.x, y - 1, 2.4, r * 1.6); } } },
  { back: backFull, top(ctx, x, y, r, c, F, R, o, front) {
    capHair(ctx, x, y, r, c, F, o, 0.2); if (!front) backFull(ctx, x, y, r, c, F, o);
    const tx = x - F.x * r * 1.05, ty = y - r * 0.2 - F.y * 1.5;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(tx - 1.5, ty); ctx.quadraticCurveTo(tx - F.x * 4 - 2, ty + 6, tx - F.x * 2, ty + 10); ctx.lineTo(tx + 1.5, ty); ctx.fill(); ctx.strokeStyle = o; ctx.lineWidth = 0.6; ctx.stroke();
  } },
  { back: backFull, top(ctx, x, y, r, c, F, R, o, front) {
    capHair(ctx, x, y, r, c, F, o, 0.1); if (!front) backFull(ctx, x, y, r, c, F, o);
    ctx.fillStyle = c; for (let i = -2; i <= 2; i++) { const bx = x + i * r * 0.42 - F.x; ctx.beginPath(); ctx.moveTo(bx - 2, y - r * 0.6); ctx.lineTo(bx + i * 0.8, y - r * 1.55 - (2 - Math.abs(i))); ctx.lineTo(bx + 2, y - r * 0.6); ctx.fill(); }
  } },
  { back(ctx, x, y, r, c, F, R, o) { ctx.fillStyle = shade(c, -0.1); ellipse(ctx, x - F.x, y + r * 0.45, r * 1.15, r * 1.05); ctx.fill(); ctx.strokeStyle = o; ctx.lineWidth = 0.8; ctx.stroke(); },
    top(ctx, x, y, r, c, F, R, o, front) { capHair(ctx, x, y, r, c, F, o, 0.4); if (front) { ctx.fillStyle = c; ctx.fillRect(x - r * 0.8 + F.x * 2, y - r * 0.75, r * 1.6, 2.4); } else backFull(ctx, x, y, r, c, F, o); } },
  { back(ctx, x, y, r, c, F, R, o) { if (F.y > 0.4) return; const bx = x - F.x * r * 0.6; ctx.fillStyle = c; for (let i = 0; i < 4; i++) { ellipse(ctx, bx, y + r * 0.8 + i * 2.6, 1.9, 1.6); ctx.fill(); } },
    top(ctx, x, y, r, c, F, R, o, front) { capHair(ctx, x, y, r, c, F, o, 0.25); if (!front) backFull(ctx, x, y, r, c, F, o); } },
];

// ── 인간형 몬스터 스타일 ──
export const HUMANOID_BODIES = {
  goblin:       { head: 'goblin', skin: '#6a8a3a', body: '#5a4a2a', sleeve: '#6a8a3a', leg: '#4a3a24', trim: '#3a2a1a', boots: '#3a2a1a', weapon: 'dagger', height: 0.72, width: 0.95, headR: 6.4, hunch: 0.4, rags: true, gauntlet: true, handColor: '#6a8a3a' },
  skeleton:     { head: 'skull', skin: '#e0d6bc', body: 'rgba(0,0,0,0)', sleeve: '#d8ceb4', leg: '#d8ceb4', trim: '#5a4a3a', boots: '#d8ceb4', weapon: 'sword_short', shield: 'shield_wood', bone: true, ribs: true, limbW: 2, taper: 0.5, bulk: 0.8, belt: '#4a3a2a' },
  skeleton_archer: { head: 'skull', skin: '#e0d6bc', body: 'rgba(0,0,0,0)', sleeve: '#d8ceb4', leg: '#d8ceb4', trim: '#5a4a3a', boots: '#d8ceb4', weapon: 'bow', bone: true, ribs: true, limbW: 2, taper: 0.5, bulk: 0.8, belt: '#4a3a2a', eyeGlow: '#ff7040' },
  zombie:       { head: 'zombie', skin: '#7a8a62', body: '#4a4436', sleeve: '#7a8a62', leg: '#3a3a30', trim: '#2a2a20', boots: '#4a4a3a', hunch: 0.6, armsForward: true, rags: true, hairColor: '#2a2a20', hair: 3 },
  ghoul:        { head: 'ghoul', skin: '#8a8e84', body: '#7a7e74', sleeve: '#8a8e84', leg: '#6a6e64', trim: '#3a3a34', boots: '#5a5e54', hunch: 1.1, claws: true, height: 0.9, bulk: 0.85, taper: 0.6, handColor: '#8a8e84', rags: true },
  gravekeeper:  { head: 'hood', hoodColor: '#3a3428', face: 'skull', skin: '#a8a090', body: '#3a3428', sleeve: '#3a3428', leg: '#2a2620', trim: '#5a4a30', boots: '#2a2620', weapon: 'shovel', hunch: 0.8, height: 1.15, bulk: 1.35, robe: '#332e24', eyeGlow: '#7fe0a0', handColor: '#a8a090' },
  knight_spirit:{ head: 'knight', helmColor: '#8ab4e8', body: '#7aa0d8', sleeve: '#6a90c8', leg: '#5a80b8', trim: '#c0e0ff', boots: '#5a80b8', weapon: 'sword_long', shield: 'shield_iron', pattern: 'plate', pauldron: '#9ac0f0', eyeGlow: '#e0f4ff', gauntlet: true, height: 1.1, cape: '#4a6aa8' },
  knight_dark:  { head: 'knight', helmColor: '#2a2430', body: '#2c2434', sleeve: '#2a2232', leg: '#241e2c', trim: '#a02838', boots: '#1e1a24', weapon: 'dark_great', pattern: 'plate', pauldron: '#3a2e44', eyeGlow: '#ff3040', horns: true, gauntlet: true, height: 1.1, bulk: 1.1, glow: '#ff3a4a', cape: '#5a1a24' },
  lich:         { head: 'hood', hoodColor: '#2a1a34', face: 'skull', skin: '#c8c0a8', body: '#2a1a34', sleeve: '#2a1a34', leg: '#1a1020', trim: '#a060ff', boots: '#1a1020', weapon: 'staff', robe: '#2a1a34', robeFull: true, float: true, eyeGlow: '#c070ff', handColor: '#c8c0a8', height: 1.1, crown: '#8a6aaa' },
  dusk_king:    { head: 'knight', helmColor: '#1a1418', crownHelm: true, crown: '#b08a3a', body: '#1e1820', sleeve: '#1a141c', leg: '#141016', trim: '#ff3a3a', boots: '#100c12', weapon: 'dark_great', pattern: 'plate', pauldron: '#2a2028', eyeGlow: '#ff2a2a', gauntlet: true, height: 1.2, bulk: 1.25, glow: '#ff2a2a', cape: '#3a0a12', robe: '#1a1018' },
  golem:        { head: 'golem', skin: '#7a766c', body: '#6e6a60', sleeve: '#6e6a60', leg: '#625e56', trim: '#4a4640', boots: '#5a564e', bulk: 1.6, taper: 0.85, limbW: 8, height: 1.15, headR: 6, headScale: 1, handColor: '#7a766c', gauntlet: true, eyeGlow: '#7fd8ff' },
  cultist:      { head: 'hood', hoodColor: '#3a1418', skin: '#d8b090', body: '#3a1418', sleeve: '#3a1418', leg: '#1a0a0c', trim: '#a02030', boots: '#1a0a0c', robe: '#2e1014', weapon: 'dagger', eyeGlow: '#ff5040' },
};

export function humanoidStyle(body, look) {
  const base = HUMANOID_BODIES[body];
  if (!base) return null;
  const st = { ...base };
  if (look.weapon) st.weapon = look.weapon;
  if (look.robe && body === 'human') st.robe = look.robe;
  return st;
}

// 피부 계열 색 보정(tint)
export function tintStyle(st, tint) {
  if (!tint) return st;
  const t = (c) => (typeof c === 'string' && c.startsWith('#') ? mix(c, tint, 0.45) : c);
  const out = { ...st };
  for (const k of ['skin', 'body', 'sleeve', 'leg', 'boots', 'robe', 'cape', 'helmColor', 'hoodColor', 'pauldron']) if (out[k]) out[k] = t(out[k]);
  return out;
}
