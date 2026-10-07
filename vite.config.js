import { defineConfig } from 'vite';

// GitHub Pages 프로젝트 페이지(https://poguni.github.io/starvoyager/)로 배포하므로
// 정적 자원 경로가 저장소 이름 아래에서 시작하도록 base를 맞춘다.
export default defineConfig({
  base: '/starvoyager/'
});
