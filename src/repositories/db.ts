// IndexedDB Local Database wrapper for DeskNest
const DB_NAME = "desknest_db";
const DB_VERSION = 2;

export const STORES = {
  NOTES: "notes",
  TASKS: "tasks",
  REMINDERS: "reminders",
  DRAWINGS: "drawings",
  SETTINGS: "settings",
  NOTIFICATIONS: "notifications",
  DRAFTS: "drafts",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Notes store
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const store = db.createObjectStore(STORES.NOTES, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("isPinned", "isPinned", { unique: false });
      }

      // Tasks store
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const store = db.createObjectStore(STORES.TASKS, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("dueAt", "dueAt", { unique: false });
        store.createIndex("priority", "priority", { unique: false });
      }

      // Reminders store
      if (!db.objectStoreNames.contains(STORES.REMINDERS)) {
        const store = db.createObjectStore(STORES.REMINDERS, { keyPath: "id" });
        store.createIndex("scheduledAt", "scheduledAt", { unique: false });
        store.createIndex("enabled", "enabled", { unique: false });
      }

      // Drawings store
      if (!db.objectStoreNames.contains(STORES.DRAWINGS)) {
        const store = db.createObjectStore(STORES.DRAWINGS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }

      // Notifications history store
      if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
        const store = db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: "id" });
        store.createIndex("triggeredAt", "triggeredAt", { unique: false });
      }

      // Durable recovery drafts store (lightweight)
      if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
        const store = db.createObjectStore(STORES.DRAFTS, { keyPath: "id" });
        store.createIndex("noteId", "noteId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };


    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGet<T>(storeName: string, id: string): Promise<T | null> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as T) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function dbPut<T>(storeName: string, item: T): Promise<T> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

export async function dbDelete(storeName: string, id: string): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbClear(storeName: string): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Atomic multi-store save spanning NOTES and DRAWINGS.
 * Either all writes (note and drawings) succeed, or all roll back.
 */
export async function dbBatchSaveNoteAndDrawings(
  note: any,
  drawingsToSave: any[] = [],
  drawingIdsToDelete: string[] = []
): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.NOTES, STORES.DRAWINGS], "readwrite");
    const noteStore = tx.objectStore(STORES.NOTES);
    const drawingStore = tx.objectStore(STORES.DRAWINGS);

    noteStore.put(note);

    for (const drawing of drawingsToSave) {
      drawingStore.put(drawing);
    }

    for (const drawId of drawingIdsToDelete) {
      drawingStore.delete(drawId);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

/**
 * Atomic multi-store delete for a note and its embedded drawings.
 */
export async function dbAtomicNoteDelete(
  noteId: string,
  drawingIdsToDelete: string[] = []
): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.NOTES, STORES.DRAWINGS], "readwrite");
    const noteStore = tx.objectStore(STORES.NOTES);
    const drawingStore = tx.objectStore(STORES.DRAWINGS);

    noteStore.delete(noteId);

    for (const drawId of drawingIdsToDelete) {
      drawingStore.delete(drawId);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

