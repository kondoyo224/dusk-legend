// 3장 — 황혼의 탑 정상. 소유: 워커 B (재배정 B10).
// 계단 위 경비실 → 허공 위 다리 → 용암 고리에 둘러싸인 의식의 원판(벨자르 → 황혼의 왕의 그림자) → 엔딩
import { MapBuilder } from './_build.js';
import { spawnBoss } from './_hooks.js';

const C = { x: 20, y: 11 };          // 의식 원판 중심 (보스 위치)
const b = new MapBuilder(40, 40, ' ', 7707);
// 용암 고리 → 대리석 원판
b.blob(C.x, C.y, 10.5, 9.5, 'L', 'g', 0.15);
b.blob(C.x, C.y, 8.5, 7.5, 'M', 'g', 0);
b.blob(C.x, C.y, 3, 2.5, 'r', 'g', 0);        // 중앙 붉은 문양
// 경비실 (계단 도착)
b.room(6, 24, 28, 15, { wall: '#', floor: '_', doors: [[19, 24], [20, 24], [21, 24]] });
b.fillO(19, 37, 3, 1, 'v');
for (const [x, y] of [[10, 24], [16, 24], [24, 24], [30, 24], [6, 30], [33, 30]]) b.o(x, y, 't');
b.o(9, 27, 'x').o(10, 27, 'O').o(30, 27, 'x').o(31, 35, 'O').o(8, 35, 'L').o(9, 35, 'L').o(26, 30, 'n').o(14, 31, 'k');
// 허공 위 다리 (원판까지)
b.path([[19, 23], [19, 17]], 'M', 3);
// 원판 장식: 기둥 고리(출입구 남쪽만 비움), 화로, 제단
for (let k = 0; k < 16; k++) {
  const a = (k / 16) * Math.PI * 2, x = Math.round(C.x + Math.cos(a) * 7), y = Math.round(C.y + Math.sin(a) * 6.2);
  if (y >= C.y + 4 && Math.abs(x - C.x) <= 2) continue;
  if (k % 2 === 0) b.o(x, y, 'I');
}
b.o(C.x - 4, C.y - 3, 'h').o(C.x + 4, C.y - 3, 'h').o(C.x - 4, C.y + 3, 'h').o(C.x + 4, C.y + 3, 'h');
b.o(C.x, C.y - 5, 'A');
const { ground, objects } = b.build();

const KING = { spawn: 'dusk_king', x: C.x, y: C.y - 1, boss: true };
// 엔딩 시퀀스 (처치 직후 / 재입장 복구 공용). g._ch3Ending: 같은 세션 중복 실행 방지
const ENDING = [
  { call: (g) => { g._ch3Ending = true; } },
  { lock: true },
  { wait: 1.2 },
  { shake: 10, time: 1.6 },
  { msg: '그림자가 비명도 없이 무너져 내린다. 탑 전체가 신음하듯 흔들린다.', channel: 'warn' },
  { bgm: 'ending' },
  { wait: 1.0 },
  { fade: 1, time: 1.4 },
  { msg: '…눈부신 빛. 품 안의 찢긴 장들이 저절로 떠올라 하늘로 오른다.' },
  // 왕이 떨군 찢긴 장 III(바닥 드랍)까지 거두어, 세 장 모두 책으로 돌아간다
  { call: (g) => { for (const e of [...g.world.entities]) if (e.kind === 'drop' && /^torn_page_/.test(e.itemId || '')) g.world.removeEntity(e); } },
  { setFlag: 'ch3.page3' },
  { takeItem: 'torn_page_1' }, { takeItem: 'torn_page_2' }, { takeItem: 'torn_page_3' },
  { if: (g) => !g.findNpc('recorder'), then: [{ call: (g) => { const p = g.player; g.world.spawnNpc('recorder', p.x, Math.max(1, p.y - 2), { dir: 4 }); } }] },
  { wait: 0.6 },
  { fade: 0, time: 1.6 },
  { dialog: 'ch3_ending', npc: 'recorder' },
  { completeQuest: 'ch3_tower' },
  { setFlag: 'end.cleared' },
  { chapter: 4 },
  { save: true },
  { lock: false },
  { ending: 'main' },
];

