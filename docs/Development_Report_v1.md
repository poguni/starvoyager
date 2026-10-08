# 별빛 탐사선 (Star Voyager) 개발 리포트 v1

- 작성일: 2026-10-08 (Phase 10 시점)
- 저장소: https://github.com/poguni/starvoyager · 배포: https://poguni.github.io/starvoyager/
- 기준 문서: `docs/별빛탐사선_기획서.md`(요구사항), `docs/별빛탐사선_단계별프롬프트.md`(개발 순서), `design/`(겉모습), `docs/결정기록.md`(정한 것)
- 참고 앱: 달빛 관측소(`../MoonLab`). 같은 구조·같은 규칙으로 만들고 미션 엔진·제출 대기열·학생 정보·FPS 측정기·QR 스크립트를 가져와 넓혔다.

## 1. 프로젝트 개요

초등 4학년 2학기 과학 '밤하늘 관찰 — 태양계의 구성원'(교과서 22~29쪽)을 3~4차시 동안 주교재로 쓰는 3D 웹 앱이다. 교사가 전자칠판으로 시연하고, 학생이 크롬북으로 개별 탐사한 뒤, 전자칠판에서 학생 도감을 발표한다.

| 탐사 | 내용 | 주요 장면 |
|---|---|---|
| 탐사 1 | 태양계 구성원과 태양 | 태양계 지도(구성원 찾기, 태양 빛 가리기, 공전 재생), 요일 카드 |
| 탐사 2 | 행성 탐사와 도감 | 행성 탐사(1K→4K 질감, 고리 찾기 돋보기), 착륙, 탐사 도감 8장, 발표 화면, 행성 랩(C-1) |
| 탐사 3 | 크기 비교 실험실 | 실제 크기 비율, 줄 세우기, 나누어 담기, 태양과 비교 |
| 탐사 4 | 북쪽 밤하늘 별자리 | 서울 북쪽 하늘(실제 별), 시각 슬라이더, 별 잇기 3개, 주변 불빛, 새 별자리 이름(C-2) |

모든 탐사는 '예측 → 확인 → 최종 답 → 한 줄 정리' 미션으로 진행하고 끝에 흥미 체크를 한다. 결과는 교사의 구글 시트 '미션'·'도감' 두 탭에 쌓인다.

## 2. 기술 스택

| 항목 | 사용 | 비고 |
|---|---|---|
| 빌드 | Vite 8 | `base: '/starvoyager/'` |
| 언어 | 순수 JavaScript(ESM) | 프레임워크·TypeScript 없음 |
| 3D | three ^0.186 | OrbitControls, EffectComposer + UnrealBloomPass |
| 북쪽 밤하늘 | 2D Canvas | 입체 사영(stereographic) |
| 테스트 | Vitest 5 | 순수 모듈만, 250개 |
| 결과 저장 | Google Apps Script 웹앱 → 구글 시트 | `gas-test/Code.gs` |
| 배포 | GitHub Actions → GitHub Pages | `.github/workflows/deploy.yml`, Node 22 |
| QR | qrcode 1.5 | `scripts/make-qr.mjs` |
| 글꼴 | Pretendard(하위 집합, OFL), IBM Plex Mono(OFL) | 저장소에 포함 |
| 자료 가공 | Python(Pillow, fontTools) | 질감·별·글꼴 스크립트 |

외부 CDN을 쓰지 않는다. 인터넷은 결과 제출 때만 쓴다.

## 3. 폴더 구조

