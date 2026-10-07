import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import { installIconSprite } from './ui/components/icon.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
installIconSprite();

if (params.get('debug') === 'ui') {
  // 개발 확인용 부품 견본(?debug=ui). 필요할 때만 불러온다.
  import('./debug/uiGallery.js').then(({ renderUiGallery }) => renderUiGallery(app));
} else {
  app.classList.add('sv-placeholder');
  app.textContent = '별빛 탐사선 준비 중';
}
