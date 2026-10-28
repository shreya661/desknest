import React, { useState, useEffect } from "react";
import {
  Bell,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Repeat,
  Volume2,
  History,
  AlertCircle,
} from "lucide-react";
import { Reminder, ReminderRecurrence, NotificationRecord } from "../../types";
import { remindersRepository } from "../../repositories/remindersRepository";
import { notificationsRepository } from "../../repositories/notificationsRepository";
import { notificationService } from "../../services/notificationService";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";

interface RemindersWorkspaceProps {
  reminders: Reminder[];
  onRefreshReminders: () => void;
}

export const RemindersWorkspace: React.FC<RemindersWorkspaceProps> = ({
  reminders,
  onRefreshReminders,
}) => {
  const [activeTab, setActiveTab] = useState<"reminders" | "history">("reminders");
  const [historyList, setHistoryList] = useState<NotificationRecord[]>([]);

  // Add Reminder Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>("none");

  // Load history on mount or tab change
  useEffect(() => {
    if (activeTab === "history") {
      notificationsRepository.list().then(setHistoryList);
    }
  }, [activeTab]);

  const now = new Date();

  // Helper default date: 30 minutes from now formatted for datetime-local
  const getDefaultDateTime = () => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const handleOpenAdd = () => {
    setTitle("");
    setDescription("");
    setScheduledAt(getDefaultDateTime());
    setRecurrence("none");
    setIsAddOpen(true);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) return;

    await remindersRepository.create({
      title: title.trim(),
      description: description.trim(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      recurrence,
    });

    setIsAddOpen(false);
    onRefreshReminders();
  };

  const handleToggleEnabled = async (id: string, current: boolean) => {
    await remindersRepository.update(id, { enabled: !current });
    onRefreshReminders();
  };

  const handleDeleteReminder = async (id: string) => {
    if (window.confirm("Delete this reminder?")) {
      await remindersRepository.delete(id);
      onRefreshReminders();
    }
  };

  const handleSnooze = async (id: string, minutes: number) => {
    await remindersRepository.snooze(id, minutes);
    onRefreshReminders();
  };

  const handleComplete = async (id: string) => {
    await remindersRepository.complete(id);
    onRefreshReminders();
  };

  const handleClearHistory = async () => {
    if (window.confirm("Clear all notification history?")) {
      await notificationsRepository.clear();
      setHistoryList([]);
    }
  };

  // Group reminders into active, overdue, completed
  const activeReminders = reminders.filter((r) => r.enabled && !r.completedAt);
  const overdueReminders = activeReminders.filter((r) => new Date(r.scheduledAt) < now);
  const upcomingReminders = activeReminders.filter((r) => new Date(r.scheduledAt) >= now);
  const completedReminders = reminders.filter((r) => r.completedAt);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-3">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("reminders")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "reminders"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-fg hover:text-foreground hover:bg-surface"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Reminders ({activeReminders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-fg hover:text-foreground hover:bg-surface"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Notification Log</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => notificationService.playChime()}
            title="Test notification chime sound"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Test Sound</span>
          </Button>

          {activeTab === "reminders" ? (
            <Button size="sm" variant="primary" onClick={handleOpenAdd}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleClearHistory} disabled={historyList.length === 0}>
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {activeTab === "reminders" ? (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* Overdue alerts section */}
          {overdueReminders.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-500 font-semibold text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Overdue Reminders</span>
              </div>
              {overdueReminders.map((rem) => (
                <div
                  key={rem.id}
                  className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between gap-2"
                >
                  <div className="truncate flex-1">
                    <h3 className="text-xs font-bold text-foreground truncate">{rem.title}</h3>
                    {rem.description && (
                      <p className="text-[11px] text-muted-fg truncate">{rem.description}</p>
                    )}
                    <span className="text-[10px] text-rose-500 font-medium">
                      Was due: {new Date(rem.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => handleSnooze(rem.id, 15)}>
                      +15m
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleComplete(rem.id)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming reminders section */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-fg uppercase tracking-wider block">
              Scheduled Reminders
            </span>

            {upcomingReminders.length === 0 && overdueReminders.length === 0 ? (
              <div className="py-8 text-center text-muted-fg">
                <Clock className="w-8 h-8 opacity-40 mx-auto mb-2" />
                <p className="text-xs font-semibold text-foreground">No active reminders</p>
                <p className="text-[11px] mt-1">
                  Schedule reminders with native notifications and sound alerts.
                </p>
                <Button size="sm" variant="secondary" onClick={handleOpenAdd} className="mt-3">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Reminder</span>
                </Button>
              </div>
            ) : (
              upcomingReminders.map((rem) => {
                const remDate = new Date(rem.scheduledAt);
                return (
                  <div
                    key={rem.id}
                    className="p-3 rounded-xl border border-border bg-surface hover:border-primary/50 transition-all flex items-center justify-between gap-2 group"
                  >
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-foreground truncate">{rem.title}</h3>
                        {rem.recurrence !== "none" && (
                          <Badge variant="primary" className="text-[9px] py-0 capitalize flex items-center gap-0.5">
                            <Repeat className="w-2.5 h-2.5" />
                            {rem.recurrence}
                          </Badge>
                        )}
                      </div>
                      {rem.description && (
                        <p className="text-[11px] text-muted-fg truncate mt-0.5">{rem.description}</p>
                      )}
                      <span className="text-[10px] text-primary font-medium flex items-center gap-1 mt-1">
                        <Clock className="w-2.5 h-2.5" />
                        {remDate.toLocaleDateString([], { month: "short", day: "numeric" })} at{" "}
                        {remDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Toggle enabled */}
                      <button
                        onClick={() => handleToggleEnabled(rem.id, rem.enabled)}
                        title={rem.enabled ? "Disable reminder" : "Enable reminder"}
                        className={`p-1.5 rounded transition-colors ${
                          rem.enabled ? "text-primary hover:bg-primary/10" : "text-muted-fg hover:bg-surface-elevated"
                        }`}
                      >
                        <Bell className="w-4 h-4" />
                      </button>

                      {/* Snooze options */}
                      <button
                        onClick={() => handleSnooze(rem.id, 10)}
                        title="Snooze 10 minutes"
                        className="text-[10px] font-medium px-2 py-1 rounded bg-surface-elevated border border-border hover:bg-surface-hover text-muted-fg"
                      >
                        +10m
                      </button>

                      {/* Complete */}
                      <button
                        onClick={() => handleComplete(rem.id)}
                        title="Mark as done"
                        className="p-1.5 rounded hover:bg-emerald-500/10 text-muted-fg hover:text-emerald-500"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteReminder(rem.id)}
                        title="Delete reminder"
                        className="p-1.5 rounded hover:bg-rose-500/10 text-muted-fg hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Completed reminders section */}
          {completedReminders.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <span className="text-xs font-semibold text-muted-fg uppercase tracking-wider block">
                Completed Reminders ({completedReminders.length})
              </span>
              {completedReminders.slice(0, 3).map((rem) => (
                <div
                  key={rem.id}
                  className="p-2 rounded-lg bg-surface/40 border border-border opacity-50 flex items-center justify-between text-xs"
                >
                  <span className="truncate line-through text-muted-fg">{rem.title}</span>
                  <button
                    onClick={() => handleDeleteReminder(rem.id)}
                    className="p-1 text-muted-fg hover:text-rose-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History Log View */
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {historyList.length === 0 ? (
            <div className="py-8 text-center text-muted-fg">
              <History className="w-8 h-8 opacity-40 mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">No alerts logged yet</p>
              <p className="text-[11px] mt-1">
                Triggered notifications will be permanently recorded here.
              </p>
            </div>
          ) : (
            historyList.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl border border-border bg-surface flex items-start justify-between text-xs"
              >
                <div>
                  <h4 className="font-semibold text-foreground">{item.title}</h4>
                  {item.description && (
                    <p className="text-[11px] text-muted-fg mt-0.5">{item.description}</p>
                  )}
                  <span className="text-[10px] text-muted-fg">
                    Triggered: {new Date(item.triggeredAt).toLocaleString()}
                  </span>
                </div>
                <Badge variant="success" className="text-[10px]">
                  Delivered
                </Badge>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Reminder Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Schedule Reminder"
        maxWidth="md"
      >
        <form onSubmit={handleCreateReminder} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Code Review meeting..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Description (Optional)
            </label>
            <textarea
              placeholder="Additional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Recurrence
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as ReminderRecurrence)}
                className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary"
              >
                <option value="none">Once (No Recurrence)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={!title.trim() || !scheduledAt}>
              Save Reminder
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