```
StarVoyager/
├─ index.html
├─ vite.config.js            base 경로
├─ .github/workflows/deploy.yml
├─ .env.example              VITE_WEBAPP_URL (실제 .env는 git 제외)
├─ CREDITS.md                질감 출처
├─ README.md / TEST.md
├─ gas-test/                 Code.gs(시트 스크립트), test.html(제출 시험), Code.test.js
├─ design/                   tokens.css, components.css, motion.md, screens/S01~S10, README.md(디자인과 다르게 정한 것)
├─ docs/                     기획서, 단계별프롬프트, 결정기록, 창작문구_검토, design-check/phase*/(점검표·비교 이미지)
├─ public/
│  ├─ textures/1k·2k·4k/     태양·행성·지구(낮·밤·구름)·달·토성 고리
│  └─ thumbs/mission-1~4.jpg 탐사 선택 카드 그림(앱 장면 캡처)
├─ scripts/                  fetch-textures.py, fetch-stars.py, subset-fonts.py, sky-dates.mjs, make-qr.mjs
└─ src/
   ├─ main.js                장면·UI·미션·제출을 잇는 진입점
   ├─ data/                  stars.json(밝은 별), constellations.js·constellationArt.js(별자리 선·선화),
   │                         planetFacts.js(도감 보기·정답), rapLines.js(행성 랩 조각), skyDate.js(고정 날짜)
   ├─ model/                 순수 계산: world(천체 목록), orbit(궤도), sizes·sizeLayout(크기 비교), arrange(끌어다 놓기 판정),
   │                         astro·skyTime·starLink(밤하늘), journal·journalStore(도감), memberProgress(구성원 찾기),
   │                         missionProgress(탐사 진행), landingPlan·landingLog(착륙), josa(조사)
   ├─ missions/              engine.js(미션 상태 기계), missions.js(탐사 1~4 문항)
   ├─ scene/                 solarMap, cameraRig, picking, textureManager, materials, rings, bloom, starBackground,
   │                         landing, sizeLab, northSky
   ├─ ui/                    hud, labels, journalPanel, presentView, missionPanel, arrangeBoard, sizeLabels, starLinker,
   │                         studentGate(S01), missionSelect(S02), components/(버튼·패널·대화 상자·발견 카드·아이콘)
   ├─ student/studentInfo.js 학생 정보 검증·저장
   ├─ submit/submitQueue.js  시트 제출·대기열
   ├─ styles/                tokens.css(디자인 토큰), components.css, app.css, contrast.js(색 대비 계산)
   └─ debug/                 fpsMeter.js, uiGallery.js(?debug=ui)
```

## 4. 개발 단계(Phase) 요약

| Phase | 목표 | 결과 |
|---|---|---|
| 1 | 프로젝트 초기화, 공통 모듈 이식, 시트 두 탭 제출 테스트, 디자인 기반 | 달빛 관측소 뼈대 이식, `Code.gs`에 '미션'·'도감' 탭 분기, tokens.css·글꼴·기본 부품, `?debug=ui` 견본 |
| 2 | 태양계 지도 | 태양·행성 8개·달·궤도·혜성·소행성 띠, 공전 재생, 태양 빛 가리기, 천체 누르기 비행, 구성원 칩(S03) |
| 3 | 행성 탐사 + 질감 단계 불러오기 + 고리 | 가까이 보기, 1K → 4K 교체(미리 불러오기), 토성 질감 고리 + 목성·천왕성·해왕성 희미한 고리, 고리 찾기 돋보기 |
| 4 | 착륙 체험 | 단단한 땅 4개 착륙(지형·돌·하늘색), 기체 4개 구름층 통과 후 실패, 착륙 배너 |
| 5 | 탐사 도감 | 구성원 쪽·태양 카드·행성 카드 8장, 보기 고르기 판정·고치기·정답 공개, 도장, 발표 화면(S09), 기기 저장 |
| 6 | 크기 비교 실험실 | 정사영 카메라로 15장 비율 그대로, 같은 크기 ↔ 실제 크기, 태양과 비교, 줄 세우기·나누어 담기 판 |
| 7 | 북쪽 밤하늘 | 예일 밝은 별 목록, 서울·고정 날짜(3월 12일) 항성시 계산, 시각 슬라이더, 별 잇기 3개, 주변 불빛, 선화 |
| 8 | 시안 대조 다듬기 + 3D 시각 품질 + 저사양 옵션 | 전체 화면 시안 대조, 블룸·대기광·실제 별 배경, `?quality=low`, 움직임 줄이기 |
| 9A | 미션 엔진 확장 + 탐사 1~4 문항 + 미션 패널 | sort·classify·summary·탐색 게이트, 문항별 시작 상태와 확인 도구 잠금, 미션 패널(S06) |
| 9B | 탐사 선택 + 학생 정보 + 창작 + 시트 제출 + 시연 모드 | 등록(S01)·탐사 선택(S02), 탐사별 진행 저장·이어서 하기, 창작 C-1·C-2, 흥미1~5, 실제 시트 전송·대기열, `?mode=demo` |
| 10 | 배포 + QR + 실기 테스트 준비 | 배포 워크플로 점검(Node 22), `npm run qr:all`, README·TEST·이 리포트. 시연 모드에서 '다른 친구가 사용해요' 버튼이 보이던 CSS 문제 수정 |

