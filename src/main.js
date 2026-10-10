import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import * as THREE from 'three';
import { installIconSprite } from './ui/components/icon.js';
import { el } from './ui/components/dom.js';
import { icon } from './ui/components/icon.js';
import { createSolarMap } from './scene/solarMap.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createTextureManager } from './scene/textureManager.js';
import { createLandingScene } from './scene/landing.js';
import { pickBody } from './scene/picking.js';
import { createLabels } from './ui/labels.js';
import { createHud } from './ui/hud.js';
import { createJournalPanel } from './ui/journalPanel.js';
import { createPresentView } from './ui/presentView.js';
import { createSizeLabels } from './ui/sizeLabels.js';
import { createArrangeBoard } from './ui/arrangeBoard.js';
import { createDiscoveryCards } from './ui/components/discovery.js';
import { createBodyInfo } from './ui/bodyInfo.js';
import { createSizeLab } from './scene/sizeLab.js';
import { createBloom } from './scene/bloom.js';
import { createNorthSky } from './scene/northSky.js';
import { createStarLinker } from './ui/starLinker.js';
import { createStarLink } from './model/starLink.js';
import { clampTime, TIME_DEFAULT } from './model/skyTime.js';
import { CONSTELLATIONS } from './data/constellations.js';
import { ART } from './data/constellationArt.js';
import { SKY_DATE } from './data/skyDate.js';
import starData from './data/stars.json';
import { createMemberProgress } from './model/memberProgress.js';
import { bodyById, isExplorable, planetNeighbors, SURFACE, canLand } from './model/world.js';
import { createLandingLog } from './model/landingLog.js';
import { landingPlan, stepAt } from './model/landingPlan.js';
import { createJournal, PLANET_IDS } from './model/journal.js';
import { loadJournal, saveJournal, clearJournal } from './model/journalStore.js';
import { createFpsMeter } from './debug/fpsMeter.js';
import { createMissionEngine } from './missions/engine.js';
import { MISSIONS, missionById } from './missions/missions.js';
import { createMissionPanel } from './ui/missionPanel.js';
import { createMissionProgress, clearMissionProgress } from './model/missionProgress.js';
import { loadStudentInfo, saveStudentInfo, clearStudentInfo } from './student/studentInfo.js';
import { trySubmit, flushQueue, queueSize, onQueueChange } from './submit/submitQueue.js';
import { createStudentGate } from './ui/studentGate.js';
import { createMissionSelect } from './ui/missionSelect.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
// 시연 모드(기획서 11장): 학생 정보 입력·시트 제출 생략, 큰 글씨, 이름 라벨 기본 숨김, 기기에 저장하지 않음
const demo = params.get('mode') === 'demo';
app.classList.toggle('sv-demo', demo);
installIconSprite();

// 크롬북 크기(1440px 이하)에서는 components.css의 .sv-stage--cb 배치를 쓴다.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cbQuery = matchMedia('(max-width: 1440px)');
const stageSizeListeners = [];
const syncStageSize = () => {
  app.classList.toggle('sv-stage--cb', cbQuery.matches);
  stageSizeListeners.forEach((fn) => fn(cbQuery.matches));
};
syncStageSize();
cbQuery.addEventListener('change', syncStageSize);

if (params.get('debug') === 'ui') {
  // 개발 확인용 부품 견본(?debug=ui). 필요할 때만 불러온다.
  import('./debug/uiGallery.js').then(({ renderUiGallery }) => renderUiGallery(app));
} else {
  // ?view=map이 기본이다. ?view=planet은 행성 탐사 화면, ?view=size는 크기 비교 실험실,
  // ?view=sky(&time=21)는 북쪽 밤하늘에서 시작한다.
  // ?debug=arrange(&activity=classify): 크기 비교 실험실에서 끌어다 놓기 활동을 연다(미션 연결 전 확인용).
  // ?mission=1~4: 탐사 선택 화면을 건너뛰고 그 탐사로 바로 간다(학생 정보가 없으면 등록 먼저). ?debug=missions: 결과 행 패널
  // ?mode=demo: 시연 모드
  startSolarMap();
}

