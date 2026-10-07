// 끌어다 놓기 판정(기획서 9-4 문항 3-3 줄 세우기, 3-4 나누어 담기). DOM과 분리한 순수 모듈.
//   확인 → 맞으면 통과, 틀리면 틀린 카드만 표시하고 한 번 더. 2차도 틀리면 정답 배치로 바꾼다.
//   처음 배치와 최종 배치를 기록용 글자로 내보낸다(기획서 10-3).
import { bodyById } from './world.js';
import { SIZE_ORDER, SMALLER_THAN_EARTH, LARGER_THAN_EARTH } from './sizes.js';

const nameOf = (id) => bodyById(id).name;

// 줄 세우기: placed는 자리 순서대로의 행성 id(빈자리는 null). 틀린 자리 번호(0부터) 목록을 돌려준다.
export function judgeOrder(placed, answer = SIZE_ORDER) {
  const wrong = answer.map((id, i) => (placed[i] === id ? null : i)).filter((i) => i !== null);
  return { correct: wrong.length === 0, wrong };
}

// 나누어 담기: groups = { small: [...], large: [...] }. 잘못 담긴(또는 담지 않은) 행성 id 목록을 돌려준다.
export function judgeGroups(groups, answer = { small: SMALLER_THAN_EARTH, large: LARGER_THAN_EARTH }) {
  const wrong = [];
  for (const key of ['small', 'large']) {
    for (const id of groups[key]) if (!answer[key].includes(id)) wrong.push(id);
  }
  for (const id of [...answer.small, ...answer.large]) {
    if (!groups.small.includes(id) && !groups.large.includes(id)) wrong.push(id);
  }
  return { correct: wrong.length === 0, wrong };
}

// 기록용 글자. 줄 세우기 '목성>토성>…', 나누어 담기 '작은: 금성, 화성, 수성 / 큰: 목성, 토성, 천왕성, 해왕성'
export const orderText = (placed) => placed.map((id) => (id ? nameOf(id) : '')).join('>');
export const groupsText = ({ small, large }) => `작은: ${small.map(nameOf).join(', ')} / 큰: ${large.map(nameOf).join(', ')}`;

export const ARRANGE_ANSWERS = {
  sort: SIZE_ORDER,
  classify: { small: SMALLER_THAN_EARTH, large: LARGER_THAN_EARTH }
};

// kind: 'sort' | 'classify'
export function createArrangeTask(kind) {
  const judge = kind === 'sort' ? judgeOrder : judgeGroups;
  const text = kind === 'sort' ? orderText : groupsText;
  let attempts = 0;
  let first = null;
  let done = false;

  return {
    kind,
    // 모든 카드를 놓았는지(줄 세우기 8칸, 나누어 담기 7장)
    isComplete(arrangement) {
      if (kind === 'sort') return arrangement.length === SIZE_ORDER.length && arrangement.every(Boolean);
      return arrangement.small.length + arrangement.large.length === SMALLER_THAN_EARTH.length + LARGER_THAN_EARTH.length;
    },
    // 'correct' | 'retry' | 'revealed'. 끝나면 record에 처음·최종 배치가 담긴다.
    check(arrangement) {
      if (done || !this.isComplete(arrangement)) return null;
      const { correct, wrong } = judge(arrangement);
      attempts += 1;
      if (attempts === 1) first = text(arrangement);
      let result = 'retry';
      if (correct) result = 'correct';
      else if (attempts >= 2) result = 'revealed';
      if (result !== 'retry') done = true;
      const record = done ? { kind, first, final: text(arrangement), correct, attempts } : null;
      return { result, wrong, record };
    },
    isDone: () => done,
    answer: ARRANGE_ANSWERS[kind]
  };
}
