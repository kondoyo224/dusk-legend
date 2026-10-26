// 프롤로그 — 신들의 제단. 다섯 제단(화면 위쪽 호), 귀혼의 문(화면 아래쪽). 소유: 워커 D.
import { MapBuilder } from './_build.js';

const b = new MapBuilder(34, 34, ' ', 4242);
// 마름모꼴 대리석 전당: 중심(17,17), 체비셰프가 아닌 맨해튼 거리로 잘라 화면상 원형에 가깝게
for (let y = 0; y < 34; y++) for (let x = 0; x < 34; x++) {
  const d = Math.abs(x - 17) + Math.abs(y - 17), c = Math.max(Math.abs(x - 17), Math.abs(y - 17));
  if (d <= 17 && c <= 12) b.g(x, y, 'M');
  if ((d === 17 && c <= 12) || (c === 12 && d <= 17)) b.o(x, y, 'K');
}
// 중앙 의식의 원
b.blob(17, 17, 3.2, 3.2, 'm', 'g', 0);
// 다섯 제단 (화면 기준 서→동 호)
export const ALTARS = { noctis: [10, 18], astera: [10, 14], argen: [12, 12], elia: [14, 10], kai: [18, 10] };
for (const [x, y] of Object.values(ALTARS)) b.o(x, y, 'R');
// 제단 앞 화로, 회랑 기둥
b.o(9, 16, 'h').o(16, 9, 'h');
for (const [x, y] of [[8, 22], [11, 25], [22, 8], [25, 11], [20, 26], [26, 20]]) b.o(x, y, 'I');
// 귀혼의 문 자리(닫힘) — 양옆 석상
b.o(25, 23, 'S').o(23, 25, 'S');
b.o(18, 18, 'A');
const { ground, objects } = b.build();
export const GATE = { x: 24, y: 24 };

export default {
  id: 'limbo_altar', name: '신들의 제단', bgm: 'altar',
  ambient: { darkness: 0.45, tint: '#4a3f6a', particles: 'soul', fog: false },
  respawn: { map: 'limbo_awakening', x: 29, y: 30 },
  start: { x: 21, y: 23 },
  ground, objects,
  lights: [
    { x: 12, y: 12, radius: 3, color: '#ffb060' },
    { x: 17, y: 17, radius: 5, color: '#c9b6ff' },
  ],
  npcs: [
    { id: 'recorder', x: 19, y: 21, dir: 7, dialog: 'recorder_altar' },
    { id: 'altar_noctis', x: 10, y: 18, dir: 3 },
    { id: 'altar_astera', x: 10, y: 14, dir: 3 },
    { id: 'altar_argen', x: 12, y: 12, dir: 3 },
    { id: 'altar_elia', x: 14, y: 10, dir: 3 },
    { id: 'altar_kai', x: 18, y: 10, dir: 3 },
  ],
  spawns: [],
  portals: [
    { x: GATE.x, y: GATE.y, to: 'village_roen', tx: 14, ty: 8, dir: 4, cond: { flag: 'pro.gate' }, failMsg: '빛이 닫혀 있다. 아직 건너갈 때가 아니다.' },
  ],
  triggers: [],
  onEnter: [
    { if: { notFlag: 'pro.altar_seen' }, then: [
      { lock: true },
      { wait: 0.6 },
      { title: '신들의 제단', sub: '황혼을 막아선 다섯 신' },
      { wait: 2.2 },
      { dialog: 'pro_altar_intro', npc: 'recorder' },
      { setFlag: 'pro.altar_seen' },
      { lock: false },
      { notice: '아르겐의 제단이 불타고 있다', sub: '제단 곁에서 클릭하거나 F 로 다가가 말을 건다' },
    ] },
    // 아르겐의 불꽃은 맹세 전엔 더 크게 타오른다 / 문 복구
    { if: { flag: 'pro.gate' }, then: [{ setTile: { x: GATE.x, y: GATE.y, id: 'portal_glow' } }] },
  ],
};
