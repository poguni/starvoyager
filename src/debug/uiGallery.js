// ?debug=ui: 부품 견본 화면. design/screens/design-system.png와 같은 순서로 부품을 상태별로 늘어놓는다.
// 강조 색 선택 상자로 data-accent를 바꿔 부품 색이 함께 바뀌는지 확인한다. (개발 확인용, 학생 화면 아님)
import './uiGallery.css';
import { el } from '../ui/components/dom.js';
import { icon } from '../ui/components/icon.js';
import { controlButton, toggleButton, primaryButton, secondaryButton, ghostButton } from '../ui/components/buttons.js';
import { panelHandle } from '../ui/components/panel.js';
import { createDiscoveryCards } from '../ui/components/discovery.js';
import { confirmDialog } from '../ui/components/dialog.js';

const ACCENTS = [
  ['default', '기본', '지도·크기 비교'], ['sun', '태양'], ['mercury', '수성'], ['venus', '금성'], ['earth', '지구'],
  ['mars', '화성'], ['jupiter', '목성'], ['saturn', '토성'], ['uranus', '천왕성'], ['neptune', '해왕성 (흰 글씨)'], ['sky', '북쪽 밤하늘']
];
const ICONS = ['i-map', 'i-prev', 'i-next', 'i-land', 'i-ascend', 'i-ring', 'i-label', 'i-journal', 'i-play', 'i-pause',
  'i-sun-off', 'i-sun', 'i-city', 'i-hint', 'i-undo', 'i-present', 'i-close', 'i-check', 'i-pin', 'i-info',
  'i-warn', 'i-plus', 'i-minus', 'i-star', 'i-resend', 'i-pencil', 'i-user', 'i-scale'];

const check = '<svg class="sv-check" aria-hidden="true"><use href="#i-check"/></svg>';
const use = (name) => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const heading = (title, code) => `<h2>${title} <code>${code}</code></h2><div class="rule"></div>`;

function accentCards() {
  return ACCENTS.map(([id, name, darkLabel = 'HUD 선']) => `
    <div class="acc" data-accent="${id}">
      <div class="acc-top"><b>${name}</b><span>${id}</span></div>
      <div class="acc-dark"><span>${darkLabel}</span><span class="line"></span></div>
      <div class="acc-bottom"><button class="sv-option" aria-pressed="true"><span class="sv-option-text">선택됨</span>${check}</button></div>
    </div>`).join('');
}

