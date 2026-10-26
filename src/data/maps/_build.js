// 맵 제작 도우미. 소유: 워커 D. 맵 파일이 모듈 로드 시 한 번 실행해 ground/objects 문자열 행을 만든다.
// 모든 난수는 시드 고정(mulberry32) → 매번 같은 지형 → 좌표 기반 트리거/포탈이 안전하다.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MapBuilder {
  constructor(w, h, ground = ' ', seed = 1) {
    this.w = w; this.h = h;
    this.G = Array.from({ length: h }, () => new Array(w).fill(ground));
    this.O = Array.from({ length: h }, () => new Array(w).fill(' '));
    this.r = rng(seed);
    this.keep = new Set(); // 장식 산포 금지 칸 (길, 포탈 주변 등)
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  g(x, y, c) { if (this.in(x, y)) this.G[y][x] = c; return this; }
  o(x, y, c) { if (this.in(x, y)) this.O[y][x] = c; return this; }
  getG(x, y) { return this.in(x, y) ? this.G[y][x] : ' '; }
  getO(x, y) { return this.in(x, y) ? this.O[y][x] : ' '; }
  reserve(x, y, w = 1, h = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.keep.add(`${i},${j}`); return this; }

  fillG(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.g(i, j, c); return this; }
  fillO(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.o(i, j, c); return this; }
  clear(x, y, w = 1, h = 1) { return this.fillO(x, y, w, h, ' '); }

  // 테두리 오브젝트 (맵 가장자리 막기)
  border(c, t = 1) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (x < t || y < t || x >= this.w - t || y >= this.h - t) this.o(x, y, c);
    }
    return this;
  }

  // 벽으로 둘러싼 방. doors: [[x,y],...] 벽 틈(바닥으로 열림)
  room(x, y, w, h, { wall = '#', floor = '_', doors = [] } = {}) {
    this.fillG(x, y, w, h, floor);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const edge = i === x || j === y || i === x + w - 1 || j === y + h - 1;
      this.o(i, j, edge ? wall : ' ');
    }
    for (const [dx, dy] of doors) { this.o(dx, dy, ' '); this.reserve(dx, dy); }
    return this;
  }

  // 4방향 연결 길(대각 이동 모서리 끼임 방지). pts: [[x,y],...], width 칸 폭. 오브젝트는 지운다.
  path(pts, c, width = 2) {
    for (let k = 0; k < pts.length - 1; k++) {
      let [x, y] = pts[k];
      const [tx, ty] = pts[k + 1];
      const paint = (px, py) => {
        for (let j = 0; j < width; j++) for (let i = 0; i < width; i++) {
          if (c) this.g(px + i, py + j, c);
          this.o(px + i, py + j, ' ');
          this.reserve(px + i, py + j);
        }
      };
      paint(x, y);
      while (x !== tx || y !== ty) {
        // 남은 거리 비율대로 x/y 번갈아 전진 → 완만한 사선 오솔길
        const ax = Math.abs(tx - x), ay = Math.abs(ty - y);
        if (ax && (!ay || this.r() < ax / (ax + ay))) x += Math.sign(tx - x); else y += Math.sign(ty - y);
        paint(x, y);
      }
    }
    return this;
  }

  // 울퉁불퉁한 타원 영역. layer 'g'|'o'
  blob(cx, cy, rx, ry, c, layer = 'g', rough = 0.25) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 - rough + this.r() * rough * 2) layer === 'g' ? this.g(x, y, c) : this.o(x, y, c);
    }
    return this;
  }

  // 장식 산포. area: [x,y,w,h], density 0..1, onG: 허용 지면 문자열, 예약칸/기존 오브젝트 피함
  // force: 예약칸도 무시(공터 안 장식용)
  scatter(c, density, area = [0, 0, this.w, this.h], onG = null, force = false) {
    const [ax, ay, aw, ah] = area;
    for (let y = ay; y < ay + ah; y++) for (let x = ax; x < ax + aw; x++) {
      if (!this.in(x, y) || (!force && this.keep.has(`${x},${y}`)) || this.O[y][x] !== ' ') continue;
      if (onG && !onG.includes(this.G[y][x])) continue;
      if (this.r() < density) this.O[y][x] = c;
    }
    return this;
  }

  // 지면이 특정 문자인 칸 중 오브젝트 없는 곳을 빽빽하게 채움(숲 외곽 등)
  fillWhere(gchars, c, area = [0, 0, this.w, this.h]) {
    const [ax, ay, aw, ah] = area;
    for (let y = ay; y < ay + ah; y++) for (let x = ax; x < ax + aw; x++) {
      if (this.in(x, y) && gchars.includes(this.G[y][x]) && this.O[y][x] === ' ' && !this.keep.has(`${x},${y}`)) this.O[y][x] = c;
    }
    return this;
  }

  // 공터: 타원 지면 + 나무 채우기 금지 예약
  clearing(cx, cy, rx, ry, c = null) {
    if (c) this.blob(cx, cy, rx, ry, c);
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) { this.o(x, y, ' '); this.reserve(x, y); }
    }
    return this;
  }

  build() {
    return { ground: this.G.map((r) => r.join('')), objects: this.O.map((r) => r.join('')) };
  }
}
