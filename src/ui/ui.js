// UI 진입점. 소유: 워커 C. 공개 API(docs/ARCHITECTURE.md §8): showTitle, hideTitle, showHud, isBlocking, update.
// 구성: 타이틀/캐릭터 생성, HUD(하단 바·채팅·미니맵·추적), 대화창, 창(가방·기술·능력치·일지·지도·상점), 시스템 메뉴, 엔딩, 커서.
import { el } from './dom.js';
import { TitleScreen } from './title.js';
import { Hud } from './hud.js';
import { DialogBox } from './dialogbox.js';
import { InventoryWin, SkillsWin, CharacterWin, QuestWin, MapWin } from './panels.js';
import { ShopWin } from './shop.js';
import { SystemMenu, makeModal } from './menu.js';
import { Ending } from './ending.js';
import { CursorCtl } from './cursor.js';
import { applySkin } from './skin.js';
import { MobileCtl, ActionSheet } from './mobile.js';

const WIN_KEYS = { KeyI: 'inventory', KeyK: 'skills', KeyC: 'character', KeyJ: 'quests', KeyM: 'map' };

export class UI {
  constructor(game, root) {
    this.game = game; this.root = root;
    root.innerHTML = '';
    applySkin(root); // 도트 노이즈 텍스처(--tx-*) 생성
    // 헤드리스 검증(스크린샷)에선 CSS 애니메이션 시계가 멈춰 첫 프레임(투명)으로 찍힌다 → 애니메이션 끄기
    this.noAnim = /Headless/i.test(navigator.userAgent) || new URLSearchParams(location.search).has('noanim');
    if (this.noAnim) root.classList.add('noanim');
    this.layer = el('div'); this.layer.id = 'win-layer';
    this.modals = [];
    this.tip = new Tooltip(root);
    this.mobile = new MobileCtl(this); // 터치 모드·화면 크기 클래스·전체화면 (src/ui/mobile.js)
    this.sheet = new ActionSheet(this);
    this.drag = new DragManager(this);
    this.title = new TitleScreen(this);
    this.hud = new Hud(this);
    root.appendChild(this.layer);
    this.dialogBox = new DialogBox(this);
    this.windows = {
      inventory: new InventoryWin(this), skills: new SkillsWin(this), character: new CharacterWin(this),
      quests: new QuestWin(this), map: new MapWin(this), shop: new ShopWin(this),
    };
    this.menu = new SystemMenu(this);
    this.ending = new Ending(this);
    this.cursor = new CursorCtl(game);
    const b = game.bus;
    b.on('game:new', () => this.onGameStart());
    b.on('game:loaded', () => this.onGameStart());
    b.on('item:used', ({ id }) => { if (game.data.items[id]?.use) b.emit('sound', { id: 'potion' }); });
    window.addEventListener('resize', () => { for (const w of Object.values(this.windows)) if (w.isOpen) w.place(); });
  }

  // ── 공개 API ──
  showTitle(opts = {}) {
    this.hud.destroy();
    this.closeAll();
    this.title.show({ canContinue: !!opts.canContinue });
  }
  hideTitle() { this.title.hide(); }
  showHud() {
    this.title.hide();
    this.hud.build();
    this.hud.refreshAll();
    this.runDebugQuery();
  }
  isBlocking() {
    return this.hud.chatOpen || this.menu.isOpen || this.modals.length > 0 || this.ending.active || this.windows.shop.isOpen;
  }
  update(dt) {
    const g = this.game;
    this.cursor.update(dt);
    if (g.scene !== 'play' || !g.state) return;
    this.mobile.update(dt);
    this.dialogBox.update(dt);
    this.ending.update(dt);
    this.hud.update(dt);
    for (const w of Object.values(this.windows)) w.update(dt);
    this.handleKeys();
  }

  handleKeys() {
    const g = this.game, inp = g.input;
    if (this.ending.active) return;
    if (inp.pressed('Escape')) return this.escape();
    if (g.dialog.isOpen || this.menu.isOpen || this.modals.length) return;
    for (const [code, id] of Object.entries(WIN_KEYS)) if (inp.pressed(code)) this.toggleWindow(id);
    if ((inp.pressed('Enter') || inp.pressed('NumpadEnter')) && !this.hud.chatOpen) this.hud.openChat();
  }
  escape() {
    if (this.drag.cancel()) return;
    if (this.sheet.isOpen) { this.sheet.close(); return; }
    if (this.modals.length) { this.modals[this.modals.length - 1](); return; }
    if (this.menu.isOpen) { this.menu.close(); return; }
    if (this.game.dialog.isOpen) return;
    const open = [...this.layer.querySelectorAll('.win')];
    if (open.length) {
      const top = open[open.length - 1];
      Object.values(this.windows).find((w) => w.root === top)?.close();
      return;
    }
    this.menu.open();
  }

