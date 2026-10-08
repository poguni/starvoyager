// 탐사 선택(S02, 기획서 7장): 대원 정보 · '다른 친구가 사용해요' · 탐사 카드 4장(순서 잠금 없음) · 제출 대기 안내.
// 카드 그림은 앱의 실제 3D 장면을 캡처한 사진(public/thumbs/, docs/결정기록.md 2026-10-08).
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { confirmDialog } from './components/dialog.js';

const STATUS = {
  done: { cls: 'sv-status--done', icon: 'i-check', text: '완료' },
  doing: { cls: 'sv-status--doing', icon: 'i-play', text: '진행 중 · 이어서 하기' },
  todo: { cls: 'sv-status--todo', icon: null, text: '시작 전' }
};
const CONFIRM_TEXT = '도감과 탐사 기록을 모두 지우고 새 친구가 시작할까요?';

export function createMissionSelect(screen, { missions, onPick, onSwitch, onRetry }) {
  const who = el('div', { class: 'sv-ms-who' });
  const switchButton = el('button', { type: 'button', class: 'sv-ghost' }, '다른 친구가 사용해요');
  const cards = el('div', { class: 'sv-ms-cards' });
  const queueText = el('span');
  const retry = el('button', { type: 'button', class: 'sv-ghost sv-ms-retry' }, [icon('i-resend'), '다시 보내기']);
  const queue = el('span', { class: 'sv-queue', role: 'status', hidden: true }, [icon('i-warn'), queueText, retry]);
  retry.addEventListener('click', () => onRetry());

  // 확인 상자를 한 번 거친다(디자인 시스템 확인 대화 상자)
  switchButton.addEventListener('click', async () => {
    if (await confirmDialog({ title: '다른 친구가 사용해요', message: CONFIRM_TEXT, confirmLabel: '지우기', container: screen })) onSwitch();
  });

  const root = el('div', { class: 'sv-ms', hidden: true }, [
    el('div', { class: 'sv-ms-top' }, [who, switchButton]),
    el('h1', { class: 'sv-ms-heading' }, ['오늘은 어디를 탐사할까요?', el('small', {}, '탐사를 하나 골라요. 순서대로 하지 않아도 돼요.')]),
    cards,
    el('div', { class: 'sv-ms-bottom' }, [queue, el('span', { class: 'sv-ms-brand' }, ['STAR VOYAGER', el('span', {}, '·'), '별빛 탐사선'])])
  ]);
  screen.append(root);

  function card(m, status, journal) {
    const s = STATUS[status];
    const meter = m.id === 2 && journal
      ? el('div', { class: 'sv-ms-meter' }, [
        el('span', {}, '도감'),
        el('span', { class: 'sv-ms-meter-bar' }, el('span', { style: `width:${(journal.count / journal.total) * 100}%` })),
        el('span', { class: 'sv-ms-meter-num' }, `${journal.count}/${journal.total}`)
      ])
      : null;
    const b = el('button', { type: 'button', class: status === 'doing' ? 'sv-mission-card is-active' : 'sv-mission-card' }, [
      el('div', { class: 'sv-ms-art', 'aria-hidden': 'true' }, el('img', { src: `${import.meta.env.BASE_URL}thumbs/mission-${m.id}.jpg`, alt: '' })),
      el('span', { class: 'sv-mission-card-num' }, m.code),
      el('span', { class: 'sv-mission-card-title' }, m.name),
      el('span', { class: 'sv-mission-card-desc' }, m.desc),
      meter,
      el('span', { class: `sv-status ${s.cls}` }, [s.icon && icon(s.icon), s.text])
    ]);
    b.addEventListener('click', () => onPick(m.id));
    return b;
  }

  return {
    // student: 학년·반·번호·이름(시연 모드면 null), statuses: {id: 'todo'|'doing'|'done'}, journal: {count, total}
    show({ student, statuses, journal, demo = false }) {
      who.replaceChildren(icon('i-user'), ...(student
        ? [el('span', {}, `${student.grade}학년 ${student.cls}반 ${student.number}번`), el('b', {}, `${student.name} 대원`)]
        : [el('b', {}, demo ? '시연 모드' : '')]));
      switchButton.hidden = demo;
      cards.replaceChildren(...missions.map((m) => card(m, statuses[m.id] ?? 'todo', journal)));
      root.hidden = false;
    },
    hide() { root.hidden = true; who.replaceChildren(); },
    isShown: () => !root.hidden,
    setQueue(size) {
      queue.hidden = size === 0;
      queueText.textContent = `제출 대기 중 ${size}개 · 인터넷이 연결되면 다시 보내요`;
    }
  };
}
