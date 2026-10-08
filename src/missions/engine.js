// 미션 진행 상태 기계(3D 장면·DOM과 분리, 테스트 가능). 달빛 관측소 엔진을 별빛 탐사선에 맞게 넓혔다.
//   탐사 하나(mission)는 단계(steps)를 차례로 지난다.
//   intro(요일 도입, 점수 없음) · gate(탐색 조건) · quiz(보기 선택) · sort/classify(끌어다 놓기)
//   · summary(한 줄 정리) · feel(보고 느끼기, 점수 없음) · creative(창작, 정답 없음) · survey(흥미 체크)
//
// 문항 하나의 흐름(기획서 9-1, 달빛 관측소와 같음):
//   predict → 정답이면 확인 단계 없이 result('정답이에요!') → next()로 다음 단계
//           → 오답이면 confirm(힌트, 조작 잠금 해제) → submitFinal → result(칭찬 또는 정답 공개)
//
// lastFeedback(달빛 관측소 리포트 6-2의 주의점): 방금 띄운 '정답이에요!' 배너가 화면에 그려지기 전에
// 지워지면 안 된다. 그래서 배너는 result·summaryResult 단계에 머무는 동안 유지하고, 학생이 '다음 문항'을
// 눌러 next()로 그 단계를 떠날 때만 지운다. 단계를 시작하는 함수(enter)는 lastFeedback을 건드리지 않는다.
//
// 결과 행은 기획서 10-3 '미션' 탭 컬럼과 이름·순서가 같다(submitQueue.buildPayload가 받는 모양).
// 한 줄 정리는 새 행을 만들지 않고 그 탐사의 마지막 문항 행에 붙는다(달빛 관측소와 같음).

export const ROW_KEYS = ['종류', '탐사', '문항', '처음예측', '예측정답여부', '최종답', '최종정답여부', '한줄정리', '한줄정리정답여부', '소요시간', '메모'];

const ITEM_TYPES = new Set(['quiz', 'sort', 'classify']);

// 한 줄 정리 문장의 [ ] 자리에 보기('태양 / 행성')를 차례로 넣는다.
export function fillSentence(text, option) {
  const words = option.split(' / ');
  let i = 0;
  return text.replace(/\[ \]/g, () => words[i++] ?? '');
}

// 탐색 조건 이름 → 화면 문구에 쓰는 단위는 데이터(missions.js)가 가진다.
export const GATE_CONDITIONS = ['members', 'cards', 'constellations'];

