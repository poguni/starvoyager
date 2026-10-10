import { describe, expect, it } from 'vitest';
import { createMissionEngine, fillSentence, ROW_KEYS } from './engine.js';
import { createArrangeTask, ARRANGE_ANSWERS } from '../model/arrange.js';

// 엔진 로직만 검증하는 작은 가짜 탐사(실제 문구 대조는 missions.test.js에서 한다).
function fixture() {
  return {
    id: 2,
    days: [{ id: 'mon' }, { id: 'tue' }],
    memberLabels: { sun: '태양', planet: '행성' },
    steps: [
      { type: 'intro', days: [{ id: 'mon' }, { id: 'tue' }] },
      { type: 'gate', condition: 'cards', count: 2 },
      { type: 'quiz', id: 'a-1', options: ['x', 'y'], answerIndex: 1, hint: 'hint1', explanation: 'exp1' },
      { type: 'quiz', id: 'a-2', options: ['x', 'y', 'z'], answerIndex: 0, guide: 'guide2', explanation: 'exp2', memo: 'members' },
      { type: 'summary', text: '[ ]은 [ ]이에요.', options: ['가 / 나', '다 / 라'], answerIndex: 0 },
      { type: 'gate', condition: 'constellations', count: 3 },
      { type: 'sort', id: 's-1' },
      { type: 'feel' },
      { type: 'creative', id: 'C-1' },
      { type: 'survey', questions: [{ id: '흥미4', options: ['좋아요', '보통'] }, { id: '흥미5', options: ['예', '아니요'] }] }
    ]
  };
}

function clock() {
  let t = 0;
  return { now: () => t, add: (s) => { t += s * 1000; } };
}

// 도입과 탐색을 지나 첫 문항까지
function toFirstItem(engine) {
  engine.start();
  engine.next(); // 도입 '다음'
  engine.report('cards', 2);
}

describe('예측 → (오답일 때만) 확인 → 최종 답', () => {
  it('예측이 정답이면 확인 단계 없이 결과(정답이에요)로 가고, 다음을 누르면 다음 문항', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    expect(engine.getState().stage).toBe('predict');
    engine.submitPredict(1);
    let s = engine.getState();
    expect(s.stage).toBe('result');
    expect(s.lastFeedback).toMatchObject({ stage: 'final', correct: true, firstCorrect: true, message: 'exp1' });
    expect(s.results.at(-1)).toMatchObject({ 문항: 'a-1', 처음예측: 'y', 예측정답여부: true, 최종답: 'y', 최종정답여부: true });
    engine.next();
    s = engine.getState();
    expect(s.stage).toBe('predict');
    expect(s.step.id).toBe('a-2');
    expect(s.lastFeedback).toBeNull();
  });

  it('예측 오답 → 힌트가 오고 확인 단계 → 최종 정답', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    engine.submitPredict(0);
    let s = engine.getState();
    expect(s.stage).toBe('confirm');
    expect(s.lastFeedback).toMatchObject({ stage: 'predict', correct: false, message: 'hint1', choiceIndex: 0 });
    engine.submitFinal(1);
    s = engine.getState();
    expect(s.stage).toBe('result');
    expect(s.lastFeedback).toMatchObject({ correct: true, firstCorrect: false, choiceIndex: 1, firstChoiceIndex: 0 });
    expect(s.results.at(-1)).toMatchObject({ 처음예측: 'x', 예측정답여부: false, 최종답: 'y', 최종정답여부: true });
  });

  it('힌트가 없는 문항은 확인 방법(guide)을 안내로 쓴다', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    engine.submitPredict(1);
    engine.next();
    engine.submitPredict(2);
    expect(engine.getState().lastFeedback.message).toBe('guide2');
  });

  it('두 번째도 오답이면 정답을 공개한다', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    engine.submitPredict(0);
    engine.submitFinal(0);
    const s = engine.getState();
    expect(s.lastFeedback).toMatchObject({ correct: false, correctText: 'y' });
    expect(s.results.at(-1)).toMatchObject({ 최종정답여부: false });
  });

  it('확인 단계에서는 예측을, 예측 단계에서는 최종 답을 받지 않는다(중복 제출 방어)', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    engine.submitFinal(1);
    expect(engine.getState().stage).toBe('predict');
    engine.submitPredict(0);
    engine.submitPredict(1);
    expect(engine.getState().stage).toBe('confirm');
    expect(engine.getState().results).toHaveLength(0);
  });

  it('결과 단계의 정답 배너는 다음을 누르기 전까지 남아 있다(lastFeedback, 달빛 관측소 6-2)', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    engine.submitPredict(1);
    engine.report('constellations', 1); // 다른 신호가 와도
    expect(engine.getState().lastFeedback).toMatchObject({ correct: true });
  });
});

