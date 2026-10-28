import React, { useState, useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Pin,
  Trash2,
  Copy,
  Download,
  Check,
  ArrowLeft,
  Files,
  Mic,
  Lightbulb,
  Bookmark,
  AlertTriangle,
  Quote,
  Terminal,
  Type,
  Share2,
  FileSpreadsheet,
  Eye,
  Columns,
  Edit3,
} from "lucide-react";

import {
  Note,
  NoteColor,
  NoteFontStyle,
  VoiceRecording,
  NoteBlock,
  TextBlock,
  DrawingBlock,
  NoteDraftRecord,
  Drawing,
} from "../../types";
import { notesRepository } from "../../repositories/notesRepository";
import { drawingsRepository } from "../../repositories/drawingsRepository";
import { draftsRepository } from "../../repositories/draftsRepository";
import { saveQueue } from "../../utils/saveQueue";
import {
  ensureNoteBlocks,
  deriveNoteContent,
  splitTextBlockAtCursor,
} from "../../utils/blockSplitting";
import { evaluateDraftFreshness } from "../../utils/draftFreshness";
import { Button } from "../common/Button";

import { VoiceRecorderModal } from "./VoiceRecorderModal";
import { VoiceNotePlayer } from "./VoiceNotePlayer";
import { ShareNoteModal } from "./ShareNoteModal";
import { NoteTemplatesModal, NoteTemplate } from "./NoteTemplatesModal";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { soundEffects } from "../../services/soundEffectsService";
import {
  toggleInlineMarker,
  applyTextColor,
  toggleHeading,
  TextColor,
} from "../../utils/markdownFormatting";
import { TextBlockItem } from "./blocks/TextBlockItem";
import { DrawingBlockItem } from "./blocks/DrawingBlockItem";

