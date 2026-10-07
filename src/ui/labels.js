// 3D 위 천체 이름표(S03의 .sv-label). 이름 보기를 켜면 보인다. 이름표를 눌러도 그 천체로 날아간다.
import { el } from './components/dom.js';
import { screenCircle } from '../scene/picking.js';

const GAP_PX = 8;

export function createLabels({ container, map, onPick }) {
  const labels = {};
  for (const [id, obj] of Object.entries(map.objects)) {
    labels[id] = el('button', {
      type: 'button',
      class: id === 'moon' ? 'sv-label sv-label--small' : 'sv-label',
      onclick: () => onPick(id)
    }, obj.body.name);
    container.append(labels[id]);
  }
  let visible = true;
  let hiddenId = null; // 행성 탐사 중인 천체는 목적지 칸에 이름이 있으므로 이름표를 숨긴다

  // 매 프레임: 천체 바로 아래(태양은 화면에 보이는 부분의 가운데)에 이름표를 둔다.
  function update(camera, rect) {
    for (const [id, label] of Object.entries(labels)) {
      if (!visible || id === hiddenId || !map.labelKept(id)) { label.hidden = true; continue; }
      const pos = map.worldPosition(id, camera.position);
      const c = screenCircle(camera, rect, pos, map.radiusOf(id));
      let x = c?.x;
      let y = c ? c.y + (id === 'asteroids' ? 0 : c.r) + GAP_PX : 0;
      if (c && id === 'moon') {
        // 달은 지구 이름표와 겹치지 않도록 오른쪽 옆에 둔다.
        x = c.x + c.r + GAP_PX + 18;
        y = c.y - 14;
      }
      if (c && id === 'sun') {
        x = Math.max(c.x, Math.min(c.x + c.r * 0.55, 80));
        y = c.y;
      }
      const off = !c || x < 0 || x > rect.width || y < 0 || y > rect.height;
      label.hidden = off;
      if (!off) label.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
    }
  }

  return {
    update,
    setVisible(on) { visible = on; },
    hide(id) { hiddenId = id; }
  };
}
