// 끌어다 놓기 활동(기획서 9-4 문항 3-3 줄 세우기, 3-4 나누어 담기, S07, motion.md '끌어다 놓기').
//   카드를 끌어 칸·상자에 놓거나, 카드를 누른 뒤 칸을 눌러 옮긴다(docs/결정기록.md 2026-10-08).
//   카드가 있는 칸에 놓으면 두 카드가 자리를 바꾼다. 남은 카드 줄로 되돌릴 수도 있다.
//   '확인' → 맞으면 통과, 틀리면 틀린 카드만 흔들리고 한 번 더. 2차도 틀리면 1초 동안 정답 자리로 옮긴다.
// 판정은 model/arrange.js가 하고, 끝나면 onDone(처음·최종 배치)을 부른다(미션 연결은 Phase 9A).
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { primaryButton } from './components/buttons.js';
import { createArrangeTask } from '../model/arrange.js';
import { PLANETS } from '../model/world.js';

const DRAG_START_PX = 6;
const REVEAL_MS = 1000;
const TEXT = {
  sort: '행성을 크기가 큰 순서대로 줄 세워 봐요.',
  classify: '지구보다 작은 행성과 큰 행성으로 나누어 담아 봐요.',
  wrong: '자리가 맞지 않는 카드가 있어요. 한 번 더 해 봐요.',
  correct: '정답이에요!',
  revealed: '정답 자리로 옮겼어요.'
};

