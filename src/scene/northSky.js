// 북쪽 밤하늘 장면(기획서 5-3 ⑤, S08). 서울에서 북쪽을 바라본 하늘을 2D 캔버스에 입체 사영으로 그린다
// (docs/결정기록.md 2026-10-08: 넓은 시야에서도 국자·W 자 모양이 일그러지지 않게).
// 별은 밝기에 따라 크기·빛무리가 다르고, 실제 별 색이 아주 약하게 들어간다. 은하수는 은하면을 따라 흩어진 희미한 점.
// 주변 불빛을 켜면 1초 동안 지평선이 주황빛으로 밝아지며 어두운 별부터 사라진다.
// 별자리 별(별 잇기)은 화면 요소(DOM)로 그리므로 여기서는 건너뛴다(skip).
import { skyPositions, stereographic, altAz, localSiderealDegrees, koreaTimeToUtc } from '../model/astro.js';

// 그림의 색(화면 요소가 아니라 하늘 그림이라 tokens.css가 아닌 여기에 둔다)
const SKY_TOP = [7, 11, 31];
const SKY_LOW = [22, 28, 62];
const GROUND = [5, 7, 15];
const CITY = [255, 150, 70];
const SKY_GLOW = [124, 140, 248];

const VIEW_ALT = 25;           // 바라보는 고도(가운데)
const HORIZON_AT = 0.84;       // 북쪽 지평선이 화면 높이의 84%에 오게
const ZOOM = 0.72;             // 넓게 본다: 새벽에 높이 올라간 북두칠성(고도 약 75°)과 선화까지 화면 안에
const LIMIT_DARK = 4.5;        // 보이는 가장 어두운 등급(불빛 없음)
const LIMIT_CITY = 2.3;        // 주변 불빛을 켰을 때
const LIGHT_SECONDS = 1;
const MILKY_POINTS = 7000;
const RAD = Math.PI / 180;

// 은하 좌표 → 적도 좌표(J2000) 회전
const G2E = [
  [-0.0548755604, 0.4941094279, -0.8676661490],
  [-0.8734370902, -0.4448296300, -0.1980763734],
  [-0.4838350155, 0.7469822445, 0.4559837762]
];

function gaussian() {
  let u = 0;
  for (let i = 0; i < 6; i++) u += Math.random();
  return u - 3;
}

// 은하수 점: [적경, 적위, 밝기]
export function milkyWayPoints() {
  const pts = [];
  for (let i = 0; i < MILKY_POINTS; i++) {
    const l = Math.random() * 360;
    const b = gaussian() * 5 * (0.6 + Math.random());
    const g = [Math.cos(b * RAD) * Math.cos(l * RAD), Math.cos(b * RAD) * Math.sin(l * RAD), Math.sin(b * RAD)];
    const e = G2E.map((row) => row[0] * g[0] + row[1] * g[1] + row[2] * g[2]);
    const ra = (Math.atan2(e[1], e[0]) / RAD + 360) % 360;
    const dec = Math.asin(e[2]) / RAD;
    // 은하 중심(l=0) 쪽이 밝고 반대쪽(l=180)은 희미하다
    const w = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(l * RAD));
    pts.push([ra, dec, w * (0.4 + Math.random() * 0.6)]);
  }
  return pts;
}

// 색 지수(B-V) → 아주 옅은 별 색
export function starColor(bv) {
  const t = Math.max(-0.3, Math.min(1.6, bv));
  const r = t < 0.4 ? 200 + (t + 0.3) * 79 : 255;
  const g = t < 0.4 ? 215 + (t + 0.3) * 50 : 250 - (t - 0.4) * 45;
  const b = t < 0 ? 255 : 255 - t * 70;
  const mix = (c) => Math.round(c * 0.45 + 255 * 0.55); // 흰빛 쪽으로 섞어 은은하게
  return [mix(r), mix(g), mix(b)];
}

const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

