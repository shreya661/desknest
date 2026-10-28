import React from "react";
import {
  Pen,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  FolderOpen,
  Plus,
  MousePointer,
  BookOpen,
} from "lucide-react";
import { DrawingTool } from "../../types";

interface DrawingToolbarProps {
  currentTool: DrawingTool;
  onChangeTool: (tool: DrawingTool) => void;
  currentColor: string;
  onChangeColor: (color: string) => void;
  currentWidth: number;
  onChangeWidth: (width: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onOpenGallery: () => void;
  onNewDrawing: () => void;
  onOpenInNotebook?: () => void;
  drawingTitle: string;
  onChangeTitle: (title: string) => void;
  hasSelectedStroke?: boolean;
  onDeleteSelected?: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  onChangeTool,
  currentColor,
  onChangeColor,
  currentWidth,
  onChangeWidth,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onClear,
  onExportPng,
  onOpenGallery,
  onNewDrawing,
  onOpenInNotebook,
  drawingTitle,
  onChangeTitle,
  hasSelectedStroke,
  onDeleteSelected,
}) => {
  const palette = [
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

  const strokeWidths = [2, 4, 8, 16];

  const tools: { id: DrawingTool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
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
    <div className="bg-surface rounded-xl border border-border p-2.5 shadow-xs space-y-2 select-none">
      {/* Top row: Title, Gallery, New, Export, Clear, Undo/Redo */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 max-w-[240px]">
          <input
            type="text"
            value={drawingTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="Drawing Title..."
            className="text-xs font-bold text-foreground bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-0.5 focus:outline-none w-full truncate"
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Undo / Redo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-surface-hover text-muted-fg hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Undo stroke"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-surface-hover text-muted-fg hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Redo stroke"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-border mx-1" />

          {/* Open in Notebook */}
          {onOpenInNotebook && (
            <button
              onClick={onOpenInNotebook}
              title="Open in Notebook (Document View)"
              className="px-2 py-1 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 text-xs font-medium flex items-center gap-1 transition"
              aria-label="Open in notebook"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Notebook</span>
            </button>
          )}

          {/* New Canvas */}
          <button
            onClick={onNewDrawing}
            title="New Sketch"
            className="p-1.5 rounded hover:bg-surface-hover text-muted-fg hover:text-foreground"
            aria-label="New sketch"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Gallery modal */}
          <button
            onClick={onOpenGallery}
            title="Open Saved Sketches"
            className="p-1.5 rounded hover:bg-surface-hover text-muted-fg hover:text-foreground"
            aria-label="Sketches gallery"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          {/* Export PNG */}
          <button
            onClick={onExportPng}
            title="Export as PNG"
            className="p-1.5 rounded hover:bg-surface-hover text-muted-fg hover:text-foreground"
            aria-label="Export PNG"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Delete Selected Stroke */}
          {hasSelectedStroke && onDeleteSelected && (
            <button
              type="button"
              onClick={onDeleteSelected}
              title="Delete Selected Item (Delete)"
              className="px-2 py-1 text-xs rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-medium flex items-center gap-1 transition animate-fadeIn"
              aria-label="Delete selected object"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete item</span>
            </button>
          )}

          {/* Clear */}
          <button
            onClick={onClear}
            title="Clear Canvas"
            className="p-1.5 rounded hover:bg-rose-500/10 text-muted-fg hover:text-rose-500"
            aria-label="Clear canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom row: Tool selector with shapes and text, stroke widths, color swatches */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border">
        {/* Tool selector with shapes & text */}
        <div className="flex items-center gap-0.5 bg-surface-elevated p-0.5 rounded-lg border border-border">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = currentTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTool(t.id)}
                title={t.label}
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Stroke widths */}
        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-border">
          {strokeWidths.map((w) => (
            <button
              key={w}
              onClick={() => onChangeWidth(w)}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                currentWidth === w ? "bg-primary/20 text-primary" : "hover:bg-surface-hover text-muted-fg"
              }`}
              title={`${w}px width`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: `${Math.min(14, w + 2)}px`, height: `${Math.min(14, w + 2)}px` }}
              />
            </button>
          ))}
        </div>

        {/* Color Palette */}
        {currentTool !== "eraser" && (
          <div className="flex items-center gap-1.5">
            {palette.map((color) => (
              <button
                key={color}
                onClick={() => onChangeColor(color)}
                className={`w-4 h-4 rounded-full border border-black/20 dark:border-white/20 transition-transform ${
                  currentColor === color ? "scale-125 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            {/* Custom color input */}
            <div className="relative w-5 h-5 rounded-full overflow-hidden border border-border cursor-pointer">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => onChangeColor(e.target.value)}
                className="absolute -inset-2 w-8 h-8 cursor-pointer opacity-0"
                title="Custom color"
              />
              <div
                className="w-full h-full"
                style={{ backgroundColor: currentColor }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
