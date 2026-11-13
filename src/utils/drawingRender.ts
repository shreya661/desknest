import { DrawingStroke } from "../types";
import { getStrokeBoundingBox, BoundingBox } from "./drawingGeometry";

/**
 * Draws an arrowhead on canvas at the end of a line (p1 -> p2).
 */
export function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number
) {
  const headLength = Math.max(12, strokeWidth * 3.5);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

/**
 * Renders a single stroke on a 2D canvas context using
 * quadratic Bézier smoothing for 3+ points.
 */
export function renderDrawingStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
  }

  // Text shape
  if (stroke.tool === "text") {
    if (stroke.points.length > 0 && stroke.text) {
      const pt = stroke.points[0];
      const fontSize = stroke.fontSize || Math.max(14, stroke.width * 3.5);
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(stroke.text, pt.x, pt.y);
    }
    ctx.restore();
    return;
  }

  if (!stroke.points || stroke.points.length === 0) {
    ctx.restore();
    return;
  }

  // Freehand Pen / Eraser
  if (stroke.tool === "pen" || stroke.tool === "eraser") {
    if (stroke.points.length === 1) {
      const pt = stroke.points[0];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (stroke.points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const pt = stroke.points[i];
        const next = stroke.points[i + 1];
        const midX = (pt.x + next.x) / 2;
        const midY = (pt.y + next.y) / 2;
        ctx.quadraticCurveTo(pt.x, pt.y, midX, midY);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Geometric shapes
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

  ctx.restore();
}

/**
 * Calculates the union bounding box across multiple strokes.
 */
export function getOverallBoundingBox(strokes: DrawingStroke[]): BoundingBox {
  if (!strokes || strokes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of strokes) {
    const b = getStrokeBoundingBox(s);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Renders an array of strokes onto a canvas context.
 * If targetWidth and targetHeight are supplied, fits or scales
 * the drawing seamlessly within the viewport.
 */
export function renderAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  targetWidth?: number,
  targetHeight?: number
) {
  if (!strokes || strokes.length === 0) return;

  ctx.save();

  if (targetWidth && targetHeight && targetWidth > 0 && targetHeight > 0) {
    const box = getOverallBoundingBox(strokes);
    const padding = 20;
    const availW = Math.max(20, targetWidth - padding * 2);
    const availH = Math.max(20, targetHeight - padding * 2);

    if (box.width > 0 && box.height > 0) {
      // If strokes already fit inside bounds, render 1:1 aligned
      if (
        box.maxX <= targetWidth - padding &&
        box.maxY <= targetHeight - padding &&
        box.minX >= padding &&
        box.minY >= padding
      ) {
        // Natural 1:1 positioning
      } else {
        // Scale to fit comfortably
        const scale = Math.min(1, Math.min(availW / box.width, availH / box.height));
        const offsetX = (targetWidth - box.width * scale) / 2 - box.minX * scale;
        const offsetY = (targetHeight - box.height * scale) / 2 - box.minY * scale;
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
      }
    }
  }

  for (const stroke of strokes) {
    renderDrawingStroke(ctx, stroke);
  }

  ctx.restore();
}

