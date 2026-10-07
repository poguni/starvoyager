import { describe, expect, it } from 'vitest';
import { BODIES, PLANETS, SUN, MOON, COMET, ASTEROID_BELT, SIZE_RATIO, bodyById } from './world.js';
import { circularPosition, cometPosition, moonPosition, distance } from './orbit.js';
import { createMemberProgress, MEMBERS } from './memberProgress.js';
import { euro, withEuro } from './josa.js';

describe('천체 목록 (기획서 15장)', () => {
  it('행성은 태양에서 가까운 순서로 8개다', () => {
    expect(PLANETS.map((p) => p.name)).toEqual(['수성', '금성', '지구', '화성', '목성', '토성', '천왕성', '해왕성']);
    expect(PLANETS.map((p) => p.id)).toEqual(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  });

  it('궤도 반지름도 태양에서 가까운 순서대로 커진다', () => {
    const radii = PLANETS.map((p) => p.orbitRadius);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
  });

  it('바깥 행성일수록 공전 주기가 길다', () => {
    for (let i = 1; i < PLANETS.length; i++) {
      expect(PLANETS[i].period, PLANETS[i].name).toBeGreaterThan(PLANETS[i - 1].period);
    }
  });

  it('표시 크기는 줄였지만 크기 순서는 실제와 같다(목성 > 토성 > 천왕성 > 해왕성 > 지구 > 금성 > 화성 > 수성)', () => {
    const bySize = [...PLANETS].sort((a, b) => b.radius - a.radius).map((p) => p.name);
    expect(bySize).toEqual(['목성', '토성', '천왕성', '해왕성', '지구', '금성', '화성', '수성']);
    expect(SUN.radius).toBeGreaterThan(Math.max(...PLANETS.map((p) => p.radius)));
    expect(SIZE_RATIO.earth).toBe(1);
  });

  it('천체끼리 겹치지 않는다(이웃 궤도 사이가 두 행성 반지름 합보다 넓다)', () => {
    expect(PLANETS[0].orbitRadius - SUN.radius).toBeGreaterThan(PLANETS[0].radius * 2);
    for (let i = 1; i < PLANETS.length; i++) {
      const gap = PLANETS[i].orbitRadius - PLANETS[i - 1].orbitRadius;
      expect(gap, PLANETS[i].name).toBeGreaterThan((PLANETS[i].radius + PLANETS[i - 1].radius) * 2);
    }
  });

  it('소행성 띠는 화성과 목성 사이에 있다', () => {
    const mars = bodyById('mars');
    const jupiter = bodyById('jupiter');
    expect(ASTEROID_BELT.inner).toBeGreaterThan(mars.orbitRadius + mars.radius);
    expect(ASTEROID_BELT.outer).toBeLessThan(jupiter.orbitRadius - jupiter.radius);
  });

  it('누를 수 있는 천체의 종류가 구성원 다섯 가지와 맞는다', () => {
    const kinds = new Set(BODIES.map((b) => b.kind));
    expect([...kinds].sort()).toEqual(MEMBERS.map((m) => m.id).sort());
  });
});

describe('궤도 위치', () => {
  it('행성 위치는 언제나 궤도 반지름 위에 있다', () => {
    for (const p of PLANETS) {
      for (const t of [0, 3.3, 17, 250]) {
        const pos = circularPosition(p, t);
        expect(distance(pos)).toBeCloseTo(p.orbitRadius, 6);
        expect(pos.y).toBe(0);
      }
    }
  });

  it('한 주기가 지나면 같은 자리로 돌아온다', () => {
    const earth = bodyById('earth');
    const a = circularPosition(earth, 5);
    const b = circularPosition(earth, 5 + earth.period);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
  });

  it('달은 지구를 중심으로 일정한 거리에서 돈다', () => {
    const earth = bodyById('earth');
    for (const t of [0, 1.5, 4, 9]) {
      const e = circularPosition(earth, t);
      const m = moonPosition(MOON, e, t);
      expect(Math.hypot(m.x - e.x, m.y - e.y, m.z - e.z)).toBeCloseTo(MOON.orbitRadius, 6);
    }
  });

  it('혜성은 타원 궤도를 돈다(가장 가까울 때 a(1−e), 가장 멀 때 a(1+e))', () => {
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < 2000; i++) {
      const d = distance(cometPosition(COMET, (i / 2000) * COMET.period));
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    expect(min).toBeCloseTo(COMET.a * (1 - COMET.e), 0);
    expect(max).toBeCloseTo(COMET.a * (1 + COMET.e), 0);
    expect(min).toBeGreaterThan(SUN.radius);
  });
});

describe('구성원 찾기', () => {
  it('다섯 가지를 모두 찾으면 5/5가 된다', () => {
    const progress = createMemberProgress();
    for (const kind of ['sun', 'planet', 'moon', 'comet', 'asteroid']) progress.find(kind);
    expect(progress.getState()).toMatchObject({ count: 5, total: 5 });
  });

  it('행성은 여러 개를 눌러도 한 번만 센다', () => {
    const progress = createMemberProgress();
    expect(progress.find('planet')).toBe(true);
    expect(progress.find('planet')).toBe(false);
    expect(progress.getState().count).toBe(1);
  });

  it('구성원이 아닌 값은 무시한다', () => {
    const progress = createMemberProgress();
    expect(progress.find('star')).toBe(false);
    expect(progress.getState().count).toBe(0);
  });

  it('구독하면 지금 상태를 바로 받고, 새로 찾을 때마다 다시 받는다', () => {
    const progress = createMemberProgress(['sun']);
    const seen = [];
    progress.subscribe((s) => seen.push(s.found));
    progress.find('comet');
    progress.find('comet');
    expect(seen).toEqual([['sun'], ['sun', 'comet']]);
  });
});

describe('조사 으로/로', () => {
  it('천체 이름에 맞는 조사를 붙인다', () => {
    expect(withEuro('화성')).toBe('화성으로');
    expect(withEuro('지구')).toBe('지구로');
    expect(withEuro('달')).toBe('달로');
    expect(withEuro('태양계 지도')).toBe('태양계 지도로');
    expect(withEuro('천왕성')).toBe('천왕성으로');
    expect(euro('혜성')).toBe('으로');
  });
});
