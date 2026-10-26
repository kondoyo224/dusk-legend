// 시스템 상태 시각화(도트풍): 버프 표시, 투사체, 예고 장판 (워커 B 의 game.systems.* 실시간 목록을 읽는다). 소유: 워커 A.
import { tileToWorld } from '../core/iso.js';
import { clamp } from './util.js';
import { flame } from './tiles.js';
import { pxEllipse, pxLine, pxDitherDiamond } from './pixel.js';

export function drawEntityExtras(ctx, r, e, wx, wy, spr, time) {
  const top = spr.top ?? 46;
  const sc = e.look?.scale ?? 1;
  if (e.anim?.state === 'cast' && e.anim.t < 0.6) {
    // 시전: 손 위로 도는 4점 + 바닥 고리
    const k = Math.floor(clamp(e.anim.t / 0.6, 0, 1) * 4) / 4;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + k * Math.PI;
      ctx.fillStyle = i % 2 ? '#c8b0ff' : '#ffffff';
      ctx.fillRect(Math.round(wx + Math.cos(a) * 12), Math.round(wy - top * 0.6 + Math.sin(a) * 5), 2, 2);
    }
    pxEllipse(ctx, wx, wy, 14 + k * 6, 6 + k * 3, '#a890ff', 2);
  }
  if (!e.buffs?.length || e.dead) return;
  for (const b of e.buffs) {
    switch (b.id) {
      case 'stun': {
        for (let i = 0; i < 3; i++) {
          const a = Math.floor(time * 8) / 2 + i * 2.09;
          star(ctx, Math.round(wx + Math.cos(a) * 9 * sc), Math.round(wy - top - 4 + Math.sin(a) * 3));
        }
        break;
      }
      case 'iron_wall': case 'stoneskin': {
        const c = b.id === 'iron_wall' ? '#9ac0ff' : '#c8c0b0';
        if (Math.floor(time * 5) % 4 !== 0) pxEllipse(ctx, wx, Math.round(wy - top * 0.45), Math.round(15 * sc), Math.round(top * 0.6), c, 3);
        for (let i = 0; i < 3; i++) { const an = Math.floor(time * 6) / 3 + i * 2.09; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(wx + Math.cos(an) * 15 * sc) - 1, Math.round(wy - top * 0.45 + Math.sin(an) * top * 0.3) - 1, 2, 2); }
        break;
      }
      case 'war_cry': case 'wrath': {
        const c = b.id === 'war_cry' ? '#ff7a30' : '#ff3040';
        pxEllipse(ctx, wx, wy, Math.round(18 * sc), Math.round(8 * sc), c, 2);
        for (let i = 0; i < 3; i++) { const an = time * 1.7 + i * 2.09; flame(ctx, wx + Math.cos(an) * 12 * sc, wy + Math.sin(an) * 5 * sc, 0.5, time * 1.3 + i); }
        break;
      }
      case 'poison': {
        for (let i = 0; i < 3; i++) {
          const k = Math.floor(((time * 0.8 + i / 3 + e.id * 0.1) % 1) * 5) / 5;
          if (k > 0.8) continue;
          ctx.fillStyle = k < 0.4 ? '#a0f070' : '#60b040';
          const s = k < 0.4 ? 2 : 1;
          ctx.fillRect(Math.round(wx - 7 + i * 7), Math.round(wy - top * 0.5 - k * 18), s, s);
        }
        break;
      }
      default: break;
    }
  }
}

// 도트 별 (5×5 십자 + 중심)
function star(ctx, x, y) {
  ctx.fillStyle = '#5a3a00'; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 1, y - 3, 3, 7);
  ctx.fillStyle = '#ffe060'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
}

// 투사체: {kind:'arrow'|'soul_bolt'|'dark_bolt', x,y, fx,fy, tx,ty, t, dur}
export function drawProjectiles(ctx, r, time) {
  const list = r.game.systems?.projectiles;
  if (!list?.length) return;
  for (const pr of list) {
    const p = tileToWorld(pr.x, pr.y);
    const a = tileToWorld(pr.fx, pr.fy), b = tileToWorld(pr.tx, pr.ty);
    const k = clamp(pr.t / (pr.dur || 1), 0, 1);
    const arc = Math.sin(k * Math.PI) * (pr.kind === 'arrow' ? 14 : 6);
    const x = Math.round(p.x), y = Math.round(p.y - 24 - arc);
    const dx = b.x - a.x, dy = b.y - a.y - Math.cos(k * Math.PI) * (pr.kind === 'arrow' ? 22 : 9);
    const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    ctx.fillStyle = 'rgba(8,6,12,0.35)'; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y), 5, 2);
    if (pr.kind === 'arrow') {
      pxLine(ctx, x - ux * 10, y - uy * 10, x, y, '#7a5430');
      pxLine(ctx, x, y, x + ux * 3, y + uy * 3, '#e0e0e0');
      ctx.fillStyle = '#f0e8d8';
      ctx.fillRect(Math.round(x - ux * 10 - uy * 2), Math.round(y - uy * 10 + ux * 2), 1, 1);
      ctx.fillRect(Math.round(x - ux * 10 + uy * 2), Math.round(y - uy * 10 - ux * 2), 1, 1);
    } else {
      const c = pr.kind === 'soul_bolt' ? '#8ad0ff' : '#c040ff';
      const c2 = pr.kind === 'soul_bolt' ? '#e0f4ff' : '#ff6a8a';
      // 꼬리: 점점 작아지는 사각 점
      for (let i = 1; i <= 5; i++) { const s = Math.max(1, 4 - i); ctx.fillStyle = i < 3 ? c : '#4a3a8a'; ctx.fillRect(Math.round(x - ux * i * 4) - (s >> 1), Math.round(y - uy * i * 4) - (s >> 1), s, s); }
      const fr = Math.floor(time * 12) & 1;
      ctx.fillStyle = c; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
      ctx.fillStyle = c2; ctx.fillRect(x - 1, y - 1, 3, 3);
      if (fr) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 5, 1, 2); ctx.fillRect(x, y + 4, 1, 2); ctx.fillRect(x - 5, y, 2, 1); ctx.fillRect(x + 4, y, 2, 1); }
      r.fx.light(p.x, p.y - 24, 48, c, 0.05);
    }
  }
}

// 예고 장판: {tiles:[{x,y}], t(남은 초), total, kind} — 붉은 망점 + 깜빡이는 테두리
export function drawTelegraphs(ctx, r, time) {
  const list = r.game.systems?.telegraphs;
  if (!list?.length) return;
  for (const tg of list) {
    const k = clamp(1 - tg.t / (tg.total || 1), 0, 1);
    const on = Math.floor(time * 10) & 1;
    for (const t of tg.tiles || []) {
      const p = tileToWorld(t.x, t.y);
      const x = Math.round(p.x), y = Math.round(p.y);
      pxDitherDiamond(ctx, x, y, 30, 15, '#c81408', 0.3);
      const kk = Math.floor(k * 4) / 4;
      if (kk > 0) pxDitherDiamond(ctx, x, y, Math.round(30 * kk), Math.round(15 * kk), '#ff4020', 0.6);
      const c = on ? '#ff6a40' : '#c02010';
      pxLine(ctx, x, y - 15, x + 30, y, c); pxLine(ctx, x + 30, y, x, y + 15, c); pxLine(ctx, x, y + 15, x - 30, y, c); pxLine(ctx, x - 30, y, x, y - 15, c);
    }
  }
}
