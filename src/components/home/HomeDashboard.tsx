import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  PenTool,
  CheckCircle2,
  Clock,
  Pin,
  ArrowRight,
  Send,
  Mic,
  Headphones,
  FileSpreadsheet,
  Sun,
  Moon,
  Sunset,
  Sunrise,
  Check,
} from "lucide-react";
import { Note, NoteColor, Task, Reminder, WorkspaceType } from "../../types";
import { notesRepository } from "../../repositories/notesRepository";
import { tasksRepository } from "../../repositories/tasksRepository";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { VoiceRecorderModal } from "../notes/VoiceRecorderModal";
import { FocusAmbientWidget } from "../focus/FocusAmbientWidget";
import { NoteTemplatesModal, NoteTemplate } from "../notes/NoteTemplatesModal";
import { soundEffects } from "../../services/soundEffectsService";
import { triggerConfetti } from "../../utils/confetti";

interface HomeDashboardProps {
  notes: Note[];
  tasks: Task[];
  reminders: Reminder[];
  onSelectWorkspace: (ws: WorkspaceType) => void;
  onOpenNote: (noteId: string) => void;
  onRefreshData: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  notes,
  tasks,
  reminders,
  onSelectWorkspace,
  onOpenNote,
  onRefreshData,
}) => {
  const [quickTitle, setQuickTitle] = useState("");
  const [quickContent, setQuickContent] = useState("");
  const [quickColor, setQuickColor] = useState<NoteColor>("amber");
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  // Modals
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);

  // Greeting & Date
  const now = new Date();
  const hours = now.getHours();
  let greeting = "Good morning";
  let TimeIcon = Sunrise;
  if (hours >= 12 && hours < 17) {
    greeting = "Good afternoon";
    TimeIcon = Sun;
  } else if (hours >= 17 && hours < 21) {
    greeting = "Good evening";
    TimeIcon = Sunset;
  } else if (hours >= 21 || hours < 5) {
    greeting = "Good night";
    TimeIcon = Moon;
  }

  const dateFormatted = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Task statistics
  const taskProgress = tasksRepository.calculateProgress(tasks);
  const pendingTasks = tasks.filter((t) => t.status === "pending").slice(0, 4);

  // Upcoming reminders
  const upcomingReminders = reminders
    .filter((r) => r.enabled && !r.completedAt)
    .slice(0, 3);

  // Pinned notes
  const pinnedNotes = notes.filter((n) => n.isPinned).slice(0, 4);

  const handleCreateQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() && !quickContent.trim()) return;

    setIsSavingQuick(true);
    try {
      await notesRepository.create({
        title: quickTitle.trim() || "Quick Note",
        content: quickContent.trim(),
        color: quickColor,
        isPinned: false,
      });
      soundEffects.playPop();
      setQuickTitle("");
      setQuickContent("");
      onRefreshData();
    } finally {
      setIsSavingQuick(false);
    }
  };

  const handleApplyTemplate = async (tmpl: NoteTemplate) => {
    const created = await notesRepository.create({
      title: tmpl.title,
      content: tmpl.content,
      color: tmpl.color,
      isPinned: false,
    });
    onRefreshData();
    onOpenNote(created.id);
  };

  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const wasPending = task?.status === "pending";
    await tasksRepository.toggleComplete(taskId);
    if (wasPending) {
      soundEffects.playTaskComplete();
      triggerConfetti();
    }
    onRefreshData();
  };

  const handleSaveVoiceFromHome = async (
    audioData: string,
    durationSeconds: number,
    transcription: string,
    title?: string
  ) => {
    const newMemo = {
      id: "voice_" + Date.now(),
      audioData,
      durationSeconds,
      createdAt: new Date().toISOString(),
      transcription: transcription.trim() || undefined,
    };
    const noteTitle = title || (transcription ? `Voice: ${transcription.slice(0, 28)}...` : "Voice Memo");
    const created = await notesRepository.create({
      title: noteTitle,
      content: transcription ? `🎙️ ${transcription}` : "Voice recording attached.",
      color: "rose",
      isPinned: false,
    });
    await notesRepository.update(created.id, {
      voiceRecordings: [newMemo],
    });
    onRefreshData();
    onOpenNote(created.id);
  };

  const colorOptions: { id: NoteColor; bg: string; label: string }[] = [
    { id: "amber", bg: "bg-amber-400", label: "Amber" },
    { id: "lemon", bg: "bg-yellow-300", label: "Lemon" },
    { id: "mint", bg: "bg-emerald-400", label: "Mint" },
    { id: "sky", bg: "bg-sky-400", label: "Sky" },
    { id: "lavender", bg: "bg-purple-400", label: "Lavender" },
    { id: "rose", bg: "bg-rose-400", label: "Rose" },
    { id: "slate", bg: "bg-slate-400", label: "Slate" },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 ambient-glow">
      {/* Header Banner with Breathing Room & Aesthetic Styling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <span>{greeting}</span>
            </h1>
            <TimeIcon className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold text-foreground/80">{dateFormatted}</span>
            <span className="text-muted-fg">•</span>
            <span className="text-[11px] text-muted-fg flex items-center gap-1 font-medium bg-surface-elevated/70 px-2 py-0.5 rounded-full border border-border">
              <Sparkles className="w-3 h-3 text-sky-400" /> Focus Workspace
            </span>
          </div>
        </div>

        {/* Quick Launch Action Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFocusModalOpen(true)}
            title="Focus Sanctuary & Ambient Soundscapes"
            className="px-3 py-1.5 rounded-xl glass-card text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-semibold transition-all shadow-xs"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Focus & Audio</span>
          </button>

          <button
            onClick={() => setTemplatesModalOpen(true)}
            title="Choose a structured Note Template"
            className="px-3 py-1.5 rounded-xl glass-card text-amber-500 dark:text-amber-400 hover:text-amber-600 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-semibold transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Template</span>
          </button>

          <button
            onClick={() => setVoiceModalOpen(true)}
            title="Record Voice Note / Speech-to-Text"
            className="px-3 py-1.5 rounded-xl glass-card text-rose-500 dark:text-rose-400 hover:text-rose-600 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-semibold transition-all shadow-xs"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice</span>
          </button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => onSelectWorkspace("notes")}
            title="Create new rich note"
            className="rounded-xl shadow-md hover:scale-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Note</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSelectWorkspace("drawing")}
            title="Open freehand & shapes sketchboard"
            className="rounded-xl shadow-xs hover:scale-105 active:scale-95"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sketch</span>
          </Button>
        </div>
      </div>

      {/* Quick Capture Card (Aesthetic Glassmorphism) */}
      <div className="glass-card rounded-2xl p-4.5 border border-border shadow-sm transition-all hover:border-primary/40 relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-sky-400 to-indigo-500 opacity-80" />

        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-foreground tracking-wider uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            Quick Capture & Key Points
          </span>

          {/* Color palette pills */}
          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-full border border-black/5 dark:border-white/5">
            {colorOptions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setQuickColor(c.id)}
                title={c.label}
                className={`w-3.5 h-3.5 rounded-full ${c.bg} transition-all ${
                  quickColor === c.id
                    ? "scale-125 ring-2 ring-primary ring-offset-1"
                    : "opacity-60 hover:opacity-100 hover:scale-110"
                }`}
                aria-label={`Select color ${c.label}`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleCreateQuickNote} className="space-y-2.5">
          <input
            type="text"
            placeholder="Title, key point, or topic..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            className="w-full text-xs font-semibold bg-surface-elevated/70 border border-border/80 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-fg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <textarea
            placeholder="Jot down quick thoughts, checklist, or takeaways..."
            value={quickContent}
            onChange={(e) => setQuickContent(e.target.value)}
            rows={2}
            className="w-full text-xs bg-surface-elevated/70 border border-border/80 rounded-xl p-3 text-foreground placeholder:text-muted-fg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all leading-relaxed"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-fg flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">Ctrl+Alt+N</span>
              <span>creates a note from anywhere</span>
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingQuick || (!quickTitle.trim() && !quickContent.trim())}
              className="rounded-xl shadow-sm"
            >
              <Send className="w-3 h-3" />
              <span>Capture Note</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Grid: Daily Tasks & Upcoming Reminders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Today's Tasks */}
        <div className="glass-card rounded-2xl p-4.5 border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Daily Tasks
                </h2>
              </div>
              <button
                onClick={() => onSelectWorkspace("tasks")}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold group"
              >
                View all <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Progress Bar with glowing pill */}
            <div className="mb-3.5">
              <div className="flex justify-between text-[11px] font-semibold text-muted-fg mb-1.5">
                <span>{taskProgress.completed} of {taskProgress.total} completed</span>
                <span className="text-emerald-500 font-bold">{taskProgress.percentage}%</span>
              </div>
              <div className="w-full h-2 bg-muted/80 rounded-full overflow-hidden p-0.5 border border-border">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                  style={{ width: `${taskProgress.percentage}%` }}
                />
              </div>
            </div>

            {/* Task list preview */}
            <div className="space-y-1.5">
              {pendingTasks.length === 0 ? (
                <div className="py-5 text-center flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-1.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-muted-fg font-medium">
                    {tasks.length > 0 ? "All caught up! Excellent focus!" : "No tasks added yet."}
                  </p>
                </div>
              ) : (
                pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-elevated/80 border border-transparent hover:border-border cursor-pointer group text-xs text-foreground transition-all"
                  >
                    <div className="w-4 h-4 rounded-md border border-border flex items-center justify-center group-hover:border-emerald-500 group-hover:bg-emerald-500/10 transition-colors flex-shrink-0" />
                    <span className="truncate flex-1 font-medium group-hover:text-primary transition-colors">
                      {task.title}
                    </span>
                    {task.priority === "high" && (
                      <Badge variant="danger" className="text-[9px] py-0">High</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Reminders */}
        <div className="glass-card rounded-2xl p-4.5 border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-sky-500/15 text-sky-500">
                  <Clock className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Upcoming Reminders
                </h2>
              </div>
              <button
                onClick={() => onSelectWorkspace("reminders")}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold group"
              >
                View all <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="space-y-2">
              {upcomingReminders.length === 0 ? (
                <div className="py-5 text-center flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-sky-500/15 text-sky-500 flex items-center justify-center mb-1.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-muted-fg font-medium">
                    No upcoming reminders scheduled.
                  </p>
                </div>
              ) : (
                upcomingReminders.map((rem) => {
                  const remDate = new Date(rem.scheduledAt);
                  const timeString = remDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={rem.id}
                      className="p-2.5 rounded-xl bg-surface-elevated/70 border border-border flex items-center justify-between text-xs hover:border-primary/40 transition-colors"
                    >
                      <div className="truncate mr-2">
                        <p className="font-semibold text-foreground truncate">{rem.title}</p>
                        {rem.description && (
                          <p className="text-[11px] text-muted-fg truncate">{rem.description}</p>
                        )}
                      </div>
                      <Badge variant="primary" className="text-[10px] flex-shrink-0 font-mono">
                        {timeString}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pinned Notes Section */}
      {pinnedNotes.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-amber-500/15 text-amber-500">
              <Pin className="w-3.5 h-3.5 fill-current" />
            </div>
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Pinned Notes
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pinnedNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => onOpenNote(note.id)}
                className="p-3.5 rounded-2xl border cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all text-xs flex flex-col justify-between h-28 overflow-hidden relative group"
                style={{
                  backgroundColor: `var(--note-${note.color}-bg)`,
                  borderColor: `var(--note-${note.color}-border)`,
                }}
              >
                <div>
                  <h3 className="font-bold text-foreground line-clamp-1">{note.title}</h3>
                  <p className="text-[11px] text-muted-fg line-clamp-2 mt-1 whitespace-pre-wrap leading-relaxed">
                    {note.content || "Empty note..."}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-fg mt-2 pt-1 border-t border-black/5 dark:border-white/5">
                  <span>{new Date(note.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                  <Pin className="w-3 h-3 text-amber-600 fill-amber-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Recorder Modal */}
      <VoiceRecorderModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onSaveVoiceNote={handleSaveVoiceFromHome}
      />

      {/* Focus Sanctuary & Ambient Soundscape Modal */}
      <FocusAmbientWidget
        isOpen={focusModalOpen}
        onClose={() => setFocusModalOpen(false)}
      />

      {/* Note Templates Modal */}
      <NoteTemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />
    </div>
  );
};
