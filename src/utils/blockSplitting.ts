import { Note, NoteBlock } from "../types";

export interface SplitResult {
  topContent: string;
  bottomContent: string;
  fallbackReason?: string;
}

/**
 * Splits a text block at the cursor position while strictly preserving all text,
 * Markdown syntax, headings, lists, and inline formatting without dropping any user content.
 */
export function splitTextBlockAtCursor(
  content: string,
  cursorOffset: number
): SplitResult {
  if (cursorOffset <= 0) {
    return { topContent: "", bottomContent: content };
  }
  if (cursorOffset >= content.length) {
    return { topContent: content, bottomContent: "" };
  }

  // Find the boundaries of the line containing the cursor
  const lineStart = content.lastIndexOf("\n", cursorOffset - 1) + 1;
  const nextNewline = content.indexOf("\n", cursorOffset);
  const lineEnd = nextNewline === -1 ? content.length : nextNewline;
  const line = content.slice(lineStart, lineEnd);
  const col = cursorOffset - lineStart;

  // 1. Heading check: e.g. "# Heading text" or "### Subheading"
  const headingPrefixMatch = line.match(/^(#{1,6}\s+)/);
  if (headingPrefixMatch) {
    const prefixLen = headingPrefixMatch[0].length;
    // If cursor is within the hash/space prefix (e.g. inside "## ")
    if (col < prefixLen) {
      return {
        topContent: content.slice(0, lineStart),
        bottomContent: content.slice(lineStart),
        fallbackReason:
          "Drawing inserted before the heading because cursor was inside the heading marker.",
      };
    }
  }

  // 2. Checklist / List check: e.g. "- [ ] item" or "1. item" or "- item"
  const checklistMatch = line.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)/);
  if (checklistMatch && col < checklistMatch[0].length) {
    return {
      topContent: content.slice(0, lineStart),
      bottomContent: content.slice(lineStart),
      fallbackReason:
        "Drawing inserted before the checklist item because cursor was inside the checkbox marker.",
    };
  }

  const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)/);
  if (listMatch && col < listMatch[0].length) {
    return {
      topContent: content.slice(0, lineStart),
      bottomContent: content.slice(lineStart),
      fallbackReason:
        "Drawing inserted before the list item because cursor was inside the list bullet/number.",
    };
  }

  // 3. Inline formatting delimiter check: **, *, ~~, `
  // If cursor is inside a pair like **bold|text**, splitting directly would break the markdown syntax.
  const inlineDelimiters = ["**", "~~", "`", "*"];
  for (const delim of inlineDelimiters) {
    const dLen = delim.length;
    // Check if cursor is directly inside the delimiter characters itself
    if (
      col >= dLen &&
      line.slice(col - dLen, col) === delim &&
      line.indexOf(delim, col) !== -1
    ) {
      // Cursor is right at the opening delimiter
      return {
        topContent: content.slice(0, lineStart + col - dLen),
        bottomContent: content.slice(lineStart + col - dLen),
        fallbackReason:
          "Drawing inserted before formatted span because cursor was inside format marker.",
      };
    }

    // Check if cursor is between opening and closing delimiter on this line
    const beforeText = line.slice(0, col);
    const afterText = line.slice(col);
    const lastOpen = beforeText.lastIndexOf(delim);
    const firstClose = afterText.indexOf(delim);

    if (lastOpen !== -1 && firstClose !== -1) {
      // Cursor is sandwiched inside an active formatting span
      // Snap split to immediately after the closing delimiter to maintain clean Markdown
      const snapOffset = lineStart + col + firstClose + dLen;
      return {
        topContent: content.slice(0, snapOffset),
        bottomContent: content.slice(snapOffset),
        fallbackReason:
          "Drawing inserted after formatted text to preserve complete Markdown syntax.",
      };
    }
  }

  // Default clean split at exact cursor position (zero characters lost)
  return {
    topContent: content.slice(0, cursorOffset),
    bottomContent: content.slice(cursorOffset),
  };
}

/**
 * Derives a Markdown string representation from canonical blocks.
 * Used for global search indexing, note card previews, and export.
 */
export function deriveNoteContent(blocks: NoteBlock[]): string {
  if (!blocks || blocks.length === 0) return "";

  return blocks
    .map((block) => {
      if (block.type === "text") {
        return block.content;
      }
      if (block.type === "drawing") {
        const title = block.title || "Embedded Drawing";
        return `![drawing:${block.drawingId}](${title})`;
      }
      return "";
    })
    .join("\n\n")
    .trim();
}

/**
 * Ensures a note has canonical blocks.
 * Hydrates legacy notes (which only have note.content) into a single text block.
 */
export function ensureNoteBlocks(note: Note): NoteBlock[] {
  if (note.blocks && note.blocks.length > 0) {
    return note.blocks;
  }

  return [
    {
      id: "blk_" + (note.id || Date.now().toString()) + "_txt",
      type: "text",
      content: note.content || "",
    },
  ];
}
