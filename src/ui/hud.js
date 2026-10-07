// 조종석 HUD 뼈대(S03): 네 모서리 꺾쇠, 상단 계기판(현재 탐사 / 목적지 / 진행 개수), 구성원 칩,
// 모형 안내, 도감 손잡이, 하단 조작 패널. 비행 중에는 목적지 칸이 "○○(으)로 이동 중"으로 바뀌고 하단 버튼이 잠긴다.
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
  mapButton.hidden = true;
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
  const ringButton = controlButton({ iconName: 'i-ring', label: '고리 찾기', disabled: true }); // 기능은 Phase 3
  const namesButton = toggleButton({ iconName: 'i-label', label: '이름 보기', pressed: true, onChange: handlers.onNames });
  const journalButton = controlButton({ iconName: 'i-journal', label: '도감', onClick: handlers.onJournal });
  const controls = el('nav', { class: 'sv-controls', 'aria-label': '조작' },
    [mapButton, playButton, speedGroup, sunButton, ringButton, namesButton, journalButton]);

  root.append(...corners, top, el('div', { class: 'sv-hud-rule' }), chipBar, modelNote, handle, controls);

  // 비행 중 잠글 버튼들(고리 찾기는 이번 Phase 내내 잠겨 있다)
  const lockable = [mapButton, playButton, ...speedButtons, sunButton, namesButton, journalButton, handle];

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
    setLocked(locked) {
      for (const b of lockable) b.disabled = locked;
    },
    setFocused(focused) {
      mapButton.hidden = !focused;
    },
    setPlaying(playing) {
      setPressed(playButton, playing);
      playIcon.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
      playLabel.textContent = playing ? '일시정지' : '재생';
    },
    setSpeed(speed) {
      speedButtons.forEach((b, i) => setPressed(b, SPEEDS[i] === speed));
    },
    setMembers({ found, count, total }) {
      for (const m of MEMBERS) {
        const on = found.includes(m.id);
        const chip = chips[m.id];
        if (chip.classList.contains('is-found') === on && chip.childNodes.length) continue;
        chip.className = on ? 'sv-member is-found' : 'sv-member';
        chip.replaceChildren(...(on ? [icon('i-check'), m.label] : [m.label]));
      }
      progressNum.textContent = `${count}/${total}`;
    }
  };
}
