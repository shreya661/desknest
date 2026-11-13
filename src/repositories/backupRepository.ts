import { BackupData, Note, Task, Reminder, Drawing, NotificationRecord } from "../types";
import { notesRepository } from "./notesRepository";
import { tasksRepository } from "./tasksRepository";
import { remindersRepository } from "./remindersRepository";
import { drawingsRepository } from "./drawingsRepository";
import { settingsRepository } from "./settingsRepository";
import { notificationsRepository } from "./notificationsRepository";
import {
  dbPut,
  dbClear,
  STORES,
  AudioBlobRecord,
  getAllAudioBlobs,
  saveAudioBlob,
} from "./db";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  counts: {
    notes: number;
    tasks: number;
    reminders: number;
    drawings: number;
    notifications: number;
    audioBlobs: number;
  };
  data?: BackupData;
}

export const backupRepository = {
  async exportAll(): Promise<BackupData> {
    const [notes, tasks, reminders, drawings, settings, notifications, audioBlobs] =
      await Promise.all([
        notesRepository.list(),
        tasksRepository.list(),
        remindersRepository.list(),
        drawingsRepository.list(),
        settingsRepository.get(),
        notificationsRepository.list(),
        getAllAudioBlobs(),
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
      audioBlobs,
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
        counts: { notes: 0, tasks: 0, reminders: 0, drawings: 0, notifications: 0, audioBlobs: 0 },
      };
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        valid: false,
        errors: ["Backup data must be an object"],
        counts: { notes: 0, tasks: 0, reminders: 0, drawings: 0, notifications: 0, audioBlobs: 0 },
      };
    }

    const data = parsed as Partial<BackupData>;

    if (data.format !== "desknest-backup") {
      errors.push("Invalid backup header: Expected 'desknest-backup' format");
    }

    if (
      typeof data.version !== "number" ||
      (data.version !== 1 && data.version !== 2 && data.version !== 3)
    ) {
      errors.push(`Unsupported backup schema version: ${data.version}`);
    }

    const notes = Array.isArray(data.notes) ? data.notes : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const reminders = Array.isArray(data.reminders) ? data.reminders : [];
    const drawings = Array.isArray(data.drawings) ? data.drawings : [];
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];
    const audioBlobs = Array.isArray(data.audioBlobs) ? data.audioBlobs : [];

    const counts = {
      notes: notes.length,
      tasks: tasks.length,
      reminders: reminders.length,
      drawings: drawings.length,
      notifications: notifications.length,
      audioBlobs: audioBlobs.length,
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
        dbClear(STORES.AUDIO_BLOBS),
      ]);
    }

    // Save notes with backward-compatible block hydration for V1/V2 backups.
    // On V1/V2 backups, notes may still carry inline audioData; we migrate
    // those into audio_blobs on the fly so the notes store stays lean.
    for (const note of data.notes) {
      if (note && note.id && note.title) {
        let noteToSave: Note = note;

        // Upgrade legacy schema: add blocks if missing
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

        // Migrate inline audioData → audio_blobs store for v1/v2 backups
        if (Array.isArray(noteToSave.voiceRecordings)) {
          const cleanedRecordings = await Promise.all(
            noteToSave.voiceRecordings.map(async (rec) => {
              if (rec.audioData && rec.audioData.length > 0) {
                const blobRecord: AudioBlobRecord = {
                  id: rec.id,
                  noteId: note.id,
                  mimeType: rec.mimeType || "audio/webm",
                  data: rec.audioData,
                  createdAt: rec.createdAt
                    ? new Date(rec.createdAt).getTime()
                    : Date.now(),
                };
                await saveAudioBlob(blobRecord);
                // Strip inline data from the note record
                const { audioData: _dropped, ...rest } = rec;
                return { ...rest };
              }
              return rec;
            })
          );
          noteToSave = { ...noteToSave, voiceRecordings: cleanedRecordings };
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

    // Save audio blobs (v3 backups)
    if (Array.isArray(data.audioBlobs)) {
      for (const blob of data.audioBlobs) {
        if (blob && blob.id) {
          await saveAudioBlob(blob as AudioBlobRecord);
        }
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
