// 로엔 마을 — 허브. 소유: 워커 D. 대본: docs/SCRIPT.md §1장 이후
// 큰길: 세로 x28~30, 가로 y28~30, 가운데 우물 광장.
//   서북: 신전(부활 지점 14,10) · 리나의 집 / 동북: 촌장의 집 · 빵집 · 과부의 집
//   서남: 여관 '잠든 사슴'(지하실 계단 7,36) · 밭 / 동남: 대장간 · 잡화점 · 수련장
//   출구: 위(북문→황혼의 탑) · 오른쪽(동문→옛 묘지) · 아래(남쪽 길→속삭이는 숲)
import { MapBuilder } from './_build.js';

const b = new MapBuilder(60, 60, '.', 2024);
// 풀밭 얼룩
for (let k = 0; k < 14; k++) b.blob(3 + b.r() * 54, 3 + b.r() * 54, 2 + b.r() * 4, 2 + b.r() * 3, ',');
// 큰길·광장
b.fillG(28, 1, 3, 58, 'c').fillG(1, 28, 58, 3, 'c');
b.blob(29, 29, 5.5, 5.5, 'c', 'g', 0);

// ── 신전 ──
b.room(6, 5, 17, 14, { wall: '#', floor: 'M', doors: [[13, 18], [14, 18], [15, 18]] });
b.fillG(13, 7, 3, 12, 'r');
b.o(14, 7, 'A').o(11, 7, 'R').o(17, 7, 'R');
for (const y of [9, 12, 15]) b.o(9, y, 'I').o(19, y, 'I');
b.o(6, 10, 't').o(22, 10, 't').o(6, 14, 't').o(22, 14, 't');
b.o(8, 6, 'L').o(9, 6, 'L').o(19, 6, 'L').o(20, 6, 'L');
b.path([[13, 19], [13, 27]], 'c', 3);
// ── 리나의 집 (주인공의 집) ──
b.room(3, 21, 9, 7, { wall: 'H', floor: 'w', doors: [[11, 24]] });
b.o(4, 22, 'y').o(4, 24, 'y').o(7, 22, 'n').o(9, 26, 'O').o(5, 26, 'z');
b.path([[12, 24], [13, 24]], ':', 1);
b.fillO(4, 28, 7, 1, 'f');

// ── 촌장의 집 ──
b.room(35, 5, 13, 10, { wall: 'H', floor: 'w', doors: [[41, 14], [42, 14]] });
b.o(36, 6, 'L').o(37, 6, 'L').o(38, 6, 'L').o(41, 8, 'n').o(42, 8, 'n').o(46, 6, 'z').o(46, 13, 'O').o(36, 13, 'y');
b.path([[41, 15], [41, 27]], '=', 2);
// ── 빵집 (베아) ──
b.room(50, 5, 8, 7, { wall: 'H', floor: 'w', doors: [[50, 8]] });
b.o(55, 6, 'h').o(52, 6, 'n').o(56, 10, 'O').o(51, 10, 'x');
b.path([[49, 8], [49, 16], [43, 16]], '=', 1);
// ── 과부의 집 (엘다) ──
b.room(50, 16, 8, 7, { wall: 'H', floor: 'w', doors: [[50, 19]] });
b.o(56, 17, 'y').o(53, 17, 'n').o(56, 21, 'L');
b.path([[49, 19], [43, 19], [43, 21]], '=', 1);

// ── 여관 '잠든 사슴' ──
b.room(5, 34, 18, 12, { wall: 'H', floor: 'w', doors: [[22, 39], [22, 40]] });
b.o(7, 36, 'v').o(6, 35, 't');
for (const [x, y] of [[11, 37], [11, 41], [15, 37], [15, 41]]) b.o(x, y, 'n');
b.fillO(18, 35, 1, 5, 'n').o(20, 35, 'O').o(21, 35, 'O').o(21, 36, 'O');
b.o(6, 43, 'y').o(8, 43, 'y').o(10, 44, 'y').o(21, 44, 'x');
b.path([[23, 39], [27, 39]], 'c', 2);
b.o(23, 37, 'i');
// ── 밭 ──
b.fillG(5, 48, 18, 8, ':');
for (let y = 49; y < 55; y += 2) b.fillO(6, y, 16, 1, 'u');
b.fillO(4, 47, 20, 1, '|').fillO(4, 56, 20, 1, '|').fillO(4, 47, 1, 10, '|').fillO(23, 47, 1, 10, '|').clear(23, 51, 1, 2);
b.path([[24, 51], [27, 51]], ':', 2);

