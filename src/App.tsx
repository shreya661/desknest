import { useState, useEffect, useCallback } from "react";
import { Note, Task, Reminder, ApplicationSettings, WorkspaceType } from "./types";
import { notesRepository } from "./repositories/notesRepository";
import { tasksRepository } from "./repositories/tasksRepository";
import { remindersRepository } from "./repositories/remindersRepository";
import { settingsRepository, DEFAULT_SETTINGS } from "./repositories/settingsRepository";
import { notificationService } from "./services/notificationService";
import { soundEffects } from "./services/soundEffectsService";
import { windowService } from "./services/windowService";
import { WindowTitleBar } from "./components/window/WindowTitleBar";
import { NavigationRail } from "./components/navigation/NavigationRail";
import { HomeDashboard } from "./components/home/HomeDashboard";
import { NotesWorkspace } from "./components/notes/NotesWorkspace";
import { DrawingWorkspace } from "./components/drawing/DrawingWorkspace";
import { TasksWorkspace } from "./components/tasks/TasksWorkspace";
import { RemindersWorkspace } from "./components/reminders/RemindersWorkspace";
import { SearchWorkspace } from "./components/search/SearchWorkspace";
import { SettingsWorkspace } from "./components/settings/SettingsWorkspace";
import { Toast, ToastItem } from "./components/common/Toast";
import { FocusAmbientWidget } from "./components/focus/FocusAmbientWidget";
import { VoiceRecorderModal } from "./components/notes/VoiceRecorderModal";
import { NoteTemplatesModal, NoteTemplate } from "./components/notes/NoteTemplatesModal";
import { CommandPaletteModal } from "./components/CommandPaletteModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { saveAudioBlob } from "./repositories/db";

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>("home");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettings] = useState<ApplicationSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Load all initial data from local persistence
  const refreshAll = useCallback(async () => {
    try {
      await notesRepository.syncStandaloneDrawingsToNotes();
      const [n, t, r, s] = await Promise.all([
        notesRepository.list(),
        tasksRepository.list(),
        remindersRepository.list(),
        settingsRepository.get(),
      ]);
      setNotes(n);
      setTasks(t);
      setReminders(r);
      setSettings(s);
    } catch (err) {
      console.error("Failed to load local data:", err);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Apply theme dynamically to documentElement
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (theme: "light" | "dark" | "system") => {
      let isDark = false;
      if (theme === "dark") {
        isDark = true;
      } else if (theme === "light") {
        isDark = false;
      } else {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme(settings.theme);

    if (settings.theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  // Apply notification and UI sound preference
  useEffect(() => {
    notificationService.setSoundEnabled(settings.notificationSound);
    soundEffects.setEnabled(settings.notificationSound);
  }, [settings.notificationSound]);

  // Start background reminder scheduler & in-app toast listener
  useEffect(() => {
    notificationService.startScheduler();

    const unsubscribe = notificationService.subscribe((toast) => {
      setToasts((prev) => [...prev, toast]);
    });

    return () => {
      notificationService.stopScheduler();
      unsubscribe();
    };
  }, []);

  // Safe window close protection: flushes pending saves before exiting (Refinement 1)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    windowService
      .registerCloseProtection((errorMsg) => {
        setToasts((prev) => [
          ...prev,
          {
            id: "close_err_" + Date.now(),
            reminderId: "close_err",
            title: "Save Failed on Exit",
            description: errorMsg,
          },
        ]);
      })
      .then((cleanup) => {
        unlisten = cleanup;
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);


  // Global Keyboard Shortcuts
  useEffect(() => {

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K or Cmd + K: Global Command Palette
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl + Alt + N: New Note
      if (e.ctrlKey && e.altKey && e.code === "KeyN") {
        e.preventDefault();
        setActiveWorkspace("notes");
        setSelectedNoteId(null);
      }
      // Ctrl + Alt + V: Voice Note Recorder & Saver
      else if (e.ctrlKey && e.altKey && e.code === "KeyV") {
        e.preventDefault();
        setVoiceRecorderOpen(true);
      }
      // Ctrl + F: Global Search
      else if (e.ctrlKey && e.code === "KeyF" && !e.altKey && !e.shiftKey) {
        // Only trigger if not already in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          setActiveWorkspace("search");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Window Toggles
  const handleToggleAlwaysOnTop = async () => {
    const nextVal = !settings.alwaysOnTop;
    const updated = await settingsRepository.update({ alwaysOnTop: nextVal });
    await windowService.setAlwaysOnTop(nextVal);
    setSettings(updated);
  };

  const handleToggleCompactMode = async () => {
    const nextCompact = !settings.compactMode;
    const updated = await settingsRepository.update({ compactMode: nextCompact });
    if (nextCompact) {
      // Resize to compact width
      await windowService.setSize(380, 620);
    } else {
      // Resize to comfortable expanded size
      await windowService.setSize(840, 680);
    }
    setSettings(updated);
  };

  const handleToggleTheme = async () => {
    const isDark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const nextTheme = isDark ? "light" : "dark";
    const updated = await settingsRepository.update({ theme: nextTheme });
    soundEffects.playPop();
    setSettings(updated);
  };

  const handleOpenNote = (id: string) => {
    setSelectedNoteId(id);
    setActiveWorkspace("notes");
  };

  const handleSaveGlobalVoiceNote = async (
    audioData: string,
    durationSeconds: number,
    transcription: string,
    title?: string,
    recordingId?: string
  ) => {
    // If a stable recordingId was supplied, the blob was already written to audio_blobs
    // by VoiceRecorderModal. We just need to backfill the noteId after note creation.
    // Fallback: legacy callers that still pass a full base64 audioData.
    const id = recordingId ?? "voice_" + Date.now();
    const newMemo = {
      id,
      // audioData intentionally omitted — stored in audio_blobs store
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

    // Backfill noteId on the blob record if present (may be a no-op if noteId was already set)
    if (recordingId && audioData === "") {
      try {
        const { getAudioBlob } = await import("./repositories/db");
        const existing = await getAudioBlob(recordingId);
        if (existing && existing.noteId === "") {
          await saveAudioBlob({ ...existing, noteId: created.id });
        }
      } catch {
        // non-critical
      }
    } else if (audioData && audioData.length > 0) {
      // Legacy inline audio — save to blob store now
      const mimeType = audioData.startsWith("data:") ? audioData.split(";")[0].slice(5) : "audio/webm";
      await saveAudioBlob({
        id,
        noteId: created.id,
        mimeType,
        data: audioData,
        createdAt: Date.now(),
      });
    }

    refreshAll();
    handleOpenNote(created.id);
  };

  const handleApplyGlobalTemplate = async (tmpl: NoteTemplate) => {
    const created = await notesRepository.create({
      title: tmpl.title,
      content: tmpl.content,
      color: tmpl.color,
      isPinned: false,
    });
    refreshAll();
    handleOpenNote(created.id);
  };

  // Toast banner interactions
  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSnoozeToast = async (reminderId: string, toastId: string, minutes: number) => {
    await remindersRepository.snooze(reminderId, minutes);
    handleDismissToast(toastId);
    refreshAll();
  };

  const handleCompleteToast = async (reminderId: string, toastId: string) => {
    await remindersRepository.complete(reminderId);
    handleDismissToast(toastId);
    refreshAll();
  };

  const pendingTasksCount = tasks.filter((t) => t.status === "pending").length;
  const activeRemindersCount = reminders.filter((r) => r.enabled && !r.completedAt).length;

  const handleOpenFullCanvas = useCallback((drawingId: string) => {
    setSelectedDrawingId(drawingId);
    setActiveWorkspace("drawing");
  }, []);

  return (
    <div
      className={`h-screen w-screen flex flex-col bg-background text-foreground font-sans overflow-hidden select-none border border-border shadow-2xl ${
        settings.textSize === "compact"
          ? "text-[13px]"
          : settings.textSize === "large"
          ? "text-[15px]"
          : "text-sm"
      }`}
    >
      {/* Frameless Desktop Window Titlebar */}
      <WindowTitleBar
        alwaysOnTop={settings.alwaysOnTop}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        compactMode={settings.compactMode}
        onToggleCompactMode={handleToggleCompactMode}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
        onOpenFocus={() => setFocusModalOpen(true)}
        onOpenVoiceRecorder={() => setVoiceRecorderOpen(true)}
      />

      {/* Main Workspace Body */}
      <div className={`flex-1 flex overflow-hidden ${settings.compactMode ? "flex-col" : "flex-row"}`}>
        {/* Modern Sidebar with Add-on Studio and Workspace Icons */}
        <NavigationRail
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={(ws) => {
            setActiveWorkspace(ws);
            if (ws !== "notes") {
              setSelectedNoteId(null);
            }
            if (ws !== "drawing") {
              setSelectedDrawingId(null);
            }
          }}
          pendingTasksCount={pendingTasksCount}
          activeRemindersCount={activeRemindersCount}
          notesCount={notes.length}
          compactMode={settings.compactMode}
          onOpenVoiceRecorder={() => setVoiceRecorderOpen(true)}
          onOpenFocus={() => setFocusModalOpen(true)}
          onOpenTemplates={() => setTemplatesModalOpen(true)}
        />

        {/* Active Workspace View */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
          {activeWorkspace === "home" && (
            <ErrorBoundary label="Home Dashboard">
            <HomeDashboard
              notes={notes}
              tasks={tasks}
              reminders={reminders}
              onSelectWorkspace={setActiveWorkspace}
              onOpenNote={handleOpenNote}
              onRefreshData={refreshAll}
            />
            </ErrorBoundary>
          )}

          {activeWorkspace === "notes" && (
            <ErrorBoundary label="Notes Workspace">
            <NotesWorkspace
              notes={notes}
              selectedNoteId={selectedNoteId}
              onSelectNote={setSelectedNoteId}
              onRefreshNotes={refreshAll}
              defaultNoteColor={settings.defaultNoteColor}
              onOpenFullCanvas={handleOpenFullCanvas}
            />
            </ErrorBoundary>
          )}

          {activeWorkspace === "drawing" && (
            <ErrorBoundary label="Sketch Canvas">
            <DrawingWorkspace
              initialDrawingId={selectedDrawingId}
              onOpenNote={(noteId) => {
                setSelectedNoteId(noteId);
                setActiveWorkspace("notes");
              }}
            />
            </ErrorBoundary>
          )}

          {activeWorkspace === "tasks" && (
            <ErrorBoundary label="Tasks Workspace">
            <TasksWorkspace tasks={tasks} onRefreshTasks={refreshAll} />
            </ErrorBoundary>
          )}

          {activeWorkspace === "reminders" && (
            <ErrorBoundary label="Reminders Workspace">
            <RemindersWorkspace
              reminders={reminders}
              onRefreshReminders={refreshAll}
            />
            </ErrorBoundary>
          )}

          {activeWorkspace === "search" && (
            <ErrorBoundary label="Search Workspace">
            <SearchWorkspace
              notes={notes}
              tasks={tasks}
              reminders={reminders}
              onOpenNote={handleOpenNote}
              onOpenWorkspace={setActiveWorkspace}
            />
            </ErrorBoundary>
          )}

          {activeWorkspace === "settings" && (
            <ErrorBoundary label="Settings Workspace">
            <SettingsWorkspace
              settings={settings}
              onUpdateSettings={setSettings}
              onRefreshAllData={refreshAll}
            />
            </ErrorBoundary>
          )}
        </main>
      </div>

      {/* In-App Toast Alert Center */}
      <Toast
        toasts={toasts}
        onDismiss={handleDismissToast}
        onSnooze={handleSnoozeToast}
        onComplete={handleCompleteToast}
      />

      {/* Focus Sanctuary & Ambient Audio Modal */}
      <ErrorBoundary label="Focus Widget">
      <FocusAmbientWidget
        isOpen={focusModalOpen}
        onClose={() => setFocusModalOpen(false)}
      />
      </ErrorBoundary>

      {/* Voice Note Recorder & Saver Modal */}
      <ErrorBoundary label="Voice Recorder">
      <VoiceRecorderModal
        isOpen={voiceRecorderOpen}
        onClose={() => setVoiceRecorderOpen(false)}
        onSaveVoiceNote={handleSaveGlobalVoiceNote}
      />
      </ErrorBoundary>

      {/* Note Templates Modal */}
      <ErrorBoundary label="Templates Modal">
      <NoteTemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={handleApplyGlobalTemplate}
      />
      </ErrorBoundary>

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <ErrorBoundary label="Command Palette">
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        notes={notes}
        onOpenNote={handleOpenNote}
        onSelectWorkspace={setActiveWorkspace}
        onCreateNewNote={() => {
          setActiveWorkspace("notes");
          setSelectedNoteId(null);
        }}
        onCreateNewSketch={() => {
          setSelectedDrawingId(null);
          setActiveWorkspace("drawing");
        }}
        onOpenVoiceRecorder={() => setVoiceRecorderOpen(true)}
        onShowToast={(title, description) =>
          setToasts((prev) => [
            ...prev,
            {
              id: "toast_" + Date.now(),
              reminderId: "cmd",
              title,
              description: description || "",
            },
          ])
        }
      />
      </ErrorBoundary>
    </div>
  );
}

export default App;
