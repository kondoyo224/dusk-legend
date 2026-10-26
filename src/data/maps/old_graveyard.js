// 2장 — 옛 묘지. 소유: 워커 D.
// 동문(왼쪽 끝 3,29)으로 들어와 → 묘역 길 → 무너진 예배당(가운데) → 납골당들 → 동북 끝 지하묘지 입구(봉인)
import { MapBuilder } from './_build.js';

const b = new MapBuilder(56, 56, ',', 6660);
for (let k = 0; k < 16; k++) b.blob(b.r() * 56, b.r() * 56, 2 + b.r() * 4, 2 + b.r() * 3, ':');
for (let k = 0; k < 6; k++) b.blob(6 + b.r() * 44, 6 + b.r() * 44, 1.5 + b.r() * 2, 1.2 + b.r() * 1.5, 'p');
// 큰길: 입구 → 예배당 → 지하묘지 입구
b.path([[1, 28], [14, 28], [24, 26], [28, 24]], '=', 3);
b.path([[30, 22], [38, 16], [44, 11]], '=', 3);
b.path([[28, 28], [28, 42], [36, 46]], ':', 2);
b.path([[20, 28], [14, 40], [12, 46]], ':', 2);
b.path([[33, 26], [45, 30], [48, 38]], ':', 2);
// 묘역: 철책으로 둘러싼 비석 줄
const plot = (x, y, w, h, gap) => {
  b.fillO(x, y, w, 1, '|').fillO(x, y + h - 1, w, 1, '|').fillO(x, y, 1, h, '|').fillO(x + w - 1, y, 1, h, '|');
  for (const [gx, gy] of gap) b.clear(gx, gy);
  for (let j = y + 2; j < y + h - 1; j += 2) for (let i = x + 2; i < x + w - 1; i += 2) b.o(i, j, 'g');
  b.reserve(x + 1, y + 1, w - 2, h - 2); // 묘역 안은 장식 산포 금지 — 비석 사이에 갇힌 칸(못 잡는 몬스터)이 생기지 않게
};
plot(4, 14, 11, 10, [[9, 23]]);          // 서북 묘역 (리나의 부모 무덤)
plot(16, 33, 9, 9, [[20, 33]]);          // 서남 묘역
plot(31, 31, 11, 9, [[31, 35]]);         // 동남 묘역
plot(40, 40, 11, 11, [[40, 45]]);        // 깊은 묘역
// 무너진 예배당
b.room(22, 16, 12, 9, { wall: '#', floor: '_', doors: [[27, 24], [28, 24], [29, 24]] });
b.clear(22, 19, 1, 2).clear(33, 18, 1, 3).o(24, 16, ' ').o(31, 16, ' ');
b.o(27, 18, 'A').o(24, 18, 'I').o(31, 18, 'I').o(24, 22, 'r').o(31, 21, 'r').o(26, 20, 'k').o(30, 22, 'r');
// 납골당 (작은 석실)
b.room(6, 40, 7, 6, { wall: 'C', floor: 'b', doors: [[9, 40]] }).o(9, 43, 'z');
b.room(46, 22, 7, 6, { wall: 'C', floor: 'b', doors: [[46, 25]] }).o(50, 24, 'S');
// 지하묘지 입구 납골당 (동북)
b.room(42, 5, 9, 8, { wall: 'C', floor: 'b', doors: [[44, 12], [45, 12], [46, 12]] });
b.o(46, 7, 'v').o(43, 6, 't').o(49, 6, 't').o(43, 9, 'S').o(49, 9, 'S');
// 동문 쪽 낡은 담장
b.fillO(2, 22, 1, 5, '#').fillO(2, 31, 1, 5, '#');
// 고목·뼈·안개 장식
b.scatter('g', 0.05, [2, 2, 52, 52], ',:');
b.scatter('D', 0.035, [2, 2, 52, 52], ',:');
b.scatter('k', 0.02, [2, 2, 52, 52], ',:p');
b.scatter('*', 0.015, [2, 2, 52, 52], ',');
for (const [x, y] of [[13, 27], [21, 30], [34, 25], [27, 34], [40, 14], [45, 34], [14, 38]]) b.o(x, y, 'l');
b.border('D', 1).fillWhere(',:p', 'D', [1, 1, 54, 2]).fillWhere(',:p', 'D', [1, 52, 54, 3]).fillWhere(',:p', 'D', [52, 1, 3, 54]);
b.clear(0, 28, 2, 3);
const { ground, objects } = b.build();
const CRYPT = { x: 46, y: 7 };