const TEMPLATE = `
  <h1>별빛 탐사선 디자인 시스템</h1>
  <p class="lead">?debug=ui 부품 견본 · 값은 모두 src/styles/tokens.css, 모양은 src/styles/components.css</p>

  ${heading('1 바탕 · 종이 · 상태 색', '--sv-space-* --sv-paper* --sv-ok* --sv-warn*')}
  <div class="row">
    <div class="item"><div class="sw" style="background:var(--sv-space-900)"></div><span class="cap">space-900</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-space-800)"></div><span class="cap">space-800</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-glass); backdrop-filter:blur(10px)"></div><span class="cap">glass 58%</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-glass-strong)"></div><span class="cap">glass-strong 82%</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-text)"></div><span class="cap">text</span></div>
    <div class="item"><div class="sw sv-journal" style="border-top:none"></div><span class="cap">paper + 모눈 24px</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-paper-text)"></div><span class="cap">paper-text</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-ok-bright)"></div><span class="cap">ok-bright</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-warn-bright)"></div><span class="cap">warn-bright</span></div>
    <div class="item"><div class="sw" style="background:var(--sv-stamp)"></div><span class="cap">stamp</span></div>
  </div>

  ${heading('2 강조 색 11개', 'data-accent="…" → --sv-accent / on-accent / accent-soft / accent-strong')}
  <div class="row">${accentCards()}</div>

  ${heading('3 글꼴과 크기', 'Pretendard(하위 집합) · IBM Plex Mono(숫자·영문 코드)')}
  <div class="type-row"><span class="cap">display</span><span style="font-size:var(--sv-fs-display); font-weight:700">화성 · 목적지 이름</span></div>
  <div class="type-row"><span class="cap">question</span><span style="font-size:var(--sv-fs-question); font-weight:700">탐사선을 목성에 착륙시킬 수 있을까요?</span></div>
  <div class="type-row"><span class="cap">title</span><span style="font-size:var(--sv-fs-title); font-weight:700">도감에 기록하기 · 패널 제목</span></div>
  <div class="type-row"><span class="cap">body</span><span style="font-size:var(--sv-fs-body)">목성은 표면이 기체로 되어 있어서 내려앉을 땅이 없어요.</span></div>
  <div class="type-row"><span class="cap">control</span><span style="font-size:var(--sv-fs-control)">태양계 지도 · 착륙하기 · 고리 찾기</span></div>
  <div class="type-row"><span class="cap">option</span><span style="font-size:var(--sv-fs-option)">파란색 바다와 초록·갈색 땅</span></div>
  <div class="type-row"><span class="cap">section</span><span style="font-size:var(--sv-fs-section); font-weight:700">3 고리 · 하나 고르기</span></div>
  <div class="type-row"><span class="cap">small (최소)</span><span style="font-size:var(--sv-fs-small)">모형입니다: 크기와 거리는 실제와 달라요</span></div>
  <div class="type-row"><span class="cap">hud-num Mono</span><span style="font-family:var(--sv-font-num); font-size:var(--sv-fs-hud-num); font-weight:600">5/8 · MISSION 02</span></div>

  ${heading('4 조종석 HUD', '.sv-hud-cell .sv-hud-dest .sv-corner .sv-hud-flying .sv-panel-handle')}
  <div class="glass-box" style="position:relative; height:300px">
    <div class="sv-corner sv-corner--tl" style="left:16px; top:16px"></div>
    <div class="sv-corner sv-corner--br" style="right:16px; bottom:16px"></div>
    <div class="row" style="padding:30px 40px">
      <div class="item"><div class="sv-glass sv-hud-cell"><span class="sv-hud-code">MISSION 02</span><span class="sv-hud-val">탐사 2 · 행성 탐사</span></div><span class="cap">현재 탐사</span></div>
      <div class="item"><div class="sv-glass sv-hud-cell sv-hud-dest"><span class="sv-hud-key">목적지</span><span class="sv-hud-val">화성</span></div><span class="cap">목적지(강조 색)</span></div>
      <div class="item"><div class="sv-glass sv-hud-cell sv-hud-dest sv-hud-flying"><span class="sv-hud-key">이동 중</span><span class="sv-hud-val">화성으로 이동 중</span></div><span class="cap">비행 중</span></div>
      <div class="item"><div class="sv-glass sv-hud-cell"><span class="sv-hud-key">도감</span><span class="sv-hud-num">5/8</span></div><span class="cap">진행 개수</span></div>
      <div class="item"><span class="sv-label" style="position:static; transform:none">해왕성</span><span class="cap">3D 이름표</span></div>
    </div>
    <div data-slot="handle" style="position:absolute; right:0; top:0; bottom:0; width:80px"></div>
  </div>

  ${heading('5 조작 버튼', 'controlButton · toggleButton · ghostButton (src/ui/components/buttons.js)')}
  <div class="glass-box"><div class="row" data-slot="controls"></div></div>

  ${heading('6 탐사 도감', '.sv-journal .sv-option .sv-swatch .sv-box .sv-hint .sv-record .sv-stamp')}
  <div class="row">
    <div class="paper-box sv-journal" style="width:620px; display:flex; flex-direction:column; gap:14px">
      <div class="sv-journal-head"><div class="sv-journal-title"><span class="sv-journal-kicker">탐사 도감</span><span class="sv-journal-name">화성</span></div><span class="sv-tag">작성 중</span></div>
      <div class="sv-section"><div class="sv-section-title">보기 상태 <small>· 기본 / 선택됨 / 틀림 / 여러 개 고르기</small></div>
        <div class="sv-options">
          <button class="sv-option"><span class="sv-swatch sv-swatch--gray"></span><span class="sv-option-text">기본</span></button>
          <button class="sv-option" aria-pressed="true"><span class="sv-swatch sv-swatch--red"></span><span class="sv-option-text">선택됨</span>${check}</button>
          <button class="sv-option is-wrong" aria-pressed="true"><span class="sv-option-text">틀린 칸</span></button>
          <button class="sv-option"><span class="sv-box"></span><span class="sv-option-text">체크 안 함</span></button>
          <button class="sv-option" aria-pressed="true"><span class="sv-box"><svg aria-hidden="true" style="width:16px;height:16px;color:var(--sv-paper)"><use href="#i-check"/></svg></span><span class="sv-option-text">체크함</span></button>
        </div>
      </div>
      <div class="sv-hint">${use('i-hint')}<span>힌트 상자: 정답은 숨기고 관찰 방법만 알려 줘요.</span></div>
      <div style="display:flex; gap:12px" data-slot="paper-buttons"></div>
    </div>
    <div class="paper-box sv-journal" style="width:560px; display:flex; flex-direction:column; gap:16px">
      <span class="cap">색 견본 8개 (항상 글자와 함께)</span>
      <div class="sv-options">
        <span class="sv-option"><span class="sv-swatch sv-swatch--gray"></span>회색</span>
        <span class="sv-option"><span class="sv-swatch sv-swatch--yellow"></span>노란색</span>
        <span class="sv-option"><span class="sv-swatch sv-swatch--earth"></span>바다와 땅</span>
        <span class="sv-option"><span class="sv-swatch sv-swatch--red"></span>붉은색</span>
        <span class="sv-option"><span class="sv-swatch sv-swatch--stripe"></span>줄무늬</span>
        <span class="sv-option"><span class="sv-swatch sv-swatch--tan"></span>연한 갈색</span>
        <span class="sv-option"><span class="sv-swatch sv-swatch--teal"></span>청록색</span>
        <span class="sv-option"><span class="sv-swatch sv-swatch--blue"></span>파란색</span>
      </div>
      <span class="cap">완성 카드 기록 줄 · 태그</span>
      <dl class="sv-record" style="margin:0"><div class="sv-record-row"><dt>고리</dt><dd>고리가 없어요</dd></div></dl>
      <div style="display:flex; gap:10px"><span class="sv-tag">작성 중</span><span class="sv-tag sv-tag--done">완성</span></div>
    </div>
    <div class="paper-box sv-journal" style="width:420px; display:flex; flex-direction:column; gap:20px; align-items:center">
      <span class="cap" style="align-self:flex-start">완성 도장 · 교과서 문장</span>
      <div class="sv-stamp"><span class="sv-stamp-small">STAR VOYAGER</span><span class="sv-stamp-big">관찰 완료</span><span class="sv-stamp-small">05 / 08</span></div>
      <p class="sv-fact" style="margin:0">화성은 전체적으로 붉게 보여요.</p>
    </div>
  </div>

  ${heading('7 미션 패널', '.sv-mission .sv-choice .sv-hint-dark .sv-banner-ok .sv-reveal .sv-blank')}
  <div class="row">
    <div class="sv-mission" style="width:620px; display:flex; flex-direction:column; border-radius:var(--sv-radius)">
      <div class="sv-mission-progress"><span>탐사 2 · 문항 1/3</span><span class="sv-dots"><span class="is-on"></span><span></span><span></span></span></div>
      <h3 class="sv-question">질문은 30px 굵게, 두 줄까지</h3>
      <div class="sv-choices">
        <button class="sv-choice"><span class="sv-choice-key">1</span>기본 보기</button>
        <button class="sv-choice" aria-pressed="true"><span class="sv-choice-key">2</span>선택됨</button>
        <button class="sv-choice is-wrong"><span class="sv-choice-key">3</span>오답</button>
        <button class="sv-choice is-correct"><span class="sv-choice-key">4</span>정답</button>
      </div>
    </div>
    <div class="sv-mission" style="width:620px; display:flex; flex-direction:column; border-radius:var(--sv-radius)">
      <div class="sv-banner-ok">${use('i-check')}정답이에요!</div>
      <div class="sv-hint-dark">${use('i-hint')}<span>오답 힌트: 정답 없이 관찰 방법만.</span></div>
      <div class="sv-guide">${use('i-land')}<span>관찰 안내 한 줄</span></div>
      <div class="sv-reveal"><span class="sv-reveal-key">정답은 4개예요</span>두 번째도 틀리면 정답과 이유를 보여 줘요.</div>
      <p class="sv-sentence">한 줄 정리 빈칸: <span class="sv-blank">단단한 땅</span> <span class="sv-blank"></span></p>
    </div>
  </div>

  ${heading('8 끌어다 놓기 · 안내', '.sv-card .sv-slot .sv-notice · 발견 카드 · 확인 대화 상자')}
  <div class="row">
    <div class="glass-box" style="display:flex; gap:20px; align-items:flex-start">
      <div class="item"><div class="sv-slot" style="width:190px; height:150px"><span class="sv-slot-num">1</span><button class="sv-card"><span class="sv-card-dot" data-accent="jupiter" style="background:var(--sv-accent)"></span>목성</button></div><span class="cap">카드 기본</span></div>
      <div class="item"><div class="sv-slot is-target" style="width:190px; height:150px"><span class="sv-slot-num">4</span></div><span class="cap">놓을 수 있는 칸</span></div>
      <div class="item"><div class="sv-slot" style="width:190px; height:150px"><span class="sv-slot-num">3</span><button class="sv-card is-wrong"><span class="sv-card-dot" data-accent="neptune" style="background:var(--sv-accent)"></span>해왕성</button></div><span class="cap">틀린 자리</span></div>
      <div class="item"><div style="width:190px; height:150px; display:flex; align-items:center; justify-content:center"><button class="sv-card is-dragging" style="width:168px"><span class="sv-card-dot" data-accent="uranus" style="background:var(--sv-accent)"></span>천왕성</button></div><span class="cap">집은 카드</span></div>
    </div>
    <div class="glass-box" style="display:flex; flex-direction:column; gap:20px; width:760px; position:relative; min-height:260px">
      <div class="sv-notice">${use('i-warn')}자리가 맞지 않는 카드가 있어요. 한 번 더 해 봐요.</div>
      <div class="sv-discovery" style="position:static; transform:none; align-self:flex-start">${use('i-star')}태양은 지구보다 훨씬, 훨씬 커요!</div>
      <div class="row" data-slot="demo-buttons"></div>
    </div>
  </div>

  ${heading('9 아이콘', 'src/assets/icons.svg · 24×24 선 아이콘 · currentColor')}
  <div class="icons">${ICONS.map((n) => `<div class="icon-cell">${use(n)}<span>${n}</span></div>`).join('')}</div>
`;

