import { DrawingPoint, DrawingStroke } from "../types";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type ResizeHandle =
  | "nw"
  | "ne"
  | "se"
  | "sw"
  | "n"
  | "s"
  | "e"
  | "w";

export interface HandlePosition {
  handle: ResizeHandle;
  x: number;
  y: number;
}

/**
 * Calculates the axis-aligned bounding box for any stroke or shape.
 */
export function getStrokeBoundingBox(stroke: DrawingStroke): BoundingBox {
  if (!stroke.points || stroke.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  if (stroke.tool === "text") {
    const pt = stroke.points[0];
    const fontSize = stroke.fontSize || Math.max(14, stroke.width * 3.5);
    // Estimate text width: ~0.62 * fontSize * characters
    const estimatedWidth = Math.max(30, (stroke.text || "").length * (fontSize * 0.62));
    const estimatedHeight = Math.max(16, fontSize * 1.25);

    return {
      minX: pt.x,
      minY: pt.y,
      maxX: pt.x + estimatedWidth,
      maxY: pt.y + estimatedHeight,
      width: estimatedWidth,
      height: estimatedHeight,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of stroke.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  // Ensure minimum dimensions (min 8px) for zero-area shapes (like single point or horizontal/vertical line)
  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;
  const minDim = Math.max(8, stroke.width);
  const extraWidth = Math.max(0, minDim - rawWidth);
  const extraHeight = Math.max(0, minDim - rawHeight);

  const actualMinX = minX - extraWidth / 2;
  const actualMinY = minY - extraHeight / 2;
  const width = rawWidth + extraWidth;
  const height = rawHeight + extraHeight;

  return {
    minX: actualMinX,
    minY: actualMinY,
    maxX: actualMinX + width,
    maxY: actualMinY + height,
    width,
    height,
  };
}

/**
 * Distance from point P to line segment AB.
 */
export function distanceToSegment(
  p: DrawingPoint,
  a: DrawingPoint,
  b: DrawingPoint
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return Math.sqrt(px * px + py * py);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const distX = p.x - projX;
  const distY = p.y - projY;

  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Hit test: returns true if point (x, y) is near or inside the stroke.
 */
export function isPointNearStroke(
  stroke: DrawingStroke,
  point: DrawingPoint,
  tolerance = 8
): boolean {
  const box = getStrokeBoundingBox(stroke);

  // Quick bounding box rejection test with tolerance
  if (
    point.x < box.minX - tolerance ||
    point.x > box.maxX + tolerance ||
    point.y < box.minY - tolerance ||
    point.y > box.maxY + tolerance
  ) {
    return false;
  }

  const effectiveTolerance = tolerance + stroke.width / 2;

  // 1. Text tool (with tolerance)
  if (stroke.tool === "text") {
    return (
      point.x >= box.minX - tolerance &&
      point.x <= box.maxX + tolerance &&
      point.y >= box.minY - tolerance &&
      point.y <= box.maxY + tolerance
    );
  }

  // 2. Rectangle tool
  if (stroke.tool === "rectangle") {
    // Hit either inside the rectangle or near its 4 edges
    if (stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      const x1 = Math.min(p1.x, p2.x);
      const x2 = Math.max(p1.x, p2.x);
      const y1 = Math.min(p1.y, p2.y);
      const y2 = Math.max(p1.y, p2.y);

      // Inside rectangle:
      if (point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2) {
        return true;
      }
      // Near perimeter:
      const nearLeft =
        Math.abs(point.x - x1) <= effectiveTolerance &&
        point.y >= y1 - effectiveTolerance &&
        point.y <= y2 + effectiveTolerance;
      const nearRight =
        Math.abs(point.x - x2) <= effectiveTolerance &&
        point.y >= y1 - effectiveTolerance &&
        point.y <= y2 + effectiveTolerance;
      const nearTop =
        Math.abs(point.y - y1) <= effectiveTolerance &&
        point.x >= x1 - effectiveTolerance &&
        point.x <= x2 + effectiveTolerance;
      const nearBottom =
        Math.abs(point.y - y2) <= effectiveTolerance &&
        point.x >= x1 - effectiveTolerance &&
        point.x <= x2 + effectiveTolerance;
      return nearLeft || nearRight || nearTop || nearBottom;
    }
  }

  // 3. Circle / Ellipse tool
  if (stroke.tool === "circle") {
    if (stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      const rx = Math.max(1, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(1, Math.abs(p2.y - p1.y) / 2);
      const cx = Math.min(p1.x, p2.x) + rx;
      const cy = Math.min(p1.y, p2.y) + ry;

      const normDist =
        Math.pow((point.x - cx) / (rx + effectiveTolerance), 2) +
        Math.pow((point.y - cy) / (ry + effectiveTolerance), 2);

      return normDist <= 1.0;
    }
  }

  // 4. Line / Arrow tool
  if (stroke.tool === "line" || stroke.tool === "arrow") {
    if (stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      return distanceToSegment(point, p1, p2) <= effectiveTolerance;
    }
  }

  // 5. Pen / Eraser tool (polyline)
  const pts = stroke.points;
  if (pts.length === 1) {
    const dx = point.x - pts[0].x;
    const dy = point.y - pts[0].y;
    return Math.sqrt(dx * dx + dy * dy) <= effectiveTolerance;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    if (distanceToSegment(point, pts[i], pts[i + 1]) <= effectiveTolerance) {
      return true;
    }
  }

  return false;
}

/**
 * Returns positions for 8 resize handles around a bounding box.
 */
export function getBoundingBoxHandles(box: BoundingBox): HandlePosition[] {
  const midX = box.minX + box.width / 2;
  const midY = box.minY + box.height / 2;

  return [
    { handle: "nw", x: box.minX, y: box.minY },
    { handle: "n", x: midX, y: box.minY },
    { handle: "ne", x: box.maxX, y: box.minY },
    { handle: "e", x: box.maxX, y: midY },
    { handle: "se", x: box.maxX, y: box.maxY },
    { handle: "s", x: midX, y: box.maxY },
    { handle: "sw", x: box.minX, y: box.maxY },
    { handle: "w", x: box.minX, y: midY },
  ];
}

/**
 * Detects if a point hits any resize handle of the selection.
 */
export function getHoveredHandle(
  box: BoundingBox,
  point: DrawingPoint,
  handleRadius = 7
): ResizeHandle | null {
  const handles = getBoundingBoxHandles(box);

  for (const h of handles) {
    const dx = point.x - h.x;
    const dy = point.y - h.y;
    if (Math.sqrt(dx * dx + dy * dy) <= handleRadius) {
      return h.handle;
    }
  }

  return null;
}

/**
 * Translates a stroke by (dx, dy).
 */
export function translateStroke(stroke: DrawingStroke, dx: number, dy: number): DrawingStroke {
  return {
    ...stroke,
    points: stroke.points.map((pt) => ({
      x: pt.x + dx,
      y: pt.y + dy,
      pressure: pt.pressure,
    })),
  };
}

/**
 * Resizes a stroke proportionally from an original bounding box to a new target bounding box.
 */
export function resizeStroke(
  stroke: DrawingStroke,
  originalBox: BoundingBox,
  newBox: BoundingBox
): DrawingStroke {
  const safeOrigWidth = Math.max(1, originalBox.width);
  const safeOrigHeight = Math.max(1, originalBox.height);
  const safeNewWidth = Math.max(4, newBox.width);
  const safeNewHeight = Math.max(4, newBox.height);

  const scaleX = safeNewWidth / safeOrigWidth;
  const scaleY = safeNewHeight / safeOrigHeight;
  const fontScale = Math.min(scaleX, scaleY);

  // Scale points relative to origin
  const newPoints = stroke.points.map((pt) => {
    const relX = (pt.x - originalBox.minX) / safeOrigWidth;
    const relY = (pt.y - originalBox.minY) / safeOrigHeight;
    return {
      x: newBox.minX + relX * safeNewWidth,
      y: newBox.minY + relY * safeNewHeight,
      pressure: pt.pressure,
    };
  });

  // If text, also scale fontSize
  let newFontSize = stroke.fontSize;
  if (stroke.tool === "text") {
    const currentSize = stroke.fontSize || Math.max(14, stroke.width * 3.5);
    newFontSize = Math.max(10, Math.min(120, Math.round(currentSize * fontScale)));
  }

  return {
    ...stroke,
    points: newPoints,
    fontSize: newFontSize,
  };
}

/**
 * Calculates a new bounding box given an active resize handle and the current pointer position.
 */
export function computeResizedBox(
  orig: BoundingBox,
  handle: ResizeHandle,
  p: DrawingPoint
): BoundingBox {
  let { minX, minY, maxX, maxY } = orig;

  if (handle === "se") {
    maxX = Math.max(minX + 8, p.x);
    maxY = Math.max(minY + 8, p.y);
  } else if (handle === "nw") {
    minX = Math.min(maxX - 8, p.x);
    minY = Math.min(maxY - 8, p.y);
  } else if (handle === "ne") {
    maxX = Math.max(minX + 8, p.x);
    minY = Math.min(maxY - 8, p.y);
  } else if (handle === "sw") {
    minX = Math.min(maxX - 8, p.x);
    maxY = Math.max(minY + 8, p.y);
  } else if (handle === "n") {
    minY = Math.min(maxY - 8, p.y);
  } else if (handle === "s") {
    maxY = Math.max(minY + 8, p.y);
  } else if (handle === "w") {
    minX = Math.min(maxX - 8, p.x);
  } else if (handle === "e") {
    maxX = Math.max(minX + 8, p.x);
  }

  const width = Math.max(8, maxX - minX);
  const height = Math.max(8, maxY - minY);

  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
    width,
    height,
  };
}

/**
 * Returns the appropriate CSS cursor for a given resize handle.
 */
export function getHandleCursor(handle: ResizeHandle): string {
  switch (handle) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    default:
      return "default";
  }
}