function startSolarMap() {
  // ?fx=off: 후처리(블룸·빛무리·대기광) 끄기. ?quality=low: 저사양(화면 배율 1.5까지, 블룸 끄기, 질감 2K까지)
  const fx = params.get('fx') !== 'off';
  const low = params.get('quality') === 'low';
  const high = low ? '2k' : '4k';
  // orbitPaused: 행성 탐사 중에는 공전을 멈추고 자전(spin)만 계속한다(docs/결정기록.md).
  // landingLocked: 미션이 착륙 버튼을 잠글 때(Phase 9A). landing: 착륙 연출 중인 정보
  // target: 날아가는 중이면 도착할 천체. presenting: 발표 화면을 보는 중. size: 크기 비교 실험실에 있을 때의 상태
  // pickLocked: 미션 예측 단계에서 태양계 지도의 천체 누르기를 잠글 때. pendingGo: 비행이 끝나면 날아갈 천체(미션 시작 상태)
  const state = { t: 0, spin: 0, seconds: 0, playing: false, speed: 1, focus: null, target: null, orbitPaused: false, landingLocked: false, landing: null, presenting: false, size: null, sky: null, names: !demo, pickLocked: false, pendingGo: null };

  // ---- 3D ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
  renderer.domElement.className = 'sv-canvas';
  // three.js가 넣는 인라인 display:block을 지워 hidden 속성(.sv-canvas[hidden])이 듣게 한다. 밤하늘에서 3D를 숨길 때 필요.
  renderer.domElement.style.display = '';
  // 우주 배경은 토큰의 가장 짙은 남색(시안 S03~S09의 배경 톤, 실제 우주처럼 아주 어둡게).
  // 블룸을 거칠 때도 같은 색이 되도록 지우기 색이 아닌 장면 배경으로 준다.
  const spaceColor = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--sv-space-900').trim());
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 4000);
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = createTextureManager({
    high,
    load: (level, file, color) => loader.loadAsync(`${import.meta.env.BASE_URL}textures/${level}/${file}`).then((tex) => {
      if (color) tex.colorSpace = THREE.SRGBColorSpace;
      if (file === 'sun.jpg') tex.wrapS = THREE.RepeatWrapping; // 태양 셰이더가 질감을 옆으로 흘려 보낸다(materials.js)
      tex.anisotropy = maxAniso;
      return tex;
    }),
    prepare: (tex) => renderer.initTexture(tex) // 바꾸기 전에 GPU에 올려 두어 멈칫하지 않게
  });
  const bloom = fx && !low ? createBloom(renderer) : null;
  renderer.info.autoReset = false; // 블룸 단계까지 한 프레임의 그리기 수를 모두 센다(?debug=fps)
  const draw = (scene, cam) => (bloom ? bloom.render(scene, cam) : renderer.render(scene, cam));
  const map = createSolarMap({ fx, textures, stars: starData, pixelRatio: renderer.getPixelRatio() });
  map.scene.background = spaceColor;
  const rig = createCameraRig(camera, renderer.domElement);

  // ---- 화면 요소 ----
  const labelLayer = el('div', { class: 'sv-labels' });
  const fade = el('div', { class: 'sv-fade', 'aria-hidden': 'true' }); // 착륙 장면으로 바뀔 때 잠깐 어두워지는 막
  app.append(renderer.domElement, labelLayer, fade);
  const labels = createLabels({ container: labelLayer, map, onPick: (id) => { if (!state.pickLocked) goTo(id); } });
  labels.setVisible(state.names);
  // 도감 진행 상태(기획서 10-5): 카드·태양 카드·찾은 구성원·착륙 시도를 브라우저에 저장해 두고 이어서 한다.
  const saved = demo ? {} : loadJournal(); // 시연 모드는 매번 새로 시작한다
  const progress = createMemberProgress(Array.isArray(saved.members) ? saved.members : []);
  const landingLog = createLandingLog(Array.isArray(saved.landed) ? saved.landed.filter((id) => PLANET_IDS.includes(id)) : []);
  const journal = createJournal({
    initial: saved,
    hasLanded: landingLog.hasTried,
    // 카드 한 장을 완성할 때마다 '도감' 탭 한 행
    onComplete: (row) => submitRow(row)
  });
  // '다른 친구가 사용해요'로 지운 뒤에는 다시 저장하지 않는다(pagehide 등)
  let saving = !demo;
  const persist = () => { if (saving) saveJournal({ ...journal.serialize(), members: progress.getState().found, landed: landingLog.list() }); };

  // ---- 학생 정보와 시트 제출(기획서 10장). 학생 이름은 시트로 보내는 요청 본문 말고는 어디에도 남기지 않는다. ----
  let student = demo ? null : loadStudentInfo();
  function submitRow(row) {
    if (demo || !student) return;
    trySubmit(student, row);
  }
  const missionProgress = createMissionProgress(MISSIONS.map((m) => m.id), { persist: !demo });
  const landingView = createLandingScene();
  let sunNotice = null;

  const hud = createHud(app, {
    onMap: () => (state.size ? withFade(exitSizeLab) : goHome()),
    onPrev: () => goTo(planetNeighbors(state.focus).prev),
    onNext: () => goTo(planetNeighbors(state.focus).next),
    onPlay(playing) { state.playing = playing; hud.setPlaying(playing); },
    onSpeed(speed) { state.speed = speed; hud.setSpeed(speed); },
    onSunlightBlock: setSunlightBlocked,
    onLoupe(on) { map.setLoupe(on); syncRingCue(); },
    onLand: startLanding,
    onAscend: liftOff,
    onNames: setNames,
    onTime: (hour) => setSkyTime(hour),
    onHint: () => starLinker.showHint(),
    onUndo: () => { starLinker.undo(); hud.setUndoable(starLink.canUndo()); },
    onCityLights: setCityLights,
    onRealSize: (on) => setRealSize(on),
    onMissionSelect: () => leaveMission(),
    onSunCompare: (on) => setSunCompare(on),
    onJournal() {
      if (journalPanel.isOpen()) { journalPanel.setOpen(false); return; }
      if (missionPanel.isShown()) return; // 미션 패널이 도감 자리에 있을 때는 열지 않는다
      // 행성 탐사 화면에서는 그 천체의 카드, 그 밖에는 목차
      if (hud.getMode() === 'planet') showCardOf(state.focus);
      else journalPanel.showToc();
      journalPanel.setOpen(true);
    }
  });
  hud.setMode('map');
  hud.setNames(state.names);
  progress.subscribe((s) => hud.setMembers(s));

  function setNames(on) {
    state.names = on;
    hud.setNames(on);
    labels.setVisible(on);
    sizeLabels?.setVisible(on && Boolean(state.size)); // 크기 비교 실험실 이름표는 실험실 안에서만
    starLinker?.setNamesVisible(on);
  }

  function setCityLights(on) {
    northSky.setLights(on);
    hud.setCityLights(on);
  }

  const journalPanel = createJournalPanel(app, {
    journal,
    members: progress,
    // 목차에서 행성 카드를 누르면 그 행성으로 날아가며 카드가 펼쳐진다.
    onOpenPlanet(id) {
      if (rig.isFlying() || state.landing) return;
      journalPanel.showPlanet(id);
      goTo(id);
    },
    canPresent: (id) => id === state.focus && !rig.isFlying(),
    onPresent: startPresent,
    onOpenChange: syncJournalLayout
  });
  const present = createPresentView(app, { journal, onClose: endPresent });

  // ---- 미션(기획서 9장, S06·S06b) ----
  let mission = null; // missions.js의 탐사
  let engine = null;
  const missionPanel = createMissionPanel(app, {
    onPredict: (i) => engine.submitPredict(i),
    onFinal: (i) => engine.submitFinal(i),
    onSummary: (i) => engine.submitSummary(i),
    onNext: () => engine.next(),
    onDay(day) { engine.pressDay(day.id); goTo(day.body); },
    onExit: leaveMission,
    donePlanets: () => journal.doneIds(),
    // 창작(정답 없음): 행성 랩은 그 카드에, 새 별자리 이름은 그 별자리 위에(밤하늘을 떠날 때까지)
    onCreative(result) {
      if (result.detail?.planet) journal.setRap(result.detail.planet, result.detail.lines);
      if (result.detail?.constellation) starLinker?.setCaption(result.detail.constellation, result.detail.lines);
      engine.submitCreative(result);
    },
    onSurvey: (picks) => engine.submitSurvey(picks)
  });
  journal.subscribe(() => { hud.setJournalCount(journal.count(), journal.total); syncRingCue(); persist(); });
  hud.setJournalCount(journal.count(), journal.total);
  progress.subscribe(persist);
  landingLog.subscribe(persist);
  stageSizeListeners.push((cb) => { journalPanel.setCompact(cb); syncJournalLayout(); });
  journalPanel.setCompact(cbQuery.matches);

  function showCardOf(id) {
    if (id === 'sun') journalPanel.showSun();
    else if (isExplorable(id)) journalPanel.showPlanet(id);
  }

  // 도감 펼침에 따라 손잡이·막대와 3D 구도를 맞춘다.
  function syncJournalLayout() {
    const missionOn = missionPanel.isShown();
    const bar = cbQuery.matches && hud.getMode() === 'planet' && !missionOn;
    journalPanel.setBarAllowed(bar);
    hud.setJournalOpen(journalPanel.isOpen(), (bar && !journalPanel.isOpen()) || missionOn);
    setFrameTarget();
    syncRingCue();
  }

  // 펼친 카드에 '고리' 칸 힌트가 보이면 '고리 찾기' 버튼을 안내한다.
  function syncRingCue() {
    const id = journalPanel.activeCardId();
    const card = id && id === state.focus && hud.getMode() === 'planet' ? journal.getCard(id) : null;
    hud.setRingCue(card?.status === 'retry' && 'ring' in card.wrongPicks);
  }

  // ---- 발표 화면(S09) ----
  function startPresent(id) {
    if (id !== state.focus || rig.isFlying() || state.landing) return;
    state.presenting = true;
    app.classList.add('sv-presenting');
    journalPanel.setHidden(true);
    labelLayer.hidden = true;
    present.show(id);
    setFrameTarget();
  }

  function endPresent() {
    state.presenting = false;
    app.classList.remove('sv-presenting');
    present.hide();
    journalPanel.setHidden(false);
    labelLayer.hidden = false;
    setFrameTarget();
  }

  function setSunlightBlocked(blocked) {
    map.setSunlight(!blocked);
    hud.setSunlightBlocked(blocked);
    sunNotice?.remove();
    sunNotice = blocked ? el('div', { class: 'sv-discovery sv-discovery--enter sv-discovery--sticky', role: 'status' }, [icon('i-sun-off'), '태양 빛을 가렸어요']) : null;
    if (sunNotice) app.append(sunNotice);
  }

  // 화면 구도(카메라 view offset·zoom). 행성 탐사 화면에서 도감이 펼쳐져 있으면
  //   전자칠판: S04처럼 행성을 화면 왼쪽~가운데(오른쪽 도감 자리를 비운 곳)에 둔다.
  //   크롬북: S10처럼 아래 패널 위쪽 빈 곳에 조금 작게 둔다.
  // 도감을 접으면 가운데, 발표 화면(S09)에서는 왼쪽 절반 가운데에 둔다.
  const frame = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1 };
  function setFrameTarget({ instant = false } = {}) {
    const w = app.clientWidth;
    const h = app.clientHeight;
    const planet = isExplorable(state.target);
    let [x, y, z] = [0, 0, 1];
    if (planet && state.presenting) {
      // S09처럼 행성이 화면 높이의 절반쯤 되게(토성은 고리까지 보이게 더 작게)
      x = w / 4;
      z = state.target === 'saturn' ? 0.42 : 0.82;
    }
    else if (missionPanel.isShown()) {
      // 미션 패널(오른쪽, 크롬북도 오른쪽): 행성은 남은 자리 가운데에, 태양계 지도는 조금 작게
      x = planetFrameOffset(missionPanel.element.offsetWidth);
      if (!planet) z = 0.8;
    }
    else if (planet && journalPanel.isShown() && cbQuery.matches) {
      // 위 계기판 아래부터 하단 조작 버튼 위까지의 가운데
      const css = getComputedStyle(document.documentElement);
      const bottom = h * 0.47 + parseFloat(css.getPropertyValue('--sv-button-h')) + 10;
      const top = 80;
      y = h / 2 - (top + h - bottom) / 2;
      z = 0.62;
    } else if (planet && journalPanel.isShown()) x = planetFrameOffset();
    Object.assign(frame, { tx: x, ty: y, tz: z });
    if (instant) Object.assign(frame, { x, y, zoom: z });
  }
  function planetFrameOffset(panelWidth) {
    const css = getComputedStyle(document.documentElement);
    const margin = parseFloat(css.getPropertyValue('--sv-hud-margin'));
    const panel = panelWidth ?? parseFloat(css.getPropertyValue('--sv-panel-w'));
    const gap = parseFloat(css.getPropertyValue('--sv-gap-l'));
    const w = app.clientWidth;
    const center = (margin + (w - margin - panel - gap)) / 2;
    return w / 2 - center;
  }

  // 고해상도 질감이 필요한 천체: 지금 천체와 이전·다음 천체(지구는 달도)
  function texturesFor(id) {
    if (isExplorable(id)) {
      const { prev, next } = planetNeighbors(id);
      return [id, prev, next, id === 'earth' ? 'moon' : null].filter(Boolean);
    }
    return id === 'moon' ? ['moon', 'earth'] : [];
  }

  // 행성 탐사 화면에서는 태양 쪽에서 비스듬히(약 40°) 바라보아 낮 쪽 색과 표면이 잘 보이게 한다.
  function litViewDirection(id) {
    const toSun = map.worldPosition(id).multiplyScalar(-1).setY(0).normalize();
    const side = new THREE.Vector3(-toSun.z, 0, toSun.x);
    return toSun.multiplyScalar(Math.cos(0.7)).add(side.multiplyScalar(Math.sin(0.7))).setY(0.35).normalize();
  }

  function goTo(id, { instant = false } = {}) {
    if (!id || rig.isFlying() || id === state.focus) return;
    const body = bodyById(id);
    const explore = isExplorable(id);
    // 소행성 띠는 날아가기 시작할 때 카메라에서 가장 가까운 띠 위의 점으로 간다.
    const fixed = id === 'asteroids' ? map.worldPosition(id, camera.position) : null;
    const radius = map.radiusOf(id);
    const isSun = id === 'sun';
    const distance = explore ? radius * (isSun ? 3.4 : 5.2) : { asteroids: 14, comet: 9 }[id];
    const started = rig.flyTo({
      getTarget: () => fixed ?? map.worldPosition(id),
      radius, distance, instant, direction: explore && !isSun ? litViewDirection(id) : undefined,
      limits: explore ? [radius * (isSun ? 1.3 : 1.5), radius * (isSun ? 6 : 12)] : undefined,
      onArrive() {
        state.focus = id;
        hud.setDestination(body.name);
        hud.setMode(explore ? 'planet' : 'focus', explore ? planetNeighbors(id) : undefined);
        syncJournalLayout();
        journalPanel.refresh(); // 도착해야 '발표하기'를 누를 수 있다
        if (isSun) journal.markSunExplored();
        document.body.dataset.accent = explore ? body.accent : 'default';
        labels.hide(explore ? id : null);
        hud.setLandable(canLand(id) && !state.landingLocked);
        hud.setLocked(false);
        bodyInfo.show(id);
      }
    });
    if (!started) return;
    bodyInfo.hide();
    progress.find(body.kind);
    textures.want(texturesFor(id));
    if (explore && hud.getMode() !== 'planet') setSunlightBlocked(false); // 행성 탐사에는 태양 빛 가리기가 없다
    // 도감: 태양계 지도에서 행성 탐사 화면에 들어가면 그 카드로 펼치고, 이전/다음 행성으로 옮길 때는 펼침 상태를 둔다.
    state.target = id;
    if (explore) {
      showCardOf(id);
      // 미션 패널이 도감 자리에 있으면 도감은 펼치지 않는다
      if (hud.getMode() !== 'planet' && !missionPanel.isShown()) journalPanel.setOpen(true);
    } else {
      journalPanel.setOpen(false);
      journalPanel.showToc();
    }
    state.orbitPaused = explore;
    map.isolate(explore ? id : null); // 행성 탐사 중에는 그 천체만 남긴다
    setFrameTarget({ instant });
    hud.setFlying(body.name);
    hud.setLocked(true);
  }

  function goHome() {
    if (rig.isFlying() || state.focus === null) return;
    const started = rig.flyHome(() => {
      hud.setDestination('태양계 지도');
      hud.setMode('map');
      document.body.dataset.accent = 'default';
      labels.hide(null);
      hud.setLocked(false);
    });
    if (!started) return;
    bodyInfo.hide();
    state.focus = null;
    state.target = null;
    state.orbitPaused = false;
    map.isolate(null);
    journalPanel.setOpen(false);
    journalPanel.showToc();
    setFrameTarget();
    textures.want([]);
    hud.setFlying('태양계 지도');
    hud.setLocked(true);
  }

  // ---- 크기 비교 실험실(S07, 기획서 5-3 ④) ----
  const cards = createDiscoveryCards(app);
  const bodyInfo = createBodyInfo(app); // 혜성·소행성 소개(docs/결정기록.md)
  const sizeTextures = new Map(); // 실험실은 행성 8개를 한꺼번에 보므로 2K 질감을 쓴다
  function loadSizeTexture(file, { color = true } = {}) {
    if (!sizeTextures.has(file)) {
      sizeTextures.set(file, loader.loadAsync(`${import.meta.env.BASE_URL}textures/2k/${file}`).then((tex) => {
        if (color) tex.colorSpace = THREE.SRGBColorSpace;
        if (file === 'sun.jpg') tex.wrapS = THREE.RepeatWrapping;
        tex.anisotropy = maxAniso;
        return tex;
      }));
    }
    return sizeTextures.get(file);
  }
  let sizeLab = null;
  let sizeLabels = null;

  // board: 'sort' | 'classify'이면 끌어다 놓기 활동을 함께 연다. 줄 세우기는 실제 크기 보기를 켠 채로 시작한다(9-4 문항 3-3).
  function enterSizeLab({ board = null } = {}) {
    sizeLab ??= createSizeLab({ load: loadSizeTexture, fx });
    sizeLab.scene.background = spaceColor;
    sizeLabels ??= createSizeLabels(app);
    state.size = { real: false, sun: false, board: null };
    bodyInfo.hide();
    setSunlightBlocked(false);
    journalPanel.setOpen(false);
    journalPanel.setHidden(true);
    labelLayer.hidden = true;
    hud.setMode('size');
    hud.setDestination('크기 비교 실험실');
    document.body.dataset.accent = 'default';
    sizeLabels.setVisible(state.names);
    if (board) {
      state.size.board = createArrangeBoard(app, {
        kind: board,
        // 처음·최종 배치(미션 연결은 Phase 9A)
        onDone: (record) => dispatchEvent(new CustomEvent('starvoyager:arrange-result', { detail: record }))
      });
    }
    setRealSize(Boolean(board), { instant: true });
    setSunCompare(false, { instant: true });
    layoutSizeLab();
  }

  // 장면이 바뀔 때(크기 비교 실험실·북쪽 밤하늘 ↔ 태양계 지도) 0.2초 어두워졌다가 0.2초 밝아진다.
  // 착륙 때 쓰는 어두운 막을 함께 쓴다.
  let switching = false;
  function withFade(change) {
    if (switching) return;
    switching = true;
    fade.style.transition = `opacity ${FADE_SECONDS / 2}s ease-in-out`;
    fade.style.opacity = 1;
    setTimeout(() => {
      change();
      fade.style.opacity = 0;
      setTimeout(() => { fade.style.transition = ''; switching = false; }, FADE_SECONDS * 500);
    }, FADE_SECONDS * 500);
  }

  function exitSizeLab() {
    state.size.board?.destroy();
    state.size = null;
    sizeLabels.setVisible(false);
    labelLayer.hidden = false;
    journalPanel.setHidden(false);
    hud.setMode('map');
    hud.setDestination('태양계 지도');
    syncJournalLayout();
  }

  function setRealSize(on, opts) {
    state.size.real = on;
    if (!on && state.size.sun) setSunCompare(false); // 태양과 비교는 실제 크기에서만
    sizeLab.setReal(on, opts);
    hud.setRealSize(on);
  }

  function setSunCompare(on, opts) {
    state.size.sun = on;
    if (on) {
      if (!state.size.real) setRealSize(true);
      cards.show('sun-compare', '태양은 지구보다 훨씬, 훨씬 커요!');
      engine?.markFelt(); // 탐사 3 보고 느끼기
    }
    sizeLab.setSunCompare(on, opts);
    hud.setSunCompare(on);
  }

  // 행성 줄은 위 계기판 아래부터 끌어다 놓기 판(없으면 하단 조작 버튼) 위까지
  function layoutSizeLab() {
    const { clientWidth: w, clientHeight: h } = app;
    const css = getComputedStyle(document.documentElement);
    const margin = parseFloat(css.getPropertyValue('--sv-hud-margin'));
    const top = cbQuery.matches ? 92 : 130;
    const below = state.size.board ? state.size.board.element : app.querySelector('.sv-controls');
    const bottom = below.getBoundingClientRect().top - app.getBoundingClientRect().top - (state.size.board ? 18 : 30);
    // 미션 패널이 있으면 행성 줄은 패널 왼쪽까지
    const right = missionPanel.isShown() ? w - margin - missionPanel.element.offsetWidth - parseFloat(css.getPropertyValue('--sv-gap-l')) : w - margin;
    sizeLab.resize(w, h, { left: margin, right, top, bottom });
  }

  // ---- 북쪽 밤하늘(S08, 기획서 5-3 ⑤) ----
  let northSky = null;
  let starLink = null;
  let starLinker = null;

  function enterSky({ hour = TIME_DEFAULT } = {}) {
    const linkStars = new Set(CONSTELLATIONS.flatMap((c) => c.stars));
    northSky ??= createNorthSky(app, { date: SKY_DATE, stars: starData, skip: linkStars });
    if (!starLink) {
      starLink = createStarLink(CONSTELLATIONS);
      starLinker = createStarLinker(app, { sky: northSky, link: starLink, constellations: CONSTELLATIONS, art: ART, after: labelLayer });
      // 이은 별자리 수(0/3). 탐사 4의 탐색 조건(별자리 3개)도 이 구독을 쓴다.
      starLink.subscribe((s) => { hud.setSkyCount(s); hud.setUndoable(starLink.canUndo()); engine?.report('constellations', s.count); });
    }
    state.sky = { hour };
    bodyInfo.hide();
    setSunlightBlocked(false);
    journalPanel.setOpen(false);
    renderer.domElement.hidden = true;
    labelLayer.hidden = true;
    northSky.canvas.hidden = false;
    starLinker.setVisible(true);
    starLinker.setNamesVisible(state.names);
    hud.setMode('sky');
    hud.setDestination('북쪽 밤하늘');
    document.body.dataset.accent = 'sky';
    syncSkyView();
    setSkyTime(hour);
  }

  // 북쪽 밤하늘에서 태양계 지도로(탐사 선택으로 돌아갈 때). 새 별자리 이름 문장은 여기서 사라진다.
  function exitSky() {
    state.sky = null;
    starLinker.setVisible(false);
    starLinker.setCaption(null);
    northSky.canvas.hidden = true;
    renderer.domElement.hidden = false;
    labelLayer.hidden = false;
    hud.setMode('map');
    hud.setDestination('태양계 지도');
    document.body.dataset.accent = 'default';
    syncJournalLayout();
  }

  function setSkyTime(hour) {
    state.sky.hour = clampTime(hour);
    northSky.setTime(state.sky.hour);
    hud.setTime(state.sky.hour);
  }

  // ---- 착륙(기획서 5-3 ③, motion.md '착륙') ----
  // 미션이 착륙 버튼을 잠그거나 풀 때 쓴다(Phase 9A에서 연결).
  function setLandingLocked(on) {
    state.landingLocked = on;
    hud.setLandable(isExplorable(state.focus) && canLand(state.focus) && !on);
  }

  const SOLID_TEXT = '단단한 땅에 착륙했어요!';
  const GAS_TEXT = '내려앉을 땅이 없어요. 표면이 기체로 되어 있어요.';
  const LOOK_TEXT = '화면을 좌우로 끌어 주변을 둘러봐요.';
  const LIFT_SECONDS = 2;
  const FADE_SECONDS = 0.4;

  function startLanding() {
    const id = state.focus;
    if (state.landing || rig.isFlying() || !canLand(id) || state.landingLocked) return;
    landingLog.record(id);
    const surface = SURFACE[id];
    state.landing = {
      id, surface, plan: landingPlan(surface, id), t: 0, phase: 'run', built: false, banner: false,
      fromPos: camera.position.clone(), fromTarget: rig.controls.target.clone()
    };
    rig.controls.enabled = false;
    labelLayer.hidden = true;
    journalPanel.setHidden(true); // 착륙 중에는 도감·미션 패널을 감췄다가 올라오면 다시 보인다
    missionPanel.setHidden(true);
    app.classList.add('sv-hud-shake');
    hud.setLanding('landing');
  }

  // 땅 위에서 '다시 올라가기'
  function liftOff() {
    const L = state.landing;
    if (!L || L.phase !== 'landed') return;
    L.phase = 'lift';
    L.t = 0;
    hud.hideBanner();
    hud.setLanding('landing');
    app.classList.add('sv-hud-shake');
  }

  function endLanding() {
    const L = state.landing;
    camera.position.copy(L.fromPos);
    rig.controls.target.copy(L.fromTarget);
    rig.controls.enabled = true;
    landingView.dispose();
    state.landing = null;
    labelLayer.hidden = false;
    fade.style.opacity = 0;
    app.classList.remove('sv-hud-shake');
    hud.hideBanner();
    hud.setLanding(null);
    journalPanel.setHidden(false);
    missionPanel.setHidden(false);
  }

  // 착륙 연출 한 프레임. 3D를 그릴 장면과 카메라를 돌려준다.
  function stepLanding(dt) {
    const L = state.landing;
    L.t += dt;
    if (L.phase === 'run') {
      const step = stepAt(L.plan, L.t);
      if (step.name === 'approach') {
        // 행성 표면 쪽으로 다가가며 화면이 어두워진다.
        const center = map.worldPosition(L.id);
        const toward = L.fromPos.clone().sub(center).normalize().multiplyScalar(map.radiusOf(L.id) * 1.15).add(center);
        camera.position.lerpVectors(L.fromPos, toward, step.k * step.k);
        camera.lookAt(center);
        fade.style.opacity = Math.max(0, (step.k - 0.6) / 0.4);
        return null;
      }
      if (!L.built) {
        landingView.build(L.id, L.surface, map.surfaceImage(L.id));
        L.built = true;
      }
      const descendStart = L.plan.steps[1].start;
      const lastEnd = L.plan.total;
      // 착륙 장면이 나타날 때는 밝아지고, 기체 행성에서 다 올라오면 다시 어두워진다.
      let dark = Math.max(0, 1 - (L.t - descendStart) / FADE_SECONDS);
      if (L.surface === 'gas') dark = Math.max(dark, (L.t - (lastEnd - FADE_SECONDS)) / FADE_SECONDS);
      fade.style.opacity = Math.min(1, dark);
      const c = L.plan.clouds;
      const cloudK = c && L.surface === 'solid' ? Math.max(0, 1 - Math.abs(L.t - (c.start + c.end) / 2) / ((c.end - c.start) / 2)) : 0;
      if (step.name === 'done') {
        if (L.surface === 'gas') { endLanding(); return null; }
      }
      if ((step.name === 'banner' || step.name === 'hold') && !L.banner) {
        L.banner = true;
        app.classList.remove('sv-hud-shake');
        hud.showBanner(L.surface === 'solid' ? 'i-land' : 'i-ascend', L.surface === 'solid' ? SOLID_TEXT : GAS_TEXT);
      }
      if (step.name === 'done' && L.surface === 'solid') {
        // 배너 2초가 지나면 '다시 올라가기' 버튼이 나타난다.
        L.phase = 'landed';
        hud.hideBanner();
        hud.setLanding('landed');
        cards.show('look-around', LOOK_TEXT, 'i-hint'); // 처음 한 번만
      }
      const phase = step.name === 'banner' || step.name === 'done' ? 'landed' : step.name;
      landingView.update(phase, step.k, { cloudK, time: state.seconds });
      return landingView;
    }
    if (L.phase === 'landed') {
      landingView.update('landed', 1, { time: state.seconds });
      return landingView;
    }
    // lift: 땅에서 다시 올라간 뒤 행성 탐사 화면으로 돌아온다.
    const k = Math.min(1, L.t / LIFT_SECONDS);
    landingView.update('lift', k, { time: state.seconds });
    fade.style.opacity = Math.max(0, (L.t - (LIFT_SECONDS - FADE_SECONDS)) / FADE_SECONDS);
    if (k >= 1) { endLanding(); return null; }
    return landingView;
  }

  // ---- 미션 진행(Phase 9A) ----
  // 단계마다 장면을 문항의 시작 상태로 맞추고, 허용되지 않은 조작을 잠근다(docs/결정기록.md 2026-10-08).
  const GATE_DELAY_MS = 1500; // 탐색 조건을 채운 뒤 도장·완성 연출을 보고 나서 질문 패널이 나타난다
  const VIEW_LOCKS = { map: [], planet: ['map', 'prev', 'next'], size: [], sky: [] };
  let missionKey = null;
  let missionTimer = null;
  let missionDebug = null;

  function startMission(id) {
    if (engine) endMission();
    mission = missionById(id);
    engine = createMissionEngine(mission);
    missionKey = null;
    missionPanel.reset();
    hud.setMission(mission);
    if (params.get('debug') === 'missions') {
      missionDebug ??= el('div', { class: 'sv-debug-missions', 'aria-label': '미션 결과 행(개발 확인용)' });
      app.append(missionDebug);
    }
    // 탐색 조건 공급: 구성원(memberProgress), 도감 카드(journal), 별자리(starLink, 밤하늘에 들어가면)
    const members = progress.getState();
    engine.report('members', members.count, members.found);
    engine.report('cards', journal.count());
    if (mission.view === 'size') enterSizeLab();
    if (mission.view === 'sky') enterSky();
    if (starLink) engine.report('constellations', starLink.getState().count);
    engine.onChange(renderMission);
    // 완성된 결과 행 → '미션' 탭(창작·흥미 체크 포함)
    engine.onRow(submitRow);
    // 진행 중이던 탐사는 저장한 단계부터 이어서 한다(기획서 10-5)
    engine.start(missionProgress.startOf(id));
  }
  progress.subscribe((s) => engine?.report('members', s.count, s.found));
  journal.subscribe(() => engine?.report('cards', journal.count()));

  function endMission() {
    clearTimeout(missionTimer);
    engine = null;
    mission = null;
    destroyMissionBoard();
    missionPanel.setOpen(false);
    missionPanel.setStrip(null);
    hud.setMission(null);
    hud.setItemCount(null);
    hud.setMissionLocks([]);
    setLandingLocked(false);
    state.pickLocked = false;
    afterMissionLayout();
  }

  // '탐사 끝내기'·'탐사 선택': 진행은 이미 저장되어 있다. 탐사 선택 화면으로.
  function leaveMission() {
    if (state.landing) return;
    endMission();
    showSelect();
  }

  function renderMission(s) {
    missionProgress.record(mission.id, { resumeIndex: s.resumeIndex, done: s.done, days: s.days });
    const key = `${s.stepIndex}:${s.stage}`;
    const keepStrip = s.stage === 'gate' && s.step.manual; // 카드를 채울 때마다 안내 띠(와 '질문 풀기' 버튼)를 갱신
    if (key !== missionKey) {
      const afterGate = missionKey?.endsWith(':gate') && s.gateOpened;
      missionKey = key;
      clearTimeout(missionTimer);
      if (afterGate) {
        // 질문이 막 열렸다: 안내 띠를 거두고 잠깐 기다렸다가 패널을 띄운다.
        missionPanel.setStrip(null);
        missionTimer = setTimeout(() => { if (engine) applyStage(engine.getState()); }, GATE_DELAY_MS);
      } else applyStage(s);
    }
    if (keepStrip) setGateStrip(s);
    missionPanel.render(s, mission);
    if (mission.view === 'size') hud.setItemCount(s.itemNumber > 0 ? { count: s.itemNumber, total: s.itemTotal } : null);
    if (missionDebug) renderMissionDebug(s.results);
  }

  // 탐색 단계 안내 띠. 직접 여는 조건(탐사 1·2)은 채웠을 때 문구가 바뀌고 '질문 풀기' 버튼이 붙는다.
  function setGateStrip({ step, gateReady }) {
    if (!step.manual || !gateReady) return missionPanel.setStrip(step.text);
    missionPanel.setStrip(step.readyText, { label: step.goLabel, onClick: () => engine.openGate() });
  }

  // 단계가 바뀔 때 한 번: 패널·안내 띠·잠금·시작 상태
  function applyStage(s) {
    const { stage, step } = s;
    const arrange = step && (step.type === 'sort' || step.type === 'classify');
    const panelOn = stage !== 'gate' && !arrange;
    if (stage === 'gate') setGateStrip(s);
    else missionPanel.setStrip(null);
    if (panelOn) journalPanel.setOpen(false);
    missionPanel.setOpen(panelOn);

    if ((stage === 'predict' || stage === 'arrange' || stage === 'gate') && step.start) applyStart(step.start);
    if (state.size?.board && state.size.boardStep !== s.stepIndex) destroyMissionBoard(); // 다른 문항의 판
    if (stage === 'arrange' && !state.size.board) {
      state.size.boardStep = s.stepIndex;
      state.size.board = createArrangeBoard(app, {
        kind: step.type,
        wrongText: step.hint,
        onDone: (record) => engine.submitArrange(record),
        onNext: () => engine.next()
      });
    }
    if (!arrange) destroyMissionBoard();
    if (stage === 'predict') setNames(false); // 예측 단계에서는 이름 라벨을 숨긴다(9-1 ①)

    // 잠금: 예측 단계는 이름 보기·장면을 바꾸는 버튼·그 문항의 확인 도구. 패널이 도감 자리에 있으면 도감도.
    const view = mission.view === 'map' ? (isExplorable(state.target) ? 'planet' : 'map') : mission.view;
    const locks = [];
    if (panelOn || arrange) locks.push('journal');
    if (mission.view === 'size' && stage !== 'done') locks.push('sizeMap'); // 미션 중에는 실험실을 떠나지 않는다
    const predicting = stage === 'predict';
    if (predicting) locks.push('names', ...VIEW_LOCKS[step.start?.view ?? view], ...(step.lock ?? []));
    let cue = null;
    if (stage === 'confirm') cue = step.cue ?? null;
    if (stage === 'feel') cue = step.cue;
    hud.setMissionLocks(locks, cue);
    setLandingLocked(predicting && (step.lock ?? []).includes('land'));
    state.pickLocked = predicting && step.start?.view === 'map';

    if (stage === 'summaryResult' && mission.id === 1) journal.setSunSummary(s.lastFeedback.answer); // 태양 카드에는 정답 문장
    afterMissionLayout();
  }

  // 문항의 시작 상태로 장면을 맞춘다.
  function applyStart(start) {
    if (start.view === 'map') {
      if (rig.isFlying() || state.landing) state.pendingGo = 'home';
      else if (state.focus) goHome();
      if (start.loupe === false) { map.setLoupe(false); hud.setLoupe(false); syncRingCue(); }
      setSunlightBlocked(false);
    } else if (start.view === 'planet') {
      if (state.target !== start.planet) {
        if (rig.isFlying() || state.landing) state.pendingGo = start.planet;
        else goTo(start.planet);
      }
    } else if (start.view === 'size') {
      setSunCompare(false);
      setRealSize(start.real);
    } else if (start.view === 'sky') {
      setSkyTime(start.hour);
      setCityLights(Boolean(start.lights));
    }
  }

  function destroyMissionBoard() {
    if (!state.size?.board) return;
    state.size.board.destroy();
    state.size.board = null;
  }

  // 패널이 나타나거나 사라질 때 도감 손잡이·3D 구도·실험실 행성 줄·밤하늘을 다시 맞춘다.
  function afterMissionLayout() {
    syncJournalLayout();
    if (state.size) layoutSizeLab();
    if (state.sky) syncSkyView();
  }

  // 미션 패널이 오른쪽을 가리면 밤하늘을 왼쪽으로 옮기고 조금 작게(북두칠성이 패널 아래로 들어가지 않게)
  function syncSkyView() {
    const css = getComputedStyle(document.documentElement);
    const cover = missionPanel.isShown() ? missionPanel.element.offsetWidth + parseFloat(css.getPropertyValue('--sv-gap-l')) : 0;
    const w = app.clientWidth;
    northSky.setView(cover ? { offsetX: -cover / 2, zoom: (w - cover) / w + 0.08 } : {});
    northSky.resize(w, app.clientHeight);
  }

  // ?debug=missions: 결과 행(기획서 10-3 컬럼). 학생 이름은 결과 행에 없다.
  function renderMissionDebug(rows) {
    const head = ['탐사', '문항', '처음예측', '예측정답여부', '최종답', '최종정답여부', '한줄정리', '한줄정리정답여부', '소요시간', '메모'];
    const cell = (v) => (v === null ? '' : v === true ? 'O' : v === false ? 'X' : String(v));
    missionDebug.replaceChildren(el('table', {}, [
      el('tr', {}, head.map((h) => el('th', {}, h))),
      ...rows.map((r) => el('tr', {}, head.map((h) => el('td', {}, cell(r[h])))))
    ]));
  }

  // 누르기와 끌기(회전)를 구분한다: 거의 움직이지 않고 손을 떼면 누르기.
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, at: performance.now(), lx: e.clientX, ly: e.clientY }; });
  // 착륙해 땅에 내려앉은 뒤에는 끌어서 제자리에서 둘러본다(docs/결정기록.md).
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!down || state.landing?.phase !== 'landed') return;
    landingView.lookAround(e.clientX - down.lx, e.clientY - down.ly);
    down.lx = e.clientX;
    down.ly = e.clientY;
  });
  renderer.domElement.addEventListener('pointercancel', () => { down = null; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    const start = down;
    down = null; // 손을 뗀 뒤 마우스를 움직여도 둘러보기가 되지 않게 늘 비운다
    if (!start || rig.isFlying() || state.landing || state.presenting || state.size || state.sky || state.pickLocked) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const quick = performance.now() - start.at < 600;
    if (moved > 8 || !quick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    // 화면 구도 이동(view offset)은 카메라 투영에 들어 있어 화면 좌표를 그대로 쓴다.
    const id = pickBody(camera, rect, e.clientX - rect.left, e.clientY - rect.top, map);
    if (id) goTo(id);
  });

  function resize() {
    const { clientWidth: w, clientHeight: h } = app;
    renderer.setSize(w, h, false);
    bloom?.setSize(w, h);
    camera.aspect = w / h;
    landingView.camera.aspect = w / h;
    landingView.camera.updateProjectionMatrix();
    setFrameTarget({ instant: true });
    camera.updateProjectionMatrix();
    if (state.size) layoutSizeLab();
    if (state.sky) syncSkyView();
  }
  addEventListener('resize', resize);
  resize();

  let fps = null;
  if (params.get('debug') === 'fps') {
    const box = el('div', { class: 'sv-debug-fps' });
    app.append(box);
    fps = createFpsMeter({ container: box, renderer });
  }

  // ?view=planet&planet=mars: 그 천체의 행성 탐사 화면에서 바로 시작한다.
  map.update(state.t, state.spin, state.seconds); // 첫 프레임 전에 천체 위치를 정해 둔다
  if (params.get('view') === 'planet') {
    const start = params.get('planet') ?? 'earth';
    goTo(isExplorable(start) ? start : 'earth', { instant: true });
  } else if (params.get('debug') === 'arrange') {
    enterSizeLab({ board: params.get('activity') === 'classify' ? 'classify' : 'sort' });
  } else if (params.get('view') === 'size') {
    enterSizeLab();
  } else if (params.get('view') === 'sky') {
    const time = Number(params.get('time'));
    enterSky({ hour: Number.isFinite(time) && params.has('time') ? time : TIME_DEFAULT });
  }

  // ---- 등록(S01) → 탐사 선택(S02) → 탐사(기획서 7장, 10-1) ----
  const screen = el('div', { class: 'sv-screen', hidden: true }, ['tl', 'tr', 'bl', 'br'].map((c) => el('div', { class: `sv-corner sv-corner--${c}` })));
  app.append(screen);
  const gate = createStudentGate(screen, {
    onSubmit(info) {
      student = info;
      saveStudentInfo(info);
      gate.hide();
      afterRegister();
    }
  });
  let sceneEntry = false; // 뒤로 가기용 방문 기록 한 칸을 넣어 두었는지(아래 pushSceneEntry)
  const select = createMissionSelect(screen, {
    missions: MISSIONS,
    onPick(id) {
      select.hide();
      screen.hidden = true;
      pushSceneEntry();
      startMission(id);
    },
    onSwitch() {
      // 학생 정보·도감·탐사 진행을 지우고 처음부터. 제출 대기열은 남겨 앞 친구 결과를 마저 보낸다.
      saving = false;
      clearStudentInfo();
      clearJournal();
      clearMissionProgress();
      location.reload();
    },
    onRetry: () => flushQueue()
  });
  onQueueChange((n) => select.setQueue(demo ? 0 : n));
  select.setQueue(demo ? 0 : queueSize());

  // 탐사 선택 화면: 뒤의 장면은 태양계 지도로 돌려 두고 그리지 않는다.
  function showSelect() {
    // 화면 버튼으로 나왔으면 넣어 둔 방문 기록 한 칸도 되돌려, 다음 뒤로 가기가 앱 밖으로 나가게 한다.
    if (sceneEntry) { sceneEntry = false; history.back(); }
    bodyInfo.hide();
    if (state.presenting) endPresent();
    if (state.sky) exitSky();
    if (state.size) exitSizeLab();
    if (state.focus) goHome();
    document.body.dataset.accent = 'default';
    const statuses = Object.fromEntries(MISSIONS.map((m) => [m.id, missionProgress.get(m.id).status]));
    select.show({ student, statuses, journal: { count: journal.count(), total: journal.total }, demo });
    screen.hidden = false;
    if (!demo) flushQueue();
  }

  // ?mission·?view 등 시작 장면이 있으면 탐사 선택을 건너뛴다(docs/결정기록.md 2026-10-08).
  const urlMission = missionById(Number(params.get('mission')));
  const urlScene = urlMission || params.has('view') || params.get('debug') === 'arrange';
  function afterRegister() {
    if (urlMission) { screen.hidden = true; pushSceneEntry(); startMission(urlMission.id); }
    else if (urlScene) { screen.hidden = true; pushSceneEntry(); }
    else showSelect();
  }

  // 브라우저 뒤로 가기(docs/결정기록.md): 장면에 들어갈 때 방문 기록에 한 칸(주소는 그대로)을 넣어 두고,
  // 뒤로 가면 '탐사 선택' 버튼과 같이 진행을 저장하고 탐사 선택 화면으로 간다. 비행·착륙 연출(내려가기·올라가기) 중에는 그 자리에 머문다.
  function pushSceneEntry() {
    if (sceneEntry) return;
    history.pushState({ sv: 'scene' }, '');
    sceneEntry = true;
  }
  addEventListener('popstate', () => {
    if (!sceneEntry) return;
    if (state.landing?.phase === 'landed') endLanding(); // 땅에 내려앉아 둘러보는 중이면 착륙을 끝내고 나간다
    if (rig.isFlying() || state.landing) { history.pushState({ sv: 'scene' }, ''); return; }
    sceneEntry = false;
    if (mission) leaveMission();
    else showSelect();
  });
  if (!demo && !student) { screen.hidden = false; gate.show(); }
  else afterRegister();

  // 펼쳐 둔 작성 중 카드의 시간을 더하고(착륙·발표 화면 제외) 5초마다 저장한다.
  let unsaved = 0;
  function countCardTime(dt) {
    const id = journalPanel.activeCardId();
    if (!id || state.landing || state.presenting || document.visibilityState !== 'visible') return;
    journal.addTime(id, dt);
    unsaved += dt;
    if (unsaved >= 5) { unsaved = 0; persist(); }
  }
  addEventListener('pagehide', persist);

  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    renderer.info.reset();
    last = now;
    if (state.playing && !state.orbitPaused) state.t += dt * state.speed;
    state.spin += dt * (state.playing ? state.speed : 0.3);
    state.seconds += dt;
    map.update(state.t, state.spin, state.seconds);
    const landingFrame = state.landing ? stepLanding(dt) : null;
    if (state.size) sizeLab.update(dt, state.seconds);
    if (!state.landing) rig.update(dt);
    if (state.pendingGo && !rig.isFlying() && !state.landing) {
      const id = state.pendingGo;
      state.pendingGo = null;
      if (id === 'home') goHome();
      else goTo(id);
    }
    countCardTime(dt);
    // 화면 구도 이동은 비행과 비슷한 빠르기로 부드럽게 따라간다('움직임 줄이기'에서는 바로 맞춘다).
    const ease = reducedMotion.matches ? 1 : Math.min(1, dt * 2.4);
    frame.x += (frame.tx - frame.x) * ease;
    frame.y += (frame.ty - frame.y) * ease;
    frame.zoom += (frame.tz - frame.zoom) * ease;
    const { clientWidth: w, clientHeight: h } = app;
    camera.zoom = frame.zoom;
    camera.setViewOffset(w, h, frame.x, frame.y, w, h);
    if (!screen.hidden) { /* 등록·탐사 선택 화면 뒤의 3D는 그리지 않는다 */ }
    else if (state.sky) {
      northSky.update(dt, state.seconds);
      starLinker.update();
    } else if (landingFrame) renderer.render(landingFrame.getScene(), landingFrame.camera);
    else if (state.size) {
      draw(sizeLab.scene, sizeLab.camera);
      sizeLabels.update(sizeLab.items(), sizeLab.sunInfo(), { real: sizeLab.isReal() });
    } else draw(map.scene, camera);
    if (!state.size && !state.sky && screen.hidden) labels.update(camera, { width: w, height: h });
    fps?.tick(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
