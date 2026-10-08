# 별빛 탐사선 (Star Voyager)

초등 4학년 2학기 과학 '밤하늘 관찰 — 태양계의 구성원'(교과서 22~29쪽) 학습용 3D 웹 앱. 태양계 지도·행성 탐사·착륙·탐사 도감·크기 비교 실험실·북쪽 밤하늘 별자리를 탐사 1~4로 진행하고, 결과는 교사의 구글 시트('미션'·'도감' 두 탭)에 쌓인다.

- 기획: `docs/별빛탐사선_기획서.md` · 개발 순서: `docs/별빛탐사선_단계별프롬프트.md` · 결정 기록: `docs/결정기록.md`
- 디자인: `design/`(목차 `design/README.md`) · 질감 출처: `CREDITS.md`
- 개발 리포트: `docs/Development_Report_v1.md` · 실기 테스트: `TEST.md`
- 배포 주소: https://poguni.github.io/starvoyager/

## 설치·개발

Node.js 22 이상(Vite 8 기준).

```
npm install
npm run dev      # 개발 서버(http://localhost:5173/starvoyager/)
npm test         # 단위 테스트(vitest)
npm run build    # 배포용 빌드(dist/)
npm run preview  # 빌드 결과를 배포와 같은 경로(/starvoyager/)로 미리 보기
```

앱 본체는 외부 CDN을 쓰지 않는다. 질감(`public/textures/1k·2k·4k`), 별 자료(`src/data/stars.json`), 글꼴(`src/assets/fonts`)이 모두 저장소에 들어 있다. 다시 만들 때 쓰는 스크립트:

| 스크립트 | 하는 일 |
|---|---|
| `python -I scripts/fetch-textures.py` | 질감 원본을 내려받아 1K·2K·4K로 줄인다(`textures-src/`는 git 제외) |
| `python -I scripts/fetch-stars.py` | 예일 밝은 별 목록에서 4.5등급까지 추려 `src/data/stars.json`을 만든다 |
| `python -I scripts/subset-fonts.py` | Pretendard를 한글 2,350자 + 영문·숫자·기호로 줄인다 |
| `node scripts/sky-dates.mjs` | 북쪽 밤하늘 고정 날짜 후보를 계산한다(결정: 3월 12일) |

## 결과 제출(구글 시트) 설정

1. `gas-test/README.md` 순서대로 시트에 `gas-test/Code.gs`를 붙여넣고 웹앱으로 배포해 주소(`.../exec`)를 받는다. `gas-test/test.html`로 두 탭에 한 줄씩 기록되는지 먼저 확인한다.
2. 프로젝트 루트에 `.env`를 만들고(`.env.example` 복사) 주소를 넣는다.

   ```
   VITE_WEBAPP_URL=https://script.google.com/macros/s/xxxxx/exec
   ```

3. `.env`는 git에 올라가지 않는다. 배포 빌드에는 아래 '배포'에서 같은 이름의 저장소 변수로 넣는다.
4. 주소가 없으면 앱은 그대로 동작하지만 제출은 실패로 처리되어 대기열에만 쌓인다(탐사 선택 화면 아래 "제출 대기 중 n개").

학생 이름은 시트로 보내는 요청 본문에만 들어가고, 콘솔·오류 메시지·디버그 패널에는 남기지 않는다.

## 배포(GitHub Pages)

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 `npm ci → npm test → npm run build → Pages 배포`를 한다. 테스트가 실패하면 배포하지 않는다.

1. **Pages 설정(최초 1회)**: 저장소 → Settings → Pages → Build and deployment → **Source**를 `GitHub Actions`로.
2. **웹앱 주소 등록(최초 1회)**: 저장소 → Settings → Secrets and variables → Actions → **Variables** 탭 → New repository variable
   - Name: `VITE_WEBAPP_URL` / Value: Apps Script 웹앱 주소(`.../exec`)
   - 이 주소는 빌드된 JS 안에 그대로 들어가 누구나 볼 수 있다. 오·남용은 시트 쪽(`Code.gs`)의 입력값 검증(학년·반·번호·이름 형식, 문항·행성 허용 목록)으로 막는다.
