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
import { pickBody } from './scene/picking.js';
import { createLabels } from './ui/labels.js';
import { createHud } from './ui/hud.js';
import { createMemberProgress } from './model/memberProgress.js';
import { bodyById } from './model/world.js';
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
  // ?view=map이 기본이다. 다른 장면(planet·size·sky)은 Phase 3·6·7에서 붙인다.
  startSolarMap();
}

function startSolarMap() {
  const fx = params.get('fx') !== 'off';
  const state = { t: 0, playing: false, speed: 1, focus: null };

  // ---- 3D ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = 'sv-canvas';
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 4000);
  const map = createSolarMap({ fx });
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
    onPlay(playing) { state.playing = playing; hud.setPlaying(playing); },
    onSpeed(speed) { state.speed = speed; hud.setSpeed(speed); },
    onSunlightBlock(blocked) {
      map.setSunlight(!blocked);
      sunNotice?.remove();
      sunNotice = blocked ? el('div', { class: 'sv-discovery sv-discovery--enter sv-discovery--sticky', role: 'status' }, [icon('i-sun-off'), '태양 빛을 가렸어요']) : null;
      if (sunNotice) app.append(sunNotice);
    },
    onNames(on) { labels.setVisible(on); },
    // 도감은 Phase 5에서 만든다.
    onJournal() { cards.show(`journal-${notices++}`, '도감은 준비 중이에요'); }
  });
  progress.subscribe((s) => hud.setMembers(s));

  function goTo(id) {
    if (rig.isFlying() || id === state.focus) return;
    const body = bodyById(id);
    progress.find(body.kind);
    // 소행성 띠는 날아가기 시작할 때 카메라에서 가장 가까운 띠 위의 점으로 간다.
    const fixed = id === 'asteroids' ? map.worldPosition(id, camera.position) : null;
    const started = rig.flyTo({
      getTarget: () => fixed ?? map.worldPosition(id),
      radius: map.radiusOf(id),
      distance: { asteroids: 14, comet: 9 }[id],
      onArrive() {
        state.focus = id;
        hud.setDestination(body.name);
        hud.setFocused(true);
        hud.setLocked(false);
      }
    });
    if (!started) return;
    hud.setFlying(body.name);
    hud.setLocked(true);
  }

  function goHome() {
    if (rig.isFlying() || state.focus === null) return;
    if (!rig.flyHome(() => { hud.setDestination('태양계 지도'); hud.setLocked(false); })) return;
    state.focus = null;
    hud.setFocused(false);
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
    const id = pickBody(camera, rect, e.clientX - rect.left, e.clientY - rect.top, map);
    if (id) goTo(id);
  });

  function resize() {
    const { clientWidth: w, clientHeight: h } = app;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
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

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state.playing) state.t += dt * state.speed;
    map.update(state.t);
    rig.update(dt);
    renderer.render(map.scene, camera);
    labels.update(camera, { width: app.clientWidth, height: app.clientHeight });
    fps?.tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
