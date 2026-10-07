// 행성별 착륙 시도 기록(기획서 10-4 '착륙 시도 여부'). 도감 결과 행에서 쓴다(Phase 5).
export function createLandingLog(initial = []) {
  const tried = new Set(initial);
  const listeners = new Set();

  return {
    // 착륙하기를 누를 때 기록한다. 처음 시도했으면 true.
    record(planetId) {
      if (tried.has(planetId)) return false;
      tried.add(planetId);
      listeners.forEach((fn) => fn([...tried]));
      return true;
    },
    hasTried: (planetId) => tried.has(planetId),
    list: () => [...tried],
    subscribe(fn) { listeners.add(fn); fn([...tried]); return () => listeners.delete(fn); }
  };
}
