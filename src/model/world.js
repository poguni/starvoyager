// 태양계 지도의 천체 목록(기획서 5-3 ①, 15장). DOM·Three.js와 분리된 순수 데이터.
// 크기와 거리는 한눈에 보이도록 조정한 모형 값이다(기획서 12장 '의도적 단순화').
//   - 표시 반지름 = √(실제 크기 비). 줄였지만 크기 순서는 실제와 같다(docs/결정기록.md 2026-10-07).
//   - 공전 주기(초, 빠르기 ×1 기준) = 40 × √(실제 공전 주기(년)). 바깥 행성일수록 느리다(과장, 평가하지 않음).

// 기획서 15장: 지구 = 1인 반지름 비
export const SIZE_RATIO = {
  sun: 109, mercury: 0.38, venus: 0.95, earth: 1, mars: 0.53,
  jupiter: 11.2, saturn: 9.4, uranus: 4.0, neptune: 3.9
};

// 실제 공전 주기(년). 화면 속도를 정할 때만 쓴다.
const ORBIT_YEARS = {
  mercury: 0.24, venus: 0.62, earth: 1, mars: 1.88,
  jupiter: 11.86, saturn: 29.46, uranus: 84.0, neptune: 164.8
};

// 자전축 기울기(도). 보기 좋은 정도로만 쓰고 학습 내용으로 다루지 않는다(기획서 12장).
// 천왕성은 거의 누워 있어 고리도 세로에 가깝게 보인다. 금성은 거꾸로 도는 것(177°)을 3°로 단순화했다.
const TILT_DEG = {
  sun: 7, mercury: 0, venus: 3, earth: 23.4, mars: 25.2,
  jupiter: 3.1, saturn: 26.7, uranus: 97.8, neptune: 28.3
};

const displayRadius = (id) => Math.sqrt(SIZE_RATIO[id]);
const orbitSeconds = (years) => 40 * Math.sqrt(years);

function planet(id, name, orbitRadius, phase) {
  return {
    id, name, kind: 'planet', accent: id, tilt: TILT_DEG[id],
    radius: displayRadius(id), orbitRadius, period: orbitSeconds(ORBIT_YEARS[id]), phase
  };
}

// 태양에서 가까운 순서(기획서 15장). phase는 처음 위치(라디안). 처음 화면(S03)에서 행성이 태양 오른쪽으로 펼쳐 보이게 정했다.
export const SUN = { id: 'sun', name: '태양', kind: 'sun', accent: 'sun', tilt: TILT_DEG.sun, radius: displayRadius('sun') };

export const PLANETS = [
  planet('mercury', '수성', 21, 0.9),
  planet('venus', '금성', 28, 0.2),
  planet('earth', '지구', 35, 0.95),
  planet('mars', '화성', 42, 0.38),
  planet('jupiter', '목성', 66, -0.28),
  planet('saturn', '토성', 82, 0.3),
  planet('uranus', '천왕성', 96, -0.16),
  planet('neptune', '해왕성', 109, 0.17)
];

// 달(지구의 위성). 지구를 중심으로 돈다.
export const MOON = {
  id: 'moon', name: '달', kind: 'moon', parent: 'earth',
  radius: Math.sqrt(0.27), orbitRadius: 2.6, period: 6, phase: 0
};

// 혜성 1개: 태양을 한 초점으로 하는 긴 타원 궤도(a: 긴반지름, e: 이심률, tilt: 궤도 기울기, rot: 근일점 방향).
export const COMET = {
  id: 'comet', name: '혜성', kind: 'comet',
  radius: 0.35, a: 72, e: 0.8, tilt: 0.28, rot: 2.2, period: 160, phase: 0.55
};

// 화성과 목성 사이 소행성 띠
export const ASTEROID_BELT = {
  id: 'asteroids', name: '소행성', kind: 'asteroid',
  inner: 49, outer: 57, count: 1500, period: 240
};

// 누를 수 있는 천체 전체(태양 → 행성 → 달 → 혜성 → 소행성)
export const BODIES = [SUN, ...PLANETS, MOON, COMET, ASTEROID_BELT];

export function bodyById(id) {
  return BODIES.find((b) => b.id === id) ?? null;
}

// 행성 탐사 화면을 여는 천체(태양 + 행성 8개). 달·혜성·소행성은 따라가며 보기만 한다(docs/결정기록.md).
export function isExplorable(id) {
  return id === 'sun' || PLANETS.some((p) => p.id === id);
}

// 이전/다음 행성: 행성 8개만 태양에서 가까운 순서로 돈다. 태양에서 '다음'은 수성, 끝에서는 멈춘다(null).
export function planetNeighbors(id) {
  if (id === 'sun') return { prev: null, next: PLANETS[0].id };
  const i = PLANETS.findIndex((p) => p.id === id);
  if (i < 0) return { prev: null, next: null };
  return { prev: PLANETS[i - 1]?.id ?? null, next: PLANETS[i + 1]?.id ?? null };
}
