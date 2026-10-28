import { Note, NoteColor, NoteBlock, Drawing, DrawingBlock, DrawingStroke } from "../types";
import { dbClear, dbDelete, dbGet, dbGetAll, dbPut, STORES, dbBatchSaveNoteAndDrawings, dbAtomicNoteDelete } from "./db";
import { deriveNoteContent } from "../utils/blockSplitting";
import { drawingsRepository } from "./drawingsRepository";
import { draftsRepository } from "./draftsRepository";

export const notesRepository = {
  /**
   * Idempotently reconciles standalone drawings in STORES.DRAWINGS into unified
   * notebook documents so that All Notes and Sketch Canvas operate seamlessly
   * on the same underlying data without duplicates or orphan records.
   */
  async syncStandaloneDrawingsToNotes(): Promise<void> {
    try {
      const drawings = await dbGetAll<Drawing>(STORES.DRAWINGS);
      const notes = await dbGetAll<Note>(STORES.NOTES);

      const referencedDrawingIds = new Set<string>();
      for (const note of notes) {
        if (note.blocks) {
          for (const block of note.blocks) {
            if (block.type === "drawing" && block.drawingId) {
              referencedDrawingIds.add(block.drawingId);
            }
          }
        }
      }

      for (const drawing of drawings) {
        if (!referencedDrawingIds.has(drawing.id)) {
          const now = drawing.updatedAt || new Date().toISOString();
          const noteId = "note_" + drawing.id.replace(/^draw_/, "");
          const newNote: Note = {
            id: noteId,
            title: drawing.title || "Untitled Sketch",
            content: `[Drawing: ${drawing.title || "Untitled Sketch"}]`,
            blocks: [
              {
                id: "blk_" + drawing.id,
                type: "drawing",
                drawingId: drawing.id,
                title: drawing.title || "Untitled Sketch",
                displayMode: "expanded",
              },
            ],
            schemaVersion: 2,
            color: "sky",
            isPinned: false,
            createdAt: drawing.createdAt || now,
            updatedAt: now,
          };
          await dbPut<Note>(STORES.NOTES, newNote);
          await drawingsRepository.update(drawing.id, {
            parentNoteId: noteId,
            isEmbedded: true,
          });
          referencedDrawingIds.add(drawing.id);
        }
      }
    } catch (err) {
      console.warn("Could not sync standalone drawings to notes:", err);
    }
  },

  /**
   * Creates a dedicated visual sketch notebook containing an initial DrawingBlock.
   * Both the Note and the Drawing are persisted with stable cross-references.
   */
  async createSketchNotebook(data?: {
    title?: string;
    color?: NoteColor;
    strokes?: DrawingStroke[];
  }): Promise<{ note: Note; drawing: Drawing }> {
    const title = data?.title?.trim() || "Untitled Sketch";
    const noteId = "note_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const drawing = await drawingsRepository.create({
      title,
      strokes: data?.strokes || [],
      isEmbedded: true,
      parentNoteId: noteId,
    });

    const drawingBlock: DrawingBlock = {
      id: "blk_" + drawing.id,
      type: "drawing",
      drawingId: drawing.id,
      title,
      displayMode: "expanded",
    };

    const now = new Date().toISOString();
    const note: Note = {
      id: noteId,
      title,
      content: `[Drawing: ${title}]`,
      blocks: [drawingBlock],
      schemaVersion: 2,
      color: data?.color || "sky",
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    };

    await dbPut<Note>(STORES.NOTES, note);
    return { note, drawing };
  },

  async list(): Promise<Note[]> {
    const notes = await dbGetAll<Note>(STORES.NOTES);
    // Sort pinned first, then by updatedAt descending
    return notes.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },

  async getById(id: string): Promise<Note | null> {
    return dbGet<Note>(STORES.NOTES, id);
  },

  async create(data: {
    title?: string;
    content?: string;
    color?: NoteColor;
    isPinned?: boolean;
    blocks?: NoteBlock[];
  }): Promise<Note> {
    const now = new Date().toISOString();
    const id = "note_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    
    let canonicalBlocks: NoteBlock[];
    let derivedContent: string;

    if (data.blocks && data.blocks.length > 0) {
      canonicalBlocks = data.blocks;
      derivedContent = deriveNoteContent(data.blocks);
    } else {
      const initialContent = data.content || "";
      canonicalBlocks = [
        {
          id: "blk_" + id + "_txt",
          type: "text",
          content: initialContent,
        },
      ];
      derivedContent = initialContent;
    }

    const note: Note = {
      id,
      title: data.title?.trim() || "Untitled Note",
      content: derivedContent,
      blocks: canonicalBlocks,
      schemaVersion: 2,
      color: data.color || "amber",
      isPinned: !!data.isPinned,
      createdAt: now,
      updatedAt: now,
    };
    return dbPut<Note>(STORES.NOTES, note);
  },

  async update(id: string, updates: Partial<Omit<Note, "id" | "createdAt">>): Promise<Note> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Note with id ${id} not found`);
    }

    const updated: Note = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Refinement 4: Keep blocks authoritative for upgraded notes.
    // If caller provided new blocks:
    if (updates.blocks) {
      updated.blocks = updates.blocks;
      updated.schemaVersion = 2;
      updated.content = deriveNoteContent(updates.blocks);
    } else if (updates.content !== undefined) {
      // Content-only update from legacy caller:
      if (existing.blocks && existing.blocks.length > 0) {
        if (existing.blocks.length === 1 && existing.blocks[0].type === "text") {
          // Single text block: sync canonical block with the updated content
          updated.blocks = [{ ...existing.blocks[0], content: updates.content }];
          updated.content = updates.content;
        } else {
          // Multi-block document: preserve blocks as canonical to prevent accidental erasure of drawings!
          updated.blocks = existing.blocks;
          updated.content = deriveNoteContent(existing.blocks);
        }
      } else {
        // Upgrade legacy note without blocks to canonical block representation
        updated.blocks = [
          {
            id: "blk_" + id + "_txt",
            type: "text",
            content: updates.content,
          },
        ];
        updated.schemaVersion = 2;
      }
    }

    return dbPut<Note>(STORES.NOTES, updated);
  },

  /**
   * Saves a note and its embedded drawings in a single atomic IndexedDB transaction.
   */
  async saveNoteWithDrawings(
    note: Note,
    drawingsToSave: Drawing[] = [],
    drawingIdsToDelete: string[] = []
  ): Promise<Note> {
    const now = new Date().toISOString();
    const updatedNote: Note = {
      ...note,
      schemaVersion: 2,
      content: note.blocks ? deriveNoteContent(note.blocks) : note.content,
      updatedAt: now,
    };

    await dbBatchSaveNoteAndDrawings(updatedNote, drawingsToSave, drawingIdsToDelete);
    return updatedNote;
  },

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      return dbDelete(STORES.NOTES, id);
    }

    // Refinement 5: Deleting a note cascade deletes its embedded drawings,
    // while keeping standalone drawings from the Drawing Library completely intact.
    const embeddedIdsToDelete: string[] = [];
    if (existing.blocks) {
      for (const block of existing.blocks) {
        if (block.type === "drawing" && block.drawingId) {
          const drawing = await drawingsRepository.getById(block.drawingId);
          if (drawing && drawing.isEmbedded) {
            embeddedIdsToDelete.push(drawing.id);
          }
        }
      }
    }

    if (embeddedIdsToDelete.length > 0) {
      await dbAtomicNoteDelete(id, embeddedIdsToDelete);
    } else {
      await dbDelete(STORES.NOTES, id);
    }

    // Clean up any remaining recovery drafts for this note
    await draftsRepository.removeDraft(id);
  },

  async search(query: string): Promise<Note[]> {

    const notes = await this.list();
    if (!query.trim()) return notes;
    const lower = query.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(lower) || n.content.toLowerCase().includes(lower)
    );
  },

  async getByDrawingId(drawingId: string): Promise<Note | null> {
    const notes = await this.list();
    return (
      notes.find((n) =>
        n.blocks?.some((b) => b.type === "drawing" && b.drawingId === drawingId)
      ) || null
    );
  },

  async clear(): Promise<void> {
    return dbClear(STORES.NOTES);
  },
};

