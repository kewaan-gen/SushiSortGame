/**
 * IndexedDB persistence for the Forge level library.
 *
 * Falls back to localStorage if IndexedDB is unavailable (private mode, old browsers).
 */

import { ForgeLevel } from './types';

const DB_NAME = 'kaizen_forge';
const DB_VERSION = 1;
const STORE = 'levels';
const LS_KEY = 'kaizen_forge_levels';

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// --- localStorage fallback ------------------------------------------------- //
function lsList(): ForgeLevel[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ForgeLevel[]) : [];
  } catch {
    return [];
  }
}
function lsWrite(levels: ForgeLevel[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(levels));
  } catch {
    /* ignore quota errors */
  }
}

// --- Public API ------------------------------------------------------------ //
export async function saveLevel(level: ForgeLevel): Promise<void> {
  if (!hasIndexedDB()) {
    const levels = lsList().filter((l) => l.id !== level.id);
    levels.push(level);
    lsWrite(levels);
    return;
  }
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(level);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listLevels(): Promise<ForgeLevel[]> {
  if (!hasIndexedDB()) {
    return lsList().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const levels = (req.result as ForgeLevel[]) ?? [];
      levels.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      resolve(levels);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLevel(id: string): Promise<ForgeLevel | undefined> {
  if (!hasIndexedDB()) {
    return lsList().find((l) => l.id === id);
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as ForgeLevel | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLevel(id: string): Promise<void> {
  if (!hasIndexedDB()) {
    lsWrite(lsList().filter((l) => l.id !== id));
    return;
  }
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
