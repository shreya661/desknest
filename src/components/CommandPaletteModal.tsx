import React, { useState, useEffect, useRef, useMemo } from "react";
import { Note, WorkspaceType } from "../types";
import { ambientAudioService } from "../services/ambientAudioService";
import { soundEffects } from "../services/soundEffectsService";
import {
  Search,
  FilePlus,
  PenTool,
  Mic,
  LayoutDashboard,
  FileText,
  CheckSquare,
  Bell,
  Settings,
  StickyNote,
  LucideIcon,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onOpenNote: (id: string) => void;
  onSelectWorkspace: (workspace: WorkspaceType) => void;
  onCreateNewNote: () => void;
  onCreateNewSketch: () => void;
  onOpenVoiceRecorder: () => void;
  onShowToast?: (title: string, description?: string) => void;
}

interface CommandItem {
  id: string;
  section: "Quick Actions" | "Jump to Workspace" | "Notes";
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  shortcut?: string;
  color?: string;
  onSelect: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  notes,
  onOpenNote,
  onSelectWorkspace,
  onCreateNewNote,
  onCreateNewSketch,
  onOpenVoiceRecorder,
  onShowToast,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isAmbientPlaying = ambientAudioService.getStatus().isPlaying;

  // Auto-focus input when opened & reset search
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleToggleAmbient = () => {
    if (ambientAudioService.getStatus().isPlaying) {
      ambientAudioService.stop();
      soundEffects.playPop();
      onShowToast?.("Focus Audio Stopped", "Ambient soundscape turned off.");
    } else {
      ambientAudioService.play("rain");
      soundEffects.playPop();
      onShowToast?.("Focus Audio Playing", "Rain ambient soundscape started.");
    }
    onClose();
  };

  // Compile items
  const items: CommandItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. Quick Actions
    const quickActions: CommandItem[] = [
      {
        id: "qa_new_note",
        section: "Quick Actions",
        title: "Create New Note",
        subtitle: "Start drafting a fresh document in unified notebook",
        icon: FilePlus,
        shortcut: "Ctrl+Alt+N",
        onSelect: () => {
          onCreateNewNote();
          onClose();
        },
      },
      {
        id: "qa_new_sketch",
        section: "Quick Actions",
        title: "New Sketch Canvas",
        subtitle: "Open full drawing canvas for freehand sketches",
        icon: PenTool,
        onSelect: () => {
          onCreateNewSketch();
          onClose();
        },
      },
      {
        id: "qa_voice_recorder",
        section: "Quick Actions",
        title: "Open Voice Recorder",
        subtitle: "Record voice memo with offline transcription",
        icon: Mic,
        shortcut: "Ctrl+Alt+V",
        onSelect: () => {
          onOpenVoiceRecorder();
          onClose();
        },
      },
      {
        id: "qa_toggle_ambient",
        section: "Quick Actions",
        title: isAmbientPlaying ? "Pause Ambient Audio" : "Play Ambient Focus Audio",
        subtitle: isAmbientPlaying
          ? "Stop offline synthesized soundscape"
          : "Start calming offline rain soundscape",
        icon: isAmbientPlaying ? VolumeX : Volume2,
        badge: isAmbientPlaying ? "Playing" : "Offline",
        onSelect: handleToggleAmbient,
      },
    ];

