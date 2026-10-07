import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import * as THREE from 'three';
import { installIconSprite } from './ui/components/icon.js';
import { el } from './ui/components/dom.js';
import { icon } from './ui/components/icon.js';
import { createDiscoveryCards } from './ui/components/discovery.js';
import { createSolarMap } from './scene/solarMap.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createTextureManager } from './scene/textureManager.js';
import { pickBody } from './scene/picking.js';
import { createLabels } from './ui/labels.js';
import { createHud } from './ui/hud.js';
import { createMemberProgress } from './model/memberProgress.js';
import { bodyById, isExplorable, planetNeighbors } from './model/world.js';
import { createFpsMeter } from './debug/fpsMeter.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
installIconSprite();

// 크롬북 크기(1440px 이하)에서는 components.css의 .sv-stage--cb 배치를 쓴다.
const cbQuery = matchMedia('(max-width: 1440px)');
const syncStageSize = () => app.classList.toggle('sv-stage--cb', cbQuery.matches);
syncStageSize();
cbQuery.addEventListener('change', syncStageSize);

if (params.get('debug') === 'ui') {
  // 개발 확인용 부품 견본(?debug=ui). 필요할 때만 불러온다.
  import('./debug/uiGallery.js').then(({ renderUiGallery }) => renderUiGallery(app));
} else {
  // ?view=map이 기본이다. ?view=planet은 행성 탐사 화면에서 시작한다. size·sky는 Phase 6·7에서 붙인다.
  startSolarMap();
}

function startSolarMap() {
  const fx = params.get('fx') !== 'off';
  const high = params.get('quality') === 'low' ? '2k' : '4k';
  // orbitPaused: 행성 탐사 중에는 공전을 멈추고 자전(spin)만 계속한다(docs/결정기록.md).
  const state = { t: 0, spin: 0, seconds: 0, playing: false, speed: 1, focus: null, orbitPaused: false };

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
  app.append(renderer.domElement, labelLayer);
  const labels = createLabels({ container: labelLayer, map, onPick: goTo });
  const cards = createDiscoveryCards(app);
  const progress = createMemberProgress();
  let sunNotice = null;
  let notices = 0;

  const hud = createHud(app, {
    onMap: goHome,
    onPrev: () => goTo(planetNeighbors(state.focus).prev),
    onNext: () => goTo(planetNeighbors(state.focus).next),
    onPlay(playing) { state.playing = playing; hud.setPlaying(playing); },
    onSpeed(speed) { state.speed = speed; hud.setSpeed(speed); },
    onSunlightBlock: setSunlightBlocked,
    onLoupe(on) { map.setLoupe(on); },
    onNames(on) { labels.setVisible(on); },
    // 도감은 Phase 5에서 만든다.
    onJournal() { cards.show(`journal-${notices++}`, '도감은 준비 중이에요'); }
  });
  hud.setMode('map');
  progress.subscribe((s) => hud.setMembers(s));

  function setSunlightBlocked(blocked) {
    map.setSunlight(!blocked);
    hud.setSunlightBlocked(blocked);
    sunNotice?.remove();
    sunNotice = blocked ? el('div', { class: 'sv-discovery sv-discovery--enter sv-discovery--sticky', role: 'status' }, [icon('i-sun-off'), '태양 빛을 가렸어요']) : null;
    if (sunNotice) app.append(sunNotice);
  }

  // 행성 탐사 화면에서는 S04처럼 행성을 화면 왼쪽~가운데(오른쪽 도감 자리를 비운 곳)에 둔다.
  // 크롬북 크기(S10)에서는 도감이 아래에서 올라오므로 가운데에 둔다.
  const frame = { x: 0, target: 0 };
  function planetFrameOffset() {
    if (cbQuery.matches) return 0;
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
        document.body.dataset.accent = explore ? body.accent : 'default';
        labels.hide(explore ? id : null);
        hud.setLocked(false);
      }
    });
    if (!started) return;
    progress.find(body.kind);
    textures.want(texturesFor(id));
    if (explore && hud.getMode() !== 'planet') setSunlightBlocked(false); // 행성 탐사에는 태양 빛 가리기가 없다
    state.orbitPaused = explore;
    frame.target = explore ? planetFrameOffset() : 0;
    if (instant) frame.x = frame.target;
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
    state.orbitPaused = false;
    frame.target = 0;
    textures.want([]);
    hud.setFlying('태양계 지도');
    hud.setLocked(true);
  }

  // 누르기와 끌기(회전)를 구분한다: 거의 움직이지 않고 손을 떼면 누르기.
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, at: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || rig.isFlying()) return;
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
    if (state.focus && isExplorable(state.focus)) frame.target = frame.x = planetFrameOffset();
    camera.updateProjectionMatrix();
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
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state.playing && !state.orbitPaused) state.t += dt * state.speed;
    state.spin += dt * (state.playing ? state.speed : 0.3);
    state.seconds += dt;
    map.update(state.t, state.spin, state.seconds);
    rig.update(dt);
    // 화면 구도 이동(행성을 왼쪽~가운데로)은 비행과 비슷한 빠르기로 부드럽게 따라간다.
    frame.x += (frame.target - frame.x) * Math.min(1, dt * 2.4);
    const { clientWidth: w, clientHeight: h } = app;
    camera.setViewOffset(w, h, frame.x, 0, w, h);
    renderer.render(map.scene, camera);
    labels.update(camera, { width: w, height: h });
    fps?.tick(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
