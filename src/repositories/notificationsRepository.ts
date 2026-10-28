import { NotificationRecord } from "../types";
import { dbClear, dbDelete, dbGetAll, dbPut, STORES } from "./db";

export const notificationsRepository = {
  async list(): Promise<NotificationRecord[]> {
    const list = await dbGetAll<NotificationRecord>(STORES.NOTIFICATIONS);
    return list.sort(
      (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );
  },

  async log(record: Omit<NotificationRecord, "id">): Promise<NotificationRecord> {
    const fullRecord: NotificationRecord = {
      ...record,
      id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    };
    return dbPut<NotificationRecord>(STORES.NOTIFICATIONS, fullRecord);
  },

  async delete(id: string): Promise<void> {
    return dbDelete(STORES.NOTIFICATIONS, id);
  },

  async clear(): Promise<void> {
    return dbClear(STORES.NOTIFICATIONS);
  },
};
