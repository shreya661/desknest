import { Reminder, ReminderRecurrence } from "../types";
import { dbClear, dbDelete, dbGet, dbGetAll, dbPut, STORES } from "./db";

export const remindersRepository = {
  async list(): Promise<Reminder[]> {
    const reminders = await dbGetAll<Reminder>(STORES.REMINDERS);
    // Sort upcoming first (by scheduledAt ascending)
    return reminders.sort((a, b) => {
      // Enabled before disabled
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  },

  async getById(id: string): Promise<Reminder | null> {
    return dbGet<Reminder>(STORES.REMINDERS, id);
  },

  async create(data: {
    title: string;
    description?: string;
    scheduledAt: string;
    recurrence?: ReminderRecurrence;
  }): Promise<Reminder> {
    const now = new Date().toISOString();
    const reminder: Reminder = {
      id: "rem_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title: data.title.trim(),
      description: data.description?.trim() || "",
      scheduledAt: data.scheduledAt,
      recurrence: data.recurrence || "none",
      enabled: true,
      completedAt: null,
      lastTriggeredAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return dbPut<Reminder>(STORES.REMINDERS, reminder);
  },

  async update(id: string, updates: Partial<Omit<Reminder, "id" | "createdAt">>): Promise<Reminder> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Reminder with id ${id} not found`);
    }
    const updated: Reminder = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return dbPut<Reminder>(STORES.REMINDERS, updated);
  },

  async snooze(id: string, minutes: number): Promise<Reminder> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Reminder ${id} not found`);

    const newTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    return this.update(id, {
      scheduledAt: newTime,
      enabled: true,
    });
  },

  async complete(id: string): Promise<Reminder> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Reminder ${id} not found`);

    const now = new Date().toISOString();
    if (existing.recurrence === "daily") {
      const nextDate = new Date(existing.scheduledAt);
      nextDate.setDate(nextDate.getDate() + 1);
      return this.update(id, {
        scheduledAt: nextDate.toISOString(),
        enabled: true,
        lastTriggeredAt: now,
      });
    } else if (existing.recurrence === "weekly") {
      const nextDate = new Date(existing.scheduledAt);
      nextDate.setDate(nextDate.getDate() + 7);
      return this.update(id, {
        scheduledAt: nextDate.toISOString(),
        enabled: true,
        lastTriggeredAt: now,
      });
    }

    return this.update(id, {
      enabled: false,
      completedAt: now,
      lastTriggeredAt: now,
    });
  },

  async delete(id: string): Promise<void> {
    return dbDelete(STORES.REMINDERS, id);
  },

  async clear(): Promise<void> {
    return dbClear(STORES.REMINDERS);
  },
};
