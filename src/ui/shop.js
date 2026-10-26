// 상점 창: 구매/판매 탭, 수량, 골드 부족·요구 레벨 표시. 'shop:open' {shopId, npc} 로 열린다.
import { el, esc, iconCanvas, fmtNum, itemTooltipHtml, GRADE_COLOR, TYPE_NAME } from './dom.js';
import { Win } from './windows.js';

export class ShopWin extends Win {
  constructor(ui) {
    super(ui, 'shop', { title: '상점', cls: 'shopwin', place: (W, H, w, h) => ({ x: W / 2 - w - 10, y: Math.max(10, (H - h) / 2 - 60) }), events: ['inventory:changed', 'gold:changed'] });
    this.shopId = null; this.npc = null; this.tab = 'buy'; this.sel = null; this.qty = 1;
    this.game.bus.on('shop:open', ({ shopId, npc }) => this.openShop(shopId, npc));
    this.game.bus.on('dialog:open', () => this.close());
  }
  openShop(shopId, npc) {
    const def = this.game.data.shops[shopId];
    if (!def) { console.warn('상점 없음', shopId); return; }
    this.shopId = shopId; this.npc = npc ?? null; this.tab = 'buy'; this.sel = null; this.qty = 1;
    this.opts.title = def.name ?? '상점';
    // 대화가 상점 액션 직후 닫히므로 한 틱 뒤에 연다
    setTimeout(() => {
      if (this.isOpen) { this.root.querySelector('.wt span').textContent = this.opts.title; this.render(); }
      else this.open();
      // 좁은 화면에선 가방을 같이 열면 겹친다 → 판매 탭으로 충분
      if (!(this.ui.mobile?.compact && window.innerWidth < 980)) this.ui.windows.inventory.open();
    }, 0);
  }
  onClose() { this.shopId = null; }
  get def() { return this.game.data.shops[this.shopId]; }
  priceOf(id) { return this.game.systems.inventory?.buyPrice?.(this.shopId, id) ?? Math.round((this.game.data.items[id]?.price ?? 0) * (this.def?.buyMul ?? 1)); }
  sellPrice(id) { return this.game.systems.inventory?.sellPrice?.(id) ?? Math.floor((this.game.data.items[id]?.price ?? 0) * 0.4); }

