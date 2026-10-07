// 미션 진행 상태 기계(3D 장면과 분리, 테스트 가능). 달빛 관측소 엔진을 그대로 가져왔다.
//   예측이 정답이면 바로 다음 문항으로 넘어간다(기획서 9-1).
//   예측이 오답이면 ② 확인(조작 잠금 해제, 직접 관찰) → ③ 최종 답(2차 시도)을 거친다.
// 미션 데이터는 인자(groups)로 받는다. 별빛 탐사선의 미션 데이터는 Phase 9A에서 만든다.
// 아래 explore-quiz(충돌 구덩이 개수 게이트)·freeplay(자유 탐색)는 달빛 관측소 형식 그대로이며,
// Phase 9A에서 '조건 이름과 필요한 개수' 게이트와 sort·classify·creative·survey 형식으로 확장한다.
export function createMissionEngine(groups) {
  let groupIndex = 0;
  let itemIndex = 0;
  let stage = 'idle'; // idle|explore|predict|confirm|summary|freeplay|interest|done
  let craterCount = 0;
  let orbitCount = 0;
  let viewSwitchCount = 0;
  let shownDiscoveries = new Set();
  let pendingDiscoveries = [];
  let pendingPredict = null; // { choiceIndex, correct } — submitPredict와 submitFinal 사이에만 존재
  let itemStartedAt = 0;
  let groupStartedAt = 0;
  let lastFeedback = null;
  const results = [];
  const listeners = new Set();

  function currentGroup() { return groups[groupIndex] ?? null; }
  function currentItem() { return currentGroup()?.items?.[itemIndex] ?? null; }

  function emit() { listeners.forEach((fn) => fn(getState())); }

  function beginItem() {
    stage = 'predict';
    pendingPredict = null;
    itemStartedAt = Date.now();
  }

  function beginGroup(index) {
    groupIndex = index;
    itemIndex = 0;
    groupStartedAt = Date.now();
    const group = currentGroup();
    if (!group) { stage = 'done'; return; }
    if (group.type === 'explore-quiz') stage = 'explore';
    else if (group.type === 'freeplay') stage = 'freeplay';
    else if (group.type === 'survey') stage = 'interest';
    else beginItem();
  }

  function start() {
    results.length = 0;
    craterCount = 0;
    orbitCount = 0;
    viewSwitchCount = 0;
    shownDiscoveries = new Set();
    pendingDiscoveries = [];
    beginGroup(0);
    emit();
  }

  // ---- 문항(예측 → 확인 → 최종 답) ----
  function submitPredict(choiceIndex) {
    const item = currentItem();
    if (!item || stage !== 'predict') return;
    const correct = choiceIndex === item.answerIndex;
    if (correct) {
      finishItem(item, { choiceIndex, correct: true }, choiceIndex, true);
    } else {
      pendingPredict = { choiceIndex, correct: false };
      lastFeedback = { stage: 'predict', correct: false, message: item.hint ?? null };
      stage = 'confirm';
      emit();
    }
  }

  function submitFinal(choiceIndex) {
    const item = currentItem();
    if (!item || stage !== 'confirm' || !pendingPredict) return;
    const correct = choiceIndex === item.answerIndex;
    finishItem(item, pendingPredict, choiceIndex, correct);
  }

  // 예측/최종 답이 정해진 문항 하나를 결과에 기록하고 다음 문항(또는 한 줄 정리)으로 넘어간다.
  function finishItem(item, predict, finalChoiceIndex, finalCorrect) {
    const seconds = Math.round((Date.now() - itemStartedAt) / 1000);
    results.push({
      문항: item.id,
      처음예측: item.options[predict.choiceIndex],
      예측정답여부: predict.correct,
      최종답: item.options[finalChoiceIndex],
      최종정답여부: finalCorrect,
      한줄정리: null,
      한줄정리정답여부: null,
      소요시간: seconds,
      메모: item.id === '4-2' ? craterCount : null
    });

    lastFeedback = { stage: 'final', correct: finalCorrect, message: item.explanation, correctText: item.options[item.answerIndex] };
    pendingPredict = null;

    const group = currentGroup();
    if (itemIndex < group.items.length - 1) {
      itemIndex++;
      beginItem();
    } else {
      stage = 'summary';
    }
    emit();
  }

  function submitSummary(choiceIndex) {
    const group = currentGroup();
    if (!group || stage !== 'summary') return;
    const correct = choiceIndex === group.summary.answerIndex;
    const last = results[results.length - 1];
    last.한줄정리 = group.summary.options[choiceIndex];
    last.한줄정리정답여부 = correct;
    lastFeedback = { stage: 'summary', correct, message: null };
    beginGroup(groupIndex + 1);
    // 미션 5(자유 탐색)·흥미 체크는 문항 형식이 아니므로, 앞 미션의 한 줄 정리 배너를 그대로 띄우지 않는다.
    const nextType = currentGroup()?.type;
    if (nextType === 'freeplay' || nextType === 'survey') lastFeedback = null;
    emit();
  }

  // ---- 미션 4: 표면 탐험(충돌 구덩이 3개를 찾아야 질문이 열린다) ----
  function reportCraterCount(count) {
    craterCount = count;
    const group = currentGroup();
    if (stage === 'explore' && group?.type === 'explore-quiz' && craterCount >= group.unlockCraterCount) {
      beginItem();
    }
    emit();
  }

  // ---- 미션 5: 우주 탐험(자유 탐색, 발견 카드) ----
  function bumpDiscovery(trigger) {
    const group = currentGroup();
    if (!group || group.type !== 'freeplay') return;
    const card = group.discoveries.find((d) => d.trigger === trigger);
    if (card && !shownDiscoveries.has(card.id)) {
      shownDiscoveries.add(card.id);
      pendingDiscoveries.push(card.text);
    }
    emit();
  }

  function reportOrbitComplete() {
    if (currentGroup()?.type !== 'freeplay') return;
    orbitCount++;
    bumpDiscovery('orbit');
  }

  function reportViewSwitch() {
    if (currentGroup()?.type !== 'freeplay') return;
    viewSwitchCount++;
    bumpDiscovery('viewSwitch');
  }

  function reportMoonZoom() {
    bumpDiscovery('zoom');
  }

  function freeplayReady() {
    return stage === 'freeplay' && orbitCount >= 1 && viewSwitchCount >= 1;
  }

  // UI가 새로 뜬 발견 카드 문구를 가져가면서 비운다.
  function drainDiscoveries() {
    const list = pendingDiscoveries;
    pendingDiscoveries = [];
    return list;
  }

  function completeExploration() {
    if (!freeplayReady()) return;
    const seconds = Math.round((Date.now() - groupStartedAt) / 1000);
    results.push({
      문항: '5', 처음예측: null, 예측정답여부: null, 최종답: null, 최종정답여부: null,
      한줄정리: null, 한줄정리정답여부: null, 소요시간: seconds, 메모: '탐험 완료'
    });
    beginGroup(groupIndex + 1);
    emit();
  }

  // ---- 마무리. 흥미 체크 ----
  function submitInterest({ feelingIndex, wantIndex }) {
    const group = currentGroup();
    if (!group || stage !== 'interest') return;
    const seconds = Math.round((Date.now() - groupStartedAt) / 1000);
    results.push({
      문항: '흥미', 처음예측: null, 예측정답여부: null,
      최종답: `${group.feelingOptions[feelingIndex]} · ${group.wantOptions[wantIndex]}`,
      최종정답여부: null, 한줄정리: null, 한줄정리정답여부: null,
      소요시간: seconds, 메모: null
    });
    stage = 'done';
    lastFeedback = { stage: 'done', correct: true, message: null };
    emit();
  }

  function getState() {
    return {
      groupIndex, itemIndex, stage,
      craterCount, orbitCount, viewSwitchCount,
      lastFeedback,
      results: results.slice(),
      done: stage === 'done'
    };
  }

  return {
    start,
    submitPredict,
    submitFinal,
    submitSummary,
    reportCraterCount,
    reportOrbitComplete,
    reportViewSwitch,
    reportMoonZoom,
    freeplayReady,
    completeExploration,
    submitInterest,
    drainDiscoveries,
    getState,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
