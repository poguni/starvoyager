// ?debug=fps일 때 화면 구석에 프레임률과 렌더링 부하(Three.js renderer.info)를 보여 준다(기획서 12장 성능).
export function createFpsMeter({ container, renderer }) {
  let frames = 0;
  let elapsed = 0;

  return {
    // dt: 이전 프레임과의 간격(초)
    tick(dt) {
      frames++;
      elapsed += dt;
      if (elapsed < 0.5) return; // 너무 자주 갱신하면 숫자가 어지러워 0.5초마다 표시한다

      const fps = Math.round(frames / elapsed);
      const info = renderer.info;
      container.textContent =
        `FPS ${fps} · draw ${info.render.calls} · tri ${info.render.triangles.toLocaleString()}`;
      frames = 0;
      elapsed = 0;
    }
  };
}