각 Phase의 점검표와 시안 비교 이미지는 `docs/design-check/phase*/`에 있다.

## 5. 질감·별·글꼴 자료 출처

| 자료 | 출처 | 라이선스 | 파일 |
|---|---|---|---|
| 태양·수성·금성·화성·목성·토성·천왕성·해왕성·토성 고리 | Solar System Scope(Wikimedia Commons 사본) | CC BY 4.0 | `public/textures/*/` |
| 지구 낮·밤·구름, 달 표면·높낮이 | NASA(Blue Marble, Earth at Night, CGI Moon Kit) — 달빛 관측소에서 재사용 | 퍼블릭 도메인 | `public/textures/*/` |
| 별 | 예일 밝은 별 목록 5판(CDS V/50), 4.5등급까지 + 별자리 별 | 퍼블릭 도메인 | `src/data/stars.json` |
| 별자리 선 | 직접 정의(HR 번호 목록) | — | `src/data/constellations.js` |
| 별자리 선화 | 직접 그림 | — | `src/data/constellationArt.js` |
| 글꼴 | Pretendard(한글 2,350자 하위 집합), IBM Plex Mono | SIL OFL 1.1 | `src/assets/fonts/` |

질감은 1K(1.2MB)·2K(4.0MB)·4K(13MB) 세 크기로 두었다. CC BY 표시는 등록 화면(S01) 아래 한 줄("태양·행성 질감: Solar System Scope (CC BY 4.0) · 지구·달 질감: NASA")과 `CREDITS.md`에 있다. 목성·천왕성·해왕성의 희미한 고리는 질감 없이 코드로 그린다.

## 6. 핵심 아키텍처

### 6-1. 화면 층

```
#app.sv-stage (sv-stage--cb: 폭 1440px 이하 / sv-demo: 시연 모드)
 ├─ canvas.sv-canvas           Three.js(태양계 지도·행성 탐사·착륙·크기 비교). 한 renderer를 장면들이 나눠 씀
 ├─ .sv-sky-layer              북쪽 밤하늘 2D 캔버스 + 별 누르기 칸 + 별자리 문장
 ├─ HUD                        네 모서리 꺾쇠, 상단 계기판(현재 탐사 · 목적지 · 진행 개수), 하단 조작 버튼
 ├─ 이름표(.sv-labels)         3D 위치를 화면 좌표로 옮긴 DOM 이름표
 ├─ 오른쪽 패널                도감(종이) / 미션(어두운 유리). 크롬북 크기에서 도감은 아래 패널(S10)
 ├─ 줄 세우기 판(.sv-ab)       S07처럼 화면 아래 넓은 판
 ├─ 발표 화면(.sv-present)     S09
 └─ .sv-screen                 등록(S01)·탐사 선택(S02). 보이는 동안 3D는 그리지 않음
```

### 6-2. 계산과 화면의 분리

판정·계산은 모두 DOM·Three.js 없이 `src/model`, `src/missions`, `src/data`의 순수 모듈로 만들고 Vitest로 검사한다(예: 도감 판정 `journal.js`, 크기 비율 `sizes.js`, 별 위치 `astro.js`, 별 잇기 `starLink.js`, 끌어다 놓기 `arrange.js`). `scene/`은 그 결과를 그리기만 하고, `ui/`는 DOM만 만든다. `main.js`가 이들을 잇는다.

### 6-3. 질감 단계 불러오기 (`scene/textureManager.js`)

처음에는 모든 천체에 1K 질감을 쓰고, 가까이 간 천체와 그 이전·다음 천체만 4K(`?quality=low`면 2K)로 바꾼다. 고해상도는 다 받아 GPU에 미리 올린 뒤 바꾸므로 깜빡이지 않고, 멀어진 천체는 30초 뒤 1K로 되돌려 메모리에서 해제한다.

### 6-4. 미션 엔진 (`missions/engine.js`)

탐사 하나를 단계(step) 목록으로 보고 상태 기계로 진행한다.

```
intro(요일 카드 등) / gate(탐색 게이트: 찾은 개수 조건 — 구성원·도감 카드·별자리)
→ 문항(quiz): predict → (오답) confirm(확인 단계) → result
  문항(sort·classify): arrange → result
→ summary(한 줄 정리) → summaryResult
→ feel(보고 느끼기, 탐사 3)
→ creative(C-1 행성 랩 / C-2 새 별자리 이름) → creativeResult
→ survey(흥미 체크) → done
```

