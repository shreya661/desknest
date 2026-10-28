import { describe, it, expect } from "vitest";
import {
  toggleInlineMarker,
  applyTextColor,
  toggleHeading,
  cleanMarkdownSnippet,
  getTextColorClass,
} from "../src/utils/markdownFormatting";

describe("Markdown Formatting Utilities", () => {
  describe("1. Inline Text Colors", () => {
    it("wraps selected text in color tag [color:rose ...]", () => {
      const content = "Hello World";
      const start = "Hello ".length;
      const end = content.length; // "World"

      const result = applyTextColor(content, start, end, "rose");
      expect(result.newContent).toBe("Hello [color:rose World]");
      expect(result.newStart).toBe("Hello [color:rose ".length);
      expect(result.newEnd).toBe("Hello [color:rose World".length);
    });

    it("inserts placeholder and selects it when no text is selected", () => {
      const content = "Prefix ";
      const start = content.length;
      const end = content.length;

      const result = applyTextColor(content, start, end, "emerald");
      expect(result.newContent).toBe("Prefix [color:emerald colored text]");
      expect(result.newStart).toBe("Prefix [color:emerald ".length);
      expect(result.newEnd).toBe("Prefix [color:emerald colored text".length);
    });

    it("toggles off color tag when selection includes the color tag", () => {
      const content = "Before [color:sky Selected Item] After";
      const start = "Before ".length;
      const end = "Before [color:sky Selected Item]".length;

      const result = applyTextColor(content, start, end, "sky");
      expect(result.newContent).toBe("Before Selected Item After");
      expect(result.newStart).toBe(start);
      expect(result.newEnd).toBe(start + "Selected Item".length);
    });

    it("toggles off color tag when selection is inside the color tag", () => {
      const content = "Before [color:purple Selected Item] After";
      const start = "Before [color:purple ".length;
      const end = start + "Selected Item".length;

      const result = applyTextColor(content, start, end, "purple");
      expect(result.newContent).toBe("Before Selected Item After");
      expect(result.newStart).toBe("Before ".length);
      expect(result.newEnd).toBe("Before Selected Item".length);
    });

    it("returns theme-safe accessible CSS classes for all 5 colors", () => {
      expect(getTextColorClass("rose")).toContain("text-rose-600");
      expect(getTextColorClass("amber")).toContain("text-amber-700");
      expect(getTextColorClass("emerald")).toContain("text-emerald-700");
      expect(getTextColorClass("sky")).toContain("text-sky-700");
      expect(getTextColorClass("purple")).toContain("text-purple-700");
    });
  });

  describe("2. Highlighted Text (==text==)", () => {
    it("wraps selected text with == highlight markers", () => {
      const content = "Highlight this phrase now";
      const start = "Highlight ".length;
      const end = "Highlight this phrase".length;

      const result = toggleInlineMarker(content, start, end, "==", "==", "highlighted text");
      expect(result.newContent).toBe("Highlight ==this phrase== now");
      expect(result.newStart).toBe("Highlight ==".length);
      expect(result.newEnd).toBe("Highlight ==this phrase".length);
    });

    it("inserts placeholder and selects it when cursor is collapsed", () => {
      const content = "Note: ";
      const pos = content.length;

      const result = toggleInlineMarker(content, pos, pos, "==", "==", "highlighted text");
      expect(result.newContent).toBe("Note: ==highlighted text==");
      expect(result.newStart).toBe("Note: ==".length);
      expect(result.newEnd).toBe("Note: ==highlighted text".length);
    });

    it("toggles off highlight when selection contains == markers", () => {
      const content = "A ==highlighted== item";
      const start = "A ".length;
      const end = "A ==highlighted==".length;

      const result = toggleInlineMarker(content, start, end, "==", "==");
      expect(result.newContent).toBe("A highlighted item");
      expect(result.newStart).toBe(start);
      expect(result.newEnd).toBe(start + "highlighted".length);
    });

    it("toggles off highlight when selection is immediately inside == markers", () => {
      const content = "A ==highlighted== item";
      const start = "A ==".length;
      const end = start + "highlighted".length;

      const result = toggleInlineMarker(content, start, end, "==", "==");
      expect(result.newContent).toBe("A highlighted item");
      expect(result.newStart).toBe("A ".length);
      expect(result.newEnd).toBe("A highlighted".length);
    });
  });

  describe("3. Bold and Italic Toggling", () => {
    it("applies bold markers to selected text", () => {
      const content = "Make me bold please";
      const start = "Make me ".length;
      const end = "Make me bold".length;

      const result = toggleInlineMarker(content, start, end, "**", "**", "bold text");
      expect(result.newContent).toBe("Make me **bold** please");
    });

    it("toggles off bold markers when already bold", () => {
      const content = "Make me **bold** please";
      const start = "Make me ".length;
      const end = "Make me **bold**".length;

      const result = toggleInlineMarker(content, start, end, "**", "**");
      expect(result.newContent).toBe("Make me bold please");
    });

    it("applies italic markers to selected text", () => {
      const content = "Make me italic please";
      const start = "Make me ".length;
      const end = "Make me italic".length;

      const result = toggleInlineMarker(content, start, end, "*", "*", "italic text");
      expect(result.newContent).toBe("Make me *italic* please");
    });

    it("toggles off italic markers when already italic", () => {
      const content = "Make me *italic* please";
      const start = "Make me ".length;
      const end = "Make me *italic*".length;

      const result = toggleInlineMarker(content, start, end, "*", "*");
      expect(result.newContent).toBe("Make me italic please");
    });
  });

  describe("4. Heading Hierarchy (H1, H2, H3)", () => {
    it("applies H1 to a plain line", () => {
      const content = "First Heading\nParagraph below";
      const result = toggleHeading(content, 5, 5, 1);

      expect(result.newContent).toBe("# First Heading\nParagraph below");
      expect(result.newStart).toBe(5 + "# ".length);
    });

    it("toggles H1 off to plain line when H1 is already active", () => {
      const content = "# First Heading\nParagraph below";
      const result = toggleHeading(content, 7, 7, 1);

      expect(result.newContent).toBe("First Heading\nParagraph below");
      expect(result.newStart).toBe(7 - "# ".length);
    });

    it("switches from H1 to H2 when clicking H2", () => {
      const content = "# First Heading\nParagraph below";
      const result = toggleHeading(content, 5, 5, 2);

      expect(result.newContent).toBe("## First Heading\nParagraph below");
      expect(result.newStart).toBe(5 + ("## ".length - "# ".length));
    });

    it("applies H3 to a plain line", () => {
      const content = "Section Subsection\nText";
      const result = toggleHeading(content, 4, 4, 3);

      expect(result.newContent).toBe("### Section Subsection\nText");
      expect(result.newStart).toBe(4 + "### ".length);
    });

    it("switches from H2 to H3 cleanly", () => {
      const content = "## Section Subsection\nText";
      const result = toggleHeading(content, 5, 5, 3);

      expect(result.newContent).toBe("### Section Subsection\nText");
    });

    it("toggles H3 off to plain paragraph", () => {
      const content = "### Section Subsection\nText";
      const result = toggleHeading(content, 5, 5, 3);

      expect(result.newContent).toBe("Section Subsection\nText");
    });
  });

  describe("5. Clean Markdown Snippet for Note Cards", () => {
    it("strips headings, lists, colors, highlights, bold, and italic", () => {
      const raw = `# Meeting Notes
> 📌 **KEY TAKEAWAY**
- [x] Done item
- [ ] Todo item
Here is ==highlighted== text and [color:rose vibrant color].
***Bold Italic*** and \`code\`.`;

      const snippet = cleanMarkdownSnippet(raw);

      expect(snippet).not.toContain("#");
      expect(snippet).not.toContain("==");
      expect(snippet).not.toContain("[color:");
      expect(snippet).not.toContain("**");
      expect(snippet).not.toContain("`");
      expect(snippet).toContain("Meeting Notes");
      expect(snippet).toContain("Done item");
      expect(snippet).toContain("highlighted text");
      expect(snippet).toContain("vibrant color");
      expect(snippet).toContain("Bold Italic");
    });

    it("returns default text for empty content", () => {
      expect(cleanMarkdownSnippet("")).toBe("Empty note content...");
      expect(cleanMarkdownSnippet("   ")).toBe("Empty note content...");
    });
  });
});