    // 2. Jump to Workspace
    const workspaces: CommandItem[] = [
      {
        id: "ws_home",
        section: "Jump to Workspace",
        title: "Home Dashboard",
        subtitle: "Overview of notes, tasks & upcoming reminders",
        icon: LayoutDashboard,
        onSelect: () => {
          onSelectWorkspace("home");
          onClose();
        },
      },
      {
        id: "ws_notes",
        section: "Jump to Workspace",
        title: "All Notes",
        subtitle: "Browse and edit all notebook pages",
        icon: FileText,
        onSelect: () => {
          onSelectWorkspace("notes");
          onClose();
        },
      },
      {
        id: "ws_drawing",
        section: "Jump to Workspace",
        title: "Sketch Canvas",
        subtitle: "Draw and manage freehand drawings",
        icon: PenTool,
        onSelect: () => {
          onSelectWorkspace("drawing");
          onClose();
        },
      },
      {
        id: "ws_tasks",
        section: "Jump to Workspace",
        title: "Tasks & Checklists",
        subtitle: "Manage daily to-dos and priorities",
        icon: CheckSquare,
        onSelect: () => {
          onSelectWorkspace("tasks");
          onClose();
        },
      },
      {
        id: "ws_reminders",
        section: "Jump to Workspace",
        title: "Reminders",
        subtitle: "Time-based scheduled notifications",
        icon: Bell,
        onSelect: () => {
          onSelectWorkspace("reminders");
          onClose();
        },
      },
      {
        id: "ws_settings",
        section: "Jump to Workspace",
        title: "Settings",
        subtitle: "Customize theme, fonts, backup & sounds",
        icon: Settings,
        onSelect: () => {
          onSelectWorkspace("settings");
          onClose();
        },
      },
    ];

    // Filter quick actions and workspaces if user searched
    const filteredQuick = quickActions.filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
      );
    });

    const filteredWorkspaces = workspaces.filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
      );
    });

    // 3. Notes
    let matchingNotes = notes;
    if (q) {
      matchingNotes = notes.filter((n) => {
        const titleMatch = (n.title || "").toLowerCase().includes(q);
        const contentMatch = (n.content || "").toLowerCase().includes(q);
        return titleMatch || contentMatch;
      });
    }

    const noteItems: CommandItem[] = matchingNotes.slice(0, 8).map((n) => {
      const cleanContent = (n.content || "")
        .replace(/^[#\-*>\s]+/gm, "")
        .slice(0, 80)
        .replace(/\n+/g, " ");

      return {
        id: `note_${n.id}`,
        section: "Notes",
        title: n.title || "Untitled Note",
        subtitle: cleanContent || "Empty note",
        icon: StickyNote,
        color: n.color,
        onSelect: () => {
          onOpenNote(n.id);
          onClose();
        },
      };
    });

    return [...filteredQuick, ...filteredWorkspaces, ...noteItems];
  }, [
    query,
    notes,
    isAmbientPlaying,
    onCreateNewNote,
    onCreateNewSketch,
    onOpenVoiceRecorder,
    onSelectWorkspace,
    onOpenNote,
    onClose,
  ]);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected element into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        items.length > 0 ? (prev - 1 + items.length) % items.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items.length > 0 && items[selectedIndex]) {
        items[selectedIndex].onSelect();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-elevated border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Box */}
        <div className="relative flex items-center px-4 py-3 border-b border-border bg-muted/20">
          <Search className="w-5 h-5 text-muted-fg mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search notes... (Ctrl+K)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-fg/70 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded text-muted-fg hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="ml-2 px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-muted-fg bg-surface">
            esc
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted-fg text-xs">
              No matching commands or notes found for "{query}".
            </div>
          ) : (
            (() => {
              let currentSection = "";
              return items.map((item, idx) => {
                const showHeader = item.section !== currentSection;
                currentSection = item.section;
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;

                return (
                  <React.Fragment key={item.id}>
                    {showHeader && (
                      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-fg">
                        {item.section}
                      </div>
                    )}

                    <button
                      ref={(el) => (itemRefs.current[idx] = el)}
                      type="button"
                      onClick={item.onSelect}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg flex-shrink-0 ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-fg"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.shortcut && (
                            <span
                              className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-fg"
                              }`}
                            >
                              {item.shortcut}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <p
                            className={`text-[11px] truncate mt-0.5 ${
                              isSelected
                                ? "text-primary-foreground/80"
                                : "text-muted-fg"
                            }`}
                          >
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  </React.Fragment>
                );
              });
            })()
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-fg select-none">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                ↑
              </kbd>{" "}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                ↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                ↵
              </kbd>{" "}
              Execute
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                esc
              </kbd>{" "}
              Close
            </span>
          </div>

          <span className="text-[10px] opacity-70">DeskNest Command Palette</span>
        </div>
      </div>
    </div>
  );
};

