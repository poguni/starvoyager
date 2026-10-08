import { describe, expect, it } from 'vitest';
import { BODY_INFO } from './bodyInfo.js';

describe('혜성·소행성 소개 문장', () => {
  const lines = Object.values(BODY_INFO).flatMap((b) => b.lines);

  it('혜성과 소행성 두 천체만 있고, 문장은 해요체다', () => {
    expect(Object.keys(BODY_INFO).sort()).toEqual(['asteroids', 'comet']);
    for (const line of lines) expect(line).toMatch(/요\.$/);
  });

  it('교과서 용어만 쓰고, 문항 1-2와 헷갈릴 "태양 주위를 돌아요"는 쓰지 않는다', () => {
    for (const line of lines) {
      expect(line).not.toMatch(/가스|크레이터|소행성대/);
      expect(line).not.toMatch(/태양(의)? 주위를 돌/);
    }
  });

  it('소행성은 화성과 목성 사이에 있다고 알려 준다', () => {
    expect(BODY_INFO.asteroids.lines.join(' ')).toContain('화성과 목성 사이');
  });
});