  // ── 창/모달 ──
  toggleWindow(id) {
    const w = this.windows[id];
    if (!w || !this.game.state) return;
    w.toggle();
  }
  toggleMenu() { this.menu.toggle(); }
  closeAll() {
    for (const w of Object.values(this.windows)) w.close();
    this.menu.close();
    while (this.modals.length) this.modals[this.modals.length - 1]();
    this.tip.hide();
    this.sheet?.close();
  }
  modal(title, html) { return makeModal(this, title, html); }
  confirm(text, onYes) { return makeModal(this, '확인', `<p style="text-align:center;line-height:1.7">${text}</p>`, [['예', onYes], ['아니오', null]]); }
  toast(text, kind) { this.hud.toast(text, kind); }

  onGameStart() {
    this.closeAll();
    this.dialogBox.hide();
    this.hud.chatLines.length = 0;
    if (this.hud.root) { this.hud.$.chatLog.innerHTML = ''; this.hud.refreshAll(); }
    const s = this.game.state;
    for (const id of s?.skills ?? []) this.autoHotbarSkill(id);
  }

  // ── 게임 연동 헬퍼 ──
  expNeed(level) {
    let n = null;
    try { n = this.game.systems.stats?.expToNext?.(level); } catch { n = null; }
    return n > 0 ? n : Math.round(40 * Math.pow(level, 1.85));
  }
  useItem(i) {
    const g = this.game, it = g.state.inventory[i];
    if (!it) return;
    const d = g.data.items[it.id];
    const inv = g.systems.inventory;
    if (!d) return;
    if (d.type === 'consumable') inv?.useSlot?.(i);
    else if (['weapon', 'armor', 'shield', 'helm', 'ring', 'amulet', 'boots'].includes(d.type)) {
      if (d.level && g.player.level < d.level) { this.toast(`레벨 ${d.level} 이상이어야 장착할 수 있다.`); return; }
      inv?.equip?.(i);
      g.bus.emit('sound', { id: 'ui_click' });
    } else g.log(`${d.name}: ${d.desc ?? '지금은 쓸 수 없는 물건이다.'}`, 'system');
  }
  unequip(slot) {
    const g = this.game;
    if (!g.state.equipment[slot]) return;
    if (!g.state.inventory.some((x) => !x)) { this.toast('가방에 빈 자리가 없다.'); return; }
    g.systems.inventory?.unequip?.(slot);
    g.bus.emit('sound', { id: 'ui_click' });
  }
  setHotbar(i, v) {
    const sk = this.game.systems.skills;
    if (sk?.setHotbar) return sk.setHotbar(i, v);
    const hb = this.game.state.hotbar;
    if (v) for (let j = 0; j < hb.length; j++) if (j !== i && sameHot(hb[j], v)) hb[j] = null;
    hb[i] = v;
    this.game.bus.emit('hotbar:changed', {});
  }
  autoHotbarSkill(id, announce = false) {
    const hb = this.game.state?.hotbar;
    if (!hb || hb.includes(id)) return;
    const i = hb.findIndex((x) => !x);
    if (i < 0 || i >= 8) { if (announce) this.toast('단축키 빈 칸이 없다.'); return; }
    this.setHotbar(i, id);
  }
  autoHotbarItem(id) {
    const hb = this.game.state?.hotbar;
    if (!hb || hb.some((x) => x?.item === id)) return;
    for (let i = 9; i >= 6; i--) if (!hb[i]) { this.setHotbar(i, { item: id }); return; }
  }

