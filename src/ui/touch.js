// 터치 조작 오버레이(소유: 워커 C). #ui-root.touch 일 때만 보인다.
//  왼쪽 아래: 가상 조이스틱 → input.setVirtualDir(sx, sy) (놓으면 (0,0))
//  오른쪽 아래: 공격(누르는 동안 Space) + 기술 1~6(Digit1~6) + 대상(Tab)
//  가운데 아래(세로 화면은 조이스틱 위): 상호작용(F, 근처에 인물/물건이 있으면 강조) + 물약(단축키 7~0)
//  멀티터치: 컨트롤마다 pointerId 를 따로 추적하고 window 에서 move/up 을 받는다 → 조이스틱을 잡은 채 공격 가능.
//  길게 누르기(0.5초): 기술/물약 설명 상자.
import { el, iconCanvas } from './dom.js';
import { pixelArt } from './cursor.js';
import { hotbarSheet } from './mobile.js';

const LONG_MS = 500;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export class TouchPad {
  constructor(hud) {
    this.hud = hud; this.ui = hud.ui; this.game = hud.game;
    this.held = new Map(); // pointerId → {code, elm}
    this.joyId = null; this.root = null;
    this.acc = 0; this.potKey = ''; this.pots = [];
    this.onMove = (e) => { if (e.pointerId === this.joyId) this.joyMove(e); };
    this.onUp = (e) => this.pointerUp(e);
  }

  build(parent) {
    const r = this.root = el('div');
    r.id = 'tpad';
    r.innerHTML = `
      <div class="joy-zone"><div class="joy iron"><div class="well"></div>
        <i class="ar u">▲</i><i class="ar d">▼</i><i class="ar l">◀</i><i class="ar r">▶</i><div class="knob"></div></div></div>
      <div class="tcl"></div>
      <div class="tutil"></div>`;
    this.$zone = r.querySelector('.joy-zone'); this.$joy = r.querySelector('.joy'); this.$knob = r.querySelector('.knob');
    this.$ar = { u: r.querySelector('.ar.u'), d: r.querySelector('.ar.d'), l: r.querySelector('.ar.l'), r: r.querySelector('.ar.r') };
    this.$zone.addEventListener('pointerdown', (e) => this.joyStart(e));
    // 오른쪽 묶음
    const tcl = this.$tcl = r.querySelector('.tcl');
    this.$atk = this.button(tcl, 'tb atk', 'Space');
    this.$atk.append(pixelArt('attack', 2), el('span', 'lbl', '공격'));
    this.$skills = [0, 1, 2, 3, 4, 5].map((i) => {
      const b = this.button(tcl, 'tb sk', `Digit${i + 1}`, () => hotbarSheet(this.ui, b, i), () => !this.game.state?.hotbar[i]);
      b.dataset.i = i;
      return b;
    });
    this.$tgt = this.button(tcl, 'tb tgt', 'Tab');
    this.$tgt.innerHTML = '<span class="lbl">대상</span><span class="k2">Tab</span>';
    // 상호작용 + 물약
    const ut = r.querySelector('.tutil');
    this.$f = this.button(ut, 'tb act dim', 'KeyF');
    this.$f.innerHTML = '<span class="lbl">조사</span><span class="k2">F</span>';
    this.$pots = [0, 1].map((k) => {
      const b = this.button(ut, 'tb pot hidden', null, () => { const p = this.pots[k]; if (p?.slot != null) hotbarSheet(this.ui, b, p.slot); });
      b.dataset.k = k;
      return b;
    });
    parent.appendChild(r);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    this.layout();
    this.refresh();
  }

  destroy() {
    this.reset();
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.root?.remove(); this.root = null;
  }

  // 이 패드가 누른 입력만 해제 (키보드 입력은 건드리지 않음)
  reset() {
    const inp = this.game.input;
    for (const { code, elm } of this.held.values()) { if (code) inp.release(code); elm.classList.remove('on'); clearTimeout(elm._lt); }
    this.held.clear();
    if (this.joyId != null) { this.joyId = null; inp.setVirtualDir(0, 0); this.knob(0, 0); }
  }

  // ── 버튼 ──
  // code: 누르는 동안 유지할 가상 키(null 이면 onPress 직접 처리), onLong: 길게 누르기, tapInfo(): true 면 누르기 대신 설명 상자
  button(parent, cls, code, onLong, tapInfo) {
    const b = el('div', cls);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 */ }
      this.game.input.setTouchMode?.(true);
      if (tapInfo?.()) { onLong?.(); return; }
      b.classList.add('on');
      const c = code ?? null;
      this.held.set(e.pointerId, { code: c, elm: b });
      if (c) this.game.input.press(c);
      else this.potPress(+b.dataset.k);
      if (onLong) { clearTimeout(b._lt); b._lt = setTimeout(() => { if ([...this.held.values()].some((h) => h.elm === b)) onLong(); }, LONG_MS); }
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    parent.appendChild(b);
    return b;
  }

  pointerUp(e) {
    if (e.pointerId === this.joyId) { this.joyEnd(); return; }
    const h = this.held.get(e.pointerId);
    if (!h) return;
    this.held.delete(e.pointerId);
    if (h.code) this.game.input.release(h.code);
    h.elm.classList.remove('on');
    clearTimeout(h.elm._lt);
  }

  potPress(k) {
    const p = this.pots[k], g = this.game;
    if (!p) return;
    if (p.slot != null) { const code = p.slot === 9 ? 'Digit0' : `Digit${p.slot + 1}`; g.input.press(code); g.input.release(code); }
    else if (p.inv != null) g.systems.inventory?.useSlot?.(p.inv);
  }

  // ── 조이스틱 ──
  joyStart(e) {
    e.preventDefault(); e.stopPropagation();
    if (this.joyId != null) return;
    this.joyId = e.pointerId;
    try { this.$zone.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 */ }
    this.game.input.setTouchMode?.(true);
    this.$joy.classList.add('on');
    this.joyMove(e);
  }
  joyMove(e) {
    const r = this.$joy.getBoundingClientRect();
    const R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / (R * 0.8), dy = (e.clientY - (r.top + R)) / (R * 0.8);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    this.game.input.setVirtualDir(dx, dy);
    this.knob(dx * R * 0.55, dy * R * 0.55);
    const v = this.game.input.virtualDir, t = 0.38;
    this.$ar.u.classList.toggle('on', !!v && v.sy < -t); this.$ar.d.classList.toggle('on', !!v && v.sy > t);
    this.$ar.l.classList.toggle('on', !!v && v.sx < -t); this.$ar.r.classList.toggle('on', !!v && v.sx > t);
  }
  joyEnd() {
    this.joyId = null;
    this.game.input.setVirtualDir(0, 0);
    this.knob(0, 0);
    this.$joy.classList.remove('on');
    for (const a of Object.values(this.$ar)) a.classList.remove('on');
  }
  knob(x, y) { this.$knob.style.transform = `translate(${Math.round(x / 2) * 2}px, ${Math.round(y / 2) * 2}px)`; } // 2px 도트 단위

  // ── 배치: 공격 버튼을 중심으로 기술 두 겹 부채꼴 ──
  layout() {
    if (!this.root) return;
    const short = this.ui.root.classList.contains('short');
    const A = short ? 64 : 72, b1 = short ? 42 : 46, b2 = short ? 40 : 42, R1 = short ? 72 : 80, R2 = short ? 120 : 132;
    const c = A / 2 + 2;
    const box = Math.ceil(c + R2 + b2 / 2 + 2);
    const tcl = this.$tcl;
    tcl.style.width = tcl.style.height = box + 'px';
    const put = (elm, deg, R, s) => {
      const a = deg * Math.PI / 180, x = box - c + R * Math.cos(a), y = box - c - R * Math.sin(a);
      Object.assign(elm.style, { left: Math.round(x - s / 2) + 'px', top: Math.round(y - s / 2) + 'px', width: s + 'px', height: s + 'px' });
      elm._s = s;
    };
    put(this.$atk, 0, 0, A);
    [180, 135, 90].forEach((d, i) => put(this.$skills[i], d, R1, b1));
    [180, 150, 120].forEach((d, i) => put(this.$skills[i + 3], d, R2, b2));
    put(this.$tgt, 90, R2, b2);
    const joy = short ? 104 : 116;
    this.ui.root.style.setProperty('--joy', joy + 'px');
    this.refresh();
  }

  // ── 내용 갱신 (단축키/가방 변경 시) ──
  refresh() {
    if (!this.root || !this.game.state) return;
    const g = this.game, s = g.state;
    this.$skills.forEach((b, i) => {
      const h = s.hotbar[i];
      b.querySelectorAll('canvas,.cd,.cdt,.k').forEach((x) => x.remove());
      b._cd = null; b._cdk = -1;
      b.classList.toggle('empty', !h);
      b.classList.remove('nomp');
      b.appendChild(el('span', 'k', String(i + 1)));
      if (!h) return;
      const sz = (b._s ?? 44) - 6;
      b.insertBefore(typeof h === 'string' ? iconCanvas(g, 'skill', h, sz) : iconCanvas(g, 'item', h.item, sz), b.firstChild);
      b.classList.toggle('dim', typeof h === 'string' ? !s.skills.includes(h) : !(g.systems.inventory?.count?.(h.item) > 0));
      b._cd = el('div', 'cd'); b._cdt = el('div', 'cdt');
      b.append(b._cd, b._cdt);
    });
    this.potKey = '';
    this.refreshPots();
  }

  // 물약 버튼: 단축키 7~0 의 물건 최대 2개, 없으면 가방의 첫 회복 물약
  potEntries() {
    const g = this.game, s = g.state, out = [];
    for (let j = 6; j < 10 && out.length < 2; j++) { const h = s.hotbar[j]; if (h && typeof h === 'object') out.push({ slot: j, item: h.item }); }
    if (!out.length) {
      const i = s.inventory.findIndex((it) => it && g.data.items[it.id]?.use?.heal);
      if (i >= 0) out.push({ inv: i, item: s.inventory[i].id });
    }
    return out;
  }
  refreshPots() {
    const g = this.game, inv = g.systems.inventory;
    const pots = this.potEntries();
    const key = pots.map((p) => `${p.slot ?? 'i' + p.inv}:${p.item}:${inv?.count?.(p.item) ?? 0}`).join(',');
    if (key === this.potKey) return;
    this.potKey = key; this.pots = pots;
    this.$pots.forEach((b, k) => {
      const p = pots[k];
      b.classList.toggle('hidden', !p);
      b.innerHTML = '';
      b._cd = null; b._cdk = -1;
      if (!p) return;
      const n = inv?.count?.(p.item) ?? 0;
      b.classList.toggle('dim', !n);
      b.append(iconCanvas(g, 'item', p.item, 38), el('span', 'qty', String(n)));
      if (p.slot != null) b.appendChild(el('span', 'k', String((p.slot + 1) % 10)));
      b._cd = el('div', 'cd'); b._cdt = el('div', 'cdt');
      b.append(b._cd, b._cdt);
    });
  }

  // ── 매 프레임 ──
  update(dt) {
    if (!this.root || !this.ui.mobile?.on) return;
    const g = this.game, ui = this.ui, p = g.player, s = g.state;
    const blocked = g.dialog.isOpen || ui.dialogBox.open || ui.ending.active || ui.menu.isOpen || ui.modals.length > 0 || ui.windows.shop.isOpen || g.cutscene;
    this.root.classList.toggle('off', !!blocked);
    if (blocked) return;
    // 쿨다운
    const cd = (b, h) => {
      if (!b._cd || !h) return;
      const { pct, left } = this.hud.cdOf(h);
      const key = left > 0 ? Math.ceil(left * 10) : 0;
      if (b._cdk === key) return;
      b._cdk = key;
      b._cd.style.height = pct > 0 ? Math.ceil(pct * 16) / 16 * 100 + '%' : '0';
      b._cdt.textContent = left > 0 ? (left >= 1 ? Math.ceil(left) : left.toFixed(1)) : '';
    };
    this.$skills.forEach((b, i) => {
      const h = s.hotbar[i];
      cd(b, h);
      if (typeof h === 'string') b.classList.toggle('nomp', (g.data.skills[h]?.mp ?? 0) > p.mp);
    });
    this.$pots.forEach((b, k) => { const e = this.pots[k]; if (e) cd(b, { item: e.item }); });
    // 0.2초마다: 상호작용 강조, 물약 수량, 패널 높이
    this.acc -= dt;
    if (this.acc > 0) return;
    this.acc = 0.2;
    let near = null;
    for (const e of g.world.entities) {
      if (e === p || (e.kind !== 'npc' && e.kind !== 'drop') || cheb(e, p) > 1) continue;
      if (!near || e.kind === 'drop') near = e;
    }
    const lbl = near ? (near.kind === 'drop' ? '줍기' : '대화') : '조사';
    if (this.$f._l !== lbl) { this.$f._l = lbl; this.$f.querySelector('.lbl').textContent = lbl; }
    this.$f.classList.toggle('hl', !!near); this.$f.classList.toggle('dim', !near);
    this.refreshPots();
    ui.mobile.syncBar();
  }
}
