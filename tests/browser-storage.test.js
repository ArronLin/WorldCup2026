import { describe, it, expect, vi } from 'vitest';
import { createBrowserStorage } from '../src/browser-storage.js';

describe('safe browser storage', () => {
  it('reads missing and present values, and writes only the requested key', () => {
    const values = new Map();
    const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
    const adapter = createBrowserStorage(() => storage);
    expect(adapter.read('follow')).toEqual({ ok: true, value: null });
    expect(adapter.write('follow','saved')).toEqual({ ok: true });
    expect(adapter.read('follow')).toEqual({ ok: true, value: 'saved' });
    expect([...values.keys()]).toEqual(['follow']);
  });
  it('contains access, read and write exceptions', () => {
    const denied = () => { throw new Error('denied'); };
    for (const getStorage of [denied, () => ({ getItem: denied, setItem: denied })]) {
      const adapter = createBrowserStorage(getStorage);
      expect(adapter.read('x')).toEqual({ ok: false });
      expect(adapter.write('x','v')).toEqual({ ok: false });
    }
  });
  it('does not acquire storage until an operation occurs', () => {
    const getStorage = vi.fn(() => ({ getItem: () => null, setItem: () => {} }));
    const adapter = createBrowserStorage(getStorage);
    expect(getStorage).not.toHaveBeenCalled();
    adapter.read('x');
    expect(getStorage).toHaveBeenCalledOnce();
  });
});