export function createMissionEngine(mission, { now = () => Date.now() } = {}) {
  const steps = mission.steps;
  const itemSteps = steps.filter((s) => ITEM_TYPES.has(s.type));
  let stepIndex = -1;
  let stage = 'idle'; // idle|intro|gate|predict|confirm|arrange|result|summary|summaryResult|feel|creative|creativeResult|survey|done
  let pendingPredict = null; // { choiceIndex } — 오답 예측과 최종 답 사이에만 있다
  let lastFeedback = null;
  let stepStartedAt = 0;
  let gateOpened = false; // 학생이 탐색 조건을 막 채워서 질문이 열렸는지(화면이 잠깐 기다렸다 패널을 띄운다)
  let felt = false;
  const days = new Set();
  const counts = Object.fromEntries(GATE_CONDITIONS.map((c) => [c, 0]));
  let members = [];
  const results = [];
  let heldRow = null; // 한 줄 정리를 기다리는 마지막 문항 행
  let heldIndex = -1; // 그 문항의 단계 번호
  const listeners = new Set();
  const rowListeners = new Set();

  const step = () => steps[stepIndex] ?? null;
  const emit = () => { const s = getState(); listeners.forEach((fn) => fn(s)); };
  const seconds = () => Math.round((now() - stepStartedAt) / 1000);
  const gateMet = (s) => counts[s.condition] >= s.count;

  function finalize(row) {
    rowListeners.forEach((fn) => fn({ ...row }));
  }

  function enter(index, { byGate = false } = {}) {
    stepIndex = index;
    gateOpened = byGate;
    pendingPredict = null;
    stepStartedAt = now();
    const s = step();
    if (!s) { stage = 'done'; return; }
    if (s.type === 'gate') {
      if (gateMet(s)) { enter(index + 1); return; } // 이미 채운 조건(저장된 진행)은 건너뛴다
      stage = 'gate';
    } else if (s.type === 'quiz') stage = 'predict';
    else if (s.type === 'sort' || s.type === 'classify') stage = 'arrange';
    else stage = s.type; // intro | summary | feel | creative | survey
    if (s.type === 'feel') felt = false;
  }

  function addRow(fields) {
    const row = {
      종류: '미션', 탐사: mission.id, 문항: null, 처음예측: null, 예측정답여부: null, 최종답: null, 최종정답여부: null,
      한줄정리: null, 한줄정리정답여부: null, 소요시간: seconds(), 메모: null, ...fields
    };
    results.push(row);
    return row;
  }

  function memoOf(item) {
    if (item.memo !== 'members') return null;
    const label = mission.memberLabels ?? {};
    const found = members.map((id) => label[id] ?? id).join(', ');
    return `구성원: ${found} / 요일 도입: ${days.size >= (mission.days?.length ?? 0) ? '완료' : '미완료'}`;
  }

  // 문항 하나를 결과 행으로 남기고 result 단계로. 다음 단계가 한 줄 정리면 그 행은 정리를 기다린다.
  function finishItem(item, first, firstCorrect, final, finalCorrect, extra = {}) {
    const row = addRow({ 문항: item.id, 처음예측: first, 예측정답여부: firstCorrect, 최종답: final, 최종정답여부: finalCorrect, 메모: memoOf(item) });
    if (steps[stepIndex + 1]?.type === 'summary') { heldRow = row; heldIndex = stepIndex; }
    else finalize(row);
    lastFeedback = { stage: 'final', correct: finalCorrect, firstCorrect, message: item.explanation ?? null, correctText: item.options?.[item.answerIndex] ?? null, ...extra };
    pendingPredict = null;
    stage = 'result';
    emit();
  }

  function submitPredict(choiceIndex) {
    const item = step();
    if (stage !== 'predict' || !item?.options?.[choiceIndex]) return;
    if (choiceIndex === item.answerIndex) {
      finishItem(item, item.options[choiceIndex], true, item.options[choiceIndex], true, { choiceIndex });
      return;
    }
    pendingPredict = { choiceIndex };
    lastFeedback = { stage: 'predict', correct: false, choiceIndex, message: item.hint ?? item.guide ?? null };
    stage = 'confirm';
    emit();
  }

  function submitFinal(choiceIndex) {
    const item = step();
    if (stage !== 'confirm' || !pendingPredict || !item?.options?.[choiceIndex]) return;
    const first = item.options[pendingPredict.choiceIndex];
    const correct = choiceIndex === item.answerIndex;
    finishItem(item, first, false, item.options[choiceIndex], correct, { choiceIndex, firstChoiceIndex: pendingPredict.choiceIndex });
  }

  // 줄 세우기·나누어 담기: arrange.js(createArrangeTask)의 기록 { first, final, correct, attempts }을 받는다.
  function submitArrange(record) {
    const item = step();
    if (stage !== 'arrange' || !record) return;
    finishItem(item, record.first, record.attempts === 1 && record.correct, record.final, record.correct);
  }

  function submitSummary(choiceIndex) {
    const s = step();
    if (stage !== 'summary' || !s.options[choiceIndex]) return;
    const correct = choiceIndex === s.answerIndex;
    const chosen = fillSentence(s.text, s.options[choiceIndex]);
    const answer = fillSentence(s.text, s.options[s.answerIndex]);
    if (heldRow) {
      heldRow.한줄정리 = chosen;
      heldRow.한줄정리정답여부 = correct;
      finalize(heldRow);
      heldRow = null;
      heldIndex = -1;
    }
    lastFeedback = { stage: 'summary', correct, chosen, answer, choiceIndex };
    stage = 'summaryResult';
    emit();
  }

  // 결과·한 줄 정리·창작 완성·보고 느끼기·요일 도입에서 '다음'
  function next() {
    if (stage === 'feel' && !felt) return;
    if (!['result', 'summaryResult', 'creativeResult', 'feel', 'intro'].includes(stage)) return;
    lastFeedback = null;
    enter(stepIndex + 1);
    emit();
  }

  // 탐색 조건(구성원 5개, 도감 카드 4장, 별자리 3개)을 공급하는 모듈이 개수를 알린다.
  function report(condition, count, detail) {
    if (!(condition in counts)) return;
    counts[condition] = count;
    if (condition === 'members' && Array.isArray(detail)) members = [...detail];
    const s = step();
    if (stage === 'gate' && s.condition === condition && gateMet(s)) enter(stepIndex + 1, { byGate: true });
    emit();
  }

  function pressDay(id) {
    const s = step();
    if (stage !== 'intro' || !s.days.some((d) => d.id === id) || days.has(id)) return;
    days.add(id);
    emit();
  }

  function markFelt() {
    if (stage !== 'feel' || felt) return;
    felt = true;
    emit();
  }

  // 창작: 완성 문장(최종 답)과 고른 행성·별자리(메모). 정답 없음. 완성 문장을 크게 보여 주는 creativeResult를 거친다.
  // detail: 화면이 다시 쓰는 값(랩 네 줄, 별자리 id 등)
  function submitCreative({ text, memo = null, detail = null }) {
    const s = step();
    if (stage !== 'creative' || !text) return;
    finalize(addRow({ 문항: s.id, 최종답: text, 메모: memo }));
    lastFeedback = { stage: 'creative', text, memo, detail };
    stage = 'creativeResult';
    emit();
  }

  // 흥미 체크: 문항마다 고른 보기 번호. 문항마다 한 행(흥미1~흥미5).
  function submitSurvey(choiceIndexes) {
    const s = step();
    if (stage !== 'survey' || s.questions.some((q, i) => !q.options[choiceIndexes[i]])) return;
    s.questions.forEach((q, i) => finalize(addRow({ 문항: q.id, 최종답: q.options[choiceIndexes[i]] })));
    enter(stepIndex + 1);
    emit();
  }

  // from: 이어서 할 단계 번호(기획서 10-5, getState().resumeIndex를 저장해 둔 값). pressedDays: 저장해 둔 요일 도입 기록
  function start({ from = 0, pressedDays = [] } = {}) {
    results.length = 0;
    heldRow = null;
    heldIndex = -1;
    lastFeedback = null;
    days.clear();
    pressedDays.forEach((d) => days.add(d));
    enter(Math.max(0, Math.min(from, steps.length)));
    emit();
  }

  // 다음 차시에 이어서 할 단계: 아직 결과 행을 보내지 않은 첫 단계.
  // 한 줄 정리를 기다리는 문항 행은 보내지 않았으므로 그 문항부터 다시 한다.
  function resumeIndex() {
    if (stage === 'done') return steps.length;
    if (heldRow) return heldIndex;
    if (stage === 'result' || stage === 'summaryResult' || stage === 'creativeResult') return stepIndex + 1;
    return stepIndex;
  }

  function itemPosition() {
    // 지금(또는 방금 끝낸) 문항이 몇 번째인지. 문항 앞 단계에서는 0.
    let n = 0;
    for (let i = 0; i <= stepIndex && i < steps.length; i++) if (ITEM_TYPES.has(steps[i].type)) n++;
    return n;
  }

  function getState() {
    return {
      missionId: mission.id, stepIndex, stage, step: step(),
      itemNumber: itemPosition(), itemTotal: itemSteps.length,
      counts: { ...counts }, days: [...days], felt, gateOpened,
      lastFeedback: lastFeedback && { ...lastFeedback },
      results: results.map((r) => ({ ...r })),
      done: stage === 'done',
      resumeIndex: resumeIndex()
    };
  }

  return {
    start, submitPredict, submitFinal, submitArrange, submitSummary, next,
    report, pressDay, markFelt, submitCreative, submitSurvey, getState,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // 시트로 보낼 수 있게 완성된 결과 행(한 줄 정리가 붙은 뒤)
    onRow(fn) { rowListeners.add(fn); return () => rowListeners.delete(fn); }
  };
}
