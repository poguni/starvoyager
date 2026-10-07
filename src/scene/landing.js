// 착륙 장면(기획서 5-3 ③): 단단한 땅 행성은 땅 위에 내려앉고, 기체 행성은 구름층을 지나도 땅이 나오지 않는다.
// 땅은 그 행성 질감에서 가져온 색을 바탕으로 지형·돌 무늬를 코드로 그린다(docs/결정기록.md 2026-10-08).
// 이 장면은 표면 상태를 느끼기 위한 연출이며 실제 탐사 장면과 다를 수 있다(기획서 12장).
import * as THREE from 'three';

// 그림의 색(화면 요소가 아니라 3D 장면의 색이라 tokens.css가 아닌 여기에 둔다)
const SOLID = {
  mercury: { sky: 0x000000, fog: null, light: 0xffffff, fallback: [0.45, 0.43, 0.41], craters: 46, roughness: 7 },
  venus: { sky: 0x6b3d12, fog: 0x7a4a18, light: 0xffc27a, fallback: [0.52, 0.38, 0.22], craters: 0, roughness: 3, cloud: 0xd9a54a },
  earth: { sky: 0x7fb4ec, fog: 0xa9c9ee, light: 0xfff6e8, fallback: [0.32, 0.4, 0.22], craters: 0, roughness: 6 },
  mars: { sky: 0xd2a77c, fog: 0xcf9f78, light: 0xffeedd, fallback: [0.7, 0.32, 0.16], craters: 6, roughness: 5 }
};
const GAS = {
  jupiter: { bands: [0xeee0c8, 0xc28a5c, 0xf5efe2, 0xa8724a], deep: 0x5a3a22 },
  saturn: { bands: [0xf2e2b4, 0xd8c08a, 0xe9d8a8], deep: 0x6a5530 },
  uranus: { bands: [0xa6e0de, 0x86cdd0, 0xc4ecea], deep: 0x2c5f62 },
  neptune: { bands: [0x5b7ff0, 0x3d5fd6, 0x8ea6f5], deep: 0x101f5a }
};
// 지구는 한반도(동경 127°, 북위 37°) 땅색, 수성·화성은 질감 가운데 넓은 영역의 평균색을 쓴다.
const SAMPLE = { earth: { u: (127 + 180) / 360, v: (90 - 37) / 180, size: 0.012 }, mercury: { u: 0.5, v: 0.5, size: 0.3 }, mars: { u: 0.45, v: 0.52, size: 0.12 } };

// ---- 간단한 값 잡음(value noise)과 fBm ----
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi); const b = hash(xi + 1, yi); const c = hash(xi, yi + 1); const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 주기 period로 반복되는 잡음(바위 결 무늬가 이음매 없이 이어지도록)
function tileNoise(x, y, period) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const w = (i) => ((i % period) + period) % period;
  const a = hash(w(xi), w(yi)); const b = hash(w(xi + 1), w(yi)); const c = hash(w(xi), w(yi + 1)); const d = hash(w(xi + 1), w(yi + 1));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, octaves = 5) {
  let sum = 0; let amp = 0.5; let f = 1;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * f, y * f); amp *= 0.5; f *= 2.03; }
  return sum;
}

// 질감 그림의 한 영역 평균색(0~1). 그림을 읽지 못하면 null.
export function sampleTextureColor(image, { u, v, size }) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const w = image.width; const h = image.height;
    ctx.drawImage(image, (u - size / 2) * w, (v - size / 2) * h, size * w, size * h, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    let r = 0; let g = 0; let b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4 * 255;
    return [r / n, g / n, b / n];
  } catch {
    return null;
  }
}

