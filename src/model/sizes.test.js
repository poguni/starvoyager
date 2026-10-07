import { describe, expect, it } from 'vitest';
import { SIZE_ORDER, SMALLER_THAN_EARTH, LARGER_THAN_EARTH, timesLabel, easyTimes, sizeOf } from './sizes.js';
import { judgeOrder, judgeGroups, orderText, groupsText, createArrangeTask } from './arrange.js';
import { bodyById } from './world.js';
import { sizeLayout } from './sizeLayout.js';

const names = (ids) => ids.map((id) => bodyById(id).name);

describe('크기 비(15장)', () => {
  it('크기 순서가 기획서 4-3과 같다', () => {
    expect(names(SIZE_ORDER)).toEqual(['목성', '토성', '천왕성', '해왕성', '지구', '금성', '화성', '수성']);
  });

  it('지구보다 작은 행성은 금성·화성·수성, 큰 행성은 목성·토성·천왕성·해왕성', () => {
    expect(names(SMALLER_THAN_EARTH)).toEqual(['금성', '화성', '수성']);
    expect(names(LARGER_THAN_EARTH)).toEqual(['목성', '토성', '천왕성', '해왕성']);
  });

  it('15장 값 그대로다', () => {
    expect([sizeOf('sun'), sizeOf('mercury'), sizeOf('venus'), sizeOf('mars'), sizeOf('jupiter'), sizeOf('saturn'), sizeOf('uranus'), sizeOf('neptune')])
      .toEqual([109, 0.38, 0.95, 0.53, 11.2, 9.4, 4.0, 3.9]);
  });

  it('"약 ○배"는 쉬운 수로 쓴다(S07과 같은 값)', () => {
    const labels = Object.fromEntries(SIZE_ORDER.map((id) => [id, timesLabel(id)]));
    expect(labels).toEqual({
      jupiter: '약 11배', saturn: '약 9배', uranus: '약 4배', neptune: '약 4배',
      earth: '기준', venus: '약 1배', mars: '약 0.5배', mercury: '약 0.4배'
    });
    expect(easyTimes(109)).toBe('109');
  });
});

