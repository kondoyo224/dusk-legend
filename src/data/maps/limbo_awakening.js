// 프롤로그 「귀혼의 서」 — 망각의 묘원. 소유: 워커 D. 대본: docs/SCRIPT.md §프롤로그
// 화면 방향 ↔ 그리드: 화면 북=좌상(작은 x,y) / 동=우상(큰 x) / 서=좌하(큰 y) / 남=우하
//   중앙(28,28) 눈뜸·세린 / 동(44,12) 육신의 기억 / 서(11,46) 마음의 기억 / 북(11,11) 혼의 기억·파수꾼 / 남(45,45) 빛의 길
import { MapBuilder } from './_build.js';
import { dropAt, dropOnce, spawnBoss } from './_hooks.js';

const b = new MapBuilder(58, 58, ' ', 7311);
// 섬처럼 떠 있는 안개 바닥들
b.blob(28, 28, 7.5, 7.5, 'm');
b.blob(44, 12, 8, 6.5, 'm');
b.blob(11, 46, 7, 7, 'm');
b.blob(11, 11, 8, 8, 'm', 'g', 0.12);
b.blob(45, 45, 5.5, 5.5, 'm');
// 길 (북·서 길목은 직선 복도 → 영혼 장벽으로 봉인)
b.path([[32, 24], [38, 17], [42, 13]], 'm', 3);
b.path([[23, 22], [15, 22], [15, 17]], 'm', 3);            // 북 복도: 행 22~24
b.path([[22, 31], [22, 41], [15, 41], [13, 44]], 'm', 3);  // 서 복도: 열 22~24
b.path([[32, 32], [40, 40], [43, 43]], 'm', 3);
// 북 투기장: 기둥 고리
for (let k = 0; k < 10; k++) {
  const a = (k / 10) * Math.PI * 2;
  const x = Math.round(11 + Math.cos(a) * 6), y = Math.round(11 + Math.sin(a) * 6);
  if (!(x >= 13 && y >= 15)) b.o(x, y, 'I'); // 남동쪽(복도 쪽) 입구는 비워 둔다
}
b.reserve(13, 13, 5, 5);
// 장식
b.scatter('g', 0.05, [0, 0, 58, 58], 'm');
b.scatter('D', 0.025, [0, 0, 58, 58], 'm');
b.scatter('k', 0.04, [0, 0, 58, 58], 'm');
b.scatter('r', 0.04, [34, 4, 20, 16], 'm');   // 동: 무너진 수련장 잔해
b.scatter('f', 0.10, [4, 39, 15, 15], 'm');   // 서: 고향의 꽃
// 중앙: 눈뜬 자리
b.clear(24, 24, 9, 9).reserve(24, 24, 9, 9);
b.o(26, 25, 'g').o(30, 25, 'g').o(25, 29, 'q').o(32, 30, 'q');
// 동: 부서진 석상과 짚더미 표적
b.clear(40, 9, 8, 7).o(41, 9, 'S').o(47, 14, 'S').o(46, 9, 'x');
// 서: 기억 속 집 마당 (울타리·우물)
b.clear(7, 42, 9, 9).o(7, 43, '|').o(7, 44, '|').o(7, 45, '|').o(8, 42, '|').o(9, 42, '|').o(13, 49, 'Q').o(15, 43, 'f');
// 남: 빛의 길 끝, 귀혼의 문 자리
b.clear(42, 42, 7, 7).o(43, 47, 'q').o(47, 43, 'q').o(42, 44, 'R').o(44, 42, 'R');
// 영혼 장벽 (진행에 따라 열림)
const WEST_GATE = [[22, 37], [23, 37], [24, 37]];
const NORTH_GATE = [[18, 22], [18, 23], [18, 24]];
for (const [x, y] of [...WEST_GATE, ...NORTH_GATE]) b.o(x, y, 'X');
b.o(45, 45, ' ');
b.o(7, 6, ' '); // 북 투기장 서쪽 끝: 고목이 막아 (6,6) 칸이 갇히던 것 해소 (망령 스폰 영역)
const { ground, objects } = b.build();

const open = (cells) => cells.map(([x, y]) => ({ setTile: { x, y, id: null } }));
const SHADES = [{ spawn: 'shade', x: 43, y: 11 }, { spawn: 'shade', x: 46, y: 12 }, { spawn: 'shade', x: 44, y: 14 }];

