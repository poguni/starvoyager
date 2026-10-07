// 크기 비교 실험실 이름표(S07): 행성 아래에 이름, 실제 크기로 볼 때만 지구 기준 "약 ○배".
// 이름 보기를 끄면 모두 숨긴다. 태양과 비교할 때는 태양 가장자리에 "태양 약 109배".
import { el } from './components/dom.js';
import { PLANETS, SUN } from '../model/world.js';
import { timesLabel, easyTimes, sizeOf } from '../model/sizes.js';

const GAP = 12;

export function createSizeLabels(container) {
  const layer = el('div', { class: 'sv-size-labels', 'aria-hidden': 'true' });
  container.append(layer);
  const make = (name, times) => {
    const small = el('small', {}, times);
    const node = el('div', { class: 'sv-size-label' }, [name, small]);
    layer.append(node);
    return { node, small };
  };
  const labels = Object.fromEntries(PLANETS.map((p) => [p.id, make(p.name, timesLabel(p.id))]));
  const sun = make(SUN.name, `약 ${easyTimes(sizeOf('sun'))}배`);
  sun.node.classList.add('sv-size-label--sun');

  return {
    setVisible(on) { layer.hidden = !on; },
    remove: () => layer.remove(),
    // items: sizeLayout의 행성 자리, sunInfo: 태양 자리, real: 실제 크기로 다 바뀌었는지
    update(items, sunInfo, { real }) {
      for (const it of items) {
        const { node, small } = labels[it.id];
        node.style.transform = `translate(${it.x}px, ${it.y + it.r + GAP}px) translateX(-50%)`;
        small.hidden = !real;
      }
      sun.node.hidden = !sunInfo.shown;
      sun.node.style.transform = `translate(${sunInfo.edge - GAP * 2}px, ${sunInfo.y}px) translate(-100%, -50%)`;
    }
  };
}
