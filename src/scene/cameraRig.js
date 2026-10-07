// 카메라와 비행 연출(motion.md '비행'). 드래그 회전·휠/두 손가락 확대는 OrbitControls.
// 비행: 2.5초 동안 부드럽게 시작하고 멈춘다. 비행 중에는 조작을 잠근다.
// 도착한 뒤에는 그 천체를 따라가며 본다(행성이 공전해도 화면 가운데에 남는다).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const FLIGHT_SECONDS = 2.5; // tokens.css --sv-dur-flight

// tokens.css --sv-ease: cubic-bezier(0.45, 0, 0.55, 1)에 가까운 곡선
export function easeInOut(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

// 태양계 지도 전체 보기(S03처럼 태양이 왼쪽에 크게, 궤도가 오른쪽으로 펼쳐지게)
export const HOME = {
  position: new THREE.Vector3(60.5, 42.5, 152.5),
  target: new THREE.Vector3(68, 0, 0),
  minDistance: 20,
  maxDistance: 420
};

export function createCameraRig(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  camera.position.copy(HOME.position);
  controls.target.copy(HOME.target);
  setLimits(HOME.minDistance, HOME.maxDistance);
  controls.update();

  let flight = null; // { fromPos, fromTarget, getTarget, offset, elapsed, follow, limits, onArrive }
  let follow = null; // 도착한 뒤 따라가는 대상(지금 위치를 돌려주는 함수)
  const lastFollow = new THREE.Vector3();

  function setLimits(min, max) {
    controls.minDistance = min;
    controls.maxDistance = max;
  }

  function start(plan) {
    if (flight) return false; // 연타 방어
    follow = null;
    // 비행 중에는 거리 제한이 카메라를 붙잡지 않도록 풀어 둔다.
    setLimits(0, Infinity);
    flight = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), elapsed: 0, ...plan };
    controls.enabled = false;
    return true;
  }

  // getTarget(): 목표 천체의 지금 위치. radius: 천체 반지름(카메라 거리와 확대 제한을 정한다).
  function flyTo({ getTarget, radius, distance, onArrive }) {
    // 지금 보는 방향을 크게 바꾸지 않으면서 천체를 비스듬히 위에서 보도록
    const dir = camera.position.clone().sub(controls.target).normalize();
    dir.y = Math.max(dir.y, 0.25);
    const dist = distance ?? radius * 4.2;
    return start({
      getTarget, offset: dir.normalize().multiplyScalar(dist), follow: true,
      limits: [radius * 1.6, dist * 4], onArrive
    });
  }

  function flyHome(onArrive) {
    return start({
      getTarget: () => HOME.target, offset: HOME.position.clone().sub(HOME.target), follow: false,
      limits: [HOME.minDistance, HOME.maxDistance], onArrive
    });
  }

  function update(dt) {
    if (flight) {
      flight.elapsed += dt;
      const k = easeInOut(Math.min(flight.elapsed / FLIGHT_SECONDS, 1));
      const target = flight.getTarget();
      controls.target.lerpVectors(flight.fromTarget, target, k);
      camera.position.lerpVectors(flight.fromPos, target.clone().add(flight.offset), k);
      camera.lookAt(controls.target);
      if (k < 1) return;
      const done = flight;
      flight = null;
      setLimits(...done.limits);
      controls.enabled = true;
      if (done.follow) {
        follow = done.getTarget;
        lastFollow.copy(follow());
      }
      done.onArrive?.();
      return;
    }
    if (follow) {
      // 천체가 움직인 만큼 카메라와 바라보는 점을 함께 옮긴다.
      const now = follow();
      camera.position.add(now.clone().sub(lastFollow));
      controls.target.add(now.clone().sub(lastFollow));
      lastFollow.copy(now);
    }
    controls.update();
  }

  return { controls, flyTo, flyHome, update, isFlying: () => flight !== null };
}
