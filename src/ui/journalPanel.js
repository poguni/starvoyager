// 탐사 도감 화면(S04 작성 중·틀린 칸, S05 완성 카드, S10 크롬북 아래 패널, S10b 접힌 막대).
// 전자칠판 크기: 오른쪽 종이 노트 패널(.sv-panel). 크롬북 크기(1440px 이하): 아래에서 올라오는 패널(.sv-sheet).
// 보기: 목차(구성원 쪽·태양 카드·행성 카드 8장) / 행성 카드 / 태양 카드(docs/결정기록.md 2026-10-08).
// 도감 상태는 model/journal.js가 갖고, 이 파일은 그리기와 누르기만 한다.
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { primaryButton, secondaryButton } from './components/buttons.js';
import { FIELDS, FACTS, HINTS, SUN_FACTS, SUN_LOCKED_TEXT, swatchOf } from '../data/planetFacts.js';
import { PLANET_IDS } from '../model/journal.js';
import { MEMBERS } from '../model/memberProgress.js';
import { bodyById } from '../model/world.js';

const pad2 = (n) => String(n).padStart(2, '0');

// 완성 도장(S05·S09). bottom: 아래 작은 글씨(완성 순서 "06 / 08")
export function stampEl(bottom, { enter = false } = {}) {
  return el('div', { class: enter ? 'sv-stamp sv-stamp--enter' : 'sv-stamp', role: 'img', 'aria-label': '완성 도장' }, [
    el('span', { class: 'sv-stamp-small' }, 'STAR VOYAGER'),
    el('span', { class: 'sv-stamp-big' }, '관찰 완료'),
    el('span', { class: 'sv-stamp-small' }, bottom)
  ]);
}

export const stampNumber = (order, total) => `${pad2(order)} / ${pad2(total)}`;

// 완성 카드의 기록 줄(S05·S09). 정답을 공개한 칸에는 '교과서 정답' 표시
export function recordList(journal, id, { features = true } = {}) {
  const record = journal.recordOf(id);
  const { revealed } = journal.getCard(id);
  const mark = (field) => revealed.includes(field) && el('span', { class: 'sv-jp-revealed' }, '교과서 정답');
  const row = (title, value, field) => el('div', { class: 'sv-record-row' }, [el('dt', {}, title), el('dd', {}, [...value, mark(field)])]);
  const rows = [
    row('색깔', [el('span', { class: `sv-swatch sv-swatch--${swatchOf(record.color)}` }), record.color], 'color'),
    row('표면 상태', [record.surface], 'surface'),
    row('고리', [record.ring], 'ring')
  ];
  if (features) {
    const none = revealed.includes('features') ? '없음' : '고른 특징 없음';
    const text = record.features.length ? record.features.join(', ') : el('span', { class: 'sv-jp-muted' }, none);
    rows.push(row('그 밖의 특징', [text], 'features'));
  }
  return el('dl', { class: 'sv-record' }, rows);
}