describe('행성 줄 배치', () => {
  const region = { left: 40, right: 1880, top: 130, bottom: 470 }; // S07 위쪽 영역
  const byId = (layout) => Object.fromEntries(layout.items.map((it) => [it.id, it]));

  it('실제 크기로 보면 목성이 가장 크고 수성이 가장 작으며, 지구와 금성은 거의 같다', () => {
    const p = byId(sizeLayout({ region, real: 1 }));
    const rs = Object.values(p).map((it) => it.r);
    expect(p.jupiter.r).toBe(Math.max(...rs));
    expect(p.mercury.r).toBe(Math.min(...rs));
    expect(p.venus.r / p.earth.r).toBeCloseTo(0.95, 5);
    expect(p.jupiter.r / p.earth.r).toBeCloseTo(11.2, 5);
  });

  it('같은 크기로 보면 모두 같고, 줄이 영역 안에 들어간다', () => {
    const l = sizeLayout({ region, real: 0 });
    expect(new Set(l.items.map((it) => it.r.toFixed(6))).size).toBe(1);
    for (const real of [0, 0.5, 1]) {
      for (const it of sizeLayout({ region, real }).items) {
        expect(it.x - it.r).toBeGreaterThanOrEqual(region.left - 1);
        expect(it.x + it.r).toBeLessThanOrEqual(region.right + 1);
        expect(it.y - it.r).toBeGreaterThanOrEqual(region.top - 1);
      }
    }
  });

  it('행성은 태양에서 가까운 순서로 왼쪽부터 놓인다', () => {
    const xs = sizeLayout({ region, real: 1 }).items.map((it) => it.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('태양과 비교하면 태양이 지구의 109배로 왼쪽 가장자리에 들어오고, 행성은 그 오른쪽에 있다', () => {
    const l = sizeLayout({ region, real: 1, sun: 1 });
    expect(l.sun.r / l.earthRadius).toBeCloseTo(109, 5);
    expect(l.sun.edge).toBeGreaterThan(region.left);
    expect(l.sun.x).toBeLessThan(region.left); // 가운데는 화면 밖: 가장자리만 보인다
    const first = l.items[0];
    expect(first.x - Math.max(first.r, 42)).toBeGreaterThan(l.sun.edge);
    expect(sizeLayout({ region, real: 1, sun: 0 }).sun.edge).toBeLessThan(region.left);
  });

  it('크롬북 크기(1366×768)에서 태양과 비교해도 행성이 충분히 크게 보인다', () => {
    const cb = { left: 20, right: 1346, top: 92, bottom: 642 };
    const l = sizeLayout({ region: cb, real: 1, sun: 1 });
    const jupiter = l.items.find((it) => it.id === 'jupiter');
    expect(jupiter.r * 2).toBeGreaterThan(60);
    const last = l.items.at(-1);
    expect(last.x + Math.max(last.r, 42)).toBeLessThanOrEqual(cb.right + 1);
    expect(l.items[0].x - 42).toBeGreaterThan(l.sun.edge);
  });
});

describe('줄 세우기 판정', () => {
  it('정답 순서면 맞고, 틀린 자리 번호를 알려 준다', () => {
    expect(judgeOrder(SIZE_ORDER)).toEqual({ correct: true, wrong: [] });
    const swapped = ['jupiter', 'saturn', 'neptune', 'uranus', 'earth', 'venus', 'mars', 'mercury'];
    expect(judgeOrder(swapped)).toEqual({ correct: false, wrong: [2, 3] });
    expect(judgeOrder([...SIZE_ORDER.slice(0, 7), null]).wrong).toEqual([7]);
  });

  it('기록 글자는 목성>토성>… 형식이다', () => {
    expect(orderText(['jupiter', 'saturn', 'neptune', 'uranus', 'earth', 'venus', 'mars', 'mercury']))
      .toBe('목성>토성>해왕성>천왕성>지구>금성>화성>수성');
  });
});

describe('나누어 담기 판정', () => {
  it('정답이면 맞고, 잘못 담긴 행성을 알려 준다', () => {
    expect(judgeGroups({ small: SMALLER_THAN_EARTH, large: LARGER_THAN_EARTH }).correct).toBe(true);
    const r = judgeGroups({ small: ['venus', 'mars', 'mercury', 'neptune'], large: ['jupiter', 'saturn', 'uranus'] });
    expect(r).toEqual({ correct: false, wrong: ['neptune'] });
    expect(judgeGroups({ small: ['venus'], large: [] }).wrong).toEqual(expect.arrayContaining(['mars', 'jupiter']));
  });

  it('기록 글자는 작은/큰 상자 순서다', () => {
    expect(groupsText({ small: ['venus', 'mars', 'mercury'], large: ['jupiter', 'saturn', 'uranus', 'neptune'] }))
      .toBe('작은: 금성, 화성, 수성 / 큰: 목성, 토성, 천왕성, 해왕성');
  });
});

describe('확인 흐름', () => {
  const wrongOrder = ['saturn', 'jupiter', 'uranus', 'neptune', 'earth', 'venus', 'mars', 'mercury'];

  it('다 놓기 전에는 확인할 수 없다', () => {
    const task = createArrangeTask('sort');
    expect(task.check([...SIZE_ORDER.slice(0, 7), null])).toBeNull();
  });

  it('1차에 틀리면 한 번 더, 2차도 틀리면 정답 배치로 끝난다', () => {
    const task = createArrangeTask('sort');
    const a = task.check(wrongOrder);
    expect(a).toMatchObject({ result: 'retry', wrong: [0, 1], record: null });
    const b = task.check(['jupiter', 'saturn', 'neptune', 'uranus', 'earth', 'venus', 'mars', 'mercury']);
    expect(b.result).toBe('revealed');
    expect(b.record).toEqual({
      kind: 'sort', first: '토성>목성>천왕성>해왕성>지구>금성>화성>수성',
      final: '목성>토성>해왕성>천왕성>지구>금성>화성>수성', correct: false, attempts: 2
    });
    expect(task.check(SIZE_ORDER)).toBeNull();
    expect(task.answer).toEqual(SIZE_ORDER);
  });

  it('고쳐서 맞으면 통과한다', () => {
    const task = createArrangeTask('classify');
    expect(task.check({ small: ['venus', 'mars'], large: ['mercury', 'jupiter', 'saturn', 'uranus', 'neptune'] }).result).toBe('retry');
    const r = task.check({ small: ['venus', 'mars', 'mercury'], large: ['jupiter', 'saturn', 'uranus', 'neptune'] });
    expect(r.result).toBe('correct');
    expect(r.record).toMatchObject({ first: '작은: 금성, 화성 / 큰: 수성, 목성, 토성, 천왕성, 해왕성', correct: true, attempts: 2 });
  });
});
