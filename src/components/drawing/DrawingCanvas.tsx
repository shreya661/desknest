import React, { useRef, useEffect, useCallback, useState } from "react";
import { DrawingPoint, DrawingStroke, DrawingTool } from "../../types";
import {
  BoundingBox,
  ResizeHandle,
  getStrokeBoundingBox,
  isPointNearStroke,
  getBoundingBoxHandles,
  getHoveredHandle,
  translateStroke,
  resizeStroke,
  computeResizedBox,
  getHandleCursor,
} from "../../utils/drawingGeometry";

interface DrawingCanvasProps {
  strokes: DrawingStroke[];
  currentTool: DrawingTool;
  currentColor: string;
  currentWidth: number;
  selectedStrokeId?: string | null;
  onSelectStroke?: (strokeId: string | null) => void;
  onAddStroke: (stroke: DrawingStroke) => void;
  onUpdateStrokes?: (strokes: DrawingStroke[]) => void;
  onThumbnailChange?: (dataUrl: string) => void;
}

interface TransformState {
  type: "move" | "resize";
  handle?: ResizeHandle;
  startPoint: DrawingPoint;
  origBox?: BoundingBox;
  origStroke: DrawingStroke;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  strokes,
  currentTool,
  currentColor,
  currentWidth,
  selectedStrokeId: controlledSelectedId,
  onSelectStroke,
  onAddStroke,
  onUpdateStrokes,
  onThumbnailChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<DrawingPoint | null>(null);
  const currentPointsRef = useRef<DrawingPoint[]>([]);

