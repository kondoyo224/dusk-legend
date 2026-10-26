// 타이틀 배경(도트 풍경): 달빛 아래 황혼의 탑과 묘지 실루엣, 계단식 반투명 안개, 떠오르는 혼불.
// 화면의 1/2 해상도로 그리고 하이컬러 톤 매핑(휴 시프트, 디더 없음) → 최근접 확대. 소유: 워커 A.
import { makeCanvas, hash2 } from './util.js';
import { pixelize } from './pixel.js';

const TS = 2; // 타이틀 도트 배율

export class TitleScene {
  constructor(renderer) { this.r = renderer; this.bg = null; this.fg = null; this.souls = []; this.w = 0; this.h = 0; }

  resize(W, H) {
    this.W = W; this.H = H;
    const w = Math.ceil(W / TS), h = Math.ceil(H / TS);
    this.w = w; this.h = h;
    this.buf = makeCanvas(w, h); this.bctx = this.buf.getContext('2d'); this.fogBands = null;
    this.bg = makeCanvas(w, h); this.fg = makeCanvas(w, h);
    const c = this.bg.getContext('2d');
    // 하늘
    let g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#07050f'); g.addColorStop(0.45, '#1a1230'); g.addColorStop(0.7, '#3a1e2e'); g.addColorStop(1, '#0a0608');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // 별
    for (let i = 0; i < 110; i++) {
      const x = hash2(i, 1) * w, y = hash2(i, 2) * h * 0.6, s = hash2(i, 3);
      c.fillStyle = `rgba(230,220,255,${0.15 + s * 0.55})`; c.fillRect(x, y, s > 0.9 ? 2 : 1, s > 0.9 ? 2 : 1);
    }
    // 달
    const mx = w * 0.72, my = h * 0.26, mr = Math.min(w, h) * 0.09;
    // 달무리: 동심 5단 따뜻한 반투명 링
    for (const [k, col] of [[2.8, 'rgba(255,150,160,0.05)'], [2.3, 'rgba(255,170,160,0.06)'], [1.85, 'rgba(255,190,170,0.08)'], [1.45, 'rgba(255,210,180,0.12)'], [1.18, 'rgba(255,230,200,0.18)']]) { c.fillStyle = col; c.beginPath(); c.arc(mx, my, mr * k, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#e8b8a0'; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff0e0'; c.beginPath(); c.arc(mx - mr * 0.12, my - mr * 0.12, mr * 0.86, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(160,110,100,0.25)';
    for (const [dx, dy, r] of [[-0.3, -0.1, 0.2], [0.25, 0.3, 0.15], [0.1, -0.4, 0.1]]) { c.beginPath(); c.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); c.fill(); }
    // 먼 산
    ridge(c, w, h, h * 0.62 - 1, 22, '#7a4a6a', 11);   // 달빛 받은 능선
    ridge(c, w, h, h * 0.62, 22, '#3a2448', 11);
    ridge(c, w, h, h * 0.7 - 1, 14, '#5a3450', 23);
    ridge(c, w, h, h * 0.7, 14, '#241634', 23);
    // 황혼의 탑
    const tx = w * 0.3, base = h * 0.66, th = h * 0.42, tw = Math.max(9, w * 0.03);
    c.fillStyle = '#1a1228';
    c.beginPath(); c.moveTo(tx - tw * 1.2, base); c.lineTo(tx - tw * 0.8, base - th); c.lineTo(tx - tw * 1.1, base - th - 2); c.lineTo(tx - tw * 0.5, base - th - 4);
    c.lineTo(tx - tw * 0.3, base - th - 14); c.lineTo(tx, base - th - 24); c.lineTo(tx + tw * 0.3, base - th - 14); c.lineTo(tx + tw * 0.5, base - th - 4);
    c.lineTo(tx + tw * 1.1, base - th - 2); c.lineTo(tx + tw * 0.8, base - th); c.lineTo(tx + tw * 1.2, base); c.closePath(); c.fill();
    // 달 쪽(오른쪽) 가장자리 반사광
    c.fillStyle = '#4a3050'; c.fillRect(tx + tw * 0.62, base - th, 2, th);
    for (let i = 0; i < 5; i++) { const wy = base - th * (0.2 + i * 0.17); c.fillStyle = i === 4 ? '#ff3a3a' : 'rgba(255,90,60,0.6)'; c.fillRect(tx - 1, wy, 2, 3); c.fillStyle = '#ffd080'; c.fillRect(tx, wy + 1, 1, 1); }
    // 앞 언덕 + 묘지
    const f = this.fg.getContext('2d');
    ridge(f, w, h, h * 0.8 - 1, 9, '#3a2440', 41);
    ridge(f, w, h, h * 0.8, 9, '#140c1e', 41);
    f.fillStyle = '#100a1a';
    for (let i = 0; i < 16; i++) {
      const x = hash2(i, 9) * w, y = h * 0.8 + hash2(i, 10) * h * 0.12, s = 0.25 + hash2(i, 11) * 0.3;
      if (hash2(i, 12) < 0.5) { f.fillRect(x - 2 * s, y - 30 * s, 4 * s, 30 * s); f.fillRect(x - 10 * s, y - 23 * s, 20 * s, 4 * s); }
      else { f.beginPath(); f.moveTo(x - 9 * s, y); f.lineTo(x - 9 * s, y - 16 * s); f.arc(x, y - 16 * s, 9 * s, Math.PI, 0); f.lineTo(x + 9 * s, y); f.fill(); }
    }
    // 앙상한 나무
    tree(f, w * 0.88, h * 0.86, h * 0.32);
    tree(f, w * 0.06, h * 0.9, h * 0.26);
    pixelize(this.bg, { outline: false, levels: 26, alphaCut: 1 });
    pixelize(this.fg, { outline: false, tone: false, alphaCut: 100 });
  }

  render(ctx, dt, time) {
    const { w, h } = this;
    const b = this.bctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    if (this.bg) b.drawImage(this.bg, 0, 0);
    // 안개 띠: 계단식 반투명 (미리 구워 두고 가로로 흘린다)
    if (!this.fogBands) this.fogBands = [0, 1, 2].map((i) => fogBand(w, i));
    this.fogBands.forEach((band, i) => {
      const off = Math.floor(time * (4 + i * 3)) % w;
      b.drawImage(band, -off, Math.round(h * (0.62 + i * 0.08)) - 10);
    });
    if (this.fg) b.drawImage(this.fg, 0, 0);
    // 혼불: 2px 사각 + 십자, 계단식 상승
    while (this.souls.length < 26) this.souls.push({ x: Math.random() * w, y: h * (0.75 + Math.random() * 0.3), v: 4 + Math.random() * 9, ph: Math.random() * 6, life: 0, max: 4 + Math.random() * 6 });
    for (const p of this.souls) {
      p.life += dt; p.y -= p.v * dt; p.x += Math.sin(time + p.ph) * 3 * dt;
      const k = p.life / p.max;
      if (k > 0.92 || k < 0.05) continue;
      const x = Math.round(p.x), y = Math.round(p.y);
      b.fillStyle = '#7080e0'; b.fillRect(x - 1, y, 3, 1); b.fillRect(x, y - 1, 1, 3);
      b.fillStyle = Math.floor(time * 6 + p.ph) & 1 ? '#e0e8ff' : '#b8c8ff'; b.fillRect(x, y, 1, 1);
    }
    this.souls = this.souls.filter((p) => p.life < p.max);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, w * TS, h * TS);
  }
}