- 단계 형식: `intro`, `gate`, `quiz`, `sort`(줄 세우기), `classify`(나누어 담기), `summary`, `feel`, `creative`, `survey`.
- 문항마다 시작 상태(장면·행성·시각)와 예측 단계에서 잠그는 확인 도구를 데이터로 갖는다(`missions.js`).
- 결과 행이 완성되면 `onRow`로 내보내고, `main.js`가 시트 제출로 넘긴다.
- `start({ from, pressedDays })`로 저장한 단계부터 이어서 하고, `resumeIndex`가 '아직 행을 보내지 않은 첫 단계'를 알려 준다.

### 6-5. 저장과 제출

| 저장 키(localStorage) | 내용 | 모듈 |
|---|---|---|
| `starvoyager:student` | 학년·반·번호·이름 | `student/studentInfo.js` |
| `starvoyager:journal:v1` | 도감 카드(고른 값·상태·도장 순서·시간·행성 랩) | `model/journalStore.js` |
| `starvoyager:missions:v1` | 탐사별 todo/doing/done + 이어서 할 단계 | `model/missionProgress.js` |
| `starvoyager:submitQueue` | 보내지 못한 결과 행 | `submit/submitQueue.js` |

- 제출은 한 기기에서 **한 행씩 차례로** 보낸다(동시에 보내면 Apps Script가 응답 단계에서 404를 자주 돌려줌).
- 실패한 행은 대기열에 두고 온라인 복귀·탐사 선택 화면 열기·'다시 보내기'에서 다시 보낸다. 다시 보내기가 겹쳐도 같은 행을 두 번 보내지 않는다.
- 시연 모드는 아무것도 저장하거나 보내지 않는다. '다른 친구가 사용해요'는 학생 정보·도감·진행을 지우되 대기열은 남긴다.
- 학생 이름은 시트로 보내는 요청 본문에만 들어간다.

### 6-6. 시트 스크립트 (`gas-test/Code.gs`)

`kind`('미션'/'도감')에 따라 탭을 나눠 1행을 추가한다. 탭이 없으면 머리글과 함께 만든다. 학년 1~6·반 1~20·번호 1~40·이름 1~10글자, 문항 ID(1-1~4-6, C-1, C-2, 흥미1~5)·행성 이름 허용 목록으로 검증하고 `LockService`로 동시 쓰기를 직렬화한다.

## 7. 기획서와 다르게(또는 기획서에 없던 것을) 정한 부분

전체 목록과 날짜·이유는 `docs/결정기록.md`(70여 건), 겉모습은 `design/README.md`의 '디자인과 다르게 정한 것' 표에 있다. 주요한 것만 묶었다.

| 영역 | 정한 내용 | 이유 |
|---|---|---|
| 문항 ID | 흥미 체크는 `흥미1~흥미5`(10-3 허용 목록은 흥미1~4) | 9-5에서 탐사 4가 2문항이라 개수가 맞지 않음 |
| 힌트 | 힌트가 없는 문항은 새 힌트를 만들지 않고 '확인 방법'을 해요체로 보여 줌. 둘 다 없으면 "직접 관찰한 뒤 답을 다시 골라요." | 학생용 문구를 임의로 만들지 않음 |
| 도감 정답 | 수성 회색, 목성 흰색과 갈색 줄무늬 | 교과서에 색깔 서술 없음(17-1) |
| 태양 카드 | 탐사 1의 한 줄 정리 + 태양 가까이 보기로 채워짐 | 8-1에 시점이 없음 |
| 태양계 지도 | 태양을 가운데 두고 해왕성까지 한눈에(S03 구도와 다름). 크기는 모형이지만 크기 순서는 실제와 같게 | 회전·재생할 때 어색함, 탐사 3 오개념 방지 |
| 이전/다음 행성 | 행성 8개만 돎(태양 제외) | 1-4에서 9개로 세지 않도록 |
| 착륙 | 땅은 행성 질감 색으로 코드로 그림, 지구는 한반도 땅색 | 4K 질감도 가까이서 뭉개짐 |
| 크기 비교 | 정사영 카메라, 토성 고리 비스듬히, "약 ○배"는 실제 크기에서만 | 원근 왜곡 방지, 3-1 답 노출 방지 |
| 끌어다 놓기 | 끌기 + '카드 누른 뒤 칸 누르기' | 전자칠판·작은 손 |
| 북쪽 밤하늘 | 2D 입체 사영, 고정 날짜 3월 12일, 30분 단위 시각, 별 잇기는 '선의 모음' | 넓은 시야에서 모양 왜곡 방지, 두 별자리 밤새 지평선 위 |
| 미션 진행 | 예측 단계에서 확인 도구·이름 보기 잠금, 문항마다 시작 상태 다시 맞춤, 탐색 단계는 안내 띠만 | 9-1 '허용한 조작만'의 구체화 |
| 한 줄 정리 | 한 번만 고르고, 틀리면 정답 문장 공개 | 9-1 ④에 오답 처리 없음 |
| 탐사 선택·진행 | HUD '탐사 선택' 버튼, 탐사마다 '아직 마치지 않은 첫 단계'부터 이어서 | 10-5 |
| 시연 모드 | 기기 저장도 하지 않음, 미션 글씨 확대 | 교사 기기에서 학생 기록과 섞이지 않게 |
| 제출 | 한 행씩 차례로 전송, 404도 실패로 보고 다시 보냄(시트에 중복 행이 생길 수 있음) | 실제 시트 전송 점검에서 발견 |
| 배경색 | 3D 배경은 시안보다 어두운 `--sv-space-900` | 실사 질감 행성이 떠 보이지 않게 |
| 저사양 | `?quality=low` = 화면 배율 1.5까지 + 블룸 끄기 + 질감 2K까지. 크롬북 기본값은 실측 뒤 결정 | 12장, 근거 자료 없음 |

