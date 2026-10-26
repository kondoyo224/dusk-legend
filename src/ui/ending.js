// 엔딩 시퀀스: 에필로그 문장들 → 스태프 롤 → "로엔 마을에서 이어하기" → state.ended = true (포스트게임).
import { el, esc } from './dom.js';
import { pixelText } from './skin.js';

const EPILOGUE = [
  '탑이 무너지고, 잿빛 하늘이 갈라졌다.\n세 장의 찢긴 기록이 빛이 되어 하늘로 떠올랐다.',
  '귀혼의 서는 다시 온전해졌고,\n로엔의 혼들은 마침내 윤회의 강을 건넜다.',
  '로엔 신전의 종이 울렸다.\n사제 오드릭은 오랜만에 깊은 잠을 잤다.',
  '옛 묘지에는 누군가 들꽃을 심었다.\n밤마다 들리던 울음은 이제 바람 소리뿐이다.',
  '{sibling}! — 리나가 달려와 품에 안겼다.\n한 번 죽었던 자의 가슴이, 따뜻하게 뛰고 있었다.',
  '그리고 {name}.\n죽음에서 돌아와 경계를 지키는 자 — 귀혼자(歸魂者).',
  '황혼은 끝나지 않는다.\n다만, 이제 그 앞을 지키는 이가 있을 뿐.',
];

const CREDITS = [
  ['h', '황혼의 전설'],
  ['s', '歸魂의 書'],
  ['gap'],
  ['role', '총괄 · 설계 · 통합'], ['who', '관리자 세션'],
  ['role', '렌더링 · 그래픽'], ['who', '워커 A'],
  ['role', '게임플레이 시스템'], ['who', '워커 B'],
  ['role', 'UI · 사운드'], ['who', '워커 C'],
  ['role', '세계관 · 이야기 · 지도'], ['who', '워커 D'],
  ['gap'],
  ['role', '등장인물'],
  ['who', '기록자 세린'], ['who', '사제 오드릭'], ['who', '촌장 하르딘'], ['who', '대장장이 브론'], ['who', '잡화상 미라'],
  ['who', '여관주인 토마'], ['who', '교관 가렌'], ['who', '리나'],
  ['who', '흑마도사 벨자르'], ['who', '황혼의 왕의 그림자 모르데카이'],
  ['gap'],
  ['role', '그리고 귀혼자'], ['who', '{name}'],
  ['gap'],
  ['role', '모든 그림과 소리는'], ['who', '코드로 빚어졌습니다'],
  ['gap'],
  ['role', '쿼터뷰 RPG 의 밤을 사랑했던'], ['who', '모든 모험가에게'],
  ['gap'], ['gap'],
  ['h', '끝'],
];

export class Ending {
  constructor(ui) {
    this.ui = ui; this.game = ui.game; this.root = null; this.stage = null;
    this.game.bus.on('game:ending', ({ id }) => this.start(id));
  }
  get active() { return !!this.root; }

