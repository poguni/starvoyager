// 우주 배경(태양계 지도·행성 탐사): 실제 밝은 별(stars.json, 예일 밝은 별 목록)을 실제 방향에 밝기별 크기·별 색으로 놓고,
// 어두운 별과 은하수(은하면을 따라 흩어진 옅은 빛)를 더한다. 북쪽 밤하늘과 같은 별·은하수 자료를 쓴다.
import * as THREE from 'three';
import { milkyWayPoints, starColor } from './northSky.js';

const RAD = Math.PI / 180;
const OBLIQUITY = 23.44 * RAD; // 장면의 바닥(y = 0)은 황도면이므로 적도 좌표를 이만큼 돌린다
const FAINT_STARS = 2600;

// 적경·적위(도) → 장면 방향(y가 황도 북쪽, 궤도는 x → -z 방향으로 돈다)
function direction(ra, dec) {
  const x = Math.cos(dec * RAD) * Math.cos(ra * RAD);
  const y = Math.cos(dec * RAD) * Math.sin(ra * RAD);
  const z = Math.sin(dec * RAD);
  const ye = y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY);
  const ze = -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY);
  return [x, ze, -ye];
}

// 점마다 크기(px)·색·밝기를 갖는 부드러운 원
function pointsLayer(items, radius, pixelRatio, softness) {
  const n = items.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const c = new THREE.Color();
  items.forEach(({ dir, rgb, px, a }, i) => {
    pos.set(dir.map((v) => v * radius), i * 3);
    c.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace); // 선형 색으로 더하고 출력할 때 sRGB로
    col.set([c.r * a, c.g * a, c.b * a], i * 3);
    size[i] = px;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: pixelRatio }, softness: { value: softness } },
    vertexShader: /* glsl */`
      attribute float size;
      uniform float pixelRatio;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pixelRatio;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float softness;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(1.0 - softness, 1.0, d);
        gl_FragColor = vec4(vColor * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geo, material);
}

export function createStarBackground({ stars, radius = 1500, pixelRatio = 1 }) {
  const group = new THREE.Group();
  // 은하수: 크고 아주 옅은 점이 겹쳐 띠처럼 보인다.
  const milky = milkyWayPoints().map(([ra, dec, k]) => ({ dir: direction(ra, dec), rgb: [190, 205, 255], px: 7, a: 0.05 * k }));
  // 밝은 별: 1등성은 약 4.5px, 4.5등성은 약 1.3px
  const bright = stars.map(([, ra, dec, mag, bv]) => ({
    dir: direction(ra, dec), rgb: starColor(bv),
    px: THREE.MathUtils.clamp(3.6 - 0.55 * mag, 1.3, 5), a: THREE.MathUtils.clamp(1.15 - 0.15 * mag, 0.45, 1)
  }));
  // 어두운 별(목록보다 어두운 별을 대신하는 무작위 점)
  const faint = Array.from({ length: FAINT_STARS }, () => {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return { dir: [s * Math.cos(t), u, s * Math.sin(t)], rgb: [235, 240, 255], px: 1.2, a: 0.25 + Math.random() * 0.3 };
  });
  group.add(pointsLayer(milky, radius, pixelRatio, 1), pointsLayer(faint, radius, pixelRatio, 0.6), pointsLayer(bright, radius, pixelRatio, 0.55));
  group.renderOrder = -1;
  return group;
}
