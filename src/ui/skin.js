// 고전 RPG 스킨: 캔버스로 굽는 도트 노이즈 텍스처(돌/철/짙은 나무/어두운 홈)와 도트 글자(로고·연출 제목).
// 외부 에셋 없음. 텍스처는 data URL 로 #ui-root 의 CSS 변수(--tx-*)에 넣어 반복 배경으로 쓴다.

function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// w×h 도트(각 도트 = 2×2 화면 픽셀) 텍스처. pick(x,y,r) → 색
function tex(w, h, pick, seed) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext('2d'), r = rng(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    ctx.fillStyle = pick(x, y, r);
    ctx.fillRect(x * 2, y * 2, 2, 2);
  }
  return c.toDataURL();
}
const wpick = (r, list) => { let t = r() * list.reduce((s, [, w]) => s + w, 0); for (const [c, w] of list) { if ((t -= w) <= 0) return c; } return list[0][0]; };

export function buildTextures() {
  // 돌: 회갈색, 드문 어두운 점과 밝은 점
  const stone = tex(32, 32, (x, y, r) => wpick(r, [['#4c463c', 10], ['#544d42', 7], ['#433d34', 6], ['#5e5648', 2], ['#38322a', 2]]), 11);
  // 철: 청회색, 가는 가로 결
  const iron = tex(32, 32, (x, y, r) => {
    const band = (y % 7 === 0) ? -1 : 0;
    const c = wpick(r, [['#3c4048', 10], ['#444852', 6], ['#363940', 5], ['#4e535e', 1]]);
    return band ? (r() < 0.6 ? '#30333a' : c) : c;
  }, 23);
  // 짙은 나무: 세로로 긴 결 + 옹이
  const wood = tex(32, 32, (x, y, r) => {
    const grain = Math.sin(y * 1.25 + Math.sin(x * 0.2) * 0.9);
    const base = grain > 0.55 ? '#3e2a1a' : grain < -0.6 ? '#2a1c10' : '#342316';
    return r() < 0.12 ? (r() < 0.5 ? '#2c1d11' : '#40301f') : base;
  }, 37);
  // 어두운 홈(오목 바탕): 거의 검은 갈색
  const dark = tex(32, 32, (x, y, r) => wpick(r, [['#15110d', 10], ['#1a1511', 6], ['#110e0a', 4], ['#211a14', 1]]), 51);
  // 제목줄: 남색 철
  const navy = tex(32, 16, (x, y, r) => (y === 0 ? '#3c4a74' : wpick(r, [['#222c4a', 10], ['#273252', 5], ['#1d2640', 4]])), 67);
  // 양피지 대신 쓰는 어두운 가죽
  const leather = tex(32, 32, (x, y, r) => wpick(r, [['#2a2018', 10], ['#30251b', 6], ['#251c15', 5], ['#382b1f', 1]]), 79);
  return { stone, iron, wood, dark, navy, leather };
}

export function applySkin(root) {
  try {
    const t = buildTextures();
    for (const [k, v] of Object.entries(t)) root.style.setProperty(`--tx-${k}`, `url(${v})`);
  } catch (e) { console.warn('스킨 텍스처 생성 실패', e); }
}

// ── 도트 글자 ──
// 작은 해상도로 글자를 그린 뒤 알파를 이진화 → 1px 외곽 + 위/아래 2단 명암 → scale 배 최근접 확대 캔버스.
// opts: {px:글자 높이(도트), scale, hi, mid, lo, edge, shadow, font}
export function pixelText(text, opts = {}) {
  const px = opts.px ?? 16, scale = opts.scale ?? 3;
  const font = opts.font ?? `bold ${px}px "굴림", Gulim, "돋움", Dotum, "Malgun Gothic", sans-serif`;
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  // 글자마다 따로 찍어 자간을 벌린다(이진화 후 글자끼리 붙지 않도록)
  const gap = opts.gap ?? Math.max(1, Math.round(px / 10));
  const chars = [...text], ws = chars.map((ch) => Math.ceil(m.measureText(ch).width));
  const tw = ws.reduce((s, w) => s + w + gap, 0) + 6, th = Math.ceil(px * 1.35) + 6;
  const a = document.createElement('canvas');
  a.width = tw; a.height = th;
  const ac = a.getContext('2d');
  ac.font = font; ac.textBaseline = 'top'; ac.fillStyle = '#fff';
  let cx = 3;
  chars.forEach((ch, i) => { ac.fillText(ch, cx, 3); cx += ws[i] + gap; });
  const src = ac.getImageData(0, 0, tw, th).data;
  const on = new Uint8Array(tw * th);
  let top = th, bot = 0;
  for (let i = 0; i < tw * th; i++) if (src[i * 4 + 3] > 110) { on[i] = 1; const y = (i / tw) | 0; if (y < top) top = y; if (y > bot) bot = y; }
  const out = document.createElement('canvas');
  out.width = tw * scale; out.height = th * scale;
  const oc = out.getContext('2d');
  const hi = opts.hi ?? '#fff2b0', mid = opts.mid ?? '#e0a83a', lo = opts.lo ?? '#9a5a14', edge = opts.edge ?? '#1a0c04', shadow = opts.shadow ?? '#000';
  const at = (x, y) => (x >= 0 && y >= 0 && x < tw && y < th ? on[y * tw + x] : 0);
  const dot = (x, y, c) => { oc.fillStyle = c; oc.fillRect(x * scale, y * scale, scale, scale); };
  // 그림자(오른쪽 아래 1도트)
  if (shadow) for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (!at(x, y) && (at(x - 1, y - 1) || at(x - 2, y - 2))) dot(x, y, shadow);
  // 외곽
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (at(x, y)) continue;
    if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) dot(x, y, edge);
  }
  // 본체 3단 명암(위 밝게 / 아래 어둡게) + 윗변 하이라이트
  const span = Math.max(1, bot - top);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (!at(x, y)) continue;
    const k = (y - top) / span;
    let c = k < 0.34 ? hi : k < 0.7 ? mid : lo;
    if (!at(x, y - 1) && k > 0.2) c = hi;
    dot(x, y, c);
  }
  out.className = 'ptext';
  out.style.width = out.width + 'px'; out.style.height = out.height + 'px';
  return out;
}
