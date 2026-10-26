// 엔티티 스프라이트: look → 리그/짐승 그리기, 프레임 양자화 + LRU 캐시, 섬광/혼/외곽선 변형. 소유: 워커 A.
import { makeCanvas, LRU, clamp, easeOut } from './util.js';
import { pixelize } from './pixel.js';
import { drawRig, poseOf, humanStyle, humanoidStyle, tintStyle, HUMANOID_BODIES } from './rig.js';
import { drawBeast, BEAST_BODIES, FLYING } from './beasts.js';

export { FLYING };
export const ATTACK_T = 0.34, HURT_T = 0.28, CAST_T = 0.5, DEAD_T = 0.6;
// 고전풍: 적은 프레임으로 끊어지는 애니메이션 (걷기 4, 공격 3)
const FRAMES = { walk: 4, idle: 2, attack: 3, hurt: 2, cast: 3, dead: 4 };
// 반투명 몸(영체): 도트화 시 2단 알파 유지
const SHEER = new Set(['shade', 'wraith']);
// 몸 자체가 계속 움직이는(날갯짓·일렁임) 종류: 정지 상태에서도 순환 프레임
const ALWAYS_CYCLE = new Set(['bat', 'shade', 'wraith', 'slime', 'lich']);

const cache = new LRU(900);
export function clearSpriteCache() { cache.clear(); }

export function lookKey(look) {
  return [look.body, look.gender, look.skin, look.hair, look.hairColor, look.robe, look.apron, look.beard ? 1 : 0, look.armor, look.weapon,
    look.shield, look.helm, look.boots, look.scale ?? 1, look.tint, look.cape].join('|');
}

// 엔티티의 현재 표시 상태 + 정규화 진행도
export function animOf(e, time) {
  const a = e.anim || { state: 'idle', t: 0 };
  const body = e.look?.body;
  if (e.dead && e.kind !== 'player') return { state: 'dead', k: clamp(a.state === 'dead' ? a.t / DEAD_T : 1, 0, 1) };
  if (a.state === 'attack' && a.t < ATTACK_T) return { state: 'attack', k: a.t / ATTACK_T };
  if (a.state === 'cast' && a.t < CAST_T) return { state: 'cast', k: a.t / CAST_T };
  if (a.state === 'hurt' && a.t < HURT_T) return { state: 'hurt', k: a.t / HURT_T };
  if (e.move || a.state === 'walk') {
    const sp = (e.speed ?? 4.6) * (e.speedMul ?? 1);
    return { state: 'walk', k: ((a.t * sp) / 2.2 + 0.25) % 1 };
  }
  if (ALWAYS_CYCLE.has(body)) return { state: 'walk', k: (time * (body === 'bat' ? 2.4 : 0.7) + (e.id || 0) * 0.37) % 1, hover: true };
  return { state: 'idle', k: (time * 0.45 + (e.id || 0) * 0.37) % 1 };
}

function styleFor(look) {
  const body = look.body || 'human';
  let st = body === 'human' ? humanStyle(look) : humanoidStyle(body, look);
  if (st && look.tint) st = tintStyle(st, look.tint);
  return st;
}

export function isHumanoid(body) { return !body || body === 'human' || !!HUMANOID_BODIES[body]; }

// 기본 스프라이트 {canvas, ax, ay, top}
export function getSprite(look, dir, state, k, time = 0) {
  const body = look.body || 'human';
  const n = FRAMES[state] || 4;
  const fi = state === 'dead' || state === 'attack' || state === 'hurt' || state === 'cast' ? Math.min(n - 1, Math.floor(k * n)) : Math.floor(k * n) % n;
  const key = `${lookKey(look)}#${dir}#${state}#${fi}`;
  let s = cache.get(key);
  if (s) return s;
  const sc = look.scale ?? 1;
  const W = Math.ceil(110 * sc), H = Math.ceil(120 * sc);
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const ax = Math.floor(W / 2), ay = H - Math.ceil(22 * sc);
  const kk = (fi + 0.5) / n;
  const pose = poseOf(state === 'dead' ? 'idle' : state, state === 'dead' ? 0 : kk);
  if (state === 'walk') pose.phase = kk * Math.PI * 2;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.scale(sc, sc);
  if (state === 'dead') {
    const t = easeOut(kk);
    const side = dir <= 3 ? 1 : -1;
    ctx.translate(0, -2 * t);
    ctx.rotate(side * t * Math.PI * 0.45);
    ctx.scale(1, 1 - t * 0.15);
  }
  const st = isHumanoid(body) ? styleFor(look) : null;
  if (st) drawRig(ctx, 0, 0, dir, pose, st);
  else if (BEAST_BODIES.has(body)) drawBeast(ctx, 0, 0, body, dir, pose, look, kk * 6.28);
  else drawRig(ctx, 0, 0, dir, pose, humanStyle(look));
  ctx.restore();
  pixelize(c, { keepAlpha: SHEER.has(body) });
  // 히트박스용 상단 높이(대략) — 고전 비율(짧은 몸 + 큰 머리)
  const top = (BEAST_BODIES.has(body) ? (body === 'wolf' || body === 'boar' ? 30 : body === 'rat' ? 16 : body === 'spider' ? 22 : body === 'slime' ? 22 : body === 'bat' ? 44 : 52) : 52 * (st?.height ?? 1)) * sc;
  s = { canvas: c, ax, ay, top, w: W, h: H, sc };
  return cache.set(key, s);
}

// 변형: 'flash'(흰 섬광) | 'ghost'(푸른 혼) | 'ghostDead' | 'outline:#hex'
export function getVariant(base, variant) {
  let v = base.variants?.[variant];
  if (v) return v;
  const c = makeCanvas(base.w, base.h), ctx = c.getContext('2d');
  if (variant.startsWith('outline:')) {
    const color = variant.slice(8);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(base.canvas, dx, dy);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color; ctx.fillRect(0, 0, base.w, base.h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(base.canvas, 0, 0);
  } else {
    ctx.drawImage(base.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    if (variant === 'flash') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, base.w, base.h); }
    else if (variant === 'ghost') {
      ctx.fillStyle = 'rgba(90,150,255,0.5)'; ctx.fillRect(0, 0, base.w, base.h);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(c, 0, 0);
    } else if (variant === 'ghostDead') { ctx.fillStyle = 'rgba(150,170,220,0.7)'; ctx.fillRect(0, 0, base.w, base.h); }
    else if (variant === 'red') { ctx.fillStyle = 'rgba(255,50,30,0.6)'; ctx.fillRect(0, 0, base.w, base.h); }
  }
  base.variants = base.variants || {};
  base.variants[variant] = c;
  return c;
}

// 초상화용 즉석 그리기 (캐시 없음, 큰 배율에서 선명하게)
export function drawLookAt(ctx, look, x, y, scale, dir = 4, state = 'idle', k = 0.25) {
  const body = look.body || 'human';
  const pose = poseOf(state, k);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const st = isHumanoid(body) ? styleFor(look) : null;
  if (st) drawRig(ctx, 0, 0, dir, pose, st);
  else drawBeast(ctx, 0, 0, body, dir, pose, look, 0);
  ctx.restore();
}
