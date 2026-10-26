// 디버그 쇼케이스: ?showcase=1..5 (또는 숫자키로 전환), &sz=2 → 도트 2배 확대(왼쪽 위 1/4 영역). 모든 body/장비/타일/오브젝트/아이콘을 늘어놓는다. 소유: 워커 A.
import { TILES } from '../data/tiles.js';
import { getSprite, getVariant } from './sprites.js';
import { drawGroundTile, drawGroundAnim, objectSprite, drawObjectAnim, ANIMATED_OBJECTS } from './tiles.js';
import { drawItemIcon, drawSkillIcon, drawPortrait, goldIcon } from './icons.js';
import { FONT_KO } from './fx.js';
import { makeCanvas } from './util.js';

const BODIES = ['human', 'shade', 'wraith', 'knight_spirit', 'rat', 'wolf', 'boar', 'spider', 'goblin', 'skeleton', 'zombie', 'bat', 'ghoul', 'gravekeeper', 'golem', 'knight_dark', 'lich', 'dusk_king', 'slime', 'skeleton_archer', 'cultist'];
const HUMANS = [
  { label: '맨몸(혼)', look: { body: 'human', gender: 'm', hair: 0, hairColor: '#3b2a1e', skin: '#e8c4a0' }, ghost: true },
  { label: '튜닉+목검', look: { body: 'human', gender: 'm', hair: 3, hairColor: '#5a3a1a', skin: '#e0b890', armor: 'tunic', weapon: 'sword_wood', boots: 'boots_leather' } },
  { label: '가죽+단검+나무방패', look: { body: 'human', gender: 'f', hair: 1, hairColor: '#8a4a2a', skin: '#f0d0b0', armor: 'leather', weapon: 'sword_short', shield: 'shield_wood', helm: 'cap_leather', boots: 'boots_leather' } },
  { label: '사슬+장검+철방패', look: { body: 'human', gender: 'm', hair: 2, hairColor: '#2a1a10', skin: '#d8a880', armor: 'chain', weapon: 'sword_long', shield: 'shield_iron', helm: 'helm_iron', boots: 'boots_iron' } },
  { label: '비늘+광검', look: { body: 'human', gender: 'f', hair: 5, hairColor: '#d8c890', skin: '#f0d0b0', armor: 'scale', weapon: 'sword_broad', shield: 'shield_iron', boots: 'boots_iron' } },
  { label: '판금+기사검+탑방패', look: { body: 'human', gender: 'm', hair: 0, hairColor: '#1a1a1a', skin: '#e8c4a0', armor: 'plate', weapon: 'sword_knight', shield: 'shield_tower', helm: 'helm_knight', boots: 'boots_iron' } },
  { label: '황혼판금+대검', look: { body: 'human', gender: 'm', hair: 4, hairColor: '#c8c8d0', skin: '#e8c4a0', armor: 'dusk_plate', weapon: 'sword_great', boots: 'boots_iron' } },
  { label: '아르겐의 검/도끼/철퇴', look: { body: 'human', gender: 'f', hair: 2, hairColor: '#f0e0c0', skin: '#f0d0b0', armor: 'plate', weapon: 'sword_argen', boots: 'boots_iron' } },
  { label: 'NPC 로브+수염', look: { body: 'human', gender: 'm', hair: 4, hairColor: '#d8d8d8', skin: '#e0b898', robe: '#5a4a7a', beard: true } },
  { label: 'NPC 앞치마', look: { body: 'human', gender: 'f', hair: 1, hairColor: '#4a2a1a', skin: '#f0c8a8', robe: '#6a5a3a', apron: '#d8d0c0' } },
];
const ITEMS = ['wooden_sword', 'short_sword', 'long_sword', 'broad_sword', 'knight_sword', 'claymore', 'argen_blade', 'cloth_tunic', 'leather_armor', 'chain_mail', 'scale_mail', 'plate_armor', 'dusk_plate',
  'wooden_shield', 'iron_shield', 'tower_shield', 'leather_cap', 'iron_helm', 'knight_helm', 'leather_boots', 'iron_boots', 'copper_ring', 'ruby_ring', 'guardian_amulet', 'serin_pendant',
  'red_potion', 'red_potion_m', 'red_potion_l', 'blue_potion', 'soul_vial', 'return_scroll', 'shard_body', 'shard_mind', 'shard_soul', 'torn_page_1', 'rat_tail', 'wolf_pelt', 'crypt_key', 'grave_dust'];
const SKILLS = ['power_strike', 'whirlwind', 'charge', 'war_cry', 'iron_wall', 'earth_splitter'];
const STATES = [['idle', 1.6], ['walk', 0.9], ['attack', 0.34], ['hurt', 0.28], ['cast', 0.5], ['dead', 0.6]];

