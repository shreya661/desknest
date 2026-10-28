import { BackupData, Note, Task, Reminder, Drawing, NotificationRecord } from "../types";
import { notesRepository } from "./notesRepository";
import { tasksRepository } from "./tasksRepository";
import { remindersRepository } from "./remindersRepository";
import { drawingsRepository } from "./drawingsRepository";
import { settingsRepository } from "./settingsRepository";
import { notificationsRepository } from "./notificationsRepository";
import { dbPut, STORES } from "./db";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  counts: {
    notes: number;
    tasks: number;
    reminders: number;
    drawings: number;
    notifications: number;
  };
  data?: BackupData;
}

export const backupRepository = {
  async exportAll(): Promise<BackupData> {
    const [notes, tasks, reminders, drawings, settings, notifications] = await Promise.all([
      notesRepository.list(),
      tasksRepository.list(),
      remindersRepository.list(),
      drawingsRepository.list(),
      settingsRepository.get(),
      notificationsRepository.list(),
    ]);

    const backup: BackupData = {
      format: "desknest-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      notes,
      tasks,
      reminders,
      drawings,
      settings,
      notifications,
    };

    return backup;
  },

  validate(jsonString: string): ValidationResult {
    const errors: string[] = [];
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return {
        valid: false,
        errors: ["Invalid JSON format: file could not be parsed"],
        counts: { notes: 0, tasks: 0, reminders: 0, drawings: 0, notifications: 0 },
      };
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        valid: false,
        errors: ["Backup data must be an object"],
        counts: { notes: 0, tasks: 0, reminders: 0, drawings: 0, notifications: 0 },
      };
    }

    const data = parsed as Partial<BackupData>;

    if (data.format !== "desknest-backup") {
      errors.push("Invalid backup header: Expected 'desknest-backup' format");
    }

    if (typeof data.version !== "number" || (data.version !== 1 && data.version !== 2)) {
      errors.push(`Unsupported backup schema version: ${data.version}`);
    }

    const notes = Array.isArray(data.notes) ? data.notes : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const reminders = Array.isArray(data.reminders) ? data.reminders : [];
    const drawings = Array.isArray(data.drawings) ? data.drawings : [];
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];

    const counts = {
      notes: notes.length,
      tasks: tasks.length,
      reminders: reminders.length,
      drawings: drawings.length,
      notifications: notifications.length,
    };

    if (errors.length > 0) {
      return { valid: false, errors, counts };
    }

    return {
      valid: true,
      errors: [],
      counts,
      data: data as BackupData,
    };
  },

  async importData(data: BackupData, mode: "merge" | "overwrite"): Promise<void> {
    if (mode === "overwrite") {
      await Promise.all([
        notesRepository.clear(),
        tasksRepository.clear(),
        remindersRepository.clear(),
        drawingsRepository.clear(),
        notificationsRepository.clear(),
      ]);
    }

    // Save notes with backward-compatible block hydration for V1 backups
    for (const note of data.notes) {
      if (note && note.id && note.title) {
        let noteToSave: Note = note;
        if (!noteToSave.blocks || noteToSave.blocks.length === 0) {
          noteToSave = {
            ...noteToSave,
            schemaVersion: 2,
            blocks: [
              {
                id: "blk_" + noteToSave.id + "_txt",
                type: "text",
                content: noteToSave.content || "",
              },
            ],
          };
        }
        await dbPut<Note>(STORES.NOTES, noteToSave);
      }
    }


    // Save tasks
    for (const task of data.tasks) {
      if (task && task.id && task.title) {
        await dbPut<Task>(STORES.TASKS, task);
      }
    }

    // Save reminders
    for (const reminder of data.reminders) {
      if (reminder && reminder.id && reminder.title) {
        await dbPut<Reminder>(STORES.REMINDERS, reminder);
      }
    }

    // Save drawings
    for (const drawing of data.drawings) {
      if (drawing && drawing.id) {
        await dbPut<Drawing>(STORES.DRAWINGS, drawing);
      }
    }

    // Save notifications
    for (const notif of data.notifications) {
      if (notif && notif.id) {
        await dbPut<NotificationRecord>(STORES.NOTIFICATIONS, notif);
      }
    }

    // Update settings if present
    if (data.settings) {
      await settingsRepository.update(data.settings);
    }

    // Idempotently adapt any standalone drawings into the unified notebook system
    await notesRepository.syncStandaloneDrawingsToNotes();
  },
};
