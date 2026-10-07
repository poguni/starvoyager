// 별 이어 그리기(기획서 5-3 ⑤, 9-5). DOM과 분리한 순수 모듈.
// 별자리를 '이어야 할 선의 모음'으로 본다(docs/결정기록.md 2026-10-08).
//   · 지금 별과 아직 잇지 않은 선으로 연결된 별을 누르면 선이 생긴다.
//   · 같은 별자리에서 이어지지 않는 별을 누르면 'wrong'(화면에서 흔들림, 선 없음).
//   · 다른 별자리의 별을 누르면 그 별자리를 새로 시작한다. 지금 별에서 더 갈 선이 없을 때도 새로 시작할 수 있다.
//   · 마지막 선 지우기, 힌트(다음에 누를 별), 완성한 별자리 수 구독.
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function createStarLink(constellations) {
  const byId = new Map(constellations.map((c) => [c.id, c]));
  const drawn = new Map(constellations.map((c) => [c.id, new Set()]));
  const history = []; // { c, from, to }
  let current = null; // { c, star }
  const listeners = new Set();

  const constellationOf = (hr) => constellations.find((c) => c.stars.includes(hr));
  const isComplete = (id) => drawn.get(id).size === byId.get(id).lines.length;
  const undrawn = (id) => byId.get(id).lines.filter(([a, b]) => !drawn.get(id).has(key(a, b)));
  const neighbors = (id, hr) => undrawn(id).flatMap(([a, b]) => (a === hr ? [b] : b === hr ? [a] : []));
  const completedCount = () => constellations.filter((c) => isComplete(c.id)).length;
  const snapshot = () => ({ completed: constellations.filter((c) => isComplete(c.id)).map((c) => c.id), count: completedCount(), total: constellations.length });
  const emit = () => { const s = snapshot(); listeners.forEach((fn) => fn(s)); };

  // 선 (a, b)를 지워도 남은 선들이 b에서 모두 이어지는지(한 번에 이을 수 있게 다리 선은 나중에 쓴다)
  function keepsConnected(id, a, b) {
    const rest = undrawn(id).filter(([x, y]) => key(x, y) !== key(a, b));
    if (rest.length === 0) return true;
    const seen = new Set([b]);
    const stack = [b];
    while (stack.length) {
      const v = stack.pop();
      for (const [x, y] of rest) {
        const w = x === v ? y : y === v ? x : null;
        if (w !== null && !seen.has(w)) { seen.add(w); stack.push(w); }
      }
    }
    return rest.every(([x, y]) => seen.has(x) && seen.has(y));
  }

  // 새로 시작하기 좋은 별: 남은 선에서 연결 수가 홀수인 별(한 번에 다 이을 수 있는 시작점), 없으면 아무 별
  function startStar(id) {
    const count = new Map();
    for (const [a, b] of undrawn(id)) { count.set(a, (count.get(a) ?? 0) + 1); count.set(b, (count.get(b) ?? 0) + 1); }
    const stars = byId.get(id).stars.filter((hr) => count.has(hr));
    return stars.find((hr) => count.get(hr) % 2 === 1) ?? stars[0];
  }

  return {
    constellationOf,
    // 별 누르기 → { result: 'start' | 'line' | 'complete' | 'wrong' | 'ignored', constellation, from?, to? }
    press(hr) {
      const c = constellationOf(hr);
      if (!c || isComplete(c.id)) return { result: 'ignored' };
      if (current && current.c === c.id) {
        if (hr === current.star) return { result: 'ignored', constellation: c.id };
        if (neighbors(c.id, current.star).includes(hr)) {
          const from = current.star;
          drawn.get(c.id).add(key(from, hr));
          history.push({ c: c.id, from, to: hr });
          const done = isComplete(c.id);
          current = done ? null : { c: c.id, star: hr };
          emit();
          return { result: done ? 'complete' : 'line', constellation: c.id, from, to: hr };
        }
        // 더 갈 선이 없는 별에 있으면 남은 선의 다른 별에서 다시 시작할 수 있다.
        if (neighbors(c.id, current.star).length === 0 && neighbors(c.id, hr).length > 0) {
          current = { c: c.id, star: hr };
          return { result: 'start', constellation: c.id };
        }
        return { result: 'wrong', constellation: c.id };
      }
      if (neighbors(c.id, hr).length === 0) return { result: 'ignored', constellation: c.id };
      current = { c: c.id, star: hr };
      return { result: 'start', constellation: c.id };
    },
    // 마지막 선 지우기: 선의 시작 별이 지금 별이 된다.
    undo() {
      const last = history.pop();
      if (!last) return null;
      drawn.get(last.c).delete(key(last.from, last.to));
      current = { c: last.c, star: last.from };
      emit();
      return last;
    },
    // 다음에 누를 별(힌트). 이어 그리는 중이면 이어지는 별, 아니면 시작할 별.
    hint() {
      if (current && neighbors(current.c, current.star).length) {
        const next = neighbors(current.c, current.star);
        return { hr: next.find((n) => keepsConnected(current.c, current.star, n)) ?? next[0], constellation: current.c };
      }
      const c = (current && !isComplete(current.c) && byId.get(current.c)) || constellations.find((x) => !isComplete(x.id));
      return c ? { hr: startStar(c.id), constellation: c.id, start: true } : null;
    },
    current: () => (current ? { ...current } : null),
    linesOf: (id) => byId.get(id).lines.filter(([a, b]) => drawn.get(id).has(key(a, b))),
    isComplete,
    // 점선 안내: 아직 시작하지 않은 별자리에만(S08)
    showsGuide: (id) => drawn.get(id).size === 0 && !(current && current.c === id),
    canUndo: () => history.length > 0,
    getState: snapshot,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); }
  };
}
