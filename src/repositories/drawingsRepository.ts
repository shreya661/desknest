import { Drawing, DrawingStroke } from "../types";
import { dbClear, dbDelete, dbGet, dbGetAll, dbPut, STORES } from "./db";

export const drawingsRepository = {
  async list(): Promise<Drawing[]> {
    const drawings = await dbGetAll<Drawing>(STORES.DRAWINGS);
    return drawings.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getById(id: string): Promise<Drawing | null> {
    return dbGet<Drawing>(STORES.DRAWINGS, id);
  },

  async getByParentNoteId(noteId: string): Promise<Drawing[]> {
    const all = await this.list();
    return all.filter((d) => d.parentNoteId === noteId);
  },

  async create(data: {
    title?: string;
    strokes?: DrawingStroke[];
    thumbnail?: string | null;
    width?: number;
    height?: number;
    isEmbedded?: boolean;
    parentNoteId?: string;
  }): Promise<Drawing> {
    const now = new Date().toISOString();
    const drawing: Drawing = {
      id: "draw_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title: data.title?.trim() || "Untitled Sketch",
      documentVersion: 1,
      strokes: data.strokes || [],
      thumbnail: data.thumbnail || null,
      width: data.width || 800,
      height: data.height || 600,
      isEmbedded: data.isEmbedded,
      parentNoteId: data.parentNoteId,
      createdAt: now,
      updatedAt: now,
    };
    return dbPut<Drawing>(STORES.DRAWINGS, drawing);
  },

  async update(id: string, updates: Partial<Omit<Drawing, "id" | "createdAt">>): Promise<Drawing> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Drawing with id ${id} not found`);
    }
    const updated: Drawing = {
      ...existing,
      ...updates,
      documentVersion: existing.documentVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    return dbPut<Drawing>(STORES.DRAWINGS, updated);
  },

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (existing?.parentNoteId) {
      try {
        const parentNote = await dbGet<any>(STORES.NOTES, existing.parentNoteId);
        if (parentNote) {
          const remainingBlocks = parentNote.blocks?.filter(
            (b: any) => !(b.type === "drawing" && b.drawingId === id)
          );
          if (!remainingBlocks || remainingBlocks.length === 0) {
            await dbDelete(STORES.NOTES, parentNote.id);
          } else {
            await dbPut(STORES.NOTES, {
              ...parentNote,
              blocks: remainingBlocks,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn("Could not clean up parent note on drawing deletion:", err);
      }
    }
    return dbDelete(STORES.DRAWINGS, id);
  },

  async clear(): Promise<void> {
    return dbClear(STORES.DRAWINGS);
  },
};
