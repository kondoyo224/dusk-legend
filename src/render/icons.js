// UI 지원: 아이템 아이콘, 스킬 아이콘, 초상화. 32x32 단위 좌표로 그려 size 로 확대, (id,size)별 캐시. 소유: 워커 A.
import { makeCanvas, shade, rgba, ellipse, roundRect, LRU } from './util.js';
import { WEAPONS, ARMOR, SHIELDS, HELMS, BOOTS, HUMANOID_BODIES } from './rig.js';
import { drawLookAt, isHumanoid, lookKey } from './sprites.js';
import { pixelize } from './pixel.js';

const cache = new LRU(400);
const OUT = 'rgba(12,8,6,0.85)';
const GRADE_GLOW = { rare: '#4a8aff', epic: '#b060ff', legendary: '#ff9a2a' };

// 도트 아이콘: 32(또는 size/배율) 원본 해상도로 굽고 도트화 → 최근접 확대
function cached(key, size, fn, outline = true) {
  const k = Math.max(1, Math.round(size / 32));
  const N = Math.max(8, Math.round(size / k));
  let c = cache.get(key + '@' + N);
  if (!c) {
    c = makeCanvas(N, N);
    const ctx = c.getContext('2d');
    ctx.scale(N / 32, N / 32);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    fn(ctx);
    pixelize(c, { outline, levels: 10, alphaCut: 100 });
    cache.set(key + '@' + N, c);
  }
  return c;
}
function blit(ctx, c, x, y, size) {
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  ctx.imageSmoothingEnabled = sm;
}

// ── 아이템 ──
export function drawItemIcon(game, ctx, itemId, x, y, size) {
  const def = game.data.items?.[itemId];
  const c = cached('i:' + itemId, size, (g) => itemArt(g, itemId, def));
  blit(ctx, c, x, y, size);
}

function itemArt(ctx, id, def) {
  const type = def?.type || guessType(id);
  const look = def?.look || id;
  const hint = def?.icon || '';
  if (type === 'weapon') return weaponIcon(ctx, WEAPONS[look] ? look : guessWeapon(id));
  if (type === 'armor') return armorIcon(ctx, ARMOR[look] ? look : 'leather');
  if (type === 'shield') return shieldIcon(ctx, SHIELDS[look] ? look : 'shield_wood');
  if (type === 'helm') return helmIcon(ctx, HELMS[look] ? look : 'helm_iron');
  if (type === 'boots') return bootIcon(ctx, BOOTS[look] || (/iron/.test(id) ? BOOTS.boots_iron : BOOTS.boots_leather));
  if (type === 'ring') return ringIcon(ctx, /ruby/.test(id + hint) ? '#e02040' : /sapph|blue/.test(id + hint) ? '#3070ff' : /emer|green/.test(id + hint) ? '#30c060' : '#e8c070', /copper/.test(id) ? '#b8743a' : '#d8b048');
  if (type === 'amulet') return amuletIcon(ctx, /serin/.test(id) ? '#a8c8ff' : /guard/.test(id) ? '#ffd860' : '#c070ff');
  const key = id + ' ' + hint;
  if (/shard/.test(key)) return shardIcon(ctx, /body/.test(key) ? '#ff7a6a' : /mind/.test(key) ? '#7ab8ff' : '#c49aff');
  if (/page/.test(key)) return pageIcon(ctx);
  if (/scroll/.test(key)) return scrollIcon(ctx);
  if (/key/.test(key)) return keyIcon(ctx);
  if (/tail/.test(key)) return tailIcon(ctx);
  if (/pelt|hide|fur/.test(key)) return peltIcon(ctx);
  if (/dust|powder|ash/.test(key)) return pouchIcon(ctx, '#8a8070', '#c8c0b0');
  if (/vial|soul/.test(key)) return potionIcon(ctx, '#a8d0ff', true, 'vial');
  if (/potion|elixir/.test(key) || def?.use?.heal || def?.use?.mana) {
    const blue = /blue|mana/.test(key) || (def?.use?.mana && !def?.use?.heal);
    const sz = /_l\b|_l$/.test(id) ? 'l' : /_m\b|_m$/.test(id) ? 'm' : 's';
    return potionIcon(ctx, blue ? '#3a6aff' : '#e0283a', false, sz);
  }
  if (type === 'consumable') return potionIcon(ctx, '#e8a030', false, 's');
  return pouchIcon(ctx, '#6a4a2c', '#c9a14a');
}
function guessType(id) {
  if (/sword|blade|axe|mace|claymore/.test(id)) return 'weapon';
  if (/armor|mail|tunic|plate/.test(id)) return 'armor';
  if (/shield/.test(id)) return 'shield';
  if (/helm|cap/.test(id)) return 'helm';
  if (/boots/.test(id)) return 'boots';
  if (/ring/.test(id)) return 'ring';
  if (/amulet|pendant/.test(id)) return 'amulet';
  return 'misc';
}
function guessWeapon(id) {
  if (/wood/.test(id)) return 'sword_wood'; if (/short/.test(id)) return 'sword_short'; if (/broad/.test(id)) return 'sword_broad';
  if (/knight/.test(id)) return 'sword_knight'; if (/clay|great/.test(id)) return 'sword_great'; if (/argen/.test(id)) return 'sword_argen';
  if (/axe/.test(id)) return 'axe'; if (/mace/.test(id)) return 'mace'; return 'sword_long';
}

