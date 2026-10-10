import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MISSIONS } from './missions.js';
import { RAP_LINES } from '../data/rapLines.js';
import { PLANET_IDS } from '../model/journal.js';
import { ARRANGE_ANSWERS, orderText, groupsText } from '../model/arrange.js';

// 기획서 원문과 대조한다(학생용 문구는 한 글자도 바꾸지 않는다).
const PRD = readFileSync(new URL('../../docs/별빛탐사선_기획서.md', import.meta.url), 'utf8');
const section = (from, to) => PRD.slice(PRD.indexOf(from), PRD.indexOf(to));
const ACTIVITIES = section('### 9-2.', '### 9-6.');

// 9-6 판정표: | 1-1 | 태양 | 보기 선택 |
const TABLE = Object.fromEntries(
  [...section('### 9-6.', '## 10.').matchAll(/^\| (\d-\d) \| (.+?) \| (.+?) \|$/gm)].map(([, id, answer, how]) => [id, { answer, how }])
);

const items = MISSIONS.flatMap((m) => m.steps.filter((s) => ['quiz', 'sort', 'classify'].includes(s.type)).map((s) => ({ ...s, mission: m.id })));
const quizzes = items.filter((s) => s.type === 'quiz');
const summaries = MISSIONS.map((m) => m.steps.find((s) => s.type === 'summary'));

// 기획서 한 문항 덩어리(- **문항 1-1** 부터 다음 - ** 까지)
function block(id) {
  const start = ACTIVITIES.search(new RegExp(`- \\*\\*(?:이야기 미션 )?문항 ${id}`));
  const rest = ACTIVITIES.slice(start + 1);
  const end = rest.search(/\n- \*\*/);
  return ACTIVITIES.slice(start, start + 1 + (end < 0 ? rest.length : end));
}
const field = (text, name) => text.match(new RegExp(`- ${name}: (.+)`))?.[1].trim() ?? null;
const quoted = (line) => line?.match(/^"(.+)"$/)?.[1] ?? null;

describe('9-6 판정표와 데이터의 정답이 같다', () => {
  it('문항 17개가 모두 있고 판정표에 있는 문항만 있다', () => {
    expect(items.map((s) => s.id).sort()).toEqual(Object.keys(TABLE).sort());
    expect(items).toHaveLength(17);
  });

  it.each(quizzes.map((q) => [q.id, q]))('%s 보기 선택 정답', (id, q) => {
    expect(TABLE[id].how).toBe('보기 선택');
    expect(q.options[q.answerIndex]).toBe(TABLE[id].answer.replace(/\*/g, ''));
  });

  it('3-3 순서 일치', () => {
    expect(TABLE['3-3'].how).toBe('순서 일치');
    expect(orderText(ARRANGE_ANSWERS.sort)).toBe(TABLE['3-3'].answer.replace(/→/g, '>'));
  });

  it('3-4 집합 일치', () => {
    expect(TABLE['3-4'].how).toBe('집합 일치');
    // 표: '작은: 금성·화성·수성 / 큰: 목성·토성·천왕성·해왕성'
    expect(groupsText(ARRANGE_ANSWERS.classify).replace(/, /g, '·')).toBe(TABLE['3-4'].answer);
  });

  it('한 줄 정리 정답은 각 탐사의 ①', () => {
    for (const s of summaries) expect(s.answerIndex).toBe(0);
  });
});

describe('문구가 기획서와 한 글자도 다르지 않다', () => {
  it.each(quizzes.map((q) => [q.id, q]))('%s 질문·보기·힌트·정답 설명', (id, q) => {
    const b = block(id);
    expect(quoted(field(b, '질문'))).toBe(q.question);
    // 보기: 태양 / 지구 / 달 / 목성 (4-4는 ' · '로 나눔)
    const optionLine = field(b, '보기');
    const options = id === '4-4' ? optionLine.split(' · ') : optionLine.split(' / ');
    expect(q.options).toEqual(options);
    expect(quoted(field(b, '정답 설명'))).toBe(q.explanation ?? null);
    expect(quoted(field(b, '오답 힌트'))).toBe(q.hint ?? null);
  });

  it.each(items.filter((s) => s.type !== 'quiz').map((s) => [s.id, s]))('%s 질문·힌트', (id, s) => {
    const b = block(id);
    expect(quoted(field(b, '질문'))).toBe(s.question);
    expect(quoted(field(b, '오답 힌트'))).toBe(s.hint ?? null);
  });

  it.each(summaries.map((s, i) => [i + 1, s]))('탐사 %s 한 줄 정리', (n, s) => {
    const part = section(`### 9-${n + 1}.`, n === 4 ? '### 9-6.' : `### 9-${n + 2}.`);
    const line = part.match(/- \*\*한 줄 정리\*\*: "(.+)"\n\s+- 보기: (.+)/);
    expect(line[1]).toBe(s.text);
    expect(line[2].split(/\s?[①②③]\s/).filter(Boolean)).toEqual(s.options);
  });

  it('힌트가 없는 문항만 확인 방법 안내(guide)를 갖는다', () => {
    for (const q of quizzes) if (q.guide) expect(q.hint).toBeUndefined();
  });
});

