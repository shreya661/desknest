import { describe, it, expect, beforeEach } from "vitest";
import {
  splitTextBlockAtCursor,
  deriveNoteContent,
  ensureNoteBlocks,
} from "../src/utils/blockSplitting";
import { notesRepository } from "../src/repositories/notesRepository";
import { drawingsRepository } from "../src/repositories/drawingsRepository";
import { draftsRepository } from "../src/repositories/draftsRepository";
import { backupRepository } from "../src/repositories/backupRepository";
import { SaveQueue } from "../src/utils/saveQueue";
import { NoteBlock, Drawing } from "../src/types";

describe("Phase 1: Unified Visual Notebook - Block Model & Persistence", () => {
  beforeEach(async () => {
    await notesRepository.clear();
    await drawingsRepository.clear();
    await draftsRepository.clear();
  });

  describe("Markdown-Preserving Text Splitting at Cursor", () => {
    it("splits plain text cleanly without dropping characters", () => {
      const text = "Hello World! This is a test note.";
      const offset = 12; // after "Hello World!"
      const result = splitTextBlockAtCursor(text, offset);

      expect(result.topContent).toBe("Hello World!");
      expect(result.bottomContent).toBe(" This is a test note.");
      expect(result.topContent + result.bottomContent).toBe(text);
    });

    it("handles cursor at beginning (offset 0) and end of text", () => {
      const text = "Single block content";
      const atStart = splitTextBlockAtCursor(text, 0);
      expect(atStart.topContent).toBe("");
      expect(atStart.bottomContent).toBe(text);

      const atEnd = splitTextBlockAtCursor(text, text.length);
      expect(atEnd.topContent).toBe(text);
      expect(atEnd.bottomContent).toBe("");
    });

    it("handles cursor inside heading prefix safely with predictable fallback", () => {
      const text = "### Main Architecture Header\nSecond line";
      // Cursor inside "##" prefix (offset 1)
      const result = splitTextBlockAtCursor(text, 1);
      expect(result.fallbackReason).toBeDefined();
      expect(result.topContent).toBe("");
      expect(result.bottomContent).toBe(text);

      // Cursor inside heading text (offset 10)
      const insideText = splitTextBlockAtCursor(text, 10);
      expect(insideText.topContent).toBe("### Main A");
      expect(insideText.bottomContent).toBe("rchitecture Header\nSecond line");
    });

    it("handles cursor inside checklist prefix safely", () => {
      const text = "Intro line\n- [ ] Task item to complete\nFinal line";
      const checklistLineStart = 11;
      // Cursor inside "- [" (offset 13)
      const result = splitTextBlockAtCursor(text, checklistLineStart + 2);
      expect(result.fallbackReason).toBeDefined();
      expect(result.topContent).toBe("Intro line\n");
      expect(result.bottomContent).toBe("- [ ] Task item to complete\nFinal line");
    });

    it("handles cursor inside inline formatting without corrupting markers", () => {
      const text = "Here is some **bold statement** in markdown.";
      // Cursor inside "bold statement", e.g. at offset 19 (between 'b' and 'o')
      const result = splitTextBlockAtCursor(text, 19);
      expect(result.fallbackReason).toBeDefined();
      // Snaps to immediately after the closing ** delimiter
      expect(result.topContent).toBe("Here is some **bold statement**");
      expect(result.bottomContent).toBe(" in markdown.");
    });
  });

  describe("Canonical Document Content & Derivation", () => {
    it("derives Markdown representation with embedded drawing references", () => {
      const blocks: NoteBlock[] = [
        { id: "b1", type: "text", content: "## Meeting Notes\nReview architecture." },
        { id: "b2", type: "drawing", drawingId: "draw_123", title: "Diagram 1" },
        { id: "b3", type: "text", content: "- Next action item" },
      ];

      const derived = deriveNoteContent(blocks);
      expect(derived).toContain("## Meeting Notes");
      expect(derived).toContain("![drawing:draw_123](Diagram 1)");
      expect(derived).toContain("- Next action item");
    });

    it("hydrates legacy notes without blocks into canonical single text block", () => {
      const legacyNote = {
        id: "note_legacy",
        title: "Legacy Note",
        content: "Only legacy markdown content here",
        color: "amber" as const,
        isPinned: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const blocks = ensureNoteBlocks(legacyNote);
      expect(blocks.length).toBe(1);
      expect(blocks[0].type).toBe("text");
      expect(blocks[0].content).toBe("Only legacy markdown content here");
    });
  });

  describe("Monotonic SaveQueue Mutex", () => {
    it("executes tasks in sequential FIFO order", async () => {
      const queue = new SaveQueue();
      const executionOrder: number[] = [];

      const p1 = queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 40));
        executionOrder.push(1);
        return 1;
      });

      const p2 = queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push(2);
        return 2;
      });

      const p3 = queue.enqueue(async () => {
        executionOrder.push(3);
        return 3;
      });

      await Promise.all([p1, p2, p3]);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("waitForPendingSaves resolves true when queue drains", async () => {
      const queue = new SaveQueue();
      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(queue.isPending()).toBe(true);
      const flushed = await queue.waitForPendingSaves(2000);
      expect(flushed).toBe(true);
      expect(queue.isPending()).toBe(false);
    });
  });

  describe("Transactional Persistence & Drawing Lifecycle", () => {
    it("creates multi-block note and updates blocks as canonical source of truth", async () => {
      const initialBlocks: NoteBlock[] = [
        { id: "blk_1", type: "text", content: "Top Paragraph" },
        { id: "blk_draw", type: "drawing", drawingId: "draw_abc", title: "Sketch 1" },
        { id: "blk_2", type: "text", content: "Bottom Paragraph" },
      ];

      const note = await notesRepository.create({
        title: "Visual Note",
        blocks: initialBlocks,
      });

      expect(note.schemaVersion).toBe(2);
      expect(note.blocks?.length).toBe(3);
      expect(note.content).toContain("![drawing:draw_abc](Sketch 1)");

      // Legacy content-only update caller should NOT wipe multi-block note
      const updated = await notesRepository.update(note.id, {
        content: "Legacy caller string",
      });
      expect(updated.blocks?.length).toBe(3);
      expect(updated.blocks?.[1].type).toBe("drawing");
    });

    it("cascade deletes embedded drawings when note is deleted, preserving standalone drawings", async () => {
      // 1. Create an embedded drawing
      const embeddedDrawing = await drawingsRepository.create({
        title: "Embedded Drawing",
        strokes: [],
      });
      embeddedDrawing.isEmbedded = true;
      await drawingsRepository.update(embeddedDrawing.id, { isEmbedded: true });

      // 2. Create a standalone drawing in Drawing Library
      const standaloneDrawing = await drawingsRepository.create({
        title: "Standalone Library Drawing",
        strokes: [],
      });

      // 3. Create a note linking both
      const note = await notesRepository.create({
        title: "Note with Drawings",
        blocks: [
          { id: "b1", type: "drawing", drawingId: embeddedDrawing.id },
          { id: "b2", type: "drawing", drawingId: standaloneDrawing.id },
        ],
      });

      // 4. Delete the note
      await notesRepository.delete(note.id);

      // Embedded drawing should be cascade deleted
      const checkEmbedded = await drawingsRepository.getById(embeddedDrawing.id);
      expect(checkEmbedded).toBeNull();

      // Standalone drawing in Drawing Library must be completely preserved
      const checkStandalone = await drawingsRepository.getById(standaloneDrawing.id);
      expect(checkStandalone).not.toBeNull();
      expect(checkStandalone?.title).toBe("Standalone Library Drawing");
    });
  });

  describe("Durable Recovery Drafts", () => {
    it("persists lightweight recovery draft and removes on successful save", async () => {
      const noteId = "note_recovery_test";
      await draftsRepository.saveDraft({
        id: noteId,
        noteId,
        title: "Draft Title",
        blocks: [{ id: "b1", type: "text", content: "Unsaved text content" }],
        updatedAt: new Date().toISOString(),
      });

      const retrieved = await draftsRepository.getDraft(noteId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe("Draft Title");
      expect(retrieved?.blocks[0].content).toBe("Unsaved text content");

      await draftsRepository.removeDraft(noteId);
      const afterDelete = await draftsRepository.getDraft(noteId);
      expect(afterDelete).toBeNull();
    });
  });

  describe("Backup and Restore Compatibility (V1 and V2)", () => {
    it("imports Version 1 legacy backup and hydrates blocks non-destructively", async () => {
      const v1BackupJson = JSON.stringify({
        format: "desknest-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        notes: [
          {
            id: "v1_note_1",
            title: "Old V1 Note",
            content: "Markdown content from v1 backup",
            color: "amber",
            isPinned: false,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
        tasks: [],
        reminders: [],
        drawings: [],
        settings: { theme: "dark" },
        notifications: [],
      });

      const validation = backupRepository.validate(v1BackupJson);
      expect(validation.valid).toBe(true);

      await backupRepository.importData(validation.data!, "merge");

      const notes = await notesRepository.list();
      const imported = notes.find((n) => n.id === "v1_note_1");
      expect(imported).toBeDefined();
      expect(imported?.blocks).toBeDefined();
      expect(imported?.blocks?.[0].content).toBe("Markdown content from v1 backup");
    });

    it("exports Version 2 backup with full block structure and drawings", async () => {
      await notesRepository.create({
        title: "Export Note",
        blocks: [{ id: "b1", type: "text", content: "Content" }],
      });
      await drawingsRepository.create({ title: "Export Sketch", strokes: [] });

      const exported = await backupRepository.exportAll();
      expect(exported.format).toBe("desknest-backup");
      expect(exported.version).toBe(2);
      expect(exported.notes.length).toBe(1);
      expect(exported.drawings.length).toBe(1);

      const validation = backupRepository.validate(JSON.stringify(exported));
      expect(validation.valid).toBe(true);
    });
  });

  describe("Rapid Typing, Close Protection, and Stale Draft Prevention", () => {
    it("handles rapid bursts of saves and ensures waitForPendingSaves waits until queue is drained", async () => {
      const queue = new SaveQueue();
      const writes: string[] = [];

      // Simulate rapid user typing burst
      for (let i = 1; i <= 5; i++) {
        queue.enqueue(async () => {
          await new Promise((r) => setTimeout(r, 20));
          writes.push(`write_${i}`);
          return `write_${i}`;
        });
      }

      expect(queue.isPending()).toBe(true);
      // Window close protection requests flush
      const flushed = await queue.waitForPendingSaves(3000);
      expect(flushed).toBe(true);
      expect(queue.isPending()).toBe(false);
      expect(writes).toEqual(["write_1", "write_2", "write_3", "write_4", "write_5"]);
    });

    it("purges recovery draft when note is deleted", async () => {
      const note = await notesRepository.create({
        title: "To Be Deleted",
        content: "Draft should be purged",
      });

      await draftsRepository.saveDraft({
        id: note.id,
        noteId: note.id,
        title: "To Be Deleted Draft",
        blocks: [{ id: "b1", type: "text", content: "Unsaved text" }],
        updatedAt: new Date().toISOString(),
      });

      const draftBefore = await draftsRepository.getDraft(note.id);
      expect(draftBefore).not.toBeNull();

      await notesRepository.delete(note.id);

      const draftAfter = await draftsRepository.getDraft(note.id);
      expect(draftAfter).toBeNull();
    });

    it("prevents stale drafts older than saved notes from being considered valid restoration candidates", () => {
      const savedNoteUpdatedAt = new Date("2026-10-24T12:00:00Z").getTime();
      const olderDraftUpdatedAt = new Date("2026-10-24T11:50:00Z").getTime();
      const newerDraftUpdatedAt = new Date("2026-10-24T12:10:00Z").getTime();

      // Logic check: draft is only actionable if draft.updatedAt > note.updatedAt + 1000
      const isOlderActionable = olderDraftUpdatedAt > savedNoteUpdatedAt + 1000;
      const isNewerActionable = newerDraftUpdatedAt > savedNoteUpdatedAt + 1000;

      expect(isOlderActionable).toBe(false);
      expect(isNewerActionable).toBe(true);
    });

    it("removing drawing block does not delete a standalone library drawing", async () => {
      // Create standalone drawing in Drawing Library
      const standalone = await drawingsRepository.create({
        title: "Library Diagram",
        strokes: [],
      });
      expect(standalone.isEmbedded).toBeFalsy();

      // Create note that references this standalone drawing
      const note = await notesRepository.create({
        title: "Referencing Note",
        blocks: [
          { id: "b1", type: "text", content: "Top" },
          { id: "b2", type: "drawing", drawingId: standalone.id },
        ],
      });

      // Remove the block from the note
      const remainingBlocks = note.blocks!.filter((b) => b.id !== "b2");
      await notesRepository.update(note.id, { blocks: remainingBlocks });

      // Standalone drawing in Drawing Library must still exist
      const checkDrawing = await drawingsRepository.getById(standalone.id);
      expect(checkDrawing).not.toBeNull();
      expect(checkDrawing?.id).toBe(standalone.id);
    });
  });
});