describe('탐색 게이트(조건 이름과 필요한 개수)', () => {
  it('조건을 채우기 전에는 질문이 열리지 않고, 채우면 gateOpened와 함께 열린다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.next();
    expect(engine.getState().stage).toBe('gate');
    engine.report('cards', 1);
    expect(engine.getState().stage).toBe('gate');
    engine.report('members', 9); // 다른 조건은 상관없다
    expect(engine.getState().stage).toBe('gate');
    engine.report('cards', 2);
    expect(engine.getState()).toMatchObject({ stage: 'predict', gateOpened: true });
  });

  it('이미 채운 조건(저장된 진행)이면 탐색을 건너뛴다', () => {
    const engine = createMissionEngine(fixture());
    engine.report('cards', 4);
    engine.start();
    engine.next();
    expect(engine.getState()).toMatchObject({ stage: 'predict', gateOpened: false });
  });

  it('문항 사이의 게이트도 된다(탐사 4: 4-1 → 별자리 3개 → 4-2)', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    engine.submitPredict(1); engine.next();
    engine.submitPredict(0); engine.next();
    engine.submitSummary(0); engine.next();
    expect(engine.getState().stage).toBe('gate');
    engine.report('constellations', 3);
    expect(engine.getState().stage).toBe('arrange');
  });
});

describe('직접 여는 탐색 게이트(manual, 탐사 2 도감)', () => {
  const manualFixture = () => {
    const m = fixture();
    m.steps[1] = { ...m.steps[1], manual: true };
    return m;
  };

  it('조건을 채워도 저절로 넘어가지 않고 gateReady만 켜진다. openGate를 하면 질문이 열린다', () => {
    const engine = createMissionEngine(manualFixture());
    engine.start();
    engine.next();
    engine.report('cards', 1);
    expect(engine.getState()).toMatchObject({ stage: 'gate', gateReady: false });
    engine.openGate(); // 아직 조건 미달: 열리지 않는다
    expect(engine.getState().stage).toBe('gate');
    engine.report('cards', 2);
    expect(engine.getState()).toMatchObject({ stage: 'gate', gateReady: true });
    engine.report('cards', 5); // 더 채워도 머문다
    expect(engine.getState()).toMatchObject({ stage: 'gate', gateReady: true });
    engine.openGate();
    expect(engine.getState()).toMatchObject({ stage: 'predict', gateOpened: false });
  });

  it('이미 채운 조건이어도 건너뛰지 않고 게이트에서 시작한다(끝낸 탐사에 다시 들어올 때)', () => {
    const engine = createMissionEngine(manualFixture());
    engine.report('cards', 8);
    engine.start();
    engine.next();
    expect(engine.getState()).toMatchObject({ stage: 'gate', gateReady: true, resumeIndex: 1 });
  });

  it('manual이 아닌 게이트에서는 openGate가 아무것도 하지 않는다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.next();
    engine.openGate();
    expect(engine.getState().stage).toBe('gate');
  });
});

describe('요일 도입과 1-4 메모', () => {
  it('요일 카드를 모두 누르면 완료, 구성원 목록과 함께 메모에 남는다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.pressDay('mon');
    engine.pressDay('mon');
    engine.pressDay('tue');
    expect(engine.getState().days).toEqual(['mon', 'tue']);
    engine.next();
    engine.report('members', 2, ['sun', 'planet']);
    engine.report('cards', 2);
    engine.submitPredict(1); engine.next();
    engine.submitPredict(0);
    expect(engine.getState().results.at(-1).메모).toBe('구성원: 태양, 행성 / 요일 도입: 완료');
  });

  it('요일 카드를 덜 눌러도 다음으로 갈 수 있고 미완료로 남는다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.pressDay('mon');
    engine.next();
    engine.report('cards', 2);
    engine.submitPredict(1); engine.next();
    engine.submitPredict(0);
    expect(engine.getState().results.at(-1).메모).toBe('구성원:  / 요일 도입: 미완료');
  });
});

