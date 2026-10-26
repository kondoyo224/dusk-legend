// 시스템 메뉴(Esc): 계속, 저장, 불러오기, 음량, 조작법, 타이틀로. + 공용 모달/확인창.
import { el, esc } from './dom.js';

export function helpHtml() {
  const rows = [
    ['WASD / 방향키', '8방향 이동 (두 키 동시 = 대각선). 누르고 있으면 끊김 없이 계속 이동'],
    ['좌클릭', '땅: 이동 · 적: 추적 후 연속 공격 · 인물: 다가가서 대화 · 물건: 줍기'],
    ['좌클릭 유지', '커서 방향으로 계속 이동'],
    ['Space', '공격 (누르고 있으면 연타). 앞이 비면 인접한 적을 자동 조준'],
    ['1 ~ 0', '단축키 (기술 / 물약)'],
    ['F / E', '가까운 인물과 대화 · 발밑 물건 줍기'],
    ['Tab', '가까운 적 순서대로 지정'],
    ['I / K / C / J / M', '소지품 / 기술 / 능력치 / 의뢰 일지 / 지도'],
    ['Enter', '대화 입력 (/저장, /위치, /시간)'],
    ['Esc', '창 닫기 → 시스템 메뉴'],
    ['대화 중', 'Space·Enter·클릭: 넘기기 · 숫자키/방향키: 선택'],
  ];
  return `<table class="help-table">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
}

export class SystemMenu {
  constructor(ui) { this.ui = ui; this.game = ui.game; this.root = null; }
  get isOpen() { return !!this.root; }
  toggle() { if (this.root) this.close(); else this.open(); }
  open() {
    if (this.root) return;
    const g = this.game, a = g.audio;
    const r = this.root = el('div', 'ui-sys');
    r.innerHTML = `<div class="dim-bg"></div><div class="iron rivets panel-center modal sysmenu">
      <h2>쉼터</h2>
      <button class="btn gold" data-a="resume">계속하기</button>
      <button class="btn" data-a="save">여정 기록 (저장)</button>
      <button class="btn" data-a="load">마지막 기록 불러오기</button>
      <div class="sec-title" style="color:var(--gold);border-color:#444">소리</div>
      ${[['master', '전체'], ['bgm', '음악'], ['sfx', '효과음']].map(([k, n]) => `<div class="vol"><span>${n}</span><input type="range" min="0" max="100" data-v="${k}" value="${Math.round((a?.settings?.[k] ?? 0.7) * 100)}"><span class="pv">${Math.round((a?.settings?.[k] ?? 0.7) * 100)}</span></div>`).join('')}
      <button class="btn" data-a="help">조작법</button>
      <button class="btn" data-a="title">타이틀로</button>
    </div>`;
    r.querySelector('.dim-bg').addEventListener('click', () => this.close());
    r.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
      inp.nextElementSibling.textContent = inp.value;
      a?.setVolume?.(inp.dataset.v, inp.value / 100);
    }));
    r.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('change', () => g.bus.emit('sound', { id: 'ui_click' })));
    r.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.a;
      if (!act) return;
      g.bus.emit('sound', { id: 'ui_click' });
      if (act === 'resume') this.close();
      if (act === 'save') { const ok = g.save(); this.ui.toast(ok ? '여정을 기록했다.' : '기록에 실패했다.'); this.close(); }
      if (act === 'load') this.ui.confirm('마지막 기록으로 돌아갈까요? 저장하지 않은 진행은 사라집니다.', () => {
        this.close();
        this.ui.closeAll();
        if (!g.continueGame()) this.ui.toast('불러올 기록이 없다.');
      });
      if (act === 'help') this.ui.modal('조작법', helpHtml());
      if (act === 'title') this.ui.confirm('타이틀 화면으로 돌아갈까요? (현재 진행을 저장합니다)', () => {
        g.save();
        location.href = location.pathname;
      });
    });
    this.ui.root.appendChild(r);
    g.bus.emit('sound', { id: 'ui_open' });
  }
  close() { this.root?.remove(); this.root = null; }
}

// 공용 모달 (닫기 버튼, 배경 클릭/Esc 로 닫힘)
export function makeModal(ui, title, html, buttons = [['닫기', null]]) {
  const r = el('div', 'ui-modal');
  r.innerHTML = `<div class="dim-bg"></div><div class="iron rivets panel-center modal"><h2>${esc(title)}</h2><div class="mb">${html}</div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">${buttons.map(([n], i) => `<button class="btn${i === 0 ? ' gold' : ''}" data-i="${i}">${esc(n)}</button>`).join('')}</div></div>`;
  const close = () => { r.remove(); ui.modals = ui.modals.filter((m) => m !== close); };
  r.querySelector('.dim-bg').addEventListener('click', close);
  r.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => {
    ui.game.bus.emit('sound', { id: 'ui_click' });
    close();
    buttons[+b.dataset.i][1]?.();
  }));
  ui.root.appendChild(r);
  ui.modals.push(close);
  return close;
}
