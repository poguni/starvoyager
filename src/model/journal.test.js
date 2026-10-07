import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJournal, PLANET_IDS } from './journal.js';
import { ANSWERS, FACTS, HINTS, FIELDS } from '../data/planetFacts.js';
import { JOURNAL_KEY, loadJournal, saveJournal, clearJournal } from './journalStore.js';
import { buildPayload } from '../submit/submitQueue.js';
import { bodyById } from './world.js';

// 정답대로 네 칸을 채운다.
function fillAnswer(j, id, override = {}) {
  const a = { ...ANSWERS[id], ...override };
  for (const k of ['color', 'surface', 'ring']) j.pick(id, k, a[k]);
  for (const f of a.features) j.pick(id, 'features', f);
}

describe('8-3 행성별 정답표', () => {
  // 기획서 8-3 표를 그대로 옮긴 것
  const TABLE = [
    ['수성', '회색', '단단한 땅', '고리가 없어요', ['충돌 구덩이가 많아요', '행성 중 가장 작아요']],
    ['금성', '노란색', '단단한 땅', '고리가 없어요', ['표면이 얼룩져 보여요']],
    ['지구', '파란색 바다와 초록·갈색 땅', '단단한 땅', '고리가 없어요', ['바다와 육지가 있어요']],
    ['화성', '붉은색', '단단한 땅', '고리가 없어요', []],
    ['목성', '흰색과 갈색 줄무늬', '기체', '희미한 고리가 있어요', ['줄무늬가 있어요', '행성 중 가장 커요']],
    ['토성', '연한 갈색', '기체', '뚜렷한 고리가 있어요', []],
    ['천왕성', '청록색', '기체', '희미한 고리가 있어요', []],
    ['해왕성', '파란색', '기체', '희미한 고리가 있어요', []]
  ];

  it('행성 8개의 정답이 기획서 표와 같다(수성 회색, 목성 흰색과 갈색 줄무늬 포함)', () => {
    expect(PLANET_IDS.map((id) => bodyById(id).name)).toEqual(TABLE.map((r) => r[0]));
    TABLE.forEach(([, color, surface, ring, features], i) => {
      expect(ANSWERS[PLANET_IDS[i]]).toEqual({ color, surface, ring, features });
    });
  });

  it('정답 값은 모두 보기 안에 있다', () => {
    for (const id of PLANET_IDS) {
      for (const f of FIELDS) {
        const v = ANSWERS[id][f.id];
        for (const x of [v].flat()) expect(f.options, `${id} ${f.id}`).toContain(x);
      }
    }
  });

  it('행성마다 정답대로 고르면 한 번에 완성된다', () => {
    const j = createJournal();
    for (const id of PLANET_IDS) {
      fillAnswer(j, id);
      expect(j.submit(id), id).toBe('done');
    }
    expect(j.count()).toBe(8);
  });

  it('행성마다 교과서 문장이 있고 그 행성 이름으로 시작한다', () => {
    for (const id of PLANET_IDS) expect(FACTS[id].startsWith(bodyById(id).name)).toBe(true);
    expect(FACTS.mars).toBe('화성은 전체적으로 붉게 보여요.');
  });

  it('수성을 노란색, 목성을 연한 갈색으로 고르면 색깔 칸이 틀린다', () => {
    const j = createJournal();
    fillAnswer(j, 'mercury', { color: '노란색' });
    expect(j.submit('mercury')).toBe('retry');
    expect(Object.keys(j.getCard('mercury').wrongPicks)).toEqual(['color']);
    fillAnswer(j, 'jupiter', { color: '연한 갈색' });
    expect(j.submit('jupiter')).toBe('retry');
  });
});

