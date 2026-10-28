import React, { useState, useEffect, useRef } from "react";
import { Drawing, DrawingStroke, DrawingTool } from "../../types";
import { drawingsRepository } from "../../repositories/drawingsRepository";
import { notesRepository } from "../../repositories/notesRepository";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingToolbar } from "./DrawingToolbar";
import { Modal } from "../common/Modal";
import { Trash2, Calendar, FileImage, BookOpen } from "lucide-react";
import { Button } from "../common/Button";
import { saveQueue } from "../../utils/saveQueue";

interface DrawingWorkspaceProps {
  initialDrawingId?: string | null;
  onOpenNote?: (noteId: string) => void;
}

export const DrawingWorkspace: React.FC<DrawingWorkspaceProps> = ({
  initialDrawingId,
  onOpenNote,
}) => {
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  const [parentNoteId, setParentNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled Sketch");
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<DrawingStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[][]>([]);

  const [currentTool, setCurrentTool] = useState<DrawingTool>("pen");
  const [currentColor, setCurrentColor] = useState("#0284c7");
  const [currentWidth, setCurrentWidth] = useState(4);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [savedDrawings, setSavedDrawings] = useState<Drawing[]>([]);
  const thumbnailRef = useRef<string | null>(null);

  const pendingStateRef = useRef({ strokes, title, currentDrawingId, parentNoteId });
  useEffect(() => {
    pendingStateRef.current = { strokes, title, currentDrawingId, parentNoteId };
  }, [strokes, title, currentDrawingId, parentNoteId]);

  // Register shutdown flush hook to prevent silent loss on rapid close
  useEffect(() => {
    const unregister = saveQueue.registerFlushHook(async () => {
      const { strokes: s, title: t, currentDrawingId: id, parentNoteId: pId } = pendingStateRef.current;
      if (id) {
        await drawingsRepository.update(id, {
          title: t,
          strokes: s,
          thumbnail: thumbnailRef.current,
        });
        if (pId) {
          try {
            await notesRepository.update(pId, { title: t });
          } catch {
            // parent note may have been deleted
          }
        }
      } else if (s.length > 0) {
        await drawingsRepository.create({
          title: t,
          strokes: s,
          thumbnail: thumbnailRef.current,
        });
      }
    });
    return unregister;
  }, []);

  // Handle initialDrawingId changes
  useEffect(() => {
    if (!initialDrawingId) return;
    const loadSpecific = async () => {
      const drawing = await drawingsRepository.getById(initialDrawingId);
      if (drawing) {
        setCurrentDrawingId(drawing.id);
        setTitle(drawing.title);
        setStrokes(drawing.strokes || []);
        setSelectedStrokeId(null);
        setUndoStack([]);
        setRedoStack([]);
        if (drawing.parentNoteId) {
          setParentNoteId(drawing.parentNoteId);
        } else {
          const parent = await notesRepository.getByDrawingId(drawing.id);
          setParentNoteId(parent ? parent.id : null);
        }
      }
    };
    loadSpecific();
  }, [initialDrawingId]);

  // Load latest drawing or create one on mount if no initialDrawingId specified
  useEffect(() => {
    if (initialDrawingId) return;
    const initDrawing = async () => {
      const list = await drawingsRepository.list();
      setSavedDrawings(list);
      if (list.length > 0) {
        const latest = list[0];
        setCurrentDrawingId(latest.id);
        setTitle(latest.title);
        setStrokes(latest.strokes || []);
        if (latest.parentNoteId) {
          setParentNoteId(latest.parentNoteId);
        } else {
          const parent = await notesRepository.getByDrawingId(latest.id);
          setParentNoteId(parent ? parent.id : null);
        }
      }
    };
    initDrawing();
  }, [initialDrawingId]);

  // Debounced auto-save via saveQueue
  useEffect(() => {
    const saveTimer = setTimeout(async () => {
      try {
        await saveQueue.enqueue(async () => {
          if (!currentDrawingId) {
            if (strokes.length > 0) {
              const { note, drawing } = await notesRepository.createSketchNotebook({
                title,
                strokes,
              });
              setCurrentDrawingId(drawing.id);
              setParentNoteId(note.id);
              const list = await drawingsRepository.list();
              setSavedDrawings(list);
            }
          } else {
            await drawingsRepository.update(currentDrawingId, {
              title,
              strokes,
              thumbnail: thumbnailRef.current,
            });
            if (parentNoteId) {
              try {
                await notesRepository.update(parentNoteId, { title });
              } catch {
                // Ignore if note removed
              }
            }
            const list = await drawingsRepository.list();
            setSavedDrawings(list);
          }
        });
      } catch (err) {
        console.warn("Could not auto-save drawing:", err);
      }
    }, 600);

    return () => clearTimeout(saveTimer);
  }, [strokes, title, currentDrawingId, parentNoteId]);

  const handleAddStroke = (stroke: DrawingStroke) => {
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]); // clear redo on new action
    setStrokes((prev) => [...prev, stroke]);
  };

  const handleUpdateStrokes = (newStrokes: DrawingStroke[]) => {
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
    setStrokes(newStrokes);
  };

  const handleDeleteSelected = () => {
    if (!selectedStrokeId) return;
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
    setStrokes((prev) => prev.filter((s) => s.id !== selectedStrokeId));
    setSelectedStrokeId(null);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, strokes]);
    setUndoStack((prev) => prev.slice(0, -1));
    setStrokes(previous);
    setSelectedStrokeId(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes(next);
    setSelectedStrokeId(null);
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    if (window.confirm("Clear all strokes from canvas?")) {
      setUndoStack((prev) => [...prev, strokes]);
      setRedoStack([]);
      setStrokes([]);
      setSelectedStrokeId(null);
    }
  };

  const handleNewDrawing = async () => {
    const { note, drawing } = await notesRepository.createSketchNotebook({
      title: "New Sketch " + (savedDrawings.length + 1),
      strokes: [],
    });
    setCurrentDrawingId(drawing.id);
    setParentNoteId(note.id);
    setTitle(drawing.title);
    setStrokes([]);
    setSelectedStrokeId(null);
    setUndoStack([]);
    setRedoStack([]);
    const list = await drawingsRepository.list();
    setSavedDrawings(list);
  };

  const handleOpenDrawing = async (d: Drawing) => {
    setCurrentDrawingId(d.id);
    setTitle(d.title);
    setStrokes(d.strokes || []);
    setSelectedStrokeId(null);
    setUndoStack([]);
    setRedoStack([]);
    setGalleryOpen(false);

    if (d.parentNoteId) {
      setParentNoteId(d.parentNoteId);
    } else {
      const parent = await notesRepository.getByDrawingId(d.id);
      setParentNoteId(parent ? parent.id : null);
    }
  };

  const handleDeleteDrawing = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this drawing?")) {
      await drawingsRepository.delete(id);
      const list = await drawingsRepository.list();
      setSavedDrawings(list);
      if (currentDrawingId === id) {
        if (list.length > 0) {
          handleOpenDrawing(list[0]);
        } else {
          handleNewDrawing();
        }
      }
    }
  };

  const handleExportPng = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "sketch"}.png`;
    link.click();
  };

  const handleOpenInNotebook = async () => {
    if (!onOpenNote) return;
    let targetNoteId = parentNoteId;
    if (!targetNoteId && currentDrawingId) {
      const parent = await notesRepository.getByDrawingId(currentDrawingId);
      targetNoteId = parent ? parent.id : null;
    }
    if (targetNoteId) {
      onOpenNote(targetNoteId);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full p-3 space-y-3 overflow-hidden">
      {/* Drawing Toolbar */}
      <DrawingToolbar
        currentTool={currentTool}
        onChangeTool={(tool) => {
          setCurrentTool(tool);
          if (tool !== "select") {
            setSelectedStrokeId(null);
          }
        }}
        currentColor={currentColor}
        onChangeColor={setCurrentColor}
        currentWidth={currentWidth}
        onChangeWidth={setCurrentWidth}
        canUndo={undoStack.length > 0}
        onUndo={handleUndo}
        canRedo={redoStack.length > 0}
        onRedo={handleRedo}
        onClear={handleClear}
        onExportPng={handleExportPng}
        onOpenGallery={() => setGalleryOpen(true)}
        onNewDrawing={handleNewDrawing}
        onOpenInNotebook={onOpenNote ? handleOpenInNotebook : undefined}
        drawingTitle={title}
        onChangeTitle={setTitle}
        hasSelectedStroke={!!selectedStrokeId}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Canvas Area */}
      <DrawingCanvas
        strokes={strokes}
        currentTool={currentTool}
        currentColor={currentColor}
        currentWidth={currentWidth}
        selectedStrokeId={selectedStrokeId}
        onSelectStroke={setSelectedStrokeId}
        onAddStroke={handleAddStroke}
        onUpdateStrokes={handleUpdateStrokes}
        onThumbnailChange={(thumb) => {
          thumbnailRef.current = thumb;
        }}
      />

      {/* Gallery Modal */}
      <Modal
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title="Saved Sketches & Diagrams"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-fg">
              {savedDrawings.length} {savedDrawings.length === 1 ? "sketch" : "sketches"} stored locally.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                handleNewDrawing();
                setGalleryOpen(false);
              }}
            >
              New Sketch
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {savedDrawings.map((d) => (
              <div
                key={d.id}
                onClick={() => handleOpenDrawing(d)}
                className={`p-2.5 rounded-xl border cursor-pointer hover:shadow-md transition-all flex flex-col justify-between group ${
                  currentDrawingId === d.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:bg-surface-elevated"
                }`}
              >
                <div className="h-28 bg-white dark:bg-[#14151a] rounded-lg border border-border flex items-center justify-center overflow-hidden mb-2 relative">
                  {d.thumbnail ? (
                    <img
                      src={d.thumbnail}
                      alt={d.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <FileImage className="w-8 h-8 text-muted-fg opacity-40" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="truncate mr-1">
                    <h4 className="text-xs font-semibold text-foreground truncate">
                      {d.title}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-fg flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(d.updatedAt).toLocaleDateString()}
                      </span>
                      {d.parentNoteId && (
                        <span className="flex items-center gap-0.5 text-[9px] text-sky-500 font-medium bg-sky-500/10 px-1 py-0.2 rounded">
                          <BookOpen className="w-2.5 h-2.5" />
                          Notebook
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteDrawing(e, d.id)}
                    className="p-1 rounded text-muted-fg hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete sketch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
