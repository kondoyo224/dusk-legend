// 스킬 데이터. 소유: 워커 B. 동작 구현은 src/systems/skills.js.
// mult: 기본 공격력 대비 배율 / cd: 쿨다운(초) / mp: 소모 MP / level: 습득 권장 레벨
export const SKILLS = {
  power_strike: {
    name: '강타', cls: 'warrior', level: 1, mp: 6, cd: 3, mult: 1.6, range: 1, sound: 'skill_power',
    desc: '아르겐의 맹세를 실은 일격. 대상 하나에게 160% 피해를 주고 밀쳐낸다.',
  },
  whirlwind: {
    name: '회전베기', cls: 'warrior', level: 5, mp: 12, cd: 6, mult: 1.2, radius: 1, sound: 'skill_whirl',
    desc: '몸을 크게 휘돌려 주변 8칸의 모든 적에게 120% 피해를 준다.',
  },
  charge: {
    name: '돌진', cls: 'warrior', level: 8, mp: 10, cd: 8, mult: 1.3, range: 4, stun: 1, sound: 'skill_charge',
    desc: '최대 4칸 떨어진 적에게 순식간에 돌진해 130% 피해를 주고 1초간 기절시킨다.',
  },
  war_cry: {
    name: '전투의 함성', cls: 'warrior', level: 12, mp: 15, cd: 25, duration: 15, atkBonus: 0.3, radius: 5, sound: 'skill_cry',
    desc: '15초간 공격력이 30% 오르고, 주변 5칸의 적이 시전자에게 달려든다.',
  },
  iron_wall: {
    name: '철벽', cls: 'warrior', level: 15, mp: 12, cd: 20, duration: 6, reduce: 0.5, sound: 'skill_wall',
    desc: '6초간 받는 피해가 50% 줄어든다. 넉백과 기절에 면역이 된다.',
  },
  earth_splitter: {
    name: '대지 가르기', cls: 'warrior', level: 18, mp: 25, cd: 12, mult: 3.0, length: 4, sound: 'skill_earth',
    desc: '검을 내리꽂아 전방 직선 4칸의 대지를 가른다. 300% 피해, 적을 0.6초간 기절시킨다.',
  },
};
