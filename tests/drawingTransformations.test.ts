import { describe, it, expect, beforeEach } from "vitest";
import {
  BoundingBox,
  getStrokeBoundingBox,
  distanceToSegment,
  isPointNearStroke,
  getBoundingBoxHandles,
  getHoveredHandle,
  translateStroke,
  resizeStroke,
  computeResizedBox,
  getHandleCursor,
} from "../src/utils/drawingGeometry";
import { DrawingStroke } from "../src/types";
import { drawingsRepository } from "../src/repositories/drawingsRepository";
import { notesRepository } from "../src/repositories/notesRepository";
import { draftsRepository } from "../src/repositories/draftsRepository";
import { SaveQueue } from "../src/utils/saveQueue";

describe("Phase 2: Drawing Selection and Transformations", () => {
  beforeEach(async () => {
    await drawingsRepository.clear();
    await notesRepository.clear();
    await draftsRepository.clear();
  });

  describe("Bounding Box Calculation", () => {
    it("calculates accurate bounding box for a multi-point pen stroke matching exact point extents", () => {
      const stroke: DrawingStroke = {
        id: "stroke_1",
        tool: "pen",
        color: "#000000",
        width: 4,
        points: [
          { x: 10, y: 20 },
          { x: 50, y: 80 },
          { x: 100, y: 40 },
        ],
      };

      const box = getStrokeBoundingBox(stroke);

      expect(box.minX).toBe(10);
      expect(box.minY).toBe(20);
      expect(box.maxX).toBe(100);
      expect(box.maxY).toBe(80);
      expect(box.width).toBe(90);
      expect(box.height).toBe(60);
    });

    it("ensures minimum 8px dimensions for single-point or zero-area strokes", () => {
      const singlePointStroke: DrawingStroke = {
        id: "stroke_pt",
        tool: "pen",
        color: "#000000",
        width: 2,
        points: [{ x: 50, y: 50 }],
      };

      const box = getStrokeBoundingBox(singlePointStroke);
      expect(box.width).toBeGreaterThanOrEqual(8);
      expect(box.height).toBeGreaterThanOrEqual(8);
      expect(box.minX).toBe(46);
      expect(box.maxX).toBe(54);
      expect(box.minY).toBe(46);
      expect(box.maxY).toBe(54);
    });

    it("ensures minimum 8px width for purely vertical lines", () => {
      const verticalLine: DrawingStroke = {
        id: "vert_line",
        tool: "line",
        color: "#0284c7",
        width: 2,
        points: [
          { x: 100, y: 20 },
          { x: 100, y: 120 },
        ],
      };

      const box = getStrokeBoundingBox(verticalLine);
      expect(box.width).toBe(8);
      expect(box.height).toBe(100);
      expect(box.minX).toBe(96);
      expect(box.maxX).toBe(104);
      expect(box.minY).toBe(20);
      expect(box.maxY).toBe(120);
    });

    it("ensures minimum 8px height for purely horizontal lines", () => {
      const horizLine: DrawingStroke = {
        id: "horiz_line",
        tool: "line",
        color: "#0284c7",
        width: 2,
        points: [
          { x: 20, y: 80 },
          { x: 180, y: 80 },
        ],
      };

      const box = getStrokeBoundingBox(horizLine);
      expect(box.width).toBe(160);
      expect(box.height).toBe(8);
      expect(box.minX).toBe(20);
      expect(box.maxX).toBe(180);
      expect(box.minY).toBe(76);
      expect(box.maxY).toBe(84);
    });

    it("calculates text stroke bounding box with exact origin matching", () => {
      const textStroke: DrawingStroke = {
        id: "text_1",
        tool: "text",
        color: "#0284c7",
        width: 4,
        points: [{ x: 30, y: 40 }],
        text: "Architecture Spec",
        fontSize: 20,
      };

      const box = getStrokeBoundingBox(textStroke);
      expect(box.minX).toBe(30);
      expect(box.minY).toBe(40);
      expect(box.width).toBeGreaterThan(100);
      expect(box.height).toBeGreaterThanOrEqual(20);
    });

    it("handles empty points safely", () => {
      const emptyStroke: DrawingStroke = {
        id: "empty",
        tool: "pen",
        color: "#000000",
        width: 2,
        points: [],
      };

      const box = getStrokeBoundingBox(emptyStroke);
      expect(box.width).toBe(0);
      expect(box.height).toBe(0);
    });
  });

  describe("Distance and Hit-Testing", () => {
    it("calculates distance from point to line segment accurately", () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 0 };

      // Point directly on segment
      expect(distanceToSegment({ x: 5, y: 0 }, a, b)).toBe(0);

      // Point perpendicular to midpoint
      expect(distanceToSegment({ x: 5, y: 5 }, a, b)).toBe(5);

      // Point beyond end of segment (clamps to b)
      expect(distanceToSegment({ x: 14, y: 0 }, a, b)).toBe(4);

      // Point before start of segment (clamps to a)
      expect(distanceToSegment({ x: -3, y: 0 }, a, b)).toBe(3);
    });

    it("hit-tests polyline pen strokes within tolerance and rejects points far away", () => {
      const stroke: DrawingStroke = {
        id: "s1",
        tool: "pen",
        color: "#000000",
        width: 4,
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 60 },
        ],
      };

      // Near first segment
      expect(isPointNearStroke(stroke, { x: 25, y: 12 }, 6)).toBe(true);

      // Near second segment
      expect(isPointNearStroke(stroke, { x: 52, y: 35 }, 6)).toBe(true);

      // Far away
      expect(isPointNearStroke(stroke, { x: 200, y: 200 }, 6)).toBe(false);

      // Between segments but inside corner
      expect(isPointNearStroke(stroke, { x: 10, y: 50 }, 4)).toBe(false);
    });

    it("hit-tests rectangle strokes both inside bounds and on border", () => {
      const rectStroke: DrawingStroke = {
        id: "rect_1",
        tool: "rectangle",
        color: "#0284c7",
        width: 2,
        points: [
          { x: 20, y: 20 },
          { x: 120, y: 80 },
        ],
      };

      // Inside rectangle
      expect(isPointNearStroke(rectStroke, { x: 50, y: 50 })).toBe(true);

      // Along the edge
      expect(isPointNearStroke(rectStroke, { x: 20, y: 50 })).toBe(true);
      expect(isPointNearStroke(rectStroke, { x: 120, y: 80 })).toBe(true);

      // Outside rectangle
      expect(isPointNearStroke(rectStroke, { x: 5, y: 5 })).toBe(false);
      expect(isPointNearStroke(rectStroke, { x: 150, y: 100 })).toBe(false);
    });

    it("hit-tests circular strokes correctly", () => {
      const circleStroke: DrawingStroke = {
        id: "circle_1",
        tool: "circle",
        color: "#059669",
        width: 2,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      };

      // Center is (50, 50), radius is 50
      expect(isPointNearStroke(circleStroke, { x: 50, y: 50 })).toBe(true);
      expect(isPointNearStroke(circleStroke, { x: 50, y: 90 })).toBe(true);

      // Point at (120, 120) is outside the circle
      expect(isPointNearStroke(circleStroke, { x: 120, y: 120 }, 4)).toBe(false);
    });

    it("hit-tests line and arrow strokes along their trajectories", () => {
      const arrowStroke: DrawingStroke = {
        id: "arrow_1",
        tool: "arrow",
        color: "#ef4444",
        width: 4,
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 90 },
        ],
      };

      expect(isPointNearStroke(arrowStroke, { x: 50, y: 50 }, 6)).toBe(true);
      expect(isPointNearStroke(arrowStroke, { x: 10, y: 90 }, 6)).toBe(false);
    });

    it("hit-tests text strokes within their bounding box including tolerance", () => {
      const textStroke: DrawingStroke = {
        id: "text_1",
        tool: "text",
        color: "#000",
        width: 2,
        points: [{ x: 50, y: 50 }],
        text: "Sample Label",
        fontSize: 16,
      };

      expect(isPointNearStroke(textStroke, { x: 55, y: 55 })).toBe(true);
      expect(isPointNearStroke(textStroke, { x: 10, y: 10 })).toBe(false);
    });
  });

  describe("Selection Handles and Cursor Mapping", () => {
    it("generates 8 distinct bounding box resize handles", () => {
      const box: BoundingBox = {
        minX: 10,
        minY: 20,
        maxX: 110,
        maxY: 80,
        width: 100,
        height: 60,
      };

      const handles = getBoundingBoxHandles(box);
      expect(handles).toHaveLength(8);

      const handleTypes = handles.map((h) => h.handle);
      expect(handleTypes).toEqual(["nw", "n", "ne", "e", "se", "s", "sw", "w"]);

      // Verify corner coordinates
      expect(handles.find((h) => h.handle === "nw")).toEqual({ handle: "nw", x: 10, y: 20 });
      expect(handles.find((h) => h.handle === "se")).toEqual({ handle: "se", x: 110, y: 80 });
      expect(handles.find((h) => h.handle === "n")).toEqual({ handle: "n", x: 60, y: 20 });
    });

    it("detects hovered handles correctly within radius", () => {
      const box: BoundingBox = {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
        width: 100,
        height: 100,
      };

      // Exact SE handle (100, 100)
      expect(getHoveredHandle(box, { x: 100, y: 100 })).toBe("se");

      // Within radius of NW handle (0, 0)
      expect(getHoveredHandle(box, { x: 3, y: 2 }, 6)).toBe("nw");

      // Middle of bounding box - no handle
      expect(getHoveredHandle(box, { x: 50, y: 50 })).toBeNull();
    });

    it("maps resize handles to correct CSS cursor styles", () => {
      expect(getHandleCursor("nw")).toBe("nwse-resize");
      expect(getHandleCursor("se")).toBe("nwse-resize");
      expect(getHandleCursor("ne")).toBe("nesw-resize");
      expect(getHandleCursor("sw")).toBe("nesw-resize");
      expect(getHandleCursor("n")).toBe("ns-resize");
      expect(getHandleCursor("s")).toBe("ns-resize");
      expect(getHandleCursor("e")).toBe("ew-resize");
      expect(getHandleCursor("w")).toBe("ew-resize");
    });
  });

  describe("Transformations: Translation and Resizing", () => {
    it("translates stroke points accurately by (dx, dy)", () => {
      const originalStroke: DrawingStroke = {
        id: "stroke_move",
        tool: "pen",
        color: "#0284c7",
        width: 3,
        points: [
          { x: 10, y: 20, pressure: 0.8 },
          { x: 30, y: 40, pressure: 0.5 },
        ],
      };

      const translated = translateStroke(originalStroke, 25, -10);

      expect(translated.id).toBe(originalStroke.id);
      expect(translated.tool).toBe("pen");
      expect(translated.color).toBe("#0284c7");
      expect(translated.points[0]).toEqual({ x: 35, y: 10, pressure: 0.8 });
      expect(translated.points[1]).toEqual({ x: 55, y: 30, pressure: 0.5 });
    });

    it("computes resized bounding boxes from all cardinal and diagonal handles", () => {
      const orig: BoundingBox = {
        minX: 20,
        minY: 20,
        maxX: 100,
        maxY: 100,
        width: 80,
        height: 80,
      };

      // SE handle
      const se = computeResizedBox(orig, "se", { x: 150, y: 160 });
      expect(se.width).toBe(130);
      expect(se.height).toBe(140);

      // NW handle
      const nw = computeResizedBox(orig, "nw", { x: 40, y: 50 });
      expect(nw.minX).toBe(40);
      expect(nw.minY).toBe(50);
      expect(nw.width).toBe(60);
      expect(nw.height).toBe(50);

      // N handle
      const n = computeResizedBox(orig, "n", { x: 60, y: 10 });
      expect(n.minY).toBe(10);
      expect(n.maxY).toBe(100);
      expect(n.height).toBe(90);

      // S handle
      const s = computeResizedBox(orig, "s", { x: 60, y: 150 });
      expect(s.minY).toBe(20);
      expect(s.maxY).toBe(150);
      expect(s.height).toBe(130);

      // E handle
      const e = computeResizedBox(orig, "e", { x: 140, y: 60 });
      expect(e.minX).toBe(20);
      expect(e.maxX).toBe(140);
      expect(e.width).toBe(120);

      // W handle
      const w = computeResizedBox(orig, "w", { x: 10, y: 60 });
      expect(w.minX).toBe(10);
      expect(w.maxX).toBe(100);
      expect(w.width).toBe(90);
    });

    it("safely handles handles crossing the opposite side without collapsing or inverting to negative sizes", () => {
      const orig: BoundingBox = {
        minX: 50,
        minY: 50,
        maxX: 150,
        maxY: 150,
        width: 100,
        height: 100,
      };

      // Drag N handle way down past maxY (p.y = 250)
      const nCross = computeResizedBox(orig, "n", { x: 100, y: 250 });
      expect(nCross.height).toBeGreaterThanOrEqual(8);
      expect(nCross.maxY).toBe(150);
      expect(nCross.minY).toBe(142);

      // Drag S handle way up past minY (p.y = 0)
      const sCross = computeResizedBox(orig, "s", { x: 100, y: 0 });
      expect(sCross.height).toBeGreaterThanOrEqual(8);
      expect(sCross.minY).toBe(50);
      expect(sCross.maxY).toBe(58);

      // Drag W handle way right past maxX (p.x = 300)
      const wCross = computeResizedBox(orig, "w", { x: 300, y: 100 });
      expect(wCross.width).toBeGreaterThanOrEqual(8);
      expect(wCross.maxX).toBe(150);
      expect(wCross.minX).toBe(142);

      // Drag E handle way left past minX (p.x = -50)
      const eCross = computeResizedBox(orig, "e", { x: -50, y: 100 });
      expect(eCross.width).toBeGreaterThanOrEqual(8);
      expect(eCross.minX).toBe(50);
      expect(eCross.maxX).toBe(58);

      // Drag SE corner to the extreme top-left (-100, -100)
      const seCross = computeResizedBox(orig, "se", { x: -100, y: -100 });
      expect(seCross.width).toBeGreaterThanOrEqual(8);
      expect(seCross.height).toBeGreaterThanOrEqual(8);

      // Drag NW corner to the extreme bottom-right (400, 400)
      const nwCross = computeResizedBox(orig, "nw", { x: 400, y: 400 });
      expect(nwCross.width).toBeGreaterThanOrEqual(8);
      expect(nwCross.height).toBeGreaterThanOrEqual(8);
    });

    it("resizes stroke points proportionally without drift", () => {
      const origBox: BoundingBox = {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
        width: 100,
        height: 100,
      };

      const stroke: DrawingStroke = {
        id: "stroke_scale",
        tool: "rectangle",
        color: "#000",
        width: 2,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      };

      const newBox: BoundingBox = {
        minX: 50,
        minY: 50,
        maxX: 250,
        maxY: 250,
        width: 200,
        height: 200,
      };

      const resized = resizeStroke(stroke, origBox, newBox);

      // (0, 0) maps exactly to (50, 50)
      expect(resized.points[0].x).toBe(50);
      expect(resized.points[0].y).toBe(50);

      // (100, 100) maps exactly to (250, 250)
      expect(resized.points[1].x).toBe(250);
      expect(resized.points[1].y).toBe(250);
    });

    it("resizes text objects with zero origin drift when dragging SE handle", () => {
      const origBox: BoundingBox = {
        minX: 40,
        minY: 60,
        maxX: 140,
        maxY: 110,
        width: 100,
        height: 50,
      };

      const textStroke: DrawingStroke = {
        id: "text_drift_test",
        tool: "text",
        color: "#000",
        width: 2,
        points: [{ x: 40, y: 60 }],
        text: "Stationary Origin",
        fontSize: 16,
      };

      // Double box size by dragging SE handle
      const expandedBox: BoundingBox = {
        minX: 40,
        minY: 60,
        maxX: 240,
        maxY: 160,
        width: 200,
        height: 100,
      };

      const resized = resizeStroke(textStroke, origBox, expandedBox);

      // Origin point must not drift!
      expect(resized.points[0].x).toBe(40);
      expect(resized.points[0].y).toBe(60);
      // Font size scales proportionally
      expect(resized.fontSize).toBe(32);
    });

    it("clamps font size within readable limits (10px to 120px) under extreme scaling", () => {
      const origBox: BoundingBox = {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
        width: 100,
        height: 100,
      };

      const textStroke: DrawingStroke = {
        id: "text_extreme",
        tool: "text",
        color: "#000",
        width: 2,
        points: [{ x: 0, y: 0 }],
        text: "Extreme Scale",
        fontSize: 16,
      };

      // Extremely tiny box
      const tinyBox: BoundingBox = {
        minX: 0,
        minY: 0,
        maxX: 8,
        maxY: 8,
        width: 8,
        height: 8,
      };
      const shrunk = resizeStroke(textStroke, origBox, tinyBox);
      expect(shrunk.fontSize).toBeGreaterThanOrEqual(10);

      // Extremely huge box
      const hugeBox: BoundingBox = {
        minX: 0,
        minY: 0,
        maxX: 2000,
        maxY: 2000,
        width: 2000,
        height: 2000,
      };
      const enlarged = resizeStroke(textStroke, origBox, hugeBox);
      expect(enlarged.fontSize).toBeLessThanOrEqual(120);
    });
  });

  describe("Persistence and Save-Queue Reliability", () => {
    it("persists transformed strokes to drawingsRepository without data loss", async () => {
      const drawing = await drawingsRepository.create({
        title: "Architecture Diagram",
        strokes: [
          {
            id: "s1",
            tool: "pen",
            color: "#0284c7",
            width: 3,
            points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
          },
        ],
      });

      // Apply move transformation
      const movedStroke = translateStroke(drawing.strokes[0], 40, 20);
      await drawingsRepository.update(drawing.id, {
        strokes: [movedStroke],
      });

      const reloaded = await drawingsRepository.getById(drawing.id);
      expect(reloaded).toBeDefined();
      expect(reloaded!.strokes).toHaveLength(1);
      expect(reloaded!.strokes[0].points[0]).toEqual({ x: 50, y: 30, pressure: undefined });
      expect(reloaded!.strokes[0].points[1]).toEqual({ x: 90, y: 70, pressure: undefined });
    });

    it("atomically saves modified drawings alongside note content", async () => {
      const drawing = await drawingsRepository.create({
        title: "Block Drawing 1",
        strokes: [
          {
            id: "s_box",
            tool: "rectangle",
            color: "#e11d48",
            width: 2,
            points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
          },
        ],
      });

      const note = await notesRepository.create({
        title: "Unified Note with Transformed Drawing",
        content: "Intro block\n\nFinal block",
        blocks: [
          { id: "b1", type: "text", content: "Intro block" },
          { id: "b2", type: "drawing", drawingId: drawing.id, title: "Embedded Drawing" },
          { id: "b3", type: "text", content: "Final block" },
        ],
      });

      // Simulate move transformation on drawing stroke
      const movedBox = translateStroke(drawing.strokes[0], 100, 100);
      const updatedDrawing = {
        ...drawing,
        strokes: [movedBox],
        updatedAt: new Date().toISOString(),
      };

      // Atomic persistence
      await notesRepository.saveNoteWithDrawings(
        { ...note, updatedAt: new Date().toISOString() },
        [updatedDrawing]
      );

      // Verify both note and drawing retained changes
      const fetchedNote = await notesRepository.getById(note.id);
      const fetchedDrawing = await drawingsRepository.getById(drawing.id);

      expect(fetchedNote).toBeDefined();
      expect(fetchedNote!.title).toBe("Unified Note with Transformed Drawing");
      expect(fetchedNote!.blocks).toHaveLength(3);

      expect(fetchedDrawing).toBeDefined();
      expect(fetchedDrawing!.strokes[0].points[0].x).toBe(100);
      expect(fetchedDrawing!.strokes[0].points[0].y).toBe(100);
      expect(fetchedDrawing!.strokes[0].points[1].x).toBe(150);
      expect(fetchedDrawing!.strokes[0].points[1].y).toBe(150);
    });

    it("handles stroke deletion and preserves remaining strokes upon reload", async () => {
      const drawing = await drawingsRepository.create({
        title: "Multi-stroke Diagram",
        strokes: [
          { id: "keep_me", tool: "pen", color: "#000", width: 2, points: [{ x: 1, y: 1 }] },
          { id: "delete_me", tool: "pen", color: "#f00", width: 2, points: [{ x: 50, y: 50 }] },
        ],
      });

      // Filter out deleted stroke
      const remaining = drawing.strokes.filter((s) => s.id !== "delete_me");
      await drawingsRepository.update(drawing.id, {
        strokes: remaining,
      });

      const reloaded = await drawingsRepository.getById(drawing.id);
      expect(reloaded!.strokes).toHaveLength(1);
      expect(reloaded!.strokes[0].id).toBe("keep_me");
    });

    it("flushes rapid uncommitted transformations via SaveQueue flush hook before application exit", async () => {
      const queue = new SaveQueue();
      const drawing = await drawingsRepository.create({
        title: "Flush Test Drawing",
        strokes: [{ id: "s1", tool: "pen", color: "#000", width: 2, points: [{ x: 10, y: 10 }] }],
      });

      // Simulate a user rapidly moving a stroke where debounce hasn't fired yet
      let pendingStrokes = [translateStroke(drawing.strokes[0], 80, 50)];

      // Register the component flush hook
      const unregister = queue.registerFlushHook(async () => {
        await drawingsRepository.update(drawing.id, {
          strokes: pendingStrokes,
        });
      });

      // Simulate window close triggering flush
      const flushed = await queue.waitForPendingSaves(2000);
      expect(flushed).toBe(true);

      // Verify that IndexedDB persisted the uncommitted transformation
      const saved = await drawingsRepository.getById(drawing.id);
      expect(saved!.strokes[0].points[0]).toEqual({ x: 90, y: 60, pressure: undefined });

      unregister();
    });

    it("preserves pending recovery drafts if an unexpected database save failure occurs", async () => {
      const note = await notesRepository.create({
        title: "Draft Protection Note",
        content: "Original text",
        blocks: [{ id: "b1", type: "text", content: "Original text" }],
      });

      // Create a draft with transformed content
      await draftsRepository.saveDraft({
        id: note.id,
        noteId: note.id,
        title: "Draft Protection Note (Edited)",
        blocks: [
          { id: "b1", type: "text", content: "Original text" },
          { id: "b2", type: "drawing", drawingId: "draw_fail", title: "New Sketch" },
        ],
        updatedAt: new Date(Date.now() + 5000).toISOString(),
      });

      // Simulate save failure
      const queue = new SaveQueue();
      let saveErrorCaught = false;
      try {
        await queue.enqueue(async () => {
          throw new Error("Simulated IndexedDB I/O disk error");
        });
      } catch (err: any) {
        saveErrorCaught = true;
      }
      expect(saveErrorCaught).toBe(true);

      // Verify draft is STILL present in draftsRepository so user never loses edits
      const preservedDraft = await draftsRepository.getDraft(note.id);
      expect(preservedDraft).toBeDefined();
      expect(preservedDraft!.title).toBe("Draft Protection Note (Edited)");
      expect(preservedDraft!.blocks).toHaveLength(2);
    });
  });
});
