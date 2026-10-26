// 이펙트(도트풍): 비트맵 데미지 숫자, 단색 섬광, 도트 휘두름 궤적, 스킬 6종, 레벨업, 사망 소멸, 페이드, 흔들림,
// 클릭 마커, 말풍선(박스 없는 외곽선 글자), 줍기. 월드 이펙트는 저해상도 버퍼에, 한글 글자는 메인 캔버스에. 소유: 워커 A.
import { tileToWorld, DIRS } from '../core/iso.js';
import { rgba, clamp, shade, easeOut } from './util.js';
import { flame } from './tiles.js';
import { FONT_PIX, bitmapText, isBitmapText, outlinedText, pxEllipse, pxFillEllipse, pxLine, pxDitherDiamond } from './pixel.js';

export const FONT_KO = FONT_PIX;
const R = Math.random;

const ent = (e) => tileToWorld(e.rx ?? e.x, e.ry ?? e.y);
// 방향 단위벡터(화면)
function dirVec(dir) { const d = DIRS[((dir % 8) + 8) % 8]; const x = (d.dx - d.dy) * 32, y = (d.dx + d.dy) * 16; const n = Math.hypot(x, y); return { x: x / n, y: y / n, len: n }; }
const step = (k, n) => Math.floor(k * n) / n; // 계단식 진행도

export class FX {
  constructor(renderer) {
    this.r = renderer;
    this.game = renderer.game;
    this.list = [];          // 월드 이펙트
    this.texts = [];         // 떠오르는 글자
    this.bubbles = new Map(); // entity → {text, t, dur}
    this.dynLights = [];
    this.shakeT = 0; this.shakeMax = 0; this.shakeAmt = 0;
    this.fade = { a: 0, from: 0, to: 0, t: 0, dur: 0 };
    this.marker = null;
    this.corpses = [];
    this.subscribe();
  }

  subscribe() {
    const b = this.game.bus;
    b.on('combat:damage', (p) => this.onDamage(p));
    b.on('combat:attack', (p) => this.onAttack(p));
    b.on('combat:miss', (p) => p.target && this.text(p.target, 'MISS', '#c8c8d0', 14, { dy: -6 }));
    b.on('entity:died', (p) => this.onDied(p.entity));
    b.on('entity:removed', (p) => this.onRemoved(p.entity));
    b.on('skill:cast', (p) => this.onSkill(p));
    b.on('player:levelup', (p) => this.onLevelUp(p));
    b.on('npc:say', (p) => p.entity && this.bubbles.set(p.entity, { text: this.game.format?.(p.text) ?? p.text, t: 0, dur: clamp(2 + String(p.text).length * 0.07, 2.5, 6) }));
    b.on('fx:shake', (p) => this.shake(p?.amount ?? 4, p?.time ?? 0.25));
    const noFade = /[?&]nofade/.test(location.search); // 디버그: 헤드리스 스크린샷용
    b.on('fx:fade', (p) => { if (noFade) return; this.fade = { a: this.fade.a, from: this.fade.a, to: p?.to ?? 0, t: 0, dur: Math.max(0.001, p?.time ?? 0.3) }; });
    b.on('fx:play', (p) => this.play(p?.id, p?.x, p?.y, p));
    b.on('ui:moveMarker', (p) => { this.marker = { x: p.x, y: p.y, t: 0 }; });
    b.on('item:pickup', (p) => this.onPickup(p));
    b.on('map:loaded', () => this.clear());
  }

  clear() { this.list = []; this.texts = []; this.bubbles.clear(); this.dynLights = []; this.marker = null; this.corpses = []; }

  shake(amount, time) { this.shakeAmt = Math.max(this.shakeAmt * (this.shakeT > 0 ? 1 : 0), amount * 0.6); this.shakeT = Math.max(this.shakeT, time); this.shakeMax = Math.max(this.shakeT, 0.01); }
  shakeOffset(time) {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = this.shakeT / this.shakeMax, a = this.shakeAmt * k;
    return { x: Math.sin(time * 71) * a, y: Math.cos(time * 53) * a * 0.7 };
  }
  light(x, y, r, color, dur) { this.dynLights.push({ x, y, r, color, life: dur, max: dur }); }
  add(fx) { fx.t = 0; this.list.push(fx); return fx; }

  text(e, str, color, size = 16, opt = {}) {
    const p = e.x != null && e.rx !== undefined ? ent(e) : e;
    const top = this.r.spriteTop?.(e) ?? 50;
    this.texts.push({ x: p.x + (opt.dx ?? (R() - 0.5) * 14), y: p.y - top - 6 + (opt.dy ?? 0), str, color, size, t: 0, dur: opt.dur ?? 1.0, crit: opt.crit, vy: opt.vy ?? -38, stroke: opt.stroke ?? '#1a0a08' });
  }

