// 3장 「황혼의 탑」 · 종장 「경계를 지키는 자」 대화. 소유: 워커 B (재배정 B10).
// 말투: 벨자르=오만한 고어 / 황혼의 왕=장중, 짧은 문장 / 세린=차분한 하오체
const BELZAR = '흑마도사 벨자르';
const KING = '황혼의 왕 모르데카이';
const SERIN = '기록자 세린';
const NARR = { speaker: '', portrait: false };

export default {
  // 정상에서 벨자르와 마주침
  ch3_belzar: {
    nodes: {
      start: { speaker: BELZAR, text: '…이름 없는 혼이 끝내 여기까지 기어올랐구나. 북문에서 쓰러뜨린 경비병. 그래, 기억하고말고.', next: 'b' },
      b: { speaker: BELZAR, text: '그날 밤 나는 네 이름도 찢어 낼 생각이었다. 헌데 네 혼은 끝까지 버티더군. 미련한 것. 그 미련이 너를 다시 죽음으로 데려왔다.', options: [
        { text: '찢긴 장을 돌려받으러 왔다.', next: 'c1' },
        { text: '로엔의 죽은 이들을 놓아 줘라.', next: 'c2' },
      ] },
      c1: { speaker: BELZAR, text: '돌려받아? 하하! 이것은 빼앗은 것이 아니라 해방한 것이다. 이름에 묶여 강을 건너는 것이 구원이더냐? 황혼의 왕께서는 죽음 자체를 다스리신다.', next: 'd' },
      c2: { speaker: BELZAR, text: '놓아 달라? 그들은 이제 아무것도 잃지 않는다. 늙지도, 굶지도, 슬퍼하지도 않지. 교단이 그들에게 준 것은 영원이다.', next: 'd' },
      d: { speaker: BELZAR, text: '두 장을 되찾았다지. 상관없다. 마지막 장과 이 탑, 그리고 네 혼이면 충분하니. 와라, 아르겐의 개여. 네 신이 너를 몇 번이나 일으켜 주는지 보자꾸나!', actions: [{ sound: 'skill_cry' }] },
    },
  },

  // 벨자르 패배 → 찢긴 장 III 으로 황혼의 왕의 그림자를 부른다
  ch3_belzar_fall: {
    nodes: {
      start: { speaker: BELZAR, text: '크윽… 이럴 수가… 한 번 죽은 자 따위에게…', next: 'b' },
      b: { speaker: BELZAR, text: '…허나 늦었다. 의식은 이미 끝났다. 내 피가 마지막 획이다!', next: 'c' },
      c: { ...NARR, text: '벨자르가 품에서 황혼빛 양피지를 꺼내 제 가슴에 짓누른다. 찢긴 장 III 의 글자들이 피처럼 번져 바닥의 문양을 따라 흐른다.', actions: [{ shake: 6, time: 0.8 }, { sound: 'skill_earth' }], next: 'd' },
      d: { speaker: BELZAR, text: '황혼의 왕이시여! 천 년의 잠에서 깨어나소서! 이 혼을, 이 탑을, 이 땅을 받으소서──!', next: 'e' },
      e: { ...NARR, text: '외침이 끊긴다. 벨자르의 몸이 재가 되어 무너지고, 그 재 속에서 거대한 그림자가 일어선다.' },
    },
  },

  // 황혼의 왕 강림
  ch3_king: {
    nodes: {
      start: { speaker: KING, text: '…오래 잤다.', next: 'b' },
      b: { speaker: KING, text: '다섯 신의 냄새가 난다. 아르겐. 강철과 맹세의 개.', next: 'c' },
      c: { speaker: KING, text: '너는 이미 죽은 자다. 죽은 자는 나의 것이다. 무릎 꿇어라.', options: [
        { text: '내 이름은 내 것이다.', next: 'd1' },
        { text: '(말없이 검을 들어 올린다)', next: 'd2' },
      ] },
      d1: { speaker: KING, text: '이름. 한 줄의 먹물. 그것이 너를 지킬 수 있겠느냐.', next: 'e' },
      d2: { speaker: KING, text: '…좋다. 맹세의 검이 얼마나 단단한지 보자.', next: 'e' },
      e: { ...NARR, text: '황혼이 탑 꼭대기를 삼킨다. 마지막 싸움이다.' },
    },
  },

  // 종장: 세린의 현신과 선택
  ch3_ending: {
    nodes: {
      start: { ...NARR, text: '빛이 걷히자, 무너진 탑 꼭대기에 은빛 머리칼의 여인이 서 있다. 세 장의 양피지가 그녀의 손 위에서 천천히 하나의 책으로 돌아간다.', next: 'b' },
      b: { speaker: SERIN, text: '…다시 만났구려, {name}. 이번에는 그대가 나를 찾아왔소.', next: 'c' },
      c: { speaker: SERIN, text: '세 장이 모두 돌아왔소. 로엔의 혼들이 하나씩 강을 건너고 있소. 경비병들도, 묘지기 그라우스도, 그 늙은 늑대도. 그대가 그 이름들을 되찾아 준 것이오.', next: 'd' },
      d: { speaker: SERIN, text: '그리고 그대의 이름도. 처음 만났을 때 반쯤 지워져 있던 그 이름이… 이제는 내가 쓴 어떤 글씨보다 선명하오.', next: 'e' },
      e: { speaker: SERIN, text: '하나 묻고 싶은 것이 있소. 그대는 이미 한 번 죽은 자. 산 자와 죽은 자의 경계를 넘나든 자는 흔치 않소.', next: 'f' },
      f: { speaker: SERIN, text: '그대, 경계를 지키는 귀혼자(歸魂者)로 살아가겠소? 아니면 그저 로엔의 한 사람으로 돌아가겠소?', options: [
        { text: '로엔에 남겠다. 지켜야 할 사람들이 있다.', next: 'stay' },
        { text: '경계를 지키겠다. 다시는 이름을 잃는 혼이 없도록.', next: 'guard' },
      ] },
      stay: { speaker: SERIN, text: '…그 대답일 줄 알았소. 리나가 기다리고 있으니. 허나 기억하시오. 마을의 문지기도 경계를 지키는 자요. 그대가 서 있는 곳이 곧 경계가 될 것이오.', actions: [{ setFlag: 'end.stay' }], next: 'g' },
      guard: { speaker: SERIN, text: '…무거운 맹세구려. 그러나 그대라면 감당하리라 믿소. 서두를 것은 없소. 경계는 로엔에서도 지킬 수 있으니, 먼저 리나에게 돌아가 웃는 얼굴을 보여 주시오.', actions: [{ setFlag: 'end.guard' }], next: 'g' },
      g: { speaker: SERIN, text: '이것을 받으시오. 내 곁을 오래 지킨 펜던트요. 그대가 어디에 있든, 귀혼의 서는 그대의 이름을 기억할 것이오.', next: 'h' },
      h: { speaker: SERIN, text: '…고맙소, 귀혼자여. 이제 돌아가시오. 그대가 살아갈 땅으로.', actions: [{ sound: 'levelup' }] },
    },
  },
};
