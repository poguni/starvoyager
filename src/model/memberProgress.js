// 태양계 구성원 찾기(기획서 5-3 ①, 8-1). 태양·행성·위성·혜성·소행성을 누르면 '찾음'으로 기록한다.
// 행성은 아무 행성이나 하나를 누르면 '행성'을 찾은 것으로 본다. 판정은 없고 찾음 여부만 기록한다.
export const MEMBERS = [
  { id: 'sun', label: '태양' },
  { id: 'planet', label: '행성' },
  { id: 'moon', label: '위성' },
  { id: 'comet', label: '혜성' },
  { id: 'asteroid', label: '소행성' }
];

export function createMemberProgress(initial = []) {
  const found = new Set(initial.filter((id) => MEMBERS.some((m) => m.id === id)));
  const listeners = new Set();
  const snapshot = () => ({ found: MEMBERS.filter((m) => found.has(m.id)).map((m) => m.id), count: found.size, total: MEMBERS.length });

  return {
    // kind: world.js 천체의 kind('sun' | 'planet' | 'moon' | 'comet' | 'asteroid'). 새로 찾았으면 true.
    find(kind) {
      if (!MEMBERS.some((m) => m.id === kind) || found.has(kind)) return false;
      found.add(kind);
      const state = snapshot();
      listeners.forEach((fn) => fn(state));
      return true;
    },
    isFound: (kind) => found.has(kind),
    getState: snapshot,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); }
  };
}
