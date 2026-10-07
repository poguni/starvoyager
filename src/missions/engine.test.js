import { describe, expect, it } from 'vitest';
import { createMissionEngine } from './engine.js';

// 엔진 로직만 검증하기 위한 작은 가짜 데이터(실제 문구 대조는 아래 '실제 미션 데이터' 묶음에서 한다).
function fixture() {
  return [
    {
      id: 'A',
      type: 'quiz',
      items: [
        { id: 'a-1', start: { view: 'sky', day: 1 }, allow: [], question: 'Q1', options: ['x', 'y'], answerIndex: 1, hint: 'hint1', explanation: 'exp1' },
        { id: 'a-2', start: { view: 'sky', day: 2 }, allow: [], question: 'Q2', options: ['x', 'y'], answerIndex: 0, hint: 'hint2', explanation: 'exp2' }
      ],
      summary: { text: 'S', options: ['s0', 's1'], answerIndex: 0 }
    },
    {
      id: 'B',
      type: 'explore-quiz',
      start: { view: 'sky', day: 15 },
      exploreText: 'explore',
      unlockCraterCount: 3,
      items: [
        { id: 'b-1', start: null, allow: ['zoom'], question: 'Q3', options: ['x', 'y'], answerIndex: 0, hint: 'hint3', explanation: 'exp3' }
      ],
      summary: { text: 'S2', options: ['s0'], answerIndex: 0 }
    },
    {
      id: 'C',
      type: 'freeplay',
      start: { view: 'space', day: 8 },
      introText: 'intro',
      discoveries: [
        { id: 'orbit', trigger: 'orbit', text: 'orbit text' },
        { id: 'viewSwitch', trigger: 'viewSwitch', text: 'view text' }
      ]
    },
    {
      id: 'interest',
      type: 'survey',
      feelingOptions: ['fun', 'meh', 'bad'],
      wantOptions: ['yes', 'no']
    }
  ];
}

// 그룹 A(문항 2개)를 모두 정답으로 통과시켜 한 줄 정리 단계까지 보낸다.
function finishGroupA(engine) {
  engine.submitPredict(1); // a-1 정답
  engine.submitPredict(0); // a-2 정답
  engine.submitSummary(0);
}

describe('예측 → (필요할 때만 확인) → 다음 문항', () => {
  it('예측이 정답이면 확인 단계 없이 바로 다음 문항으로 넘어간다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    expect(engine.getState().stage).toBe('predict');

    engine.submitPredict(1); // 정답
    const state = engine.getState();
    expect(state.stage).toBe('predict'); // 확인 단계를 거치지 않고 바로 다음 문항(a-2)
    expect(state.itemIndex).toBe(1);
    expect(state.lastFeedback).toMatchObject({ stage: 'final', correct: true });
    expect(state.results.at(-1)).toMatchObject({
      문항: 'a-1', 처음예측: 'y', 예측정답여부: true, 최종답: 'y', 최종정답여부: true
    });
  });

  it('예측 오답 → 최종 정답: 힌트가 오고 확인 단계를 거친 뒤 최종 답은 정답으로 기록된다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.submitPredict(0); // 오답
    let state = engine.getState();
    expect(state.stage).toBe('confirm');
    expect(state.lastFeedback).toMatchObject({ stage: 'predict', correct: false, message: 'hint1' });

    engine.submitFinal(1); // 정답
    state = engine.getState();
    expect(state.stage).toBe('predict'); // 다음 문항으로 이동
    expect(state.results.at(-1)).toMatchObject({
      처음예측: 'x', 예측정답여부: false, 최종답: 'y', 최종정답여부: true
    });
  });

  it('예측 오답 → 최종 오답: 정답이 공개된다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.submitPredict(0);
    engine.submitFinal(0);
    const state = engine.getState();
    expect(state.results.at(-1)).toMatchObject({ 최종정답여부: false });
    expect(state.lastFeedback.correctText).toBe('y'); // 정답 공개
  });

  it('확인 단계 중에는 예측을 다시 받지 않는다(중복 제출 방어)', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.submitPredict(0); // 오답 → confirm
    engine.submitPredict(1); // confirm 중에는 무시되어야 한다
    expect(engine.getState().stage).toBe('confirm');
    expect(engine.getState().results).toHaveLength(0);
  });

  it('그룹의 마지막 문항까지 마치면 한 줄 정리 단계로 넘어간다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.submitPredict(1); // a-1 완료 → a-2로 이동
    expect(engine.getState().itemIndex).toBe(1);
    expect(engine.getState().stage).toBe('predict');

    engine.submitPredict(0); // a-2 완료 → 한 줄 정리
    expect(engine.getState().stage).toBe('summary');
  });

  it('한 줄 정리는 그룹의 마지막 문항 결과에 붙는다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    finishGroupA(engine);

    const state = engine.getState();
    expect(state.results).toHaveLength(2);
    expect(state.results[0].한줄정리).toBeNull(); // a-1에는 붙지 않는다
    expect(state.results[1]).toMatchObject({ 문항: 'a-2', 한줄정리: 's0', 한줄정리정답여부: true });
    expect(state.groupIndex).toBe(1); // 다음 미션으로 이동
  });
});