// ── 대장간 ──
b.room(34, 33, 11, 8, { wall: '#', floor: '_', doors: [[34, 36], [34, 37]] });
b.o(39, 35, 'a').o(42, 34, 'h').o(43, 37, 'O').o(43, 38, 'O').o(37, 39, 'x').o(41, 39, 'n');
b.path([[31, 36], [33, 36]], 'c', 2);
b.o(33, 34, 'i');
// ── 잡화점 ──
b.room(47, 33, 10, 8, { wall: 'H', floor: 'w', doors: [[51, 33], [52, 33]] });
b.fillO(49, 36, 5, 1, 'n').o(48, 39, 'L').o(49, 39, 'L').o(55, 39, 'x').o(55, 34, 'O').o(48, 34, 'O');
b.path([[51, 31], [51, 32]], 'c', 2);
// ── 수련장 ──
b.fillG(36, 45, 19, 11, ':');
b.fillO(36, 45, 19, 1, '|').fillO(36, 55, 19, 1, '|').fillO(36, 45, 1, 11, '|').fillO(54, 45, 1, 11, '|').clear(45, 45, 2, 1);
for (const [x, y] of [[40, 49], [40, 52], [50, 49], [50, 52]]) b.o(x, y, 'x');
b.o(49, 47, 'S').o(38, 54, 'O').o(52, 54, 'O').o(37, 47, 'h');
b.path([[45, 31], [45, 44]], '=', 2).reserve(37, 46, 17, 9);

// ── 광장 장식 ──
b.o(29, 29, 'Q');
for (const [x, y] of [[24, 24], [34, 24], [24, 34], [34, 34], [27, 12], [31, 46], [12, 31], [46, 27], [27, 52], [52, 31], [31, 6]]) b.o(x, y, 'l');
b.o(32, 26, 'i');
// 북문·동문 성벽 흔적 (울타리+돌)
b.fillO(20, 3, 8, 1, '#').fillO(31, 3, 8, 1, '#').o(27, 3, 't').o(31, 3, 't');
b.fillO(56, 23, 1, 5, '#').fillO(56, 31, 1, 8, '#').o(56, 27, 't').o(56, 31, 't');

// 테두리: 침엽수림
b.border('P', 2);
b.clear(28, 0, 3, 3).clear(57, 28, 3, 3).clear(28, 57, 3, 3);
b.reserve(26, 0, 7, 60).reserve(0, 26, 60, 7);
// 나무·덤불·꽃 (풀밭에만)
b.scatter('T', 0.035, [2, 2, 56, 56], '.,');
b.scatter('*', 0.02, [2, 2, 56, 56], '.,');
b.scatter('f', 0.03, [2, 2, 56, 56], '.,');
b.scatter('o', 0.006, [2, 2, 56, 56], '.,');
const { ground, objects } = b.build();

export const TEMPLE = { x: 14, y: 10 };
// 습격 이벤트 (2장 끝) — 리나의 집 앞
const RAIDERS = [
  { spawn: 'cultist', x: 15, y: 23 }, { spawn: 'cultist', x: 16, y: 25 }, { spawn: 'cultist', x: 17, y: 22 }, { spawn: 'cultist', x: 15, y: 26 },
];
const raidOn = [{ flag: 'ch2.raid_on' }, { notFlag: 'ch2.raid_done' }];

