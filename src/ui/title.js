// 타이틀 화면 + 캐릭터 생성. 배경은 자체 캔버스 애니메이션(달, 안개, 묘비 실루엣, 떠도는 혼불).
import { el, paintPortrait } from './dom.js';
import { helpHtml } from './menu.js';
import { pixelText } from './skin.js';

const HAIR_COLORS = ['#1c1410', '#3b2a1e', '#6a4424', '#a8743a', '#d8b878', '#8a2a1a', '#c8c8d0', '#3a3a5a'];
const SKINS = ['#f4d6b8', '#e8c4a0', '#d4a47a', '#b07a50', '#7a5034'];
const HAIR_NAMES = ['단정한', '앞머리', '묶은 머리', '긴 머리', '헝클어진', '땋은 머리'];

export class TitleScreen {
  constructor(ui) {
    this.ui = ui; this.game = ui.game;
    this.root = null; this.raf = 0;
  }

  show({ canContinue }) {
    this.hide();
    const g = this.game;
    const r = this.root = el('div', '', '');
    r.id = 'title';
    const cv = el('canvas', 'bg');
    r.appendChild(cv);
    r.insertAdjacentHTML('beforeend', `
      <div class="logo npe"><div class="t1"></div><div class="t2">歸 魂 의 書</div><div class="t3">THE LEGEND OF DUSK</div></div>
      <div class="menu iron rivets">
        <button class="btn gold" data-a="new">새로운 여정</button>
        <button class="btn" data-a="cont" ${canContinue ? '' : 'disabled'}>이어하기</button>
        <button class="btn" data-a="help">조작법</button>
      </div>
      <div class="foot npe">모든 그림과 소리는 코드로 빚어졌습니다 · ${this.ui.mobile?.on ? '터치로 플레이 (가로 화면 권장)' : '마우스 또는 키보드로 플레이'}</div>`);
    r.querySelector('.menu').addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (!a) return;
      g.bus.emit('sound', { id: 'ui_click' });
      if (a === 'new') this.showCreate();
      if (a === 'cont') { if (g.continueGame()) this.hide(); else this.ui.toast('저장 데이터를 불러오지 못했습니다.'); }
      if (a === 'help') this.ui.modal('조작법', helpHtml(this.ui.mobile?.on));
    });
    // 도트 로고: 굵은 픽셀 글자 + 단색 외곽 + 3단 명암
    r.querySelector('.t1').appendChild(pixelText('황혼의 전설', { px: 22, scale: 3, hi: '#fff4c0', mid: '#f0b848', lo: '#b0561a', edge: '#200a02' }));
    this.ui.root.appendChild(r);
    // 렌더러(워커 A)가 타이틀 배경을 그리면 그것을 쓰고, 없을 때만 자체 배경을 그린다
    if (g.renderer?.title?.render) { r.classList.add('clear'); cv.remove(); this.startGlow(); }
    else this.startBg(cv);
    if (new URLSearchParams(location.search).get('uitest') === 'create') this.showCreate(); // 디버그: 캐릭터 생성 화면
  }

  hide() {
    cancelAnimationFrame(this.raf);
    this.root?.remove();
    this.root = null;
  }

  startGlow() { /* 고전풍: 로고는 정지된 도트 글자(발광 애니메이션 없음) */ }

  // ── 배경 ──
  startBg(cv) {
    const ctx = cv.getContext('2d');
    const rnd = mulberry(7);
    const stars = Array.from({ length: 140 }, () => ({ x: rnd(), y: rnd() * 0.6, s: rnd() * 1.4 + 0.3, p: rnd() * 6 }));
    const graves = Array.from({ length: 26 }, (_, i) => ({ x: i / 25 + (rnd() - 0.5) * 0.03, h: 18 + rnd() * 26, w: 12 + rnd() * 10, k: rnd() < 0.35 ? 'cross' : 'stone', tilt: (rnd() - 0.5) * 0.25 }));
    const souls = Array.from({ length: 38 }, () => ({ x: rnd(), y: 0.55 + rnd() * 0.45, v: 0.004 + rnd() * 0.01, a: rnd() * 6, s: 1 + rnd() * 2.5 }));
    const t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      const W = cv.width = cv.clientWidth, H = cv.height = cv.clientHeight;
      // 하늘
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#07060f'); sky.addColorStop(0.45, '#1a1230'); sky.addColorStop(0.7, '#3a1c2a'); sky.addColorStop(1, '#0a0608');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      for (const s of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s.p)); ctx.fillStyle = '#e8e0ff'; ctx.fillRect(s.x * W, s.y * H, s.s, s.s); }
      ctx.globalAlpha = 1;
      // 달
      const mx = W * 0.72, my = H * 0.24, mr = Math.min(W, H) * 0.08;
      const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4);
      halo.addColorStop(0, 'rgba(255,220,180,.35)'); halo.addColorStop(1, 'rgba(255,200,160,0)');
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f6e6c8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(26,18,48,.92)'; ctx.beginPath(); ctx.arc(mx + mr * 0.42, my - mr * 0.12, mr * 0.92, 0, 7); ctx.fill();
      // 먼 탑 실루엣
      ctx.fillStyle = '#120c18';
      const tx = W * 0.2;
      ctx.beginPath(); ctx.moveTo(tx - 30, H * 0.72); ctx.lineTo(tx - 18, H * 0.34); ctx.lineTo(tx - 26, H * 0.34); ctx.lineTo(tx, H * 0.22); ctx.lineTo(tx + 26, H * 0.34); ctx.lineTo(tx + 18, H * 0.34); ctx.lineTo(tx + 30, H * 0.72); ctx.fill();
      ctx.fillStyle = `rgba(255,80,40,${0.5 + 0.3 * Math.sin(t * 2)})`; ctx.fillRect(tx - 3, H * 0.3, 6, 8);
      // 언덕
      ctx.fillStyle = '#0e0a12';
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.74 + Math.sin(x * 0.006) * 18 + Math.sin(x * 0.017) * 7);
      ctx.lineTo(W, H); ctx.fill();
      // 묘비
      for (const gv of graves) {
        const gx = gv.x * W, gy = H * 0.76 + Math.sin(gx * 0.006) * 18 + Math.sin(gx * 0.017) * 7;
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(gv.tilt); ctx.fillStyle = '#07050a';
        if (gv.k === 'cross') { ctx.fillRect(-2.5, -gv.h - 6, 5, gv.h + 8); ctx.fillRect(-9, -gv.h + 2, 18, 4.5); }
        else { ctx.beginPath(); ctx.moveTo(-gv.w / 2, 2); ctx.lineTo(-gv.w / 2, -gv.h + gv.w / 2); ctx.arc(0, -gv.h + gv.w / 2, gv.w / 2, Math.PI, 0); ctx.lineTo(gv.w / 2, 2); ctx.fill(); }
        ctx.restore();
      }
      // 안개
      for (let i = 0; i < 4; i++) {
        const fy = H * (0.7 + i * 0.075), sp = 6 + i * 4, a = 0.07 + i * 0.03;
        for (let k = 0; k < 6; k++) {
          const bx = ((k / 6) * W * 1.4 + t * sp * (i % 2 ? -1 : 1)) % (W * 1.4);
          const x = (bx < 0 ? bx + W * 1.4 : bx) - W * 0.2, rx = W * 0.22;
          ctx.save(); ctx.translate(x, fy); ctx.scale(1, 0.22);
          const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          fg.addColorStop(0, `rgba(130,110,180,${a})`); fg.addColorStop(1, 'rgba(130,110,180,0)');
          ctx.fillStyle = fg; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
          ctx.restore();
        }
      }
      // 혼불
      ctx.globalCompositeOperation = 'lighter';
      for (const s of souls) {
        s.y -= s.v * 0.016 * 6; s.a += 0.02;
        if (s.y < 0.3) { s.y = 1.02; s.x = rnd(); }
        const sx = (s.x + Math.sin(s.a) * 0.01) * W, sy = s.y * H;
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.s * 6);
        gr.addColorStop(0, 'rgba(190,220,255,.9)'); gr.addColorStop(0.3, 'rgba(130,150,255,.35)'); gr.addColorStop(1, 'rgba(100,80,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(sx - s.s * 6, sy - s.s * 6, s.s * 12, s.s * 12);
      }
      ctx.globalCompositeOperation = 'source-over';
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  // ── 캐릭터 생성 ──
  showCreate() {
    const g = this.game;
    this.root.querySelector('.menu').classList.add('hidden');
    this.root.classList.add('creating');
    this.root.querySelector('.logo').style.top = '5%';
    const look = { body: 'human', gender: 'm', hair: 0, hairColor: HAIR_COLORS[1], skin: SKINS[1], armor: 'tunic' };
    const box = el('div', 'iron rivets panel-center cc');
    box.style.top = '58%';
    box.innerHTML = `
      <h2>혼의 모습</h2>
      <div class="row">
        <div class="pv"><div class="frame"></div><div class="hint" style="text-align:center">기억은 희미하지만<br>모습은 남아 있다.</div></div>
        <div class="opts">
          <div><label class="k">이름</label><input class="name" maxlength="8" placeholder="이름을 새기시오 (2~8자)" spellcheck="false" autocomplete="off" enterkeyhint="go"></div>
          <div><label class="k">성별</label><div class="chips" data-k="gender"><button class="btn sm sel" data-v="m">남성</button><button class="btn sm" data-v="f">여성</button></div></div>
          <div><label class="k">머리 모양</label><div class="chips" data-k="hair">${HAIR_NAMES.map((n, i) => `<button class="btn sm${i === 0 ? ' sel' : ''}" data-v="${i}">${n}</button>`).join('')}</div></div>
          <div><label class="k">머리 색</label><div class="chips" data-k="hairColor">${HAIR_COLORS.map((c, i) => `<div class="sw${i === 1 ? ' sel' : ''}" data-v="${c}" style="background:${c}"></div>`).join('')}</div></div>
          <div><label class="k">피부</label><div class="chips" data-k="skin">${SKINS.map((c, i) => `<div class="sw${i === 1 ? ' sel' : ''}" data-v="${c}" style="background:${c}"></div>`).join('')}</div></div>
          <div class="hint err" style="color:#ff8a7a;min-height:16px"></div>
        </div>
      </div>
      <div class="acts"><button class="btn" data-a="back">돌아가기</button><button class="btn sm" data-a="rand">무작위</button><button class="btn gold" data-a="go">망각의 묘원으로</button></div>`;
    const pv = document.createElement('canvas');
    pv.width = pv.height = 360; pv.style.width = pv.style.height = '180px'; pv.className = 'portrait';
    box.querySelector('.frame').appendChild(pv);
    const redraw = () => paintPortrait(g, pv, look);
    redraw();
    const nameIn = box.querySelector('input.name');
    const pick = (chips, v) => {
      chips.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('sel', b.dataset.v === String(v)));
    };
    box.querySelectorAll('.chips').forEach((chips) => {
      chips.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        const k = chips.dataset.k;
        look[k] = k === 'hair' ? +b.dataset.v : b.dataset.v;
        pick(chips, b.dataset.v);
        g.bus.emit('sound', { id: 'ui_click' });
        redraw();
      });
    });
    const err = box.querySelector('.err');
    const go = () => {
      const name = nameIn.value.trim();
      if (name.length < 2) { err.textContent = '이름은 두 글자 이상이어야 합니다.'; nameIn.focus(); return; }
      if (/[{}<>]/.test(name)) { err.textContent = '쓸 수 없는 문자가 있습니다.'; return; }
      g.bus.emit('sound', { id: 'portal' });
      this.hide();
      g.newGame({ name, gender: look.gender, hair: look.hair, hairColor: look.hairColor, skin: look.skin });
    };
    box.querySelector('.acts').addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (!a) return;
      g.bus.emit('sound', { id: 'ui_click' });
      if (a === 'back') { box.remove(); this.root.classList.remove('creating'); this.root.querySelector('.menu').classList.remove('hidden'); this.root.querySelector('.logo').style.top = ''; }
      if (a === 'go') go();
      if (a === 'rand') {
        look.gender = Math.random() < 0.5 ? 'm' : 'f';
        look.hair = Math.floor(Math.random() * HAIR_NAMES.length);
        look.hairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
        look.skin = SKINS[Math.floor(Math.random() * SKINS.length)];
        box.querySelectorAll('.chips').forEach((c) => pick(c, look[c.dataset.k]));
        redraw();
      }
    });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
    // 터치: 화상 키보드가 가려도 진행 버튼이 보이도록 상자를 위로 올리고(.kb) 보이는 높이(--vvh)에 맞춘다
    nameIn.addEventListener('focus', () => { if (this.ui.mobile?.on) box.classList.add('kb'); });
    // (blur 직후 바로 옮기면 누르던 버튼이 손가락 밑에서 사라진다 → 잠시 뒤에)
    nameIn.addEventListener('blur', () => setTimeout(() => { if (document.activeElement === nameIn) return; box.classList.remove('kb'); try { window.scrollTo(0, 0); } catch { /* 무시 */ } }, 400));
    this.root.appendChild(box);
    if (!this.ui.mobile?.on) setTimeout(() => nameIn.focus(), 30); // 터치에선 자동으로 키보드를 띄우지 않음
  }
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
