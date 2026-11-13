import { describe, it, expect } from "vitest";
import { kanbanPlugin, KanbanBlockData } from "../src/blocks/plugins/kanbanPlugin";
import { tablePlugin, TableBlockData } from "../src/blocks/plugins/tablePlugin";
import { getBlockPlugin, getAllBlockPlugins, createBlockInstance } from "../src/blocks";
import { insertBlockWithSplit, deriveNoteContent } from "../src/utils/blockSplitting";
import { NoteBlock, TextBlock } from "../src/types";

describe("Productivity Block Plugins & Slash Command Block Insertion", () => {
  describe("Kanban Plugin Serialization", () => {
    it("should be registered in block registry", () => {
      const plugin = getBlockPlugin("kanban");
      expect(plugin).toBeDefined();
      expect(plugin?.type).toBe("kanban");
      expect(plugin?.shortcut).toBe("/kanban");

      const all = getAllBlockPlugins();
      expect(all.some((p) => p.type === "kanban")).toBe(true);
    });

    it("should generate default data with 3 columns", () => {
      const defaultData = kanbanPlugin.defaultData();
      expect(defaultData.columns).toHaveLength(3);
      expect(defaultData.columns.map((c) => c.title)).toEqual([
        "To Do",
        "In Progress",
        "Done",
      ]);
    });

    it("should serialize columns and cards into markdown task lists", () => {
      const mockData: KanbanBlockData = {
        columns: [
          {
            id: "col_1",
            title: "Backlog",
            cards: [
              { id: "c1", text: "Design block engine", done: true },
              { id: "c2", text: "Implement keyboard shortcuts", done: false },
            ],
          },
          {
            id: "col_2",
            title: "Sprint",
            cards: [{ id: "c3", text: "Write unit tests", done: false }],
          },
        ],
      };

      const plainText = kanbanPlugin.toPlainText(mockData);
      expect(plainText).toContain("### Backlog");
      expect(plainText).toContain("- [x] Design block engine");
      expect(plainText).toContain("- [ ] Implement keyboard shortcuts");
      expect(plainText).toContain("### Sprint");
      expect(plainText).toContain("- [ ] Write unit tests");
    });

    it("should handle empty or null data safely", () => {
      expect(kanbanPlugin.toPlainText({ columns: [] })).toBe("");
      expect(kanbanPlugin.toPlainText(null as any)).toBe("");
    });
  });

  describe("Table Plugin Serialization", () => {
    it("should be registered in block registry", () => {
      const plugin = getBlockPlugin("table");
      expect(plugin).toBeDefined();
      expect(plugin?.type).toBe("table");
      expect(plugin?.shortcut).toBe("/table");

      const all = getAllBlockPlugins();
      expect(all.some((p) => p.type === "table")).toBe(true);
    });

    it("should generate default data with 3 columns and 2 rows", () => {
      const defaultData = tablePlugin.defaultData();
      expect(defaultData.headers).toHaveLength(3);
      expect(defaultData.rows).toHaveLength(2);
    });

    it("should serialize grid into standard GFM markdown table", () => {
      const mockData: TableBlockData = {
        headers: ["Feature", "Status", "Owner"],
        rows: [
          ["Slash Commands", "Complete", "Frontend"],
          ["Kanban Block", "Verified", "Architect"],
        ],
      };

      const plainText = tablePlugin.toPlainText(mockData);
      const lines = plainText.split("\n");

      expect(lines[0]).toBe("| Feature | Status | Owner |");
      expect(lines[1]).toBe("| --- | --- | --- |");
      expect(lines[2]).toBe("| Slash Commands | Complete | Frontend |");
      expect(lines[3]).toBe("| Kanban Block | Verified | Architect |");
    });

    it("should handle empty or null table data safely", () => {
      expect(tablePlugin.toPlainText({ headers: [], rows: [] })).toBe("");
      expect(tablePlugin.toPlainText(null as any)).toBe("");
    });
  });

  describe("Slash Command Block Insertion & Splitting", () => {
    it("should strip /kanban command and replace empty block", () => {
      const initialBlocks: NoteBlock[] = [
        {
          id: "blk_1",
          type: "text",
          content: "/kanban",
        },
      ];

      const kanbanBlock = createBlockInstance("kanban") as NoteBlock;
      const { nextBlocks, activeBlockId } = insertBlockWithSplit(
        initialBlocks,
        "blk_1",
        0, // slashIndex
        7, // cursorOffset (after '/kanban')
        kanbanBlock
      );

      expect(nextBlocks).toHaveLength(1);
      expect(nextBlocks[0].type).toBe("kanban");
      expect(activeBlockId).toBe(kanbanBlock.id);
    });

    it("should strip command and split text block when inserted between paragraphs", () => {
      const fullText = "First paragraph\n/table\nSecond paragraph";
      const slashIndex = fullText.indexOf("/table");
      const cursorOffset = slashIndex + "/table".length;

      const initialBlocks: NoteBlock[] = [
        {
          id: "blk_text_1",
          type: "text",
          content: fullText,
        },
      ];

      const tableBlock = createBlockInstance("table") as NoteBlock;
      const { nextBlocks, activeBlockId } = insertBlockWithSplit(
        initialBlocks,
        "blk_text_1",
        slashIndex,
        cursorOffset,
        tableBlock
      );

      expect(nextBlocks).toHaveLength(3);
      expect(nextBlocks[0].type).toBe("text");
      expect((nextBlocks[0] as TextBlock).content).toBe("First paragraph\n");

      expect(nextBlocks[1].type).toBe("table");
      expect(activeBlockId).toBe(tableBlock.id);

      expect(nextBlocks[2].type).toBe("text");
      expect((nextBlocks[2] as TextBlock).content).toBe("\nSecond paragraph");
    });

    it("should properly derive document markdown for search/export with kanban & table blocks", () => {
      const testBlocks: NoteBlock[] = [
        {
          id: "b1",
          type: "text",
          content: "# Project Overview",
        },
        {
          id: "b2",
          type: "kanban",
          columns: [
            {
              id: "col1",
              title: "Tasks",
              cards: [{ id: "c1", text: "Audit codebase", done: true }],
            },
          ],
        } as any,
        {
          id: "b3",
          type: "table",
          headers: ["Task", "Priority"],
          rows: [["Fix lists", "High"]],
        } as any,
      ];

      const derived = deriveNoteContent(testBlocks);
      expect(derived).toContain("# Project Overview");
      expect(derived).toContain("### Tasks");
      expect(derived).toContain("- [x] Audit codebase");
      expect(derived).toContain("| Task | Priority |");
      expect(derived).toContain("| --- | --- |");
      expect(derived).toContain("| Fix lists | High |");
    });
  });
});

