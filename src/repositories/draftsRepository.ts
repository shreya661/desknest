import { NoteDraftRecord } from "../types";
import { dbDelete, dbGet, dbPut, dbClear, STORES } from "./db";

export const draftsRepository = {
  async saveDraft(draft: NoteDraftRecord): Promise<void> {
    try {
      await dbPut<NoteDraftRecord>(STORES.DRAFTS, draft);
    } catch (err) {
      console.warn("Could not write recovery draft to IndexedDB:", err);
    }
  },

  async getDraft(noteId: string): Promise<NoteDraftRecord | null> {
    try {
      return await dbGet<NoteDraftRecord>(STORES.DRAFTS, noteId);
    } catch (err) {
      console.warn("Could not retrieve recovery draft:", err);
      return null;
    }
  },

  async removeDraft(noteId: string): Promise<void> {
    try {
      await dbDelete(STORES.DRAFTS, noteId);
    } catch (err) {
      console.warn("Could not remove recovery draft:", err);
    }
  },

  async clear(): Promise<void> {
    try {
      await dbClear(STORES.DRAFTS);
    } catch (err) {
      console.warn("Could not clear recovery drafts:", err);
    }
  },
};
