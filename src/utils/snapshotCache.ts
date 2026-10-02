const DB_NAME = "payless-archive-cache";
const DB_VERSION = 1;
const STORE = "snapshots";
const MAX_ENTRIES = 200;

type SnapshotRow = { url: string; html: string; at: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "url" });
          store.createIndex("at", "at");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }
  return dbPromise;
}

export async function getCachedSnapshot(url: string): Promise<string | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => {
        const row = req.result as SnapshotRow | undefined;
        resolve(row?.html || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function putCachedSnapshot(
  url: string,
  html: string
): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.put({ url, html, at: Date.now() } satisfies SnapshotRow);
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result > MAX_ENTRIES) {
          evictOldest(store, countReq.result - MAX_ENTRIES);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    return;
  }
}

function evictOldest(store: IDBObjectStore, n: number) {
  const cursorReq = store.index("at").openCursor();
  let deleted = 0;
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor || deleted >= n) return;
    cursor.delete();
    deleted += 1;
    cursor.continue();
  };
}
