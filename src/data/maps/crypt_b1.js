// 2장 — 지하묘지 1층. 소유: 워커 D.
// 3×3 석실을 복도로 이은 미궁. 좌상 입구 → 우하 2층 계단. 벽에 황혼의 왕 봉인 전설을 새긴 비석 넷.
import { MapBuilder } from './_build.js';

const b = new MapBuilder(44, 44, 'b', 1313);
b.fillO(0, 0, 44, 44, 'C');
// 석실 (x, y, w, h)
const R = {
  entry: [2, 2, 9, 9], hall: [17, 2, 10, 9], ossuary: [33, 2, 9, 10],
  west: [2, 17, 10, 10], center: [16, 16, 12, 12], east: [33, 17, 9, 9],
  pit: [2, 33, 10, 9], chapel: [17, 33, 10, 9], down: [33, 32, 9, 10],
};
for (const [x, y, w, h] of Object.values(R)) b.clear(x, y, w, h);
// 복도 (막다른 길 없이 순환 + 곁가지)
b.path([[10, 5], [17, 5]], 'b', 2);
b.path([[26, 5], [33, 5]], 'b', 2);
b.path([[5, 10], [5, 17]], 'b', 2);
b.path([[11, 21], [16, 21]], 'b', 2);
b.path([[21, 10], [21, 16]], 'b', 2);
b.path([[27, 21], [33, 21]], 'b', 2);
b.path([[37, 11], [37, 17]], 'b', 2);
b.path([[21, 27], [21, 33]], 'b', 2);
b.path([[6, 26], [6, 33]], 'b', 2);
b.path([[26, 37], [33, 37]], 'b', 2);
b.path([[37, 25], [37, 32]], 'b', 2);
// 석실 장식
b.o(4, 4, '^').o(3, 9, 't').o(9, 3, 't');
for (const x of [19, 22, 25]) b.o(x, 4, 'I').o(x, 8, 'I');
for (let y = 3; y <= 10; y += 2) b.o(34, y, 'k').o(40, y, 'k');
b.fillO(35, 3, 5, 1, 'L').o(38, 9, 'z');
b.blob(7, 22, 2.5, 2, 'W', 'g', 0.1);
for (const [x, y] of [[18, 18], [25, 18], [18, 25], [25, 25]]) b.o(x, y, 'I');
b.o(21, 21, 'S').o(22, 21, 'S');
b.o(35, 19, 'O').o(40, 24, 'x').o(39, 19, 'e');
b.blob(6, 37, 2.5, 2, ' ', 'g', 0.15);
b.o(21, 35, 'A').o(18, 34, 't').o(25, 34, 't');
b.o(39, 39, 'v').o(35, 33, 't').o(40, 33, 't');
b.scatter('k', 0.05, [0, 0, 44, 44], 'b').scatter('e', 0.03, [0, 0, 44, 44], 'b').scatter('r', 0.03, [0, 0, 44, 44], 'b');
// 비석 (로어)
const STONES = [[23, 3], [3, 19], [26, 26], [19, 40]];
for (const [x, y] of STONES) b.o(x, y, 'i');
const { ground, objects } = b.build();

const lore = (id, x, y, text) => ({ id, x: x - 1, y: y - 1, w: 3, h: 3, once: true, actions: [{ sound: 'page' }, { msg: text, channel: 'quest' }] });

export default {
  id: 'crypt_b1', name: '지하묘지 1층', bgm: 'crypt',
  ambient: { darkness: 0.82, tint: '#2a2a3a', particles: 'dust', fog: false },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 4, y: 5 },
  ground, objects,
  lights: [{ x: 21, y: 21, radius: 4, color: '#8a7aff' }, { x: 7, y: 37, radius: 3, color: '#5a3a8a' }],
  npcs: [],
  spawns: [
    { monster: 'skeleton', x: 17, y: 2, w: 10, h: 9, count: 3, respawn: 25 },
    { monster: 'bat', x: 33, y: 2, w: 9, h: 10, count: 4, respawn: 22 },
    { monster: 'ghoul', x: 2, y: 17, w: 10, h: 10, count: 3, respawn: 25 },
    { monster: 'skeleton_archer', x: 16, y: 16, w: 12, h: 12, count: 3, respawn: 25 },
    { monster: 'skeleton', x: 16, y: 16, w: 12, h: 12, count: 2, respawn: 25 },
    { monster: 'bat', x: 33, y: 17, w: 9, h: 9, count: 3, respawn: 22 },
    { monster: 'ghoul', x: 2, y: 33, w: 10, h: 9, count: 3, respawn: 25 },
    { monster: 'skeleton_archer', x: 17, y: 33, w: 10, h: 9, count: 3, respawn: 25 },
    { monster: 'ghoul', x: 33, y: 32, w: 9, h: 10, count: 2, respawn: 28 },
  ],
  portals: [
    { x: 4, y: 4, to: 'old_graveyard', tx: 45, ty: 9, dir: 4 },
    { x: 39, y: 39, to: 'crypt_b2', tx: 4, ty: 5, dir: 3 },
  ],
  triggers: [
    { id: 'enter', x: 3, y: 3, w: 5, h: 5, once: true, actions: [{ msg: '횃불 몇 개가 아직도 타고 있다. 누군가 최근까지 이곳을 드나들었다.' }] },
    lore('stone1', ...STONES[0], '비석 I — 『황혼이 처음 내리던 해, 왕 모르데카이는 죽음을 정복하겠노라 선언하였다. 그는 죽은 자들의 이름을 모아 군대를 일으켰다.』'),
    lore('stone2', ...STONES[1], '비석 II — 『다섯 신이 왕 앞에 섰다. 강철의 아르겐이 문을 막고, 그림자의 녹티스가 길을 감추고, 별의 아스테라가 이름을 흩고, 빛의 엘리아가 상처를 덮고, 바람의 카이가 왕을 심연으로 밀어 넣었다.』'),
    lore('stone3', ...STONES[2], '비석 III — 『그러나 왕은 죽지 않았다. 죽음을 정복한 자는 죽일 수 없으므로. 신들은 그를 봉인하고, 그 대가로 깊은 잠에 들었다. 오직 아르겐만이 문 곁에 남았다.』'),
    lore('stone4', ...STONES[3], '비석 IV — 『우리 사제들은 이 묘지 아래에 왕의 잔당을 가두고, 묘지기를 세워 그 잠을 지키게 하였다. 묘지기여, 부디 이름을 잃지 말라.』'),
  ],
  onEnter: [
    { if: { notFlag: 'ch2.b1_seen' }, then: [{ setFlag: 'ch2.b1_seen' }, { title: '지하묘지', sub: '봉인된 자들의 잠자리' }] },
  ],
};
