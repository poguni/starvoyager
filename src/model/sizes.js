// 행성 크기 비교(기획서 15장, 지구 = 1, 반지름 기준). 크기 순서와 지구보다 작은/큰 행성은 이 값에서 계산한다.
import { PLANETS, SIZE_RATIO } from './world.js';

const PLANET_IDS = PLANETS.map((p) => p.id);

export const sizeOf = (id) => SIZE_RATIO[id];

// 크기가 큰 순서(목성 > 토성 > … > 수성)
export const SIZE_ORDER = [...PLANET_IDS].sort((a, b) => SIZE_RATIO[b] - SIZE_RATIO[a]);

// 지구보다 작은/큰 행성(크기가 큰 순서)
export const SMALLER_THAN_EARTH = SIZE_ORDER.filter((id) => SIZE_RATIO[id] < SIZE_RATIO.earth);
export const LARGER_THAN_EARTH = SIZE_ORDER.filter((id) => SIZE_RATIO[id] > SIZE_RATIO.earth);

// 화면에 쓰는 쉬운 수: 1보다 작으면 소수 한 자리, 1 이상이면 정수(docs/결정기록.md 2026-10-08)
export function easyTimes(ratio) {
  const one = Math.round(ratio * 10) / 10;
  return one < 1 ? one.toFixed(1) : String(Math.round(ratio));
}

// 지구 기준 "약 ○배"(지구는 "기준")
export const timesLabel = (id) => (id === 'earth' ? '기준' : `약 ${easyTimes(SIZE_RATIO[id])}배`);
