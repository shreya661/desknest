/**
 * Markdown Formatting Utilities for DeskNest.
 * Provides pure, testable functions for:
 * - Toggling inline markers (bold, italic, strike, highlight, code)
 * - Applying and toggling safe text colors (Rose, Amber, Emerald, Sky, Purple)
 * - Toggling heading hierarchy (H1, H2, H3) on the current line
 * - Stripping markdown formatting tokens for clean card snippets
 */

export type TextColor = "rose" | "amber" | "emerald" | "sky" | "purple";

export interface FormattingResult {
  newContent: string;
  newStart: number;
  newEnd: number;
}

/**
 * Returns accessible, theme-safe Tailwind CSS class names for each supported text color.
 */
export function getTextColorClass(color: TextColor): string {
  switch (color) {
    case "rose":
      return "text-rose-600 dark:text-rose-400 font-medium";
    case "amber":
      return "text-amber-700 dark:text-amber-300 font-medium";
    case "emerald":
      return "text-emerald-700 dark:text-emerald-400 font-medium";
    case "sky":
      return "text-sky-700 dark:text-sky-400 font-medium";
    case "purple":
      return "text-purple-700 dark:text-purple-400 font-medium";
    default:
      return "text-foreground";
  }
}

/**
 * Toggles an inline markdown marker (e.g. `**` for bold, `*` for italic, `==` for highlight).
 * If the selected text (or surrounding text) already has the marker, it removes it (toggle off).
 * If no text is selected, it inserts `prefix + placeholder + suffix` and selects the placeholder.
 */
export function toggleInlineMarker(
  content: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string = prefix,
  placeholder: string = "text"
): FormattingResult {
  const selected = content.slice(start, end);

  // Case 1: The selection itself includes the prefix and suffix (e.g. user selected "**hello**")
  if (
    selected.startsWith(prefix) &&
    selected.endsWith(suffix) &&
    selected.length >= prefix.length + suffix.length
  ) {
    const unformatted = selected.slice(prefix.length, selected.length - suffix.length);
    const newContent = content.slice(0, start) + unformatted + content.slice(end);
    return {
      newContent,
      newStart: start,
      newEnd: start + unformatted.length,
    };
  }

  // Case 2: The text immediately surrounding the selection already has prefix and suffix
  // (e.g. content has "**hello**", and user selected "hello" from index 2 to 7)
  const hasSurroundingPrefix =
    start >= prefix.length && content.slice(start - prefix.length, start) === prefix;
  const hasSurroundingSuffix =
    end + suffix.length <= content.length && content.slice(end, end + suffix.length) === suffix;

  if (hasSurroundingPrefix && hasSurroundingSuffix) {
    const newContent =
      content.slice(0, start - prefix.length) + selected + content.slice(end + suffix.length);
    return {
      newContent,
      newStart: start - prefix.length,
      newEnd: start - prefix.length + selected.length,
    };
  }

  // Case 3: Empty selection (collapsed cursor)
  if (start === end) {
    const replacement = prefix + placeholder + suffix;
    const newContent = content.slice(0, start) + replacement + content.slice(end);
    return {
      newContent,
      newStart: start + prefix.length,
      newEnd: start + prefix.length + placeholder.length,
    };
  }

  // Case 4: Text is selected -> wrap selection in prefix and suffix
  const replacement = prefix + selected + suffix;
  const newContent = content.slice(0, start) + replacement + content.slice(end);
  return {
    newContent,
    newStart: start + prefix.length,
    newEnd: start + prefix.length + selected.length,
  };
}

/**
 * Applies or toggles a persistent text color tag: `[color:<name> <text>]`.
 * If text is selected, wraps it: `[color:rose <selected>]`.
 * If already wrapped in this color tag, toggles it off.
 * If no text is selected, inserts `[color:<name> text]` and selects "text".
 */
