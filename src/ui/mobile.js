// 모바일·터치 지원(소유: 워커 C).
//  - 터치 모드 판정 → #ui-root.touch  (input.touchMode / 'input:touchmode' 이벤트, ?touch=1 강제 표시 · ?touch=0 강제 숨김)
//  - 화면 크기 클래스 → .small(폭<900 또는 높이<560) .portrait(세로) .short(높이<480)
//  - CSS 변수 --vh(창 높이) --vvh/--vvt(화상 키보드를 뺀 보이는 영역) --bar-h(하단 패널 높이)
//  - 세로 화면 안내(닫기 가능), 전체화면 토글(첫 탭 시 시도, 실패·미지원 무시)
//  - 탭 동작 상자(ActionSheet): 터치에서 드래그 대신 탭 → 설명 + [사용/장착/단축키/버리기] 버튼
import { el, itemTooltipHtml, skillTooltipHtml, EQUIP_SLOTS } from './dom.js';

const FS_KEY = 'duskLegend.fullscreen';
const HINT_KEY = 'duskLegend.rotateHint';

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* 저장소 없음 */ }
  return null;
}

export class MobileCtl {
  constructor(ui) {
    this.ui = ui; this.game = ui.game; this.root = ui.root;
    const q = new URLSearchParams(location.search);
    this.force = q.get('touch'); // '1' | '0' | null
    this.on = false; this.barH = 0;
    this.hintClosed = store(HINT_KEY) === '1';
    this.apply(this.game.input?.touchMode);
    window.addEventListener('input:touchmode', (e) => this.apply(e.detail?.touch));
    // 버튼·창(DOM) 위의 터치도 터치 모드로 본다 — input.js 는 캔버스만 감시
    window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') this.game.input?.setTouchMode?.(true); }, true);
    // 전체화면은 사용자 동작 안에서만 가능: 터치는 pointerup 이 활성화 이벤트
    window.addEventListener('pointerup', (e) => this.firstTouch(e), true);
    const rs = () => this.resize();
    window.addEventListener('resize', rs);
    window.addEventListener('orientationchange', () => setTimeout(rs, 150));
    window.visualViewport?.addEventListener('resize', rs);
    window.visualViewport?.addEventListener('scroll', rs);
    this.resize();
  }

  get compact() { return this.on || this.root.classList.contains('small'); }

  apply(t) {
    const on = this.force === '1' ? true : this.force === '0' ? false : !!t;
    if (on === this.on && this.root.classList.contains('touch') === on) return;
    this.on = on;
    this.root.classList.toggle('touch', on);
    if (!on) this.ui.hud?.pad?.reset();
    this.ui.tip?.hide();
    this.resize();
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight, r = this.root, vv = window.visualViewport;
    r.classList.toggle('small', W < 900 || H < 560);
    r.classList.toggle('portrait', H > W);
    r.classList.toggle('short', H < 480);
    r.style.setProperty('--vh', H + 'px');
    r.style.setProperty('--vvh', Math.round(vv?.height ?? H) + 'px');
    r.style.setProperty('--vvt', Math.round(vv?.offsetTop ?? 0) + 'px');
    this.syncBar();
    this.ui.hud?.pad?.layout();
    this.updateHint();
  }

  // 하단 패널 실제 높이 → --bar-h (터치 컨트롤·대화창·창 배치 기준)
  syncBar() {
    const bar = this.ui.hud?.root?.querySelector('#bar');
    const h = bar ? bar.offsetHeight : 0;
    if (h === this.barH) return;
    this.barH = h;
    this.root.style.setProperty('--bar-h', h + 'px');
  }

  update() {
    this.updateHint();
  }

  // ── 세로 화면 안내 ──
  updateHint() {
    const show = this.on && !this.hintClosed && this.root.classList.contains('portrait') && this.game.scene === 'play' && !!this.ui.hud?.root;
    if (!show) { this.hint?.remove(); this.hint = null; return; }
    if (!this.hint) {
      const h = this.hint = el('div', 'iron pe', '<span>가로로 돌리면 더 넓게 보입니다</span><button class="btn sm">X</button>');
      h.id = 'rotate-hint';
      h.querySelector('button').addEventListener('click', () => { this.hintClosed = true; store(HINT_KEY, '1'); this.updateHint(); });
      this.root.appendChild(h);
    }
    // 창·대화·메뉴가 떠 있으면 가리지 않도록 잠시 숨김
    const ui = this.ui, busy = !!ui.layer.querySelector('.win') || ui.dialogBox?.open || ui.menu?.isOpen || ui.modals.length > 0;
    if (this.hint._busy !== busy) { this.hint._busy = busy; this.hint.classList.toggle('hidden', busy); }
  }

  // ── 전체화면 ──
  fsSupported() {
    const d = document.documentElement;
    return !!(d.requestFullscreen || d.webkitRequestFullscreen) && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true) !== false;
  }
  get fsWanted() {
    const v = store(FS_KEY);
    if (v === '1' || v === '0') return v === '1';
    return window.matchMedia?.('(pointer: coarse)').matches ?? false; // 기본: 휴대폰·태블릿만 켬
  }
  set fsWanted(v) { store(FS_KEY, v ? '1' : '0'); }
  isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  enterFs() {
    try {
      const d = document.documentElement, fn = d.requestFullscreen || d.webkitRequestFullscreen;
      const p = fn?.call(d, { navigationUI: 'hide' });
      p?.catch?.(() => {});
    } catch { /* iOS 등 미지원 */ }
  }
  exitFs() {
    try { const p = (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); p?.catch?.(() => {}); } catch { /* 무시 */ }
  }
  firstTouch(e) {
    if (this.fsTried || e.pointerType === 'mouse') return;
    this.fsTried = true;
    if (this.fsWanted && this.fsSupported() && !this.isFs()) this.enterFs();
  }
  toggleFs() {
    const want = !this.isFs();
    this.fsWanted = want;
    if (want) this.enterFs(); else this.exitFs();
    return want;
  }
}