// 안개 띠 1개 (가로 2배 폭, 주기 w 로 이어짐)
function fogBand(w, i) {
  const c = makeCanvas(w * 2, 21), g = c.getContext('2d');
  g.fillStyle = i === 2 ? '#6a5a8a' : '#8a7aa8';
  for (let yy = -6; yy <= 6; yy++) {
    g.globalAlpha = Math.ceil((1 - Math.abs(yy) / 7) * 4) / 4 * (0.1 + i * 0.03);
    for (let x = 0; x < w * 2; x++) {
      const wave = Math.round(Math.sin(((x % w) / w) * Math.PI * 2 * Math.max(1, Math.round(w * 0.05 / (Math.PI * 2))) + i) * 3);
      g.fillRect(x, 10 + yy + wave, 1, 1);
    }
  }
  g.globalAlpha = 1;
  return c;
}

function ridge(c, w, h, y, amp, color, seed) {
  c.fillStyle = color; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 3) {
    const k = x / w;
    c.lineTo(x, y - Math.sin(k * 5 + seed) * amp * 0.5 - Math.sin(k * 13 + seed * 2) * amp * 0.25 - hash2((x / 3) | 0, seed) * amp * 0.12);
  }
  c.lineTo(w, h); c.closePath(); c.fill();
}
function tree(c, x, y, H) {
  c.strokeStyle = '#120a1c'; c.lineCap = 'round';
  const br = (x0, y0, a, len, wd, d) => {
    const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
    c.lineWidth = wd; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (d > 0) { br(x1, y1, a - 0.5, len * 0.7, wd * 0.65, d - 1); br(x1, y1, a + 0.45, len * 0.65, wd * 0.6, d - 1); }
  };
  br(x, y, -0.1, H * 0.4, H * 0.05, 5);
}
