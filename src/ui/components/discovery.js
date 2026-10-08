// 발견 카드(motion.md '발견 카드'): 화면 아래 가운데에서 올라와 3초 머물고 사라진다. 같은 카드는 한 번만.
import { el } from './dom.js';
import { icon } from './icon.js';

const STAY_MS = 3000;

export function createDiscoveryCards(container) {
  const shown = new Set();

  return {
    // id가 같은 카드는 다시 띄우지 않는다. 띄웠으면 true. iconName: 발견이 아닌 안내는 'i-hint'
    show(id, text, iconName = 'i-star') {
      if (shown.has(id)) return false;
      shown.add(id);
      const card = el('div', { class: 'sv-discovery sv-discovery--enter', role: 'status' }, [icon(iconName), text]);
      container.append(card);
      setTimeout(() => {
        card.classList.add('sv-discovery--leave');
        card.addEventListener('animationend', () => card.remove(), { once: true });
        // 움직임 줄이기로 애니메이션이 없으면 animationend가 오지 않으므로 바로 지운다.
        if (getComputedStyle(card).animationName === 'none') card.remove();
      }, STAY_MS);
      return true;
    },
    reset() { shown.clear(); }
  };
}
