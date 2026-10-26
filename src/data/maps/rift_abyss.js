// 포스트게임 — 망각의 균열 (Lv20~30). 소유: 워커 B (재배정 B11).
// 허공에 뜬 안개 섬들: 입구(남) → 그림자 평원(중앙) → 서쪽 공포의 둥지 / 동쪽 부서진 회랑 → 북쪽 군주의 옥좌
import { MapBuilder } from './_build.js';

const b = new MapBuilder(48, 48, ' ', 9091);
const ISLANDS = [
  { x: 24, y: 42, rx: 5, ry: 4.5 },    // 입구
  { x: 24, y: 28, rx: 8, ry: 6.5 },    // 그림자 평원
  { x: 9, y: 20, rx: 6, ry: 6 },       // 공포의 둥지
  { x: 39, y: 21, rx: 6, ry: 6.5 },    // 부서진 회랑
  { x: 24, y: 9, rx: 8, ry: 6.5 },     // 군주의 옥좌
];
for (const I of ISLANDS) b.blob(I.x, I.y, I.rx, I.ry, 'm', 'g', 0.2);
b.blob(24, 9, 3.5, 3, 'b', 'g', 0.1);
// 섬을 잇는 다리 (허공 위 안개길)
b.path([[23, 38], [23, 33]], 'm', 3);
b.path([[17, 26], [13, 23]], 'm', 2);
b.path([[31, 25], [35, 23]], 'm', 2);
b.path([[23, 22], [23, 15]], 'm', 3);
b.path([[11, 15], [16, 10], [18, 9]], 'm', 2);
// 장식: 균열 결정, 뼈, 잔해
b.scatter('q', 0.03, [0, 0, 48, 48], 'm').scatter('k', 0.04, [0, 0, 48, 48], 'm').scatter('r', 0.04, [0, 0, 48, 48], 'm');
for (let k = 0; k < 10; k++) {
  const a = (k / 10) * Math.PI * 2, x = Math.round(24 + Math.cos(a) * 6.5), y = Math.round(9 + Math.sin(a) * 5.2);
  if (!(y > 12 && Math.abs(x - 24) <= 2)) b.o(x, y, k % 2 ? 'q' : 'I');
}
b.o(36, 17, 'I').o(42, 18, 'I').o(37, 25, 'r').o(41, 24, 'I').o(5, 18, 'S').o(12, 24, 'k');
b.clear(22, 41, 5, 4);
b.fillO(23, 46, 3, 1, '@');
b.fillG(22, 45, 5, 3, 'm');
const { ground, objects } = b.build();

export default {
  id: 'rift_abyss', name: '망각의 균열', bgm: 'rift',
  ambient: { darkness: 0.62, tint: '#3a1f5a', particles: 'soul', fog: true },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 24, y: 42 },
  ground, objects,
  lights: [
    { x: 24, y: 42, radius: 5, color: '#c9a8ff' },
    { x: 24, y: 9, radius: 7, color: '#8a3aff' },
    { x: 9, y: 20, radius: 4, color: '#5a1f8b' },
  ],
  npcs: [],
  spawns: [
    { monster: 'rift_shade', x: 17, y: 23, w: 14, h: 10, count: 5, respawn: 25 },
    { monster: 'rift_horror', x: 5, y: 15, w: 9, h: 10, count: 3, respawn: 35 },
    { monster: 'rift_shade', x: 4, y: 16, w: 9, h: 9, count: 2, respawn: 30 },
    { monster: 'rift_shade', x: 34, y: 16, w: 10, h: 10, count: 3, respawn: 30 },
    { monster: 'rift_horror', x: 35, y: 17, w: 8, h: 8, count: 2, respawn: 35 },
    { monster: 'rift_horror', x: 19, y: 12, w: 10, h: 3, count: 2, respawn: 45 },
    { monster: 'rift_lord', x: 24, y: 7, w: 1, h: 1, count: 1, respawn: 900 },
  ],
  portals: [
    ...[23, 24, 25].map((x) => ({ x, y: 46, to: 'village_roen', tx: 21, ty: 8, dir: 4 })),
  ],
  triggers: [
    { id: 'throne_warn', x: 19, y: 14, w: 10, h: 2, actions: [
      { msg: '공기가 무겁게 짓누른다. 옥좌 위의 그림자가 천천히 고개를 든다…', channel: 'warn' },
    ] },
  ],
  onKill: [
    { monster: 'rift_lord', actions: [
      { shake: 10, time: 1.0 },
      { msg: '균열의 군주가 흩어진다. 그러나 균열 깊은 곳에서 또 다른 형체가 웅크리기 시작한다… (15분 뒤 재출현)', channel: 'warn' },
    ] },
  ],
  onEnter: [
    { notice: '망각의 균열', sub: 'Lv 20~30 · 기억마저 삼키는 심연' },
  ],
};
