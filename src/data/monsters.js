// 몬스터 데이터. 소유: 워커 B. 형식: docs/ARCHITECTURE.md §11 몬스터.
// 밸런스 기준(전사, 장비 적정): 일반 몬스터 3~7타, 보스 1~2분 전투. 레벨 곡선 = 프롤로그 1→3, 1장 3→9, 2장 9→15, 3장 15→20, 포스트게임 20→30.
// speed: 초당 타일 / attackSpeed: 공격 간격(초) / aggro: 감지 반경 / range: 공격 사거리(기본 1)
// ai: melee | ranged | caster | passive | boss_*  (src/systems/ai.js, bosses.js)
// 공통 포션 드랍은 src/systems/combat.js 가 레벨대별로 추가한다.
export const MONSTERS = {
  // ── 프롤로그: 망각의 묘원 ──
  shade: {
    name: '방황하는 그림자', level: 1, hp: 14, atk: [3, 5], def: 0, exp: 12, gold: [0, 0], speed: 2.4, attackSpeed: 1.8, aggro: 5,
    ai: 'melee', look: { body: 'shade' }, drops: [{ id: 'soul_vial', chance: 0.12 }],
  },
  lost_soul: {
    name: '길 잃은 망령', level: 2, hp: 24, atk: [4, 8], def: 1, exp: 22, gold: [0, 0], speed: 2.8, attackSpeed: 1.4, aggro: 6,
    ai: 'melee', look: { body: 'wraith', scale: 0.8, alpha: 0.85 }, drops: [{ id: 'soul_vial', chance: 0.15 }],
  },
  oblivion_warden: {
    name: '망각의 파수꾼', level: 4, hp: 130, atk: [5, 8], def: 2, exp: 160, gold: [0, 0], speed: 2.2, attackSpeed: 1.6, aggro: 6,
    ai: 'boss_warden', boss: true, look: { body: 'knight_spirit', scale: 1.35 }, drops: [{ id: 'soul_vial', chance: 1, qty: 2 }],
  },

  // ── 1장: 지하실 ──
  cellar_rat: {
    name: '지하실 쥐', level: 2, hp: 22, atk: [3, 7], def: 1, exp: 18, gold: [2, 5], speed: 3.0, attackSpeed: 1.2, aggro: 5,
    ai: 'melee', look: { body: 'rat' }, drops: [{ id: 'rat_tail', chance: 0.6 }],
  },
  rat_king: {
    name: '쥐왕', level: 5, hp: 260, atk: [11, 17], def: 4, exp: 280, gold: [40, 60], speed: 2.6, attackSpeed: 1.4, aggro: 6,
    ai: 'boss_ratking', boss: true, look: { body: 'rat', scale: 1.6, tint: '#6b4a3a' },
    drops: [{ id: 'rat_tail', chance: 1, qty: 3 }, { id: 'leather_cap', chance: 0.5 }, { id: 'copper_ring', chance: 0.35 }],
  },

  // ── 1장: 속삭이는 숲 ──
  wolf: {
    name: '회색 늑대', level: 5, hp: 66, atk: [10, 17], def: 3, exp: 55, gold: [4, 9], speed: 3.6, attackSpeed: 1.3, aggro: 6,
    ai: 'melee', look: { body: 'wolf' }, drops: [{ id: 'wolf_pelt', chance: 0.45 }],
  },
  boar: {
    name: '성난 멧돼지', level: 6, hp: 90, atk: [14, 22], def: 5, exp: 70, gold: [5, 11], speed: 3.0, attackSpeed: 1.6, aggro: 4,
    ai: 'melee', charger: true, look: { body: 'boar' }, drops: [{ id: 'boar_tusk', chance: 0.4 }, { id: 'leather_boots', chance: 0.03 }],
  },
  forest_spider: {
    name: '숲 거미', level: 7, hp: 84, atk: [15, 24], def: 4, exp: 80, gold: [6, 12], speed: 3.2, attackSpeed: 1.3, aggro: 5,
    ai: 'melee', poison: { dps: 2, time: 4 }, look: { body: 'spider' }, drops: [{ id: 'spider_silk', chance: 0.45 }],
  },
  goblin: {
    name: '고블린 약탈자', level: 7, hp: 100, atk: [15, 26], def: 6, exp: 88, gold: [10, 22], speed: 3.0, attackSpeed: 1.3, aggro: 6,
    ai: 'melee', look: { body: 'goblin' },
    drops: [{ id: 'goblin_ear', chance: 0.35 }, { id: 'short_sword', chance: 0.04 }, { id: 'leather_armor', chance: 0.03 }, { id: 'wooden_shield', chance: 0.04 }],
  },
  grimfang: {
    name: '타락한 늑대왕 그림팽', level: 10, hp: 1500, atk: [15, 23], def: 9, exp: 1600, gold: [180, 260], speed: 3.4, attackSpeed: 1.25, aggro: 7,
    ai: 'boss_grimfang', boss: true, look: { body: 'wolf', scale: 1.7, tint: '#2a1f33' },
    drops: [{ id: 'torn_page_1', chance: 1 }, { id: 'wolf_pelt', chance: 1, qty: 3 }, { id: 'long_sword', chance: 0.6 }, { id: 'chain_mail', chance: 0.3 }],
  },

  // ── 2장: 옛 묘지 / 지하묘지 ──
  skeleton: {
    name: '해골 병사', level: 9, hp: 135, atk: [20, 31], def: 8, exp: 150, gold: [12, 24], speed: 2.6, attackSpeed: 1.4, aggro: 6,
    ai: 'melee', undead: true, look: { body: 'skeleton' }, drops: [{ id: 'bone_shard', chance: 0.5 }, { id: 'grave_dust', chance: 0.25 }, { id: 'iron_helm', chance: 0.015 }],
  },
  zombie: {
    name: '썩은 시체', level: 10, hp: 175, atk: [24, 36], def: 6, exp: 170, gold: [10, 22], speed: 1.8, attackSpeed: 1.8, aggro: 5,
    ai: 'melee', undead: true, look: { body: 'zombie' }, drops: [{ id: 'grave_dust', chance: 0.5 }, { id: 'chain_mail', chance: 0.012 }],
  },
  bat: {
    name: '흡혈 박쥐', level: 10, hp: 110, atk: [19, 29], def: 4, exp: 140, gold: [8, 16], speed: 4.2, attackSpeed: 1.1, aggro: 7,
    ai: 'melee', lifesteal: 0.3, look: { body: 'bat' }, drops: [],
  },
  skeleton_archer: {
    name: '해골 궁수', level: 12, hp: 160, atk: [26, 37], def: 8, exp: 210, gold: [15, 28], speed: 2.6, attackSpeed: 1.9, aggro: 8, range: 6,
    ai: 'ranged', projectile: 'arrow', undead: true, look: { body: 'skeleton', tint: '#c9b98f' }, drops: [{ id: 'bone_shard', chance: 0.6 }, { id: 'iron_boots', chance: 0.012 }],
  },
  ghoul: {
    name: '구울', level: 12, hp: 220, atk: [31, 44], def: 10, exp: 240, gold: [16, 30], speed: 2.8, attackSpeed: 1.5, aggro: 6,
    ai: 'melee', undead: true, look: { body: 'ghoul' }, drops: [{ id: 'grave_dust', chance: 0.4 }, { id: 'broad_sword', chance: 0.015 }, { id: 'iron_shield', chance: 0.015 }],
  },
  wraith: {
    name: '원령', level: 13, hp: 215, atk: [34, 48], def: 8, exp: 270, gold: [18, 34], speed: 2.8, attackSpeed: 2.2, aggro: 8, range: 5,
    ai: 'caster', projectile: 'soul_bolt', magic: true, undead: true, look: { body: 'wraith' }, drops: [{ id: 'ectoplasm', chance: 0.4 }, { id: 'ruby_ring', chance: 0.008 }],
  },
  graus: {
    name: '묘지기 그라우스', level: 15, hp: 3100, atk: [36, 52], def: 16, exp: 3800, gold: [500, 700], speed: 2.2, attackSpeed: 1.8, aggro: 7,
    ai: 'boss_graus', boss: true, undead: true, look: { body: 'gravekeeper', scale: 1.5 },
    drops: [{ id: 'torn_page_2', chance: 1 }, { id: 'war_mace', chance: 0.6 }, { id: 'scale_mail', chance: 0.4 }, { id: 'guardian_amulet', chance: 0.3 }],
  },

  // ── 3장: 황혼의 탑 ──
  cultist: {
    name: '황혼 교단 신도', level: 15, hp: 240, atk: [48, 65], def: 10, exp: 330, gold: [25, 45], speed: 2.8, attackSpeed: 2.2, aggro: 8, range: 5,
    ai: 'caster', projectile: 'dark_bolt', magic: true, look: { body: 'human', robe: '#3a0f14', gender: 'm', hair: 2, hairColor: '#111', skin: '#c9a789' },
    drops: [{ id: 'dark_crystal', chance: 0.25 }, { id: 'red_potion_m', chance: 0.12 }, { id: 'wrath_scroll', chance: 0.03 }],
  },
  dusk_knight: {
    name: '황혼의 기사', level: 17, hp: 385, atk: [65, 88], def: 20, exp: 430, gold: [30, 55], speed: 2.6, attackSpeed: 1.6, aggro: 7,
    ai: 'melee', look: { body: 'knight_dark' }, drops: [{ id: 'dark_crystal', chance: 0.3 }, { id: 'knight_sword', chance: 0.015 }, { id: 'knight_helm', chance: 0.015 }, { id: 'plate_armor', chance: 0.01 }],
  },
  stone_golem: {
    name: '석상 골렘', level: 18, hp: 530, atk: [78, 105], def: 28, exp: 520, gold: [35, 60], speed: 1.7, attackSpeed: 2.2, aggro: 5,
    ai: 'melee', heavy: true, look: { body: 'golem' }, drops: [{ id: 'dark_crystal', chance: 0.35 }, { id: 'tower_shield', chance: 0.015 }, { id: 'stone_scroll', chance: 0.04 }],
  },
  belzar: {
    name: '흑마도사 벨자르', level: 20, hp: 5200, atk: [60, 82], def: 20, exp: 6500, gold: [1200, 1600], speed: 2.8, attackSpeed: 1.5, aggro: 9, range: 6,
    ai: 'boss_belzar', boss: true, magic: true, projectile: 'dark_bolt', look: { body: 'lich', scale: 1.3 },
    drops: [{ id: 'elixir', chance: 1, qty: 2 }, { id: 'plate_armor', chance: 0.5 }, { id: 'knight_helm', chance: 0.5 }],
  },
  dusk_king: {
    name: '황혼의 왕의 그림자', level: 22, hp: 9200, atk: [66, 92], def: 26, exp: 14000, gold: [3000, 4000], speed: 2.6, attackSpeed: 1.7, aggro: 12,
    ai: 'boss_dusk_king', boss: true, look: { body: 'dusk_king', scale: 1.6 },
    drops: [{ id: 'torn_page_3', chance: 1 }, { id: 'claymore', chance: 1 }],
  },

  // ── 포스트게임: 망각의 균열 ──
  rift_shade: {
    name: '균열의 그림자', level: 22, hp: 480, atk: [99, 133], def: 22, exp: 640, gold: [60, 100], speed: 3.2, attackSpeed: 1.4, aggro: 7,
    ai: 'melee', look: { body: 'shade', scale: 1.3, tint: '#5a1f6b' },
    drops: [{ id: 'rift_essence', chance: 0.12 }, { id: 'red_potion_l', chance: 0.08 }, { id: 'abyss_ring', chance: 0.003 }, { id: 'wind_boots', chance: 0.003 }],
  },
  rift_horror: {
    name: '균열의 공포', level: 26, hp: 730, atk: [129, 170], def: 30, exp: 980, gold: [90, 150], speed: 2.8, attackSpeed: 2.0, aggro: 8, range: 5,
    ai: 'caster', projectile: 'soul_bolt', magic: true, look: { body: 'wraith', scale: 1.5, tint: '#3a0f4a' },
    drops: [{ id: 'rift_essence', chance: 0.2 }, { id: 'elixir', chance: 0.04 }, { id: 'abyss_mail', chance: 0.003 }, { id: 'dusk_helm', chance: 0.003 }, { id: 'abyss_cleaver', chance: 0.002 }],
  },
  rift_lord: {
    name: '균열의 군주', level: 30, hp: 21000, atk: [120, 160], def: 38, exp: 32000, gold: [8000, 12000], speed: 2.8, attackSpeed: 1.6, aggro: 12,
    ai: 'boss_rift_lord', boss: true, look: { body: 'dusk_king', scale: 1.8, tint: '#5a1f8b' },
    drops: [{ id: 'rift_essence', chance: 1, qty: 5 }, { id: 'argen_blade', chance: 0.25 }, { id: 'dusk_plate', chance: 0.25 }, { id: 'aegis_argen', chance: 0.25 }],
  },
};
