// 혜성·소행성 소개 카드(시안 없음, 유리 패널 부품). 그 천체에 도착하면 왼쪽 위 모형 안내 아래에 보이고,
// 다른 곳으로 가거나 닫기를 누르면 사라진다.
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { BODY_INFO } from '../data/bodyInfo.js';

export function createBodyInfo(container) {
  const title = el('h2', { class: 'sv-body-info-title' });
  const list = el('ul', { class: 'sv-body-info-lines' });
  const close = el('button', { type: 'button', class: 'sv-body-info-close', 'aria-label': '소개 닫기', onclick: () => hide() }, icon('i-close'));
  const root = el('section', { class: 'sv-glass sv-body-info', role: 'status', hidden: true }, [
    el('div', { class: 'sv-body-info-head' }, [icon('i-info'), title, close]),
    list
  ]);
  container.append(root);

  function hide() { root.hidden = true; }

  return {
    // 소개가 있는 천체면 보이고 true
    show(id) {
      const info = BODY_INFO[id];
      if (!info) { hide(); return false; }
      title.textContent = info.title;
      list.replaceChildren(...info.lines.map((line) => el('li', {}, line)));
      root.hidden = false;
      return true;
    },
    hide
  };
}