function weaponIcon(ctx, key) {
  const W = WEAPONS[key];
  ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 4);
  const L = 10 + W.len * 0.65, w = Math.max(2.2, W.w * 0.9);
  if (W.glow) { ctx.fillStyle = rgba(W.glow, 0.35); ctx.fillRect(-w - 3, -L - 2, w * 2 + 6, L + 6); }
  // 손잡이·폼멜
  ctx.fillStyle = '#4a2e18'; ctx.fillRect(-1.6, 3, 3.2, 8); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.strokeRect(-1.6, 3, 3.2, 8);
  ctx.fillStyle = W.guard; ellipse(ctx, 0, 12.5, 2.2, 2.2); ctx.fill(); ctx.stroke();
  if (W.type === 'sword') {
    ctx.beginPath(); ctx.moveTo(-w, 2); ctx.lineTo(-w, -L + 4); ctx.lineTo(0, -L); ctx.lineTo(w, -L + 4); ctx.lineTo(w, 2); ctx.closePath();
    const g = ctx.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, W.edge); g.addColorStop(0.5, W.blade); g.addColorStop(1, shade(W.blade, -0.35));
    ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L + 3); ctx.stroke();
    ctx.fillStyle = W.guard; ctx.fillRect(-w - 3, 1.5, w * 2 + 6, 2.6); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.strokeRect(-w - 3, 1.5, w * 2 + 6, 2.6);
  } else if (W.type === 'axe') {
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(-1.4, -L + 2, 2.8, L); ctx.strokeRect(-1.4, -L + 2, 2.8, L);
    ctx.beginPath(); ctx.moveTo(1, -L + 3); ctx.quadraticCurveTo(10, -L + 1, 11, -L + 9); ctx.quadraticCurveTo(8, -L + 11, 1, -L + 10); ctx.closePath();
    ctx.fillStyle = W.blade; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = W.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, -L + 3); ctx.quadraticCurveTo(11.5, -L + 6, 10.5, -L + 9); ctx.stroke();
  } else {
    ctx.fillStyle = '#5a3e24'; ctx.fillRect(-1.4, -L + 6, 2.8, L - 4); ctx.strokeRect(-1.4, -L + 6, 2.8, L - 4);
    ctx.fillStyle = W.blade; ellipse(ctx, 0, -L + 5, 5, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = W.edge; for (let i = 0; i < 6; i++) { const a = i * 1.047; ctx.fillRect(Math.cos(a) * 5 - 1, -L + 5 + Math.sin(a) * 5 - 1, 2, 2); }
  }
  ctx.restore();
}
function armorIcon(ctx, key) {
  const A = ARMOR[key];
  ctx.beginPath();
  ctx.moveTo(9, 6); ctx.lineTo(13, 4); ctx.quadraticCurveTo(16, 7, 19, 4); ctx.lineTo(23, 6); ctx.lineTo(28, 10); ctx.lineTo(25, 15); ctx.lineTo(23, 14);
  ctx.lineTo(23, 27); ctx.lineTo(9, 27); ctx.lineTo(9, 14); ctx.lineTo(7, 15); ctx.lineTo(4, 10); ctx.closePath();
  const g = ctx.createLinearGradient(6, 0, 26, 0); g.addColorStop(0, shade(A.body, 0.3)); g.addColorStop(1, shade(A.body, -0.35));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); ctx.clip();
  if (A.pattern === 'chain') { ctx.fillStyle = 'rgba(20,20,26,0.4)'; for (let yy = 5; yy < 28; yy += 1.6) for (let xx = 5 + (yy % 3.2 ? 0.8 : 0); xx < 28; xx += 1.6) ctx.fillRect(xx, yy, 0.8, 0.8); }
  if (A.pattern === 'scale') { ctx.strokeStyle = 'rgba(10,14,20,0.5)'; ctx.lineWidth = 0.6; for (let yy = 7, k = 0; yy < 28; yy += 2.2, k++) for (let xx = 5 + (k % 2) * 1.4; xx < 28; xx += 2.8) { ctx.beginPath(); ctx.arc(xx, yy, 1.4, 0, Math.PI); ctx.stroke(); } }
  if (A.pattern === 'plate') { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(11, 7, 3, 14); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(9, 20); ctx.lineTo(23, 20); ctx.moveTo(16, 6); ctx.lineTo(16, 27); ctx.stroke(); }
  if (A.strap) { ctx.strokeStyle = A.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 7); ctx.lineTo(22, 24); ctx.stroke(); }
  ctx.restore();
  if (A.pauldron) { for (const xx of [7.5, 24.5]) { ctx.fillStyle = A.pauldron; ellipse(ctx, xx, 8, 4.5, 3.4); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke(); } }
  ctx.fillStyle = shade(A.trim, -0.1); ctx.fillRect(9, 22, 14, 2.4);
  if (A.glow) { ctx.fillStyle = A.glow; ellipse(ctx, 16, 13, 1.8, 1.8); ctx.fill(); }
}
function shieldIcon(ctx, key) {
  const S = SHIELDS[key];
  ctx.save(); ctx.translate(16, 16);
  ctx.beginPath();
  if (S.shape === 'round') ctx.arc(0, 0, 12, 0, Math.PI * 2);
  else if (S.shape === 'kite') { ctx.moveTo(-11, -11); ctx.lineTo(11, -11); ctx.quadraticCurveTo(12, 4, 0, 14); ctx.quadraticCurveTo(-12, 4, -11, -11); }
  else ctx.rect(-9, -13, 18, 26);
  const g = ctx.createLinearGradient(-12, -12, 12, 12); g.addColorStop(0, shade(S.face, 0.25)); g.addColorStop(1, shade(S.face, -0.35));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = S.rim; ctx.lineWidth = 2.4; ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
  if (S.shape === 'round') { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; for (const xx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(xx, -11); ctx.lineTo(xx, 11); ctx.stroke(); } }
  if (S.emblem) { ctx.fillStyle = S.emblem; ctx.fillRect(-1.6, -8, 3.2, 16); ctx.fillRect(-6, -3, 12, 3.2); }
  ctx.fillStyle = S.boss; ellipse(ctx, 0, 0, 2.6, 2.6); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke();
  ctx.restore();
}
function helmIcon(ctx, key) {
  const H = HELMS[key];
  ctx.save(); ctx.translate(16, 18);
  const g = ctx.createRadialGradient(-4, -6, 1, 0, 0, 14); g.addColorStop(0, shade(H.c, 0.45)); g.addColorStop(1, shade(H.c, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  if (H.kind === 'cap') { ctx.arc(0, 2, 11, Math.PI, 0); ctx.lineTo(12, 5); ctx.lineTo(-12, 5); ctx.closePath(); }
  else if (H.kind === 'iron') { ctx.arc(0, 2, 11, Math.PI, 0); ctx.lineTo(11, 8); ctx.lineTo(-11, 8); ctx.closePath(); }
  else { ctx.ellipse(0, 1, 11, 12.5, 0, 0, Math.PI * 2); }
  ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  if (H.kind === 'iron') { ctx.fillStyle = shade(H.c, -0.25); ctx.fillRect(-1.3, 0, 2.6, 9); ctx.fillRect(-11, 2, 22, 2); }
  if (H.kind === 'cap') { ctx.fillStyle = shade(H.c, -0.3); ctx.fillRect(-12, 3, 24, 2.4); }
  if (H.kind === 'knight') {
    ctx.fillStyle = '#0c0c12'; ctx.fillRect(-8, 0, 16, 2.4); ctx.fillRect(-1, 0, 2, 7);
    ctx.fillStyle = H.plume; ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(10, -16, 14, -4); ctx.quadraticCurveTo(8, -10, 1, -9); ctx.fill();
  }
  ctx.restore();
}
function bootIcon(ctx, color) {
  for (const [dx, a] of [[-4, 0.9], [4, 1]]) {
    ctx.save(); ctx.translate(dx, 0); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(10, 5); ctx.lineTo(18, 5); ctx.lineTo(18, 20); ctx.quadraticCurveTo(26, 21, 26, 27); ctx.lineTo(9, 27); ctx.lineTo(10, 5); ctx.closePath();
    const g = ctx.createLinearGradient(9, 0, 26, 0); g.addColorStop(0, shade(color, 0.3)); g.addColorStop(1, shade(color, -0.3));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = shade(color, -0.4); ctx.fillRect(9, 25, 17, 2.2); ctx.fillRect(10, 5, 8, 2.4);
    ctx.restore();
  }
}
function ringIcon(ctx, gem, band) {
  ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(16, 19, 9, 7, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = band; ctx.lineWidth = 3.4; ctx.stroke();
  ctx.strokeStyle = shade(band, 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(16, 19, 9, 7, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.fillStyle = gem; ctx.beginPath(); ctx.moveTo(16, 6); ctx.lineTo(21, 11); ctx.lineTo(16, 16); ctx.lineTo(11, 11); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(14, 9, 2, 2);
}
function amuletIcon(ctx, gem) {
  ctx.strokeStyle = '#c9a14a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(6, 4); ctx.quadraticCurveTo(16, 22, 26, 4); ctx.stroke();
  const g = ctx.createRadialGradient(15, 19, 1, 16, 21, 7); g.addColorStop(0, shade(gem, 0.6)); g.addColorStop(1, shade(gem, -0.3));
  ctx.fillStyle = '#c9a14a'; ellipse(ctx, 16, 21, 7, 8); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = g; ellipse(ctx, 16, 21, 4.6, 5.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(14, 18, 2, 2);
}
function potionIcon(ctx, color, glow, sz) {
  const big = sz === 'l' ? 1.15 : sz === 'm' ? 1.05 : 0.95;
  ctx.save(); ctx.translate(16, 18); ctx.scale(big, big);
  ctx.beginPath();
  if (sz === 'vial') { ctx.moveTo(-3, -12); ctx.lineTo(3, -12); ctx.lineTo(3, -4); ctx.quadraticCurveTo(7, 0, 7, 6); ctx.quadraticCurveTo(7, 11, 0, 11); ctx.quadraticCurveTo(-7, 11, -7, 6); ctx.quadraticCurveTo(-7, 0, -3, -4); ctx.closePath(); }
  else { ctx.moveTo(-3, -11); ctx.lineTo(3, -11); ctx.lineTo(3, -5); ctx.arc(0, 3, 9, -Math.PI * 0.32, Math.PI * 1.32); ctx.closePath(); }
  ctx.fillStyle = '#c8dce6'; ctx.fill();
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(-9, 0, 9, 0); g.addColorStop(0, shade(color, 0.35)); g.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = g; ctx.fillRect(-10, -1, 20, 14);
  ctx.fillStyle = rgba('#ffffff', 0.25); ctx.fillRect(-10, -1, 20, 1.5);
  ctx.restore();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ellipse(ctx, -4, 1, 1.6, 3); ctx.fill();
  ctx.fillStyle = '#7a5230'; ctx.fillRect(-3.5, -14, 7, 4); ctx.strokeRect(-3.5, -14, 7, 4);
  ctx.restore();
}
function shardIcon(ctx, color) {
  ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(23, 13); ctx.lineTo(19, 29); ctx.lineTo(12, 27); ctx.lineTo(9, 12); ctx.closePath();
  const g = ctx.createLinearGradient(9, 0, 23, 0); g.addColorStop(0, shade(color, 0.6)); g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(15, 28); ctx.stroke();
}
function pageIcon(ctx) {
  ctx.beginPath(); ctx.moveTo(7, 4); ctx.lineTo(25, 4); ctx.lineTo(25, 24); ctx.lineTo(22, 26); ctx.lineTo(20, 23); ctx.lineTo(17, 28); ctx.lineTo(14, 25); ctx.lineTo(11, 28); ctx.lineTo(7, 25); ctx.closePath();
  ctx.fillStyle = '#d8c8a0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#5a3a20'; for (let i = 0; i < 5; i++) ctx.fillRect(10, 8 + i * 3, 12 - (i % 2) * 4, 1);
  ctx.fillStyle = 'rgba(60,0,40,0.5)'; ellipse(ctx, 20, 20, 3, 2.4); ctx.fill();
}
function scrollIcon(ctx) {
  ctx.fillStyle = '#d8c8a0'; ctx.fillRect(8, 7, 16, 18); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(8, 7, 16, 18);
  for (const yy of [7, 25]) { ctx.fillStyle = '#a88a5a'; ellipse(ctx, 16, yy, 10, 2.6); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#3a5aaa'; ctx.beginPath(); ctx.arc(16, 16, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a02020'; ctx.fillRect(15, 20, 2, 7);
}
function keyIcon(ctx) {
  ctx.save(); ctx.translate(16, 16); ctx.rotate(-0.7);
  ctx.strokeStyle = OUT; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.moveTo(0, -3); ctx.lineTo(0, 12); ctx.stroke();
  ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.moveTo(0, -3); ctx.lineTo(0, 12); ctx.stroke();
  ctx.fillStyle = '#e8c860'; ctx.fillRect(0, 7, 5, 2.4); ctx.fillRect(0, 11, 4, 2.4);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-1, -10, 2, 2);
  ctx.restore();
}
function tailIcon(ctx) {
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(6, 24); ctx.quadraticCurveTo(14, 4, 26, 10); ctx.stroke();
  ctx.strokeStyle = '#c09088'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.fillStyle = '#6a5e54'; ellipse(ctx, 6, 24, 3.4, 3); ctx.fill();
}
function peltIcon(ctx) {
  ctx.beginPath(); ctx.moveTo(6, 8); ctx.quadraticCurveTo(16, 3, 26, 8); ctx.lineTo(28, 14); ctx.lineTo(24, 16); ctx.lineTo(26, 26); ctx.quadraticCurveTo(16, 29, 6, 26); ctx.lineTo(8, 16); ctx.lineTo(4, 14); ctx.closePath();
  const g = ctx.createLinearGradient(4, 4, 28, 28); g.addColorStop(0, '#9a9690'); g.addColorStop(1, '#4e4c4a');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(9 + i * 3, 10); ctx.lineTo(10 + i * 3, 22); ctx.stroke(); }
}
function pouchIcon(ctx, color, tie) {
  ctx.beginPath(); ctx.moveTo(11, 9); ctx.quadraticCurveTo(4, 18, 8, 26); ctx.quadraticCurveTo(16, 30, 24, 26); ctx.quadraticCurveTo(28, 18, 21, 9); ctx.closePath();
  const g = ctx.createLinearGradient(6, 0, 26, 0); g.addColorStop(0, shade(color, 0.3)); g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = shade(color, 0.1); ctx.beginPath(); ctx.moveTo(10, 9); ctx.lineTo(13, 4); ctx.lineTo(19, 4); ctx.lineTo(22, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = tie; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(10, 9.5); ctx.lineTo(22, 9.5); ctx.stroke();
}
export function goldIcon(ctx, x, y, size) {
  const c = cached('gold', size, (g) => {
    for (const [cx, cy] of [[11, 22], [20, 22], [16, 17], [13, 13], [20, 14]]) {
      g.fillStyle = '#b8862a'; ellipse(g, cx, cy + 1.2, 6, 3); g.fill();
      g.fillStyle = '#ffd860'; ellipse(g, cx, cy, 6, 3); g.fill(); g.strokeStyle = '#7a5418'; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(cx - 2, cy - 1, 2, 1);
    }
  });
  blit(ctx, c, x, y, size);
}

// ── 스킬 ──
const SKILL_BG = { power_strike: '#6a4a10', whirlwind: '#24406a', charge: '#5a3a1a', war_cry: '#6a1a10', iron_wall: '#2a3a5a', earth_splitter: '#4a2a10' };
export function drawSkillIcon(game, ctx, skillId, x, y, size) {
  const def = game.data.skills?.[skillId];
  const c = cached('s:' + skillId, size, (g) => skillArt(g, skillId, def), false);
  blit(ctx, c, x, y, size);
}
function skillArt(ctx, id, def) {
  const bg = SKILL_BG[id] || '#3a3450';
  ctx.beginPath(); ctx.rect(0, 0, 32, 32);
  const g = ctx.createRadialGradient(13, 11, 2, 16, 16, 22); g.addColorStop(0, shade(bg, 0.45)); g.addColorStop(1, shade(bg, -0.55));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const sword = (cx, cy, ang, len, col = '#e8ecf0') => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.lineTo(-1.6, -len + 3); ctx.lineTo(0, -len); ctx.lineTo(1.6, -len + 3); ctx.lineTo(1.6, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#c9a14a'; ctx.fillRect(-4.5, -0.5, 9, 2); ctx.fillStyle = '#4a2e18'; ctx.fillRect(-1, 1.5, 2, 5);
    ctx.restore();
  };
  switch (id) {
    case 'power_strike': {
      const r = ctx.createRadialGradient(20, 11, 0, 20, 11, 12); r.addColorStop(0, 'rgba(255,240,170,1)'); r.addColorStop(1, 'rgba(255,170,40,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 1.2; for (let i = 0; i < 8; i++) { const a = i * 0.785; ctx.beginPath(); ctx.moveTo(20 + Math.cos(a) * 4, 11 + Math.sin(a) * 4); ctx.lineTo(20 + Math.cos(a) * 10, 11 + Math.sin(a) * 10); ctx.stroke(); }
      sword(10, 25, Math.PI * 0.25, 20);
      break;
    }
    case 'whirlwind':
      ctx.strokeStyle = 'rgba(200,225,255,0.9)'; ctx.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(16, 16, 11 - i * 3, i * 2.1, i * 2.1 + 4); ctx.stroke(); }
      sword(16, 16, 1.1, 13); sword(16, 16, 1.1 + Math.PI, 13);
      break;
    case 'charge':
      ctx.strokeStyle = 'rgba(255,230,180,0.85)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(3, 8 + i * 4); ctx.lineTo(14 - (i % 2) * 4, 8 + i * 4); ctx.stroke(); }
      ctx.fillStyle = '#e8d0a0'; ctx.beginPath(); ctx.moveTo(14, 8); ctx.lineTo(28, 16); ctx.lineTo(14, 24); ctx.lineTo(17, 16); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
      break;
    case 'war_cry':
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(255,${140 - i * 30},60,${0.9 - i * 0.25})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(11, 16, 7 + i * 5, -0.8, 0.8); ctx.stroke(); }
      ctx.fillStyle = '#e8b890'; ellipse(ctx, 9, 16, 6, 7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = '#3a0a0a'; ellipse(ctx, 12, 18, 2.4, 3); ctx.fill();
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(4, 8, 9, 3);
      break;
    case 'iron_wall': {
      const r = ctx.createRadialGradient(16, 16, 2, 16, 16, 15); r.addColorStop(0, 'rgba(170,200,255,0.6)'); r.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, 32, 32);
      shieldIcon(ctx, 'shield_tower');
      break;
    }
    case 'earth_splitter':
      ctx.fillStyle = '#2a1a0a'; ctx.beginPath(); ctx.moveTo(2, 28); ctx.lineTo(9, 22); ctx.lineTo(14, 24); ctx.lineTo(20, 17); ctx.lineTo(25, 18); ctx.lineTo(30, 10); ctx.lineTo(30, 13); ctx.lineTo(26, 21); ctx.lineTo(21, 20); ctx.lineTo(15, 27); ctx.lineTo(10, 25); ctx.lineTo(4, 30); ctx.fill();
      ctx.strokeStyle = '#ff9a40'; ctx.lineWidth = 1; ctx.stroke();
      for (const [sx, sy, h] of [[8, 24, 8], [15, 21, 11], [22, 16, 13]]) { ctx.fillStyle = '#7a6a54'; ctx.beginPath(); ctx.moveTo(sx - 3, sy); ctx.lineTo(sx, sy - h); ctx.lineTo(sx + 3, sy); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.6; ctx.stroke(); }
      break;
    default:
      ctx.fillStyle = '#c8c0ff'; ctx.font = 'bold 16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((def?.name || id || '?').slice(0, 1), 16, 17);
  }
  ctx.restore();
  // 베벨 테두리 (좌상 밝게 / 우하 어둡게)
  ctx.fillStyle = '#100c08'; ctx.fillRect(0, 0, 32, 1); ctx.fillRect(0, 31, 32, 1); ctx.fillRect(0, 0, 1, 32); ctx.fillRect(31, 0, 1, 32);
  ctx.fillStyle = 'rgba(255,236,190,0.55)'; ctx.fillRect(1, 1, 30, 1); ctx.fillRect(1, 1, 1, 30);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(1, 30, 30, 1); ctx.fillRect(30, 1, 1, 30);
}

// ── 초상화: 정면, 정지. 사람형은 머리~가슴, 그 외는 전신 ──
export function drawPortrait(ctx, look, x, y, size) {
  if (!look) return;
  const body = look.body || 'human';
  if (body === 'drop') return;
  // 도트 초상화: 작은 해상도로 그린 뒤 도트화 → 최근접 확대 (look+크기별 캐시)
  const k = size >= 40 ? 2 : 1;
  const N = Math.max(12, Math.round(size / k));
  const key = 'p:' + lookKey(look) + '@' + N;
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(N, N);
    const g = c.getContext('2d');
    if (isHumanoid(body)) {
      const sc = N / 30, hgt = (HUMANOID_BODIES[body]?.height ?? (look.gender === 'f' ? 0.96 : 1)), hun = HUMANOID_BODIES[body]?.hunch ?? 0;
      const headZ = 37 * 1.06 * hgt + 8.8 - hun * 5; // 머리 중심 높이 → 초상화 0.53 지점
      drawLookAt(g, { ...look, scale: 1 }, N / 2, N * 0.53 + headZ * sc, sc, 4, 'idle', 0.25);
    } else {
      const tall = { wolf: 38, boar: 34, rat: 22, spider: 30, slime: 30, bat: 50, shade: 52, wraith: 56 }[body] ?? 48;
      const sc = N / tall;
      drawLookAt(g, { ...look, scale: 1 }, N / 2, N * (body === 'bat' ? 1.25 : 0.88), sc, 3, 'idle', 0.25);
    }
    cache.set(key, c);
  }
  blit(ctx, c, x, y, size);
}