  // 드래그 결과 처리. spec: 'inv:i' | 'eq:slot' | 'hot:i' | null, overWorld: 캔버스 위에서 놓았는가
  handleDrop(pl, spec, overWorld) {
    const g = this.game, s = g.state, inv = g.systems.inventory;
    const [kind, arg] = spec ? spec.split(':') : [null, null];
    const items = g.data.items;
    if (!kind) {
      if (pl.type === 'hot') this.setHotbar(pl.slot, null);
      else if (pl.type === 'item' && overWorld) {
        const it = s.inventory[pl.slot];
        const d = it && items[it.id];
        if (!d) return;
        if (d.type === 'quest') { this.toast('중요한 물건은 버릴 수 없다.'); return; }
        this.confirm(`${d.name}${it.qty > 1 ? ` ×${it.qty}` : ''}을(를) 땅에 버릴까요?`, () => {
          const cur = s.inventory[pl.slot];
          if (!cur || cur.id !== it.id) return;
          if (inv?.discard) inv.discard(pl.slot, cur.qty);
          else if (inv?.remove?.(cur.id, cur.qty) !== false) inv?.dropItem?.(g.player.x, g.player.y, cur.id, cur.qty);
        });
      }
      return;
    }
    if (kind === 'inv') {
      const j = +arg;
      if (pl.type === 'item' && pl.slot !== j) {
        if (inv?.swap) inv.swap(pl.slot, j);
        else {
          const a = s.inventory;
          [a[pl.slot], a[j]] = [a[j], a[pl.slot]];
          g.bus.emit('inventory:changed', {});
        }
      } else if (pl.type === 'equip') this.unequip(pl.slot);
    } else if (kind === 'eq') {
      if (pl.type !== 'item') return;
      const it = s.inventory[pl.slot], d = it && items[it.id];
      if (!d) return;
      if (d.type !== arg) { this.toast('그 자리에 맞지 않는 물건이다.'); return; }
      this.useItem(pl.slot);
    } else if (kind === 'hot') {
      const j = +arg;
      if (pl.type === 'skill') this.setHotbar(j, pl.id);
      else if (pl.type === 'item') {
        const it = s.inventory[pl.slot];
        if (!it) return;
        if (items[it.id]?.type !== 'consumable') { this.toast('단축키에는 기술과 소모품만 등록할 수 있다.'); return; }
        this.setHotbar(j, { item: it.id });
      } else if (pl.type === 'hot' && pl.slot !== j) {
        const hb = s.hotbar;
        [hb[pl.slot], hb[j]] = [hb[j], hb[pl.slot]];
        g.bus.emit('hotbar:changed', {});
      }
    }
  }

  // 디버그: ?uiopen=inventory,skills&uitest=dialog|ending|chapter|levelup|death|menu|shop:smithy|notice
  runDebugQuery() {
    if (this.debugDone) return;
    this.debugDone = true;
    const q = new URLSearchParams(location.search), g = this.game;
    const t = q.get('uitest');
    setTimeout(() => {
      for (const id of (q.get('uiopen') || '').split(',').filter(Boolean)) this.windows[id]?.open();
      if (!t) return;
      if (t === 'dialog') g.bus.emit('dialog:show', { speaker: '기록자 세린', portrait: { body: 'human', gender: 'f', hair: 3, hairColor: '#c8c8d0', skin: '#f4d6b8', robe: '#4a4a7a' }, text: '눈을 떴구려. 그대의 이름은 반쯤 지워져 있소… 이곳은 망각의 묘원, 산 자와 죽은 자의 경계라오.', options: [{ text: '여긴… 어디지?' }, { text: '내 이름이 뭐지?' }, { text: '(말없이 고개를 끄덕인다)' }], hasNext: false });
      if (t === 'ending') g.bus.emit('game:ending', { id: 'main' });
      if (t === 'chapter') g.bus.emit('ui:chapter', { title: '제1장 — 돌아온 자', sub: '로엔의 종이 다시 울린다' });
      if (t === 'levelup') g.bus.emit('player:levelup', { level: 2 });
      if (t === 'death') g.bus.emit('player:dead', {});
      if (t === 'notice') g.bus.emit('ui:notice', { text: '기억의 조각을 되찾았다', sub: '육신의 기억 (1/3)' });
      if (t === 'menu') this.menu.open();
      if (t.startsWith('shop:')) g.bus.emit('shop:open', { shopId: t.slice(5), npc: null });
    }, 300);
  }
}

function sameHot(a, b) {
  if (!a || !b) return false;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.item === b.item;
}