export class Showcase {
  constructor(renderer) {
    this.r = renderer;
    const q = new URLSearchParams(location.search);
    this.page = +(q.get('showcase') || 1) || 1;
    this.sz = Math.max(1, +(q.get('sz') || 1) || 1);
    this.off = null;
    const root = document.getElementById('ui-root');
    if (root) root.style.display = 'none';
    window.addEventListener('keydown', (e) => { const n = +e.key; if (n >= 1 && n <= 5) this.page = n; });
  }

  render(main, dt, time) {
    let ctx = main;
    const { W, H } = this.r;
    if (this.sz > 1) {
      if (!this.off || this.off.width !== W) this.off = makeCanvas(W, H);
      ctx = this.off.getContext('2d');
    }
    this.draw(ctx, dt, time, W, H);
    if (this.sz > 1) {
      main.setTransform(1, 0, 0, 1, 0, 0); main.imageSmoothingEnabled = false;
      main.drawImage(this.off, 0, 0, W / this.sz, H / this.sz, 0, 0, W, H);
    }
  }

  draw(ctx, dt, time, W, H) {
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#16141c'; ctx.fillRect(0, 0, W, H);
    text(ctx, `쇼케이스 ${this.page}/5  (숫자키 1~5: 인간형 / 몬스터 / 지면 / 오브젝트 / 아이콘)`, 12, 20, '#c8c0a0', 13, 'left');
    [this.humans, this.monsters, this.grounds, this.objects, this.icons][this.page - 1]?.call(this, ctx, time, W, H);
  }

  humans(ctx, time) {
    const cellW = 74, rowH = 66;
    HUMANS.forEach((h, row) => {
      const y = 92 + row * rowH;
      text(ctx, h.label, 10, y - 16, '#a8a090', 11, 'left');
      for (let d = 0; d < 8; d++) {
        const x = 150 + d * cellW;
        const st = (Math.floor(time / 2.5) + row) % 3 === 0 ? 'idle' : (Math.floor(time / 2.5) + row) % 3 === 1 ? 'walk' : 'attack';
        const k = st === 'walk' ? (time * 1.6) % 1 : st === 'attack' ? (time % 0.8) / 0.8 * 1.0 : (time * 0.5) % 1;
        this.sprite(ctx, h.look, d, st === 'attack' && k > 0.99 ? 'idle' : st, Math.min(0.999, k), x, y, h.ghost);
      }
    });
    // 상태 열
    const look = HUMANS[5].look;
    STATES.forEach(([st, dur], i) => {
      const x = 790 + (i % 3) * 120, y = 140 + Math.floor(i / 3) * 140;
      text(ctx, st, x, y + 24, '#a8a090', 12);
      const k = st === 'idle' || st === 'walk' ? (time / dur) % 1 : Math.min(0.999, (time % (dur + 0.6)) / dur);
      this.sprite(ctx, look, 3, st, k, x, y, false, 1.6);
    });
    text(ctx, '섬광 / 외곽선 / 혼', 970, 470, '#a8a090', 12);
    const s = getSprite(HUMANS[3].look, 4, 'idle', 0.3);
    ctx.drawImage(getVariant(s, 'flash'), 860 - s.ax, 540 - s.ay);
    ctx.drawImage(getVariant(s, 'outline:#ff4a3a'), 960 - s.ax, 540 - s.ay); ctx.drawImage(s.canvas, 960 - s.ax, 540 - s.ay);
    ctx.globalAlpha = 0.68; ctx.drawImage(getVariant(s, 'ghost'), 1060 - s.ax, 540 - s.ay); ctx.globalAlpha = 1;
    // 초상화
    HUMANS.slice(1, 7).forEach((h, i) => { ctx.fillStyle = '#2a2430'; ctx.fillRect(800 + i * 70, 620, 64, 64); drawPortrait(ctx, h.look, 800 + i * 70, 620, 64); });
  }

