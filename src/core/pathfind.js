import { DIRS } from './iso.js';

// 8방향 A*. canStep(fx,fy,tx,ty) 는 한 칸 이동 가능 여부(대각 모서리 끼임 검사 포함)를 판단.
// 반환: [{x,y}, ...] (시작점 제외, 목표 포함). 실패 시 null. allowAdjacent=true면 목표에 인접만 해도 성공.
export function findPath(sx, sy, tx, ty, canStep, { maxNodes = 4000, allowAdjacent = false } = {}) {
  if (sx === tx && sy === ty) return [];
  const key = (x, y) => x * 4096 + y;
  const h = (x, y) => {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const open = [{ x: sx, y: sy, g: 0, f: h(sx, sy) }];
  const came = new Map();
  const gScore = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    const reached = (cur.x === tx && cur.y === ty) ||
      (allowAdjacent && Math.max(Math.abs(cur.x - tx), Math.abs(cur.y - ty)) === 1);
    if (reached) {
      const path = [];
      let k = ck, node = cur;
      while (k !== key(sx, sy)) {
        path.push({ x: node.x, y: node.y });
        node = came.get(k);
        k = key(node.x, node.y);
      }
      return path.reverse();
    }
    for (const d of DIRS) {
      const nx = cur.x + d.dx, ny = cur.y + d.dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const isGoal = nx === tx && ny === ty;
      if (!canStep(cur.x, cur.y, nx, ny, isGoal)) continue;
      // 그리드 대각(dx,dy 모두 ≠0)은 화면상 수직/수평 이동이며 거리 √2
      const g = cur.g + (d.dx !== 0 && d.dy !== 0 ? 1.414 : 1);
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, cur);
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}
