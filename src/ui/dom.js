// UI 공용 헬퍼: DOM 생성, 이스케이프, 아이콘/초상화(렌더러 API 우선, 없으면 자체 폴백), 툴팁 HTML.
export function el(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmtNum = (n) => Math.round(n ?? 0).toLocaleString('ko-KR');

export const GRADE_COLOR = { common: '#e8e2d0', uncommon: '#5fd068', rare: '#4f9dff', epic: '#c070ff', legendary: '#ff9a2e' };
export const GRADE_NAME = { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' };
export const SLOT_NAME = { weapon: '무기', armor: '갑옷', shield: '방패', helm: '투구', ring: '반지', amulet: '목걸이', boots: '신발' };
export const TYPE_NAME = { ...SLOT_NAME, consumable: '소모품', quest: '퀘스트', material: '재료' };
export const STAT_NAME = { atk: '공격력', def: '방어력', str: '힘', dex: '민첩', con: '체력', int: '지능', wis: '지혜', hp: '최대 HP', mp: '최대 MP', crit: '치명타', speed: '이동 속도', hit: '명중', eva: '회피' };
export const EQUIP_SLOTS = ['weapon', 'armor', 'shield', 'helm', 'ring', 'amulet', 'boots'];

// ── 아이콘 ──
export function iconCanvas(game, kind, id, size = 36) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = size + 'px';
  c.className = 'icon';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawIcon(game, ctx, kind, id, 0, 0, size);
  return c;
}

export function drawIcon(game, ctx, kind, id, x, y, size) {
  const r = game.renderer;
  try {
    if (kind === 'item' && r?.drawItemIcon) return r.drawItemIcon(ctx, id, x, y, size);
    if (kind === 'skill' && r?.drawSkillIcon) return r.drawSkillIcon(ctx, id, x, y, size);
  } catch (e) { /* 렌더러 쪽 오류 시 폴백 */ }
  if (kind === 'item') fallbackItemIcon(ctx, { id, ...(game.data.items[id] ?? {}) }, x, y, size);
  else fallbackSkillIcon(ctx, id, x, y, size);
}

function fallbackItemIcon(ctx, def, x, y, s) {
  const t = def?.type ?? 'material';
  const gc = GRADE_COLOR[def?.grade] ?? '#bbb';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 32, s / 32);
  ctx.lineJoin = 'round';
  const metal = (g) => { const gr = ctx.createLinearGradient(0, 0, 32, 32); gr.addColorStop(0, '#f2f2f6'); gr.addColorStop(0.5, g); gr.addColorStop(1, '#45454c'); return gr; };
  ctx.strokeStyle = '#120c06'; ctx.lineWidth = 1.4;
  const path = (pts, fill) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
  const id = def?.id ?? '';
  if (t === 'consumable') {
    const mana = def?.use?.mana && !def?.use?.heal;
    const col = def?.use?.teleport ? '#e4d39a' : mana ? '#3f7bff' : id.includes('soul') ? '#9ad8ff' : '#d8283a';
    if (def?.use?.teleport) { // 주문서
      path([[7, 8], [25, 8], [25, 25], [7, 25]], '#e9dcb5');
      ctx.fillStyle = '#8a1d1d'; ctx.beginPath(); ctx.arc(16, 22, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a6440'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(10, 12 + i * 3); ctx.lineTo(22, 12 + i * 3); ctx.stroke(); }
    } else {
      path([[13, 4], [19, 4], [19, 10], [26, 18], [24, 28], [8, 28], [6, 18], [13, 10]], 'rgba(220,235,255,.35)');
      ctx.beginPath(); ctx.moveTo(8, 18); ctx.lineTo(24, 18); ctx.lineTo(24, 27); ctx.lineTo(8, 27); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(12.5, 2, 7, 4);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(10, 19, 2, 6);
    }
  } else if (t === 'weapon') {
    const axe = def?.look === 'axe', mace = def?.look === 'mace', wood = def?.look === 'sword_wood';
    if (axe) { ctx.fillStyle = '#6b4222'; ctx.fillRect(15, 6, 3, 23); path([[17, 6], [27, 8], [27, 17], [17, 15]], metal('#9aa0aa')); }
    else if (mace) { ctx.fillStyle = '#6b4222'; ctx.fillRect(15, 12, 3, 17); ctx.fillStyle = metal('#888'); ctx.beginPath(); ctx.arc(16.5, 9, 6, 0, 7); ctx.fill(); ctx.stroke(); }
    else {
      path([[24, 3], [28, 4], [12, 21], [10, 19]], wood ? '#a87a46' : metal(def?.grade === 'legendary' ? '#ffcf6a' : '#b7bcc7'));
      path([[6, 17], [15, 26], [13, 28], [4, 19]], '#8a6a2e');
      ctx.fillStyle = '#5a3416'; ctx.save(); ctx.translate(8, 24); ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -1, 4, 7); ctx.restore();
    }
  } else if (t === 'armor') {
    path([[9, 5], [13, 7], [19, 7], [23, 5], [28, 10], [25, 15], [24, 28], [8, 28], [7, 15], [4, 10]], def?.look === 'tunic' ? '#7d6a4a' : def?.look === 'leather' ? '#8a5a2e' : metal('#9aa0aa'));
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(16, 27); ctx.stroke();
  } else if (t === 'shield') {
    path([[6, 6], [26, 6], [26, 16], [16, 29], [6, 16]], def?.look === 'shield_wood' ? '#8a5a2e' : metal('#8a90a0'));
    ctx.strokeStyle = '#d8b46a'; ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(16, 25); ctx.moveTo(9, 13); ctx.lineTo(23, 13); ctx.stroke();
  } else if (t === 'helm') {
    path([[7, 20], [7, 13], [11, 7], [21, 7], [25, 13], [25, 20], [21, 26], [11, 26]], def?.look === 'cap_leather' ? '#8a5a2e' : metal('#9aa0aa'));
    ctx.fillStyle = '#1a1208'; ctx.fillRect(10, 15, 12, 3);
  } else if (t === 'boots') {
    path([[8, 6], [15, 6], [15, 20], [25, 22], [25, 28], [8, 28]], def?.look === 'boots_iron' ? metal('#888') : '#6a4224');
  } else if (t === 'ring') {
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#d8b46a'; ctx.beginPath(); ctx.arc(16, 19, 8, 0, 7); ctx.stroke();
    ctx.lineWidth = 1.4; ctx.fillStyle = id.includes('ruby') ? '#e0263a' : '#c98a4a'; ctx.strokeStyle = '#120c06';
    ctx.beginPath(); ctx.arc(16, 10, 4, 0, 7); ctx.fill(); ctx.stroke();
  } else if (t === 'amulet') {
    ctx.strokeStyle = '#d8b46a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(7, 4); ctx.quadraticCurveTo(16, 20, 25, 4); ctx.stroke();
    ctx.strokeStyle = '#120c06'; ctx.lineWidth = 1.4;
    path([[16, 14], [22, 20], [16, 28], [10, 20]], id.includes('serin') ? '#bfe6ff' : '#4fa0ff');
  } else if (t === 'quest') {
    if (id.startsWith('shard')) { path([[16, 3], [24, 14], [16, 29], [8, 14]], id.includes('body') ? '#ff9a7a' : id.includes('mind') ? '#9affc8' : '#b9a6ff'); }
    else if (id.startsWith('torn_page')) { path([[7, 5], [24, 5], [26, 12], [23, 18], [25, 27], [7, 27]], '#d9c9a0'); ctx.strokeStyle = '#5a1a2a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(10, 10 + i * 4); ctx.lineTo(21, 10 + i * 4); ctx.stroke(); } }
    else if (id.includes('key')) { ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(11, 11, 5, 0, 7); ctx.moveTo(15, 15); ctx.lineTo(26, 26); ctx.moveTo(22, 22); ctx.lineTo(25, 19); ctx.stroke(); }
    else { ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.arc(16, 17, 9, 0, 7); ctx.fill(); ctx.stroke(); }
  } else {
    ctx.fillStyle = '#8a7a5a'; ctx.beginPath(); ctx.ellipse(16, 18, 10, 8, 0.4, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // 등급 테두리 점
  if (def?.grade && def.grade !== 'common') { ctx.fillStyle = gc; ctx.fillRect(x + s - 6, y + 2, 4, 4); }
}

const SKILL_COL = { power_strike: '#ff7a3a', whirlwind: '#c8d8ff', charge: '#ffd24a', war_cry: '#ff3a3a', iron_wall: '#9ab0c8', earth_splitter: '#c8902a' };
function fallbackSkillIcon(ctx, id, x, y, s) {
  const col = SKILL_COL[id] ?? '#aaa';
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 32, s / 32);
  const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 18); g.addColorStop(0, col); g.addColorStop(1, '#140c08');
  ctx.fillStyle = g; ctx.fillRect(1, 1, 30, 30);
  ctx.strokeStyle = '#fff6dc'; ctx.fillStyle = '#fff6dc'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  if (id === 'power_strike') { ctx.moveTo(8, 24); ctx.lineTo(24, 8); ctx.moveTo(18, 6); ctx.lineTo(26, 14); }
  else if (id === 'whirlwind') { ctx.arc(16, 16, 9, 0, 5); ctx.moveTo(25, 16); ctx.lineTo(21, 12); }
  else if (id === 'charge') { ctx.moveTo(6, 12); ctx.lineTo(20, 12); ctx.moveTo(6, 20); ctx.lineTo(20, 20); ctx.moveTo(18, 8); ctx.lineTo(26, 16); ctx.lineTo(18, 24); }
  else if (id === 'war_cry') { ctx.moveTo(8, 12); ctx.lineTo(14, 12); ctx.lineTo(20, 7); ctx.lineTo(20, 25); ctx.lineTo(14, 20); ctx.lineTo(8, 20); ctx.closePath(); }
  else if (id === 'iron_wall') { ctx.moveTo(8, 7); ctx.lineTo(24, 7); ctx.lineTo(24, 16); ctx.lineTo(16, 26); ctx.lineTo(8, 16); ctx.closePath(); }
  else if (id === 'earth_splitter') { ctx.moveTo(6, 26); ctx.lineTo(12, 18); ctx.lineTo(10, 14); ctx.lineTo(18, 10); ctx.lineTo(16, 6); ctx.lineTo(26, 4); }
  else { ctx.arc(16, 16, 7, 0, 7); }
  ctx.stroke();
  ctx.restore();
}

// ── 초상화 ──
export function portraitCanvas(game, look, size = 96) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  c.style.width = c.style.height = size + 'px';
  c.className = 'portrait';
  paintPortrait(game, c, look);
  return c;
}
export function paintPortrait(game, canvas, look) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  // 고전풍: 평탄한 2단 배경(그라데이션 없음)
  ctx.fillStyle = '#1a140e'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#241c14'; ctx.fillRect(0, 0, s, Math.round(s * 0.6));
  if (!look) return;
  if (typeof look === 'string') look = game.data.npcs[look]?.look ?? { body: look };
  try {
    if (game.renderer?.drawPortrait) { game.renderer.drawPortrait(ctx, look, 0, 0, s); return; }
  } catch (e) { /* 폴백 */ }
  fallbackPortrait(ctx, look, s);
}

