import { describe, it, expect, beforeEach } from "vitest";
import { remindersRepository } from "../src/repositories/remindersRepository";

describe("Reminders Repository & Recurrence", () => {
  beforeEach(async () => {
    await remindersRepository.clear();
  });

  it("schedules a reminder with correct date and enabled status", async () => {
    const scheduled = new Date(Date.now() + 60000).toISOString();
    const reminder = await remindersRepository.create({
      title: "Team Standup",
      description: "Discuss DeskNest progress",
      scheduledAt: scheduled,
      recurrence: "none",
    });

    expect(reminder.id).toBeDefined();
    expect(reminder.enabled).toBe(true);
    expect(reminder.scheduledAt).toBe(scheduled);
  });

  it("snoozes a reminder by specified minutes", async () => {
    const now = Date.now();
    const originalTime = new Date(now).toISOString();
    const reminder = await remindersRepository.create({
      title: "Quick Break",
      scheduledAt: originalTime,
    });

    const snoozed = await remindersRepository.snooze(reminder.id, 15);
    const snoozedTime = new Date(snoozed.scheduledAt).getTime();
    expect(snoozedTime).toBeGreaterThan(now + 14 * 60 * 1000);
  });

  it("advances daily recurring reminders by 24 hours on completion", async () => {
    const originalDate = new Date("2026-10-23T10:00:00Z");
    const reminder = await remindersRepository.create({
      title: "Daily Standup",
      scheduledAt: originalDate.toISOString(),
      recurrence: "daily",
    });

    const completed = await remindersRepository.complete(reminder.id);
    expect(completed.enabled).toBe(true);
    const nextDate = new Date(completed.scheduledAt);
    expect(nextDate.getUTCDate()).toBe(originalDate.getUTCDate() + 1);
  });

  it("disables non-recurring reminders on completion", async () => {
    const reminder = await remindersRepository.create({
      title: "One-time call",
      scheduledAt: new Date().toISOString(),
      recurrence: "none",
    });

    const completed = await remindersRepository.complete(reminder.id);
    expect(completed.enabled).toBe(false);
    expect(completed.completedAt).not.toBeNull();
  });
});
