// 오른쪽 패널 틀(components.css의 .sv-panel). 도감은 종이(.sv-journal), 미션은 어두운 유리(.sv-mission).
// 안의 내용은 각 Phase의 도감·미션 화면이 채운다.
import { el } from './dom.js';
import { icon } from './icon.js';

export function panelFrame({ kind = 'journal', children = [] } = {}) {
  const skin = kind === 'mission' ? 'sv-mission' : 'sv-journal';
  return el('section', { class: `sv-panel ${skin}` }, children);
}

// 접힌 도감 손잡이(S03). 누르면 onClick.
export function panelHandle({ label = '도감', onClick } = {}) {
  return el('button', { type: 'button', class: 'sv-panel-handle', onclick: onClick }, [icon('i-journal'), label]);
}
