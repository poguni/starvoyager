// 조종석 HUD: 네 모서리 꺾쇠, 상단 계기판(현재 탐사 / 목적지 / 진행 개수), 구성원 칩, 모형 안내, 도감 손잡이, 하단 조작 패널.
// 하단 조작은 상태에 따라 바뀐다.
//   map   (S03): 재생 · 빠르기 · 태양 빛 가리기 · 고리 찾기 · 이름 보기 · 도감
//   focus      : 위 + 맨 앞 '태양계 지도'(달·혜성·소행성을 따라가며 볼 때)
//   planet(S04): 태양계 지도 · 이전 행성 · 다음 행성 · 착륙하기 · 고리 찾기 · 이름 보기 · 도감
//   size  (S07): 실제 크기로 보기 · 태양과 비교하기 · 이름 보기 · 태양계 지도
//   sky   (S08): 시각 슬라이더 · 힌트 · 마지막 선 지우기 · 주변 불빛 · 이름 보기 · 도감
// 비행 중에는 목적지 칸이 "○○(으)로 이동 중"으로 바뀌고 하단 버튼이 잠긴다.
import { el } from './components/dom.js';
import { icon } from './components/icon.js';
import { controlButton, toggleButton, setPressed, setCue } from './components/buttons.js';
import { panelHandle } from './components/panel.js';
import { MEMBERS } from '../model/memberProgress.js';
import { withEuro } from '../model/josa.js';
import { TIME_MIN, TIME_MAX, TIME_STEP, TIME_DEFAULT, timeLabel } from '../model/skyTime.js';

const SPEEDS = [0.5, 1, 2];

