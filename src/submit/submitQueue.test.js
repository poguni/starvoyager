import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function fakeLocalStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
}

// 매 테스트마다 모듈을 새로 불러와 대기열(memoryQueue) 상태를 초기화한다.
async function freshModule(storage = fakeLocalStorage()) {
  vi.resetModules();
  vi.stubEnv('VITE_WEBAPP_URL', 'https://example.com/exec');
  vi.stubGlobal('localStorage', storage);
  return { mod: await import('./submitQueue.js'), storage };
}

const student = { grade: 4, cls: 3, number: 12, name: '홍길동' };
const row = {
  종류: '미션', 탐사: 1, 문항: '1-1', 처음예측: '지구', 예측정답여부: false,
  최종답: '태양', 최종정답여부: true,
  한줄정리: null, 한줄정리정답여부: null, 소요시간: 10, 메모: null
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('buildPayload', () => {
  it('미션 행을 기획서 10-3 컬럼에 맞는 payload로 바꾼다(숫자 메모는 문자열로)', async () => {
    const { mod } = await freshModule();
    const missionRow = {
      종류: '미션', 탐사: 1, 문항: '1-4', 처음예측: '9개', 예측정답여부: false,
      최종답: '8개', 최종정답여부: true,
      한줄정리: '태양 / 행성', 한줄정리정답여부: true, 소요시간: 42, 메모: 5
    };
    expect(mod.buildPayload(student, missionRow)).toEqual({
      kind: '미션', grade: 4, class: 3, number: 12, name: '홍길동',
      mission: 1, item: '1-4', predicted: '9개', predictedCorrect: false,
      finalAnswer: '8개', finalCorrect: true,
      summary: '태양 / 행성', summaryCorrect: true, seconds: 42, memo: '5'
    });
  });

  it('종류가 없는 행은 미션 행으로 본다', async () => {
    const { mod } = await freshModule();
    const { 종류, ...noKind } = row;
    expect(mod.buildPayload(student, noKind).kind).toBe('미션');
  });

  it('도감 행을 기획서 10-4 컬럼에 맞는 payload로 바꾼다(여러 개 고른 특징은 이어 쓴다)', async () => {
    const { mod } = await freshModule();
    const journalRow = {
      종류: '도감', 행성: '수성',
      색깔처음: '노란색', 색깔최종: '회색', 색깔정답: true,
      표면처음: '단단한 땅', 표면최종: '단단한 땅', 표면정답: true,
      고리처음: '고리가 없어요', 고리최종: '고리가 없어요', 고리정답: true,
      특징최종: ['충돌 구덩이가 많아요', '행성 중 가장 작아요'], 특징정답: true,
      착륙시도여부: true, 소요시간: 95
    };
    expect(mod.buildPayload(student, journalRow)).toEqual({
      kind: '도감', grade: 4, class: 3, number: 12, name: '홍길동',
      planet: '수성',
      colorFirst: '노란색', colorFinal: '회색', colorCorrect: true,
      surfaceFirst: '단단한 땅', surfaceFinal: '단단한 땅', surfaceCorrect: true,
      ringFirst: '고리가 없어요', ringFinal: '고리가 없어요', ringCorrect: true,
      featuresFinal: '충돌 구덩이가 많아요, 행성 중 가장 작아요', featuresCorrect: true,
      landingTried: true, seconds: 95
    });
  });

  it('도감 행의 특징을 하나도 고르지 않았으면 빈 칸이다', async () => {
    const { mod } = await freshModule();
    const payload = mod.buildPayload(student, { 종류: '도감', 행성: '화성', 특징최종: [], 특징정답: true });
    expect(payload.featuresFinal).toBe('');
  });
});

describe('trySubmit', () => {
  it('제출이 성공하면 대기열에 쌓이지 않는다', async () => {
    const { mod } = await freshModule();
    fetch.mockResolvedValue({ text: async () => JSON.stringify({ ok: true }) });

    const ok = await mod.trySubmit(student, row);
    expect(ok).toBe(true);
    expect(mod.queueSize()).toBe(0);
  });

  it('네트워크 오류면 대기열에 쌓인다', async () => {
    const { mod } = await freshModule();
    fetch.mockRejectedValue(new Error('network down'));

    const ok = await mod.trySubmit(student, row);
    expect(ok).toBe(false);
    expect(mod.queueSize()).toBe(1);
  });

  it('서버가 거절해도(ok:false) 대기열에 쌓인다', async () => {
    const { mod } = await freshModule();
    fetch.mockResolvedValue({ text: async () => JSON.stringify({ ok: false, error: '검증 실패' }) });

    const ok = await mod.trySubmit(student, row);
    expect(ok).toBe(false);
    expect(mod.queueSize()).toBe(1);
  });
});

describe('flushQueue', () => {
  it('대기열에 쌓인 항목을 다시 보내 성공한 것만 지운다', async () => {
    const { mod } = await freshModule();
    fetch.mockRejectedValue(new Error('network down'));
    await mod.trySubmit(student, row);
    expect(mod.queueSize()).toBe(1);

    fetch.mockResolvedValue({ text: async () => JSON.stringify({ ok: true }) });
    await mod.flushQueue();
    expect(mod.queueSize()).toBe(0);
  });

  it('다시 보내는 중에 또 불러도 같은 행을 두 번 보내지 않는다', async () => {
    const { mod } = await freshModule();
    fetch.mockRejectedValue(new Error('network down'));
    await mod.trySubmit(student, row);
    await mod.trySubmit(student, row);
    fetch.mockClear();
    fetch.mockResolvedValue({ text: async () => JSON.stringify({ ok: true }) });
    await Promise.all([mod.flushQueue(), mod.flushQueue(), mod.flushQueue()]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mod.queueSize()).toBe(0);
  });

  it('다시 보내는 동안 새로 실패한 행은 대기열에 남는다', async () => {
    const { mod } = await freshModule();
    fetch.mockRejectedValue(new Error('network down'));
    await mod.trySubmit(student, row);
    let release;
    fetch.mockImplementationOnce(() => new Promise((r) => { release = () => r({ text: async () => JSON.stringify({ ok: true }) }); }));
    const flushing = mod.flushQueue();
    fetch.mockRejectedValueOnce(new Error('network down'));
    const later = mod.trySubmit(student, { ...row, 문항: '1-2' }); // 보내는 도중 들어온 행 → 차례를 기다렸다가 실패 → 대기열
    await new Promise((r) => setTimeout(r, 0)); // 다시 보내기가 첫 행을 보내기 시작할 때까지
    release();
    await Promise.all([flushing, later]);
    expect(mod.queueSize()).toBe(1);
  });

  it('여러 행을 한꺼번에 보내도 한 번에 하나씩 차례로 보낸다', async () => {
    const { mod } = await freshModule();
    let open = 0;
    let most = 0;
    fetch.mockImplementation(async () => {
      open++; most = Math.max(most, open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      return { text: async () => JSON.stringify({ ok: true }) };
    });
    await Promise.all([1, 2, 3].map(() => mod.trySubmit(student, row)));
    expect(most).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('대기열 지속', () => {
  it('저장된 대기열은 모듈을 다시 불러와도(새로고침) 이어진다', async () => {
    const storage = fakeLocalStorage();
    const { mod: mod1 } = await freshModule(storage);
    fetch.mockRejectedValue(new Error('network down'));
    await mod1.trySubmit(student, row);
    expect(mod1.queueSize()).toBe(1);

    const { mod: mod2 } = await freshModule(storage); // 같은 storage로 모듈만 새로 불러온다
    expect(mod2.queueSize()).toBe(1);
  });
});
