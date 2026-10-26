// 로엔 마을 NPC 대화 (1장~엔딩 후). 소유: 워커 D. 대본: docs/SCRIPT.md §마을
// entry 는 위에서부터 검사 → 늦은 진행도(엔딩 후)를 먼저 둔다.
// 말투: 오드릭=온화한 존댓말 / 하르딘=무뚝뚝한 하게체+존대 / 브론=걸걸한 반말 / 미라=명랑한 존댓말
//       토마=소심한 존댓말 / 가렌=군대식 / 리나=어린아이 반말
const END = { flag: 'end.cleared' };
const isGhost = (g) => !!(g.player?.ghost || g.player?.ghostDead || g.player?.dead);
const knows = (id) => (g) => g.state.skills.includes(id);
const canLearn = (id, lv) => (g) => !g.state.skills.includes(id) && g.player.level >= lv;
const tooLow = (id, lv) => (g) => !g.state.skills.includes(id) && g.player.level < lv;
const Q = (quest, state) => ({ quest, state });
// 받은 장비를 바로 착용
const equip = (id) => ({ call: (g) => { const i = g.state.inventory.findIndex((x) => x?.id === id); if (i >= 0) g.systems.inventory.equip?.(i); } });

export default {
  // ════════ 사제 오드릭 ════════
  odric: {
    entry: [
      { cond: isGhost, node: 'revive' },
      { cond: END, node: 'post' },
      { cond: { flag: 'ch3.open' }, node: 'ch3' },
      { cond: { flag: 'ch2.raid_done' }, node: 'ch3start' },
      { cond: { flag: 'ch2.page2' }, node: 'raid' },
      { cond: Q('ch2_graveyard', 'ready'), node: 'gy_done' },
      { cond: { flag: 'ch2.key' }, node: 'crypt' },
      { cond: { flag: 'ch1.done' }, node: 'gy' },
      { cond: [{ flag: 'ch1.page1' }, Q('ch1_forest', 'done')], node: 'page' },
      { cond: { flag: 'ch1.page1' }, node: 'page_wait' },
    ],
    nodes: {
      revive: { text: '이런, 혼이 또 몸을 떠나 버렸군요. 아르겐께서 아직 그대를 놓지 않으셨으니… 이리 오세요.', actions: [{ revive: true }, { sound: 'levelup' }], next: 'revive2' },
      revive2: { text: '자, 다시 숨을 쉬세요. 죽음을 두 번 겪는 사람은 흔치 않지만, 세 번째는 없기를 빕니다.' },
      start: { text: '촌장님께는 가 보셨습니까? 마을 동북쪽, 큰 굴뚝이 있는 집입니다. 그분도 그대를 보면 놀라 자빠지실 겁니다.', options: [
        { text: '치유를 부탁드립니다.', next: 'heal' }, { text: '귀혼의 서에 대해 더 알려 주세요.', next: 'lore' }, { text: '다녀오겠습니다.' },
      ] },
      heal: { text: '엘리아께서 잠드신 뒤로 신전의 빛은 약해졌지만, 상처 하나 아물게 할 힘은 남아 있지요.', actions: [{ heal: true }, { sound: 'potion' }] },
      lore: { text: '옛 경전에는 이렇게 적혀 있습니다. "이름이 적힌 혼은 강을 건너고, 이름을 잃은 혼은 물가를 맴돈다." 사흘 전 밤 쓰러진 경비병들의 무덤이… 요즘 이상하게 차갑습니다.', next: 'lore2' },
      lore2: { text: '그대가 돌아왔다는 것은, 그 책이 아직 누군가의 손에 지켜지고 있다는 뜻이겠지요. 기록자 세린… 전설 속의 이름인 줄로만 알았습니다.' },

      page_wait: { text: '그 양피지에서… 묘한 냉기가 느껴지는군요. 먼저 촌장님께 숲의 일을 보고하세요. 그다음에 함께 읽어 봅시다.' },
      page: { text: '촌장님께 들었습니다. 숲의 우두머리를 쓰러뜨렸다고요. 그 양피지, 이리 주시겠습니까?', next: 'page2' },
      page2: { speaker: '', portrait: false, text: '오드릭이 떨리는 손으로 찢긴 장을 펼친다. 빼곡히 적힌 이름들 사이로 검은 얼룩이 번져 있다.', actions: [{ sound: 'page' }], next: 'page3' },
      page3: { text: '이건… 로엔 사람들의 이름입니다. 대장장이 브론의 아버지, 과부 엘다의 남편… 모두 지난 몇 해 사이 세상을 떠난 이들이에요.', next: 'page4' },
      page4: { text: '그리고 여백에 쓰인 이 서명. 황혼의 왕의 문장 아래 "벨자르". …황혼 교단. 백 년 전에 사라졌다던 그 광신도들이 돌아온 것입니다.', next: 'page5' },
      page5: { text: '장에서 흘러나온 검은 기운이 늑대들을 미치게 했던 거라면, 나머지 두 장도 어딘가에서 같은 짓을 하고 있겠지요.', next: 'page6' },
      page6: { text: '…마을 동쪽 옛 묘지. 요즘 밤마다 무덤에서 무언가 기어 나온다는 소문이 있습니다. 경비대도 더는 버티지 못하고 있어요. {name}, 부탁드립니다.', actions: [
        { setFlag: 'ch1.done' }, { chapter: 2 }, { startQuest: 'ch2_graveyard' }, { save: true },
      ], next: 'page7' },
      page7: { speaker: '', portrait: false, text: '찢긴 장은 신전의 제단에 맡겨 두기로 했다. 동문이 열렸다.', actions: [{ title: '제2장 — 묘지기의 노래', sub: '로엔 동쪽, 옛 묘지' }] },

      gy: { text: '옛 묘지는 동문 밖입니다. 해골들은 둔기에 약하다지만… 그대의 검이라면 충분하겠지요. 묘지 깊은 곳 어딘가에 근원이 있을 겁니다.', options: [
        { text: '치유를 부탁드립니다.', next: 'heal' }, { text: '다녀오겠습니다.' },
      ] },
      gy_done: { text: '돌아오셨군요! 묘지 깊은 곳에 봉인된 문이 있었다고요? 그건 옛 지하묘지의 입구입니다. 백 년 전, 황혼의 왕의 잔당을 가두려고 사제들이 봉인했지요.', next: 'gy_done2' },
      gy_done2: { text: '이 열쇠를 가져가세요. 아르겐의 제단 앞에서 사흘 밤낮 축복한 것입니다. 봉인은 축복받은 손만을 들여보낼 겁니다.', actions: [
        { completeQuest: 'ch2_graveyard' }, { giveItem: 'crypt_key' }, { setFlag: 'ch2.key' }, { startQuest: 'ch2_crypt' }, { sound: 'quest' },
      ], next: 'gy_done3' },
      gy_done3: { text: '지하묘지의 묘지기, 그라우스… 원래는 죽은 이들의 잠을 지키던 선한 수호자였습니다. 만약 그가 찢긴 장에 묶였다면, 부디 그를 쉬게 해 주세요.' },
      crypt: { text: '지하묘지는 깊고 어둡습니다. 귀환 주문서를 꼭 챙기세요. 미라의 가게에 있을 겁니다.', options: [
        { text: '치유를 부탁드립니다.', next: 'heal' }, { text: '다녀오겠습니다.' },
      ] },

      raid: { text: '{name}! 교단 놈들이 마을에… 리나가 위험합니다! 어서요, 리나의 집으로!' },

      ch3start: { text: '…리나는 무사합니다. 그대 덕분이에요. 그리고 그라우스에게서 되찾은 두 번째 장. 이제 남은 건 하나뿐이군요.', actions: [{ completeQuest: 'ch2_crypt' }], next: 'c2' },
      c2: { text: '벨자르가 마지막 장을 쥐고 있다면, 그자는 북쪽 잿빛 황야의 황혼의 탑에 있을 겁니다. 그라우스가 남긴 유언과도 맞아떨어지지요.', next: 'c3' },
      c3: { text: '그 전에… 함께 기도를 올립시다. 아르겐의 제단 앞에서. 그대가 맹세한 신께, 그대를 위해.', options: [{ text: '(제단 앞에 무릎을 꿇는다)', next: 'c4' }] },
      c4: { speaker: '', portrait: false, text: '오드릭의 낮은 기도가 신전을 채운다. 제단의 불이 천천히 붉게, 이윽고 하얗게 타오른다.', actions: [{ lock: true }, { shake: 5, time: 0.8 }, { sound: 'skill_earth' }, { fx: 'levelup' }], next: 'c5' },
      c5: { speaker: '아르겐', portrait: false, text: '나의 전사여. 땅은 모든 죽은 자를 품는다. 그러니 땅을 가르는 검은, 그 무엇도 묻어 둘 수 없다.', next: 'c6' },
      c6: { speaker: '아르겐', portrait: false, text: '마지막 가르침이다 — 【대지 가르기】. 황혼이 드리운 땅을 갈라, 빛이 스며들게 하라.', actions: [
        { learnSkill: 'earth_splitter' }, { setFlag: 'ch3.open' }, { chapter: 3 }, { startQuest: 'ch3_tower' }, { lock: false },
        { notice: '【대지 가르기】를 배웠다', sub: '스킬 창 K 에서 단축키에 등록하자' },
      ], next: 'c7' },
      c7: { text: '…들으셨군요. 저도 들었습니다. 오십 년 사제 노릇에 신의 목소리는 처음입니다. 북문이 열렸습니다, {name}. 부디 살아서 돌아오세요. 이번에는 제가 그대를 묻지 않게 해 주세요.', actions: [
        { title: '제3장 — 황혼의 탑', sub: '북문 너머, 잿빛 황야' }, { save: true },
      ] },
      ch3: { text: '아르겐께서 그대와 함께하십니다. 탑에 오르기 전에 대장간과 잡화점을 꼭 들르세요.', options: [
        { text: '치유를 부탁드립니다.', next: 'heal' }, { text: '다녀오겠습니다.' },
      ] },

      post: { text: '요즘 저는 매일 아침 묘지에 꽃을 놓습니다. 이제 그곳의 무덤들은 따뜻하거든요. 이름이 강을 건넌 덕분이겠지요.', options: [
        { text: '치유를 부탁드립니다.', next: 'heal' }, { text: '앞으로는 어떻게 지내실 건가요?', next: 'post2' }, { text: '안녕히 계세요.' },
      ] },
      post2: { text: '잠든 네 신의 제단을 다시 공부해 볼 생각입니다. 언젠가 녹티스나 엘리아께서도 누군가를 부르실 날이 오겠지요. 그때 그 아이를 맞을 사람이 있어야 하지 않겠습니까.' },
    },
  },

  // 부활 컷신 (village_roen onEnter)
  odric_reborn: {
    nodes: {
      start: { text: '아르겐이시여… 엘리아시여… 제가 노망이 난 겁니까? 사흘 전, 이 손으로 묻은 사람이 제단 위에서 숨을 쉬다니…', next: 'b' },
      b: { text: '{name}… 정말 {name}입니까? 북문의 그 젊은 경비병…?', options: [
        { text: '기록자 세린이 저를 돌려보냈습니다.', next: 'c' },
        { text: '…여긴 어디죠? 몸이… 무겁습니다.', next: 'c0' },
      ] },
      c0: { text: '로엔 신전입니다. 무거운 게 당연하지요. 산 자의 몸이란 원래 무거운 법입니다. 천천히, 천천히 일어나세요.', next: 'c' },
      c: { text: '세린… 귀혼의 서의 기록자 말입니까? 그럼 그대는 망각의 묘원에서… 아아, 전설이 사실이었군요.', next: 'd' },
      d: { text: '찢긴 장, 흑마도사 벨자르… 이건 늙은 사제 혼자 감당할 이야기가 아닙니다. 촌장 하르딘에게 알려야 해요. 마을 동북쪽, 큰 굴뚝이 있는 집입니다.', next: 'e' },
      e: { text: '아, 그리고… 그대와 함께 묻었던 수의 대신, 경비대의 옷을 입혀 드리지요. 물약도 몇 병 챙기세요. 소지품은 I, 장비를 바꿀 때도 I 입니다.', actions: [
        { giveItem: 'cloth_tunic' }, equip('cloth_tunic'), { giveItem: 'red_potion', qty: 3 }, { startQuest: 'ch1_return' },
      ], next: 'f' },
      f: { text: '…리나에게는, 그대가 직접 가 주세요. 그 아이는 사흘 동안 한 번도 울지 않았습니다. 그게 더 걱정이었지요.' },
    },
  },

  // ════════ 촌장 하르딘 ════════
  hardin: {
    entry: [
      { cond: END, node: 'post' },
      { cond: { flag: 'ch3.open' }, node: 'ch3' },
      { cond: { flag: 'ch2.raid_done' }, node: 'raid_after' },
      { cond: { flag: 'ch1.done' }, node: 'ch2' },
      { cond: Q('ch1_forest', 'ready'), node: 'f_done' },
      { cond: { flag: 'ch1.page1' }, node: 'f_done_wait' },
      { cond: Q('ch1_forest', 'done'), node: 'f_after' },
      { cond: { flag: 'ch1.met_hardin' }, node: 'f_hint' },
    ],
    nodes: {
      start: { text: '오드릭 영감이 헛것을 본 줄 알았는데… 자네, 정말 {name}인가.', next: 'b' },
      b: { text: '…앉게. 아니, 서 있어도 되네. 나도 지금 앉아 있을 기분이 아니야.', next: 'c' },
      c: { text: '사흘 전 북문에서 경비병 넷을 잃었네. 자네까지 다섯이었지. 내 손으로 장례 명단에 이름을 적었어. 그런데 그 이름이 걸어 들어오는군.', options: [
        { text: '찢긴 장과 벨자르에 대해 들으셨습니까?', next: 'd' },
        { text: '면목 없습니다. 문을 지키지 못했습니다.', next: 'd2' },
      ] },
      d2: { text: '문은 지켰네. 놈들은 북문을 넘지 못했어. 자네가 쓰러진 자리가 바로 문턱이었지. …사과는 내가 해야 할 일이네. 그 밤에 지원을 보내지 못했으니.', next: 'd' },
      d: { text: '오드릭에게 대충 들었네. 믿기 어렵지만, 자네가 살아 있으니 믿을 수밖에. 그럼 일을 하나 맡기겠네. 마을 사람들은 지쳤고, 남은 경비병도 몇 안 돼.', next: 'e' },
      e: { text: '요즘 속삭이는 숲의 늑대들이 미쳐 날뛰어. 나무꾼 둘이 물렸고, 사냥꾼은 돌아오지 않았네. 그놈들 눈이… 검게 타 있다더군.', next: 'f' },
      f: { text: '숲 깊은 곳에 무리를 이끄는 놈이 있을 거야. 그놈을 잡아 주게. 남쪽 길 경비에게는 자네를 들여보내라고 일러두지. …숲은 레벨 4쯤은 되어야 버틸 거야. 여관 지하실 쥐라도 먼저 잡아 보든가.', actions: [
        { completeQuest: 'ch1_return' }, { setFlag: 'ch1.met_hardin' }, { setFlag: 'ch1.forest_q' }, { startQuest: 'ch1_forest' }, { sound: 'quest' },
      ], next: 'g' },
      g: { text: '아, 그리고. 장비는 대장장이 브론에게 가 보게. 그 친구, 자네 장례 때 제일 크게 울었어. 본인은 연기 탓이라고 우기겠지만.' },
      f_hint: { text: '숲은 마을 남쪽 길로 나가면 되네. 무리를 이끄는 놈은 개울 건너 깊은 곳 어딘가에 있을 게야. 무리하지 말게. 두 번 장례 치르기는 싫으니.' },
      f_done_wait: { text: '그 표정… 해냈군. 늑대들이 잠잠해졌다는 소식이 벌써 들어왔네. 다만 사냥 기록이 덜 찼다면 마저 하고 오게.', options: [{ text: '알겠습니다.' }] },
      f_done: { text: '그 표정… 해냈군. 늑대들이 잠잠해졌다고 나무꾼들이 벌써 떠들고 다니네. 그런데 그 손에 든 건 뭔가?', next: 'f_done2' },
      f_done2: { text: '양피지라… 그런 건 내가 봐서 알 리가 없지. 오드릭에게 가져가게. 그리고, {name}. 고맙네. 진심으로.', actions: [{ completeQuest: 'ch1_forest' }, { sound: 'quest' }] },
      f_after: { text: '오드릭이 그 양피지를 기다리고 있을 걸세.' },
      ch2: { text: '묘지 일은 오드릭에게 맡겼네. 아니, 자네에게 맡긴 셈이지. 동문 경비 테스에게 말해 두었으니 드나드는 데 문제없을 거야. 나는 그동안 성벽 보수를 하겠네.' },
      raid_after: { text: '교단 놈들이 마을 안까지 들어올 줄은… 내 불찰이네. 리나는 무사해서 다행이야. 오드릭이 자네를 찾더군. 신전으로 가 보게.' },
      ch3: { text: '북문은 열어 두었네. 잿빛 황야를 지나면 탑이 보일 거야. …돌아오면 마을 잔치를 열지. 이번엔 장례 명단이 아니라 축배 명단에 자네 이름을 적고 싶군.' },
      post: { text: '잔치는 사흘 밤낮 이어졌지. 자네가 술잔을 피해 도망 다니던 모습은 마을 아이들이 아직도 흉내 내더군. …로엔은 자네에게 큰 빚을 졌네.', options: [
        { text: '마을 형편은 어떻습니까?', next: 'post2' }, { text: '안녕히 계십시오.' },
      ] },
      post2: { text: '북문도 다시 쌓았고, 경비병도 새로 뽑았네. 그런데 다들 자네처럼 되겠다고 수련장에 몰려가서 가렌이 골머리를 앓고 있어. 허허.' },
    },
  },

  // ════════ 대장장이 브론 ════════
  bron: {
    entry: [
      { cond: { notFlag: 'ch1.bron_met' }, node: 'first' },
      { cond: END, node: 'post' },
    ],
    nodes: {
      first: { text: '……어이. 내가 연기를 너무 마셨나. 아니면 귀신인가. …{name}? 진짜 너냐?', next: 'first2' },
      first2: { text: '하, 하하! 이 망할 녀석! 장례 때 내가 얼마나… 아니, 연기 탓이었어. 연기. 대장간은 원래 맵다고.', next: 'first3' },
      first3: { text: '잠깐 기다려 봐. …자, 이거. 네가 북문에서 쓰던 검이다. 반으로 부러진 걸 주워 와서 다시 벼려 뒀지. 묘비 앞에 꽂아 둘 생각이었는데, 주인한테 돌려주는 게 낫겠군.', actions: [
        { giveItem: 'short_sword' }, equip('short_sword'), { setFlag: 'ch1.bron_met' }, { sound: 'quest' },
      ], next: 'start' },
      start: { text: '뭐가 필요하냐? 쇠라면 뭐든 두드려 주마.', options: [
        { text: '장비를 보여 주세요.', next: 'shop' },
        { text: '도울 일은 없나요?', cond: Q('ch1_pelts', 'none'), next: 'pelt' },
        { text: '늑대 가죽을 가져왔어요.', cond: Q('ch1_pelts', 'ready'), next: 'pelt_done' },
        { text: '좋은 장비는 언제 들어오나요?', next: 'stock' },
        { text: '다음에 올게요.' },
      ] },
      shop: { text: '골라 봐. 깎아 달라는 소리는 하지 마라. 쇠값이 올랐어.', actions: [{ shop: 'smithy' }] },
      pelt: { text: '겨울이 오기 전에 풀무 덮개를 새로 해야 하는데 쓸 만한 가죽이 없어. 숲에서 늑대 가죽 여섯 장만 구해 와라. 미친 늑대라도 가죽은 멀쩡하더군.', options: [
        { text: '구해 오겠습니다.', actions: [{ startQuest: 'ch1_pelts' }] }, { text: '나중에요.' },
      ] },
      pelt_done: { text: '오, 털이 좋은데! 이걸로 덮개 만들고 남는 걸로 네 신발도 하나 만들어 뒀다. 받아라.', actions: [
        { completeQuest: 'ch1_pelts' },
      ] },
      stock: { text: '숲 일이 끝나면 강철을 더 들여올 수 있겠지. 상인들이 길을 무서워해서 말이야. 길이 안전해질수록 좋은 물건이 들어온다. 그러니 열심히 싸워라.' },
      post: { text: '왔냐, 영웅 나리! 크하하, 농담이다. 왕도에서 상인들이 몰려와서 진짜 좋은 쇠가 들어왔어. 기사의 검, 판금 갑옷… 그리고 하나 더.', options: [
        { text: '하나 더요?', next: 'post2' }, { text: '장비를 보여 주세요.', next: 'shop' }, { text: '다음에 올게요.' },
      ] },
      post2: { text: '탑에서 가져온 황혼의 쇳조각, 그리고 아르겐 신전의 제단 쇠를 섞어서 검을 하나 벼렸다. 아르겐의 검. 내 평생 최고의 작품이지. 값은… 평생 최고로 비싸다.', actions: [{ shop: 'smithy' }] },
    },
  },

  // ════════ 잡화상 미라 ════════
  mira: {
    entry: [{ cond: END, node: 'post' }],
    nodes: {
      start: { text: '어서 오세요, 미라의 잡화점이에요! 어머나, {name} 씨? 진짜예요? 오드릭 할아버지가 동네방네 떠들고 다니던데, 전 또 할아버지가 드디어… 아, 아니에요!', options: [
        { text: '물건을 보여 주세요.', next: 'shop' },
        { text: '요즘 마을 소식은요?', next: 'news' },
        { text: '도울 일 있나요?', cond: [{ flag: 'ch1.done' }, Q('ch2_dust', 'none')], next: 'dust' },
        { text: '묘지 흙을 가져왔어요.', cond: Q('ch2_dust', 'ready'), next: 'dust_done' },
        { text: '다음에 올게요.' },
      ] },
      shop: { text: '물약은 넉넉히! 죽었다 살아난 분이라도 두 번은 곤란하잖아요?', actions: [{ shop: 'general' }] },
      news: { text: '음, 토마 아저씨네 여관 지하실에 쥐가 들끓는대요. 엘다 아주머니는 요즘 묘지에 꽃을 놓으러 가지도 못하고요. 아, 그리고 렌이 또 이상한 노래를 지었는데 들으면 안 돼요. 귀가 썩어요!' },
      dust: { text: '묘지에서 언데드가 남기는 흙 있죠? 그걸 성수에 섞으면 해독제가 된대요. 옛날 책에서 봤어요! 여덟 줌만 모아다 주시면, 대신 물약을 한 아름 드릴게요.', options: [
        { text: '모아 볼게요.', actions: [{ startQuest: 'ch2_dust' }] }, { text: '으, 사양할게요.' },
      ] },
      dust_done: { text: '우와, 진짜 모아 오셨네요! 냄새는… 상상 이상이네요. 약속대로 물약이에요! 잔뜩!', actions: [
        { completeQuest: 'ch2_dust' },
      ] },
      post: { text: '요즘 장사가 너무 잘돼요! 다들 "귀혼자가 마신 물약"을 사겠다고… 제가 그렇게 써 붙였거든요. 헤헤, 괜찮죠?', options: [
        { text: '물건을 보여 주세요.', next: 'shop' }, { text: '…괜찮아요.' },
      ] },
    },
  },

  // ════════ 여관주인 토마 ════════
  toma: {
    entry: [
      { cond: END, node: 'post' },
      { cond: Q('ch1_cellar', 'ready'), node: 'done' },
      { cond: Q('ch1_cellar', 'active'), node: 'active' },
      { cond: Q('ch1_cellar', 'done'), node: 'after' },
    ],
    nodes: {
      start: { text: "어, 어서 오세요. '잠든 사슴'입니다. 히익! {name} 씨…? 저, 저는 귀신은 안 받는데요…", options: [
        { text: '살아 있습니다. 진짜로요.', next: 'b' },
        { text: '무슨 걱정이라도 있으세요?', next: 'b' },
      ] },
      b: { text: '그, 그렇군요. 오드릭 사제님이 그러셨으니… 저, 저기 그런데 말이에요. 지하실에 쥐가… 쥐가 너무 많아요. 포도주 통을 다 갉아 먹고, 그중에 개만 한 놈이 하나 있어서…', next: 'c' },
      c: { text: '경비병분들은 다들 바쁘시고… 혹시, 혹시나 해서 여쭙는 건데, 좀 잡아 주실 수 있을까요? 사례는 꼭 할게요! 손님이 두고 간 가죽 갑옷도 있고요!', options: [
        { text: '맡겨 주세요.', actions: [{ startQuest: 'ch1_cellar' }, { setFlag: 'ch1.cellar_ok' }, { sound: 'quest' }], next: 'd' },
        { text: '나중에 올게요.' },
      ] },
      d: { text: '가, 감사합니다! 지하실 계단은 여관 안쪽 구석에 있어요. 문은 열어 둘게요. 조심하세요, 그 큰 놈은 진짜… 진짜 커요.' },
      active: { text: '지, 지하실은 어때요? 그 큰 놈 보셨어요? 저는 계단 근처에도 못 가요…' },
      done: { text: '조용해졌어요! 쥐 소리가 하나도 안 나요! 아, 아르겐이시여… 정말 감사합니다. 약속드린 사례예요.', actions: [{ completeQuest: 'ch1_cellar' }, { sound: 'quest' }], next: 'done2' },
      done2: { text: '그런데 무너진 벽 너머에 굴이 있었다고요? 숲 쪽으로…? 으으, 듣기만 해도 소름이… 판자로 막아 둘게요.' },
      after: { text: "'잠든 사슴'에 오신 걸 환영해요! 이제 진짜로 편히 주무실 수 있어요. 쥐 없이요!" },
      post: { text: '요즘 손님이 너무 많아요. 다들 귀혼자 이야기를 들으러 온대요. 저, 저는 그 지하실 이야기만 백 번째 하는 중이에요. 쥐가 점점 커지고 있어요. 이야기 속에서요.' },
    },
  },

  // ════════ 교관 가렌 (전사 스킬) ════════
  garen: {
    entry: [{ cond: END, node: 'post' }, { cond: { flag: 'ch2.raid_done' }, node: 'start2' }],
    nodes: {
      post: { text: '차렷! …하하, 농담이다. 요즘 수련장이 미어터진다. 다들 귀혼자처럼 되겠다고 몰려와서 말이야. 그러려면 한 번 죽어 봐야 한다고 했더니 반은 도망가더군.', options: [
        { text: '오늘도 수련을 부탁드립니다.', next: 'menu' }, { text: '물러가겠습니다.' },
      ] },
      start: { text: '차렷! …아니, 자네는 이제 내 부하가 아니지. 다시 보니 반갑다, {name}. 아르겐의 전사가 되었다고? 그럼 내가 가르칠 게 남았나 보자.', next: 'menu' },
      start2: { text: '그날 밤, 자네 등을 맡을 수 있어서 영광이었다. 전사는 등 뒤를 맡길 사람을 고르는 법이지. 자, 오늘은 무엇을 배우겠나?', next: 'menu' },
      menu: { text: '수련장의 규칙은 하나다. 배운 건 몸에 새겨질 때까지 휘두른다!', options: [
        { text: '【회전베기】를 배우겠습니다. (Lv5)', cond: canLearn('whirlwind', 5), next: 'whirl' },
        { text: '【돌진】을 배우겠습니다. (Lv8)', cond: canLearn('charge', 8), next: 'charge' },
        { text: '【전투의 함성】을 배우겠습니다. (Lv12)', cond: canLearn('war_cry', 12), next: 'cry' },
        { text: '【철벽】을 배우겠습니다. (Lv15)', cond: canLearn('iron_wall', 15), next: 'wall' },
        { text: '아직 배울 수 있는 게 없나요?', cond: (g) => ['whirlwind', 'charge', 'war_cry', 'iron_wall'].every((id) => knows(id)(g) || g.player.level < { whirlwind: 5, charge: 8, war_cry: 12, iron_wall: 15 }[id]), next: 'none_low' },
        { text: '전투 요령을 알려 주세요.', next: 'tips' },
        { text: '물러가겠습니다.' },
      ] },
      none_low: { text: '지금 자네에게 가르칠 건 없다. 아직 몸이 따라오지 않거나, 이미 다 배웠거나. 회전베기는 5, 돌진은 8, 함성은 12, 철벽은 15. 레벨을 올리고 다시 와라!' },
      whirl: { text: '【회전베기】! 적에게 둘러싸였을 때, 발을 축으로 몸을 돌려 주변을 모조리 벤다. 허리로 돌려라, 팔이 아니라!', actions: [{ learnSkill: 'whirlwind' }, { sound: 'skill_whirl' }, { notice: '【회전베기】를 배웠다', sub: '스킬 창 K' }] },
      charge: { text: '【돌진】! 거리를 좁히는 데 망설임은 독이다. 방패를 앞세우고 부딪쳐라. 상대가 정신을 차리기 전에 끝내는 거다!', actions: [{ learnSkill: 'charge' }, { sound: 'skill_charge' }, { notice: '【돌진】을 배웠다', sub: '스킬 창 K' }] },
      cry: { text: '【전투의 함성】! 전장에서 가장 먼저 꺾이는 건 마음이다. 소리쳐라. 적은 너를 노리고, 너의 검은 더 무거워진다!', actions: [{ learnSkill: 'war_cry' }, { sound: 'skill_cry' }, { notice: '【전투의 함성】을 배웠다', sub: '스킬 창 K' }] },
      wall: { text: '【철벽】! 이건 내가 북문에서 배운 거다. 물러설 수 없을 때, 버티는 것도 싸움이다. …자네가 그날 밤 보여 준 것처럼.', actions: [{ learnSkill: 'iron_wall' }, { sound: 'skill_wall' }, { notice: '【철벽】을 배웠다', sub: '스킬 창 K' }] },
      tips: { text: '하나, 둘러싸이지 마라. 벽을 등지거나 좁은 길로 끌어들여라. 둘, 강타는 큰 놈에게 아껴라. 셋, 물약은 체력이 반 남았을 때 마셔라. 바닥났을 때 마시면 늦는다!' },
    },
  },

  // ════════ 리나 ════════
  lina: {
    entry: [
      { cond: { notFlag: 'ch1.lina_met' }, node: 'reunion' },
      { cond: END, node: 'post' },
      { cond: { flag: 'ch2.raid_done' }, node: 'ch3' },
      { cond: { flag: 'ch1.done' }, node: 'ch2' },
    ],
    nodes: {
      reunion: { text: '……', next: 'r2' },
      r2: { text: '……{sibling}?', next: 'r3' },
      r3: { speaker: '', portrait: false, text: '리나가 들고 있던 물동이를 떨어뜨린다. 물이 바닥에 번지는 동안, 아이는 꼼짝도 하지 않는다.', next: 'r4' },
      r4: { text: '거짓말. 오드릭 할아버지가 {sibling} 묻었어. 내가 봤어. 흙 덮는 거 내가 다 봤단 말이야…!', options: [
        { text: '리나. 나 왔어.', next: 'r5' },
        { text: '(말없이 리나를 안아 준다)', next: 'r5b' },
      ] },
      r5: { text: '……으, 으아아앙! 바보! 바보 {sibling}! 금방 온다며! 금방 온다며어…!', next: 'r6' },
      r5b: { speaker: '', portrait: false, text: '작은 어깨가 품 안에서 떨린다. 사흘 동안 참았던 울음이, 그제야 터져 나온다.', next: 'r6' },
      r6: { text: '흑… 그날 저녁에, 수프 끓여 놨었어. 다 식었어. 다 식어서… 버렸어…', next: 'r7' },
      r7: { text: '…이제 안 가는 거지? 또 북문 같은 데 가서 안 죽는 거지?', options: [
        { text: '다시는 너를 혼자 두지 않을게.', next: 'r8' },
        { text: '해야 할 일이 남았어. 하지만 꼭 돌아올게.', next: 'r8b' },
      ] },
      r8: { text: '…약속이야. 이번엔 진짜 약속이야. 거짓말하면 이번엔 내가 {sibling} 묻어 버릴 거야.', actions: [{ setFlag: 'ch1.lina_met' }] },
      r8b: { text: '…알아. {sibling}는 원래 그래. 맨날 지키러 가. …그럼 이번엔 꼭 돌아와. 수프 또 끓여 놓을 테니까. 식기 전에.', actions: [{ setFlag: 'ch1.lina_met' }] },
      start: { text: '{sibling}! 숲은 위험하대. 콜린 아저씨가 그러는데 늑대 눈이 막 시커멓대. …조심해야 돼?', options: [
        { text: '걱정 마.', next: 'kiss' }, { text: '리나는 집에 있어.', next: 'home' },
      ] },
      kiss: { text: '흥, 걱정 안 해. …쪼금밖에.' },
      home: { text: '알았어. 근데 심심하단 말이야. 핌이랑 우물가에서 노는 건 돼?' },
      ch2: { text: '묘지 간다며? …엄마 아빠 무덤도 거기 있어. 꽃이 다 시들었을 거야. 다녀오면, 같이 꽃 놓으러 가자.' },
      ch3: { text: '그 사람들, 나를 데려가려고 했어. "이름 없는 아이"라고 불렀어. 무슨 말인지 모르겠지만 너무 무서웠어. …{sibling}가 와 줘서 다행이야. 이번엔 늦지 않았어.', options: [
        { text: '탑에 가야 해. 금방 돌아올게.', next: 'ch3b' }, { text: '이제 괜찮아.' },
      ] },
      ch3b: { text: '"금방"이라고 하지 마. 그 말 싫어. …"꼭"이라고 해.', options: [{ text: '꼭 돌아올게.', next: 'ch3c' }] },
      ch3c: { text: '응. 꼭.' },
      post: { text: '{sibling}! 오늘 수프 끓였어! 이번엔 안 식었어! …그리고 엄마 아빠 무덤에 꽃 놨는데, 이상하지? 무덤이 따뜻했어. 꼭 누가 손잡아 준 것처럼.', options: [
        { text: '맛있겠다.', next: 'post2' }, { text: '엄마 아빠가 강을 건너셨나 봐.', next: 'post3' },
      ] },
      post2: { text: '당연하지! 내가 만들었으니까! 핌네 엄마한테 버섯 넣는 법 배웠어.' },
      post3: { text: '…응. 이제 다시 태어나실까? 그럼 나 언니 누나 해야겠다. 아니, 그건 좀 이상한가?' },
    },
  },

  // ════════ 경비병 ════════
  guard_north: {
    entry: [
      { cond: END, node: 'post' },
      { cond: { flag: 'ch3.open' }, node: 'open' },
    ],
    nodes: {
      start: { text: '{name}… 그날 밤 같이 북문을 지켰던 오웬이다. 네가 문턱에서 버티는 동안 나는… 종을 치러 뛰어가고 있었지. 살아 돌아와 줘서, 고맙다.', next: 'b' },
      b: { text: '북문 너머는 잿빛 황야다. 그날 밤 놈들이 몰려온 곳이지. 촌장님 명령으로 문은 잠가 두었어.' },
      open: { text: '문은 열었다. 잿빛 황야를 곧장 가로지르면 탑이 보일 거다. …이번엔 내가 종을 치지 않게 해 줘.' },
      post: { text: '북문은 다시 쌓았다. 이번엔 돌로. 네 이름도 문 기둥에 새겼어. 산 사람 이름을 새기는 건 처음이라던데.' },
    },
  },
  guard_east: {
    entry: [
      { cond: END, node: 'post' },
      { cond: { flag: 'ch1.done' }, node: 'open' },
    ],
    nodes: {
      start: { text: '동문 경비 테스다. 동쪽 옛 묘지는 출입 금지야. 밤마다 무덤이 들썩거려서, 해 지기 전에 문을 잠근다.' },
      open: { text: '촌장님께 들었다. 묘지로 가는 거지? 문은 열어 뒀어. 해골 놈들은 쓰러뜨려도 다시 일어나니까, 길게 끌지 마.' },
      post: { text: '요즘 묘지는 조용하다. 너무 조용해서 오히려 졸음이 와. 하하, 이런 불평을 할 날이 올 줄이야.' },
    },
  },

  // ════════ 마을 사람들 ════════
  villager_baker: {
    entry: [{ cond: END, node: 'post' }],
    nodes: {
      start: { text: '어이구, 우리 북문 경비 아니냐. 죽은 사람이 빵 냄새 맡고 돌아왔다더니, 진짜였구먼. 배고프면 언제든 와. 갓 구운 건 못 줘도 어제 거는 줄게.' },
      post: { text: '요즘은 빵에 네 얼굴을 찍어서 판다. "귀혼자 빵"이라고. 얼굴이 좀 찌그러졌어도 이해해라. 반죽이 원래 그래.' },
    },
  },
  villager_farmer: {
    entry: [{ cond: END, node: 'post' }, { cond: { flag: 'ch1.page1' }, node: 'calm' }],
    nodes: {
      start: { text: '숲 가장자리 밭은 다 버렸어. 늑대들이 밤마다 내려와서 울어 대는데, 그 소리가 꼭 사람 우는 소리 같다니까. 눈이 시커멓게 탄 놈들이야.' },
      calm: { text: '늑대들이 잠잠해졌어! 덕분에 버섯밭을 다시 일구고 있지. 가을엔 리나한테 제일 큰 놈으로 갖다 줄게.' },
      post: { text: '올해 농사는 대풍이야. 땅이 따뜻해. 묘지 쪽 흙까지 따뜻하다니까. 무슨 일이 있었던 건지는 몰라도, 고맙다.' },
    },
  },
  villager_widow: {
    entry: [{ cond: END, node: 'post' }, { cond: { flag: 'ch1.done' }, node: 'ch2' }],
    nodes: {
      start: { text: '…남편은 작년 겨울에 갔어요. 그런데 요즘 꿈에 자꾸 나와요. 강가에서, 건너지도 못하고 서성이면서… 내 이름을 불러요.' },
      ch2: { text: '오드릭 사제님께 들었어요. 그 찢긴 장에 남편 이름도 있었다고. 그래서 강을 못 건넜던 거군요. …부탁이에요. 그이를 보내 주세요.' },
      post: { text: '어젯밤 꿈에 그이가 왔어요. 강을 건너면서 손을 흔들더군요. 웃고 있었어요. …이제 저도 웃어도 되겠지요.' },
    },
  },
  villager_kid: {
    entry: [{ cond: END, node: 'post' }, { cond: { flag: 'ch2.raid_done' }, node: 'raid' }],
    nodes: {
      start: { text: '형아 진짜 죽었다 살아났어? 그럼 귀신이야? 손 줘 봐! …따뜻하네. 에이, 시시해.' },
      raid: { text: '그 검은 옷 아저씨들, 리나를 끌고 가려고 했어! 내가 돌 던졌어! 하나 맞혔어! …진짜야!' },
      post: { text: '나도 커서 귀혼자 될 거야! 가렌 아저씨가 그러는데 그러려면 일단 한 번 죽어야 된대. …그건 좀 생각해 볼게.' },
    },
  },
  villager_bard: {
    entry: [{ cond: END, node: 'post' }],
    nodes: {
      start: { text: '오, 돌아온 자여! 노래 한 자락 들어 보겠소? 다섯 신의 노래라오.', options: [
        { text: '들려주세요.', next: 'song' }, { text: '미라가 듣지 말라던데요.', next: 'mira' },
      ] },
      song: { text: '♪ 세상이 처음 저물던 날 / 다섯 불이 어둠을 막았네 / 강철의 아르겐, 그림자의 녹티스 / 별의 아스테라, 빛의 엘리아 / 바람의 카이가 손을 잡으니 / 황혼의 왕은 깊이 잠들었네 ♪', next: 'song2' },
      song2: { text: '…그런데 이상하지 않소? 노래는 늘 여기서 끝나. 왕이 잠들었다고만 하지, 죽었다고는 안 하거든.' },
      mira: { text: '미라는 내 노래의 깊이를 몰라서 그렇소! …뭐, 음이 좀 나가긴 하지만.' },
      post: { text: '새 노래를 지었소! "이름을 놓지 않은 문지기". 마지막 구절이 아직 안 나와서 고민이오. 혹시 탑 꼭대기에서 무슨 말을 했는지 알려 줄 수 있소?' },
    },
  },

  // 엔딩 후 신전의 세린
  recorder_post: {
    entry: [
      { cond: Q('post_rift', 'ready'), node: 'done' },
      { cond: Q('post_rift', 'active'), node: 'active' },
      { cond: Q('post_rift', 'done'), node: 'after' },
    ],
    nodes: {
      start: { speaker: '기록자 세린', text: '산 자의 땅은 시끄럽구려. 하지만 나쁘지 않소. …{name}, 그대에게 할 말이 있어 이렇게 내려왔소.', next: 'b' },
      b: { speaker: '기록자 세린', text: '황혼의 왕이 스러지며 경계에 상처를 남겼소. 망각의 균열. 그 밑바닥에서 이름 없는 것들이 계속 기어오르고 있지.', next: 'c' },
      c: { speaker: '기록자 세린', text: '그 가장 깊은 곳엔 균열의 군주가 똬리를 틀고 있소. 지금의 그대라도 쉽지 않을 것이오. 신전 한쪽에 균열로 통하는 문을 열어 두었소. 준비가 되면 들어가시오.', actions: [{ startQuest: 'post_rift' }, { sound: 'quest' }] },
      active: { speaker: '기록자 세린', text: '균열은 깊을수록 위험하오. 그러나 그만큼 그대를 단련시켜 줄 것이오. 이름을 놓지 마시오, {name}.' },
      done: { speaker: '기록자 세린', text: '군주를 쓰러뜨렸구려. 균열은 닫히지 않겠지만, 한동안은 잠잠할 것이오. 수고했소, 귀혼자여.', actions: [{ completeQuest: 'post_rift' }] },
      after: { speaker: '기록자 세린', text: '경계는 오늘도 조용하오. 그대 덕분이지. …가끔은 이렇게 내려와서 리나의 수프를 얻어먹어도 되겠소?' },
    },
  },
};