describe('미션 4 형태: 탐험 게이트', () => {
  it('충돌 구덩이를 3개 찾기 전에는 질문이 열리지 않는다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    finishGroupA(engine); // 그룹 B(탐험)로 진입

    expect(engine.getState().stage).toBe('explore');
    engine.reportCraterCount(2);
    expect(engine.getState().stage).toBe('explore');
    engine.reportCraterCount(3);
    expect(engine.getState().stage).toBe('predict');
  });

  it("마지막 문항(4-2에 해당)의 메모에 찾은 개수가 기록된다", () => {
    const groups = fixture();
    groups[1].items.push({
      id: '4-2', start: null, allow: ['zoom'], question: 'Q4', options: ['x', 'y'], answerIndex: 0, hint: null, explanation: 'exp4'
    });
    const engine = createMissionEngine(groups);
    engine.start();
    finishGroupA(engine);
    engine.reportCraterCount(3);
    engine.submitPredict(0); // b-1
    engine.reportCraterCount(5);
    engine.submitPredict(0); // 4-2

    const last = engine.getState().results.at(-1);
    expect(last.문항).toBe('4-2');
    expect(last.메모).toBe(5);
  });
});

describe('미션 5 형태: 자유 탐색', () => {
  function advanceToFreeplay() {
    const engine = createMissionEngine(fixture());
    engine.start();
    finishGroupA(engine);
    engine.reportCraterCount(3);
    engine.submitPredict(0);
    engine.submitSummary(0);
    return engine;
  }

  it('앞 미션의 한 줄 정리 배너가 자유 탐색 화면까지 남아 있지 않는다', () => {
    const engine = advanceToFreeplay();
    expect(engine.getState().lastFeedback).toBeNull();
  });

  it('한 바퀴 관찰과 시점 전환을 모두 해야 완료 버튼이 켜진다', () => {
    const engine = advanceToFreeplay();
    expect(engine.getState().stage).toBe('freeplay');
    expect(engine.freeplayReady()).toBe(false);

    engine.reportOrbitComplete();
    expect(engine.freeplayReady()).toBe(false);
    engine.reportViewSwitch();
    expect(engine.freeplayReady()).toBe(true);
  });

  it('발견 카드는 조건을 만날 때 한 번만 나타난다', () => {
    const engine = advanceToFreeplay();
    engine.reportOrbitComplete();
    engine.reportOrbitComplete();
    expect(engine.drainDiscoveries()).toEqual(['orbit text']);
    expect(engine.drainDiscoveries()).toEqual([]); // 두 번째는 이미 나온 카드라 비어 있다
  });

  it('완료 조건을 채우면 탐험 완료 기록을 남기고 다음 단계(흥미 체크)로 간다', () => {
    const engine = advanceToFreeplay();
    engine.completeExploration(); // 조건 미달이면 아무 일도 없다
    expect(engine.getState().stage).toBe('freeplay');

    engine.reportOrbitComplete();
    engine.reportViewSwitch();
    engine.completeExploration();

    const state = engine.getState();
    expect(state.results.at(-1)).toMatchObject({ 문항: '5', 최종답: null, 메모: '탐험 완료' });
    expect(state.stage).toBe('interest');
  });
});

describe('흥미 체크', () => {
  it('선택값을 기록하고 전체를 완료 상태로 만든다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    finishGroupA(engine);
    engine.reportCraterCount(3);
    engine.submitPredict(0);
    engine.submitSummary(0);
    engine.reportOrbitComplete();
    engine.reportViewSwitch();
    engine.completeExploration();

    engine.submitInterest({ feelingIndex: 0, wantIndex: 0 });
    const state = engine.getState();
    expect(state.stage).toBe('done');
    expect(state.results.at(-1)).toMatchObject({ 문항: '흥미', 최종답: 'fun · yes' });
    expect(state.lastFeedback).toMatchObject({ stage: 'done', correct: true });
  });
});

describe('결과 객체 필드(달빛 관측소 형식, Phase 9A에서 기획서 10-3에 맞춘다)', () => {
  it('필드 이름이 달빛 관측소 결과 행과 같다', () => {
    const engine = createMissionEngine(fixture());
    engine.start();
    engine.submitPredict(1);
    const result = engine.getState().results[0];
    expect(Object.keys(result)).toEqual([
      '문항', '처음예측', '예측정답여부', '최종답', '최종정답여부', '한줄정리', '한줄정리정답여부', '소요시간', '메모'
    ]);
  });
});
