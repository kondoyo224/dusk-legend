// 프롤로그 「귀혼의 서」 대화. 소유: 워커 D. 대본: docs/SCRIPT.md §프롤로그
// 말투: 세린 = 차분한 하오체 / 아르겐 = 짧고 무거운 고어 / 리나의 환영 = 어린 아이 반말
import { dropAt } from '../maps/_hooks.js';

const SERIN = '기록자 세린';
const VOICE = '세린의 목소리';
const N = { speaker: '', portrait: false }; // 지문(내레이션)

// 세린이 곁에 있을 때 공통 선택지: 회복, 물병 보충
const careOpts = (back) => [
  { text: '혼이 지쳤어요.', next: 'heal' },
  { text: '물병이 다 떨어졌어요.', cond: { not: { item: 'soul_vial' } }, next: 'vial' },
  { text: '알겠어요.', next: back },
];

export default {
  // ── 눈뜸 ──
  pro_wake: {
    nodes: {
      start: { speaker: SERIN, text: '…눈을 떴구려. 서두르지 마시오. 이곳에서는 숨을 쉬지 않아도 되니.', next: 'b' },
      b: { speaker: SERIN, text: '여기는 망각의 묘원. 산 자의 땅도, 죽은 자의 강도 아닌… 그 사이의 물가라오.', options: [
        { text: '당신은 누구죠?', next: 'who' },
        { text: '나는… 누구지?', next: 'me' },
      ] },
      who: { speaker: SERIN, text: '나는 세린. 귀혼의 서를 지키는 기록자요. 죽은 이의 이름을 이 책에 적어, 그 혼이 강을 건너 다시 태어나게 하지.', next: 'me' },
      me: { speaker: SERIN, text: '그대의 이름은… 반쯤 지워져 있소. 찢긴 것이 아니라 지워진 것. 무언가에 끝까지 저항한 혼에게서나 보이는 흔적이오.', next: 'm2' },
      m2: { speaker: SERIN, text: '묘원에 그대의 기억이 세 갈래로 흩어져 빛나고 있소. 육신의 기억, 마음의 기억, 혼의 기억. 그것들을 되찾으면 이름도 돌아올 것이오.', next: 'm3' },
      m3: { speaker: SERIN, text: '먼저 동쪽으로 가 보시오. 쇠와 땀의 냄새가 나는 쪽이오. …걷는 법은 기억하겠지. 발이 기억하는 대로 옮기면 되오.' },
    },
  },

  // ── 묘원의 세린 (진행도별 안내 + 이름 되찾기) ──
  recorder_limbo: {
    entry: [
      { cond: { flag: 'pro.named' }, node: 'after' },
      { cond: { flag: 'pro.soul' }, node: 'naming' },
      { cond: { flag: 'pro.mind' }, node: 'h_north' },
      { cond: { flag: 'pro.body' }, node: 'h_west' },
    ],
    nodes: {
      start: { speaker: SERIN, text: '동쪽이오. 그림자들이 그대의 검 쥐던 손을 흉내 내고 있소. 그것들을 흩어 버리면 육신의 기억이 드러날 것이오.', options: careOpts(null) },
      h_west: { speaker: SERIN, text: '손이 기억해 냈구려. 이번엔 서쪽이오. 꽃내음이 나는 곳… 그대가 마지막으로 마음을 두고 온 자리일 것이오.', options: careOpts(null) },
      h_north: { speaker: SERIN, text: '마지막은 북쪽이오. 기둥들 사이에 망각의 파수꾼이 서 있소. 이곳에 흘러든 기억을 모조리 삼키는 자요. 혼의 물병을 아끼지 마시오.', options: careOpts(null) },
      heal: { speaker: SERIN, text: '잠시 눈을 감으시오. …물결이 잦아들 것이오.', actions: [{ heal: true }, { sound: 'potion' }] },
      vial: { speaker: SERIN, text: '망각의 샘에서 길어 온 물이오. 혼이 흔들릴 때 마시시오.', actions: [{ giveItem: 'soul_vial', qty: 3 }] },
      naming: { speaker: SERIN, text: '…세 개의 빛이 모두 그대 안에 돌아왔구려. 그대 얼굴에 표정이 생겼소.', next: 'n2' },
      n2: { speaker: SERIN, text: '자, 조각들을 내게 주시오. 귀혼의 서에 그대의 이름을 다시 새기겠소.', options: [
        { text: '(세 조각을 건넨다)', next: 'n3' },
        { text: '잠시만 기다려 주세요.', next: null },
      ] },
      n3: { ...N, text: '세린이 귀혼의 서를 펼친다. 펜 끝에서 흘러나온 빛이 지워진 글자들을 한 획씩 메워 나간다…', actions: [
        { takeItem: 'shard_body' }, { takeItem: 'shard_mind' }, { takeItem: 'shard_soul' }, { sound: 'page' },
      ], next: 'n4' },
      n4: { speaker: SERIN, text: '{name}. …그렇소, 그것이 그대의 이름이오. 로엔의 북문을 지키던 젊은 경비병, {name}.', actions: [
        { setFlag: 'pro.named' }, { sound: 'levelup' }, { title: '{name}', sub: '— 되찾은 이름 —' }, { wait: 2.4 },
      ], next: 'n5' },
      n5: { speaker: SERIN, text: '그대가 마지막으로 본 검은 로브의 사내… 나도 그자를 알고 있소. 하지만 그 이야기는 신들 앞에서 하리다.', next: 'n6' },
      n6: { speaker: SERIN, text: '남쪽 끝, 빛이 고인 곳으로 가시오. 이름을 가진 혼이라면 이제 그 길을 걸을 수 있소.', actions: [
        { msg: '남쪽(화면 오른쪽 아래)의 빛의 길이 열렸다.', channel: 'quest' },
      ] },
      after: { speaker: SERIN, text: '빛의 길은 남쪽 끝에 있소. 신들이 그대를 기다리고 있지, {name}.', options: careOpts(null) },
    },
  },

  // ── 튜토리얼 ──
  pro_fight_tip: {
    nodes: {
      start: { speaker: VOICE, portrait: false, text: '그림자들이오! 그대의 손은 아직 검을 기억하고 있소.', next: 'b' },
      b: { speaker: VOICE, portrait: false, text: '적을 클릭하면 쫓아가 계속 베고, Space 를 누르면 가장 가까운 적을 향해 몸을 돌려 휘두르오. 누르고 있으면 쉬지 않고 베지.', next: 'c' },
      c: { speaker: VOICE, portrait: false, text: '쓰러져도 두려워 마시오. 이곳에서 혼은 사라지지 않소. 내 곁에서 다시 눈을 뜰 뿐이오.' },
    },
  },
  pro_body: {
    nodes: {
      start: { ...N, text: '조각을 쥐자, 손바닥에 굳은살의 감각이 되살아난다.', next: 'b' },
      b: { ...N, text: '새벽마다 북문 앞에서 목검을 휘두르던 나날. 무거운 창을 짊어지고 성벽을 돌던 밤들.', next: 'c' },
      c: { ...N, text: '— 나는, 무언가를 지키던 사람이었다.', next: 'd' },
      d: { speaker: VOICE, portrait: false, text: '육신의 기억이 돌아왔구려. 이번엔 서쪽으로 가 보시오. 그쪽 장벽이 걷혔소.' },
    },
  },
  pro_vial_tip: {
    nodes: {
      start: { speaker: VOICE, portrait: false, text: '기억이 너무 거세게 밀려들면 혼이 흔들리오. 그대 손에 혼의 물병을 쥐여 주었소.', next: 'b' },
      b: { speaker: VOICE, portrait: false, text: '숫자 1 키를 누르거나, 소지품 창(I)을 열어 물병을 쓰시오. 흔들린 혼이 가라앉을 것이오.' },
    },
  },

  // ── 마음의 기억: 리나의 환영 (선택지 튜토리얼) ──
  pro_echo: {
    nodes: {
      start: { speaker: '어린 소녀의 환영', text: '{sibling}! 벌써 가? 오늘도 북문 지키러 가는 거야?', next: 'ask' },
      ask: { speaker: '어린 소녀의 환영', text: '…있지, 오늘은 일찍 오면 안 돼?', options: [
        { text: '응. 금방 돌아올게.', actions: [{ setFlag: 'pro.answer', value: 'promise' }], next: 'a1' },
        { text: '걱정 마. 리나는 집에서 문 꼭 잠그고 있어.', actions: [{ setFlag: 'pro.answer', value: 'protect' }], next: 'a2' },
        { text: '……(대답하지 못한다)', actions: [{ setFlag: 'pro.answer', value: 'silent' }], next: 'a3' },
      ] },
      a1: { speaker: '어린 소녀의 환영', text: '정말? 약속했다! 오늘 저녁엔 내가 버섯 수프 끓여 놓을게. 늦으면 다 식어 버린다?', next: 'end' },
      a2: { speaker: '어린 소녀의 환영', text: '치, 나도 이제 다 컸거든? …그래도 알았어. {sibling}도 조심해. 요즘 밤마다 묘지 쪽에서 이상한 소리가 난대.', next: 'end' },
      a3: { speaker: '어린 소녀의 환영', text: '{sibling}…? 왜 그렇게 봐? …이상해. 오늘따라 {sibling}가 아주 멀리 있는 것 같아.', next: 'end' },
      end: { ...N, text: '소녀의 모습이 꽃잎처럼 흩어진다. 그 자리에 따스한 빛 한 조각이 남았다.', actions: [
        { removeNpc: 'memory_echo' }, { setFlag: 'pro.mind_drop' }, { sound: 'page' }, dropAt('shard_mind', 11, 46),
      ] },
    },
  },
  pro_mind: {
    nodes: {
      start: { ...N, text: '리나. 내 동생의 이름은 리나였다.', next: 'b' },
      b: { ...N, text: '로엔. 안개 낀 숲과 낡은 종탑, 갓 구운 빵 냄새가 골목마다 배어 있는 작은 마을. 그곳이 나의 고향이다.', next: 'c' },
      c: { speaker: VOICE, portrait: false, text: '마음의 기억이구려. …이제 마지막이오. 북쪽 장벽이 걷혔소. 그곳엔 망각의 파수꾼이 있으니, 물병을 넉넉히 챙기시오.' },
    },
  },
  pro_warden: {
    nodes: {
      start: { speaker: '망각의 파수꾼', portrait: false, text: '……이름 없는 혼이여. 여기서 멈추라. 기억은 고통이니, 내가 거두어 가리라.', next: 'b' },
      b: { speaker: VOICE, portrait: false, text: '물러서지 마시오! 그 기억은 그대의 것이오. 혼이 흔들리면 물병(1)을 마시시오!' },
    },
  },
  // ── 혼의 기억: 죽음의 회상 ──
  pro_death: {
    nodes: {
      start: { ...N, text: '— 사흘 전 밤. 로엔 북문.', next: 'b' },
      b: { ...N, text: '경종이 미친 듯이 울린다. 안개 속에서 하얀 뼈들이 덜그럭거리며 밀려온다.', next: 'c' },
      c: { ...N, text: '동료들이 하나둘 쓰러진다. 그래도 나는 문 앞을 떠나지 않았다. 내 뒤에는 잠든 마을이… 리나가 있었으니까.', next: 'd' },
      d: { ...N, text: '그때, 해골들 너머에서 검은 로브의 사내가 천천히 손을 들었다.', next: 'e' },
      e: { speaker: '검은 로브의 사내', portrait: false, text: '제법 버티는구나, 문지기. 좋다… 네 이름은 내가 거두어 가마.', next: 'f' },
      f: { ...N, text: '차가운 손가락이 가슴속으로 파고든다. 무언가가 찢겨 나가려 한다. 나는 이를 악물고 — 놓지 않았다.', next: 'g' },
      g: { ...N, text: '그리고, 어둠.' },
    },
  },

  // ── 신들의 제단 ──
  pro_altar_intro: {
    nodes: {
      start: { speaker: SERIN, text: '여기가 신들의 제단이오. 세상이 처음 저물던 날, 황혼을 막아선 다섯 신이 이곳에 불을 남겼지.', next: 'b' },
      b: { speaker: SERIN, text: '그러나 지금 타오르는 것은 강철과 맹세의 신, 아르겐의 불뿐이오. 나머지 넷은 오래전 깊은 잠에 들었소.', next: 'c' },
      c: { speaker: SERIN, text: '그대를 부르는 불꽃에게 가 보시오. 신은 그대의 손을 기억하고 있을 것이오.' },
    },
  },
  recorder_altar: {
    entry: [
      { cond: { flag: 'pro.gate' }, node: 'gate' },
      { cond: { flag: 'pro.warrior' }, node: 'book' },
    ],
    nodes: {
      start: { speaker: SERIN, text: '가운데, 붉게 타오르는 제단이오. 아르겐이 그대를 부르고 있소.' },
      book: { speaker: SERIN, text: '맹세를 마쳤구려. 이제 그대에게 보여 줄 것이 있소.', actions: [{ dialog: 'pro_book', npc: 'recorder' }] },
      gate: { speaker: SERIN, text: '문은 열려 있소. 로엔 신전의 오드릭을 찾으시오. …살아 있다는 건 원래 아픈 일이오. 그러니 잘 아파하시오, {name}.' },
    },
  },
  altar_argen: {
    entry: [{ cond: { flag: 'pro.warrior' }, node: 'done' }],
    nodes: {
      start: { speaker: '아르겐의 불꽃', text: '……지키다 쓰러진 자여. 네가 끝내 놓지 않은 것을, 나는 보았다.', next: 's2' },
      s2: { speaker: '아르겐의 불꽃', text: '문을 등지고 끝까지 서 있던 두 발. 이름을 빼앗기면서도 펴지지 않던 주먹. 그것이 강철의 마음이다.', next: 's3' },
      s3: { speaker: '아르겐의 불꽃', text: '맹세하라. 쓰러진 자를 다시 일으키는 검이 되겠다고.', options: [
        { text: '맹세합니다. 다시는 물러서지 않겠습니다.', next: 'oath' },
        { text: '쓰러진 이들을… 이번에는 지켜 내겠습니다.', next: 'oath' },
        { text: '(잠시 망설인다)', next: 'hesit' },
      ] },
      hesit: { speaker: '아르겐의 불꽃', text: '망설임은 부끄러움이 아니다. 무게를 아는 자만이 망설이지. 준비가 되면 다시 오라.' },
      oath: { ...N, text: '불꽃이 손등을 타고 흘러든다. 뼛속까지 뜨거운 쇳물이 차오르는 듯하다.', actions: [
        { setClass: 'warrior' }, { learnSkill: 'power_strike' }, { setFlag: 'pro.warrior' }, { giveItem: 'wooden_sword' },
        { call: (g) => { const i = g.state.inventory.findIndex((x) => x?.id === 'wooden_sword'); if (i >= 0) g.systems.inventory.equip?.(i); } },
        { call: (g) => {
          g.state.statPoints += 2;
          const hb = g.state.hotbar;
          if (!hb.includes('power_strike')) { const i = hb[1] == null ? 1 : hb.findIndex((s) => s == null); if (i >= 0) hb[i] = 'power_strike'; }
          g.systems.stats.recalc(g.player);
          g.bus.emit('stats:changed', { entity: g.player });
        } },
        { sound: 'skill_power' }, { shake: 6, time: 0.5 }, { fx: 'levelup' },
      ], next: 'o2' },
      o2: { speaker: '아르겐', text: '손에 쥔 것은 나무에 불과하나, 쥔 손은 강철이다. 이제 너는 나의 전사다. 첫 가르침을 주마 — 【강타】. 온 무게를 실어 단 한 번에 내려치는 법이다.', next: 'o3' },
      o3: { ...N, text: '【강타】를 배웠다. 단축키 2 로 쓸 수 있고, 스킬 창(K)에서 다른 칸으로 옮길 수 있다.', actions: [{ notice: '전사로 각성했다', sub: '스킬 【강타】 습득 · 스킬 창 K' }], next: 'o4' },
      o4: { ...N, text: '아르겐의 축복으로 스탯 포인트 2를 얻었다. 캐릭터 창(C)에서 힘·민첩·체력·지능·지혜에 나누어 줄 수 있다. 전사에겐 힘과 체력이 근본이다.', next: 'o5' },
      o5: { speaker: '아르겐', text: '가라. 기록자가 너를 기다린다. 그리고 기억하라 — 강철은 꺾이지 않는 것이 아니라, 꺾여도 다시 벼려지는 것이다.', options: [
        { text: '(고개를 숙인다)', actions: [{ dialog: 'pro_book', npc: 'recorder' }] },
      ] },
      done: { speaker: '아르겐의 불꽃', text: '너의 맹세는 내 불 속에 있다. 가라, 나의 전사여.' },
    },
  },
  pro_book: {
    nodes: {
      start: { speaker: SERIN, text: '맹세를 마쳤구려. 이제 그대에게 보여 줄 것이 있소.', actions: [{ sound: 'page' }], next: 'b' },
      b: { ...N, text: '세린이 귀혼의 서를 펼친다. 책 한가운데가 거칠게 뜯겨 나가 있다. 누군가 손톱으로 할퀸 듯한 자국.', next: 'c' },
      c: { speaker: SERIN, text: '세 장(章)이 찢겨 나갔소. 로엔 사람들의 이름이 적혀 있던 장들이오. 그 장에 이름이 있던 혼들은 강을 건너지 못한 채, 언데드가 되어 묶여 있소.', next: 'd' },
      d: { speaker: SERIN, text: '찢어 간 자는 흑마도사 벨자르. 황혼의 왕 모르데카이를 섬기는 황혼 교단의 수장이오. 그대의 이름을 거두려 했던, 바로 그 검은 로브의 사내지.', next: 'e' },
      e: { speaker: SERIN, text: '찢긴 장이 모두 그자의 손에 모이면, 천 년 전 다섯 신이 봉인한 황혼의 왕이 돌아오오. 그리고 이번에는 막아설 신이 하나뿐이지.', options: [
        { text: '제가 그 장들을 되찾겠습니다.', next: 'f' },
        { text: '왜 하필 저입니까?', next: 'why' },
      ] },
      why: { speaker: SERIN, text: '그대는 이름을 빼앗기지 않은 유일한 혼이오. 그리고… 아르겐이 그대를 택했소. 신이 고른 자를 기록자가 거절할 수는 없는 법이지.', next: 'f' },
      f: { speaker: SERIN, text: '고맙소, {name}. 이제 그대의 이름을 서에 다시 적어, 산 자의 땅으로 돌려보내겠소.', actions: [{ sound: 'page' }], next: 'g' },
      g: { ...N, text: '세린의 펜이 마지막 획을 긋자, 전당 남쪽의 두 석상 사이로 빛의 문이 열린다.', actions: [
        { setTile: { x: 24, y: 24, id: 'portal_glow' } }, { setFlag: 'pro.gate' }, { sound: 'portal' }, { shake: 4, time: 0.5 },
      ], next: 'h' },
      h: { speaker: SERIN, text: '문을 지나면 그대는 다시 숨을 쉬게 될 것이오. 처음엔 아플 거요. 살아 있다는 건 원래 아픈 일이니.', next: 'i' },
      i: { speaker: SERIN, text: '로엔 신전으로 가시오. 그대를 묻어 준 노사제 오드릭이 있을 것이오. …부디, 다시는 이곳에서 만나지 않기를.', actions: [
        { notice: '귀혼의 문이 열렸다', sub: '두 석상 사이의 빛으로 걸어 들어간다' },
      ] },
    },
  },
  // 잠든 네 신의 제단
  altar_noctis: { nodes: { start: { speaker: '녹티스의 제단', text: '그림자와 비밀의 여신 녹티스. 차갑게 식은 재 위로 희미한 속삭임만이 맴돈다. 『…아직, 너를 부르지 않는다.』' } } },
  altar_astera: { nodes: { start: { speaker: '아스테라의 제단', text: '별과 지혜의 현자신 아스테라. 꺼진 화로에 별가루 같은 먼지가 내려앉아 있다. 『…아직, 너를 부르지 않는다.』' } } },
  altar_elia: { nodes: { start: { speaker: '엘리아의 제단', text: '빛과 치유의 어머니 엘리아. 손을 대자 아주 잠깐 온기가 스친다. 『…아직, 너를 부르지 않는다.』' } } },
  altar_kai: { nodes: { start: { speaker: '카이의 제단', text: '바람과 수행의 신 카이. 고요한 제단 위로 바람 한 줄기가 맴돌다 사라진다. 『…아직, 너를 부르지 않는다.』' } } },
};
