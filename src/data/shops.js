// 상점 정의. 소유: 워커 D. 형식: docs/ARCHITECTURE.md §11 상점 (가격은 아이템 데이터의 price)
// 진행도에 따라 진열이 늘어난다: 1장 완료 → 2장 완료(습격 격퇴, 3장 대비) → 엔딩 후 최상급(postgame)
const CH1 = { flag: 'ch1.done' };
const CH2 = { flag: 'ch2.raid_done' };
const END = { flag: 'end.cleared' };

export const SHOPS = {
  smithy: {
    name: '브론의 대장간',
    items: [
      { id: 'wooden_sword' }, { id: 'short_sword' }, { id: 'long_sword', cond: CH1 }, { id: 'battle_axe', cond: CH1 },
      { id: 'broad_sword', cond: CH1 }, { id: 'war_mace', cond: CH2 }, { id: 'knight_sword', cond: CH2 },
      { id: 'claymore', cond: END }, { id: 'abyss_cleaver', cond: END }, { id: 'argen_blade', cond: END },
      { id: 'cloth_tunic' }, { id: 'leather_armor' }, { id: 'chain_mail', cond: CH1 }, { id: 'scale_mail', cond: CH1 },
      { id: 'plate_armor', cond: CH2 }, { id: 'abyss_mail', cond: END }, { id: 'dusk_plate', cond: END },
      { id: 'wooden_shield' }, { id: 'iron_shield', cond: CH1 }, { id: 'tower_shield', cond: CH2 }, { id: 'aegis_argen', cond: END },
      { id: 'leather_cap' }, { id: 'iron_helm', cond: CH1 }, { id: 'knight_helm', cond: CH2 }, { id: 'dusk_helm', cond: END },
      { id: 'leather_boots' }, { id: 'iron_boots', cond: CH2 }, { id: 'wind_boots', cond: END },
    ],
  },
  general: {
    name: '미라의 잡화점',
    items: [
      { id: 'red_potion' }, { id: 'red_potion_m', cond: CH1 }, { id: 'red_potion_l', cond: CH2 }, { id: 'elixir', cond: CH2 },
      { id: 'blue_potion' }, { id: 'return_scroll' }, { id: 'wrath_scroll', cond: CH2 }, { id: 'stone_scroll', cond: CH2 },
      { id: 'copper_ring' }, { id: 'ruby_ring', cond: CH2 }, { id: 'guardian_amulet', cond: CH2 }, { id: 'abyss_ring', cond: END },
    ],
  },
};