3. push 뒤 **Actions** 탭에서 초록 체크를 확인하고 https://poguni.github.io/starvoyager/ 에 접속한다.

`vite.config.js`의 `base: '/starvoyager/'`는 저장소 이름과 같아야 한다(저장소 이름을 바꾸면 함께 바꾼다).

## QR 코드

```
npm run qr:all                                                        # 아래 5장을 한 번에
npm run qr                                                            # 기본 주소 → qr/starvoyager-qr.png
npm run qr -- "https://poguni.github.io/starvoyager/?mission=2" qr/4-3반.png   # 주소·파일명 직접 지정
```

| `npm run qr:all`이 만드는 파일 | 주소 |
|---|---|
| `qr/starvoyager-qr.png` | `https://poguni.github.io/starvoyager/` (등록 → 탐사 선택) |
| `qr/mission-1.png` ~ `qr/mission-4.png` | `...?mission=1` ~ `...?mission=4` (그 차시의 탐사로 바로) |

인쇄해도 선명하도록 1200×1200px PNG로 만든다. `qr/`는 git에 올라가지 않는다.

## 성능 측정

`?debug=fps`로 접속하면 화면 구석에 `FPS · draw(그리기 호출) · tri(삼각형 수)`가 0.5초마다 표시된다. 장면마다 10초 이상 머문 뒤 3~5번 읽어 평균을 낸다. 측정표는 `TEST.md`.

`?quality=low`는 화면 배율을 1.5까지로 제한하고, 블룸(태양 빛 번짐)을 끄고, 가까이 본 천체 질감을 2K까지만 불러온다. 크롬북 기본값으로 켤지는 실기 테스트 뒤 정한다.

## URL 파라미터

여러 개를 `&`로 이어 쓸 수 있다. 예: `?mode=demo&mission=4&view=sky&time=20` — 전자칠판에서 저녁 8시 북쪽 하늘로 탐사 4 시연.

| 파라미터 | 설명 |
|---|---|
| `?mission=1~4` | 탐사 선택 화면을 건너뛰고 그 탐사로 바로 시작(학생 정보가 없으면 등록 먼저). 진행 중이던 탐사면 이어서 한다 |
| `?view=map` | 태양계 지도에서 시작(탐사 선택 화면 건너뜀) |
| `?view=planet` | 행성 탐사 화면에서 시작(`?planet`과 함께, 없으면 지구) |
| `?view=size` | 크기 비교 실험실에서 시작 |
| `?view=sky` | 북쪽 밤하늘에서 시작(`?time`과 함께, 없으면 저녁 8시) |
| `?planet=mars` | 시작 행성: sun, mercury, venus, earth, mars, jupiter, saturn, uranus, neptune |
| `?time=21` | 북쪽 밤하늘 시작 시각(18~30, 30은 다음 날 아침 6시) |
| `?mode=demo` | 시연 모드: 학생 정보 입력·시트 제출·기기 저장 없음, 큰 글씨, 이름 라벨 기본 숨김 |
| `?fx=off` | 시각 효과(블룸·빛무리·대기광) 끄기 |
| `?quality=low` | 저사양: 화면 배율 1.5까지, 블룸 끄기, 질감 2K까지 |
| `?debug=fps` | FPS·렌더링 부하 표시 |
| `?debug=missions` | 미션 결과 행을 화면 왼쪽 개발용 패널에도 표시(이름 제외) |
| `?debug=arrange` | 크기 비교 실험실의 줄 세우기 판(`&activity=classify`면 나누어 담기)을 바로 연다(개발 확인용) |
| `?debug=ui` | 화면 부품 견본(개발 확인용, `&accent=mars` 등 강조 색 바꾸기) |

탐사가 문항마다 정한 시작 상태가 `?time` 등보다 우선한다.
