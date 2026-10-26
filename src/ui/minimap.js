// 미니맵 & 지도창: 맵 그리드를 1px=1타일 오프스크린 이미지로 굽고, 아핀 변환으로 쿼터뷰(마름모) 투영해 그린다.
export const TILE_COLOR = {
  grass: '#3e5a2c', grass_dark: '#2c4220', dirt: '#5a4630', path: '#7a6644', stone_floor: '#55545a', cobble: '#6a6660',
  wood_floor: '#6a4a2a', carpet_red: '#7a2222', sand: '#a8925e', swamp: '#3a4630', bridge: '#7a5a34', marble: '#8a8a94',
  mist_floor: '#4a4266', bone_floor: '#5a524a', ash: '#4a4444', water: '#24466a', deep_water: '#142a4a', lava: '#c8401a', void: null,
};
const OBJ_COLOR = {
  wall: '#1a1a1e', tree: '#1e3416', pine: '#18301a', dead_tree: '#2a2420', wall_spirit: '#6a5aa8',
  portal_glow: '#b08aff', stairs_down: '#c8b070', stairs_up: '#c8b070', torch: '#ffa046', brazier: '#ff8a30', lamp_post: '#ffd27a',
  crystal: '#7fd8ff', altar: '#c9b6ff', shrine: '#fff0b0',
};

export function bakeMap(world, TILES) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, world.w); c.height = Math.max(1, world.h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  const put = (i, hex, a = 255) => { const n = parseInt(hex.slice(1), 16); img.data[i] = n >> 16; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = a; };
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const i = (y * c.width + x) * 4;
    const g = world.groundAt(x, y), o = world.objAt(x, y);
    const gc = TILE_COLOR[g];
    if (!gc) continue;
    let col = gc;
    if (o) {
      if (OBJ_COLOR[o]) col = OBJ_COLOR[o];
      else if (o.startsWith('wall')) col = OBJ_COLOR.wall;
      else if (!TILES[o]?.walk) col = shade(gc, -0.35);
    }
    put(i, col);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + k))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}

// 엔티티/포탈 표식 그리기 (ctx 는 이미 iso 변환이 걸리지 않은 화면 좌표계). proj(x,y) → {x,y}
export function drawMarkers(game, ctx, proj, scale, t, opts = {}) {
  const w = game.world, p = game.player;
  for (const po of w.map?.portals || []) {
    if (po.cond && !game.script.check(po.cond)) continue;
    const s = proj(po.x + 0.5, po.y + 0.5);
    const r = Math.round(Math.max(2, scale * 0.9));
    dotSq(ctx, s.x, s.y, r, Math.sin(t * 4) > 0 ? '#d0b0ff' : '#8a5ad8');
  }
  for (const e of w.entities) {
    if (e === p || e.dead) continue;
    const s = proj(e.rx + 0.5, e.ry + 0.5);
    let col = null, r = Math.max(1.6, scale * 0.55);
    if (e.kind === 'monster') { col = e.boss ? '#ff8a2a' : '#e8383a'; if (e.boss) r *= 1.8; }
    else if (e.kind === 'npc') { col = '#ffe14a'; r *= 1.2; }
    else if (e.kind === 'drop') { col = '#ffffff'; r *= 0.7; }
    if (!col) continue;
    dotSq(ctx, s.x, s.y, Math.max(1, Math.round(r)), col);
    if (opts.labels && e.kind === 'npc') {
      ctx.font = '12px "굴림", Gulim, "돋움", Dotum, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(e.name, s.x + 1, s.y - 6);
      ctx.fillStyle = '#ffe9a0'; ctx.fillText(e.name, s.x, s.y - 7);
    }
  }
  if (p) {
    const s = proj(p.rx + 0.5, p.ry + 0.5);
    const r = Math.round(Math.max(2, scale * 0.8));
    dotSq(ctx, s.x, s.y, r + 1, '#000');
    dotSq(ctx, s.x, s.y, r, Math.sin(t * 6) > -0.3 ? '#ffffff' : '#9fd8ff');
  }
}
// 도트 표식: 정수 좌표 사각 점(1px 어두운 외곽)
function dotSq(ctx, x, y, r, col) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#000'; ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
  ctx.fillStyle = col; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export class MiniMap {
  constructor(game, canvas) {
    this.game = game; this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.base = null; this.t = 0; this.acc = 0;
    this.k = 4; // 타일당 픽셀(캔버스 해상도 = CSS 픽셀)
  }
  rebuild() {
    const w = this.game.world;
    this.base = w.map ? bakeMap(w, this.game.data.tiles) : null;
  }
  draw(dt) {
    this.t += dt; this.acc += dt;
    if (this.acc < 1 / 20) return; // 20fps 로 충분
    this.acc = 0;
    const { ctx, canvas } = this, W = canvas.width, H = canvas.height, k = this.k, p = this.game.player;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070608'; ctx.fillRect(0, 0, W, H);
    if (!this.base || !p) return;
    const cx = p.rx + 0.5, cy = p.ry + 0.5;
    const ox = Math.round(W / 2 - k * (cx - cy)), oy = Math.round(H / 2 - (k / 2) * (cx + cy));
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(k, k / 2, -k, k / 2, ox, oy);
    ctx.drawImage(this.base, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const proj = (x, y) => ({ x: ox + k * (x - y), y: oy + (k / 2) * (x + y) });
    drawMarkers(this.game, ctx, proj, k * 0.5, this.t);
  }
}

// 지도창 전체 그리기
export function drawFullMap(game, canvas, t) {
  const ctx = canvas.getContext('2d'), w = game.world, W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050406'; ctx.fillRect(0, 0, W, H);
  if (!w.map) return;
  const base = bakeMap(w, game.data.tiles);
  const n = w.w + w.h;
  const k = Math.min((W - 30) / n, (H - 30) / (n / 2));
  const ox = W / 2 - k * (w.w - w.h) / 2, oy = H / 2 - (k / 2) * (w.w + w.h) / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(k, k / 2, -k, k / 2, ox, oy);
  ctx.drawImage(base, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const proj = (x, y) => ({ x: ox + k * (x - y), y: oy + (k / 2) * (x + y) });
  drawMarkers(game, ctx, proj, Math.max(2, k * 0.5), t, { labels: true });
}
