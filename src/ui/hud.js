// HUD: 하단 고정 패널(어둠의 전설식 — HP/MP 도트 막대, 경험치, 채팅 로그, 단축키 10칸, 메뉴 버튼), 미니맵, 퀘스트 추적, 타겟/보스 프레임, 공지·토스트·장 제목·레벨업·사망 연출.
import { el, esc, iconCanvas, fmtNum, clamp, skillTooltipHtml, itemTooltipHtml } from './dom.js';
import { MiniMap } from './minimap.js';
import { pixelText } from './skin.js';
import { TouchPad } from './touch.js';

const KEY_LABEL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const MENU_BTNS = [['inventory', '가방', 'I'], ['skills', '기술', 'K'], ['character', '능력', 'C'], ['quests', '일지', 'J'], ['map', '지도', 'M'], ['menu', '메뉴', 'Esc']];
const MAX_CHAT = 120;

export class Hud {
  constructor(ui) {
    this.ui = ui; this.game = ui.game;
    this.root = null;
    this.cache = {};
    this.noticeQ = []; this.noticeT = 0;
    this.lastTarget = null;
    this.trackT = 0;
    this.chatLines = [];
    this.bind();
  }

  build() {
    if (this.root) return;
    const r = this.root = el('div');
    r.id = 'hud';
    r.innerHTML = `
      <div id="minimap" class="iron"><div class="name"></div><canvas width="184" height="140"></canvas><div class="sub"><span class="coord"></span><span class="saved">저장됨</span></div></div>
      <div id="tracker"></div>
      <div id="buffs"></div>
      <div id="target" class="iron hidden"><div class="tn"></div><div class="hpbar"><div class="trail"></div><div class="fill"></div></div></div>
      <div id="boss" class="iron hidden"><div class="bn"></div><div class="hpbar"><div class="trail"></div><div class="fill"></div><div class="pct"></div></div></div>
      <div id="status"></div>
      <div id="notice"></div>
      <div id="toasts"></div>
      <div id="bar" class="iron">
        <div class="expbar"><div class="fill"></div>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<div class="tick" style="left:${i * 10}%"></div>`).join('')}</div>
        <div class="row">
          <div class="stat well">
            <div class="who"><span class="lv"></span><span class="gold"></span></div>
            <div class="gauge hp"><b>HP</b><div class="gb"><div class="liq"></div><span class="val"></span></div></div>
            <div class="gauge mp"><b>MP</b><div class="gb"><div class="liq"></div><span class="val"></span></div></div>
            <div class="explbl"></div>
          </div>
          <div id="chat" class="well"><div class="log"></div><input class="hidden" maxlength="80" placeholder="말하기 (Enter 전송 · Esc 취소 · /도움)"><div class="tip">Enter: 대화 입력</div></div>
          <div class="act">
            <div class="hotbar">${KEY_LABEL.map((k, i) => `<div class="slot" data-drop="hot:${i}" data-i="${i}"><span class="key">${k}</span></div>`).join('')}</div>
            <div class="menus">${MENU_BTNS.map(([id, n, k]) => `<button class="btn" data-w="${id}">${n}<b>${k}</b></button>`).join('')}</div>
          </div>
        </div>
      </div>`;
    this.ui.root.insertBefore(r, this.ui.layer);
    const q = (s) => r.querySelector(s);
    this.$ = {
      chatLog: q('#chat .log'), chatIn: q('#chat input'), chatTip: q('#chat .tip'),
      mmName: q('#minimap .name'), mmCanvas: q('#minimap canvas'), mmCoord: q('#minimap .coord'), mmSaved: q('#minimap .saved'),
      tracker: q('#tracker'), buffs: q('#buffs'),
      target: q('#target'), tName: q('#target .tn'), tFill: q('#target .fill'), tTrail: q('#target .trail'),
      boss: q('#boss'), bName: q('#boss .bn'), bFill: q('#boss .fill'), bTrail: q('#boss .trail'), bPct: q('#boss .pct'),
      status: q('#status'), notice: q('#notice'), toasts: q('#toasts'),
      lv: q('#bar .lv'), gold: q('#bar .gold'), expFill: q('#bar .expbar .fill'), expLbl: q('#bar .explbl'),
      hpLiq: q('.gauge.hp .liq'), hpVal: q('.gauge.hp .val'), hpOrb: q('.gauge.hp'),
      mpLiq: q('.gauge.mp .liq'), mpVal: q('.gauge.mp .val'), mpOrb: q('.gauge.mp'),
      slots: [...r.querySelectorAll('.hotbar .slot')],
    };
    this.minimap = new MiniMap(this.game, this.$.mmCanvas);
    this.$.mmCanvas.addEventListener('click', () => this.ui.toggleWindow('map'));
    q('#bar .menus').addEventListener('click', (e) => {
      const w = e.target.closest('button')?.dataset.w;
      if (!w) return;
      if (w === 'menu') this.ui.toggleMenu(); else this.ui.toggleWindow(w);
    });
    this.$.slots.forEach((s, i) => {
      this.ui.drag.bind(s, () => (this.game.state?.hotbar[i] ? { type: 'hot', slot: i } : null), {
        icon: () => this.slotIcon(this.game.state?.hotbar[i], 32),
        onClick: () => this.game.systems.skills?.useSlot?.(i),
        onRight: () => this.game.systems.skills?.useSlot?.(i),
      });
      this.ui.tip.bind(s, () => {
        const h = this.game.state?.hotbar[i];
        if (!h) return '<div class="tt-type">빈 단축키 — 기술(K)이나 물약을 끌어다 놓으세요</div>';
        return typeof h === 'string' ? skillTooltipHtml(this.game, h) : itemTooltipHtml(this.game, h.item, { qty: this.game.systems.inventory?.count?.(h.item) });
      });
    });
    // 채팅 입력
    const ci = this.$.chatIn;
    ci.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.sendChat(ci.value); this.closeChat(); }
      else if (e.key === 'Escape') this.closeChat();
    });
    ci.addEventListener('blur', () => this.closeChat());
    // 터치: 채팅은 최근 몇 줄만 보이고, 탭하면 펼침/접힘
    q('#chat').addEventListener('click', () => {
      if (!this.ui.mobile?.on || this.chatOpen) return;
      const c = q('#chat'), log = this.$.chatLog;
      c.classList.toggle('open');
      log.scrollTop = log.scrollHeight;
    });
    for (const l of this.chatLines) this.appendChatDom(l);
    this.pad = new TouchPad(this);
    this.pad.build(r);
    this.ui.mobile?.syncBar();
    this.refreshAll();
  }

  destroy() { this.pad?.destroy(); this.pad = null; this.root?.remove(); this.root = null; }

  // 단축키 항목의 쿨다운 {pct, left} (하단 단축키 칸·터치 버튼 공용)
  cdOf(h) {
    const g = this.game, sk = g.systems.skills;
    let total, left;
    if (typeof h === 'string') {
      total = sk?.cooldownTotal?.(h) ?? g.data.skills[h]?.cd ?? g.data.skills[h]?.cooldown ?? 0;
      left = sk?.cooldownLeft?.(h) ?? 0;
    } else {
      const u = g.data.items[h.item]?.use;
      total = this.potMax; left = u?.heal || u?.mana ? (this.potLeft ?? 0) : 0;
    }
    return { pct: total && left > 0 ? clamp(left / total, 0, 1) : 0, left };
  }

  bind() {
    const b = this.game.bus;
    b.on('chat', ({ text, channel }) => this.chat(text, channel));
    b.on('ui:notice', ({ text, sub }) => this.notice(text, sub));
    b.on('ui:chapter', ({ title, sub }) => this.chapter(title, sub));
    b.on('map:loaded', ({ map }) => { this.minimap?.rebuild(); if (this.$) this.$.mmName.textContent = map.name ?? map.id; this.refreshTracker(); });
    b.on('map:tileChanged', () => this.minimap?.rebuild());
    b.on('inventory:changed', () => { this.refreshHotbar(); this.refreshTracker(); });
    b.on('skill:learned', ({ id }) => {
      const d = this.game.data.skills[id];
      this.toast(`새 기술: ${d?.name ?? id}`, 'skill');
      this.ui.autoHotbarSkill(id);
      this.refreshHotbar();
    });
    b.on('hotbar:changed', () => this.refreshHotbar());
    b.on('boss:engaged', ({ entity }) => { this.boss = entity; });
    b.on('boss:reset', ({ entity }) => { if (this.boss === entity) this.boss = null; });
    b.on('boss:defeated', ({ entity }) => { if (this.boss === entity) this.boss = null; });
    b.on('map:loaded', () => { this.boss = null; });
    b.on('player:levelup', ({ level }) => this.levelUp(level));
    b.on('target:set', ({ entity }) => { this.lastTarget = entity; });
    b.on('entity:removed', ({ entity }) => { if (entity === this.lastTarget) this.lastTarget = null; });
    b.on('player:dead', (d) => this.death(d));
    b.on('player:revived', () => this.notice('생명이 돌아왔다', '다시 한번, 육신의 무게가 느껴진다.'));
    b.on('game:saved', () => { if (!this.$) return; this.$.mmSaved.classList.add('on'); clearTimeout(this.savedT); this.savedT = setTimeout(() => this.$?.mmSaved.classList.remove('on'), 1600); });
    for (const e of ['quest:started', 'quest:updated', 'quest:ready', 'quest:completed']) b.on(e, () => this.refreshTracker());
    // quest:started 는 시스템이 ui:notice 로 알린다 → 여기선 ready/completed 만 토스트
    b.on('quest:ready', ({ id }) => this.toast(`목표 달성: ${this.qName(id)} — 의뢰인에게 돌아가자`, 'quest'));
    b.on('quest:completed', ({ id }) => this.toast(`의뢰 완료: ${this.qName(id)}`, 'quest'));
  }
  qName(id) { return this.game.data.quests[id]?.name ?? id; }

  refreshAll() { this.refreshHotbar(); this.refreshTracker(); this.cache = {}; if (this.game.world.map && this.$) { this.$.mmName.textContent = this.game.world.map.name ?? ''; this.minimap.rebuild(); } }

  // ── 매 프레임 ──
  update(dt) {
    if (!this.root || !this.game.state) return;
    const g = this.game, p = g.player, s = g.state, $ = this.$, c = this.cache;
    // 구슬
    const hpR = p.maxHp ? clamp(p.hp / p.maxHp, 0, 1) : 0, mpR = p.maxMp ? clamp(p.mp / p.maxMp, 0, 1) : 0;
    const hpK = `${Math.ceil(p.hp)}/${p.maxHp}`, mpK = `${Math.floor(p.mp)}/${p.maxMp}`;
    if (c.hp !== hpK) { c.hp = hpK; $.hpLiq.style.width = hpR * 100 + '%'; $.hpVal.textContent = hpK; $.hpOrb.classList.toggle('low', hpR < 0.25 && p.hp > 0); }
    if (c.mp !== mpK) { c.mp = mpK; $.mpLiq.style.width = mpR * 100 + '%'; $.mpVal.textContent = mpK; }
    // 레벨/골드/경험치
    const lvK = `${p.level}|${s.statPoints}`;
    if (c.lv !== lvK) { c.lv = lvK; $.lv.innerHTML = `Lv ${p.level}${s.statPoints > 0 ? ` <span style="color:#ff9a4a" title="분배할 능력치">+${s.statPoints}</span>` : ''}`; }
    if (c.gold !== s.gold) { c.gold = s.gold; $.gold.textContent = fmtNum(s.gold); }
    const need = this.ui.expNeed(p.level), exp = p.exp ?? 0;
    const expK = `${exp}|${need}`;
    if (c.exp !== expK) {
      c.exp = expK;
      const max = p.level >= 30;
      $.expFill.style.width = (max ? 100 : clamp(exp / need, 0, 1) * 100) + '%';
      $.expLbl.textContent = max ? '최고 레벨' : `경험치 ${fmtNum(exp)} / ${fmtNum(need)} (${(clamp(exp / need, 0, 1) * 100).toFixed(1)}%)`;
    }
    // 단축키 쿨다운/MP
    const potLeft = this.potLeft = g.systems.inventory?.potionCooldownLeft?.() ?? 0;
    if (potLeft > (this.potMax ?? 0) || potLeft === 0) this.potMax = potLeft;
    s.hotbar.forEach((h, i) => {
      const slot = $.slots[i];
      if (!h || !slot._cd) return;
      const { pct, left } = this.cdOf(h);
      const key = left > 0 ? Math.ceil(left * 10) : 0;
      if (slot._cdk !== key) {
        slot._cdk = key;
        slot._cd.style.height = pct > 0 ? Math.ceil(pct * 16) * 2 + 'px' : '0'; // 2px 단위로 내려가는 도트 덮개
        slot._cdt.textContent = left > 0 ? (left >= 1 ? Math.ceil(left) : left.toFixed(1)) : '';
      }
      if (typeof h === 'string') slot.classList.toggle('nomp', (g.data.skills[h]?.mp ?? 0) > p.mp);
    });
    for (let i = 0; i < 10; i++) if (g.input.pressed(i === 9 ? 'Digit0' : `Digit${i + 1}`) && !g.dialog.isOpen) this.flashSlot(i);
    // 좌표
    const ck = `${p.x},${p.y}`;
    if (c.coord !== ck) { c.coord = ck; $.mmCoord.textContent = `(${p.x}, ${p.y})`; }
    this.minimap.draw(dt);
    this.updateTarget();
    this.updateStatus();
    this.updateBuffs();
    // 공지
    if (this.noticeT > 0) { this.noticeT -= dt; if (this.noticeT <= 0) this.nextNotice(); }
    this.trackT -= dt;
    if (this.trackT <= 0) { this.trackT = 1; this.refreshTracker(); }
    this.pad?.update(dt);
  }

  updateTarget() {
    const g = this.game, $ = this.$, p = g.player;
    let t = g.controller?.target ?? this.lastTarget;
    if (t && (t.dead || !g.world.entities.includes(t))) { t = null; this.lastTarget = null; }
    // 보스: 가까운 살아있는 보스
    let boss = this.boss && !this.boss.dead && g.world.entities.includes(this.boss) ? this.boss : null;
    if (!boss) for (const e of g.world.entities) {
      if (e.kind === 'monster' && e.boss && !e.dead && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= 12) { boss = e; break; }
    }
    if (boss) {
      $.boss.classList.remove('hidden');
      const r = clamp(boss.hp / boss.maxHp, 0, 1);
      const k = `${boss.id}|${boss.hp}`;
      if (this.cache.boss !== k) {
        this.cache.boss = k;
        $.bName.textContent = boss.name;
        $.bFill.style.width = r * 100 + '%'; $.bTrail.style.width = r * 100 + '%';
        $.bPct.textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp}`;
      }
    } else $.boss.classList.add('hidden');
    if (t && t !== boss && t.maxHp) {
      $.target.classList.remove('hidden');
      const r = clamp(t.hp / t.maxHp, 0, 1);
      const k = `${t.id}|${t.hp}`;
      if (this.cache.tgt !== k) {
        if (this.cache.tgtId !== t.id) { $.tTrail.style.transition = 'none'; $.tTrail.style.width = r * 100 + '%'; void $.tTrail.offsetWidth; $.tTrail.style.transition = ''; }
        this.cache.tgt = k; this.cache.tgtId = t.id;
        $.tName.innerHTML = `${esc(t.name)}<span class="lvl">Lv ${t.level ?? 1}</span>`;
        $.tFill.style.width = r * 100 + '%'; $.tTrail.style.width = r * 100 + '%';
      }
    } else $.target.classList.add('hidden');
  }

  updateStatus() {
    const g = this.game, p = g.player, s = g.state;
    let k = '';
    if (p.ghost && !g.dialog.isOpen && !this.ui.dialogBox.open) k = s.flags['pro.reborn'] ? '혼의 상태 — 신전의 사제에게 부활을 청하라' : '혼의 상태 — 이곳은 산 자와 죽은 자의 경계';
    if (this.cache.status !== k) { this.cache.status = k; this.$.status.innerHTML = k ? `<span class="ghost">${esc(k)}</span>` : ''; }
  }

  updateBuffs() {
    const g = this.game, list = g.player.buffs;
    const arr = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.entries(list).map(([id, v]) => ({ id, ...(typeof v === 'object' ? v : { t: v }) })) : [];
    const k = arr.map((b) => `${b.id}:${Math.ceil(b.t ?? b.left ?? b.time ?? 0)}`).join(',');
    if (this.cache.buffs === k) return;
    this.cache.buffs = k;
    const box = this.$.buffs;
    box.innerHTML = '';
    for (const b of arr) {
      const d = el('div', 'buff');
      const sid = b.skill ?? b.id;
      d.appendChild(iconCanvas(g, 'skill', sid, 30));
      const left = b.t ?? b.left ?? b.time;
      if (left != null) d.insertAdjacentHTML('beforeend', `<span>${Math.ceil(left)}</span>`);
      this.ui.tip.bind(d, () => skillTooltipHtml(g, sid));
      box.appendChild(d);
    }
  }

  // ── 단축키 ──
  slotIcon(h, size) {
    if (!h) return null;
    return typeof h === 'string' ? iconCanvas(this.game, 'skill', h, size) : iconCanvas(this.game, 'item', h.item, size);
  }
  refreshHotbar() {
    if (!this.root || !this.game.state) return;
    const g = this.game, s = g.state;
    s.hotbar.forEach((h, i) => {
      const slot = this.$.slots[i];
      slot.querySelectorAll('canvas,.qty,.cd,.cdt').forEach((x) => x.remove());
      slot.classList.remove('dim', 'nomp');
      slot._cd = null; slot._cdk = -1;
      if (!h) return;
      slot.insertBefore(this.slotIcon(h, 32), slot.firstChild);
      if (typeof h === 'string') {
        if (!s.skills.includes(h)) slot.classList.add('dim');
        slot._cd = el('div', 'cd'); slot._cdt = el('div', 'cdt');
        slot.append(slot._cd, slot._cdt);
      } else {
        const n = g.systems.inventory?.count?.(h.item) ?? 0;
        if (!n) slot.classList.add('dim');
        slot._cd = el('div', 'cd'); slot._cdt = el('div', 'cdt');
        slot.append(slot._cd, slot._cdt, el('span', 'qty', String(n)));
      }
    });
    this.pad?.refresh();
  }
  flashSlot(i) {
    const s = this.$.slots[i];
    s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash');
  }

  // ── 퀘스트 추적 ──
  refreshTracker() {
    if (!this.root || !this.game.state) return;
    const g = this.game, qs = g.state.quests, Q = g.data.quests;
    const act = Object.entries(qs).filter(([, v]) => v && v.state !== 'done').sort(([a], [b]) => (Q[b]?.main ? 1 : 0) - (Q[a]?.main ? 1 : 0)).slice(0, 4);
    let h = '';
    for (const [id] of act) {
      const d = Q[id];
      const st = g.systems.quests?.stateOf?.(id);
      let prog = '';
      try { prog = g.systems.quests?.progressText?.(id) ?? ''; } catch { prog = ''; }
      if (!prog && d?.objectives) prog = d.objectives.map((o) => o.text).filter(Boolean).join('\n');
      const lines = String(prog || '').split('\n').filter(Boolean);
      h += `<div class="q"><div class="qn${d?.main ? ' main' : ''}">${esc(d?.name ?? id)}</div>${st === 'ready' ? '<div class="qp ready">✔ 의뢰인에게 보고하기</div>' : lines.map((l) => `<div class="qp">${esc(l)}</div>`).join('')}</div>`;
    }
    if (this.cache.track !== h) { this.cache.track = h; this.$.tracker.innerHTML = h; }
  }

  // ── 채팅 ──
  chat(text, channel = 'system') {
    const line = { text: String(text ?? ''), channel };
    this.chatLines.push(line);
    if (this.chatLines.length > MAX_CHAT) this.chatLines.shift();
    if (this.root) this.appendChatDom(line);
  }
  appendChatDom(line) {
    const log = this.$.chatLog;
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    const d = el('div', `ch-${line.channel}`);
    d.textContent = line.text;
    log.appendChild(d);
    while (log.children.length > MAX_CHAT) log.firstChild.remove();
    if (atBottom) log.scrollTop = log.scrollHeight;
  }
  openChat() {
    const ci = this.$.chatIn;
    ci.classList.remove('hidden'); this.$.chatTip.classList.add('hidden');
    ci.value = '';
    this.game.input.blocked = true;
    this.game.input.down.clear();
    setTimeout(() => ci.focus(), 0);
  }
  closeChat() {
    const ci = this.$?.chatIn;
    if (!ci || ci.classList.contains('hidden')) return;
    ci.classList.add('hidden'); this.$.chatTip.classList.remove('hidden');
    ci.blur();
    this.game.input.blocked = false;
  }
  get chatOpen() { return !!this.$ && !this.$.chatIn.classList.contains('hidden'); }
  sendChat(raw) {
    const t = raw.trim();
    if (!t) return;
    const g = this.game;
    if (t.startsWith('/')) {
      const cmd = t.slice(1).split(/\s+/)[0];
      if (['저장', 'save'].includes(cmd)) { g.log(g.save() ? '여정을 기록했다.' : '저장에 실패했다.', 'system'); return; }
      if (['위치', 'loc'].includes(cmd)) { g.log(`${g.world.map?.name ?? ''} (${g.player.x}, ${g.player.y})`, 'system'); return; }
      if (['시간', 'time'].includes(cmd)) { const m = Math.floor(g.state.playTime / 60); g.log(`플레이 시간 ${Math.floor(m / 60)}시간 ${m % 60}분`, 'system'); return; }
      g.log('명령어: /저장, /위치, /시간', 'system');
      return;
    }
    g.say(g.player, t);
  }

  // ── 공지·토스트·연출 ──
  notice(text, sub = '') {
    this.noticeQ.push({ text, sub });
    if (this.noticeT <= 0) this.nextNotice();
  }
  nextNotice() {
    if (!this.$) return;
    const box = this.$.notice;
    const old = box.firstChild;
    if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 800); }
    const n = this.noticeQ.shift();
    if (!n) { this.noticeT = 0; return; }
    const d = el('div', 'n', `<div class="a">${esc(n.text)}</div>${n.sub ? `<div class="b">${esc(n.sub)}</div>` : ''}`);
    box.appendChild(d);
    this.noticeT = 2.6 + Math.min(2, (n.text.length + n.sub.length) * 0.03);
  }
  toast(text, kind = '') {
    if (!this.$) return;
    const d = el('div', `t ${kind}`);
    d.textContent = text;
    this.$.toasts.appendChild(d);
    while (this.$.toasts.children.length > 5) this.$.toasts.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 650); }, 3600);
  }
  chapter(title, sub) {
    this.ui.root.querySelector('#chapter')?.remove();
    const d = el('div', '', `<div class="band"><div class="line"></div><div class="ct"></div>${sub ? `<div class="cs">${esc(sub)}</div>` : ''}<div class="line"></div></div>`);
    d.id = 'chapter';
    d.querySelector('.ct').appendChild(pixelText(String(title ?? ''), { px: 20, scale: 2 }));
    this.ui.root.appendChild(d);
    this.game.bus.emit('sound', { id: 'page' });
    setTimeout(() => d.remove(), 4700);
  }
  levelUp(level) {
    this.ui.root.querySelector('#levelup')?.remove();
    const pts = this.game.state?.statPoints ?? 0;
    // 큰 'LEVEL UP!' 글자는 렌더러가 캐릭터 머리 위에 그린다 → UI 는 베벨 알림 상자만
    const d = el('div', '', `<div class="l1 iron rivets"><b>레벨 업!</b><div class="l2">Lv ${level} 달성${pts ? ` — 분배할 능력치 ${pts} (C)` : ''}</div></div>`);
    d.id = 'levelup';
    this.ui.root.appendChild(d);
    this.game.log(`레벨이 올랐다! (Lv ${level})`, 'quest');
    setTimeout(() => d.remove(), 2900);
  }
  death(info = {}) {
    this.ui.root.querySelector('#death')?.remove();
    const g = this.game;
    const pro = info.prologue ?? !g.state?.flags['pro.reborn'];
    const lost = info.goldLost > 0 ? `<div class="d2" style="color:#d8a84a">${fmtNum(info.goldLost)} 골드를 잃었다.</div>` : '';
    const d = el('div', '', `<div class="d1"></div><div class="d2">${pro ? '혼이 흩어졌다가… 기록자의 곁에서 다시 모인다.' : '혼이 육신을 떠난다… 신전에서 눈을 뜰 것이다.'}</div>${lost}`);
    d.id = 'death';
    d.querySelector('.d1').appendChild(pixelText('쓰러졌다', { px: 16, scale: 3, hi: '#ff9a8a', mid: '#d02a2a', lo: '#7a0a0a', edge: '#1a0000' }));
    this.ui.root.appendChild(d);
    setTimeout(() => d.remove(), 4300);
  }
}