export default {
  id: 'dusk_tower_2', name: '황혼의 탑 — 정상', bgm: 'tower',
  ambient: { darkness: 0.55, tint: '#6a2a2a', particles: 'embers', fog: true },
  respawn: { map: 'village_roen', x: 14, y: 10 },
  start: { x: 20, y: 35 },
  ground, objects,
  lights: [
    { x: C.x, y: C.y, radius: 7, color: '#ff4a2a' },
    { x: 20, y: 30, radius: 5, color: '#ff8a40' },
  ],
  npcs: [
    { id: 'belzar_npc', x: C.x, y: C.y - 2, dir: 4, cond: { notFlag: 'ch3.belzar_met' } },
  ],
  spawns: [
    { monster: 'cultist', x: 8, y: 26, w: 24, h: 8, count: 3, respawn: 30 },
    { monster: 'dusk_knight', x: 13, y: 29, w: 14, h: 5, count: 2, respawn: 40 },
    { monster: 'stone_golem', x: 19, y: 19, w: 3, h: 3, count: 1, respawn: 60, cond: { notFlag: 'ch3.belzar_met' } },
  ],
  portals: [
    ...[19, 20, 21].map((x) => ({ x, y: 37, to: 'dusk_tower_1', tx: 23, ty: 7, dir: 4 })),
  ],
  triggers: [
    { id: 'hall', x: 15, y: 30, w: 10, h: 4, once: true, actions: [
      { msg: '바람 소리가 들린다. 경비실 너머로 탑의 꼭대기가 허공에 떠 있다.' },
    ] },
    // 벨자르와 마주침
    { id: 'belzar_meet', x: 14, y: 16, w: 13, h: 3, once: true, cond: [{ flag: 'ch3.open' }, { notFlag: 'ch3.belzar_met' }], actions: [
      { lock: true },
      { bgm: 'boss' },
      { faceNpc: 'belzar_npc', dir: 4 },
      { wait: 0.4 },
      { dialog: 'ch3_belzar', npc: 'belzar_npc' },
      { setFlag: 'ch3.belzar_met' },
      { fx: 'blink', x: C.x, y: C.y - 2 },
      { removeNpc: 'belzar_npc' },
      { spawn: 'belzar', x: C.x, y: C.y - 2, boss: true },
      { shake: 6, time: 0.5 },
      { lock: false },
    ] },
    // 엔딩 도중 끊겼을 때 복구
    { id: 'ending_resume', x: 12, y: 4, w: 17, h: 15, cond: [{ flag: 'ch3.king' }, { notFlag: 'end.cleared' }, (g) => !g._ch3Ending], actions: ENDING },
  ],
  onKill: [
    { monster: 'belzar', cond: { notFlag: 'ch3.belzar' }, actions: [
      { setFlag: 'ch3.belzar' },
      { lock: true },
      { wait: 1.0 },
      { spawnNpc: 'belzar_npc', x: C.x, y: C.y - 3, dir: 4 },
      { dialog: 'ch3_belzar_fall', npc: 'belzar_npc' },
      { fx: 'summon', x: C.x, y: C.y - 1 },
      { shake: 12, time: 1.4 },
      { removeNpc: 'belzar_npc' },
      { wait: 0.8 },
      KING,
      { setFlag: 'ch3.king_met' },
      { bgm: 'final' },
      { dialog: 'ch3_king', npc: null },
      { lock: false },
    ] },
    // 중복 방지 표시를 플래그보다 먼저(동기 실행) — setFlag 뒤 await 사이에 ending_resume 트리거가 끼어들면 엔딩이 두 번 돈다
    { monster: 'dusk_king', cond: { notFlag: 'ch3.king' }, actions: [{ call: (g) => { g._ch3Ending = true; } }, { setFlag: 'ch3.king' }, ...ENDING] },
  ],
  onEnter: [
    { if: [{ flag: 'ch3.belzar_met' }, { notFlag: 'ch3.belzar' }], then: [spawnBoss('belzar', C.x, C.y - 2, 'ch3.belzar')] },
    { if: [{ flag: 'ch3.belzar' }, { notFlag: 'ch3.king' }], then: [spawnBoss('dusk_king', C.x, C.y - 1, 'ch3.king')] },
    { if: { flag: 'end.cleared' }, then: [{ msg: '정상은 고요하다. 용암마저 식어 붉은 빛만 희미하게 남았다.' }] },
  ],
};
