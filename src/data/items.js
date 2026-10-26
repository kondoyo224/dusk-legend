// 아이템 데이터. 소유: 워커 B. 형식: docs/ARCHITECTURE.md §11 아이템.
// 추가 필드: unsellable(판매 불가), postgame(엔딩 후 상점 해금 권장), stack(최대 겹침, 기본 장비 1 / 그 외 99)
// 판매가 = price * 0.4 (src/systems/inventory.js)

export const GRADES = {
  common:    { name: '일반', color: '#e8e4d8' },
  uncommon:  { name: '고급', color: '#5fd35f' },
  rare:      { name: '희귀', color: '#4f9cff' },
  epic:      { name: '영웅', color: '#b46cff' },
  legendary: { name: '전설', color: '#ff9a2e' },
};

export const SLOT_NAMES = { weapon: '무기', armor: '갑옷', shield: '방패', helm: '투구', ring: '반지', amulet: '목걸이', boots: '신발' };
export const EQUIP_TYPES = ['weapon', 'armor', 'shield', 'helm', 'ring', 'amulet', 'boots'];

export const ITEMS = {
  // ── 퀘스트 ──
  shard_body:   { name: '육신의 기억', type: 'quest', grade: 'rare', price: 0, unsellable: true, icon: 'shard_red', desc: '검을 쥐던 손의 감각이 깃든 붉은 빛 조각.' },
  shard_mind:   { name: '마음의 기억', type: 'quest', grade: 'rare', price: 0, unsellable: true, icon: 'shard_blue', desc: '누군가의 웃음소리가 들리는 푸른 빛 조각.' },
  shard_soul:   { name: '혼의 기억', type: 'quest', grade: 'rare', price: 0, unsellable: true, icon: 'shard_white', desc: '마지막 순간의 기억이 잠든 흰 빛 조각.' },
  torn_page_1:  { name: '찢긴 장 I', type: 'quest', grade: 'epic', price: 0, unsellable: true, icon: 'page', desc: '귀혼의 서에서 찢겨 나간 첫 번째 장. 검은 기운이 스며 있다.' },
  torn_page_2:  { name: '찢긴 장 II', type: 'quest', grade: 'epic', price: 0, unsellable: true, icon: 'page', desc: '귀혼의 서에서 찢겨 나간 두 번째 장. 묘지의 흙냄새가 난다.' },
  torn_page_3:  { name: '찢긴 장 III', type: 'quest', grade: 'epic', price: 0, unsellable: true, icon: 'page', desc: '귀혼의 서에서 찢겨 나간 마지막 장. 황혼빛으로 물들어 있다.' },
  rat_tail:     { name: '쥐 꼬리', type: 'quest', grade: 'common', price: 2, stack: 99, icon: 'tail', desc: '지하실 쥐의 꼬리. 여관주인 토마가 증거로 원한다.' },
  wolf_pelt:    { name: '늑대 가죽', type: 'quest', grade: 'common', price: 8, stack: 99, icon: 'pelt', desc: '거칠고 두꺼운 회색 늑대의 가죽.' },
  crypt_key:    { name: '축복받은 열쇠', type: 'quest', grade: 'rare', price: 0, unsellable: true, icon: 'key', desc: '사제 오드릭이 축복한 지하묘지의 열쇠.' },
  grave_dust:   { name: '묘지의 흙', type: 'quest', grade: 'common', price: 4, stack: 99, icon: 'dust', desc: '언데드가 기어 나온 무덤의 차가운 흙.' },

  // ── 재료(판매용 전리품) ──
  bone_shard:   { name: '뼛조각', type: 'material', grade: 'common', price: 12, stack: 99, icon: 'bone', desc: '해골 병사의 부서진 뼈. 대장장이가 산다.' },
  spider_silk:  { name: '거미줄 뭉치', type: 'material', grade: 'common', price: 10, stack: 99, icon: 'silk', desc: '질기고 끈적한 숲 거미의 실.' },
  boar_tusk:    { name: '멧돼지 엄니', type: 'material', grade: 'common', price: 14, stack: 99, icon: 'tusk', desc: '날카롭게 휜 엄니.' },
  goblin_ear:   { name: '고블린 귀걸이', type: 'material', grade: 'common', price: 18, stack: 99, icon: 'trinket', desc: '고블린이 훔친 싸구려 놋쇠 귀걸이.' },
  ectoplasm:    { name: '영혼의 잔재', type: 'material', grade: 'uncommon', price: 35, stack: 99, icon: 'ecto', desc: '원령이 흩어진 자리에 남은 서늘한 빛.' },
  dark_crystal: { name: '황혼의 결정', type: 'material', grade: 'rare', price: 80, stack: 99, icon: 'crystal', desc: '교단의 의식에 쓰이던 붉은 결정.' },
  rift_essence: { name: '균열의 정수', type: 'material', grade: 'epic', price: 220, stack: 99, icon: 'essence', desc: '망각의 균열에서만 맺히는 정수. 아주 비싸게 팔린다.' },

  // ── 소모품 ──
  soul_vial:    { name: '혼의 물병', type: 'consumable', grade: 'uncommon', price: 0, unsellable: true, stack: 99, use: { heal: 40 }, icon: 'vial_soul', desc: '세린이 건넨 푸른 물병. 혼의 상처를 40 회복한다.' },
  red_potion:   { name: '붉은 물약', type: 'consumable', grade: 'common', price: 20, stack: 99, use: { heal: 60 }, icon: 'potion_red', desc: '체력을 60 회복한다.' },
  red_potion_m: { name: '진한 붉은 물약', type: 'consumable', grade: 'common', price: 70, stack: 99, use: { heal: 160 }, level: 8, icon: 'potion_red', desc: '체력을 160 회복한다.' },
  red_potion_l: { name: '농축 붉은 물약', type: 'consumable', grade: 'uncommon', price: 200, stack: 99, use: { heal: 380 }, level: 16, icon: 'potion_red', desc: '체력을 380 회복한다.' },
  blue_potion:  { name: '푸른 물약', type: 'consumable', grade: 'common', price: 35, stack: 99, use: { mana: 50 }, icon: 'potion_blue', desc: 'MP를 50 회복한다.' },
  elixir:       { name: '아르겐의 영약', type: 'consumable', grade: 'rare', price: 600, stack: 99, use: { heal: 9999, mana: 9999 }, level: 15, icon: 'potion_gold', desc: '체력과 MP를 모두 회복한다.' },
  return_scroll:{ name: '귀환 주문서', type: 'consumable', grade: 'common', price: 60, stack: 99, use: { teleport: { map: 'village_roen' } }, icon: 'scroll', desc: '찢으면 로엔 마을로 돌아간다.' },
  wrath_scroll: { name: '분노의 주문서', type: 'consumable', grade: 'uncommon', price: 150, stack: 99, use: { buff: { id: 'wrath', atk: 0.2, time: 60 } }, level: 10, icon: 'scroll_red', desc: '60초간 공격력이 20% 오른다.' },
  stone_scroll: { name: '수호의 주문서', type: 'consumable', grade: 'uncommon', price: 150, stack: 99, use: { buff: { id: 'stoneskin', def: 15, time: 60 } }, level: 10, icon: 'scroll_blue', desc: '60초간 방어력이 15 오른다.' },

  // ── 무기 ──
  wooden_sword: { name: '목검', type: 'weapon', grade: 'common', price: 10, level: 1, stats: { atk: [2, 4] }, look: 'sword_wood', desc: '수련용 목검. 없는 것보다는 낫다.' },
  short_sword:  { name: '소검', type: 'weapon', grade: 'common', price: 80, level: 3, stats: { atk: [4, 7] }, look: 'sword_short', desc: '경비병에게 지급되는 짧은 검.' },
  long_sword:   { name: '장검', type: 'weapon', grade: 'uncommon', price: 350, level: 7, stats: { atk: [8, 13] }, look: 'sword_long', desc: '브론이 벼린 균형 잡힌 장검.' },
  battle_axe:   { name: '전투 도끼', type: 'weapon', grade: 'uncommon', price: 600, level: 9, stats: { atk: [7, 18], crit: 0.03 }, look: 'axe', desc: '편차가 크지만 한 방이 무겁다.' },
  broad_sword:  { name: '광검', type: 'weapon', grade: 'uncommon', price: 950, level: 11, stats: { atk: [12, 19] }, look: 'sword_broad', desc: '날이 넓어 언데드의 뼈도 쪼갠다.' },
  war_mace:     { name: '전투 철퇴', type: 'weapon', grade: 'rare', price: 1600, level: 13, stats: { atk: [14, 22], str: 2 }, look: 'mace', desc: '축복받은 쇠뭉치. 해골에게 특히 무섭다.' },
  knight_sword: { name: '기사의 검', type: 'weapon', grade: 'rare', price: 2600, level: 15, stats: { atk: [18, 27], dex: 2 }, look: 'sword_knight', desc: '로엔 경비대장이 쓰던 문장 새긴 검.' },
  claymore:     { name: '클레이모어', type: 'weapon', grade: 'epic', price: 9000, level: 20, stats: { atk: [26, 38], str: 3 }, look: 'sword_great', postgame: true, desc: '양손으로 휘두르는 거대한 대검.' },
  abyss_cleaver:{ name: '심연 가르개', type: 'weapon', grade: 'epic', price: 18000, level: 24, stats: { atk: [30, 46], crit: 0.05 }, look: 'axe', postgame: true, desc: '균열의 정수로 단련한 검은 도끼.' },
  argen_blade:  { name: '아르겐의 검', type: 'weapon', grade: 'legendary', price: 45000, level: 26, stats: { atk: [38, 54], str: 5, con: 3, crit: 0.05 }, look: 'sword_argen', postgame: true, desc: '강철과 맹세의 신이 남긴 검. 쓰러진 자를 일으키는 칼날.' },

  // ── 갑옷 ──
  cloth_tunic:  { name: '천 튜닉', type: 'armor', grade: 'common', price: 15, level: 1, stats: { def: 2 }, look: 'tunic', desc: '얇은 천옷.' },
  leather_armor:{ name: '가죽 갑옷', type: 'armor', grade: 'common', price: 120, level: 3, stats: { def: 5, hp: 10 }, look: 'leather', desc: '무두질한 가죽을 겹쳐 만든 갑옷.' },
  chain_mail:   { name: '사슬 갑옷', type: 'armor', grade: 'uncommon', price: 500, level: 8, stats: { def: 10, hp: 20 }, look: 'chain', desc: '촘촘한 쇠사슬을 엮은 갑옷.' },
  scale_mail:   { name: '비늘 갑옷', type: 'armor', grade: 'uncommon', price: 1300, level: 12, stats: { def: 16, hp: 35 }, look: 'scale', desc: '쇠비늘을 덧댄 튼튼한 갑옷.' },
  plate_armor:  { name: '판금 갑옷', type: 'armor', grade: 'rare', price: 3200, level: 16, stats: { def: 24, hp: 50 }, look: 'plate', desc: '온몸을 감싸는 강철 판금.' },
  abyss_mail:   { name: '심연의 갑주', type: 'armor', grade: 'epic', price: 14000, level: 22, stats: { def: 30, hp: 80, con: 3 }, look: 'plate', postgame: true, desc: '균열의 어둠을 머금은 갑주.' },
  dusk_plate:   { name: '황혼의 판금', type: 'armor', grade: 'legendary', price: 40000, level: 26, stats: { def: 38, hp: 120, str: 3, con: 4 }, look: 'dusk_plate', postgame: true, desc: '황혼의 왕을 쓰러뜨린 강철로 다시 벼린 갑옷.' },

  // ── 방패 ──
  wooden_shield:{ name: '나무 방패', type: 'shield', grade: 'common', price: 25, level: 1, stats: { def: 2 }, look: 'shield_wood', desc: '쇠테를 두른 둥근 나무 방패.' },
  iron_shield:  { name: '철 방패', type: 'shield', grade: 'uncommon', price: 550, level: 8, stats: { def: 6 }, look: 'shield_iron', desc: '묵직한 철 방패.' },
  tower_shield: { name: '탑 방패', type: 'shield', grade: 'rare', price: 2800, level: 15, stats: { def: 11, hp: 30 }, look: 'shield_tower', desc: '몸을 다 가리는 거대한 방패.' },
  aegis_argen:  { name: '아르겐의 수호', type: 'shield', grade: 'legendary', price: 30000, level: 25, stats: { def: 18, hp: 80, con: 3 }, look: 'shield_tower', postgame: true, desc: '맹세의 문장이 새겨진 성스러운 방패.' },

  // ── 투구 ──
  leather_cap:  { name: '가죽 모자', type: 'helm', grade: 'common', price: 40, level: 2, stats: { def: 1 }, look: 'cap_leather', desc: '머리를 감싸는 가죽 모자.' },
  iron_helm:    { name: '철 투구', type: 'helm', grade: 'uncommon', price: 480, level: 9, stats: { def: 4, hp: 10 }, look: 'helm_iron', desc: '단단한 철 투구.' },
  knight_helm:  { name: '기사 투구', type: 'helm', grade: 'rare', price: 2300, level: 16, stats: { def: 8, hp: 25 }, look: 'helm_knight', desc: '얼굴까지 가리는 기사의 투구.' },
  dusk_helm:    { name: '황혼의 투구', type: 'helm', grade: 'epic', price: 16000, level: 24, stats: { def: 12, hp: 50, str: 2 }, look: 'helm_knight', postgame: true, desc: '붉은 깃이 꽂힌 검은 투구.' },

  // ── 신발 ──
  leather_boots:{ name: '가죽 장화', type: 'boots', grade: 'common', price: 45, level: 2, stats: { def: 1, speed: 0.04 }, look: 'boots_leather', desc: '발이 가벼워진다.' },
  iron_boots:   { name: '철 장화', type: 'boots', grade: 'uncommon', price: 900, level: 12, stats: { def: 4, speed: 0.04 }, look: 'boots_iron', desc: '쇠를 덧댄 장화.' },
  wind_boots:   { name: '바람의 장화', type: 'boots', grade: 'epic', price: 12000, level: 22, stats: { def: 6, dex: 3, speed: 0.1 }, look: 'boots_leather', postgame: true, desc: '카이의 축복이 남은 장화. 걸음이 바람 같다.' },

  // ── 장신구 ──
  copper_ring:  { name: '구리 반지', type: 'ring', grade: 'common', price: 60, level: 1, stats: { str: 1 }, icon: 'ring_copper', desc: '소박한 구리 반지.' },
  ruby_ring:    { name: '루비 반지', type: 'ring', grade: 'rare', price: 1600, level: 10, stats: { str: 3, hp: 30 }, icon: 'ring_ruby', desc: '붉게 타오르는 루비가 박힌 반지.' },
  abyss_ring:   { name: '심연의 반지', type: 'ring', grade: 'epic', price: 15000, level: 24, stats: { str: 6, crit: 0.05 }, icon: 'ring_dark', postgame: true, desc: '들여다보면 끝없이 깊어지는 검은 보석.' },
  guardian_amulet:{ name: '수호의 목걸이', type: 'amulet', grade: 'rare', price: 2000, level: 12, stats: { def: 4, con: 3 }, icon: 'amulet', desc: '엘리아의 문장이 새겨진 목걸이.' },
  serin_pendant:{ name: '세린의 펜던트', type: 'amulet', grade: 'legendary', price: 0, level: 1, unsellable: true, stats: { str: 3, dex: 3, con: 3, int: 3, wis: 3, hp: 60, mp: 30 }, icon: 'amulet_soul', desc: '기록자 세린이 남긴 은빛 펜던트. 경계를 지키는 자의 증표.' },
};

export function gradeColor(grade) { return GRADES[grade]?.color ?? GRADES.common.color; }
export function isEquip(def) { return !!def && EQUIP_TYPES.includes(def.type); }
