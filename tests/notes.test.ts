import { describe, it, expect, beforeEach } from "vitest";
import { notesRepository } from "../src/repositories/notesRepository";

describe("Notes Repository", () => {
  beforeEach(async () => {
    await notesRepository.clear();
  });

  it("creates and retrieves a note", async () => {
    const note = await notesRepository.create({
      title: "React Architecture",
      content: "Component separation and repository pattern.",
      color: "sky",
      isPinned: false,
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe("React Architecture");
    expect(note.color).toBe("sky");

    const fetched = await notesRepository.getById(note.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.content).toBe("Component separation and repository pattern.");
  });

  it("updates note content and updates timestamp", async () => {
    const note = await notesRepository.create({
      title: "Initial Title",
      content: "Initial Content",
      color: "amber",
    });

    const updated = await notesRepository.update(note.id, {
      title: "Updated Title",
      content: "Updated Content",
      color: "mint",
    });

    expect(updated.title).toBe("Updated Title");
    expect(updated.content).toBe("Updated Content");
    expect(updated.color).toBe("mint");
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(note.createdAt).getTime()
    );
  });

  it("sorts pinned notes ahead of unpinned notes", async () => {
    await notesRepository.create({ title: "Older Note", isPinned: false });
    const note2 = await notesRepository.create({ title: "Pinned Note", isPinned: true });
    await notesRepository.create({ title: "Newer Note", isPinned: false });

    const list = await notesRepository.list();
    expect(list.length).toBe(3);
    expect(list[0].id).toBe(note2.id); // Pinned note is first
  });

  it("searches notes by title or content substring", async () => {
    await notesRepository.create({ title: "Meeting with Client", content: "Discuss timeline" });
    await notesRepository.create({ title: "Shopping List", content: "Milk, eggs, coffee" });

    const results = await notesRepository.search("timeline");
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Meeting with Client");

    const emptyResults = await notesRepository.search("nonexistent query");
    expect(emptyResults.length).toBe(0);
  });

  it("deletes a note successfully", async () => {
    const note = await notesRepository.create({ title: "Temporary" });
    await notesRepository.delete(note.id);

    const fetched = await notesRepository.getById(note.id);
    expect(fetched).toBeNull();
  });

  it("projects lightweight summaries without loading full block trees (PERF-02)", async () => {
    await notesRepository.create({
      title: "Architecture Doc",
      content: "# Heading\nDetailed summary text for test.",
      color: "lavender",
      isPinned: true,
    });

    const summaries = await notesRepository.listSummaries();
    expect(summaries.length).toBe(1);
    expect(summaries[0].title).toBe("Architecture Doc");
    expect(summaries[0].color).toBe("lavender");
    expect(summaries[0].isPinned).toBe(true);
    expect(summaries[0].contentPreview).toContain("Heading Detailed summary text");
    expect(summaries[0].hasDrawings).toBe(false);
  });

  it("paginates notes with limit, offset, and total count (PERF-02)", async () => {
    for (let i = 1; i <= 5; i++) {
      await notesRepository.create({ title: `Note ${i}`, content: `Body ${i}` });
    }

    const page1 = await notesRepository.listPaginated({ limit: 2, offset: 0 });
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBe(5);
    expect(page1.hasMore).toBe(true);

    const page2 = await notesRepository.listPaginated({ limit: 2, offset: 2 });
    expect(page2.items.length).toBe(2);
    expect(page2.hasMore).toBe(true);

    const page3 = await notesRepository.listPaginated({ limit: 2, offset: 4 });
    expect(page3.items.length).toBe(1);
    expect(page3.hasMore).toBe(false);
  });
});
