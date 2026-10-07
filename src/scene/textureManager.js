// 질감 단계 불러오기(기획서 12장): 처음에는 모든 천체에 1K 질감을 쓰고,
// 가까이 간 천체(와 이전·다음 천체)만 고해상도(4K, ?quality=low면 2K)로 바꾼다.
// 멀어진 천체의 고해상도 질감은 일정 시간 뒤 1K로 되돌리고 메모리에서 해제한다.
// 고해상도는 다 받은 뒤 GPU에 미리 올려 두고 바꾸므로, 그동안은 1K가 그대로 보이고 깜빡이지 않는다.

export const RELEASE_MS = 30000;

// load(level, file, color) → Promise<texture>, prepare(texture): GPU에 미리 올리기, dispose(texture)
export function createTextureManager({ high, load, prepare = () => {}, dispose = (t) => t.dispose(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  const slots = new Map(); // id → [{ file, color, apply, base, high, pending }]
  const timers = new Map();
  let wanted = new Set();

  // 천체 id의 질감 하나를 등록한다. apply(texture)는 재질에 질감을 끼운다. 1K는 바로 불러와 끼운다.
  function bind(id, file, apply, { color = true } = {}) {
    const slot = { file, color, apply, base: null, high: null, pending: null };
    if (!slots.has(id)) slots.set(id, []);
    slots.get(id).push(slot);
    return load('1k', file, color).then((tex) => {
      slot.base = tex;
      if (!slot.high) apply(tex);
      return tex;
    });
  }

  function upgrade(id) {
    clearTimer(timers.get(id));
    timers.delete(id);
    for (const slot of slots.get(id) ?? []) {
      if (slot.high || slot.pending) continue;
      slot.pending = load(high, slot.file, slot.color).then((tex) => {
        slot.pending = null;
        if (!wanted.has(id)) { dispose(tex); return; } // 받는 사이에 멀어졌으면 쓰지 않는다
        prepare(tex);
        slot.high = tex;
        slot.apply(tex);
      }).catch(() => { slot.pending = null; }); // 실패하면 1K를 그대로 쓴다
    }
  }

  function release(id) {
    timers.delete(id);
    for (const slot of slots.get(id) ?? []) {
      if (!slot.high) continue;
      if (slot.base) slot.apply(slot.base);
      dispose(slot.high);
      slot.high = null;
    }
  }

  // 지금 고해상도가 필요한 천체 목록. 빠진 천체는 RELEASE_MS 뒤 1K로 돌아간다.
  function want(ids) {
    const next = new Set(ids.filter((id) => slots.has(id)));
    for (const id of wanted) {
      if (!next.has(id) && !timers.has(id)) timers.set(id, setTimer(() => release(id), RELEASE_MS));
    }
    wanted = next;
    for (const id of wanted) upgrade(id);
  }

  function level(id) {
    const list = slots.get(id) ?? [];
    return list.length && list.every((s) => s.high) ? high : '1k';
  }

  return { bind, want, level };
}
