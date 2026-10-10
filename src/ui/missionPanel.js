// 미션 패널(S06·S06b, motion.md '미션'): 도감 패널 자리(오른쪽)에 나타나는 어두운 유리 패널.
//   진행 표시("탐사 2 · 문항 1/3" + 점) · 질문 · 보기 · 오답 힌트 · 정답 배너 · 정답 공개 · 한 줄 정리.
//   탐색 단계에서는 패널 대신 왼쪽 위 작은 안내 띠만 보인다(docs/결정기록.md 2026-10-08).
// 상태는 missions/engine.js가 갖고, 이 파일은 그리기와 누르기만 한다.
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { primaryButton } from './components/buttons.js';
import { fillSentence } from '../missions/engine.js';
import { withIeyo } from '../model/josa.js';
import { RAP_LINES, rapNameLine } from '../data/rapLines.js';
import { bodyById } from '../model/world.js';

const CONFIRM_TEXT = '직접 관찰한 뒤 답을 다시 골라요.'; // S06
const CUE_ICON = {
  sunlight: 'i-sun-off', play: 'i-play', next: 'i-next', land: 'i-land', loupe: 'i-ring',
  real: 'i-scale', sunCompare: 'i-sun', time: 'i-star', names: 'i-label', lights: 'i-city'
};

// 정답 공개 상자 머리말(S06b B "정답은 4개예요"). '…요'로 끝나는 보기는 조사를 붙이지 않는다.
const revealKey = (text) => (text.endsWith('요') ? `정답: ${text}` : `정답은 ${withIeyo(text)}`);

