import React, { useState, useEffect, useRef } from "react";
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
import { soundEffects } from "../../services/soundEffectsService";
import {
  toggleInlineMarker,
  applyTextColor,
  toggleHeading,
  TextColor,
} from "../../utils/markdownFormatting";
import { createBlockInstance } from "../../blocks";
import { VoiceRecorderModal } from "./VoiceRecorderModal";
import { VoiceNotePlayer } from "./VoiceNotePlayer";
import { ShareNoteModal } from "./ShareNoteModal";
import { NoteTemplatesModal, NoteTemplate } from "./NoteTemplatesModal";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { EditorHeader } from "./editor/EditorHeader";
import { EditorToolbar } from "./editor/EditorToolbar";
import { EditorRecoveryBanner } from "./editor/EditorRecoveryBanner";
import { EditorBlockList } from "./editor/EditorBlockList";

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
  const [content, setContent] = useState(
    note.content || deriveNoteContent(ensureNoteBlocks(note))
  );
  const [color, setColor] = useState<NoteColor>(note.color);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [fontStyle, setFontStyle] = useState<NoteFontStyle>(note.fontStyle || "sans");
  const [voiceRecordings, setVoiceRecordings] = useState<VoiceRecording[]>(
    note.voiceRecordings || []
  );
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [copied, setCopied] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("split");

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeCursorOffset, setActiveCursorOffset] = useState<number>(0);
  const [activeSelectionRange, setActiveSelectionRange] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 0 });
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

    // Check for durable recovery draft in IndexedDB
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

    // Immediately write lightweight recovery draft in IndexedDB
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

  const handleBlockChange = (updatedBlock: NoteBlock) => {
    const updated = blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b));
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

  // Insert Drawing at current cursor position
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

  // Insert a custom block plugin instance at the end
  const handleInsertCustomBlock = (type: string) => {
    soundEffects.playPop();
    const newBlock = createBlockInstance(type);
    const nextBlocks = [...blocks, newBlock as NoteBlock];
    setBlocks(nextBlocks);
    setContent(deriveNoteContent(nextBlocks));
    setActiveBlockId(newBlock.id);
    triggerAutoSave(title, nextBlocks, color, isPinned, voiceRecordings, fontStyle);
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

  const handleDeleteBlock = (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    if (block.type === "drawing") {
      if (!window.confirm("Remove this drawing from the note?")) return;
      const drawingId = (block as DrawingBlock).drawingId;
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
      return;
    }

    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    // Always preserve at least one text block
    if (nextBlocks.length === 0) {
      nextBlocks.push({
        id: "blk_txt_" + Date.now(),
        type: "text",
        content: "",
      });
    }
    setBlocks(nextBlocks);
    setContent(deriveNoteContent(nextBlocks));
    triggerAutoSave(title, nextBlocks, color, isPinned, voiceRecordings, fontStyle);
  };

  const handleToggleBlockDisplayMode = (blockId: string) => {
    const updated = blocks.map((b) => {
      if (b.id === blockId && b.type === "drawing") {
        return {
          ...b,
          displayMode:
            (b.displayMode === "expanded" ? "inline" : "expanded") as
              | "inline"
              | "expanded",
        };
      }
      return b;
    });
    setBlocks(updated);
    triggerAutoSave(title, updated, color, isPinned, voiceRecordings, fontStyle);
  };

  const handleSaveVoiceNote = async (
    audioData: string,
    durationSeconds: number,
    transcription: string,
    voiceTitle?: string,
    recordingId?: string
  ) => {
    const id = recordingId ?? "voice_" + Date.now();

    if (audioData && audioData.length > 0) {
      const { saveAudioBlob: saveBlobFn } = await import("../../repositories/db");
      const mimeType = audioData.startsWith("data:")
        ? audioData.split(";")[0].slice(5)
        : "audio/webm";
      await saveBlobFn({
        id,
        noteId: note.id,
        mimeType,
        data: audioData,
        createdAt: Date.now(),
      });
    }

    const newMemo: VoiceRecording = {
      id,
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
          content: tb.content
            ? `${tb.content}\n\n🎙️ ${transcription.trim()}`
            : `🎙️ ${transcription.trim()}`,
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

  const handleDeleteVoiceNote = async (id: string) => {
    const updated = voiceRecordings.filter((v) => v.id !== id);
    setVoiceRecordings(updated);
    triggerAutoSave(title, blocks, color, isPinned, updated, fontStyle);
    try {
      const { deleteAudioBlob } = await import("../../repositories/db");
      await deleteAudioBlob(id);
    } catch {
      // non-critical
    }
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
    if (firstTextIdx !== -1) {
      return { block: blocks[firstTextIdx] as TextBlock, index: firstTextIdx };
    }
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
    const start =
      textarea && textarea.selectionStart !== textarea.selectionEnd
        ? textarea.selectionStart
        : activeSelectionRange.start !== activeSelectionRange.end
        ? activeSelectionRange.start
        : textarea
        ? textarea.selectionStart
        : activeCursorOffset;
    const end =
      textarea && textarea.selectionStart !== textarea.selectionEnd
        ? textarea.selectionEnd
        : activeSelectionRange.start !== activeSelectionRange.end
        ? activeSelectionRange.end
        : textarea
        ? textarea.selectionEnd
        : activeCursorOffset;

    const result = toggleInlineMarker(
      active.block.content,
      start,
      end,
      prefix,
      suffix,
      placeholder
    );
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: result.newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    setActiveSelectionRange({ start: result.newStart, end: result.newEnd });
    setActiveCursorOffset(result.newStart);
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
    const start =
      textarea && textarea.selectionStart !== textarea.selectionEnd
        ? textarea.selectionStart
        : activeSelectionRange.start !== activeSelectionRange.end
        ? activeSelectionRange.start
        : textarea
        ? textarea.selectionStart
        : activeCursorOffset;
    const end =
      textarea && textarea.selectionStart !== textarea.selectionEnd
        ? textarea.selectionEnd
        : activeSelectionRange.start !== activeSelectionRange.end
        ? activeSelectionRange.end
        : textarea
        ? textarea.selectionEnd
        : activeCursorOffset;

    const result = toggleHeading(active.block.content, start, end, level);
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: result.newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    setActiveSelectionRange({ start: result.newStart, end: result.newEnd });
    setActiveCursorOffset(result.newStart);
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
    const start =
      textarea && textarea.selectionStart !== textarea.selectionEnd
        ? textarea.selectionStart
        : activeSelectionRange.start !== activeSelectionRange.end
        ? activeSelectionRange.start
        : textarea
        ? textarea.selectionStart
        : activeCursorOffset;
    const end =
      textarea && textarea.selectionStart !== textarea.selectionEnd
        ? textarea.selectionEnd
        : activeSelectionRange.start !== activeSelectionRange.end
        ? activeSelectionRange.end
        : textarea
        ? textarea.selectionEnd
        : activeCursorOffset;

    const result = applyTextColor(active.block.content, start, end, textColor);
    const updated = [...blocks];
    updated[active.index] = { ...active.block, content: result.newContent };
    setBlocks(updated);
    setContent(deriveNoteContent(updated));
    setActiveSelectionRange({ start: result.newStart, end: result.newEnd });
    setActiveCursorOffset(result.newStart);
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

    const newContent =
      current.substring(0, lineStart) + prefix + current.substring(lineStart);
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

  const insertAestheticBox = (
    boxType: "keypoint" | "idea" | "quote" | "code" | "warning"
  ) => {
    let boxText = "";
    if (boxType === "keypoint") {
      boxText = "\n\n> 📌 **KEY TAKEAWAY**\n> Enter key point or concept here...\n\n";
    } else if (boxType === "idea") {
      boxText = "\n\n> 💡 **IDEA & INSPIRATION**\n> A creative thought or observation...\n\n";
    } else if (boxType === "quote") {
      boxText =
        '\n\n> 💬 *"Simplicity is the prerequisite for reliability."*\n> — Edsger W. Dijkstra\n\n';
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
    triggerAutoSave(
      newTitle,
      updatedBlocks,
      template.color,
      isPinned,
      voiceRecordings,
      fontStyle
    );
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

  const getFontFamilyStyle = (): React.CSSProperties => {
    switch (fontStyle) {
      case "serif":
        return { fontFamily: 'Georgia, Cambria, "Times New Roman", serif' };
      case "mono":
        return {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        };
      case "casual":
        return {
          fontFamily: '"Caveat", "Segoe Print", "Bradley Hand", cursive, sans-serif',
        };
      default:
        return {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        };
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
      {/* Recovery & Notice Banners */}
      <EditorRecoveryBanner
        draftRecovery={draftRecovery}
        fallbackAlert={fallbackAlert}
        onRestoreDraft={handleRestoreDraft}
        onDiscardDraft={handleDiscardDraft}
      />

      {/* Top action header bar */}
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        color={color}
        onColorChange={handleColorChange}
        fontStyle={fontStyle}
        onFontStyleChange={handleFontStyleChange}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        saveStatus={saveStatus}
        copied={copied}
        onCopyContent={handleCopyContent}
        onDuplicate={() => onDuplicate(note)}
        onExportMarkdown={handleExportMarkdown}
        onDelete={() => {
          if (window.confirm("Are you sure you want to delete this note?")) {
            onDelete(note.id);
          }
        }}
        onClose={onClose}
        onOpenShare={() => setShareModalOpen(true)}
        onOpenTemplates={() => setTemplatesModalOpen(true)}
        onOpenVoiceRecorder={() => setVoiceModalOpen(true)}
        fontFamilyStyle={getFontFamilyStyle()}
      />

      {/* Formatting & Block Toolbar */}
      <EditorToolbar
        onToggleInline={handleToggleInline}
        onToggleHeading={handleToggleHeading}
        onInsertLinePrefix={insertLinePrefix}
        onApplyTextColor={handleApplyTextColor}
        onInsertDrawing={handleInsertDrawing}
        onInsertAestheticBox={insertAestheticBox}
        onInsertCustomBlock={handleInsertCustomBlock}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

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
          <EditorBlockList
            blocks={blocks}
            activeBlockId={activeBlockId}
            fontClass={getFontClass()}
            onBlockChange={handleBlockChange}
            onBlockFocus={(id) => setActiveBlockId(id)}
            onCursorChange={(start, end) => {
              setActiveCursorOffset(start);
              setActiveSelectionRange({
                start,
                end: end !== undefined ? end : start,
              });
            }}
            onDeleteBlock={handleDeleteBlock}
            onUpdateDrawing={handleUpdateDrawing}
            onOpenFullCanvas={onOpenFullCanvas}
            onToggleDisplayMode={handleToggleBlockDisplayMode}
            onAddBlock={handleInsertCustomBlock}
          />
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