describe('시작 상태와 잠금', () => {
  it('기획서에 적힌 시작 상태', () => {
    const byId = Object.fromEntries(items.map((s) => [s.id, s]));
    expect(byId['1-1'].start.view).toBe('map');
    expect(byId['2-1'].start).toMatchObject({ view: 'planet', planet: 'jupiter' });
    expect(byId['2-1'].lock).toContain('land');
    expect(byId['2-3'].start).toMatchObject({ view: 'map', loupe: false });
    expect(byId['3-1'].start).toMatchObject({ view: 'size', real: false });
    expect(byId['3-3'].start).toMatchObject({ view: 'size', real: true });
    expect(byId['4-1'].start).toMatchObject({ view: 'sky', hour: 20 });
    expect(byId['4-5'].start).toMatchObject({ lights: true });
  });

  it('모든 문항에 시작 상태가 있고, 강조하는 조작은 예측 단계에서 잠긴다(이름 보기 제외)', () => {
    for (const s of items) {
      expect(s.start?.view).toBeTruthy();
      if (s.type === 'quiz' && s.cue && s.cue !== 'names') expect(s.lock).toContain(s.cue);
    }
  });

  it('탐색 조건: 탐사 1 구성원 5개, 탐사 2 도감 4장, 탐사 4 별자리 3개', () => {
    const gates = MISSIONS.map((m) => m.steps.filter((s) => s.type === 'gate').map((g) => [g.condition, g.count]));
    expect(gates).toEqual([[['members', 5]], [['cards', 4]], [], [['constellations', 3]]]);
    // 탐사 4는 4-1 뒤에 열린다
    // 탐사 2의 카드 탐색만 학생이 '질문 풀기'를 눌러 직접 연다(1·4는 조건을 채우면 저절로 열림)
    expect(MISSIONS.flatMap((m) => m.steps.filter((s) => s.type === 'gate' && s.manual).map(() => m.id))).toEqual([2]);
    expect(MISSIONS[3].steps.map((s) => s.id ?? s.type).slice(0, 3)).toEqual(['4-1', 'gate', '4-2']);
  });

  it('탐사 1은 요일 도입(7장)으로 시작하고 1-4 행에 메모를 남긴다', () => {
    const intro = MISSIONS[0].steps[0];
    expect(intro.type).toBe('intro');
    expect(intro.days.map((d) => `${d.label[0]} ${d.body}`)).toEqual(
      ['월 moon', '화 mars', '수 mercury', '목 jupiter', '금 venus', '토 saturn', '일 sun']
    );
    expect(items.find((s) => s.id === '1-4').memo).toBe('members');
  });
});

describe('창작·흥미 체크(9-3, 9-5)', () => {
  const stepOf = (id, type) => MISSIONS.find((m) => m.id === id).steps.find((s) => s.type === type);
  const BLOCK_25 = section('- **창작(점수 없음) — 새 별자리 이름 붙이기**', '### 9-6.');

  it('탐사마다 마지막은 흥미 체크, 탐사 2·4는 그 앞에 창작', () => {
    expect(MISSIONS.map((m) => m.steps.at(-1).type)).toEqual(['survey', 'survey', 'survey', 'survey']);
    expect(MISSIONS.map((m) => m.steps.at(-1).questions.map((q) => q.id))).toEqual([['흥미1'], ['흥미2'], ['흥미3'], ['흥미4', '흥미5']]);
    expect(stepOf(2, 'creative').id).toBe('C-1');
    expect(stepOf(4, 'creative').id).toBe('C-2');
  });

  it('C-2 문장과 보기가 기획서 그대로', () => {
    const c = stepOf(4, 'creative');
    for (const b of c.blanks) {
      const line = BLOCK_25.split('\n').find((l) => l.includes(b.text.split('[ ]')[0].trim()));
      expect(line).toContain(`"${b.text}" 보기: ${b.options.join(' / ')}`);
    }
    expect(c.constellations.map((x) => x.name)).toEqual(['북두칠성', '카시오페이아자리', '작은곰자리']);
  });

  it('탐사 4 흥미 체크 두 문항이 기획서 그대로(기록값은 이모지 없이)', () => {
    const [q4, q5] = stepOf(4, 'survey').questions;
    expect(BLOCK_25).toContain(`"${q4.text}" ${q4.options.map((o, i) => `${q4.emoji[i]} ${o}`).join(' / ')}`);
    expect(BLOCK_25).toContain(`"${q5.text}" ${q5.options.join(' / ')}`);
  });

  it('행성 랩: 행성 8개 × 3줄 × 보기 3개, 화성은 기획서 예시 그대로', () => {
    expect(Object.keys(RAP_LINES).sort()).toEqual([...PLANET_IDS].sort());
    for (const lines of Object.values(RAP_LINES)) {
      expect(lines).toHaveLength(3);
      for (const opts of lines) expect(opts).toHaveLength(3);
    }
    const rap = section('- **창작(점수 없음) — 행성 자기소개 랩 만들기**', '### 9-4.');
    RAP_LINES.mars.forEach((opts, i) => {
      expect(rap).toContain(`${i + 2}줄 보기: ${opts.map((t) => `"${t}"`).join(' / ')}`);
    });
  });

  it('행성 랩 문장에 쓰지 않는 말(가스, 크레이터)이 없고, 고리·표면 줄이 정답표와 맞다', () => {
    const all = Object.values(RAP_LINES).flat(2).join(' ');
    expect(all).not.toMatch(/가스|크레이터/);
    const solid = ['mercury', 'venus', 'earth', 'mars'];
    for (const [id, [, surface, ring]] of Object.entries(RAP_LINES)) {
      const isSolid = solid.includes(id);
      expect(surface.join(' ')).toMatch(isSolid ? /땅|착륙해도|내려앉을 수 있/ : /기체|땅이 없|내려앉을 수 없/);
      if (isSolid) expect(ring.join(' ')).toMatch(/고리가 없|고리 없이|다른 친구/);
      else expect(ring.every((t) => t.includes('고리') && !t.includes('없'))).toBe(true);
    }
  });
});