describe('판정과 다시 고치기(8-4)', () => {
  it('세 칸을 다 고르기 전에는 기록할 수 없다', () => {
    const j = createJournal();
    j.pick('mars', 'color', '붉은색');
    j.pick('mars', 'surface', '단단한 땅');
    expect(j.canSubmit('mars')).toBe(false);
    expect(j.submit('mars')).toBeNull();
    j.pick('mars', 'ring', '고리가 없어요');
    expect(j.canSubmit('mars')).toBe(true);
  });

  it('틀린 칸만 표시하고, 맞은 칸은 잠기며, 한 번 고쳐 맞으면 완성된다', () => {
    const j = createJournal();
    fillAnswer(j, 'mars', { ring: '희미한 고리가 있어요' });
    expect(j.submit('mars')).toBe('retry');
    const card = j.getCard('mars');
    expect(card.wrongPicks).toEqual({ ring: '희미한 고리가 있어요' });
    expect(j.canEdit('mars', 'color')).toBe(false);
    expect(j.pick('mars', 'color', '회색')).toBe(false);
    expect(j.canEdit('mars', 'ring')).toBe(true);
    j.pick('mars', 'ring', '고리가 없어요');
    expect(j.submit('mars')).toBe('done');
    expect(j.getCard('mars').revealed).toEqual([]);
  });

  it('고친 뒤에도 틀리면 정답을 공개하고, 카드에는 정답이 적힌다(고치기는 한 번뿐)', () => {
    const j = createJournal();
    fillAnswer(j, 'jupiter', { surface: '단단한 땅' });
    expect(j.submit('jupiter')).toBe('retry');
    expect(j.submit('jupiter')).toBe('revealed');
    const card = j.getCard('jupiter');
    expect(card.status).toBe('done');
    expect(card.revealed).toEqual(['surface']);
    expect(j.recordOf('jupiter').surface).toBe('기체');
    expect(card.picks.surface).toBe('단단한 땅'); // 학생이 고른 값은 그대로
    expect(j.submit('jupiter')).toBeNull();
    expect(j.pick('jupiter', 'surface', '기체')).toBe(false);
  });

  it('그 밖의 특징은 틀린 특징을 고르지 않았으면 정답이다(모두 고르지 않아도 됨)', () => {
    const j = createJournal();
    fillAnswer(j, 'mercury', { features: ['충돌 구덩이가 많아요'] });
    expect(j.submit('mercury')).toBe('done');
    fillAnswer(j, 'venus', { features: [] });
    expect(j.submit('venus')).toBe('done');
    fillAnswer(j, 'mars', { features: ['줄무늬가 있어요'] });
    expect(j.submit('mars')).toBe('retry');
    expect(j.getCard('mars').wrongPicks).toEqual({ features: ['줄무늬가 있어요'] });
  });

  it('특징을 끝내 틀리면 카드에는 교과서 특징이 적힌다', () => {
    const j = createJournal();
    fillAnswer(j, 'earth', { features: ['바다와 육지가 있어요', '행성 중 가장 커요'] });
    j.submit('earth');
    j.submit('earth');
    expect(j.recordOf('earth').features).toEqual(['바다와 육지가 있어요']);
    expect(j.getCard('earth').picks.features).toEqual(['바다와 육지가 있어요', '행성 중 가장 커요']);
  });

  it('칸마다 힌트가 있고, 기획서 예시 힌트와 같다', () => {
    for (const f of FIELDS) expect(HINTS[f.id]).toBeTruthy();
    expect(HINTS.surface).toBe('착륙해 보면 표면이 어떤지 알 수 있어요.');
    expect(HINTS.ring).toBe('고리 찾기 돋보기를 켜 봐요.');
  });

  it('완성 순서가 도장 번호가 된다', () => {
    const j = createJournal();
    fillAnswer(j, 'neptune');
    j.submit('neptune');
    fillAnswer(j, 'saturn');
    j.submit('saturn');
    expect(j.getCard('neptune').order).toBe(1);
    expect(j.getCard('saturn').order).toBe(2);
  });
});