describe('한 줄 정리', () => {
  it('완성 문장이 마지막 문항 행에 붙고, 그때 그 행이 완성 행으로 나간다', () => {
    const engine = createMissionEngine(fixture());
    const rows = [];
    engine.onRow((r) => rows.push(r));
    toFirstItem(engine);
    engine.submitPredict(1); engine.next();
    expect(rows.map((r) => r.문항)).toEqual(['a-1']);
    engine.submitPredict(0); engine.next();
    expect(engine.getState().stage).toBe('summary');
    expect(rows.map((r) => r.문항)).toEqual(['a-1']); // a-2는 한 줄 정리를 기다린다
    engine.submitSummary(1);
    const s = engine.getState();
    expect(s.stage).toBe('summaryResult');
    expect(s.lastFeedback).toMatchObject({ stage: 'summary', correct: false, chosen: '다은 라이에요.', answer: '가은 나이에요.' });
    expect(rows.at(-1)).toMatchObject({ 문항: 'a-2', 한줄정리: '다은 라이에요.', 한줄정리정답여부: false });
    expect(s.results[0].한줄정리).toBeNull();
  });

  it('빈칸 채우기', () => {
    expect(fillSentence('태양계의 중심에는 [ ]이 있고, 그 주위를 [ ]이 돌아요.', '태양 / 행성')).toBe('태양계의 중심에는 태양이 있고, 그 주위를 행성이 돌아요.');
  });
});

describe('줄 세우기·나누어 담기(arrange.js 기록)', () => {
  function toSort(engine) {
    toFirstItem(engine);
    engine.submitPredict(1); engine.next();
    engine.submitPredict(0); engine.next();
    engine.submitSummary(0); engine.next();
    engine.report('constellations', 3);
  }

  it('처음에 맞으면 예측 정답, 처음·최종 배치 글자가 기록된다', () => {
    const engine = createMissionEngine(fixture());
    toSort(engine);
    const task = createArrangeTask('sort');
    const { record } = task.check([...ARRANGE_ANSWERS.sort]);
    engine.submitArrange(record);
    expect(engine.getState().results.at(-1)).toMatchObject({
      문항: 's-1', 처음예측: '목성>토성>천왕성>해왕성>지구>금성>화성>수성', 예측정답여부: true, 최종정답여부: true
    });
    expect(engine.getState().stage).toBe('result');
  });

  it('처음에 틀리고 두 번째에 맞으면 예측 오답·최종 정답', () => {
    const engine = createMissionEngine(fixture());
    toSort(engine);
    const task = createArrangeTask('sort');
    const wrong = [...ARRANGE_ANSWERS.sort];
    [wrong[2], wrong[3]] = [wrong[3], wrong[2]];
    expect(task.check(wrong).result).toBe('retry');
    const { record } = task.check([...ARRANGE_ANSWERS.sort]);
    engine.submitArrange(record);
    expect(engine.getState().results.at(-1)).toMatchObject({
      처음예측: '목성>토성>해왕성>천왕성>지구>금성>화성>수성', 예측정답여부: false,
      최종답: '목성>토성>천왕성>해왕성>지구>금성>화성>수성', 최종정답여부: true
    });
  });
});

