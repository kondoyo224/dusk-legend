// 조명/대기 (도트풍): 어둠 오버레이 + 계단식(4단) 광원 구멍, 경계는 4×4 베이어 디더.
// 모든 좌표는 저해상도 월드 버퍼(1 월드px = 1 버퍼px) 기준. 넓은 가산 발광은 쓰지 않는다. 소유: 워커 A.
import { makeCanvas, rgba, mix, hash2, hexToRgb } from './util.js';
import { bayer } from './pixel.js';
import { tileToWorld } from '../core/iso.js';

const LIGHT_PX = 36;            // 광원 반경 1타일당 버퍼 px
const FIRE = /#ff|#ffa|#ff8/i;
const ISO = 0.62;               // 광원 타원 세로 비율

// 맵 darkness → 실제 어둠. 낮 맵(≤0.3)은 거의 밝게, 던전도 완전 암흑은 피한다 (ART_STYLE §3)
export function effectiveDarkness(d) {
  if (d <= 0.3) return d * 0.3;
  return Math.min(0.74, 0.09 + (d - 0.3) * 1.25);
}

// 계단식 광원 스탬프: 중심 1, 0.66, 0.33, 0 의 4단 + 단 경계 베이어 디더. (destination-out 으로 사용)
const stampCache = new Map();
function lightStamp(r, color = '#000000') {
  r = Math.max(6, Math.round(r / 3) * 3);
  const key = r + color;
  let c = stampCache.get(key);
  if (c) return c;
  const ry = Math.round(r * ISO);
  c = makeCanvas(r * 2 + 1, ry * 2 + 1);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height), d = img.data;
  const [cr, cg, cb] = hexToRgb(color);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const dx = (x - r) / r, dy = (y - ry) / ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= 1) continue;
    const f = Math.min(1, (1 - dist) / 0.55);          // 반경 45% 안쪽은 완전 밝음
    const q = Math.min(3, Math.floor(f * 3 + bayer(x, y))) / 3;
    if (q <= 0) continue;
    const i = (y * c.width + x) * 4;
    d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = Math.round(q * 255);
  }
  ctx.putImageData(img, 0, 0);
  if (stampCache.size > 300) stampCache.clear();
  stampCache.set(key, c);
  return c;
}

export class Lighting {
  constructor() {
    this.lc = makeCanvas(2, 2); this.lctx = this.lc.getContext('2d');
    this.w = 0; this.h = 0;
    this.particles = []; this.pType = null;
    this.fogTex = null;
    this.ambient = { darkness: 0, tint: null, particles: null, fog: false };
    this.dark = 0;
  }

  setMap(map) {
    const a = map?.ambient || {};
    this.ambient = { darkness: a.darkness ?? 0.2, tint: a.tint || null, particles: a.particles || null, fog: !!a.fog };
    this.dark = effectiveDarkness(this.ambient.darkness);
    this.particles = []; this.pType = this.ambient.particles;
    this.darkColor = mix('#0a0812', this.ambient.tint || '#0a0812', 0.3);
  }

  // 버퍼 크기
  resize(w, h) {
    this.w = w; this.h = h;
    this.lc.width = w; this.lc.height = h;
  }

