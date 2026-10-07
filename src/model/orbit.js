// 시각(초) → 천체 위치. 궤도는 모두 같은 평면(y = 0)의 원이다(기획서 12장). 혜성만 기울어진 타원.
// 좌표: x·z가 궤도면, y가 위쪽. 태양이 원점.

// 원 궤도: 반지름 r, 주기 period(초), 처음 각도 phase. 위에서 볼 때 반시계 방향으로 돈다.
export function circularPosition({ orbitRadius, period, phase = 0 }, t) {
  const angle = phase + (2 * Math.PI * t) / period;
  return { x: orbitRadius * Math.cos(angle), y: 0, z: -orbitRadius * Math.sin(angle) };
}

// 케플러 방정식 M = E − e·sin E 를 뉴턴 방법으로 푼다.
function eccentricAnomaly(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

// 혜성의 타원 궤도. 태양 가까이에서 빨라지고 멀리서 느려진다(보기 좋게 보여 주기 위한 정도).
export function cometPosition({ a, e, tilt, rot, period, phase = 0 }, t) {
  const M = ((phase + (2 * Math.PI * t) / period) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const E = eccentricAnomaly(M, e);
  const px = a * (Math.cos(E) - e);            // 근일점 방향 축
  const pz = a * Math.sqrt(1 - e * e) * Math.sin(E);
  // 궤도면 안에서 rot만큼 돌리고, x축 둘레로 tilt만큼 기울인다.
  const x1 = px * Math.cos(rot) - pz * Math.sin(rot);
  const z1 = px * Math.sin(rot) + pz * Math.cos(rot);
  return { x: x1, y: -z1 * Math.sin(tilt), z: z1 * Math.cos(tilt) };
}

// 달: 지구 위치를 중심으로 도는 원.
export function moonPosition(moon, earthPos, t) {
  const p = circularPosition(moon, t);
  return { x: earthPos.x + p.x, y: earthPos.y, z: earthPos.z + p.z };
}

export function distance(p) {
  return Math.hypot(p.x, p.y, p.z);
}
