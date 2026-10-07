import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio, parseAccents, rootColor } from './contrast.js';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const accents = parseAccents(css);
const paper = rootColor(css, 'paper');
const space900 = rootColor(css, 'space-900');
const space800 = rootColor(css, 'space-800');

describe('contrastRatio', () => {
  it('검정과 흰색은 21:1, 같은 색은 1:1이다', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#3D6BE0', '#3D6BE0')).toBe(1);
  });

  it('순서를 바꿔도 같다', () => {
    expect(contrastRatio('#E0603A', '#1B0B06')).toBe(contrastRatio('#1B0B06', '#E0603A'));
  });
});

describe('강조 색 11개 (tokens.css)', () => {
  it('11개가 모두 정의되어 있다', () => {
    expect(Object.keys(accents)).toEqual([
      'default', 'sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sky'
    ]);
  });

  for (const [id, a] of Object.entries(accents)) {
    describe(id, () => {
      it('강조 색 바탕 위 글씨(--sv-on-accent)는 4.5:1 이상', () => {
        expect(contrastRatio(a.accent, a.onAccent)).toBeGreaterThanOrEqual(4.5);
      });

      it('도감 종이 위 강조 선·체크(--sv-accent-strong)는 4.5:1 이상', () => {
        expect(contrastRatio(a.accentStrong, paper)).toBeGreaterThanOrEqual(4.5);
      });

      // 목적지 이름(38px 굵게)처럼 어두운 바탕 위에 강조 색을 글씨로 쓰는 곳은 큰 글씨 기준 3:1.
      // 해왕성(#3D6BE0)은 이 경우 3.8~4.1:1이라 작은 글씨에는 쓰지 않는다(docs/결정기록.md).
      it('어두운 우주 바탕 위 강조 색 글씨는 큰 글씨 기준 3:1 이상', () => {
        expect(contrastRatio(a.accent, space900)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(a.accent, space800)).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
