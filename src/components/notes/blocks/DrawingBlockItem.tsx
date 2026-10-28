import React, { useState, useEffect } from "react";
import { DrawingStroke, DrawingTool } from "../../../types";
import { drawingsRepository } from "../../../repositories/drawingsRepository";
import { DrawingCanvas } from "../../drawing/DrawingCanvas";
import {
  Pen,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  RotateCcw,
  RotateCw,
  Trash2,
  Maximize2,
  Minimize2,
  MousePointer,
  ExternalLink,
  LucideIcon,
} from "lucide-react";

interface DrawingBlockItemProps {
  blockId: string;
  drawingId: string;
  title?: string;
  displayMode?: "inline" | "expanded";
  isReadOnly?: boolean;
  onUpdateDrawing: (drawingId: string, strokes: DrawingStroke[], thumbnail?: string | null) => void;
  onDeleteBlock: (blockId: string) => void;
  onToggleDisplayMode: (blockId: string) => void;
  onOpenFullCanvas?: (drawingId: string) => void;
}

const COLOR_PALETTE = [
  "#000000",
  "#475569",
  "#0284c7",
  "#06b6d4",
  "#10b981",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#a855f7",
  "#ffffff",
];

const STROKE_WIDTHS = [2, 4, 8, 16];

export const DrawingBlockItem: React.FC<DrawingBlockItemProps> = ({
  blockId,
  drawingId,
  title = "Embedded Sketch",
  displayMode = "inline",
  isReadOnly = false,
  onUpdateDrawing,
  onDeleteBlock,
  onToggleDisplayMode,
  onOpenFullCanvas,
}) => {
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<DrawingStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[][]>([]);

  const [currentTool, setCurrentTool] = useState<DrawingTool>("pen");
  const [currentColor, setCurrentColor] = useState("#0284c7");
  const [currentWidth, setCurrentWidth] = useState(4);

  // Load drawing on mount or when drawingId changes
  useEffect(() => {
    let mounted = true;
    drawingsRepository.getById(drawingId).then((loaded) => {
      if (mounted && loaded) {
        setStrokes(loaded.strokes || []);
      }
    });
    return () => {
      mounted = false;
    };
  }, [drawingId]);

  const handleAddStroke = (stroke: DrawingStroke) => {
    if (isReadOnly) return;
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
    const updated = [...strokes, stroke];
    setStrokes(updated);
    onUpdateDrawing(drawingId, updated);
  };

  const handleUpdateStrokes = (newStrokes: DrawingStroke[]) => {
    if (isReadOnly) return;
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
    setStrokes(newStrokes);
    onUpdateDrawing(drawingId, newStrokes);
  };

  const handleDeleteSelected = () => {
    if (isReadOnly || !selectedStrokeId) return;
    const updated = strokes.filter((s) => s.id !== selectedStrokeId);
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
    setStrokes(updated);
    setSelectedStrokeId(null);
    onUpdateDrawing(drawingId, updated);
  };

  const handleUndo = () => {
    if (isReadOnly || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, strokes]);
    setUndoStack((prev) => prev.slice(0, -1));
    setStrokes(previous);
    setSelectedStrokeId(null);
    onUpdateDrawing(drawingId, previous);
  };

  const handleRedo = () => {
    if (isReadOnly || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes(next);
    setSelectedStrokeId(null);
    onUpdateDrawing(drawingId, next);
  };

  const handleClear = () => {
    if (isReadOnly || strokes.length === 0) return;
    if (window.confirm("Clear all strokes from this drawing?")) {
      setUndoStack((prev) => [...prev, strokes]);
      setRedoStack([]);
      setStrokes([]);
      setSelectedStrokeId(null);
      onUpdateDrawing(drawingId, []);
    }
  };

  const containerHeight = displayMode === "expanded" ? 480 : 280;

  const tools: { id: DrawingTool; label: string; icon: LucideIcon }[] = [
    { id: "select", label: "Select", icon: MousePointer },
    { id: "pen", label: "Pen", icon: Pen },
    { id: "eraser", label: "Eraser", icon: Eraser },
    { id: "rectangle", label: "Box", icon: Square },
    { id: "circle", label: "Circle", icon: Circle },
    { id: "line", label: "Line", icon: Minus },
    { id: "arrow", label: "Arrow", icon: ArrowRight },
    { id: "text", label: "Text", icon: Type },
  ];

  return (
    <div className="relative group w-full my-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 shadow-sm backdrop-blur-sm overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 bg-slate-100/60 dark:bg-slate-800/60 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200 tracking-wide">
            ✏️ {title}
          </span>
          <span className="text-[10px] text-slate-400">
            ({strokes.length} {strokes.length === 1 ? "stroke" : "strokes"})
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1">
          {onOpenFullCanvas && (
            <button
              type="button"
              onClick={() => onOpenFullCanvas(drawingId)}
              className="p-1 px-1.5 rounded text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition flex items-center gap-1 text-[11px] font-medium mr-1"
              title="Focus in standalone Sketch Canvas"
            >
              <ExternalLink size={12} />
              <span>Full Canvas</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleDisplayMode(blockId)}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            title={displayMode === "expanded" ? "Collapse height" : "Expand height"}
          >
            {displayMode === "expanded" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => onDeleteBlock(blockId)}
              className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title="Remove drawing block"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Floating Canvas Controls Toolbar */}
      {!isReadOnly && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/40 dark:border-slate-700/40 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            {/* Tool buttons */}
            <div className="flex items-center gap-0.5 bg-slate-200/50 dark:bg-slate-700/50 p-0.5 rounded-lg">
              {tools.map((t) => {
                const Icon = t.icon;
                const isActive = currentTool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setCurrentTool(t.id);
                      if (t.id !== "select") {
                        setSelectedStrokeId(null);
                      }
                    }}
                    className={`p-1 rounded transition flex items-center gap-1 text-[11px] ${
                      isActive
                        ? "bg-sky-500 text-white shadow-xs font-medium"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                    title={t.label}
                  >
                    <Icon size={12} />
                    <span className="hidden lg:inline">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedStrokeId && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition animate-fadeIn"
                title="Delete selected item (Delete)"
              >
                Delete item
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Stroke Width Selector */}
            <div className="flex items-center space-x-0.5">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setCurrentWidth(w)}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                    currentWidth === w
                      ? "bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900"
                      : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={`${w}px width`}
                >
                  {w}px
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Color Swatches */}
            {currentTool !== "eraser" && (
              <div className="flex items-center space-x-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCurrentColor(color)}
                    className={`w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 transition-transform ${
                      currentColor === color
                        ? "scale-125 ring-2 ring-sky-500 ring-offset-1"
                        : "opacity-80 hover:opacity-100 hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {/* Custom Color Input */}
                <div
                  className="relative w-4 h-4 rounded-full overflow-hidden border border-slate-300 dark:border-slate-600 cursor-pointer ml-0.5"
                  title="Custom color"
                >
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => setCurrentColor(e.target.value)}
                    className="absolute -inset-2 w-8 h-8 cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full" style={{ backgroundColor: currentColor }} />
                </div>
              </div>
            )}
          </div>

          {/* History Controls */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Undo stroke (Ctrl+Z)"
            >
              <RotateCcw size={12} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Redo stroke (Ctrl+Y)"
            >
              <RotateCw size={12} />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="px-1.5 py-0.5 text-[11px] rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Clear all strokes"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div
        className="w-full relative bg-white dark:bg-slate-950/80 transition-all duration-300"
        style={{ height: `${containerHeight}px` }}
      >
        <DrawingCanvas
          strokes={strokes}
          currentTool={currentTool}
          currentColor={currentColor}
          currentWidth={currentWidth}
          selectedStrokeId={selectedStrokeId}
          onSelectStroke={setSelectedStrokeId}
          onAddStroke={handleAddStroke}
          onUpdateStrokes={handleUpdateStrokes}
        />
      </div>
    </div>
  );
};
