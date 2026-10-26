// 퀘스트 정의. 소유: 워커 D (진행 시스템은 워커 B). 형식: docs/ARCHITECTURE.md §11 퀘스트
// 보고(완료)는 대화 액션 {completeQuest} 로. 수집형 퀘스트의 아이템 회수는 대화에서 takeItem 후 completeQuest.
export const QUESTS = {
  // ── 1장 ──
  ch1_return: {
    name: '돌아온 자', chapter: 1, main: true, giver: 'odric',
    desc: '사흘 전 묻혔던 내가 신전 제단 위에서 깨어났다. 사제 오드릭은 촌장 하르딘에게 이 일을 알려야 한다고 했다.',
    objectives: [{ type: 'talk', target: 'hardin', text: '촌장 하르딘을 만나기 (촌장의 집, 마을 동북쪽)' }],
    rewards: { exp: 40, gold: 30 },
  },
  ch1_cellar: {
    name: '잠든 사슴의 골칫거리', chapter: 1, main: false, giver: 'toma',
    desc: "여관 '잠든 사슴'의 지하실에 쥐 떼가 들끓는다. 여관주인 토마는 그 가운데 개만 한 놈이 있다며 몸서리를 쳤다.",
    objectives: [
      { type: 'kill', target: 'cellar_rat', count: 8, text: '지하실 쥐 처치' },
      { type: 'kill', target: 'rat_king', count: 1, text: '쥐왕 처치' },
    ],
    rewards: { exp: 160, gold: 120, items: [{ id: 'leather_armor', qty: 1 }] },
  },
  ch1_forest: {
    name: '숲의 울음', chapter: 1, main: true, giver: 'hardin',
    desc: '속삭이는 숲의 늑대들이 미쳐 날뛰며 사람을 문다. 촌장은 숲 깊은 곳에 무리를 이끄는 놈이 있을 거라 했다. 마을 남쪽 길로 나간다.',
    objectives: [
      { type: 'kill', target: 'wolf', count: 8, text: '회색 늑대 처치' },
      { type: 'kill', target: 'grimfang', count: 1, text: '숲 깊은 곳의 우두머리 처치' },
    ],
    rewards: { exp: 700, gold: 300, items: [{ id: 'red_potion', qty: 5 }] },
  },
  ch1_pelts: {
    name: '대장장이의 겨울 준비', chapter: 1, main: false, giver: 'bron',
    desc: '브론은 겨울이 오기 전에 풀무 덮개와 장갑을 새로 만들 늑대 가죽이 필요하다고 했다.',
    objectives: [{ type: 'item', target: 'wolf_pelt', count: 6, text: '늑대 가죽 모으기' }],
    rewards: { exp: 220, gold: 150, items: [{ id: 'leather_boots', qty: 1 }] },
  },

  // ── 2장 ──
  ch2_graveyard: {
    name: '묘지의 밤', chapter: 2, main: true, giver: 'odric',
    desc: '마을 동쪽 옛 묘지에서 밤마다 죽은 자들이 기어 나온다. 언데드를 쓸어 내고, 그 근원을 찾아야 한다. 동문으로 나간다.',
    objectives: [
      { type: 'kill', target: 'skeleton', count: 10, text: '해골 병사 처치' },
      { type: 'kill', target: 'zombie', count: 6, text: '썩은 시체 처치' },
      { type: 'flag', target: 'ch2.crypt_found', text: '묘지 깊은 곳의 근원 찾기' },
    ],
    rewards: { exp: 1500, gold: 500 },
  },
  ch2_dust: {
    name: '묘지의 흙', chapter: 2, main: false, giver: 'mira',
    desc: '미라는 언데드가 남긴 묘지 흙으로 성수를 빚어 보겠다고 했다. "장사꾼은 기회를 놓치지 않는 법이죠!"',
    objectives: [{ type: 'item', target: 'grave_dust', count: 8, text: '묘지 흙 모으기' }],
    rewards: { exp: 900, gold: 250, items: [{ id: 'blue_potion', qty: 5 }, { id: 'red_potion_m', qty: 5 }] },
  },
  ch2_crypt: {
    name: '묘지기의 노래', chapter: 2, main: true, giver: 'odric',
    desc: '오드릭이 축복한 열쇠로 옛 지하묘지의 봉인을 열 수 있다. 가장 깊은 곳에 찢긴 장의 기운이 고여 있다.',
    objectives: [{ type: 'kill', target: 'graus', count: 1, text: '지하묘지 2층의 묘지기를 쓰러뜨리기' }],
    rewards: { exp: 2200, gold: 800, items: [{ id: 'guardian_amulet', qty: 1 }] },
  },

  // ── 3장 ──
  ch3_tower: {
    name: '황혼의 탑', chapter: 3, main: true, giver: 'odric',
    desc: '북문 너머 잿빛 황야에 황혼의 탑이 솟았다. 벨자르가 마지막 찢긴 장을 쥐고 그 꼭대기에서 기다린다.',
    objectives: [
      { type: 'kill', target: 'belzar', count: 1, text: '흑마도사 벨자르 처치' },
      { type: 'kill', target: 'dusk_king', count: 1, text: '황혼의 왕의 그림자 처치' },
    ],
    rewards: { exp: 8000, gold: 2000, items: [{ id: 'serin_pendant', qty: 1 }] },
  },

  // ── 포스트게임 ──
  post_rift: {
    name: '망각의 균열', chapter: 4, main: false, giver: 'recorder',
    desc: '황혼의 왕이 남긴 상처가 경계에 균열을 냈다. 그 밑바닥에 균열의 군주가 똬리를 틀고 있다.',
    objectives: [{ type: 'kill', target: 'rift_lord', count: 1, text: '균열의 군주 처치' }],
    rewards: { exp: 20000, gold: 5000, items: [{ id: 'ruby_ring', qty: 1 }] },
  },
};
