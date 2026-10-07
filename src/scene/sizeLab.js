// 크기 비교 실험실 장면(기획서 5-3 ④, S07). 행성 8개를 한 줄로 놓고 같은 크기 ↔ 실제 크기 비율로 바꿔 본다.
// 정사영 카메라를 써서 화면 속 크기가 크기 비와 정확히 같다(원근 왜곡 없음). 단위는 화면 픽셀.
// '태양과 비교하기'를 켜면 화면 왼쪽에 태양 가장자리가 지구의 109배 크기로 들어온다.
import * as THREE from 'three';
import { PLANETS } from '../model/world.js';
import { sizeLayout } from '../model/sizeLayout.js';
import { createSunMaterial, createEarthMaterial } from './materials.js';
import { createSaturnRing } from './rings.js';

const MORPH_SECONDS = 1; // 같은 크기 ↔ 실제 크기, 태양 들어오기
const LIGHT_DIR = new THREE.Vector3(-0.55, 0.35, 1).normalize(); // 앞쪽 왼편에서 고르게 비춘다
const COLORS = { light: 0xfff4e6, ambient: 0x8090b0, star: 0xffffff };

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function starField(count = 900) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set([Math.random() * 2 - 1, Math.random() * 2 - 1, -0.999], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // 화면 전체에 흩어진 별(카메라 좌표계에 고정)
  const mat = new THREE.PointsMaterial({ color: COLORS.star, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function glowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.36, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,200,110,0.55)');
  g.addColorStop(0.4, 'rgba(255,150,50,0.18)');
  g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// load(file, { color }) → Promise<Texture>
export function createSizeLab({ load, fx = true }) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  camera.position.set(0, 0, 2000);
  const stars = starField();
  const starHolder = new THREE.Group();
  starHolder.add(stars);
  const light = new THREE.DirectionalLight(COLORS.light, 2.6);
  light.position.copy(LIGHT_DIR).multiplyScalar(1000);
  scene.add(light, new THREE.AmbientLight(COLORS.ambient, 0.35), starHolder);

  // ---- 행성: 반지름 1로 만들고 크기는 scale로 바꾼다 ----
  const planets = {};
  for (const p of PLANETS) {
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    let material;
    if (p.id === 'earth') {
      material = createEarthMaterial(null, null);
      material.uniforms.sunPosition.value.copy(LIGHT_DIR).multiplyScalar(1e5);
      load('earth.jpg').then((t) => { material.uniforms.dayMap.value = t; });
      load('earth_night.jpg').then((t) => { material.uniforms.nightMap.value = t; });
    } else {
      material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
      load(`${p.id}.jpg`).then((t) => {
        material.map = t;
        if (p.id === 'mercury') { material.bumpMap = t; material.bumpScale = 2.2; }
        material.needsUpdate = true;
      });
    }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), material);
    tilt.add(mesh);
    if (p.id === 'earth') {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(1.012, 96, 48),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, roughness: 1 })
      );
      load('earth_clouds.jpg', { color: false }).then((t) => { clouds.material.alphaMap = t; clouds.material.needsUpdate = true; });
      tilt.add(clouds);
    }
    if (p.id === 'saturn') {
      // 고리를 비스듬히 내려다보게 기울인다(docs/결정기록.md 2026-10-08: 토성은 고리를 보여 줌)
      const ring = createSaturnRing(1);
      load('saturn_ring.png').then((t) => ring.setMap(t));
      tilt.add(ring.mesh);
      tilt.rotation.set(0.42, 0, -0.12);
    } else {
      tilt.rotation.set(0.25, 0, THREE.MathUtils.degToRad(p.tilt) * 0.5);
    }
    group.add(tilt);
    scene.add(group);
    planets[p.id] = { group, mesh };
  }

  // ---- 태양 ----
  const sunMaterial = createSunMaterial(null);
  load('sun.jpg').then((t) => { sunMaterial.uniforms.map.value = t; });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), sunMaterial);
  sun.position.z = -800; // 행성보다 뒤
  const glow = fx ? new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })) : null;
  if (glow) { glow.position.z = -900; scene.add(glow); }
  scene.add(sun);

  let width = 1;
  let height = 1;
  let region = { left: 0, right: 1, top: 0, bottom: 1 };
  const k = { real: 0, sun: 0 };
  const target = { real: 0, sun: 0 };
  let layout = null;

  const toWorld = (x, y) => [x - width / 2, height / 2 - y];

  function place() {
    layout = sizeLayout({ region, real: ease(k.real), sun: ease(k.sun) });
    for (const it of layout.items) {
      const { group } = planets[it.id];
      const [x, y] = toWorld(it.x, it.y);
      group.position.set(x, y, 0);
      group.scale.setScalar(Math.max(it.r, 0.001));
    }
    const s = layout.sun;
    const [sx, sy] = toWorld(s.x, s.y);
    sun.position.set(sx, sy, -800);
    sun.scale.setScalar(s.r);
    sun.visible = k.sun > 0.001;
    if (glow) {
      glow.position.set(sx, sy, -900);
      glow.scale.setScalar(s.r * 2.5);
      glow.visible = sun.visible;
    }
  }

  return {
    scene,
    camera,
    // 화면 크기와 행성 줄을 놓을 영역(화면 픽셀, 위쪽이 0)
    resize(w, h, nextRegion) {
      width = w;
      height = h;
      region = nextRegion;
      Object.assign(camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 });
      camera.updateProjectionMatrix();
      stars.scale.set(w / 2, h / 2, 1);
      starHolder.position.set(0, 0, -2000);
      place();
    },
    setReal(on, { instant = false } = {}) { target.real = on ? 1 : 0; if (instant) { k.real = target.real; place(); } },
    setSunCompare(on, { instant = false } = {}) { target.sun = on ? 1 : 0; if (instant) { k.sun = target.sun; place(); } },
    // 바뀌는 중인지(이름표 숨김 판단용)
    isSettled: () => k.real === target.real && k.sun === target.sun,
    isReal: () => k.real === 1,
    update(dt, time) {
      const step = dt / MORPH_SECONDS;
      for (const key of ['real', 'sun']) {
        if (k[key] < target[key]) k[key] = Math.min(target[key], k[key] + step);
        else if (k[key] > target[key]) k[key] = Math.max(target[key], k[key] - step);
      }
      place();
      for (const id in planets) planets[id].mesh.rotation.y = time * 0.15;
      sunMaterial.uniforms.time.value = time;
    },
    // 이름표 자리(화면 픽셀): 행성 아래
    items: () => layout.items,
    sunInfo: () => ({ ...layout.sun, shown: k.sun > 0.001 })
  };
}