export function applyTextColor(
  content: string,
  start: number,
  end: number,
  color: TextColor
): FormattingResult {
  const prefix = `[color:${color} `;
  const suffix = "]";
  const selected = content.slice(start, end);

  // Check if selection is already this exact color tag
  if (selected.startsWith(prefix) && selected.endsWith(suffix)) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length);
    const newContent = content.slice(0, start) + inner + content.slice(end);
    return {
      newContent,
      newStart: start,
      newEnd: start + inner.length,
    };
  }

  // Check if cursor/selection is immediately surrounded by this color tag
  const hasPrefix = start >= prefix.length && content.slice(start - prefix.length, start) === prefix;
  const hasSuffix =
    end + suffix.length <= content.length && content.slice(end, end + suffix.length) === suffix;

  if (hasPrefix && hasSuffix) {
    const newContent =
      content.slice(0, start - prefix.length) + selected + content.slice(end + suffix.length);
    return {
      newContent,
      newStart: start - prefix.length,
      newEnd: start - prefix.length + selected.length,
    };
  }

  // Empty selection: insert placeholder and select it
  if (start === end) {
    const placeholder = "colored text";
    const replacement = prefix + placeholder + suffix;
    const newContent = content.slice(0, start) + replacement + content.slice(end);
    return {
      newContent,
      newStart: start + prefix.length,
      newEnd: start + prefix.length + placeholder.length,
    };
  }

  // Selected text: wrap in color tag
  const replacement = prefix + selected + suffix;
  const newContent = content.slice(0, start) + replacement + content.slice(end);
  return {
    newContent,
    newStart: start + prefix.length,
    newEnd: start + prefix.length + selected.length,
  };
}

/**
 * Toggles heading hierarchy for the current line containing cursorIndex.
 * Levels: 1 (# ), 2 (## ), 3 (### ).
 * If the current line already has this exact heading level, removes it (toggles off to paragraph).
 * If the current line has a different heading level, replaces the prefix with the requested level.
 * Preserves cursor position and selection on that line.
 */
export function toggleHeading(
  content: string,
  cursorStart: number,
  cursorEnd: number = cursorStart,
  targetLevel: 1 | 2 | 3 = 1
): FormattingResult {
  const lastNewline = content.lastIndexOf("\n", cursorStart - 1);
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

  const nextNewline = content.indexOf("\n", cursorStart);
  const lineEnd = nextNewline === -1 ? content.length : nextNewline;

  const currentLine = content.slice(lineStart, lineEnd);
  const targetPrefix = "#".repeat(targetLevel) + " ";

  // Match any existing heading prefix (# , ## , ### , etc.)
  const headingMatch = currentLine.match(/^(#{1,6})\s+/);

  let newLine = currentLine;
  let oldPrefixLen = 0;
  let newPrefixLen = 0;

  if (headingMatch) {
    oldPrefixLen = headingMatch[0].length;
    const currentLevel = headingMatch[1].length;

    if (currentLevel === targetLevel) {
      // Toggle OFF: remove heading prefix
      newLine = currentLine.slice(oldPrefixLen);
      newPrefixLen = 0;
    } else {
      // Switch level: replace prefix
      newLine = targetPrefix + currentLine.slice(oldPrefixLen);
      newPrefixLen = targetPrefix.length;
    }
  } else {
    // Apply heading prefix
    newLine = targetPrefix + currentLine;
    oldPrefixLen = 0;
    newPrefixLen = targetPrefix.length;
  }

  const delta = newPrefixLen - oldPrefixLen;
  const newContent = content.slice(0, lineStart) + newLine + content.slice(lineEnd);

  const newStart = Math.max(lineStart + newPrefixLen, cursorStart + delta);
  const newEnd = Math.max(lineStart + newPrefixLen, cursorEnd + delta);

  return {
    newContent,
    newStart,
    newEnd,
  };
}

/**
 * Removes raw markdown markers, formatting tokens, and tags to create a clean,
 * readable plain-text snippet for note card previews.
 */
export function cleanMarkdownSnippet(content: string): string {
  if (!content || !content.trim()) return "Empty note content...";

  return content
    // Remove headings (# , ## , ### )
    .replace(/^#{1,6}\s+/gm, "")
    // Remove callout/blockquote prefixes (> )
    .replace(/^>\s*/gm, "")
    // Convert checklists
    .replace(/^-\s*\[[xX]\]\s*/gm, "✓ ")
    .replace(/^-\s*\[\s*\]\s*/gm, "☐ ")
    // Convert bullet lists
    .replace(/^[-*+]\s+/gm, "• ")
    // Clean color tags: [color:rose text] -> text
    .replace(/\[color:(?:rose|amber|emerald|sky|purple)\s+([^\]]+)\]/g, "$1")
    // Clean highlights: ==text== -> text
    .replace(/==([^=]+)==/g, "$1")
    // Clean bold, italic, strikethrough, inline code
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    // Remove horizontal rules
    .replace(/^(?:---|___|\*\*\*)$/gm, "")
    // Collapse multiple blank lines
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
