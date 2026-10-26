// 게임 창들: 가방+장비(I), 기술(K), 능력치(C), 의뢰 일지(J), 지도(M).
import { el, esc, iconCanvas, portraitCanvas, fmtNum, itemTooltipHtml, skillTooltipHtml, EQUIP_SLOTS, SLOT_NAME, STAT_NAME } from './dom.js';
import { Win } from './windows.js';
import { drawFullMap } from './minimap.js';
import { itemSheet, equipSheet, skillSheet } from './mobile.js';

// ── 가방 + 장비 ──
const EQ_POS = { helm: [4, 0], armor: [4, 42], weapon: [4, 84], boots: [4, 126], amulet: [210, 0], ring: [210, 42], shield: [210, 84] };

export class InventoryWin extends Win {
  constructor(ui) {
    super(ui, 'inventory', {
      title: '소지품', cls: 'invwin', place: (W, H, w, h) => ({ x: W - w - 220, y: Math.max(10, H - h - 120) }),
      events: ['inventory:changed', 'gold:changed', 'stats:changed', 'player:levelup'],
    });
  }
  render() {
    const g = this.game, s = g.state;
    if (!s) return;
    const b = this.body;
    b.innerHTML = `<div class="sec-title">장비</div><div class="eq"><div class="pframe"></div></div><div class="sec-title">가방</div><div class="grid inv-grid"></div>
      <div class="invfoot"><span>골드 <span class="g">${fmtNum(s.gold)}</span></span><span class="h">${this.ui.mobile?.on ? '탭: 설명·사용·단축키 · 길게 누르기: 바로 사용·장착' : '클릭: 사용·장착 · 끌기: 이동/단축키/버리기'}</span></div>`;
    const eq = b.querySelector('.eq');
    eq.querySelector('.pframe').appendChild(portraitCanvas(g, g.player.look, 112));
    for (const k of EQUIP_SLOTS) {
      const [x, y] = EQ_POS[k];
      const sl = el('div', 'slot');
      sl.style.left = x + 'px'; sl.style.top = y + 'px';
      sl.dataset.drop = `eq:${k}`;
      const it = s.equipment[k];
      if (it) sl.appendChild(iconCanvas(g, 'item', it.id, 32));
      else sl.appendChild(el('div', 'lab', SLOT_NAME[k]));
      this.ui.drag.bind(sl, () => (s.equipment[k] ? { type: 'equip', slot: k } : null), {
        icon: () => s.equipment[k] && iconCanvas(g, 'item', s.equipment[k].id, 36),
        onClick: () => this.ui.unequip(k), onRight: () => this.ui.unequip(k),
        onTap: (e) => equipSheet(this.ui, e, k), onLong: () => this.ui.unequip(k),
      });
      this.ui.tip.bind(sl, () => (s.equipment[k] ? itemTooltipHtml(g, s.equipment[k].id, { hint: '클릭: 장비 해제' }) : `<div class="tt-type">${SLOT_NAME[k]} — 비어 있음</div>`));
      eq.appendChild(sl);
    }
    const grid = b.querySelector('.inv-grid');
    s.inventory.forEach((it, i) => {
      const sl = el('div', 'slot');
      sl.dataset.drop = `inv:${i}`;
      if (it) {
        sl.appendChild(iconCanvas(g, 'item', it.id, 32));
        if (it.qty > 1) sl.appendChild(el('span', 'qty', String(it.qty)));
        const d = g.data.items[it.id];
        if (d?.level && d.level > g.player.level) sl.style.borderColor = '#5a0a0a #e04040 #e04040 #5a0a0a';
      }
      this.ui.drag.bind(sl, () => (s.inventory[i] ? { type: 'item', slot: i } : null), {
        icon: () => s.inventory[i] && iconCanvas(g, 'item', s.inventory[i].id, 36),
        onClick: () => this.ui.useItem(i), onRight: () => this.ui.useItem(i),
        onTap: (e) => itemSheet(this.ui, e, i), onLong: () => this.ui.useItem(i),
      });
      this.ui.tip.bind(sl, () => {
        const cur = s.inventory[i];
        if (!cur) return null;
        const d = g.data.items[cur.id];
        const hint = d?.type === 'consumable' ? '클릭: 사용 · 단축키로 끌어 등록' : EQUIP_SLOTS.includes(d?.type) ? '클릭: 장착' : '';
        return itemTooltipHtml(g, cur.id, { qty: cur.qty, sell: true, hint });
      });
      grid.appendChild(sl);
    });
  }
}