export function createJournalPanel(app, { journal, members, onOpenPlanet, onPresent, canPresent, onOpenChange }) {
  let open = false;
  let hidden = false; // 착륙·발표 중에는 잠시 감춘다
  let compact = false; // 크롬북 크기
  let barAllowed = false; // 크롬북 행성 탐사 화면에서 접히면 아래 막대(S10b)
  let view = { kind: 'toc' };
  let effect = null; // 다음 그리기에서 한 번만 할 연출: { shake } | { stamp: id }

  const kicker = el('span', { class: 'sv-journal-kicker' }, '탐사 도감');
  const name = el('span', { class: 'sv-journal-name' });
  const headSide = el('div', { class: 'sv-jp-head-side' });
  const head = el('div', { class: 'sv-journal-head' }, [el('div', { class: 'sv-journal-title' }, [kicker, name]), headSide]);
  const grip = el('button', { type: 'button', class: 'sv-sheet-grip', 'aria-label': '도감 접기', onclick: () => setOpen(false) });
  const body = el('div', { class: 'sv-jp-body' });
  const panel = el('section', { class: 'sv-journal sv-jp', 'aria-label': '탐사 도감' }, [grip, head, body]);

  // 크롬북 접힌 막대(S10b)
  const barName = el('b');
  const barTag = el('span', { class: 'sv-tag' });
  const bar = el('button', { type: 'button', class: 'sv-journal sv-jp-bar', 'aria-label': '도감 펼치기', onclick: () => setOpen(true) }, [
    icon('i-journal'), el('span', { class: 'sv-journal-kicker' }, '탐사 도감'), barName, barTag,
    el('span', { class: 'sv-jp-bar-open' }, ['펼치기', icon('i-next')])
  ]);
  app.append(panel, bar);

  journal.subscribe(render);
  members.subscribe(() => { if (view.kind === 'toc') render(); });

  // ---- 그리기 ----
  function statusTag(status) {
    if (status === 'done') return el('span', { class: 'sv-tag sv-tag--done' }, '완성');
    return el('span', { class: 'sv-tag' }, status === 'todo' ? '아직' : '작성 중');
  }

  function tocButton() {
    return el('button', { type: 'button', class: 'sv-tag sv-jp-toc', onclick: showToc }, [icon('i-prev'), '목차']);
  }

  function renderToc() {
    name.textContent = '목차';
    headSide.replaceChildren();
    const { found, count, total } = members.getState();
    const memberItems = MEMBERS.map((m) => {
      const on = found.includes(m.id);
      return el('li', { class: on ? 'sv-option sv-jp-member is-found' : 'sv-option sv-jp-member' }, [on && icon('i-check'), m.label]);
    });
    const sun = journal.getSun();
    const planetButtons = PLANET_IDS.map((id) => el('button', {
      type: 'button', class: 'sv-option sv-jp-card-btn', onclick: () => onOpenPlanet(id)
    }, [el('span', { class: 'sv-option-text' }, bodyById(id).name), statusTag(journal.getCard(id).status)]));
    // 크롬북은 2열: 구성원·태양 카드 / 행성 카드
    body.replaceChildren(el('div', { class: 'sv-jp-toc-grid' }, [
      el('div', { class: 'sv-jp-col' }, [
        el('div', { class: 'sv-section' }, [
          el('div', { class: 'sv-section-title' }, ['태양계 구성원 ', el('small', {}, `· 찾은 것 ${count}/${total}`)]),
          el('ul', { class: 'sv-jp-members' }, memberItems)
        ]),
        el('div', { class: 'sv-section' }, [
          el('div', { class: 'sv-section-title' }, '태양 카드'),
          el('button', { type: 'button', class: 'sv-option sv-jp-card-btn', onclick: showSun }, [
            el('span', { class: 'sv-option-text' }, '태양'), statusTag(sun.done ? 'done' : 'todo')
          ])
        ])
      ]),
      el('div', { class: 'sv-jp-col' }, [
        el('div', { class: 'sv-section' }, [
          el('div', { class: 'sv-section-title' }, ['행성 카드 ', el('small', {}, `· 완성 ${journal.count()}/${journal.total}`)]),
          el('div', { class: 'sv-options sv-jp-planets' }, planetButtons)
        ])
      ])
    ]));
  }

  function optionButton(id, field, value, card) {
    const multi = field.multi;
    const pressed = multi ? card.picks.features.includes(value) : card.picks[field.id] === value;
    const wrongPick = card.status === 'retry' ? card.wrongPicks[field.id] : undefined;
    const wrong = pressed && wrongPick !== undefined && (multi ? wrongPick.includes(value) : wrongPick === value);
    const classes = ['sv-option', wrong && 'is-wrong', wrong && effect?.shake && 'sv-jp-shake'].filter(Boolean).join(' ');
    const swatch = field.id === 'color' && el('span', { class: `sv-swatch sv-swatch--${swatchOf(value)}` });
    return el('button', {
      type: 'button', class: classes, 'aria-pressed': pressed ? 'true' : 'false',
      disabled: !journal.canEdit(id, field.id),
      onclick: () => journal.pick(id, field.id, value)
    }, [multi ? el('span', { class: 'sv-box' }, pressed ? icon('i-check') : null) : swatch,
      el('span', { class: 'sv-option-text' }, value), !multi && icon('i-check', 'sv-check')]);
  }

  function fieldSection(id, field, index, card) {
    const how = field.multi ? (compact ? '여러 개' : '여러 개 고르기 (안 골라도 돼요)') : (compact ? '하나' : '하나 고르기');
    const showHint = card.status === 'retry' && field.id in card.wrongPicks;
    return el('div', { class: `sv-section sv-jp-field sv-jp-field--${field.id}` }, [
      el('div', { class: 'sv-section-title' }, [`${index + 1} ${field.title} `, el('small', {}, `· ${how}`)]),
      el('div', { class: 'sv-options' }, field.options.map((v) => optionButton(id, field, v, card))),
      showHint && el('div', { class: 'sv-hint', role: 'status' }, [icon('i-hint'), el('span', {}, HINTS[field.id])])
    ]);
  }

  function renderForm(id, card) {
    headSide.replaceChildren(tocButton(), statusTag(card.status === 'todo' ? 'editing' : card.status));
    const sections = FIELDS.map((f, i) => fieldSection(id, f, i, card));
    const retry = card.status === 'retry';
    const submit = primaryButton({
      iconName: 'i-pencil', label: retry ? '다시 고치기 (1번 남음)' : '도감에 기록하기',
      disabled: !journal.canSubmit(id),
      onClick() {
        const result = journal.submit(id);
        effect = result === 'retry' ? { shake: true } : result ? { stamp: id } : null;
        render();
      }
    });
    submit.classList.add('sv-jp-submit');
    // 크롬북은 3열(S10): 색깔 / 표면 상태·고리 / 그 밖의 특징·기록하기. 전자칠판은 열 구분 없이 위에서 아래로.
    body.replaceChildren(el('div', { class: 'sv-jp-form' }, [
      el('div', { class: 'sv-jp-col' }, [sections[0]]),
      el('div', { class: 'sv-jp-col' }, [sections[1], sections[2]]),
      el('div', { class: 'sv-jp-col' }, [sections[3], submit])
    ]));
  }

  function renderDone(id, card) {
    headSide.replaceChildren(statusTag('done'));
    const enter = effect?.stamp === id;
    const fact = el('p', { class: enter ? 'sv-fact sv-jp-fact sv-jp-fact--enter' : 'sv-fact sv-jp-fact' }, FACTS[id]);
    const present = primaryButton({ iconName: 'i-present', label: '발표하기', disabled: !canPresent(id), onClick: () => onPresent(id) });
    body.replaceChildren(el('div', { class: 'sv-jp-done' }, [
      el('div', { class: 'sv-jp-col' }, [recordList(journal, id)]),
      el('div', { class: 'sv-jp-col' }, [
        el('div', { class: 'sv-jp-stamp-row' }, [stampEl(stampNumber(card.order, journal.total), { enter }), fact]),
        // 행성 랩 자리(S05). 랩 만들기는 Phase 9B
        el('div', { class: 'sv-jp-rap' }, [
          el('span', { class: 'sv-section-title' }, '행성 랩'),
          el('span', { class: 'sv-jp-muted' }, '탐사 2를 마치면 이 카드로 랩을 만들 수 있어요.')
        ]),
        el('div', { class: 'sv-jp-actions' }, [secondaryButton({ iconName: 'i-prev', label: '도감 목차', onClick: showToc }), present])
      ])
    ]));
  }

  function renderSun() {
    name.textContent = '태양';
    const sun = journal.getSun();
    headSide.replaceChildren(statusTag(sun.done ? 'done' : 'todo'));
    const content = sun.done
      ? [
        el('dl', { class: 'sv-record' }, SUN_FACTS.map((t) => el('div', { class: 'sv-record-row sv-jp-sun-row' }, [el('dd', {}, [icon('i-sun'), t])]))),
        el('div', { class: 'sv-jp-stamp-row' }, [stampEl('THE SUN'), el('p', { class: 'sv-fact sv-jp-fact' }, sun.summary)])
      ]
      : [el('p', { class: 'sv-fact sv-jp-fact' }, SUN_LOCKED_TEXT)];
    body.replaceChildren(el('div', { class: 'sv-jp-sun' }, [
      ...content,
      el('div', { class: 'sv-jp-actions' }, [secondaryButton({ iconName: 'i-prev', label: '도감 목차', onClick: showToc })])
    ]));
  }

  function render() {
    if (view.kind === 'toc') renderToc();
    else if (view.kind === 'sun') renderSun();
    else {
      const card = journal.getCard(view.id);
      name.textContent = bodyById(view.id).name;
      if (card.status === 'done') renderDone(view.id, card);
      else renderForm(view.id, card);
    }
    panel.dataset.view = view.kind === 'planet' ? (journal.getCard(view.id).status === 'done' ? 'done' : 'form') : view.kind;
    effect = null;
    renderBar();
  }

  function renderBar() {
    barName.textContent = name.textContent;
    const status = view.kind === 'planet' ? journal.getCard(view.id).status : view.kind === 'sun' ? (journal.getSun().done ? 'done' : 'todo') : null;
    barTag.hidden = status === null;
    if (status) {
      barTag.className = status === 'done' ? 'sv-tag sv-tag--done' : 'sv-tag';
      barTag.textContent = status === 'done' ? '완성' : status === 'todo' ? '아직' : '작성 중';
    }
  }

  // ---- 펼침·배치 ----
  function layout() {
    panel.classList.toggle('sv-panel', !compact);
    panel.classList.toggle('sv-sheet', compact);
    panel.classList.toggle('is-open', open && !hidden);
    panel.setAttribute('aria-hidden', open && !hidden ? 'false' : 'true');
    panel.inert = !(open && !hidden);
    const barOn = compact && barAllowed && !open && !hidden;
    bar.hidden = !barOn;
    app.classList.toggle('sv-jp-sheet-open', compact && open && !hidden);
    app.classList.toggle('sv-jp-bar-on', barOn);
  }

  function setOpen(next) {
    if (open === next) return;
    open = next;
    layout();
    onOpenChange?.(open);
  }

  function showToc() { view = { kind: 'toc' }; render(); }
  function showSun() { view = { kind: 'sun' }; render(); }

  render();
  layout();

  return {
    setOpen,
    isOpen: () => open,
    // 3D 구도에 영향을 주는지(펼쳐져 보이는 중)
    isShown: () => open && !hidden,
    showToc,
    showSun,
    showPlanet(id) {
      if (view.kind === 'planet' && view.id === id) return;
      view = { kind: 'planet', id };
      render();
    },
    // 지금 펼쳐져 있는 작성 중 행성 카드(소요 시간을 셀 카드)
    activeCardId() {
      if (!open || hidden || view.kind !== 'planet') return null;
      return journal.getCard(view.id).status === 'done' ? null : view.id;
    },
    setCompact(on) { compact = on; render(); layout(); },
    setBarAllowed(on) { barAllowed = on; layout(); },
    setHidden(on) { hidden = on; layout(); },
    refresh: render
  };
}