  // 버퍼 좌표 광원 목록 → {x,y,r,color,a}
  collect(renderer, time) {
    const out = [];
    const { game } = renderer;
    const w = game.world;
    const toB = (x, y) => renderer.worldToBuf(x, y);
    const boost = 1 + this.dark * 0.35; // 어두운 맵일수록 광원을 넉넉히
    for (const L of w.lights) {
      const p = tileToWorld(L.x, L.y);
      const s = toB(p.x, p.y - 10);
      const r = (L.radius ?? 3) * LIGHT_PX * boost;
      if (s.x < -r || s.y < -r || s.x > this.w + r || s.y > this.h + r) continue;
      const fire = FIRE.test(L.color || '');
      // 고전식 깜빡임: 연속 변화 대신 계단(3px 단위 스탬프)으로 튄다
      const fl = fire ? 1 + (hash2(L.x, L.y, Math.floor(time * 7)) - 0.5) * 0.08 : 1;
      out.push({ x: s.x, y: s.y, r: r * fl, color: L.color || '#ffd8a0', a: 1, fire });
    }
    const p = game.player;
    if (p && game.scene === 'play') {
      const wp = tileToWorld(p.rx, p.ry);
      const s = toB(wp.x, wp.y - 20);
      out.push({ x: s.x, y: s.y, r: (p.ghost ? 3.8 : 3.4) * LIGHT_PX * boost, color: p.ghost ? '#8ab0ff' : '#ffe2b0', a: 0.95, self: true });
    }
    for (const e of w.entities) {
      if (e === p || e.dead) continue;
      const g = GLOW[e.look?.body];
      if (!g && !e.boss) continue;
      const wp = tileToWorld(e.rx, e.ry);
      const s = toB(wp.x, wp.y - 24);
      out.push({ x: s.x, y: s.y, r: (g?.r ?? 2) * LIGHT_PX * (e.look?.scale ?? 1), color: g?.c || '#ff5050', a: 0.7 });
    }
    for (const d of renderer.fx.dynLights) {
      const s = toB(d.x, d.y);
      // 반경은 12px 계단으로 (스탬프 캐시 재사용 + 고전식 끊김)
      out.push({ x: s.x, y: s.y, r: Math.max(12, Math.round(d.r * Math.max(0.3, d.life / d.max) / 12) * 12), color: d.color, a: Math.min(1, d.life / d.max * 1.5) });
    }
    return out;
  }