function fallbackPortrait(ctx, look, s) {
  ctx.save();
  ctx.scale(s / 100, s / 100);
  const body = look.body ?? 'human';
  if (body !== 'human') { // 몬스터/정령: 실루엣
    const tint = look.tint ?? (body === 'shade' || body === 'wraith' ? '#8a7aff' : '#7a6a5a');
    const g = ctx.createRadialGradient(50, 45, 4, 50, 55, 48); g.addColorStop(0, tint); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(50, 60, 30, 40, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(40, 46, 3, 0, 7); ctx.arc(60, 46, 3, 0, 7); ctx.fill();
    ctx.restore(); return;
  }
  const skin = look.skin ?? '#e8c4a0', hairC = look.hairColor ?? '#3b2a1e';
  const cloth = look.robe ?? (look.armor === 'plate' || look.armor === 'chain' ? '#8a90a0' : look.armor === 'leather' ? '#7a4a24' : '#5a4a3a');
  ctx.fillStyle = cloth; ctx.beginPath(); ctx.moveTo(10, 100); ctx.quadraticCurveTo(14, 70, 50, 68); ctx.quadraticCurveTo(86, 70, 90, 100); ctx.fill();
  if (look.apron) { ctx.fillStyle = look.apron; ctx.fillRect(36, 76, 28, 24); }
  ctx.fillStyle = skin; ctx.fillRect(43, 58, 14, 14);
  ctx.beginPath(); ctx.ellipse(50, 44, 19, 23, 0, 0, 7); ctx.fill();
  // 머리
  ctx.fillStyle = hairC;
  const h = look.hair ?? 0, f = look.gender === 'f';
  ctx.beginPath(); ctx.ellipse(50, 30, 21, 14, 0, Math.PI, 0); ctx.fill();
  if (f || h === 3 || h === 5) { ctx.fillRect(29, 30, 7, f ? 36 : 22); ctx.fillRect(64, 30, 7, f ? 36 : 22); }
  if (h === 1 || h === 4) { ctx.beginPath(); ctx.moveTo(30, 34); ctx.lineTo(50, 24); ctx.lineTo(70, 34); ctx.lineTo(70, 26); ctx.lineTo(30, 26); ctx.fill(); }
  if (h === 2) { ctx.beginPath(); ctx.arc(50, 16, 8, 0, 7); ctx.fill(); }
  if (look.beard) { ctx.beginPath(); ctx.moveTo(33, 48); ctx.quadraticCurveTo(50, 80, 67, 48); ctx.lineTo(62, 56); ctx.quadraticCurveTo(50, 62, 38, 56); ctx.fill(); }
  if (look.helm) { ctx.fillStyle = look.helm === 'cap_leather' ? '#6a4224' : '#8a90a0'; ctx.beginPath(); ctx.ellipse(50, 30, 22, 16, 0, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = '#1a1008'; ctx.fillRect(41, 44, 4, 3); ctx.fillRect(55, 44, 4, 3);
  ctx.fillStyle = 'rgba(120,40,30,.6)'; ctx.fillRect(46, 56, 8, 2);
  ctx.restore();
}

// ── 툴팁 HTML ──
function statLine(k, v) {
  if (k === 'atk' && Array.isArray(v)) return `${STAT_NAME.atk} ${v[0]}~${v[1]}`;
  const sign = v > 0 ? '+' : '';
  return `${STAT_NAME[k] ?? k} ${sign}${v}${k === 'crit' ? '%' : ''}`;
}
export function itemTooltipHtml(game, itemId, opts = {}) {
  const d = game.data.items[itemId];
  if (!d) return `<div class="tt-name">${esc(itemId)}</div>`;
  const gc = GRADE_COLOR[d.grade] ?? GRADE_COLOR.common;
  let h = `<div class="tt-name" style="color:${gc}">${esc(d.name)}${opts.qty > 1 ? ` <span class="tt-qty">×${opts.qty}</span>` : ''}</div>`;
  h += `<div class="tt-type">${GRADE_NAME[d.grade] ?? '일반'} · ${TYPE_NAME[d.type] ?? d.type ?? ''}</div>`;
  if (d.level) {
    const lack = (game.player?.level ?? 1) < d.level;
    h += `<div class="tt-req${lack ? ' bad' : ''}">요구 레벨 ${d.level}</div>`;
  }
  if (d.stats) h += `<div class="tt-stats">${Object.entries(d.stats).map(([k, v]) => `<div>${esc(statLine(k, v))}</div>`).join('')}</div>`;
  if (d.use) {
    const u = [];
    if (d.use.heal) u.push(`HP ${d.use.heal} 회복`);
    if (d.use.mana) u.push(`MP ${d.use.mana} 회복`);
    if (d.use.teleport) u.push('마을로 귀환');
    if (d.use.buff) u.push('강화 효과');
    if (u.length) h += `<div class="tt-use">사용: ${u.join(', ')}</div>`;
  }
  if (d.desc) h += `<div class="tt-desc">${esc(d.desc)}</div>`;
  if (opts.price != null) h += `<div class="tt-price">가격 ${fmtNum(opts.price)} 골드</div>`;
  else if (opts.sell && d.price && !d.unsellable) h += `<div class="tt-price">판매가 ${fmtNum(game.systems.inventory?.sellPrice?.(itemId) ?? Math.floor(d.price * 0.4))} 골드</div>`;
  if (opts.hint) h += `<div class="tt-hint">${esc(opts.hint)}</div>`;
  return h;
}
export function skillTooltipHtml(game, id) {
  const d = game.data.skills[id] ?? {};
  let h = `<div class="tt-name" style="color:#ffd27a">${esc(d.name ?? id)}</div>`;
  const meta = [];
  if (d.level) meta.push(`습득 Lv ${d.level}`);
  if (d.mp) meta.push(`MP ${d.mp}`);
  const cd = d.cooldown ?? d.cd;
  if (cd) meta.push(`재사용 ${cd}초`);
  if (meta.length) h += `<div class="tt-type">${meta.join(' · ')}</div>`;
  if (d.desc) h += `<div class="tt-desc">${esc(d.desc)}</div>`;
  return h;
}
