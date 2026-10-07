// 조종석 HUD: 네 모서리 꺾쇠, 상단 계기판(현재 탐사 / 목적지 / 진행 개수), 구성원 칩, 모형 안내, 도감 손잡이, 하단 조작 패널.
// 하단 조작은 상태에 따라 바뀐다.
//   map   (S03): 재생 · 빠르기 · 태양 빛 가리기 · 고리 찾기 · 이름 보기 · 도감
//   focus      : 위 + 맨 앞 '태양계 지도'(달·혜성·소행성을 따라가며 볼 때)
//   planet(S04): 태양계 지도 · 이전 행성 · 다음 행성 · 착륙하기 · 고리 찾기 · 이름 보기 · 도감
// 비행 중에는 목적지 칸이 "○○(으)로 이동 중"으로 바뀌고 하단 버튼이 잠긴다.
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { controlButton, toggleButton, setPressed } from './components/buttons.js';
import { panelHandle } from './components/panel.js';
import { MEMBERS } from '../model/memberProgress.js';
import { withEuro } from '../model/josa.js';

const SPEEDS = [0.5, 1, 2];

export function createHud(root, handlers) {
  const corners = ['tl', 'tr', 'bl', 'br'].map((c) => el('div', { class: `sv-corner sv-corner--${c}` }));

  // ---- 상단 계기판 ----
  // '현재 탐사' 칸은 미션을 붙이는 Phase 9A에서 채운다. 지금은 자리만 둔다.
  const missionCell = el('div', { class: 'sv-glass sv-hud-cell sv-hud-cell--empty', 'aria-hidden': 'true' });
  const destKey = el('span', { class: 'sv-hud-key' }, '목적지');
  const destVal = el('span', { class: 'sv-hud-val' }, '태양계 지도');
  const destCell = el('div', { class: 'sv-glass sv-hud-cell sv-hud-dest', role: 'status' }, [destKey, destVal]);
  const progressNum = el('span', { class: 'sv-hud-num' }, '0/5');
  const progressCell = el('div', { class: 'sv-glass sv-hud-cell' }, [el('span', { class: 'sv-hud-key' }, '구성원 찾기'), progressNum]);
  const top = el('header', { class: 'sv-hud-top' }, [missionCell, destCell, progressCell]);

  // ---- 구성원 칩(S03 오른쪽 위) ----
  const chips = Object.fromEntries(MEMBERS.map((m) => [m.id, el('span', { class: 'sv-member' }, m.label)]));
  const chipBar = el('div', { class: 'sv-glass sv-members', 'aria-label': '찾은 태양계 구성원' }, Object.values(chips));

  const modelNote = el('p', { class: 'sv-glass sv-model-note sv-model-note--map' }, [icon('i-info'), '모형입니다: 크기와 거리는 실제와 달라요']);
  const handle = panelHandle({ label: '도감 열기', onClick: handlers.onJournal });

  // ---- 하단 조작 패널 ----
  const mapButton = controlButton({ iconName: 'i-map', label: '태양계 지도', onClick: handlers.onMap });
  const prevButton = controlButton({ iconName: 'i-prev', label: '이전 행성', onClick: handlers.onPrev });
  const nextButton = controlButton({ iconName: 'i-next', label: '다음 행성', onClick: handlers.onNext });
  const landButton = controlButton({ iconName: 'i-land', label: '착륙하기', disabled: true }); // 기능은 Phase 4
  const playIcon = icon('i-play');
  const playLabel = document.createTextNode('재생');
  const playButton = el('button', { type: 'button', class: 'sv-ctl', 'aria-pressed': 'false' }, [playIcon, playLabel]);
  playButton.addEventListener('click', () => handlers.onPlay(playButton.getAttribute('aria-pressed') !== 'true'));

  const speedButtons = SPEEDS.map((s) => el('button', { type: 'button', 'aria-pressed': s === 1 ? 'true' : 'false', onclick: () => handlers.onSpeed(s) }, `×${s}`));
  const speedGroup = el('div', { class: 'sv-glass sv-ctl-group', role: 'group', 'aria-label': '빠르기' }, [
    el('span', { class: 'sv-ctl-group-label' }, '빠르기'),
    el('div', { class: 'sv-seg' }, speedButtons)
  ]);
  const sunButton = toggleButton({ iconName: 'i-sun-off', label: '태양 빛 가리기', onChange: handlers.onSunlightBlock });
  const ringButton = toggleButton({ iconName: 'i-ring', label: '고리 찾기', onChange: handlers.onLoupe });
  const namesButton = toggleButton({ iconName: 'i-label', label: '이름 보기', pressed: true, onChange: handlers.onNames });
  const journalButton = controlButton({ iconName: 'i-journal', label: '도감', onClick: handlers.onJournal });
  const controls = el('nav', { class: 'sv-controls', 'aria-label': '조작' },
    [mapButton, prevButton, nextButton, landButton, playButton, speedGroup, sunButton, ringButton, namesButton, journalButton]);

  root.append(...corners, top, el('div', { class: 'sv-hud-rule' }), chipBar, modelNote, handle, controls);

  const SHOWN = {
    map: [playButton, speedGroup, sunButton, ringButton, namesButton, journalButton],
    focus: [mapButton, playButton, speedGroup, sunButton, ringButton, namesButton, journalButton],
    planet: [mapButton, prevButton, nextButton, landButton, ringButton, namesButton, journalButton]
  };
  let mode = 'map';
  let neighbors = { prev: null, next: null };
  let locked = false;

  function refreshDisabled() {
    for (const b of [mapButton, playButton, ...speedButtons, sunButton, ringButton, namesButton, journalButton, handle]) b.disabled = locked;
    prevButton.disabled = locked || !neighbors.prev;
    nextButton.disabled = locked || !neighbors.next;
  }

  return {
    setDestination(name) {
      destCell.classList.remove('sv-hud-flying');
      destKey.textContent = '목적지';
      destVal.textContent = name;
    },
    setFlying(name) {
      destCell.classList.add('sv-hud-flying');
      destKey.textContent = '이동 중';
      destVal.textContent = `${withEuro(name)} 이동 중`;
    },
    setLocked(on) {
      locked = on;
      refreshDisabled();
    },
    // mode: 'map' | 'focus' | 'planet'. planet일 때 neighbors({ prev, next })로 이전/다음 행성 버튼을 켜고 끈다.
    setMode(next, nextNeighbors = { prev: null, next: null }) {
      mode = next;
      neighbors = nextNeighbors;
      for (const child of controls.children) child.hidden = !SHOWN[mode].includes(child);
      // 행성 탐사 화면(S04)에는 구성원 칩과 모형 안내가 없다.
      chipBar.hidden = mode === 'planet';
      modelNote.hidden = mode === 'planet';
      refreshDisabled();
    },
    setPlaying(playing) {
      setPressed(playButton, playing);
      playIcon.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
      playLabel.textContent = playing ? '일시정지' : '재생';
    },
    setSpeed(speed) {
      speedButtons.forEach((b, i) => setPressed(b, SPEEDS[i] === speed));
    },
    setSunlightBlocked(on) { setPressed(sunButton, on); },
    setMembers({ found, count, total }) {
      for (const m of MEMBERS) {
        const on = found.includes(m.id);
        const chip = chips[m.id];
        if (chip.classList.contains('is-found') === on && chip.childNodes.length) continue;
        chip.className = on ? 'sv-member is-found' : 'sv-member';
        chip.replaceChildren(...(on ? [icon('i-check'), m.label] : [m.label]));
      }
      progressNum.textContent = `${count}/${total}`;
    },
    getMode: () => mode
  };
}