interface NoteEditorProps {
  note: Note;
  onClose: () => void;
  onUpdate: (updatedNote: Note) => void;
  onDelete: (id: string) => void;
  onDuplicate: (note: Note) => void;
  onOpenFullCanvas?: (drawingId: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  onOpenFullCanvas,
}) => {
  const [title, setTitle] = useState(note.title);
  const [blocks, setBlocks] = useState<NoteBlock[]>(() => ensureNoteBlocks(note));
  const [content, setContent] = useState(note.content || deriveNoteContent(ensureNoteBlocks(note)));
  const [color, setColor] = useState<NoteColor>(note.color);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [fontStyle, setFontStyle] = useState<NoteFontStyle>(note.fontStyle || "sans");
  const [voiceRecordings, setVoiceRecordings] = useState<VoiceRecording[]>(note.voiceRecordings || []);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [copied, setCopied] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("split");

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeCursorOffset, setActiveCursorOffset] = useState<number>(0);
  const [draftRecovery, setDraftRecovery] = useState<NoteDraftRecord | null>(null);
  const [fallbackAlert, setFallbackAlert] = useState<string | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);

  // Sync state if active note changes from outside
  useEffect(() => {
    setTitle(note.title);
    const initialBlocks = ensureNoteBlocks(note);
    setBlocks(initialBlocks);
    setContent(note.content || deriveNoteContent(initialBlocks));
    setColor(note.color);
    setIsPinned(note.isPinned);
    setFontStyle(note.fontStyle || "sans");
    setVoiceRecordings(note.voiceRecordings || []);
    if (initialBlocks.length > 0) {
      setActiveBlockId(initialBlocks[0].id);
    }

    // Check for durable recovery draft in IndexedDB (Freshness verification)
    draftsRepository.getDraft(note.id).then((draft) => {
      if (draft) {
        const freshness = evaluateDraftFreshness(draft, note);
        if (freshness.isFresh) {
          setDraftRecovery(draft);
        }
      }
    });
  }, [note.id]);

  // Close protection: Flush pending debounced writes immediately when application close is requested
  useEffect(() => {
    const unregister = saveQueue.registerFlushHook(async () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        const derived = deriveNoteContent(blocks);
        const updated = await notesRepository.saveNoteWithDrawings(
          {
            ...note,
            title: title.trim() || "Untitled Note",
            content: derived,
            blocks,
            schemaVersion: 2,
            color,
            isPinned,
            voiceRecordings,
            fontStyle,
            updatedAt: new Date().toISOString(),
          }
        );
        onUpdate(updated);
        await draftsRepository.removeDraft(note.id);
        setSaveStatus("saved");
      }
    });

    return () => unregister();
  }, [blocks, title, color, isPinned, voiceRecordings, fontStyle, note, onUpdate]);


  // Debounced auto-save with Monotonic SaveQueue and Durable Recovery Draft
  const triggerAutoSave = (
    newTitle: string,
    newBlocks: NoteBlock[],
    newColor: NoteColor,
    newPinned: boolean,
    newRecordings: VoiceRecording[],
    newFontStyle: NoteFontStyle,
    drawingsToSave: Drawing[] = [],
    drawingIdsToDelete: string[] = []
  ) => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Immediately write lightweight recovery draft in IndexedDB (Refinement 2)
    draftsRepository.saveDraft({
      id: note.id,
      noteId: note.id,
      title: newTitle,
      blocks: newBlocks,
      updatedAt: new Date().toISOString(),
    });

    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await saveQueue.enqueue(async () => {
          const derived = deriveNoteContent(newBlocks);
          const updated = await notesRepository.saveNoteWithDrawings(
            {
              ...note,
              title: newTitle.trim() || "Untitled Note",
              content: derived,
              blocks: newBlocks,
              schemaVersion: 2,
              color: newColor,
              isPinned: newPinned,
              voiceRecordings: newRecordings,
              fontStyle: newFontStyle,
              updatedAt: new Date().toISOString(),
            },
            drawingsToSave,
            drawingIdsToDelete
          );
          onUpdate(updated);
          // On successful save, clean up recovery draft (Refinement 2)
          await draftsRepository.removeDraft(note.id);
          setSaveStatus("saved");
        });
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 400);
  };

  const handleRestoreDraft = () => {
    if (!draftRecovery) return;
    setBlocks(draftRecovery.blocks);
    const derived = deriveNoteContent(draftRecovery.blocks);
    setContent(derived);
    setTitle(draftRecovery.title);
    setDraftRecovery(null);
    triggerAutoSave(
      draftRecovery.title,
      draftRecovery.blocks,
      color,
      isPinned,
      voiceRecordings,
      fontStyle
    );
  };

  const handleDiscardDraft = async () => {
    if (!draftRecovery) return;
    await draftsRepository.removeDraft(note.id);
    setDraftRecovery(null);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerAutoSave(val, blocks, color, isPinned, voiceRecordings, fontStyle);
  };

  const handleTextBlockChange = (blockId: string, newText: string) => {
    const updated = blocks.map((b) => (b.id === blockId ? { ...b, content: newText } : b));
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);
  };

  const handleColorChange = (newColor: NoteColor) => {
    setColor(newColor);
    triggerAutoSave(title, blocks, newColor, isPinned, voiceRecordings, fontStyle);
  };

  const handleFontStyleChange = (newFont: NoteFontStyle) => {
    setFontStyle(newFont);
    soundEffects.playPop();
    triggerAutoSave(title, blocks, color, isPinned, voiceRecordings, newFont);
  };

  const handleTogglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    soundEffects.playPop();
    triggerAutoSave(title, blocks, color, nextPinned, voiceRecordings, fontStyle);
  };

  // Insert Drawing at current cursor position (Refinement 3)
  const handleInsertDrawing = async () => {
    soundEffects.playPop();

    const targetId = activeBlockId || (blocks.length > 0 ? blocks[0].id : null);
    const targetIndex = blocks.findIndex((b) => b.id === targetId);

    let targetBlock: TextBlock;
    let insertIdx = blocks.length;

    if (targetIndex !== -1 && blocks[targetIndex].type === "text") {
      targetBlock = blocks[targetIndex] as TextBlock;
      insertIdx = targetIndex;
    } else {
      const firstTextIdx = blocks.findIndex((b) => b.type === "text");
      if (firstTextIdx !== -1) {
        targetBlock = blocks[firstTextIdx] as TextBlock;
        insertIdx = firstTextIdx;
      } else {
        targetBlock = { id: "blk_txt_" + Date.now(), type: "text", content: "" };
        insertIdx = blocks.length;
      }
    }

    // Cursor-based splitting with zero lost content
    const splitResult = splitTextBlockAtCursor(targetBlock.content, activeCursorOffset);

    if (splitResult.fallbackReason) {
      setFallbackAlert(splitResult.fallbackReason);
      setTimeout(() => setFallbackAlert(null), 4500);
    }

    // Create embedded drawing in Drawings store
    const newDrawing = await drawingsRepository.create({
      title: "Sketch " + (blocks.filter((b) => b.type === "drawing").length + 1),
      strokes: [],
    });
    newDrawing.isEmbedded = true;
    newDrawing.parentNoteId = note.id;

    const topBlock: TextBlock = {
      id: targetBlock.id,
      type: "text",
      content: splitResult.topContent,
    };

    const drawingBlock: DrawingBlock = {
      id: "blk_draw_" + Date.now(),
      type: "drawing",
      drawingId: newDrawing.id,
      title: newDrawing.title,
      displayMode: "inline",
    };

    const bottomBlock: TextBlock = {
      id: "blk_txt_" + Date.now() + "_cont",
      type: "text",
      content: splitResult.bottomContent,
    };

    let nextBlocks: NoteBlock[];
    if (targetIndex !== -1 && blocks[targetIndex].type === "text") {
      nextBlocks = [
        ...blocks.slice(0, insertIdx),
        topBlock,
        drawingBlock,
        bottomBlock,
        ...blocks.slice(insertIdx + 1),
      ];
    } else {
      nextBlocks = [...blocks, drawingBlock, bottomBlock];
    }

    setBlocks(nextBlocks);
    const derived = deriveNoteContent(nextBlocks);
    setContent(derived);
    setActiveBlockId(bottomBlock.id);
    setActiveCursorOffset(0);

    triggerAutoSave(
      title,
      nextBlocks,
      color,
      isPinned,
      voiceRecordings,
      fontStyle,
      [newDrawing]
    );
  };

  const handleUpdateDrawing = async (drawingId: string, updatedStrokes: any[]) => {
    try {
      const existing = await drawingsRepository.getById(drawingId);
      if (existing) {
        const updated = await drawingsRepository.update(drawingId, {
          strokes: updatedStrokes,
        });
        triggerAutoSave(
          title,
          blocks,
          color,
          isPinned,
          voiceRecordings,
          fontStyle,
          [updated]
        );
      }
    } catch (err) {
      console.warn("Could not auto-save drawing strokes:", err);
    }
  };

  const handleDeleteDrawingBlock = (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "drawing") return;

    if (!window.confirm("Remove this drawing from the note?")) return;

    const drawingId = block.drawingId;
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    setContent(deriveNoteContent(nextBlocks));

    triggerAutoSave(
      title,
      nextBlocks,
      color,
      isPinned,
      voiceRecordings,
      fontStyle,
      [],
      [drawingId]
    );
  };

  const handleToggleBlockDisplayMode = (blockId: string) => {
    const updated = blocks.map((b) => {
      if (b.id === blockId && b.type === "drawing") {
        return {
          ...b,
          displayMode: (b.displayMode === "expanded" ? "inline" : "expanded") as "inline" | "expanded",
        };
      }
      return b;
    });
    setBlocks(updated);
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);
  };

  const handleSaveVoiceNote = (
    audioData: string,
    durationSeconds: number,
    transcription: string,
    voiceTitle?: string
  ) => {
    const newMemo: VoiceRecording = {
      id: "voice_" + Date.now(),
      audioData,
      durationSeconds,
      createdAt: new Date().toISOString(),
      transcription: transcription.trim() || undefined,
    };
    const updatedRecordings = [...voiceRecordings, newMemo];
    setVoiceRecordings(updatedRecordings);

    let nextBlocks = [...blocks];
    if (transcription.trim()) {
      const lastTextIdx = nextBlocks.map((b) => b.type).lastIndexOf("text");
      if (lastTextIdx !== -1) {
        const tb = nextBlocks[lastTextIdx] as TextBlock;
        nextBlocks[lastTextIdx] = {
          ...tb,
          content: tb.content ? `${tb.content}\n\n🎙️ ${transcription.trim()}` : `🎙️ ${transcription.trim()}`,
        };
      } else {
        nextBlocks.push({
          id: "blk_txt_" + Date.now(),
          type: "text",
          content: `🎙️ ${transcription.trim()}`,
        });
      }
      setBlocks(nextBlocks);
      setContent(deriveNoteContent(nextBlocks));
    }

    let nextTitle = title;
    if ((title === "Untitled Note" || !title.trim()) && voiceTitle) {
      nextTitle = voiceTitle;
      setTitle(voiceTitle);
    }

    triggerAutoSave(nextTitle, nextBlocks, color, isPinned, updatedRecordings, fontStyle);
  };

  const handleDeleteVoiceNote = (id: string) => {
    const updated = voiceRecordings.filter((v) => v.id !== id);
    setVoiceRecordings(updated);
    triggerAutoSave(title, blocks, color, isPinned, updated, fontStyle);
  };

  const handleAppendTranscription = (text: string) => {
    const nextBlocks = [...blocks];
    const lastTextIdx = nextBlocks.map((b) => b.type).lastIndexOf("text");
    if (lastTextIdx !== -1) {
      const tb = nextBlocks[lastTextIdx] as TextBlock;
      nextBlocks[lastTextIdx] = {
        ...tb,
        content: tb.content ? `${tb.content}\n\n🎙️ ${text}` : `🎙️ ${text}`,
      };
    } else {
      nextBlocks.push({
        id: "blk_txt_" + Date.now(),
        type: "text",
        content: `🎙️ ${text}`,
      });
    }
    setBlocks(nextBlocks);
    setContent(deriveNoteContent(nextBlocks));
    triggerAutoSave(title, nextBlocks, color, isPinned, voiceRecordings, fontStyle);
  };

  // Helper to get active text block for toolbar formatting actions
  const getActiveTextBlock = (): { block: TextBlock; index: number } | null => {
    const idx = blocks.findIndex((b) => b.id === activeBlockId && b.type === "text");
    if (idx !== -1) return { block: blocks[idx] as TextBlock, index: idx };
    const firstTextIdx = blocks.findIndex((b) => b.type === "text");
    if (firstTextIdx !== -1) return { block: blocks[firstTextIdx] as TextBlock, index: firstTextIdx };
    return null;
  };

  const handleToggleInline = (
    prefix: string,
    suffix: string = prefix,
    placeholder: string = "text"
  ) => {
    const active = getActiveTextBlock();
    if (!active) return;

    const textarea = document.querySelector(
      `textarea[data-block-id="${active.block.id}"]`
    ) as HTMLTextAreaElement | null;
    const start = textarea ? textarea.selectionStart : activeCursorOffset;
    const end = textarea ? textarea.selectionEnd : activeCursorOffset;

    const result = toggleInlineMarker(active.block.content, start, end, prefix, suffix, placeholder);
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: result.newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(result.newStart, result.newEnd);
      }
    }, 10);
  };

  const handleToggleHeading = (level: 1 | 2 | 3) => {
    const active = getActiveTextBlock();
    if (!active) return;

    const textarea = document.querySelector(
      `textarea[data-block-id="${active.block.id}"]`
    ) as HTMLTextAreaElement | null;
    const start = textarea ? textarea.selectionStart : activeCursorOffset;
    const end = textarea ? textarea.selectionEnd : activeCursorOffset;

    const result = toggleHeading(active.block.content, start, end, level);
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: result.newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(result.newStart, result.newEnd);
      }
    }, 10);
  };

  const handleApplyTextColor = (textColor: TextColor) => {
    const active = getActiveTextBlock();
    if (!active) return;

    const textarea = document.querySelector(
      `textarea[data-block-id="${active.block.id}"]`
    ) as HTMLTextAreaElement | null;
    const start = textarea ? textarea.selectionStart : activeCursorOffset;
    const end = textarea ? textarea.selectionEnd : activeCursorOffset;

    const result = applyTextColor(active.block.content, start, end, textColor);
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: result.newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(result.newStart, result.newEnd);
      }
    }, 10);
  };

  const insertLinePrefix = (prefix: string) => {
    const active = getActiveTextBlock();
    if (!active) return;

    const textarea = document.querySelector(
      `textarea[data-block-id="${active.block.id}"]`
    ) as HTMLTextAreaElement | null;
    const start = textarea ? textarea.selectionStart : activeCursorOffset;
    const current = active.block.content;
    const before = current.substring(0, start);
    const lastNewline = before.lastIndexOf("\n");
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const newContent = current.substring(0, lineStart) + prefix + current.substring(lineStart);
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }, 10);
  };

  const insertAestheticBox = (boxType: "keypoint" | "idea" | "quote" | "code" | "warning") => {
    let boxText = "";
    if (boxType === "keypoint") {
      boxText = "\n\n> 📌 **KEY TAKEAWAY**\n> Enter key point or concept here...\n\n";
    } else if (boxType === "idea") {
      boxText = "\n\n> 💡 **IDEA & INSPIRATION**\n> A creative thought or observation...\n\n";
    } else if (boxType === "quote") {
      boxText = '\n\n> 💬 *"Simplicity is the prerequisite for reliability."*\n> — Edsger W. Dijkstra\n\n';
    } else if (boxType === "code") {
      boxText = "\n\n```typescript\n// Aesthetic Code Box\nconst focus = true;\n```\n\n";
    } else if (boxType === "warning") {
      boxText = "\n\n> ⚠️ **IMPORTANT DETAIL**\n> Do not overlook this requirement...\n\n";
    }

    const active = getActiveTextBlock();
    if (!active) return;

    const textarea = document.querySelector(
      `textarea[data-block-id="${active.block.id}"]`
    ) as HTMLTextAreaElement | null;
    const start = textarea ? textarea.selectionStart : active.block.content.length;

    const current = active.block.content;
    const newContent = current.substring(0, start) + boxText + current.substring(start);
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    soundEffects.playPop();
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(start + boxText.length, start + boxText.length);
      }
    }, 10);
  };

  const handleApplyTemplate = (template: NoteTemplate) => {
    const updatedBlocks: NoteBlock[] = [
      {
        id: "blk_template_" + Date.now(),
        type: "text",
        content: template.content,
      },
    ];
    const newTitle = title === "Untitled Note" || !title.trim() ? template.title : title;
    setTitle(newTitle);
    setBlocks(updatedBlocks);
    setContent(template.content);
    setColor(template.color);
    triggerAutoSave(newTitle, updatedBlocks, template.color, isPinned, voiceRecordings, fontStyle);
  };

  const handleCopyContent = () => {
    const fullText = `${title}\n\n${content}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    soundEffects.playPop();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    const fullText = `# ${title}\n\n${content}`;
    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "note"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const colorList: { id: NoteColor; label: string; bg: string }[] = [
    { id: "amber", label: "Amber", bg: "bg-amber-400" },
    { id: "lemon", label: "Lemon", bg: "bg-yellow-300" },
    { id: "mint", label: "Mint", bg: "bg-emerald-400" },
    { id: "sky", label: "Sky", bg: "bg-sky-400" },
    { id: "lavender", label: "Lavender", bg: "bg-purple-400" },
    { id: "rose", label: "Rose", bg: "bg-rose-400" },
    { id: "slate", label: "Slate", bg: "bg-slate-400" },
  ];

  const fontOptions: { id: NoteFontStyle; label: string; styleClass: string }[] = [
    { id: "sans", label: "Clean Sans", styleClass: "font-sans" },
    { id: "serif", label: "Editorial Serif", styleClass: "font-serif" },
    { id: "mono", label: "Retro Mono", styleClass: "font-mono" },
    { id: "casual", label: "Handwritten", styleClass: "font-casual" },
  ];

  const getFontFamilyStyle = () => {
    switch (fontStyle) {
      case "serif":
        return { fontFamily: 'Georgia, Cambria, "Times New Roman", serif' };
      case "mono":
        return { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' };
      case "casual":
        return { fontFamily: '"Caveat", "Segoe Print", "Bradley Hand", cursive, sans-serif' };
      default:
        return { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
    }
  };

  const getFontClass = () => {
    switch (fontStyle) {
      case "serif":
        return "font-serif text-sm";
      case "mono":
        return "font-mono text-xs";
      case "casual":
        return "font-casual text-base";
      default:
        return "font-sans text-xs";
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full rounded-xl border overflow-hidden shadow-xs transition-colors"
      style={{
        backgroundColor: `var(--note-${color}-bg)`,
        borderColor: `var(--note-${color}-border)`,
      }}
    >
      {/* Durable Recovery Banner (Refinement 2) */}
      {draftRecovery && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/20 text-amber-900 dark:text-amber-100 text-xs border-b border-amber-500/30">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Unsaved changes recovered from {new Date(draftRecovery.updatedAt).toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRestoreDraft}
              className="px-2 py-0.5 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
            >
              Restore
            </button>
            <button
              onClick={handleDiscardDraft}
              className="px-2 py-0.5 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 transition"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Fallback Notice Banner (Refinement 3) */}
      {fallbackAlert && (
        <div className="px-3 py-1 bg-sky-500/15 text-sky-900 dark:text-sky-100 text-xs border-b border-sky-500/30 flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>{fallbackAlert}</span>
        </div>
      )}

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
            {colorList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleColorChange(c.id)}
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
              onChange={(e) => handleFontStyleChange(e.target.value as NoteFontStyle)}
              title="Font Style"
              className="bg-transparent text-xs text-foreground font-medium rounded px-1.5 py-0.5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {fontOptions.map((f) => (
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
            onClick={() => setShareModalOpen(true)}
            title="Share note"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Share note"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Templates Button */}
          <button
            onClick={() => setTemplatesModalOpen(true)}
            title="Choose Aesthetic Template"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors flex items-center gap-1"
            aria-label="Templates"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Template</span>
          </button>

          {/* Voice Memo Record Button */}
          <button
            onClick={() => setVoiceModalOpen(true)}
            title="Record Voice Note / Dictation"
            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold transition-all hover:scale-105 active:scale-95"
            aria-label="Record Voice Memo"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Voice</span>
          </button>

          {/* Pin toggle */}
          <button
            onClick={handleTogglePin}
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
            onClick={handleCopyContent}
            title="Copy note to clipboard"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Copy note"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Duplicate note */}
          <button
            onClick={() => onDuplicate(note)}
            title="Duplicate note"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Duplicate note"
          >
            <Files className="w-4 h-4" />
          </button>

          {/* Export markdown */}
          <button
            onClick={handleExportMarkdown}
            title="Export as Markdown (.md)"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors"
            aria-label="Export Markdown"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Delete note */}
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this note?")) {
                onDelete(note.id);
              }
            }}
            title="Delete note"
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-fg hover:text-rose-500 transition-colors"
            aria-label="Delete note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rich formatting ribbon + Drawing Insert + Aesthetic Boxes */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-x-auto select-none">
        {/* Core Markdown Formatting */}
        <button
          onClick={() => handleToggleInline("**", "**", "bold text")}
          title="Bold (**text**)"
          aria-label="Toggle Bold (**text**)"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleToggleInline("*", "*", "italic text")}
          title="Italic (*text*)"
          aria-label="Toggle Italic (*text*)"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleToggleInline("~~", "~~", "strikethrough")}
          title="Strikethrough (~~text~~)"
          aria-label="Toggle Strikethrough (~~text~~)"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleToggleInline("`", "`", "code")}
          title="Inline Code (`code`)"
          aria-label="Toggle Inline Code (`code`)"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <Code className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

        {/* Headings H1, H2, H3 */}
        <button
          onClick={() => handleToggleHeading(1)}
          title="Heading 1 (# Heading)"
          aria-label="Toggle Heading 1"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleToggleHeading(2)}
          title="Heading 2 (## Subheading)"
          aria-label="Toggle Heading 2"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleToggleHeading(3)}
          title="Heading 3 (### Section)"
          aria-label="Toggle Heading 3"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

        {/* Lists & Checklists */}
        <button
          onClick={() => insertLinePrefix("- ")}
          title="Bullet list (- Item)"
          aria-label="Insert Bullet List (- Item)"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => insertLinePrefix("1. ")}
          title="Numbered list (1. Item)"
          aria-label="Insert Numbered List (1. Item)"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => insertLinePrefix("- [ ] ")}
          title="Checklist item (- [ ] Task)"
          aria-label="Insert Checklist Item (- [ ] Task)"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-foreground"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

        {/* Text Color Swatches */}
        <div className="flex items-center gap-1 px-1 bg-black/5 dark:bg-white/5 rounded-md py-0.5">
          <button
            onClick={() => handleApplyTextColor("rose")}
            title="Rose text color"
            aria-label="Apply Rose text color"
            className="w-3 h-3 rounded-full bg-rose-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
          />
          <button
            onClick={() => handleApplyTextColor("amber")}
            title="Amber text color"
            aria-label="Apply Amber text color"
            className="w-3 h-3 rounded-full bg-amber-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
          />
          <button
            onClick={() => handleApplyTextColor("emerald")}
            title="Emerald text color"
            aria-label="Apply Emerald text color"
            className="w-3 h-3 rounded-full bg-emerald-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
          />
          <button
            onClick={() => handleApplyTextColor("sky")}
            title="Sky text color"
            aria-label="Apply Sky text color"
            className="w-3 h-3 rounded-full bg-sky-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
          />
          <button
            onClick={() => handleApplyTextColor("purple")}
            title="Purple text color"
            aria-label="Apply Purple text color"
            className="w-3 h-3 rounded-full bg-purple-500 hover:scale-125 transition-transform border border-black/10 dark:border-white/10"
          />
        </div>

        <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

        {/* Insert Drawing Button (Unified Visual Notebook) */}
        <button
          onClick={handleInsertDrawing}
          title="Insert drawing canvas at cursor position"
          aria-label="Insert Drawing"
          className="px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 font-semibold text-[11px] flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
        >
          <span>✏️</span>
          <span>Drawing</span>
        </button>

        <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

        {/* Aesthetic Callout Text Box Inserts */}
        <span className="text-[10px] text-muted-fg font-semibold uppercase tracking-wider ml-1 mr-0.5">
          Boxes:
        </span>
        <button
          onClick={() => insertAestheticBox("keypoint")}
          title="Insert Key Point Card"
          className="px-1.5 py-0.5 rounded hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <Bookmark className="w-3 h-3" />
          <span>Point</span>
        </button>

        <button
          onClick={() => insertAestheticBox("idea")}
          title="Insert Idea Card"
          className="px-1.5 py-0.5 rounded hover:bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <Lightbulb className="w-3 h-3" />
          <span>Idea</span>
        </button>

        <button
          onClick={() => insertAestheticBox("quote")}
          title="Insert Aesthetic Quote Box"
          className="px-1.5 py-0.5 rounded hover:bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <Quote className="w-3 h-3" />
          <span>Quote</span>
        </button>

        <button
          onClick={() => insertAestheticBox("warning")}
          title="Insert Warning / Detail Box"
          className="px-1.5 py-0.5 rounded hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Alert</span>
        </button>

        <button
          onClick={() => insertAestheticBox("code")}
          title="Insert Code / Terminal Box"
          className="px-1.5 py-0.5 rounded hover:bg-slate-500/15 text-foreground text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <Terminal className="w-3 h-3" />
          <span>Code</span>
        </button>

        {/* View Mode Segmented Switcher (Write / Split / Preview) */}
        <div className="flex items-center gap-0.5 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg border border-black/10 dark:border-white/10 ml-auto flex-shrink-0">
          <button
            onClick={() => setViewMode("edit")}
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
            onClick={() => setViewMode("split")}
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
            onClick={() => setViewMode("preview")}
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

      {/* Note Title Input */}
      <div className="px-4 pt-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note Title..."
          style={getFontFamilyStyle()}
          className="w-full bg-transparent text-base font-bold text-foreground placeholder:text-muted-fg focus:outline-none"
        />
      </div>

      {/* Attached Voice Memos */}
      {voiceRecordings.length > 0 && (
        <div className="px-4 py-1 space-y-1">
          {voiceRecordings.map((recording) => (
            <VoiceNotePlayer
              key={recording.id}
              recording={recording}
              onDelete={handleDeleteVoiceNote}
              onAppendTranscription={handleAppendTranscription}
            />
          ))}
        </div>
      )}

      {/* Note Content Area (Edit / Split / Preview) */}
      <div className="flex-1 p-4 pt-2 flex overflow-hidden gap-4 min-h-0">
        {/* Block Document Editor Pane (shown in 'edit' or 'split') */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1">
            {blocks.map((block) => {
              if (block.type === "text") {
                return (
                  <TextBlockItem
                    key={block.id}
                    id={block.id}
                    content={block.content}
                    fontClass={getFontClass()}
                    onChange={handleTextBlockChange}
                    onFocus={(id, cursor) => {
                      setActiveBlockId(id);
                      setActiveCursorOffset(cursor);
                    }}
                    onCursorChange={(cursor) => setActiveCursorOffset(cursor)}
                  />
                );
              }
              if (block.type === "drawing") {
                return (
                  <DrawingBlockItem
                    key={block.id}
                    blockId={block.id}
                    drawingId={block.drawingId}
                    title={block.title}
                    displayMode={block.displayMode}
                    onUpdateDrawing={handleUpdateDrawing}
                    onDeleteBlock={handleDeleteDrawingBlock}
                    onToggleDisplayMode={handleToggleBlockDisplayMode}
                    onOpenFullCanvas={onOpenFullCanvas}
                  />
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Divider in split mode */}
        {viewMode === "split" && (
          <div className="w-[1px] bg-black/10 dark:bg-white/10 self-stretch my-1 flex-shrink-0" />
        )}

        {/* Live Formatted Markdown Preview Pane (shown in 'preview' or 'split') */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1">
            <MarkdownRenderer
              content={content}
              fontStyle={fontStyle}
              className="flex-1"
            />
          </div>
        )}
      </div>

      {/* Voice Recorder Modal */}
      {voiceModalOpen && (
        <VoiceRecorderModal
          isOpen={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          onSaveVoiceNote={handleSaveVoiceNote}
        />
      )}

      {/* Share Note Modal */}
      {shareModalOpen && (
        <ShareNoteModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          note={{ ...note, title, content, color, blocks }}
        />
      )}

      {/* Templates Modal */}
      {templatesModalOpen && (
        <NoteTemplatesModal
          isOpen={templatesModalOpen}
          onClose={() => setTemplatesModalOpen(false)}
          onSelectTemplate={handleApplyTemplate}
        />
      )}

    </div>
  );
};
