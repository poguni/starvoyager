// 발표 화면(S09, 기획서 8-5): 왼쪽에 3D 행성, 오른쪽에 크게 확대한 도감 카드, 닫기 버튼.
// 3D 행성 배치와 HUD 감추기는 main.js가 한다. 탐사 2에서 만든 행성 랩이 있으면 카드 아래에 보인다(S09).
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { FACTS } from '../data/planetFacts.js';
import { bodyById } from '../model/world.js';
import { recordList, stampEl, stampNumber } from './journalPanel.js';

export function createPresentView(app, { journal, onClose }) {
  const title = el('b');
  const who = el('p', { class: 'sv-present-who' }, ['발표하기', title]);
  const card = el('section', { class: 'sv-journal sv-present-card', 'aria-label': '도감 카드' });
  const close = el('button', { type: 'button', class: 'sv-present-close', 'aria-label': '발표 화면 닫기', onclick: () => onClose() }, icon('i-close'));
  const root = el('div', { class: 'sv-present', hidden: true }, [who, card, close]);
  app.append(root);

  return {
    show(id) {
      const name = bodyById(id).name;
      const { order, rap } = journal.getCard(id);
      title.textContent = `${name} 도감 카드`;
      card.setAttribute('aria-label', `${name} 도감 카드`);
      // S09처럼 그 밖의 특징은 고른 것이 있을 때만 줄을 보인다.
      const hasFeatures = journal.recordOf(id).features.length > 0;
      card.replaceChildren(
        el('div', { class: 'sv-journal-head' }, [
          el('div', { class: 'sv-journal-title' }, [el('span', { class: 'sv-journal-kicker' }, '탐사 도감'), el('span', { class: 'sv-journal-name' }, name)]),
          stampEl(stampNumber(order, journal.total))
        ]),
        recordList(journal, id, { features: hasFeatures }),
        el('p', { class: 'sv-fact' }, FACTS[id]),
        ...(rap ? [el('div', { class: 'sv-present-rap' }, [
          el('span', { class: 'sv-present-rap-title' }, [icon('i-star'), '내가 만든 행성 랩']),
          ...rap.map((t) => el('p', {}, t))
        ])] : [])
      );
      root.hidden = false;
      close.focus();
    },
    hide() { root.hidden = true; },
    isOpen: () => !root.hidden
  };
}
