// 인벤토리/장비/사용/줍기/버리기/상점/드랍.
import { chebyshev } from '../core/iso.js';
import { makeEntity } from '../world/entity.js';
import { isEquip } from '../data/items.js';
import { addBuff } from './util.js';

const SELL_RATE = 0.4;
const DROP_LIFETIME = 180;      // 초 (퀘스트 아이템은 사라지지 않음)
const POTION_CD = 0.6;
const LOOK_SLOTS = ['weapon', 'armor', 'shield', 'helm', 'boots'];

export function createInventory(g, sys) {
  const S = () => g.state;
  const def = (id) => g.data.items[id];
  const maxStack = (d) => (isEquip(d) ? 1 : d.stack ?? 99);
  let potionReady = 0;

  const changed = () => g.bus.emit('inventory:changed', {});

  const inv = {
    SELL_RATE,
    sellPrice(id) { const d = def(id); return d && !d.unsellable ? Math.floor((d.price || 0) * SELL_RATE) : 0; },
    buyPrice(shopId, id) { const d = def(id); return d ? Math.ceil((d.price || 0) * (g.data.shops[shopId]?.buyMul ?? 1)) : 0; },
    potionCooldownLeft() { return Math.max(0, potionReady - g.time); },

    count(id) { return S()?.inventory.reduce((s, it) => s + (it?.id === id ? it.qty : 0), 0) ?? 0; },
    freeSlots() { return S().inventory.filter((x) => !x).length; },

    // 들어갈 수 있는지 (일부만 넣지 않는다)
    canAdd(id, qty = 1) {
      const d = def(id); if (!d) return false;
      const ms = maxStack(d);
      let room = 0;
      for (const it of S().inventory) {
        if (!it) room += ms;
        else if (it.id === id) room += ms - it.qty;
        if (room >= qty) return true;
      }
      return room >= qty;
    },

    add(id, qty = 1) {
      const d = def(id);
      if (!d) { console.warn('알 수 없는 아이템', id); return false; }
      if (!this.canAdd(id, qty)) { g.log('가방이 가득 찼습니다.', 'warn'); return false; }
      const list = S().inventory, ms = maxStack(d);
      let left = qty;
      for (const it of list) {
        if (left <= 0) break;
        if (it && it.id === id && it.qty < ms) { const n = Math.min(ms - it.qty, left); it.qty += n; left -= n; }
      }
      for (let i = 0; i < list.length && left > 0; i++) {
        if (!list[i]) { const n = Math.min(ms, left); list[i] = { id, qty: n }; left -= n; }
      }
      // 회복 물약은 빈 단축키(7~0번)에 자동 등록
      if (d.type === 'consumable' && (d.use?.heal || d.use?.mana)) {
        const hb = S().hotbar;
        if (!hb.some((h) => h?.item === id)) {
          const same = hb.findIndex((h) => h?.item && def(h.item)?.use?.heal && d.use.heal && h.item !== id && this.count(h.item) === 0);
          const i = same >= 0 ? same : hb.findIndex((h, k) => !h && k >= 6);
          if (i >= 0) { hb[i] = { item: id }; g.bus.emit('hotbar:changed', {}); }
        }
      }
      changed();
      return true;
    },

    remove(id, qty = 1) {
      if (this.count(id) < qty) return false;
      const list = S().inventory;
      let left = qty;
      for (let i = list.length - 1; i >= 0 && left > 0; i--) {
        const it = list[i];
        if (it?.id !== id) continue;
        const n = Math.min(it.qty, left);
        it.qty -= n; left -= n;
        if (it.qty <= 0) list[i] = null;
      }
      changed();
      return true;
    },

    swap(i, j) {
      const list = S().inventory;
      if (i === j || !(i in list) || !(j in list)) return;
      const a = list[i], b = list[j];
      if (a && b && a.id === b.id && !isEquip(def(a.id))) {
        const ms = maxStack(def(a.id)), n = Math.min(ms - b.qty, a.qty);
        b.qty += n; a.qty -= n;
        if (a.qty <= 0) list[i] = null;
      } else { list[i] = b; list[j] = a; }
      changed();
    },

    // ── 장비 ──
    equip(i) {
      const s = S(), p = g.player, it = s.inventory[i];
      if (!it) return false;
      const d = def(it.id);
      if (!isEquip(d)) return false;
      if ((d.level ?? 1) > p.level) { g.log(`레벨 ${d.level} 이상만 장착할 수 있습니다.`, 'warn'); return false; }
      const slot = d.type;
      const old = s.equipment[slot];
      s.equipment[slot] = { id: it.id };
      s.inventory[i] = old ? { id: old.id, qty: 1 } : null;
      this.applyLook();
      sys.stats.recalc(p);
      g.bus.emit('sound', { id: 'ui_click' });
      g.bus.emit('inventory:equip', { slot, id: it.id });
      g.log(`${d.name}을(를) 장착했다.`, 'loot');
      changed();
      return true;
    },

    unequip(slot) {
      const s = S(), cur = s.equipment[slot];
      if (!cur) return false;
      const i = s.inventory.findIndex((x) => !x);
      if (i < 0) { g.log('가방에 빈 칸이 없습니다.', 'warn'); return false; }
      s.inventory[i] = { id: cur.id, qty: 1 };
      s.equipment[slot] = null;
      this.applyLook();
      sys.stats.recalc(g.player);
      g.bus.emit('inventory:equip', { slot, id: null });
      changed();
      return true;
    },

    // 장비 외형 → player.look (렌더러가 반영)
    applyLook() {
      const p = g.player, eq = S().equipment;
      for (const slot of LOOK_SLOTS) p.look[slot] = (eq[slot] && def(eq[slot].id)?.look) || null;
    },

    // ── 사용 ──
    useSlot(i) {
      const it = S().inventory[i];
      if (!it) return false;
      const d = def(it.id);
      if (isEquip(d)) return this.equip(i);
      if (d?.type === 'consumable') return this.useAt(i);
      g.log(`${d?.name ?? it.id}: 사용할 수 없는 아이템입니다.`, 'warn');
      return false;
    },

    useItemById(id) {
      const i = S().inventory.findIndex((x) => x?.id === id);
      if (i < 0) { g.log(`${def(id)?.name ?? id}이(가) 없습니다.`, 'warn'); return false; }
      return this.useSlot(i);
    },

    useAt(i) {
      const s = S(), p = g.player, it = s.inventory[i], d = def(it.id), u = d.use || {};
      if (p.dead) { g.log('쓰러진 몸으로는 사용할 수 없습니다.', 'warn'); return false; }
      if (g.time < potionReady && (u.heal || u.mana)) return false;
      if ((u.heal && !u.mana && p.hp >= p.maxHp) || (u.mana && !u.heal && p.mp >= p.maxMp)) {
        g.log(u.heal ? '이미 체력이 가득합니다.' : '이미 MP가 가득합니다.', 'warn'); return false;
      }
      if (u.teleport) {
        if (g.data.maps[u.teleport.map] == null) { g.log('지금은 그곳으로 돌아갈 수 없습니다.', 'warn'); return false; }
        if (S().chapter === 0 && !S().flags['pro.reborn']) { g.log('경계의 땅에서는 주문서가 듣지 않는다.', 'warn'); return false; }
      }
      if (u.heal) { p.hp = Math.min(p.maxHp, p.hp + u.heal); g.bus.emit('fx:play', { id: 'heal', x: p.x, y: p.y }); }
      if (u.mana) { p.mp = Math.min(p.maxMp, p.mp + u.mana); g.bus.emit('fx:play', { id: 'mana', x: p.x, y: p.y }); }
      if (u.heal || u.mana) { potionReady = g.time + POTION_CD; g.bus.emit('sound', { id: 'potion' }); }
      if (u.buff) {
        addBuff(p, { id: u.buff.id, t: u.buff.time, atk: u.buff.atk, def: u.buff.def });
        g.log(`${d.name}의 힘이 몸에 깃든다.`, 'system');
      }
      it.qty--;
      if (it.qty <= 0) s.inventory[i] = null;
      if (u.teleport) {
        const m = g.data.maps[u.teleport.map];
        const dest = u.teleport.x != null ? u.teleport : (m.respawn?.map === u.teleport.map ? m.respawn : m.start) || {};
        g.bus.emit('sound', { id: 'portal' });
        g.changeMap(u.teleport.map, dest.x, dest.y);
      }
      g.bus.emit('stats:changed', { entity: p });
      changed();
      return true;
    },

    discard(i, qty) {
      const s = S(), it = s.inventory[i];
      if (!it) return false;
      const d = def(it.id);
      if (d?.type === 'quest' && d.unsellable) { g.log('소중한 물건은 버릴 수 없습니다.', 'warn'); return false; }
      const n = Math.min(qty ?? it.qty, it.qty);
      it.qty -= n;
      if (it.qty <= 0) s.inventory[i] = null;
      const p = g.player;
      this.dropItem(p.x, p.y, it.id, n, { noScatter: true, noAutoLoot: true });
      changed();
      return true;
    },

    // ── 상점 ──
    buy(shopId, itemId, qty = 1) {
      const s = S(), shop = g.data.shops[shopId], d = def(itemId);
      if (!shop || !d) return false;
      const entry = shop.items.find((x) => (typeof x === 'string' ? x : x.id) === itemId);
      if (!entry || (entry.cond && !g.script.check(entry.cond))) { g.log('판매하지 않는 물건입니다.', 'warn'); return false; }
      const cost = this.buyPrice(shopId, itemId) * qty;
      if (s.gold < cost) { g.log('골드가 부족합니다.', 'warn'); return false; }
      if (!this.canAdd(itemId, qty)) { g.log('가방이 가득 찼습니다.', 'warn'); return false; }
      s.gold -= cost;
      this.add(itemId, qty);
      g.bus.emit('gold:changed', { gold: s.gold, delta: -cost });
      g.log(`${d.name}${qty > 1 ? ' ×' + qty : ''} 구입 (-${cost} 골드)`, 'loot');
      return true;
    },

    sell(i, qty = 1) {
      const s = S(), it = s.inventory[i];
      if (!it) return false;
      const d = def(it.id), price = this.sellPrice(it.id);
      if (!d || d.unsellable || price <= 0) { g.log('팔 수 없는 물건입니다.', 'warn'); return false; }
      const n = Math.min(qty, it.qty);
      it.qty -= n;
      if (it.qty <= 0) s.inventory[i] = null;
      s.gold += price * n;
      g.bus.emit('gold:changed', { gold: s.gold, delta: price * n });
      g.log(`${d.name}${n > 1 ? ' ×' + n : ''} 판매 (+${price * n} 골드)`, 'loot');
      changed();
      return true;
    },

    // ── 바닥 드랍 ──
    scatter(x, y) {
      const w = g.world, c = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (w.tileWalkable(x + dx, y + dy)) c.push({ x: x + dx, y: y + dy });
      return c.length ? c[Math.floor(Math.random() * c.length)] : { x, y };
    },

    dropItem(x, y, id, qty = 1, opts = {}) {
      const d = def(id);
      if (!d) { console.warn('알 수 없는 드랍', id); return null; }
      const pos = opts.noScatter ? { x, y } : this.scatter(x, y);
      const e = makeEntity('drop', {
        name: qty > 1 ? `${d.name} ×${qty}` : d.name, itemId: id, qty, x: pos.x, y: pos.y,
        blocking: false, faction: 'neutral', grade: d.grade ?? 'common',
        look: { body: 'drop', item: id }, born: g.time, noAutoLoot: !!opts.noAutoLoot,
      });
      return g.world.addEntity(e);
    },

    dropGold(x, y, n) {
      if (n <= 0) return null;
      const pos = { x, y };
      const e = makeEntity('drop', {
        name: `${n} 골드`, gold: n, x: pos.x, y: pos.y, blocking: false, faction: 'neutral',
        look: { body: 'drop', gold: true, amount: n }, born: g.time,
      });
      return g.world.addEntity(e);
    },

    pickup(drop) {
      if (!drop || !g.world.entities.includes(drop)) return false;
      if (g.player?.dead) { g.log('혼의 손은 물건을 쥘 수 없다.', 'warn'); return false; }
      const s = S();
      if (typeof drop.gold === 'number') {
        s.gold += drop.gold;
        g.world.removeEntity(drop);
        g.bus.emit('gold:changed', { gold: s.gold, delta: drop.gold });
        g.bus.emit('item:pickup', { itemId: null, qty: 0, gold: drop.gold });
        g.log(`${drop.gold} 골드를 주웠다.`, 'loot');
        return true;
      }
      if (!this.add(drop.itemId, drop.qty)) return false;
      g.world.removeEntity(drop);
      g.bus.emit('item:pickup', { itemId: drop.itemId, qty: drop.qty, gold: 0 });
      g.log(`${def(drop.itemId).name}${drop.qty > 1 ? ' ×' + drop.qty : ''}을(를) 주웠다.`, 'loot');
      return true;
    },

    // 골드 자동 줍기(2칸), 발밑 아이템 자동 줍기, 오래된 드랍 정리
    update() {
      const p = g.player;
      if (!p) return;
      for (const e of [...g.world.entities]) {
        if (e.kind !== 'drop') continue;
        const d = chebyshev(p.x, p.y, e.x, e.y);
        if (typeof e.gold === 'number' && d <= 2 && !p.dead) this.pickup(e);
        else if (e.itemId && d === 0 && !p.move && !p.dead && !e.noAutoLoot && !e._failed) { if (!this.pickup(e)) e._failed = true; }
        else if (d > 0) e._failed = false;
        if (e.born != null && g.time - e.born > DROP_LIFETIME && def(e.itemId)?.type !== 'quest') g.world.removeEntity(e);
      }
    },
  };
  return inv;
}
