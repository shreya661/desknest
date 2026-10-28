import { describe, it, expect } from "vitest";
import {
  handleEditorEnter,
  handleEditorTab,
  handleEditorBackspace,
  renumberNumberedList,
} from "../src/utils/listContinuation";

describe("Smart List Continuation & Enter Handling", () => {
  describe("1. Numbered Lists", () => {
    it("increments number after a numbered list item", () => {
      const content = "1. First item";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.isListExit).toBe(false);
      expect(result.newContent).toBe("1. First item\n2. ");
      expect(result.newCursorPosition).toBe("1. First item\n2. ".length);
    });

    it("increments multi-digit and larger numbers", () => {
      const content = "9. Ninth item";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("9. Ninth item\n10. ");
      expect(result.newCursorPosition).toBe("9. Ninth item\n10. ".length);
    });

    it("preserves alternative delimiters like parentheses", () => {
      const content = "1) Parenthesis numbered item";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("1) Parenthesis numbered item\n2) ");
      expect(result.newCursorPosition).toBe("1) Parenthesis numbered item\n2) ".length);
    });
  });

  describe("2. Bullet Lists", () => {
    it("continues hyphen bullet list", () => {
      const content = "- Hyphen item";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.isListExit).toBe(false);
      expect(result.newContent).toBe("- Hyphen item\n- ");
      expect(result.newCursorPosition).toBe("- Hyphen item\n- ".length);
    });

    it("continues asterisk bullet list", () => {
      const content = "* Asterisk item";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("* Asterisk item\n* ");
      expect(result.newCursorPosition).toBe("* Asterisk item\n* ".length);
    });

    it("continues plus bullet list", () => {
      const content = "+ Plus item";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("+ Plus item\n+ ");
      expect(result.newCursorPosition).toBe("+ Plus item\n+ ".length);
    });
  });

  describe("3. Checklist Items", () => {
    it("continues an unchecked checklist item with an unchecked box", () => {
      const content = "- [ ] Task to do";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.isListExit).toBe(false);
      expect(result.newContent).toBe("- [ ] Task to do\n- [ ] ");
      expect(result.newCursorPosition).toBe("- [ ] Task to do\n- [ ] ".length);
    });

    it("continues a checked checklist item (- [x]) with an unchecked box (- [ ] )", () => {
      const content = "- [x] Finished task";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.isListExit).toBe(false);
      expect(result.newContent).toBe("- [x] Finished task\n- [ ] ");
      expect(result.newCursorPosition).toBe("- [x] Finished task\n- [ ] ".length);
    });

    it("continues uppercase checked item (- [X]) with unchecked box", () => {
      const content = "- [X] Task completed uppercase";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("- [X] Task completed uppercase\n- [ ] ");
      expect(result.newCursorPosition).toBe("- [X] Task completed uppercase\n- [ ] ".length);
    });
  });

  describe("4. Empty-Item Exit", () => {
    it("exits numbered list cleanly when pressing Enter on an empty item", () => {
      const content = "1. Item 1\n2. ";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(false);
      expect(result.isListExit).toBe(true);
      expect(result.newContent).toBe("1. Item 1\n");
      expect(result.newCursorPosition).toBe("1. Item 1\n".length);
    });

    it("exits bullet list cleanly when pressing Enter on an empty bullet", () => {
      const content = "- Item 1\n- ";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(false);
      expect(result.isListExit).toBe(true);
      expect(result.newContent).toBe("- Item 1\n");
      expect(result.newCursorPosition).toBe("- Item 1\n".length);
    });

    it("exits checklist cleanly when pressing Enter on an empty checklist item", () => {
      const content = "- [ ] Task 1\n- [ ] ";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(false);
      expect(result.isListExit).toBe(true);
      expect(result.newContent).toBe("- [ ] Task 1\n");
      expect(result.newCursorPosition).toBe("- [ ] Task 1\n".length);
    });

    it("exits cleanly when single empty item is at start of document", () => {
      const content = "- ";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListExit).toBe(true);
      expect(result.newContent).toBe("");
      expect(result.newCursorPosition).toBe(0);
    });
  });

  describe("5. Nested Items & Indentation", () => {
    it("preserves indentation on nested bullet items", () => {
      const content = "  - Nested bullet";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("  - Nested bullet\n  - ");
      expect(result.newCursorPosition).toBe("  - Nested bullet\n  - ".length);
    });

    it("preserves indentation on nested numbered items", () => {
      const content = "    1. Deeply nested";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("    1. Deeply nested\n    2. ");
      expect(result.newCursorPosition).toBe("    1. Deeply nested\n    2. ".length);
    });

    it("preserves indentation on nested checklist items", () => {
      const content = "   - [ ] Nested check";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("   - [ ] Nested check\n   - [ ] ");
      expect(result.newCursorPosition).toBe("   - [ ] Nested check\n   - [ ] ".length);
    });

    it("exits nested list cleanly when pressing Enter on empty nested item", () => {
      const content = "- Parent\n  - ";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListExit).toBe(true);
      expect(result.newContent).toBe("- Parent\n");
      expect(result.newCursorPosition).toBe("- Parent\n".length);
    });
  });

  describe("6. Cursor Positioning & Text Preservation", () => {
    it("preserves text before and after cursor when splitting a list item in the middle", () => {
      const content = "- First part and second part";
      // Split between "First part" and " and second part"
      const cursor = "- First part".length;
      const result = handleEditorEnter(content, cursor);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("- First part\n-  and second part");
      expect(result.newCursorPosition).toBe("- First part\n- ".length);
    });

    it("preserves following lines in a multi-line document", () => {
      const content = "- Item 1\nParagraph below";
      const cursor = "- Item 1".length;
      const result = handleEditorEnter(content, cursor);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("- Item 1\n- \nParagraph below");
      expect(result.newCursorPosition).toBe("- Item 1\n- ".length);
    });

    it("properly handles selected text replacement inside a list item", () => {
      const content = "1. Hello REPLACE_ME world";
      const start = "1. Hello ".length;
      const end = "1. Hello REPLACE_ME".length;

      const result = handleEditorEnter(content, start, end);

      expect(result.isListContinuation).toBe(true);
      expect(result.newContent).toBe("1. Hello \n2.  world");
      expect(result.newCursorPosition).toBe("1. Hello \n2. ".length);
    });
  });

  describe("7. Normal Enter Behavior", () => {
    it("inserts standard newline on non-list text", () => {
      const content = "Just a standard paragraph";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(false);
      expect(result.isListExit).toBe(false);
      expect(result.newContent).toBe("Just a standard paragraph\n");
      expect(result.newCursorPosition).toBe("Just a standard paragraph\n".length);
    });

    it("inserts standard newline and replaces selection in non-list text", () => {
      const content = "Line 1 SELECTED Line 2";
      const start = "Line 1 ".length;
      const end = "Line 1 SELECTED".length;

      const result = handleEditorEnter(content, start, end);

      expect(result.isListContinuation).toBe(false);
      expect(result.newContent).toBe("Line 1 \n Line 2");
      expect(result.newCursorPosition).toBe("Line 1 \n".length);
    });

    it("does not mistake horizontal rules for bullet lists", () => {
      const content = "---";
      const result = handleEditorEnter(content, content.length);

      expect(result.isListContinuation).toBe(false);
      expect(result.newContent).toBe("---\n");
    });
  });

  describe("8. Tab & Shift+Tab Indentation / Outdentation", () => {
    it("indents a list item by 2 spaces on Tab", () => {
      const content = "- List item";
      const result = handleEditorTab(content, 0, 0, false);

      expect(result.handled).toBe(true);
      expect(result.newContent).toBe("  - List item");
      expect(result.newStart).toBe(2);
    });

    it("outdents an indented list item on Shift+Tab", () => {
      const content = "  - Indented item";
      const result = handleEditorTab(content, 4, 4, true);

      expect(result.handled).toBe(true);
      expect(result.newContent).toBe("- Indented item");
      expect(result.newStart).toBe(2);
    });

    it("indents multiple selected lines simultaneously", () => {
      const content = "1. Item A\n2. Item B";
      const result = handleEditorTab(content, 0, content.length, false);

      expect(result.handled).toBe(true);
      expect(result.newContent).toBe("  1. Item A\n  2. Item B");
    });

    it("outdents multiple selected lines on Shift+Tab", () => {
      const content = "  - Item A\n  - Item B";
      const result = handleEditorTab(content, 0, content.length, true);

      expect(result.handled).toBe(true);
      expect(result.newContent).toBe("- Item A\n- Item B");
    });
  });

  describe("9. Backspace Handling on Empty List Items", () => {
    it("clears root bullet marker cleanly on Backspace", () => {
      const content = "- ";
      const result = handleEditorBackspace(content, 2, 2);

      expect(result).not.toBeNull();
      expect(result?.handled).toBe(true);
      expect(result?.newContent).toBe("");
      expect(result?.newCursorPosition).toBe(0);
    });

    it("clears numbered list marker cleanly on Backspace", () => {
      const content = "1. ";
      const result = handleEditorBackspace(content, 3, 3);

      expect(result).not.toBeNull();
      expect(result?.handled).toBe(true);
      expect(result?.newContent).toBe("");
      expect(result?.newCursorPosition).toBe(0);
    });

    it("outdents nested empty list item on Backspace", () => {
      const content = "  - ";
      const result = handleEditorBackspace(content, 4, 4);

      expect(result).not.toBeNull();
      expect(result?.handled).toBe(true);
      expect(result?.newContent).toBe("- ");
      expect(result?.newCursorPosition).toBe(2);
    });

    it("returns null if cursor has non-empty text following", () => {
      const content = "- Text here";
      const result = handleEditorBackspace(content, 2, 2);

      expect(result).toBeNull();
    });
  });

  describe("10. Numbered List Renumbering", () => {
    it("renumbers non-sequential numbered list items", () => {
      const content = "1. First\n4. Second\n9. Third";
      const result = renumberNumberedList(content);

      expect(result).toBe("1. First\n2. Second\n3. Third");
    });

    it("preserves indentation when renumbering nested lists", () => {
      const content = "1. Root A\n  1. Sub 1\n  5. Sub 2\n2. Root B";
      const result = renumberNumberedList(content);

      expect(result).toBe("1. Root A\n  1. Sub 1\n  2. Sub 2\n2. Root B");
    });
  });
});
