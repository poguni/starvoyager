import { describe, expect, it } from 'vitest';
import { SURFACE, PLANETS, canLand } from './world.js';
import { createLandingLog } from './landingLog.js';
import { landingPlan, stepAt } from './landingPlan.js';

describe('표면 상태 (기획서 4-3)', () => {
  it('수성·금성·지구·화성은 단단한 땅, 목성·토성·천왕성·해왕성은 기체다', () => {
    const solid = PLANETS.filter((p) => SURFACE[p.id] === 'solid').map((p) => p.name);
    const gas = PLANETS.filter((p) => SURFACE[p.id] === 'gas').map((p) => p.name);
    expect(solid).toEqual(['수성', '금성', '지구', '화성']);
    expect(gas).toEqual(['목성', '토성', '천왕성', '해왕성']);
  });

  it('행성 8개에는 착륙을 시도할 수 있고, 태양·달에는 없다', () => {
    expect(PLANETS.every((p) => canLand(p.id))).toBe(true);
    expect(canLand('sun')).toBe(false);
    expect(canLand('moon')).toBe(false);
  });
});

describe('착륙 시도 기록', () => {
  it('착륙을 시도한 행성이 기록된다', () => {
    const log = createLandingLog();
    expect(log.hasTried('mars')).toBe(false);
    expect(log.record('mars')).toBe(true);
    expect(log.record('mars')).toBe(false);
    expect(log.hasTried('mars')).toBe(true);
    expect(log.list()).toEqual(['mars']);
  });

  it('구독하면 기록이 바뀔 때마다 받는다', () => {
    const log = createLandingLog(['earth']);
    const seen = [];
    log.subscribe((list) => seen.push(list));
    log.record('jupiter');
    expect(seen).toEqual([['earth'], ['earth', 'jupiter']]);
  });
});

describe('착륙 시간표 (motion.md)', () => {
  it('단단한 땅은 약 6초 내려가 착륙 배너를 2초 보여 준다', () => {
    const plan = landingPlan('solid', 'mars');
    expect(plan.steps.find((s) => s.name === 'descend').end).toBe(6);
    const banner = plan.steps.find((s) => s.name === 'banner');
    expect(banner.end - banner.start).toBe(2);
    expect(plan.clouds).toBeNull();
  });

  it('금성은 내려가는 중간 2초 동안 구름을 지난다', () => {
    const plan = landingPlan('solid', 'venus');
    const d = plan.steps.find((s) => s.name === 'descend');
    expect(plan.clouds.end - plan.clouds.start).toBeCloseTo(2, 6);
    expect(plan.clouds.start).toBeGreaterThan(d.start);
    expect(plan.clouds.end).toBeLessThan(d.end);
  });

  it('기체는 약 8초 내려가고, 멈칫한 뒤 3초 동안 자동으로 올라온다', () => {
    const plan = landingPlan('gas', 'jupiter');
    expect(plan.steps.find((s) => s.name === 'descend').end).toBe(8);
    const up = plan.steps.find((s) => s.name === 'ascend');
    expect(up.end - up.start).toBe(3);
    expect(plan.steps.at(-1).name).toBe('ascend');
  });

  it('한 번의 연출은 12초를 넘지 않는다', () => {
    for (const p of PLANETS) expect(landingPlan(SURFACE[p.id], p.id).total, p.name).toBeLessThanOrEqual(12);
  });

  it('시각에 따라 단계를 알려 준다', () => {
    const plan = landingPlan('gas', 'neptune');
    expect(stepAt(plan, 0.5).name).toBe('approach');
    expect(stepAt(plan, 3).name).toBe('descend');
    expect(stepAt(plan, 8.3).name).toBe('hold');
    expect(stepAt(plan, 10).name).toBe('ascend');
    expect(stepAt(plan, 20).name).toBe('done');
  });
});
