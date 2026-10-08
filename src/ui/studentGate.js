// 탐사 대원 등록(S01, 기획서 10-1): 학년(버튼 6개) · 반·번호(−/+ 와 직접 적기) · 이름 → '탐사 시작하기'.
// 검증은 student/studentInfo.js(달빛 관측소와 같은 규칙). 틀린 칸은 주황 테두리와 ⚠ 문구(S01).
// 학생 이름은 화면 입력칸 말고는 어디에도 남기지 않는다(콘솔·오류 메시지 금지).
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { validateStudentInfo } from '../student/studentInfo.js';

const CREDIT = '태양·행성 질감: Solar System Scope (CC BY 4.0) · 지구·달 질감: NASA';

export function createStudentGate(screen, { onSubmit }) {
  let grade = null;
  const gradeButtons = [1, 2, 3, 4, 5, 6].map((g) => {
    const b = el('button', { type: 'button', 'aria-pressed': 'false' }, String(g));
    b.addEventListener('click', () => { grade = g; syncGrade(); clearError('grade'); });
    return b;
  });
  const syncGrade = () => gradeButtons.forEach((b, i) => b.setAttribute('aria-pressed', i + 1 === grade ? 'true' : 'false'));

  // 반·번호: 시안의 −/+ 사이 숫자 칸에 직접 적을 수도 있다(번호 25를 +로 25번 누르지 않게).
  function stepper(label, max) {
    const input = el('input', { class: 'sv-stepper-num', type: 'text', inputmode: 'numeric', maxlength: '2', 'aria-label': label, placeholder: '–' });
    const step = (d) => {
      const n = Number(input.value) || 0;
      input.value = String(Math.min(max, Math.max(1, n + d)));
      clearError(label === '반' ? 'cls' : 'number');
    };
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); clearError(label === '반' ? 'cls' : 'number'); });
    const minus = el('button', { type: 'button', 'aria-label': `${label} 줄이기` }, icon('i-minus'));
    const plus = el('button', { type: 'button', 'aria-label': `${label} 늘리기` }, icon('i-plus'));
    minus.addEventListener('click', () => step(-1));
    plus.addEventListener('click', () => step(1));
    return { input, node: el('div', { class: 'sv-field' }, [el('span', { class: 'sv-field-label' }, label), el('div', { class: 'sv-stepper' }, [minus, input, plus])]) };
  }
  const cls = stepper('반', 20);
  const num = stepper('번호', 40);

  const nameInput = el('input', { id: 'sv-reg-name', class: 'sv-input', type: 'text', placeholder: '이름을 적어요', autocomplete: 'off', maxlength: '20' });
  nameInput.addEventListener('input', () => clearError('name'));
  const errors = {
    grade: el('span', { class: 'sv-error', hidden: true }),
    cls: el('span', { class: 'sv-error', hidden: true }),
    number: el('span', { class: 'sv-error', hidden: true }),
    name: el('span', { class: 'sv-error', hidden: true })
  };
  const inputs = { cls: cls.input, number: num.input, name: nameInput };

  function showError(field, text) {
    errors[field].replaceChildren(icon('i-warn'), text);
    errors[field].hidden = false;
    inputs[field]?.classList.add('is-error');
    inputs[field]?.setAttribute('aria-invalid', 'true');
    (inputs[field] ?? gradeButtons[0]).focus();
  }
  function clearError(field) {
    errors[field].hidden = true;
    inputs[field]?.classList.remove('is-error');
    inputs[field]?.removeAttribute('aria-invalid');
  }

  const start = el('button', { type: 'submit', class: 'sv-primary sv-reg-start' }, ['탐사 시작하기', icon('i-next')]);
  const form = el('form', { class: 'sv-glass sv-card-panel sv-reg', 'aria-label': '탐사 대원 등록', novalidate: true }, [
    el('div', { class: 'sv-reg-brand' }, [
      el('span', { class: 'sv-reg-en' }, 'STAR VOYAGER'),
      el('h1', { class: 'sv-reg-ko' }, '별빛 탐사선'),
      el('span', { class: 'sv-reg-sub' }, '탐사 대원 등록')
    ]),
    el('div', { class: 'sv-field', role: 'group', 'aria-label': '학년' }, [
      el('span', { class: 'sv-field-label' }, '학년'), el('div', { class: 'sv-reg-grade' }, gradeButtons), errors.grade
    ]),
    el('div', { class: 'sv-reg-row2' }, [
      el('div', {}, [cls.node, errors.cls]),
      el('div', {}, [num.node, errors.number])
    ]),
    el('div', { class: 'sv-field' }, [el('label', { for: 'sv-reg-name', class: 'sv-field-label' }, '이름'), nameInput, errors.name]),
    start
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.keys(errors).forEach(clearError);
    // S01 문구: 아직 고르거나 적지 않은 칸
    if (grade === null) return showError('grade', '학년을 골라 주세요.');
    if (!cls.input.value) return showError('cls', '반을 적어 주세요.');
    if (!num.input.value) return showError('number', '번호를 적어 주세요.');
    if (!nameInput.value.trim()) return showError('name', '이름을 적어 주세요.');
    const check = validateStudentInfo({ grade, cls: cls.input.value, number: num.input.value, name: nameInput.value });
    if (!check.ok) return showError(check.field, check.error);
    onSubmit(check.value);
  });

  const root = el('div', { class: 'sv-reg-wrap', hidden: true }, [form, el('p', { class: 'sv-reg-credit' }, CREDIT)]);
  screen.append(root);

  return {
    show() {
      grade = null;
      syncGrade();
      cls.input.value = '';
      num.input.value = '';
      nameInput.value = '';
      Object.keys(errors).forEach(clearError);
      root.hidden = false;
    },
    hide() { root.hidden = true; nameInput.value = ''; }
  };
}