export default {
  id: 'village_roen', name: '로엔 마을', bgm: 'village',
  // 낮(ART_STYLE §3): 아주 옅은 따뜻한 색, darkness 0.08. 2장 끝 습격(찢긴 장 II 이후 ~ 격퇴 전)에 들어오면 밤.
  // 렌더러는 맵 로드 때 ambient 를 읽으므로 getter 로 진행도에 따라 고른다 (격퇴 후엔 다음 입장부터 낮).
  get ambient() {
    const f = globalThis.game?.state?.flags;
    return f && f['ch2.page2'] && !f['ch2.raid_done']
      ? { darkness: 0.55, tint: '#3a2a4a', particles: 'embers', fog: false }
      : { darkness: 0.08, tint: '#fff2dc', particles: 'fireflies', fog: false };
  },
  safe: true,
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 14, y: 10 },
  ground, objects,
  lights: [
    { x: 14, y: 8, radius: 5, color: '#fff0c0' },
    { x: 13, y: 39, radius: 5, color: '#ffb060' },
  ],
  npcs: [
    { id: 'odric', x: 12, y: 9, dir: 3 },
    { id: 'hardin', x: 41, y: 10, dir: 4 },
    { id: 'bron', x: 38, y: 36, dir: 5 },
    { id: 'mira', x: 51, y: 35, dir: 3 },
    { id: 'toma', x: 17, y: 38, dir: 6 },
    { id: 'garen', x: 45, y: 49, dir: 0 },
    { id: 'lina', x: 7, y: 24, dir: 3, cond: { flag: 'pro.reborn' } },
    { id: 'guard_north', x: 27, y: 5, dir: 4 },
    { id: 'guard_east', x: 54, y: 27, dir: 6 },
    { id: 'villager_baker', x: 53, y: 8, dir: 5 },
    { id: 'villager_farmer', x: 14, y: 51, dir: 4 },
    { id: 'villager_widow', x: 53, y: 19, dir: 5 },
    { id: 'villager_kid', x: 32, y: 31, dir: 4 },
    { id: 'villager_bard', x: 25, y: 31, dir: 2 },
    // 엔딩 후: 기록자 세린이 신전에 머문다 (망각의 균열 안내)
    { id: 'recorder', x: 17, y: 9, dir: 5, cond: { flag: 'end.cleared' }, dialog: 'recorder_post' },
  ],
  spawns: [],
  portals: [
    { x: 7, y: 36, to: 'roen_cellar', tx: 4, ty: 4, dir: 3, cond: { flag: 'ch1.cellar_ok' }, failMsg: '지하실 문이 잠겨 있다. 여관주인 토마의 허락이 필요하다.' },
    // 남쪽 길 → 속삭이는 숲
    ...[28, 29, 30].map((x) => ({ x, y: 58, to: 'whisper_forest', tx: 32, ty: 3, dir: 4, cond: { flag: 'ch1.met_hardin' }, failMsg: '경비병이 길을 막는다. "촌장님을 먼저 뵙고 오시오."' })),
    // 동문 → 옛 묘지
    ...[28, 29, 30].map((y) => ({ x: 58, y, to: 'old_graveyard', tx: 2, ty: 29, dir: 3, cond: { flag: 'ch1.done' }, failMsg: '동문이 굳게 닫혀 있다. 묘지 쪽은 아직 출입 금지다.' })),
    // 북문 → 황혼의 탑
    ...[28, 29, 30].map((x) => ({ x, y: 1, to: 'dusk_tower_1', tx: 24, ty: 44, dir: 0, cond: { flag: 'ch3.open' }, failMsg: '북문 너머는 잿빛 황야다. 아직 그 길을 갈 때가 아니다.' })),
    // 엔딩 후: 신전의 균열 → 망각의 균열
    { x: 21, y: 6, to: 'rift_abyss', tx: 24, ty: 42, dir: 0, cond: { flag: 'end.cleared' }, failMsg: '' },
  ],
  triggers: [
    // 2장 끝 습격: 리나의 집 앞
    { id: 'raid_scene', x: 12, y: 19, w: 10, h: 10, once: true, cond: raidOn, actions: [
      { lock: true }, { dialog: 'ch2_raid', npc: null }, { lock: false },
    ] },
  ],
  onKill: [
    { monster: 'cultist', all: true, cond: raidOn, actions: [
      { setFlag: 'ch2.raid_done' },
      { lock: true },
      { bgm: 'village' },
      { wait: 0.8 },
      { if: (g) => !g.findNpc('lina'), then: [{ spawnNpc: 'lina', x: 12, y: 24, dir: 2 }] },
      { moveNpc: 'lina', x: 14, y: 24 },
      { dialog: 'ch2_raid_end', npc: 'lina' },
      { lock: false },
      { save: true },
    ] },
  ],
  onEnter: [
    // 부활: 신전 제단 위에서 깨어난다
    { if: { notFlag: 'pro.reborn' }, then: [
      { lock: true },
      { wait: 0.8 },
      { shake: 3, time: 0.4 },
      // pro.reborn 을 revive 보다 먼저: stats.revive 는 이 플래그로 혼(ghost) 여부를 정한다
      { setFlag: 'pro.reborn' },
      { revive: true },
      { sound: 'levelup' },
      { msg: '……숨이, 들어온다. 차갑고 날카로운 공기가 폐를 찌른다.' },
      { wait: 1.2 },
      { faceNpc: 'odric', dir: 2 },
      { say: '이, 이럴 수가…!', npc: 'odric' },
      { wait: 1.0 },
      { moveNpc: 'odric', x: 13, y: 10 },
      { dialog: 'odric_reborn', npc: 'odric' },
      { chapter: 1 },
      { spawnNpc: 'lina', x: 7, y: 24, dir: 3 },
      { lock: false },
      { title: '제1장 — 돌아온 자', sub: '로엔 마을' },
      { save: true },
    ] },
    // 엔딩 후 망각의 균열 입구
    { if: { flag: 'end.cleared' }, then: [{ setTile: { x: 21, y: 6, id: 'portal_glow' } }] },
    // 습격: 2장 보스 처치 후 귀환
    { if: [{ flag: 'ch2.page2' }, { notFlag: 'ch2.raid_on' }], then: [
      { setFlag: 'ch2.raid_on' },
      { bgm: 'boss' },
      { notice: '마을에 경종이 울린다!', sub: '리나의 집 쪽에서 비명이 들린다' },
      { msg: '경비병 테스: 황혼 교단이다! 서북쪽 민가로 몰려갔어!', channel: 'npc' },
    ] },
    { if: raidOn, then: [{ bgm: 'boss' }, ...RAIDERS, { removeNpc: 'lina' }] },
  ],
};