  start(id = 'main') {
    if (this.root) return;
    const g = this.game;
    this.id = id;
    g.cutscene = true;
    g.controller?.clearOrders?.();
    this.ui.closeAll();
    g.bus.emit('bgm', { id: 'ending' });
    const r = this.root = el('div');
    r.id = 'ending';
    r.innerHTML = '<canvas class="bg"></canvas><div class="ep" style="opacity:0"></div><div class="skip">클릭 / Space: 넘기기</div>';
    this.ui.root.appendChild(r);
    this.cv = r.querySelector('canvas'); this.ep = r.querySelector('.ep');
    this.t = 0; this.idx = -1; this.lineT = 0;
    this.stage = 'epi';
    this.particles = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05, s: 0.5 + Math.random() * 2, p: Math.random() * 6 }));
    r.addEventListener('click', () => this.skip());
    this.nextLine();
  }

  nextLine() {
    this.idx++;
    if (this.idx >= EPILOGUE.length) return this.startRoll();
    const g = this.game;
    this.ep.style.opacity = 0;
    setTimeout(() => {
      if (this.stage !== 'epi') return;
      this.ep.innerHTML = esc(g.format(EPILOGUE[this.idx])).replace(/\n/g, '<br>');
      this.ep.style.opacity = 1;
    }, this.idx === 0 ? 1500 : 900);
    this.lineT = this.idx === 0 ? 7.5 : 6.2;
  }

  startRoll() {
    const g = this.game;
    this.stage = 'roll';
    this.ep.style.opacity = 0;
    const roll = this.roll = el('div', 'roll');
    roll.innerHTML = CREDITS.map(([k, v]) => {
      if (k === 'gap') return '<div class="gap"></div>';
      if (k === 'h') return `<div class="h" data-t="${esc(v)}"></div>`;
      if (k === 's') return `<div class="sub">${esc(v)}</div>`;
      return `<div class="${k}">${esc(g.format(v))}</div>`;
    }).join('');
    roll.querySelectorAll('.h').forEach((h) => h.appendChild(pixelText(h.dataset.t, { px: 16, scale: 3 })));
    this.root.appendChild(roll);
    this.rollY = 0;
  }

  finish() {
    this.stage = 'fin';
    this.roll?.remove();
    const g = this.game;
    const fin = el('div', 'fin', `<div class="f1"></div><div class="box iron"><div class="f2">플레이 시간 ${Math.floor((g.state?.playTime ?? 0) / 3600)}시간 ${Math.floor(((g.state?.playTime ?? 0) % 3600) / 60)}분 · Lv ${g.player?.level ?? 1}</div>
      <div class="f2">이야기는 끝났지만, 경계의 땅은 여전히 그대를 기다린다.<br>마을의 상인들은 새 물건을 들였고, 기록자는 망각의 균열을 열어 두었다.</div>
      <button class="btn gold">로엔 마을에서 이어하기</button></div>`);
    fin.querySelector('.f1').appendChild(pixelText('- 끝 -', { px: 16, scale: 4 }));
    fin.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); this.continueAfter(); });
    this.root.appendChild(fin);
    this.root.querySelector('.skip').remove();
  }

  continueAfter() {
    const g = this.game, s = g.state;
    g.bus.emit('sound', { id: 'portal' });
    if (s) {
      s.ended = true;
      s.chapter = 4;
      if (!s.flags['end.cleared']) { s.flags['end.cleared'] = true; g.bus.emit('flags:changed', { key: 'end.cleared' }); }
    }
    this.root.remove(); this.root = null; this.stage = null;
    g.cutscene = false;
    if (g.player?.dead || g.player?.hp <= 0) g.systems.stats?.revive?.(g.player);
    if (g.data.maps.village_roen) {
      if (g.world.map?.id === 'village_roen') g.save();
      else g.changeMap('village_roen');
    } else g.save();
    g.bus.emit('ui:endingDone', {});
    setTimeout(() => g.bus.emit('ui:notice', { text: '자유 모험', sub: '엔딩 이후의 세계 — 사냥하고, 모으고, 더 깊은 곳으로.' }), 900);
  }

  skip() {
    if (this.stage === 'epi') { this.lineT = 0; }
    else if (this.stage === 'roll') { this.rollSpeed = 6; }
  }

  update(dt) {
    if (!this.root) return;
    this.t += dt;
    const inp = this.game.input;
    if (inp.pressed('Space') || inp.pressed('Enter')) this.skip();
    if (this.stage === 'epi') {
      this.lineT -= dt;
      if (this.lineT <= 0) this.nextLine();
    } else if (this.stage === 'roll') {
      this.rollY += dt * 46 * (this.rollSpeed ?? 1);
      this.roll.style.transform = `translateY(${-this.rollY}px)`;
      if (this.rollY > this.roll.offsetHeight + window.innerHeight * 0.55) this.finish();
    }
    this.drawBg(dt);
  }

  // 고전풍 배경: 픽셀 해상도(1/4)로 그린 계단식 하늘 띠 + 체커 디더 + 2×2 도트 빛가루 + 계단 언덕
  drawBg(dt) {
    const cv = this.cv, ctx = cv.getContext('2d');
    const W = Math.max(1, Math.ceil(cv.clientWidth / 4)), H = Math.max(1, Math.ceil(cv.clientHeight / 4));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const k = Math.min(1, this.t / 20); // 어둠 → 새벽
    const top = mix('#04030a', '#1a2a4a', k), midC = mix('#0a0612', '#7a4a5a', k), bot = mix('#020104', '#e8a060', k);
    const BANDS = 10, bh = Math.ceil(H / BANDS);
    const bandCol = (i) => { const f = i / (BANDS - 1); return f < 0.6 ? mixRgb(top, midC, f / 0.6) : mixRgb(midC, bot, (f - 0.6) / 0.4); };
    for (let i = 0; i < BANDS; i++) {
      ctx.fillStyle = bandCol(i); ctx.fillRect(0, i * bh, W, bh);
      if (i < BANDS - 1) { // 띠 경계 디더(체커)
        ctx.fillStyle = bandCol(i + 1);
        for (let y = 0; y < 2; y++) for (let x = (y & 1); x < W; x += 2) ctx.fillRect(x, (i + 1) * bh - 2 + y, 1, 1);
      }
    }
    for (const p of this.particles) {
      p.y -= p.v * dt; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      const x = Math.round((p.x + Math.sin(this.t * 0.5 + p.p) * 0.01) * W), y = Math.round(p.y * H);
      ctx.fillStyle = p.s > 1.6 ? '#fff4d0' : '#e8c890';
      ctx.fillRect(x, y, p.s > 1.2 ? 2 : 1, p.s > 1.2 ? 2 : 1);
    }
    ctx.fillStyle = '#0a0608';
    for (let x = 0; x < W; x += 3) ctx.fillRect(x, Math.round(H * 0.86 + Math.sin(x * 0.02) * 4), 3, H);
  }
}

function mixRgb(a, b, k) { // 'rgb(r,g,b)' 두 개를 섞는다
  const pa = a.match(/\d+/g).map(Number), pb = b.match(/\d+/g).map(Number);
  k = Math.max(0, Math.min(1, k));
  return `rgb(${pa.map((v, i) => Math.round(v * (1 - k) + pb[i] * k)).join(',')})`;
}
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