// ── 탭 동작 상자 ──
// actions: [{label, fn, cls}] 또는 {label, row:[{label, fn}]} (번호 선택 줄: 단축키 칸 고르기)
export class ActionSheet {
  constructor(ui) {
    this.ui = ui; this.box = null;
    window.addEventListener('pointerdown', (e) => { if (this.box && !this.box.contains(e.target)) this.close(); }, true);
  }
  get isOpen() { return !!this.box; }
  open(anchor, html, actions = []) {
    this.close();
    this.ui.tip.hide();
    const b = this.box = el('div', 'tsheet iron pe');
    b.innerHTML = `<div class="ts-info">${html}</div><div class="ts-acts"></div>`;
    const acts = b.querySelector('.ts-acts');
    const btn = (a, cls = '') => {
      const x = el('button', `btn ${cls} ${a.cls ?? ''}`, a.label);
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ui.game.bus.emit('sound', { id: 'ui_click' });
        this.close();
        a.fn?.();
      });
      return x;
    };
    for (const a of actions) {
      if (a.row) {
        const row = el('div', 'ts-row', `<span>${a.label}</span>`);
        for (const r of a.row) row.appendChild(btn(r, 'sm'));
        acts.appendChild(row);
      } else acts.appendChild(btn(a));
    }
    acts.appendChild(btn({ label: '닫기' }));
    this.ui.root.appendChild(b);
    // 위치: 대상 칸 옆(오른쪽 → 왼쪽 → 위), 화면 안으로
    const W = window.innerWidth, H = window.innerHeight, ar = anchor?.getBoundingClientRect?.() ?? { left: W / 2, right: W / 2, top: H / 2, bottom: H / 2 };
    const w = b.offsetWidth, h = b.offsetHeight;
    let x = ar.right + 6, y = ar.top - 10;
    if (x + w > W - 4) x = ar.left - w - 6;
    if (x < 4) { x = (ar.left + ar.right) / 2 - w / 2; y = ar.top - h - 6; if (y < 4) y = ar.bottom + 6; }
    b.style.left = Math.round(Math.max(4, Math.min(W - w - 4, x))) + 'px';
    b.style.top = Math.round(Math.max(4, Math.min(H - h - 4, y))) + 'px';
  }
  close() { this.box?.remove(); this.box = null; }
}

// ── 탭 동작: 가방 칸 / 장비 칸 / 기술 / 단축키 버튼 ──
export function itemSheet(ui, anchor, i) {
  const g = ui.game, it = g.state?.inventory[i];
  if (!it) return;
  const d = g.data.items[it.id] ?? {};
  const acts = [];
  if (d.type === 'consumable') {
    acts.push({ label: '사용', cls: 'gold', fn: () => ui.useItem(i) });
    acts.push({ label: '단축키', row: [6, 7, 8, 9].map((j) => ({ label: String((j + 1) % 10), fn: () => ui.setHotbar(j, { item: it.id }) })) });
  } else if (EQUIP_SLOTS.includes(d.type)) acts.push({ label: '장착', cls: 'gold', fn: () => ui.useItem(i) });
  if (d.type !== 'quest') acts.push({ label: '버리기', fn: () => ui.handleDrop({ type: 'item', slot: i }, null, true) });
  ui.sheet.open(anchor, itemTooltipHtml(g, it.id, { qty: it.qty, sell: true, hint: '길게 누르기: 바로 사용·장착' }), acts);
}
export function equipSheet(ui, anchor, slot) {
  const g = ui.game, it = g.state?.equipment[slot];
  if (!it) return;
  ui.sheet.open(anchor, itemTooltipHtml(g, it.id), [{ label: '장비 해제', cls: 'gold', fn: () => ui.unequip(slot) }]);
}
export function skillSheet(ui, anchor, id) {
  const g = ui.game, learned = g.state?.skills.includes(id);
  const acts = learned ? [
    { label: '사용', cls: 'gold', fn: () => g.systems.skills?.use?.(g.player, id, g.controller?.target ?? null) },
    { label: '단축키', row: [0, 1, 2, 3, 4, 5].map((j) => ({ label: String(j + 1), fn: () => ui.setHotbar(j, id) })) },
  ] : [];
  ui.sheet.open(anchor, skillTooltipHtml(g, id) + (learned ? '' : '<div class="tt-hint">아직 익히지 못한 기술</div>'), acts);
}
export function hotbarSheet(ui, anchor, i) {
  const g = ui.game, h = g.state?.hotbar[i];
  if (!h) {
    ui.sheet.open(anchor, '<div class="tt-type">빈 단축키</div><div class="tt-desc">기술 창(또는 가방)에서 항목을 눌러 [단축키]로 등록하세요.</div>',
      [{ label: i < 6 ? '기술 창 열기' : '가방 열기', cls: 'gold', fn: () => ui.windows[i < 6 ? 'skills' : 'inventory'].open() }]);
    return;
  }
  const html = typeof h === 'string' ? skillTooltipHtml(g, h) : itemTooltipHtml(g, h.item, { qty: g.systems.inventory?.count?.(h.item) });
  ui.sheet.open(anchor, html, [{ label: '단축키에서 빼기', fn: () => ui.setHotbar(i, null) }]);
}
