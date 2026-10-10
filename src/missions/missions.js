// 미션 데이터(기획서 9-2 ~ 9-5). 질문·보기·정답·힌트·정답 설명·한 줄 정리는 기획서 문구를 그대로 옮긴다.
// 기획서에 오답 힌트가 없는 문항은 '확인 방법'을 끝만 해요체로 바꿔 guide에 둔다(docs/결정기록.md 2026-10-07, 2026-10-08).
// 둘 다 없으면 hint·guide가 없다.
//
// 문항마다:
//   start  문항을 시작할 때 맞출 장면. view: 'map' | 'planet' | 'size' | 'sky'
//          planet(행성 탐사 화면의 천체) · loupe(고리 찾기) · real(실제 크기로 보기) · hour(시각) · lights(주변 불빛)
//   lock   예측 단계에서 잠그는 조작(이름 보기와 장면을 바꾸는 버튼은 화면이 함께 잠근다)
//   cue    확인 단계(오답 뒤)에서 눌러 보라고 강조할 조작
// 조작 이름: sunlight 태양 빛 가리기 · play 재생 · next 다음 행성 · land 착륙하기 · loupe 고리 찾기
//            real 실제 크기로 보기 · sunCompare 태양과 비교하기 · time 시각 슬라이더 · names 이름 보기 · lights 주변 불빛
import { MEMBERS } from '../model/memberProgress.js';
import { CONSTELLATIONS } from '../data/constellations.js';

const MEMBER_LABELS = Object.fromEntries(MEMBERS.map((m) => [m.id, m.label]));

// 요일 도입(9-2): 요일 카드 → 날아갈 천체
const DAYS = [
  { id: 'mon', label: '월요일', body: 'moon' },
  { id: 'tue', label: '화요일', body: 'mars' },
  { id: 'wed', label: '수요일', body: 'mercury' },
  { id: 'thu', label: '목요일', body: 'jupiter' },
  { id: 'fri', label: '금요일', body: 'venus' },
  { id: 'sat', label: '토요일', body: 'saturn' },
  { id: 'sun', label: '일요일', body: 'sun' }
];

// 흥미 체크(9-1, 9-5, docs/결정기록.md 2026-10-08). 기록값은 이모지를 뺀 글자, 이모지는 화면에만.
const FUN = ['재미있었어요', '보통이에요', '별로예요'];
const FUN_EMOJI = ['😀', '🙂', '😐'];
const funQuestion = (id, text) => ({ id, text, options: FUN, emoji: FUN_EMOJI });

const MAP = { view: 'map' };
const JUPITER = { view: 'planet', planet: 'jupiter' };
const SAME_SIZE = { view: 'size', real: false };
const REAL_SIZE = { view: 'size', real: true };
const SKY_8PM = { view: 'sky', hour: 20, lights: false };