// kind: 'sort' | 'classify'
export function createArrangeBoard(root, { kind, onDone }) {
  const task = createArrangeTask(kind);
  const sort = kind === 'sort';
  // 남은 카드는 태양에서 가까운 순서로 둔다(정답 순서가 아니게)
  const movable = PLANETS.map((p) => p.id).filter((id) => sort || id !== 'earth');
  const zones = { tray: [...movable], slots: Array(8).fill(null), small: [], large: [] };
  const wrong = new Set();
  let shake = false;
  let selected = null;
  let locked = false;

  // ---- 카드 ----
  const cards = {};
  for (const p of PLANETS) {
    const fixed = !sort && p.id === 'earth';
    cards[p.id] = el('button', {
      type: 'button', class: fixed ? 'sv-card is-fixed' : 'sv-card', 'data-id': p.id,
      'aria-label': fixed ? `${p.name}(기준)` : p.name, disabled: fixed
    }, [el('span', { class: 'sv-card-dot', 'data-accent': p.id }), p.name]);
    if (!fixed) bindCard(p.id);
  }

  // ---- 칸·상자 ----
  const zoneEls = {};
  const zone = (key, node) => { node.dataset.zone = key; zoneEls[key] = node; node.addEventListener('click', onZoneClick); return node; };
  const tray = zone('tray', el('div', { class: 'sv-tray', 'aria-label': '남은 카드' }));
  let field;
  if (sort) {
    const slots = zones.slots.map((_, i) => zone(`slot:${i}`, el('div', { class: 'sv-slot' }, el('span', { class: 'sv-slot-num' }, String(i + 1)))));
    field = [
      el('div', { class: 'sv-arrow-label' }, [el('span', {}, '큰 쪽 ←'), el('span', {}, '→ 작은 쪽')]),
      el('div', { class: 'sv-slots' }, slots)
    ];
  } else {
    const box = (key, title) => zone(key, el('div', { class: 'sv-ab-box' }, [el('span', { class: 'sv-ab-box-title' }, title), el('div', { class: 'sv-ab-box-cards' })]));
    field = [el('div', { class: 'sv-ab-zones' }, [
      box('small', '지구보다 작은 행성'),
      el('div', { class: 'sv-ab-ref' }, [el('span', { class: 'sv-ab-box-title' }, '기준'), cards.earth]),
      box('large', '지구보다 큰 행성')
    ])];
  }

  const check = primaryButton({ iconName: 'i-check', label: '확인', disabled: true, onClick: onCheck });
  check.classList.add('sv-ab-check');
  const notice = el('div', { class: 'sv-notice', role: 'status', hidden: true });
  const board = el('section', { class: 'sv-glass sv-board sv-ab', 'aria-label': sort ? '줄 세우기' : '나누어 담기' }, [
    el('div', { class: 'sv-ab-head' }, [el('h2', { class: 'sv-ab-q' }, TEXT[kind]), check]),
    ...field,
    el('div', { class: 'sv-ab-foot' }, [tray, notice])
  ]);
  root.append(board);

  // ---- 상태 ----
  function zoneOf(id) {
    if (zones.tray.includes(id)) return 'tray';
    if (zones.small.includes(id)) return 'small';
    if (zones.large.includes(id)) return 'large';
    const i = zones.slots.indexOf(id);
    return i >= 0 ? `slot:${i}` : null;
  }

  function take(id) {
    const at = zoneOf(id);
    if (at.startsWith('slot:')) zones.slots[Number(at.slice(5))] = null;
    else zones[at].splice(zones[at].indexOf(id), 1);
    return at;
  }

  function put(id, key) {
    if (key.startsWith('slot:')) zones.slots[Number(key.slice(5))] = id;
    else zones[key].push(id);
  }

  // id 카드를 key 자리로. 카드가 있는 칸이면 그 카드는 id가 있던 자리로 간다.
  function move(id, key) {
    if (locked || zoneOf(id) === key) { render(); return; }
    const occupant = key.startsWith('slot:') ? zones.slots[Number(key.slice(5))] : null;
    const from = take(id);
    if (occupant) { take(occupant); put(occupant, from); wrong.delete(occupant); }
    put(id, key);
    wrong.delete(id);
    render();
  }

  const arrangement = () => (sort ? [...zones.slots] : { small: [...zones.small], large: [...zones.large] });

  function render() {
    tray.replaceChildren(...zones.tray.map((id) => cards[id]));
    if (sort) zones.slots.forEach((id, i) => { const slot = zoneEls[`slot:${i}`]; slot.replaceChildren(slot.firstChild, ...(id ? [cards[id]] : [])); });
    else for (const key of ['small', 'large']) zoneEls[key].lastChild.replaceChildren(...zones[key].map((id) => cards[id]));
    for (const id of movable) {
      const c = cards[id];
      c.classList.toggle('is-wrong', wrong.has(id));
      c.classList.toggle('sv-ab-shake', shake && wrong.has(id));
      c.classList.toggle('is-selected', selected === id);
      c.disabled = locked;
    }
    shake = false;
    check.disabled = locked || !task.isComplete(arrangement());
  }

  function showNotice(type, text) {
    notice.className = { wrong: 'sv-notice', correct: 'sv-banner-ok', revealed: 'sv-notice sv-notice--info' }[type];
    notice.replaceChildren(icon({ wrong: 'i-warn', correct: 'i-check', revealed: 'i-info' }[type]), text);
    notice.hidden = false;
  }

  function onCheck() {
    const res = task.check(arrangement());
    if (!res) return;
    wrong.clear();
    if (res.result === 'retry') {
      const ids = sort ? res.wrong.map((i) => zones.slots[i]) : res.wrong;
      ids.forEach((id) => wrong.add(id));
      shake = true;
      showNotice('wrong', TEXT.wrong);
      render();
      return;
    }
    locked = true;
    selected = null;
    if (res.result === 'revealed') revealAnswer();
    else render();
    showNotice(res.result, TEXT[res.result]);
    onDone?.(res.record);
  }

  // 카드들이 1초 동안 정답 자리로 움직인다(motion.md '끌어다 놓기').
  function revealAnswer() {
    const before = Object.fromEntries(movable.map((id) => [id, cards[id].getBoundingClientRect()]));
    zones.tray = [];
    if (sort) zones.slots = [...task.answer];
    else { zones.small = [...task.answer.small]; zones.large = [...task.answer.large]; }
    render();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const id of movable) {
      const c = cards[id];
      const after = c.getBoundingClientRect();
      if (reduce) continue;
      c.style.transition = 'none';
      c.style.translate = `${before[id].left - after.left}px ${before[id].top - after.top}px`;
      void c.offsetWidth;
      c.style.transition = `translate ${REVEAL_MS}ms var(--sv-ease)`;
      c.style.translate = '';
      setTimeout(() => { c.style.transition = ''; }, REVEAL_MS);
    }
  }

  // ---- 끌기·누르기 ----
  let justDragged = false;
  function bindCard(id) {
    const c = cards[id];
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      if (locked || e.button > 0) return;
      c.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, moving: false, over: null };
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moving && Math.hypot(dx, dy) < DRAG_START_PX) return;
      if (!drag.moving) { drag.moving = true; c.classList.add('is-dragging'); selected = null; }
      c.style.translate = `${dx}px ${dy}px`;
      const over = zoneAt(e.clientX, e.clientY, c);
      if (over !== drag.over) {
        zoneEls[drag.over]?.classList.remove('is-target');
        zoneEls[over]?.classList.add('is-target');
        drag.over = over;
      }
    });
    const end = (e, drop) => {
      if (!drag) return;
      const { moving, over } = drag;
      drag = null;
      c.classList.remove('is-dragging');
      c.style.translate = '';
      zoneEls[over]?.classList.remove('is-target');
      if (!moving) return;
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 0);
      if (drop && over) move(id, over);
      else render();
    };
    c.addEventListener('pointerup', (e) => end(e, true));
    c.addEventListener('pointercancel', (e) => end(e, false));
    // 놓기 신호 없이 끌기가 끊겨도(브라우저가 포인터를 놓친 경우) 카드가 떠 있지 않게 제자리로
    c.addEventListener('lostpointercapture', (e) => end(e, false));
    // 누르기: 카드 고르기 → 칸(또는 다른 카드)을 눌러 옮기기
    c.addEventListener('click', (e) => {
      e.stopPropagation();
      if (justDragged || locked) return;
      if (selected === id) selected = null;
      else if (selected && zoneOf(id) !== 'tray') { const s = selected; selected = null; move(s, zoneOf(id)); return; }
      else selected = id;
      render();
    });
  }

  function zoneAt(x, y, self) {
    for (const node of document.elementsFromPoint(x, y)) {
      if (node === self || self.contains(node)) continue;
      const z = node.closest?.('[data-zone]');
      if (z && board.contains(z)) return z.dataset.zone;
    }
    return null;
  }

  function onZoneClick(e) {
    if (!selected || locked) return;
    const s = selected;
    selected = null;
    move(s, e.currentTarget.dataset.zone);
  }

  render();
  return { element: board, destroy: () => board.remove() };
}
