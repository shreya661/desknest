import React from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Bookmark,
  Lightbulb,
  Quote,
  AlertTriangle,
  Terminal,
  Edit3,
  Columns,
  Eye,
  Plus,
} from "lucide-react";
import { TextColor } from "../../../utils/markdownFormatting";
import { getAllBlockPlugins } from "../../../blocks/blockRegistry";

export interface EditorToolbarProps {
  onToggleInline: (prefix: string, suffix?: string, placeholder?: string) => void;
  onToggleHeading: (level: 1 | 2 | 3) => void;
  onInsertLinePrefix: (prefix: string) => void;
  onApplyTextColor: (color: TextColor) => void;
  onInsertDrawing: () => void;
  onInsertAestheticBox: (
    boxType: "keypoint" | "idea" | "quote" | "code" | "warning"
  ) => void;
  onInsertCustomBlock?: (type: string) => void;
  viewMode: "edit" | "split" | "preview";
  onViewModeChange: (mode: "edit" | "split" | "preview") => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onToggleInline,
  onToggleHeading,
  onInsertLinePrefix,
  onApplyTextColor,
  onInsertDrawing,
  onInsertAestheticBox,
  onInsertCustomBlock,
  viewMode,
  onViewModeChange,
}) => {
  const registeredPlugins = getAllBlockPlugins().filter(
    (p) => p.type !== "text" && p.type !== "drawing"
  );

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-x-auto select-none">
      {/* Core Inline Formatting */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleInline("**", "**", "bold text")}
        title="Bold (**text**)"
        aria-label="Toggle Bold"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleInline("*", "*", "italic text")}
        title="Italic (*text*)"
        aria-label="Toggle Italic"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleInline("<u>", "</u>", "underlined text")}
        title="Underline (<u>text</u>)"
        aria-label="Toggle Underline"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Underline className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleInline("~~", "~~", "strikethrough")}
        title="Strikethrough (~~text~~)"
        aria-label="Toggle Strikethrough"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleInline("==", "==", "highlighted text")}
        title="Highlight (==text==)"
        aria-label="Toggle Highlight"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-amber-500"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleInline("`", "`", "code")}
        title="Inline Code (`code`)"
        aria-label="Toggle Inline Code"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1 flex-shrink-0" />

      {/* Headings H1, H2, H3 */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleHeading(1)}
        title="Heading 1 (# Heading)"
        aria-label="Toggle Heading 1"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleHeading(2)}
        title="Heading 2 (## Subheading)"
        aria-label="Toggle Heading 2"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggleHeading(3)}
        title="Heading 3 (### Section)"
        aria-label="Toggle Heading 3"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <Heading3 className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1 flex-shrink-0" />

      {/* Lists & Checklists */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onInsertLinePrefix("- ")}
        title="Bullet list (- Item)"
        aria-label="Insert Bullet List"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <List className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onInsertLinePrefix("1. ")}
        title="Numbered list (1. Item)"
        aria-label="Insert Numbered List"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onInsertLinePrefix("- [ ] ")}
        title="Checklist item (- [ ] Task)"
        aria-label="Insert Checklist Item"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
      >
        <CheckSquare className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1 flex-shrink-0" />

      {/* Text Color Swatches */}
      <div className="flex items-center gap-1 px-1 bg-black/5 dark:bg-white/5 rounded-md py-0.5 flex-shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApplyTextColor("rose")}
          title="Rose text color"
          aria-label="Apply Rose text color"
          className="w-3 h-3 rounded-full bg-rose-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApplyTextColor("amber")}
          title="Amber text color"
          aria-label="Apply Amber text color"
          className="w-3 h-3 rounded-full bg-amber-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApplyTextColor("emerald")}
          title="Emerald text color"
          aria-label="Apply Emerald text color"
          className="w-3 h-3 rounded-full bg-emerald-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApplyTextColor("sky")}
          title="Sky text color"
          aria-label="Apply Sky text color"
          className="w-3 h-3 rounded-full bg-sky-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApplyTextColor("purple")}
          title="Purple text color"
          aria-label="Apply Purple text color"
          className="w-3 h-3 rounded-full bg-purple-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
        />
      </div>

      <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1 flex-shrink-0" />

      {/* Insert Drawing Button (Unified Visual Notebook) */}
      <button
        type="button"
        onClick={onInsertDrawing}
        title="Insert drawing canvas at cursor position"
        aria-label="Insert Drawing"
        className="px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 font-semibold text-[11px] flex items-center gap-1 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
      >
        <span>✏️</span>
        <span>Drawing</span>
      </button>

      {/* Aesthetic Callout Text Box Inserts */}
      <span className="text-[10px] text-muted-fg font-semibold uppercase tracking-wider ml-1 mr-0.5 flex-shrink-0">
        Boxes:
      </span>

      <button
        type="button"
        onClick={() => onInsertAestheticBox("keypoint")}
        title="Insert Key Point Card"
        className="px-1.5 py-0.5 rounded hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
      >
        <Bookmark className="w-3 h-3" />
        <span>Point</span>
      </button>

      <button
        type="button"
        onClick={() => onInsertAestheticBox("idea")}
        title="Insert Idea Card"
        className="px-1.5 py-0.5 rounded hover:bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
      >
        <Lightbulb className="w-3 h-3" />
        <span>Idea</span>
      </button>

      <button
        type="button"
        onClick={() => onInsertAestheticBox("quote")}
        title="Insert Aesthetic Quote Box"
        className="px-1.5 py-0.5 rounded hover:bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
      >
        <Quote className="w-3 h-3" />
        <span>Quote</span>
      </button>

      <button
        type="button"
        onClick={() => onInsertAestheticBox("warning")}
        title="Insert Warning / Detail Box"
        className="px-1.5 py-0.5 rounded hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
      >
        <AlertTriangle className="w-3 h-3" />
        <span>Alert</span>
      </button>

      <button
        type="button"
        onClick={() => onInsertAestheticBox("code")}
        title="Insert Code / Terminal Box"
        className="px-1.5 py-0.5 rounded hover:bg-slate-500/15 text-foreground text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
      >
        <Terminal className="w-3 h-3" />
        <span>Code</span>
      </button>

      {/* Custom Plugin Blocks Dropdown/Buttons if registered */}
      {registeredPlugins.length > 0 && onInsertCustomBlock && (
        <div className="flex items-center gap-1 ml-1 pl-1 border-l border-black/10 dark:border-white/10 flex-shrink-0">
          {registeredPlugins.map((plugin) => (
            <button
              key={plugin.type}
              type="button"
              onClick={() => onInsertCustomBlock(plugin.type)}
              title={plugin.description}
              className="px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{plugin.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* View Mode Switcher (Write / Split / Preview) */}
      <div className="flex items-center gap-0.5 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg border border-black/10 dark:border-white/10 ml-auto flex-shrink-0">
        <button
          type="button"
          onClick={() => onViewModeChange("edit")}
          title="Write mode (Structured Block Editor)"
          className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
            viewMode === "edit"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-fg hover:text-foreground"
          }`}
        >
          <Edit3 className="w-3 h-3" />
          <span>Write</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange("split")}
          title="Split mode (Side-by-side Live Preview)"
          className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
            viewMode === "split"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-fg hover:text-foreground"
          }`}
        >
          <Columns className="w-3 h-3" />
          <span className="hidden sm:inline">Split</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange("preview")}
          title="Preview mode (Rich Formatted View)"
          className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
            viewMode === "preview"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-fg hover:text-foreground"
          }`}
        >
          <Eye className="w-3 h-3" />
          <span>Preview</span>
        </button>
      </div>
    </div>
  );
};

