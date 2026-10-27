// Minimal IndexedDB key-value store: the original audio file plus the project
// JSON are kept locally so a session survives reloads and works offline.

// Legacy name kept on purpose: renaming it would orphan projects already saved.
const DB = 'beatmaker';
const STORE = 'kv';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function get<T>(key: string): Promise<T | undefined> {
  try {
    return await tx<T>('readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function set(key: string, value: unknown): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(value, key));
  } catch (e) {
    console.warn('[simple-sample] no se pudo guardar', e);
  }
}

export async function del(key: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(key));
  } catch {
    /* ignore */
  }
}