  // Local selection state (synchronized with controlledSelectedId if provided)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedStrokeId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  const setSelectedId = (id: string | null) => {
    setInternalSelectedId(id);
    if (onSelectStroke) onSelectStroke(id);
  };

  // Live transform preview
  const [liveStroke, setLiveStroke] = useState<DrawingStroke | null>(null);
  const transformState = useRef<TransformState | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>("crosshair");

  // Text box placement on canvas
  const [activeTextInput, setActiveTextInput] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Helper: Draw an arrowhead
  const drawArrowhead = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    width: number
  ) => {
    const headLength = Math.max(10, width * 3.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 7),
      toY - headLength * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 7),
      toY - headLength * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
  };

  // Helper: Render a single stroke/shape onto context
  const renderStroke = (ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    ctx.beginPath();
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
    }

    if (stroke.tool === "text") {
      if (stroke.points.length > 0 && stroke.text) {
        const pt = stroke.points[0];
        const fontSize = stroke.fontSize || Math.max(14, stroke.width * 3.5);
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(stroke.text, pt.x, pt.y);
      }
      return;
    }

    if (stroke.points.length === 0) return;

    if (stroke.tool === "pen" || stroke.tool === "eraser") {
      if (stroke.points.length === 1) {
        const pt = stroke.points[0];
        ctx.arc(pt.x, pt.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      return;
    }

    // Geometric Shapes (start: points[0], end: points[1])
    if (stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];

      if (stroke.tool === "rectangle") {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        ctx.strokeRect(x, y, w, h);
      } else if (stroke.tool === "circle") {
        const rx = Math.abs(p2.x - p1.x) / 2;
        const ry = Math.abs(p2.y - p1.y) / 2;
        const cx = Math.min(p1.x, p2.x) + rx;
        const cy = Math.min(p1.y, p2.y) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (stroke.tool === "line") {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (stroke.tool === "arrow") {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        drawArrowhead(ctx, p1.x, p1.y, p2.x, p2.y, stroke.width);
      }
    }
  };

  // Helper: Render selection box and handles
  const renderSelectionOverlay = (ctx: CanvasRenderingContext2D, targetStroke: DrawingStroke) => {
    const box = getStrokeBoundingBox(targetStroke);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    // Subtle shaded bounding region
    ctx.fillStyle = "rgba(2, 132, 199, 0.05)";
    ctx.fillRect(box.minX, box.minY, box.width, box.height);

    // Dashed primary selection outline
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(box.minX, box.minY, box.width, box.height);
    ctx.setLineDash([]);

    // 8 Aesthetic Resize Handles
    const handles = getBoundingBoxHandles(box);
    for (const h of handles) {
      ctx.beginPath();
      ctx.rect(h.x - 4, h.y - 4, 8, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  };

  // Redraw all strokes with selection overlay
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    let activeSelectedStroke: DrawingStroke | null = null;

    for (const stroke of strokes) {
      if (liveStroke && stroke.id === liveStroke.id) {
        // Draw the live transformed version instead
        renderStroke(ctx, liveStroke);
        activeSelectedStroke = liveStroke;
      } else {
        renderStroke(ctx, stroke);
        if (stroke.id === selectedStrokeId) {
          activeSelectedStroke = stroke;
        }
      }
    }

    // Render selection bounding box and handles if in select mode or if a stroke is selected
    if (activeSelectedStroke && (currentTool === "select" || controlledSelectedId)) {
      renderSelectionOverlay(ctx, activeSelectedStroke);
    }

    ctx.restore();

    if (onThumbnailChange && strokes.length > 0) {
      const dataUrl = canvas.toDataURL("image/png");
      onThumbnailChange(dataUrl);
    }
  }, [strokes, liveStroke, selectedStrokeId, currentTool, controlledSelectedId, onThumbnailChange]);

  // Adjust canvas size to parent container with High-DPI support
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(100, Math.floor(rect.width * dpr));
      canvas.height = Math.max(100, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      redraw();
    };

    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [redraw]);

  // Update cursor dynamically based on tool and hover position
  useEffect(() => {
    if (currentTool === "select") {
      setCursorStyle("default");
    } else {
      setCursorStyle("crosshair");
      setSelectedId(null);
    }
  }, [currentTool]);

  const getPointerCoord = (e: React.PointerEvent<HTMLCanvasElement>): DrawingPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    containerRef.current?.focus();
    const point = getPointerCoord(e);

    // ==========================================
    // 1. SELECT TOOL INTERACTIONS
    // ==========================================
    if (currentTool === "select") {
      commitActiveText();

      const currentSelected = strokes.find((s) => s.id === selectedStrokeId);

      // Check if clicking on an active resize handle of currently selected object
      if (currentSelected) {
        const box = getStrokeBoundingBox(currentSelected);
        const hoveredHandle = getHoveredHandle(box, point, 8);

        if (hoveredHandle) {
          e.currentTarget.setPointerCapture(e.pointerId);
          transformState.current = {
            type: "resize",
            handle: hoveredHandle,
            startPoint: point,
            origBox: box,
            origStroke: { ...currentSelected },
          };
          return;
        }

        // Check if clicking inside the currently selected object to move it
        if (isPointNearStroke(currentSelected, point, 6)) {
          e.currentTarget.setPointerCapture(e.pointerId);
          transformState.current = {
            type: "move",
            startPoint: point,
            origStroke: { ...currentSelected },
          };
          return;
        }
      }

      // Hit-test other strokes from top to bottom
      let hitStroke: DrawingStroke | null = null;
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (isPointNearStroke(strokes[i], point, 6)) {
          hitStroke = strokes[i];
          break;
        }
      }

      if (hitStroke) {
        e.currentTarget.setPointerCapture(e.pointerId);
        setSelectedId(hitStroke.id);
        transformState.current = {
          type: "move",
          startPoint: point,
          origStroke: { ...hitStroke },
        };
      } else {
        // Deselect if clicked on empty canvas
        setSelectedId(null);
      }
      return;
    }

    // ==========================================
    // 2. TEXT TOOL
    // ==========================================
    if (currentTool === "text") {
      commitActiveText();
      setActiveTextInput({ x: point.x, y: point.y, text: "" });
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    // ==========================================
    // 3. DRAWING & SHAPE TOOLS
    // ==========================================
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    startPointRef.current = point;
    currentPointsRef.current = [point];

    if (currentTool === "pen" || currentTool === "eraser") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      ctx.scale(dpr, dpr);
      renderStroke(ctx, {
        id: "temp",
        tool: currentTool,
        color: currentColor,
        width: currentWidth,
        points: [point],
      });
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const currentPoint = getPointerCoord(e);

    // Handle Active Transformation (Move or Resize)
    if (transformState.current) {
      const { type, handle, startPoint, origBox, origStroke } = transformState.current;

      if (type === "move") {
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const moved = translateStroke(origStroke, dx, dy);
        setLiveStroke(moved);
      } else if (type === "resize" && handle && origBox) {
        const newBox = computeResizedBox(origBox, handle, currentPoint);
        const resized = resizeStroke(origStroke, origBox, newBox);
        setLiveStroke(resized);
      }
      return;
    }

    // Handle Hover Cursor Updates in Select Mode
    if (currentTool === "select") {
      const currentSelected = strokes.find((s) => s.id === selectedStrokeId);
      if (currentSelected) {
        const box = getStrokeBoundingBox(currentSelected);
        const handle = getHoveredHandle(box, currentPoint, 8);
        if (handle) {
          setCursorStyle(getHandleCursor(handle));
          return;
        }
        if (isPointNearStroke(currentSelected, currentPoint, 6)) {
          setCursorStyle("move");
          return;
        }
      }

      // Check if hovering over another stroke
      const isOverAny = strokes.some((s) => isPointNearStroke(s, currentPoint, 6));
      setCursorStyle(isOverAny ? "pointer" : "default");
      return;
    }

    // Standard Drawing Strokes
    if (!isDrawingRef.current || !startPointRef.current) return;

    if (currentTool === "pen" || currentTool === "eraser") {
      const pts = currentPointsRef.current;
      const lastPoint = pts[pts.length - 1];
      pts.push(currentPoint);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.beginPath();
      ctx.lineWidth = currentWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (currentTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = currentColor;
      }
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
      ctx.restore();
    } else {
      // Shape live preview: clear and redraw all existing strokes + live shape preview!
      redraw();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      ctx.scale(dpr, dpr);
      renderStroke(ctx, {
        id: "preview",
        tool: currentTool,
        color: currentColor,
        width: currentWidth,
        points: [startPointRef.current, currentPoint],
      });
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    // Commit transformation if active
    if (transformState.current) {
      if (liveStroke && onUpdateStrokes) {
        const nextStrokes = strokes.map((s) => (s.id === liveStroke.id ? liveStroke : s));
        onUpdateStrokes(nextStrokes);
      }
      transformState.current = null;
      setLiveStroke(null);
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    isDrawingRef.current = false;
    const endPoint = getPointerCoord(e);

    if (currentTool === "pen" || currentTool === "eraser") {
      if (currentPointsRef.current.length > 0) {
        onAddStroke({
          id: "stroke_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          tool: currentTool,
          color: currentColor,
          width: currentWidth,
          points: [...currentPointsRef.current],
        });
      }
    } else {
      // Shape tool: commit shape
      onAddStroke({
        id: "shape_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        tool: currentTool,
        color: currentColor,
        width: currentWidth,
        points: [startPointRef.current, endPoint],
      });
    }

    startPointRef.current = null;
    currentPointsRef.current = [];
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    if (transformState.current) {
      transformState.current = null;
      setLiveStroke(null);
    }
    isDrawingRef.current = false;
    startPointRef.current = null;
    currentPointsRef.current = [];
  };

  const commitActiveText = () => {
    if (activeTextInput && activeTextInput.text.trim()) {
      onAddStroke({
        id: "text_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        tool: "text",
        color: currentColor,
        width: currentWidth,
        points: [{ x: activeTextInput.x, y: activeTextInput.y }],
        text: activeTextInput.text.trim(),
        fontSize: Math.max(14, currentWidth * 3.5),
      });
    }
    setActiveTextInput(null);
  };

  // Keyboard navigation: Delete / Backspace to remove selected stroke; Escape to deselect
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (activeTextInput) return;

    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedStrokeId && onUpdateStrokes) {
        e.preventDefault();
        const next = strokes.filter((s) => s.id !== selectedStrokeId);
        onUpdateStrokes(next);
        setSelectedId(null);
      }
    } else if (e.key === "Escape") {
      setSelectedId(null);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ cursor: cursorStyle }}
      className="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-[#14151a] rounded-xl border border-border shadow-inner outline-none"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="absolute inset-0 block touch-none"
      />

      {/* Inline Text Box Editor */}
      {activeTextInput && (
        <div
          style={{
            position: "absolute",
            left: `${activeTextInput.x}px`,
            top: `${activeTextInput.y}px`,
          }}
          className="z-20 -translate-y-2"
        >
          <input
            ref={textInputRef}
            type="text"
            value={activeTextInput.text}
            onChange={(e) =>
              setActiveTextInput({ ...activeTextInput, text: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitActiveText();
              } else if (e.key === "Escape") {
                setActiveTextInput(null);
              }
            }}
            onBlur={commitActiveText}
            placeholder="Type text..."
            style={{
              color: currentColor,
              fontSize: `${Math.max(14, currentWidth * 3.5)}px`,
            }}
            className="bg-surface/90 border border-primary rounded px-2 py-0.5 font-semibold shadow-lg focus:outline-none min-w-[120px]"
          />
        </div>
      )}
    </div>
  );
};