// ── 기술 ──
export class SkillsWin extends Win {
  constructor(ui) {
    super(ui, 'skills', { title: '기술', place: (W, H, w, h) => ({ x: W / 2 - w - 20, y: Math.max(10, H - h - 130) }), events: ['skill:learned', 'player:class', 'player:levelup', 'hotbar:changed'] });
  }
  render() {
    const g = this.game, s = g.state;
    if (!s) return;
    const all = Object.entries(g.data.skills)
      .filter(([, d]) => !d.class || !s.cls || d.class === s.cls)
      .sort(([, a], [, b]) => (a.level ?? 0) - (b.level ?? 0));
    for (const id of s.skills) if (!all.find(([k]) => k === id)) all.push([id, g.data.skills[id] ?? { name: id }]);
    const b = this.body;
    b.innerHTML = `<div class="skill-list"></div><div class="note">${this.ui.mobile?.on ? '기술을 탭해 [단축키 1~6]으로 등록 · 길게 누르기: 빈 칸에 자동 등록' : '배운 기술을 단축키 칸으로 끌어다 놓으세요 · 우클릭: 빈 칸에 자동 등록'}</div>`;
    const list = b.querySelector('.skill-list');
    if (!all.length) list.innerHTML = '<div class="empty">아직 깨달은 기술이 없다.<br>신의 응답을 기다려라.</div>';
    for (const [id, d] of all) {
      const learned = s.skills.includes(id);
      const row = el('div', `skill-row${learned ? '' : ' locked'}`);
      const sl = el('div', 'slot');
      sl.appendChild(iconCanvas(g, 'skill', id, 32));
      row.appendChild(sl);
      const cd = d.cooldown ?? d.cd;
      const onBar = s.hotbar.indexOf(id);
      row.appendChild(el('div', 'info', `<div class="nm">${esc(d.name ?? id)}${onBar >= 0 ? ` <small>[${(onBar + 1) % 10}]</small>` : ''}</div>
        <div class="meta">${[d.level ? `Lv ${d.level}` : '', d.mp ? `MP ${d.mp}` : '', cd ? `재사용 ${cd}초` : '', learned ? '' : '미습득'].filter(Boolean).join(' · ')}</div>
        ${d.desc ? `<div class="ds">${esc(d.desc)}</div>` : ''}`));
      if (learned) {
        this.ui.drag.bind(sl, () => ({ type: 'skill', id }), {
          icon: () => iconCanvas(g, 'skill', id, 36),
          onClick: () => g.systems.skills?.use?.(g.player, id, g.controller?.target ?? null),
          onRight: () => { this.ui.autoHotbarSkill(id, true); },
          onTap: (e) => skillSheet(this.ui, e, id), onLong: () => this.ui.autoHotbarSkill(id, true),
        });
      }
      this.ui.tip.bind(sl, () => skillTooltipHtml(g, id));
      row.addEventListener('click', (e) => { if (this.ui.mobile?.on && !e.target.closest('.slot')) skillSheet(this.ui, sl, id); });
      list.appendChild(row);
    }
  }
}

