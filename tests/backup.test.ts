import { describe, it, expect, beforeEach } from "vitest";
import { backupRepository } from "../src/repositories/backupRepository";
import { notesRepository } from "../src/repositories/notesRepository";
import { tasksRepository } from "../src/repositories/tasksRepository";

describe("Backup & Restore Validation", () => {
  beforeEach(async () => {
    await notesRepository.clear();
    await tasksRepository.clear();
  });

  it("exports valid versioned backup schema", async () => {
    await notesRepository.create({ title: "Note for Backup", content: "Details" });
    await tasksRepository.create({ title: "Task for Backup" });

    const exportData = await backupRepository.exportAll();
    expect(exportData.format).toBe("desknest-backup");
    expect(exportData.version).toBe(2);
    expect(exportData.notes.length).toBe(1);
    expect(exportData.tasks.length).toBe(1);
    expect(exportData.exportedAt).toBeDefined();
  });


  it("validates well-formed JSON backup", async () => {
    const validJson = JSON.stringify({
      format: "desknest-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: [{ id: "n1", title: "Test Note", content: "", color: "amber", isPinned: false, createdAt: "", updatedAt: "" }],
      tasks: [],
      reminders: [],
      drawings: [],
      settings: { theme: "dark" },
      notifications: [],
    });

    const result = backupRepository.validate(validJson);
    expect(result.valid).toBe(true);
    expect(result.counts.notes).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it("rejects invalid JSON syntax", () => {
    const invalidJson = "{ corrupted json ...";
    const result = backupRepository.validate(invalidJson);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid JSON format");
  });

  it("rejects unsupported backup formats or missing headers", () => {
    const foreignJson = JSON.stringify({
      format: "unknown-backup",
      version: 99,
      data: [],
    });

    const result = backupRepository.validate(foreignJson);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid backup header"))).toBe(true);
  });

  it("imports valid backup data in merge mode", async () => {
    await notesRepository.create({ title: "Existing Local Note" });

    const backupToImport = {
      format: "desknest-backup" as const,
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      notes: [
        {
          id: "imported_n1",
          title: "Imported Note",
          content: "Imported content",
          color: "mint" as const,
          isPinned: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      tasks: [],
      reminders: [],
      drawings: [],
      settings: {
        theme: "system" as const,
        alwaysOnTop: false,
        compactMode: false,
        defaultWidth: 440,
        defaultHeight: 680,
        defaultNoteColor: "amber" as const,
        notificationSound: true,
        textSize: "normal" as const,
      },
      notifications: [],
    };

    await backupRepository.importData(backupToImport, "merge");

    const notes = await notesRepository.list();
    expect(notes.length).toBe(2);
    expect(notes.some((n) => n.title === "Imported Note")).toBe(true);
  });
});