## 8. 배포 (GitHub Pages + GitHub Actions) — 상세 가이드

### 8-1. 전체 그림

```
로컬에서 git push (main 브랜치)
        │
        ▼
GitHub Actions가 .github/workflows/deploy.yml 실행
   ① 코드 가져오기 → ② Node 22 설치 → ③ npm ci → ④ npm test(250개)
   → ⑤ npm run build(VITE_WEBAPP_URL 주입) → ⑥ dist/ 업로드 → ⑦ GitHub Pages 배포
        │
        ▼
https://poguni.github.io/starvoyager/
```

`dist/`는 커밋하지 않는다(`.gitignore`). `gh-pages` 브랜치를 쓰지 않는 GitHub 기본 Pages 배포 방식이다. 테스트가 하나라도 실패하면 배포하지 않는다.

### 8-2. `base: '/starvoyager/'`가 필요한 이유

프로젝트 페이지는 주소에 저장소 이름이 들어간다(`poguni.github.io/starvoyager/`). Vite 기본값(`/`)으로 빌드하면 `/assets/…`가 도메인 루트를 가리켜 404가 난다. 질감(`public/textures`)과 카드 그림(`public/thumbs`)도 코드에서 `import.meta.env.BASE_URL`을 앞에 붙여 부른다. 저장소 이름을 바꾸면 `base`도 바꾼다.

### 8-3. 워크플로 읽는 법

```yaml
on:
  push: { branches: [main] }   # main에 push하면 자동 실행
  workflow_dispatch:            # Actions 탭에서 수동 실행 가능
permissions:
  contents: read
  pages: write                  # Pages에 쓰기
  id-token: write               # Pages 배포 인증
jobs:
  build:   checkout → setup-node(22, npm 캐시) → npm ci → npm test → npm run build(env: VITE_WEBAPP_URL: ${{ vars.VITE_WEBAPP_URL }})
           → configure-pages → upload-pages-artifact(dist)
  deploy:  needs: build, environment: github-pages → deploy-pages
```

Phase 10에서 Node를 20 → 22로 올렸다(Node 20은 2026년 4월 지원 종료, Vite 8은 Node 20.19+ / 22.12+ 필요).

### 8-4. GitHub 웹 화면에서 할 설정 (최초 1회)

**(1) Pages 배포 소스를 GitHub Actions로**
1. https://github.com/poguni/starvoyager → **Settings**
2. 왼쪽 **Pages**
3. **Build and deployment → Source**를 `Deploy from a branch`에서 **`GitHub Actions`** 로 바꾼다(선택만으로 저장됨).
   - 이 설정이 없으면 `deploy` 잡이 실패하거나 사이트에 반영되지 않는다.