// date: 고정 날짜(SKY_DATE), stars: stars.json, skip: 캔버스에서 그리지 않을 별 번호
export function createNorthSky(container, { date, stars, skip = new Set() }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sv-canvas sv-sky-canvas';
  container.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const milky = milkyWayPoints();
  const milkyCanvas = document.createElement('canvas');
  const phase = new Map(stars.map(([hr]) => [hr, Math.random() * Math.PI * 2]));
  const colors = new Map(stars.map(([hr, , , , bv]) => [hr, starColor(bv)]));

  let w = 1;
  let h = 1;
  let dpr = 1;
  let scale = 1;
  let shiftY = 0; // 넓게 볼 때도 지평선이 같은 높이에 오도록 내린다
  let view = { offsetX: 0, zoom: 1 }; // 미션 패널이 오른쪽을 가릴 때 하늘을 왼쪽으로 옮기고 조금 작게
  let hour = 20;
  let positions = skyPositions(stars, date, hour);
  let light = 0; // 0 어두운 하늘 → 1 주변 불빛
  let lightTarget = 0;
  let milkyDirty = true;

  // 고도·방위 → 화면 좌표(px)
  function toScreen(alt, az) {
    const q = stereographic(alt, az, VIEW_ALT, 0);
    return { x: w / 2 + view.offsetX + q.x * scale, y: h / 2 + shiftY - q.y * scale, front: q.front };
  }

  const limitMag = () => LIMIT_DARK + (LIMIT_CITY - LIMIT_DARK) * light;
  // 등급이 보이는 한계에 가까울수록 흐려지고, 지평선 가까이에서도 조금 흐려진다.
  function starAlpha(mag, alt) {
    const vis = Math.max(0, Math.min(1, (limitMag() - mag) / 0.5 + 0.35));
    const low = alt < 12 ? 0.45 + 0.55 * (alt / 12) : 1;
    return vis * low;
  }
  const starRadius = (mag) => Math.max(0.7, Math.min(6.5, 0.6 + (4.6 - mag) * 1.6));

  function horizonPath() {
    const pts = [];
    for (let az = -100; az <= 100; az += 2) pts.push(toScreen(0, az));
    return pts.filter((p) => p.front);
  }

  function drawMilkyWay() {
    milkyCanvas.width = Math.ceil(w / 4);
    milkyCanvas.height = Math.ceil(h / 4);
    const m = milkyCanvas.getContext('2d');
    m.clearRect(0, 0, milkyCanvas.width, milkyCanvas.height);
    const lst = localSiderealDegrees(koreaTimeToUtc(date, hour));
    for (const [ra, dec, k] of milky) {
      const p = altAz(ra, dec, lst);
      if (p.alt < 0) continue;
      const s = toScreen(p.alt, p.az);
      if (!s.front) continue;
      m.fillStyle = `rgba(200,210,255,${0.5 * k})`;
      m.fillRect(s.x / 4, s.y / 4, 1, 1);
    }
    milkyDirty = false;
  }

  function draw(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const horizon = horizonPath();
    const north = toScreen(0, 0);
    // 하늘: 위는 짙은 남색, 지평선 쪽은 조금 밝게. 불빛을 켜면 지평선이 주황빛으로
    const sky = ctx.createLinearGradient(0, 0, 0, north.y);
    sky.addColorStop(0, rgba(SKY_TOP, 1));
    sky.addColorStop(1, rgba(SKY_LOW.map((c, i) => c + (CITY[i] * 0.55 - c) * light * 0.6), 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // 지평선 쪽 은은한 보라빛(S08), 불빛을 켜면 주황빛 도시 불빛
    for (const [color, alpha] of [[SKY_GLOW, 0.16 * (1 - light)], [CITY, 0.5 * light]]) {
      if (alpha <= 0) continue;
      const glow = ctx.createRadialGradient(north.x, north.y + h * 0.15, 0, north.x, north.y + h * 0.15, h * 0.8);
      glow.addColorStop(0, rgba(color, alpha));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    // 은하수
    if (milkyDirty) drawMilkyWay();
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - light);
    ctx.filter = 'blur(6px)';
    ctx.drawImage(milkyCanvas, 0, 0, w, h);
    ctx.filter = 'blur(1.5px)';
    ctx.globalAlpha = 0.35 * (1 - light);
    ctx.drawImage(milkyCanvas, 0, 0, w, h);
    ctx.restore();

    // 별
    for (const [hr, p] of positions) {
      if (!p.up || skip.has(hr)) continue;
      const a0 = starAlpha(p.mag, p.alt);
      if (a0 <= 0.01) continue;
      const s = toScreen(p.alt, p.az);
      if (!s.front || s.x < -10 || s.x > w + 10 || s.y < -10 || s.y > north.y + 40) continue;
      const r = starRadius(p.mag);
      const twinkle = p.mag > 1.5 ? 1 - 0.18 * (0.5 + 0.5 * Math.sin(time * 2.3 + phase.get(hr))) : 1;
      const a = a0 * twinkle;
      const c = colors.get(hr);
      if (r > 2.5) {
        const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3.2);
        halo.addColorStop(0, rgba(c, 0.35 * a));
        halo.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(s.x - r * 3.2, s.y - r * 3.2, r * 6.4, r * 6.4);
      }
      ctx.fillStyle = rgba(c, a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 땅: 지평선 곡선 아래를 어둡게(낮은 언덕 실루엣)
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const [i, p] of horizon.entries()) {
      const hill = Math.sin(i * 0.37) * 3 + Math.sin(i * 0.11 + 1) * 6;
      ctx.lineTo(p.x, p.y - Math.max(0, hill));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const ground = ctx.createLinearGradient(0, north.y - 60, 0, h);
    ground.addColorStop(0, rgba(GROUND.map((c, i) => c + (CITY[i] * 0.12 - c) * light), 1));
    ground.addColorStop(1, rgba(GROUND, 1));
    ctx.fillStyle = ground;
    ctx.fill();
  }

  return {
    canvas,
    resize(width, height) {
      w = width;
      h = height;
      dpr = Math.min(devicePixelRatio, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const horizonY = Math.abs(stereographic(0, 0, VIEW_ALT, 0).y);
      scale = ((h * HORIZON_AT - h / 2) / horizonY) * ZOOM * view.zoom;
      shiftY = h * HORIZON_AT - h / 2 - horizonY * scale;
      milkyDirty = true;
    },
    // offsetX: 하늘 가운데(북쪽)를 옮길 거리(px), zoom: 크기 비율. 지평선 높이는 그대로 둔다. 다음 resize부터 쓴다.
    setView(next) { view = { offsetX: 0, zoom: 1, ...next }; },
    // 한국 시간(18~30)
    setTime(next) {
      hour = next;
      positions = skyPositions(stars, date, hour);
      milkyDirty = true;
    },
    setLights(on) { lightTarget = on ? 1 : 0; },
    update(dt, time) {
      if (light !== lightTarget) {
        const step = dt / LIGHT_SECONDS;
        light = light < lightTarget ? Math.min(lightTarget, light + step) : Math.max(lightTarget, light - step);
      }
      draw(time);
    },
    // 별 번호 → 화면 좌표와 보이는 정도(별 잇기 화면 요소가 쓴다)
    starOnScreen(hr) {
      const p = positions.get(hr);
      const s = toScreen(p.alt, p.az);
      return { x: s.x, y: s.y, up: p.up && s.front, alpha: p.up ? starAlpha(p.mag, p.alt) : 0, radius: starRadius(p.mag) };
    },
    // 방위 표시 자리(지평선 위): 북서·북·북동
    compass: () => [[-45, '북서'], [0, '북'], [45, '북동']].map(([az, label]) => ({ label, ...toScreen(0, az) })),
    visibleCount() {
      let n = 0;
      for (const [, p] of positions) if (p.up && starAlpha(p.mag, p.alt) > 0.2) n += 1;
      return n;
    }
  };
}