describe('보고 느끼기 · 창작 · 흥미 체크', () => {
  function toFeel(engine) {
    toFirstItem(engine);
    engine.submitPredict(1); engine.next();
    engine.submitPredict(0); engine.next();
    engine.submitSummary(0); engine.next();
    engine.report('constellations', 3);
    engine.submitArrange({ first: 'a', final: 'a', correct: true, attempts: 1 });
    engine.next();
  }

  it('보고 느끼기는 본 뒤에만 다음으로 가고 결과 행을 남기지 않는다', () => {
    const engine = createMissionEngine(fixture());
    toFeel(engine);
    const before = engine.getState().results.length;
    engine.next();
    expect(engine.getState().stage).toBe('feel');
    engine.markFelt();
    engine.next();
    expect(engine.getState().stage).toBe('creative');
    expect(engine.getState().results).toHaveLength(before);
  });

  it('창작은 완성 문장을 최종 답에, 고른 것을 메모에. 흥미 체크는 문항마다 한 행', () => {
    const engine = createMissionEngine(fixture());
    toFeel(engine);
    engine.markFelt(); engine.next();
    engine.submitCreative({ text: '내 이름은 화성.', memo: '화성', detail: { planet: 'mars' } });
    expect(engine.getState()).toMatchObject({ stage: 'creativeResult', lastFeedback: { text: '내 이름은 화성.', detail: { planet: 'mars' } } });
    expect(engine.getState().resumeIndex).toBe(engine.getState().stepIndex + 1); // 창작 행은 이미 보냄
    engine.next();
    engine.submitSurvey([0, 1]);
    const s = engine.getState();
    expect(s.results.slice(-3)).toMatchObject([
      { 문항: 'C-1', 최종답: '내 이름은 화성.', 메모: '화성', 최종정답여부: null },
      { 문항: '흥미4', 최종답: '좋아요' },
      { 문항: '흥미5', 최종답: '아니요' }
    ]);
    expect(s.done).toBe(true);
  });
});

describe('결과 행(기획서 10-3)', () => {
  it('컬럼 이름·순서가 10-3과 같고 탐사 번호와 소요 시간이 들어간다', () => {
    const c = clock();
    const engine = createMissionEngine(fixture(), { now: c.now });
    toFirstItem(engine);
    c.add(12);
    engine.submitPredict(1);
    const row = engine.getState().results[0];
    expect(Object.keys(row)).toEqual(ROW_KEYS);
    expect(ROW_KEYS).toEqual(['종류', '탐사', '문항', '처음예측', '예측정답여부', '최종답', '최종정답여부', '한줄정리', '한줄정리정답여부', '소요시간', '메모']);
    expect(row).toMatchObject({ 종류: '미션', 탐사: 2, 소요시간: 12 });
  });

  it('문항 번호(문항 n/전체)', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    expect(engine.getState()).toMatchObject({ itemNumber: 0, itemTotal: 3 });
    engine.next();
    engine.report('cards', 2);
    expect(engine.getState().itemNumber).toBe(1);
  });
});

describe('이어서 하기(기획서 10-5)', () => {
  it('resumeIndex는 아직 행을 보내지 않은 첫 단계, start({ from })은 그 단계부터', () => {
    const engine = createMissionEngine(fixture());
    const rows = [];
    engine.onRow((r) => rows.push(r));
    toFirstItem(engine);
    const first = engine.getState().stepIndex;
    expect(engine.getState().resumeIndex).toBe(first); // 문항을 푸는 중
    engine.submitPredict(1); // 정답 → 행을 보냄
    expect(engine.getState().resumeIndex).toBe(first + 1);

    const again = createMissionEngine(fixture());
    again.start({ from: first + 1 });
    expect(again.getState().stepIndex).toBe(first + 1);
  });

  it('한 줄 정리를 기다리는 문항은 그 문항부터 다시 한다', () => {
    const engine = createMissionEngine(fixture());
    toFirstItem(engine);
    engine.submitPredict(1); engine.next(); // 1번째 문항 끝
    const item = engine.getState().stepIndex;
    engine.submitPredict(0); // 한 줄 정리 앞 문항 → 행을 붙잡아 둠
    expect(engine.getState().resumeIndex).toBe(item);
    engine.next();
    expect(engine.getState()).toMatchObject({ stage: 'summary', resumeIndex: item });
  });

  it('요일 도입 기록을 이어받는다', () => {
    const engine = createMissionEngine(fixture());
    engine.start({ from: 0, pressedDays: ['mon'] });
    expect(engine.getState().days).toEqual(['mon']);
  });
});