**(2) 시트 웹앱 주소를 저장소 변수로**
1. **Settings → Secrets and variables → Actions**
2. 위쪽 **Variables** 탭(처음엔 Secrets 탭이 보임)
3. **New repository variable** → Name `VITE_WEBAPP_URL`, Value: Apps Script 웹앱 주소(`https://script.google.com/macros/s/…/exec`, 로컬 `.env`와 같은 값) → **Add variable**

> Secrets가 아니라 Variables를 쓰는 이유: `VITE_` 변수는 빌드된 JS에 그대로 들어가 누구나 볼 수 있으므로 애초에 비밀이 아니다. 보호는 `Code.gs`의 입력값 검증이 한다. Secrets를 쓰고 싶으면 워크플로의 `vars.`를 `secrets.`로 바꾼다.
>
> 변수를 등록하지 않고 배포하면 앱은 동작하지만 제출이 모두 실패해 대기열에만 쌓인다. 등록한 뒤에는 Actions 탭에서 **Re-run all jobs**(또는 Run workflow)로 다시 빌드해야 반영된다.

### 8-5. 일상적인 배포 흐름

1. 로컬에서 수정 → `npm test` → `npm run build`(선택: `npm run preview`로 `/starvoyager/` 경로 확인)
2. `git add` → `git commit` → `git push origin main`
3. **Actions** 탭에서 초록 체크 확인(보통 1~2분)
4. 실패하면 로그에서 막힌 단계를 본다: `npm test`·`npm run build` 실패는 로컬에서 같은 명령으로 재현, `deploy` 권한 오류는 8-4 (1) 확인
5. https://poguni.github.io/starvoyager/ 에서 확인(안 바뀌어 보이면 강력 새로고침 Ctrl+Shift+R)

### 8-6. 배포 후 확인할 항목

`TEST.md` 0장: Actions 초록 체크, 접속(등록 화면), 질감·글꼴, 배포본에서 제출한 행이 시트에 기록되는지, 휴대폰 QR.

## 9. QR 코드

```
npm run qr:all     # qr/starvoyager-qr.png(기본 주소) + qr/mission-1~4.png(?mission=1~4)
npm run qr         # 기본 주소만
npm run qr -- "https://poguni.github.io/starvoyager/?mission=2" qr/4-3반.png
```

`scripts/make-qr.mjs`가 1200×1200px PNG(오류 정정 M, 여백 2)를 만든다. `qr/`는 git에 올리지 않는다. 차시별 QR은 등록(처음 한 번) 뒤 그 탐사로 바로 들어간다. 진행 중이던 탐사면 이어서 한다.

## 10. 성능

### 10-1. 측정 도구

`?debug=fps`: 화면 구석에 `FPS · draw · tri`(0.5초마다, `src/debug/fpsMeter.js`, `renderer.info`). 장면 다섯 가지(태양계 지도, 행성 탐사, 착륙, 크기 비교, 북쪽 밤하늘)를 기본과 `?quality=low`로 재는 표는 `TEST.md` 2장. `?mode=demo`를 함께 붙여 기록이 섞이지 않게 한다.

### 10-2. 지금 들어 있는 성능 장치

| 장치 | 내용 |
|---|---|
| 질감 단계 불러오기 | 지도는 1K, 다가간 천체만 4K(low면 2K) |
| 화면 배율 제한 | 기본 `min(devicePixelRatio, 2)`, low는 1.5 |
| 블룸 | 태양 빛무리. `?fx=off`·`?quality=low`에서 끔 |
| 장면 정리 | 행성 탐사·발표 화면에서 다른 천체·궤도선·소행성 띠를 감춤 |
| 등록·탐사 선택 화면 | 3D를 그리지 않음 |
| 북쪽 밤하늘 | 3D 대신 2D 캔버스 |

### 10-3. 남은 결정

크롬북에서 `?quality=low`를 기본으로 켤지는 `TEST.md` 실측 결과로 정한다(기획서 16장 4번). 켠다면 방식(화면 크기로 자동 판단 / 기기 성능 감지 / 학생이 켜고 끄기)을 함께 정하고 Phase 11로 넣는다.

### 10-4. 번들 크기 경고 (고치지 않음, 원인과 선택지만)

`npm run build` 결과:

| 파일 | 크기 | gzip |
|---|---|---|
| `assets/index-*.js` | 767KB | 214KB |
| `assets/index-*.css` | 53KB | 10KB |
| `assets/PretendardVariable.subset-*.woff2` | 510KB | — |
| 질감(처음 화면에 필요한 1K) | 약 1.2MB | — |

