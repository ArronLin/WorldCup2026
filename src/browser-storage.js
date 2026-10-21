export function createBrowserStorage(getStorage = () => window.localStorage) {
  return {
    read(key) {
      try { return { ok: true, value: getStorage().getItem(key) }; }
      catch { return { ok: false }; }
    },
    write(key, value) {
      try { getStorage().setItem(key, value); return { ok: true }; }
      catch { return { ok: false }; }
    },
  };
}

export const browserStorage = createBrowserStorage();
