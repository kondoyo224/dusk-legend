// 시스템 공용 도우미: 적대 판정, 버프, 시야, 무작위.
import { TILES } from '../data/tiles.js';
import { chebyshev } from '../core/iso.js';

export const ATTACK_CD = 0.55;     // 플레이어 기본 공격 간격(초)
export const MAX_LEVEL = 30;

export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const rollRange = (r) => (Array.isArray(r) ? randInt(r[0], r[1]) : r || 0);

// 살아 있는 적대 대상인가 (플레이어↔몬스터)
export function hostile(a, b) {
  if (!a || !b || a === b || b.dead) return false;
  if (b.kind !== 'player' && b.kind !== 'monster') return false;
  return a.faction !== b.faction;
}

// ── 버프: e.buffs = [{id, t, atk, def, reduce, stun, dot, immune, src}] ──
export function addBuff(e, buff) {
  if (!e.buffs) e.buffs = [];
  const i = e.buffs.findIndex((b) => b.id === buff.id);
  if (i >= 0) e.buffs[i] = { ...e.buffs[i], ...buff };
  else e.buffs.push({ ...buff });
}
export const hasBuff = (e, id) => !!e.buffs?.some((b) => b.id === id);
export const buffSum = (e, key) => (e.buffs ? e.buffs.reduce((s, b) => s + (b[key] || 0), 0) : 0);
export const isStunned = (e) => !!e.buffs?.some((b) => b.stun);
export const isImmune = (e) => e.boss || !!e.buffs?.some((b) => b.immune);
export function removeBuff(e, id) { if (e.buffs) e.buffs = e.buffs.filter((b) => b.id !== id); }

// 오브젝트(벽/나무 등 막힌 오브젝트)만 시야를 가린다. 물/구덩이는 너머로 쏠 수 있다.
export function lineOfSight(world, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  while (!(x === x1 && y === y1)) {
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) break;
    const o = world.objAt(x, y);
    if (o && !TILES[o]?.walk) return false;
    if (!world.inBounds(x, y)) return false;
  }
  return true;
}

// (x,y) 근처에서 비어 있는 칸 찾기 (나선형 탐색)
export function findFreeNear(world, x, y, maxR = 4, avoid = null) {
  if (world.isFree(x, y) && !(avoid && chebyshev(x, y, avoid.x, avoid.y) < 1)) return { x, y };
  for (let r = 1; r <= maxR; r++) {
    const cand = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (world.isFree(x + dx, y + dy)) cand.push({ x: x + dx, y: y + dy });
    }
    if (cand.length) return cand[Math.floor(Math.random() * cand.length)];
  }
  return null;
}
