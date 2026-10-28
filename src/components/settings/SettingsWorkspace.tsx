import React, { useState, useRef } from "react";
import {
  Sun,
  Moon,
  Laptop,
  Pin,
  Volume2,
  VolumeX,
  Download,
  Upload,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Keyboard,
  Info,
} from "lucide-react";
import { ApplicationSettings, NoteColor } from "../../types";
import { settingsRepository } from "../../repositories/settingsRepository";
import { backupRepository, ValidationResult } from "../../repositories/backupRepository";
import { notificationService } from "../../services/notificationService";
import { windowService } from "../../services/windowService";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";

interface SettingsWorkspaceProps {
  settings: ApplicationSettings;
  onUpdateSettings: (newSettings: ApplicationSettings) => void;
  onRefreshAllData: () => void;
}

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  settings,
  onUpdateSettings,
  onRefreshAllData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import preview state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleThemeChange = async (theme: "light" | "dark" | "system") => {
    const updated = await settingsRepository.update({ theme });
    onUpdateSettings(updated);
  };

  const handleAlwaysOnTopChange = async (alwaysOnTop: boolean) => {
    const updated = await settingsRepository.update({ alwaysOnTop });
    await windowService.setAlwaysOnTop(alwaysOnTop);
    onUpdateSettings(updated);
  };

  const handleSoundChange = async (notificationSound: boolean) => {
    const updated = await settingsRepository.update({ notificationSound });
    notificationService.setSoundEnabled(notificationSound);
    onUpdateSettings(updated);
  };

  const handleColorChange = async (defaultNoteColor: NoteColor) => {
    const updated = await settingsRepository.update({ defaultNoteColor });
    onUpdateSettings(updated);
  };

  const handleTextSizeChange = async (textSize: "compact" | "normal" | "large") => {
    const updated = await settingsRepository.update({ textSize });
    onUpdateSettings(updated);
  };

  // Export full backup
  const handleExportBackup = async () => {
    const backupData = await backupRepository.exportAll();
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `desknest-backup-${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Trigger file selection for import
  const handleTriggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = backupRepository.validate(content);
      setValidationResult(result);
      setImportStatus(null);
      setImportModalOpen(true);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!validationResult || !validationResult.valid || !validationResult.data) return;

    setImportStatus("Importing...");
    try {
      await backupRepository.importData(validationResult.data, importMode);
      setImportStatus("Import completed successfully!");
      onRefreshAllData();
      setTimeout(() => {
        setImportModalOpen(false);
        setImportStatus(null);
      }, 1200);
    } catch (err) {
      setImportStatus("Import failed: " + String(err));
    }
  };

  const handleResetSettings = async () => {
    if (window.confirm("Reset all settings to default values? Your notes and tasks will remain intact.")) {
      const reset = await settingsRepository.reset();
      onUpdateSettings(reset);
    }
  };

  const colors: { id: NoteColor; label: string; bg: string }[] = [
    { id: "amber", label: "Amber", bg: "bg-amber-400" },
    { id: "lemon", label: "Lemon", bg: "bg-yellow-300" },
    { id: "mint", label: "Mint", bg: "bg-emerald-400" },
    { id: "sky", label: "Sky", bg: "bg-sky-400" },
    { id: "lavender", label: "Lavender", bg: "bg-purple-400" },
    { id: "rose", label: "Rose", bg: "bg-rose-400" },
    { id: "slate", label: "Slate", bg: "bg-slate-400" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-base font-bold text-foreground">DeskNest Settings</h1>
        <p className="text-xs text-muted-fg">Customize your workspace appearance and preferences.</p>
      </div>

      {/* Theme Selection */}
      <div className="bg-surface rounded-xl p-3.5 border border-border space-y-2">
        <label className="text-xs font-semibold text-foreground block">
          Appearance Theme
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleThemeChange("system")}
            className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              settings.theme === "system"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-surface-elevated text-muted-fg border-border hover:text-foreground"
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>System</span>
          </button>

          <button
            onClick={() => handleThemeChange("light")}
            className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              settings.theme === "light"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-surface-elevated text-muted-fg border-border hover:text-foreground"
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Light</span>
          </button>

          <button
            onClick={() => handleThemeChange("dark")}
            className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              settings.theme === "dark"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-surface-elevated text-muted-fg border-border hover:text-foreground"
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* Window & Desktop Behavior */}
      <div className="bg-surface rounded-xl p-3.5 border border-border space-y-3">
        <span className="text-xs font-semibold text-foreground block">
          Desktop Integration
        </span>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-muted-fg" />
            <div>
              <p className="text-xs font-medium text-foreground">Always on Top</p>
              <p className="text-[11px] text-muted-fg">Keep DeskNest above other Windows while multitasking</p>
            </div>
          </div>
          <button
            onClick={() => handleAlwaysOnTopChange(!settings.alwaysOnTop)}
            className={`w-9 h-5 rounded-full transition-colors relative ${
              settings.alwaysOnTop ? "bg-primary" : "bg-muted"
            }`}
            aria-label="Toggle always on top"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                settings.alwaysOnTop ? "left-4.5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            {settings.notificationSound ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-fg" />
            )}
            <div>
              <p className="text-xs font-medium text-foreground">Reminder Audio Chime</p>
              <p className="text-[11px] text-muted-fg">Play clear synthesized chime when reminders trigger</p>
            </div>
          </div>
          <button
            onClick={() => handleSoundChange(!settings.notificationSound)}
            className={`w-9 h-5 rounded-full transition-colors relative ${
              settings.notificationSound ? "bg-primary" : "bg-muted"
            }`}
            aria-label="Toggle reminder audio chime"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                settings.notificationSound ? "left-4.5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Note Preferences */}
      <div className="bg-surface rounded-xl p-3.5 border border-border space-y-3">
        <span className="text-xs font-semibold text-foreground block">
          Note Preferences
        </span>

        <div>
          <label className="text-[11px] text-muted-fg block mb-1.5">Default Sticky Note Color</label>
          <div className="flex items-center gap-2">
            {colors.map((c) => (
              <button
                key={c.id}
                onClick={() => handleColorChange(c.id)}
                title={c.label}
                className={`w-5 h-5 rounded-full ${c.bg} transition-transform ${
                  settings.defaultNoteColor === c.id
                    ? "scale-125 ring-2 ring-primary ring-offset-2"
                    : "opacity-70 hover:opacity-100"
                }`}
                aria-label={`Default color: ${c.label}`}
              />
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <label className="text-[11px] text-muted-fg block mb-1.5">Note Text Size</label>
          <div className="grid grid-cols-3 gap-2">
            {(["compact", "normal", "large"] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => handleTextSizeChange(sz)}
                className={`py-1.5 rounded-lg border text-xs capitalize font-medium transition-colors ${
                  settings.textSize === sz
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface-elevated text-muted-fg border-border hover:text-foreground"
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Backup and Restore */}
      <div className="bg-surface rounded-xl p-3.5 border border-border space-y-3">
        <span className="text-xs font-semibold text-foreground block">
          Local Backup & Data Portability
        </span>
        <p className="text-[11px] text-muted-fg leading-relaxed">
          Export your notes, drawings, tasks, reminders, and settings into a versioned JSON backup file. All data is kept 100% on your local disk.
        </p>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportBackup}>
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={handleTriggerImport}>
            <Upload className="w-3.5 h-3.5" />
            <span>Import Backup</span>
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelected}
            accept=".json,application/json"
            className="hidden"
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="bg-surface rounded-xl p-3.5 border border-border space-y-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Keyboard className="w-4 h-4 text-primary" />
          Keyboard Shortcuts
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-surface-elevated border border-border flex justify-between items-center">
            <span className="text-muted-fg">Create Note</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
              Ctrl+Alt+N
            </kbd>
          </div>
          <div className="p-2 rounded bg-surface-elevated border border-border flex justify-between items-center">
            <span className="text-muted-fg">Global Search</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
              Ctrl+F
            </kbd>
          </div>
          <div className="p-2 rounded bg-surface-elevated border border-border flex justify-between items-center">
            <span className="text-muted-fg">Undo Stroke</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
              Ctrl+Z
            </kbd>
          </div>
          <div className="p-2 rounded bg-surface-elevated border border-border flex justify-between items-center">
            <span className="text-muted-fg">Close Dialog</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
              Esc
            </kbd>
          </div>
        </div>
      </div>

      {/* App Information & Reset */}
      <div className="bg-surface rounded-xl p-3.5 border border-border space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-fg" />
          <div>
            <p className="text-xs font-bold text-foreground">DeskNest v1.0.0</p>
            <p className="text-[10px] text-muted-fg">Offline-First Windows Desktop Workspace</p>
          </div>
        </div>

        <div className="pt-2 border-t border-border flex justify-between items-center">
          <span className="text-[11px] text-muted-fg">Restore default preferences</span>
          <Button variant="ghost" size="sm" onClick={handleResetSettings}>
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </Button>
        </div>
      </div>

      {/* Import Preview Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Backup Data"
        maxWidth="md"
      >
        {validationResult && (
          <div className="space-y-4">
            {validationResult.valid ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid DeskNest backup schema detected!</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-surface-elevated border border-border">
                    <span className="text-muted-fg">Notes:</span>{" "}
                    <strong className="text-foreground">{validationResult.counts.notes}</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-elevated border border-border">
                    <span className="text-muted-fg">Tasks:</span>{" "}
                    <strong className="text-foreground">{validationResult.counts.tasks}</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-elevated border border-border">
                    <span className="text-muted-fg">Reminders:</span>{" "}
                    <strong className="text-foreground">{validationResult.counts.reminders}</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-elevated border border-border">
                    <span className="text-muted-fg">Drawings:</span>{" "}
                    <strong className="text-foreground">{validationResult.counts.drawings}</strong>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Import Strategy
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === "merge"}
                        onChange={() => setImportMode("merge")}
                      />
                      <span>Merge with existing records</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="overwrite"
                        checked={importMode === "overwrite"}
                        onChange={() => setImportMode("overwrite")}
                      />
                      <span className="text-rose-500 font-medium">Replace all existing data</span>
                    </label>
                  </div>
                </div>

                {importStatus && (
                  <p className="text-xs font-semibold text-primary">{importStatus}</p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setImportModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleExecuteImport}>
                    Confirm & Apply
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Invalid Backup File</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
