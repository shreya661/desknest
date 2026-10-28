/**
 * Utility for smart list continuation, tab indentation, backspace handling,
 * and renumbering in DeskNest editor.
 * Supports:
 * - Numbered lists (1. , 2) , etc.) with automatic incrementing
 * - Bullet lists (- , * , + )
 * - Checklists (- [ ] , - [x] , * [ ] , etc.) with unchecked continuation (- [ ] )
 * - Clean exit on empty list items (Enter or Backspace)
 * - Indent & outdent via Tab / Shift+Tab preserving list markers
 * - Preserving leading indentation for nested list items
 * - Preserving text before and after cursor, and proper selection replacement
 * - Ordinary Enter behavior for non-list content
 */

export interface EditorEnterResult {
  newContent: string;
  newCursorPosition: number;
  isListContinuation: boolean;
  isListExit: boolean;
}

export interface EditorTabResult {
  newContent: string;
  newStart: number;
  newEnd: number;
  handled: boolean;
}

export interface EditorBackspaceResult {
  newContent: string;
  newCursorPosition: number;
  handled: boolean;
}

export function handleEditorEnter(
  content: string,
  selectionStart: number,
  selectionEnd: number = selectionStart
): EditorEnterResult {
  const before = content.slice(0, selectionStart);
  const after = content.slice(selectionEnd);

  const lastNewline = before.lastIndexOf("\n");
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const lineBeforeCursor = before.slice(lineStart);

  const nextNewline = after.indexOf("\n");
  const lineAfterCursor = nextNewline === -1 ? after : after.slice(0, nextNewline);
  const fullLine = lineBeforeCursor + lineAfterCursor;
  const fullTrimmed = fullLine.trim();

  // Helper for normal Enter behavior
  const normalEnter = (): EditorEnterResult => ({
    newContent: before + "\n" + after,
    newCursorPosition: before.length + 1,
    isListContinuation: false,
    isListExit: false,
  });

  // Ignore horizontal rules: ---, ***, ___
  if (fullTrimmed === "---" || fullTrimmed === "***" || fullTrimmed === "___") {
    return normalEnter();
  }

  // 1. Checklist items: e.g. "- [ ] ", "- [x] ", "  * [ ] "
  const checklistRegex = /^(\s*)([-*+])\s*\[([ xX])\](?:\s+(.*)|\s*)$/;
  const checklistMatch = lineBeforeCursor.match(checklistRegex);

  if (checklistMatch) {
    const indent = checklistMatch[1];
    const bulletChar = checklistMatch[2];
    const textBefore = checklistMatch[4] || "";
    const textAfter = lineAfterCursor;
    const isEmpty = textBefore.trim() === "" && textAfter.trim() === "";

    if (isEmpty) {
      // Exit list cleanly: remove the list marker on this line
      const newContent = before.slice(0, lineStart) + after.slice(lineAfterCursor.length);
      return {
        newContent,
        newCursorPosition: lineStart,
        isListContinuation: false,
        isListExit: true,
      };
    }

    // Continue list with unchecked marker
    const continuation = `\n${indent}${bulletChar} [ ] `;
    return {
      newContent: before + continuation + after,
      newCursorPosition: before.length + continuation.length,
      isListContinuation: true,
      isListExit: false,
    };
  }

  // 2. Numbered list items: e.g. "1. ", "9. ", "  1) "
  const numberedRegex = /^(\s*)(\d+)([.)])(?:\s+(.*)|\s*)$/;
  const numberedMatch = lineBeforeCursor.match(numberedRegex);

  if (numberedMatch) {
    const indent = numberedMatch[1];
    const numStr = numberedMatch[2];
    const delimiter = numberedMatch[3];
    const textBefore = numberedMatch[4] || "";
    const textAfter = lineAfterCursor;
    const isEmpty = textBefore.trim() === "" && textAfter.trim() === "";

    if (isEmpty) {
      // Exit list cleanly: remove the list marker on this line
      const newContent = before.slice(0, lineStart) + after.slice(lineAfterCursor.length);
      return {
        newContent,
        newCursorPosition: lineStart,
        isListContinuation: false,
        isListExit: true,
      };
    }

    // Continue list with incremented number
    const currentNum = parseInt(numStr, 10);
    const nextNum = isNaN(currentNum) ? 1 : currentNum + 1;
    const continuation = `\n${indent}${nextNum}${delimiter} `;
    return {
      newContent: before + continuation + after,
      newCursorPosition: before.length + continuation.length,
      isListContinuation: true,
      isListExit: false,
    };
  }

  // 3. Bullet list items: e.g. "- ", "* ", "+ ", "  - "
  const bulletRegex = /^(\s*)([-*+])(?:\s+(.*)|\s*)$/;
  const bulletMatch = lineBeforeCursor.match(bulletRegex);

  if (bulletMatch) {
    const indent = bulletMatch[1];
    const bulletChar = bulletMatch[2];
    const textBefore = bulletMatch[3] || "";
    const textAfter = lineAfterCursor;
    const isEmpty = textBefore.trim() === "" && textAfter.trim() === "";

    if (isEmpty) {
      // Exit list cleanly: remove the list marker on this line
      const newContent = before.slice(0, lineStart) + after.slice(lineAfterCursor.length);
      return {
        newContent,
        newCursorPosition: lineStart,
        isListContinuation: false,
        isListExit: true,
      };
    }

    // Continue bullet list
    const continuation = `\n${indent}${bulletChar} `;
    return {
      newContent: before + continuation + after,
      newCursorPosition: before.length + continuation.length,
      isListContinuation: true,
      isListExit: false,
    };
  }

  // 4. Ordinary Enter behavior
  return normalEnter();
}

