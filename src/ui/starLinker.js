// 별 이어 그리기 화면 요소(S08, motion.md '북쪽 밤하늘').
//   별자리 별(점과 64px 누르는 자리), 이은 선(0.3초 동안 그어짐), 점선 안내(시작 전 별자리만),
//   힌트(다음 별이 1초 주기로 두 번 반짝임), 잘못 누른 별은 작게 흔들림,
//   완성하면 선화가 1초 동안 은은하게 나타남, 이름표(북극성·완성한 별자리), 방위(북서·북·북동).
// 위치는 매 프레임 sky.starOnScreen()으로 맞춘다(시각을 바꾸면 선도 별을 따라 돈다).
import { el } from './components/dom.js';
import { POLARIS } from '../data/constellations.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const HIT_RADIUS = 40; // 누른 곳에서 이 거리 안의 가장 가까운 별을 고른다
const LABEL_MIN_Y = 140; // 이름표가 위 계기판(높이 약 110px) 아래에 오도록
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// after: 이 요소 바로 뒤에 넣는다(HUD보다 아래 층)
export function createStarLinker(app, { sky, link, constellations, art, after }) {
  const layer = el('div', { class: 'sv-sky-layer' });
  const svg = svgEl('svg', { class: 'sv-sky-lines', 'aria-hidden': 'true' });
  const starLayer = el('div', { class: 'sv-sky-stars' });
  const labelLayer = el('div', { class: 'sv-sky-labels', 'aria-hidden': 'true' });
  const hintRing = el('span', { class: 'sv-star-next', hidden: true });
  layer.append(svg, starLayer, hintRing, labelLayer);
  after.after(layer);

  // ---- 별자리별 그림 요소 ----
  const groups = {};
  for (const c of constellations) {
    const artGroup = svgEl('g', { class: 'sv-sky-art' });
    for (const d of art[c.art].paths) artGroup.append(svgEl('path', { d, 'vector-effect': 'non-scaling-stroke' }));
    const guide = svgEl('g', { class: 'sv-sky-guide' });
    const done = svgEl('g', { class: 'sv-sky-done' });
    const guideLines = c.lines.map(() => guide.appendChild(svgEl('line')));
    svg.append(artGroup, guide, done);
    const label = el('span', { class: 'sv-label sv-sky-label', hidden: true }, c.label);
    labelLayer.append(label);
    groups[c.id] = { c, artGroup, guide, guideLines, done, doneLines: new Map(), label };
  }
  const polarisLabel = el('span', { class: 'sv-label sv-sky-label' }, '북극성');
  labelLayer.append(polarisLabel);
  const compass = ['북서', '북', '북동'].map((t) => el('span', { class: t === '북' ? 'sv-compass sv-compass--n' : 'sv-compass' }, t));
  labelLayer.append(...compass);

  // ---- 별(점 + 누르는 자리) ----
  const starIds = [...new Set(constellations.flatMap((c) => c.stars))];
  const dots = new Map();
  for (const hr of starIds) {
    const dot = el('span', { class: hr === POLARIS ? 'sv-star sv-star--polaris' : 'sv-star' });
    const hit = el('button', { type: 'button', class: 'sv-star-hit', 'aria-label': hr === POLARIS ? '북극성' : '별' });
    hit.addEventListener('click', (e) => press(nearestStar(e.clientX, e.clientY) ?? hr));
    starLayer.append(dot, hit);
    dots.set(hr, { dot, hit });
  }

  let names = true;
  let hintTimer = null;

  function nearestStar(x, y) {
    if (!x && !y) return null; // 키보드로 누른 경우
    const rect = app.getBoundingClientRect();
    let best = null;
    let bestD = HIT_RADIUS;
    for (const hr of starIds) {
      const s = sky.starOnScreen(hr);
      const d = Math.hypot(s.x - (x - rect.left), s.y - (y - rect.top));
      if (d < bestD) { best = hr; bestD = d; }
    }
    return best;
  }

  function press(hr) {
    const r = link.press(hr);
    if (r.result === 'wrong') {
      const { dot } = dots.get(hr);
      dot.classList.remove('sv-star--wrong');
      void dot.offsetWidth;
      dot.classList.add('sv-star--wrong');
    }
    if (r.result === 'line' || r.result === 'complete') addLine(r.constellation, r.from, r.to, true);
    if (r.result === 'complete') groups[r.constellation].artGroup.classList.add('is-shown');
    hideHint();
    refresh();
  }

  function addLine(id, a, b, animate) {
    const g = groups[id];
    const line = svgEl('line', { pathLength: 1, class: animate ? 'sv-line--new' : '' });
    g.done.append(line);
    g.doneLines.set(key(a, b), { line, a, b });
  }

  // 모델과 그려진 선을 맞춘다(마지막 선 지우기 뒤 등)
  function syncLines() {
    for (const g of Object.values(groups)) {
      const want = new Set(link.linesOf(g.c.id).map(([a, b]) => key(a, b)));
      for (const [k, v] of g.doneLines) if (!want.has(k)) { v.line.remove(); g.doneLines.delete(k); }
      for (const [a, b] of link.linesOf(g.c.id)) if (!g.doneLines.has(key(a, b))) addLine(g.c.id, a, b, false);
      g.artGroup.classList.toggle('is-shown', link.isComplete(g.c.id));
    }
  }

  function refresh() {
    syncLines();
    for (const g of Object.values(groups)) {
      g.guide.style.display = link.showsGuide(g.c.id) ? '' : 'none';
      g.label.hidden = !(names && link.isComplete(g.c.id));
    }
    polarisLabel.hidden = !names;
  }

  function hideHint() {
    hintRing.hidden = true;
    clearTimeout(hintTimer);
  }

  // components.css의 별·이름표·방위는 transform으로 가운데를 맞추므로 그 이동을 함께 쓴다.
  const place = (node, x, y) => { node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`; };

  return {
    // 매 프레임: 별·선·선화·이름표·방위 자리를 맞춘다.
    update() {
      const pos = new Map(starIds.map((hr) => [hr, sky.starOnScreen(hr)]));
      for (const [hr, { dot, hit }] of dots) {
        const s = pos.get(hr);
        place(dot, s.x, s.y);
        place(hit, s.x, s.y);
        const size = Math.max(5, s.radius * 2 + (hr === POLARIS ? 3 : 1));
        dot.style.width = dot.style.height = `${size}px`;
        dot.style.opacity = s.up ? Math.max(0.25, s.alpha) : 0;
        hit.hidden = !s.up;
      }
      for (const g of Object.values(groups)) {
        g.c.lines.forEach(([a, b], i) => setLine(g.guideLines[i], pos.get(a), pos.get(b)));
        for (const { line, a, b } of g.doneLines.values()) setLine(line, pos.get(a), pos.get(b));
        const [A, B] = art[g.c.art].anchors.map((hr) => pos.get(hr));
        const vx = B.x - A.x;
        const vy = B.y - A.y;
        g.artGroup.setAttribute('transform', `matrix(${vx} ${vy} ${-vy} ${vx} ${A.x} ${A.y})`);
        // 이름표: 별자리 위쪽
        const ps = g.c.stars.map((hr) => pos.get(hr));
        const top = Math.min(...ps.map((p) => p.y));
        const bottom = Math.max(...ps.map((p) => p.y));
        const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
        // 위 계기판에 가리면 별자리 아래쪽에 단다.
        place(g.label, cx, top - 44 > LABEL_MIN_Y ? top - 44 : bottom + 44);
      }
      const p = pos.get(POLARIS);
      place(polarisLabel, p.x, p.y + 26);
      if (!hintRing.hidden) { const h = pos.get(Number(hintRing.dataset.hr)); place(hintRing, h.x, h.y); }
      sky.compass().forEach((c, i) => place(compass[i], c.x, c.y + 14));
    },
    // 힌트: 다음에 누를 별이 1초 주기로 두 번 반짝인다.
    showHint() {
      const h = link.hint();
      if (!h) return;
      hintRing.dataset.hr = h.hr;
      hintRing.hidden = false;
      hintRing.classList.remove('sv-star-next--blink');
      void hintRing.offsetWidth;
      hintRing.classList.add('sv-star-next--blink');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(hideHint, 2000);
    },
    undo() { link.undo(); hideHint(); refresh(); },
    setNamesVisible(on) { names = on; refresh(); },
    setVisible(on) { layer.hidden = !on; },
    refresh
  };
}

function setLine(line, a, b) {
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
}
