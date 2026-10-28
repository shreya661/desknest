import { describe, it, expect, beforeEach } from "vitest";
import { notesRepository } from "../src/repositories/notesRepository";
import { drawingsRepository } from "../src/repositories/drawingsRepository";
import { backupRepository } from "../src/repositories/backupRepository";
import { dbClear, STORES, dbPut, dbGetAll } from "../src/repositories/db";
import { Note, Drawing, DrawingStroke } from "../src/types";
import { SaveQueue } from "../src/utils/saveQueue";
import { translateStroke, resizeStroke, getStrokeBoundingBox } from "../src/utils/drawingGeometry";

describe("Unified Notebook and Sketch Canvas Integration", () => {
  beforeEach(async () => {
    await dbClear(STORES.NOTES);
    await dbClear(STORES.DRAWINGS);
    await dbClear(STORES.TASKS);
    await dbClear(STORES.REMINDERS);
    await dbClear(STORES.DRAFTS);
  });

  describe("Unified Data Model & Dual Entry Points", () => {
    it("creates a notebook containing both text blocks and embedded drawing blocks", async () => {
      // 1. Create drawing record
      const drawing = await drawingsRepository.create({
        title: "Architecture Diagram",
        strokes: [
          {
            id: "str_1",
            tool: "rectangle",
            points: [
              { x: 10, y: 10 },
              { x: 110, y: 70 },
            ],
            color: "#0284c7",
            width: 4,
          },
        ],
      });

      // 2. Create note with text before and after the drawing
      const note = await notesRepository.create({
        title: "Sprint Planning",
        blocks: [
          { id: "b_txt1", type: "text", content: "## System Overview\nHere is the proposed component layout:" },
          { id: "b_draw1", type: "drawing", drawingId: drawing.id, title: drawing.title, displayMode: "expanded" },
          { id: "b_txt2", type: "text", content: "### Next Steps\n- Implement data layer\n- Add automated tests" },
        ],
      });

      expect(note.id).toBeDefined();
      expect(note.blocks?.length).toBe(3);
      expect(note.blocks?.[1].type).toBe("drawing");
      expect((note.blocks?.[1] as any).drawingId).toBe(drawing.id);

      // Verify derived Markdown representation includes the drawing token
      expect(note.content).toContain(`![drawing:${drawing.id}](${drawing.title})`);
      expect(note.content).toContain("System Overview");
      expect(note.content).toContain("Next Steps");
    });

    it("creates a dedicated sketch notebook via createSketchNotebook with paired Note and Drawing", async () => {
      const { note, drawing } = await notesRepository.createSketchNotebook({
        title: "Brainstorming Wireframe",
        strokes: [
          {
            id: "str_circle",
            tool: "circle",
            points: [
              { x: 50, y: 50 },
              { x: 150, y: 150 },
            ],
            color: "#10b981",
            width: 4,
          },
        ],
      });

      expect(note.id).toBeDefined();
      expect(drawing.id).toBeDefined();
      expect(drawing.parentNoteId).toBe(note.id);
      expect(drawing.isEmbedded).toBe(true);
      expect(drawing.strokes.length).toBe(1);

      // The note's first block references the exact drawing ID
      expect(note.blocks?.length).toBe(1);
      expect(note.blocks?.[0].type).toBe("drawing");
      expect((note.blocks?.[0] as any).drawingId).toBe(drawing.id);

      // Verify reverse lookup
      const foundNote = await notesRepository.getByDrawingId(drawing.id);
      expect(foundNote).toBeDefined();
      expect(foundNote?.id).toBe(note.id);
    });

    it("resolves the same underlying drawing record from both standalone and embedded entry points", async () => {
      // Create sketch notebook
      const { note, drawing } = await notesRepository.createSketchNotebook({
        title: "Shared Canvas",
        strokes: [
          {
            id: "str_initial",
            tool: "pen",
            points: [
              { x: 10, y: 10 },
              { x: 20, y: 20 },
            ],
            color: "#0284c7",
            width: 4,
          },
        ],
      });

      // Edit drawing from standalone Sketch Canvas perspective
      const newStroke: DrawingStroke = {
        id: "str_arrow",
        tool: "arrow",
        points: [
          { x: 30, y: 30 },
          { x: 80, y: 80 },
        ],
        color: "#ef4444",
        width: 4,
      };
      await drawingsRepository.update(drawing.id, {
        strokes: [...drawing.strokes, newStroke],
      });

      // Retrieve via Note block reference
      const drawingRefId = (note.blocks?.[0] as any).drawingId;
      const reloadedDrawing = await drawingsRepository.getById(drawingRefId);

      expect(reloadedDrawing).toBeDefined();
      expect(reloadedDrawing?.strokes.length).toBe(2);
      expect(reloadedDrawing?.strokes[1].tool).toBe("arrow");
      expect(reloadedDrawing?.strokes[1].id).toBe("str_arrow");
    });
  });

  describe("Duplicate Prevention & Idempotent Migration", () => {
    it("idempotently adopts legacy orphan drawings into visual notebook notes without duplicates", async () => {
      // Simulate existing standalone drawings created before unification
      const legacyDrawing1: Drawing = {
        id: "draw_legacy_1",
        title: "Legacy Diagram 1",
        strokes: [],
        documentVersion: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const legacyDrawing2: Drawing = {
        id: "draw_legacy_2",
        title: "Legacy Diagram 2",
        strokes: [],
        documentVersion: 1,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      };

      await dbPut(STORES.DRAWINGS, legacyDrawing1);
      await dbPut(STORES.DRAWINGS, legacyDrawing2);

      // Run syncStandaloneDrawingsToNotes
      await notesRepository.syncStandaloneDrawingsToNotes();

      const allNotes = await notesRepository.list();
      expect(allNotes.length).toBe(2);

      const note1 = allNotes.find((n) => n.title === "Legacy Diagram 1");
      const note2 = allNotes.find((n) => n.title === "Legacy Diagram 2");
      expect(note1).toBeDefined();
      expect(note2).toBeDefined();
      expect((note1?.blocks?.[0] as any)?.drawingId).toBe("draw_legacy_1");
      expect((note2?.blocks?.[0] as any)?.drawingId).toBe("draw_legacy_2");

      // Verify drawings were linked with parentNoteId
      const d1 = await drawingsRepository.getById("draw_legacy_1");
      expect(d1?.parentNoteId).toBe(note1?.id);
      expect(d1?.isEmbedded).toBe(true);

      // Run sync AGAIN to verify strict idempotency - no duplicate notes created!
      await notesRepository.syncStandaloneDrawingsToNotes();
      const allNotesAfterSecondSync = await notesRepository.list();
      expect(allNotesAfterSecondSync.length).toBe(2);

      const allDrawings = await drawingsRepository.list();
      expect(allDrawings.length).toBe(2);
    });

    it("does not create duplicate notes when drawings are already referenced in multi-block notes", async () => {
      const standalone = await drawingsRepository.create({
        title: "Embedded In Report",
        strokes: [],
      });

      // A note already references this drawing
      await notesRepository.create({
        title: "Quarterly Report",
        blocks: [
          { id: "b1", type: "text", content: "Intro" },
          { id: "b2", type: "drawing", drawingId: standalone.id, title: standalone.title },
        ],
      });

      // Run sync
      await notesRepository.syncStandaloneDrawingsToNotes();

      // Ensure no second note was created for this drawing
      const notes = await notesRepository.list();
      expect(notes.length).toBe(1);
      expect(notes[0].title).toBe("Quarterly Report");
    });
  });

  describe("Lifecycle & Deletion Consistency", () => {
    it("deleting a dedicated sketch notebook cascade deletes its paired drawing", async () => {
      const { note, drawing } = await notesRepository.createSketchNotebook({
        title: "Temporary Scratchpad",
        strokes: [],
      });

      expect(await drawingsRepository.getById(drawing.id)).toBeDefined();

      // Delete note
      await notesRepository.delete(note.id);

      // Note is deleted
      expect(await notesRepository.getById(note.id)).toBeNull();

      // Paired drawing is also deleted
      expect(await drawingsRepository.getById(drawing.id)).toBeNull();
    });

    it("deleting a drawing unlinks or deletes the parent note safely", async () => {
      const { note, drawing } = await notesRepository.createSketchNotebook({
        title: "Pure Sketch Note",
        strokes: [],
      });

      // Delete via drawingsRepository
      await drawingsRepository.delete(drawing.id);

      expect(await drawingsRepository.getById(drawing.id)).toBeNull();
      // Since note only had this drawing block, it is also cleaned up
      expect(await notesRepository.getById(note.id)).toBeNull();
    });

    it("deleting a drawing referenced in a multi-block note leaves text blocks intact", async () => {
      const drawing = await drawingsRepository.create({
        title: "Sketch To Remove",
        strokes: [],
      });

      const note = await notesRepository.create({
        title: "Comprehensive Documentation",
        blocks: [
          { id: "tb1", type: "text", content: "Section 1: Architecture" },
          { id: "db1", type: "drawing", drawingId: drawing.id, title: drawing.title },
          { id: "tb2", type: "text", content: "Section 2: Implementation" },
        ],
      });

      // Set parentNoteId
      await drawingsRepository.update(drawing.id, { parentNoteId: note.id });

      // Delete the drawing
      await drawingsRepository.delete(drawing.id);

      const updatedNote = await notesRepository.getById(note.id);
      expect(updatedNote).toBeDefined();
      expect(updatedNote?.blocks?.length).toBe(2);
      expect(updatedNote?.blocks?.some((b) => b.type === "drawing")).toBe(false);
      expect(updatedNote?.content).toContain("Section 1");
      expect(updatedNote?.content).toContain("Section 2");
    });
  });

  describe("Drawing Geometry Transformations in Unified Blocks", () => {
    it("supports translation and resizing of shape objects in embedded drawings", () => {
      // Box shape stroke
      const boxStroke: DrawingStroke = {
        id: "shape_box",
        tool: "rectangle",
        points: [
          { x: 10, y: 10 },
          { x: 110, y: 90 },
        ],
        color: "#0284c7",
        width: 4,
      };

      // 1. Translation: Move by (+20, +30)
      const translated = translateStroke(boxStroke, 20, 30);
      expect(translated.points[0]).toEqual({ x: 30, y: 40 });
      expect(translated.points[1]).toEqual({ x: 130, y: 120 });

      // 2. Resize: Scale by factor of 2 horizontally and vertically
      const origBounds = getStrokeBoundingBox(translated);
      const newBounds = {
        minX: origBounds.minX,
        minY: origBounds.minY,
        maxX: origBounds.minX + origBounds.width * 2,
        maxY: origBounds.minY + origBounds.height * 2,
        width: origBounds.width * 2,
        height: origBounds.height * 2,
      };

      const resized = resizeStroke(translated, origBounds, newBounds);
      expect(resized.points[0]).toEqual({ x: 30, y: 40 });
      expect(resized.points[1]).toEqual({ x: 230, y: 200 });
    });

    it("supports deleting an individual stroke from an embedded drawing", async () => {
      const stroke1: DrawingStroke = { id: "s1", tool: "pen", points: [{ x: 5, y: 5 }, { x: 10, y: 10 }], color: "#000", width: 2 };
      const stroke2: DrawingStroke = { id: "s2", tool: "text", points: [{ x: 50, y: 50 }], text: "Label", color: "#000", width: 2 };

      const { drawing } = await notesRepository.createSketchNotebook({
        title: "Multi Stroke Sketch",
        strokes: [stroke1, stroke2],
      });

      expect(drawing.strokes.length).toBe(2);

      // Delete stroke 1
      const updatedStrokes = drawing.strokes.filter((s) => s.id !== "s1");
      const updatedDrawing = await drawingsRepository.update(drawing.id, {
        strokes: updatedStrokes,
      });

      expect(updatedDrawing.strokes.length).toBe(1);
      expect(updatedDrawing.strokes[0].id).toBe("s2");
      expect(updatedDrawing.strokes[0].text).toBe("Label");
    });
  });

  describe("SaveQueue and Concurrency Safety", () => {
    it("serializes concurrent drawing and note updates through SaveQueue without race conditions", async () => {
      const queue = new SaveQueue();
      const operations: string[] = [];

      const { note, drawing } = await notesRepository.createSketchNotebook({
        title: "Concurrent Note",
        strokes: [],
      });

      // Queue 3 interleaved updates
      await Promise.all([
        queue.enqueue(async () => {
          await drawingsRepository.update(drawing.id, {
            strokes: [{ id: "str_1", tool: "pen", points: [{ x: 1, y: 1 }], color: "#000", width: 2 }],
          });
          operations.push("drawing_update_1");
        }),
        queue.enqueue(async () => {
          await notesRepository.update(note.id, {
            title: "Updated Note Title",
          });
          operations.push("note_title_update");
        }),
        queue.enqueue(async () => {
          const current = await drawingsRepository.getById(drawing.id);
          await drawingsRepository.update(drawing.id, {
            strokes: [
              ...(current?.strokes || []),
              { id: "str_2", tool: "pen", points: [{ x: 2, y: 2 }], color: "#000", width: 2 },
            ],
          });
          operations.push("drawing_update_2");
        }),
      ]);

      expect(operations).toEqual(["drawing_update_1", "note_title_update", "drawing_update_2"]);

      const finalDrawing = await drawingsRepository.getById(drawing.id);
      expect(finalDrawing?.strokes.length).toBe(2);

      const finalNote = await notesRepository.getById(note.id);
      expect(finalNote?.title).toBe("Updated Note Title");
    });
  });

  describe("Backup and Restore Compatibility with Unified System", () => {
    it("exports and imports unified visual notebook and drawing records seamlessly", async () => {
      // Create rich notebook document
      const { note, drawing } = await notesRepository.createSketchNotebook({
        title: "Exported Sketch Note",
        strokes: [
          {
            id: "str_rect",
            tool: "rectangle",
            points: [
              { x: 15, y: 15 },
              { x: 85, y: 65 },
            ],
            color: "#0284c7",
            width: 4,
          },
        ],
      });

      // Export
      const backup = await backupRepository.exportAll();
      expect(backup.format).toBe("desknest-backup");
      expect(backup.version).toBe(2);
      expect(backup.notes.length).toBe(1);
      expect(backup.drawings.length).toBe(1);
      expect(backup.notes[0].id).toBe(note.id);
      expect(backup.drawings[0].id).toBe(drawing.id);

      // Clear database to simulate fresh install or new device
      await dbClear(STORES.NOTES);
      await dbClear(STORES.DRAWINGS);
      expect((await dbGetAll(STORES.NOTES)).length).toBe(0);
      expect((await dbGetAll(STORES.DRAWINGS)).length).toBe(0);

      // Import backup
      await backupRepository.importData(backup, "overwrite");

      // Verify restored records
      const restoredNotes = await notesRepository.list();
      const restoredDrawings = await drawingsRepository.list();

      expect(restoredNotes.length).toBe(1);
      expect(restoredDrawings.length).toBe(1);
      expect(restoredNotes[0].id).toBe(note.id);
      expect(restoredNotes[0].blocks?.[0].type).toBe("drawing");
      expect((restoredNotes[0].blocks?.[0] as any).drawingId).toBe(drawing.id);

      expect(restoredDrawings[0].id).toBe(drawing.id);
      expect(restoredDrawings[0].strokes.length).toBe(1);
      expect(restoredDrawings[0].strokes[0].tool).toBe("rectangle");
    });
  });
});
