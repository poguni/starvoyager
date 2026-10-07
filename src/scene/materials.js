// 특별한 재질: 태양(스스로 빛나며 표면이 천천히 일렁임), 지구(낮·밤·바다 반짝임·옅은 대기), 대기광.
// 셰이더 안의 색은 그림의 색이라 tokens.css가 아닌 여기에 둔다.
import * as THREE from 'three';

// 출력 색공간 변환(선형 → sRGB)을 다른 재질과 똑같이 하기 위한 공통 끝부분
const OUTPUT = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// 태양: 질감 두 겹이 서로 다른 속도로 흐르며 섞여 표면이 끓어오르듯 보이고, 가장자리는 조금 어둡다(주연 감광).
export function createSunMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, time: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec2 wobble = vec2(sin(vUv.y * 60.0 + time * 0.7), cos(vUv.x * 80.0 - time * 0.5)) * 0.0025;
        vec3 a = texture2D(map, vUv + wobble + vec2(time * 0.0015, 0.0)).rgb;
        vec3 b = texture2D(map, vUv - wobble * 1.6 + vec2(-time * 0.001, 0.0)).rgb;
        vec3 c = mix(a, b, 0.35 + 0.15 * sin(time * 0.3));
        float mu = max(dot(normalize(vNormal), normalize(vView)), 0.0);
        c *= 0.55 + 0.6 * pow(mu, 0.45);
        gl_FragColor = vec4(c * 1.35, 1.0);
        ${OUTPUT}
      }
    `,
    toneMapped: false
  });
}

// 지구: 태양 쪽은 낮 질감, 반대쪽은 도시 불빛. 바다는 조금 밝히고 햇빛이 비치는 곳은 반짝이게,
// 낮 쪽 가장자리로 갈수록 푸른 대기 빛을 더한다. sunlight가 0이면(태양 빛 가리기) 모두 꺼진다.
export function createEarthMaterial(dayMap, nightMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      sunPosition: { value: new THREE.Vector3() },
      sunlight: { value: 1 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunPosition;
      uniform float sunlight;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 l = normalize(sunPosition - vWorldPos);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float ndl = dot(n, l);
        float light = clamp(ndl, 0.0, 1.0);
        float dayAmount = smoothstep(-0.08, 0.18, ndl);

        vec3 day = texture2D(dayMap, vUv).rgb;
        float ocean = smoothstep(0.004, 0.03, day.b - max(day.r, day.g));
        day = mix(day, day * 1.9 + vec3(0.0, 0.012, 0.035), ocean);

        vec3 color = day * (light * 1.08 + 0.02);
        vec3 h = normalize(l + v);
        color += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, h), 0.0), 70.0) * ocean * 0.55 * light;
        float rim = 1.0 - max(dot(n, v), 0.0);
        color += vec3(0.28, 0.52, 1.0) * (0.04 + 0.42 * pow(rim, 2.2)) * sqrt(light);
        color *= sunlight;

        vec3 night = texture2D(nightMap, vUv).rgb * 1.5 * (1.0 - dayAmount) * sunlight;
        gl_FragColor = vec4(color + night, 1.0);
        ${OUTPUT}
      }
    `
  });
}

// 대기광: 시선이 표면을 스칠수록(가장자리) 밝아지는 푸른 빛. 밤 쪽에서는 사라진다.
export function createAtmosphere(radius) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { sunPosition: { value: new THREE.Vector3() }, sunlight: { value: 1 } },
      vertexShader: /* glsl */`
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 sunPosition;
        uniform float sunlight;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 n = normalize(vWorldNormal);
          vec3 v = normalize(cameraPosition - vWorldPos);
          float rim = 1.0 - max(dot(v, n), 0.0);
          float lit = smoothstep(-0.25, 0.4, dot(n, normalize(sunPosition - vWorldPos)));
          gl_FragColor = vec4(vec3(0.3, 0.62, 1.0), pow(rim, 5.0) * 0.75 * lit * sunlight);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}