// ── 능력치 ──
const STAT_DESC = { str: '물리 공격력', dex: '명중·회피·치명타', con: '최대 HP·방어', int: '최대 MP', wis: 'MP 회복' };
export class CharacterWin extends Win {
  constructor(ui) {
    super(ui, 'character', { title: '능력치', cls: 'charwin', place: () => ({ x: 16, y: 70 }), events: ['stats:changed', 'player:levelup', 'player:exp', 'player:class', 'inventory:changed'] });
  }
  render() {
    const g = this.game, s = g.state, p = g.player;
    if (!s) return;
    const cls = s.cls ? (g.data.classes[s.cls]?.name ?? s.cls) : (p.ghost ? '혼' : '무직');
    const need = this.ui.expNeed(p.level);
    const atk = Array.isArray(p.atk) ? `${p.atk[0]} ~ ${p.atk[1]}` : (p.atk ?? '-');
    const fx = (v, suf = '') => (v == null ? '-' : (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v) + suf);
    const b = this.body;
    b.innerHTML = `
      <div class="top"><div class="pf"></div><div><div class="nm">${esc(p.name)}</div><div class="cls">${esc(cls)} · Lv ${p.level}</div>
        <div class="cls">${Number.isFinite(need) && p.level < 30 ? `경험치 ${fmtNum(p.exp ?? 0)} / ${fmtNum(need)}` : '경험치 MAX'}</div><div class="cls">${esc(chapterName(s.chapter))}</div></div></div>
      <div class="sec-title">기본 능력</div>
      <div class="pts ${s.statPoints > 0 ? 'glow' : ''}">${s.statPoints > 0 ? `분배할 능력치: ${s.statPoints}` : '&nbsp;'}</div>
      <table class="stat-table">${['str', 'dex', 'con', 'int', 'wis'].map((k) => `<tr><td class="k">${STAT_NAME[k]}<div class="desc">${STAT_DESC[k]}</div></td>
        <td class="v">${p.stats?.[k] ?? p.base?.[k] ?? 0}${(p.stats?.[k] ?? 0) > (p.base?.[k] ?? 0) ? ` <small>(기본 ${p.base[k]})</small>` : ''}</td>
        <td class="p">${s.statPoints > 0 ? `<button class="btn sm plus" data-k="${k}">+</button>` : ''}</td></tr>`).join('')}</table>
      <div class="sec-title" style="margin-top:10px">전투 능력</div>
      <div class="two-col">
        <div>생명력<b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div><div>마력<b>${Math.floor(p.mp)} / ${p.maxMp}</b></div>
        <div>공격력<b>${atk}</b></div><div>방어력<b>${fx(p.def)}</b></div>
        <div>명중<b>${fx(p.hit)}</b></div><div>회피<b>${fx(p.eva)}</b></div>
        <div>치명타<b>${p.crit == null ? '-' : (p.crit <= 1 ? (p.crit * 100).toFixed(1) : p.crit) + '%'}</b></div><div>이동 속도<b>${fx(p.speed * (p.speedMul ?? 1))}</b></div>
      </div>
      <div class="note">플레이 시간 ${playTime(s.playTime)}</div>`;
    b.querySelector('.pf').appendChild(portraitCanvas(g, p.look, 64));
    b.querySelectorAll('.plus').forEach((bt) => bt.addEventListener('click', () => {
      g.systems.stats?.allocate?.(bt.dataset.k);
      g.bus.emit('sound', { id: 'ui_click' });
      this.dirty = true;
    }));
  }
}
function chapterName(c) { return ['프롤로그 — 귀혼의 서', '제1장 — 돌아온 자', '제2장 — 묘지기의 노래', '제3장 — 황혼의 탑', '종장 이후 — 경계를 지키는 자'][c ?? 0] ?? ''; }
function playTime(t) { const m = Math.floor((t ?? 0) / 60); return `${Math.floor(m / 60)}시간 ${m % 60}분`; }

