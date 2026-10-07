// 별 위치 계산(기획서 12장): 관측 위치 서울, 날짜 + 한국 시간 → 항성시 → 각 별의 고도·방위.
// 좌표는 J2000 적경·적위를 그대로 쓴다(세차·대기 굴절은 무시: 화면에서 보이지 않을 만큼 작음).
export const SEOUL = { lat: 37.5, lon: 127 };
const RAD = Math.PI / 180;

// date: 'YYYY-MM-DD', hour: 한국 시간(18~30, 24 이상은 다음 날 새벽) → UTC 밀리초
export function koreaTimeToUtc(date, hour) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0) + (hour - 9) * 3600000;
}

// 그리니치 평균 항성시(도)
export function gmstDegrees(utcMs) {
  const jd = utcMs / 86400000 + 2440587.5;
  const g = 280.46061837 + 360.98564736629 * (jd - 2451545);
  return ((g % 360) + 360) % 360;
}

export const localSiderealDegrees = (utcMs, lon = SEOUL.lon) => (gmstDegrees(utcMs) + lon) % 360;

// 적경·적위(도) → 고도·방위(도). 방위는 북쪽 0°, 동쪽 90°(동쪽이 +), 서쪽은 -90°로 -180~180.
export function altAz(raDeg, decDeg, lstDeg, latDeg = SEOUL.lat) {
  const h = (lstDeg - raDeg) * RAD;
  const dec = decDeg * RAD;
  const lat = latDeg * RAD;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(h);
  const x = -Math.sin(h) * Math.cos(dec);
  const y = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(h);
  return { alt: Math.asin(sinAlt) / RAD, az: Math.atan2(x, y) / RAD };
}

// stars: [[번호, 적경, 적위, 등급, 색 지수], …] → 번호별 { alt, az, mag, bv, up }
export function skyPositions(stars, date, hour) {
  const lst = localSiderealDegrees(koreaTimeToUtc(date, hour));
  const out = new Map();
  for (const [hr, ra, dec, mag, bv] of stars) {
    const p = altAz(ra, dec, lst);
    out.set(hr, { ...p, mag, bv, up: p.alt > 0 });
  }
  return out;
}

// 지평선 위의 별만
export const aboveHorizon = (positions) => [...positions].filter(([, p]) => p.up).map(([hr]) => hr);

// 입체 사영(stereographic): 바라보는 방향(alt0, az0)을 가운데로, 모양이 일그러지지 않게 평면에 옮긴다.
// 돌려주는 x는 오른쪽(동쪽)이 +, y는 위쪽이 +. 단위는 '가운데에서 90° = 2'.
export function stereographic(alt, az, alt0, az0) {
  const a = alt * RAD;
  const a0 = alt0 * RAD;
  const dz = (az - az0) * RAD;
  const cosc = Math.sin(a0) * Math.sin(a) + Math.cos(a0) * Math.cos(a) * Math.cos(dz);
  const k = 2 / (1 + cosc);
  return {
    x: k * Math.cos(a) * Math.sin(dz),
    y: k * (Math.cos(a0) * Math.sin(a) - Math.sin(a0) * Math.cos(a) * Math.cos(dz)),
    front: cosc > -0.9 // 바라보는 방향의 거의 반대쪽은 그리지 않는다
  };
}