/**
 * Handles Tab and Shift+Tab indentation / outdentation.
 * Indents list items and standard lines by 2 spaces.
 * Preserves selection across single or multi-line blocks.
 */
export function handleEditorTab(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  isShiftTab: boolean = false
): EditorTabResult {
  const INDENT = "  "; // 2 spaces

  // Find start of the first selected line
  const firstNewlineBefore = content.lastIndexOf("\n", selectionStart - 1);
  const blockStart = firstNewlineBefore === -1 ? 0 : firstNewlineBefore + 1;

  // Find end of the last selected line
  const endLookahead = selectionEnd > selectionStart ? selectionEnd - 1 : selectionEnd;
  const nextNewlineAfter = content.indexOf("\n", endLookahead);
  const blockEnd = nextNewlineAfter === -1 ? content.length : nextNewlineAfter;

  const targetBlock = content.slice(blockStart, blockEnd);
  const lines = targetBlock.split("\n");

  if (!isShiftTab) {
    // Indent each line
    const indentedLines = lines.map((line) => INDENT + line);
    const newBlock = indentedLines.join("\n");
    const newContent = content.slice(0, blockStart) + newBlock + content.slice(blockEnd);

    const addedPerLine = INDENT.length;
    const numLines = lines.length;

    const newStart = selectionStart + addedPerLine;
    const newEnd =
      selectionStart === selectionEnd
        ? newStart
        : selectionEnd + addedPerLine * numLines;

    return {
      newContent,
      newStart,
      newEnd,
      handled: true,
    };
  } else {
    // Outdent each line (remove up to 2 leading spaces)
    let removedTotal = 0;
    let firstLineRemoved = 0;

    const outdentedLines = lines.map((line, idx) => {
      let removeCount = 0;
      if (line.startsWith(INDENT)) {
        removeCount = INDENT.length;
      } else if (line.startsWith(" ")) {
        removeCount = 1;
      }

      if (idx === 0) firstLineRemoved = removeCount;
      removedTotal += removeCount;

      return line.slice(removeCount);
    });

    const newBlock = outdentedLines.join("\n");
    const newContent = content.slice(0, blockStart) + newBlock + content.slice(blockEnd);

    const newStart = Math.max(blockStart, selectionStart - firstLineRemoved);
    const newEnd =
      selectionStart === selectionEnd
        ? newStart
        : Math.max(newStart, selectionEnd - removedTotal);

    return {
      newContent,
      newStart,
      newEnd,
      handled: true,
    };
  }
}

/**
 * Handles Backspace on empty list items or at the beginning of a list item.
 * When a user is on an empty list item (e.g. "- ", "1. ", "  - "), pressing Backspace
 * cleanly outdents or clears the list marker instead of leaving orphaned punctuation.
 */
export function handleEditorBackspace(
  content: string,
  selectionStart: number,
  selectionEnd: number
): EditorBackspaceResult | null {
  // Only handle collapsed cursor
  if (selectionStart !== selectionEnd) return null;

  const lastNewline = content.lastIndexOf("\n", selectionStart - 1);
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const lineBeforeCursor = content.slice(lineStart, selectionStart);

  const nextNewline = content.indexOf("\n", selectionStart);
  const lineAfterCursor = nextNewline === -1 ? content.slice(selectionStart) : content.slice(selectionStart, nextNewline);

  // Check if current line contains only a list marker with no text after it
  const listMarkerRegex = /^(\s*)([-*+]|\d+[.)]|[-*+]\s*\[[ xX]\])\s*$/;
  const match = lineBeforeCursor.match(listMarkerRegex);

  if (match && lineAfterCursor.trim() === "") {
    const indent = match[1];

    if (indent.length >= 2) {
      // Outdent by 2 spaces
      const newContent =
        content.slice(0, lineStart) + content.slice(lineStart + 2);
      return {
        newContent,
        newCursorPosition: selectionStart - 2,
        handled: true,
      };
    } else {
      // Remove marker completely, converting to empty line
      const newContent =
        content.slice(0, lineStart) + content.slice(lineStart + lineBeforeCursor.length);
      return {
        newContent,
        newCursorPosition: lineStart,
        handled: true,
      };
    }
  }

  return null;
}

/**
 * Renumbers consecutive numbered list items within text.
 * E.g., if items became 1. A, 4. B, 5. C -> 1. A, 2. B, 3. C
 * Preserves hierarchical nesting counters (e.g. root 1, 2 with sub 1, 2).
 */
export function renumberNumberedList(content: string): string {
  const lines = content.split("\n");
  const counters: { [indentLen: number]: number } = {};

  const renumbered = lines.map((line) => {
    const match = line.match(/^(\s*)(\d+)([.)])(\s+.*)$/);
    if (match) {
      const indent = match[1];
      const delim = match[3];
      const rest = match[4];
      const indentLen = indent.length;

      // Reset any counters that were deeper than the current indent level
      for (const key of Object.keys(counters)) {
        if (Number(key) > indentLen) {
          delete counters[Number(key)];
        }
      }

      const current = counters[indentLen] || 1;
      counters[indentLen] = current + 1;

      return `${indent}${current}${delim}${rest}`;
    } else {
      // Non-numbered line: reset all counters
      for (const key of Object.keys(counters)) {
        delete counters[Number(key)];
      }
      return line;
    }
  });

  return renumbered.join("\n");
}
