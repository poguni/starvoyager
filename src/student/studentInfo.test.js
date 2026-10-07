import { describe, expect, it } from 'vitest';
import { validateStudentInfo } from './studentInfo.js';

describe('validateStudentInfo', () => {
  it('학년·반·번호·이름이 범위 안이면 통과한다', () => {
    const result = validateStudentInfo({ grade: '4', cls: '3', number: '12', name: '홍길동' });
    expect(result).toEqual({ ok: true, value: { grade: 4, cls: 3, number: 12, name: '홍길동' } });
  });

  it('학년이 1~6을 벗어나면 안내 문구와 함께 실패한다', () => {
    expect(validateStudentInfo({ grade: '7', cls: '3', number: '12', name: '홍길동' }))
      .toMatchObject({ ok: false, error: '학년은 1~6 숫자로 써 주세요.' });
    expect(validateStudentInfo({ grade: '', cls: '3', number: '12', name: '홍길동' }).ok).toBe(false);
  });

  it('반이 1~20을 벗어나면 실패한다', () => {
    expect(validateStudentInfo({ grade: '4', cls: '21', number: '12', name: '홍길동' }))
      .toMatchObject({ ok: false, error: '반은 1~20 숫자로 써 주세요.' });
  });

  it('번호가 1~40을 벗어나면 실패한다', () => {
    expect(validateStudentInfo({ grade: '4', cls: '3', number: '0', name: '홍길동' }))
      .toMatchObject({ ok: false, error: '번호는 1~40 숫자로 써 주세요.' });
  });

  it('이름이 비어 있거나 10글자를 넘으면 실패한다', () => {
    expect(validateStudentInfo({ grade: '4', cls: '3', number: '12', name: '  ' }))
      .toMatchObject({ ok: false, error: '이름은 1~10글자로 써 주세요.' });
    expect(validateStudentInfo({ grade: '4', cls: '3', number: '12', name: '가'.repeat(11) }))
      .toMatchObject({ ok: false, error: '이름은 1~10글자로 써 주세요.' });
  });

  it('이름 앞뒤 공백은 잘라서 저장한다', () => {
    const result = validateStudentInfo({ grade: '4', cls: '3', number: '12', name: ' 홍길동 ' });
    expect(result.value.name).toBe('홍길동');
  });
});
