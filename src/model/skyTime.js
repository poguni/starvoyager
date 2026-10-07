// 북쪽 밤하늘 시각 슬라이더(기획서 5-3 ⑤): 저녁 6시 ~ 다음 날 아침 6시, 내부 값 18~30, 30분 단위.
// 표기(docs/결정기록.md 2026-10-08): 저녁 6~8시, 밤 9~11시, 밤 12시, 새벽 1~4시, 아침 5~6시.
export const TIME_MIN = 18;
export const TIME_MAX = 30;
export const TIME_STEP = 0.5;
export const TIME_DEFAULT = 20;

export const clampTime = (h) => Math.min(TIME_MAX, Math.max(TIME_MIN, Math.round(h / TIME_STEP) * TIME_STEP));

export function timeLabel(h) {
  const t = clampTime(h);
  const whole = Math.floor(t);
  const half = t - whole >= 0.5 ? ' 30분' : '';
  const clock = whole % 24;
  let part;
  if (whole <= 20) part = '저녁';
  else if (whole <= 24) part = '밤';
  else if (whole <= 28) part = '새벽';
  else part = '아침';
  const shown = clock === 0 ? 12 : clock > 12 ? clock - 12 : clock;
  return `${part} ${shown}시${half}`;
}
