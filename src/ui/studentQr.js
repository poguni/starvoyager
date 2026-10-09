// '학생용 QR 코드'(시안 없음): 등록 화면 오른쪽 아래 버튼 → 화면 가운데에 QR을 크게 보여 준다.
// QR은 지금 열린 주소(설정 뺀 기본 주소)로 그 자리에서 그려서, 배포 주소가 바뀌어도 맞다.
import QRCode from 'qrcode';
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { entryUrl } from '../student/entryUrl.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const QUIET = 4; // QR 규격의 흰 여백(칸 수)

// 어두운 칸만 하나의 path로 모은 SVG(색은 CSS가 정한다)
function qrSvg(url) {
  const modules = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules;
  const size = modules.size;
  let d = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules.get(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
  const total = size + QUIET * 2;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '학생용 QR 코드');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

export function createStudentQr(container) {
  const box = el('div', { class: 'sv-qr-box' });
  const close = el('button', { type: 'button', class: 'sv-qr-close', 'aria-label': 'QR 코드 닫기', onclick: () => hide() }, icon('i-close'));
  const panel = el('section', { class: 'sv-glass sv-qr', role: 'dialog', 'aria-label': '학생용 QR 코드' }, [
    el('div', { class: 'sv-qr-head' }, [el('h2', { class: 'sv-qr-title' }, '학생용 QR 코드'), close]),
    box,
    el('p', { class: 'sv-qr-help' }, '카메라로 비추면 등록 화면이 열려요.')
  ]);
  const root = el('div', { class: 'sv-qr-backdrop', hidden: true, onclick: (e) => { if (e.target === root) hide(); } }, panel);
  const open = el('button', { type: 'button', class: 'sv-ghost sv-qr-open', onclick: () => show() }, '학생용 QR 코드');
  container.append(open, root);

  function show() {
    box.replaceChildren(qrSvg(entryUrl(location.href)));
    root.hidden = false;
    close.focus();
  }
  function hide() { root.hidden = true; open.focus(); }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) hide(); });

  return { hide: () => { root.hidden = true; } };
}