// ── 툴팁 ──
class Tooltip {
  constructor(root) {
    this.root = root;
    this.box = el('div'); this.box.id = 'tooltip'; this.box.classList.add('hidden');
    root.appendChild(this.box);
    this.src = null; this.fn = null;
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.move(e.clientX, e.clientY); });
    // 터치: 탭하면 보이고, 다른 곳을 누르거나 4초 뒤 사라진다
    window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && this.src && !this.src.contains(e.target)) this.hide(); }, true);
  }
  bind(elm, fn) {
    elm.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; this.src = elm; this.fn = fn; this.refresh(); this.move(e.clientX, e.clientY); });
    elm.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && this.src === elm) this.hide(); });
    elm.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') elm._tp = { x: e.clientX, y: e.clientY }; });
    elm.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' || !elm._tp || Math.hypot(e.clientX - elm._tp.x, e.clientY - elm._tp.y) > 8) return;
      this.src = elm; this.fn = fn; this.refresh();
      this.anchorTo(elm);
      clearTimeout(this.tt); this.tt = setTimeout(() => { if (this.src === elm) this.hide(); }, 4000);
    });
  }
  // 터치용: 요소 위(공간이 없으면 아래)에 띄운다
  anchorTo(elm) {
    if (this.box.classList.contains('hidden')) return;
    const r = elm.getBoundingClientRect(), w = this.box.offsetWidth, h = this.box.offsetHeight;
    let x = (r.left + r.right) / 2 - w / 2, y = r.top - h - 8;
    if (y < 4) y = r.bottom + 8;
    this.box.style.left = Math.round(Math.max(4, Math.min(window.innerWidth - w - 4, x))) + 'px';
    this.box.style.top = Math.round(Math.max(4, Math.min(window.innerHeight - h - 4, y))) + 'px';
  }
  refresh() {
    if (!this.fn || !this.src?.isConnected) return this.hide();
    let h = null;
    try { h = this.fn(); } catch (e) { console.warn('툴팁 오류', e); }
    if (!h) { this.box.classList.add('hidden'); return; }
    this.box.innerHTML = h;
    this.box.classList.remove('hidden');
    this.root.appendChild(this.box); // 항상 맨 위
  }
  move(x, y) {
    if (this.box.classList.contains('hidden')) return;
    if (this.src && !this.src.isConnected) return this.hide();
    const w = this.box.offsetWidth, h = this.box.offsetHeight;
    let tx = x + 16, ty = y + 18;
    if (tx + w > window.innerWidth - 4) tx = x - w - 12;
    if (ty + h > window.innerHeight - 4) ty = y - h - 12;
    this.box.style.left = Math.max(4, tx) + 'px'; this.box.style.top = Math.max(4, ty) + 'px';
  }
  hide() { this.src = null; this.fn = null; this.box.classList.add('hidden'); }
}

// ── 드래그 앤 드롭 (포인터 이벤트 기반: 클릭과 드래그를 구분) ──
class DragManager {
  constructor(ui) { this.ui = ui; this.cur = null; }
  // opts: {icon()->canvas, onClick(), onRight(), onTap(elm) 터치 탭, onLong() 터치 길게 누르기}
  bind(elm, getPayload, opts = {}) {
    elm.addEventListener('contextmenu', (e) => { e.preventDefault(); if (performance.now() - (elm._touchT ?? -1e9) > 1500) opts.onRight?.(); });
    elm.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const touch = e.pointerType !== 'mouse';
      const pl = getPayload();
      const start = { x: e.clientX, y: e.clientY };
      let ghost = null, longDone = false, lt = 0;
      if (touch) {
        elm._touchT = performance.now();
        if (opts.onLong && pl) lt = setTimeout(() => { longDone = true; this.ui.tip.hide(); opts.onLong(); }, 500);
      }
      const mv = (ev) => {
        if (!pl || longDone || ev.pointerId !== e.pointerId) return;
        if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > (touch ? 10 : 5)) {
          clearTimeout(lt);
          ghost = el('div'); ghost.id = 'drag-ghost';
          const ic = opts.icon?.();
          if (ic) ghost.appendChild(ic);
          this.ui.root.appendChild(ghost);
          this.ui.tip.hide();
          this.cur = { cancel: () => { cleanup(); } };
        }
        if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; this.highlight(ev.clientX, ev.clientY); }
      };
      const cleanup = () => {
        clearTimeout(lt);
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        ghost?.remove(); ghost = null; this.cur = null; this.highlight(-1, -1);
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const dragged = !!ghost;
        cleanup();
        if (ev.type === 'pointercancel' || longDone) return;
        if (!dragged) { if (touch && opts.onTap) opts.onTap(elm); else opts.onClick?.(); return; }
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const drop = t?.closest?.('[data-drop]');
        this.ui.handleDrop(pl, drop?.dataset.drop ?? null, t === this.ui.game.canvas);
        this.ui.game.bus.emit('sound', { id: 'ui_click' });
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  highlight(x, y) {
    const t = x >= 0 ? document.elementFromPoint(x, y)?.closest?.('[data-drop]') : null;
    if (this.hl === t) return;
    this.hl?.classList.remove('drop-ok');
    this.hl = t; t?.classList.add('drop-ok');
  }
  cancel() { if (!this.cur) return false; this.cur.cancel(); return true; }
}