describe('결과 행(10-4)', () => {
  it('처음 선택·최종 선택·판정·착륙 시도 여부·소요 시간을 담는다', () => {
    const rows = [];
    const j = createJournal({ hasLanded: (id) => id === 'mercury', onComplete: (r) => rows.push(r) });
    j.addTime('mercury', 40.4);
    fillAnswer(j, 'mercury', { color: '노란색', features: ['충돌 구덩이가 많아요', '행성 중 가장 작아요'] });
    j.submit('mercury');
    j.addTime('mercury', 54.8);
    j.pick('mercury', 'color', '회색');
    j.submit('mercury');
    expect(rows).toEqual([{
      종류: '도감', 행성: '수성',
      색깔처음: '노란색', 색깔최종: '회색', 색깔정답: true,
      표면처음: '단단한 땅', 표면최종: '단단한 땅', 표면정답: true,
      고리처음: '고리가 없어요', 고리최종: '고리가 없어요', 고리정답: true,
      특징최종: ['충돌 구덩이가 많아요', '행성 중 가장 작아요'], 특징정답: true,
      착륙시도여부: true, 소요시간: 95
    }]);
  });

  it('정답을 공개한 칸은 정답 여부가 아니요(false)이고, 착륙하지 않았으면 착륙 시도 여부도 false', () => {
    const rows = [];
    const j = createJournal({ onComplete: (r) => rows.push(r) });
    fillAnswer(j, 'saturn', { ring: '고리가 없어요' });
    j.submit('saturn');
    j.submit('saturn');
    expect(rows[0]).toMatchObject({ 고리처음: '고리가 없어요', 고리최종: '고리가 없어요', 고리정답: false, 착륙시도여부: false });
  });

  it('시트 제출 payload(도감 탭 컬럼 순서)로 그대로 바뀐다', () => {
    const rows = [];
    const j = createJournal({ hasLanded: () => true, onComplete: (r) => rows.push(r) });
    fillAnswer(j, 'mars');
    j.submit('mars');
    const payload = buildPayload({ grade: 4, cls: 1, number: 1, name: '가' }, rows[0]);
    expect(Object.keys(payload).slice(5)).toEqual([
      'planet', 'colorFirst', 'colorFinal', 'colorCorrect', 'surfaceFirst', 'surfaceFinal', 'surfaceCorrect',
      'ringFirst', 'ringFinal', 'ringCorrect', 'featuresFinal', 'featuresCorrect', 'landingTried', 'seconds'
    ]);
    expect(payload).toMatchObject({ planet: '화성', featuresFinal: '', featuresCorrect: true, landingTried: true });
  });

  it('완성한 카드에는 시간이 더해지지 않는다', () => {
    const j = createJournal();
    fillAnswer(j, 'uranus');
    j.addTime('uranus', 10);
    j.submit('uranus');
    j.addTime('uranus', 10);
    expect(j.getCard('uranus').seconds).toBe(10);
  });
});

describe('태양 카드(8-1)', () => {
  it('태양을 가까이 보고 탐사 1 한 줄 정리를 마쳐야 채워진다', () => {
    const j = createJournal();
    j.markSunExplored();
    expect(j.getSun().done).toBe(false);
    j.setSunSummary('태양은 스스로 빛을 내요.');
    expect(j.getSun().done).toBe(true);
  });
});

describe('진행 상태 저장(10-5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeStorage() {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
  }

  it('저장한 뒤 다시 만들면 완성 카드·고르던 칸·다시 고치기 상태가 그대로다', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    const j = createJournal();
    fillAnswer(j, 'neptune');
    j.submit('neptune');
    j.pick('earth', 'color', '파란색');
    fillAnswer(j, 'mars', { ring: '뚜렷한 고리가 있어요' });
    j.submit('mars');
    j.markSunExplored();
    saveJournal(j.serialize());
    expect(store.m.has(JOURNAL_KEY)).toBe(true);
    expect(JOURNAL_KEY.startsWith('starvoyager:')).toBe(true);

    const k = createJournal({ initial: loadJournal() });
    expect(k.getCard('neptune').status).toBe('done');
    expect(k.getCard('neptune').order).toBe(1);
    expect(k.getCard('earth').picks.color).toBe('파란색');
    expect(k.getCard('mars').status).toBe('retry');
    expect(k.canEdit('mars', 'color')).toBe(false);
    expect(k.getSun().explored).toBe(true);
    expect(k.count()).toBe(1);
  });

  it('저장소를 쓸 수 없거나 값이 망가져 있어도 빈 도감으로 시작한다', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); }, removeItem() { throw new Error('막힘'); } });
    expect(loadJournal()).toEqual({});
    expect(saveJournal({})).toBe(false);
    expect(() => clearJournal()).not.toThrow();

    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    store.setItem(JOURNAL_KEY, '{망가진 값');
    expect(loadJournal()).toEqual({});
    const j = createJournal({ initial: { cards: { mars: { status: 'done', picks: { color: '보라색' } } } } });
    expect(j.getCard('mars').status).toBe('todo');
  });

  it('지우면 다음에는 빈 도감이다', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    saveJournal({ cards: {} });
    clearJournal();
    expect(loadJournal()).toEqual({});
  });
});
