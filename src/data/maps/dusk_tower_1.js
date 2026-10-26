// 3장 — 잿빛 황야 & 황혼의 탑 1층. 소유: 워커 B (재배정 B10).
// 남쪽(마을 북문에서 도착) 잿빛 황야 → 탑 정문 → 중앙 회랑(황혼의 기사) · 서쪽 석상실(골렘) · 동쪽 의식실(교단 신도) → 북쪽 계단 → 탑 정상
import { MapBuilder } from './_build.js';

const b = new MapBuilder(48, 48, 'a', 3303);
// ── 잿빛 황야 (y 26~47) ──
for (let k = 0; k < 10; k++) b.blob(4 + b.r() * 40, 30 + b.r() * 15, 2 + b.r() * 4, 1.5 + b.r() * 3, ':');
b.blob(9, 38, 3, 2, 'L', 'g', 0.3).blob(39, 34, 2.5, 2, 'L', 'g', 0.3).blob(35, 43, 2, 1.5, 'L', 'g', 0.3);
b.path([[23, 47], [23, 40], [22, 33], [23, 26]], ':', 3);
b.scatter('D', 0.05, [1, 27, 46, 20], 'a:').scatter('o', 0.04, [1, 27, 46, 20], 'a:').scatter('k', 0.04, [1, 27, 46, 20], 'a:').scatter('r', 0.05, [1, 27, 46, 20], 'a:');
// ── 탑 외벽 ──
b.room(8, 3, 32, 23, { wall: '#', floor: '_', doors: [[22, 25], [23, 25], [24, 25], [25, 25]] });
// 중앙 회랑(대리석) + 기둥 열
b.fillG(19, 4, 10, 21, 'M');
for (let y = 6; y <= 22; y += 4) b.o(19, y, 'I').o(28, y, 'I');
b.o(20, 8, 'h').o(27, 8, 'h').o(20, 16, 'h').o(27, 16, 'h');
// 서쪽 석상실 / 동쪽 의식실 (안쪽 벽 + 출입구)
for (let y = 4; y <= 24; y++) { b.o(15, y, '#'); b.o(32, y, '#'); }
for (const y of [8, 9, 19, 20]) { b.o(15, y, ' '); b.o(32, y, ' '); }
b.o(10, 5, 'S').o(13, 5, 'S').o(10, 23, 'S').o(13, 23, 'S').o(9, 14, 'S').o(12, 12, 'r').o(11, 17, 'r');
b.o(35, 13, 'A').o(34, 11, 'h').o(36, 11, 'h').o(34, 16, 'k').o(37, 6, 'L').o(38, 6, 'L').o(37, 22, 'x').o(38, 21, 'O');
b.fillG(33, 10, 5, 6, 'r');
// 벽 횃불
for (const [x, y] of [[9, 3], [14, 3], [17, 3], [30, 3], [33, 3], [38, 3], [8, 12], [39, 12], [17, 25], [30, 25]]) b.o(x, y, 't');
// 북쪽 계단 (탑 정상으로)
b.fillO(22, 4, 4, 1, '^');
b.o(21, 4, 'h').o(26, 4, 'h');
// 탑 앞 잔해와 깃발 대신 석상
b.o(19, 27, 'S').o(28, 27, 'S');
b.border('o', 1);
b.clear(22, 47, 4, 1);
const { ground, objects } = b.build();

export default {
  id: 'dusk_tower_1', name: '황혼의 탑 — 잿빛 황야', bgm: 'tower',
  ambient: { darkness: 0.5, tint: '#5a3a34', particles: 'ash', fog: true },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 24, y: 44 },
  ground, objects,
  lights: [
    { x: 23, y: 26, radius: 5, color: '#ff7a3a' },
    { x: 23, y: 6, radius: 6, color: '#ff5a2a' },
  ],
  npcs: [],
  spawns: [
    { monster: 'cultist', x: 12, y: 29, w: 24, h: 12, count: 4, respawn: 25 },
    { monster: 'cultist', x: 30, y: 38, w: 10, h: 6, count: 2, respawn: 30 },
    { monster: 'dusk_knight', x: 20, y: 11, w: 8, h: 11, count: 3, respawn: 30 },
    { monster: 'stone_golem', x: 9, y: 6, w: 5, h: 16, count: 2, respawn: 40 },
    { monster: 'dusk_knight', x: 9, y: 10, w: 5, h: 6, count: 1, respawn: 40 },
    { monster: 'cultist', x: 33, y: 5, w: 5, h: 18, count: 3, respawn: 30 },
  ],
  portals: [
    ...[22, 23, 24, 25].map((x) => ({ x, y: 47, to: 'village_roen', tx: 29, ty: 3, dir: 4 })),
    ...[22, 23, 24, 25].map((x) => ({ x, y: 4, to: 'dusk_tower_2', tx: 20, ty: 35, dir: 0 })),
  ],
  triggers: [
    { id: 'waste', x: 20, y: 39, w: 8, h: 4, once: true, actions: [
      { msg: '발밑에서 재가 눈처럼 흩날린다. 북쪽 하늘을 찌르는 검은 탑 꼭대기에 붉은 빛이 맥박처럼 뛴다.' },
    ] },
    { id: 'gate', x: 21, y: 24, w: 6, h: 2, once: true, actions: [
      { notice: '황혼의 탑', sub: '천 년 전 봉인의 탑 — 이제 교단의 둥지' },
      { msg: '문 안쪽에서 낮은 찬송이 울린다. "황혼이여, 돌아오소서…"', channel: 'warn' },
    ] },
    { id: 'nave_ambush', x: 20, y: 9, w: 8, h: 3, once: true, cond: { notFlag: 'ch3.belzar' }, actions: [
      { shake: 4, time: 0.4 },
      { msg: '기둥 그늘에서 검은 갑주의 기사들이 걸어 나온다!', channel: 'warn' },
      { spawn: 'dusk_knight', x: 21, y: 6, count: 1 },
      { spawn: 'dusk_knight', x: 26, y: 6, count: 1 },
    ] },
  ],
  onEnter: [
    { if: { notFlag: 'ch3.tower_seen' }, then: [
      { setFlag: 'ch3.tower_seen' },
      { title: '잿빛 황야', sub: '황혼의 탑으로 가는 길' },
    ] },
  ],
};
