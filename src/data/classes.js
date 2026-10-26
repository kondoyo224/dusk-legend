// 직업 데이터. 소유: 워커 B. 현재 구현 직업: 전사(warrior) 하나.
// growth: 레벨당 자동 성장(소수 누적, floor 적용). bonus: 각성 시 즉시 보너스.
// hpPerLevel/mpPerLevel: 레벨당 최대 HP/MP 증가량.
export const CLASSES = {
  warrior: {
    name: '전사',
    god: '아르겐',
    desc: '강철과 맹세의 신 아르겐의 검. 단단한 몸과 묵직한 일격으로 전장의 앞에 선다.',
    bonus: { str: 3, con: 2 },
    growth: { str: 1, dex: 0.25, con: 0.5, int: 0, wis: 0.2 },
    hpPerLevel: 8,
    mpPerLevel: 2,
    skills: ['power_strike', 'whirlwind', 'charge', 'war_cry', 'iron_wall', 'earth_splitter'],
  },
};

// 직업 없음(프롤로그 각성 전) 기본 성장
export const NO_CLASS = { name: '혼', bonus: {}, growth: { str: 0.3, dex: 0.3, con: 0.3, int: 0.2, wis: 0.2 }, hpPerLevel: 6, mpPerLevel: 2, skills: [] };
