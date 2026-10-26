// 맵 스크립트 헬퍼 액션. 소유: 워커 D. (보스 처치/줍기 훅은 계약의 map.onKill / map.onPickup 사용)

// 땅에 아이템을 떨어뜨린다(줍기 연출). 시스템 미구현 시 바로 지급.
// _drop: 정적 검증(tools/verify_content.mjs)용 메타데이터 — 스크립트 실행엔 영향 없음
export const dropAt = (itemId, x, y, qty = 1) => ({
  _drop: { itemId, x, y, qty },
  call(g) {
    const inv = g.systems.inventory;
    if (inv.dropItem) inv.dropItem(x, y, itemId, qty); else inv.add(itemId, qty);
  },
});
// 아직 없으면 떨어뜨림 (맵 재입장 시 핵심 아이템 재배치)
export const dropOnce = (itemId, x, y, gotFlag) => ({
  if: [{ notFlag: gotFlag }, { not: { item: itemId } }],
  then: [dropAt(itemId, x, y)],
});
// 보스 스폰 (이미 처치 플래그면 생략)
export const spawnBoss = (monsterId, x, y, deadFlag) => ({
  if: { notFlag: deadFlag },
  then: [{ spawn: monsterId, x, y, boss: true }],
});
