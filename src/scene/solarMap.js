// 태양계 지도 장면(기획서 5-3 ①). 태양·행성 8개·궤도선·달·혜성·소행성 띠·별 배경.
// 시각 t(초)를 받아 천체 위치를 맞추고, 화면 좌표로 천체를 고를 수 있게 한다.
import * as THREE from 'three';
import { SUN, PLANETS, MOON, COMET, ASTEROID_BELT } from '../model/world.js';
import { circularPosition, cometPosition, moonPosition } from '../model/orbit.js';
import { createSunMaterial, createEarthMaterial, createAtmosphere } from './materials.js';
import { createSaturnRing, createFaintRing, FAINT_RING_PLANETS } from './rings.js';
import { createStarBackground } from './starBackground.js';

// 3D 장면의 빛·재질 색(화면 요소가 아니라 그림의 색이므로 tokens.css가 아닌 여기에 둔다).
const COLORS = {
  sunLight: 0xfff4e0,
  ambient: 0x8090b0,
  orbit: 0xffffff,
  asteroid: 0x8a8178,
  cometNucleus: 0xd8dde6,
  cometTail: 0xbfe2ff
};
const SUNLIGHT = 3.2;
const AMBIENT = 0.22; // 밤 쪽도 색이 조금 보이게(태양 빛 가리기를 켜면 0)

// 혜성 핵: 감자처럼 길쭉하고 울퉁불퉁한 덩어리. 구의 각 점을 방향에 따라 정해진 혹들만큼 밀고 당긴다(늘 같은 모양).
function potatoGeometry(radius) {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const bumps = [ // [방향, 세기, 뾰족함]
    [[0.8, 0.3, 0.5], 0.22, 3], [[-0.6, 0.7, -0.2], 0.18, 4], [[0.1, -0.9, 0.4], -0.16, 5],
    [[-0.3, -0.2, -0.9], 0.2, 3], [[0.5, 0.6, -0.6], -0.14, 6], [[-0.9, -0.3, 0.3], 0.15, 4],
    [[0.2, 0.2, 0.95], -0.12, 8], [[0.6, -0.5, -0.3], 0.1, 10]
  ].map(([d, a, p]) => [new THREE.Vector3(...d).normalize(), a, p]);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let r = 1;
    for (const [d, a, p] of bumps) r += a * Math.max(0, v.dot(d)) ** p;
    r += 0.025 * Math.sin(v.x * 11 + v.y * 7) * Math.sin(v.z * 9 - v.x * 5); // 잔 울퉁불퉁
    v.multiplyScalar(r);
    pos.setXYZ(i, v.x * 1.5, v.y, v.z * 0.8);
  }
  geo.computeVertexNormals();
  geo.scale(radius / 1.3, radius / 1.3, radius / 1.3); // 가장 긴 쪽이 원래 지름보다 조금 크도록
  return geo;
}

// 가운데가 밝고 바깥으로 갈수록 투명해지는 원(빛무리·혜성 머리용)
function radialGlowTexture(stops) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function orbitLine(radius) {
  const points = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    points.push(new THREE.Vector3(radius * Math.cos(a), 0, -radius * Math.sin(a)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: COLORS.orbit, transparent: true, opacity: 0.14 }));
}

function asteroidBelt() {
  const { inner, outer, count } = ASTEROID_BELT;
  // 울퉁불퉁한 돌 모양: 꼭짓점을 조금씩 흔든 다면체
  const geo = new THREE.IcosahedronGeometry(0.07, 1);
  const gp = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < gp.count; i++) {
    v.fromBufferAttribute(gp, i);
    const k = 0.75 + 0.5 * Math.abs(Math.sin(v.x * 91.3 + v.y * 47.1 + v.z * 13.7));
    gp.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.asteroid, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const r = inner + (outer - inner) * (0.5 + (Math.random() + Math.random() - 1) * 0.5);
    const a = Math.random() * Math.PI * 2;
    const s = 0.4 + Math.random() ** 2 * 1.6;
    q.setFromEuler(e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3));
    m.compose(new THREE.Vector3(r * Math.cos(a), (Math.random() - 0.5) * 1.2, r * Math.sin(a)), q, new THREE.Vector3(s, s * 0.8, s));
    mesh.setMatrixAt(i, m);
  }
  return mesh;
}

