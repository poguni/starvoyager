// 태양계 지도 장면(기획서 5-3 ①). 태양·행성 8개·궤도선·달·혜성·소행성 띠·별 배경.
// 시각 t(초)를 받아 천체 위치를 맞추고, 화면 좌표로 천체를 고를 수 있게 한다.
import * as THREE from 'three';
import { SUN, PLANETS, MOON, COMET, ASTEROID_BELT } from '../model/world.js';
import { circularPosition, cometPosition, moonPosition } from '../model/orbit.js';

const textureUrl = (name) => `${import.meta.env.BASE_URL}textures/1k/${name}`;

// 3D 장면의 빛·재질 색(화면 요소가 아니라 그림의 색이므로 tokens.css가 아닌 여기에 둔다).
const COLORS = {
  sunLight: 0xfff4e0,
  ambient: 0x8090b0,
  orbit: 0xffffff,
  asteroid: 0x8a8178,
  cometNucleus: 0xd8dde6,
  cometTail: 0xbfe2ff,
  saturnRing: 0xd9c690,
  star: 0xffffff
};
const SUNLIGHT = 3.2;
const AMBIENT = 0.22; // 밤 쪽도 색이 조금 보이게(태양 빛 가리기를 켜면 0)

function loadTexture(loader, name) {
  const tex = loader.load(textureUrl(name));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
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

function starField(count = 3500, radius = 1500) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(a), radius * u, radius * s * Math.sin(a)], i * 3);
    const b = 0.35 + Math.random() ** 3 * 0.65; // 어두운 별이 많고 밝은 별은 드물게
    col.set([b, b, b * (0.95 + Math.random() * 0.1)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false });
  return new THREE.Points(geo, mat);
}

function asteroidBelt() {
  const { inner, outer, count } = ASTEROID_BELT;
  // 울퉁불퉁한 돌 모양: 꼭짓점을 조금씩 흔든 다면체
  const geo = new THREE.IcosahedronGeometry(0.11, 1);
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

export function createSolarMap({ fx = true } = {}) {
  const scene = new THREE.Scene();
  const loader = new THREE.TextureLoader();
  const sunlight = new THREE.PointLight(COLORS.sunLight, SUNLIGHT, 0, 0);
  const ambient = new THREE.AmbientLight(COLORS.ambient, AMBIENT);
  scene.add(sunlight, ambient, starField());

  // ---- 태양: 스스로 빛나는 구 + 빛무리 ----
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN.radius, 64, 32),
    new THREE.MeshBasicMaterial({ map: loadTexture(loader, 'sun.jpg'), toneMapped: false })
  );
  scene.add(sun);
  let glow = null;
  if (fx) {
    glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTexture([[0, 'rgba(255,236,190,0.95)'], [0.22, 'rgba(255,190,90,0.55)'], [0.5, 'rgba(255,140,40,0.16)'], [1, 'rgba(255,120,30,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    glow.scale.setScalar(SUN.radius * 4.4);
    scene.add(glow);
  }

  // ---- 행성 ----
  const meshes = { sun };
  const objects = { sun: { body: SUN, mesh: sun, position: new THREE.Vector3() } };
  for (const p of PLANETS) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius, 64, 32),
      new THREE.MeshStandardMaterial({ map: loadTexture(loader, `${p.id}.jpg`), roughness: 1, metalness: 0 })
    );
    scene.add(mesh, orbitLine(p.orbitRadius));
    meshes[p.id] = mesh;
    objects[p.id] = { body: p, mesh, position: mesh.position };
  }
  // 토성 고리(이번 Phase는 간단한 반투명 고리. 정식 고리는 Phase 3)
  const saturn = meshes.saturn;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(saturn.geometry.parameters.radius * 1.25, saturn.geometry.parameters.radius * 2.2, 96),
    new THREE.MeshStandardMaterial({ color: COLORS.saturnRing, transparent: true, opacity: 0.4, side: THREE.DoubleSide, roughness: 1 })
  );
  ring.rotation.x = -Math.PI / 2 + 0.47; // 토성의 기울기만큼
  saturn.add(ring);

  // ---- 달 ----
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(MOON.radius, 48, 24),
    new THREE.MeshStandardMaterial({ map: loadTexture(loader, 'moon.jpg'), roughness: 1 })
  );
  scene.add(moon);
  objects.moon = { body: MOON, mesh: moon, position: moon.position };

  // ---- 혜성: 머리 + 태양 반대쪽으로 뻗는 꼬리 ----
  const comet = new THREE.Group();
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(COMET.radius, 16, 12), new THREE.MeshStandardMaterial({ color: COLORS.cometNucleus, roughness: 1 }));
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
  scene.add(belt);
  objects.asteroids = { body: ASTEROID_BELT, mesh: belt, position: new THREE.Vector3() };

  let sunlightOn = true;

  function update(t) {
    for (const p of PLANETS) {
      const pos = circularPosition(p, t);
      meshes[p.id].position.set(pos.x, pos.y, pos.z);
      meshes[p.id].rotation.y = t * 0.25;
    }
    const e = meshes.earth.position;
    const mp = moonPosition(MOON, e, t);
    moon.position.set(mp.x, mp.y, mp.z);
    sun.rotation.y = t * 0.02;

    const cp = cometPosition(COMET, t);
    comet.position.set(cp.x, cp.y, cp.z);
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

  return { scene, update, setSunlight, worldPosition, radiusOf, objects, glow };
}
