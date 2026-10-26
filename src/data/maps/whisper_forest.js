// 1장 — 속삭이는 숲. 소유: 워커 D.
// 숲 입구(위, 마을과 연결) → 늑대 초지 → 갈림길: 서(거미 숲) / 동(고블린 약탈 야영지) / 남(개울 다리)
// 다리 너머: 멧돼지 공터(서남) · 깊은 숲 그림팽의 굴(동남)
import { MapBuilder } from './_build.js';
import { dropOnce, spawnBoss } from './_hooks.js';

const b = new MapBuilder(64, 64, '.', 5150);
for (let k = 0; k < 18; k++) b.blob(b.r() * 64, b.r() * 64, 3 + b.r() * 5, 2 + b.r() * 4, ',');
// 개울 (서→동 비스듬히), 다리
for (let x = 0; x < 64; x++) {
  const y = Math.round(36 + Math.sin(x / 7) * 2 + x / 16);
  b.fillG(x, y, 1, 3, '~').g(x, y + 1, x % 5 ? '~' : 'W');
}
// 공터
b.clearing(31, 4, 4, 3, '.');                 // 숲 입구
b.clearing(29, 14, 8, 5.5, '.');              // 늑대 초지
b.clearing(11, 24, 6.5, 6, ',');              // 거미 숲
b.clearing(50, 19, 7.5, 6, ':');              // 고블린 야영지
b.clearing(32, 29, 4, 3, '.');                // 갈림길
b.clearing(17, 48, 7, 6, '.');                // 멧돼지 공터
b.clearing(47, 52, 8.5, 7, ':');              // 그림팽의 굴
b.blob(47, 52, 5, 4, 'b', 'g', 0.3);
// 오솔길
b.path([[31, 1], [31, 7], [29, 10]], '=', 3);
b.path([[23, 15], [17, 20], [14, 23]], ':', 2);
b.path([[36, 14], [42, 17], [45, 19]], ':', 2);
b.path([[30, 19], [31, 26]], '=', 3);
b.path([[31, 31], [31, 44]], null, 3);
// 다리: 길이 개울을 건너는 칸을 다리로
for (let y = 30; y < 46; y++) for (let x = 31; x < 34; x++) b.g(x, y, b.getG(x, y) === '~' || b.getG(x, y) === 'W' ? 'B' : '=');
b.path([[31, 44], [24, 47], [20, 48]], ':', 2);
b.path([[33, 44], [40, 49], [42, 51]], ':', 2);
// 공터 장식
b.scatter('u', 0.05, [3, 17, 16, 14], ',', true).scatter('e', 0.06, [3, 17, 16, 14], ',', true);
b.scatter('f', 0.06, [20, 9, 18, 11], '.', true).scatter('*', 0.02, [20, 9, 18, 11], '.', true);
b.scatter('f', 0.05, [10, 42, 15, 12], '.', true).scatter('o', 0.03, [10, 42, 15, 12], '.', true);
b.scatter('k', 0.08, [38, 45, 18, 15], ':b', true).scatter('D', 0.04, [38, 45, 18, 15], ':', true);
// 고블린 야영지: 약탈품, 모닥불, 울타리
b.o(50, 19, 'h').o(47, 16, 'x').o(48, 16, 'x').o(53, 16, 'O').o(54, 17, 'O').o(46, 22, 'x').o(55, 21, 'z');
b.fillO(43, 13, 5, 1, '|').fillO(52, 25, 5, 1, '|');
// 늑대 초지의 쓰러진 나무와 사냥꾼 표지
b.o(26, 12, 'o').o(34, 16, 'o').o(30, 11, 'i');
// 그림팽의 굴: 고목 고리
for (let k = 0; k < 12; k++) {
  const a = (k / 12) * Math.PI * 2, x = Math.round(47 + Math.cos(a) * 7.5), y = Math.round(52 + Math.sin(a) * 6);
  if (!(x <= 43 && y <= 50)) b.o(x, y, 'D');
}
// 나머지: 빽빽한 숲
b.scatter('P', 0.45, [0, 0, 64, 64], '.,:');
b.fillWhere('.,:', 'T');
b.border('P', 1);
b.clear(30, 0, 3, 2);
const { ground, objects } = b.build();
const LAIR = { x: 47, y: 52 };