// textures: textureManager(질감 단계 불러오기). 천체마다 1K로 시작해 가까이 가면 고해상도로 바뀐다.
// stars: 배경 별 자료(stars.json), pixelRatio: 별 점 크기를 화면 배율에 맞춘다.
export function createSolarMap({ fx = true, textures, stars, pixelRatio = 1 }) {
  const scene = new THREE.Scene();
  const sunlight = new THREE.PointLight(COLORS.sunLight, SUNLIGHT, 0, 0);
  const ambient = new THREE.AmbientLight(COLORS.ambient, AMBIENT);
  scene.add(sunlight, ambient, createStarBackground({ stars, pixelRatio }));

  // ---- 태양: 스스로 빛나며 표면이 일렁이는 구 + 빛무리 ----
  const sunMaterial = createSunMaterial(null);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN.radius, 96, 48), sunMaterial);
  sun.rotation.z = THREE.MathUtils.degToRad(SUN.tilt);
  scene.add(sun);
  textures.bind('sun', 'sun.jpg', (tex) => { sunMaterial.uniforms.map.value = tex; });
  let glow = null;
  if (fx) {
    glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTexture([[0, 'rgba(255,236,190,0.95)'], [0.22, 'rgba(255,190,90,0.55)'], [0.5, 'rgba(255,140,40,0.16)'], [1, 'rgba(255,120,30,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    glow.scale.setScalar(SUN.radius * 4.4);
    scene.add(glow);
  }

  // ---- 행성: 공전하는 무리(group) → 기울어진 축(tilt) → 자전하는 구(mesh). 고리는 기울어진 축에 붙는다. ----
  const meshes = { sun };
  const groups = {};
  const objects = { sun: { body: SUN, mesh: sun, position: new THREE.Vector3() } };
  const rings = [];
  const orbitLines = [];
  let earthMaterial = null;
  let atmosphere = null;
  let clouds = null;
  for (const p of PLANETS) {
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.z = THREE.MathUtils.degToRad(p.tilt);
    const geometry = new THREE.SphereGeometry(p.radius, 128, 64);
    let material;
    if (p.id === 'earth') {
      material = earthMaterial = createEarthMaterial(null, null);
      textures.bind('earth', 'earth.jpg', (tex) => { material.uniforms.dayMap.value = tex; });
      textures.bind('earth', 'earth_night.jpg', (tex) => { material.uniforms.nightMap.value = tex; });
    } else {
      material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
      textures.bind(p.id, `${p.id}.jpg`, (tex) => {
        material.map = tex;
        // 수성은 색 질감의 밝고 어두운 차이로 충돌 구덩이가 입체적으로 보이게 한다.
        if (p.id === 'mercury') { material.bumpMap = tex; material.bumpScale = 2.2; }
        material.needsUpdate = true;
      });
    }
    const mesh = new THREE.Mesh(geometry, material);
    tilt.add(mesh);
    group.add(tilt);
    const orbit = orbitLine(p.orbitRadius);
    orbitLines.push(orbit);
    scene.add(group, orbit);
    meshes[p.id] = mesh;
    groups[p.id] = group;
    objects[p.id] = { body: p, mesh, position: group.position };

    if (p.id === 'saturn') {
      const ring = createSaturnRing(p.radius);
      textures.bind('saturn', 'saturn_ring.png', (tex) => ring.setMap(tex));
      tilt.add(ring.mesh);
      rings.push(ring);
    } else if (FAINT_RING_PLANETS.includes(p.id)) {
      const ring = createFaintRing(p.id, p.radius);
      tilt.add(ring.mesh);
      rings.push(ring);
    }
    if (p.id === 'earth') {
      clouds = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius * 1.012, 128, 64),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, roughness: 1 })
      );
      textures.bind('earth', 'earth_clouds.jpg', (tex) => { clouds.material.alphaMap = tex; clouds.material.needsUpdate = true; }, { color: false });
      tilt.add(clouds);
      if (fx) {
        atmosphere = createAtmosphere(p.radius * 1.035);
        tilt.add(atmosphere);
      }
    }
  }

  // ---- 달 ----
  const moonMaterial = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON.radius, 96, 48), moonMaterial);
  textures.bind('moon', 'moon.jpg', (tex) => { moonMaterial.map = tex; moonMaterial.needsUpdate = true; });
  textures.bind('moon', 'moon_bump.jpg', (tex) => { moonMaterial.bumpMap = tex; moonMaterial.bumpScale = 3; moonMaterial.needsUpdate = true; }, { color: false });
  scene.add(moon);
  objects.moon = { body: MOON, mesh: moon, position: moon.position };

  // ---- 혜성: 머리 + 태양 반대쪽으로 뻗는 꼬리 ----
  const comet = new THREE.Group();
  const nucleus = new THREE.Mesh(potatoGeometry(COMET.radius), new THREE.MeshStandardMaterial({ color: COLORS.cometNucleus, roughness: 1 }));
  const coma = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTexture([[0, 'rgba(235,245,255,0.9)'], [0.3, 'rgba(191,226,255,0.35)'], [1, 'rgba(191,226,255,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  coma.scale.setScalar(2.4);
  const tailGeo = new THREE.ConeGeometry(1.1, 1, 24, 1, true);
  tailGeo.translate(0, -0.5, 0);   // 꼭짓점(머리)이 원점, 밑면(꼬리 끝)이 y = -1
  tailGeo.rotateX(-Math.PI / 2);   // 꼬리가 +z 쪽으로 뻗게(lookAt이 +z를 목표로 돌린다)
  const tailColors = [];
  const tp = tailGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const k = 1 - tp.getZ(i); // 머리 1 → 끝 0
    tailColors.push(k, k, k);
  }
  tailGeo.setAttribute('color', new THREE.Float32BufferAttribute(tailColors, 3));
  const tail = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({
    color: COLORS.cometTail, vertexColors: true, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  comet.add(nucleus, coma, tail);
  scene.add(comet);
  objects.comet = { body: COMET, mesh: nucleus, position: comet.position };

  // ---- 소행성 띠 ----
  const belt = asteroidBelt();
  belt.material.transparent = true;
  scene.add(belt);
  objects.asteroids = { body: ASTEROID_BELT, mesh: belt, position: new THREE.Vector3() };

  let sunlightOn = true;

  // 행성 탐사·발표 중에는 그 천체만 남기고 궤도선·소행성 띠·다른 천체를 0.6초 동안 감춘다(시안 S04·S09).
  //   다른 천체는 작아지며 사라지고(고리·구름·대기광까지 함께), 궤도선·소행성 띠는 흐려진다.
  const ISOLATE_SECONDS = 0.6;
  const shown = Object.fromEntries([...Object.keys(objects), 'orbits'].map((id) => [id, 1]));
  let keep = null; // null이면 모두 보인다
  let lastSeconds = null;
  const wantShown = (id) => !keep || keep.includes(id);
  const scaleTarget = (id) => (id === 'moon' ? moon : id === 'comet' ? comet : id === 'sun' ? null : groups[id]?.children[0]);
  function stepIsolate(dt) {
    const k = dt / ISOLATE_SECONDS;
    for (const id of Object.keys(shown)) {
      const want = id === 'orbits' ? (keep ? 0 : 1) : wantShown(id) ? 1 : 0;
      if (shown[id] === want) continue;
      shown[id] = want > shown[id] ? Math.min(want, shown[id] + k) : Math.max(want, shown[id] - k);
      const e = shown[id] * shown[id] * (3 - 2 * shown[id]); // 부드럽게 시작하고 멈춤
      if (id === 'orbits') {
        for (const line of orbitLines) { line.material.opacity = 0.14 * e; line.visible = e > 0; }
      } else if (id === 'asteroids') {
        belt.material.opacity = e;
        belt.visible = e > 0;
      } else {
        const obj = scaleTarget(id);
        if (!obj) continue;
        obj.scale.setScalar(Math.max(e, 1e-4));
        obj.visible = e > 0;
      }
    }
  }

  // t: 공전 시각, spin: 자전 시각(행성 탐사 중에는 공전만 멈추고 자전은 계속한다)
  function update(t, spin = t, seconds = spin) {
    stepIsolate(lastSeconds === null ? 0 : Math.max(0, seconds - lastSeconds));
    lastSeconds = seconds;
    for (const p of PLANETS) {
      const pos = circularPosition(p, t);
      groups[p.id].position.set(pos.x, pos.y, pos.z);
      meshes[p.id].rotation.y = spin * 0.25;
    }
    if (clouds) clouds.rotation.y = spin * 0.25 + seconds * 0.006; // 구름은 지구보다 아주 조금 더 흐른다
    const e = groups.earth.position;
    const mp = moonPosition(MOON, e, t);
    moon.position.set(mp.x, mp.y, mp.z);
    moon.lookAt(e); // 달은 늘 같은 면이 지구를 향한다
    sun.rotation.y = spin * 0.02;
    sunMaterial.uniforms.time.value = seconds;

    const cp = cometPosition(COMET, t);
    comet.position.set(cp.x, cp.y, cp.z);
    nucleus.rotation.set(seconds * 0.11, seconds * 0.07, seconds * 0.05); // 천천히 굴러가듯 돈다
    // 꼬리는 태양 반대쪽, 태양에 가까울수록 길고 밝다.
    const r = comet.position.length();
    tail.lookAt(comet.position.clone().multiplyScalar(2)); // 태양 반대쪽을 향한다
    tail.scale.set(1, 1, THREE.MathUtils.clamp(320 / r, 9, 24));
    const shine = sunlightOn ? THREE.MathUtils.clamp(50 / r, 0.5, 1) : 0;
    tail.material.opacity = 0.45 * shine;
    coma.material.opacity = shine;

    belt.rotation.y = (2 * Math.PI * t) / ASTEROID_BELT.period;
  }

  // 태양 빛 가리기: 행성·달·혜성·소행성은 어두워지고, 태양 자신과 배경 별은 그대로 빛난다(docs/결정기록.md).
  function setSunlight(on) {
    sunlightOn = on;
    sunlight.intensity = on ? SUNLIGHT : 0;
    ambient.intensity = on ? AMBIENT : 0;
    const k = on ? 1 : 0;
    if (earthMaterial) earthMaterial.uniforms.sunlight.value = k;
    if (atmosphere) atmosphere.material.uniforms.sunlight.value = k;
    for (const ring of rings) ring.setSunlight(on);
  }

  // id: 행성 탐사 중인 천체(지구는 달도 함께 남긴다). null이면 모두 다시 보인다.
  function isolate(id) {
    keep = id ? ['sun', id, ...(id === 'earth' ? ['moon'] : [])] : null;
  }
  const isShown = (id) => (id === 'asteroids' ? belt.visible : shown[id] > 0);
  // 이름표를 달 천체: 감추는 중에는 남긴 천체만(태양은 빛만 남기고 이름표는 달지 않는다)
  const labelKept = (id) => !keep || (wantShown(id) && id !== 'sun');

  // 고리 찾기 돋보기: 희미한 고리(목성·천왕성·해왕성)를 밝게 강조한다. 토성 고리도 조금 밝아진다.
  function setLoupe(on) {
    for (const ring of rings) ring.setLoupe(on);
  }

  // 천체의 월드 위치(소행성 띠는 가장 가까운 띠 위의 점을 쓰도록 near를 받는다)
  function worldPosition(id, near) {
    if (id === 'asteroids') {
      const mid = (ASTEROID_BELT.inner + ASTEROID_BELT.outer) / 2;
      const dir = near ? new THREE.Vector3(near.x, 0, near.z).normalize() : new THREE.Vector3(1, 0, 0);
      return dir.multiplyScalar(mid);
    }
    return objects[id].position.clone();
  }

  function radiusOf(id) {
    return id === 'asteroids' ? (ASTEROID_BELT.outer - ASTEROID_BELT.inner) / 2 : objects[id].body.radius;
  }

  // 착륙 장면의 땅색을 가져올 질감 그림(지금 끼워진 질감)
  function surfaceImage(id) {
    if (id === 'earth') return earthMaterial?.uniforms.dayMap.value?.image ?? null;
    return meshes[id]?.material.map?.image ?? null;
  }

  return { scene, update, setSunlight, setLoupe, isolate, isShown, labelKept, worldPosition, radiusOf, surfaceImage, objects, glow };
}
