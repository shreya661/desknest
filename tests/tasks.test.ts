import { describe, it, expect, beforeEach } from "vitest";
import { tasksRepository } from "../src/repositories/tasksRepository";

describe("Tasks Repository & Progress Calculations", () => {
  beforeEach(async () => {
    await tasksRepository.clear();
  });

  it("creates a task with correct default status and priority", async () => {
    const task = await tasksRepository.create({
      title: "Complete Desktop App",
      description: "Implement all requirements",
      priority: "high",
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("high");
    expect(task.completedAt).toBeNull();
  });

  it("toggles task completion and tracks completedAt timestamp", async () => {
    const task = await tasksRepository.create({ title: "Write Documentation" });

    const completed = await tasksRepository.toggleComplete(task.id);
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();

    const reopened = await tasksRepository.toggleComplete(task.id);
    expect(reopened.status).toBe("pending");
    expect(reopened.completedAt).toBeNull();
  });

  it("accurately calculates task progress statistics", () => {
    const sampleTasks = [
      { id: "1", title: "T1", status: "completed" as const, priority: "normal" as const, description: "", dueAt: null, category: "", createdAt: "", updatedAt: "", completedAt: "" },
      { id: "2", title: "T2", status: "completed" as const, priority: "normal" as const, description: "", dueAt: null, category: "", createdAt: "", updatedAt: "", completedAt: "" },
      { id: "3", title: "T3", status: "pending" as const, priority: "normal" as const, description: "", dueAt: null, category: "", createdAt: "", updatedAt: "", completedAt: null },
      { id: "4", title: "T4", status: "pending" as const, priority: "normal" as const, description: "", dueAt: null, category: "", createdAt: "", updatedAt: "", completedAt: null },
    ];

    const progress = tasksRepository.calculateProgress(sampleTasks);
    expect(progress.total).toBe(4);
    expect(progress.completed).toBe(2);
    expect(progress.pending).toBe(2);
    expect(progress.percentage).toBe(50);
  });

  it("returns 0% progress when no tasks exist without NaN errors", () => {
    const progress = tasksRepository.calculateProgress([]);
    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it("sorts high priority pending tasks before normal priority", async () => {
    await tasksRepository.create({ title: "Low task", priority: "low" });
    const highTask = await tasksRepository.create({ title: "High task", priority: "high" });
    await tasksRepository.create({ title: "Normal task", priority: "normal" });

    const list = await tasksRepository.list();
    expect(list[0].id).toBe(highTask.id);
  });
});
