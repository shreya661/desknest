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
            <HomeDashboard
              notes={notes}
              tasks={tasks}
              reminders={reminders}
              onSelectWorkspace={setActiveWorkspace}
              onOpenNote={handleOpenNote}
              onRefreshData={refreshAll}
            />
          )}

          {activeWorkspace === "notes" && (
            <NotesWorkspace
              notes={notes}
              selectedNoteId={selectedNoteId}
              onSelectNote={setSelectedNoteId}
              onRefreshNotes={refreshAll}
              defaultNoteColor={settings.defaultNoteColor}
              onOpenFullCanvas={handleOpenFullCanvas}
            />
          )}

          {activeWorkspace === "drawing" && (
            <DrawingWorkspace
              initialDrawingId={selectedDrawingId}
              onOpenNote={(noteId) => {
                setSelectedNoteId(noteId);
                setActiveWorkspace("notes");
              }}
            />
          )}

          {activeWorkspace === "tasks" && (
            <TasksWorkspace tasks={tasks} onRefreshTasks={refreshAll} />
          )}

          {activeWorkspace === "reminders" && (
            <RemindersWorkspace
              reminders={reminders}
              onRefreshReminders={refreshAll}
            />
          )}

          {activeWorkspace === "search" && (
            <SearchWorkspace
              notes={notes}
              tasks={tasks}
              reminders={reminders}
              onOpenNote={handleOpenNote}
              onOpenWorkspace={setActiveWorkspace}
            />
          )}

          {activeWorkspace === "settings" && (
            <SettingsWorkspace
              settings={settings}
              onUpdateSettings={setSettings}
              onRefreshAllData={refreshAll}
            />
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
      <FocusAmbientWidget
        isOpen={focusModalOpen}
        onClose={() => setFocusModalOpen(false)}
      />

      {/* Voice Note Recorder & Saver Modal */}
      <VoiceRecorderModal
        isOpen={voiceRecorderOpen}
        onClose={() => setVoiceRecorderOpen(false)}
        onSaveVoiceNote={handleSaveGlobalVoiceNote}
      />

      {/* Note Templates Modal */}
      <NoteTemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={handleApplyGlobalTemplate}
      />
    </div>
  );
}

export default App;