Vite가 500KB를 넘는 JS 청크에 경고를 낸다. 따로 재 보니 three.js(코어 + OrbitControls·후처리)가 약 **596KB**, 앱 코드가 약 **171KB**(gzip 66KB, 별 자료 30KB 포함)다. 즉 경고의 대부분은 three.js다.

| 선택지 | 효과 | 비용·위험 |
|---|---|---|
| 그대로 둔다(경고 한도만 `build.chunkSizeWarningLimit`로 올림) | 없음(경고만 사라짐) | 없음. gzip 214KB는 교실 Wi-Fi에서 1초 안팎 |
| three.js를 별도 청크로 나눔(`codeSplitting`/manualChunks) | 앱 코드만 바꿀 때 three 캐시 재사용 | 첫 로딩 크기는 같음 |
| 장면별 동적 import(크기 비교·착륙·밤하늘·후처리) | 첫 화면 JS 감소 | 장면 전환 때 잠깐 기다림, main.js 구조 변경 필요 |
| 글꼴 하위 집합 더 줄이기 | 510KB 감소 | 학생 이름에 드문 글자가 시스템 글꼴로 보임 |

첫 로딩에서 체감에 더 크게 작용하는 것은 JS보다 글꼴(510KB)과 질감이다. `TEST.md` 3장의 '첫 로딩 시간'을 재 본 뒤 필요하면 정한다.

## 11. URL 파라미터 전체 목록

| 파라미터 | 설명 | 추가된 Phase |
|---|---|---|
| `?view=map` | 태양계 지도에서 시작 | 2 |
| `?view=planet&planet=mars` | 행성 탐사 화면에서 시작(sun, mercury, venus, earth, mars, jupiter, saturn, uranus, neptune, 없으면 earth) | 3 |
| `?view=size` | 크기 비교 실험실에서 시작 | 6 |
| `?debug=arrange` (`&activity=classify`) | 줄 세우기(나누어 담기) 판 바로 열기, 개발 확인용 | 6 |
| `?view=sky&time=21` | 북쪽 밤하늘에서 시작, 시각 18~30(30 = 다음 날 6시, 없으면 20) | 7 |
| `?fx=off` | 블룸·빛무리·대기광 끄기 | 8 |
| `?quality=low` | 화면 배율 1.5까지, 블룸 끄기, 질감 2K까지 | 8 |
| `?debug=fps` | FPS·렌더링 부하 표시 | 8 |
| `?debug=ui` (`&accent=mars`) | 부품 견본, 개발 확인용 | 1 |
| `?debug=missions` | 미션 결과 행을 왼쪽 개발용 패널에 표시(이름 없음) | 9A |
| `?mission=1~4` | 탐사 선택을 건너뛰고 그 탐사로(학생 정보가 없으면 등록 먼저, 진행 중이면 이어서) | 9A·9B |
| `?mode=demo` | 시연 모드: 등록·제출·기기 저장 없음, 큰 글씨, 이름 라벨 숨김 | 9B |

`?mission`·`?view`·`?debug=arrange`가 있으면 탐사 선택 화면을 건너뛴다. 탐사의 문항 시작 상태가 `?time` 등보다 우선한다. 예: `?mode=demo&mission=4&view=sky&time=20`.

## 12. 테스트 현황

```
npm test  →  Test Files 14 passed, Tests 250 passed
```

| 파일 | 대상 | 개수 |
|---|---|---|
| `gas-test/Code.test.js` | 시트 스크립트 검증·탭 분기·머리글 | 22 |
| `src/missions/engine.test.js` | 미션 상태 기계(예측/확인/최종, 탐색 게이트, 한 줄 정리, 창작, 흥미 체크, 이어서 하기) | 22 |
| `src/missions/missions.test.js` | 탐사 1~4 문항이 기획서 문구·정답·ID와 같은지, 랩 조각(8×3×3)·교과서 용어 | 50 |
| `src/model/astro.test.js` | 항성시·별 고도/방위·입체 사영 | 13 |
| `src/model/journal.test.js` | 도감 판정·고치기·정답 공개·도장·랩 저장 | 20 |
| `src/model/landing.test.js` | 착륙 시간표·착륙 기록 | 9 |
| `src/model/missionProgress.test.js` | 탐사 진행 저장·이어서 할 단계 | 6 |
| `src/model/sizes.test.js` | 15장 크기 비율·순서·배치·끌어다 놓기 판정 | 16 |
| `src/model/starLink.test.js` | 별 잇기(선의 모음, 어느 끝에서나) | 11 |
| `src/model/world.test.js` | 천체 목록·궤도·구성원 찾기·이전/다음 행성 | 21 |
| `src/scene/textureManager.test.js` | 질감 단계(1K→4K/2K, 정리) | 6 |
| `src/student/studentInfo.test.js` | 학생 정보 범위·오류 칸 | 6 |
| `src/styles/contrast.test.js` | 강조 색 위 글씨 대비(WCAG) | 36 |
| `src/submit/submitQueue.test.js` | payload 매핑(10-3·10-4), 성공/실패/재전송, 동시 재전송 중복 방지, 차례 전송, 지속성 | 12 |