  // 버퍼(항등 변환) 위에 덮는다
  apply(ctx, renderer, time) {
    const A = this.ambient;
    const W = this.w, H = this.h;
    // 앰비언트 틴트 (낮 맵은 아주 약하게)
    if (A.tint) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = mix('#ffffff', A.tint, 0.1 + this.dark * 0.35); ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.dark < 0.02) return;
    const lights = this.collect(renderer, time);
    const c = this.lctx;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, W, H);
    c.fillStyle = rgba(this.darkColor, this.dark);
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const s = lightStamp(L.r);
      c.globalAlpha = L.a;
      c.drawImage(s, Math.round(L.x - (s.width >> 1)), Math.round(L.y - (s.height >> 1)));
    }
    c.globalAlpha = 1;
    ctx.drawImage(this.lc, 0, 0);
    // 색광: 광원 안쪽 절반만, 아주 옅은 계단식 색 (넓은 가산 발광 금지)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (L.self) continue;
      const s = lightStamp(L.r * 0.55, L.color);
      ctx.globalAlpha = 0.09 * L.a * (0.5 + this.dark);
      ctx.drawImage(s, Math.round(L.x - (s.width >> 1)), Math.round(L.y - (s.height >> 1)));
    }
    ctx.restore();
  }

  // ── 안개: 디더 망점 띠 (버퍼 좌표) ──
  drawFog(ctx, renderer, time) {
    if (!this.ambient.fog) return;
    const tint = mix('#c8c4d8', this.ambient.tint || '#9090a0', 0.4);
    if (!this.fogTex || this.fogKey !== tint) {
      const T = 192, t = makeCanvas(T, T / 2), c = t.getContext('2d');
      const img = c.createImageData(T, T / 2), d = img.data, [r, g, b] = hexToRgb(tint);
      for (let y = 0; y < T / 2; y++) for (let x = 0; x < T; x++) {
        const dx = (x - T / 2) / (T / 2), dy = (y - T / 4) / (T / 4), f = 1 - Math.sqrt(dx * dx + dy * dy);
        if (f <= 0) continue;
        if (bayer(x, y) < f * 0.32) { const i = (y * T + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
      }
      c.putImageData(img, 0, 0);
      this.fogTex = t; this.fogKey = tint;
    }
    const cam = renderer.camera;
    ctx.save();
    ctx.globalAlpha = 0.2;
    const cellW = 300, cellH = 150;
    for (let layer = 0; layer < 2; layer++) {
      const ox = -(((cam.x * (0.9 + layer * 0.2) + time * (7 + layer * 5)) % cellW) + cellW) % cellW;
      const oy = -(((cam.y * (0.9 + layer * 0.2) + time * 2) % cellH) + cellH) % cellH;
      for (let y = oy - cellH; y < this.h + cellH; y += cellH) for (let x = ox - cellW; x < this.w + cellW; x += cellW) {
        const j = hash2(Math.round((x - ox) / cellW + cam.x / cellW), Math.round((y - oy) / cellH), layer + 3);
        ctx.drawImage(this.fogTex, Math.round(x + j * cellW * 0.4), Math.round(y + (1 - j) * cellH * 0.3));
      }
    }
    ctx.restore();
  }

  // ── 입자 (월드 좌표) ──
  updateParticles(dt, renderer, time) {
    const type = this.pType;
    if (!type) return;
    const cam = renderer.camera;
    const vw = this.w, vh = this.h;
    const x0 = cam.x - vw / 2 - 40, y0 = cam.y - vh / 2 - 40, x1 = cam.x + vw / 2 + 40, y1 = cam.y + vh / 2 + 40;
    const want = { soul: 40, ash: 70, fireflies: 26, embers: 40, dust: 36 }[type] ?? 30;
    const ps = this.particles;
    while (ps.length < want) ps.push(this.spawn(type, x0, y0, x1, y1, ps.length < want * 0.5));
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (type === 'fireflies') { p.vx += Math.sin(time * 1.3 + p.seed * 9) * 12 * dt; p.vy += Math.cos(time * 1.1 + p.seed * 7) * 10 * dt; p.vx *= 0.99; p.vy *= 0.99; }
      if (type === 'soul') p.x += Math.sin(time * 1.2 + p.seed * 10) * 8 * dt;
      if (p.life <= 0 || p.x < x0 - 60 || p.x > x1 + 60 || p.y < y0 - 80 || p.y > y1 + 80) ps[i] = this.spawn(type, x0, y0, x1, y1, false);
    }
  }
  spawn(type, x0, y0, x1, y1, anywhere) {
    const r = Math.random;
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    const life = 3 + r() * 5;
    const base = { x, y, life, max: life, seed: r() };
    switch (type) {
      case 'soul': return { ...base, vx: (r() - 0.5) * 6, vy: -8 - r() * 14, size: r() < 0.3 ? 2 : 1, color: r() < 0.7 ? '#b8c8ff' : '#e0d0ff' };
      case 'ash': return { ...base, y: anywhere ? y : y0, vx: 10 + r() * 14, vy: 18 + r() * 16, size: 1, color: r() < 0.8 ? '#8a8480' : '#c0b8b0', life: 8 };
      case 'fireflies': return { ...base, vx: (r() - 0.5) * 10, vy: (r() - 0.5) * 10, size: 1, color: '#f0f880' };
      case 'embers': return { ...base, y: anywhere ? y : y1, vx: (r() - 0.5) * 16, vy: -30 - r() * 40, size: 1, color: r() < 0.6 ? '#ff8a30' : '#ffcf60' };
      default: return { ...base, vx: (r() - 0.5) * 5, vy: (r() - 0.5) * 4, size: 1, color: '#c8c0b0' };
    }
  }
  // 1~2px 사각 점, 깜빡임은 켜짐/꺼짐 계단
  drawParticles(ctx, time) {
    const type = this.pType;
    if (!type) return;
    for (const p of this.particles) {
      const t = p.life / p.max;
      let on = Math.sin(t * Math.PI) > 0.2;
      if (type === 'fireflies') on = on && Math.sin(time * 4 + p.seed * 20) > -0.2;
      if (type === 'embers') on = on && Math.sin(time * 15 + p.seed * 30) > -0.5;
      if (type === 'dust' && (p.seed * 7 | 0) % 2) on = on && Math.sin(time * 2 + p.seed * 9) > 0;
      if (!on) continue;
      const x = Math.round(p.x), y = Math.round(p.y);
      ctx.globalAlpha = type === 'dust' ? 0.5 : type === 'ash' ? 0.75 : 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(x, y, p.size, p.size);
      if (type === 'fireflies' || (type === 'soul' && p.size > 1)) {
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + p.size, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + p.size, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawVignette() { /* 고전풍: 비네트 없음 */ }
}

// 스스로 빛나는 몸
const GLOW = {
  wraith: { r: 1.6, c: '#9fe0e8' }, knight_spirit: { r: 2, c: '#9ac0ff' }, lich: { r: 2.2, c: '#b070ff' }, dusk_king: { r: 3, c: '#ff3040' },
  shade: { r: 1, c: '#8060c0' }, knight_dark: { r: 1.2, c: '#ff4050' },
};
