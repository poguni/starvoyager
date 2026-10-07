# 질감 자료 출처와 저작권

앱 안의 질감은 모두 저장소에 함께 넣어(외부 서버에 의존하지 않고) 사용합니다. 크기별 파일은 `scripts/fetch-textures.py`로 원본에서 다시 만들 수 있습니다.

## Solar System Scope (CC BY 4.0)

태양·행성(지구 제외)·토성 고리 질감은 Solar System Scope의 질감입니다. NASA 관측 자료를 바탕으로 만들어졌고, **Creative Commons Attribution 4.0 International(CC BY 4.0)** 으로 배포됩니다. 출처를 밝히면 고치거나 나누어 쓸 수 있습니다.

- 원본: https://www.solarsystemscope.com/textures/
- 라이선스: https://creativecommons.org/licenses/by/4.0/
- 내려받은 곳: Wikimedia Commons에 올라온 같은 파일(아래 표)
- 가공: 앱에서 쓰는 크기(1024·2048·4096px 폭, 원본보다 크게 늘리지 않음)로 줄이고 JPG(품질 88)로 저장. 토성 고리는 세로를 64px로 줄인 PNG(투명도 유지)
- 목성·천왕성·해왕성의 희미한 고리는 질감 없이 코드로 직접 그린다(`src/scene/rings.js`).

| 앱 파일 | 내용 | 원본(Commons) |
|---|---|---|
| `public/textures/*/sun.jpg` | 태양 | [Solarsystemscope texture 8k sun.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_sun.jpg) (4096×2048) |
| `public/textures/*/mercury.jpg` | 수성 | [Solarsystemscope texture 8k mercury.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mercury.jpg) |
| `public/textures/*/venus.jpg` | 금성(구름) | [Solarsystemscope texture 4k venus atmosphere.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_4k_venus_atmosphere.jpg) |
| `public/textures/*/mars.jpg` | 화성 | [Solarsystemscope texture 8k mars.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mars.jpg) |
| `public/textures/*/jupiter.jpg` | 목성 | [Solarsystemscope texture 8k jupiter.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_jupiter.jpg) (4096×2048) |
| `public/textures/*/saturn.jpg` | 토성 | [Solarsystemscope texture 8k saturn.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_saturn.jpg) (4096×2048) |
| `public/textures/*/saturn_ring.png` | 토성 고리(투명도) | [Solarsystemscope texture 8k saturn ring alpha.png](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_saturn_ring_alpha.png) |
| `public/textures/*/uranus.jpg` | 천왕성 | [Solarsystemscope texture 2k uranus.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_2k_uranus.jpg) (2K가 최대) |
| `public/textures/*/neptune.jpg` | 해왕성 | [Solarsystemscope texture 2k neptune.jpg](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_2k_neptune.jpg) (2K가 최대) |

## NASA (퍼블릭 도메인)

지구·달 질감은 달빛 관측소(`../MoonLab/public/textures`, 그 저장소의 CREDITS.md 참고)에서 가져온 NASA 공개 자료입니다. NASA의 자료는 별도 표시가 없는 한 저작권 보호를 받지 않습니다.

| 앱 파일 | 내용 | 원본 |
|---|---|---|
| `public/textures/*/earth.jpg` | 지구 낮 | NASA Earth Observatory, Blue Marble Next Generation with Topography and Bathymetry (2004년 12월) |
| `public/textures/*/earth_night.jpg` | 지구 밤(도시 불빛) | NASA Earth Observatory, Earth at Night 2012 (원본 3600×1800이 최대) |
| `public/textures/*/earth_clouds.jpg` | 지구 구름(회색) | NASA Earth Observatory, Blue Marble cloud composite (원본 2048×1024가 최대) |
| `public/textures/*/moon.jpg` | 달 표면 | NASA Scientific Visualization Studio, CGI Moon Kit (LRO / LROC) |
| `public/textures/*/moon_bump.jpg` | 달 지형 높낮이(회색) | NASA Scientific Visualization Studio, CGI Moon Kit (LRO LOLA) |

- 이 자료는 NASA가 특정 제품이나 서비스를 보증한다는 뜻이 아닙니다.

## 앱·소개 자료에 출처를 적을 때

"행성 질감: Solar System Scope (CC BY 4.0) · 지구와 달 질감: NASA"

## 글꼴

| 파일 | 라이선스 |
|---|---|
| Pretendard(하위 집합) | SIL Open Font License 1.1 (`src/assets/fonts/LICENSE-Pretendard.txt`) |
| IBM Plex Mono | SIL Open Font License 1.1 (`src/assets/fonts/LICENSE-IBMPlexMono.txt`) |