Three.js·DOM 화면은 자동 테스트 대상이 아니다. Phase마다 Playwright로 1920×1080·1366×768 스크린샷을 찍어 시안과 비교하고 콘솔 오류·학생 이름 노출을 확인했다(`docs/design-check/phase*/점검표.md`). Phase 10에서는 빌드 결과(`vite preview`)로 등록·탐사 선택·지도·행성·착륙·크기 비교·밤하늘·시연 모드를 열어 자원 404 0건, 콘솔 오류 0건을 확인했다.

## 13. 알려진 이슈 · 향후 작업

- **실기 테스트 대기**: `TEST.md`(전자칠판·크롬북 FPS, 탐사 시간, 학생 시범 사용) 결과로 ⓐ `?quality=low` 기본값, ⓑ 문구 조정, ⓒ 탐사 시간 조정을 정한다. 필요하면 Phase 11.
- **교사 확인 대기(Phase 9B)**: 실제 시트 두 탭의 행·필드 대조, `docs/창작문구_검토.md`(행성 랩 조각·새 별자리 이름 보기, 기획서 16장 2번) 검토.
- **Apps Script 404**: 여러 행을 한꺼번에 보내면 웹앱이 응답 단계에서 404를 돌려줄 때가 있다. 한 행씩 차례로 보내도록 바꿔 크게 줄었지만, 이미 시트에 적힌 행이 404로 돌아오면 다시 보낼 때 같은 행이 한 번 더 쌓일 수 있다(재제출 허용과 같은 취급). 학급 30명이 동시에 쓰면 `LockService` 대기로 제출이 몇 초씩 늦어질 수 있다.
- **기기 간 이어 하기 없음**: 진행 상태는 그 기기의 브라우저에만 있다. 차시마다 크롬북이 바뀌면 이어지지 않는다(기획서 16장 3번, 2차 범위 검토).
- **번들 크기 경고**: 10-4. 고치지 않았다.
- **QR 휴대폰 스캔**: PNG와 담긴 주소는 확인했고, 실제 스캔은 배포 뒤 교사가 확인.
- **성취기준 원문**: 기획서 4-1장 기입 대기(16장 1번).

## 14. 자주 참고하게 될 파일

| 무엇을 바꾸고 싶을 때 | 파일 |
|---|---|
| 미션 문항·보기·정답·힌트·한 줄 정리·흥미 체크 | `src/missions/missions.js` |
| 행성 랩 문장 조각 | `src/data/rapLines.js` |
| 도감 보기·정답·교과서 문장·힌트 | `src/data/planetFacts.js` |
| 천체 목록·궤도·표시 크기 | `src/model/world.js`, `src/model/orbit.js` |
| 크기 비교 비율 | `src/model/sizes.js` |
| 별자리 선·선화, 북쪽 밤하늘 날짜 | `src/data/constellations.js`, `src/data/constellationArt.js`, `src/data/skyDate.js` |
| 미션 진행 규칙 | `src/missions/engine.js` |
| 탐사 선택·등록 화면 | `src/ui/missionSelect.js`, `src/ui/studentGate.js` |
| 색·글꼴·크기·간격 | `src/styles/tokens.css`(원본 `design/tokens.css`) |
| 질감 파일·저사양 질감 | `public/textures/`, `src/scene/textureManager.js`, `scripts/fetch-textures.py` |
| 시트 제출·대기열 | `src/submit/submitQueue.js`, `gas-test/Code.gs` |
| 배포 | `.github/workflows/deploy.yml`, `vite.config.js` |
| QR | `scripts/make-qr.mjs` |
| 정한 것과 이유 | `docs/결정기록.md`, `design/README.md` |