export default {
  id: 'whisper_forest', name: '속삭이는 숲', bgm: 'forest',
  ambient: { darkness: 0.42, tint: '#2f4a32', particles: 'fireflies', fog: true },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 32, y: 3 },
  ground, objects,
  lights: [
    { x: 50, y: 19, radius: 5, color: '#ff8a30' },
    { x: 47, y: 52, radius: 4, color: '#9a3050' },
  ],
  npcs: [],
  spawns: [
    { monster: 'wolf', x: 22, y: 10, w: 14, h: 9, count: 5, respawn: 18 },
    { monster: 'wolf', x: 29, y: 27, w: 6, h: 5, count: 2, respawn: 20 },
    { monster: 'forest_spider', x: 6, y: 19, w: 11, h: 11, count: 5, respawn: 20 },
    { monster: 'goblin', x: 44, y: 14, w: 12, h: 10, count: 5, respawn: 22 },
    { monster: 'boar', x: 11, y: 43, w: 13, h: 10, count: 4, respawn: 20 },
    { monster: 'wolf', x: 36, y: 46, w: 6, h: 5, count: 3, respawn: 22 },
  ],
  portals: [30, 31, 32].map((x) => ({ x, y: 1, to: 'village_roen', tx: 29, ty: 56, dir: 0 })),
  triggers: [
    { id: 'enter_hint', x: 28, y: 6, w: 7, h: 3, once: true, actions: [
      { msg: '나뭇잎이 바람도 없이 수군거린다. 멀리서 늑대 울음이 길게 이어진다.' },
    ] },
    { id: 'lair_warn', x: 40, y: 47, w: 4, h: 4, cond: { notFlag: 'ch1.forest_q' }, actions: [
      { msg: '고목 사이로 짙은 짐승 냄새가 흘러나온다. 지금은 들어가지 않는 편이 좋겠다.' },
    ] },
    { id: 'lair', x: 40, y: 46, w: 6, h: 6, once: true, cond: [{ flag: 'ch1.forest_q' }, { notFlag: 'ch1.grimfang' }], actions: [
      { lock: true },
      { bgm: 'boss' },
      { msg: '뼈 무더기 위에서 거대한 늑대가 몸을 일으킨다. 털 사이로 검은 연기가 피어오른다.', channel: 'warn' },
      spawnBoss('grimfang', LAIR.x + 1, LAIR.y + 1, 'ch1.grimfang'),
      { setFlag: 'ch1.grimfang_met' },
      { shake: 8, time: 0.7 },
      { dialog: 'ch1_grimfang', npc: null },
      { lock: false },
    ] },
  ],
  onKill: [
    { monster: 'grimfang', cond: { notFlag: 'ch1.grimfang' }, actions: [
      { setFlag: 'ch1.grimfang' },
      { bgm: 'forest' },
      { msg: '그림팽의 몸에서 검은 기운이 빠져나가자, 늙고 지친 늑대 한 마리만이 남아 숨을 거둔다.' },
      { notice: '무언가 떨어졌다', sub: '그을린 양피지 한 장' },
    ] },
  ],
  onPickup: [
    { item: 'torn_page_1', cond: { notFlag: 'ch1.page1' }, actions: [
      { setFlag: 'ch1.page1' }, { sound: 'page' }, { dialog: 'ch1_page', npc: null },
      { notice: '찢긴 장 I 을 되찾았다', sub: '촌장 하르딘에게 돌아가자' },
    ] },
  ],
  onEnter: [
    { if: [{ flag: 'ch1.grimfang_met' }, { notFlag: 'ch1.grimfang' }], then: [spawnBoss('grimfang', LAIR.x + 1, LAIR.y + 1, 'ch1.grimfang')] },
    { if: { flag: 'ch1.grimfang' }, then: [dropOnce('torn_page_1', LAIR.x, LAIR.y, 'ch1.page1')] },
  ],
};
