// 탐사별 진행 상태(기획서 10-5): 시작 전(todo) / 진행 중(doing) / 완료(done)와 이어서 할 단계 번호.
// 학생 기기의 브라우저에 저장해 다음 차시에 이어서 한다. DOM과 분리한 순수 모듈.
//   from  다음에 시작할 단계 번호(engine getState().resumeIndex)
//   days  요일 도입에서 누른 요일(탐사 1의 1-4 메모용)
export const PROGRESS_KEY = 'starvoyager:missions:v1';
const STATUSES = ['todo', 'doing', 'done'];

function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

const fresh = () => ({ status: 'todo', from: 0, days: [] });

function restore(saved) {
  const p = fresh();
  if (!saved || typeof saved !== 'object' || !STATUSES.includes(saved.status)) return p;
  p.status = saved.status;
  p.from = Number.isInteger(saved.from) && saved.from >= 0 ? saved.from : 0;
  p.days = Array.isArray(saved.days) ? saved.days.filter((d) => typeof d === 'string') : [];
  return p;
}

// ids: 탐사 번호 목록. persist=false면 저장하지 않는다(시연 모드).
export function createMissionProgress(ids, { persist = true } = {}) {
  let saved = {};
  if (persist) {
    try { saved = JSON.parse(storage()?.getItem(PROGRESS_KEY) ?? '{}') ?? {}; } catch { saved = {}; }
  }
  const all = Object.fromEntries(ids.map((id) => [id, restore(saved[id])]));
  const save = () => {
    if (!persist) return;
    try { storage()?.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch { /* 저장이 막혀도 계속 */ }
  };

  return {
    get: (id) => ({ ...all[id], days: [...all[id].days] }),
    // 탐사를 열 때 시작할 단계: 진행 중이면 이어서, 시작 전·완료면 처음부터(완료한 탐사는 다시 처음부터, 9-1 재제출 허용)
    startOf(id) {
      const p = all[id];
      return p.status === 'doing' ? { from: p.from, pressedDays: [...p.days] } : { from: 0, pressedDays: [] };
    },
    // 엔진 상태가 바뀔 때마다: 이어서 할 단계를 적는다. 끝까지 가면 완료.
    record(id, { resumeIndex, done, days = [] }) {
      const p = all[id];
      if (done) Object.assign(p, { status: 'done', from: 0, days: [] });
      else if (p.status === 'done' && resumeIndex === 0) return; // 끝낸 탐사에 다시 들어와 첫 단계(탐사 2 도감 탐색)에만 머물면 '완료'를 그대로 둔다
      else Object.assign(p, { status: 'doing', from: resumeIndex, days: [...days] });
      save();
    }
  };
}

export function clearMissionProgress() {
  try { storage()?.removeItem(PROGRESS_KEY); } catch { /* 지우지 못해도 계속 */ }
}