  render() {
    const g = this.game, s = g.state, def = this.def;
    if (!s || !def) return;
    const b = this.body;
    b.innerHTML = `<div class="tabs"><button class="btn sm${this.tab === 'buy' ? ' sel' : ''}" data-t="buy">구매</button><button class="btn sm${this.tab === 'sell' ? ' sel' : ''}" data-t="sell">판매</button>
      <span class="who">${this.npc ? esc(this.npc.name) : ''}</span></div>
      <div class="shop-list"></div>
      <div class="shopfoot"><span class="g">보유 ${fmtNum(s.gold)} 골드</span><span>수량</span>${this.ui.mobile?.on ? '<button class="btn sm qd" data-d="-1">-</button>' : ''}<input type="number" min="1" max="99" value="${this.qty}">${this.ui.mobile?.on ? '<button class="btn sm qd" data-d="1">+</button>' : ''}<span class="sum"></span><button class="btn gold act">${this.tab === 'buy' ? '구매' : '판매'}</button></div>`;
    b.querySelectorAll('.tabs [data-t]').forEach((bt) => bt.addEventListener('click', () => { this.tab = bt.dataset.t; this.sel = null; this.qty = 1; g.bus.emit('sound', { id: 'ui_click' }); this.render(); }));
    const list = b.querySelector('.shop-list');
    const qIn = b.querySelector('input'), sum = b.querySelector('.sum'), act = b.querySelector('.act');
    const rows = this.tab === 'buy' ? this.buyRows() : this.sellRows();
    if (!rows.length) list.innerHTML = `<div class="empty">${this.tab === 'buy' ? '팔 물건이 없다.' : '팔 만한 물건이 없다.'}</div>`;
    for (const r of rows) {
      const d = g.data.items[r.id] ?? { name: r.id };
      const cant = this.tab === 'buy' && r.price > s.gold;
      const row = el('div', `shop-row${this.sel === r.key ? ' sel' : ''}${cant ? ' cant' : ''}`);
      const sl = el('div', 'slot');
      sl.appendChild(iconCanvas(g, 'item', r.id, 32));
      if (r.qty > 1) sl.appendChild(el('span', 'qty', String(r.qty)));
      row.appendChild(sl);
      const main = d.stats?.atk ? `공격 ${d.stats.atk[0]}~${d.stats.atk[1]}` : d.stats?.def ? `방어 ${d.stats.def}` : d.use?.heal ? `HP +${d.use.heal}` : d.use?.mana ? `MP +${d.use.mana}` : '';
      const lack = d.level && d.level > g.player.level;
      row.appendChild(el('div', 'nm', `<span class="grade-dot" style="background:${GRADE_COLOR[d.grade] ?? '#ddd'}"></span>${esc(d.name)}
        <small>${esc(TYPE_NAME[d.type] ?? '')}${main ? ' · ' + esc(main) : ''}${d.level ? ` · <span class="${lack ? 'lack' : ''}">Lv ${d.level}</span>` : ''}</small>`));
      row.appendChild(el('div', 'pr', `${fmtNum(r.price)} G`));
      row.addEventListener('click', () => { this.sel = r.key; this.qty = 1; g.bus.emit('sound', { id: 'ui_click' }); this.render(); });
      row.addEventListener('dblclick', () => { this.sel = r.key; this.qty = 1; this.doAction(); });
      this.ui.tip.bind(row, () => itemTooltipHtml(g, r.id, this.tab === 'buy' ? { price: r.price } : { qty: r.qty, price: r.price }));
      list.appendChild(row);
    }
    const cur = rows.find((r) => r.key === this.sel);
    const stack = cur && (g.data.items[cur.id]?.stack ?? (g.data.items[cur.id]?.type === 'consumable' ? 99 : 1)) > 1;
    qIn.disabled = !stack;
    const upd = () => {
      let q = Math.max(1, Math.floor(+qIn.value || 1));
      if (cur && this.tab === 'sell') q = Math.min(q, cur.qty);
      this.qty = q;
      sum.textContent = cur ? `= ${fmtNum(cur.price * q)} G` : '';
      act.disabled = !cur || (this.tab === 'buy' && cur.price * q > s.gold);
    };
    qIn.addEventListener('input', upd);
    b.querySelectorAll('.qd').forEach((bt) => bt.addEventListener('click', () => {
      if (qIn.disabled) return;
      qIn.value = Math.max(1, Math.min(99, (Math.floor(+qIn.value) || 1) + +bt.dataset.d));
      upd();
    }));
    qIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.doAction(); });
    act.addEventListener('click', () => this.doAction());
    upd();
  }

  buyRows() {
    const g = this.game;
    return (this.def.items || [])
      .filter((it) => !it.cond || g.script.check(it.cond))
      .filter((it) => g.data.items[it.id])
      .map((it) => ({ key: 'b:' + it.id, id: it.id, price: this.priceOf(it.id) }));
  }
  sellRows() {
    const g = this.game;
    return g.state.inventory.map((it, i) => it && ({ key: 's:' + i, slot: i, id: it.id, qty: it.qty, price: this.sellPrice(it.id) }))
      .filter((r) => r && !g.data.items[r.id]?.unsellable && g.data.items[r.id]?.type !== 'quest' && r.price > 0);
  }

  doAction() {
    const g = this.game, s = g.state, inv = g.systems.inventory;
    const rows = this.tab === 'buy' ? this.buyRows() : this.sellRows();
    const cur = rows.find((r) => r.key === this.sel);
    if (!cur) return;
    const name = g.data.items[cur.id]?.name ?? cur.id;
    if (this.tab === 'buy') {
      if (cur.price * this.qty > s.gold) { this.ui.toast('골드가 부족하다.'); g.bus.emit('sound', { id: 'miss' }); return; }
      const ok = inv?.buy?.(this.shopId, cur.id, this.qty);
      if (ok) { g.bus.emit('sound', { id: 'gold' }); g.log(`${name}${this.qty > 1 ? ` ×${this.qty}` : ''}을(를) 샀다.`, 'loot'); }
      else if (ok === false) this.ui.toast('살 수 없다. (가방이 가득 찼는지 확인하자)');
    } else {
      const ok = inv?.sell?.(cur.slot, this.qty);
      if (ok) { g.bus.emit('sound', { id: 'gold' }); g.log(`${name}${this.qty > 1 ? ` ×${this.qty}` : ''}을(를) 팔았다.`, 'loot'); this.sel = null; }
    }
    this.dirty = true;
  }

  update(dt) {
    super.update(dt);
    // 상인에게서 멀어지면 닫기
    const n = this.npc, p = this.game.player;
    if (this.isOpen && n && p && (Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) > 3 || !this.game.world.entities.includes(n))) this.close();
  }
}
