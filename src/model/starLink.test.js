import { describe, expect, it } from 'vitest';
import { createStarLink } from './starLink.js';
import { CONSTELLATIONS, POLARIS } from '../data/constellations.js';

// 북두칠성: 두브헤 4301 · 메라크 4295 · 페크다 4554 · 메그레즈 4660 · 알리오트 4905 · 미자르 5054 · 알카이드 5191
const DIPPER_FROM_HANDLE = [5191, 5054, 4905, 4660, 4554, 4295, 4301, 4660];

const pressAll = (link, stars) => stars.map((hr) => link.press(hr).result);

describe('별자리 정의(15장)', () => {
  it('북두칠성 7개, 카시오페이아자리 5개, 작은곰자리 7개이고 북극성이 작은곰자리 꼬리 끝이다', () => {
    const [dipper, cas, little] = CONSTELLATIONS;
    expect([dipper.stars.length, cas.stars.length, little.stars.length]).toEqual([7, 5, 7]);
    // 꼬리 끝: 선 하나에만 이어진 별
    const ends = little.stars.filter((hr) => little.lines.filter((l) => l.includes(hr)).length === 1);
    expect(ends).toEqual([POLARIS]);
  });
});

describe('별 잇기', () => {
  it('손잡이 끝에서 시작해 북두칠성을 완성한다', () => {
    const link = createStarLink(CONSTELLATIONS);
    const results = pressAll(link, DIPPER_FROM_HANDLE);
    expect(results[0]).toBe('start');
    expect(results.slice(1, -1).every((r) => r === 'line')).toBe(true);
    expect(results.at(-1)).toBe('complete');
    expect(link.getState()).toMatchObject({ completed: ['dipper'], count: 1, total: 3 });
  });

  it('반대쪽 끝(메그레즈)에서 시작해도 완성된다', () => {
    const link = createStarLink(CONSTELLATIONS);
    expect(pressAll(link, [...DIPPER_FROM_HANDLE].reverse()).at(-1)).toBe('complete');
  });

  it('W 자 카시오페이아자리는 어느 끝에서 시작해도 된다', () => {
    expect(pressAll(createStarLink(CONSTELLATIONS), [21, 168, 264, 403, 542]).at(-1)).toBe('complete');
    expect(pressAll(createStarLink(CONSTELLATIONS), [542, 403, 264, 168, 21]).at(-1)).toBe('complete');
  });

  it('이어지지 않는 별을 누르면 wrong이고 선이 생기지 않는다', () => {
    const link = createStarLink(CONSTELLATIONS);
    link.press(5191);
    expect(link.press(4301).result).toBe('wrong');
    expect(link.linesOf('dipper')).toEqual([]);
    expect(link.current()).toEqual({ c: 'dipper', star: 5191 });
  });

  it('다른 별자리의 별을 누르면 흔들지 않고 그 별자리를 새로 시작한다', () => {
    const link = createStarLink(CONSTELLATIONS);
    pressAll(link, [5191, 5054]);
    expect(link.press(21).result).toBe('start');
    expect(link.press(168).result).toBe('line');
    expect(link.linesOf('dipper')).toHaveLength(1); // 이어 둔 선은 남는다
    // 다시 북두칠성: 남은 선의 끝(미자르)에서 이어 갈 수 있다
    expect(link.press(5054).result).toBe('start');
    expect(link.press(4905).result).toBe('line');
  });

  it('더 갈 선이 없는 별에서는 남은 선의 다른 별에서 다시 시작할 수 있다', () => {
    const link = createStarLink(CONSTELLATIONS);
    pressAll(link, [4301, 4660, 4905, 5054, 5191]); // 두브헤에서 시작해 손잡이 끝에 막힘
    expect(link.press(4295).result).toBe('start');
    expect(pressAll(link, [4554, 4660]).at(-1)).toBe('line');
    // 메그레즈에서 더 갈 선이 없으니, 남은 선(두브헤-메라크)의 두브헤에서 다시 시작해 마친다
    expect(link.press(4301).result).toBe('start');
    expect(link.press(4295).result).toBe('complete');
  });

  it('마지막 선 지우기는 선 하나를 지우고, 그 선의 시작 별부터 다시 잇는다', () => {
    const link = createStarLink(CONSTELLATIONS);
    pressAll(link, DIPPER_FROM_HANDLE);
    expect(link.isComplete('dipper')).toBe(true);
    const removed = link.undo();
    expect(removed).toEqual({ c: 'dipper', from: 4301, to: 4660 });
    expect(link.getState().count).toBe(0);
    expect(link.current()).toEqual({ c: 'dipper', star: 4301 });
    expect(link.press(4660).result).toBe('complete');
  });

  it('점선 안내는 아직 시작하지 않은 별자리에만 보인다', () => {
    const link = createStarLink(CONSTELLATIONS);
    expect(CONSTELLATIONS.every((c) => link.showsGuide(c.id))).toBe(true);
    link.press(21);
    expect(link.showsGuide('cassiopeia')).toBe(false);
    expect(link.showsGuide('dipper')).toBe(true);
  });

  it('힌트만 따라 눌러도 세 별자리를 모두 완성할 수 있다', () => {
    const link = createStarLink(CONSTELLATIONS);
    const seen = [];
    link.subscribe((s) => seen.push(s.count));
    for (let i = 0; i < 40 && link.getState().count < 3; i++) {
      const h = link.hint();
      const r = link.press(h.hr).result;
      expect(['start', 'line', 'complete'], `${h.hr}`).toContain(r);
    }
    expect(link.getState().count).toBe(3);
    expect(seen.at(-1)).toBe(3);
    expect(link.hint()).toBeNull();
  });

  it('별자리에 없는 별과 완성한 별자리의 별은 무시한다', () => {
    const link = createStarLink(CONSTELLATIONS);
    expect(link.press(9999).result).toBe('ignored');
    pressAll(link, [21, 168, 264, 403, 542]);
    expect(link.press(264).result).toBe('ignored');
  });
});
