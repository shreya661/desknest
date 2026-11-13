import React, { useState, useEffect, useRef, useCallback } from "react";
import { Drawing, DrawingStroke } from "../../types";
import { drawingsRepository } from "../../repositories/drawingsRepository";
import { renderAllStrokes } from "../../utils/drawingRender";
import { PenTool, ExternalLink } from "lucide-react";

export interface DrawingPreviewItemProps {
  drawingId: string;
  title?: string;
  cachedDrawing?: Drawing;
  onOpenFullCanvas?: (drawingId: string) => void;
}

export const DrawingPreviewItem: React.FC<DrawingPreviewItemProps> = ({
  drawingId,
  title,
  cachedDrawing,
  onOpenFullCanvas,
}) => {
  const [drawing, setDrawing] = useState<Drawing | null>(cachedDrawing || null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync with cached drawing if provided and updated
  useEffect(() => {
    if (cachedDrawing) {
      setDrawing(cachedDrawing);
    }
  }, [cachedDrawing]);

  // Load from IndexedDB if not cached or drawingId changes
  useEffect(() => {
    let mounted = true;
    if (!cachedDrawing || cachedDrawing.id !== drawingId) {
      drawingsRepository.getById(drawingId).then((loaded) => {
        if (mounted && loaded) {
          setDrawing(loaded);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [drawingId, cachedDrawing]);

  const strokes: DrawingStroke[] = drawing?.strokes || [];
  const displayTitle = drawing?.title || title || "Embedded Sketch";

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = Math.max(100, Math.floor(rect.width));
    const height = Math.max(160, Math.floor(rect.height || 260));

    // Update canvas buffer size for high-DPI crisp rendering
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (strokes.length > 0) {
      renderAllStrokes(ctx, strokes, width, height);
    }

    ctx.restore();
  }, [strokes]);

  // Redraw when strokes change
  useEffect(() => {
    redraw();
  }, [redraw, strokes]);

  // Redraw when container dimensions change (split resizing, window resizing)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      redraw();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
    };
  }, [redraw]);

  return (
    <div className="my-3 rounded-xl border border-border bg-surface-elevated overflow-hidden shadow-xs select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <PenTool className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="font-semibold text-foreground truncate max-w-[240px]">
            {displayTitle}
          </span>
          <span className="text-[10px] text-muted-fg font-mono px-1.5 py-0.2 rounded bg-muted/70 flex-shrink-0">
            {strokes.length} {strokes.length === 1 ? "stroke" : "strokes"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenFullCanvas && (
            <button
              type="button"
              onClick={() => onOpenFullCanvas(drawingId)}
              title="Open sketch in full canvas"
              className="p-1 rounded text-muted-fg hover:text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1 text-[11px]"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Full Canvas</span>
            </button>
          )}
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full relative bg-white dark:bg-slate-950/80 h-[260px] flex items-center justify-center overflow-hidden"
      >
        {strokes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-fg text-xs italic gap-1 select-none pointer-events-none">
            <PenTool className="w-5 h-5 opacity-40 mb-1" />
            <span>Empty sketch canvas</span>
            <span className="text-[10px] opacity-70">
              Draw on the editor canvas to see live preview
            </span>
          </div>
        ) : (
          <canvas ref={canvasRef} className="block w-full h-full" />
        )}
      </div>
    </div>
  );
};

