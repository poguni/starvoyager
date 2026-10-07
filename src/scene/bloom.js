// 태양 빛무리(블룸). 아주 밝은 곳(스스로 빛나는 태양 표면)만 번지도록 문턱을 높게 둔다.
// ?fx=off, ?quality=low에서는 쓰지 않는다(main.js).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const STRENGTH = 0.42;
const RADIUS = 0.45;
const THRESHOLD = 1.05; // 햇빛을 받은 행성(최대 약 1)은 번지지 않는다

export function createBloom(renderer) {
  const composer = new EffectComposer(renderer);
  const pass = new RenderPass(new THREE.Scene(), new THREE.Camera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), STRENGTH, RADIUS, THRESHOLD);
  composer.addPass(pass);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    render(scene, camera) {
      pass.scene = scene;
      pass.camera = camera;
      composer.render();
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
  };
}
