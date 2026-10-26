// 대화창: 중앙 하단 베벨 창 + 왼쪽 도트 초상화(portrait 없으면 지문), 타자기 효과(클릭/Space/Enter 로 스킵), 선택지(숫자키·방향키·클릭).
import { el, esc, paintPortrait } from './dom.js';

const CPS = 46; // 초당 글자 수

export class DialogBox {
  constructor(ui) {
    this.ui = ui; this.game = ui.game;
    this.box = null; this.d = null;
    this.shown = 0; this.full = ''; this.hl = 0; this.age = 0;
    const b = this.game.bus;
    b.on('dialog:show', (d) => this.show(d));
    b.on('dialog:close', () => this.hide());
  }
  get open() { return !!this.box; }

  build() {
    const box = this.box = el('div', 'iron rivets');
    box.id = 'dialog';
    box.innerHTML = `<div class="in parch"><div class="pf"></div><div class="body"><div class="sp"></div><div class="tx"></div><div class="ops"></div></div></div><div class="nx">▼</div>`;
    this.pv = document.createElement('canvas');
    this.pv.width = this.pv.height = 192; this.pv.style.width = this.pv.style.height = '96px'; this.pv.className = 'portrait';
    box.querySelector('.pf').appendChild(this.pv);
    this.$sp = box.querySelector('.sp'); this.$tx = box.querySelector('.tx'); this.$ops = box.querySelector('.ops'); this.$nx = box.querySelector('.nx');
    box.addEventListener('click', (e) => {
      const op = e.target.closest('.op');
      if (op) return this.choose(+op.dataset.i);
      this.advance();
    });
    this.$ops.addEventListener('mousemove', (e) => {
      const op = e.target.closest('.op');
      if (op) this.setHl(+op.dataset.i);
    });
    this.ui.root.appendChild(box);
  }

  show(d) {
    if (!this.box) { this.build(); this.game.bus.emit('sound', { id: 'ui_open' }); }
    this.d = d;
    this.full = String(d.text ?? '');
    this.shown = 0; this.hl = 0; this.age = 0;
    const npc = d.npc;
    const title = npc?.title && npc.name === d.speaker ? npc.title : '';
    this.$sp.innerHTML = `${esc(d.speaker || '')}${title ? `<small>${esc(title)}</small>` : ''}`;
    this.$sp.style.display = d.speaker ? '' : 'none';
    const look = d.portrait ?? null;
    this.box.querySelector('.pf').style.display = look ? '' : 'none';
    if (look) paintPortrait(this.game, this.pv, look);
    this.$tx.textContent = '';
    this.$ops.innerHTML = '';
    this.$nx.style.display = 'none';
    if (this.ui.noAnim) this.skipText();
  }

  hide() {
    this.box?.remove();
    this.box = null; this.d = null;
  }

  update(dt) {
    if (!this.box || !this.d) return;
    this.age += dt;
    const typing = this.shown < this.full.length;
    if (typing) {
      const prev = Math.floor(this.shown);
      this.shown = Math.min(this.full.length, this.shown + dt * CPS);
      if (Math.floor(this.shown) !== prev) this.$tx.textContent = this.full.slice(0, Math.floor(this.shown));
      if (this.shown >= this.full.length) this.finishText();
    }
    const inp = this.game.input;
    if (this.age < 0.12) return;
    const opts = this.d.options || [];
    if (inp.pressed('Space') || inp.pressed('Enter') || inp.pressed('NumpadEnter') || inp.pressed('KeyF') || inp.pressed('KeyE')) {
      if (this.shown < this.full.length) this.skipText();
      else if (opts.length) this.choose(this.hl);
      else this.advance();
      return;
    }
    if (opts.length && this.shown >= this.full.length) {
      for (let i = 0; i < Math.min(9, opts.length); i++) if (inp.pressed(`Digit${i + 1}`) || inp.pressed(`Numpad${i + 1}`)) return this.choose(i);
      if (inp.pressed('ArrowDown') || inp.pressed('KeyS')) this.setHl((this.hl + 1) % opts.length);
      if (inp.pressed('ArrowUp') || inp.pressed('KeyW')) this.setHl((this.hl + opts.length - 1) % opts.length);
    }
  }

  skipText() { this.shown = this.full.length; this.$tx.textContent = this.full; this.finishText(); }
  finishText() {
    const opts = this.d.options || [];
    if (opts.length) {
      this.$ops.innerHTML = opts.map((o, i) => `<div class="op${i === this.hl ? ' hl' : ''}" data-i="${i}"><b>${i + 1}.</b>${esc(o.text)}</div>`).join('');
      this.$nx.style.display = 'none';
    } else this.$nx.style.display = '';
  }
  setHl(i) {
    this.hl = i;
    this.$ops.querySelectorAll('.op').forEach((o, j) => o.classList.toggle('hl', j === i));
  }
  advance() {
    if (!this.d) return;
    if (this.shown < this.full.length) return this.skipText();
    if (this.d.options?.length) return;
    this.game.bus.emit('sound', { id: 'ui_click' });
    this.game.dialog.next();
  }
  choose(i) {
    if (!this.d || this.shown < this.full.length) { this.skipText(); return; }
    if (!this.d.options?.[i]) return;
    this.game.bus.emit('sound', { id: 'ui_click' });
    this.game.dialog.choose(i);
  }
}
