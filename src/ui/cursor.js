// 마우스 커서: 고전 도트 커서 — 기본(금빛 화살) / 공격(칼) / 대화(말풍선) / 줍기(손).
// 16×16 도트 그림을 2배(32px)로 최근접 확대해 data URL 커서로 쓴다. 외부 에셋 없음.
const PAL = {
  k: '#1a0e04', w: '#fff6d0', y: '#e8b440', d: '#9a6418',
  s: '#f4f6fa', g: '#a8b0c0', n: '#5a6070', h: '#6a3a14', r: '#d83a2a',
  p: '#fff8e0', b: '#c8b48a', f: '#f4cc98', F: '#c08a52',
};
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
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = PAL[ch];
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
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = PAL[ch];
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
