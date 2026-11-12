// IndexedDB Local Database wrapper for DeskNest
const DB_NAME = "desknest_db";
const DB_VERSION = 3; // v2 → v3: adds audio_blobs store; migrates inline audioData out of notes

export const STORES = {
  NOTES: "notes",
  TASKS: "tasks",
  REMINDERS: "reminders",
  DRAWINGS: "drawings",
  SETTINGS: "settings",
  NOTIFICATIONS: "notifications",
  DRAFTS: "drafts",
  AUDIO_BLOBS: "audio_blobs",
} as const;

/** Stored separately from notes so list() never loads multi-MB Base64 strings. */
export interface AudioBlobRecord {
  id: string;        // matches VoiceRecording.id on the note
  noteId: string;
  mimeType: string;
  data: string;      // Base64 data URL (audio/webm;codecs=opus or audio/webm)
  createdAt: number; // Unix timestamp (ms)
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction!;

      // ── Notes store ──────────────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const store = db.createObjectStore(STORES.NOTES, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("isPinned", "isPinned", { unique: false });
      }

      // ── Tasks store ──────────────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const store = db.createObjectStore(STORES.TASKS, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("dueAt", "dueAt", { unique: false });
        store.createIndex("priority", "priority", { unique: false });
      }

      // ── Reminders store ──────────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.REMINDERS)) {
        const store = db.createObjectStore(STORES.REMINDERS, { keyPath: "id" });
        store.createIndex("scheduledAt", "scheduledAt", { unique: false });
        store.createIndex("enabled", "enabled", { unique: false });
      }

      // ── Drawings store ───────────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.DRAWINGS)) {
        const store = db.createObjectStore(STORES.DRAWINGS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // ── Settings store ───────────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }

      // ── Notifications history store ──────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
        const store = db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: "id" });
        store.createIndex("triggeredAt", "triggeredAt", { unique: false });
      }

      // ── Durable recovery drafts store ────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
        const store = db.createObjectStore(STORES.DRAFTS, { keyPath: "id" });
        store.createIndex("noteId", "noteId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // ── Audio blobs store (NEW in v3) ────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.AUDIO_BLOBS)) {
        const store = db.createObjectStore(STORES.AUDIO_BLOBS, { keyPath: "id" });
        store.createIndex("noteId", "noteId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // ── v2 → v3 migration: hoist inline audioData out of notes ──────────
      // This runs only when upgrading from an existing v2 database.
      if (event.oldVersion < 3 && event.oldVersion >= 1) {
        try {
          const notesStore = tx.objectStore(STORES.NOTES);
          const audioBlobsStore = tx.objectStore(STORES.AUDIO_BLOBS);
          const getAllReq = notesStore.getAll();

          getAllReq.onsuccess = () => {
            const notes: any[] = getAllReq.result || [];
            for (const note of notes) {
              if (!Array.isArray(note.voiceRecordings) || note.voiceRecordings.length === 0) {
                continue;
              }

              let mutated = false;
              const updatedRecordings = note.voiceRecordings.map((rec: any) => {
                // Only migrate recordings that still carry inline audioData
                if (typeof rec.audioData === "string" && rec.audioData.length > 0) {
                  const blobRecord: AudioBlobRecord = {
                    id: rec.id,
                    noteId: note.id,
                    mimeType: rec.mimeType || "audio/webm",
                    data: rec.audioData,
                    createdAt: rec.createdAt
                      ? new Date(rec.createdAt).getTime()
                      : Date.now(),
                  };
                  audioBlobsStore.put(blobRecord);

                  mutated = true;
                  // Remove inline blob; keep metadata only
                  const { audioData: _dropped, ...rest } = rec;
                  return { ...rest };
                }
                return rec;
              });

              if (mutated) {
                notesStore.put({ ...note, voiceRecordings: updatedRecordings });
              }
            }
          };
        } catch (migErr) {
          console.warn("[DB v3 migration] Could not migrate audio blobs:", migErr);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Audio blob helpers (v3)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveAudioBlob(blob: AudioBlobRecord): Promise<void> {
  await dbPut<AudioBlobRecord>(STORES.AUDIO_BLOBS, blob);
}

export async function getAudioBlob(id: string): Promise<AudioBlobRecord | null> {
  return dbGet<AudioBlobRecord>(STORES.AUDIO_BLOBS, id);
}

export async function deleteAudioBlob(id: string): Promise<void> {
  await dbDelete(STORES.AUDIO_BLOBS, id);
}

/** Returns all audio blobs for a given noteId (used by backup). */
export async function getAudioBlobsByNoteId(noteId: string): Promise<AudioBlobRecord[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AUDIO_BLOBS, "readonly");
    const store = tx.objectStore(STORES.AUDIO_BLOBS);
    const index = store.index("noteId");
    const request = index.getAll(noteId);
    request.onsuccess = () => resolve(request.result as AudioBlobRecord[]);
    request.onerror = () => reject(request.error);
  });
}

/** Returns all audio blob records (used by backup export). */
export async function getAllAudioBlobs(): Promise<AudioBlobRecord[]> {
  return dbGetAll<AudioBlobRecord>(STORES.AUDIO_BLOBS);
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
