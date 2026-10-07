import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateStudentInfo } from '../src/student/studentInfo.js';
import { buildPayload } from '../src/submit/submitQueue.js';

// Code.gs는 Apps Script 전용 파일이지만 순수 JS라서, 시트·잠금 객체를 가짜로 넣어 Node에서 그대로 실행해 본다.
function loadGas() {
  const appended = {}; // 탭 이름 → 추가된 행 목록
  const sheets = {};
  const fakeSheet = (name) => ({
    getLastRow: () => appended[name].length,
    appendRow: (row) => appended[name].push(row),
    setFrozenRows: () => {}
  });
  const ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets[n] ?? null,
        insertSheet: (n) => { appended[n] = []; sheets[n] = fakeSheet(n); return sheets[n]; }
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('./Code.gs', import.meta.url), 'utf8'), ctx);
  const post = (payload) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
  return { ctx, post, appended };
}

const student = { grade: 4, cls: 3, number: 12, name: '테스트' };
const missionRow = {
  종류: '미션', 탐사: 1, 문항: '1-1', 처음예측: '지구', 예측정답여부: false,
  최종답: '태양', 최종정답여부: true, 한줄정리: null, 한줄정리정답여부: null, 소요시간: 30, 메모: null
};
const journalRow = {
  종류: '도감', 행성: '화성',
  색깔처음: '붉은색', 색깔최종: '붉은색', 색깔정답: true,
  표면처음: '기체', 표면최종: '단단한 땅', 표면정답: true,
  고리처음: '고리가 없어요', 고리최종: '고리가 없어요', 고리정답: true,
  특징최종: [], 특징정답: true, 착륙시도여부: true, 소요시간: 80
};

describe('Code.gs 탭 나누기', () => {
  it('미션 행은 미션 탭에, 도감 행은 도감 탭에 머리글과 함께 기록된다', () => {
    const { post, appended } = loadGas();
    expect(post(buildPayload(student, missionRow))).toEqual({ ok: true });
    expect(post(buildPayload(student, journalRow))).toEqual({ ok: true });

    expect(appended['미션'][0]).toEqual([
      '제출시각', '학년', '반', '번호', '이름', '탐사', '문항', '처음 예측', '예측 정답 여부', '최종 답',
      '최종 정답 여부', '한 줄 정리', '한 줄 정리 정답 여부', '소요 시간(초)', '메모'
    ]);
    expect(appended['미션'][1].slice(1)).toEqual([4, 3, 12, '테스트', 1, '1-1', '지구', 'X', '태양', 'O', '', '', 30, '']);

    expect(appended['도감'][0]).toEqual([
      '제출시각', '학년', '반', '번호', '이름', '행성', '색깔(처음)', '색깔(최종)', '색깔 정답',
      '표면(처음)', '표면(최종)', '표면 정답', '고리(처음)', '고리(최종)', '고리 정답',
      '그 밖의 특징(최종)', '특징 정답', '착륙 시도 여부', '소요 시간(초)'
    ]);
    expect(appended['도감'][1].slice(1)).toEqual([
      4, 3, 12, '테스트', '화성', '붉은색', '붉은색', 'O', '기체', '단단한 땅', 'O',
      '고리가 없어요', '고리가 없어요', 'O', '', 'O', '예', 80
    ]);
  });

  it('문항 허용 목록은 기획서 10-3 + 흥미1~흥미5다', () => {
    const { ctx } = loadGas();
    expect(vm.runInContext('ALLOWED_ITEMS', ctx)).toEqual([
      '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '3-1', '3-2', '3-3', '3-4',
      '4-1', '4-2', '4-3', '4-4', '4-5', '4-6', 'C-1', 'C-2', '흥미1', '흥미2', '흥미3', '흥미4', '흥미5'
    ]);
  });
});

describe('Code.gs 잘못된 값 거르기', () => {
  const cases = [
    ['학년 9', { ...buildPayload(student, missionRow), grade: 9 }],
    ['허용되지 않은 문항', { ...buildPayload(student, missionRow), item: '5-1' }],
    ['흥미6', { ...buildPayload(student, missionRow), item: '흥미6' }],
    ['탐사 5', { ...buildPayload(student, missionRow), mission: 5 }],
    ['종류 없음', { ...buildPayload(student, missionRow), kind: undefined }],
    ['허용되지 않은 행성', { ...buildPayload(student, journalRow), planet: '명왕성' }],
    ['너무 긴 글', { ...buildPayload(student, missionRow), memo: '가'.repeat(201) }],
    ['정답 여부 값 이상', { ...buildPayload(student, journalRow), colorCorrect: '맞음' }],
    ['착륙 시도 값 이상', { ...buildPayload(student, journalRow), landingTried: 'yes' }],
    ['소요 시간 음수', { ...buildPayload(student, missionRow), seconds: -1 }]
  ];
  for (const [label, payload] of cases) {
    it(`${label}이면 시트에 쓰지 않는다`, () => {
      const { post, appended } = loadGas();
      expect(post(payload).ok).toBe(false);
      expect(Object.values(appended).flat()).toHaveLength(0);
    });
  }

  it('수식처럼 보이는 글은 글자로 기록된다', () => {
    const { post, appended } = loadGas();
    post({ ...buildPayload(student, missionRow), memo: '=SUM(A1)' });
    expect(appended['미션'][1].at(-1)).toBe("'=SUM(A1)");
  });
});

describe('학생 정보 검증 규칙이 앱과 Code.gs에서 같다', () => {
  const samples = [
    { grade: '4', cls: '3', number: '12', name: '홍길동' },
    { grade: '0', cls: '3', number: '12', name: '홍길동' },
    { grade: '6', cls: '20', number: '40', name: '가'.repeat(10) },
    { grade: '7', cls: '3', number: '12', name: '홍길동' },
    { grade: '4', cls: '21', number: '12', name: '홍길동' },
    { grade: '4', cls: '3', number: '41', name: '홍길동' },
    { grade: '4', cls: '3', number: '12', name: '   ' },
    { grade: '4', cls: '3', number: '12', name: '가'.repeat(11) },
    { grade: '4.5', cls: '3', number: '12', name: '홍길동' }
  ];
  for (const s of samples) {
    it(JSON.stringify(s), () => {
      const { ctx } = loadGas();
      const app = validateStudentInfo(s);
      ctx.__d = { grade: s.grade, class: s.cls, number: s.number, name: s.name };
      const gas = vm.runInContext('validateStudent_(__d)', ctx);
      expect(gas.ok).toBe(app.ok);
      if (!app.ok) expect(gas.error).toBe(app.error);
    });
  }
});
