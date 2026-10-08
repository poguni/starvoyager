// 미션 패널(S06·S06b, motion.md '미션'): 도감 패널 자리(오른쪽)에 나타나는 어두운 유리 패널.
//   진행 표시("탐사 2 · 문항 1/3" + 점) · 질문 · 보기 · 오답 힌트 · 정답 배너 · 정답 공개 · 한 줄 정리.
//   탐색 단계에서는 패널 대신 왼쪽 위 작은 안내 띠만 보인다(docs/결정기록.md 2026-10-08).
// 상태는 missions/engine.js가 갖고, 이 파일은 그리기와 누르기만 한다.
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { primaryButton } from './components/buttons.js';
import { fillSentence } from '../missions/engine.js';
import { withIeyo } from '../model/josa.js';

const CONFIRM_TEXT = '직접 관찰한 뒤 답을 다시 골라요.'; // S06
const CUE_ICON = {
  sunlight: 'i-sun-off', play: 'i-play', next: 'i-next', land: 'i-land', loupe: 'i-ring',
  real: 'i-scale', sunCompare: 'i-sun', time: 'i-star', names: 'i-label', lights: 'i-city'
};

// 정답 공개 상자 머리말(S06b B "정답은 4개예요"). '…요'로 끝나는 보기는 조사를 붙이지 않는다.
const revealKey = (text) => (text.endsWith('요') ? `정답: ${text}` : `정답은 ${withIeyo(text)}`);

export function createMissionPanel(app, { onPredict, onFinal, onSummary, onNext, onDay, onExit }) {
  const progressText = el('span');
  const dots = el('span', { class: 'sv-dots', 'aria-hidden': 'true' });
  const body = el('div', { class: 'sv-mp-body' });
  const foot = el('div', { class: 'sv-mp-foot' });
  const panel = el('section', { class: 'sv-mission sv-mp', 'aria-label': '미션', 'aria-live': 'polite' }, [
    el('div', { class: 'sv-mission-progress' }, [progressText, dots]), body, foot
  ]);
  const stripText = el('span');
  const strip = el('div', { class: 'sv-glass sv-mp-strip', role: 'status', hidden: true }, [icon('i-star'), stripText]);
  app.append(panel, strip);

  let open = false;
  let hidden = false;
  let summaryPick = null; // 한 줄 정리에서 고른 보기(문장 완성하기 전)
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
    if (fresh) summaryPick = null;
    const n = mission.id;
    body.replaceChildren();
    foot.replaceChildren();
    panel.classList.toggle('is-wide', false);

    // 진행 표시
    if (stage === 'summary' || stage === 'summaryResult') progressText.textContent = `탐사 ${n} · 한 줄 정리`;
    else if (stage === 'intro') progressText.textContent = `탐사 ${n} · ${step.title}`;
    else if (stage === 'feel') progressText.textContent = `탐사 ${n} · 보고 느끼기`;
    else if (stage === 'done') progressText.textContent = `탐사 ${n}`;
    else progressText.textContent = `탐사 ${n} · 문항 ${state.itemNumber}/${state.itemTotal}`;
    progressDots(stage === 'done' || stage.startsWith('summary') || stage === 'feel' ? state.itemTotal : state.itemNumber, state.itemTotal);

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

    if (stage === 'done') {
      body.append(el('div', { class: `sv-banner-ok${fresh ? ' sv-mp-drop' : ''}`, role: 'status' }, [icon('i-check'), `탐사 ${n}${'을를을를'[n - 1]} 마쳤어요!`]));
      foot.append(primaryButton({ label: '탐사 끝내기', onClick: onExit }));
    }
  }

  return {
    render,
    setOpen,
    isOpen: () => open,
    isShown: () => open && !hidden,
    setHidden(on) { hidden = on; layout(); },
    element: panel,
    // 탐색 단계 안내 띠(text가 없으면 숨김)
    setStrip(text) { strip.hidden = !text; stripText.textContent = text ?? ''; },
    reset() { lastKey = null; summaryPick = null; }
  };
}
