import React from "react";
import {
  Pin,
  PinOff,
  Minus,
  Square,
  X,
  Minimize2,
  Maximize2,
  Layers,
  Sun,
  Moon,
  Headphones,
  Mic,
} from "lucide-react";
import { windowService } from "../../services/windowService";
import { WorkspaceType } from "../../types";

interface WindowTitleBarProps {
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  compactMode: boolean;
  onToggleCompactMode: () => void;
  activeWorkspace: WorkspaceType;
  onSelectWorkspace: (ws: WorkspaceType) => void;
  theme: "light" | "dark" | "system";
  onToggleTheme: () => void;
  onOpenFocus: () => void;
  onOpenVoiceRecorder: () => void;
}

export const WindowTitleBar: React.FC<WindowTitleBarProps> = ({
  alwaysOnTop,
  onToggleAlwaysOnTop,
  compactMode,
  onToggleCompactMode,
  activeWorkspace,
  onSelectWorkspace,
  theme,
  onToggleTheme,
  onOpenFocus,
  onOpenVoiceRecorder,
}) => {
  const isTauri = windowService.isTauri();

  const handleMinimize = () => windowService.minimize();
  const handleMaximize = () => windowService.toggleMaximize();
  const handleClose = () => windowService.close();

  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <header
      data-tauri-drag-region
      className="h-10 bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-3 select-none flex-shrink-0 z-40 transition-colors"
    >
      {/* Left: App Branding & Status */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-xs">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <span
          data-tauri-drag-region
          className="font-bold text-xs tracking-wider text-foreground uppercase bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent"
        >
          DeskNest
        </span>

        {/* Compact Mode Workspace Selector */}
        {compactMode && (
          <div className="ml-2 flex items-center gap-1">
            <select
              value={activeWorkspace}
              onChange={(e) => onSelectWorkspace(e.target.value as WorkspaceType)}
              className="text-[10px] text-foreground bg-surface-elevated px-1.5 py-0.5 rounded border border-border capitalize font-medium cursor-pointer focus:outline-none"
            >
              <option value="home">Home</option>
              <option value="notes">Notes</option>
              <option value="drawing">Drawing</option>
              <option value="tasks">Tasks</option>
              <option value="reminders">Reminders</option>
              <option value="search">Search</option>
              <option value="settings">Settings</option>
            </select>
          </div>
        )}
      </div>

      {/* Middle: Drag area */}
      <div data-tauri-drag-region className="flex-1 h-full mx-2" />

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1">
        {/* Voice Note Recorder quick button */}
        <button
          onClick={onOpenVoiceRecorder}
          title="Record & Save Voice Note / Dictation (Ctrl+Alt+V)"
          className="p-1.5 rounded-lg hover:bg-surface-hover text-rose-500 hover:text-rose-600 transition-colors"
          aria-label="Record Voice Note"
        >
          <Mic className="w-3.5 h-3.5" />
        </button>

        {/* Focus & Ambient Soundscape quick button */}
        <button
          onClick={onOpenFocus}
          title="Open Focus Sanctuary & Ambient Soundscapes"
          className="p-1.5 rounded-lg hover:bg-surface-hover text-indigo-500 hover:text-indigo-600 transition-colors"
          aria-label="Focus Sanctuary"
        >
          <Headphones className="w-3.5 h-3.5" />
        </button>

        {/* Quick Dark/Light Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Obsidian Mode"}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-fg hover:text-foreground transition-colors"
          aria-label="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-500" />}
        </button>

        {/* Always on top toggle */}
        <button
          onClick={onToggleAlwaysOnTop}
          title={alwaysOnTop ? "Always on top: Enabled" : "Always on top: Disabled"}
          className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors ${
            alwaysOnTop ? "text-primary bg-primary/10" : "text-muted-fg"
          }`}
          aria-label="Toggle always on top"
        >
          {alwaysOnTop ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>

        {/* Compact mode toggle */}
        <button
          onClick={onToggleCompactMode}
          title={compactMode ? "Switch to Expanded Workspace" : "Switch to Compact Widget"}
          className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors ${
            compactMode ? "text-primary bg-primary/10" : "text-muted-fg"
          }`}
          aria-label="Toggle compact widget mode"
        >
          {compactMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Native Window Controls if Tauri or fallback */}
        {isTauri ? (
          <div className="flex items-center ml-1 border-l border-border pl-1">
            <button
              onClick={handleMinimize}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-fg hover:text-foreground transition-colors"
              aria-label="Minimize window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-fg hover:text-foreground transition-colors"
              aria-label="Maximize window"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-danger hover:text-white text-muted-fg transition-colors"
              aria-label="Close window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center ml-1">
            <span className="text-[10px] text-muted-fg px-1.5 py-0.5 rounded-md bg-surface-elevated border border-border">
              Offline-ready
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
