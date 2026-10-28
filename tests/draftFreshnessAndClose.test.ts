import { describe, it, expect } from "vitest";
import { evaluateDraftFreshness } from "../src/utils/draftFreshness";
import { Note, NoteDraftRecord } from "../src/types";
import { SaveQueue } from "../src/utils/saveQueue";

describe("Recovery Draft Freshness & Close Protection Edge Cases", () => {
  const baseNote: Note = {
    id: "note_freshness_test",
    title: "Saved Title",
    content: "Saved content paragraph.",
    blocks: [{ id: "b1", type: "text", content: "Saved content paragraph." }],
    color: "amber",
    isPinned: false,
    schemaVersion: 2,
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
  };

  describe("evaluateDraftFreshness", () => {
    it("returns false when draft is null or undefined", () => {
      expect(evaluateDraftFreshness(null, baseNote).isFresh).toBe(false);
      expect(evaluateDraftFreshness(undefined, baseNote).isFresh).toBe(false);
    });

    it("rejects draft that is older than the saved note", () => {
      const olderDraft: NoteDraftRecord = {
        id: baseNote.id,
        noteId: baseNote.id,
        title: "Older Draft Title",
        blocks: [{ id: "b1", type: "text", content: "Older text" }],
        updatedAt: "2026-10-24T11:59:59.000Z",
      };
      const result = evaluateDraftFreshness(olderDraft, baseNote);
      expect(result.isFresh).toBe(false);
      expect(result.reason).toBe("stale_timestamp");
    });

    it("rejects draft that has equal timestamp to the saved note", () => {
      const equalDraft: NoteDraftRecord = {
        id: baseNote.id,
        noteId: baseNote.id,
        title: "Saved Title",
        blocks: [{ id: "b1", type: "text", content: "Saved content paragraph." }],
        updatedAt: "2026-10-24T12:00:00.000Z",
      };
      const result = evaluateDraftFreshness(equalDraft, baseNote);
      expect(result.isFresh).toBe(false);
      expect(result.reason).toBe("stale_timestamp");
    });

    it("rejects draft that is newer but has identical content and title", () => {
      const identicalDraft: NoteDraftRecord = {
        id: baseNote.id,
        noteId: baseNote.id,
        title: "Saved Title",
        blocks: [{ id: "b1", type: "text", content: "Saved content paragraph." }],
        updatedAt: "2026-10-24T12:00:00.500Z", // 500ms newer
      };
      const result = evaluateDraftFreshness(identicalDraft, baseNote);
      expect(result.isFresh).toBe(false);
      expect(result.reason).toBe("identical_content");
    });

    it("accepts draft that is closely spaced (e.g. 5ms newer) with unsaved content edits", () => {
      // 5 milliseconds after save
      const closelySpacedDraft: NoteDraftRecord = {
        id: baseNote.id,
        noteId: baseNote.id,
        title: "Saved Title",
        blocks: [{ id: "b1", type: "text", content: "Saved content paragraph. With 5ms unsaved addition!" }],
        updatedAt: "2026-10-24T12:00:00.005Z",
      };
      const result = evaluateDraftFreshness(closelySpacedDraft, baseNote);
      expect(result.isFresh).toBe(true);
      expect(result.reason).toBe("newer_unsaved_edits");
    });

    it("accepts draft that is closely spaced (e.g. 50ms newer) with unsaved title edit", () => {
      const titleEditedDraft: NoteDraftRecord = {
        id: baseNote.id,
        noteId: baseNote.id,
        title: "New Unsaved Title",
        blocks: [{ id: "b1", type: "text", content: "Saved content paragraph." }],
        updatedAt: "2026-10-24T12:00:00.050Z",
      };
      const result = evaluateDraftFreshness(titleEditedDraft, baseNote);
      expect(result.isFresh).toBe(true);
      expect(result.reason).toBe("newer_unsaved_edits");
    });
  });

  describe("Close Protection & Debounce Flush Hooks", () => {
    it("executes registered flush hooks before queue drain during waitForPendingSaves", async () => {
      const queue = new SaveQueue();
      let flushHookExecuted = false;
      let finalSavedText = "";

      // Register an editor flush hook simulating an active debounce timer
      const unregister = queue.registerFlushHook(async () => {
        flushHookExecuted = true;
        await queue.enqueue(async () => {
          finalSavedText = "Flushed from active debounce before window close";
          return finalSavedText;
        });
      });

      expect(queue.isPending()).toBe(false);

      // Trigger close protection flush
      const success = await queue.waitForPendingSaves(2000);
      expect(success).toBe(true);
      expect(flushHookExecuted).toBe(true);
      expect(finalSavedText).toBe("Flushed from active debounce before window close");

      unregister();
    });

    it("returns false if a save fails during queue execution without silent destruction", async () => {
      const queue = new SaveQueue();

      const taskPromise = queue.enqueue(async () => {
        throw new Error("Simulated IndexedDB disk full or write failure");
      });
      // Attach catch handler so rejected promise is handled
      taskPromise.catch(() => {});

      const success = await queue.waitForPendingSaves(2000);
      // Must report failure so window does not silently destroy
      expect(success).toBe(false);
    });


    it("returns false if queue times out", async () => {
      const queue = new SaveQueue();

      queue.enqueue(async () => {
        // Hang longer than timeout
        await new Promise((r) => setTimeout(r, 600));
      });

      // Timeout with 100ms
      const success = await queue.waitForPendingSaves(100);
      expect(success).toBe(false);
    });
  });
});
