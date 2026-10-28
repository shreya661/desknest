import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Reminder } from "../types";
import { remindersRepository } from "../repositories/remindersRepository";
import { notificationsRepository } from "../repositories/notificationsRepository";

type ToastListener = (toast: {
  id: string;
  reminderId: string;
  title: string;
  description: string;
}) => void;

class NotificationService {
  private listeners: Set<ToastListener> = new Set();
  private timerId: number | null = null;
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private activeToasts: Map<string, { id: string; reminderId: string; title: string; description: string }> = new Map();

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public playChime() {
    if (!this.soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Note 2: B5 (987.77 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(987.77, now + 0.12);
      gain2.gain.setValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.9);
    } catch (e) {
      console.warn("Could not play notification sound:", e);
    }
  }

  public async triggerReminder(reminder: Reminder) {
    // 1. Play chime
    this.playChime();

    // 2. Dispatch in-app toast
    const toastData = {
      id: "toast_" + Date.now(),
      reminderId: reminder.id,
      title: reminder.title,
      description: reminder.description,
    };
    this.activeToasts.set(toastData.id, toastData);
    this.listeners.forEach((fn) => fn(toastData));

    // 3. Log to notification history
    await notificationsRepository.log({
      reminderId: reminder.id,
      title: reminder.title,
      description: reminder.description,
      triggeredAt: new Date().toISOString(),
      status: "delivered",
    });

    // 4. Try native OS notification
    try {
      let permitted = await isPermissionGranted();
      if (!permitted) {
        const permission = await requestPermission();
        permitted = permission === "granted";
      }

      if (permitted) {
        sendNotification({
          title: "DeskNest Reminder: " + reminder.title,
          body: reminder.description || "You have a scheduled reminder in DeskNest.",
        });
      } else if ("Notification" in window && Notification.permission === "granted") {
        new Notification("DeskNest Reminder: " + reminder.title, {
          body: reminder.description || "You have a scheduled reminder in DeskNest.",
        });
      }
    } catch {
      // Fallback web notification if tauri plugin isn't active
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("DeskNest: " + reminder.title, {
            body: reminder.description,
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((p) => {
            if (p === "granted") {
              new Notification("DeskNest: " + reminder.title, {
                body: reminder.description,
              });
            }
          });
        }
      }
    }
  }

  public startScheduler() {
    if (this.timerId !== null) return;

    const checkDueReminders = async () => {
      try {
        const now = new Date();
        const reminders = await remindersRepository.list();

        for (const rem of reminders) {
          if (!rem.enabled || rem.completedAt) continue;

          const scheduledTime = new Date(rem.scheduledAt);
          if (scheduledTime <= now) {
            // Check if it was already triggered in the last 60 seconds to avoid repeating
            if (rem.lastTriggeredAt) {
              const last = new Date(rem.lastTriggeredAt);
              if (now.getTime() - last.getTime() < 60000) {
                continue;
              }
            }

            await this.triggerReminder(rem);
            await remindersRepository.complete(rem.id);
          }
        }
      } catch (err) {
        console.error("Error in reminder scheduler:", err);
      }
    };

    // Run check on startup
    checkDueReminders();

    // Check every 5 seconds
    this.timerId = window.setInterval(checkDueReminders, 5000);
  }

  public stopScheduler() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

export const notificationService = new NotificationService();