  monsters(ctx, time) {
    const cols = 7, cw = 170, rh = 230;
    BODIES.forEach((b, i) => {
      const x = 90 + (i % cols) * cw, y = 150 + Math.floor(i / cols) * rh;
      const look = { body: b, ...(b === 'human' ? { robe: '#3a1418', hair: 0, hairColor: '#222' } : {}), ...(b === 'cultist' ? {} : {}) };
      const phase = Math.floor(time / 1.6) % 3;
      const st = phase === 0 ? 'walk' : phase === 1 ? 'attack' : 'idle';
      const k = st === 'attack' ? Math.min(0.999, (time % 1.6) / 0.6) : (time * 1.2) % 1;
      const d = Math.floor(time / 4.8) % 8;
      this.sprite(ctx, look, (d + 3) % 8, st === 'attack' && k >= 0.999 ? 'idle' : st, k, x, y, false, 1.4);
      this.sprite(ctx, look, (d + 7) % 8, 'walk', (time * 1.2) % 1, x + 70, y, false, 1);
      text(ctx, b, x + 30, y + 30, '#c8c0a0', 12);
    });
    // 보스 스케일/틴트
    this.sprite(ctx, { body: 'wolf', scale: 1.7, tint: '#3a1a2a' }, 3, 'walk', (time * 1.2) % 1, 1150, 640, false, 1);
    text(ctx, 'grimfang (scale 1.7, tint)', 1150, 680, '#c8c0a0', 11);
  }

  sprite(ctx, look, dir, state, k, x, y, ghost, zoom = 1) {
    const s = getSprite(look, dir, state, k, 0);
    ctx.save(); ctx.translate(x, y); ctx.scale(zoom, zoom);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 1, 14 * (look.scale ?? 1), 6 * (look.scale ?? 1), 0, 0, Math.PI * 2); ctx.fill();
    if (ghost) { ctx.globalAlpha = 0.68; ctx.drawImage(getVariant(s, 'ghost'), -s.ax, -s.ay); }
    else ctx.drawImage(s.canvas, -s.ax, -s.ay);
    ctx.restore();
  }

  grounds(ctx, time) {
    const ids = Object.keys(TILES).filter((id) => TILES[id].layer === 'ground');
    // 3x3 패치로 각 지면 표시
    ids.forEach((id, i) => {
      const ox = 110 + (i % 7) * 170, oy = 110 + Math.floor(i / 7) * 170;
      const fake = { groundAt: (x, y) => (x >= 0 && y >= 0 && x < 3 && y < 3 ? id : (i % 2 ? 'grass' : 'void')), objAt: () => null };
      for (let s = 0; s < 5; s++) for (let x = 0; x < 3; x++) { const y = s - x; if (y < 0 || y > 2) continue;
        const cx = ox + (x - y) * 32, cy = oy + (x + y) * 16;
        drawGroundTile(ctx, id, cx, cy, x + i * 7, y, fake);
        drawGroundAnim(ctx, id, cx, cy, x, y, time);
      }
      text(ctx, id, ox, oy + 76, '#c8c0a0', 12);
    });
  }

  objects(ctx, time) {
    const ids = Object.keys(TILES).filter((id) => TILES[id].layer === 'object');
    ids.forEach((id, i) => {
      const cx = 70 + (i % 10) * 124, cy = 170 + Math.floor(i / 10) * 175;
      drawGroundTile(ctx, i % 3 === 0 ? 'stone_floor' : i % 3 === 1 ? 'grass' : 'dirt', cx, cy, i, 0, null);
      const s = objectSprite(id, i, 0, null);
      ctx.drawImage(s.canvas, cx - s.ax, cy - s.ay);
      if (ANIMATED_OBJECTS.has(id)) drawObjectAnim(ctx, id, cx, cy, i, 0, time);
      text(ctx, id, cx, cy + 34, '#c8c0a0', 11);
    });
  }

  icons(ctx) {
    const g = this.r.game;
    ITEMS.forEach((id, i) => {
      const x = 30 + (i % 13) * 96, y = 60 + Math.floor(i / 13) * 92;
      ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y, 48, 48);
      drawItemIcon(g, ctx, id, x, y, 48);
      text(ctx, id, x + 24, y + 62, '#a8a090', 10);
    });
    goldIcon(ctx, 30, 340, 48); text(ctx, 'gold', 54, 402, '#a8a090', 10);
    SKILLS.forEach((id, i) => { drawSkillIcon(g, ctx, id, 140 + i * 90, 340, 48); text(ctx, id, 164 + i * 90, 402, '#a8a090', 10); });
    // 아이콘 크기별
    [16, 24, 32, 40, 64].forEach((s, i) => { drawItemIcon(g, ctx, 'knight_sword', 30 + i * 80, 440, s); drawSkillIcon(g, ctx, 'whirlwind', 30 + i * 80, 520, s); });
    BODIES.slice(1, 12).forEach((b, i) => { ctx.fillStyle = '#2a2430'; ctx.fillRect(30 + i * 80, 620, 64, 64); drawPortrait(ctx, { body: b }, 30 + i * 80, 620, 64); });
  }
}

function text(ctx, s, x, y, color, size, align = 'center') {
  ctx.font = `${size}px ${FONT_KO}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
