import { ApplicationSettings } from "../types";
import { dbGet, dbPut, STORES } from "./db";

const SETTINGS_KEY = "app_settings";

export const DEFAULT_SETTINGS: ApplicationSettings = {
  theme: "system",
  alwaysOnTop: false,
  compactMode: false,
  defaultWidth: 440,
  defaultHeight: 680,
  defaultNoteColor: "amber",
  notificationSound: true,
  textSize: "normal",
};

interface SettingsRecord {
  key: string;
  value: ApplicationSettings;
}

export const settingsRepository = {
  async get(): Promise<ApplicationSettings> {
    try {
      const record = await dbGet<SettingsRecord>(STORES.SETTINGS, SETTINGS_KEY);
      if (record && record.value) {
        return { ...DEFAULT_SETTINGS, ...record.value };
      }
    } catch (e) {
      console.warn("Failed to load settings from DB, using fallback", e);
    }
    return DEFAULT_SETTINGS;
  },

  async update(updates: Partial<ApplicationSettings>): Promise<ApplicationSettings> {
    const current = await this.get();
    const updated: ApplicationSettings = {
      ...current,
      ...updates,
    };
    await dbPut<SettingsRecord>(STORES.SETTINGS, {
      key: SETTINGS_KEY,
      value: updated,
    });
    return updated;
  },

  async reset(): Promise<ApplicationSettings> {
    await dbPut<SettingsRecord>(STORES.SETTINGS, {
      key: SETTINGS_KEY,
      value: DEFAULT_SETTINGS,
    });
    return DEFAULT_SETTINGS;
  },
};
