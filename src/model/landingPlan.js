// 착륙 연출의 시간표(motion.md '착륙'). 장면 코드와 분리해 길이와 순서를 테스트한다.
//   단단한 땅: 다가가기 → 내려가기(합 약 6초) → 착륙 배너 2초 → '다시 올라가기' 버튼
//              금성은 내려가는 중간 2초 동안 노란 구름을 지난다.
//   기체:      다가가기 → 내려가기(합 약 8초) → 멈칫 → 배너와 함께 3초 동안 자동으로 올라오기
// 한 번의 연출은 12초를 넘지 않는다.
export const APPROACH = 1.2;

export function landingPlan(surface, planetId) {
  if (surface === 'solid') {
    const descendEnd = 6;
    const plan = {
      surface,
      steps: [
        { name: 'approach', start: 0, end: APPROACH },
        { name: 'descend', start: APPROACH, end: descendEnd },
        { name: 'banner', start: descendEnd, end: descendEnd + 2 }
      ],
      total: descendEnd + 2,
      clouds: null
    };
    if (planetId === 'venus') {
      const mid = (APPROACH + descendEnd) / 2;
      plan.clouds = { start: mid - 1, end: mid + 1 }; // 내려가는 중간 2초
    }
    return plan;
  }
  const descendEnd = 8;
  const holdEnd = descendEnd + 0.6;
  return {
    surface,
    steps: [
      { name: 'approach', start: 0, end: APPROACH },
      { name: 'descend', start: APPROACH, end: descendEnd },
      { name: 'hold', start: descendEnd, end: holdEnd },
      { name: 'ascend', start: holdEnd, end: holdEnd + 3 }
    ],
    total: holdEnd + 3,
    clouds: { start: APPROACH, end: descendEnd }
  };
}

// 시각 t(초)에 어떤 단계인지와 그 단계 안에서의 진행(0~1)
export function stepAt(plan, t) {
  for (const s of plan.steps) {
    if (t < s.end) return { name: s.name, k: Math.max(0, (t - s.start) / (s.end - s.start)) };
  }
  return { name: 'done', k: 1 };
}
