// 고리 네 개(기획서 4-3, 12장). 토성은 질감으로 '뚜렷한 고리', 목성·천왕성·해왕성은 직접 그린 '희미한 고리'.
// 희미한 고리는 평소 실제처럼 잘 안 보이고, 고리 찾기 돋보기를 켜면 밝게 강조된다.
import * as THREE from 'three';

// 행성 반지름 배수로 나타낸 고리 범위와 띠(실제 고리 배치를 단순하게 옮긴 것)
const FAINT = {
  jupiter: { inner: 1.38, outer: 1.82, bands: [[0.0, 0.62, 0.12], [0.78, 0.98, 1.0]], tint: [0.78, 0.68, 0.56] },
  uranus: { inner: 1.6, outer: 2.05, bands: [[0.06, 0.1, 0.8], [0.2, 0.24, 0.8], [0.34, 0.38, 0.7], [0.55, 0.6, 0.9], [0.9, 1.0, 1.0]], tint: [0.8, 0.84, 0.86] },
  neptune: { inner: 1.65, outer: 2.55, bands: [[0.0, 0.3, 0.3], [0.48, 0.52, 0.9], [0.62, 0.7, 0.35], [0.94, 0.99, 1.0]], tint: [0.8, 0.82, 0.9] }
};
const FAINT_OPACITY = 0.015;  // 평소: 거의 안 보임(빛을 더하는 방식이라 행성을 가리지 않는다. 선형 색에 더하므로 아주 작게)
const LOUPE_OPACITY = 0.8;   // 돋보기: 밝게

// 고리면이 행성 적도(xz 평면)에 놓이도록 눕히고, u가 안쪽(0)→바깥쪽(1)이 되도록 UV를 고친다.
function ringGeometry(inner, outer) {
  const geo = new THREE.RingGeometry(inner, outer, 160, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// 띠 목록 [[시작, 끝, 진하기]]으로 가로 1줄짜리 투명도 질감을 그린다.
function bandTexture(bands) {
  const w = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, 1);
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    let a = 0;
    for (const [s, e, k] of bands) {
      if (u >= s && u <= e) {
        const edge = Math.min(u - s, e - u) / Math.max((e - s) * 0.5, 1e-3);
        a = Math.max(a, k * Math.min(1, edge * 3));
      }
    }
    // alphaMap은 색(초록) 채널을 읽으므로 진하기를 색에 넣는다(투명도 칸에 넣으면 띠 사이도 비친다)
    const v = Math.round(a * 255);
    img.data.set([v, v, v, 255], x * 4);
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export function createSaturnRing(planetRadius) {
  const mesh = new THREE.Mesh(
    ringGeometry(planetRadius * 1.24, planetRadius * 2.27),
    new THREE.MeshStandardMaterial({
      transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0,
      depthWrite: false, emissive: 0xffffff, emissiveIntensity: 0
    })
  );
  return {
    mesh,
    setMap(tex) {
      mesh.material.map = tex;
      mesh.material.emissiveMap = tex;
      mesh.material.needsUpdate = true;
    },
    setLoupe(on) { mesh.material.emissiveIntensity = on ? 0.35 : 0; },
    setSunlight() {}
  };
}

export function createFaintRing(id, planetRadius) {
  const spec = FAINT[id];
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(...spec.tint), alphaMap: bandTexture(spec.bands),
    transparent: true, opacity: FAINT_OPACITY, side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(ringGeometry(planetRadius * spec.inner, planetRadius * spec.outer), material);
  let loupe = false;
  let sunlight = true;
  const refresh = () => {
    // 돋보기를 켜면 밝게. 태양 빛을 가리면(돋보기가 꺼져 있을 때) 고리도 보이지 않는다.
    material.opacity = loupe ? LOUPE_OPACITY : sunlight ? FAINT_OPACITY : 0;
  };
  return {
    mesh,
    setLoupe(on) { loupe = on; refresh(); },
    setSunlight(on) { sunlight = on; refresh(); }
  };
}

export const FAINT_RING_PLANETS = Object.keys(FAINT);
