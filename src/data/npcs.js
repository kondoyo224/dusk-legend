// NPC 정의. 소유: 워커 D. 형식: docs/ARCHITECTURE.md §11 NPC. 대화 id 는 src/data/dialogues/*.js
// look 은 렌더러 계약(§4)의 키만 사용.
const H = (o) => ({ body: 'human', gender: 'm', skin: '#e2b994', hair: 0, hairColor: '#3b2a1e', ...o });
const flame = (tint, alpha = 0.4) => ({ body: 'wraith', scale: 0.7, alpha, tint });

export const NPCS = {
  // ── 프롤로그 ──
  recorder: { name: '기록자 세린', title: '귀혼의 서를 지키는 자', look: H({ gender: 'f', skin: '#efe2da', hair: 3, hairColor: '#dcdce6', robe: '#4b3a6b' }), dialog: 'recorder_limbo' },
  memory_echo: { name: '기억의 메아리', title: '어린 소녀의 환영', look: H({ gender: 'f', hair: 2, hairColor: '#7a4a2a', scale: 0.75, alpha: 0.55, tint: '#ffd0e0' }), dialog: 'pro_echo' },
  altar_argen: { name: '아르겐의 불꽃', title: '강철과 맹세의 신', look: flame('#ff8a30', 0.75), dialog: 'altar_argen' },
  altar_noctis: { name: '녹티스의 제단', title: '그림자와 비밀의 여신', look: flame('#5a4a8a', 0.2), dialog: 'altar_noctis' },
  altar_astera: { name: '아스테라의 제단', title: '별과 지혜의 현자신', look: flame('#7fa8ff', 0.2), dialog: 'altar_astera' },
  altar_elia: { name: '엘리아의 제단', title: '빛과 치유의 어머니', look: flame('#fff0b0', 0.2), dialog: 'altar_elia' },
  altar_kai: { name: '카이의 제단', title: '바람과 수행의 신', look: flame('#a8ffd0', 0.2), dialog: 'altar_kai' },

  // ── 로엔 마을 ──
  odric: { name: '사제 오드릭', title: '로엔 신전', look: H({ skin: '#e8cdb2', hair: 5, hairColor: '#d8d8d8', beard: true, robe: '#e8e0c8' }), dialog: 'odric' },
  hardin: { name: '촌장 하르딘', title: '로엔의 촌장', look: H({ hair: 1, hairColor: '#6b5a48', beard: true, armor: 'tunic', robe: '#5a4a3a' }), dialog: 'hardin' },
  bron: { name: '대장장이 브론', title: '대장간', look: H({ skin: '#cf9a72', hair: 4, hairColor: '#2a1d14', beard: true, apron: '#4a3020' }), dialog: 'bron' },
  mira: { name: '잡화상 미라', title: '잡화점', look: H({ gender: 'f', hair: 2, hairColor: '#c8742a', apron: '#6e8a44' }), dialog: 'mira' },
  toma: { name: '여관주인 토마', title: "여관 '잠든 사슴'", look: H({ hair: 1, hairColor: '#8a7a5a', apron: '#cfc6ac' }), dialog: 'toma' },
  garen: { name: '교관 가렌', title: '전사 수련장', look: H({ skin: '#c8956c', hair: 0, hairColor: '#1e1e1e', armor: 'chain', weapon: 'sword_long', shield: 'shield_iron' }), dialog: 'garen' },
  lina: { name: '리나', title: '', look: H({ gender: 'f', hair: 2, hairColor: '#7a4a2a', scale: 0.78, robe: '#b05a5a' }), dialog: 'lina', wander: 2 },
  guard_north: { name: '경비병 오웬', title: '북문 경비', look: H({ hair: 0, hairColor: '#5a3a22', armor: 'chain', helm: 'helm_iron', weapon: 'sword_short', shield: 'shield_wood' }), dialog: 'guard_north' },
  guard_east: { name: '경비병 테스', title: '동문 경비', look: H({ gender: 'f', hair: 1, hairColor: '#2a2a2a', armor: 'chain', helm: 'helm_iron', weapon: 'sword_short', shield: 'shield_wood' }), dialog: 'guard_east' },
  villager_baker: { name: '빵집 할멈 베아', title: '', look: H({ gender: 'f', hair: 3, hairColor: '#bbbbbb', apron: '#e0d8c8' }), dialog: 'villager_baker' },
  villager_farmer: { name: '농부 콜린', title: '', look: H({ skin: '#c99a70', hair: 4, hairColor: '#7a5a2a', armor: 'tunic' }), dialog: 'villager_farmer', wander: 3 },
  villager_widow: { name: '과부 엘다', title: '', look: H({ gender: 'f', hair: 1, hairColor: '#3a3030', robe: '#2e2e3a' }), dialog: 'villager_widow' },
  villager_kid: { name: '꼬마 핌', title: '', look: H({ hair: 4, hairColor: '#d8a040', scale: 0.72, armor: 'tunic' }), dialog: 'villager_kid', wander: 3 },
  villager_bard: { name: '음유시인 렌', title: '', look: H({ hair: 2, hairColor: '#a03030', robe: '#3a5a7a' }), dialog: 'villager_bard' },

  // ── 컷신 ──
  belzar_npc: { name: '흑마도사 벨자르', title: '황혼 교단', look: { body: 'lich', scale: 1.2 }, dialog: null },
};