// donePlanets(): 완성한 행성 카드 id 목록(행성 랩을 고를 수 있는 행성)
export function createMissionPanel(app, { onPredict, onFinal, onSummary, onNext, onDay, onExit, onCreative, onSurvey, donePlanets = () => [] }) {
  const progressText = el('span');
  const dots = el('span', { class: 'sv-dots', 'aria-hidden': 'true' });
  const body = el('div', { class: 'sv-mp-body' });
  const foot = el('div', { class: 'sv-mp-foot' });
  const panel = el('section', { class: 'sv-mission sv-mp', 'aria-label': '미션', 'aria-live': 'polite' }, [
    el('div', { class: 'sv-mission-progress' }, [progressText, dots]), body, foot
  ]);
  const stripText = el('span');
  const stripGo = el('button', { type: 'button', class: 'sv-ghost sv-mp-strip-go', hidden: true });
  const strip = el('div', { class: 'sv-glass sv-mp-strip', role: 'status', hidden: true }, [icon('i-star'), stripText, stripGo]);
  app.append(panel, strip);

  let open = false;
  let hidden = false;
  let summaryPick = null; // 한 줄 정리에서 고른 보기(문장 완성하기 전)
  // 창작: target 고른 행성·별자리 id, picks 줄(빈칸)마다 고른 보기 번호, active 지금 고르는 줄
  let creative = { target: null, picks: [], active: 0, total: 0 };
  let surveyPicks = [];
  let lastKey = null;

  function setOpen(on) {
    open = on;
    layout();
  }
  function layout() {
    const shown = open && !hidden;
    panel.classList.toggle('is-open', shown);
    app.classList.toggle('sv-mp-on', shown); // 밤하늘의 넓은 하단 조작줄이 패널 왼쪽에서 끝나게
    panel.inert = !shown;
    panel.setAttribute('aria-hidden', shown ? 'false' : 'true');
  }

  function choiceButton(text, index, { onPick, state = null, pressed = false, disabled = false }) {
    const b = el('button', { type: 'button', class: 'sv-choice', 'aria-pressed': pressed ? 'true' : 'false', disabled }, [
      el('span', { class: 'sv-choice-key' }, String(index + 1)), el('span', { class: 'sv-choice-text' }, text)
    ]);
    if (state) b.classList.add(state);
    if (onPick) b.addEventListener('click', () => onPick(index));
    return b;
  }

  function progressDots(n, total) {
    dots.replaceChildren(...Array.from({ length: total }, (_, i) => el('span', { class: i < n ? 'is-on' : '' })));
  }

  function nextLabel(mission, stepIndex) {
    const after = mission.steps[stepIndex + 1];
    if (!after) return '다음';
    if (after.type === 'summary') return '한 줄 정리하기';
    if (['quiz', 'sort', 'classify', 'gate'].includes(after.type)) return '다음 문항';
    return '다음';
  }

  // 한 줄 정리 문장: [ ] 자리를 빈칸(.sv-blank)으로. option이 있으면 빈칸에 채운다.
  function sentence(text, option, cls = 'sv-sentence') {
    const words = option ? option.split(' / ') : [];
    const parts = text.split('[ ]');
    const p = el('p', { class: cls });
    parts.forEach((part, i) => {
      p.append(part);
      if (i < parts.length - 1) p.append(el('span', { class: 'sv-blank' }, words[i] ?? ''));
    });
    return p;
  }

  // state: engine.getState(), mission: missions.js의 탐사
  function render(state, mission) {
    const { stage, step, lastFeedback: fb } = state;
    const key = `${state.stepIndex}:${stage}`;
    const fresh = key !== lastKey; // 단계가 바뀐 첫 그리기(등장 연출은 이때만)
    lastKey = key;
    if (fresh) { summaryPick = null; creative = { target: null, picks: [], active: 0, total: 0 }; surveyPicks = []; }
    const n = mission.id;
    body.replaceChildren();
    foot.replaceChildren();
    panel.classList.toggle('is-wide', false);

    // 진행 표시
    if (stage === 'summary' || stage === 'summaryResult') progressText.textContent = `탐사 ${n} · 한 줄 정리`;
    else if (stage === 'intro') progressText.textContent = `탐사 ${n} · ${step.title}`;
    else if (stage === 'feel') progressText.textContent = `탐사 ${n} · 보고 느끼기`;
    else if (stage === 'creative' || stage === 'creativeResult') progressText.textContent = `탐사 ${n} · ${step.title}`;
    else if (stage === 'survey') progressText.textContent = `탐사 ${n} · 마무리`;
    else if (stage === 'done') progressText.textContent = `탐사 ${n}`;
    else progressText.textContent = `탐사 ${n} · 문항 ${state.itemNumber}/${state.itemTotal}`;
    const after = ['done', 'summary', 'summaryResult', 'feel', 'creative', 'creativeResult', 'survey'].includes(stage);
    progressDots(after ? state.itemTotal : state.itemNumber, state.itemTotal);

    if (stage === 'intro') {
      body.append(
        el('h2', { class: 'sv-question' }, step.text),
        el('div', { class: 'sv-choices sv-mp-days' }, step.days.map((d, i) => {
          const b = el('button', { type: 'button', class: 'sv-choice', 'aria-pressed': state.days.includes(d.id) ? 'true' : 'false' }, [
            el('span', { class: 'sv-choice-key' }, d.label[0]), d.label
          ]);
          b.addEventListener('click', () => onDay(d));
          return b;
        }))
      );
      foot.append(primaryButton({ label: ['다음', icon('i-next')], onClick: onNext }));
      return;
    }

    if (stage === 'predict' || stage === 'confirm') {
      const wrongIndex = stage === 'confirm' ? fb?.choiceIndex : null;
      const q = el('h2', { class: 'sv-question' }, step.question);
      const choices = el('div', { class: 'sv-choices' }, step.options.map((text, i) => choiceButton(text, i, {
        onPick: stage === 'predict' ? onPredict : onFinal,
        state: i === wrongIndex ? 'is-wrong' : null,
        disabled: i === wrongIndex
      })));
      body.append(q, choices);
      if (stage === 'confirm') {
        const wrong = choices.children[wrongIndex];
        if (fresh) wrong.classList.add('sv-mp-shake'); // 고른 보기만 작게 흔들림(motion.md)
        if (fb?.message) body.append(el('div', { class: `sv-hint-dark${fresh ? ' sv-mp-unfold' : ''}` }, [icon('i-hint'), el('span', {}, fb.message)]));
        body.append(el('div', { class: 'sv-guide' }, [icon(CUE_ICON[step.cue] ?? 'i-star'), el('span', {}, CONFIRM_TEXT)]));
      }
      return;
    }

    if (stage === 'result' && step.type === 'quiz') {
      // S06b A(정답) · B(두 번째도 오답 → 정답 공개)
      if (fb.correct) body.append(el('div', { class: `sv-banner-ok${fresh ? ' sv-mp-drop' : ''}`, role: 'status' }, [icon('i-check'), '정답이에요!']));
      body.append(
        el('h2', { class: 'sv-question' }, step.question),
        el('div', { class: 'sv-choices' }, step.options.map((text, i) => {
          let s = null;
          if (i === step.answerIndex) s = 'is-correct';
          else if (!fb.correct && i === fb.choiceIndex) s = 'is-wrong';
          return choiceButton(text, i, { state: s, disabled: true });
        }))
      );
      if (fb.correct && fb.message) body.append(el('p', { class: 'sv-explain' }, fb.message));
      if (!fb.correct) body.append(el('div', { class: 'sv-reveal' }, [el('span', { class: 'sv-reveal-key' }, revealKey(fb.correctText)), fb.message]));
      foot.append(primaryButton({ label: [nextLabel(mission, state.stepIndex), icon('i-next')], onClick: onNext }));
      return;
    }

    if (stage === 'summary') {
      const pick = summaryPick;
      body.append(
        sentence(step.text, pick === null ? null : step.options[pick]),
        el('div', { class: 'sv-choices' }, step.options.map((text, i) => choiceButton(text, i, {
          pressed: i === pick,
          onPick: (index) => { summaryPick = index; render(state, mission); }
        })))
      );
      foot.append(primaryButton({ label: '문장 완성하기', disabled: pick === null, onClick: () => onSummary(summaryPick) }));
      return;
    }

    if (stage === 'summaryResult') {
      // 완성한 문장이 패널 가운데에 크게 0.5초 페이드인(motion.md '미션')
      const done = el('div', { class: `sv-mp-done${fresh ? ' sv-mp-fade' : ''}` }, [sentence(step.text, step.options[fb.choiceIndex], 'sv-sentence sv-mp-big')]);
      if (!fb.correct) done.append(el('div', { class: 'sv-reveal' }, [el('span', { class: 'sv-reveal-key' }, '정답 문장이에요'), fb.answer]));
      body.append(done);
      foot.append(primaryButton({ label: ['다음', icon('i-next')], onClick: onNext }));
      return;
    }

    if (stage === 'feel') {
      body.append(el('div', { class: 'sv-guide sv-mp-lead' }, [icon(CUE_ICON[step.cue]), el('span', {}, step.text)]));
      foot.append(primaryButton({ label: ['다음', icon('i-next')], disabled: !state.felt, onClick: onNext }));
      return;
    }

    if (stage === 'creative') {
      if (step.kind === 'rap') renderRap(state, mission);
      else renderNaming(state, mission, step);
      return;
    }

    if (stage === 'creativeResult') {
      // 완성한 랩·문장을 크게(한 줄 정리 완성과 같은 0.5초 페이드인)
      const lines = fb.detail?.lines ?? [fb.text];
      body.append(el('div', { class: `sv-mp-done${fresh ? ' sv-mp-fade' : ''}` }, [
        el('span', { class: 'sv-mp-kicker' }, [icon('i-star'), step.kind === 'rap' ? '내가 만든 행성 랩' : `새 이름을 붙인 ${fb.memo}`]),
        el('div', { class: 'sv-mp-lines' }, lines.map((t) => el('p', { class: 'sv-sentence sv-mp-big' }, t)))
      ]));
      foot.append(primaryButton({ label: ['다음', icon('i-next')], onClick: onNext }));
      return;
    }

    if (stage === 'survey') {
      for (const [qi, q] of step.questions.entries()) {
        body.append(
          el('h2', { class: step.questions.length > 1 ? 'sv-question sv-mp-q2' : 'sv-question' }, q.text),
          el('div', { class: 'sv-choices' }, q.options.map((text, i) => {
            const b = choiceButton(text, i, { pressed: surveyPicks[qi] === i, onPick: (index) => { surveyPicks[qi] = index; render(state, mission); } });
            if (q.emoji) b.querySelector('.sv-choice-key').replaceWith(el('span', { class: 'sv-choice-key sv-mp-emoji', 'aria-hidden': 'true' }, q.emoji[i]));
            return b;
          }))
        );
      }
      const ready = step.questions.every((_, i) => surveyPicks[i] !== undefined);
      foot.append(primaryButton({ label: ['다음', icon('i-next')], disabled: !ready, onClick: () => onSurvey([...surveyPicks]) }));
      return;
    }

    if (stage === 'done') {
      body.append(el('div', { class: `sv-banner-ok${fresh ? ' sv-mp-drop' : ''}`, role: 'status' }, [icon('i-check'), `탐사 ${n}${'을를을를'[n - 1]} 마쳤어요!`]));
      foot.append(primaryButton({ label: '탐사 끝내기', onClick: onExit }));
    }
  }

  // 창작 고르기 화면 공통: 처음에는 고를 대상(행성·별자리), 고른 뒤에는 미리 보기 + 지금 줄(빈칸)의 보기
  function pickTarget(question, targets, state, mission) {
    body.append(
      el('h2', { class: 'sv-question' }, question),
      el('div', { class: 'sv-choices' }, targets.map((t, i) => choiceButton(t.name, i, {
        onPick: () => { creative = { target: t.id, picks: [], active: 0, total: 0 }; render(state, mission); }
      })))
    );
  }

  function againButton(label, state, mission) {
    const b = el('button', { type: 'button', class: 'sv-ghost sv-mp-again' }, [icon('i-prev'), label]);
    b.addEventListener('click', () => { creative = { target: null, picks: [], active: 0, total: 0 }; render(state, mission); });
    return b;
  }

  // 지금 줄(빈칸)의 보기. 고르면 아직 고르지 않은 다음 줄로 옮겨 간다.
  function lineChoices(options, state, mission, { grid = false } = {}) {
    return el('div', { class: grid ? 'sv-choices sv-mp-grid' : 'sv-choices' }, options.map((text, i) => choiceButton(text, i, {
      pressed: creative.picks[creative.active] === i,
      onPick: (index) => {
        creative.picks[creative.active] = index;
        const empty = Array.from({ length: creative.total }, (_, k) => k).find((k) => creative.picks[k] === undefined);
        if (empty !== undefined) creative.active = empty;
        render(state, mission);
      }
    })));
  }

  // 미리 보기 줄: 누르면 그 줄을 다시 고른다.
  function previewLine(content, k, state, mission) {
    const b = el('button', { type: 'button', class: 'sv-mp-line', 'aria-pressed': k === creative.active ? 'true' : 'false' }, content);
    b.addEventListener('click', () => { creative.active = k; render(state, mission); });
    return b;
  }

  // C-1 행성 랩(9-3): 완성한 카드 하나 → 2~4줄
  function renderRap(state, mission) {
    if (!creative.target) {
      pickTarget('완성한 행성 카드를 하나 골라요.', donePlanets().map((id) => ({ id, name: bodyById(id).name })), state, mission);
      return;
    }
    const id = creative.target;
    const name = bodyById(id).name;
    const lines = RAP_LINES[id];
    creative.total = lines.length;
    const chosen = lines.map((opts, k) => (creative.picks[k] === undefined ? null : opts[creative.picks[k]]));
    body.append(
      el('div', { class: 'sv-mp-rap' }, [
        el('div', { class: 'sv-mp-rap-head' }, [el('span', { class: 'sv-mp-kicker' }, [icon('i-star'), `${name} 랩`]), againButton('다른 행성', state, mission)]),
        el('p', { class: 'sv-mp-line is-fixed' }, rapNameLine(name)),
        ...chosen.map((t, k) => previewLine(t ?? el('span', { class: 'sv-blank' }, `${k + 2}줄`), k, state, mission))
      ]),
      el('span', { class: 'sv-mp-sub' }, `${creative.active + 2}줄을 골라요`),
      lineChoices(lines[creative.active], state, mission)
    );
    foot.append(primaryButton({
      label: '랩 완성하기', disabled: !chosen.every(Boolean),
      onClick: () => {
        const all = [rapNameLine(name), ...chosen];
        onCreative({ text: all.join(' '), memo: name, detail: { planet: id, lines: all } });
      }
    }));
  }

  // C-2 새 별자리 이름(9-5): 이어 그린 별자리 하나 → 빈칸 두 개
  function renderNaming(state, mission, step) {
    if (!creative.target) {
      pickTarget('이어 그린 별자리를 하나 골라요.', step.constellations, state, mission);
      return;
    }
    const target = step.constellations.find((c) => c.id === creative.target);
    creative.total = step.blanks.length;
    const words = step.blanks.map((b, k) => (creative.picks[k] === undefined ? null : b.options[creative.picks[k]]));
    body.append(
      el('div', { class: 'sv-mp-rap' }, [
        el('div', { class: 'sv-mp-rap-head' }, [el('span', { class: 'sv-mp-kicker' }, [icon('i-star'), target.name]), againButton('다른 별자리', state, mission)]),
        ...step.blanks.map((b, k) => previewLine(sentence(b.text, words[k]), k, state, mission))
      ]),
      lineChoices(step.blanks[creative.active].options, state, mission, { grid: true })
    );
    foot.append(primaryButton({
      label: '이름 붙이기', disabled: !words.every(Boolean),
      onClick: () => {
        const lines = step.blanks.map((b, k) => fillSentence(b.text, words[k]));
        onCreative({ text: lines.join(' '), memo: target.name, detail: { constellation: target.id, lines } });
      }
    }));
  }

  return {
    render,
    setOpen,
    isOpen: () => open,
    isShown: () => open && !hidden,
    setHidden(on) { hidden = on; layout(); },
    element: panel,
    // 탐색 단계 안내 띠(text가 없으면 숨김)
    // action({ label, onClick })이 있으면 띠 오른쪽에 버튼이 붙는다(탐사 2 '질문 풀기')
    setStrip(text, action = null) {
      strip.hidden = !text;
      app.classList.toggle('sv-strip-on', Boolean(text)); // 안내 띠가 있으면 혜성·소행성 소개 카드를 그 아래로
      stripText.textContent = text ?? '';
      stripGo.hidden = !action;
      stripGo.textContent = action?.label ?? '';
      stripGo.onclick = action ? action.onClick : null;
    },
    reset() { lastKey = null; summaryPick = null; }
  };
}