export default {
  id: 'limbo_awakening', name: '망각의 묘원', bgm: 'limbo',
  ambient: { darkness: 0.55, tint: '#3a2f5a', particles: 'soul', fog: true },
  respawn: { map: 'limbo_awakening', x: 29, y: 30 },
  start: { x: 29, y: 30 },
  ground, objects,
  lights: [
    { x: 28, y: 28, radius: 6, color: '#9f8cff' },
    { x: 44, y: 12, radius: 5, color: '#ffcf8a' },
    { x: 11, y: 46, radius: 5, color: '#ffb6d0' },
    { x: 11, y: 11, radius: 6, color: '#8fb8ff' },
    { x: 45, y: 45, radius: 6, color: '#fff2c0' },
  ],
  npcs: [
    { id: 'recorder', x: 27, y: 27, dir: 3 },
    { id: 'memory_echo', x: 11, y: 46, dir: 3, cond: [{ flag: 'pro.body' }, { notFlag: 'pro.mind_drop' }] },
  ],
  spawns: [
    // 혼의 구역의 망령들 (상시 리스폰 — 레벨업용)
    { monster: 'lost_soul', x: 5, y: 5, w: 12, h: 4, count: 3, respawn: 20, cond: { flag: 'pro.mind' } },
    { monster: 'lost_soul', x: 13, y: 17, w: 5, h: 4, count: 2, respawn: 20, cond: { flag: 'pro.mind' } },
    // 육신의 구역: 기억을 되찾은 뒤에도 수련용 그림자
    { monster: 'shade', x: 39, y: 8, w: 10, h: 7, count: 3, respawn: 15, cond: { flag: 'pro.body' } },
  ],
  portals: [
    { x: 45, y: 45, to: 'limbo_altar', tx: 21, ty: 23, dir: 0, cond: { flag: 'pro.named' }, failMsg: '빛이 고여 있지만, 이름 없는 혼은 이 길을 걸을 수 없다.' },
  ],
  triggers: [
    // 이동 튜토리얼 이후 안내
    { id: 'east_hint', x: 32, y: 21, w: 4, h: 4, once: true, cond: { flag: 'pro.awake' }, actions: [
      { msg: '동쪽 안개 너머에서 쇠붙이가 부딪치는 소리가 들린다…' },
    ] },
    // 육신의 기억: 전투 튜토리얼
    { id: 'east_fight', x: 38, y: 8, w: 12, h: 9, once: true, cond: { flag: 'pro.awake' }, actions: [
      { lock: true },
      { msg: '안개가 엉기며 형체 없는 그림자들이 일어선다!', channel: 'warn' },
      ...SHADES,
      { shake: 4, time: 0.3 },
      { setFlag: 'pro.east_fight' },
      { wait: 0.6 },
      { dialog: 'pro_fight_tip', npc: null },
      { lock: false },
    ] },
    // 잠긴 길 안내
    { id: 'west_locked', x: 22, y: 34, w: 3, h: 3, cond: { notFlag: 'pro.body' }, actions: [{ msg: '희미한 장벽이 길을 막는다. 먼저 동쪽의 빛을 찾아야 할 것 같다.' }] },
    { id: 'north_locked', x: 19, y: 22, w: 3, h: 3, cond: { notFlag: 'pro.mind' }, actions: [{ msg: '차가운 장벽 너머로 누군가 지켜보는 기척이 있다. 아직은 열리지 않는다.' }] },
    // 마음의 기억: 아이템 사용 튜토리얼 (혼이 흔들림 → 혼의 물병)
    { id: 'west_wave', x: 13, y: 40, w: 9, h: 5, once: true, cond: { flag: 'pro.body' }, actions: [
      { lock: true },
      { shake: 6, time: 0.6 },
      { msg: '낯익은 꽃내음… 그리고 가슴을 찢는 그리움이 밀려든다.', channel: 'warn' },
      { call: (g) => { const p = g.player; p.hp = Math.max(1, Math.floor(p.hp * 0.45)); g.bus.emit('stats:changed', { entity: p }); } },
      { wait: 0.5 },
      { giveItem: 'soul_vial', qty: 3 },
      { call: (g) => { const hb = g.state.hotbar; if (!hb.some((s) => s?.item === 'soul_vial')) hb[0] = { item: 'soul_vial' }; g.bus.emit('inventory:changed', {}); } },
      { dialog: 'pro_vial_tip', npc: null },
      { lock: false },
    ] },
    // 마음의 기억: 리나의 환영에게 다가가면 말을 건다
    { id: 'echo_near', x: 9, y: 44, w: 5, h: 5, once: true, cond: [{ flag: 'pro.body' }, { notFlag: 'pro.mind_drop' }], actions: [
      { dialog: 'pro_echo', npc: 'memory_echo' },
    ] },
    // 혼의 기억: 망각의 파수꾼
    { id: 'warden_gate', x: 12, y: 14, w: 6, h: 4, once: true, cond: { flag: 'pro.mind' }, actions: [
      { lock: true },
      { bgm: 'boss' },
      { msg: '기둥 사이의 안개가 무겁게 가라앉는다.', channel: 'warn' },
      spawnBoss('oblivion_warden', 10, 10, 'pro.warden'),
      { setFlag: 'pro.warden_met' },
      { shake: 8, time: 0.6 },
      { dialog: 'pro_warden', npc: null },
      { lock: false },
    ] },
  ],
  onKill: [
    { monster: 'shade', all: true, cond: [{ flag: 'pro.east_fight' }, { notFlag: 'pro.body_drop' }], actions: [
      { setFlag: 'pro.body_drop' },
      { sound: 'page' },
      dropAt('shard_body', 44, 12),
      { notice: '기억의 조각이 떨어졌다', sub: '조각을 클릭하거나, 곁에서 F / E 를 눌러 줍는다' },
    ] },
    { monster: 'oblivion_warden', cond: { notFlag: 'pro.warden' }, actions: [
      { setFlag: 'pro.warden' },
      { bgm: 'limbo' },
      { msg: '파수꾼의 갑주가 빈 껍데기처럼 무너져 내린다.' },
      dropAt('shard_soul', 11, 11),
    ] },
  ],
  onPickup: [
    { item: 'shard_body', cond: { notFlag: 'pro.body' }, actions: [
      { setFlag: 'pro.body' },
      { dialog: 'pro_body', npc: null },
      ...open(WEST_GATE),
      { sound: 'portal' },
      { notice: '서쪽의 장벽이 걷혔다', sub: '소지품: I  ·  주운 조각은 인벤토리에 있다' },
    ] },
    { item: 'shard_mind', cond: { notFlag: 'pro.mind' }, actions: [
      { setFlag: 'pro.mind' },
      { dialog: 'pro_mind', npc: null },
      ...open(NORTH_GATE),
      { sound: 'portal' },
      { notice: '북쪽의 장벽이 걷혔다', sub: '마지막 기억이 너를 기다린다' },
    ] },
    { item: 'shard_soul', cond: { notFlag: 'pro.soul' }, actions: [
      { setFlag: 'pro.soul' },
      { lock: true },
      { fade: 1, time: 1.2 },
      { bgm: 'boss' },
      { dialog: 'pro_death', npc: null },
      { bgm: 'limbo' },
      { fade: 0, time: 1.2 },
      { lock: false },
      { notice: '세 기억을 모두 되찾았다', sub: '기록자 세린에게 돌아가자' },
    ] },
  ],
  onEnter: [
    // 첫 눈뜸
    { if: { notFlag: 'pro.awake' }, then: [
      { lock: true },
      { fade: 1, time: 0.01 },
      { wait: 0.6 },
      { msg: '……차갑다. 물속 같은 고요.' },
      { fade: 0, time: 2.2 },
      { wait: 0.8 },
      { moveNpc: 'recorder', x: 28, y: 29 },
      { faceNpc: 'recorder', dir: 3 },
      { dialog: 'pro_wake', npc: 'recorder' },
      { setFlag: 'pro.awake' },
      { lock: false },
      { notice: '이동: WASD / 방향키 · 땅을 클릭', sub: '누르고 있으면 계속 걷는다 — 동쪽(화면 오른쪽 위)으로' },
    ] },
    // 재입장 복구: 열린 장벽, 진행 중이던 전투, 줍지 않은 조각
    { if: { flag: 'pro.body' }, then: open(WEST_GATE) },
    { if: { flag: 'pro.mind' }, then: open(NORTH_GATE) },
    { if: [{ flag: 'pro.east_fight' }, { notFlag: 'pro.body_drop' }], then: SHADES },
    { if: [{ flag: 'pro.warden_met' }, { notFlag: 'pro.warden' }], then: [spawnBoss('oblivion_warden', 10, 10, 'pro.warden')] },
    { if: { flag: 'pro.body_drop' }, then: [dropOnce('shard_body', 44, 12, 'pro.body')] },
    { if: { flag: 'pro.mind_drop' }, then: [dropOnce('shard_mind', 11, 46, 'pro.mind')] },
    { if: { flag: 'pro.warden' }, then: [dropOnce('shard_soul', 11, 11, 'pro.soul')] },
  ],
};
