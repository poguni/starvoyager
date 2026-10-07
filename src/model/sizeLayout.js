// 크기 비교 실험실의 행성 줄 배치(화면 픽셀 단위). 장면 코드와 분리해 크기 비율을 테스트한다.
//   real: 0이면 모두 같은 크기, 1이면 실제 크기 비율(15장). 사이 값은 부드럽게 바뀌는 중.
//   sun:  0이면 태양 없음, 1이면 화면 왼쪽에 태양 가장자리가 들어온 상태(행성은 실제 크기, 조금 작게).
// 행성은 태양에서 가까운 순서로 한 줄에 놓고(S07), 거리는 무시한다.
import { PLANETS, SIZE_RATIO } from './world.js';

const ORDER = PLANETS.map((p) => p.id);
const SATURN_RING = 4.6; // 토성은 고리까지의 가로 폭(행성 반지름 배수)
const SUN_ARC = 0.24;    // 태양과 비교할 때 태양이 들어오는 폭(줄 영역 폭 비율)
const EQUAL_FILL = 0.62; // 같은 크기일 때 줄 높이에서 행성이 차지하는 비율

const lerp = (a, b, t) => a + (b - a) * t;

// 폭이 좁으면(크롬북에서 태양과 비교할 때 등) 행성 사이 간격을 줄여 행성 몫(폭의 약 45%)을 남긴다.
const gapFor = (W, labelW, gap) => Math.max(4, Math.min(gap, (W * 0.55 - ORDER.length * labelW) / (ORDER.length - 1)));

function rowWidth(radii, labelW, gap) {
  return ORDER.reduce((sum, id, i) => sum + Math.max(id === 'saturn' ? radii[i] * SATURN_RING : radii[i] * 2, labelW), 0)
    + gap * (ORDER.length - 1);
}

// fits(x)가 참인 가장 큰 x(0~hi)
function largest(fits, hi) {
  let lo = 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

// 지구 반지름(px): 실제 크기 비율로 폭 W, 높이 H 안에 들어가는 가장 큰 값
function realScale(W, H, labelW, labelH, gap) {
  const maxRatio = Math.max(...ORDER.map((id) => SIZE_RATIO[id]));
  return largest((s) => rowWidth(ORDER.map((id) => SIZE_RATIO[id] * s), labelW, gap) <= W && maxRatio * s * 2 <= H - labelH, H);
}

function equalRadius(W, H, labelW, labelH, gap) {
  return largest((r) => rowWidth(ORDER.map(() => r), labelW, gap) <= W && r * 2 <= (H - labelH) * EQUAL_FILL, H);
}

// region: { left, right, top, bottom } 행성 줄을 놓을 화면 영역
export function sizeLayout({ region, real, sun = 0, labelW = 84, labelH = 64, gap: maxGap = 44 }) {
  const W = region.right - region.left;
  const H = region.bottom - region.top;
  const g = gapFor(W, labelW, maxGap);
  const rEq = equalRadius(W, H, labelW, labelH, g);
  const sReal = realScale(W, H, labelW, labelH, g);
  const arc = W * SUN_ARC;
  const sunW = W - arc - g * 2;
  const gSun = gapFor(sunW, labelW, maxGap);
  const sSun = realScale(sunW, H, labelW, labelH, gSun);
  const gap = lerp(g, gSun, sun);
  const s = lerp(sReal, sSun, sun);
  const radii = ORDER.map((id) => lerp(rEq, SIZE_RATIO[id] * s, real));

  const left = region.left + (arc + g * 2) * sun;
  const total = rowWidth(radii, labelW, gap);
  const cy = region.top + (H - labelH) / 2;
  let x = left + (region.right - left - total) / 2;
  const items = ORDER.map((id, i) => {
    const w = Math.max(id === 'saturn' ? radii[i] * SATURN_RING : radii[i] * 2, labelW);
    const item = { id, r: radii[i], x: x + w / 2, y: cy };
    x += w + gap;
    return item;
  });

  // 태양: 실제 비율(지구의 109배) 그대로. 왼쪽 밖에서 들어와 가장자리만 보인다.
  const R = SIZE_RATIO.sun * sSun;
  const sunX = lerp(region.left - R - g * 4, region.left + arc - R, sun);
  return { items, sun: { r: R, x: sunX, y: cy, edge: sunX + R }, earthRadius: s, equalRadius: rEq };
}
