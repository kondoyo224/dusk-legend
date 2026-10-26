// 엔티티 공통 형태 (계약: docs/ARCHITECTURE.md §엔티티). 순수 데이터 객체 + 소수의 런타임 필드.
let nextId = 1;

export function makeEntity(kind, props = {}) {
  const e = {
    id: nextId++,
    kind,                 // 'player' | 'npc' | 'monster' | 'drop'
    name: '',
    x: 0, y: 0,           // 논리 타일 좌표(점유 타일). 이동 시작 순간 목적지로 바뀐다.
    rx: 0, ry: 0,         // 렌더용 보간 좌표(실수)
    dir: 4,               // 0..7 화면 기준 8방향 (iso.js DIRS)
    move: null,           // {fx,fy,tx,ty,t,dur} 이동 중일 때
    speed: 4.6,           // 초당 타일
    blocking: true,       // 다른 엔티티 통행 차단
    faction: 'neutral',   // 'player' | 'monster' | 'neutral'
    anim: { state: 'idle', t: 0 }, // idle|walk|attack|cast|hurt|dead — 렌더러가 읽는다
    look: {},             // 외형 (render/sprites.js 가 해석). 예: {body:'human', hair:2, hairColor:'#3a2a1a', armor:'leather', weapon:'sword'}
    hp: 1, maxHp: 1, mp: 0, maxMp: 0,
    level: 1,
    dead: false,
    flash: 0,             // 피격 섬광 타이머(렌더러용)
    ...props,
  };
  e.rx = e.x; e.ry = e.y;
  return e;
}

export function setAnim(e, state) {
  if (e.anim.state !== state) { e.anim.state = state; e.anim.t = 0; }
}

// 저장 시 nextId 충돌 방지
export function bumpEntityId(n) { if (n >= nextId) nextId = n + 1; }
