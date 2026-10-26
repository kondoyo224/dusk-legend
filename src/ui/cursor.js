// 마우스 커서: 고전 도트 커서 — 기본(금빛 화살) / 공격(칼) / 대화(말풍선) / 줍기(손).
// 16×16 도트 그림을 2배(32px)로 최근접 확대해 data URL 커서로 쓴다. 외부 에셋 없음.
// v2 하이컬러: 칠(y/s/g/p/f)은 재질 램프로 자동 명암(좌상단 광원: 위·왼쪽 가장자리 밝게, 아래·오른쪽 어둡게, 휴 시프트),
// 외곽 k 는 선택적(형태의 위·왼쪽 바깥은 따뜻한 적갈, 아래·오른쪽은 짙은 남보라).
import { RAMP } from './skin.js';
const PAL = {
  k: '#1c0c1a', w: '#fff6d2', y: '#e4ac32', d: '#864c18',
  s: '#f4f0e0', g: '#98a2ae', n: '#4a526a', h: '#5c3222', r: '#c84428',
  p: '#fff8e4', b: '#c4b492', f: '#f4cc98', F: '#b87a4c',
};
const SKIN = ['#3a1c24', '#6a3a34', '#9a5a44', '#c08a52', '#dca472', '#f4cc98', '#ffe4c0', '#fff4e0'];
const PARCH = ['#2e2236', '#5a4a52', '#8a7a6c', '#b4a488', '#d4c4a4', '#ece0c4', '#fff8e4', '#ffffff'];
const AUTO = { y: [RAMP.gold, 6.4], s: [RAMP.steel, 8.6], g: [RAMP.steel, 6.6], p: [PARCH, 5.4], f: [SKIN, 5] };
const OL_LIT = '#5e2a1c';
// 문자 격자 → 도트 색 격자(자동 명암 + 선택적 외곽)
function shadeArt(rows) {
  const at = (x, y) => (rows[y]?.[x] ?? '.');
  const solid = (x, y) => at(x, y) !== '.';
  const fill = (x, y) => solid(x, y) && at(x, y) !== 'k';
  return rows.map((row, y) => [...row].map((ch, x) => {
    if (ch === '.') return null;
    if (ch === 'k') { // 형태가 오른쪽/아래에만 있으면 빛 받는 쪽 외곽
      const litSide = (fill(x + 1, y) || fill(x, y + 1)) && !fill(x - 1, y) && !fill(x, y - 1);
      return litSide ? OL_LIT : PAL.k;
    }
    const a = AUTO[ch];
    if (!a) return PAL[ch];
    const [ramp, base] = a;
    let v = base - (x + y) * 0.09;
    if (!fill(x, y - 1)) v += 1.4; if (!fill(x - 1, y)) v += 0.8;
    if (!fill(x, y + 1)) v -= 1.4; if (!fill(x + 1, y)) v -= 1;
    return ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(v)))];
  }));
}
const ART = {
  normal: [
    'k...............',
    'kk..............',
    'kwk.............',
    'kwyk............',
    'kwyyk...........',
    'kwyyyk..........',
    'kwyyyyk.........',
    'kwyyyyyk........',
    'kwyyyyyyk.......',
    'kwyyyyyyyk......',
    'kwyyyykkkkk.....',
    'kwydyyk.........',
    'kwdkkyyk........',
    'kdk..kyyk.......',
    'kk...kddk.......',
    '......kk........',
  ],
  attack: [
    'kk..............',
    'kswk............',
    'kwsgk...........',
    '.ksgnk..........',
    '..kgsnk.........',
    '...kgsnk........',
    '....kgsnk.......',
    '.....kgsnk..kk..',
    '......kgsnk.kyk.',
    '.......kgsnkyk..',
    '........kgsyk...',
    '.........kyydk..',
    '........kyk.khk.',
    '.......kyk...khk',
    '........k.....kr',
    '...............k',
  ],
  talk: [
    '................',
    '...kkkkkkkkkk...',
    '..kppppppppppk..',
    '.kppppppppppppk.',
    '.kppppppppppppk.',
    '.kpkkpppkkpppkkb',
    '.kpkkpppkkpppkkb',
    '.kppppppppppppkb',
    '.kbppppppppppbkb',
    '..kbbbpbbbbbbk..',
    '...kkkpbkkkkk...',
    '....kpbk........',
    '...kpbk.........',
    '...kbk..........',
    '..kk............',
    '................',
  ],
  pickup: [
    '.....kk.........',
    '....kffk........',
    '....kffk........',
    '....kffkkk......',
    '....kffkffkk....',
    '....kffkffkfk...',
    '.kk.kffkffkffk..',
    'kffkkfffffkffk..',
    'kfffkffffffffk..',
    '.kffkfffffffFk..',
    '..kfffffffffFk..',
    '..kffffffffFk...',
    '...kffffffFFk...',
    '....kFFFFFFk....',
    '....kkkkkkkk....',
    '................',
  ],
};
const HOT = { normal: [0, 0], attack: [1, 1], talk: [2, 14], pickup: [5, 1] };

function make(rows, hx, hy) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  shadeArt(rows).forEach((row, y) => row.forEach((col, x) => {
    if (!col) return;
    ctx.fillStyle = col; ctx.fillRect(x * 2, y * 2, 2, 2);
  }));
  return `url(${c.toDataURL()}) ${hx * 2} ${hy * 2}, auto`;
}

// 같은 도트 그림을 버튼 아이콘으로 (터치 공격 버튼 등). scale 배 최근접 확대 캔버스.
export function pixelArt(kind, scale = 2) {
  const rows = ART[kind] ?? ART.normal;
  const c = document.createElement('canvas');
  c.width = c.height = 16 * scale;
  c.className = 'icon';
  const ctx = c.getContext('2d');
  shadeArt(rows).forEach((row, y) => row.forEach((col, x) => {
    if (!col) return;
    ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  return c;
}

export function buildCursors() {
  try {
    const out = {};
    for (const k of Object.keys(ART)) out[k] = make(ART[k], HOT[k][0], HOT[k][1]);
    return out;
  } catch {
    return { normal: 'default', attack: 'crosshair', talk: 'pointer', pickup: 'grab' };
  }
}

export class CursorCtl {
  constructor(game) {
    this.game = game; this.cur = null; this.acc = 0;
    this.cursors = buildCursors();
    this.set('normal');
  }
  set(kind) {
    if (this.cur === kind) return;
    this.cur = kind;
    this.game.canvas.style.cursor = this.cursors[kind] ?? 'default';
    document.getElementById('ui-root').style.cursor = this.cursors.normal;
  }
  update(dt) {
    this.acc += dt;
    if (this.acc < 0.05) return;
    this.acc = 0;
    const g = this.game, m = g.input.mouse;
    if (g.scene !== 'play' || !m.inCanvas || !g.world?.map) return this.set('normal');
    let e = null;
    try { e = g.renderer.pickEntity?.(m.x, m.y) ?? null; } catch { e = null; }
    if (!e) {
      const t = g.renderer.screenToTile?.(m.x, m.y);
      if (t) e = g.world.entitiesAt(t.x, t.y).find((x) => x !== g.player) ?? null;
    }
    if (e?.kind === 'monster' && !e.dead) this.set('attack');
    else if (e?.kind === 'npc') this.set('talk');
    else if (e?.kind === 'drop') this.set('pickup');
    else this.set('normal');
  }
}