// ── 의뢰 일지 ──
export class QuestWin extends Win {
  constructor(ui) {
    super(ui, 'quests', { title: '의뢰 일지', events: ['quest:started', 'quest:updated', 'quest:ready', 'quest:completed', 'inventory:changed'] });
    this.sel = null;
  }
  render() {
    const g = this.game, s = g.state, Q = g.data.quests;
    if (!s) return;
    const ids = Object.keys(s.quests).sort((a, b) => (s.quests[a].state === 'done') - (s.quests[b].state === 'done') || (Q[b]?.main ? 1 : 0) - (Q[a]?.main ? 1 : 0));
    if (!this.sel || !ids.includes(this.sel)) this.sel = ids[0] ?? null;
    const b = this.body;
    b.innerHTML = '<div class="questwin"><div class="ql"></div><div class="qd"></div></div>';
    const ql = b.querySelector('.ql'), qd = b.querySelector('.qd');
    if (!ids.length) { ql.innerHTML = '<div class="empty">받은 의뢰가 없다.</div>'; qd.innerHTML = '<div class="empty">마을 사람들의 이야기에 귀 기울여 보자.</div>'; return; }
    for (const id of ids) {
      const st = g.systems.quests?.stateOf?.(id) ?? s.quests[id].state;
      const d = el('div', `qi${id === this.sel ? ' sel' : ''}${st === 'done' ? ' done' : ''}`, `${Q[id]?.main ? '◆ ' : ''}${esc(Q[id]?.name ?? id)}${st === 'ready' ? '<span class="st">완료 가능</span>' : ''}`);
      d.addEventListener('click', () => { this.sel = id; this.render(); g.bus.emit('sound', { id: 'ui_click' }); });
      ql.appendChild(d);
    }
    const id = this.sel, d = Q[id] ?? { name: id }, qs = s.quests[id];
    const st = g.systems.quests?.stateOf?.(id) ?? qs.state;
    const sysObjs = g.systems.quests?.objectives?.(id);
    const objs = (d.objectives || []).map((o, i) => {
      const so = sysObjs?.[i];
      const have = so ? so.have : o.type === 'item' ? (g.systems.inventory?.count?.(o.target) ?? 0) : o.type === 'flag' ? (s.flags[o.target] ? 1 : 0) : (qs.progress?.[i] ?? 0);
      const need = so?.need ?? o.count ?? 1;
      const ok = st === 'done' || so?.done || have >= need;
      return `<div class="obj${ok ? ' ok' : ''}">${ok ? '✔' : '·'} ${esc(o.text ?? o.target)}${need > 1 ? ` (${Math.min(have, need)}/${need})` : ''}</div>`;
    }).join('');
    const rw = d.rewards || {};
    const rws = [rw.exp ? `경험치 ${fmtNum(rw.exp)}` : '', rw.gold ? `${fmtNum(rw.gold)} 골드` : '', ...(rw.items || []).map((it) => `${g.data.items[it.id]?.name ?? it.id}${it.qty > 1 ? ` ×${it.qty}` : ''}`)].filter(Boolean);
    const giver = d.giver ? g.data.npcs[d.giver]?.name : '';
    qd.innerHTML = `<h3>${esc(d.name)}</h3>${giver ? `<div class="giver">의뢰인: ${esc(giver)}${d.chapter != null ? ` · ${esc(chapterName(d.chapter))}` : ''}</div>` : ''}
      <p>${esc(d.desc ?? '')}</p><div class="sec-title">목표</div>${objs || '<div class="obj">-</div>'}
      ${st === 'ready' ? '<div class="obj ok" style="margin-top:6px">→ 의뢰인에게 돌아가 보고하자.</div>' : ''}
      ${rws.length ? `<div class="rw">보상: ${esc(rws.join(', '))}</div>` : ''}`;
  }
}

// ── 지도 ──
export class MapWin extends Win {
  constructor(ui) {
    super(ui, 'map', { title: '지도', cls: 'mapwin', bodyCls: 'iron-in', live: true, events: ['map:loaded'] });
    this.t = 0; this.acc = 1;
  }
  render() {
    const b = this.body;
    b.innerHTML = `<div class="mt">${esc(this.game.world.map?.name ?? '')}</div>
      <canvas width="640" height="420"></canvas>
      <div class="legend"><span><i style="background:#fff"></i>나</span><span><i style="background:#ffe14a"></i>인물</span><span><i style="background:#e8383a"></i>적</span><span><i style="background:#ff8a2a"></i>강적</span><span><i style="background:#b08aff"></i>출입구</span></div>`;
    this.cv = b.querySelector('canvas');
    this.acc = 1;
  }
  tick(dt) {
    this.t += dt; this.acc += dt;
    if (this.acc < 0.2 || !this.cv) return;
    this.acc = 0;
    drawFullMap(this.game, this.cv, this.t);
  }
}
