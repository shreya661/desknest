import { Task, TaskPriority, TaskStatus } from "../types";
import { dbClear, dbDelete, dbGet, dbGetAll, dbPut, STORES } from "./db";

export const tasksRepository = {
  async list(): Promise<Task[]> {
    const tasks = await dbGetAll<Task>(STORES.TASKS);
    // Sort pending tasks first, then by due date or updated date
    const priorityWeight: Record<TaskPriority, number> = {
      high: 3,
      normal: 2,
      low: 1,
    };

    return tasks.sort((a, b) => {
      // Incomplete before completed
      if (a.status !== b.status) {
        return a.status === "pending" ? -1 : 1;
      }
      // If both pending, higher priority first
      if (a.status === "pending" && a.priority !== b.priority) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      // Then by due date if exists
      if (a.dueAt && b.dueAt) {
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      // Default newest updated first
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },

  async getById(id: string): Promise<Task | null> {
    return dbGet<Task>(STORES.TASKS, id);
  },

  async create(data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueAt?: string | null;
    category?: string;
  }): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: "task_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title: data.title.trim(),
      description: data.description?.trim() || "",
      priority: data.priority || "normal",
      status: "pending",
      dueAt: data.dueAt || null,
      category: data.category?.trim() || "General",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    return dbPut<Task>(STORES.TASKS, task);
  },

  async update(id: string, updates: Partial<Omit<Task, "id" | "createdAt">>): Promise<Task> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Task with id ${id} not found`);
    }

    const now = new Date().toISOString();
    let completedAt = existing.completedAt;
    if (updates.status !== undefined) {
      if (updates.status === "completed" && existing.status !== "completed") {
        completedAt = now;
      } else if (updates.status === "pending") {
        completedAt = null;
      }
    }

    const updated: Task = {
      ...existing,
      ...updates,
      completedAt,
      updatedAt: now,
    };
    return dbPut<Task>(STORES.TASKS, updated);
  },

  async toggleComplete(id: string): Promise<Task> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Task with id ${id} not found`);
    }
    const newStatus: TaskStatus = existing.status === "completed" ? "pending" : "completed";
    return this.update(id, { status: newStatus });
  },

  async delete(id: string): Promise<void> {
    return dbDelete(STORES.TASKS, id);
  },

  async clear(): Promise<void> {
    return dbClear(STORES.TASKS);
  },

  calculateProgress(tasks: Task[]) {
    const total = tasks.length;
    if (total === 0) return { total: 0, completed: 0, pending: 0, percentage: 0 };
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = total - completed;
    const percentage = Math.round((completed / total) * 100);
    return { total, completed, pending, percentage };
  },
};
