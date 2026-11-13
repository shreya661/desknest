import React, { useRef, useEffect } from "react";
import {
  handleEditorEnter,
  handleEditorTab,
  handleEditorBackspace,
} from "../../../utils/listContinuation";
import { useBlockEngineContext } from "../../../blocks/BlockEngineContext";

interface TextBlockItemProps {
  id: string;
  content: string;
  fontClass: string;
  isReadOnly?: boolean;
  placeholder?: string;
  onChange: (id: string, newContent: string) => void;
  onFocus: (id: string, cursorOffset: number) => void;
  onCursorChange: (cursorStart: number, cursorEnd?: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}

export const TextBlockItem: React.FC<TextBlockItemProps> = ({
  id,
  content,
  fontClass,
  isReadOnly = false,
  placeholder = "Write Markdown notes...",
  onChange,
  onFocus,
  onCursorChange,
  onKeyDown,
  autoFocus = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { slashCommandState, onOpenSlashCommand, onCloseSlashCommand } =
    useBlockEngineContext();

  // Auto-resize textarea to fit content without scrollbars
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(48, el.scrollHeight)}px`;
  };

  useEffect(() => {
    autoResize();
  }, [content]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(0, 0);
    }
  }, [autoFocus]);

  const checkSlashTrigger = (el: HTMLTextAreaElement) => {
    if (isReadOnly) return;
    const { selectionStart, selectionEnd, value } = el;
    if (selectionStart !== selectionEnd) {
      if (slashCommandState?.blockId === id) {
        onCloseSlashCommand?.();
      }
      return;
    }

    const textBefore = value.slice(0, selectionStart);
    const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);

    if (match) {
      const matchOffset = textBefore.length - match[0].length;
      const slashOffsetInMatch = match[0].indexOf("/");
      const slashIndex = matchOffset + slashOffsetInMatch;
      const query = match[1];

      const rect = el.getBoundingClientRect();
      const lineCount = textBefore.split("\n").length - 1;
      const lineHeight = 22;
      const position = {
        top: rect.top + Math.min(rect.height, (lineCount + 1) * lineHeight),
        left: Math.min(rect.left + 16, window.innerWidth - 300),
      };

      onOpenSlashCommand?.({
        blockId: id,
        query,
        slashIndex,
        cursorOffset: selectionStart,
        position,
      });
    } else {
      if (slashCommandState?.blockId === id) {
        onCloseSlashCommand?.();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(id, e.target.value);
    onCursorChange(e.target.selectionStart || 0, e.target.selectionEnd || 0);
    checkSlashTrigger(e.target);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    onCursorChange(target.selectionStart || 0, target.selectionEnd || 0);
    if (slashCommandState?.blockId === id) {
      checkSlashTrigger(target);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    onFocus(id, e.target.selectionStart || 0);
    onCursorChange(e.target.selectionStart || 0, e.target.selectionEnd || 0);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = textareaRef.current;
    if (!el) return;

    // If slash command is active for this block, intercept navigation keys
    if (
      slashCommandState &&
      slashCommandState.blockId === id &&
      ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)
    ) {
      e.preventDefault();
      return;
    }

    // Smart Enter list continuation
    if (e.key === "Enter" && !e.shiftKey) {
      const { selectionStart, selectionEnd, value } = el;
      const result = handleEditorEnter(value, selectionStart, selectionEnd);
      if (result.isListContinuation || result.isListExit) {
        e.preventDefault();
        onChange(id, result.newContent);
        onCursorChange(result.newCursorPosition);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(
              result.newCursorPosition,
              result.newCursorPosition
            );
            autoResize();
          }
        }, 0);
        return;
      }
    }

    // Tab and Shift+Tab indentation/outdentation
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = el;
      const result = handleEditorTab(value, selectionStart, selectionEnd, e.shiftKey);
      onChange(id, result.newContent);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(result.newStart, result.newEnd);
          onCursorChange(result.newStart);
          autoResize();
        }
      }, 0);
      return;
    }

    // Backspace at empty list marker
    if (e.key === "Backspace") {
      const { selectionStart, selectionEnd, value } = el;
      const result = handleEditorBackspace(value, selectionStart, selectionEnd);
      if (result && result.handled) {
        e.preventDefault();
        onChange(id, result.newContent);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(
              result.newCursorPosition,
              result.newCursorPosition
            );
            onCursorChange(result.newCursorPosition);
            autoResize();
          }
        }, 0);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className="relative group w-full mb-2">
      <textarea
        ref={textareaRef}
        data-block-id={id}
        value={content}
        onChange={handleChange}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onKeyUp={handleSelect}
        onClick={handleSelect}
        onKeyDown={handleKeyDownInternal}
        disabled={isReadOnly}
        placeholder={placeholder}
        rows={1}
        className={`w-full bg-transparent resize-none border-none outline-none focus:ring-0 leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 overflow-hidden ${fontClass}`}
      />
    </div>
  );
};