export function createHud(root, handlers) {
  const corners = ['tl', 'tr', 'bl', 'br'].map((c) => el('div', { class: `sv-corner sv-corner--${c}` }));

  // ---- 상단 계기판 ----
  // '현재 탐사' 칸(MISSION 0N 탐사 N · 제목). 미션을 하지 않을 때는 자리만 둔다.
  const missionCode = el('span', { class: 'sv-hud-code' });
  const missionTitle = el('span', { class: 'sv-hud-val' });
  const missionCell = el('div', { class: 'sv-glass sv-hud-cell sv-hud-cell--empty' }, [missionCode, missionTitle]);
  const destKey = el('span', { class: 'sv-hud-key' }, '목적지');
  const destVal = el('span', { class: 'sv-hud-val' }, '태양계 지도');
  const destCell = el('div', { class: 'sv-glass sv-hud-cell sv-hud-dest', role: 'status' }, [destKey, destVal]);
  // 진행 칸: 태양계 지도에서는 '구성원 찾기 n/5'(S03), 행성 탐사 화면에서는 '도감 n/8'(S04)
  const progressKey = el('span', { class: 'sv-hud-key' }, '구성원 찾기');
  const progressNum = el('span', { class: 'sv-hud-num' }, '0/5');
  const progressCell = el('div', { class: 'sv-glass sv-hud-cell' }, [progressKey, progressNum]);
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
  const landButton = controlButton({ iconName: 'i-land', label: '착륙하기', onClick: handlers.onLand });
  const ascendButton = controlButton({ iconName: 'i-ascend', label: '다시 올라가기', cue: true, onClick: handlers.onAscend });
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
  // 크기 비교 실험실(S07)
  const realButton = toggleButton({ iconName: 'i-scale', label: '실제 크기로 보기', onChange: handlers.onRealSize });
  const sunCompareButton = toggleButton({ iconName: 'i-sun', label: '태양과 비교하기', onChange: handlers.onSunCompare });
  const sizeMapButton = controlButton({ iconName: 'i-map', label: '태양계 지도', onClick: handlers.onMap });
  // 북쪽 밤하늘(S08): 시각 슬라이더(저녁 6시 ~ 아침 6시)
  const timeNow = el('label', { class: 'sv-time-now', for: 'sv-time-range' }, timeLabel(TIME_DEFAULT));
  const timeRange = el('input', { id: 'sv-time-range', class: 'sv-range', type: 'range', min: TIME_MIN, max: TIME_MAX, step: TIME_STEP, value: TIME_DEFAULT });
  timeRange.addEventListener('input', () => handlers.onTime(Number(timeRange.value)));
  const timeGroup = el('div', { class: 'sv-glass sv-time' }, [
    el('div', { class: 'sv-time-head' }, [timeNow, el('span', { class: 'sv-time-ends' }, '저녁 6시 ─ 밤 12시 ─ 아침 6시')]),
    timeRange
  ]);
  const hintButton = controlButton({ iconName: 'i-hint', label: '힌트', onClick: handlers.onHint });
  const undoButton = controlButton({ iconName: 'i-undo', label: '마지막 선 지우기', onClick: handlers.onUndo });
  const cityButton = toggleButton({ iconName: 'i-city', label: '주변 불빛', onChange: handlers.onCityLights });
  const controls = el('nav', { class: 'sv-controls', 'aria-label': '조작' },
    [timeGroup, hintButton, undoButton, cityButton, realButton, sunCompareButton, mapButton, prevButton, nextButton, landButton, ascendButton, playButton, speedGroup, sunButton, ringButton, namesButton, journalButton, sizeMapButton]);
  // 착륙 결과 배너(docs/결정기록.md 2026-10-08): HUD 가운데 위쪽
  const bannerIcon = icon('i-land');
  const bannerText = el('span');
  const banner = el('div', { class: 'sv-landing-banner', role: 'status', hidden: true }, [bannerIcon, bannerText]);

  root.append(...corners, top, el('div', { class: 'sv-hud-rule' }), chipBar, modelNote, handle, controls, banner);

  const SHOWN = {
    map: [playButton, speedGroup, sunButton, ringButton, namesButton, journalButton],
    focus: [mapButton, playButton, speedGroup, sunButton, ringButton, namesButton, journalButton],
    planet: [mapButton, prevButton, nextButton, landButton, ascendButton, ringButton, namesButton, journalButton],
    size: [realButton, sunCompareButton, namesButton, sizeMapButton],
    sky: [timeGroup, hintButton, undoButton, cityButton, namesButton, journalButton]
  };
  let mode = 'map';
  let neighbors = { prev: null, next: null };
  let locked = false;
  let landable = false;
  let landing = null; // null | 'landing'(내려가는 중) | 'landed'(땅 위)
  let memberCount = { count: 0, total: 5 };
  let journalCount = { count: 0, total: 8 };
  let skyCount = { count: 0, total: 3 };
  let undoable = false;
  let shownCount = null;
  let itemCount = null; // 크기 비교 실험실 미션: '문항 n/4'(S07)
  let missionLocks = new Set(); // 미션이 잠근 조작(missions.js의 조작 이름)
  let missionCue = null;
  let ringCue = false;

  // 미션 데이터의 조작 이름 → 버튼
  const KEYED = {
    map: mapButton, prev: prevButton, next: nextButton, land: landButton, play: playButton,
    sunlight: sunButton, loupe: ringButton, names: namesButton, journal: journalButton,
    real: realButton, sunCompare: sunCompareButton, sizeMap: sizeMapButton,
    time: timeRange, hint: hintButton, undo: undoButton, lights: cityButton
  };
  const cueTarget = (key) => (key === 'time' ? timeGroup : KEYED[key]);

  // 진행 칸을 지금 화면에 맞게 쓴다. 같은 칸의 숫자가 늘면 잠깐 커졌다 돌아온다(motion.md '도감').
  function refreshProgress() {
    const planet = mode === 'planet';
    const items = mode === 'size' && itemCount;
    const { count, total } = items ? itemCount : planet ? journalCount : mode === 'sky' ? skyCount : memberCount;
    const key = items ? '문항' : planet ? '도감' : mode === 'sky' ? '이은 별자리' : '구성원 찾기';
    progressCell.classList.toggle('sv-hud-cell--empty', mode === 'size' && !items);
    if (shownCount && shownCount.key === key && count > shownCount.count) {
      progressNum.classList.remove('sv-hud-num--pop');
      void progressNum.offsetWidth;
      progressNum.classList.add('sv-hud-num--pop');
    }
    shownCount = { key, count };
    progressKey.textContent = key;
    progressNum.textContent = `${count}/${total}`;
  }

  function refreshDisabled() {
    const off = locked || landing !== null;
    for (const b of [mapButton, playButton, ...speedButtons, sunButton, ringButton, namesButton, journalButton, handle, realButton, sunCompareButton, sizeMapButton, timeRange, hintButton, cityButton]) b.disabled = off;
    undoButton.disabled = off || !undoable;
    prevButton.disabled = off || !neighbors.prev;
    nextButton.disabled = off || !neighbors.next;
    landButton.disabled = off || !landable;
    for (const key of missionLocks) KEYED[key].disabled = true;
    if (missionLocks.has('journal')) handle.disabled = true;
    // 미션 확인 단계: 눌러 볼 조작에 강조 테두리. 켜고 끄는 버튼은 켜면 사라진다.
    for (const [key, b] of Object.entries(KEYED)) {
      const target = cueTarget(key);
      const unpressed = b.getAttribute('aria-pressed') !== 'true';
      let on = key === missionCue && !b.disabled && (b === landButton || b === timeRange || unpressed);
      if (b === ringButton) on ||= ringCue && unpressed; // 고리 찾기 강조는 도감 '고리' 칸 힌트도 쓴다
      setCue(target, on);
    }
    // 땅 위에서는 '착륙하기' 자리가 '다시 올라가기'로 바뀐다.
    if (mode === 'planet') {
      landButton.hidden = landing === 'landed';
      ascendButton.hidden = landing !== 'landed';
    }
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
    // mode: 'map' | 'focus' | 'planet' | 'size'. planet일 때 neighbors({ prev, next })로 이전/다음 행성 버튼을 켜고 끈다.
    setMode(next, nextNeighbors = { prev: null, next: null }) {
      mode = next;
      neighbors = nextNeighbors;
      for (const child of controls.children) child.hidden = !SHOWN[mode].includes(child);
      // 행성 탐사 화면(S04)·크기 비교 실험실(S07)에는 구성원 칩과 모형 안내가 없다.
      // 실험실에는 도감 손잡이가 없고, 진행 칸(S07 '문항 3/4')은 미션을 붙이는 Phase 9A에서 채운다.
      // 북쪽 밤하늘(S08)도 구성원 칩·모형 안내가 없다.
      chipBar.hidden = mode === 'planet' || mode === 'size' || mode === 'sky';
      modelNote.hidden = mode === 'planet' || mode === 'size' || mode === 'sky';
      handle.hidden = mode === 'size' || mode === 'sky' || handle.hidden;
      root.dataset.mode = mode;
      controls.classList.toggle('sv-controls--size', mode === 'size');
      controls.classList.toggle('sv-controls--sky', mode === 'sky');
      refreshDisabled();
      refreshProgress();
    },
    setPlaying(playing) {
      setPressed(playButton, playing);
      playIcon.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
      playLabel.textContent = playing ? '일시정지' : '재생';
      refreshDisabled();
    },
    setSpeed(speed) {
      speedButtons.forEach((b, i) => setPressed(b, SPEEDS[i] === speed));
    },
    setSunlightBlocked(on) { setPressed(sunButton, on); refreshDisabled(); },
    // 도감 '고리' 칸 힌트(돋보기를 켜 봐요)가 보이는 동안 '고리 찾기' 버튼에 눌러 보라는 안내(S04). 켜면 사라진다.
    setRingCue(on) { ringCue = on; refreshDisabled(); },
    // 지금 천체에 착륙할 수 있는지(태양이거나 미션이 잠그면 false)
    setLandable(on) { landable = on; refreshDisabled(); },
    setLanding(next) { landing = next; refreshDisabled(); },
    showBanner(iconName, text) {
      bannerIcon.querySelector('use').setAttribute('href', `#${iconName}`);
      bannerText.textContent = text;
      banner.hidden = false;
      banner.classList.remove('sv-landing-banner--enter');
      void banner.offsetWidth; // 다시 보일 때마다 등장 연출
      banner.classList.add('sv-landing-banner--enter');
    },
    hideBanner() { banner.hidden = true; },
    setMembers({ found, count, total }) {
      for (const m of MEMBERS) {
        const on = found.includes(m.id);
        const chip = chips[m.id];
        if (chip.classList.contains('is-found') === on && chip.childNodes.length) continue;
        chip.className = on ? 'sv-member is-found' : 'sv-member';
        chip.replaceChildren(...(on ? [icon('i-check'), m.label] : [m.label]));
      }
      memberCount = { count, total };
      refreshProgress();
    },
    setJournalCount(count, total) { journalCount = { count, total }; refreshProgress(); },
    // 도감이 펼쳐졌는지. bar: 크롬북에서 접힌 막대(S10b)가 손잡이 대신 보이는지
    setJournalOpen(open, bar = false) {
      setPressed(journalButton, open);
      handle.hidden = open || bar || mode === 'size' || mode === 'sky';
    },
    setRealSize(on) { setPressed(realButton, on); refreshDisabled(); },
    // 시각 슬라이더 표시(표기 + 채워진 막대)
    setTime(hour) {
      timeRange.value = hour;
      timeNow.textContent = timeLabel(hour);
      timeRange.style.setProperty('--sv-fill', `${((hour - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100}%`);
    },
    setCityLights(on) { setPressed(cityButton, on); refreshDisabled(); },
    // 지울 선이 있을 때만 '마지막 선 지우기'를 누를 수 있다.
    setUndoable(on) { undoable = on; refreshDisabled(); },
    setSkyCount({ count, total }) { skyCount = { count, total }; refreshProgress(); },
    setSunCompare(on) { setPressed(sunCompareButton, on); refreshDisabled(); },
    // 미션: 상단 '현재 탐사' 칸. null이면 비운다.
    setMission(mission) {
      missionCell.classList.toggle('sv-hud-cell--empty', !mission);
      missionCode.textContent = mission?.code ?? '';
      missionTitle.textContent = mission?.title ?? '';
    },
    // 미션이 장면을 맞출 때 켜고 끄는 버튼 표시도 함께 맞춘다.
    setNames(on) { setPressed(namesButton, on); refreshDisabled(); },
    setLoupe(on) { setPressed(ringButton, on); refreshDisabled(); },
    setItemCount(next) { itemCount = next; refreshProgress(); },
    // keys: 잠글 조작 이름 목록, cue: 강조할 조작 이름(없으면 null)
    setMissionLocks(keys, cue = null) { missionLocks = new Set(keys); missionCue = cue; refreshDisabled(); },
    // 켜고 끄는 버튼을 눌렀을 때 강조를 다시 맞춘다
    refresh: refreshDisabled,
    getMode: () => mode
  };
}
