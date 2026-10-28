/**
 * Utility for smart list continuation and ordinary Enter handling in DeskNest editor.
 * Supports:
 * - Numbered lists (1. , 2) , etc.) with automatic incrementing
 * - Bullet lists (- , * , + )
 * - Checklists (- [ ] , - [x] , * [ ] , etc.) with unchecked continuation (- [ ] )
 * - Clean exit on empty list items
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
