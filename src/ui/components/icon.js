// 아이콘 스프라이트(design/icons/icons.svg에서 옮긴 것)를 페이지에 한 번 넣고, <use>로 꺼내 쓴다.
// 파일을 따로 내려받지 않아 오프라인에서도 바로 보인다.
import spriteSvg from '../../assets/icons.svg?raw';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function installIconSprite(root = document.body) {
  if (document.getElementById('sv-icon-sprite')) return;
  const holder = document.createElement('div');
  holder.id = 'sv-icon-sprite';
  holder.hidden = true;
  holder.innerHTML = spriteSvg;
  root.prepend(holder);
}

// name: 'i-map'처럼 스프라이트의 symbol id. 글자 없이 아이콘만 쓰는 버튼에는 버튼에 aria-label을 붙인다.
export function icon(name, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}
