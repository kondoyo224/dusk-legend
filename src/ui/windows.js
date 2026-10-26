// 창 공통: 돌 베벨 프레임 + 남색 제목줄·사각 [X] + 오목 본문, 제목줄 드래그 이동, 닫기, 위치 기억(브라우저 저장소, 실패해도 무방).
import { el, esc } from './dom.js';

const POS_KEY = 'duskLegend.ui.v1';
let posCache = null;
function loadPos() {
  if (posCache) return posCache;
  try { posCache = JSON.parse(localStorage.getItem(POS_KEY) || '{}') || {}; } catch { posCache = {}; }
  return posCache;
}
function savePos() { try { localStorage.setItem(POS_KEY, JSON.stringify(posCache || {})); } catch { /* 무시 */ } }

export class Win {
  // opts: {title, cls, bodyCls, place(W,H,w,h)->{x,y}, events:[...], live:bool(매 프레임 update 호출)}
  constructor(ui, id, opts) {
    this.ui = ui; this.game = ui.game; this.id = id; this.opts = opts;
    this.root = null; this.dirty = false;
    for (const e of opts.events || []) this.game.bus.on(e, () => { this.dirty = true; });
  }
  get isOpen() { return !!this.root; }

  open() {
    if (this.root) { this.focus(); return; }
    const r = this.root = el('div', `win iron rivets ${this.opts.cls ?? ''}`);
    r.innerHTML = `<div class="wt"><span>${esc(this.opts.title)}</span><span class="x" title="닫기">X</span></div><div class="wb ${this.opts.bodyCls ?? 'parch'}"></div>`;
    this.body = r.querySelector('.wb');
    r.querySelector('.x').addEventListener('click', () => this.close());
    r.addEventListener('pointerdown', () => this.focus());
    this.ui.layer.appendChild(r);
    this.render();
    this.place();
    this.dragTitle(r.querySelector('.wt'));
    this.focus();
    this.game.bus.emit('sound', { id: 'ui_open' });
    this.onOpen?.();
  }
  close() {
    if (!this.root) return;
    this.root.remove(); this.root = null;
    this.ui.tip.hide();
    this.onClose?.();
  }
  toggle() { if (this.root) this.close(); else this.open(); }
  focus() {
    for (const w of this.ui.layer.querySelectorAll('.win.focus')) w.classList.remove('focus');
    this.root?.classList.add('focus');
    if (this.root && this.root !== this.ui.layer.lastChild) this.ui.layer.appendChild(this.root);
  }
  place() {
    const r = this.root, W = window.innerWidth, H = window.innerHeight;
    const w = r.offsetWidth, h = r.offsetHeight;
    const saved = loadPos()[this.id];
    let p = saved ?? this.opts.place?.(W, H, w, h) ?? { x: (W - w) / 2, y: (H - h) / 2 - 40 };
    p = { x: Math.max(0, Math.min(W - w, p.x)), y: Math.max(0, Math.min(H - h - 10, p.y)) };
    r.style.left = p.x + 'px'; r.style.top = p.y + 'px';
  }
  dragTitle(bar) {
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.x')) return;
      const r = this.root, sx = e.clientX, sy = e.clientY, ox = r.offsetLeft, oy = r.offsetTop;
      const mv = (ev) => {
        r.style.left = Math.max(0, Math.min(window.innerWidth - 60, ox + ev.clientX - sx)) + 'px';
        r.style.top = Math.max(0, Math.min(window.innerHeight - 30, oy + ev.clientY - sy)) + 'px';
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        loadPos()[this.id] = { x: r.offsetLeft, y: r.offsetTop }; savePos();
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
  }
  update(dt) {
    if (!this.root) return;
    if (this.dirty) { this.dirty = false; this.render(); }
    if (this.opts.live) this.tick?.(dt);
  }
  render() {}
}
