import { beforeEach, describe, expect, it } from 'vitest';
import { createMissionProgress, clearMissionProgress, PROGRESS_KEY } from './missionProgress.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('탐사 진행 상태(기획서 10-5)', () => {
  beforeEach(() => { globalThis.localStorage = memoryStorage(); });

  it('끝낸 탐사에 다시 들어와 첫 단계에만 머무는 동안은 완료로 남고, 앞으로 나아가면 진행 중이 된다', () => {
    const p = createMissionProgress([2], { persist: false });
    p.record(2, { resumeIndex: 9, done: true });
    p.record(2, { resumeIndex: 0, done: false });
    expect(p.get(2).status).toBe('done');
    p.record(2, { resumeIndex: 1, done: false });
    expect(p.get(2)).toMatchObject({ status: 'doing', from: 1 });
  });

  it('처음에는 모두 시작 전, 처음부터', () => {
    const p = createMissionProgress([1, 2]);
    expect(p.get(1)).toEqual({ status: 'todo', from: 0, days: [] });
    expect(p.startOf(1)).toEqual({ from: 0, pressedDays: [] });
  });

  it('진행 중이면 저장한 단계부터 이어서, 다음에 열어도(다음 차시) 그대로', () => {
    createMissionProgress([1, 2]).record(1, { resumeIndex: 4, done: false, days: ['mon'] });
    const again = createMissionProgress([1, 2]);
    expect(again.get(1).status).toBe('doing');
    expect(again.startOf(1)).toEqual({ from: 4, pressedDays: ['mon'] });
  });

  it('완료한 탐사는 완료로 남고, 다시 열면 처음부터', () => {
    const p = createMissionProgress([3]);
    p.record(3, { resumeIndex: 9, done: true });
    expect(p.get(3).status).toBe('done');
    expect(p.startOf(3)).toEqual({ from: 0, pressedDays: [] });
  });

  it('저장된 값이 이상하면 시작 전으로', () => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ 1: { status: 'zzz' }, 2: { status: 'doing', from: -3 } }));
    const p = createMissionProgress([1, 2]);
    expect(p.get(1).status).toBe('todo');
    expect(p.get(2)).toEqual({ status: 'doing', from: 0, days: [] });
  });

  it('시연 모드(persist=false)는 저장하지 않는다', () => {
    createMissionProgress([1], { persist: false }).record(1, { resumeIndex: 2, done: false });
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('지우기', () => {
    createMissionProgress([1]).record(1, { resumeIndex: 2, done: false });
    clearMissionProgress();
    expect(createMissionProgress([1]).get(1).status).toBe('todo');
  });
});
