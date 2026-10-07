// 탐사 도감 행성 카드의 칸·보기·정답(기획서 8-2, 8-3)과 카드에 쓰는 교과서 문장·힌트(docs/결정기록.md 2026-10-08).
// 보기 값은 화면 글자 그대로 쓴다(결과 행에도 같은 글자가 기록된다).

// 색깔 보기와 색 견본(components.css의 .sv-swatch--*). 색 견본은 글자와 함께만 보여 준다.
export const COLOR_OPTIONS = [
  { label: '회색', swatch: 'gray' },
  { label: '노란색', swatch: 'yellow' },
  { label: '파란색 바다와 초록·갈색 땅', swatch: 'earth' },
  { label: '붉은색', swatch: 'red' },
  { label: '흰색과 갈색 줄무늬', swatch: 'stripe' },
  { label: '연한 갈색', swatch: 'tan' },
  { label: '청록색', swatch: 'teal' },
  { label: '파란색', swatch: 'blue' }
];

export const SURFACE_OPTIONS = ['단단한 땅', '기체'];
export const RING_OPTIONS = ['뚜렷한 고리가 있어요', '희미한 고리가 있어요', '고리가 없어요'];
export const FEATURE_OPTIONS = [
  '충돌 구덩이가 많아요',
  '표면이 얼룩져 보여요',
  '바다와 육지가 있어요',
  '줄무늬가 있어요',
  '행성 중 가장 커요',
  '행성 중 가장 작아요'
];

// 칸 순서. multi: 여러 개 고르기(고르지 않아도 됨)
export const FIELDS = [
  { id: 'color', title: '색깔', options: COLOR_OPTIONS.map((o) => o.label), multi: false },
  { id: 'surface', title: '표면 상태', options: SURFACE_OPTIONS, multi: false },
  { id: 'ring', title: '고리', options: RING_OPTIONS, multi: false },
  { id: 'features', title: '그 밖의 특징', options: FEATURE_OPTIONS, multi: true }
];

const NONE = '고리가 없어요';
const FAINT = '희미한 고리가 있어요';

// 기획서 8-3 행성별 정답. 수성 회색·목성 흰색과 갈색 줄무늬는 교사 확정(17장 1번).
export const ANSWERS = {
  mercury: { color: '회색', surface: '단단한 땅', ring: NONE, features: ['충돌 구덩이가 많아요', '행성 중 가장 작아요'] },
  venus: { color: '노란색', surface: '단단한 땅', ring: NONE, features: ['표면이 얼룩져 보여요'] },
  earth: { color: '파란색 바다와 초록·갈색 땅', surface: '단단한 땅', ring: NONE, features: ['바다와 육지가 있어요'] },
  mars: { color: '붉은색', surface: '단단한 땅', ring: NONE, features: [] },
  jupiter: { color: '흰색과 갈색 줄무늬', surface: '기체', ring: FAINT, features: ['줄무늬가 있어요', '행성 중 가장 커요'] },
  saturn: { color: '연한 갈색', surface: '기체', ring: '뚜렷한 고리가 있어요', features: [] },
  uranus: { color: '청록색', surface: '기체', ring: FAINT, features: [] },
  neptune: { color: '파란색', surface: '기체', ring: FAINT, features: [] }
};

// 카드가 완성되면 나타나는 교과서 문장(4-3 표 서술 기준)
export const FACTS = {
  mercury: '수성은 충돌 구덩이가 많고, 행성 중 크기가 가장 작아요.',
  venus: '금성은 노란색을 띠고, 표면이 얼룩진 것처럼 보여요.',
  earth: '지구는 파란색을 띠는 바다와 초록색·갈색을 띠는 육지가 있어요.',
  mars: '화성은 전체적으로 붉게 보여요.',
  jupiter: '목성은 줄무늬가 있고, 행성 중 크기가 가장 커요.',
  saturn: '토성은 연한 갈색을 띠고, 뚜렷한 고리가 있어요.',
  uranus: '천왕성은 청록색을 띠고, 희미한 고리가 있어요.',
  neptune: '해왕성은 파란색을 띠고, 희미한 고리가 있어요.'
};

// 틀린 칸 힌트(정답은 알려 주지 않는다)
export const HINTS = {
  color: '행성을 돌려 가며 색깔을 다시 살펴봐요.',
  surface: '착륙해 보면 표면이 어떤지 알 수 있어요.',
  ring: '고리 찾기 돋보기를 켜 봐요.',
  features: '이 행성과 맞지 않는 특징이 있어요. 다시 살펴봐요.'
};

// 태양 카드(기획서 8-1)
export const SUN_FACTS = ['스스로 빛을 내요', '태양계의 중심에 있어요'];
export const SUN_LOCKED_TEXT = '탐사 1을 마치고 태양을 가까이 보면 채워져요.';

export const swatchOf = (label) => COLOR_OPTIONS.find((o) => o.label === label)?.swatch;
