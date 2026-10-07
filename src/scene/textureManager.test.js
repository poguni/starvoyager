import { describe, expect, it } from 'vitest';
import { createTextureManager, RELEASE_MS } from './textureManager.js';

// 질감 대신 이름표 객체를 쓰고, 타이머는 손으로 돌린다.
function setup(high = '4k') {
  const applied = {};
  const disposed = [];
  const timers = [];
  let now = 0;
  const tm = createTextureManager({
    high,
    load: async (level, file) => ({ level, file }),
    dispose: (t) => disposed.push(`${t.level}/${t.file}`),
    setTimer: (fn, ms) => { const t = { fn, at: now + ms }; timers.push(t); return t; },
    clearTimer: (t) => { if (t) t.cancelled = true; }
  });
  const advance = (ms) => {
    now += ms;
    for (const t of timers) if (!t.cancelled && !t.done && t.at <= now) { t.done = true; t.fn(); }
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const bind = (id, file) => tm.bind(id, file, (tex) => { applied[file] = `${tex.level}/${tex.file}`; });
  return { tm, applied, disposed, advance, flush, bind };
}

describe('질감 단계 불러오기', () => {
  it('처음에는 모든 천체가 1K 질감이다', async () => {
    const { applied, bind } = setup();
    await bind('mars', 'mars.jpg');
    await bind('earth', 'earth.jpg');
    expect(applied).toEqual({ 'mars.jpg': '1k/mars.jpg', 'earth.jpg': '1k/earth.jpg' });
  });

  it('가까이 간 천체(와 이웃)는 고해상도로 바뀐다', async () => {
    const { tm, applied, bind, flush } = setup();
    await bind('mars', 'mars.jpg');
    await bind('jupiter', 'jupiter.jpg');
    await bind('saturn', 'saturn.jpg');
    tm.want(['mars', 'jupiter']);
    await flush();
    expect(applied['mars.jpg']).toBe('4k/mars.jpg');
    expect(applied['jupiter.jpg']).toBe('4k/jupiter.jpg');
    expect(applied['saturn.jpg']).toBe('1k/saturn.jpg');
    expect(tm.level('mars')).toBe('4k');
  });

  it('?quality=low이면 2K까지만 쓴다', async () => {
    const { tm, applied, bind, flush } = setup('2k');
    await bind('mars', 'mars.jpg');
    tm.want(['mars']);
    await flush();
    expect(applied['mars.jpg']).toBe('2k/mars.jpg');
  });

  it('멀어진 천체는 일정 시간 뒤 1K로 돌아가고 고해상도는 해제된다', async () => {
    const { tm, applied, disposed, bind, flush, advance } = setup();
    await bind('mars', 'mars.jpg');
    tm.want(['mars']);
    await flush();
    tm.want([]);
    advance(RELEASE_MS - 1);
    expect(applied['mars.jpg']).toBe('4k/mars.jpg');
    advance(1);
    expect(applied['mars.jpg']).toBe('1k/mars.jpg');
    expect(disposed).toEqual(['4k/mars.jpg']);
  });

  it('해제되기 전에 다시 가까이 가면 고해상도를 그대로 쓴다', async () => {
    const { tm, applied, disposed, bind, flush, advance } = setup();
    await bind('mars', 'mars.jpg');
    tm.want(['mars']);
    await flush();
    tm.want([]);
    advance(1000);
    tm.want(['mars']);
    advance(RELEASE_MS * 2);
    expect(applied['mars.jpg']).toBe('4k/mars.jpg');
    expect(disposed).toEqual([]);
  });

  it('받는 사이에 멀어진 질감은 끼우지 않고 버린다', async () => {
    const { tm, applied, disposed, bind, flush } = setup();
    await bind('mars', 'mars.jpg');
    tm.want(['mars']);
    tm.want([]);
    await flush();
    expect(applied['mars.jpg']).toBe('1k/mars.jpg');
    expect(disposed).toEqual(['4k/mars.jpg']);
  });
});