export default {
  id: 'old_graveyard', name: '옛 묘지', bgm: 'graveyard',
  ambient: { darkness: 0.6, tint: '#3a4a5a', particles: 'soul', fog: true },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 3, y: 29 },
  ground, objects,
  lights: [
    { x: 27, y: 18, radius: 4, color: '#c9b6ff' },
    { x: 46, y: 8, radius: 4, color: '#7a5aff' },
  ],
  npcs: [],
  spawns: [
    { monster: 'skeleton', x: 5, y: 15, w: 9, h: 8, count: 4, respawn: 22 },
    { monster: 'zombie', x: 17, y: 34, w: 7, h: 7, count: 3, respawn: 24 },
    { monster: 'skeleton', x: 22, y: 26, w: 12, h: 6, count: 3, respawn: 22 },
    { monster: 'zombie', x: 32, y: 32, w: 9, h: 7, count: 3, respawn: 24 },
    { monster: 'skeleton', x: 41, y: 41, w: 9, h: 9, count: 4, respawn: 22 },
    { monster: 'zombie', x: 36, y: 13, w: 8, h: 6, count: 3, respawn: 24 },
  ],
  portals: [
    ...[28, 29, 30].map((y) => ({ x: 0, y, to: 'village_roen', tx: 56, ty: 29, dir: 6 })),
    { x: CRYPT.x, y: CRYPT.y, to: 'crypt_b1', tx: 5, ty: 5, dir: 3, cond: { flag: 'ch2.key' }, failMsg: '다섯 신의 문장이 새겨진 봉인이 철문을 막고 있다. 신전의 축복 없이는 열리지 않는다.' },
  ],
  triggers: [
    { id: 'enter', x: 2, y: 27, w: 4, h: 5, once: true, actions: [
      { msg: '젖은 흙냄새와 함께, 어디선가 뼈가 맞부딪치는 소리가 들려온다.' },
    ] },
    // 리나의 부모 무덤
    { id: 'parents', x: 8, y: 16, w: 3, h: 3, once: true, actions: [
      { msg: '비석에 새겨진 이름 — "로엔 북문 경비대장 하랄드와 아내 마르타, 여기 나란히 잠들다." 아버지와 어머니의 무덤이다. 꽃은 말라 비틀어져 있다.' },
    ] },
    { id: 'chapel', x: 25, y: 19, w: 6, h: 4, once: true, actions: [
      { msg: '부서진 제단에 다섯 신의 문장이 희미하게 남아 있다. 넷은 금이 가 있고, 강철의 문장만이 온전하다.' },
    ] },
    { id: 'crypt_found', x: 43, y: 8, w: 7, h: 4, once: true, cond: { notFlag: 'ch2.crypt_found' }, actions: [
      { lock: true }, { setFlag: 'ch2.crypt_found' }, { dialog: 'ch2_crypt_found', npc: null }, { lock: false },
      { notice: '봉인된 지하묘지 입구를 찾았다', sub: '사제 오드릭에게 알리자' },
    ] },
    { id: 'crypt_open', x: 45, y: 8, w: 3, h: 2, once: true, cond: { flag: 'ch2.key' }, actions: [
      { sound: 'door' }, { dialog: 'ch2_crypt_open', npc: null },
    ] },
  ],
  onEnter: [
    { if: { notFlag: 'ch2.gy_seen' }, then: [{ setFlag: 'ch2.gy_seen' }, { title: '옛 묘지', sub: '로엔의 죽은 이들이 잠든 곳' }] },
  ],
};
