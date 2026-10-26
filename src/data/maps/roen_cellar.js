// 1장 — 여관 '잠든 사슴' 지하실. 소유: 워커 D.
// 계단방(좌상) → 저장고(좌하) / 포도주 창고(우상) → 무너진 벽 너머 옛 땅굴(우하, 쥐왕의 둥지)
import { MapBuilder } from './_build.js';
import { spawnBoss } from './_hooks.js';

const b = new MapBuilder(30, 24, ' ', 99);
b.room(1, 1, 28, 22, { wall: '#', floor: '_' });
// 칸막이 벽
b.fillO(10, 1, 1, 22, '#').clear(10, 5, 1, 2).clear(10, 16, 1, 2);
b.fillO(10, 12, 19, 1, '#').clear(18, 12, 2, 1);
b.fillO(1, 12, 10, 1, '#').clear(5, 12, 2, 1);
// 계단방
b.o(3, 3, '^').o(2, 7, 'x').o(3, 7, 'x').o(8, 2, 'O').o(8, 3, 'O').o(2, 10, 't').o(8, 10, 'n');
// 포도주 창고: 통 줄
for (const y of [3, 6, 9]) for (let x = 13; x <= 25; x++) if (x % 4 !== 0) b.o(x, y, 'O');
b.o(27, 2, 'e').o(11, 2, 'e').o(27, 11, 'x').o(26, 11, 'x');
// 저장고
for (const [x, y] of [[2, 14], [3, 14], [2, 15], [8, 14], [8, 15], [2, 20], [3, 20], [8, 20], [5, 18]]) b.o(x, y, 'x');
b.o(7, 13, 'e').o(9, 21, 'O');
// 옛 땅굴: 흙바닥·웅덩이·잔해, 무너진 칸막이 틈
b.fillG(11, 13, 17, 9, ':');
b.blob(22, 18, 4.5, 3, 'b', 'g', 0.3);
b.blob(14, 20, 2, 1.2, 'p', 'g', 0.1);
b.scatter('r', 0.08, [11, 13, 17, 9], ':');
b.scatter('k', 0.06, [11, 13, 17, 9], ':b');
b.o(27, 14, 'e').o(12, 14, 'e').o(26, 20, 'k').o(19, 20, 'o').o(15, 15, 'o');
const { ground, objects } = b.build();

export default {
  id: 'roen_cellar', name: '잠든 사슴 지하실', bgm: 'cellar',
  ambient: { darkness: 0.72, tint: '#5a4a3a', particles: 'dust', fog: false },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 4, y: 4 },
  ground, objects,
  lights: [
    { x: 4, y: 4, radius: 4, color: '#ffb060' },
    { x: 19, y: 7, radius: 3, color: '#ff9a40' },
    { x: 22, y: 18, radius: 3, color: '#7a9a5a' },
  ],
  npcs: [],
  spawns: [
    { monster: 'cellar_rat', x: 11, y: 2, w: 16, h: 9, count: 4, respawn: 12 },
    { monster: 'cellar_rat', x: 2, y: 13, w: 7, h: 8, count: 3, respawn: 12 },
    { monster: 'cellar_rat', x: 11, y: 13, w: 8, h: 8, count: 2, respawn: 14 },
  ],
  portals: [
    { x: 3, y: 3, to: 'village_roen', tx: 8, ty: 37, dir: 3 },
  ],
  triggers: [
    { id: 'nest', x: 16, y: 13, w: 6, h: 3, once: true, cond: { notFlag: 'ch1.ratking' }, actions: [
      { lock: true },
      { msg: '찍찍거리는 소리가 한꺼번에 멎는다. 어둠 속에서 붉은 눈 한 쌍이 천천히 떠오른다.', channel: 'warn' },
      { shake: 4, time: 0.4 },
      { bgm: 'boss' },
      { wait: 0.6 },
      { lock: false },
    ] },
  ],
  onKill: [
    { monster: 'rat_king', cond: { notFlag: 'ch1.ratking' }, actions: [
      { setFlag: 'ch1.ratking' },
      { bgm: 'cellar' },
      { msg: '쥐왕이 쓰러지자 굴 속의 쥐들이 사방으로 흩어진다.' },
      { msg: '무너진 벽 너머로… 이 땅굴은 마을 바깥, 숲 쪽으로 이어져 있었던 것 같다.' },
      { notice: '쥐왕을 처치했다', sub: '여관주인 토마에게 알리자' },
    ] },
  ],
  onEnter: [
    spawnBoss('rat_king', 23, 18, 'ch1.ratking'),
    { if: { notFlag: 'ch1.cellar_seen' }, then: [
      { setFlag: 'ch1.cellar_seen' },
      { msg: '퀴퀴한 포도주 냄새와 짐승 냄새가 뒤섞여 코를 찌른다.' },
    ] },
  ],
};
