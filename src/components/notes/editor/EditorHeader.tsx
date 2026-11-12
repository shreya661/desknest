import React from "react";
import {
  ArrowLeft,
  Pin,
  Trash2,
  Copy,
  Download,
  Check,
  Files,
  Mic,
  Share2,
  FileSpreadsheet,
  Type,
} from "lucide-react";
import { NoteColor, NoteFontStyle } from "../../../types";
import { Button } from "../../common/Button";

export interface EditorHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  color: NoteColor;
  onColorChange: (color: NoteColor) => void;
  fontStyle: NoteFontStyle;
  onFontStyleChange: (fontStyle: NoteFontStyle) => void;
  isPinned: boolean;
  onTogglePin: () => void;
  saveStatus: "saved" | "saving";
  copied: boolean;
  onCopyContent: () => void;
  onDuplicate: () => void;
  onExportMarkdown: () => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenShare: () => void;
  onOpenTemplates: () => void;
  onOpenVoiceRecorder: () => void;
  fontFamilyStyle: React.CSSProperties;
}

const COLOR_LIST: { id: NoteColor; label: string; bg: string }[] = [
  { id: "amber", label: "Amber", bg: "bg-amber-400" },
  { id: "lemon", label: "Lemon", bg: "bg-yellow-300" },
  { id: "mint", label: "Mint", bg: "bg-emerald-400" },
  { id: "sky", label: "Sky", bg: "bg-sky-400" },
  { id: "lavender", label: "Lavender", bg: "bg-purple-400" },
  { id: "rose", label: "Rose", bg: "bg-rose-400" },
  { id: "slate", label: "Slate", bg: "bg-slate-400" },
];

const FONT_OPTIONS: { id: NoteFontStyle; label: string }[] = [
  { id: "sans", label: "Clean Sans" },
  { id: "serif", label: "Editorial Serif" },
  { id: "mono", label: "Retro Mono" },
  { id: "casual", label: "Handwritten" },
];

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  title,
  onTitleChange,
  color,
  onColorChange,
  fontStyle,
  onFontStyleChange,
  isPinned,
  onTogglePin,
  saveStatus,
  copied,
  onCopyContent,
  onDuplicate,
  onExportMarkdown,
  onDelete,
  onClose,
  onOpenShare,
  onOpenTemplates,
  onOpenVoiceRecorder,
  fontFamilyStyle,
}) => {
  return (
    <>
      {/* Top action toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Back to notes list"
            aria-label="Back to notes list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Color palette selector */}
          <div className="flex items-center gap-1 ml-2">
            {COLOR_LIST.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onColorChange(c.id)}
                title={c.label}
                aria-label={`Select ${c.label} note background color`}
                className={`w-4 h-4 rounded-full ${c.bg} transition-transform ${
                  color === c.id
                    ? "scale-125 ring-2 ring-primary ring-offset-1 ring-offset-background"
                    : "hover:scale-110 opacity-70 hover:opacity-100"
                }`}
              />
            ))}
          </div>

          {/* Typography selector */}
          <div className="flex items-center gap-1 ml-3 border-l border-black/10 dark:border-white/10 pl-2">
            <Type className="w-3.5 h-3.5 text-muted-fg mr-0.5" />
            <select
              value={fontStyle}
              onChange={(e) => onFontStyleChange(e.target.value as NoteFontStyle)}
              title="Font Style"
              className="bg-transparent text-xs text-foreground font-medium rounded px-1.5 py-0.5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id} className="bg-surface text-foreground">
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-fg mr-2">
            {saveStatus === "saving" ? "Saving..." : "Saved"}
          </span>

          {/* Share Note Button */}
          <button
            onClick={onOpenShare}
            title="Share note"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Share note"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Templates Button */}
          <button
            onClick={onOpenTemplates}
            title="Choose Aesthetic Template"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors flex items-center gap-1"
            aria-label="Templates"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Template</span>
          </button>

          {/* Voice Memo Record Button */}
          <button
            onClick={onOpenVoiceRecorder}
            title="Record Voice Note / Dictation"
            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold transition-all hover:scale-105 active:scale-95"
            aria-label="Record Voice Memo"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Voice</span>
          </button>

          {/* Pin toggle */}
          <button
            onClick={onTogglePin}
            title={isPinned ? "Unpin note" : "Pin note"}
            className={`p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
              isPinned ? "text-amber-500 fill-amber-500" : "text-muted-fg"
            }`}
            aria-label="Pin note"
          >
            <Pin className={`w-4 h-4 ${isPinned ? "fill-current" : ""}`} />
          </button>

          {/* Copy content */}
          <button
            onClick={onCopyContent}
            title="Copy note to clipboard"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Copy note"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Duplicate note */}
          <button
            onClick={onDuplicate}
            title="Duplicate note"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Duplicate note"
          >
            <Files className="w-4 h-4" />
          </button>

          {/* Export markdown */}
          <button
            onClick={onExportMarkdown}
            title="Export as Markdown (.md)"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Export Markdown"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Delete note */}
          <button
            onClick={onDelete}
            title="Delete note"
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-fg hover:text-rose-500 transition-colors"
            aria-label="Delete note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Note Title Input */}
      <div className="px-4 pt-3">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Note Title..."
          style={fontFamilyStyle}
          className="w-full bg-transparent text-base font-bold text-foreground placeholder:text-muted-fg focus:outline-none"
        />
      </div>
    </>
  );
};