// 바위 결 무늬(회색). 땅의 꼭짓점 색과 곱해져 가까이에서도 표면이 거칠게 보이게 한다.
function detailTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 가장자리가 이어지도록 그림 한 장에 딱 맞는 주기의 잡음을 쓴다
      const n = 0.55 * tileNoise((x / size) * 8, (y / size) * 8, 8) + 0.3 * tileNoise((x / size) * 32, (y / size) * 32, 32) + 0.15 * hash(x, y);
      const k = Math.round(150 + n * 105);
      img.data.set([k, k, k, 255], (y * size + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function softCloudTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5; const dy = y / size - 0.5;
      const fall = Math.max(0, 1 - Math.hypot(dx, dy) * 2);
      const a = fall * fall * (0.5 + 0.5 * fbm(x / 40, y / 40, 4));
      img.data.set([255, 255, 255, Math.round(a * 255)], (y * size + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function starPoints() {
  const pos = [];
  for (let i = 0; i < 1500; i++) {
    const u = Math.random(); const a = Math.random() * Math.PI * 2; const r = 900;
    const y = 0.05 + u * 0.95;
    const s = Math.sqrt(1 - y * y);
    pos.push(r * s * Math.cos(a), r * y, r * s * Math.sin(a));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0xffffff, fog: false }));
}

const easeOut = (x) => 1 - (1 - x) ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export function createLandingScene() {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
  let scene = null;
  let state = null; // 지금 착륙 중인 행성의 장면 정보

  function disposeScene() {
    scene?.traverse((o) => {
      o.geometry?.dispose();
      const m = o.material;
      if (m) { m.map?.dispose(); m.dispose(); }
    });
    scene = null;
  }

  // ---- 단단한 땅 ----
  function buildSolid(id, image) {
    const spec = SOLID[id];
    // 질감에서 가져온 색을 행성 대표색과 반씩 섞고, 바위 결 무늬가 어둡게 만드는 만큼 밝힌다.
    const sampled = image && SAMPLE[id] && sampleTextureColor(image, SAMPLE[id]);
    const base = (sampled ? sampled.map((c, i) => (c + spec.fallback[i]) / 2) : spec.fallback).map((c) => Math.min(1, c * 1.22));
    const s = new THREE.Scene();
    s.background = new THREE.Color(spec.sky);
    if (spec.fog) s.fog = new THREE.FogExp2(spec.fog, id === 'venus' ? 0.006 : 0.002);

    const craters = Array.from({ length: spec.craters }, (_, i) => ({
      x: (hash(i, 1) - 0.5) * 520, z: (hash(i, 2) - 0.5) * 520, r: 6 + hash(i, 3) ** 2 * 34
    }));
    craters.push(...(spec.craters ? [{ x: 0, z: -70, r: 26 }] : [])); // 앞쪽에 잘 보이는 구덩이 하나
    const height = (x, z) => {
      let h = (fbm(x * 0.012, z * 0.012) - 0.5) * spec.roughness * 4 + (fbm(x * 0.08, z * 0.08, 3) - 0.5) * 1.4;
      for (const c of craters) {
        const d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1) h -= c.r * 0.22 * (1 - d * d);
        else if (d < 1.35) h += c.r * 0.06 * Math.cos(((d - 1) / 0.35) * Math.PI * 0.5);
      }
      return h;
    };

    const geo = new THREE.PlaneGeometry(700, 700, 220, 220);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const tint = new THREE.Color(...base);
    const green = new THREE.Color(0.28, 0.42, 0.18);
    const brown = new THREE.Color(0.45, 0.36, 0.24);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      pos.setY(i, height(x, z));
      const n = fbm(x * 0.03 + 7, z * 0.03 + 3, 4);
      const c = id === 'earth'
        ? tint.clone().lerp(n > 0.5 ? green : brown, 0.45)
        : tint.clone().multiplyScalar(0.75 + n * 0.5);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(), roughness: 1, metalness: 0 }));
    s.add(ground);

    // 흩어진 돌
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.8), roughness: 1, flatShading: true }), 420);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
    for (let i = 0; i < 420; i++) {
      const x = (hash(i, 7) - 0.5) * 300; const z = (hash(i, 8) - 0.5) * 300 - 60;
      const sc = 0.15 + hash(i, 9) ** 3 * 1.8;
      q.setFromEuler(e.set(hash(i, 10) * 6, hash(i, 11) * 6, hash(i, 12) * 6));
      m.compose(new THREE.Vector3(x, height(x, z) + sc * 0.3, z), q, new THREE.Vector3(sc, sc * 0.7, sc));
      rocks.setMatrixAt(i, m);
    }
    s.add(rocks);

    const sun = new THREE.DirectionalLight(spec.light, id === 'venus' ? 1.2 : 2.6);
    sun.position.set(-120, id === 'venus' ? 160 : 70, -60);
    s.add(sun, new THREE.HemisphereLight(spec.sky, 0x000000, id === 'mercury' ? 0.05 : 0.6));
    if (id === 'mercury') s.add(starPoints());

    let cloud = null;
    if (spec.cloud) {
      // 금성: 내려가는 중간에 지나는 두꺼운 노란 구름(안개 농도로 표현)
      cloud = { color: new THREE.Color(spec.cloud), base: s.fog.color.clone(), density: s.fog.density };
    }
    const groundY = height(0, 0);
    return { scene: s, kind: 'solid', start: new THREE.Vector3(0, groundY + 220, 70), end: new THREE.Vector3(0, groundY + 2.2, 0), cloud };
  }

  // ---- 기체: 구름층을 지나 내려가도 땅이 없다 ----
  function buildGas(id) {
    const spec = GAS[id];
    const s = new THREE.Scene();
    // 배경은 구름보다 조금 어둡게 두어 구름 덩어리가 보이게 한다.
    const top = new THREE.Color(spec.bands[0]).lerp(new THREE.Color(spec.deep), 0.35);
    s.background = top.clone();
    s.fog = new THREE.FogExp2(top.clone(), 0.0025);
    const tex = softCloudTexture();
    const group = new THREE.Group();
    for (let i = 0; i < 260; i++) {
      const y = 60 - (i / 260) * 560;
      const color = new THREE.Color(spec.bands[i % spec.bands.length]).multiplyScalar(0.8 + hash(i, 3) * 0.45);
      const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 1, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      // 내려가는 길 둘레(옆과 아래)에 구름 덩어리를 두어 지나쳐 가는 것이 보이게 한다.
      const a = hash(i, 4) * Math.PI * 2; const r = 14 + hash(i, 5) * 70;
      sp.position.set(Math.cos(a) * r, y, Math.sin(a) * r - 25);
      sp.scale.setScalar(35 + hash(i, 6) * 70);
      group.add(sp);
    }
    s.add(group);
    return {
      scene: s, kind: 'gas', group, top, deep: new THREE.Color(spec.deep),
      start: new THREE.Vector3(0, 90, 40), end: new THREE.Vector3(0, -470, 0)
    };
  }

  // id: 행성, surface: 'solid' | 'gas', image: 그 행성 질감 그림(땅색을 가져올 때)
  function build(id, surface, image) {
    disposeScene();
    state = surface === 'solid' ? buildSolid(id, image) : buildGas(id);
    scene = state.scene;
    camera.position.copy(state.start);
  }

  // phase: 'descend' | 'hold' | 'ascend' | 'landed' | 'lift', k: 그 단계 진행(0~1), cloudK: 금성 구름 안에 있는 정도(0~1)
  function update(phase, k, { cloudK = 0, time = 0 } = {}) {
    if (!state) return;
    const { start, end } = state;
    let p;
    if (phase === 'descend') p = state.kind === 'solid' ? easeOut(k) : easeInOut(k);
    else if (phase === 'hold' || phase === 'landed') p = 1;
    else if (phase === 'ascend' || phase === 'lift') p = 1 - easeInOut(k);
    else p = 0;
    camera.position.lerpVectors(start, end, p);

    if (state.kind === 'solid') {
      // 내려가며 점점 앞(지평선)을 바라본다
      camera.lookAt(0, end.y - 2 - (1 - p) * 120, -80 - p * 60);
      if (state.cloud) {
        const f = scene.fog;
        f.color.copy(state.cloud.base).lerp(state.cloud.color, cloudK);
        f.density = state.cloud.density + cloudK * 0.09;
        scene.background.copy(f.color);
      }
    } else {
      // 깊이 들어갈수록 안개가 짙어지고 어두워진다. 멈칫할 때는 조금 흔들린다.
      const depth = p;
      scene.fog.color.copy(state.top).lerp(state.deep, depth);
      scene.fog.density = 0.0025 + depth * depth * 0.03;
      scene.background.copy(scene.fog.color);
      state.group.rotation.y = time * 0.03;
      if (phase === 'hold') camera.position.x += Math.sin(time * 40) * 0.25;
      camera.lookAt(camera.position.x, camera.position.y - 60, camera.position.z - 40);
    }
  }

  return {
    camera,
    build,
    update,
    getScene: () => scene,
    dispose() { disposeScene(); state = null; }
  };
}
