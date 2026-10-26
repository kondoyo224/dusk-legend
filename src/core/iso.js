// 아이소메트릭 좌표계 & 8방향 정의.
// 타일 (x,y) → 월드 픽셀: sx = (x - y) * TW/2, sy = (x + y) * TH/2  (타일 다이아몬드의 "윗 꼭짓점"이 아니라 "중심" 기준)
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

export function tileToWorld(x, y) {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

// 월드 픽셀 → 타일 실수 좌표 (반올림하면 타일 인덱스)
export function worldToTileF(wx, wy) {
  const a = wx / HALF_W, b = wy / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
export function worldToTile(wx, wy) {
  const t = worldToTileF(wx, wy);
  return { x: Math.round(t.x), y: Math.round(t.y) };
}

// 방향: 화면 기준 8방향. 0=↑(북) 1=↗ 2=→ 3=↘ 4=↓ 5=↙ 6=← 7=↖
// 그리드 델타(dx,dy). 화면 ↑ 은 그리드 (-1,-1).
export const DIRS = [
  { dx: -1, dy: -1, name: 'N' },
  { dx: 0, dy: -1, name: 'NE' },
  { dx: 1, dy: -1, name: 'E' },
  { dx: 1, dy: 0, name: 'SE' },
  { dx: 1, dy: 1, name: 'S' },
  { dx: 0, dy: 1, name: 'SW' },
  { dx: -1, dy: 1, name: 'W' },
  { dx: -1, dy: 0, name: 'NW' },
];

// 그리드 델타 → 방향 인덱스 (델타는 -1..1로 정규화)
export function dirFromDelta(dx, dy) {
  dx = Math.sign(dx); dy = Math.sign(dy);
  for (let i = 0; i < 8; i++) if (DIRS[i].dx === dx && DIRS[i].dy === dy) return i;
  return -1;
}

// 화면상 방향 벡터(sx,sy) → 방향 인덱스 (키보드 입력용)
export function dirFromScreen(sx, sy) {
  if (sx === 0 && sy === 0) return -1;
  const ang = Math.atan2(sx, -sy); // 0 = 위, 시계방향
  return ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
}

// 한 점에서 다른 점을 바라보는 방향 (가장 가까운 8방향)
export function dirTowards(fx, fy, tx, ty) {
  const a = tileToWorld(fx, fy), b = tileToWorld(tx, ty);
  return dirFromScreen(b.x - a.x, b.y - a.y);
}

export const isDiagonalStep = (dir) => dir % 2 === 0; // 화면 상하좌우 = 그리드 대각선
export const chebyshev = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
export const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
