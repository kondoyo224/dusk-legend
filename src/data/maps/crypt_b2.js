// 2장 — 지하묘지 2층. 소유: 워커 D.
// 계단방(좌상) → 관이 늘어선 회랑 → 원령의 납골실 → 묘지기의 대전당(우하, 그라우스)
import { MapBuilder } from './_build.js';
import { spawnBoss } from './_hooks.js';

const b = new MapBuilder(40, 40, 'b', 4040);
b.fillO(0, 0, 40, 40, 'C');
b.clear(2, 2, 8, 7);                                   // 계단방
b.path([[9, 5], [18, 5]], 'b', 3);                     // 북 회랑
b.clear(18, 2, 8, 9);                                  // 납골실 A
b.path([[21, 10], [21, 16]], 'b', 3);
b.path([[5, 8], [5, 18]], 'b', 3);                     // 서 회랑
b.clear(2, 18, 9, 9);                                  // 납골실 B
b.path([[10, 21], [18, 21]], 'b', 3);
b.clear(17, 16, 8, 6);                                 // 중앙 전실
b.path([[24, 18], [30, 18], [30, 22]], 'b', 3);
b.path([[20, 21], [20, 24]], 'b', 3);
// 대전당
b.clear(19, 23, 19, 15);
b.blob(28, 30, 6, 4.5, 'M', 'g', 0.15);
for (const [x, y] of [[21, 25], [21, 35], [35, 25], [35, 35], [25, 24], [31, 24], [25, 36], [31, 36]]) b.o(x, y, 'I');
b.o(28, 26, 'A').o(20, 30, 't').o(36, 30, 't').o(28, 37, 'S');
// 관(상자)과 뼈
for (let x = 11; x <= 17; x += 2) b.o(x, 4, 'z').o(x, 8, 'z');
for (let y = 10; y <= 16; y += 2) b.o(3, y, 'z').o(8, y, 'z');
b.o(19, 3, 'L').o(20, 3, 'L').o(24, 3, 'L').o(25, 3, 'L').o(22, 9, 'k');
b.o(3, 19, 'g').o(5, 19, 'g').o(7, 19, 'g').o(9, 19, 'g').o(3, 25, 'g').o(9, 25, 'g');
b.o(4, 3, '^').o(3, 3, 't');
b.scatter('k', 0.06, [0, 0, 40, 40], 'b').scatter('e', 0.04, [0, 0, 40, 40], 'b').scatter('r', 0.03, [0, 0, 40, 40], 'b');
const { ground, objects } = b.build();
const BOSS = { x: 28, y: 29 };
const SHORTCUT = { x: 28, y: 34 };

export default {
  id: 'crypt_b2', name: '지하묘지 2층', bgm: 'crypt',
  ambient: { darkness: 0.86, tint: '#24203a', particles: 'soul', fog: true },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 4, y: 5 },
  ground, objects,
  lights: [{ x: 28, y: 28, radius: 6, color: '#6a4aff' }],
  npcs: [],
  spawns: [
    { monster: 'wraith', x: 18, y: 2, w: 8, h: 9, count: 3, respawn: 26 },
    { monster: 'ghoul', x: 10, y: 3, w: 9, h: 5, count: 2, respawn: 26 },
    { monster: 'wraith', x: 2, y: 18, w: 9, h: 9, count: 3, respawn: 26 },
    { monster: 'skeleton_archer', x: 17, y: 16, w: 8, h: 6, count: 3, respawn: 26 },
    { monster: 'ghoul', x: 2, y: 9, w: 9, h: 9, count: 2, respawn: 26 },
  ],
  portals: [
    { x: 4, y: 4, to: 'crypt_b1', tx: 38, ty: 38, dir: 7 },
    { x: SHORTCUT.x, y: SHORTCUT.y, to: 'old_graveyard', tx: 45, ty: 13, dir: 4, cond: { flag: 'ch2.graus' }, failMsg: '' },
  ],
  triggers: [
    { id: 'enter', x: 3, y: 4, w: 4, h: 3, once: true, actions: [{ msg: '공기가 무겁다. 아래에서 느릿한 삽질 소리가 끝없이 이어진다… 툭, 툭, 툭.' }] },
    { id: 'hall', x: 19, y: 23, w: 19, h: 3, once: true, cond: { notFlag: 'ch2.graus' }, actions: [
      { lock: true }, { bgm: 'boss' },
      spawnBoss('graus', BOSS.x, BOSS.y, 'ch2.graus'),
      { setFlag: 'ch2.graus_met' }, { shake: 6, time: 0.6 },
      { dialog: 'ch2_graus_intro', npc: null },
      { lock: false },
    ] },
  ],
  onKill: [
    { monster: 'graus', cond: { notFlag: 'ch2.graus' }, actions: [
      { setFlag: 'ch2.graus' }, { lock: true }, { bgm: 'crypt' }, { wait: 1.0 },
      { dialog: 'ch2_graus', npc: null },
      { setTile: { x: SHORTCUT.x, y: SHORTCUT.y, id: 'portal_glow' } }, { sound: 'portal' },
      { lock: false },
      { msg: '석상 앞에 지상으로 이어지는 빛이 열렸다.', channel: 'quest' },
    ] },
  ],
  onPickup: [
    { item: 'torn_page_2', cond: { notFlag: 'ch2.page2' }, actions: [
      { setFlag: 'ch2.page2' }, { sound: 'page' }, { dialog: 'ch2_page', npc: null },
      { notice: '찢긴 장 II 를 되찾았다', sub: '마을로 돌아가자' },
    ] },
  ],
  onEnter: [
    { if: [{ flag: 'ch2.graus_met' }, { notFlag: 'ch2.graus' }], then: [spawnBoss('graus', BOSS.x, BOSS.y, 'ch2.graus'), { bgm: 'boss' }] },
    { if: { flag: 'ch2.graus' }, then: [{ setTile: { x: SHORTCUT.x, y: SHORTCUT.y, id: 'portal_glow' } }] },
    { if: [{ flag: 'ch2.graus' }, { notFlag: 'ch2.page2' }, { not: { item: 'torn_page_2' } }], then: [{ call: (g) => g.systems.inventory.dropItem?.(BOSS.x, BOSS.y, 'torn_page_2', 1) }] },
  ],
};
