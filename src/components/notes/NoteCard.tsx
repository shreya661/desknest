import React, { useState } from "react";
import { Pin, Trash2, Files, Mic, Share2, PenTool } from "lucide-react";
import { Note } from "../../types";
import { ShareNoteModal } from "./ShareNoteModal";
import { cleanMarkdownSnippet } from "../../utils/markdownFormatting";

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onClick,
  onTogglePin,
  onDelete,
  onDuplicate,
}) => {
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const wordCount = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const hasDrawing = Boolean(
    (note.blocks && note.blocks.some((b) => b.type === "drawing")) ||
    (note.content && (note.content.includes("<!-- drawing:") || note.content.includes("[Drawing:")))
  );

  // Clean markdown tokens for clean card preview
  const cleanSnippet = cleanMarkdownSnippet(note.content);

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalOpen(true);
  };

  return (
    <>
      <div
        onClick={onClick}
        className="p-3.5 rounded-2xl border cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col justify-between h-38 relative group select-none overflow-hidden backdrop-blur-xs"
        style={{
          backgroundColor: `var(--note-${note.color}-bg)`,
          borderColor: `var(--note-${note.color}-border)`,
        }}
      >
        <div>
          <div className="flex items-start justify-between gap-1 mb-1.5">
            <h3 className="font-bold text-xs text-foreground line-clamp-1 flex-1">
              {note.title || "Untitled Note"}
            </h3>
            <button
              onClick={onTogglePin}
              title={note.isPinned ? "Unpin note" : "Pin note"}
              className={`p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                note.isPinned ? "text-amber-500 fill-amber-500" : "text-muted-fg opacity-0 group-hover:opacity-100"
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${note.isPinned ? "fill-current" : ""}`} />
            </button>
          </div>

          <p className="text-[11px] text-muted-fg line-clamp-3 leading-relaxed whitespace-pre-wrap">
            {cleanSnippet}
          </p>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-fg mt-2 pt-2 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-1.5">
            <span>{new Date(note.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            {wordCount > 0 && <span>• {readTime}m read</span>}
            {note.voiceRecordings && note.voiceRecordings.length > 0 && (
              <span className="flex items-center gap-0.5 text-rose-500 font-semibold bg-rose-500/10 px-1 py-0.2 rounded text-[9px]">
                <Mic className="w-2.5 h-2.5" />
                {note.voiceRecordings.length}
              </span>
            )}
            {hasDrawing && (
              <span
                className="flex items-center gap-0.5 text-sky-500 font-semibold bg-sky-500/10 px-1 py-0.2 rounded text-[9px]"
                title="Contains visual sketches"
              >
                <PenTool className="w-2.5 h-2.5" />
                Sketch
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleShareClick}
              title="Share Note"
              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            >
              <Share2 className="w-3 h-3" />
            </button>
            <button
              onClick={onDuplicate}
              title="Duplicate"
              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            >
              <Files className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="p-1 rounded-md hover:bg-rose-500/10 text-muted-fg hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <ShareNoteModal
        note={note}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </>
  );
};
