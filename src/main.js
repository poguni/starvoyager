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
import { createSizeLab } from './scene/sizeLab.js';
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
import { loadJournal, saveJournal } from './model/journalStore.js';
import { createFpsMeter } from './debug/fpsMeter.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
installIconSprite();

// 크롬북 크기(1440px 이하)에서는 components.css의 .sv-stage--cb 배치를 쓴다.
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
  startSolarMap();
}

function startSolarMap() {
  const fx = params.get('fx') !== 'off';
  const high = params.get('quality') === 'low' ? '2k' : '4k';
  // orbitPaused: 행성 탐사 중에는 공전을 멈추고 자전(spin)만 계속한다(docs/결정기록.md).
  // landingLocked: 미션이 착륙 버튼을 잠글 때(Phase 9A). landing: 착륙 연출 중인 정보
  // target: 날아가는 중이면 도착할 천체. presenting: 발표 화면을 보는 중. size: 크기 비교 실험실에 있을 때의 상태
  const state = { t: 0, spin: 0, seconds: 0, playing: false, speed: 1, focus: null, target: null, orbitPaused: false, landingLocked: false, landing: null, presenting: false, size: null, sky: null, names: true };

  // ---- 3D ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = 'sv-canvas';
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 4000);
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = createTextureManager({
    high,
    load: (level, file, color) => loader.loadAsync(`${import.meta.env.BASE_URL}textures/${level}/${file}`).then((tex) => {
      if (color) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      return tex;
    }),
    prepare: (tex) => renderer.initTexture(tex) // 바꾸기 전에 GPU에 올려 두어 멈칫하지 않게
  });
  const map = createSolarMap({ fx, textures });
  const rig = createCameraRig(camera, renderer.domElement);

  // ---- 화면 요소 ----
  const labelLayer = el('div', { class: 'sv-labels' });
  const fade = el('div', { class: 'sv-fade', 'aria-hidden': 'true' }); // 착륙 장면으로 바뀔 때 잠깐 어두워지는 막
  app.append(renderer.domElement, labelLayer, fade);
  const labels = createLabels({ container: labelLayer, map, onPick: goTo });
  // 도감 진행 상태(기획서 10-5): 카드·태양 카드·찾은 구성원·착륙 시도를 브라우저에 저장해 두고 이어서 한다.
  const saved = loadJournal();
  const progress = createMemberProgress(Array.isArray(saved.members) ? saved.members : []);
  const landingLog = createLandingLog(Array.isArray(saved.landed) ? saved.landed.filter((id) => PLANET_IDS.includes(id)) : []);
  const journal = createJournal({
    initial: saved,
    hasLanded: landingLog.hasTried,
    // 카드 한 장을 완성할 때마다 '도감' 탭 한 행(시트 전송 연결은 Phase 9B)
    onComplete: (row) => dispatchEvent(new CustomEvent('starvoyager:journal-row', { detail: row }))
  });
  const persist = () => saveJournal({ ...journal.serialize(), members: progress.getState().found, landed: landingLog.list() });
  const landingView = createLandingScene();
  let sunNotice = null;

  const hud = createHud(app, {
    onMap: () => (state.size ? exitSizeLab() : goHome()),
    onPrev: () => goTo(planetNeighbors(state.focus).prev),
    onNext: () => goTo(planetNeighbors(state.focus).next),
    onPlay(playing) { state.playing = playing; hud.setPlaying(playing); },
    onSpeed(speed) { state.speed = speed; hud.setSpeed(speed); },
    onSunlightBlock: setSunlightBlocked,
    onLoupe(on) { map.setLoupe(on); },
    onLand: startLanding,
    onAscend: liftOff,
    onNames(on) { state.names = on; labels.setVisible(on); sizeLabels?.setVisible(on); starLinker?.setNamesVisible(on); },
    onTime: (hour) => setSkyTime(hour),
    onHint: () => starLinker.showHint(),
    onUndo: () => { starLinker.undo(); hud.setUndoable(starLink.canUndo()); },
    onCityLights(on) { northSky.setLights(on); hud.setCityLights(on); },
    onRealSize: (on) => setRealSize(on),
    onSunCompare: (on) => setSunCompare(on),
    onJournal() {
      if (journalPanel.isOpen()) { journalPanel.setOpen(false); return; }
      // 행성 탐사 화면에서는 그 천체의 카드, 그 밖에는 목차
      if (hud.getMode() === 'planet') showCardOf(state.focus);
      else journalPanel.showToc();
      journalPanel.setOpen(true);
    }
  });
  hud.setMode('map');
  progress.subscribe((s) => hud.setMembers(s));

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
  journal.subscribe(() => { hud.setJournalCount(journal.count(), journal.total); persist(); });
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
    const bar = cbQuery.matches && hud.getMode() === 'planet';
    journalPanel.setBarAllowed(bar);
    hud.setJournalOpen(journalPanel.isOpen(), bar && !journalPanel.isOpen());
    setFrameTarget();
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
      z = state.target === 'saturn' ? 0.55 : 0.82;
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
  function planetFrameOffset() {
    const css = getComputedStyle(document.documentElement);
    const margin = parseFloat(css.getPropertyValue('--sv-hud-margin'));
    const panel = parseFloat(css.getPropertyValue('--sv-panel-w'));
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
      }
    });
    if (!started) return;
    progress.find(body.kind);
    textures.want(texturesFor(id));
    if (explore && hud.getMode() !== 'planet') setSunlightBlocked(false); // 행성 탐사에는 태양 빛 가리기가 없다
    // 도감: 태양계 지도에서 행성 탐사 화면에 들어가면 그 카드로 펼치고, 이전/다음 행성으로 옮길 때는 펼침 상태를 둔다.
    state.target = id;
    if (explore) {
      showCardOf(id);
      if (hud.getMode() !== 'planet') journalPanel.setOpen(true);
    } else {
      journalPanel.setOpen(false);
      journalPanel.showToc();
    }
    state.orbitPaused = explore;
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
    state.focus = null;
    state.target = null;
    state.orbitPaused = false;
    journalPanel.setOpen(false);
    journalPanel.showToc();
    setFrameTarget();
    textures.want([]);
    hud.setFlying('태양계 지도');
    hud.setLocked(true);
  }

  // ---- 크기 비교 실험실(S07, 기획서 5-3 ④) ----
  const cards = createDiscoveryCards(app);
  const sizeTextures = new Map(); // 실험실은 행성 8개를 한꺼번에 보므로 2K 질감을 쓴다
  function loadSizeTexture(file, { color = true } = {}) {
    if (!sizeTextures.has(file)) {
      sizeTextures.set(file, loader.loadAsync(`${import.meta.env.BASE_URL}textures/2k/${file}`).then((tex) => {
        if (color) tex.colorSpace = THREE.SRGBColorSpace;
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
    sizeLabels ??= createSizeLabels(app);
    state.size = { real: false, sun: false, board: null };
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
    sizeLab.resize(w, h, { left: margin, right: w - margin, top, bottom });
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
      // 이은 별자리 수(0/3). 미션의 탐색 조건(Phase 9A)도 이 구독을 쓴다.
      starLink.subscribe((s) => { hud.setSkyCount(s); hud.setUndoable(starLink.canUndo()); });
    }
    state.sky = { hour };
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
    northSky.resize(app.clientWidth, app.clientHeight);
    setSkyTime(hour);
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
    journalPanel.setHidden(true); // 착륙 중에는 도감을 감췄다가 올라오면 다시 보인다
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

  // 누르기와 끌기(회전)를 구분한다: 거의 움직이지 않고 손을 떼면 누르기.
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, at: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || rig.isFlying() || state.landing || state.presenting || state.size || state.sky) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.at < 600;
    down = null;
    if (moved > 8 || !quick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    // 화면 구도 이동(view offset)은 카메라 투영에 들어 있어 화면 좌표를 그대로 쓴다.
    const id = pickBody(camera, rect, e.clientX - rect.left, e.clientY - rect.top, map);
    if (id) goTo(id);
  });

  function resize() {
    const { clientWidth: w, clientHeight: h } = app;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    landingView.camera.aspect = w / h;
    landingView.camera.updateProjectionMatrix();
    setFrameTarget({ instant: true });
    camera.updateProjectionMatrix();
    if (state.size) layoutSizeLab();
    if (state.sky) northSky.resize(w, h);
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
    last = now;
    if (state.playing && !state.orbitPaused) state.t += dt * state.speed;
    state.spin += dt * (state.playing ? state.speed : 0.3);
    state.seconds += dt;
    map.update(state.t, state.spin, state.seconds);
    const landingFrame = state.landing ? stepLanding(dt) : null;
    if (state.size) sizeLab.update(dt, state.seconds);
    if (!state.landing) rig.update(dt);
    countCardTime(dt);
    // 화면 구도 이동은 비행과 비슷한 빠르기로 부드럽게 따라간다.
    const ease = Math.min(1, dt * 2.4);
    frame.x += (frame.tx - frame.x) * ease;
    frame.y += (frame.ty - frame.y) * ease;
    frame.zoom += (frame.tz - frame.zoom) * ease;
    const { clientWidth: w, clientHeight: h } = app;
    camera.zoom = frame.zoom;
    camera.setViewOffset(w, h, frame.x, frame.y, w, h);
    if (state.sky) {
      northSky.update(dt, state.seconds);
      starLinker.update();
    } else if (landingFrame) renderer.render(landingFrame.getScene(), landingFrame.camera);
    else if (state.size) {
      renderer.render(sizeLab.scene, sizeLab.camera);
      sizeLabels.update(sizeLab.items(), sizeLab.sunInfo(), { real: sizeLab.isReal() });
    } else renderer.render(map.scene, camera);
    if (!state.size && !state.sky) labels.update(camera, { width: w, height: h });
    fps?.tick(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