  // ── 이벤트 처리 ──
  onDamage({ source, target, amount, crit, type, skill }) {
    if (!target) return;
    const toPlayer = target.kind === 'player';
    const color = toPlayer ? '#ff5a4a' : crit ? '#ffd23a' : type === 'magic' ? '#c9a0ff' : '#ffffff';
    const n = Math.round(amount);
    if (n > 0 || amount === 0) this.text(target, crit ? `${n}!` : String(n), color, crit ? 24 : toPlayer ? 17 : 18, { crit, dur: crit ? 1.15 : 0.95 });
    target.flash = Math.max(target.flash || 0, 0.12);
    const p = ent(target);
    const top = this.r.spriteTop?.(target) ?? 40;
    const hy = p.y - top * 0.55;
    // 타격 불꽃
    const sparks = [];
    const from = source ? ent(source) : { x: p.x - 10, y: p.y };
    const ang = Math.atan2(hy - (from.y - 20), p.x - from.x);
    for (let i = 0; i < (crit ? 14 : 8); i++) {
      const a = ang + (R() - 0.5) * 1.8, sp = 60 + R() * (crit ? 160 : 100);
      sparks.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.25 + R() * 0.2 });
    }
    const undead = ['skeleton', 'wraith', 'shade', 'lich', 'knight_spirit'].includes(target.look?.body);
    this.add({ kind: 'hit', x: p.x, y: hy, dur: 0.45, sparks, crit, color: toPlayer ? '#ff6a4a' : undead ? '#b8c8ff' : crit ? '#ffe070' : '#ffd8a0' });
    if (crit) { this.shake(4, 0.18); this.light(p.x, hy, 80, '#ffd070', 0.25); }
    if (toPlayer) this.shake(2.2, 0.12);
    void skill;
  }

  onAttack({ attacker, target }) {
    if (!attacker) return;
    const body = attacker.look?.body || 'human';
    const humanoid = this.r.isHumanoid(body);
    let dir = attacker.dir;
    const w = attacker.look?.weapon;
    if (humanoid && (attacker.kind === 'player' || w || ['skeleton', 'knight_spirit', 'knight_dark', 'dusk_king', 'goblin', 'gravekeeper'].includes(body))) {
      const big = /great|broad|axe|mace/.test(w || '') || ['knight_dark', 'dusk_king', 'gravekeeper'].includes(body);
      this.add({ kind: 'slash', e: attacker, dir, dur: 0.24, delay: 0.09, color: attacker.look?.weapon === 'sword_argen' ? '#cfe6ff' : attacker.kind === 'player' ? '#fff4d8' : '#ffd0c0', big, flip: (attacker.id + Math.floor(this.game.time * 2)) % 2 });
    } else if (target) {
      const p = ent(target);
      this.add({ kind: 'claw', x: p.x, y: p.y - (this.r.spriteTop?.(target) ?? 40) * 0.5, dur: 0.3, delay: 0.12, color: body === 'wraith' || body === 'shade' ? '#b090ff' : '#ff5040' });
    }
  }

  onDied(e) {
    if (!e) return;
    const p = ent(e);
    const spirit = ['shade', 'wraith', 'knight_spirit', 'lich', 'dusk_king'].includes(e.look?.body);
    const parts = [];
    for (let i = 0; i < (e.boss ? 40 : 16); i++) parts.push({ x: (R() - 0.5) * 24, y: -R() * 40, vx: (R() - 0.5) * 30, vy: -20 - R() * 50, life: 0.6 + R() * 0.9, s: 1.5 + R() * 2.5 });
    this.add({ kind: 'deathburst', x: p.x, y: p.y, dur: 1.6, parts, color: spirit ? '#b8a0ff' : e.kind === 'player' ? '#8ab0ff' : '#c8c0d8' });
    if (e.boss) { this.shake(8, 0.6); this.light(p.x, p.y - 30, 220, '#ffffff', 1.0); }
  }
  onRemoved(e) {
    if (!e || e.kind !== 'monster' || !e._lastSprite) return;
    const p = ent(e);
    this.corpses.push({ x: p.x, y: p.y, spr: e._lastSprite, t: 0, dur: 0.7 });
  }

  // 칸 목록 → 각 칸에 충격 표시
  tileBurst(tiles, color, opt = {}) {
    for (const [i, t] of (tiles || []).entries()) {
      const p = tileToWorld(t.x, t.y);
      this.add({ kind: 'tileflash', x: p.x, y: p.y, dur: opt.dur ?? 0.45, delay: (opt.stagger ?? 0) * i, color });
    }
  }

  onSkill({ caster, skillId, target, x, y, dir, tiles, from }) {
    if (!caster) return;
    if (skillId?.startsWith('boss_')) return this.onBossSkill(caster, skillId, tiles, dir);
    if (tiles && (skillId === 'whirlwind' || skillId === 'earth_splitter')) this.tileBurst(tiles, skillId === 'whirlwind' ? '#c8dcff' : '#ffb060', { stagger: skillId === 'earth_splitter' ? 0.03 : 0 });
    void from;
    const c = ent(caster);
    const d = dir ?? caster.dir;
    const tp = target ? ent(target) : x != null ? tileToWorld(x, y) : null;
    switch (skillId) {
      case 'power_strike': {
        const at = tp || { x: c.x + dirVec(d).x * 40, y: c.y + dirVec(d).y * 40 };
        this.add({ kind: 'slash', e: caster, dir: d, dur: 0.3, delay: 0.05, color: '#ffd860', big: true, power: true });
        this.add({ kind: 'shock', x: at.x, y: at.y, dur: 0.5, delay: 0.12, color: '#ffcf50', r: 46 });
        this.light(at.x, at.y - 20, 120, '#ffc040', 0.4);
        this.shake(5, 0.2);
        break;
      }
      case 'whirlwind':
        this.add({ kind: 'whirl', e: caster, dur: 0.55, color: '#e8f0ff' });
        this.light(c.x, c.y - 20, 140, '#c0d8ff', 0.5);
        this.shake(3, 0.3);
        break;
      case 'charge': {
        const v = dirVec(d);
        this.add({ kind: 'charge', e: caster, sx: c.x, sy: c.y, v, dur: 0.6 });
        this.add({ kind: 'shock', x: (tp?.x ?? c.x + v.x * 120), y: (tp?.y ?? c.y + v.y * 120), dur: 0.45, delay: 0.25, color: '#ffe0a0', r: 40 });
        this.shake(6, 0.25);
        break;
      }
      case 'war_cry':
        this.add({ kind: 'rings', e: caster, dur: 1.0, color: '#ff7a3a', n: 3, r: 150 });
        this.add({ kind: 'aura', e: caster, dur: 1.4, color: '#ff6030' });
        this.light(c.x, c.y - 20, 180, '#ff6a30', 0.8);
        this.shake(4, 0.35);
        break;
      case 'iron_wall':
        this.add({ kind: 'dome', e: caster, dur: 1.3, color: '#a8c8ff' });
        this.light(c.x, c.y - 20, 120, '#a0c0ff', 1.0);
        break;
      case 'earth_splitter': {
        const v = dirVec(d);
        const spikes = [];
        for (let i = 1; i <= 4; i++) for (let k = 0; k < 3; k++) spikes.push({ dist: i * v.len + (R() - 0.5) * 20, side: (R() - 0.5) * 18, h: 14 + R() * 18, delay: i * 0.07 + R() * 0.04 });
        this.add({ kind: 'quake', sx: c.x, sy: c.y, v, len: v.len * 4.4, spikes, dur: 1.1 });
        this.shake(9, 0.5);
        this.light(c.x + v.x * v.len * 2, c.y + v.y * v.len * 2, 200, '#ffb060', 0.6);
        break;
      }
      default:
        this.add({ kind: 'sparkle', x: c.x, y: c.y - 30, dur: 0.8, color: '#c8d8ff', n: 16 });
    }
  }

  onBossSkill(caster, id, tiles, dir) {
    const c = ent(caster);
    const sc = caster.look?.scale ?? 1;
    const tint = caster.look?.tint;
    switch (id) {
      case 'boss_sweep': case 'boss_cleave':
        this.add({ kind: 'slash', e: caster, dir: dir ?? caster.dir, dur: 0.35, delay: 0, color: id === 'boss_cleave' ? '#ff6a5a' : '#ffd0b0', big: true, power: true, scale: sc * 1.6 });
        this.tileBurst(tiles, '#ff5a3a'); this.shake(6, 0.3); break;
      case 'boss_leap':
        this.add({ kind: 'smoke', x: c.x, y: c.y, dur: 0.8, color: '#6a5a4a', n: 14 }); break;
      case 'boss_leap_land': case 'boss_slam':
        this.add({ kind: 'shock', x: c.x, y: c.y, dur: 0.6, color: '#ffb070', r: 90 * sc });
        this.add({ kind: 'smoke', x: c.x, y: c.y, dur: 1.0, color: '#5a4a3a', n: 18 });
        this.tileBurst(tiles, '#ffa060'); this.shake(10, 0.45); this.light(c.x, c.y - 20, 180, '#ffa060', 0.5); break;
      case 'boss_claw':
        for (const t of tiles || []) { const p = tileToWorld(t.x, t.y); this.add({ kind: 'claw', x: p.x, y: p.y - 10, dur: 0.35, color: tint || '#ff4040' }); }
        this.shake(4, 0.2); break;
      case 'boss_dark_rain':
        for (const [i, t] of (tiles || []).entries()) { const p = tileToWorld(t.x, t.y); this.add({ kind: 'bolt', x: p.x, y: p.y, dur: 0.5, delay: i * 0.03, color: '#c040ff' }); }
        this.shake(5, 0.4); break;
      case 'boss_dusk_wave':
        this.add({ kind: 'rings', e: caster, dur: 1.1, color: '#ff3040', n: 3, r: 220 });
        this.tileBurst(tiles, '#ff3040', { stagger: 0.01 }); this.shake(8, 0.5); this.light(c.x, c.y - 20, 260, '#ff3040', 0.9); break;
      default:
        this.tileBurst(tiles, '#ff5040'); this.shake(4, 0.25);
    }
  }

  onLevelUp() {
    const p = this.game.player;
    if (!p) return;
    this.add({ kind: 'pillar', e: p, dur: 1.8, color: '#ffe08a' });
    this.add({ kind: 'sparkle', e: p, dur: 1.6, color: '#fff0b0', n: 30, follow: true });
    this.text(p, 'LEVEL UP!', '#ffe070', 22, { dur: 1.8, vy: -24, dy: -12, dx: 0, crit: true });
    const c = ent(p);
    this.light(c.x, c.y - 30, 200, '#ffe0a0', 1.6);
  }

  onPickup({ itemId, qty, gold }) {
    const p = this.game.player;
    if (!p) return;
    const c = ent(p);
    this.add({ kind: 'sparkle', x: c.x, y: c.y - 20, dur: 0.6, color: gold ? '#ffd040' : '#fff0c0', n: 10 });
    const name = gold ? `+${typeof gold === 'number' ? gold : qty ?? ''} 골드` : (this.game.data.items?.[itemId]?.name ?? itemId) + (qty > 1 ? ` x${qty}` : '');
    if (name) this.text(p, name, gold ? '#ffd040' : '#e8e0c0', 13, { dur: 1.3, vy: -26, dx: 0, dy: -14 });
  }

  // fx:play 범용 이펙트 (스크립트 연출용)
  play(id, x, y, opt = {}) {
    const p = this.game.player;
    const at = x != null ? tileToWorld(x, y) : p ? ent(p) : { x: 0, y: 0 };
    switch (id) {
      case 'portal': case 'teleport':
        this.add({ kind: 'pillar', x: at.x, y: at.y, dur: 1.2, color: '#b090ff' });
        this.add({ kind: 'sparkle', x: at.x, y: at.y - 20, dur: 1.2, color: '#d0c0ff', n: 24 });
        this.light(at.x, at.y - 30, 160, '#a080ff', 1.2); break;
      case 'heal': case 'revive':
        this.add({ kind: 'sparkle', x: at.x, y: at.y - 20, dur: 1.2, color: '#a0ffb0', n: 22 });
        this.add({ kind: 'rings', x: at.x, y: at.y, dur: 0.8, color: '#80ff90', n: 1, r: 40 });
        this.light(at.x, at.y - 20, 110, '#80ff90', 1); break;
      case 'holy': case 'light': case 'shrine': case 'altar':
        this.add({ kind: 'pillar', x: at.x, y: at.y, dur: 2, color: '#fff0b0' });
        this.add({ kind: 'sparkle', x: at.x, y: at.y - 30, dur: 2, color: '#fff4c0', n: 30 });
        this.light(at.x, at.y - 30, 220, '#fff0c0', 2); break;
      case 'memory': case 'soul': case 'shard':
        this.add({ kind: 'sparkle', x: at.x, y: at.y - 24, dur: 1.4, color: '#b8d0ff', n: 26 });
        this.add({ kind: 'rings', x: at.x, y: at.y, dur: 1, color: '#a8c0ff', n: 2, r: 60 });
        this.light(at.x, at.y - 20, 150, '#a0c0ff', 1.4); break;
      case 'dark': case 'curse': case 'summon':
        this.add({ kind: 'smoke', x: at.x, y: at.y, dur: 1.6, color: '#2a0a30', n: 26 });
        this.add({ kind: 'rings', x: at.x, y: at.y, dur: 1, color: '#c03050', n: 2, r: 70 });
        this.light(at.x, at.y - 20, 160, '#ff3050', 1.2); break;
      case 'explosion': case 'fire':
        this.add({ kind: 'shock', x: at.x, y: at.y, dur: 0.6, color: '#ff8030', r: 70 });
        this.add({ kind: 'smoke', x: at.x, y: at.y, dur: 1.2, color: '#3a2a20', n: 16 });
        this.light(at.x, at.y - 20, 200, '#ff8030', 0.8); this.shake(6, 0.3); break;
      case 'smoke': this.add({ kind: 'smoke', x: at.x, y: at.y, dur: 1.4, color: '#5a5660', n: 18 }); break;
      case 'mana':
        this.add({ kind: 'sparkle', x: at.x, y: at.y - 20, dur: 1.1, color: '#80a8ff', n: 20 });
        this.light(at.x, at.y - 20, 100, '#6080ff', 0.9); break;
      case 'stun': this.add({ kind: 'sparkle', x: at.x, y: at.y - 50, dur: 0.7, color: '#ffe060', n: 10 }); break;
      case 'blink':
        this.add({ kind: 'screenflash', dur: 0.15, color: '#c0a0ff' });
        this.add({ kind: 'sparkle', x: at.x, y: at.y - 24, dur: 0.6, color: '#c0a0ff', n: 16 }); break;
      case 'boss_appear':
        this.add({ kind: 'smoke', x: at.x, y: at.y, dur: 2, color: '#1a0a1a', n: 30 });
        this.add({ kind: 'rings', x: at.x, y: at.y, dur: 1.4, color: '#ff3040', n: 3, r: 120 });
        this.add({ kind: 'pillar', x: at.x, y: at.y, dur: 1.6, color: '#ff4050' });
        this.light(at.x, at.y - 30, 240, '#ff3040', 1.6); this.shake(8, 0.8); break;
      case 'flash': this.add({ kind: 'screenflash', dur: opt.time ?? 0.5, color: opt.color || '#ffffff' }); break;
      case 'levelup': this.onLevelUp(); break;
      default:
        this.add({ kind: 'sparkle', x: at.x, y: at.y - 20, dur: 1, color: '#e0d8ff', n: 18 });
        this.light(at.x, at.y - 20, 100, '#c0b0ff', 0.8);
    }
  }

  update(dt) {
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    const f = this.fade;
    if (f.t < f.dur) { f.t += dt; f.a = f.from + (f.to - f.from) * clamp(f.t / f.dur, 0, 1); } else f.a = f.to;
    if (this.marker) { this.marker.t += dt; if (this.marker.t > 0.6) this.marker = null; }
    this.list = this.list.filter((x) => (x.t += dt) < x.dur + (x.delay || 0));
    this.texts = this.texts.filter((x) => (x.t += dt) < x.dur);
    this.dynLights = this.dynLights.filter((x) => (x.life -= dt) > 0);
    this.corpses = this.corpses.filter((x) => (x.t += dt) < x.dur);
    for (const [e, b] of this.bubbles) if ((b.t += dt) > b.dur || !this.game.world.entities.includes(e)) this.bubbles.delete(e);
  }


  // ── 그리기 (저해상도 버퍼, 월드 좌표계) ──
  drawUnder(ctx, time) {
    const m = this.marker;
    if (m) {
      const p = tileToWorld(m.x, m.y), k = step(m.t / 0.6, 4);
      const s = 1 - k * 0.5, c = k < 0.5 ? '#ffe696' : '#c8a050';
      const hw = Math.round(26 * s), hh = Math.round(13 * s), x = Math.round(p.x), y = Math.round(p.y);
      pxLine(ctx, x, y - hh, x + hw, y, c); pxLine(ctx, x + hw, y, x, y + hh, c); pxLine(ctx, x, y + hh, x - hw, y, c); pxLine(ctx, x - hw, y, x, y - hh, c);
      if (k < 0.5) pxDitherDiamond(ctx, x, y, hw - 2, hh - 1, c, 0.2);
    }
    for (const c of this.corpses) {
      const k = c.t / c.dur, s = c.spr;
      ctx.save(); ctx.globalAlpha = k < 0.33 ? 0.8 : k < 0.66 ? 0.5 : 0.25;
      const cut = Math.round(k * 10);
      ctx.drawImage(s.canvas, 0, 0, s.w, s.h - cut, Math.round(c.x - s.ax), Math.round(c.y - s.ay + k * 6), s.w, s.h - cut);
      ctx.restore();
    }
    for (const x of this.list) if (x.kind === 'quake' || x.kind === 'rings') this.drawOne(ctx, x, time, true);
  }
  drawOver(ctx, time) {
    for (const x of this.list) this.drawOne(ctx, x, time, false);
  }

  drawOne(ctx, x, time, under) {
    const t = x.t - (x.delay || 0);
    if (t < 0) return;
    const k = clamp(t / x.dur, 0, 1);
    const pos0 = x.e ? ent(x.e) : { x: x.x, y: x.y };
    const pos = { x: Math.round(pos0.x), y: Math.round(pos0.y) };
    ctx.save();
    switch (x.kind) {
      case 'hit': {
        // 단색 섬광(별 모양) + 도트 불꽃
        if (t < 0.1) {
          const L = (x.crit ? 9 : 6) * (t < 0.05 ? 1 : 0.6);
          ctx.fillStyle = x.color;
          ctx.fillRect(pos.x - L, pos.y - 1, L * 2 + 1, 3); ctx.fillRect(pos.x - 1, pos.y - L * 0.7, 3, L * 1.4 + 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(pos.x - L + 2, pos.y, L * 2 - 3, 1); ctx.fillRect(pos.x, pos.y - L * 0.7 + 1, 1, L * 1.4 - 1);
          ctx.fillRect(pos.x - 2, pos.y - 2, 5, 5);
          if (x.crit) for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) ctx.fillRect(pos.x + dx, pos.y + dy * 0.7, 2, 2);
        }
        for (const s of x.sparks) {
          if (t > s.life) continue;
          const sx = Math.round(pos.x + s.vx * t * 0.5), sy = Math.round(pos.y + s.vy * t * 0.5 + 80 * t * t);
          ctx.fillStyle = t < s.life * 0.5 ? '#ffffff' : x.color;
          ctx.fillRect(sx, sy, t < s.life * 0.4 ? 2 : 1, t < s.life * 0.4 ? 2 : 1);
        }
        break;
      }
      case 'slash': {
        // 도트 호(弧): 반경 4겹의 1px 점, 머리는 흰색, 꼬리는 진한 색
        const v = dirVec(x.dir);
        const top = this.r.spriteTop?.(x.e) ?? 46;
        const cx = pos.x + v.x * 12, cy = pos.y - top * 0.45 + v.y * 7;
        const base = Math.atan2(v.y, v.x);
        const R0 = (x.big ? 26 : 20) * (x.scale ?? x.e?.look?.scale ?? 1);
        const sweep = 2.4, dirSign = x.flip ? 1 : -1;
        const head = step(easeOut(k), 4) * sweep + 0.6;
        const tail = Math.max(0, head - 1.5);
        const a0 = base - dirSign * sweep / 2;
        if (k > 0.85) break;
        const col = x.color, dark = shade(col, -0.35);
        const n = Math.ceil((head - tail) * R0);
        for (let i = 0; i <= n; i++) {
          const f = i / Math.max(1, n);
          const a = a0 + dirSign * (tail + (head - tail) * f);
          const th = f > 0.85 ? (x.big ? 4 : 3) : f > 0.4 ? (x.big ? 3 : 2) : 1;
          for (let j = 0; j < th; j++) {
            const rr = R0 - j + 1;
            ctx.fillStyle = f > 0.8 && j > 0 && j < th - 1 ? '#ffffff' : f > 0.4 ? col : dark;
            ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.62), 1, 1);
          }
        }
        break;
      }
      case 'tileflash': {
        const kk = step(k, 3);
        pxDitherDiamond(ctx, pos.x, pos.y, 30, 15, x.color, (1 - kk) * 0.55);
        if (kk < 0.5) { const c = x.color; pxLine(ctx, pos.x, pos.y - 15, pos.x + 30, pos.y, c); pxLine(ctx, pos.x + 30, pos.y, pos.x, pos.y + 15, c); pxLine(ctx, pos.x, pos.y + 15, pos.x - 30, pos.y, c); pxLine(ctx, pos.x - 30, pos.y, pos.x, pos.y - 15, c); }
        break;
      }
      case 'bolt': {
        const fall = step(clamp(k / 0.4, 0, 1), 4);
        const by = pos.y - 160 * (1 - fall);
        if (k < 0.7) {
          pxLine(ctx, pos.x + 8 * (1 - fall), by - 34, pos.x + 3, by - 16, x.color, 2);
          pxLine(ctx, pos.x + 3, by - 16, pos.x, by, '#ffffff', 2);
        }
        if (fall >= 1) { const rr = 6 + step(k, 4) * 16; pxEllipse(ctx, pos.x, pos.y, rr, rr * 0.5, x.color, 2); }
        break;
      }
      case 'claw': {
        if (k > 0.8) break;
        const L = 15 * step(Math.min(1, k * 2.5), 3);
        for (let i = -1; i <= 1; i++) pxLine(ctx, pos.x - 8 + i * 5, pos.y - 8, pos.x - 8 + i * 5 + L, pos.y - 8 + L, i === 0 ? '#ffffff' : x.color, 2);
        break;
      }
      case 'shock': {
        const kk = step(k, 5);
        const r = x.r * easeOut(kk);
        pxEllipse(ctx, pos.x, pos.y, r, r * 0.5, x.color);
        if (kk < 0.6) pxEllipse(ctx, pos.x, pos.y, r - 2, r * 0.5 - 1, '#ffffff', 2);
        if (kk < 0.4) pxEllipse(ctx, pos.x, pos.y, r * 0.6, r * 0.3, x.color, 3);
        break;
      }
      case 'whirl': {
        const rot = step(easeOut(k), 8) * Math.PI * 4;
        for (let ring = 0; ring < 2; ring++) {
          const rr = 36 + ring * 12;
          for (let i = 0; i < 26; i++) {
            const f = i / 26, a = rot - 2.6 + f * 2.6;
            ctx.fillStyle = f > 0.8 ? '#ffffff' : ring ? shade(x.color, -0.3) : x.color;
            const s = f > 0.5 ? 2 : 1;
            ctx.fillRect(Math.round(pos.x + Math.cos(a) * rr), Math.round(pos.y - 20 + Math.sin(a) * rr * 0.55), s, s);
          }
        }
        break;
      }
      case 'charge': {
        const e = x.e, cur = ent(e);
        if (k < 0.7) for (let i = 0; i < 5; i++) {
          const off = (i - 2) * 5;
          pxLine(ctx, x.sx - x.v.y * off, x.sy - 18 + x.v.x * off * 0.5, cur.x - x.v.x * 10 - x.v.y * off, cur.y - 18 - x.v.y * 10 + x.v.x * off * 0.5, i % 2 ? '#fff0c8' : '#c8b088');
        }
        ctx.globalAlpha = k < 0.5 ? 0.6 : 0.3;
        for (let i = 0; i < 4; i++) { const f = i / 4; pxFillEllipse(ctx, x.sx + (cur.x - x.sx) * f, x.sy + (cur.y - x.sy) * f, 6 + k * 6, 3 + k * 2, '#8a7a60'); }
        break;
      }
      case 'rings': {
        if (!under) break;
        for (let i = 0; i < x.n; i++) {
          const kk = step(clamp(k * 1.3 - i * 0.18, 0, 1), 6);
          if (kk <= 0 || kk >= 1) continue;
          const r = x.r * easeOut(kk);
          pxEllipse(ctx, pos.x, pos.y, r, r * 0.5, kk < 0.5 ? x.color : shade(x.color, -0.3), kk < 0.5 ? 1 : 2);
          if (kk < 0.35) pxEllipse(ctx, pos.x, pos.y, r - 1, r * 0.5 - 1, x.color);
        }
        break;
      }
      case 'aura': {
        const a = Math.sin(k * Math.PI);
        if (a > 0.3) pxEllipse(ctx, pos.x, pos.y, 18, 8, x.color, 2);
        for (let i = 0; i < 6; i++) flame(ctx, pos.x + Math.round(Math.cos(i * 1.05 + time * 3) * 15), pos.y + Math.round(Math.sin(i * 1.05 + time * 3) * 6), 0.6 * (1 - k * 0.6), time + i);
        break;
      }
      case 'dome': {
        const a = k < 0.2 ? 1 : k < 0.8 ? 0.8 : 0.4;
        if (Math.floor(time * 10) % 4 === 0 && k > 0.6) break;
        ctx.globalAlpha = a;
        const y = pos.y - 3;
        pxEllipse(ctx, pos.x, y, 24, 12, x.color);
        pxEllipse(ctx, pos.x, y - 20, 24, 30, x.color, 2, Math.PI, Math.PI * 2);
        for (let i = 0; i < 3; i++) { const aa = i / 3 * Math.PI + time; pxEllipse(ctx, pos.x, y - 20, Math.abs(Math.cos(aa)) * 24, 30, '#ffffff', 3, Math.PI, Math.PI * 2); }
        break;
      }
      case 'quake': {
        const v = x.v;
        if (under) {
          const L = x.len * step(clamp(t / 0.35, 0, 1), 5);
          let px = x.sx, py = x.sy;
          for (let d = 10; d < L; d += 10) {
            const j = Math.sin(d * 0.7) * 4;
            const nx = x.sx + v.x * d - v.y * j, ny = x.sy + v.y * d + v.x * j * 0.5;
            pxLine(ctx, px, py, nx, ny, '#1a0c06', 2);
            if (k < 0.6) pxLine(ctx, px, py, nx, ny, '#ff8c32');
            px = nx; py = ny;
          }
          break;
        }
        for (const s of x.spikes) {
          const st = t - s.delay; if (st < 0) continue;
          const kk = clamp(st / 0.5, 0, 1);
          if (kk >= 1) continue;
          const h = Math.round(s.h * 0.8 * (kk < 0.2 ? 1 : 1 - step((kk - 0.2) / 0.8, 3) * 0.7));
          const px = Math.round(x.sx + v.x * s.dist - v.y * s.side), py = Math.round(x.sy + v.y * s.dist + v.x * s.side * 0.5);
          for (let i = -4; i <= 4; i++) {
            const hh = Math.round(h * (1 - Math.abs(i) / 5));
            ctx.fillStyle = i < 0 ? '#8a7a5e' : i === 0 ? '#a8987a' : '#5a4a3a';
            ctx.fillRect(px + i, py - hh, 1, hh);
          }
          ctx.fillStyle = '#2a1e14'; ctx.fillRect(px - 5, py, 11, 1);
        }
        break;
      }
      case 'pillar': {
        // 단색 기둥: 3겹 플랫 띠 (그라데이션 금지)
        const a = k < 0.15 ? 1 : k < 0.6 ? 0.8 : k < 0.85 ? 0.5 : 0.25;
        const w = Math.round(14 * (0.6 + 0.4 * Math.sin(k * Math.PI)));
        const H = 170;
        ctx.globalAlpha = 0.28 * a; ctx.fillStyle = x.color; ctx.fillRect(pos.x - w, pos.y - H, w * 2 + 1, H + 2);
        ctx.globalAlpha = 0.45 * a; ctx.fillRect(pos.x - (w >> 1), pos.y - H, w + 1, H + 2);
        ctx.globalAlpha = 0.8 * a; ctx.fillStyle = '#ffffff'; ctx.fillRect(pos.x - 1, pos.y - H, 3, H + 2);
        ctx.globalAlpha = a; pxEllipse(ctx, pos.x, pos.y, w + 8, (w + 8) * 0.5, x.color);
        break;
      }
      case 'sparkle': {
        if (!x.pts) { x.pts = []; for (let i = 0; i < x.n; i++) x.pts.push({ a: R() * 6.28, r: 4 + R() * 18, vy: 16 + R() * 40, d: R() * 0.4, s: R() < 0.3 ? 2 : 1 }); }
        const base = x.follow && x.e ? ent(x.e) : pos;
        const by = x.follow ? base.y - 18 : base.y;
        for (const p of x.pts) {
          const tt = t - p.d * x.dur; if (tt < 0) continue;
          const kk = clamp(tt / (x.dur * 0.7), 0, 1); if (kk >= 1) continue;
          const px = Math.round(base.x + Math.cos(p.a + tt * 2) * p.r), py = Math.round(by + Math.sin(p.a) * p.r * 0.4 - p.vy * tt);
          ctx.fillStyle = kk < 0.3 ? '#ffffff' : x.color;
          if (p.s > 1 && kk < 0.6) { ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3); }
          else ctx.fillRect(px, py, 1, 1);
        }
        break;
      }
      case 'smoke': {
        if (!x.pts) { x.pts = []; for (let i = 0; i < x.n; i++) x.pts.push({ dx: (R() - 0.5) * 34, dy: (R() - 0.5) * 12, vy: 8 + R() * 24, s: 5 + R() * 9 }); }
        ctx.globalAlpha = k < 0.2 ? 0.35 : k < 0.7 ? 0.5 : 0.25;
        for (const p of x.pts) {
          const g = 0.6 + step(k, 4);
          pxFillEllipse(ctx, pos.x + p.dx * (1 + k), pos.y + p.dy - p.vy * t, p.s * g, p.s * 0.7 * g, x.color);
        }
        break;
      }
      case 'deathburst': {
        for (const p of x.parts) {
          if (t > p.life) continue;
          const kk = t / p.life;
          ctx.fillStyle = kk < 0.3 ? '#ffffff' : x.color;
          const px = Math.round(pos.x + p.x + p.vx * t), py = Math.round(pos.y + p.y + p.vy * t);
          const s = kk < 0.5 && p.s > 2.5 ? 2 : 1;
          ctx.fillRect(px, py, s, s);
        }
        if (t < 0.3) pxEllipse(ctx, pos.x, pos.y - 18, 6 + t * 60, 4 + t * 40, x.color, 2);
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  // 비트맵 숫자/영문 (버퍼, 조명 위). 위로 튀고 사라짐
  drawTexts(ctx) {
    for (const x of this.texts) {
      if (!isBitmapText(x.str)) continue;
      const k = x.t / x.dur;
      if (k > 0.8 && Math.floor(x.t * 20) % 2) continue; // 사라질 땐 깜빡임
      const sc = x.crit ? 2 : 1;
      const img = bitmapText(x.str, x.color, sc);
      const rise = x.vy * easeOut(Math.min(1, x.t / 0.6)) * 0.55;
      const hop = x.t < 0.18 ? -Math.sin(x.t / 0.18 * Math.PI) * 4 : 0;
      ctx.drawImage(img, Math.round(x.x - img.width / 2), Math.round(x.y + rise + hop - img.height / 2));
    }
  }
  // 한글 알림 글자 (메인 캔버스 원해상도, 굴림 12px + 1px 외곽)
  drawHiTexts(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 12px ${FONT_PIX}`;
    for (const x of this.texts) {
      if (isBitmapText(x.str)) continue;
      const k = x.t / x.dur;
      if (k > 0.85 && Math.floor(x.t * 20) % 2) continue;
      const y = x.y + x.vy * easeOut(Math.min(1, x.t / 0.7)) * 0.6;
      const s = this.r.worldToScreen(x.x, y);
      outlinedText(ctx, x.str, s.x, s.y, x.color);
    }
    ctx.restore();
  }
  // 말풍선: 원작처럼 머리 위 흰 글자 + 1px 검은 외곽, 박스 없음
  drawBubbles(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `12px ${FONT_PIX}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const [e, b] of this.bubbles) {
      const p = ent(e);
      const top = this.r.spriteTop?.(e) ?? 46;
      if (b.t < 0.05) continue;
      const lines = wrap(ctx, b.text, 220);
      const s = this.r.worldToScreen(p.x, p.y - top);
      const y0 = s.y - (e.title ? 40 : 26) - (lines.length - 1) * 15;
      lines.forEach((l, i) => outlinedText(ctx, l, s.x, y0 + i * 15, '#ffffff', '#000000'));
    }
    ctx.restore();
  }
  drawScreen(ctx, W, H) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const x of this.list) {
      if (x.kind !== 'screenflash') continue;
      const k = step(x.t / x.dur, 4);
      ctx.fillStyle = rgba(x.color, (1 - k) * 0.7); ctx.fillRect(0, 0, W, H);
    }
    if (this.fade.a > 0.001) { ctx.fillStyle = `rgba(0,0,0,${clamp(this.fade.a, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
  }
}

export function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para.split(/(\s+)/)) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        if (ctx.measureText(ch).width > maxW) { // 긴 단어(한글 연속) → 글자 단위
          for (const c of ch) { if (ctx.measureText(line + c).width > maxW) { out.push(line); line = c; } else line += c; }
          continue;
        }
        out.push(line.trimEnd()); line = ch.trimStart();
      } else line = test;
    }
    out.push(line);
  }
  return out.slice(0, 6);
}
