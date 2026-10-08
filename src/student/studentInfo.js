// 학생 정보(학년·반·번호·이름) 검증과 브라우저 임시 저장(기획서 10장).
// 검증 범위는 gas-test/Code.gs의 validate_()와 맞춘다(시트에서 다시 걸러지지 않도록).
const STORAGE_KEY = 'starvoyager:student';

export function validateStudentInfo({ grade, cls, number, name }) {
  const g = Number(grade);
  if (!Number.isInteger(g) || g < 1 || g > 6) return { ok: false, field: 'grade', error: '학년은 1~6 숫자로 적어 주세요.' };

  const c = Number(cls);
  if (!Number.isInteger(c) || c < 1 || c > 20) return { ok: false, field: 'cls', error: '반은 1~20 숫자로 적어 주세요.' };

  const n = Number(number);
  if (!Number.isInteger(n) || n < 1 || n > 40) return { ok: false, field: 'number', error: '번호는 1~40 숫자로 적어 주세요.' };

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (trimmedName.length < 1 || trimmedName.length > 10) return { ok: false, field: 'name', error: '이름은 1~10글자로 적어 주세요.' };

  return { ok: true, value: { grade: g, cls: c, number: n, name: trimmedName } };
}

// 저장이 막힌 환경(시크릿 모드 등)에서도 앱이 그대로 동작해야 하므로 실패는 조용히 넘어간다.
export function loadStudentInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const check = validateStudentInfo(JSON.parse(raw));
    return check.ok ? check.value : null;
  } catch {
    return null;
  }
}

export function saveStudentInfo(info) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    // 이번 세션(메모리) 값은 그대로 유지된다.
  }
}

export function clearStudentInfo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
