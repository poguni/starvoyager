// 화면 좌표로 천체 고르기. 작은 천체도 손가락으로 누르기 쉽도록 화면에서 최소 반경을 둔다.
import * as THREE from 'three';
import { ASTEROID_BELT } from '../model/world.js';

const MIN_HIT_PX = 30;

// 천체 중심의 화면 위치(px)와 화면에서의 반지름(px). 카메라 뒤에 있으면 null.
export function screenCircle(camera, rect, worldPos, radius) {
  const v = worldPos.clone().project(camera);
  if (v.z > 1) return null;
  const dist = camera.position.distanceTo(worldPos);
  const pxPerUnit = rect.height / 2 / (dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height, r: radius * pxPerUnit };
}

// 겹치면 화면에서 작은 천체를 먼저 고른다(태양 앞을 지나는 행성을 누를 수 있도록).
export function pickBody(camera, rect, px, py, map) {
  let best = null;
  for (const [id, obj] of Object.entries(map.objects)) {
    if (id === 'asteroids' || !map.isShown(id)) continue;
    const c = screenCircle(camera, rect, map.worldPosition(id), obj.body.radius);
    if (!c) continue;
    const reach = Math.max(c.r * 1.15, MIN_HIT_PX);
    const d = Math.hypot(px - c.x, py - c.y);
    if (d <= reach && (!best || c.r < best.r)) best = { id, r: c.r };
  }
  if (best) return best.id;

  // 소행성 띠: 궤도면(y = 0)과 만나는 점이 띠 안이면 소행성
  const ndc = new THREE.Vector2(px / rect.width * 2 - 1, -(py / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (hit && map.isShown('asteroids')) {
    const r = Math.hypot(hit.x, hit.z);
    if (r >= ASTEROID_BELT.inner - 1 && r <= ASTEROID_BELT.outer + 1) return 'asteroids';
  }
  return null;
}
