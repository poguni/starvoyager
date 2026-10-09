import { describe, expect, it } from 'vitest';
import { entryUrl } from './entryUrl.js';

describe('학생용 QR 주소', () => {
  it('설정(?...)과 #은 빼고 기본 주소만 남긴다', () => {
    expect(entryUrl('https://poguni.github.io/starvoyager/?mode=demo&mission=2#x')).toBe('https://poguni.github.io/starvoyager/');
  });

  it('설정이 없으면 그대로이고, 개발 서버 주소(포트)도 맞게 만든다', () => {
    expect(entryUrl('https://poguni.github.io/starvoyager/')).toBe('https://poguni.github.io/starvoyager/');
    expect(entryUrl('http://localhost:5199/starvoyager/?view=map')).toBe('http://localhost:5199/starvoyager/');
  });
});