export function renderUiGallery(app) {
  app.classList.remove('sv-stage');
  document.body.dataset.accent = new URLSearchParams(location.search).get('accent') ?? 'mars';

  const select = el('select', { 'aria-label': '강조 색' },
    ACCENTS.map(([id, name]) => el('option', { value: id }, `${id} · ${name}`)));
  select.value = document.body.dataset.accent;
  select.addEventListener('change', () => { document.body.dataset.accent = select.value; });
  const toolbar = el('div', { class: 'ds-toolbar' }, ['강조 색', select, '· 화면 폭 1440px 이하에서는 크롬북 크기 값이 적용돼요']);

  const main = el('main', { class: 'ds' });
  main.innerHTML = TEMPLATE;
  app.append(toolbar, main);

  const slot = (name) => main.querySelector(`[data-slot="${name}"]`);
  const ctlDemo = (button, caption) =>
    el('div', { class: 'item' }, [el('div', { class: 'ctl-demo' }, button), el('span', { class: 'cap' }, caption)]);

  slot('controls').append(
    ctlDemo(controlButton({ iconName: 'i-land', label: '기본' }), 'default'),
    ctlDemo(toggleButton({ iconName: 'i-label', label: '켜짐', pressed: true }), 'aria-pressed=true (누르면 꺼짐)'),
    ctlDemo(controlButton({ iconName: 'i-ring', label: '눌러 봐요', cue: true }), '.is-cue (미션 안내)'),
    ctlDemo(controlButton({ iconName: 'i-next', label: '잠김', disabled: true }), 'disabled (비행·착륙 중)'),
    el('div', { class: 'item' }, [
      el('div', { class: 'sv-glass sv-ctl-group', style: 'height:var(--sv-button-h); width:260px', role: 'group', 'aria-label': '빠르기' }, [
        el('span', { class: 'sv-ctl-group-label' }, '빠르기'),
        el('div', { class: 'sv-seg' }, ['×0.5', '×1', '×2'].map((t) => el('button', { type: 'button', 'aria-pressed': t === '×1' ? 'true' : 'false' }, t)))
      ]),
      el('span', { class: 'cap' }, '.sv-ctl-group + .sv-seg')
    ]),
    el('div', { class: 'item' }, [ghostButton({ iconName: 'i-resend', label: '다시 보내기' }), el('span', { class: 'cap' }, '.sv-ghost')]),
    el('div', { class: 'item', style: 'width:520px' }, [
      el('div', { class: 'sv-glass sv-time', style: 'height:var(--sv-button-h)' }, [
        el('div', { class: 'sv-time-head' }, [
          el('label', { for: 'ds-time', class: 'sv-time-now' }, '저녁 8시'),
          el('span', { class: 'sv-time-ends' }, '저녁 6시 ─ 아침 6시')
        ]),
        el('input', { id: 'ds-time', class: 'sv-range', type: 'range', min: 18, max: 30, value: 20, style: '--sv-fill:17%' })
      ]),
      el('span', { class: 'cap' }, '시각 슬라이더 .sv-time + .sv-range')
    ])
  );

  slot('handle').append(panelHandle({}));
  slot('paper-buttons').append(
    Object.assign(secondaryButton({ label: '보조 버튼' }), { style: 'flex:1' }),
    Object.assign(primaryButton({ label: '주요 버튼' }), { style: 'flex:1.3' })
  );

  // 견본 화면은 길게 스크롤되므로, 앱 화면(100vh 무대)처럼 보이도록 화면에 고정된 겹침 층에 띄운다.
  const overlay = el('div', { style: 'position:fixed; inset:0; pointer-events:none' });
  document.body.append(overlay);
  const cards = createDiscoveryCards(overlay);
  let n = 0;
  slot('demo-buttons').append(
    ghostButton({ iconName: 'i-star', label: '발견 카드 띄우기', onClick: () => cards.show(`demo-${n++}`, '태양은 지구보다 훨씬, 훨씬 커요!') }),
    ghostButton({ iconName: 'i-user', label: '확인 대화 상자 열기', onClick: () => confirmDialog({
      title: '다른 친구가 사용할까요?',
      message: '지금 친구의 이름과 도감 기록이 이 기기에서 지워져요. 이미 보낸 기록은 선생님께 남아 있어요.',
      confirmLabel: '지우고 바꾸기'
    }) })
  );
}