export const MISSIONS = [
  {
    id: 1,
    code: 'MISSION 01',
    name: '태양계 구성원과 태양', // 탐사 선택 카드(7장 표)
    desc: '태양계 지도에서 태양, 행성, 위성, 혜성, 소행성을 찾아요.', // 탐사 선택 카드 설명(S02)
    title: '탐사 1 · 태양계 구성원',
    view: 'map',
    memberLabels: MEMBER_LABELS,
    days: DAYS,
    steps: [
      { type: 'intro', title: '요일 속 천체 찾기', text: '요일 카드를 눌러 어떤 천체와 이어지는지 봐요.', days: DAYS },
      { type: 'gate', condition: 'members', count: 5, text: '태양계 구성원 다섯 가지를 찾아 눌러 봐요.' },
      {
        type: 'quiz', id: '1-1', start: MAP, lock: ['sunlight'], cue: 'sunlight',
        question: '태양계에서 스스로 빛을 내는 천체는 무엇일까요?',
        options: ['태양', '지구', '달', '목성'],
        answerIndex: 0,
        hint: '태양 빛을 가려 보세요. 그래도 빛나는 천체가 있나요?',
        explanation: '태양은 태양계에서 유일하게 스스로 빛을 내는 천체예요.'
      },
      {
        type: 'quiz', id: '1-2', start: MAP, lock: ['play'], cue: 'play',
        question: '지구처럼 태양의 주위를 도는 천체를 무엇이라고 할까요?',
        options: ['행성', '위성', '별'],
        answerIndex: 0,
        hint: '재생을 누르고 지구가 무엇의 주위를 도는지 봐요.',
        explanation: '지구처럼 태양의 주위를 도는 천체를 행성이라고 해요.'
      },
      {
        type: 'quiz', id: '1-3', start: MAP, lock: [], cue: null,
        question: '달처럼 행성의 주위를 도는 천체를 무엇이라고 할까요?',
        options: ['행성', '위성', '혜성'],
        answerIndex: 1,
        guide: '지구로 날아가 달이 무엇의 주위를 도는지 봐요.',
        explanation: '달처럼 행성 주위를 도는 천체를 위성이라고 해요.'
      },
      {
        type: 'quiz', id: '1-4', start: MAP, lock: ['next'], cue: 'next', memo: 'members',
        question: '태양계의 행성은 모두 몇 개일까요?',
        options: ['5개', '8개', '9개', '12개'],
        answerIndex: 1,
        guide: "'다음 행성' 버튼으로 행성을 하나씩 세어 봐요.",
        explanation: '태양계의 행성은 수성, 금성, 지구, 화성, 목성, 토성, 천왕성, 해왕성으로 8개예요.'
      },
      {
        type: 'summary',
        text: '태양계의 중심에는 [ ]이 있고, 그 주위를 [ ]이 돌아요.',
        options: ['태양 / 행성', '지구 / 태양', '달 / 지구'],
        answerIndex: 0
      },
      { type: 'survey', questions: [funQuestion('흥미1', '오늘 태양계 탐사는 어땠나요?')] }
    ]
  },
  {
    id: 2,
    code: 'MISSION 02',
    name: '행성 탐사와 도감', // 탐사 선택 카드(7장 표)
    desc: '행성 8개에 가까이 가서 관찰하고, 탐사 도감을 채워요.', // 탐사 선택 카드 설명(S02)
    title: '탐사 2 · 행성 탐사',
    view: 'map',
    steps: [
      {
        type: 'gate', condition: 'cards', count: 4, text: '행성 카드를 4장 이상 완성하면 질문이 열려요.',
        // 4장을 채워도 저절로 넘어가지 않는다: 나머지 카드를 더 채우다가 학생이 눌러서 질문으로 간다(docs/결정기록.md 2026-10-11)
        manual: true, readyText: '카드 4장을 완성했어요. 더 채워도 되고, 질문을 풀어도 돼요.', goLabel: '질문 풀기'
      },
      {
        type: 'quiz', id: '2-1', start: JUPITER, lock: ['land'], cue: 'land',
        question: '탐사선을 목성에 착륙시킬 수 있을까요?',
        options: ['착륙할 수 있어요', '착륙할 수 없어요'],
        answerIndex: 1,
        hint: '목성에 내려가 보면서 발을 디딜 땅이 있는지 봐요.',
        explanation: '목성은 표면이 기체로 되어 있어서 내려앉을 땅이 없어요.'
      },
      {
        type: 'quiz', id: '2-2', start: JUPITER, lock: ['land'], cue: 'land',
        question: '표면이 단단한 땅으로 되어 있는 행성끼리 묶은 것은 무엇일까요?',
        options: ['수성·금성·지구·화성', '목성·토성·천왕성·해왕성', '지구·목성·토성·화성'],
        answerIndex: 0,
        guide: '여러 행성에 착륙해 봐요.',
        explanation: '수성, 금성, 지구, 화성은 표면이 단단한 땅으로 되어 있어요. 목성, 토성, 천왕성, 해왕성은 표면이 기체로 되어 있어요.'
      },
      {
        type: 'quiz', id: '2-3', start: { view: 'map', loupe: false }, lock: ['loupe'], cue: 'loupe',
        question: '고리가 있는 행성은 모두 몇 개일까요?',
        options: ['1개', '2개', '4개', '8개'],
        answerIndex: 2,
        hint: '고리가 뚜렷하지 않은 행성도 있어요. 돋보기를 켜고 다시 봐요.',
        explanation: '토성은 뚜렷한 고리, 목성·천왕성·해왕성은 희미한 고리가 있어요.'
      },
      {
        type: 'summary',
        text: '수성·금성·지구·화성은 표면이 [ ]으로, 목성·토성·천왕성·해왕성은 표면이 [ ]로 이루어져 있어요.',
        options: ['단단한 땅 / 기체', '기체 / 단단한 땅', '물 / 얼음'],
        answerIndex: 0
      },
      // 창작 C-1 행성 자기소개 랩: 완성한 카드 하나 → 2~4줄(src/data/rapLines.js)
      { type: 'creative', id: 'C-1', kind: 'rap', title: '행성 자기소개 랩 만들기' },
      { type: 'survey', questions: [funQuestion('흥미2', '오늘 행성 탐사는 어땠나요?')] }
    ]
  },
  {
    id: 3,
    code: 'MISSION 03',
    name: '크기 비교 실험실', // 탐사 선택 카드(7장 표)
    desc: '행성을 실제 크기로 나란히 놓고, 크기 순서대로 줄 세워요.', // 탐사 선택 카드 설명(S02)
    title: '탐사 3 · 크기 비교 실험실',
    view: 'size',
    steps: [
      {
        type: 'quiz', id: '3-1', start: SAME_SIZE, lock: ['real', 'sunCompare'], cue: 'real',
        question: '행성 중에서 크기가 가장 큰 행성은 무엇일까요?',
        options: ['목성', '토성', '지구', '해왕성'],
        answerIndex: 0,
        guide: "'실제 크기로 보기'를 눌러 비교해 봐요.",
        explanation: '목성은 행성 중 크기가 가장 커요.'
      },
      {
        type: 'quiz', id: '3-2', start: SAME_SIZE, lock: ['real', 'sunCompare'], cue: null,
        question: '행성 중에서 크기가 가장 작은 행성은 무엇일까요?',
        options: ['수성', '화성', '금성', '지구'],
        answerIndex: 0,
        explanation: '수성은 행성 중 크기가 가장 작아요.'
      },
      {
        type: 'sort', id: '3-3', start: REAL_SIZE,
        question: '행성을 크기가 큰 순서대로 줄 세워 봐요.',
        hint: '실제 크기로 나란히 놓인 행성을 보며 자리를 바꿔 봐요.'
      },
      {
        type: 'classify', id: '3-4', start: REAL_SIZE,
        question: '지구보다 작은 행성과 큰 행성으로 나누어 담아 봐요.'
      },
      {
        type: 'summary',
        text: '지구보다 큰 행성은 [ ]이고, 지구보다 작은 행성은 [ ]이에요.',
        options: ['목성·토성·천왕성·해왕성 / 금성·화성·수성', '금성·화성·수성 / 목성·토성·천왕성·해왕성', '목성·토성 / 천왕성·해왕성'],
        answerIndex: 0
      },
      { type: 'feel', text: "'태양과 비교하기'를 눌러 봐요.", cue: 'sunCompare' },
      { type: 'survey', questions: [funQuestion('흥미3', '오늘 크기 비교 탐사는 어땠나요?')] }
    ]
  },
  {
    id: 4,
    code: 'MISSION 04',
    name: '북쪽 밤하늘 별자리', // 탐사 선택 카드(7장 표)
    desc: '별을 이어 북두칠성과 카시오페이아자리를 찾고, 북극성을 찾아요.', // 탐사 선택 카드 설명(S02)
    title: '탐사 4 · 북쪽 밤하늘',
    view: 'sky',
    steps: [
      {
        type: 'quiz', id: '4-1', start: SKY_8PM, lock: [], cue: null,
        question: '별과 행성은 어떤 점이 다를까요?',
        options: ['별은 태양처럼 스스로 빛을 내요', '행성은 스스로 빛을 내요', '별과 행성 모두 스스로 빛을 내지 않아요'],
        answerIndex: 0,
        explanation: '별은 행성과 달리 태양처럼 스스로 빛을 내는 천체예요.'
      },
      { type: 'gate', condition: 'constellations', count: 3, text: '별을 이어 북두칠성, 카시오페이아자리, 작은곰자리를 완성해 봐요.' },
      {
        type: 'quiz', id: '4-2', start: SKY_8PM, lock: ['time'], cue: 'time',
        question: '시각이 바뀌어도 북쪽 하늘에서 거의 움직이지 않는 별은 무엇일까요?',
        options: ['북극성', '북두칠성의 끝 별', '카시오페이아자리의 가운데 별'],
        answerIndex: 0,
        hint: '시각 슬라이더를 천천히 움직이면서 제자리에 있는 별을 찾아봐요.',
        explanation: '북극성은 북쪽 하늘에서 거의 움직이지 않는 별이에요.'
      },
      {
        type: 'quiz', id: '4-3', start: SKY_8PM, lock: [], cue: 'names',
        question: '북극성은 어느 별자리에 있을까요?',
        options: ['큰곰자리', '작은곰자리', '카시오페이아자리'],
        answerIndex: 1,
        guide: '이름 보기를 켜고 북극성이 이어진 별자리를 확인해 봐요.',
        explanation: '북극성은 작은곰자리에 있어요. 북두칠성은 큰곰자리에 있어요.'
      },
      {
        type: 'quiz', id: '4-4', start: SKY_8PM, lock: [], cue: null,
        question: '북두칠성과 카시오페이아자리는 각각 어떤 모양처럼 보일까요?',
        options: ['국자 / W 자', 'W 자 / 국자', '세모 / 네모'],
        answerIndex: 0,
        explanation: '북두칠성은 국자 모양, 카시오페이아자리는 M 자 또는 W 자 모양처럼 보여요.'
      },
      {
        type: 'quiz', id: '4-5', start: { ...SKY_8PM, lights: true }, lock: ['lights'], cue: 'lights',
        question: '별을 관찰하기 좋은 곳은 어디일까요?',
        options: ['불빛이 없고 탁 트인 곳', '가로등이 많은 밝은 곳', '높은 건물 사이'],
        answerIndex: 0,
        guide: '주변 불빛을 껐다 켰다 하며 보이는 별의 수를 비교해 봐요.',
        explanation: '주변에 불빛이 없고 탁 트인 곳에서 별이 더 잘 보여요.'
      },
      {
        type: 'quiz', id: '4-6', start: SKY_8PM, lock: [], cue: null,
        question: '밤바다에서 나침반을 잃어버린 선장이 북쪽을 찾으려면 무엇을 찾아야 할까요?',
        options: ['북극성', '가장 밝은 별', '달'],
        answerIndex: 0,
        explanation: '북극성은 북쪽 하늘에서 거의 움직이지 않아서, 북극성이 있는 쪽이 북쪽이에요.'
      },
      {
        type: 'summary',
        text: '북쪽 하늘에서 거의 움직이지 않는 별은 [ ]이고, [ ]에 있어요.',
        options: ['북극성 / 작은곰자리', '북극성 / 큰곰자리', '북두칠성 / 작은곰자리'],
        answerIndex: 0
      },
      // 창작 C-2 새 별자리 이름 붙이기(9-5 보기 그대로)
      {
        type: 'creative', id: 'C-2', kind: 'constellation', title: '새 별자리 이름 붙이기',
        constellations: CONSTELLATIONS.map((c) => ({ id: c.id, name: c.name })),
        blanks: [
          { text: '이 별자리의 새 이름은 [ ]자리예요.', options: ['숟가락', '미끄럼틀', '번개', '왕관', '연', '물고기', '산', '꼬리별'] },
          { text: '왜냐하면 [ ] 모양처럼 보이기 때문이에요.', options: ['길게 이어진', '지그재그', '손잡이가 달린', '꺾어진', '뾰족뾰족한'] }
        ]
      },
      {
        type: 'survey',
        questions: [
          funQuestion('흥미4', '오늘 밤하늘 탐사는 어땠나요?'),
          { id: '흥미5', text: '오늘 밤에 실제 북쪽 하늘에서 북극성을 찾아보고 싶나요?', options: ['예', '아니요'] }
        ]
      }
    ]
  }
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id) ?? null;
