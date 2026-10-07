import { describe, expect, it } from 'vitest';
import { altAz, gmstDegrees, koreaTimeToUtc, skyPositions, aboveHorizon, stereographic, localSiderealDegrees } from './astro.js';
import stars from '../data/stars.json';
import { CONSTELLATIONS, POLARIS } from '../data/constellations.js';
import { SKY_DATE } from '../data/skyDate.js';
import { timeLabel, clampTime } from './skyTime.js';

const DATE = '2026-02-10';
const angle = (a, b) => {
  // 두 (alt, az) 사이 각거리(도)
  const r = Math.PI / 180;
  const c = Math.sin(a.alt * r) * Math.sin(b.alt * r) + Math.cos(a.alt * r) * Math.cos(b.alt * r) * Math.cos((a.az - b.az) * r);
  return Math.acos(Math.min(1, c)) / r;
};

describe('항성시', () => {
  it('J2000 기준 시각(2000-01-01 12:00 UT)의 그리니치 항성시는 약 280.46°', () => {
    expect(gmstDegrees(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(280.46, 2);
  });

  it('한국 시간 저녁 8시는 같은 날 11시(UTC)', () => {
    expect(new Date(koreaTimeToUtc('2026-02-10', 20)).toISOString()).toBe('2026-02-10T11:00:00.000Z');
    expect(new Date(koreaTimeToUtc('2026-02-10', 26)).toISOString()).toBe('2026-02-10T17:00:00.000Z'); // 새벽 2시
  });

  it('하루(태양시 24시간)에 항성시는 약 361° 돈다', () => {
    const a = localSiderealDegrees(koreaTimeToUtc(DATE, 20));
    const b = localSiderealDegrees(koreaTimeToUtc(DATE, 44));
    expect((b - a + 360) % 360).toBeCloseTo(0.9856, 2);
  });
});

describe('고도·방위', () => {
  it('천정에 있는 별은 고도 90°, 북극 쪽 별은 방위 0° 근처', () => {
    expect(altAz(100, 37.5, 100).alt).toBeCloseTo(90, 5);
    const p = altAz(0, 80, 180);
    expect(Math.abs(p.az)).toBeLessThan(0.001);
  });

  it('동쪽 지평선에서 뜨는 적도 위 별은 방위 +90°', () => {
    const p = altAz(90, 0, 0); // 시간각 -6시
    expect(p.alt).toBeCloseTo(0, 5);
    expect(p.az).toBeCloseTo(90, 5);
  });

  it('서울에서 북극성의 고도는 약 37.5°(±1.5°)이고 북쪽에 있다', () => {
    for (const hour of [18, 20, 24, 30]) {
      const p = skyPositions(stars, DATE, hour).get(POLARIS);
      expect(Math.abs(p.alt - 37.5)).toBeLessThan(1.5);
      expect(Math.abs(p.az)).toBeLessThan(2);
    }
  });

  it('저녁 6시~아침 6시 사이 북극성은 거의 움직이지 않고 북두칠성 별은 크게 움직인다', () => {
    const a = skyPositions(stars, DATE, 18);
    const b = skyPositions(stars, DATE, 30);
    expect(angle(a.get(POLARIS), b.get(POLARIS))).toBeLessThan(2);
    const dipper = CONSTELLATIONS.find((c) => c.id === 'dipper');
    for (const hr of dipper.stars) expect(angle(a.get(hr), b.get(hr)), String(hr)).toBeGreaterThan(30);
  });

  it('지평선 아래 별을 걸러 낸다', () => {
    const pos = skyPositions(stars, DATE, 20);
    const up = aboveHorizon(pos);
    expect(up.length).toBeGreaterThan(200);
    expect(up.length).toBeLessThan(stars.length);
    expect(up.every((hr) => pos.get(hr).alt > 0)).toBe(true);
    expect(up).toContain(POLARIS);
  });
});

describe('시각 표기', () => {
  it('저녁 6시 ~ 아침 6시를 쉬운 말로 쓴다', () => {
    expect([18, 20, 20.5, 21, 23.5, 24, 24.5, 25, 28, 29, 30].map(timeLabel)).toEqual([
      '저녁 6시', '저녁 8시', '저녁 8시 30분', '밤 9시', '밤 11시 30분', '밤 12시', '밤 12시 30분',
      '새벽 1시', '새벽 4시', '아침 5시', '아침 6시'
    ]);
  });

  it('범위 밖이나 30분 단위가 아닌 값은 가까운 값으로 맞춘다', () => {
    expect(clampTime(40)).toBe(30);
    expect(clampTime(12)).toBe(18);
    expect(clampTime(21.2)).toBe(21);
  });
});

describe('고정 날짜(17장 2번)', () => {
  it('저녁 8시에 북두칠성은 북동, 카시오페이아자리는 북서에 비슷한 높이로 있다', () => {
    const pos = skyPositions(stars, SKY_DATE, 20);
    const mean = (c, k) => c.stars.reduce((s, hr) => s + pos.get(hr)[k], 0) / c.stars.length;
    const [dipper, cas] = CONSTELLATIONS;
    expect(mean(dipper, 'az')).toBeGreaterThan(20);
    expect(mean(cas, 'az')).toBeLessThan(-20);
    expect(Math.abs(mean(dipper, 'alt') - mean(cas, 'alt'))).toBeLessThan(5);
  });

  it('저녁 6시 ~ 아침 6시 내내 세 별자리의 모든 별이 지평선 위에 있다', () => {
    for (let hour = 18; hour <= 30; hour += 0.5) {
      const pos = skyPositions(stars, SKY_DATE, hour);
      for (const c of CONSTELLATIONS) for (const hr of c.stars) expect(pos.get(hr).alt, `${hour}시 ${hr}`).toBeGreaterThan(0);
    }
  });
});

describe('입체 사영', () => {
  it('바라보는 방향은 가운데(0, 0), 동쪽은 오른쪽, 위쪽은 +y', () => {
    expect(stereographic(30, 0, 30, 0)).toMatchObject({ x: 0, y: 0 });
    expect(stereographic(30, 20, 30, 0).x).toBeGreaterThan(0);
    expect(stereographic(50, 0, 30, 0).y).toBeGreaterThan(0);
  });
});
