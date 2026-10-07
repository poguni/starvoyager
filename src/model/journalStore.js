// 도감 진행 상태를 학생 기기의 브라우저에 저장한다(기획서 10-5).
// 행성 카드·태양 카드·찾은 구성원·착륙 시도 기록을 한 키에 담는다.
// 저장소에 접근하지 못해도(사생활 보호 모드 등) 앱은 그대로 동작한다.
export const JOURNAL_KEY = 'starvoyager:journal:v1';

function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function loadJournal() {
  try {
    const raw = storage()?.getItem(JOURNAL_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function saveJournal(data) {
  try {
    storage()?.setItem(JOURNAL_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// '다른 친구가 사용해요'(Phase 9B)에서 진행 상태를 지울 때
export function clearJournal() {
  try { storage()?.removeItem(JOURNAL_KEY); } catch { /* 지우지 못해도 계속 */ }
}
