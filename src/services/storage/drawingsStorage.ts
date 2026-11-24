import type { DrawingObject } from '../../types/drawings';

const DB_NAME = 'rm_chart_drawings_db';
const STORE_NAME = 'drawings_by_symbol';
const DB_VERSION = 1;
const LS_PREFIX = 'rm_chart:drawings:v1:';
const MAX_OBJECTS_PER_SYMBOL = 20;

const saveTimers = new Map<string, number>();

function openDrawingsDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }

    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'symbol' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readLocalFallback(symbol: string): DrawingObject[] {
  try {
    const raw = window.localStorage.getItem(`${LS_PREFIX}${symbol.toUpperCase()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DrawingObject[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFallback(symbol: string, items: DrawingObject[]): void {
  try {
    window.localStorage.setItem(
      `${LS_PREFIX}${symbol.toUpperCase()}`,
      JSON.stringify(items)
    );
  } catch {
    // Игнорируем переполнение хранилища
  }
}

export async function loadDrawingsForSymbol(symbol: string): Promise<DrawingObject[]> {
  const key = symbol.toUpperCase();
  const db = await openDrawingsDb();

  if (!db) {
    return readLocalFallback(key).slice(0, MAX_OBJECTS_PER_SYMBOL);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as { symbol: string; items?: DrawingObject[] } | undefined;
        const list = Array.isArray(record?.items)
          ? record.items.slice(0, MAX_OBJECTS_PER_SYMBOL)
          : readLocalFallback(key).slice(0, MAX_OBJECTS_PER_SYMBOL);
        resolve(list);
      };
      req.onerror = () => resolve(readLocalFallback(key).slice(0, MAX_OBJECTS_PER_SYMBOL));
    } catch {
      resolve(readLocalFallback(key).slice(0, MAX_OBJECTS_PER_SYMBOL));
    }
  });
}

export async function persistDrawingsNow(
  symbol: string,
  items: DrawingObject[]
): Promise<void> {
  const key = symbol.toUpperCase();
  const bounded = items.slice(0, MAX_OBJECTS_PER_SYMBOL);
  writeLocalFallback(key, bounded);

  const db = await openDrawingsDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ symbol: key, items: bounded });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function scheduleDrawingsSave(
  symbol: string,
  items: DrawingObject[],
  delayMs = 250
): void {
  const key = symbol.toUpperCase();
  const existing = saveTimers.get(key);
  if (existing !== undefined) {
    window.clearTimeout(existing);
  }

  const timerId = window.setTimeout(() => {
    saveTimers.delete(key);
    void persistDrawingsNow(key, items);
  }, delayMs);

  saveTimers.set(key, timerId);
}